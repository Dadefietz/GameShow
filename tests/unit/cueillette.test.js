// « CUEILLETTE » — LA RESSEMBLANCE, ET CE QU'ON PEUT EN VÉRIFIER.
//
// CE QUI A ÉTÉ DEMANDÉ (16/09) : « ce score ne représentera pas une vérité
// absolue […] l'objectif est surtout de classer les joueurs de manière amusante et
// perçue comme JUSTE, pas de produire une évaluation artistique parfaite. »
//
// ================================================================================
// POURQUOI CE FICHIER NE RESSEMBLE À AUCUN AUTRE CONTRÔLE DU PROJET
// ================================================================================
//
// Partout ailleurs il y a une bonne réponse, et le contrôle compare. ICI IL N'Y A
// PAS DE BONNE RÉPONSE : il y a un dessin, et un autre dessin. Une note peut être
// parfaitement calculée et parfaitement ridicule, et aucune assertion du genre
// « le score est entre 0 et 100 » ne s'en apercevrait.
//
// CE QUI SE VÉRIFIE, C'EST L'ORDRE. Sur des figures dont on SAIT ce qu'on attend :
// le dessin exact bat le dessin décalé, qui bat le dessin à moitié, qui bat le
// gribouillis, qui bat la feuille blanche. Un barème qui tient cet ordre sur des
// cas construits tiendra un classement que le public trouve juste ; un barème qui
// ne le tient pas est faux, quels que soient ses nombres.
//
// LES FIGURES SONT DÉCRITES, PAS TIRÉES D'UN FICHIER. Un dessin d'épreuve rangé
// dans le dépôt serait un binaire de plus dont personne ne saurait le contenu ;
// celles-ci se lisent en trois lignes, et l'on peut donc dire ce qu'on attend.
import { describe, it, expect, beforeEach } from 'vitest';
import { momentDePlateau, reinitialiserVoix } from '../../src/client/shared/voix.js';
import { GRILLES_DESSINS } from '../../src/server/dessins-grilles.js';
import { copisteDe, gribouillis as gribouillage } from '../outils/copiste.js';
import { BASSIN_DESSINS } from '../../src/server/dessins.js';
import {
  formeDepuisBits, MARGE_NORMALISATION,
  ressemblance, ressemblanceContreGrilles, grilleDepuisBits, pointsDe, nettoyerDessin, rasteriser, flouter, boiteDe, presenter,
  compterPoints, COTE, TRAITS_MAX, POINTS_PAR_TRAIT_MAX, POINTS_MAX,
  SEUIL_POINTS, PLAFOND_POURCENT, POINTS_PLANCHER, POINTS_MAXIMUM,
} from '../../src/server/cueillette.js';

// --- LES FIGURES -----------------------------------------------------------

// Un carré, tracé d'un seul trait : la figure la plus simple qui ait une forme,
// une taille et une position.
const carre = (x0, y0, cote) => [[
  [x0, y0], [x0 + cote, y0], [x0 + cote, y0 + cote], [x0, y0 + cote], [x0, y0],
]];

// Le même carré, déplacé.
const decale = (d) => carre(0.2 + d, 0.2 + d, 0.6);

// La moitié du carré — deux côtés sur quatre. « Les éléments manquants ».
const moitie = [[[0.2, 0.2], [0.8, 0.2], [0.8, 0.8]]];

// Un gribouillis : une ligne brisée pseudo-aléatoire mais REPRODUCTIBLE, pour que
// le contrôle dise la même chose à chaque exécution.
const gribouillis = (() => {
  let n = 12345;
  const suivant = () => { n = (n * 1664525 + 1013904223) % 4294967296; return n / 4294967296; };
  return [Array.from({ length: 40 }, () => [suivant(), suivant()])];
})();

// Un quart du carré : un seul côté. « Les éléments manquants », poussé plus loin.
const quart = [[[0.2, 0.2], [0.8, 0.2]]];

// Le bon dessin, deux fois trop petit, au même centre. « Les proportions ».
const petit = carre(0.35, 0.35, 0.3);

// Une main qui tremble : le carré, avec du bruit REPRODUCTIBLE sur chaque point.
const tremble = (amplitude) => {
  let n = 999;
  const bruit = () => {
    n = (n * 1103515245 + 12345) % 2147483648;
    return (n / 2147483648 - 0.5) * 2 * amplitude;
  };
  return carre(0.2, 0.2, 0.6).map((t) => t.map(([x, y]) => [x + bruit(), y + bruit()]));
};

const CIBLE = carre(0.2, 0.2, 0.6);
// Le bon dessin, PLUS un gribouillage par-dessus. « Les éléments ajoutés ».
const surcharge = [...CIBLE, ...gribouillis];

