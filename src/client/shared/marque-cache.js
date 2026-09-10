// L'EMBLÈME DE « CACHE-CACHE » — la grille et l'œil barré.
//
// LE DESSIN VIENT DE LA RÉFÉRENCE FOURNIE : « une matrice 3x3 avec un œil barré
// au-dessus ». Redessiné au trait sur la grille du système — le dépôt n'admet
// aucune icône matricielle, et un PNG ne prendrait ni la couleur du texte ni
// l'épaisseur du système, et se pixelliserait à trois cents pixels sur la toile
// du stream.
//
// L'ŒIL BARRÉ DIT LA RÈGLE EN UNE IMAGE : ce qu'on a vu n'est plus visible. C'est
// exactement le jeu — neuf objets montrés une fois, puis cachés, et cinq questions
// sur ce qu'il en reste.
//
// LES MESURES SONT ÉCRITES ET LES TRACÉS EN DÉCOULENT, comme pour les emblèmes
// précédents. Chacun d'eux a connu au moins un dessin fautif qu'il a fallu voir à
// l'écran ; ce qui se mesure ici, c'est que rien ne déborde de la grille.
export const GRILLE = { largeur: 100, hauteur: 138 };
export const TRAIT = 6;

// L'ŒIL FERMÉ — une paupière baissée et trois cils.
//
// LA RÉFÉRENCE MONTRE UN ŒIL OUVERT BARRÉ D'UNE CROIX, et c'est ce qui a été
// dessiné d'abord : une amande, une pupille, une diagonale. À l'écran, à cent
// pixels de large et en une seule couleur, l'ensemble se lisait « Ø » — le signe
// de l'ensemble vide, ou celui d'une interdiction. Ce n'est pas ce que le jeu
// raconte : rien n'est interdit, c'est simplement CACHÉ.
//
// Une paupière baissée dit la même chose sans ambiguïté, et elle tient à toutes
// les tailles parce qu'elle n'a rien à l'intérieur — le piège de tout petit œil
// tracé, dont la pupille et le contour se rejoignent en tache.
export const OEIL = 'M26 18q24 14 48 0';
export const CILS = ['M33 26l-5 8', 'M50 30v9', 'M67 26l5 8'];

// LES NEUF CASES — trois rangées de trois, PLEINES.
//
// TRACÉES, ELLES ÉTAIENT ILLISIBLES. À l'épaisseur du système, un carré de vingt-
// quatre unités n'a plus qu'un trou de douze : à cent pixels de large sur le
// téléphone, les neuf cases devenaient une gaufre et l'emblème une texture. La
// référence fournie montre d'ailleurs des carrés PLEINS — c'est la forme qui
// tient à toutes les tailles, comme les pavés du quiz.
export const CASE = { cote: 26, ecart: 6, rayon: 4 };
export const DEPART = { x: 5, y: 46 };
export const CASES = Array.from({ length: 9 }, (_, i) => ({
  place: i + 1,
  x: DEPART.x + (i % 3) * (CASE.cote + CASE.ecart),
  y: DEPART.y + Math.floor(i / 3) * (CASE.cote + CASE.ecart),
}));

// La boîte de l'encre. Les cases sont PLEINES : leur encre s'arrête à leurs
// coordonnées. L'œil et la barre sont tracés : demi-trait en plus.
export const BOITE = {
  g: Math.min(DEPART.x, 26 - TRAIT / 2),
  d: Math.max(DEPART.x + 3 * CASE.cote + 2 * CASE.ecart, 74 + TRAIT / 2),
  h: 18 - TRAIT / 2,
  b: DEPART.y + 3 * CASE.cote + 2 * CASE.ecart,
};

export function margeDeGrille() {
  return Math.min(BOITE.g, BOITE.h, GRILLE.largeur - BOITE.d, GRILLE.hauteur - BOITE.b);
}

export const EMBLEME_CACHE = {
  viewBox: `0 0 ${GRILLE.largeur} ${GRILLE.hauteur}`,
  rapport: GRILLE.hauteur / GRILLE.largeur,
  trait: TRAIT,
  oeil: OEIL,
  cils: CILS,
  cases: CASES,
  cote: CASE.cote,
  rayon: CASE.rayon,
};
