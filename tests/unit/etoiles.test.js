// « CHASSE AUX ÉTOILES » — les réglages, le ciel, la séquence, l'arbitre.
//
// Les chemins réseau (le direct qui ne part qu'au staff, les touches qui
// reviennent au téléphone) sont tenus par la boucle d'intégration. Ici : ce que
// le module CALCULE, et ce que le Studio en promet.
import { describe, it, expect } from 'vitest';
import {
  modules, REGLAGES_ETOILES, reglagesEtoiles, capaciteEtoiles, genererCiel, genererSequence,
  arbitrerTouche, pointsEtoiles, FORMAT_CIEL, NOMBRE_ETOILES, MARQUE_ETOILES,
  COMPTE_A_REBOURS_ETOILES_MS, DUREE_JEU_ETOILES_MS,
} from '../../src/server/modules.js';
import { capaciteEtoiles as capaciteStudio } from '../../src/client/studio/etoilesReglages.js';
import { momentDePlateau } from '../../src/client/shared/voix.js';
import * as marque from '../../src/client/shared/marque-etoiles.js';

const m = modules.etoiles;
const COMBINAISONS = [['ciel', 'facile'], ['ciel', 'difficile'], ['chasse', 'facile'], ['chasse', 'difficile']];
const allumeesA = (seq, t) => seq.filter((a) => t >= a.debut && t < a.fin);

describe('les réglages', () => {
  it('LES MAXIMUMS ANNONCÉS : 1000, 1500, 900, 1200', () => {
    const max = (mo, ni) => REGLAGES_ETOILES[mo][ni].nombre * REGLAGES_ETOILES[mo][ni].points;
    expect(max('ciel', 'facile')).toBe(1000);
    expect(max('ciel', 'difficile')).toBe(1500);
    expect(max('chasse', 'facile')).toBe(900);
    expect(max('chasse', 'difficile')).toBe(1200);
  });

  it('CHAQUE COMBINAISON PAR DÉFAUT TIENT dans sa fenêtre — c’est ce que le document ne permettait pas', () => {
    for (const [mo, ni] of COMBINAISONS) {
      const r = REGLAGES_ETOILES[mo][ni];
      expect(capaciteEtoiles(mo, r), `${mo} ${ni}`).toBeGreaterThanOrEqual(r.nombre);
    }
    // Les valeurs du document, elles, ne tenaient pas : la preuve, chiffrée.
    expect(capaciteEtoiles('ciel', { ...REGLAGES_ETOILES.ciel.facile, duree: 1.5 })).toBeLessThan(50);
    expect(capaciteEtoiles('ciel', { ...REGLAGES_ETOILES.ciel.difficile, duree: 1.0 })).toBeLessThan(60);
  });

  it('le Facile reste plus lent que le Difficile, dans les deux modes', () => {
    expect(REGLAGES_ETOILES.ciel.facile.duree).toBeGreaterThan(REGLAGES_ETOILES.ciel.difficile.duree);
    expect(REGLAGES_ETOILES.chasse.facile.duree).toBeGreaterThan(REGLAGES_ETOILES.chasse.difficile.duree);
  });

  it('les réglages du Studio remplacent les défauts champ par champ, bornés', () => {
    const r = reglagesEtoiles([{ kind: MARQUE_ETOILES, reglages: { chasse: { facile: { nombre: 12, points: 'x', duree: 99 } } } }]);
    expect(r.chasse.facile.nombre).toBe(12);
    expect(r.chasse.facile.points).toBe(60);           // illisible : le défaut
    expect(r.chasse.facile.duree).toBe(5);             // borné
    expect(r.ciel.difficile).toEqual(REGLAGES_ETOILES.ciel.difficile);
    expect(reglagesEtoiles(null)).toEqual(REGLAGES_ETOILES);
  });

  it('LE STUDIO CALCULE LA MÊME CAPACITÉ QUE LE SERVEUR', () => {
    for (const [mo, ni] of COMBINAISONS) {
      for (let i = 0; i < 200; i += 1) {
        const r = {
          ...REGLAGES_ETOILES[mo][ni],
          duree: 0.2 + (i % 17) * 0.13, nombre: 10 + i, simultanees: 1 + (i % 5),
          pauseMin: (i % 7) * 0.1, debut: (i % 3) * 0.5, fin: 17 + (i % 4),
        };
        expect(capaciteStudio(mo, r), `${mo} ${JSON.stringify(r)}`).toBe(capaciteEtoiles(mo, r));
      }
    }
  });
});

