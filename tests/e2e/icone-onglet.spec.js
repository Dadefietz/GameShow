// E2E — L'ICÔNE D'ONGLET, ET CE QUE LE SERVEUR RÉPOND QUAND UN FICHIER MANQUE.
//
// CE QUI A ÉTÉ RAPPORTÉ, sur le site en ligne : « le favicon est toujours pas le
// bon ».
//
// CE QUE LA MESURE A MONTRÉ. La page DÉCLARE la bonne icône — la flamme du
// système, en clair dans le HTML servi, identique à celle du dépôt. Le défaut
// n'était donc pas dans la déclaration.
//
// IL ÉTAIT DANS LA RÉPONSE AUX FICHIERS ABSENTS. Le repli des routes du client
// servait `index.html` avec un code 200 à TOUT chemin hors `/api` — donc à
// `/favicon.ico`, que tout navigateur demande de lui-même sans qu'on la déclare.
// Le navigateur recevait cinq kilo-octets de HTML annoncés comme un succès.
//
// Pourquoi c'est ce qui garde une vieille icône en vie : un navigateur ne
// remplace l'icône mémorisée pour un domaine que si la nouvelle requête ÉCHOUE
// franchement. Un 200 — même absurde — la conforte. Une icône remplacée pouvait
// ainsi survivre indéfiniment, rechargement forcé compris.
//
// Ce fichier vérifie les deux moitiés : ce que la page déclare, et ce que le
// serveur répond quand on lui demande un fichier qui n'existe pas.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { FLAMME } from '../../src/client/shared/marque-flamme.js';
import { BASE } from './helpers.js';

test.describe('L\'icône d\'onglet', () => {
  test('la page déclare la flamme du système, et rien d\'autre', async ({ page }) => {
    await page.goto('/');
    const declare = await page.evaluate(() => {
      const liens = [...document.querySelectorAll('link[rel*="icon"]')];
      return {
        combien: liens.length,
        href: liens[0] ? liens[0].href : null,
        manifestes: document.querySelectorAll('link[rel="manifest"]').length,
      };
    });
    // UNE seule déclaration : deux icônes concurrentes, et c'est le navigateur qui
    // arbitre — autant dire personne.
    expect(declare.combien, 'plusieurs icônes déclarées').toBe(1);
    expect(declare.href, 'l\'icône n\'est pas embarquée dans le document').toContain('data:image/svg+xml');

    // C'est BIEN la flamme du système, pas un dessin quelconque : on compare la
    // géométrie, comme le fait le contrôle statique du chantier v2.
    const svg = decodeURIComponent(declare.href.split(',').slice(1).join(','));
    for (const trace of [FLAMME.flamme, ...FLAMME.buches]) {
      expect(svg, 'la géométrie de l\'icône a divergé de la marque').toContain(trace);
    }
    // Et aucun manifeste ne vient proposer une autre icône par la bande.
    expect(declare.manifestes, 'un manifeste déclare peut-être une autre icône').toBe(0);
  });

  test('un fichier absent répond 404, jamais une page', async ({ request }) => {
    // LE CONTRÔLE QUI ÉCHOUE SUR LE DÉFAUT D'ORIGINE. Avant, chacun de ces
    // chemins renvoyait `index.html` avec un code 200.
    const fichiers = ['/favicon.ico', '/favicon.svg', '/apple-touch-icon.png',
      '/site.webmanifest', '/assets/inexistant-00000000.js'];
    for (const chemin of fichiers) {
      const r = await request.get(`${BASE}${chemin}`, { failOnStatusCode: false });
      const type = r.headers()['content-type'] || '';
      console.log(`  ${chemin} → ${r.status()} ${type.split(';')[0]}`);
      expect(r.status(), `${chemin} ne répond pas 404`).toBe(404);
      expect(type, `${chemin} renvoie une page au lieu d'échouer`).not.toContain('text/html');
    }

    // ET LES FICHIERS QUI EXISTENT, EUX, SONT TOUJOURS SERVIS. Sans cette moitié,
    // une expression trop gourmande couperait l'application de ses bundles et ce
    // contrôle applaudirait.
    const page = await request.get(`${BASE}/`);
    const reel = (await page.text()).match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
    expect(reel, 'aucun bundle référencé par la page').toBeTruthy();
    const r = await request.get(`${BASE}${reel}`, { failOnStatusCode: false });
    console.log(`  ${reel} → ${r.status()}`);
    expect(r.status(), `le bundle réel ${reel} n'est plus servi`).toBe(200);
  });

  test('les routes du client, elles, reçoivent toujours la page', async ({ request }) => {
    // LE REVERS. Répondre 404 à tout ce qui n'existe pas casserait l'application
    // entière : ses quatre surfaces sont des chemins sans fichier derrière.
    for (const route of ['/play', '/host', '/studio', '/overlay', '/play?code=ABCDE']) {
      const r = await request.get(`${BASE}${route}`, { failOnStatusCode: false });
      console.log(`  ${route} → ${r.status()}`);
      expect(r.status(), `${route} ne sert plus l'application`).toBe(200);
      expect(r.headers()['content-type'] || '').toContain('text/html');
    }
  });

  test('l\'icône servie est celle du dépôt, au caractère près', async ({ request }) => {
    // Ce que le serveur envoie doit être ce que le dépôt contient : sans cette
    // comparaison, une construction qui réécrirait le document passerait inaperçue.
    const enLigne = await (await request.get(`${BASE}/`)).text();
    const source = readFileSync('index.html', 'utf-8');
    const extraire = (html) => (html.match(/<link rel="icon" href="([^"]+)"/) || [])[1] || null;
    const a = extraire(enLigne);
    const b = extraire(source);
    expect(a, 'aucune icône dans le document servi').not.toBeNull();
    expect(a, 'le document servi ne porte pas l\'icône du dépôt').toBe(b);
  });
});
