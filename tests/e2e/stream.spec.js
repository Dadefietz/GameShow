// E2E — M8/M9 : page stream (source navigateur OBS) — moyen de rejoindre pendant
// la partie, question en temps réel, stats de répartition à la révélation.
//
// CONTRAT RÉÉCRIT (actions 3, 4 et 5) : le QR n'est plus permanent. Il est présent
// pendant l'accueil et la partie — pour que les retardataires puissent rejoindre —
// et disparaît au podium, où la place sert au classement complet. Le CODE, lui,
// reste affiché en toute phase : le salon demeure ouvert cinq minutes après le
// podium, et un code seul suffit à revenir.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer } from './helpers.js';

test.describe('Page stream (M8)', () => {
  test('moyen de rejoindre pendant la partie, question live, stats à la révélation', async ({ browser }) => {
    // L'animateur crée un salon et récupère le lien stream.
    const { ctx: hostCtx, page: host, code } = await openHost(browser);
    const streamUrl = (await host.getByTestId('overlay-link').textContent())?.trim();
    expect(streamUrl).toContain('/overlay?token=');

    // Pendant l'accueil : QR, code et adresse, dans la pastille.
    const streamCtx = await browser.newContext();
    const stream = await streamCtx.newPage();
    await stream.goto(streamUrl);
    // Sélecteurs stables (data-testid) : le texte de l'interface peut évoluer
    // avec le design sans casser la garantie fonctionnelle.
    await expect(stream.getByTestId('stream-room-code')).toHaveText(code);
    await expect(stream.getByTestId('stream-qr')).toBeVisible();
    await expect(stream.getByTestId('player-count')).toBeVisible();

    // Un joueur rejoint, l'animateur lance un quiz : la question apparaît sur le stream (M9).
    const { ctx: p1Ctx, page: p1 } = await joinAsPlayer(browser, code, 'Viewer');

    await host.getByRole('button', { name: 'Lancer la partie' }).click();
    await host.getByRole('menuitem', { name: 'Lancer Quiz' }).click();
    await expect(stream.getByTestId('stream-question')).toBeVisible();
    // QR + code toujours affichés pendant la question.
    await expect(stream.getByTestId('stream-room-code')).toHaveText(code);

    // Le joueur répond ; à la révélation, le stream montre la RÉPARTITION des réponses
    // (les stats de l'animateur), pas les points/places du joueur.
    await p1.getByTestId('answer-option').first().click();
    await host.getByRole('button', { name: 'Révéler maintenant' }).click();
    await expect(stream.getByTestId('stats-panel')).toBeVisible();
    await expect(stream.getByText('Bonne réponse')).toHaveCount(0); // pas le label joueur — le stream a son propre affichage
    // Fin de partie (menu à confirmation en 2 temps) : le podium s'affiche sur le stream.
    await host.getByRole('button', { name: 'Voir le classement' }).click();
    await host.getByRole('button', { name: 'Menu' }).click();
    await host.getByRole('menuitem', { name: 'Terminer la partie' }).click();
    await host.getByRole('menuitem', { name: 'Confirmer — terminer la partie' }).click();
    await expect(stream.getByTestId('stream-podium')).toBeVisible();
    // AU PODIUM : plus de QR — mais le code reste, pour une éventuelle relance.
    await expect(stream.getByTestId('stream-qr')).toHaveCount(0);
    await expect(stream.getByTestId('stream-room-code')).toHaveText(code);

    await hostCtx.close();
    await streamCtx.close();
    await p1Ctx.close();
  });
});
