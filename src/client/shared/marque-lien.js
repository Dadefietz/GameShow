// LES DEUX CHAÎNONS — emblème du jeu « Le lien ».
//
// POURQUOI CE FICHIER, ET PAS UN DESSIN RECOPIÉ. La flamme du projet a vécu en
// trois exemplaires recopiés à la main avant de diverger sans que personne ne le
// voie (voir `marque-flamme.js`). Le même dessin sert ici sur TROIS surfaces —
// l'annonce du joueur, son écran de jeu, la scène du stream. Il est donc écrit
// une fois, et chaque surface n'apporte que sa taille.
//
// ---------------------------------------------------------------------------
// LE DESSIN A CHANGÉ, ET POURQUOI IL EST REDESSINÉ PLUTÔT QU'IMPORTÉ
// ---------------------------------------------------------------------------
// L'auteur a fourni une image de référence : deux maillons de chaîne posés en
// diagonale, chacun ouvert vers l'autre. Elle n'est pas embarquée telle quelle.
//
// Le dépôt n'admet AUCUNE icône matricielle — « SVG au trait inline, jamais
// d'emoji, aucune image raster pour les icônes ». Ce n'est pas une coquetterie :
// un PNG ne prend pas la couleur du texte qui l'entoure, ne suit pas l'épaisseur
// de trait du système, se pixellise à 180 px sur la toile du stream, et pose la
// question du fond transparent — question qui ne se pose tout simplement pas ici.
//
// Le tracé ci-dessous reprend donc la FORME de la référence — deux maillons
// oblongs en diagonale, ouverts l'un vers l'autre — sur la grille de 24 du
// système et au trait de 2,1, comme la flamme. Les deux emblèmes du jeu doivent
// se ressembler ; celui-ci hérite de `currentColor` et suit sa taille sans jamais
// se dégrader.
//
// ---------------------------------------------------------------------------
// POURQUOI DES NOMBRES, ET DES TRACÉS PRODUITS
// ---------------------------------------------------------------------------
// Le dessin précédent était trois chaînes de commandes SVG écrites à la main.
// Aucun contrôle ne savait les relire : rien n'aurait vu un maillon débordant de
// la grille, un jour refermé, une amorce traversant sa paroi. Or c'est
// exactement ce que les deux premiers essais de CE dessin ont fait, l'un après
// l'autre, et il a fallu les regarder à l'écran pour s'en apercevoir.
//
// Les mesures sont donc écrites en clair, et les tracés en découlent. Le contrôle
// (tests/unit/marque-lien.test.js) vérifie les mesures ; les tracés ne peuvent
// plus les démentir, puisqu'ils en sortent.
export const GRILLE = 24;
export const TRAIT = 2.1;

// La moitié du trait : ce dont le dessin déborde de son tracé, de chaque côté.
// Tout ce qui suit s'y ramène — c'est là que les deux premiers essais ont fauté.
export const DEBORD = TRAIT / 2;

// LE MAILLON. Un oblong aux bouts pleinement arrondis : un segment de
// `demiLongueur − rayon` prolongé d'un demi-disque à chaque bout.
export const MAILLON = {
  demiLongueur: 5.4,
  rayon: 3.6, // aussi la demi-hauteur : les bouts sont des demi-cercles pleins
};

// L'AMORCE — le bout de chaîne rompu qui sort du maillon vers l'autre. C'est elle
// qui dit que les deux SE CHERCHENT ; deux anneaux nus ne seraient qu'un motif.
export const AMORCE = { debut: -0.4, fin: 3.2 };

// L'ÉCART entre les centres des deux maillons, sur la diagonale.
export const ECART = 13.86;

// ---------------------------------------------------------------------------
// CE QUE LES MESURES DONNENT — les grandeurs que le contrôle vérifie
// ---------------------------------------------------------------------------

// Le jour intérieur du maillon, en largeur. C'est LA contrainte du dessin : un
// essai à rayon 3,1 ne laissait que 4,1 de jour pour une amorce de 2,1 — le
// maillon se lisait comme une tache pleine fendue d'une rainure.
export const jourDuMaillon = () => 2 * (MAILLON.rayon - DEBORD);

// La pointe du maillon : jusqu'où il va le long de son axe, trait compris.
export const pointeDuMaillon = () =>
  MAILLON.demiLongueur - MAILLON.rayon + MAILLON.rayon + DEBORD;

// Sa saillie de côté une fois posé à 45°. Un oblong tracé est la somme d'un
// segment et d'un disque : sa saillie dans une direction vaut la projection du
// segment plus le rayon. Le premier essai la calculait comme celle d'un
// rectangle, la surestimait de moitié, et a fait rejeter une géométrie qui tenait.
export const sailliePosee = () =>
  (MAILLON.demiLongueur - MAILLON.rayon) * Math.SQRT1_2 + MAILLON.rayon + DEBORD;

// Le jour entre les deux maillons.
export const jourEntreMaillons = () => ECART - 2 * pointeDuMaillon();

// Ce qui sépare le bout arrondi de l'amorce de la paroi intérieure du maillon.
export const jeuDeLAmorce = () =>
  MAILLON.demiLongueur - DEBORD - (AMORCE.fin + DEBORD);

// Ce qui reste de la grille de chaque côté de l'emblème.
export const margeDeGrille = () => GRILLE / 2 - ECART / 2 / Math.SQRT2 - sailliePosee();

// ---------------------------------------------------------------------------
// LES TRACÉS, produits depuis les mesures
// ---------------------------------------------------------------------------
const n = (v) => Number(v.toFixed(3));

// Le maillon, centré sur l'origine : les copies ne sont plus qu'un déplacement
// et une rotation.
export function traceMaillon() {
  const { demiLongueur, rayon } = MAILLON;
  const d = n(demiLongueur - rayon); // demi-longueur du segment droit
  const r = n(rayon);
  return `M${-d} ${-r}H${d}A${r} ${r} 0 01${d} ${r}H${-d}A${r} ${r} 0 01${-d} ${-r}Z`;
}

export function traceAmorce() {
  return `M${n(AMORCE.debut)} 0H${n(AMORCE.fin)}`;
}

// Les deux copies, sur la diagonale, chacune tournée de 45° pour que sa longueur
// suive cette même diagonale : les deux se présentent alors bout à bout.
// `amorce` vaut ±1 — c'est le sens dans lequel chacune tend vers l'autre.
export function copies() {
  const demi = n(ECART / 2 / Math.SQRT2);
  const c = n(GRILLE / 2);
  return [
    { x: n(c - demi), y: n(c - demi), rotation: 45, amorce: 1 },
    { x: n(c + demi), y: n(c + demi), rotation: 45, amorce: -1 },
  ];
}

export const CHAINONS = {
  viewBox: `0 0 ${GRILLE} ${GRILLE}`,
  trait: TRAIT,
  maillon: traceMaillon(),
  amorce: traceAmorce(),
  copies: copies(),
};
