// E2E — UNE PHRASE, PAS LA LISTE (chantier v3, décisions 5 et 6).
//
// CE QUI A ÉTÉ RAPPORTÉ EN TEST : « Lorsqu'un joueur gagne, ou répond bien, tous
// les messages contextuels apparaissent à la suite en une seconde. Ce n'est pas
// un message parmi la liste qui est sélectionné. »
//
// POURQUOI AUCUN CONTRÔLE NE POUVAIT LE VOIR. Le défaut n'existe QUE DANS LE
// TEMPS. À n'importe quel instant pris isolément, l'écran montre une phrase
// parfaitement valide — c'est sa succession qui est fautive. Une assertion
// classique, qui regarde l'écran une fois, passe au vert sans rien voir. Le
// contrôle de la voix écrit au chantier v1 faisait exactement cela.
//
// D'OÙ L'ÉCHANTILLONNAGE : on relève la phrase toutes les 30 ms pendant 1,4 s —
// l'animation du score dure 900 ms, c'est la fenêtre exacte où le défaut se
// produisait — et on compte les valeurs distinctes.
//
// ET POURQUOI IL FAUT GAGNER DES POINTS. `useCountUp` n'anime rien si le gain est
// nul. Une mauvaise réponse ne coûtant rien depuis la décision T1 du chantier v1,
// elle ne déclenchait pas la boucle d'images, donc pas le défilement. Le contrôle
// crée donc une question à réponse CONNUE, pour que le joueur gagne à coup sûr :
// répondre au hasard laisserait le défaut hors de portée une fois sur quatre.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer } from './helpers.js';
import { terminerPartie } from './cloture.js';

const JEU = 'Épreuve de voix';
const ENONCE = 'Quelle est la couleur de la braise du contrôle de voix ?';
const BONNE = 'Orange-V3';

// Relève la phrase à intervalle serré et rend les valeurs distinctes, dans leur
// ordre d'apparition.
async function echantillonner(page, duree = 1400, pas = 30) {
  const vues = [];
  const fin = Date.now() + duree;
  while (Date.now() < fin) {
    const t = (await page.getByTestId('voix-resultat').textContent().catch(() => null))?.trim();
    if (t && (vues.length === 0 || vues[vues.length - 1] !== t)) vues.push(t);
    await page.waitForTimeout(pas);
  }
  return vues;
}

test.describe('La voix du résultat', () => {
  let hote = null;
  let joueur = null;

  test.afterEach(async () => {
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    if (joueur) { await joueur.ctx.close(); joueur = null; }
  });

  test('une seule phrase pendant toute l\'animation du score', async ({ browser, page }) => {
    // ---- Une question dont on connaît la bonne réponse, pour gagner à coup sûr.
    await page.goto('/studio');
    await page.getByLabel('Gestion des modules')
      .getByRole('button', { name: 'Nouveau module' }).click();
    const editeur = page.getByRole('complementary');
    await expect(editeur).toBeVisible();
    await editeur.getByLabel('Nom').fill(JEU);
    await editeur.getByRole('button', { name: 'Ajouter une question' }).click();
    await editeur.getByPlaceholder('Rédige la question').fill(ENONCE);
    await editeur.getByLabel('Option 1', { exact: true }).fill(BONNE);
    await editeur.getByLabel('Option 2', { exact: true }).fill('Bleu-0000');
    await editeur.getByLabel('Option 3', { exact: true }).fill('Vert-1111');
    await editeur.getByLabel('Option 4', { exact: true }).fill('Gris-2222');
    await editeur.getByRole('radio', { name: 'Option 1 est la bonne réponse' }).click();
    await editeur.getByRole('button', { name: /^Enregistrer$/ }).click();
    await expect(editeur.locator('[data-bind="module.validation"]')).toHaveCount(0);

    // ---- La partie.
    hote = await openHost(browser);
    joueur = await joinAsPlayer(browser, hote.code, 'Voix');
    await expect(hote.page.getByTestId('player-count')).toContainText('1');
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: `Lancer ${JEU}` }).click();

    await expect(joueur.page.getByTestId('question-text')).toHaveText(ENONCE);
    await joueur.page.getByRole('button', { name: BONNE }).click();
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();
    await expect(joueur.page.getByTestId('voix-resultat')).toBeVisible({ timeout: 10_000 });

    // Le gain doit être POSITIF : sans cela l'animation ne démarre pas et le
    // contrôle ne mesurerait rien. On le vérifie plutôt que de l'espérer.
    const gain = (await joueur.page.locator('.gain__value').textContent())?.trim() || '';
    expect(gain, `le joueur n'a pas gagné de points (${gain}) — rien à mesurer`).toMatch(/^\+/);

    // C'EST ICI QUE TOUT SE JOUE.
    const vues = await echantillonner(joueur.page);
    console.log(`  ${vues.length} phrase(s) distincte(s) pendant l'animation : ${vues.join(' | ')}`);
    expect(vues.length,
      `la voix a dit ${vues.length} phrases au lieu d'une :\n${vues.join('\n')}`).toBe(1);
  });

  test('la phrase est retirée à chaque manche, pas gelée sur la première', async ({ browser }) => {
    // Le revers du contrôle précédent : figer la phrase ne doit pas la figer POUR
    // TOUJOURS. Sans cette vérification, un état sans dépendance passerait le
    // premier contrôle et serait pourtant faux.
    hote = await openHost(browser);
    joueur = await joinAsPlayer(browser, hote.code, 'Voix2');
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: 'Lancer Quiz' }).click();

    const phrases = [];
    for (let manche = 0; manche < 3; manche += 1) {
      if (manche > 0) {
        await hote.page.getByRole('button', { name: 'Question suivante' }).click();
      }
      await expect(joueur.page.getByTestId('answer-option').first()).toBeVisible({ timeout: 10_000 });
      await joueur.page.getByTestId('answer-option').first().click();
      await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();
      await expect(joueur.page.getByTestId('voix-resultat')).toBeVisible({ timeout: 10_000 });
      await joueur.page.waitForTimeout(1200);
      phrases.push((await joueur.page.getByTestId('voix-resultat').textContent())?.trim());
    }
    console.log(`  trois manches : ${phrases.map((p) => `« ${p} »`).join(' · ')}`);
    expect(new Set(phrases).size,
      `la même phrase sur trois manches : ${phrases.join(' | ')}`).toBeGreaterThan(1);
  });
});
