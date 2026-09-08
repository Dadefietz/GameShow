// LES EMBLÈMES DES QUATRE JEUX CLASSIQUES, ET LE BLANC ENTRE DEUX IMAGES.
//
// POURQUOI MESURER UN DESSIN. Un emblème qui déborde de sa grille n'est signalé
// par rien : le navigateur le RECADRE, sans erreur ni avertissement, et il
// arrive rogné sur la toile du stream — à trois cents pixels de haut, devant le
// public. Chacun des emblèmes précédents a connu au moins un dessin fautif qu'il
// a fallu voir à l'écran ; ce qui se mesure ici, c'est ce qu'une relecture ne
// voit pas.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { EMBLEMES_JEUX, margeDe, rapportDe } from '../../src/client/shared/marque-jeux.js';
import { BLANC_MS } from '../../src/client/shared/defile.js';
import { CADENCE_RETOUR } from '../../src/server/modules.js';

const TYPES = Object.keys(EMBLEMES_JEUX);

describe('les emblèmes des jeux classiques', () => {
  it('couvrent les quatre jeux', () => {
    expect(TYPES.sort()).toEqual(['estimation', 'quiz', 'true_false', 'vote']);
  });

  for (const type of TYPES) {
    it(`« ${type} » tient dans sa grille, trait compris`, () => {
      // La marge est comptée depuis le MILIEU du trait : un tracé posé sur le
      // bord de la grille déborde de la moitié de son épaisseur.
      expect(margeDe(type), `l'emblème « ${type} » déborde de sa grille`).toBeGreaterThanOrEqual(0);
    });

    it(`« ${type} » déclare une grille et un viewBox d'accord`, () => {
      // Les surfaces demandent une LARGEUR ; la hauteur se déduit du rapport. Un
      // viewBox en désaccord avec la grille écraserait le dessin.
      const e = EMBLEMES_JEUX[type];
      expect(e.viewBox).toBe(`0 0 ${e.grille.l} ${e.grille.h}`);
      expect(rapportDe(type)).toBeCloseTo(e.grille.h / e.grille.l, 10);
    });

    it(`« ${type} » garde sa boîte à l'intérieur de sa grille`, () => {
      // La boîte est celle de L'ENCRE, demi-trait compris là où la forme est
      // tracée : rien à retrancher ici, elle se compare telle quelle à la grille.
      const { boite, grille } = EMBLEMES_JEUX[type];
      expect(boite.g).toBeGreaterThanOrEqual(0);
      expect(boite.h).toBeGreaterThanOrEqual(0);
      expect(boite.d).toBeLessThanOrEqual(grille.l);
      expect(boite.b).toBeLessThanOrEqual(grille.h);
      // Et elle reste une boîte : un dessin ne peut pas finir avant de commencer.
      expect(boite.d).toBeGreaterThan(boite.g);
      expect(boite.b).toBeGreaterThan(boite.h);
    });
  }

  it("ne sont dessinés qu'au trait, jamais en image matricielle", () => {
    // RÈGLE DU DÉPÔT : aucune icône matricielle. Un PNG ne prendrait ni la
    // couleur du texte ni l'épaisseur du système, et se pixelliserait à 300 px.
    const src = fs.readFileSync('src/client/shared/EmblemeJeu.jsx', 'utf8');
    expect(/\.(png|jpe?g|gif|webp)/i.test(src)).toBe(false);
  });

  it("retombe sans casser sur un type inconnu", () => {
    expect(rapportDe('inexistant')).toBe(1);
    expect(margeDe('inexistant')).toBe(0);
  });
});

describe('le blanc entre deux images', () => {
  it('se voit sans manger le temps d\'observation', () => {
    // CE QU'IL CORRIGE : deux images identiques qui se suivent ne changent rien à
    // l'écran — et c'est précisément le moment où il faut buzzer. Trop court, il
    // ne se remarque pas ; trop long, il ampute l'image qui n'en dure que deux
    // secondes.
    expect(BLANC_MS).toBeGreaterThan(0);
    expect(BLANC_MS).toBeLessThan(CADENCE_RETOUR / 4);
  });

  it('se cale sur la PLACE dans la série, jamais sur l\'identifiant', () => {
    // LE DÉFAUT QU'IL FAUT INTERDIRE : deux images identiques portent le même
    // identifiant. Un blanc calé dessus ne verrait pas le changement — c'est
    // exactement le cas qu'on corrige, et il passerait inaperçu partout ailleurs.
    for (const f of ['src/client/play/PlayApp.jsx', 'src/client/overlay/OverlayApp.jsx']) {
      const src = fs.readFileSync(f, 'utf8');
      const appels = [...src.matchAll(/useBlancEntreImages\(([^)]*)\)/g)].map((m) => m[1]);
      expect(appels.length, `aucun blanc entre les images dans ${f}`).toBeGreaterThan(0);
      for (const a of appels) {
        expect(a.includes('Place'), `le blanc de ${f} ne se cale pas sur la place : ${a}`).toBe(true);
      }
    }
  });
});