describe('la ressemblance entre deux dessins', () => {
  it("un dessin IDENTIQUE à la cible obtient le score maximal", () => {
    const r = ressemblance(CIBLE, CIBLE);
    expect(r.pourcent).toBe(100);
    expect(r.detail.recouvrement).toBeCloseTo(1, 5);
    expect(r.detail.proportions).toBeCloseTo(1, 5);
    expect(r.detail.densite).toBeCloseTo(1, 5);
  });

  it('une feuille BLANCHE vaut ZÉRO', () => {
    // CE CONTRÔLE NE GARDE PAS LA GARDE, et c'est dit franchement : retirer le
    // court-circuit de `ressemblance` ne change rien, les quatre mesures rendant
    // déjà zéro dès qu'un dessin est vide. Ce qu'il garde, c'est le RÉSULTAT —
    // qu'aucune refonte du calcul ne vienne un jour payer une feuille blanche.
    expect(ressemblance(CIBLE, []).pourcent).toBe(0);
    expect(ressemblance(CIBLE, [[]]).pourcent).toBe(0);
    expect(ressemblance(CIBLE, null).pourcent).toBe(0);
    expect(pointsDe(ressemblance(CIBLE, []).pourcent)).toBe(0);
  });

  // LES ORDRES QU'ON PEUT DÉFENDRE, ET SEULEMENT CEUX-LÀ.
  //
  // La première version de ce contrôle imposait une file unique — exact, décalé 2,
  // décalé 8, moitié, gribouillis — et elle était FAUSSE : rien ne dit qu'un carré
  // entier décalé de huit pour cent vaille mieux ou moins qu'une moitié de carré
  // parfaitement placée. Un spectateur hésiterait ; le contrôle ne doit donc pas
  // trancher à sa place. Il ne garde que les comparaisons dont la réponse est
  // évidente pour qui regarde les deux dessins.
  const NOTE = (d) => ressemblance(CIBLE, d).pourcent;

  it.each([
    ['le dessin exact', () => CIBLE, 'un dessin tremblé', () => tremble(0.03)],
    ['un dessin tremblé', () => tremble(0.03), 'un dessin franchement décalé', () => decale(0.08)],
    ['un dessin franchement décalé', () => decale(0.08), 'un gribouillis', () => gribouillis],
    ['le dessin exact', () => CIBLE, 'la moitié du dessin', () => moitie],
    ['la moitié du dessin', () => moitie, 'un quart du dessin', () => quart],
    ['un dessin juste mais trop petit', () => petit, 'un gribouillis', () => gribouillis],
    // « UN QUART DU DESSIN passe avant un gribouillis » A ÉTÉ RETIRÉ D'ICI, et ce
    // retrait est un aveu utile. Le quart, ici, est UN SEUL SEGMENT DROIT. Mis à
    // côté d'un gribouillage qui couvre la zone de la cible, lequel ressemble le
    // plus à un carré ? Personne ne tranche d'un coup d'œil — et c'est exactement
    // le genre de comparaison que le préambule ci-dessus interdit de figer. Elle
    // n'a tenu que tant que les proportions et la densité distribuaient des points
    // à tout le monde ; le jour où elles ont cessé, elle est tombée, et j'ai failli
    // retoucher le barème pour sauver une affirmation qui n'était pas défendable.
    // Ce qui compte de ces deux dessins est ailleurs, et vérifié juste en dessous :
    // NI L'UN NI L'AUTRE NE RAPPORTE LE MOINDRE POINT.
  ])('%s passe avant %s', (nomA, a, nomB, b) => {
    const va = NOTE(a());
    const vb = NOTE(b());
    expect(va, `« ${nomA} » ${va} % ne bat pas « ${nomB} » ${vb} %`).toBeGreaterThan(vb);
  });

  it('un gribouillis ne rapporte AUCUN point — ni rien de ce qui lui ressemble', () => {
    // Noircir la page au hasard recouvre la cible PAR ACCIDENT — c'est la façon la
    // plus simple de tricher, et elle doit rester sans profit.
    //
    // CE CONTRÔLE A ÉTÉ VU FAUX. Il passait pendant que, sur de vrais dessins de la
    // banque, un gribouillis rapportait 140 points sur un chêne et 380 sur un
    // tournesol — parce que les figures de synthèse d'ici sont plus petites et plus
    // simples que les dessins du jeu. Un contrôle vert sur un carré ne dit rien
    // d'une fleur. C'est `tests/outils/planche-cueillette.mjs` qui l'a montré, et
    // c'est pour cela que cet outil existe.
    expect(pointsDe(NOTE(gribouillis))).toBe(0);
    expect(pointsDe(NOTE(surcharge))).toBe(0);
    // Un quart de dessin ne rapporte rien non plus : sous le seuil, on ne marque
    // pas. C'est la règle de l'énoncé, pas un accident du calcul.
    expect(pointsDe(NOTE(quart))).toBe(0);
  });

  it("LE FLOU FAIT SON TRAVAIL — sur la mesure de POSITION, qui est la sienne", () => {
    // SANS FLOU, deux traits parallèles distants de deux cases ne se rencontrent
    // PAS DU TOUT : la mesure de position tombe à zéro pour un dessin que
    // n'importe qui trouverait ressemblant, et le jeu devient injuste — ce que
    // l'énoncé interdit explicitement.
    //
    // UNE PREMIÈRE VERSION DE CE CONTRÔLE regardait le score FINAL, et elle ne
    // gardait rien : la mesure de forme, qui ramène les deux dessins à la même
    // boîte, rend un pour un simple décalage et rattrapait tout le reste. Le
    // sabotage — flou retiré — passait au vert. On regarde donc le terme que le
    // flou sert, et lui seul.
    const proche = ressemblance(CIBLE, decale(0.02));
    expect(proche.detail.recouvrement,
      `un carré décalé de 2 % n'a que ${proche.detail.recouvrement.toFixed(2)} de position commune`)
      .toBeGreaterThan(0.6);
    expect(proche.pourcent).toBeGreaterThan(55);
    expect(pointsDe(proche.pourcent), 'il devrait marquer des points').toBeGreaterThan(0);

    // ET LE FLOU NE DOIT PAS TOUT PARDONNER : un décalage franc doit se voir.
    expect(ressemblance(CIBLE, decale(0.15)).detail.recouvrement).toBeLessThan(0.2);
  });

  it('LES CINQ CRITÈRES DE L\'ÉNONCÉ sont chacun mesurés', () => {
    // « la position des traits, la forme générale, les proportions, les éléments
    // manquants ou ajoutés, la densité ». Chacun doit faire BAISSER le score quand
    // il est seul en cause — sinon il n'est pas mesuré, il est décoratif.

    // POSITION : le même carré, ailleurs.
    const ailleurs = carre(0.05, 0.05, 0.6);
    expect(ressemblance(CIBLE, ailleurs).pourcent).toBeLessThan(100);

    // FORME : un cercle à la place du carré, même taille, même place. Seule la
    // forme diffère — et elle doit se voir sur la mesure qui lui est dédiée.
    const rond = [Array.from({ length: 30 }, (_, i) => (
      [0.5 + 0.3 * Math.cos((i / 30) * 6.283), 0.5 + 0.3 * Math.sin((i / 30) * 6.283)]
    ))];
    expect(ressemblance(CIBLE, rond).detail.forme,
      'un cercle à la place d\'un carré devrait perdre sur la forme').toBeLessThan(0.6);

    // PROPORTIONS : LE RAPPORT DE LA FIGURE, ET NON SA TAILLE.
    //
    // CE CONTRÔLE DISAIT L'INVERSE, et il avait tort. Il exigeait qu'un carré deux
    // fois plus petit PERDE sur les proportions — c'est-à-dire qu'il soit puni une
    // troisième fois pour sa taille, après le recouvrement et après la densité. Vu
    // sur la planche : une pomme juste, tracée petite, valait ZÉRO point, derrière
    // un gribouillis. Un carré plus petit reste un carré ; ses proportions sont
    // intactes, et c'est sa POSITION qui a changé.
    const memeRapport = ressemblance(CIBLE, petit);
    expect(memeRapport.detail.proportions,
      'un carré plus petit reste un carré : ses proportions sont intactes')
      .toBeGreaterThan(0.95);
    expect(memeRapport.detail.recouvrement,
      'et c\'est la POSITION qui doit le punir, une seule fois')
      .toBeLessThan(0.5);

    // CE QUI PERD VRAIMENT SUR LES PROPORTIONS : une figure au mauvais rapport. Un
    // bouleau dessiné dans un carré, une pastèque dessinée en hauteur.
    const aplati = [[[0.1, 0.45], [0.9, 0.45], [0.9, 0.55], [0.1, 0.55], [0.1, 0.45]]];
    expect(ressemblance(CIBLE, aplati).detail.proportions,
      'un rectangle plat à la place d\'un carré devrait perdre sur les proportions')
      .toBeLessThan(0.5);

    // ÉLÉMENTS MANQUANTS : la moitié du tracé.
    expect(ressemblance(CIBLE, moitie).detail.densite,
      'la moitié du tracé devrait perdre sur la densité').toBeLessThan(0.75);

    // ÉLÉMENTS AJOUTÉS : la cible PLUS un gribouillage par-dessus.
    const trop = [...CIBLE, ...gribouillis];
    expect(ressemblance(CIBLE, trop).pourcent,
      'un dessin surchargé devrait perdre des points').toBeLessThan(100);
  });

  it('une figure DENSE mais fausse ne bat pas une figure juste', () => {
    // LE PIÈGE DE LA DENSITÉ SEULE : noircir toute la boîte donnerait beaucoup
    // d'encre et une boîte englobante parfaite. Le recouvrement doit l'emporter.
    const noirci = Array.from({ length: 30 }, (_, i) => (
      [[0.05, 0.05 + i * 0.03], [0.95, 0.05 + i * 0.03]]
    ));
    expect(ressemblance(CIBLE, noirci).pourcent)
      .toBeLessThan(ressemblance(CIBLE, decale(0.08)).pourcent);
  });

  it('le score ne dépend pas de la MAIN qui trace — même figure, plus de points', () => {
    // Deux joueurs tracent le même carré, l'un en quatre gestes, l'autre en cent
    // petits points. Le score doit être le même : on note un dessin, pas un geste.
    const dense = [];
    const cote = [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8], [0.2, 0.2]];
    for (let i = 1; i < cote.length; i += 1) {
      const seg = [];
      for (let k = 0; k <= 25; k += 1) {
        seg.push([
          cote[i - 1][0] + ((cote[i][0] - cote[i - 1][0]) * k) / 25,
          cote[i - 1][1] + ((cote[i][1] - cote[i - 1][1]) * k) / 25,
        ]);
      }
      dense.push(seg);
    }
    expect(Math.abs(ressemblance(CIBLE, dense).pourcent - 100)).toBeLessThanOrEqual(2);
  });
});

