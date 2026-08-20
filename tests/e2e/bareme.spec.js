// E2E — LE BARÈME SE LIT ET SE DIT (actions 8 et 17 du PLAN-CHANTIER-v1).
//
// Ce qui a été corrigé, et pourquoi le défaut n'était pas un défaut de calcul :
// le bonus de série était bien versé, mais FUSIONNÉ avec le bonus de vitesse et
// affiché sous ce nom. Un joueur en série de trois lisait « bonus vitesse +100 »
// sans avoir été rapide, pendant que la case « Série » affichait « ×3 » sans le
// moindre point en face. D'où la conviction, en test, qu'il n'arrivait pas.
//
// Décisions appliquées ici :
//   - la série ne rapporte plus rien, elle est comptée et affichée (T3) ;
//   - plus aucune pénalité, dans aucun jeu (T1) ;
//   - les points se lisent en deux lignes : base + complément de vitesse (T2) ;
//   - le barème est ÉNONCÉ au joueur, ce qu'il n'était nulle part (action 8) ;
//   - le panneau « Bonus / Malus » de l'animateur est supprimé (action 8).
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.describe('Barème', () => {
  let hote = null;
  let joueur = null;

  test.afterEach(async () => {
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    if (joueur) { await joueur.ctx.close(); joueur = null; }
  });

  test('le joueur peut lire les règles de points pendant l\'attente', async ({ browser }) => {
    hote = await openHost(browser);
    joueur = await joinAsPlayer(browser, hote.code, 'Curieux');

    const regles = joueur.page.getByTestId('scoring-rules');
    await expect(regles).toBeVisible();
    // Replié par défaut : l'écran d'attente reste épuré.
    await expect(regles.getByRole('list')).toBeHidden();

    await regles.getByText('Comment on marque des points').click();
    const liste = regles.getByRole('list');
    await expect(liste).toBeVisible();
    // L'énoncé doit décrire le barème RÉELLEMENT appliqué, pas un souvenir.
    await expect(liste).toContainText('700');
    await expect(liste).toContainText('300');
    await expect(liste).toContainText('150');
    await expect(liste).toContainText('ne coûte rien');
  });

  test('les points se lisent en deux lignes, sans pénalité ni bonus de série', async ({ browser }) => {
    hote = await openHost(browser);
    joueur = await joinAsPlayer(browser, hote.code, 'Compte');

    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: 'Lancer Quiz' }).click();
    await joueur.page.getByTestId('answer-option').first().click();
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();
    await expect(joueur.page.getByTestId('points-gained')).toBeVisible();

    // Aucune case « Malus » nulle part : la notion n'existe plus.
    await expect(joueur.page.getByText('Malus')).toHaveCount(0);
    // Et plus de « Bonus vitesse », dont le nom mentait sur son contenu.
    await expect(joueur.page.getByText('Bonus vitesse')).toHaveCount(0);

    // Seul le joueur ayant répondu juste voit un détail ; sinon rien à afficher.
    const base = joueur.page.getByTestId('points-base');
    if (await base.count()) {
      await expect(joueur.page.getByText('Complément de vitesse')).toBeVisible();
      // Base fixe : elle ne dépend pas de la rapidité.
      await expect(base).toHaveText('700');
    }
  });

  test('l\'animateur n\'a plus de panneau de correction de score', async ({ browser }) => {
    hote = await openHost(browser);
    joueur = await joinAsPlayer(browser, hote.code, 'Intouchable');

    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: 'Lancer Quiz' }).click();
    await joueur.page.getByTestId('answer-option').first().click();
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();

    // Le panneau, son titre et ses boutons ont disparu — pas seulement l'un d'eux.
    await expect(hote.page.getByRole('region', { name: 'Bonus et malus' })).toHaveCount(0);
    await expect(hote.page.locator('[data-action^="host:adjustScore"]')).toHaveCount(0);
    // Le classement en direct, lui, reste : c'est un outil, pas une correction.
    await expect(hote.page.getByTestId('host-leaderboard')).toBeVisible();
  });
});
