// L'EMBLÈME DE « CHASSE AUX ÉTOILES » — deux étoiles allumées, deux points.
//
// LE DESSIN VIENT DE LA RÉFÉRENCE FOURNIE : « 4 étoiles avec 2 illuminées et 2
// représentées avec un point ». En quinconce, comme la référence : un point en
// haut à gauche, une étoile en haut à droite, une étoile en bas à gauche, un
// point en bas à droite.
//
// CE QU'IL DIT EN UNE IMAGE, ET C'EST LA RÈGLE DU JEU : parmi les points du ciel,
// certains s'allument — ce sont eux qu'on touche. Une étoile seule dirait « la
// nuit » ; c'est la différence entre l'étoile et le point qui dit le jeu.
//
// DESSINÉ EN APLATS ET NON AU TRAIT, comme dans la référence. Une étoile à
// quatre branches tracée au contour, à cent pixels, se referme en losange
// grossier ; pleine, ses branches fines restent lisibles. Les points sont pleins
// eux aussi, comme celui de « Frontières ».
//
// LES BRANCHES SONT CREUSÉES (courbes rentrantes vers le centre) : c'est ce qui
// fait une étoile scintillante et non un losange ou un signe « plus ».
//
// L'ÉTENDUE EST EXACTE, sans trait à ajouter : les quatre pointes de chaque
// étoile et le bord de chaque point SONT l'encre. Étoile du haut : 62 à 114 sur
// 4 à 56 ; étoile du bas : 6 à 62 sur 50 à 106. L'encre va donc de 6 à 114 et de
// 4 à 106 ; neuf unités de marge de chaque côté.
export const ENCRE = { g: 6, d: 114, h: 4, b: 106 };
export const MARGE = 9;
export const VUE = {
  x: ENCRE.g - MARGE,
  y: ENCRE.h - MARGE,
  largeur: (ENCRE.d - ENCRE.g) + 2 * MARGE,
  hauteur: (ENCRE.b - ENCRE.h) + 2 * MARGE,
};

// UNE ÉTOILE À QUATRE BRANCHES de centre (cx, cy) et de rayon R. Chaque côté
// est une courbe dont le point de contrôle est tiré vers le centre : la taille
// de la « taille » de l'étoile (`creux`, en fraction du rayon) décide de la
// finesse des branches.
export function etoile(cx, cy, R, creux = 0.16) {
  const c = R * creux;
  return [
    `M${cx} ${cy - R}`,
    `Q${cx + c} ${cy - c} ${cx + R} ${cy}`,
    `Q${cx + c} ${cy + c} ${cx} ${cy + R}`,
    `Q${cx - c} ${cy + c} ${cx - R} ${cy}`,
    `Q${cx - c} ${cy - c} ${cx} ${cy - R}`,
    'Z',
  ].join('');
}

export const ETOILES = [
  { cx: 88, cy: 30, R: 26 },
  { cx: 34, cy: 78, R: 28 },
];
export const POINTS = [
  { cx: 34, cy: 30, r: 6.5 },
  { cx: 88, cy: 80, r: 6.5 },
];

export function margeDeGrille() {
  return Math.min(ENCRE.g - VUE.x, ENCRE.h - VUE.y, VUE.x + VUE.largeur - ENCRE.d, VUE.y + VUE.hauteur - ENCRE.b);
}

export const EMBLEME_ETOILES = {
  viewBox: `${VUE.x} ${VUE.y} ${VUE.largeur} ${VUE.hauteur}`,
  rapport: VUE.hauteur / VUE.largeur,
  etoiles: ETOILES.map((e) => etoile(e.cx, e.cy, e.R)),
  points: POINTS,
};
