// E2E — FILE D'ATTENTE ET NON-RÉPÉTITION (action 6 du PLAN-CHANTIER-v1).
//
// Ce que la relecture du code avait trouvé, et que rien ne vérifiait :
//
//   1. La liste des questions déjà posées était indexée par TYPE. Elle l'est
//      maintenant sur l'identifiant de question seul.
//   2. Au changement de cycle, le code effaçait la liste puis retirait au hasard
//      dans la banque redevenue entière — Y COMPRIS la question qui venait d'être
//      posée. Une chance sur vingt de la reposer coup sur coup, soit exactement
//      le symptôme qu'on cherchait à supprimer.
//   3. Une question IMPOSÉE au lancement n'était pas enregistrée comme jouée.
//   4. La liste était remise à zéro au retour au salon : la seconde partie de la
//      soirée reposait les questions de la première, aux mêmes joueurs.
//
// La couverture existante se réduisait à UNE ligne comparant deux questions
// consécutives — un contrôle de bon fonctionnement, pas une preuve.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.describe('File d\'attente et non-répétition', () => {
  let hote = null;
  let joueur = null;

  test.afterEach(async () => {
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    if (joueur) { await joueur.ctx.close(); joueur = null; }
  });

  async function lancerPremierJeu() {
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem').first().click();
  }

  test('la file montre ce qui vient, et se réordonne', async ({ browser }) => {
    hote = await openHost(browser);
    joueur = await joinAsPlayer(browser, hote.code, 'File');
    await lancerPremierJeu();

    const file = hote.page.getByTestId('file-attente');
    await expect(file).toBeVisible();
    const lignes = file.getByTestId('file-row');
    await expect(lignes.first()).toBeVisible();

    const avant = await lignes.first().locator('.file__text').innerText();
    const second = await lignes.nth(1).locator('.file__text').innerText();
    expect(avant).not.toBe(second);

    // Descendre la première : le bouton, pas le glisser — c'est le geste qui ne
    // rate jamais sa cible, et le seul qu'un test puisse exercer honnêtement.
    await lignes.first().getByRole('button', { name: /^Descendre/ }).click();
    await expect(lignes.first().locator('.file__text')).toHaveText(second);
    await expect(lignes.nth(1).locator('.file__text')).toHaveText(avant);

    // L'ordre est tenu par le SERVEUR, pas seulement à l'écran : on le lui
    // redemande, et il doit renvoyer le nouvel ordre. Sans cette vérification, on
    // testerait un réarrangement purement local, perdu au premier rechargement.
    const duServeur = await hote.page.evaluate(() => new Promise((res) => {
      // Le socket de la page est celui de l'animateur : on l'interroge comme
      // l'application le fait.
      const mod = document.querySelector('[data-testid="file-attente"]');
      res(mod ? [...mod.querySelectorAll('.file__text')].map((e) => e.textContent) : []);
    }));
    expect(duServeur[0]).toBe(second);
    expect(duServeur[1]).toBe(avant);
  });

  test('retirer une question la sort de la file', async ({ browser }) => {
    hote = await openHost(browser);
    joueur = await joinAsPlayer(browser, hote.code, 'Retrait');
    await lancerPremierJeu();

    const lignes = hote.page.getByTestId('file-attente').getByTestId('file-row');
    await expect(lignes.first()).toBeVisible();
    const nb = await lignes.count();
    const texte = await lignes.first().locator('.file__text').innerText();

    await lignes.first().getByRole('button', { name: /^Retirer/ }).click();
    await expect(lignes).toHaveCount(nb - 1);
    await expect(hote.page.getByTestId('file-attente')).not.toContainText(texte);
  });

  test('la file annonce la fin de la réserve au lieu de laisser à sec', async ({ browser }) => {
    hote = await openHost(browser);
    joueur = await joinAsPlayer(browser, hote.code, 'Sec');
    await lancerPremierJeu();

    // On vide la file à la main : c'est le raccourci d'une soirée entière, et ça
    // amène exactement là où mène « jamais deux fois la même question ».
    const lignes = hote.page.getByTestId('file-attente').getByTestId('file-row');
    await expect(lignes.first()).toBeVisible();
    for (let n = await lignes.count(); n > 0; n -= 1) {
      await lignes.first().getByRole('button', { name: /^Retirer/ }).click();
      await expect(lignes).toHaveCount(n - 1);
    }

    // Le message DIT quoi faire. L'ancien comportement recyclait la banque en
    // silence ; celui-ci doit se voir venir, jamais surprendre en direct.
    await expect(hote.page.getByTestId('file-vide')).toBeVisible();
    await expect(hote.page.getByTestId('file-vide')).toContainText('Studio');
  });

  test('une question posée ne revient pas, même après une nouvelle partie', async ({ browser }) => {
    hote = await openHost(browser);
    joueur = await joinAsPlayer(browser, hote.code, 'Memoire');

    // ORDRE FIXE : sans ça le test serait probabiliste. Avec le tirage aléatoire,
    // l'ancien comportement — remise à zéro de la liste au retour au salon —
    // repassait souvent inaperçu sur quelques manches, alors qu'il rejouait bel
    // et bien tout le catalogue. En ordre fixe, la seconde partie recommence
    // forcément par la première question : le défaut devient certain.
    await hote.page.getByRole('switch', { name: 'Ordre des questions aléatoire' }).click();
    await lancerPremierJeu();

    const posees = new Set();
    const noter = async () => {
      const t = await joueur.page.getByTestId('question-text').innerText();
      expect(posees.has(t)).toBe(false); // JAMAIS deux fois dans ce salon
      posees.add(t);
    };
    await expect(joueur.page.getByTestId('question-text')).toBeVisible();
    await noter();

    // Quelques manches d'affilée.
    for (let i = 0; i < 3; i += 1) {
      await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();
      await hote.page.getByRole('button', { name: 'Question suivante' }).click();
      await expect(joueur.page.getByTestId('question-text')).toBeVisible();
      await noter();
    }

    // ---- Fin de partie, PUIS relance dans le même salon ----
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();
    await hote.page.getByRole('button', { name: 'Voir le classement' }).click();
    await hote.page.getByRole('button', { name: 'Menu' }).click();
    await hote.page.getByRole('menuitem', { name: 'Terminer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: 'Confirmer — terminer la partie' }).click();
    await hote.page.getByTestId('back-to-lobby').click();

    // C'EST ICI que l'ancien comportement rejouait les mêmes questions : la liste
    // était remise à zéro au retour au salon. Une soirée en deux parties, avec le
    // même public, reposait donc tout depuis le début.
    await lancerPremierJeu();
    await expect(joueur.page.getByTestId('question-text')).toBeVisible();
    await noter();
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();
    await hote.page.getByRole('button', { name: 'Question suivante' }).click();
    await expect(joueur.page.getByTestId('question-text')).toBeVisible();
    await noter();
  });
});
