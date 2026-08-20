// E2E — ESTIMATION : PALIERS DE PRÉCISION ET DISPERSION VISIBLE (action 13).
//
// Deux défauts corrigés, de nature différente.
//
// 1. LE BARÈME. L'ancienne échelle était linéaire et plate, et la vitesse y
//    pesait plus lourd que la justesse : sur une cible de 100, une réponse exacte
//    mais tardive valait 850 quand une réponse à 10 % près mais immédiate en
//    valait 900. Le plus juste perdait contre le plus rapide — l'inverse de ce
//    que le module prétend mesurer. Désormais : des paliers à valeur fixe et plus
//    aucune composante de rapidité.
//
// 2. L'HISTOGRAMME. La maquette animateur (A5) le spécifiait depuis le début.
//    Il n'a jamais été construit — et le serveur ne calculait même pas les
//    tranches. L'animateur voyait trois chiffres : où était le groupe, mais pas
//    s'il était groupé ou éparpillé.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.describe('Module estimation', () => {
  let hote = null;
  const joueurs = [];

  test.afterEach(async () => {
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    for (const j of joueurs.splice(0)) await j.ctx.close();
  });

  async function lancerEstimation(browser, pseudos) {
    hote = await openHost(browser);
    for (const p of pseudos) joueurs.push(await joinAsPlayer(browser, hote.code, p));
    await expect(hote.page.getByTestId('player-count')).toHaveText(String(pseudos.length));
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: 'Lancer Estimation' }).click();
    await expect(joueurs[0].page.getByTestId('question-text')).toBeVisible();
  }

  test('l\'animateur voit la dispersion, pas seulement trois chiffres', async ({ browser }) => {
    await lancerEstimation(browser, ['Un', 'Deux', 'Trois']);

    // Chacun estime quelque chose de différent : c'est ce qui fait une dispersion.
    for (const [i, j] of joueurs.entries()) {
      await j.page.getByLabel('Ta réponse').fill(String(10 + i * 40));
      await j.page.getByTestId('answer-submit').click();
    }
    await expect(hote.page.getByTestId('answers-count')).toHaveText('3');

    // L'histogramme existe EN DIRECT, avant même la révélation : c'est sur lui
    // que l'animateur décide du bon moment pour révéler.
    const histo = hote.page.getByTestId('histogramme');
    await expect(histo).toBeVisible();
    await expect(histo.locator('.histo__bar')).toHaveCount(8);
    // Toutes les estimations sont comptées, aucune n'est perdue.
    const comptes = await histo.locator('.histo__bar').evaluateAll(
      (els) => els.reduce((s, e) => s + Number(e.dataset.count || 0), 0),
    );
    expect(comptes).toBe(3);
    // Et la tranche de la bonne réponse est repérée.
    await expect(histo.locator('.histo__bar--cible')).toHaveCount(1);

    // Les trois chiffres restent : ils situent, l'histogramme montre la forme.
    // Ciblé dans le panneau de répartition : « Moyenne » apparaît aussi ailleurs.
    await expect(hote.page.getByTestId('stats-panel').getByText('Moyenne')).toBeVisible();
  });

  test('le stream montre la dispersion à la révélation', async ({ browser }) => {
    await lancerEstimation(browser, ['Seul']);

    const stream = await hote.ctx.newPage();
    const token = await hote.page.evaluate(() => JSON.parse(localStorage.getItem('host')).overlayToken);
    await stream.goto(`/overlay?token=${token}`);

    await joueurs[0].page.getByLabel('Ta réponse').fill('120');
    await joueurs[0].page.getByTestId('answer-submit').click();
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();

    const histo = stream.getByTestId('stream-histogramme');
    await expect(histo).toBeVisible();
    await expect(histo.locator('.st-histo__bar')).toHaveCount(8);
    await expect(histo.locator('.st-histo__bar--cible')).toHaveCount(1);
    await stream.close();
  });
});
