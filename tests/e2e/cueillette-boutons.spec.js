// E2E — LES DEUX BOUTONS DE CHAQUE DESSIN, À ONZE JOUEURS (retour du 26/10).
//
// « Quand nous étions 11 joueurs, je n'avais pas accès au bouton [Haut le cœur],
// je n'avais accès qu'à "Coup de cœur". Il faudrait vérifier que les 2 boutons
// apparaissent tout le temps pour chaque dessin proposé. »
//
// CE QUI A ÉTÉ MESURÉ. À onze joueurs, sur six tailles de console (de 768 à
// 1920 px), les deux boutons sont présents, entiers, dans leur fiche, et c'est
// bien EUX qui reçoivent le clic, sur les onze fiches. La cause était ailleurs :
// une console ouverte avant la mise en ligne du haut le cœur garde l'ancien code
// — celui qui n'avait que le coup de cœur. C'est `console-perimee.spec.js` qui
// garde ce point-là ; celui-ci garde la mise en page.
//
// LE TÉLÉPHONE N'EST PAS DANS LA LISTE, et ce n'est pas un oubli : la console est
// un poste de pilotage pour écran large. À 390 px, sa colonne centrale entière
// s'écrase sous le rail du classement — tous les panneaux, pas ces deux boutons.
//
// LES JOUEURS SONT DES SOCKETS : onze téléphones ne prouveraient rien de plus sur
// la console, et coûteraient dix fois le temps.
import { test, expect } from '@playwright/test';
import { io } from 'socket.io-client';
import { openHost, lancerJeu } from './helpers.js';
import { terminerPartie } from './cloture.js';
import { GRILLES_DESSINS } from '../../src/server/dessins-grilles.js';
import { copisteDe, gribouillis } from '../outils/copiste.js';

test.setTimeout(240_000);
const BASE = 'http://localhost:8788';
const PSEUDOS = ['Jean-Christophe', 'Marie', 'Théodore', 'Lou', 'Anne-Sophie', 'Bob', 'Kévin', 'Inès', 'Maximilien', 'Zoé', 'Paul'];
const ECRANS = [[1280, 720], [1366, 768], [1440, 900], [1920, 1080], [1024, 768], [768, 1024]];

test('CUEILLETTE À ONZE : « Coup de cœur » et « Haut le cœur » sur chaque fiche, cliquables, sur six consoles', async ({ browser }) => {
  const hote = await openHost(browser);
  const sockets = [];
  try {
    for (const pseudo of PSEUDOS) {
      const r = await (await fetch(`${BASE}/api/rooms/${hote.code}/join`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pseudo }),
      })).json();
      sockets.push(io(BASE, { auth: { token: r.playerToken }, transports: ['websocket'] }));
    }
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await lancerJeu(hote.page, 'Cueillette');
    await hote.page.getByTestId('cu-famille-arbres').click();
    const choix = hote.page.getByTestId('cu-dessin').first();
    const id = (await choix.locator('img').getAttribute('src')).match(/(d\d{3})\.webp/)[1];
    const dessinent = sockets.map((s) => new Promise((ok) => s.on('module:started', (q) => { if (q.phase === 'dessin') ok(); })));
    await choix.click();
    await hote.page.getByTestId('cueillette-demarrer').click();
    await Promise.all(dessinent);
    // Des dessins fidèles et des gribouillis : des notes et des hauteurs de fiche variées.
    sockets.forEach((s, i) => s.emit('play:answer', {
      value: i % 2 ? gribouillis({ graine: i + 3, traits: 4, points: 20 }) : copisteDe(GRILLES_DESSINS[id], { graine: i + 1 }),
    }));
    const fiches = hote.page.getByTestId('cueillette-fiche');
    await expect(fiches).toHaveCount(11, { timeout: 60_000 });

    const rouges = [];
    for (const [w, h] of ECRANS) {
      await hote.page.setViewportSize({ width: w, height: h });
      for (let k = 0; k < 11; k += 1) {
        for (const tid of ['cueillette-coup-de-coeur', 'cueillette-haut-le-coeur']) {
          const b = fiches.nth(k).getByTestId(tid);
          if (await b.count() !== 1) { rouges.push(`${w}x${h} fiche ${k} : ${tid} absent`); continue; }
          await b.scrollIntoViewIfNeeded();
          // PRÉSENT NE SUFFIT PAS : entier, dans sa fiche, et c'est lui qui reçoit
          // le clic en son centre — pas un voisin posé par-dessus.
          const e = await b.evaluate((el) => {
            const r = el.getBoundingClientRect();
            const f = el.closest('[data-testid="cueillette-fiche"]').getBoundingClientRect();
            const dessus = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            return {
              taille: r.width > 20 && r.height > 20,
              dedans: r.left >= f.left - 1 && r.right <= f.right + 1 && r.top >= f.top - 1 && r.bottom <= f.bottom + 1,
              clic: !!dessus && (dessus === el || el.contains(dessus)),
              visible: getComputedStyle(el).visibility === 'visible' && getComputedStyle(el).opacity !== '0',
            };
          });
          const fautes = Object.entries(e).filter(([, ok]) => !ok).map(([k2]) => k2);
          if (fautes.length) rouges.push(`${w}x${h} fiche ${k} : ${tid} — ${fautes.join(', ')}`);
        }
      }
    }
    expect(rouges, 'des boutons manquent ou ne reçoivent pas le clic').toEqual([]);

    // ET LE BOUTON FAIT CE QU'IL DIT, sur la dernière fiche — la plus basse.
    await hote.page.setViewportSize({ width: 1280, height: 720 });
    await fiches.last().getByTestId('cueillette-haut-le-coeur').click();
    await expect(fiches.last()).toHaveAttribute('data-haut', 'oui');
  } finally {
    sockets.forEach((s) => s.close());
    await hote.page.setViewportSize({ width: 1280, height: 720 });
    await terminerPartie(hote.page);
    await hote.ctx.close();
  }
});
