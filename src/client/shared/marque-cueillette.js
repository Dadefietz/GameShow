// L'EMBLÈME DE « CUEILLETTE » — une fleur et un crayon.
//
// LE DESSIN VIENT DE LA RÉFÉRENCE FOURNIE avec l'énoncé : « quelque chose de ce
// style pour le logo du jeu (une fleur avec un crayon à côté pour simuler le
// dessin) ». Une tulipe à trois pétales, deux feuilles en éventail, un crayon posé
// en oblique à sa droite.
//
// REDESSINÉ AU TRAIT SUR LA GRILLE DU SYSTÈME. Le dépôt n'admet aucune icône
// matricielle : un PNG ne prendrait ni la couleur du texte ni l'épaisseur du
// système, et se pixelliserait à trois cents pixels sur la toile du stream.
//
// CE QUE L'EMBLÈME DOIT DIRE EN UNE IMAGE : on regarde une fleur, et on la
// DESSINE. Les deux objets doivent donc se lire séparément — une fleur seule
// raconterait un jeu de botanique, un crayon seul un jeu d'écriture. Ils se
// touchent sans se recouvrir, et le crayon pointe VERS la fleur : c'est elle qu'il
// reproduit.
//
// LES MESURES SONT ÉCRITES ET LES TRACÉS EN DÉCOULENT, comme pour les emblèmes
// précédents — chacun d'eux a connu au moins un dessin fautif qu'il a fallu voir à
// l'écran. Ce qui se mesure ici, c'est que rien ne déborde de la grille.
// LA GRILLE EST CALÉE SUR L'ENCRE MESURÉE, pas choisie au jugé.
//
// Les tracés ci-dessous ont été écrits d'abord ; leur étendue réelle a ensuite été
// CALCULÉE en évaluant chaque commande — pas en lisant les nombres, dont la moitié
// sont des déplacements relatifs. Elle va de 26,5 à 111 en largeur et de 9 à 109 en
// hauteur, demi-trait compris. Une boîte déclarée à la main l'annonçait à 33 : le
// pétale latéral gauche en sortait de six unités et demie, et le navigateur
// l'aurait rogné sans rien dire — à trois cents pixels de haut, devant le public.
//
// Le viewBox part donc de l'encre et non de zéro : neuf unités de marge de chaque
// côté, sans toucher à un seul tracé.
export const TRAIT = 6;
export const ENCRE = { g: 12, d: 110, h: 11, b: 107 };
export const MARGE = 9;
export const VUE = {
  x: ENCRE.g - MARGE,
  y: ENCRE.h - MARGE,
  largeur: (ENCRE.d - ENCRE.g) + 2 * MARGE,
  hauteur: (ENCRE.b - ENCRE.h) + 2 * MARGE,
};
export const GRILLE = { largeur: VUE.largeur, hauteur: VUE.hauteur };

// LA FLEUR — À GAUCHE, ET SEULE DANS SON COULOIR.
//
// PREMIER DESSIN, REJETÉ APRÈS L'AVOIR REGARDÉ. Fleur et crayon se chevauchaient :
// le corps du crayon traversait le pétale droit, sa pointe coupait la feuille, et
// l'ensemble se lisait comme un enchevêtrement de traits — ni fleur ni crayon. Les
// nombres, eux, étaient bons : la marge valait neuf de tous côtés. C'est pourquoi
// un emblème se REGARDE, et pourquoi chacun de ceux du dépôt a connu au moins un
// dessin fautif avant celui qu'on garde.
//
// Les deux objets occupent désormais deux couloirs qui ne se touchent pas — la
// fleur de 13 à 56, le crayon de 61 à 110 — et le crayon PENCHE VERS ELLE : il est
// en train de la dessiner, ce qui est le sujet du jeu.
//
// TROIS PÉTALES ET NON CINQ : à cent pixels de large, cinq pétales tracés à
// l'épaisseur du système se referment en tache. C'est le piège des neuf cases de
// « Cache-cache », qui devenaient une gaufre.
export const PETALES = [
  'M26 44Q26 22 34 14Q42 22 42 44',        // le pétale central, une amande
  'M18 44Q12 28 18 26Q26 31 26 44',        // le latéral gauche
  'M50 44Q56 28 50 26Q42 31 42 44',        // le latéral droit
];
// La coupe qui retient les pétales, puis la tige.
export const COUPE = 'M18 44v8q0 18 16 18t16-18v-8z';
export const TIGE = 'M34 70v34';
export const FEUILLES = [
  'M34 86Q22 84 16 74Q28 70 34 80',
  'M34 96Q46 94 52 84Q40 80 34 90',
];

// LE CRAYON — À DROITE, penché vers la fleur, pointe en bas.
//
// UN CRAYON POSÉ À PLAT SERAIT UN OBJET RANGÉ. Celui-ci est en train d'écrire.
export const CRAYON_CORPS = 'M93 15l14 10-28 40-14-10z';
// La virole : un trait en travers, qui empêche de lire le corps comme une simple
// barre oblique.
export const CRAYON_VIROLE = 'M87 23l14 10';
// Le bois taillé, puis la mine.
export const CRAYON_POINTE = 'M65 55l14 10-18 9z';
export const CRAYON_MINE = 'M61 74l6-3-4-3z';

// La boîte de l'encre, RAMENÉE DANS LE REPÈRE DE LA VUE.
export const BOITE = {
  g: ENCRE.g - VUE.x,
  d: ENCRE.d - VUE.x,
  h: ENCRE.h - VUE.y,
  b: ENCRE.b - VUE.y,
};

export function margeDeGrille() {
  return Math.min(BOITE.g, BOITE.h, GRILLE.largeur - BOITE.d, GRILLE.hauteur - BOITE.b);
}

export const EMBLEME_CUEILLETTE = {
  viewBox: `${VUE.x} ${VUE.y} ${VUE.largeur} ${VUE.hauteur}`,
  rapport: GRILLE.hauteur / GRILLE.largeur,
  trait: TRAIT,
  petales: PETALES,
  coupe: COUPE,
  tige: TIGE,
  feuilles: FEUILLES,
  crayonCorps: CRAYON_CORPS,
  crayonPointe: CRAYON_POINTE,
  crayonMine: CRAYON_MINE,
  crayonVirole: CRAYON_VIROLE,
};