describe('ce que le serveur accepte d\'un téléphone', () => {
  it('borne les coordonnées au lieu de refuser le dessin', () => {
    // UN POINT ABERRANT NE DOIT PAS COÛTER LE DESSIN ENTIER : ce serait punir un
    // joueur pour un défaut de son navigateur.
    const propre = nettoyerDessin([[[-5, 0.5], [2, 0.5], [0.3, 0.3]]]);
    expect(propre[0]).toEqual([[0, 0.5], [1, 0.5], [0.3, 0.3]]);
  });

  it('jette ce qui ne se lit pas, garde le reste', () => {
    const propre = nettoyerDessin([
      [[0.1, 0.1], ['a', 0.2], [null, null], [0.3, 0.3]],
      'pas un trait',
      [],
      [[0.5, 0.5]],
    ]);
    expect(propre).toEqual([[[0.1, 0.1], [0.3, 0.3]], [[0.5, 0.5]]]);
  });

  it('accepte les deux écritures d\'un point', () => {
    expect(nettoyerDessin([[{ x: 0.2, y: 0.4 }]])).toEqual([[[0.2, 0.4]]]);
  });

  it('BORNE CE QU\'UN SEUL JOUEUR PEUT ENVOYER', () => {
    // Mille joueurs, trente secondes, un salon : sans bornes, un seul téléphone
    // peut occuper le serveur pour tout le monde.
    const enorme = Array.from({ length: 2000 }, () => (
      Array.from({ length: 2000 }, () => [0.5, 0.5])
    ));
    const propre = nettoyerDessin(enorme);
    expect(propre.length).toBeLessThanOrEqual(TRAITS_MAX);
    expect(Math.max(...propre.map((t) => t.length))).toBeLessThanOrEqual(POINTS_PAR_TRAIT_MAX);
    expect(compterPoints(propre)).toBeLessThanOrEqual(POINTS_MAX);
  });
});

