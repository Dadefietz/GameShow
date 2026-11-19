// L'EMBLÈME DE « FRONTIÈRES » — une terre anonyme, et un point d'interrogation.
//
// CE QUE L'EMBLÈME DOIT DIRE EN UNE IMAGE : voici une forme de pays, et on ne
// sait pas lequel. C'est tout le jeu — « une carte d'un pays aléatoire est
// affichée », et le joueur doit le nommer.
//
// POURQUOI PAS UN GLOBE, NI UNE BOUSSOLE. Les deux disent « géographie », pas
// « reconnaître ». Un globe avec ses méridiens annonce un jeu sur le monde ;
// celui-ci porte sur UNE silhouette qu'on identifie. La terre et le point
// d'interrogation se lisent séparément, comme la fleur et le crayon de
// « Cueillette » : une terre seule serait une carte, un « ? » seul une devinette.
//
// LA TERRE EST INVENTÉE, ET C'EST UNE CONTRAINTE DE FOND. Dessiner la France ou
// l'Italie donnerait une réponse de la banque sur l'écran d'attente, avant même
// que la manche commence. Ce contour ne correspond à aucun des cent
// soixante-quinze pays : c'est un littoral plausible et faux.
//
// UN CONTOUR ANGULEUX ET NON COURBE. À cent pixels de large, des courbes
// adoucies au trait du système se referment en tache — c'est le piège des cinq
// pétales de « Cueillette » et des neuf cases de « Cache-cache », rencontré deux
// fois. Un littoral en segments reste lisible à cent pixels comme à trois cents,
// et c'est l'allure d'une carte vectorielle simplifiée.
//
// PREMIER DESSIN, REJETÉ APRÈS L'AVOIR REGARDÉ — et ses nombres étaient JUSTES.
//
// Le premier contour était un polygone de quatorze sommets, à peu près convexe,
// haut comme large (rapport 0,93), avec une échancrure au sud et le « ? » posé
// en plein centre. Marge de grille : 9 de tous côtés, rien de rogné, tout ce qui
// se mesure était bon. Rendu à l'écran, il ne se lisait pas comme un pays mais
// comme une BULLE DE BANDE DESSINÉE : une forme ronde, une pointe en bas à
// gauche qui passait pour la queue de la bulle, et un point d'interrogation
// centré dedans comme un propos. L'emblème annonçait une devinette bavarde, pas
// une carte. À quatre-vingts pixels il n'était qu'une tache.
//
// C'est le troisième emblème de ce dépôt à connaître ce sort, et toujours pour
// la même raison : on ne vérifie pas un dessin en relisant ses coordonnées.
//
// CE QUI A CHANGÉ, ET POURQUOI :
//   — LE RAPPORT. Nettement plus large que haut (0,70 contre 0,93) : une masse
//     équilibrée se lit comme une forme géométrique, un territoire a un grand
//     axe ;
//   — DES ACCIDENTS DE CÔTE DE TAILLES TRÈS DIFFÉRENTES. L'ancien contour avait
//     quatorze segments presque égaux, ce qui produit un galet. Celui-ci a de
//     longues côtes droites, un GOLFE qui entaille le nord en V, et une
//     PRESQU'ÎLE qui part vers le sud-est — trois accidents qu'on ne trouve que
//     sur une carte ;
//   — LE « ? » N'EST PLUS AU CENTRE GÉOMÉTRIQUE. Il est posé dans la grande
//     plaine du sud, sous le golfe : une marque SUR un territoire, et non le
//     contenu d'une bulle.
//
// LES MESURES SONT ÉCRITES ET L'ÉTENDUE EST CALCULÉE, comme pour les emblèmes
// précédents. Elle l'est ici EXACTEMENT, et c'est le bénéfice des segments
// droits : les sommets SONT l'étendue, il n'y a pas de point de contrôle dont il
// faudrait évaluer la courbe. Le contour va de 10 à 118 en largeur et de 24 à 90
// en hauteur ; demi-trait du contour compris (2, depuis le quatrième dessin),
// l'encre va de 8 à 120 et de 22 à 92.
//
// Le « ? » tient tout entier dans ce cadre — vérifié sommet par sommet ci-dessous
// — si bien que l'encre de l'emblème est celle du contour, et d'elle seule.
// QUATRIÈME DESSIN (19/11), DEMANDÉ : « refaites le logo de "Frontière" avec
// des contours évoquant la forme d'un pays ». Le troisième dessin avait la
// silhouette d'un territoire, mais ses côtes étaient des segments longs et nets :
// un polygone, pas une frontière. Une vraie frontière sur une carte est faite
// de petits accidents — rivières, crêtes, tracés négociés. Chaque côté de la
// silhouette est donc découpé en pas de cinq unités, chacun décalé de part et
// d'autre de deux unités et demie au plus, tirés une fois pour toutes (graine
// fixe : le dessin ne change jamais d'un rendu à l'autre).
//
// LE CONTOUR PASSE AU TRAIT DE QUATRE, le point d'interrogation garde six. Au
// trait de six, les accidents se refermaient en un boudin lisse à cent pixels —
// on retombait sur le polygone. Regardé rendu à 64, 116, 200 et 300 pixels, sur
// fond sombre et sur fond clair.
//
// L'ÉTENDUE NE CHANGE PAS : la grande silhouette est la même (10 à 118, 24 à
// 90) ; seul le demi-trait du contour (deux unités au lieu de trois) déplace
// l'encre — de 8 à 120 et de 22 à 92.
export const TRAIT = 6;
export const TRAIT_TERRE = 4;
export const ENCRE = { g: 8, d: 120, h: 22, b: 92 };
export const MARGE = 9;
export const VUE = {
  x: ENCRE.g - MARGE,
  y: ENCRE.h - MARGE,
  largeur: (ENCRE.d - ENCRE.g) + 2 * MARGE,
  hauteur: (ENCRE.b - ENCRE.h) + 2 * MARGE,
};
export const GRILLE = { largeur: VUE.largeur, hauteur: VUE.hauteur };

