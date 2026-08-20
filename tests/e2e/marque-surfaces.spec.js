// E2E — LA MARQUE SUR LES QUATRE SURFACES (chantier v2, décisions 5.2, 5.7, 5.8).
//
// CE QUI A ÉTÉ RAPPORTÉ : « La favicon feu de bois en motion design n'est pas
// présente sur toutes les pages. » C'était exact, sur deux plans :
//   - `/overlay` n'avait AUCUN écran de chargement — le montage l'excluait
//     délibérément, fond transparent d'OBS oblige ;
//   - avant que React ne monte, TOUTES les surfaces affichaient le PNG du tipi,
//     une troisième marque sans rapport avec la flamme. L'identité changeait
//     donc trois fois pendant un seul chargement.
//
// COMMENT ON LE MESURE. L'écran d'amorçage ne dure normalement qu'un instant :
// on retarde le morceau de code de chaque surface pour qu'il reste à l'écran, et
// on regarde ce qui est dessiné. Sans cette ruse, le contrôle passerait sans
// jamais avoir rien vu.
import { test, expect } from '@playwright/test';
import { FLAMME } from '../../src/client/shared/marque-flamme.js';

const SURFACES = [
  { nom: 'joueur', chemin: '/play', morceau: 'PlayApp' },
  { nom: 'animateur', chemin: '/host', morceau: 'HostApp' },
  { nom: 'studio', chemin: '/studio', morceau: 'StudioApp' },
  { nom: 'stream', chemin: '/overlay?token=inexistant', morceau: 'OverlayApp' },
];

for (const s of SURFACES) {
  test(`la flamme s'affiche pendant le chargement — ${s.nom}`, async ({ page }) => {
    await page.route(new RegExp(`assets/${s.morceau}-[^/]*\\.js`), async (route) => {
      await new Promise((r) => { setTimeout(r, 2000); });
      await route.continue();
    });
    await page.goto(s.chemin);

    const marque = page.locator('.boot__mark svg');
    await expect(marque, `aucune flamme au chargement de ${s.nom}`).toBeVisible();

    // C'est bien LA flamme du système, pas un dessin quelconque : on compare les
    // tracés à la géométrie de référence.
    const traces = await marque.locator('path').evaluateAll((els) => els.map((n) => n.getAttribute('d')));
    expect(traces).toEqual([FLAMME.flamme, ...FLAMME.buches]);
  });
}

// LA DÉCISION 5.7 disait « fond transparent sur le stream ». La vérification l'a
// démentie : la scène du stream est elle-même OPAQUE depuis qu'elle est un canevas
// fixe — les overlays transparents ont été abandonnés le 2026-08-18, seul le
// commentaire avait survécu. Un chargement transparent laisserait voir le même
// brun. Ce qui compte, et qui était FAUX, c'est que ce brun soit le même partout :
// la feuille critique d'index.html peignait oklch(0.200 0.008 80), un brun NEUTRE,
// quand le jeton --c-canvas est un brun CHAUD. Chaque chargement virait de l'un à
// l'autre, sur les quatre surfaces, et personne ne l'avait relevé.
test('le fond du chargement ne vire pas de couleur au montage', async ({ page }) => {
  await page.route(/assets\/OverlayApp-[^/]*\.js/, async (route) => {
    await new Promise((r) => { setTimeout(r, 2000); });
    await route.continue();
  });
  await page.goto('/overlay?token=inexistant');

  const boot = page.locator('.boot');
  await expect(boot).toBeVisible();
  // On compare la couleur RÉELLEMENT peinte pendant le chargement à celle du
  // jeton de canevas, telle que le navigateur les résout toutes deux.
  const [fondCharge, fondJeton] = await page.evaluate(() => {
    const sonde = document.createElement('div');
    sonde.style.backgroundColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--c-canvas').trim();
    document.body.appendChild(sonde);
    const jeton = getComputedStyle(sonde).backgroundColor;
    sonde.remove();
    return [getComputedStyle(document.querySelector('.boot')).backgroundColor, jeton];
  });
  console.log(`  chargement ${fondCharge} · jeton --c-canvas ${fondJeton}`);
  expect(fondCharge).toBe(fondJeton);

  // Et la flamme est bien là — c'est l'objet de la décision 5.2.
  await expect(page.locator('.boot__mark svg')).toBeVisible();
});

test('aucune surface ne charge le PNG du tipi', async ({ page }) => {
  // DÉCISION 5.4. On surveille le RÉSEAU : une référence oubliée quelque part se
  // traduirait par une requête, même si le fichier n'existe plus.
  const demandes = [];
  page.on('request', (r) => { if (r.url().includes('avatar-emblem-tipi')) demandes.push(r.url()); });
  for (const s of SURFACES) {
    await page.goto(s.chemin);
    await page.waitForLoadState('networkidle');
  }
  expect(demandes, `le tipi est encore demandé :\n${demandes.join('\n')}`).toEqual([]);
});