describe('la rastérisation', () => {
  it('relie deux points éloignés — un geste rapide n\'est pas un pointillé', () => {
    // DEUX POINTS CONSÉCUTIFS D'UN GESTE RAPIDE peuvent être distants de vingt
    // cases. Les relier par leurs seules extrémités laisserait un trait troué, et
    // un dessin rapide serait noté comme un dessin incomplet.
    const g = rasteriser([[[0.1, 0.5], [0.9, 0.5]]]);
    const ligne = [];
    for (let x = 0; x < COTE; x += 1) ligne.push(g[Math.round(0.5 * (COTE - 1)) * COTE + x]);
    const allumes = ligne.filter((v) => v > 0.3).length;
    expect(allumes, `seulement ${allumes} cases allumées sur la traversée`).toBeGreaterThan(COTE * 0.7);
  });

  it('la boîte englobante suit le dessin, pas la grille', () => {
    const b = boiteDe(flouter(rasteriser(carre(0.25, 0.25, 0.5))));
    expect(b).not.toBeNull();
    // Un quart de côté, à trois cases près — le flou élargit un peu la boîte.
    expect(Math.abs(b.x - 0.25 * (COTE - 1))).toBeLessThan(4);
    expect(Math.abs(b.l - 0.5 * (COTE - 1))).toBeLessThan(8);
    expect(Math.abs(b.cx - (COTE - 1) / 2)).toBeLessThan(3);
  });

  it('une grille vide n\'a pas de boîte', () => {
    expect(boiteDe(rasteriser([]))).toBeNull();
  });
});

