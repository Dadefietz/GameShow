// E2E — « CAMPEMENT », de bout en bout.
//
// Le barème et les fuites sont tenus ailleurs (tests unitaires, boucle
// d'intégration). Ce fichier regarde ce qui n'existe QUE dans un navigateur :
//
//   1. LA CARTE A UNE TAILLE, sur le téléphone et à l'antenne — la leçon de la
//      cible de « Cueillette », qui a mesuré 0 × 0 deux fois ;
//   2. UN DOIGT POSE LE POINT LÀ OÙ IL TOUCHE — et le serveur le note au même
//      endroit : un décalage d'un pixel entre l'écran et l'arbitre ferait perdre
//      le « pile » à qui l'a mérité ;
//   3. PINCER ZOOME, et un point posé sur la carte agrandie tombe toujours sous
//      le doigt ;
//   4. LA RÉVÉLATION MONTRE LA CARTE RÉPONSE ET LES POINTS sur les trois écrans ;
//   5. LE STUDIO RETROUVE LE POINT ROUGE d'une carte déposée.
//
// LA BASE EST À NOUS, avec des noms inventés et les cartes du dépôt (celles du
// pays de `c054`) : un contrôle qui attendrait « Paris » écrirait une réponse de
// la vraie banque dans le dépôt.
import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { openHost, joinAsPlayer, lancerJeu, creerJeu, retirerJeux, BASE } from './helpers.js';
import { terminerPartie } from './cloture.js';
import { VILLES_CAMPEMENT } from '../../src/server/villes-campement.js';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');

test.setTimeout(180_000);

const JEU = 'Campement du contrôle';
const VRAIE = VILLES_CAMPEMENT.find((v) => v.id === 'c054');
const AUTRE = VILLES_CAMPEMENT.find((v) => v.id === 'c002');
const BASE_VILLES = {
  kind: 'contenu-campement',
  villes: [
    { ...VRAIE, ville: 'Lutèce', pays: 'Gaule', difficulte: 2 },
    { ...AUTRE, ville: 'Cap-Rouge', pays: 'Australe', difficulte: 2 },
  ],
  poses: { c054: 6, c002: 1 },
};
// UN TÉLÉPHONE : étroit, et TACTILE — sans `hasTouch`, le navigateur n'émet que
// des événements de souris, et un geste au doigt ne serait jamais essayé.
const TELEPHONE = { viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true };

