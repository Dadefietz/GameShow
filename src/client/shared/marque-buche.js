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

// LE RONDIN — couché, aux bouts arrondis, occupant la moitié gauche et basse.
export const BUCHE = { x: 6, y: 46, largeur: 78, hauteur: 40, rayon: 20 };

// LES CERNES DU BOUT GAUCHE — ce qui fait lire « bois coupé » plutôt que
// « gélule ». Deux anneaux FERMÉS et concentriques ; trois brouillent à petite
// taille.
//
// LES PREMIERS ÉTAIENT DES ARCS OUVERTS vers la droite : à l'écran, ils se
// lisaient « C » et « c » emboîtés — une oreille, ou une spirale. Un bout de
// rondin montre des anneaux COMPLETS, et l'ovale dit en plus que la coupe est vue
// de biais.
export const CERNES = [
  'M26 54a10 12 0 1 0 0 24a10 12 0 1 0 0-24',
  'M26 61a3.5 5 0 1 0 0 10a3.5 5 0 1 0 0-10',
];

// CE QUE LA RÉFÉRENCE PORTE ET QUE CE DESSIN NE REPREND PAS : les entailles
// d'écorce dans le corps du rondin, et le coin planté dans son dos.
//
// Essayés, tracés, REGARDÉS : à un trait de six sur une grille de cent vingt, ces
// deux ajouts ne sont pas des détails, ce sont des BARRES. Les entailles se
// collaient aux cernes et l'ensemble devenait une masse ; le coin se lisait comme
// la queue d'une citrouille. La référence est un dessin PLEIN, aux lignes fines :
// elle peut porter cinq éléments, un tracé au trait épais n'en porte que deux.
// On garde donc ce qui fait le sens — le rondin, ses cernes, la hache.

// LA HACHE — À CÔTÉ DU RONDIN, PAS DEDANS, comme sur la référence.
//
// TROIS DESSINS FAUTIFS AVANT CELUI-CI, tous vus à l'écran.
//   1. Un PARALLÉLOGRAMME en biais sur le manche : il se lisait comme un nœud
//      papillon, deux triangles se touchant par la pointe.
//   2. Une lame évasée AU BOUT du manche, plantée dans le rondin : l'emblème
//      entier se lisait « PELLE ». Une hache ne se reconnaît ni à sa masse ni à
//      son manche, mais au rapport entre un talon étroit et un tranchant large.
//   3. Le même godet retourné : toujours une pelle.
//
// CE QUI LE CORRIGE, ET IL FALLAIT REGARDER LA RÉFÉRENCE POUR LE VOIR : le
// tranchant est à GAUCHE, en arc, le talon à droite, et le manche part vers le
// BAS-DROIT. La hache ne touche pas le rondin — elle est posée au-dessus, à
// côté. C'est cette silhouette-là qu'on reconnaît, pas une lame plantée.
export const FER = 'M76 8a15 15 0 000 24l24-4v-16z';
export const MANCHE = 'M99 20L112 40';

// LA BOÎTE DE L'ENCRE, trait compris — même convention que les quatre emblèmes
// classiques. Tout est tracé : trois unités au-delà de chaque coordonnée extrême.
// À gauche le rondin, en haut le fer, à droite le manche, en bas le rondin.
// Le fer est PLEIN : son encre s'arrête à ses coordonnées, sans demi-trait —
// même convention que les quatre emblèmes classiques.
export const BOITE = { g: 3, d: 115, h: 8, b: 89 };

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
  manche: MANCHE,
  fer: FER,
};