describe('la courbe de présentation', () => {
  it('est strictement croissante — elle ne change AUCUN classement', () => {
    // C'est la seule propriété qui compte : la courbe rend le score lisible, elle
    // ne doit pas réordonner les joueurs. Si elle le faisait, le classement
    // affiché ne serait plus celui que le calcul a produit.
    let precedent = -1;
    for (let b = 0; b <= 1.0001; b += 0.005) {
      const v = presenter(b);
      expect(v).toBeGreaterThanOrEqual(precedent);
      precedent = v;
    }
  });

  it('remplit les vingt tranches de cinq pour cent que l\'écran demande', () => {
    // « le graphique va de 0 % à 100 % et les résultats sont répartis par tranche
    // de 5 %, il doit donc y avoir 20 tranches ». Un score tassé entre dix et
    // trente pour cent laisserait dix-huit tranches vides en permanence.
    // LE BALAYAGE COUVRE TOUTE LA PLAGE BRUTE, de zéro à un. Une première version
    // s'arrêtait aux anciennes bornes de la courbe : elle ne parcourait plus que la
    // moitié de l'échelle et accusait le code d'un défaut qui était le sien.
    const atteintes = new Set();
    for (let b = 0; b <= 1.0001; b += 0.002) atteintes.add(Math.min(19, Math.floor(presenter(b) / 5)));
    expect(atteintes.size, `seulement ${atteintes.size} tranches sur 20 sont atteignables`).toBe(20);
  });

  it('borne à zéro et à cent', () => {
    expect(presenter(-1)).toBe(0);
    expect(presenter(0)).toBe(0);
    expect(presenter(2)).toBe(100);
  });
});

describe('le barème de Cueillette', () => {
  it('suit l\'énoncé, borne par borne', () => {
    // « Si un joueur a au moins 40 % de correspondance, il gagne des points. S'il a
    // entre 95 % et 100 %, il gagne 1200 pts. S'il a 40 %, il gagne 100 points. »
    expect(pointsDe(39)).toBe(0);
    expect(pointsDe(40)).toBe(POINTS_PLANCHER);
    expect(pointsDe(95)).toBe(POINTS_MAXIMUM);
    expect(pointsDe(100)).toBe(POINTS_MAXIMUM);
    expect(SEUIL_POINTS).toBe(40);
    expect(PLAFOND_POURCENT).toBe(95);
  });

  it('NE DONNE JAMAIS ENTRE 1 ET 100 POINTS — la phrase de l\'énoncé', () => {
    for (let p = 0; p <= 100; p += 1) {
      const pts = pointsDe(p);
      expect(pts === 0 || pts >= POINTS_PLANCHER, `${p} % vaut ${pts} points`).toBe(true);
      expect(pts).toBeLessThanOrEqual(POINTS_MAXIMUM);
    }
  });

  it('monte sans reculer, et sans sauter d\'un palier au suivant', () => {
    let precedent = -1;
    for (let p = SEUIL_POINTS; p <= 100; p += 1) {
      const pts = pointsDe(p);
      expect(pts).toBeGreaterThanOrEqual(precedent);
      precedent = pts;
    }
    // La droite est CONTINUE à son sommet : 94 % doit friser les douze cents, pas
    // les sept cents — sans quoi le dernier pour cent vaudrait autant que dix.
    expect(pointsDe(94)).toBeGreaterThan(1150);
  });

  it('ignore ce qui n\'est pas un pourcentage', () => {
    for (const cas of [null, undefined, NaN, 'beaucoup', -30]) expect(pointsDe(cas)).toBe(0);
  });
});