// LA FRONTIÈRE — soixante sommets (la grande silhouette du troisième dessin,
// découpée en petits accidents ; voir la note du quatrième dessin plus haut),
// en coordonnées ABSOLUES.
//
// Absolues et non relatives, délibérément : c'est ce qui rend l'étendue lisible
// à l'œil nu dans le tracé lui-même. La moitié des emblèmes du dépôt ont été
// écrits en déplacements relatifs, et chacun a connu un dessin qui débordait sa
// boîte sans que personne ne puisse le voir en relisant les nombres.
//
// DEUXIÈME DESSIN, REJETÉ LUI AUSSI, ET POUR LA MÊME ILLUSION.
//
// Il corrigeait bien le galet — rapport 0,75, un golfe, de longues côtes — mais
// il gardait une PRESQU'ÎLE pointant vers le sud-est. Regardé à l'écran : forme
// fermée arrondie + éperon en bas à droite + point d'interrogation dedans, c'est
// mot pour mot la grammaire d'une bulle de bande dessinée, et l'œil la lit comme
// telle avant de lire quoi que ce soit d'autre. L'éperon EST la queue.
//
// CE QUI TRANCHE ENFIN :
//   — PLUS AUCUN ÉPERON VERS LE BAS. Rien ne dépasse du corps principal par le
//     sud ni par l'est-bas ;
//   — UN GRAND AXE FRANC : 114 de large pour 72 de haut (rapport 0,63). Une
//     bulle est compacte ; un territoire s'étire ;
//   — LE RELIEF EST AU NORD, LE SUD EST CALME. Le golfe (50 48), le cap
//     nord-est (104 24) et la pointe est (118 46) dentellent le haut ; la côte
//     sud est une longue ligne lâche. C'est la silhouette d'un continent vu d'en
//     haut, et aucune bulle n'est faite ainsi.
export const COTE = [
  [10, 64], [10, 58.5], [16.5, 56], [16.5, 50.5], [18.5, 45.5], [22, 42], [26.5, 40.5], [30, 37],
  [33.5, 34], [38, 32], [40, 37], [43, 41], [47, 44], [50, 48], [53.5, 43.5], [55.5, 38.5],
  [59, 33.5], [60, 28], [64, 25.5], [69, 25.5], [73.5, 26], [78, 24], [82, 28], [88.5, 29],
  [92, 34], [96.5, 31.5], [100, 27], [104, 24], [105, 29.5], [108.5, 33.5], [114, 36], [115, 41.5],
  [118, 46], [114.5, 49.5], [114, 54.5], [112.5, 59], [111, 63.5], [110, 68], [105, 69], [101.5, 72],
  [99.5, 77], [96, 80], [92, 82], [86.5, 82], [82.5, 86], [78, 88.5], [73, 89.5], [68, 90],
  [63, 90], [57.5, 90], [52.5, 86.5], [47, 88], [42, 88], [37.5, 84.5], [33, 81.5], [26, 82.5],
  [22, 78], [18, 75], [16, 71], [13, 67.5],
];
export const TERRE = `M${COTE[0][0]} ${COTE[0][1]}${COTE.slice(1).map(([x, y]) => `L${x} ${y}`).join('')}Z`;

// LE POINT D'INTERROGATION, DANS LA GRANDE PLAINE DU SUD.
//
// PAS AU CENTRE GÉOMÉTRIQUE, et c'est la correction du premier dessin : un « ? »
// centré dans une forme fermée se lit comme le CONTENU de cette forme — une
// bulle qui parle. Posé sous le golfe, décalé vers le bas, il se lit comme une
// marque POSÉE SUR un territoire.
//
// IL EST POSÉ À L'EST DU GOLFE, sous le cap nord-est. Demi-trait compris,
// l'ensemble tient entre 62 et 86 en largeur et entre 44 et 79,5 en hauteur.
// Les dégagements, vérifiés sommet par sommet :
//   — au nord, à x = 74, la côte passe vers y = 25 : dix-neuf unités ;
//   — au sud, à x = 74, elle passe vers y = 88 : huit unités et demie ;
//   — à l'est, à y = 56, elle passe vers x = 113 ;
//   — le fond du golfe (50 48) est le point le plus proche à l'ouest, et il
//     reste à douze unités du crochet.
//
// LE CROCHET NE SE FERME PAS EN ROND. Un « ? » dont la boucle se referme devient
// un « e » à cent pixels ; celui-ci garde sa gueule ouverte à gauche.
export const CROCHET = 'M65 55Q65 47 74 47Q83 47 83 55Q83 61 74 65L74 70';
// LE POINT EST PLEIN, et c'est la même règle que la mine du crayon de
// « Cueillette » : un disque de trois unités et demie tracé au trait de six se
// remplirait de lui-même, en moins net.
export const POINT = { cx: 74, cy: 76, r: 3.5 };

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

export const EMBLEME_FRONTIERES = {
  viewBox: `${VUE.x} ${VUE.y} ${VUE.largeur} ${VUE.hauteur}`,
  rapport: GRILLE.hauteur / GRILLE.largeur,
  trait: TRAIT,
  traitTerre: TRAIT_TERRE,
  terre: TERRE,
  crochet: CROCHET,
  point: POINT,
};
