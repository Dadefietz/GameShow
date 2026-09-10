// L'EMBLÈME DE « COUPE TA BÛCHE » — la bûche et la hache.
//
// LE DESSIN VIENT DE LA RÉFÉRENCE FOURNIE : un rondin couché, ses cernes visibles
// au bout, et une hache plantée au-dessus. Redessiné au trait sur la grille du
// système — le dépôt n'admet aucune icône matricielle, et un PNG ne prendrait ni
// la couleur du texte, ni l'épaisseur du système, et se pixelliserait à 300 px sur
// la toile du stream.
//
// LES MESURES SONT ÉCRITES ET LES TRACÉS EN DÉCOULENT, comme pour les trois
// emblèmes précédents. Chacun d'eux a connu au moins un dessin fautif qu'il a
// fallu voir à l'écran ; ce qui se mesure ici, c'est que rien ne déborde de la
// grille et que la hache ne se confonde pas avec la bûche.
export const GRILLE = { largeur: 120, hauteur: 92 };
export const TRAIT = 6;

// LE RONDIN — couché sur toute la largeur, aux bouts arrondis, dans le bas de la
// grille. Il occupe le bas parce que la hache occupe le haut : elle tombe dessus.
export const BUCHE = { x: 6, y: 50, largeur: 108, hauteur: 36, rayon: 18 };

// LES CERNES DU BOUT GAUCHE — ce qui fait lire « bois coupé » plutôt que
// « gélule ». Deux anneaux FERMÉS et concentriques ; trois brouillent à petite
// taille.
//
// LES PREMIERS ÉTAIENT DES ARCS OUVERTS vers la droite : à l'écran, ils se
// lisaient « C » et « c » emboîtés — une oreille, ou une spirale. Un bout de
// rondin montre des anneaux COMPLETS, et l'ovale dit en plus que la coupe est vue
// de biais.
export const CERNES = [
  'M26 57a10 11 0 1 0 0 22a10 11 0 1 0 0-22',
  'M26 63a3.5 5 0 1 0 0 10a3.5 5 0 1 0 0-10',
];

// L'ÉCORCE — « il manque juste des petits traits sur le long pour que ça fasse
// écorce ». Trois entailles horizontales, de longueurs inégales, à droite des
// cernes. Horizontales, et c'est le sujet : verticales et régulières, elles
// faisaient du rondin une règle graduée — essayé sur l'écran de jeu, écarté là
// aussi.
export const ECORCE = ['M48 61h28', 'M54 75h30', 'M88 68h16'];
// L'ÉCORCE SE TRACE PLUS FIN QUE LE RESTE. À l'épaisseur du système, trois
// entailles deviennent trois BARRES et le rondin se lit comme un radiateur.
export const TRAIT_ECORCE = 3;

// LA HACHE — LEVÉE AU-DESSUS DU RONDIN, TRANCHANT VERS LUI.
//
// « Le logo du jeu doit ressembler à une hache qui s'apprête à couper une bûche. »
// Elle était posée À CÔTÉ, comme sur la première référence : deux objets dans la
// même image, mais aucun geste. Ici le fer surplombe le bois, le tranchant tourné
// vers lui, et le manche relevé : c'est l'instant d'avant le coup.
//
// ELLE NE TOUCHE PAS LE RONDIN, et ce n'est pas un détail : une hache déjà entrée
// dans le bois raconte la fin du geste, alors que le jeu tout entier se joue sur
// le CHOIX de l'endroit où frapper.
//
// TROIS DESSINS FAUTIFS AVANT CELUI-CI, tous vus à l'écran :
//   1. un parallélogramme en biais sur le manche — un nœud papillon ;
//   2. une lame évasée au bout du manche — une pelle ;
//   3. le même contour, tracé au lieu d'être plein — une loupe. Un petit contour
//      fermé à un trait de six se lit comme un ANNEAU. Un tranchant est une masse.
// LE FER — un tranchant LARGE et presque droit, un talon ÉTROIT. C'est ce
// rapport-là qui fait lire « hache », et rien d'autre : ni la taille, ni le
// manche.
//   - l'arc du bas bombe VERS LE BOIS. Écrit avec l'autre sens de balayage, il se
//     creusait vers le haut et le fer devenait une tente ;
//   - il est PRESQUE plat (rayon 40 pour une corde de 32, soit trois unités de
//     bombement). Trop rond — rayon 17 —, la tête devenait une LOUCHE.
// ET IL EST ASYMÉTRIQUE. Centré sur le manche, le fer devenait un BALAI : un
// trapèze régulier au bout d'un bâton. Une hache déborde d'un seul côté — un
// tranchant long à gauche, un talon court à droite —, et c'est ce déséquilibre
// qu'on reconnaît avant toute autre chose.
export const FER = 'M34 34a44 44 0 0 0 38 0L68 20L54 20z';

// LE MANCHE — À L'APLOMB, et pas en biais.
//
// En biais, il sortait du fer par le CÔTÉ : l'ensemble se lisait comme une louche
// ou une truelle. Une hache se tient perpendiculaire à son tranchant ; le
// tranchant étant horizontal, le manche est vertical. Il part de l'intérieur du
// fer, ce qui le fait passer À TRAVERS la tête plutôt que d'y être collé.
export const MANCHE = 'M60 30L60 6';

// LA BOÎTE DE L'ENCRE, trait compris pour ce qui est tracé, aux coordonnées pour
// ce qui est plein (le fer). À gauche et à droite le rondin, en haut le fer, en
// bas le rondin.
export const BOITE = { g: 3, d: 117, h: 3, b: 89 };

// Ce qui reste de la grille autour du dessin.
export function margeDeGrille() {
  return Math.min(BOITE.g, BOITE.h, GRILLE.largeur - BOITE.d, GRILLE.hauteur - BOITE.b);
}

export const BUCHE_HACHE = {
  viewBox: `0 0 ${GRILLE.largeur} ${GRILLE.hauteur}`,
  rapport: GRILLE.hauteur / GRILLE.largeur,
  trait: TRAIT,
  buche: BUCHE,
  cernes: CERNES,
  ecorce: ECORCE,
  traitEcorce: TRAIT_ECORCE,
  manche: MANCHE,
  fer: FER,
};
