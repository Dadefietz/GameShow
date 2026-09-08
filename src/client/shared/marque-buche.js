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

// LA BÛCHE — un rondin couché, aux bouts arrondis.
export const BUCHE = { x: 6, y: 44, largeur: 108, hauteur: 40, rayon: 20 };
// Les cernes du bout gauche : c'est ce qui fait lire « bois coupé » plutôt que
// « gélule ». Deux anneaux concentriques suffisent ; trois brouillent à petite
// taille.
export const CERNES = [
  'M30 50a14 14 0 000 28',
  'M30 58a6 6 0 000 12',
];

// LA HACHE — le manche en biais, le fer à son extrémité haute.
//
// ELLE MORD LA BÛCHE SANS LA TRAVERSER : le tranchant s'arrête au-dessus du
// rondin. Une hache qui le coupe déjà raconte la fin du geste ; on veut l'instant
// d'avant, celui où le joueur choisit où frapper.
export const MANCHE = 'M60 49L86 17';

// LE FER — une lame qui s'évase, pas un losange.
//
// LE PREMIER DESSIN ÉTAIT UN PARALLÉLOGRAMME posé en biais sur le manche : tracé,
// il se lisait comme un NŒUD PAPILLON — deux triangles qui se touchent par la
// pointe. Vu à l'écran, sans ambiguïté. Une hache se reconnaît à son tranchant :
// un dos droit contre le manche, et une lame qui s'ouvre en courbe.
//
// LA HACHE EST DESCENDUE DE TROIS UNITÉS après mesure : le sommet du fer tombait
// à y = 2, et le trait de six l'emmenait à −1. L'emblème sortait de sa grille par
// le haut, donc arrivait ROGNÉ — le navigateur ne signale rien, il recadre. Un
// pixel sur cent vingt à l'écran de saisie ; à trois cents pixels sur la toile du
// stream, un coin de lame coupé net.
export const FER = 'M80 11l14-6a20 20 0 019 24l-13 8z';

// LA BOÎTE DE L'ENCRE, trait compris — même convention que les quatre emblèmes
// classiques. Tout est tracé ici : trois unités au-delà de chaque coordonnée
// extrême. À gauche et à droite, la bûche ; en haut, le fer ; en bas, la bûche.
export const BOITE = { g: 3, d: 117, h: 2, b: 87 };

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
