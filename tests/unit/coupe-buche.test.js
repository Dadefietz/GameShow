// « COUPE TA BÛCHE » — le curseur, le barème, l'emblème.
//
// LE CONTRÔLE CENTRAL EST LE PREMIER : les deux formules du curseur. Il est
// promis mot pour mot dans les deux fichiers qui les portent, et c'est le seul
// endroit du projet où un calcul de score existe en double exemplaire.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import {
  positionDuCurseur as positionArbitre,
  borneDeProportion,
  coupeDuJoueur,
  DUREE_COUPE,
  PERIODE_COUPE,
  TOLERANCE_COUPE_MS,
  plagesEstimation,
  modules,
} from '../../src/server/modules.js';
import { positionDuCurseur as positionEcran, pourcent } from '../../src/client/shared/proportion.js';
import { margeDeGrille, GRILLE, BOITE } from '../../src/client/shared/marque-buche.js';

describe('le curseur de la bûche', () => {
  it("L'ARBITRE ET L'ÉCRAN PLACENT LE CURSEUR AU MÊME ENDROIT, sur deux mille instants", () => {
    // CE QUE CE CONTRÔLE GARDE. La formule vit deux fois : dans `modules.js`, qui
    // compte les points, et dans `proportion.js`, qui dessine. Elles ne peuvent
    // pas s'importer l'une l'autre sans faire entrer du code serveur dans le
    // paquet du navigateur. Si elles divergeaient, le joueur couperait à un
    // endroit et le serveur en compterait un autre : le jeu tournerait
    // normalement, les points seraient faux, et RIEN ne le signalerait — ni une
    // erreur, ni un écran cassé, ni un test d'intégration.
    //
    // Deux mille instants couvrent les dix secondes de jeu à cinq millisecondes
    // près, soit cinq allers-retours complets du curseur.
    for (let ms = 0; ms <= DUREE_COUPE * 1000; ms += 5) {
      expect(positionEcran(ms, PERIODE_COUPE)).toBeCloseTo(positionArbitre(ms, PERIODE_COUPE), 10);
    }
  });

  it('part à gauche, touche la droite à la demi-période, revient', () => {
    expect(positionArbitre(0)).toBe(0);
    expect(positionArbitre(PERIODE_COUPE / 2)).toBe(100);
    expect(positionArbitre(PERIODE_COUPE)).toBe(0);
    // Un aller-retour par période : la cinquième seconde retrouve la première.
    expect(positionArbitre(250)).toBeCloseTo(positionArbitre(250 + 4 * PERIODE_COUPE), 10);
    // Le milieu de chaque trajet, dans un sens puis dans l'autre.
    expect(positionArbitre(500)).toBe(50);
    expect(positionArbitre(1500)).toBe(50);
  });

  it("ne sort jamais de la bûche, même sur un temps négatif ou immense", () => {
    for (const ms of [-1, -12345, 0, 1, 999999, 10_000]) {
      const p = positionArbitre(ms);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(100);
    }
  });
});

describe('la coupe retenue', () => {
  const rt = { startedAt: 1_000_000 };
  const coupe = (msDepuisDepart, annonce) => coupeDuJoueur(rt, {
    at: rt.startedAt + msDepuisDepart,
    value: annonce,
  });

  it("retient l'annonce du joueur quand elle tient dans la tolérance réseau", () => {
    // POURQUOI L'ANNONCE PLUTÔT QUE L'ARRIVÉE. Le curseur parcourt cent points de
    // bûche par seconde : cent millisecondes de réseau, ce sont dix points, soit
    // dix fois le palier le plus haut. Arbitrer sur la seule heure d'arrivée ne
    // mesurerait plus l'adresse du joueur mais la latence de sa liaison.
    // 1000 ms, c'est la demi-période : le curseur est au bout de la bûche.
    // L'arrivée, elle, tombe 200 ms plus tard, à 80 % — vingt points d'écart.
    expect(coupe(1200, 1000)).toBe(Math.round(positionArbitre(1000)));
    expect(coupe(1200, 1000)).toBe(100);
  });

  it("ramène une annonce plus vieille que la tolérance", () => {
    // Un joueur qui annoncerait avoir frappé deux secondes plus tôt choisirait sa
    // position sur la bûche : la fenêtre s'arrête à la tolérance.
    const arrivee = 4000;
    const attendu = Math.round(positionArbitre(arrivee - TOLERANCE_COUPE_MS));
    expect(coupe(arrivee, 100)).toBe(attendu);
    expect(coupe(arrivee, arrivee - TOLERANCE_COUPE_MS - 1)).toBe(attendu);
  });

  it("ne laisse personne annoncer plus tard qu'il n'est arrivé", () => {
    const arrivee = 3000;
    expect(coupe(arrivee, arrivee + 500)).toBe(Math.round(positionArbitre(arrivee)));
  });

  it("retombe sur l'heure d'arrivée quand le joueur n'annonce rien", () => {
    expect(coupeDuJoueur(rt, { at: rt.startedAt + 1500 })).toBe(Math.round(positionArbitre(1500)));
    expect(coupeDuJoueur(rt, { at: rt.startedAt + 1500, value: null })).toBe(Math.round(positionArbitre(1500)));
  });

  it('ne dépasse jamais la fin du jeu', () => {
    // La fenêtre de réponse est plus longue que le jeu (le serveur laisse une
    // marge pour que frapper à zéro reste possible) : ce qui arrive après la
    // dixième seconde se lit à la dixième seconde, là où le curseur s'est arrêté.
    const plafond = DUREE_COUPE * 1000;
    expect(coupe(plafond + 900, plafond + 900)).toBe(Math.round(positionArbitre(plafond)));
  });
});