describe('le ciel', () => {
  it('une vingtaine de points, dans le ciel, jamais trop proches', () => {
    for (let i = 0; i < 100; i += 1) {
      const c = genererCiel();
      expect(c).toHaveLength(NOMBRE_ETOILES);
      for (const p of c) expect(p.x > 0 && p.x < 1 && p.y > 0 && p.y < 1).toBe(true);
      for (let a = 0; a < c.length; a += 1) {
        for (let b = a + 1; b < c.length; b += 1) {
          const d = Math.hypot((c[a].x - c[b].x) * FORMAT_CIEL.largeur, (c[a].y - c[b].y) * FORMAT_CIEL.hauteur);
          // Un sixième de la largeur, moins l'arrondi au dix-millième.
          expect(d).toBeGreaterThanOrEqual(0.4995);
        }
      }
    }
  });

  it('deux manches n’ont pas le même ciel', () => {
    expect(JSON.stringify(genererCiel())).not.toBe(JSON.stringify(genererCiel()));
  });
});

describe('la séquence', () => {
  it('CIEL ÉTOILÉ : le nombre demandé, jamais plus de trois à la fois, et des instants sans étoile', () => {
    for (const ni of ['facile', 'difficile']) {
      const r = REGLAGES_ETOILES.ciel[ni];
      let sansEtoile = 0;
      for (let i = 0; i < 60; i += 1) {
        const s = genererSequence('ciel', r);
        expect(s).toHaveLength(r.nombre);
        for (let t = 0; t <= DUREE_JEU_ETOILES_MS; t += 10) {
          const n = allumeesA(s, t).length;
          expect(n, `${ni} à ${t} ms`).toBeLessThanOrEqual(3);
          if (n === 0 && t > 1500 && t < 18500) sansEtoile += 1;
        }
        for (const a of s) {
          expect(a.fin - a.debut).toBe(Math.round(r.duree * 1000));
          expect(a.debut).toBeGreaterThanOrEqual(r.debut * 1000);
          expect(a.fin).toBeLessThanOrEqual(r.fin * 1000);
        }
      }
      // « Il est possible qu'aucune étoile soit illuminée à un instant. »
      expect(sansEtoile, ni).toBeGreaterThan(0);
    }
  });

  it('CHASSE : une étoile à la fois, des pauses entre 0,1 et 2 s, de la seconde 1 à la seconde 19', () => {
    for (const ni of ['facile', 'difficile']) {
      const r = REGLAGES_ETOILES.chasse[ni];
      for (let i = 0; i < 200; i += 1) {
        const s = genererSequence('chasse', r);
        expect(s).toHaveLength(r.nombre);
        expect(s[0].debut).toBeGreaterThanOrEqual(1000);
        expect(s[s.length - 1].fin).toBeLessThanOrEqual(19000);
        for (let k = 1; k < s.length; k += 1) {
          const pause = s[k].debut - s[k - 1].fin;
          expect(pause, `${ni} pause ${k}`).toBeGreaterThanOrEqual(99);
          expect(pause, `${ni} pause ${k}`).toBeLessThanOrEqual(2001);
          // Jamais deux fois la même étoile de suite.
          expect(s[k].etoile).not.toBe(s[k - 1].etoile);
        }
      }
    }
  });

  it('une étoile ne se rallume jamais sous le doigt : un repos entre deux allumages de la même', () => {
    for (let i = 0; i < 100; i += 1) {
      const s = genererSequence('ciel', REGLAGES_ETOILES.ciel.difficile);
      const parEtoile = new Map();
      for (const a of s) {
        const avant = parEtoile.get(a.etoile);
        if (avant != null) expect(a.debut - avant).toBeGreaterThanOrEqual(350);
        parEtoile.set(a.etoile, a.fin);
      }
    }
  });

  it('un réglage impossible n’allume que ce qui tient, sans jamais dépasser le plafond', () => {
    const r = { ...REGLAGES_ETOILES.ciel.facile, duree: 1.5 };
    const s = genererSequence('ciel', r);
    expect(s.length).toBe(capaciteEtoiles('ciel', r));
    for (let t = 0; t <= 20000; t += 10) expect(allumeesA(s, t).length).toBeLessThanOrEqual(3);
  });
});

