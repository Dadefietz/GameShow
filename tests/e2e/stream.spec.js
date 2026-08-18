// E2E — M8/M9 : page stream (source navigateur OBS) — QR/lien/code permanents,
// question en temps réel, stats de répartition à la révélation.
import { test, expect } from '@playwright/test';
import { openHost } from './helpers.js';

test.describe('Page stream (M8)', () => {
  test('QR + code permanents, question live, stats à la révélation', async ({ browser }) => {
    // L'animateur crée un salon et récupère le lien stream.
    const { ctx: hostCtx, page: host, code } = await openHost(browser);
    const streamUrl = (await host.getByTestId('overlay-link').textContent())?.trim();
    expect(streamUrl).toContain('/overlay?token=');

    // La page stream affiche EN PERMANENCE le QR, le lien et le code du salon.
    const streamCtx = await browser.newContext();
    const stream = await streamCtx.newPage();
    await stream.goto(streamUrl);
    await expect(stream.getByTestId('stream-room-code')).toHaveText(code);
    await expect(stream.getByRole('img', { name: `QR code du salon ${code}` })).toBeVisible();
    await expect(stream.getByText('La partie va commencer')).toBeVisible();

    // Un joueur rejoint, l'animateur lance un quiz : la question apparaît sur le stream (M9).
    const p1Ctx = await browser.newContext();
    const p1 = await p1Ctx.newPage();
    await p1.goto(`/?code=${code}`);
    await p1.getByLabel('Ton pseudo').fill('Viewer');
    await p1.getByRole('button', { name: 'Rejoindre' }).click();

    await host.getByRole('button', { name: 'Lancer la partie' }).click();
    await host.getByRole('button', { name: 'Quiz', exact: true }).click();
    await host.getByRole('button', { name: 'Lancer Quiz' }).click();
    await expect(stream.getByTestId('stream-question')).toBeVisible();
    // QR + code toujours affichés pendant la question.
    await expect(stream.getByTestId('stream-room-code')).toHaveText(code);

    // Le joueur répond ; à la révélation, le stream montre la RÉPARTITION des réponses
    // (les stats de l'animateur), pas les points/places du joueur.
    await p1.getByRole('group', { name: 'Choisis ta réponse' }).getByRole('button').first().click();
    await host.getByRole('button', { name: 'Révéler maintenant' }).click();
    await expect(stream.getByTestId('stats-panel')).toBeVisible();
    await expect(stream.getByText('Bonne réponse')).toHaveCount(0); // pas le label joueur — le stream a son propre affichage
    // Fin de partie (menu à confirmation en 2 temps) : le podium s'affiche sur le stream.
    await host.getByRole('button', { name: 'Voir le classement' }).click();
    await host.getByRole('button', { name: 'Menu' }).click();
    await host.getByRole('menuitem', { name: 'Terminer la partie' }).click();
    await host.getByRole('menuitem', { name: 'Confirmer — terminer la partie' }).click();
    await expect(stream.getByRole('heading', { name: 'Podium' })).toBeVisible();
    await expect(stream.getByTestId('stream-room-code')).toHaveText(code); // toujours permanent

    await hostCtx.close();
    await streamCtx.close();
    await p1Ctx.close();
  });
});
