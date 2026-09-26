// E2E — LA BANQUE DE DESSINS DE « CUEILLETTE », DU STUDIO JUSQU'À LA CONSOLE.
//
// CE QUI A ÉTÉ DEMANDÉ (26/09) : « Dans Cueillette, il faut qu'on ait le même
// mode de gestion d'images que dans Cache-cache. Au cas où on aimerait rajouter
// ou modifier les images, il faut qu'on puisse gérer la banque d'images pour le
// jeu. »
//
// CE QUE CE CONTRÔLE GARDE, ET QU'AUCUN AUTRE NE PEUT VOIR. Un dessin déposé doit
// traverser QUATRE maillons, dont un seul existe hors d'un navigateur :
//   1. le fichier est préparé comme les cinquante d'origine — recadré sur
//      l'encre, mis au carré, converti — et sa GRILLE de comparaison est
//      calculée, par le navigateur, puisque le serveur n'a pas de décodeur ;
//   2. il part au serveur et en revient avec une adresse ;
//   3. l'enregistrement garde la ligne, grille comprise ;
//   4. la console de l'animateur le propose comme cible, rangé dans sa famille.
// Sans grille, le dessin s'afficherait partout et noterait tout le monde à zéro.
import { test, expect } from '@playwright/test';
import { creerJeu, retirerJeux, openHost, lancerJeu, BASE } from './helpers.js';
import { terminerPartie } from './cloture.js';
import { GRILLES_DESSINS } from '../../src/server/dessins-grilles.js';

test.setTimeout(120_000);

const JEU = 'Cueillette banque';

const bits = (b64) => {
  const o = Buffer.from(b64, 'base64');
  return Array.from({ length: 4096 }, (_, i) => (o[i >> 3] >> (i & 7)) & 1);
};

test.describe('La banque de dessins de « Cueillette »', () => {
  test.beforeEach(async () => { await creerJeu({ name: JEU, type: 'cueillette', questions: [] }); });
  test.afterEach(async () => { await retirerJeux(JEU); });

  test('un dessin déposé au Studio est préparé, noté par sa grille, et proposé à l’animateur', async ({ page, browser }) => {
    await page.goto('/studio');
    await expect(page.locator('.studio')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: JEU }).first().click();

    const banque = page.getByTestId('studio-editeur').getByTestId('cueillette-dessins');
    // LA BANQUE QUE LE JEU JOUE : les cinquante du dépôt, et leurs trois familles.
    await expect(banque.getByTestId('cueillette-ligne')).toHaveCount(50, { timeout: 15_000 });
    await expect(banque.getByTestId('cueillette-familles')).toContainText('Arbres · Fleurs · Fruits');

    await banque.getByTestId('cueillette-ajouter').click();
    const ligne = banque.getByTestId('cueillette-ligne').last();
    await expect(ligne).toContainText("Pas encore d'image");
    await ligne.getByPlaceholder(/^Nom/).fill('Mon sapin');
    await ligne.getByPlaceholder('Famille').fill('Épreuves');

    // LE FICHIER : le sapin du dépôt lui-même. Sa grille d'origine est connue —
    // c'est ce qui permet de juger celle que le navigateur va calculer.
    const source = await page.request.get(`${BASE}/dessins/d002.webp`);
    await ligne.locator('input[type="file"]').setInputFiles({
      name: 'sapin.webp', mimeType: 'image/webp', buffer: await source.body(),
    });
    await expect(ligne.locator('.cmod__etat--ok')).toContainText(/grille de comparaison calculée/, { timeout: 20_000 });

    await page.getByTestId('studio-editeur').getByRole('button', { name: /^Enregistrer/ }).click();
    await expect(page.getByText('Enregistré')).toBeVisible({ timeout: 15_000 });

    // L'ENREGISTREMENT GARDE LA LIGNE, GRILLE COMPRISE.
    const { modules } = await (await page.request.get(`${BASE}/api/modules`)).json();
    const contenu = modules.find((m) => m.name === JEU).questions.find((q) => q.kind === 'contenu-cueillette');
    expect(contenu?.dessins?.length, 'la banque n’a pas été enregistrée entière').toBe(51);
    const neuf = contenu.dessins.find((d) => d.nom === 'Mon sapin');
    expect(neuf?.grille, 'le dessin déposé n’a pas de grille : il noterait tout le monde à zéro').toBeTruthy();

    // ET LA GRILLE EST LA BONNE : recalculée depuis le même sapin, elle doit
    // retrouver la grille d'origine — la préparation (recadrage, carré, marge) et
    // la réduction de Lanczos sont celles du script qui a produit les cinquante.
    const a = bits(neuf.grille);
    const b = bits(GRILLES_DESSINS.d002);
    let inter = 0; let uni = 0;
    for (let i = 0; i < 4096; i += 1) { if (a[i] && b[i]) inter += 1; if (a[i] || b[i]) uni += 1; }
    expect(inter / uni, `la grille calculée au Studio s’écarte de l’originale (${(inter / uni).toFixed(2)})`).toBeGreaterThan(0.8);

    // L'ANIMATEUR LE TROUVE, rangé sous sa famille neuve.
    const hote = await openHost(browser);
    try {
      await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
      await lancerJeu(hote.page, JEU, { demarrer: false });
      await hote.page.getByTestId('cu-famille-Épreuves').click();
      await expect(hote.page.getByTestId('cu-dessin').filter({ hasText: 'Mon sapin' })).toBeVisible();
    } finally {
      await terminerPartie(hote.page);
      await hote.ctx.close();
    }
  });
});
