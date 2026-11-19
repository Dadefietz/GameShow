// « CAMPEMENT » — la banque, le barème, et ce qui ne doit pas fuir.
//
// Les chemins réseau (ce qui part sur quel canal, et quand) sont tenus par la
// boucle d'intégration. Ici : ce que le module CALCULE et ce qu'il RETOURNE, et
// les fonctions pures que partagent les écrans — la pose d'un point, le zoom, la
// recherche du point rouge d'une carte déposée.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import {
  modules, banqueDeCampement, pointsCampement, distanceCampement, trancheCampement,
  positionCampement, tirerParDifficulte, RAYON_CERCLE_CAMPEMENT, ZONE_PILE_CAMPEMENT,
  RAYON_POINT_CAMPEMENT, MARQUE_CAMPEMENT,
} from '../../src/server/modules.js';
import { VILLES_CAMPEMENT, DIFFICULTES_CAMPEMENT } from '../../src/server/villes-campement.js';
import { CARTES_FRONTIERES } from '../../src/server/pays-frontieres.js';
import {
  trouverPointRouge, positionSurLaCarte, zoomerAutour, bornerLaVue, diametreDuPoint, ZOOM_MAX,
} from '../../src/client/shared/campement.js';
import { momentDePlateau } from '../../src/client/shared/voix.js';
import * as marque from '../../src/client/shared/marque-campement.js';

const m = modules.campement;
const paris = VILLES_CAMPEMENT.find((v) => v.id === 'c054');

describe('la banque de villes livrée', () => {
  it('compte cent soixante-quinze villes, une par pays de « Frontières »', () => {
    expect(VILLES_CAMPEMENT).toHaveLength(175);
    expect(new Set(VILLES_CAMPEMENT.map((v) => v.id)).size).toBe(175);
    const pays = new Set(CARTES_FRONTIERES.map((p) => p.nom));
    for (const v of VILLES_CAMPEMENT) expect(pays.has(v.pays), v.pays).toBe(true);
  });

  it('chaque ligne a ses deux cartes, servies, et une position DANS la carte', () => {
    for (const v of VILLES_CAMPEMENT) {
      expect(fs.existsSync(`src/public${v.carte}`), v.carte).toBe(true);
      expect(fs.existsSync(`src/public${v.reponse}`), v.reponse).toBe(true);
      expect(v.x > 0 && v.x < 1 && v.y > 0 && v.y < 1, `${v.ville} ${v.x} ${v.y}`).toBe(true);
      expect(DIFFICULTES_CAMPEMENT).toContain(v.difficulte);
      expect(v.ville.trim()).toBe(v.ville);
    }
  });

  it('la carte sans ville EST celle de « Frontières » pour le même pays', () => {
    const parNom = new Map(CARTES_FRONTIERES.map((p) => [p.nom, p]));
    for (const v of VILLES_CAMPEMENT) {
      expect(v.carte).toBe(`/cartes/${parNom.get(v.pays).id}.webp`);
      expect(v.difficulte).toBe(parNom.get(v.pays).difficulte);
    }
  });

  it('LA CARTE RÉPONSE A UNE ADRESSE QUI NE SE DEVINE PAS — ni du pays, ni de la carte sans ville', () => {
    const adresses = new Set();
    for (const v of VILLES_CAMPEMENT) {
      expect(v.reponse).toMatch(/^\/cartes\/v[0-9a-f]{10}\.webp$/);
      expect(v.reponse).not.toContain(v.carte.replace('/cartes/', '').replace('.webp', ''));
      adresses.add(v.reponse);
    }
    expect(adresses.size).toBe(175);
  });

  it('les cartes sont servies à leur taille d’origine, sans réduction', () => {
    // L'en-tête VP8L (WebP sans perte) porte la largeur sur 14 bits, juste
    // après la signature : on la lit sans décoder l'image.
    const largeur = (chemin) => {
      const b = fs.readFileSync(chemin);
      expect(b.toString('ascii', 12, 16), `${chemin} n'est pas un WebP sans perte`).toBe('VP8L');
      return 1 + (((b[22] & 0x3f) << 8) | b[21]);
    };
    for (const v of [paris, VILLES_CAMPEMENT[0], VILLES_CAMPEMENT[174]]) {
      expect(largeur(`src/public${v.carte}`)).toBe(2048);
      expect(largeur(`src/public${v.reponse}`)).toBe(2048);
    }
  });
});

