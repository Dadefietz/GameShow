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
import { openHost, joinAsPlayer, lancerJeu } from './helpers.js';
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
    await lancerJeu(hote.page);
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

  test('LE GLISSER TRAVERSE TOUTE LA FILE : la question 20 remonte en tête d\'un seul geste', async ({ browser }) => {
    // LE DÉFAUT DU 26/09 : « impossible de la tirer en dehors de l'écran dans
    // lequel on la voit […] si je dois tirer la question 20 et la pousser à la
    // position 10, impossible : c'est trop long. Je dois m'y prendre trois fois. »
    // Deux causes : le défilement automatique ne tournait qu'au MOUVEMENT du
    // pointeur — tenu immobile au bord, il s'arrêtait —, et le rang visé ne
    // comptait pas le défilement parcouru, si bien que la ligne ne pouvait pas
    // quitter la portion de liste visible au départ.
    //
    // UNE VRAIE SOURIS, et c'est indispensable : le glisser capture le pointeur,
    // et un événement fabriqué n'a pas de pointeur à capturer.
    hote = await openHost(browser);
    joueur = await joinAsPlayer(browser, hote.code, 'Glisse');
    await lancerPremierJeu();
    const page = hote.page;
    const liste = page.locator('ol.file');
    const lignes = page.getByTestId('file-attente').getByTestId('file-row');
    await expect(lignes.first()).toBeVisible();
    const n = await lignes.count();
    expect(n, 'il faut une file plus longue que ce qui est visible').toBeGreaterThan(10);
    const [haute, totale] = await liste.evaluate((l) => [l.clientHeight, l.scrollHeight]);
    expect(totale, 'la file tient entière à l’écran : le contrôle ne prouverait rien').toBeGreaterThan(haute * 2);

    // La dernière question, poignée en main. LA FILE D'ABORD À L'ÉCRAN : dans la
    // fenêtre de 1280 × 720 du contrôle, elle commence sous le pli, et une souris
    // ne saisit pas ce qu'elle ne voit pas.
    await liste.scrollIntoViewIfNeeded();
    await liste.evaluate((l) => { l.scrollTop = l.scrollHeight; });
    const derniere = lignes.nth(n - 1);
    const texte = await derniere.locator('.file__text').innerText();
    const poignee = await derniere.locator('.file__grip').boundingBox();
    const cadre = await liste.boundingBox();
    await page.mouse.move(poignee.x + poignee.width / 2, poignee.y + poignee.height / 2);
    await page.mouse.down();
    // On monte jusqu'au bord haut de la liste… et on n'y bouge PLUS.
    await page.mouse.move(poignee.x + poignee.width / 2, cadre.y + 8, { steps: 12 });
    await expect.poll(() => liste.evaluate((l) => l.scrollTop), {
      message: 'la liste ne défile pas sous un pointeur tenu immobile au bord', timeout: 5000,
    }).toBe(0);
    await page.mouse.up();

    // Elle est arrivée en tête — pas un rang plus haut que là où elle était.
    await expect.poll(async () => (await lignes.locator('.file__text').allInnerTexts()).indexOf(texte), {
      message: 'la question tenue n’a pas quitté le bas de la file', timeout: 5000,
    }).toBeLessThanOrEqual(1);
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

    // L'ORDRE EST TOUJOURS TIRÉ AU SORT depuis le 26/09 — l'interrupteur qui
    // permettait de le figer a disparu avec la colonne « Séance ». Ce contrôle
    // s'appuyait sur l'ordre fixe pour rendre le défaut certain ; il le rend
    // certain autrement, plus bas : en lisant LA FILE de la seconde partie, qui
    // ne doit contenir AUCUNE des questions déjà posées. Une file remise à zéro
    // les contiendrait toutes, quel que soit le tirage.
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
    const fileSeconde = await hote.page.getByTestId('file-attente').locator('.file__text').allInnerTexts();
    expect(fileSeconde.filter((t) => posees.has(t)),
      'la file de la seconde partie repropose des questions déjà posées').toEqual([]);
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();
    await hote.page.getByRole('button', { name: 'Question suivante' }).click();
    await expect(joueur.page.getByTestId('question-text')).toBeVisible();
    await noter();
  });
});
