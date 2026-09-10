// E2E — UNE QUESTION AJOUTÉE AU STUDIO SERT AUSSI AUX PARTIES SUIVANTES.
//
// CE QUI A ÉTÉ DEMANDÉ : « Faire en sorte que l'ajout et la modification de
// questions dans le Studio soit conservé dans la base. Les modifications ne
// doivent pas seulement s'appliquer à la partie en cours. Le studio doit être
// utilisé pour améliorer les jeux même pour les prochaines parties. »
//
// LE CONTRÔLE EXISTANT NE COUVRAIT QUE LES MODULES — un jeu supprimé, un jeu
// renommé. Rien ne gardait leurs QUESTIONS, qui sont pourtant ce qu'on vient
// modifier au studio entre deux soirées.
//
// TROIS CHOSES SE VÉRIFIENT ICI, ET LA TROISIÈME EST LA DEMANDE :
//   1. la question ajoutée survit à un rechargement du studio (elle est partie
//      au serveur, elle n'est pas restée dans l'écran) ;
//   2. elle survit à une relecture par une AUTRE surface (la console) ;
//   3. elle est réellement POSÉE dans une partie ouverte après coup.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer, creerJeu, retirerJeux, lancerJeu } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.setTimeout(120_000);

const JEU = 'Épreuve de mémoire du studio';
const ENONCE = 'Cette question a-t-elle survécu à la soirée ?';

test.describe('Les questions du studio', () => {
  let hote = null;
  const joueurs = [];

  test.afterEach(async () => {
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    for (const j of joueurs.splice(0)) await j.ctx.close();
    await retirerJeux(JEU);
  });

  test("une question ajoutée au studio est posée dans une partie ouverte APRÈS", async ({ browser, page }) => {
    // Un jeu à UNE question, pour que la question ajoutée soit la seule autre
    // candidate — sans quoi le tirage pourrait ne jamais la sortir.
    await creerJeu({
      name: JEU,
      type: 'quiz',
      questions: [{ text: 'La question de départ', options: ['a', 'b'], correctIndex: 0 }],
    });

    await page.goto('/studio');
    const carte = page.getByRole('article').filter({ hasText: JEU });
    await expect(carte).toBeVisible({ timeout: 15_000 });
    await carte.getByRole('button').first().click();
    const editeur = page.getByRole('complementary');
    await editeur.getByRole('button', { name: 'Ajouter une question' }).click();

    // La nouvelle question est vide : on la remplit entièrement, sinon
    // l'enregistrement est refusé — et ce refus est une autre histoire. Les
    // champs se désignent par leur invite : leurs étiquettes n'ont pas de `for`.
    await editeur.getByPlaceholder('Rédige la question…').last().fill(ENONCE);
    await editeur.getByLabel('Option 1', { exact: true }).last().fill('Oui');
    await editeur.getByLabel('Option 2', { exact: true }).last().fill('Non');
    await editeur.getByLabel('Option 1 est la bonne réponse').last().click();
    await editeur.getByRole('button', { name: /^Enregistrer/ }).click();
    await expect(editeur.getByRole('button', { name: /^Enregistré|^Enregistrer$/ })).toBeVisible({ timeout: 15_000 });

    // 1. ELLE SURVIT AU RECHARGEMENT. Vérifier que l'écran l'affiche encore ne
    // prouverait rien : l'écran l'affichait déjà avant d'enregistrer.
    await page.reload();
    const carte2 = page.getByRole('article').filter({ hasText: JEU });
    await expect(carte2, 'le jeu a disparu du studio').toBeVisible({ timeout: 15_000 });
    // La carte compte les questions du SERVEUR : deux, si l'ajout est parti.
    await expect(carte2, "la question ajoutée n'a pas survécu au rechargement")
      .toContainText('2 questions');

    // 2. ET UNE AUTRE SURFACE LA VOIT — la bibliothèque du serveur, pas un état
    // d'écran.
    const banque = await page.evaluate(async () => {
      const r = await fetch('/api/modules');
      return r.ok ? (await r.json()).modules : null;
    });
    const jeu = (banque || []).find((m) => m.name === JEU);
    expect(jeu, 'le jeu a disparu de la bibliothèque').toBeTruthy();
    expect(jeu.questions.map((q) => q.text), "la question ajoutée n'est pas dans la banque").toContain(ENONCE);

    // 3. ET ELLE EST POSÉE DANS UNE PARTIE OUVERTE APRÈS COUP. C'est la demande
    // même : « le studio doit servir à améliorer les jeux pour les prochaines
    // parties ». Deux questions, deux manches : la seconde est forcément la
    // nouvelle.
    hote = await openHost(browser);
    joueurs.push(await joinAsPlayer(browser, hote.code, 'Memoire'));
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await lancerJeu(hote.page, JEU);
    // ON ATTEND QUE L'ÉNONCÉ CHANGE, pas qu'il soit visible : entre deux manches
    // la console affiche encore celui de la précédente, et relever à cet instant
    // compte deux fois la même question — un faux rouge qui accuse le tirage.
    const enonce = hote.page.getByTestId('question-text');
    const vus = [];
    for (let manche = 1; manche <= 2; manche += 1) {
      await expect(enonce).toBeVisible({ timeout: 15_000 });
      await expect(enonce).not.toContainText('En attente', { timeout: 15_000 });
      if (vus.length) await expect(enonce).not.toHaveText(vus[vus.length - 1], { timeout: 15_000 });
      vus.push((await enonce.textContent()).trim());
      await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();
      if (manche === 1) await hote.page.getByRole('button', { name: 'Question suivante' }).click();
    }
    expect(vus, `manches posées : ${vus.join(' | ')}`).toContain(ENONCE);
  });
});