test.describe('Campement', () => {
  let hote = null;
  const joueurs = [];
  let stream = null;

  test.beforeEach(async () => {
    await retirerJeux(JEU);
    await creerJeu({ name: JEU, type: 'campement', duration: 20, questions: [BASE_VILLES] });
  });

  test.afterEach(async () => {
    if (stream) { await stream.close().catch(() => {}); stream = null; }
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    for (const j of joueurs.splice(0)) await j.ctx.close();
    await retirerJeux(JEU);
  });

  async function annoncer(browser, { avecStream = false, pseudos = ['Carto'] } = {}) {
    hote = await openHost(browser);
    for (const p of pseudos) joueurs.push(await joinAsPlayer(browser, hote.code, p, TELEPHONE));
    if (avecStream) {
      stream = await hote.ctx.newPage();
      await stream.setViewportSize({ width: 1920, height: 1080 });
      const token = await hote.page.evaluate(() => JSON.parse(localStorage.getItem('host')).overlayToken);
      await stream.goto(`/overlay?token=${token}`);
      await expect(stream.getByTestId('stream-room-code')).toHaveText(hote.code);
    }
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await lancerJeu(hote.page, JEU, { demarrer: false });
    await expect(hote.page.getByTestId('depart-campement')).toBeVisible();
  }

  async function demarrerSurLutece() {
    const h = hote.page;
    await h.getByTestId('cp-difficulte-2').click();
    await h.getByTestId('cp-pays').filter({ hasText: 'Lutèce' }).click();
    await expect(h.getByTestId('cp-cible')).toContainText('Cible : Lutèce (Gaule)');
    await h.getByTestId('campement-demarrer').click();
  }

  // Le point d'écran qui correspond à une fraction de la carte : on lit la boîte
  // de l'IMAGE, transformations comprises — exactement ce que fait le composant.
  async function ecranDe(page, frac) {
    const img = await page.locator('[data-testid="cp-carte"] .cpj__image').boundingBox();
    return { x: img.x + frac.x * img.width, y: img.y + frac.y * img.height };
  }

  test('LA CONSOLE CHOISIT SUR LA VILLE, LE PAYS ET LE COMPTEUR — jamais sur une carte', async ({ browser }) => {
    await annoncer(browser);
    const h = hote.page;
    await h.getByTestId('cp-difficulte-2').click();
    const villes = h.getByTestId('cp-pays');
    await expect(villes).toHaveCount(2);
    // « il doit voir les noms des villes et du pays dans lequel elle est »
    await expect(villes.first()).toContainText('Lutèce');
    await expect(villes.first()).toContainText('Gaule');
    await expect(h.getByTestId('cp-poses').first()).toHaveText('6');
    await expect(h.locator('[data-testid="depart-campement"] img')).toHaveCount(0);
    // Remonter la moins jouée.
    await h.getByTestId('cp-trier').click();
    await expect(villes.first()).toContainText('Cap-Rouge');
    // Le filtre lit aussi le pays.
    await h.getByLabel('Filtrer les villes').fill('austr');
    await expect(villes).toHaveCount(1);
    await expect(h.getByTestId('cp-cible')).toContainText('difficulté 2');
  });

  test('LA CARTE A SA TAILLE, UN DOIGT POSE LE POINT, ET PINCER ZOOME', async ({ browser }) => {
    await annoncer(browser, { avecStream: true });
    await demarrerSurLutece();
    const j = joueurs[0].page;

    // « Retrouve le campement : France – Paris », mot pour mot.
    await expect(j.getByTestId('question-text')).toHaveText('Retrouve le campement : Gaule – Lutèce', { timeout: 20_000 });
    const cadre = j.getByTestId('cp-carte');
    await expect(cadre).toBeVisible();
    const boite = await cadre.boundingBox();
    // LA CARTE PREND LA LARGEUR DU TÉLÉPHONE, ou presque : c'est un jeu de
    // précision, chaque pixel compte.
    expect(boite.width, 'la carte est trop petite sur le téléphone').toBeGreaterThan(300);
    expect(Math.abs(boite.height - boite.width), 'la carte n’est plus carrée').toBeLessThanOrEqual(2);
    // L'énoncé, la carte et le bouton tiennent dans l'écran, sans défiler.
    const bouton = await j.getByTestId('answer-submit').boundingBox();
    expect(bouton.y + bouton.height, 'le bouton d’envoi est sous la ligne de flottaison').toBeLessThanOrEqual(780);
    await expect(j.getByTestId('answer-submit')).toBeDisabled();

    // À L'ANTENNE : « Le Cercle essaie de retrouver le campement : … »
    await expect(stream.getByTestId('question-text'))
      .toHaveText('Le Cercle essaie de retrouver le campement : Gaule – Lutèce');
    const grande = await stream.getByTestId('stream-cp-carte').boundingBox();
    expect(grande.height, 'la carte est trop petite à l’antenne').toBeGreaterThan(400);

    // LA CARTE RÉPONSE N'EST CHARGÉE NULLE PART : elle porte le point rouge.
    const nomReponse = VRAIE.reponse.replace('/cartes/', '');
    expect(await j.content()).not.toContain(nomReponse);
    expect(await stream.content()).not.toContain(nomReponse);

    // UN DOIGT POSE LE POINT LÀ OÙ IL TOUCHE.
    const vise = { x: 0.3, y: 0.6 };
    const p1 = await ecranDe(j, vise);
    await j.touchscreen.tap(p1.x, p1.y);
    const point = j.getByTestId('cp-carte-point');
    await expect(point).toBeVisible();
    expect(Number(await point.getAttribute('data-x'))).toBeCloseTo(vise.x, 2);
    expect(Number(await point.getAttribute('data-y'))).toBeCloseTo(vise.y, 2);
    await expect(j.getByTestId('answer-submit')).toBeEnabled();

    // PINCER : deux doigts qui s'écartent autour du centre de la carte.
    const cx = boite.x + boite.width / 2;
    const cy = boite.y + boite.height / 2;
    await j.evaluate(({ cx, cy }) => {
      const el = document.querySelector('[data-testid="cp-carte"]');
      const ev = (type, id, x, y) => el.dispatchEvent(new PointerEvent(type, {
        bubbles: true, pointerId: id, pointerType: 'touch', isPrimary: id === 11, clientX: x, clientY: y, button: 0,
      }));
      ev('pointerdown', 11, cx - 20, cy);
      ev('pointerdown', 12, cx + 20, cy);
      for (let k = 1; k <= 10; k += 1) {
        ev('pointermove', 11, cx - 20 - k * 9, cy);
        ev('pointermove', 12, cx + 20 + k * 9, cy);
      }
      ev('pointerup', 11, cx - 110, cy);
      ev('pointerup', 12, cx + 110, cy);
    }, { cx, cy });
    // Un écart de 40 à 220 pixels : à peu près cinq fois — le maximum.
    await expect.poll(async () => Number(await cadre.getAttribute('data-zoom'))).toBeGreaterThan(3);
    // LE PINCEMENT N'A PAS DÉPLACÉ LE POINT : la fin d'un pincement n'est pas un appui.
    expect(Number(await point.getAttribute('data-x'))).toBeCloseTo(vise.x, 2);

    // SUR LA CARTE AGRANDIE, UN APPUI TOMBE TOUJOURS SOUS LE DOIGT. On vise le
    // centre du cadre : la fraction attendue se lit sur l'image transformée.
    const img = await j.locator('[data-testid="cp-carte"] .cpj__image').boundingBox();
    const attendu = { x: (cx - img.x) / img.width, y: (cy - img.y) / img.height };
    await j.touchscreen.tap(cx, cy);
    expect(Number(await point.getAttribute('data-x'))).toBeCloseTo(attendu.x, 3);
    expect(Number(await point.getAttribute('data-y'))).toBeCloseTo(attendu.y, 3);
    // Le point garde sa taille à l'écran malgré le zoom.
    const tache = await point.boundingBox();
    expect(tache.width).toBeLessThan(30);

    // DÉZOOMER AU BOUTON ramène la carte entière.
    for (let k = 0; k < 6; k += 1) await j.getByTestId('cp-carte-moins').click({ force: true });
    await expect.poll(async () => Number(await cadre.getAttribute('data-zoom'))).toBe(1);
  });

  test('PILE SUR LA VILLE : 1200, ET LA RÉVÉLATION SUR LES TROIS ÉCRANS', async ({ browser }) => {
    await annoncer(browser, { avecStream: true, pseudos: ['Carto', 'Atlas'] });
    await demarrerSurLutece();

    // CARTO VISE LA VILLE ELLE-MÊME — la position du point rouge, mesurée sur la
    // carte réponse — et envoie.
    const j = joueurs[0].page;
    await expect(j.getByTestId('cp-carte')).toBeVisible({ timeout: 20_000 });
    const ici = await ecranDe(j, { x: VRAIE.x, y: VRAIE.y });
    await j.touchscreen.tap(ici.x, ici.y);
    await j.getByTestId('answer-submit').click();
    await expect(j.getByTestId('answer-submit')).toHaveText('Point envoyé', { timeout: 10_000 });

    // ATLAS VISE UN COIN DE LA CARTE.
    const a = joueurs[1].page;
    await expect(a.getByTestId('cp-carte')).toBeVisible();
    const coin = await ecranDe(a, { x: 0.06, y: 0.94 });
    await a.touchscreen.tap(coin.x, coin.y);
    await a.getByTestId('answer-submit').click();
    await expect(a.getByTestId('answer-submit')).toHaveText('Point envoyé', { timeout: 10_000 });

    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();

    // LE TÉLÉPHONE : la carte réponse avec son point, le titre de la tranche, et
    // « Base + Bonus ».
    await expect(j.getByTestId('cp-bilan')).toBeVisible({ timeout: 20_000 });
    await expect(j.getByTestId('cp-ville')).toHaveText('Lutèce');
    await expect(j.locator('#verdict')).toHaveText('Pile au campement');
    await expect(j.getByTestId('cp-bilan-carte-moi')).toBeVisible();
    // LA VILLE SE VOIT ENCORE quand le point du joueur est pile dessus : le
    // repère rouge est au-dessus, plus petit, et le point orange l'entoure.
    const ville = await j.getByTestId('cp-bilan-carte-ville').boundingBox();
    const moi = await j.getByTestId('cp-bilan-carte-moi').boundingBox();
    expect(ville.width, 'la ville est invisible sur le téléphone').toBeGreaterThanOrEqual(6);
    expect(ville.width, 'la ville recouvre le point du joueur').toBeLessThan(moi.width);
    const carteBilan = await j.getByTestId('cp-bilan-carte').boundingBox();
    expect(carteBilan.width, 'la carte du bilan ne se voit pas').toBeGreaterThan(150);
    // L'image servie est la carte AVEC ville.
    await expect(j.locator('[data-testid="cp-bilan-carte"] img')).toHaveAttribute('src', VRAIE.reponse);
    await expect(j.getByTestId('points-gained')).toContainText(/\+1\s?200/, { timeout: 15_000 });
    await expect(j.getByTestId('points-base')).toContainText(/1\s?100/);
    await expect(j.getByTestId('points-bonus-exact')).toContainText('+100');
    await expect(j.getByTestId('voix-resultat')).not.toBeEmpty();
    // Atlas, dehors : « Hors du cercle », et rien de perdu.
    await expect(a.locator('#verdict')).toHaveText('Hors du cercle', { timeout: 20_000 });

    // LA CONSOLE : la carte réponse avec les DEUX points, puis le classement.
    const h = hote.page;
    await expect(h.getByTestId('campement-hote')).toBeVisible({ timeout: 20_000 });
    await expect(h.getByTestId('cp-hote-carte-point')).toHaveCount(2);
    await expect(h.getByTestId('cp-hote-carte-ville')).toBeVisible();
    await expect(h.getByTestId('cp-hote-ville')).toContainText('Lutèce — Gaule');
    const lignes = h.getByTestId('classement-ligne');
    await expect(lignes).toHaveCount(2);
    await expect(lignes.first()).toContainText('Carto');
    await expect(lignes.first()).toContainText(/1\s?200/);
    await expect(lignes.nth(1)).toContainText('Atlas');

    // LE STREAM : la même carte, réponse cette fois, les deux points, la ville,
    // les tranches — et une phrase sur le cercle, à chaque manche.
    await expect(stream.getByTestId('stream-campement-reveal')).toBeVisible({ timeout: 10_000 });
    await expect(stream.getByTestId('stream-cp-reponse-point')).toHaveCount(2);
    await expect(stream.getByTestId('stream-cp-reponse-ville')).toBeVisible();
    await expect(stream.getByTestId('stream-cp-ville')).toHaveText('Lutèce');
    await expect(stream.getByTestId('stream-cp-tranches-pile')).toHaveAttribute('data-n', '1');
    await expect(stream.getByTestId('stream-cp-tranches-hors')).toHaveAttribute('data-n', '1');
    await expect(stream.getByTestId('voix-plateau')).not.toBeEmpty();
    await expect(stream.getByTestId('question-text')).toHaveText('Le campement était ici : Gaule – Lutèce');
    const carteRev = await stream.getByTestId('stream-cp-reponse').boundingBox();
    expect(carteRev.height, 'la carte a rétréci à la révélation').toBeGreaterThan(400);
    // AUCUN NOM DE JOUEUR À L'ANTENNE.
    await expect(stream.locator('body')).not.toContainText('Carto');
    await expect(stream.locator('body')).not.toContainText('Atlas');
  });

  test('LE POINT POSÉ SANS ÊTRE ENVOYÉ EST COMPTÉ À LA FIN DU COMPTEUR', async ({ browser }) => {
    // « S'il place le point et ne l'envoie pas, la réponse est envoyée
    // automatiquement à la fin du compteur. » Ce qui ne se voit qu'ici : que le
    // doigt lui-même pousse le brouillon — un point est un OBJET, et le premier
    // filtre du téléphone, écrit pour du texte et des dessins, le jugeait vide.
    await annoncer(browser);
    await demarrerSurLutece();
    const j = joueurs[0].page;
    await expect(j.getByTestId('cp-carte')).toBeVisible({ timeout: 20_000 });
    const ici = await ecranDe(j, { x: VRAIE.x, y: VRAIE.y });
    await j.touchscreen.tap(ici.x, ici.y);
    await j.waitForTimeout(600);
    await expect(j.getByTestId('answer-submit')).toHaveText('Envoyer mon point');

    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();
    await expect(j.getByTestId('cp-bilan-carte-moi')).toBeVisible({ timeout: 20_000 });
    await expect(j.getByTestId('points-gained')).toContainText(/\+1\s?200/, { timeout: 15_000 });
  });

  test('LA BASE DE VILLES SE RÈGLE AU STUDIO, ET UNE CARTE DÉPOSÉE DONNE SA VILLE', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await page.goto(`${BASE}/studio`);
      await page.getByRole('article').filter({ hasText: JEU }).getByRole('button').first().click();
      const editeur = page.getByTestId('studio-editeur');
      await expect(editeur.getByTestId('campement-base')).toBeVisible();
      await expect(editeur.getByTestId('campement-ligne')).toHaveCount(2);
      await expect(editeur.getByTestId('campement-poses-c054')).toHaveValue('6');

      // UNE LIGNE NOUVELLE, ET SES DEUX CARTES. La carte avec ville porte un
      // point rouge en (300, 100) sur 400 × 400 : le Studio doit le retrouver.
      await editeur.getByTestId('campement-ajouter').click();
      await expect(editeur.getByTestId('campement-ligne')).toHaveCount(3);
      const nouvelle = editeur.getByTestId('campement-ligne').last();
      await expect(nouvelle.getByTestId('campement-incomplete')).toContainText('Pas encore de cartes');
      await nouvelle.getByPlaceholder('La ville — ce que le joueur cherche').fill('Bourg-Neuf');
      await nouvelle.getByPlaceholder('Le pays, en français').fill('Néoland');

      const carte = (rouge) => {
        const png = new PNG({ width: 400, height: 400 });
        for (let y = 0; y < 400; y += 1) {
          for (let x = 0; x < 400; x += 1) {
            const i = (y * 400 + x) * 4;
            const bord = x === 50 || x === 350 || y === 50 || y === 350;
            const dot = rouge && (x - 300) ** 2 + (y - 100) ** 2 <= 36;
            png.data[i] = dot ? 255 : bord ? 0 : 255;
            png.data[i + 1] = dot || bord ? 0 : 255;
            png.data[i + 2] = dot || bord ? 0 : 255;
            png.data[i + 3] = 255;
          }
        }
        return PNG.sync.write(png);
      };
      const id = await nouvelle.locator('input[type="file"]').first().getAttribute('data-testid');
      const vid = id.replace('campement-depot-carte-', '');
      // UNE CARTE SANS ROUGE DÉPOSÉE COMME CARTE AVEC VILLE est refusée, en clair.
      await nouvelle.getByTestId(`campement-depot-reponse-${vid}`).setInputFiles({ name: 'sans.png', mimeType: 'image/png', buffer: carte(false) });
      await expect(nouvelle.getByTestId('campement-depot-etat')).toContainText('Aucun point rouge', { timeout: 15_000 });
      await nouvelle.getByTestId(`campement-depot-carte-${vid}`).setInputFiles({ name: 'sc.png', mimeType: 'image/png', buffer: carte(false) });
      await expect(nouvelle.getByTestId('campement-depot-etat')).toContainText('Déposée', { timeout: 15_000 });
      await nouvelle.getByTestId(`campement-depot-reponse-${vid}`).setInputFiles({ name: 'ac.png', mimeType: 'image/png', buffer: carte(true) });
      await expect(nouvelle.getByTestId('campement-depot-etat')).toContainText('Ville repérée', { timeout: 15_000 });
      await expect(nouvelle.getByTestId('campement-incomplete')).toHaveCount(0);

      // ON MODIFIE UNE VILLE DU DÉPÔT, ON ENREGISTRE, LE SERVEUR GARDE TOUT.
      await editeur.getByLabel('Ville de la ligne c054').fill('Lutèce-sur-Seine');
      await editeur.getByRole('button', { name: /^Enregistrer/ }).click();
      await expect(editeur.getByRole('button', { name: /^Enregistrer/ })).toBeEnabled({ timeout: 20_000 });
      const apres = await fetch(`${BASE}/api/modules`).then((r) => r.json());
      const jeu = (apres.modules || []).find((m) => m.name === JEU);
      const base = (jeu?.questions || []).find((q) => q.kind === 'contenu-campement');
      expect(base?.villes?.find((v) => v.id === 'c054')?.ville).toBe('Lutèce-sur-Seine');
      // LE COMPTEUR A SURVÉCU.
      expect(base?.poses?.c054).toBe(6);
      // LA POSITION A ÉTÉ LUE SUR LA CARTE DÉPOSÉE : (300, 100) sur 400.
      const neuve = base?.villes?.find((v) => v.ville === 'Bourg-Neuf');
      expect(neuve?.x).toBeCloseTo(0.75, 2);
      expect(neuve?.y).toBeCloseTo(0.25, 2);
      // ET LA CARTE RÉPONSE N'A PAS UNE ADRESSE DÉDUCTIBLE de la carte sans ville.
      expect(neuve?.reponse).toBeTruthy();
      expect(neuve?.reponse.split('?')[0]).not.toContain('-carte');
    } finally {
      await ctx.close();
    }
  });
});
