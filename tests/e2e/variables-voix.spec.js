// E2E — AUCUNE ACCOLADE NE DOIT ARRIVER JUSQU'À UN JOUEUR (A30, A6).
//
// CE QUI A ÉTÉ RAPPORTÉ : « {serie} s'affiche vraiment en tant que {serie} dans le
// texte. Le nombre de série n'est pas hérité. » Et, dans le compte rendu de
// séance : « Dans les phrases de fin de partie, {rang} ne doit pas être écrit
// mais doit indiquer le rang du joueur dans le classement. »
//
// CE QUE C'ÉTAIT. `dire()` substituait `{clé}` quand la valeur était fournie et
// laissait le texte brut sinon, sans rien signaler. Or `usePhraseDeManche`
// recevait ses valeurs en paramètres POSITIONNELS et n'avait pas de paramètre
// `rang` du tout : l'écran de fin appelait `usePhraseDeManche(momentFin,
// momentFin)` — deux arguments sur cinq. Sept phrases de `fin.podium` et
// `fin.classe` affichaient donc l'accolade en clair à TOUT joueur classé, À
// CHAQUE FIN DE PARTIE.
//
// POURQUOI CE CONTRÔLE VA JUSQU'AU CLASSEMENT FINAL. Deux contrôles unitaires
// vérifient déjà le registre et la substitution. Ni l'un ni l'autre ne peut voir
// ce qui a réellement cassé : le CÂBLAGE entre l'écran et la voix. Seule une
// partie menée jusqu'au bout traverse ce câblage.
//
// Il balaie le texte de l'écran plutôt qu'une phrase nommée : la voix tire au
// sort, et viser une phrase précise rendrait le contrôle instable une fois sur
// quatre. Ce qu'on affirme n'est pas « telle phrase est là » mais « aucune
// accolade nulle part » — c'est exactement la garantie qu'on veut.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer, lancerJeu } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.setTimeout(120_000);

// Un repère non substitué : { suivi de lettres puis }. Volontairement étroit —
// une accolade dans un pseudo ou une énumération ne doit pas faire rougir.
const ACCOLADE = /\{\w+\}/;

async function sansAccolade(page, ou) {
  const texte = await page.locator('body').innerText();
  const trouve = texte.match(ACCOLADE);
  if (trouve) {
    const i = texte.indexOf(trouve[0]);
    console.log(`  ${ou} → ACCOLADE « ${trouve[0] } » dans « …${texte.slice(Math.max(0, i - 60), i + 60).replace(/\n/g, ' ')}… »`);
  }
  expect(trouve, `un repère de voix non substitué est affiché sur ${ou} : ${trouve && trouve[0]}`).toBeNull();
}

test.describe('Les variables de la voix', () => {
  let hote = null;
  const joueurs = [];

  test.afterEach(async () => {
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    for (const j of joueurs.splice(0)) await j.ctx.close();
  });

  test('de la première manche au classement final, aucun repère brut', async ({ browser }) => {
    hote = await openHost(browser);
    // DEUX joueurs : il faut un classement pour que `{rang}` ait un sens, donc
    // quelqu'un devant ou derrière. Avec un seul, `fin.podium` se déclenche mais
    // le cas « classé hors podium » — `fin.classe`, quatre phrases sur quatre
    // citant {rang} — ne serait jamais atteint.
    joueurs.push(await joinAsPlayer(browser, hote.code, 'Devant'));
    joueurs.push(await joinAsPlayer(browser, hote.code, 'Derriere'));
    await expect(hote.page.getByTestId('player-count')).toHaveText('2');

    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();

    // TROIS MANCHES, pour que « Devant » enchaîne une SÉRIE de 2 puis 3 — c'est
    // la condition de `juste.serie`, donc de {serie}. Une seule manche ne
    // l'atteindrait pas, et le contrôle passerait sans avoir rien regardé.
    for (let manche = 1; manche <= 3; manche += 1) {
      if (manche === 1) await lancerJeu(hote.page, 'Quiz');
      else await hote.page.getByRole('button', { name: 'Question suivante' }).click();

      await expect(joueurs[0].page.getByTestId('question-text')).toBeVisible({ timeout: 15_000 });
      // « Devant » répond à tout ; « Derriere » se tait à la dernière manche,
      // pour finir derrière et passer par `fin.classe` ou `fin.dernier`.
      await joueurs[0].page.getByTestId('answer-option').first().click();
      if (manche < 3) await joueurs[1].page.getByTestId('answer-option').nth(1).click();
      await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();

      for (const j of joueurs) {
        await expect(j.page.getByTestId('round-result')).toBeVisible({ timeout: 15_000 })
          .catch(() => {}); // certains écrans de résultat n'ont pas ce repère
        await sansAccolade(j.page, `manche ${manche}, écran joueur`);
      }
      await sansAccolade(hote.page, `manche ${manche}, console`);
    }

    // ---- LE CLASSEMENT FINAL : là où {rang} vivait, et mourait ----
    await hote.page.getByRole('button', { name: 'Voir le classement' }).click();
    await hote.page.getByRole('button', { name: 'Menu' }).click();
    await hote.page.getByRole('menuitem', { name: 'Terminer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: 'Confirmer — terminer la partie' }).click();

    for (const j of joueurs) {
      await expect(j.page.getByTestId('end-screen')).toBeVisible({ timeout: 15_000 });
      await sansAccolade(j.page, 'l\'écran de fin');
    }
    await sansAccolade(hote.page, 'la console, partie terminée');
  });
});
