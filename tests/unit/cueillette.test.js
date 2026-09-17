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
import { BASSIN_DESSINS } from '../../src/server/dessins.js';
import {
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
    ['un quart du dessin', () => quart, 'un gribouillis', () => gribouillis],
    ['un dessin juste mais trop petit', () => petit, 'un gribouillis', () => gribouillis],
  ])('%s passe avant %s', (nomA, a, nomB, b) => {
    const va = NOTE(a());
    const vb = NOTE(b());
    expect(va, `« ${nomA} » ${va} % ne bat pas « ${nomB} » ${vb} %`).toBeGreaterThan(vb);
  });

  it('un gribouillis ne rapporte AUCUN point', () => {
    // Noircir la page au hasard recouvre la cible PAR ACCIDENT — c'est la façon la
    // plus simple de tricher, et elle doit rester sans profit.
    expect(pointsDe(NOTE(gribouillis))).toBe(0);
    expect(pointsDe(NOTE(surcharge))).toBe(0);
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

    // PROPORTIONS : le même carré, deux fois plus petit, au même centre.
    const r = ressemblance(CIBLE, petit);
    expect(r.detail.proportions, 'un carré deux fois plus petit devrait perdre sur les proportions')
      .toBeLessThan(0.75);

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
  // UN COPISTE QUI TRACE DES TRAITS, ET NON DES POINTS — et c'est indispensable.
  //
  // Une première version semait un point isolé par case d'encre. Elle ne gardait
  // RIEN : deux nuages de points se rastérisent de la même façon des deux côtés, si
  // bien que le biais entre une cible en image et un dessin en traits n'apparaissait
  // pas. Vérifié en sabotant l'épaississement de la cible : le contrôle est resté
  // vert. C'est en TRAÇANT que le joueur produit plus d'encre qu'un pointillé, et
  // c'est donc en traçant qu'il faut l'éprouver.
  //
  // Les traits suivent les SUITES CONTIGUËS d'encre sur une rangée — de courts
  // segments le long du dessin, jamais une barre d'un bord à l'autre de la figure.
  const copisteDe = (bits, { bruit = 0, garde = 1, decalage = 0, graine = 7 } = {}) => {
    const g = grilleDepuisBits(bits);
    let n = graine;
    const alea = () => { n = (n * 1664525 + 1013904223) % 4294967296; return n / 4294967296; };
    const pt = (x, y) => [
      (x / (COTE - 1)) + decalage + (alea() - 0.5) * 2 * bruit,
      (y / (COTE - 1)) + decalage + (alea() - 0.5) * 2 * bruit,
    ];
    const traits = [];
    for (let y = 0; y < COTE; y += 1) {
      let debut = null;
      for (let x = 0; x <= COTE; x += 1) {
        const encre = x < COTE && g[y * COTE + x] >= 0.9;
        if (encre && debut === null) debut = x;
        if (!encre && debut !== null) {
          if (alea() <= garde) {
            const trait = [];
            for (let k = debut; k < x; k += 1) trait.push(pt(k, y));
            traits.push(trait);
          }
          debut = null;
        }
      }
    }
    return traits;
  };

  it('UNE COPIE FIDÈLE marque haut — sinon tout le monde est sous-noté', () => {
    // C'est LE contrôle du biais. Si la cible et le joueur ne sont pas rastérisés
    // de la même façon, ce nombre s'effondre pour une raison qui n'a rien à voir
    // avec le dessin, et le jeu paraît injuste à tout le monde à la fois.
    const [position, forme] = GRILLES_DESSINS.d012;
    const r = ressemblanceContreGrilles(position, forme, copisteDe(position));
    expect(r.detail.densite,
      `la copie fidèle porte ${r.detail.densite.toFixed(2)} de la densité de la cible`)
      .toBeGreaterThan(0.85);
    expect(r.detail.recouvrement).toBeGreaterThan(0.9);
    expect(r.pourcent, `une copie fidèle n'obtient que ${r.pourcent} %`).toBeGreaterThan(80);
    expect(pointsDe(r.pourcent)).toBeGreaterThan(900);
  });

  it('et le classement tient sur un VRAI dessin de la banque', () => {
    const [position, forme] = GRILLES_DESSINS.d012;
    const note = (o) => ressemblanceContreGrilles(position, forme, copisteDe(position, o)).pourcent;
    const fidele = note({});
    const tremble = note({ bruit: 0.015 });
    const tiers = note({ garde: 0.33 });
    expect(fidele, `fidèle ${fidele} % contre tremblé ${tremble} %`).toBeGreaterThan(tremble);
    expect(tremble, `tremblé ${tremble} % contre un tiers ${tiers} %`).toBeGreaterThan(tiers);

    // UN AUTRE DESSIN DE LA BANQUE ne doit pas payer comme une tulipe.
    const pomme = ressemblanceContreGrilles(position, forme, copisteDe(GRILLES_DESSINS.d031[0])).pourcent;
    expect(pomme, `une pomme dessinée pour une tulipe obtient ${pomme} %`).toBeLessThan(fidele - 30);
    expect(pointsDe(pomme), 'et elle ne devrait rien rapporter').toBe(0);
  });

  it('les cinquante dessins ont leurs deux grilles, et elles portent de l\'encre', () => {
    // UNE GRILLE VIDE NOTERAIT TOUT LE MONDE À ZÉRO, en silence : il n'y a pas de
    // bonne réponse pour s'en apercevoir.
    expect(Object.keys(GRILLES_DESSINS)).toHaveLength(BASSIN_DESSINS.length);
    for (const d of BASSIN_DESSINS) {
      const paire = GRILLES_DESSINS[d.id];
      expect(paire, `« ${d.nom} » (${d.id}) n'a pas de grille`).toBeTruthy();
      for (const [i, bits] of paire.entries()) {
        const g = grilleDepuisBits(bits);
        let encre = 0;
        for (let k = 0; k < g.length; k += 1) encre += g[k];
        expect(encre, `« ${d.nom} », grille ${i === 0 ? 'de position' : 'de forme'}, est vide`)
          .toBeGreaterThan(20);
      }
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
