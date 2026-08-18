// E2E — flux complet animateur + joueurs (F1/F2/F3) : M1, M3, M4, M5, M6, M7, M9, M10, M11.
// Deux contextes navigateur : l'animateur sur /host, les joueurs sur /.
import { test, expect } from '@playwright/test';
import { openHost } from './helpers.js';

test.describe('Partie complète animateur + joueurs', () => {
  test('création salon -> join -> quiz -> réponse -> révélation -> module suivant -> fin', async ({ browser }) => {
    // ---- M1 : l'animateur crée un salon avec code + QR ----
    const { ctx: hostCtx, page: host, code } = await openHost(browser);
    await expect(host.getByTestId('room-code')).toHaveText(code);
    expect(code).toMatch(/^[A-Z2-9]{5}$/);
    await expect(host.getByRole('img', { name: `QR code de la salle ${code}` })).toBeVisible();

    // ---- M2/F2 : une joueuse rejoint avec code + pseudo ----
    const p1Ctx = await browser.newContext();
    const p1 = await p1Ctx.newPage();
    await p1.goto(`/?code=${code}`);
    await p1.getByLabel('Ton pseudo').fill('Lea');
    await p1.getByRole('button', { name: 'Rejoindre' }).click();
    await expect(p1.getByText('Tu es connecté')).toBeVisible();
    await expect(host.getByTestId('player-count')).toHaveText('1');

    // ---- M4/M7 : l'animateur choisit et lance un module librement ----
    await host.getByRole('button', { name: 'Lancer la partie' }).click();
    await host.getByRole('button', { name: 'Quiz', exact: true }).click();
    await host.getByRole('button', { name: 'Lancer Quiz' }).click();

    // ---- M11/M9 : la joueuse voit la question et répond depuis sa manette ----
    await expect(p1.getByTestId('question-text')).toBeVisible();
    const firstAnswer = p1.getByRole('group', { name: 'Choisis ta réponse' }).getByRole('button').first();
    await firstAnswer.click();
    await expect(p1.getByText('Réponse envoyée')).toBeVisible();

    // ---- M10 : le dashboard animateur montre compteur de réponses + chrono ----
    await expect(host.getByTestId('answers-count')).toHaveText('1');
    await expect(host.getByText('temps restant')).toBeVisible();

    // ---- M3/F3 : un retardataire rejoint PENDANT la question en cours ----
    const p2Ctx = await browser.newContext();
    const p2 = await p2Ctx.newPage();
    await p2.goto('/');
    await p2.getByLabel('Code de la partie').fill(code);
    await p2.getByLabel('Ton pseudo').fill('Tard');
    await p2.getByRole('button', { name: 'Rejoindre' }).click();
    await expect(p2.getByTestId('question-text')).toBeVisible(); // intégré immédiatement

    // ---- M7 : révélation anticipée par l'animateur ----
    await host.getByRole('button', { name: 'Révéler maintenant' }).click();
    await expect(host.getByTestId('reveal-value')).toBeVisible();
    await expect(host.getByTestId('stats-panel')).toBeVisible(); // répartition des réponses

    // ---- M6 + R7 : la joueuse voit ses points et sa progression, JAMAIS son rang ----
    await expect(p1.getByTestId('points-gained')).toBeVisible();
    await expect(p1.getByTestId('places-delta')).toBeVisible();
    await expect(p1.getByText('Bonne réponse', { exact: false })).toBeVisible();
    await expect(p1.getByText('Ton rang')).toHaveCount(0); // rang masqué en cours de partie

    // ---- M6 : classement recalculé côté animateur ----
    await expect(host.getByText('Top 5 en direct')).toBeVisible();
    await expect(host.getByText('Lea')).toBeVisible();

    // ---- M4/M5 : enchaîner librement sur un AUTRE module (Vrai/Faux) via le menu ----
    await host.getByRole('button', { name: 'Changer de module' }).click();
    await host.getByRole('menuitem', { name: 'Vrai / Faux' }).click();
    await expect(p1.getByRole('button', { name: /Vrai/ })).toBeVisible();
    await p1.getByRole('button', { name: /Vrai/ }).click();
    await host.getByRole('button', { name: 'Révéler maintenant' }).click();
    await expect(p1.getByTestId('points-gained')).toBeVisible();

    // ---- M7/F1 : classement puis fin de partie (menu à confirmation en 2 temps) ----
    await host.getByRole('button', { name: 'Voir le classement' }).click();
    await expect(host.getByRole('heading', { name: 'Classement' })).toBeVisible();
    await host.getByRole('button', { name: 'Menu' }).click();
    await host.getByRole('menuitem', { name: 'Terminer la partie' }).click();
    await host.getByRole('menuitem', { name: 'Confirmer — terminer la partie' }).click();

    // Le rang FINAL est visible côté joueur (seul moment autorisé).
    await expect(p1.getByTestId('end-screen')).toBeVisible();
    await expect(p1.getByText('Ton rang final')).toBeVisible();

    await hostCtx.close();
    await p1Ctx.close();
    await p2Ctx.close();
  });
});