describe('l’arbitre', () => {
  const rt = {
    ciel: genererCiel(),
    allumages: [
      { k: 0, etoile: 4, debut: 1000, fin: 1900 },
      { k: 1, etoile: 7, debut: 3000, fin: 3900 },
      { k: 2, etoile: 4, debut: 6000, fin: 6900 },
    ],
  };
  const neuf = () => ({ bons: [], rates: 0 });

  it('une étoile allumée touchée à temps : comptée, une seule fois', () => {
    const e = neuf();
    expect(arbitrerTouche(rt, e, { etoile: 4, t: 1200 }, 1250).verdict).toBe('bon');
    expect(arbitrerTouche(rt, e, { etoile: 4, t: 1300 }, 1350).verdict).toBe('deja');
    expect(e.bons).toEqual([0]);
    expect(e.rates).toBe(0);
  });

  it('LE REBOND JUSTE APRÈS L’EXTINCTION ne coûte rien', () => {
    const e = neuf();
    arbitrerTouche(rt, e, { etoile: 7, t: 3800 }, 3850);
    expect(arbitrerTouche(rt, e, { etoile: 7, t: 4000 }, 4050).verdict).toBe('deja');
    expect(e.rates).toBe(0);
  });

  it('un point éteint touché : un raté', () => {
    const e = neuf();
    expect(arbitrerTouche(rt, e, { etoile: 9, t: 1200 }, 1250).verdict).toBe('rate');
    expect(arbitrerTouche(rt, e, { etoile: 4, t: 2500 }, 2550).verdict).toBe('rate');
    expect(e.rates).toBe(2);
  });

  it('LA MÊME ÉTOILE RALLUMÉE plus tard se compte à nouveau', () => {
    const e = neuf();
    arbitrerTouche(rt, e, { etoile: 4, t: 1200 }, 1250);
    expect(arbitrerTouche(rt, e, { etoile: 4, t: 6100 }, 6150).verdict).toBe('bon');
    expect(e.bons).toEqual([0, 2]);
  });

  it('L’ANNONCE DU TÉLÉPHONE EST BORNÉE : jamais plus tard que l’arrivée, jamais plus de 0,75 s avant', () => {
    // Le réseau a coûté 300 ms : la touche annoncée à 1850 arrive à 2150, après
    // l'extinction. Elle compte — c'est l'instant du doigt qui juge.
    expect(arbitrerTouche(rt, neuf(), { etoile: 4, t: 1850 }, 2150).verdict).toBe('bon');
    // Un téléphone qui annonce un instant trop ancien est ramené à 0,75 s avant
    // l'arrivée : ici après l'extinction, donc un raté.
    expect(arbitrerTouche(rt, neuf(), { etoile: 4, t: 1200 }, 2800).verdict).toBe('rate');
    // Un instant annoncé DANS LE FUTUR est ramené à l'arrivée.
    expect(arbitrerTouche(rt, neuf(), { etoile: 7, t: 3500 }, 2500).verdict).toBe('rate');
  });

  it('AVANT LE DÉPART ET APRÈS LA FIN, UNE TOUCHE NE COMPTE PAS', () => {
    const e = neuf();
    expect(arbitrerTouche(rt, e, { etoile: 4, t: -500 }, -400).verdict).toBe('hors');
    expect(arbitrerTouche(rt, e, { etoile: 4, t: 20_300 }, 20_400).verdict).toBe('hors');
    expect(e).toEqual(neuf());
  });

  it('une touche illisible est écartée', () => {
    for (const v of [null, { etoile: 99, t: 1200 }, { etoile: -1, t: 1200 }, { etoile: 1.5, t: 1200 }, { t: 1200 }]) {
      expect(arbitrerTouche(rt, neuf(), v, 1250).verdict, JSON.stringify(v)).toBe('invalide');
    }
  });

  it('les points : gagnés moins perdus', () => {
    expect(pointsEtoiles({ bons: [1, 2, 3], rates: 1 }, 20)).toEqual({ gagnes: 60, perdus: 20, total: 40 });
    expect(pointsEtoiles({ bons: [], rates: 2 }, 60)).toEqual({ gagnes: 0, perdus: 120, total: -120 });
  });
});