// ---------------------------------------------------------------------------
// LE CHEMIN RÉEL : UNE CIBLE EN IMAGE, UN JOUEUR EN TRAITS
// ---------------------------------------------------------------------------
//
// Les contrôles ci-dessus comparent deux jeux de TRAITS — c'est ce qui permet de
// décrire les deux figures et de savoir ce qu'on attend. Mais le jeu, lui, compare
// une IMAGE à des traits : la cible est un dessin de la banque, que personne n'a
// tracé à la main. Les deux passent par des chemins différents jusqu'à la grille de
// comparaison, et c'est exactement là qu'un biais peut se loger.
//
// IL S'Y EST LOGÉ. La cible arrivait de son image en pointillé d'une case de large,
// le dessin du joueur était épaissi comme un vrai trait : DEUX FOIS PLUS D'ENCRE
// POUR LA MÊME FIGURE. Mesuré avant correction, sur une vraie tulipe de la banque :
// une copie fidèle obtenait cinquante-six pour cent quand une main tremblante en
// obtenait soixante-cinq, et une moitié de dessin soixante-dix. Le classement était
// à l'envers, toute la banque aurait sous-noté tous les joueurs, et rien ne
// l'aurait signalé — il n'y a pas de bonne réponse à quoi comparer.
describe('la cible en image et le dessin en traits se mesurent dans la MÊME unité', () => {
  // LE COPISTE VIT DANS `tests/outils/copiste.js`, et il n'est pas seul à s'en
  // servir : la planche visuelle de « Cueillette » éprouve le MÊME barème sur les
  // MÊMES écarts, pour les donner à REGARDER. Écrit deux fois, il aurait divergé,
  // et les deux outils auraient continué de passer chacun sur son propre copiste.

  it('UNE COPIE FIDÈLE marque haut — sinon tout le monde est sous-noté', () => {
    // C'est LE contrôle du biais. Si la cible et le joueur ne sont pas rastérisés
    // de la même façon, ce nombre s'effondre pour une raison qui n'a rien à voir
    // avec le dessin, et le jeu paraît injuste à tout le monde à la fois.
    const position = GRILLES_DESSINS.d012;
    const r = ressemblanceContreGrilles(position, copisteDe(position));
    expect(r.detail.densite,
      `la copie fidèle porte ${r.detail.densite.toFixed(2)} de la densité de la cible`)
      .toBeGreaterThan(0.85);
    expect(r.detail.recouvrement).toBeGreaterThan(0.9);
    expect(r.pourcent, `une copie fidèle n'obtient que ${r.pourcent} %`).toBeGreaterThan(80);
    expect(pointsDe(r.pourcent)).toBeGreaterThan(900);
  });

  it('et le classement tient sur un VRAI dessin de la banque', () => {
    const position = GRILLES_DESSINS.d012;
    const note = (o) => ressemblanceContreGrilles(position, copisteDe(position, o)).pourcent;
    const fidele = note({});
    const tremble = note({ bruit: 0.015 });
    const tiers = note({ garde: 0.33 });
    expect(fidele, `fidèle ${fidele} % contre tremblé ${tremble} %`).toBeGreaterThan(tremble);
    expect(tremble, `tremblé ${tremble} % contre un tiers ${tiers} %`).toBeGreaterThan(tiers);

    // UN AUTRE DESSIN DE LA BANQUE ne doit pas payer comme une tulipe.
    const pomme = ressemblanceContreGrilles(position, copisteDe(GRILLES_DESSINS.d031)).pourcent;
    expect(pomme, `une pomme dessinée pour une tulipe obtient ${pomme} %`).toBeLessThan(fidele - 30);
    expect(pointsDe(pomme), 'et elle ne devrait rien rapporter').toBe(0);
  });

  it('les cinquante dessins ont leur grille, et LA FORME QUI S\'EN DÉRIVE porte de l\'encre', () => {
    // UNE GRILLE VIDE NOTERAIT TOUT LE MONDE À ZÉRO, en silence : il n'y a pas de
    // bonne réponse pour s'en apercevoir.
    //
    // LA FORME EST DÉRIVÉE, PLUS STOCKÉE, et c'est aussi elle qu'on éprouve ici.
    // Une dérivation qui rendrait une grille vide — une boîte dégénérée, une
    // échelle à zéro — serait le même désastre muet, à ceci près qu'elle
    // frapperait TOUS les dessins d'un coup.
    expect(Object.keys(GRILLES_DESSINS)).toHaveLength(BASSIN_DESSINS.length);
    for (const d of BASSIN_DESSINS) {
      const bits = GRILLES_DESSINS[d.id];
      expect(bits, `« ${d.nom} » (${d.id}) n'a pas de grille`).toBeTruthy();
      for (const [quoi, g] of [['de position', grilleDepuisBits(bits)], ['de forme', formeDepuisBits(bits)]]) {
        let encre = 0;
        for (let k = 0; k < g.length; k += 1) encre += g[k];
        expect(encre, `« ${d.nom} », grille ${quoi}, est vide`).toBeGreaterThan(20);
      }
    }
  });

  it('SUR LES CINQUANTE DESSINS : une copie fidèle paie la tranche haute', () => {
    // LE CONTRÔLE QUE LA PLANCHE A RENDU NÉCESSAIRE.
    //
    // Tous les contrôles voisins travaillent sur un carré, un cercle, un rectangle —
    // des figures de synthèse, petites et simples. Ils étaient VERTS pendant que,
    // sur les vrais dessins de la banque, un gribouillis rapportait 140 points sur
    // un chêne et 380 sur un tournesol. Un carré ne dit rien d'une fleur.
    //
    // CE QU'IL GARDE, EXACTEMENT : que la cible et le joueur soient mesurés dans la
    // MÊME UNITÉ. Quand ils ne l'étaient pas, une copie fidèle obtenait 56 % et
    // TOUTE la banque sous-notait tout le monde en silence — il n'y a pas de bonne
    // réponse pour s'en apercevoir.
    //
    // IL EXIGEAIT LE MAXIMUM EXACT, ET C'ÉTAIT TROP FIN. La copie fidèle n'est pas
    // un joueur : c'est le copiste qui retrace la grille de la cible, et sa note
    // dépend au point près d'un artefact de normalisation. Le jour où la forme a
    // pris le pas sur la position, la plus mauvaise des cinquante est passée de
    // 1200 à 1160 points — un écart qui ne dit rien du biais qu'on surveille, et
    // qui aurait fait échouer un réglage sain. La barre est donc posée là où elle
    // détecte ce qu'elle prétend détecter : la TRANCHE HAUTE du barème. Le défaut
    // d'origine, à 56 %, en reste à des lieues.
    for (const d of BASSIN_DESSINS) {
      const pos = GRILLES_DESSINS[d.id];
      const fidele = ressemblanceContreGrilles(pos, copisteDe(pos)).pourcent;
      expect(fidele, `une copie fidèle de « ${d.nom} » n'obtient que ${fidele} %`)
        .toBeGreaterThanOrEqual(90);
      expect(pointsDe(fidele), `une copie fidèle de « ${d.nom} » ne rapporte que ${pointsDe(fidele)} points`)
        .toBeGreaterThanOrEqual(POINTS_MAXIMUM - 100);
    }
  });

  it('UN GRIBOUILLIS NE PAIE QUASI JAMAIS — éprouvé sur six mille tirages', () => {
    // CE CONTRÔLE A REMPLACÉ UNE AFFIRMATION FAUSSE, ET C'EST LA LEÇON.
    //
    // Sa première version éprouvait UN gribouillis — une graine, une densité — sur
    // les cinquante dessins, n'en trouvait aucun payant, et j'en ai conclu dans un
    // message de commit que « le gribouillis le mieux noté vaut 37 %, soit zéro
    // point ». C'était vrai de CE gribouillis-là. Balayé sur quarante graines et
    // trois densités de gribouillage, le pire en valait 56 % — QUATRE CENT VINGT
    // POINTS — et 4,28 % d'entre eux rapportaient quelque chose. Un échantillon de
    // un ne mesure pas une population, et il m'avait permis d'écrire une garantie
    // que le produit ne tenait pas.
    //
    // CE QUI SE GARDE MAINTENANT est une BORNE SUR LA POPULATION, pas un absolu
    // qu'on ne peut pas tenir : à 64 cases floutées, un gribouillage dense finira
    // toujours par tomber juste sur un saule pleureur, qui est lui-même une masse
    // de traits fins. On exige que ce soit RARE et PEU PAYANT.
    //
    // HUIT GRAINES ICI, QUARANTE DANS L'OUTIL. Le balayage complet — six mille
    // tirages — demande dix secondes, quand la suite entière en demande une. Une
    // suite qu'on hésite à lancer ne protège plus rien. Le recensement large vit
    // donc dans `tests/outils/planche-cueillette.mjs`, qu'on lance à la main ;
    // ici reste un échantillon assez gros pour voir une régression du barème —
    // huit gribouillages contre les cinquante dessins, mille deux cents mesures.
    let payants = 0; let total = 0; let pire = 0; let quoi = '';
    for (let graine = 1; graine <= 8; graine += 1) {
      for (const traits of [6, 14]) {
        const g = gribouillage({ graine, traits });
        for (const d of BASSIN_DESSINS) {
          const p = ressemblanceContreGrilles(GRILLES_DESSINS[d.id], g).pourcent;
          total += 1;
          if (pointsDe(p) > 0) payants += 1;
          if (p > pire) { pire = p; quoi = `graine ${graine}, ${traits} traits, contre « ${d.nom} »`; }
        }
      }
    }
    const part = (100 * payants) / total;
    expect(part, `${part.toFixed(2)} % des gribouillis rapportent des points`).toBeLessThan(3.5);
    expect(pire, `le gribouillis le mieux noté atteint ${pire} % (${quoi})`).toBeLessThan(55);
    expect(pointsDe(pire), 'et il ne doit pas approcher la moitié du maximum')
      .toBeLessThan(POINTS_MAXIMUM / 2);
  });

  it('LA FORME PASSE DEVANT LA POSITION : un dessin juste mais petit n\'est plus confondu avec un gribouillis', () => {
    // LE CŒUR DE LA DEMANDE DU 21/09, ET CE QUI LA JUSTIFIAIT.
    //
    // Un dessin juste tracé à 62 % de la taille et un gribouillis au hasard ont le
    // MÊME recouvrement — 0,48 tous les deux. Tant que la position pesait le plus,
    // le barème ne les distinguait pas : le dessin appliqué tombait à 32 % sur
    // certaines cibles, c'est-à-dire ZÉRO point, derrière le gribouillage.
    const notes = (f) => BASSIN_DESSINS.map((d) => f(GRILLES_DESSINS[d.id]));
    const petit = notes((p) => ressemblanceContreGrilles(p, copisteDe(p, { echelle: 0.62 })).pourcent);
    const decale = notes((p) => ressemblanceContreGrilles(p, copisteDe(p, { decalage: 0.12 })).pourcent);
    const pire = (v) => Math.min(...v);

    // IL MARQUE, SUR LES CINQUANTE, SANS EXCEPTION. C'est la promesse faite.
    expect(pointsDe(pire(petit)),
      `le dessin juste mais petit tombe à ${pire(petit)} % sur au moins une cible`)
      .toBeGreaterThan(0);

    // ET IL RESTE DEVANT LE GRIBOUILLAGE, cible par cible — la comparaison qui
    // n'avait aucun sens avant, puisque les deux tombaient à zéro ensemble.
    const grib = gribouillage();
    for (const [i, d] of BASSIN_DESSINS.entries()) {
      const sale = ressemblanceContreGrilles(GRILLES_DESSINS[d.id], grib).pourcent;
      expect(petit[i], `sur « ${d.nom} », le dessin juste et petit (${petit[i]} %) ne bat pas un gribouillis (${sale} %)`)
        .toBeGreaterThan(sale);
    }

    // LE DESSIN DÉCALÉ REMONTE AUSSI, sans qu'on exige qu'il marque partout : à
    // douze pour cent de décalage sur une figure fine, il ne recouvre plus rien, et
    // l'énoncé cite « la position des traits » en premier. Il n'est plus au tapis.
    expect(pire(decale), `le dessin décalé tombe à ${pire(decale)} %`).toBeGreaterThan(30);
  });

  it('LA FORME DÉRIVÉE REMPLIT SA BOÎTE, sans jamais toucher le bord', () => {
    // LES DEUX MOITIÉS DE LA MARGE, et chacune garde un défaut vu à l'écran.
    //
    // TROP PETITE — zéro —, la figure touche les quatre bords et `poser` rogne
    // l'épaisseur du trait : deux tracés du même carré, l'un en quatre gestes et
    // l'autre en cent points, n'étaient plus rognés pareil, et la note dépendait
    // de la cadence du téléphone. C'est le tout premier défaut de ce jeu, revenu
    // par une autre porte.
    //
    // TROP GRANDE, la normalisation cesse de faire son travail : si la figure
    // n'occupe plus sa boîte, comparer deux formes « ramenées à la même boîte »
    // ne compare plus rien.
    for (const d of BASSIN_DESSINS) {
      const b = boiteDe(formeDepuisBits(GRILLES_DESSINS[d.id]));
      const marge = COTE * MARGE_NORMALISATION;
      expect(b, `« ${d.nom} » n'a pas de boîte après normalisation`).toBeTruthy();
      // ELLE REMPLIT : le plus grand côté occupe la boîte utile, marge déduite.
      expect(Math.max(b.l, b.h), `« ${d.nom} » ne remplit pas sa boîte`)
        .toBeGreaterThan(COTE - 4 * marge);
      // ELLE NE TOUCHE PAS : aucun bord de la figure ne s'appuie sur la grille.
      expect(b.x, `« ${d.nom} » touche le bord gauche`).toBeGreaterThan(0);
      expect(b.y, `« ${d.nom} » touche le bord haut`).toBeGreaterThan(0);
      expect(b.x + b.l, `« ${d.nom} » touche le bord droit`).toBeLessThan(COTE);
      expect(b.y + b.h, `« ${d.nom} » touche le bord bas`).toBeLessThan(COTE);
    }
  });
});

