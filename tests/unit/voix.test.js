// CONTRÔLE BLOQUANT DE LA VOIX DU JEU (action 7 du PLAN-CHANTIER-v1).
//
// Ce fichier n'est pas qu'une batterie de tests : c'est le GARDE-FOU de la
// convention. Toute nouvelle surface et tout nouveau type de jeu doit déclarer
// ses moments de voix — sans quoi la suite échoue.
//
// Il exige une DÉCLARATION, pas une œuvre : une phrase de repli suffit à passer.
// Sa limite, assumée : il garantit qu'une déclaration existe, jamais qu'elle est
// bonne. Qu'une phrase soit plate reste affaire de relecture humaine.
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import { MOMENTS, SURFACES, LONGUEUR_MAX, PRIORITE_PLATEAU, dire, reinitialiserVoix, momentDePlateau } from '../../src/client/shared/voix.js';
import { MODULE_TYPES } from '../../src/server/modules.js';

beforeEach(() => reinitialiserVoix());

describe('convention de la voix — contrôle bloquant', () => {
  it('chaque moment déclaré a au moins une phrase', () => {
    for (const [id, m] of Object.entries(MOMENTS)) {
      expect(m.phrases, `moment « ${id} » sans phrase`).toBeDefined();
      expect(m.phrases.length, `moment « ${id} » sans phrase`).toBeGreaterThan(0);
    }
  });

  it('chaque moment déclare la CONDITION qui le déclenche', () => {
    // C'est ce qui empêche une phrase de mentir : elle est rattachée à un fait
    // vérifié sur les données, jamais à une ambiance générale.
    for (const [id, m] of Object.entries(MOMENTS)) {
      expect(m.quand, `moment « ${id} » sans condition documentée`).toBeTruthy();
      expect(m.surface, `moment « ${id} » sans surface`).toBeTruthy();
      expect(SURFACES, `surface inconnue pour « ${id} »`).toContain(m.surface);
    }
  });

  it('aucune phrase ne contient d\'emoji — convention du projet', () => {
    const emoji = /\p{Extended_Pictographic}/u;
    for (const [id, m] of Object.entries(MOMENTS)) {
      for (const p of m.phrases) {
        expect(emoji.test(p), `emoji dans « ${id} » : ${p}`).toBe(false);
      }
    }
  });

  it('aucune phrase ne dépasse la longueur lisible sur un écran de résultat', () => {
    for (const [id, m] of Object.entries(MOMENTS)) {
      for (const p of m.phrases) {
        expect(p.length, `phrase trop longue dans « ${id} » : ${p}`).toBeLessThanOrEqual(LONGUEUR_MAX);
      }
    }
  });

  it('les repères dynamiques sont DÉCLARÉS avant d\'être employés', () => {
    // Une phrase qui emploie {serie} sans que le moment le déclare afficherait le
    // repère brut à l'écran, en direct.
    for (const [id, m] of Object.entries(MOMENTS)) {
      const declares = new Set(m.requiert || []);
      for (const p of m.phrases) {
        for (const [, cle] of p.matchAll(/\{(\w+)\}/g)) {
          expect(declares.has(cle), `« ${cle} » employé sans être déclaré dans « ${id} »`).toBe(true);
        }
      }
    }
  });

  it('CHAQUE TYPE DE JEU a ses moments de résultat', () => {
    // LE CŒUR DU CONTRÔLE : un nouveau type de jeu livré sans sa voix échoue ici.
    const parType = {
      quiz: ['juste.simple', 'faux'],
      true_false: ['juste.simple', 'faux'],
      estimation: ['estimation.mille', 'estimation.proche', 'estimation.correct', 'estimation.loin', 'estimation.hors'],
      vote: ['vote.majorite', 'vote.minorite', 'vote.sondage'],
    };
    for (const type of MODULE_TYPES) {
      expect(parType[type], `le type de jeu « ${type} » n'a aucun moment de voix déclaré`).toBeDefined();
      for (const id of parType[type]) {
        expect(MOMENTS[id], `moment « ${id} » manquant pour « ${type} »`).toBeDefined();
      }
    }
  });

  it('CHAQUE ROUTE de l\'application est couverte par la convention', () => {
    // Les routes sont énumérées à un seul endroit : une route ajoutée sans entrée
    // dans SURFACES fait échouer le contrôle.
    const main = fs.readFileSync('src/client/main.jsx', 'utf8');
    const routes = [...main.matchAll(/path\.startsWith\('\/(\w+)'\)/g)].map((m) => m[1]);
    expect(routes.length).toBeGreaterThan(0);
    for (const r of routes) {
      expect(SURFACES, `la route « /${r} » n'est pas déclarée dans SURFACES`).toContain(r);
    }
  });

  it('l\'ordre de priorité du plateau ne cite que des moments existants', () => {
    for (const id of PRIORITE_PLATEAU) {
      expect(MOMENTS[id], `« ${id} » cité en priorité mais non déclaré`).toBeDefined();
    }
  });
});

