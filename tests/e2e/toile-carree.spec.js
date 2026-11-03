// E2E — UN CARRÉ TRACÉ RESTE UN CARRÉ, SUR TOUS LES ÉCRANS.
//
// CE QUI A ÉTÉ RAPPORTÉ (02/11) : « Dans Cueillette, il existe un bug parfois
// pour des joueurs, il arrive que leur dessin soit "écrasé" et que ce soit ce
// dessin "écrasé" qui soit comptabilisé. »
//
// LA CHAÎNE DU DÉFAUT, ET ELLE ÉTAIT ENTIÈREMENT GÉOMÉTRIQUE.
//
//   1. La toile normalisait CHAQUE AXE PAR SON PROPRE CÔTÉ : `x / rect.width`,
//      `y / rect.height`. Tant que la boîte est carrée, les deux divisions sont
//      la même et tout est juste.
//   2. Le serveur rastérise ces coordonnées dans une grille CARRÉE — il n'a
//      aucun moyen de savoir que le cadre ne l'était pas. La note portait donc
//      sur la figure écrasée.
//
// ET LE JOUEUR NE VOYAIT RIEN. L'encre était rendue en
// `preserveAspectRatio="none"` : le rendu REFAISAIT exactement la déformation
// que la normalisation venait d'appliquer, si bien que le trait tombait pile
// sous le doigt. La figure n'était fausse que dans la donnée envoyée — on ne la
// découvrait qu'à la révélation. C'est ce qui rend le défaut si déroutant, et
// c'est aussi pourquoi un contrôle qui mesure l'écran NE LE VOIT PAS : il a
// d'abord été écrit ainsi, et il passait sur un cadre pourtant étiré de moitié.
//
// ET LA BOÎTE N'EST PAS TOUJOURS CARRÉE : mesuré carré sur deux téléphones
// courts, étiré sur les trois plus élancés, jusqu'à un facteur 0,50 sur
// 360 × 980. D'où le « parfois pour des joueurs » : cela dépend de la place qui
// reste sous la cible, donc de la hauteur de l'écran.
//
// CE QUE CE CONTRÔLE MESURE. Ni la forme du cadre — le correctif ne la rend pas
// carrée, il rend le dessin indépendant d'elle — ni le rendu, qui ment. Il
// INTERCEPTE LA TRAME ENVOYÉE AU SERVEUR : on trace un carré en pixels d'écran,
// et on vérifie que les coordonnées qui partent décrivent encore un carré.
// C'est exactement ce que le serveur va noter.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer, lancerJeu } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.setTimeout(180_000);

// Des écrans réels, du plus trapu au plus élancé. Les trois derniers sont ceux
// qui échouaient : ils laissent le plus de hauteur sous la cible.
const ECRANS = [
  { nom: 'iPhone SE (court)', viewport: { width: 375, height: 553 } },
  { nom: 'iPhone 12', viewport: { width: 390, height: 664 } },
  { nom: 'iPhone 14 Pro Max', viewport: { width: 430, height: 739 } },
  { nom: 'Pixel 7 (élancé)', viewport: { width: 412, height: 915 } },
  { nom: 'écran très élancé', viewport: { width: 360, height: 980 } },
];

// Trace un carré de `cote` pixels d'écran, centré dans la toile, au doigt.
// Les coordonnées sont ABSOLUES : c'est tout l'intérêt — on ne passe pas par les
// fractions que le composant pourrait normaliser de travers.
const tracerUnCarre = (page, cote) => page.evaluate((c) => {
  const t = document.querySelector('.toile');
  const r = t.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const ev = (type, x, y) => t.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, composed: true, pointerId: 1,
    pointerType: 'touch', isPrimary: true, button: 0,
    buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y,
  }));
  const coins = [
    [cx - c / 2, cy - c / 2], [cx + c / 2, cy - c / 2],
    [cx + c / 2, cy + c / 2], [cx - c / 2, cy + c / 2],
    [cx - c / 2, cy - c / 2],
  ];
  ev('pointerdown', coins[0][0], coins[0][1]);
  for (let i = 1; i < coins.length; i += 1) {
    const [x0, y0] = coins[i - 1]; const [x1, y1] = coins[i];
    for (let k = 1; k <= 8; k += 1) {
      ev('pointermove', x0 + (x1 - x0) * k / 8, y0 + (y1 - y0) * k / 8);
    }
  }
  ev('pointerup', coins[4][0], coins[4][1]);
}, cote);

test.describe('Cueillette — le dessin n\'est pas écrasé', () => {
  for (const ecran of ECRANS) {
    test(`carré tracé = carré rendu sur ${ecran.nom} (${ecran.viewport.width}×${ecran.viewport.height})`, async ({ browser }) => {
      const hote = await openHost(browser);
      const joueur = await joinAsPlayer(browser, hote.code, 'Trait', {
        ...ecran, hasTouch: true, isMobile: true,
      });
      try {
        await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
        await lancerJeu(hote.page, 'Cueillette');
        await hote.page.getByTestId('cueillette-demarrer').click();

        const j = joueur.page;
        await expect(j.getByTestId('cueillette-toile')).toBeVisible({ timeout: 25_000 });

        const COTE = 120;
        await tracerUnCarre(j, COTE);
        await expect(j.locator('[data-testid="cueillette-toile"] polyline')).toHaveCount(1);

        // CE QUE LE SERVEUR VA RECEVOIR. L'attribut `points` du tracé EST la
        // donnée normalisée : la toile l'écrit en multipliant par 1000 les
        // mêmes coordonnées qu'elle envoie (`coordonnees`). On lit donc la
        // charge utile sans dépendre du rendu — qui, lui, ment : en
        // `preserveAspectRatio="none"` il refaisait la déformation à l'envers et
        // le trait tombait pile sous le doigt.
        const points = await j.locator('[data-testid="cueillette-toile"] polyline')
          .first().getAttribute('points');
        expect(points, 'aucun trait tracé').toBeTruthy();
        const paires = points.trim().split(/\s+/).map((c) => c.split(',').map(Number));
        const xs = paires.map(([x]) => x);
        const ys = paires.map(([, y]) => y);
        const l = Math.max(...xs) - Math.min(...xs);
        const h = Math.max(...ys) - Math.min(...ys);

        // L'INVARIANT. Un carré tracé en pixels d'écran doit arriver carré dans
        // le repère normalisé — c'est celui-là que le serveur rastérise dans sa
        // grille carrée pour noter la ressemblance.
        const rapport = h > 0 ? l / h : 0;
        expect(Math.abs(l - h),
          `le carré tracé arrive en ${Math.round(l)} × ${Math.round(h)} dans le repère `
          + `envoyé au serveur : il est écrasé d'un facteur ${rapport.toFixed(2)}, `
          + "et c'est cette figure-là qui est notée")
          .toBeLessThanOrEqual(30);
      } finally {
        await joueur.ctx.close().catch(() => {});
        await terminerPartie(hote.page).catch(() => {});
        await hote.ctx.close().catch(() => {});
      }
    });
  }
});