describe('le module', () => {
  it('se déclare comme un jeu de touches en direct, de vingt secondes', () => {
    expect(m.meta).toMatchObject({ type: 'etoiles', name: 'Chasse aux étoiles', dureeS: 20, direct: true, touches: true, scored: true });
  });

  it('la manche dure trois secondes de compte à rebours, vingt de jeu, et une marge pour le réseau', () => {
    const rt = m.buildRound({ mode: 'chasse', niveau: 'difficile' });
    expect(rt.durationMs).toBeGreaterThan(COMPTE_A_REBOURS_ETOILES_MS + DUREE_JEU_ETOILES_MS);
    expect(rt.durationMs).toBeLessThan(COMPTE_A_REBOURS_ETOILES_MS + DUREE_JEU_ETOILES_MS + 1500);
    const pub = m.publicQuestion(rt);
    expect(pub).toMatchObject({ mode: 'chasse', niveau: 'difficile', nomMode: 'Chasse', nomNiveau: 'Difficile', points: 60, compteAReboursMs: 3000, dureeJeuMs: 20000 });
    expect(pub.ciel).toHaveLength(20);
    expect(pub.allumages).toHaveLength(20);
  });

  it('suit les réglages attachés par le serveur, et retombe sur les défauts', () => {
    const reglages = reglagesEtoiles([{ kind: MARQUE_ETOILES, reglages: { ciel: { facile: { nombre: 12, points: 7 } } } }]);
    const rt = m.buildRound({ mode: 'ciel', niveau: 'facile', reglages });
    expect(rt.allumages).toHaveLength(12);
    expect(rt.points).toBe(7);
    expect(m.buildRound({ mode: 'inconnu', niveau: 'x' })).toMatchObject({ mode: 'ciel', niveau: 'facile' });
  });

  it('le score : bons, ratés, solde négatif compris, et le classement du meilleur au pire', () => {
    const rt = m.buildRound({ mode: 'chasse', niveau: 'facile' });
    const [a, b] = rt.allumages;
    const touche = (pid, etoile, t) => m.toucher(rt, pid, { etoile, t }, t + COMPTE_A_REBOURS_ETOILES_MS);
    touche('champion', a.etoile, a.debut + 50);
    touche('champion', b.etoile, b.debut + 50);
    touche('presse', (a.etoile + 1) % 20, a.debut + 50);
    touche('presse', (a.etoile + 2) % 20, a.debut + 60);
    rt.answers = new Map([...rt.touches].map(([pid, e]) => [pid, { value: e }]));
    const { results, reveal, prives } = m.score(rt);
    expect(results.get('champion')).toMatchObject({ base: 120, bons: 2, rates: 0, brut: 120, correct: true });
    expect(results.get('presse')).toMatchObject({ base: -120, bons: 0, rates: 2, correct: false });
    expect(prives.classement.map((l) => l.pid)).toEqual(['champion', 'presse']);
    expect(prives.classement[0]).toMatchObject({ score: 120, bons: 2, rates: 0, rang: 1 });
    expect(reveal.stats).toMatchObject({ kind: 'etoiles', total: 2, allumages: 15, totalBons: 2, totalRates: 2, maximum: 900, meilleur: 120 });
    expect(JSON.stringify(reveal)).not.toMatch(/champion|presse/);
  });
});

describe('le stream et l’emblème', () => {
  it('LE STREAM A UNE PHRASE À CHAQUE MANCHE, sur la part d’étoiles attrapées', () => {
    const st = (total, totalBons, reussite) => ({ kind: 'etoiles', total, totalBons, reussite });
    expect(momentDePlateau('etoiles', st(2, 30, 75))).toBe('stream.etoiles-conquis');
    expect(momentDePlateau('etoiles', st(1, 5, 40))).toBe('stream.etoiles-belle');
    expect(momentDePlateau('etoiles', st(12, 9, 10))).toBe('stream.etoiles-filantes');
    expect(momentDePlateau('etoiles', st(4, 0, 0))).toBe('stream.etoiles-personne');
    expect(momentDePlateau('etoiles', st(0, 0, 0))).toBe('stream.etoiles-personne');
  });

  it('l’emblème tient dans sa grille, neuf unités de marge', () => {
    expect(marque.margeDeGrille()).toBe(9);
    for (const e of marque.ETOILES) {
      expect(e.cx - e.R).toBeGreaterThanOrEqual(marque.ENCRE.g);
      expect(e.cx + e.R).toBeLessThanOrEqual(marque.ENCRE.d);
      expect(e.cy - e.R).toBeGreaterThanOrEqual(marque.ENCRE.h);
      expect(e.cy + e.R).toBeLessThanOrEqual(marque.ENCRE.b);
    }
  });
});
