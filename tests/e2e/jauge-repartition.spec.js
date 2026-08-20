// E2E — LA JAUGE DIT LA VÉRITÉ (action 14 du PLAN-CHANTIER-v1).
//
// Le défaut corrigé : l'écran animateur posait la largeur des barres en ligne sans
// jamais renseigner --om-to, la valeur d'arrivée exigée par le système de design
// (design/tokens/tokens.css:324). L'animation retombait donc sur son défaut (100 %)
// et, conservant son état final, écrasait la largeur réelle : TOUTES les barres
// finissaient pleines. Sur le vrai/faux, qui n'en a que deux, deux barres pleines
// côte à côte ne disent rien — d'où « la jauge n'est pas correctement affichée ».
// Et à la révélation, la barre de la mauvaise réponse, pleine sur toute la largeur
// et teintée de braise, se lisait comme une sanction.
//
// Aucun test ne regardait la LARGEUR des barres : ils vérifiaient la présence du
// panneau, jamais ce qu'il montrait. C'est pourquoi le défaut a survécu.
//
// Ce test mesure la géométrie réelle, en pixels, et la compare au décompte.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.describe('Répartition chez l\'animateur', () => {
  let hote = null;
  const joueurs = [];

  test.afterEach(async () => {
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    for (const j of joueurs.splice(0)) await j.ctx.close();
  });

  test('la largeur des barres suit le décompte, et non l\'option en tête', async ({ browser }) => {
    hote = await openHost(browser);

    // Trois joueurs, pour obtenir une répartition INÉGALE : c'est le seul cas où
    // « part du total » et « part de l'option en tête » divergent visiblement.
    for (const nom of ['Un', 'Deux', 'Trois']) {
      joueurs.push(await joinAsPlayer(browser, hote.code, nom));
    }
    await expect(hote.page.getByTestId('player-count')).toHaveText('3');

    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: 'Lancer Vrai / Faux' }).click();

    // Deux votent « Faux », un vote « Vrai » — répartition 2/3 contre 1/3.
    await expect(joueurs[0].page.getByTestId('question-text')).toBeVisible();
    for (const [i, j] of joueurs.entries()) {
      await j.page.getByTestId('answer-option').nth(i === 2 ? 1 : 0).click();
    }
    await expect(hote.page.getByTestId('answers-count')).toHaveText('3');

    // ---- La géométrie, mesurée pour de vrai ----
    // Le test ne présuppose PAS l'ordre des options : le joueur voit « Vrai »
    // en premier (PlayApp.jsx:425), l'animateur « Faux » (HostApp.jsx). On
    // désigne donc chaque barre par ce qu'elle affiche, pas par son rang.
    const barres = hote.page.locator('.dist__row');
    await expect(barres).toHaveCount(2);

    const mesurer = async (barre) => {
      const piste = await barre.locator('.dist__track').boundingBox();
      const pleine = await barre.locator('.dist__fill').boundingBox();
      return pleine.width / piste.width;
    };

    const majoritaire = barres.filter({ hasText: '67%' });
    const minoritaire = barres.filter({ hasText: '33%' });
    await expect(majoritaire).toHaveCount(1);
    await expect(minoritaire).toHaveCount(1);

    // Deux voix sur trois occupent deux tiers de la piste, une voix un tiers.
    // Avant correction, les DEUX occupaient la piste entière : cadrées sur
    // l'option de tête, puis écrasées à 100 % par l'animation.
    const partMajo = await mesurer(majoritaire);
    const partMino = await mesurer(minoritaire);
    expect(partMajo).toBeGreaterThan(0.60);
    expect(partMajo).toBeLessThan(0.72);
    expect(partMino).toBeGreaterThan(0.28);
    expect(partMino).toBeLessThan(0.38);

    // L'assertion qui aurait attrapé le défaut à elle seule : tant qu'une voix
    // est allée ailleurs, aucune barre ne remplit toute la piste.
    expect(partMajo).toBeLessThan(0.95);
    expect(partMino).toBeLessThan(0.95);
  });

  test('une option sans voix n\'a pas de barre, mais garde son étiquette', async ({ browser }) => {
    hote = await openHost(browser);
    joueurs.push(await joinAsPlayer(browser, hote.code, 'Seul'));
    await expect(hote.page.getByTestId('player-count')).toHaveText('1');

    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: 'Lancer Vrai / Faux' }).click();
    await joueurs[0].page.getByTestId('answer-option').first().click();
    await expect(hote.page.getByTestId('answers-count')).toHaveText('1');

    // L'option délaissée, désignée par son décompte et non par son rang.
    const delaissee = hote.page.locator('.dist__row').filter({ hasText: '0 · 0%' });
    await expect(delaissee).toHaveCount(1);

    // Barre de largeur nulle — l'ancien comportement la montrait pleine, ce qui
    // laissait croire à des voix qui n'existaient pas.
    const pleine = await delaissee.locator('.dist__fill').boundingBox();
    expect(pleine.width).toBeLessThan(2);

    // Mais le décompte reste lisible : on lit « 0 · 0 % », on ne devine pas.
    await expect(delaissee.locator('.dist__count')).toContainText('0 · 0%');
  });
});
