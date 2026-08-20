// E2E — LE VOTE EST DEVENU UN JEU (action 18 du PLAN-CHANTIER-v1).
//
// Avant : le vote ne rapportait que des points de participation, sans notion de
// bonne réponse, et servait uniquement à choisir la suite de la soirée.
// Maintenant : la majorité l'emporte. Être minoritaire ne coûte rien — c'est un
// pari perdu, pas une faute. Aucun complément de vitesse : on ne devine pas plus
// vite ce que pense la salle, et la prime pousserait à cliquer avant d'avoir lu.
//
// Ce que le changement coûte, et que l'interrupteur préserve : un vote noté n'est
// plus un sondage. Le joueur ne répond plus ce qu'il pense mais ce qu'il croit que
// les autres vont répondre. Chaque question peut donc rester un vrai sondage.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.describe('Module vote', () => {
  let hote = null;
  const joueurs = [];

  test.afterEach(async () => {
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    for (const j of joueurs.splice(0)) await j.ctx.close();
  });

  test('la majorité marque, la minorité ne perd rien', async ({ browser }) => {
    hote = await openHost(browser);
    for (const nom of ['Majo1', 'Majo2', 'Mino']) {
      joueurs.push(await joinAsPlayer(browser, hote.code, nom));
    }
    await expect(hote.page.getByTestId('player-count')).toHaveText('3');

    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: 'Lancer Vote' }).click();
    await expect(joueurs[0].page.getByTestId('question-text')).toBeVisible();

    // Deux voix sur la première option, une sur la seconde.
    await joueurs[0].page.getByTestId('answer-option').nth(0).click();
    await joueurs[1].page.getByTestId('answer-option').nth(0).click();
    await joueurs[2].page.getByTestId('answer-option').nth(1).click();
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();

    // Les majoritaires marquent la base d'une bonne réponse.
    await expect(joueurs[0].page.getByTestId('points-gained')).toHaveText('+700');
    // Le minoritaire ne marque rien — et ne perd rien : zéro, pas moins.
    await expect(joueurs[2].page.getByTestId('points-gained')).toHaveText('0');
  });

  test('le studio permet de repasser une question en sondage', async ({ browser, page }) => {
    await page.goto('/studio');

    // On ouvre le module de vote livré d'office et on y ajoute une question :
    // plus déterministe que d'aller déplier une question existante, et ça place
    // l'éditeur exactement là où vit l'interrupteur.
    await page.getByRole('article').filter({ hasText: 'Vote' }).first()
      .getByRole('button').first().click();
    const editeur = page.getByRole('complementary');
    await expect(editeur).toBeVisible();
    await editeur.getByRole('button', { name: 'Ajouter une question' }).click();

    // L'interrupteur existe, et il est sur « jeu » par défaut.
    const choix = editeur.getByRole('radiogroup', { name: 'Nature du vote' });
    await expect(choix).toBeVisible();
    await expect(choix.getByRole('radio', { name: 'Rapporte des points' })).toHaveAttribute('aria-checked', 'true');

    // Bascule en sondage : la conséquence est énoncée, pas seulement cochée.
    await choix.getByRole('radio', { name: 'Sondage sans points' }).click();
    await expect(choix.getByRole('radio', { name: 'Sondage sans points' })).toHaveAttribute('aria-checked', 'true');
    await expect(editeur.getByText('Personne ne gagne')).toBeVisible();
  });
});