describe('le barème de la proportion', () => {
  it('encadre la cible comme l\'énoncé le demande', () => {
    // L'EXEMPLE DE L'ÉNONCÉ, à la cible de 80 % : 79–81 dans le mille,
    // 77–83 proche, 75–85 correct, 70–90 loin. Les bornes se lisent ici.
    const plages = plagesEstimation(80, 'proportion');
    const bornes = plages.flatMap((p) => [p.bas, p.haut]);
    for (const b of [70, 75, 77, 79, 81, 83, 85, 90]) {
      expect(bornes.includes(b), `borne ${b} absente du barème`).toBe(true);
    }
    expect(plages[0].bas).toBe(79);
    expect(plages[0].haut).toBe(81);
    expect(plages[plages.length - 1].bas).toBe(70);
    expect(plages[plages.length - 1].haut).toBe(90);
    // Des POINTS de pourcentage, jamais un pourcentage du pourcentage.
    expect(plages[0].libelle).toBe('± 1 pt');
  });

  it('ramène la saisie de l\'animateur dans la bûche, et à l\'entier', () => {
    expect(borneDeProportion(80)).toBe(80);
    expect(borneDeProportion(80.4)).toBe(80);
    expect(borneDeProportion(-5)).toBe(0);
    expect(borneDeProportion(140)).toBe(100);
    expect(borneDeProportion('rien')).toBe(0);
  });

  it('écrit ses valeurs en points de pourcentage', () => {
    expect(pourcent(80)).toBe('80 %');
    expect(pourcent(null)).toBe('—');
  });
});

describe('le module', () => {
  const meta = modules.coupe_buche.meta;

  it('se joue en direct, sans banque de questions', () => {
    // La proportion se saisit à l'antenne : rien à préparer au Studio.
    expect(meta.direct).toBe(true);
  });

  it('annonce au joueur la durée du jeu, et non celle de la fenêtre', () => {
    // LE DÉFAUT VU À L'ÉCRAN : le chrono affichait 12 — la fenêtre de réponse,
    // marge comprise — là où l'énoncé demande dix secondes. Le joueur voyait donc
    // le curseur s'arrêter deux secondes avant la fin de son compte à rebours.
    expect(meta.dureeCoupeMs).toBe(DUREE_COUPE * 1000);
    expect(meta.periodeMs).toBe(PERIODE_COUPE);
  });
});

describe("l'emblème de la bûche", () => {
  it('ne déborde pas de sa grille', () => {
    // LE DÉFAUT QU'IL A TROUVÉ : le sommet du fer tombait à −1 une fois le trait
    // compté. Rien ne le signalait — un emblème qui déborde est RECADRÉ.
    expect(margeDeGrille()).toBeGreaterThanOrEqual(0);
    expect(BOITE.d).toBeLessThanOrEqual(GRILLE.largeur);
    expect(BOITE.b).toBeLessThanOrEqual(GRILLE.hauteur);
    expect(BOITE.g).toBeGreaterThanOrEqual(0);
    expect(BOITE.h).toBeGreaterThanOrEqual(0);
  });

  it("n'est dessiné qu'au trait, jamais en image matricielle", () => {
    const src = fs.readFileSync('src/client/shared/BucheHache.jsx', 'utf8');
    expect(/\.(png|jpe?g|gif|webp)/i.test(src), 'une image matricielle dans un emblème').toBe(false);
  });
});
