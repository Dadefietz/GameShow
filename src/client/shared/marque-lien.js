// LES DEUX CHAÎNONS — emblème du jeu « Le lien ».
//
// POURQUOI CE FICHIER, ET PAS UN DESSIN RECOPIÉ. La flamme du projet a vécu en
// trois exemplaires recopiés à la main avant de diverger sans que personne ne le
// voie (voir `marque-flamme.js`). Le même dessin sert ici sur TROIS surfaces —
// l'annonce du joueur, son écran de jeu, la scène du stream. Il est donc écrit
// une fois, et chaque surface n'apporte que sa taille.
//
// Le tracé : deux anneaux ovales entrelacés, sur la grille de 24 du système, au
// trait de 2,1 comme la flamme — les deux emblèmes doivent se ressembler.
export const CHAINONS = {
  viewBox: '0 0 24 24',
  trait: 2.1,
  // Anneau de gauche, incliné, et son jumeau décalé vers la droite.
  gauche: 'M10.4 7.6a3.6 3.6 0 00-5.1 0l-2.2 2.2a3.6 3.6 0 105.1 5.1l1.1-1.1',
  droite: 'M13.6 16.4a3.6 3.6 0 005.1 0l2.2-2.2a3.6 3.6 0 10-5.1-5.1l-1.1 1.1',
  // Le maillon central : ce qui fait qu'ils tiennent l'un dans l'autre.
  jointure: 'M9.2 14.8l5.6-5.6',
};
