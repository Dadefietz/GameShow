// E2E — DÉPOSER UNE IMAGE D'OBJET DEPUIS LE STUDIO, ET LA CODIFIER.
//
// CE QUI A ÉTÉ DEMANDÉ : « déposer une image et codifier (nom, couleur) ».
//
// CE QUE CE CONTRÔLE GARDE, ET QU'AUCUN AUTRE NE PEUT VOIR. Le détourage et le
// nommage se vérifient sans navigateur (`tests/unit/image-objet.test.js`). Ce qui
// ne se vérifie QUE de bout en bout, c'est la chaîne : un fichier choisi devient
// un WebP, part au serveur, en revient avec une adresse, et cette adresse SERT
// VRAIMENT une image. Chacun de ces quatre maillons a sa façon de casser en
// silence — et le dernier l'a fait : le service statique enregistrait ses routes
// AU DÉMARRAGE, si bien qu'un fichier déposé ensuite répondait 404 tout en étant
// bien présent sur le disque.
//
// POURQUOI L'IMAGE EST FABRIQUÉE ICI. Un fichier d'épreuve rangé dans le dépôt
// serait un binaire de plus à versionner, et surtout on ne saurait plus ce qu'il
// contient. Celle-ci est décrite en six lignes : un anneau rouge percé d'un trou
// blanc, sur fond blanc. Les trois zones sont nommées, donc mesurables.
import { test, expect } from '@playwright/test';
import { creerJeu, retirerJeux, BASE } from './helpers.js';

test.setTimeout(90_000);

const JEU = 'Cache dépôt';

test.describe('Le dépôt d\'une image d\'objet', () => {
  test.beforeEach(async () => { await creerJeu({ name: JEU, type: 'cache_cache', questions: [] }); });
  test.afterEach(async () => { await retirerJeux(JEU); });

  test('une image déposée est convertie, rangée, et réellement servie', async ({ page }) => {
    await page.goto('/studio');
    await expect(page.locator('.studio')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: JEU }).first().click();

    const base = page.getByRole('complementary').getByTestId('cache-objets');
    await base.getByTestId('cache-voir-images').click();
    await expect(base.locator('.cmod__objet').first()).toBeVisible();

    await base.getByTestId('cache-ajouter-objet').click();
    const rang = base.locator('.cmod__objet').last();
    const idInitial = (await rang.locator('.cmod__id').textContent()).trim();

    // LE FICHIER AVANT LA CODIFICATION : refusé, et il dit pourquoi. L'identifiant
    // se déduit du nom et de la couleur ; sans eux, l'image n'aurait pas de nom
    // stable et redéposer la même paire accumulerait des copies orphelines.
    const png = await page.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 200; c.height = 200;
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, 200, 200);
      g.fillStyle = '#c0392b'; g.beginPath(); g.arc(100, 100, 80, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(100, 100, 30, 0, 7); g.fill();
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      const buf = new Uint8Array(await blob.arrayBuffer());
      return [...buf];
    });
    const fichier = { name: 'epreuve.png', mimeType: 'image/png', buffer: Buffer.from(png) };

    await rang.locator('input[type="file"]').setInputFiles(fichier);
    await expect(rang.locator('.cmod__etat--erreur')).toContainText(/nom ET la couleur/);

    // ON CODIFIE, PUIS ON DÉPOSE.
    await rang.getByLabel(`Nom de ${idInitial}`).fill('Ampoule essai');
    await rang.getByLabel(`Couleur de ${idInitial}`).fill('Turquoise');
    await rang.locator('input[type="file"]').setInputFiles(fichier);

    await expect(rang.locator('.cmod__etat--ok')).toContainText(/Déposée/, { timeout: 20_000 });
    // L'identifiant a suivi le nom et la couleur, comme les deux cents du dépôt.
    await expect(rang.locator('.cmod__id')).toHaveText('ampoule-essai-turquoise');
    const src = await rang.getByLabel('Image de ampoule-essai-turquoise').inputValue();
    expect(src, "l'adresse rendue ne ressemble pas à un fichier d'objet").toMatch(/ampoule-essai-turquoise\.webp$/);

    // LE MAILLON QUI A DÉJÀ CASSÉ : l'adresse rendue sert-elle vraiment quelque
    // chose ? On ne le demande pas à l'écran, qui afficherait une case vide sans
    // rien dire — on le demande au serveur.
    const rep = await page.request.get(src.startsWith('http') ? src : BASE + src);
    expect(rep.status(), `${src} ne sert rien`).toBe(200);
    expect(rep.headers()['content-type']).toContain('image/webp');
    const octets = await rep.body();
    expect(octets.length).toBeGreaterThan(200);
    // Signature WebP : « RIFF » … « WEBP ». Ce n'est pas un PNG renommé.
    expect(octets.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(octets.subarray(8, 12).toString('ascii')).toBe('WEBP');

    // ET LE DÉTOURAGE A BIEN EU LIEU, sur le fichier tel que le serveur le rend :
    // le coin transparent, le trou blanc du centre INTACT.
    const mesure = await page.evaluate(async (adresse) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((ok, ko) => { img.onload = ok; img.onerror = ko; img.src = `${adresse}?${Date.now()}`; });
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const px = (x, y) => g.getImageData(x, y, 1, 1).data[3];
      return { coin: px(2, 2), centre: px(c.width >> 1, c.height >> 1) };
    }, src);
    expect(mesure.coin, 'le fond blanc n\'a pas été retiré').toBe(0);
    expect(mesure.centre, 'le trou blanc a été percé — détourage naïf').toBe(255);
  });

  test('le serveur refuse ce qui n\'est pas un WebP, et les chemins déguisés', async ({ page }) => {
    // LE SERVEUR NE DÉCODE JAMAIS L'IMAGE : il vérifie la signature d'octets, le
    // poids et l'identifiant. Ces trois refus sont sa seule défense, puisque le
    // fichier arrive d'un navigateur qu'il ne contrôle pas.
    await page.goto('/studio');
    await expect(page.locator('.studio')).toBeVisible({ timeout: 15_000 });

    const poster = (body) => page.request.post(`${BASE}/api/cache/image`, { data: body });

    const faux = await poster({ id: 'x-y', webp: Buffer.from('pas une image').toString('base64') });
    expect(faux.status()).toBe(400);
    expect((await faux.json()).error).toBe('pas-un-webp');

    const chemin = await poster({ id: '../../etc/passwd', webp: 'UklGRgAAAABXRUJQ' });
    expect(chemin.status(), 'un identifiant en forme de chemin a été accepté').toBe(400);

    const majuscules = await poster({ id: 'Ampoule-Bleu', webp: 'UklGRgAAAABXRUJQ' });
    expect(majuscules.status(), "l'identifiant doit rester en minuscules").toBe(400);
  });
});
