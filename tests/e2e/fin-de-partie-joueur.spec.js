// E2E — LE JOUEUR N'A PLUS RIEN À CLIQUER POUR REJOUER (action 15 du PLAN-CHANTIER-v1).
//
// Deux boutons ont été retirés de l'écran joueur, et c'est le même défaut qui les
// condamnait : ils n'effaçaient que la session LOCALE sans prévenir le serveur.
// Le joueur restait inscrit dans le salon avec son pseudo et son score, mais
// perdait le jeton qui lui permettait d'y revenir — et se voyait refuser son propre
// pseudo à la reconnexion. Le bouton « Rejouer » appelait exactement cette
// fonction : celui qui promettait de rejouer était celui qui l'en empêchait.
//
// Ce qui les remplace n'est pas un autre bouton : quand l'animateur relance, le
// serveur ramène les joueurs au salon d'attente tout seul.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.describe('Fin de partie côté joueur', () => {
  let hote = null;
  let joueur = null;

  test.afterEach(async () => {
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    if (joueur) { await joueur.ctx.close(); joueur = null; }
  });

  test('après le podium, une relance ramène le joueur sans qu\'il touche à rien', async ({ browser }) => {
    hote = await openHost(browser);
    joueur = await joinAsPlayer(browser, hote.code, 'Fidele');

    // Une manche jouée, puis la partie terminée (podium affiché aux joueurs).
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem').first().click();
    await joueur.page.getByTestId('answer-option').first().click();
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();
    await hote.page.getByRole('button', { name: 'Voir le classement' }).click();
    await hote.page.getByRole('button', { name: 'Menu' }).click();
    await hote.page.getByRole('menuitem', { name: 'Terminer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: 'Confirmer — terminer la partie' }).click();

    // Le joueur est sur l'écran de fin, SANS aucun bouton qui détruirait sa session.
    await expect(joueur.page.getByTestId('end-screen')).toBeVisible();
    await expect(joueur.page.locator('[data-action="leave"]')).toHaveCount(0);
    await expect(joueur.page.locator('[data-action="replay"]')).toHaveCount(0);
    // À la place, on lui dit ce qui va se passer.
    await expect(joueur.page.locator('[data-bind="end.replayHint"]')).toBeVisible();

    // ---- L'ANIMATEUR RELANCE : le joueur revient tout seul ----
    // Un bouton dédié, hors du menu destructif : relancer n'est pas une action
    // dangereuse, elle ne demande donc pas de confirmation en deux temps.
    await hote.page.getByTestId('back-to-lobby').click();

    // Il retrouve le salon d'attente, toujours sous son pseudo — preuve que sa
    // session a survécu, ce que l'ancien bouton lui faisait perdre.
    await expect(joueur.page.getByTestId('player-count')).toBeVisible({ timeout: 15_000 });
    await expect(joueur.page.getByText('Fidele')).toBeVisible();
  });

  test('aucun bouton destructeur ne subsiste pendant la partie', async ({ browser }) => {
    hote = await openHost(browser);
    joueur = await joinAsPlayer(browser, hote.code, 'Sans');

    // Salle d'attente.
    await expect(joueur.page.locator('[data-action="leave"]')).toHaveCount(0);

    // Question en cours.
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem').first().click();
    await expect(joueur.page.getByTestId('question-text')).toBeVisible();
    await expect(joueur.page.locator('[data-action="leave"]')).toHaveCount(0);

    // Résultat de manche.
    await joueur.page.getByTestId('answer-option').first().click();
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();
    await expect(joueur.page.getByTestId('points-gained')).toBeVisible();
    await expect(joueur.page.locator('[data-action="leave"]')).toHaveCount(0);
  });
});