// ================================================================================
// LA VOIX DU PLATEAU — QUATRE SITUATIONS, ET LE SILENCE ENTRE ELLES
// ================================================================================
//
// « Une phrase de situation (celles de l'Estimation). » Le contrôle voisin de
// `voix.test.js` garantit qu'un moment déclaré figure quelque part ; il ne dit
// rien de la CONDITION qui l'amène. Ces quatre-là ont donc leur contrôle propre,
// sur des statistiques telles que le serveur les publie.
describe('« Cueillette » — ce que le plateau relève', () => {
  const stats = (meilleur, moyenne, total = 8) => (
    { kind: 'cueillette', total, meilleur, moyenne, tranches: [] }
  );
  const moment = (s) => momentDePlateau('cueillette', s, { type: 'cueillette' });

  beforeEach(() => reinitialiserVoix());

  it('se tait sur une manche ordinaire', () => {
    // Un bon dessin, une moyenne moyenne : c'est le jeu qui marche. Commenter
    // cela est le métier de l'animateur, pas celui d'une machine.
    expect(moment(stats(72, 50))).toBeNull();
  });

  it('relève le chef-d’œuvre, et l’échec de tout le monde', () => {
    expect(moment(stats(93, 50))).toBe('stream.cueil-chef-oeuvre');
    expect(moment(stats(30, 18))).toBe('stream.cueil-personne');
  });

  it('relève les deux extrêmes du groupe', () => {
    expect(moment(stats(88, 74))).toBe('stream.cueil-groupe-juste');
    expect(moment(stats(60, 28))).toBe('stream.cueil-groupe-loin');
  });

  it('L’EXPLOIT D’UNE SEULE PERSONNE PASSE AVANT LA MOYENNE DU GROUPE', () => {
    // Les deux conditions se déclenchent ensemble dès qu'un cercle adroit porte
    // un très bon dessin : c'est l'ordre de PRIORITE_PLATEAU qui tranche, et il
    // dit la même chose qu'à l'Estimation — l'individu remarquable d'abord.
    expect(moment(stats(96, 80))).toBe('stream.cueil-chef-oeuvre');
    expect(moment(stats(20, 12))).toBe('stream.cueil-personne');
  });

  it('se tait sous le seuil de participation, quoi qu’il arrive', () => {
    // Quatre dessins, dont un parfait : « il y a un artiste dans le cercle »
    // devant quatre personnes est ridicule. C'est le préalable commun à tous les
    // moments de plateau, et il vaut ici aussi.
    expect(moment(stats(99, 95, 4))).toBeNull();
  });
});