describe('le barème', () => {
  it('TOUCHER LE POINT ROUGE vaut 1200 : 1100 de base, 100 d’exactitude', () => {
    expect(pointsCampement(0)).toEqual({ base: 1100, bonusExact: 100, pile: true, dansLeCercle: true });
    // « Toucher » : le point du joueur, dessiné à la taille du point rouge,
    // touche celui-ci — deux rayons de centre à centre.
    expect(ZONE_PILE_CAMPEMENT).toBeCloseTo(2 * RAYON_POINT_CAMPEMENT, 10);
    expect(pointsCampement(ZONE_PILE_CAMPEMENT).pile).toBe(true);
  });

  it('juste à côté du point rouge : un peu moins de 1100, et aucune exactitude', () => {
    const p = pointsCampement(ZONE_PILE_CAMPEMENT + 1e-4);
    expect(p.pile).toBe(false);
    expect(p.bonusExact).toBe(0);
    expect(p.base).toBe(1090);
  });

  it('au bord du cercle, le minimum : 150', () => {
    expect(pointsCampement(RAYON_CERCLE_CAMPEMENT - 1e-4).base).toBe(150);
  });

  it('SUR le cercle et au-delà : rien', () => {
    expect(pointsCampement(RAYON_CERCLE_CAMPEMENT)).toEqual({ base: 0, bonusExact: 0, pile: false, dansLeCercle: false });
    expect(pointsCampement(0.9).base).toBe(0);
    expect(pointsCampement(NaN).base).toBe(0);
  });

  it('plus près, jamais moins : le barème décroît avec la distance', () => {
    let avant = Infinity;
    for (let d = 0; d <= 0.3; d += 0.002) {
      const p = pointsCampement(d);
      const total = p.base + p.bonusExact;
      expect(total, `à ${d}`).toBeLessThanOrEqual(avant);
      avant = total;
    }
  });

  it('linéaire entre la zone pile et le bord, arrondi à la dizaine', () => {
    const milieu = (ZONE_PILE_CAMPEMENT + RAYON_CERCLE_CAMPEMENT) / 2;
    expect(pointsCampement(milieu).base).toBe(630);   // (1100 + 150) / 2 = 625 → 630
    for (let d = 0.02; d < 0.26; d += 0.01) expect(pointsCampement(d).base % 10).toBe(0);
  });

  it('LE RAYON DU CERCLE EST CELUI DE L’EXEMPLE DU DOCUMENT : à peu près trente pour cent du pays', () => {
    // Le pays occupe 1743 pixels sur 2048 dans chaque carte livrée.
    expect(RAYON_CERCLE_CAMPEMENT / (1743 / 2048)).toBeGreaterThan(0.29);
    expect(RAYON_CERCLE_CAMPEMENT / (1743 / 2048)).toBeLessThan(0.32);
  });

  it('les distances se comptent dans la même unité sur les deux axes, même sur une carte non carrée', () => {
    expect(distanceCampement({ x: 0.1, y: 0.2 }, { x: 0.4, y: 0.6 })).toBeCloseTo(0.5, 10);
    // Une carte deux fois plus large que haute : un dixième de hauteur vaut un
    // vingtième de largeur.
    expect(distanceCampement({ x: 0.5, y: 0.4 }, { x: 0.5, y: 0.5 }, 0.5)).toBeCloseTo(0.05, 10);
    // Deux fois plus haute que large : un dixième de largeur vaut un vingtième.
    expect(distanceCampement({ x: 0.4, y: 0.5 }, { x: 0.5, y: 0.5 }, 2)).toBeCloseTo(0.05, 10);
  });

  it('les quatre tranches', () => {
    expect(trancheCampement(1200, true)).toBe('pile');
    expect(trancheCampement(800, false)).toBe('proche');
    expect(trancheCampement(790, false)).toBe('cercle');
    expect(trancheCampement(150, false)).toBe('cercle');
    expect(trancheCampement(0, false)).toBe('hors');
  });
});

