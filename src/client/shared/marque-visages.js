// L'EMBLÈME DE « LES VISAGES » — trois masques superposés, décalés vers la droite.
//
// POURQUOI CE FICHIER EXISTE. Même raison que `marque-lien.js` : le dessin sert
// sur DEUX surfaces — l'écran d'annonce du joueur et celui du stream — et le
// projet a déjà payé le prix d'un tracé recopié qui diverge (la flamme, chantier
// v2). Une géométrie, deux tailles.
//
// LE DESSIN. La consigne demandait « trois visages style masque blanc superposés
// avec un décalage sur la droite des visages arrières », en plus amical que la
// référence. D'où un masque ARRONDI plutôt qu'ovale, des yeux ronds plutôt que
// des fentes, et une bouche qui sourit — le registre du jeu est un feu de camp,
// pas un thriller.
//
// Les masques arrière sont décalés ET rapetissés : c'est le décalage seul qui
// donnerait trois masques côte à côte, la réduction leur donne la profondeur.

export const MASQUES = {
  viewBox: '0 0 100 88',
  trait: 3.2,

  // Le masque, tracé une fois. Un contour de visage arrondi, deux yeux, un
  // sourire. Dessiné centré sur (0,0) pour que les copies ne soient que des
  // translations et des homothéties.
  contour: 'M0 -30c11 0 18 8 18 20 0 15-8 32-18 32S-18 5-18 -10c0-12 7-20 18-20z',
  oeilGauche: { cx: -7.5, cy: -6, r: 3.1 },
  oeilDroit: { cx: 7.5, cy: -6, r: 3.1 },
  sourire: 'M-7 8c2.6 3.4 11.4 3.4 14 0',

  // Les trois exemplaires : le plus lointain d'abord, pour qu'il passe DESSOUS.
  // `opacite` fait reculer les arrières sans changer leur couleur — le masque
  // reste le même objet, plus loin dans la nuit.
  copies: [
    { x: 74, y: 46, echelle: 0.70, opacite: 0.30 },
    { x: 62, y: 45, echelle: 0.85, opacite: 0.55 },
    { x: 40, y: 44, echelle: 1.00, opacite: 1.00 },
  ],
};