describe('choix des phrases', () => {
  it('ne répète pas tant que le stock n\'est pas épuisé', () => {
    const n = MOMENTS['juste.simple'].phrases.length;
    const vues = new Set();
    for (let i = 0; i < n; i += 1) vues.add(dire('juste.simple'));
    // Dix bonnes réponses de suite ne doivent pas donner dix fois la même
    // félicitation : c'est l'usure qui tue ce genre de dispositif.
    expect(vues.size).toBe(n);
  });

  it('remplit les repères déclarés', () => {
    const p = dire('juste.serie', { serie: 4 });
    expect(p).toContain('4');
    expect(p).not.toContain('{serie}');
  });

  it('rend null sur un moment inconnu plutôt que de casser l\'écran', () => {
    expect(dire('moment.qui.n.existe.pas')).toBeNull();
  });
});

describe('le plateau ne parle que sur le remarquable', () => {
  it('se tait en dessous du seuil de participation', () => {
    // Un pourcentage sur trois joueurs ne veut rien dire, et « 100 % ont trouvé »
    // avec deux participants est ridicule à l'antenne.
    const stats = { kind: 'options', tally: [3, 0], total: 3 };
    expect(momentDePlateau('quiz', stats, { correctIndex: 0 })).toBeNull();
  });

  it('se tait sur une répartition ordinaire', () => {
    // Cinq bonnes réponses sur dix, aucune option délaissée, pas d'égalité en
    // tête : rien de remarquable. Le stream se tait, et c'est voulu — commenter
    // la répartition est le métier de l'animateur.
    expect(momentDePlateau('quiz', { kind: 'options', tally: [5, 3, 2], total: 10 }, { correctIndex: 0 }))
      .toBeNull();
  });

  it('repère une option que personne n\'a choisie', () => {
    // Écart de 2 entre les deux premières : pas d'égalité, donc c'est bien
    // l'option morte qui parle.
    expect(momentDePlateau('quiz', { kind: 'options', tally: [5, 3, 0], total: 8 }, { correctIndex: 0 }))
      .toBe('stream.option-morte');
  });

  it('repère l\'unanimité, le zéro pointé et le piège', () => {
    expect(momentDePlateau('quiz', { kind: 'options', tally: [8, 0, 0], total: 8 }, { correctIndex: 0 }))
      .toBe('stream.unanimite-juste');
    expect(momentDePlateau('quiz', { kind: 'options', tally: [0, 5, 3], total: 8 }, { correctIndex: 0 }))
      .toBe('stream.personne');
    // Piège : une mauvaise option recueille plus de voix que la bonne.
    expect(momentDePlateau('quiz', { kind: 'options', tally: [2, 6, 0], total: 8 }, { correctIndex: 0 }))
      .toBe('stream.piege');
  });

  it('une seule condition parle, selon la priorité', () => {
    // Unanimité ET option morte se déclenchent ensemble : l'unanimité prime.
    const m = momentDePlateau('quiz', { kind: 'options', tally: [8, 0], total: 8 }, { correctIndex: 0 });
    expect(m).toBe('stream.unanimite-juste');
  });

  it('lit la dispersion des estimations', () => {
    expect(momentDePlateau('estimation', {
      kind: 'numeric', total: 6, target: 100, avg: 103, closest: 100,
    })).toBe('stream.estim-quelquun-proche');
    expect(momentDePlateau('estimation', {
      kind: 'numeric', total: 6, target: 100, avg: 400, closest: 250,
    })).toBe('stream.estim-personne-proche');
  });
});
