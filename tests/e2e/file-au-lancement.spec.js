// E2E — LE BLOC « À VENIR » : POUR QUI, ET À QUEL MOMENT.
//
// DEUX DEMANDES DE LA MÊME SÉANCE, qui portent sur le même bloc et se répondent :
//
//   « Pour les jeux sans questions (hors Quiz, Vrai / Faux, Vote, Estimation),
//     supprimer le bloc "à venir" de l'écran de l'animateur. »
//   « Lors du lancement des jeux à questions, l'animateur doit avoir la
//     possibilité de choisir la 1ère question. Il faut donc que le bloc "à venir"
//     apparaisse au lancement d'un jeu à questions. »
//
// Autrement dit le bloc change de destinataire ET de moment : il disparaît là où
// il n'a rien à montrer, et il arrive plus tôt là où il sert.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer, lancerJeu } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.setTimeout(120_000);

test.describe('La file des questions', () => {
  let hote = null;
  const joueurs = [];

  test.afterEach(async () => {
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    for (const j of joueurs.splice(0)) await j.ctx.close();
  });

  async function ouvrir(browser) {
    hote = await openHost(browser);
    joueurs.push(await joinAsPlayer(browser, hote.code, 'File'));
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
  }

  test("s'ouvre AVANT le départ d'un jeu à questions, pour choisir la première", async ({ browser }) => {
    await ouvrir(browser);
    // Le clic du menu annonce le jeu ; le panneau de départ s'affiche, et la file
    // avec lui. `lancerJeu` donnerait le départ : ici on veut l'instant d'avant.
    await hote.page.getByRole('menuitem', { name: 'Lancer Quiz' }).first().click();
    await expect(hote.page.getByTestId('depart-simple')).toBeVisible({ timeout: 15_000 });

    const file = hote.page.getByTestId('file-attente');
    await expect(file, "la file n'est pas là au moment de choisir").toBeVisible({ timeout: 15_000 });
    const lignes = file.getByTestId('file-row');
    await expect(lignes.first()).toBeVisible({ timeout: 15_000 });

    // ET ON PEUT VRAIMENT CHOISIR : la deuxième question monte en tête, et c'est
    // elle que la manche pose. Sans ce dernier pas, le bloc ne serait qu'un
    // affichage — la demande, c'est de choisir.
    const texteSecond = (await lignes.nth(1).locator('.file__text').textContent()).trim();
    await lignes.nth(1).getByRole('button', { name: /^Monter / }).click();
    await expect(lignes.first().locator('.file__text')).toHaveText(texteSecond);

    await hote.page.getByTestId('simple-demarrer').click();
    const enonce = hote.page.getByTestId('question-text');
    await expect(enonce).toBeVisible({ timeout: 15_000 });
    await expect(enonce, "la question choisie n'est pas celle qui a été posée")
      .toHaveText(texteSecond, { timeout: 15_000 });
  });

  test("disparaît des jeux qui n'ont pas de banque", async ({ browser }) => {
    // « Le lien » n'a pas de questions et n'en aura jamais : sa file affichait
    // « Plus aucune question fraîche — ajoute des questions au Studio », un
    // conseil impossible à suivre, sur l'écran le plus chargé du projet.
    await ouvrir(browser);
    await hote.page.getByRole('menuitem', { name: 'Lancer Le lien' }).first().click();
    await expect(hote.page.getByTestId('saisie-lien')).toBeVisible({ timeout: 15_000 });
    await expect(hote.page.getByTestId('file-attente'),
      "la file s'affiche sur un jeu sans banque").toHaveCount(0);

    await hote.page.getByTestId('lien-mot1').fill('Feu');
    await hote.page.getByTestId('lien-mot2').fill('Bois');
    await hote.page.getByTestId('lien-diffuser').click();
    await expect(joueurs[0].page.getByTestId('question-text')).toBeVisible({ timeout: 15_000 });
    await expect(hote.page.getByTestId('file-attente'),
      "la file revient une fois la manche lancée").toHaveCount(0);
  });

  test('reste présente pendant la manche d\'un jeu à questions', async ({ browser }) => {
    // Le contrepoint du contrôle précédent : on retire le bloc là où il ne sert à
    // rien, pas partout.
    await ouvrir(browser);
    await lancerJeu(hote.page, 'Quiz');
    await expect(hote.page.getByTestId('question-text')).toBeVisible({ timeout: 15_000 });
    await expect(hote.page.getByTestId('file-attente')).toBeVisible();
  });
});