describe('le module', () => {
  it('se déclare comme un jeu en direct de vingt secondes, qui garde le point non envoyé', () => {
    expect(m.meta).toMatchObject({ type: 'campement', name: 'Campement', dureeS: 20, dureeFixe: true, direct: true, brouillon: true, scored: true });
  });

  it('la console reçoit les villes, leur pays et leur compteur — ni carte, ni position', () => {
    const b = m.banqueDe([{ kind: MARQUE_CAMPEMENT, villes: [], poses: { c054: 4 } }]);
    expect(b.villes).toHaveLength(175);
    expect(b.villes.find((v) => v.id === 'c054')).toEqual({ id: 'c054', ville: 'Paris', pays: 'France', difficulte: 1, poses: 4 });
    expect(JSON.stringify(b)).not.toMatch(/cartes\/|"x"|"y"|reponse/);
  });

  it('LA MANCHE NE PORTE NI LA POSITION NI LA CARTE RÉPONSE', () => {
    const rt = m.buildRound({ id: 'q', villeId: 'c054', banque: VILLES_CAMPEMENT });
    expect(rt.text).toBe('Retrouve le campement : France – Paris');
    const pub = JSON.stringify(m.publicQuestion(rt));
    expect(pub).toContain(paris.carte);
    expect(pub).not.toContain(paris.reponse);
    expect(pub).not.toContain(String(paris.x));
    expect(pub).not.toContain(String(paris.y));
  });

  it('une position est deux nombres entre 0 et 1, et rien d’autre', () => {
    const rt = m.buildRound({ id: 'q', villeId: 'c054' });
    expect(m.validateAnswer(rt, { x: 0.25, y: 0.75 })).toEqual({ x: 0.25, y: 0.75 });
    expect(m.validateAnswer(rt, { x: 0.123456789, y: 0 })).toEqual({ x: 0.12346, y: 0 });
    for (const faux of [null, '0.2,0.3', [0.2, 0.3], { x: '0.2', y: 0.3 }, { x: 1.01, y: 0.5 }, { x: -0.1, y: 0.5 }, { x: 0.5 }, { x: NaN, y: 0.5 }]) {
      expect(m.validateAnswer(rt, faux), JSON.stringify(faux)).toBeNull();
    }
    expect(positionCampement({ x: 1, y: 0 })).toEqual({ x: 1, y: 0 });
  });

  it('le score : points, exactitude, réponse comptée, tous les points sans les noms, et le tableau', () => {
    const rt = m.buildRound({ id: 'q', villeId: 'c054' });
    rt.answers = new Map([
      ['joueur-A', { value: { x: paris.x, y: paris.y } }],
      ['joueur-B', { value: { x: paris.x + 0.05, y: paris.y } }],
      ['joueur-C', { value: { x: 0.01, y: 0.99 } }],
    ]);
    const { results, reveal, prives } = m.score(rt);
    expect(results.get('joueur-A')).toMatchObject({ base: 1100, bonusExact: 100, exact: true, correct: true });
    expect(results.get('joueur-B')).toMatchObject({ base: 960, bonusExact: 0, exact: false, correct: true });
    expect(results.get('joueur-C')).toMatchObject({ base: 0, exact: false, correct: false, reponse: { x: 0.01, y: 0.99 } });
    expect(reveal.carte).toBe(paris.reponse);
    expect(reveal.points).toHaveLength(3);
    expect(JSON.stringify(reveal)).not.toMatch(/joueur-/);
    expect(reveal.stats.tranches.map((t) => t.n)).toEqual([1, 1, 0, 1]);
    expect(reveal.stats).toMatchObject({ total: 3, pile: 1, dansLeCercle: 2, meilleur: 1200, moyenne: 720 });
    expect(prives.classement.map((l) => l.pid)).toEqual(['joueur-A', 'joueur-B', 'joueur-C']);
  });

  it('LES DIX PLUS PROCHES ET LES DIX PLUS LOIN au-delà de vingt joueurs', () => {
    const rt = m.buildRound({ id: 'q', villeId: 'c054' });
    rt.answers = new Map(Array.from({ length: 25 }, (_, i) => [`j${i}`, { value: { x: paris.x, y: Math.min(1, paris.y + i * 0.02) } }]));
    const { prives } = m.score(rt);
    expect(prives.classement).toHaveLength(20);
    expect(prives.masques).toBe(5);
    expect(prives.classement[0].pid).toBe('j0');
    expect(prives.classement[19].pid).toBe('j24');
  });

  it('sans choix, tire dans la difficulté demandée, parmi les moins jouées', () => {
    const banque = VILLES_CAMPEMENT;
    const enDeux = banque.filter((v) => v.difficulte === 2);
    // Toutes jouées une fois sauf une : c'est elle qui sort, à chaque tirage.
    const poses = Object.fromEntries(enDeux.map((v) => [v.id, 1]));
    const rare = enDeux[3];
    poses[rare.id] = 0;
    for (let i = 0; i < 20; i += 1) {
      expect(tirerParDifficulte(banque, 2, poses, DIFFICULTES_CAMPEMENT).id).toBe(rare.id);
      expect(m.buildRound({ id: 'q', difficulte: 2, poses, banque }).cible.id).toBe(rare.id);
    }
  });

  it('écarte une ligne injouable de la base modérée, et retombe sur le dépôt si rien ne reste', () => {
    const villes = [
      { ...paris, ville: 'Lutèce' },
      { id: 'sans-reponse', ville: 'X', pays: 'Y', carte: '/a.webp', x: 0.5, y: 0.5 },
      { id: 'sans-position', ville: 'X', pays: 'Y', carte: '/a.webp', reponse: '/b.webp' },
      { id: 'sans-ville', ville: ' ', pays: 'Y', carte: '/a.webp', reponse: '/b.webp', x: 0.5, y: 0.5 },
    ];
    expect(banqueDeCampement([{ kind: MARQUE_CAMPEMENT, villes }]).map((v) => v.ville)).toEqual(['Lutèce']);
    expect(banqueDeCampement([{ kind: MARQUE_CAMPEMENT, villes: villes.slice(1) }])).toBe(VILLES_CAMPEMENT);
    expect(banqueDeCampement(null)).toBe(VILLES_CAMPEMENT);
  });
});

