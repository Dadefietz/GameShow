// E2E — CE QUE L'ANIMATEUR VOIT À LA RÉVÉLATION (retours du 26/10).
//
// Les données sont tenues par `tests/unit/vues-animateur.test.js` ; ce fichier
// regarde ce que seul un navigateur montre : que la console AFFICHE ces sections,
// avec les bonnes colonnes, les bons cadres — et que le stream n'en reçoit rien.
//
// LES JOUEURS SONT DES SOCKETS, pas des navigateurs : vingt-deux pages de
// téléphone ne prouveraient rien de plus sur la console, et coûteraient dix fois
// le temps.
import { test, expect } from '@playwright/test';
import { io } from 'socket.io-client';
import { openHost, creerJeu, retirerJeux, lancerJeu } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.setTimeout(150_000);
const BASE = 'http://localhost:8788';
const PREFIXE = 'Vues — ';

test.describe('Ce que l’animateur voit à la révélation', () => {
  let hote = null;
  let stream = null;
  const sockets = [];

  test.afterEach(async () => {
    for (const s of sockets.splice(0)) s.close();
    await retirerJeux(PREFIXE);
    if (stream) { await stream.close().catch(() => {}); stream = null; }
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
  });

  // Les joueurs rejoignent par l'API et répondent par leur socket, sur le même
  // contrat que le téléphone.
  async function joueurs(pseudos) {
    const liste = [];
    for (const pseudo of pseudos) {
      const r = await (await fetch(`${BASE}/api/rooms/${hote.code}/join`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pseudo }),
      })).json();
      const s = io(BASE, { auth: { token: r.playerToken }, transports: ['websocket'] });
      sockets.push(s);
      await new Promise((ok) => s.on('connect', ok));
      liste.push({ pseudo, s, question: new Promise((ok) => s.on('module:started', ok)) });
    }
    return liste;
  }

  async function ouvrir(browser, jeu, pseudos) {
    hote = await openHost(browser);
    const js = await joueurs(pseudos);
    stream = await hote.ctx.newPage();
    const token = await hote.page.evaluate(() => JSON.parse(localStorage.getItem('host')).overlayToken);
    await stream.goto(`/overlay?token=${token}`);
    await expect(stream.getByTestId('stream-room-code')).toHaveText(hote.code);
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await lancerJeu(hote.page, jeu, { demarrer: false });
    return js;
  }

  // Aucun pseudo à l'antenne : le stream est capturé par OBS.
  async function aucunNomAuStream(pseudos) {
    const texte = await stream.locator('body').innerText();
    for (const p of pseudos) expect(texte.includes(p), `« ${p} » est affiché sur le stream`).toBe(false);
  }

  test('ESTIMATION : vingt lignes Nom, Écart, Réponse donnée — les dix meilleurs, les dix derniers', async ({ browser }) => {
    const jeu = `${PREFIXE}Estimation`;
    await creerJeu({ name: jeu, type: 'estimation', duration: 60, questions: [{ text: 'Combien ?', target: 1000 }] });
    const pseudos = Array.from({ length: 22 }, (_, i) => `Est${String(i + 1).padStart(2, '0')}`);
    const js = await ouvrir(browser, jeu, pseudos);
    await hote.page.getByTestId('simple-demarrer').click();
    // Est01 est le plus proche (écart 2), Est22 le plus loin (écart 44).
    for (const [i, j] of js.entries()) { await j.question; j.s.emit('play:answer', { value: 1000 + (i + 1) * 2 }); }
    await hote.page.getByTestId('host-reveler').click();

    const tableau = hote.page.getByTestId('classement-manche');
    await expect(tableau).toBeVisible({ timeout: 20_000 });
    await expect(tableau.locator('.clsm__ligne--tete')).toHaveText(/Nom\s*Écart\s*Réponse donnée/i);
    const lignes = tableau.getByTestId('classement-ligne');
    await expect(lignes).toHaveCount(20);
    await expect(lignes.first()).toHaveText(/^1\s*Est01\s*2\s*1\s?002$/);
    await expect(lignes.nth(10), 'le premier des dix derniers n’est pas à son rang').toHaveText(/^13\s*Est13\s*26\s*1\s?026$/);
    await expect(lignes.last()).toHaveText(/^22\s*Est22\s*44\s*1\s?044$/);
    await expect(tableau.getByTestId('classement-masques')).toHaveText(/^2 joueurs/);
    await expect(tableau.locator('.private__count')).toHaveText('22');
    // LA COUPURE EST ENTRE LES DEUX BOUTS, pas ailleurs.
    const ordre = await tableau.locator('.clsm > *').evaluateAll((els) => els.map((e) => e.dataset.testid || 'tete'));
    expect(ordre.indexOf('classement-masques')).toBe(11);
    await aucunNomAuStream(pseudos);
  });

  test('QUIZ : les noms des bonnes réponses, et eux seuls', async ({ browser }) => {
    const jeu = `${PREFIXE}Quiz`;
    await creerJeu({ name: jeu, type: 'quiz', questions: [{ text: 'Deux et deux ?', options: ['3', '4', '5', '6'], correctIndex: 1 }] });
    const js = await ouvrir(browser, jeu, ['Rapide', 'Lent', 'Faux']);
    await hote.page.getByTestId('simple-demarrer').click();
    for (const j of js) await j.question;
    js[0].s.emit('play:answer', { value: 1 });
    await new Promise((ok) => setTimeout(ok, 400));
    js[1].s.emit('play:answer', { value: 1 });
    js[2].s.emit('play:answer', { value: 0 });
    await new Promise((ok) => setTimeout(ok, 400));
    await hote.page.getByTestId('host-reveler').click();

    const section = hote.page.getByTestId('bonnes-reponses');
    await expect(section).toBeVisible({ timeout: 20_000 });
    await expect(section.getByTestId('bonne-reponse-nom')).toHaveText(['Rapide', 'Lent']);
    await expect(section.getByTestId('bonnes-reponses-total')).toHaveText('2');
    await aucunNomAuStream(['Rapide', 'Lent', 'Faux']);
  });

  test('LES VISAGES : vingt cadres, les dix premiers à gauche, un seul vert, et les votants à côté', async ({ browser }) => {
    const js = await ouvrir(browser, 'Les visages', ['Vif', 'Lynx', 'Hibou']);
    await hote.page.getByTestId('visages-demarrer').click();
    for (const j of js) await j.question;
    // Trois buzz à trois instants différents : trois visages différents.
    for (const j of js) { await new Promise((ok) => setTimeout(ok, 2100)); j.s.emit('play:answer', { value: true }); }
    await new Promise((ok) => setTimeout(ok, 400));
    await hote.page.getByTestId('host-reveler').click();

    const section = hote.page.getByTestId('visages-votants');
    await expect(section).toBeVisible({ timeout: 60_000 });
    await expect(section.getByTestId('visages-votants-gauche').getByTestId('visage-votants')).toHaveCount(10);
    await expect(section.getByTestId('visages-votants-droite').getByTestId('visage-votants')).toHaveCount(10);
    await expect(section.locator('[data-bonne="oui"]')).toHaveCount(1);
    await expect(section.getByTestId('visage-votant')).toHaveText(['Vif', 'Lynx', 'Hibou']);
    // Chaque cadre porte son visage, chargé.
    const images = section.locator('img.visage');
    await expect(images).toHaveCount(20);
    await expect.poll(() => images.evaluateAll((els) => els.filter((e) => e.complete && e.naturalWidth > 0).length),
      'des visages ne se sont pas chargés').toBe(20);
    // LES DEUX COLONNES CÔTE À CÔTE sur la console : la gauche est à gauche.
    const g = await section.getByTestId('visages-votants-gauche').boundingBox();
    const d = await section.getByTestId('visages-votants-droite').boundingBox();
    expect(d.x, 'les dix derniers ne sont pas à droite').toBeGreaterThan(g.x + g.width - 1);
    // LE CADRE VERT EST VERT : sa bordure prend la couleur de la réussite.
    const vert = await section.locator('[data-bonne="oui"]').evaluate((el) => {
      const t = document.createElement('span');
      t.style.color = 'var(--c-good)';
      el.appendChild(t);
      const attendu = getComputedStyle(t).color;
      t.remove();
      return { ombre: getComputedStyle(el).boxShadow, attendu };
    });
    expect(vert.ombre, 'le cadre de la bonne réponse n’est pas vert').toContain(vert.attendu);
    await aucunNomAuStream(['Vif', 'Lynx', 'Hibou']);
  });
});
