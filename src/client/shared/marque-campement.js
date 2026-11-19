// L'EMBLÈME DE « CAMPEMENT » — une carte, un chemin, une tente au bout.
//
// LE DESSIN VIENT DE LA RÉFÉRENCE FOURNIE avec l'énoncé : « une carte avec un
// chemin vers une tente, comme une carte au trésor mais avec une tente au lieu
// d'un trésor à la fin du chemin ». La référence montre le contour d'un pays, un
// chemin en tirets qui part de l'ouest, plonge vers le sud et remonte, une croix
// au bout, et la tente posée juste au-dessus de la croix.
//
// CE QUE L'EMBLÈME DOIT DIRE EN UNE IMAGE : on cherche un endroit précis sur une
// carte. La croix au bout d'un chemin en tirets est le signe le plus ancien qui
// soit pour « c'est ici » — tout le monde l'a lu sur une carte au trésor — et la
// tente dit ce qu'on y trouve. C'est exactement le geste du jeu : poser un point
// là où est le campement.
//
// LA TERRE EST INVENTÉE, comme celle de « Frontières », et pour la même raison :
// un vrai pays sur l'écran d'attente donnerait une réponse de la banque. Elle
// n'est PAS celle de « Frontières » non plus — deux emblèmes au même contour
// liraient comme un seul jeu décliné.
//
// LA LEÇON DE « FRONTIÈRES » EST APPLIQUÉE D'AVANCE : une forme fermée arrondie
// avec un éperon vers le bas et un signe dedans se lit comme une bulle de bande
// dessinée. Cette terre n'a donc aucun éperon au sud, un grand axe franc (rapport
// 0,70) et son relief au nord. Ici le risque est moindre — le contenu n'est pas
// un « ? » mais un chemin, qui ne se lit pas comme une parole —, mais la règle
// ne coûte rien à tenir.
//
// LES MESURES SONT ÉCRITES ET L'ÉTENDUE EST CALCULÉE. Les sommets de la côte
// sont en coordonnées ABSOLUES, et ce sont eux qui portent l'étendue : la côte va
// de 8 à 124 en largeur et de 12 à 92 en hauteur ; demi-trait compris (3),
// l'encre va de 5 à 127 et de 9 à 95. Le chemin, la croix et la tente tiennent
// tout entiers dans ce cadre — vérifié ci-dessous élément par élément.
export const TRAIT = 6;
export const ENCRE = { g: 5, d: 127, h: 9, b: 95 };
export const MARGE = 9;
export const VUE = {
  x: ENCRE.g - MARGE,
  y: ENCRE.h - MARGE,
  largeur: (ENCRE.d - ENCRE.g) + 2 * MARGE,
  hauteur: (ENCRE.b - ENCRE.h) + 2 * MARGE,
};
export const GRILLE = { largeur: VUE.largeur, hauteur: VUE.hauteur };

// LA CÔTE — dix-sept sommets, anguleuse et non courbe : à cent pixels de large,
// des courbes adoucies au trait du système se referment en tache (le piège des
// pétales de « Cueillette », rencontré deux fois).
export const COTE = [
  [8, 50],    // la pointe ouest
  [18, 34],
  [34, 28],
  [44, 16],   // le cap nord-ouest
  [62, 20],
  [76, 12],   // le point le plus au nord
  [96, 16],
  [110, 24],
  [124, 40],  // la pointe est
  [118, 56],
  [124, 70],
  [108, 84],
  [86, 88],
  [60, 92],   // la longue côte sud, calme — aucun éperon
  [34, 86],
  [18, 74],
  [10, 62],
];
export const TERRE = `M${COTE[0][0]} ${COTE[0][1]}${COTE.slice(1).map(([x, y]) => `L${x} ${y}`).join('')}Z`;

// LE CHEMIN. Il part de l'ouest, plonge vers le sud et remonte vers la croix —
// la courbe de la référence. Deux cubiques, évaluées point par point : elles
// restent dans la terre, à douze unités au moins de la côte.
//
// LES TIRETS SONT LONGS ET ESPACÉS (9 tracés, 8 vides, au trait de six). Plus
// serrés, ils se rejoignent à cent pixels et le chemin redevient un trait plein —
// c'est-à-dire une rivière, pas une piste.
export const CHEMIN = 'M22 58C38 58 42 80 60 80C72 80 78 75 84 70';
export const TIRETS = '9 8';

// LA CROIX — « X marque l'endroit ». Deux branches de huit unités, centrées en
// (94, 64), au bout du chemin, qui s'arrête six unités avant elle : un chemin
// qui toucherait la croix ferait une seule tache à cent pixels.
export const CROIX = 'M90 60L98 68M98 60L90 68';

// LA TENTE, posée au-dessus de la croix : deux mâts croisés, le sol, la porte.
//
// PREMIER DESSIN, REJETÉ APRÈS L'AVOIR REGARDÉ : un triangle FERMÉ avec un
// chevron dedans pour la porte. Rendu à l'écran, c'était un panneau
// « attention » — triangle plein, signe au milieu —, et à soixante pixels on ne
// voyait rien d'autre. Les nombres, eux, étaient justes.
//
// CE QUI FAIT UNE TENTE ET PAS UN PANNEAU : les deux mâts qui se CROISENT et
// DÉPASSENT du sommet, et un sol qui déborde de la base. Aucun triangle fermé.
// C'est le dessin de la tente du registre d'icônes, à l'échelle de l'emblème.
//
// Les mâts partent des coins (82, 50) et (106, 50), se croisent en (94, 32) et
// dépassent de trois unités en hauteur. Au plus près, la côte nord passe à
// douze unités de leurs pointes, la côte est à onze du coin droit.
export const TENTE = 'M82 50L96.67 28M106 50L91.33 28M79 50H109';
export const PORTE = 'M90 50L94 42L98 50';

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

export const EMBLEME_CAMPEMENT = {
  viewBox: `${VUE.x} ${VUE.y} ${VUE.largeur} ${VUE.hauteur}`,
  rapport: GRILLE.hauteur / GRILLE.largeur,
  trait: TRAIT,
  terre: TERRE,
  chemin: CHEMIN,
  tirets: TIRETS,
  croix: CROIX,
  tente: TENTE,
  porte: PORTE,
};