describe('ce que partagent les écrans', () => {
  // Une image synthétique : fond blanc, un disque rouge de rayon r en (cx, cy).
  const image = (w, h, disques) => {
    const data = new Uint8ClampedArray(w * h * 4).fill(255);
    for (const [cx, cy, r] of disques) {
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) {
            const i = (y * w + x) * 4;
            data[i] = 255; data[i + 1] = 0; data[i + 2] = 0;
          }
        }
      }
    }
    return { data, width: w, height: h };
  };

  it('LE POINT ROUGE D’UNE CARTE DÉPOSÉE EST RETROUVÉ — au centre de la tache', () => {
    const r = trouverPointRouge(image(400, 200, [[100, 150, 6]]));
    expect(r.x).toBeCloseTo(100 / 400, 3);
    expect(r.y).toBeCloseTo(150 / 200, 3);
    expect(r.pixels).toBeGreaterThan(100);
  });

  it('une carte sans rouge n’a pas de ville ; deux taches éloignées ne sont pas un point', () => {
    expect(trouverPointRouge(image(200, 200, []))).toBeNull();
    expect(trouverPointRouge(image(200, 200, [[20, 20, 4], [180, 180, 4]]))).toEqual({ etale: true });
  });

  it('LE ZOOM GARDE SOUS LES DOIGTS CE QUI Y ÉTAIT', () => {
    const vue = { s: 1, tx: 0, ty: 0 };
    const p = { x: 120, y: 80 };
    const z = zoomerAutour(vue, 3, p.x, p.y, 300, 300);
    // Le point de carte sous les doigts, avant et après.
    const avant = { x: (p.x - vue.tx) / vue.s, y: (p.y - vue.ty) / vue.s };
    const apres = { x: (p.x - z.tx) / z.s, y: (p.y - z.ty) / z.s };
    expect(apres.x).toBeCloseTo(avant.x, 9);
    expect(apres.y).toBeCloseTo(avant.y, 9);
  });

  it('le zoom est borné, et la carte couvre toujours le cadre', () => {
    expect(zoomerAutour({ s: 1, tx: 0, ty: 0 }, 50, 10, 10, 300, 300).s).toBe(ZOOM_MAX);
    expect(zoomerAutour({ s: 2, tx: -100, ty: -100 }, 0.2, 10, 10, 300, 300)).toEqual({ s: 1, tx: 0, ty: 0 });
    expect(bornerLaVue({ s: 2, tx: 50, ty: -900 }, 300, 300)).toEqual({ s: 2, tx: 0, ty: -300 });
  });

  it('un doigt sur la carte se lit en fraction de l’IMAGE, zoom compris', () => {
    // L'image agrandie trois fois et décalée : sa boîte à l'écran le dit.
    const rect = { left: -200, top: -100, width: 900, height: 900 };
    expect(positionSurLaCarte(250, 350, rect)).toEqual({ x: 0.5, y: 0.5 });
    expect(positionSurLaCarte(-250, 350, rect)).toBeNull();
  });

  it('un point se dessine à la taille du point rouge', () => {
    expect(diametreDuPoint(RAYON_POINT_CAMPEMENT, 1)).toBeCloseTo(100 * 28 / 2048, 9);
    // Plus haute que large : le plus grand côté est la hauteur.
    expect(diametreDuPoint(RAYON_POINT_CAMPEMENT, 2)).toBeCloseTo(2 * 100 * 28 / 2048, 9);
  });

  it('LE STREAM A UNE PHRASE À CHAQUE MANCHE, même à moins de cinq réponses', () => {
    const st = (total, dansLeCercle, pile) => ({ kind: 'campement', total, dansLeCercle, pile });
    expect(momentDePlateau('campement', st(1, 1, 1))).toBe('stream.campement-pile');
    expect(momentDePlateau('campement', st(4, 2, 0))).toBe('stream.campement-majorite');
    expect(momentDePlateau('campement', st(10, 3, 0))).toBe('stream.campement-quelques');
    expect(momentDePlateau('campement', st(3, 0, 0))).toBe('stream.campement-personne');
    expect(momentDePlateau('campement', st(0, 0, 0))).toBe('stream.campement-personne');
  });
});

describe('l’emblème', () => {
  it('tient dans sa grille, avec neuf unités de marge de chaque côté', () => {
    expect(marque.margeDeGrille()).toBe(9);
    const xs = marque.COTE.map((p) => p[0]);
    const ys = marque.COTE.map((p) => p[1]);
    const demi = marque.TRAIT / 2;
    expect(marque.ENCRE).toEqual({
      g: Math.min(...xs) - demi, d: Math.max(...xs) + demi, h: Math.min(...ys) - demi, b: Math.max(...ys) + demi,
    });
  });
});
