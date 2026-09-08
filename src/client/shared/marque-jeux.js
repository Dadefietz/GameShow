// LES EMBLÈMES DES QUATRE JEUX CLASSIQUES — quiz, vote, estimation, vrai/faux.
//
// POURQUOI ILS ARRIVENT MAINTENANT. Les quatre jeux « en direct » — le lien, les
// visages, le juste temps, retour de flamme — ont chacun leur écran d'attente,
// parce qu'ils se préparent à l'antenne et qu'il fallait bien occuper le cercle
// pendant que l'animateur saisit. Les quatre autres démarraient d'un clic, sans
// jingle : la question tombait sans qu'on ait dit à quoi on jouait.
//
// La consigne est désormais générale : « chaque module doit comporter un écran
// d'attente lorsque l'animateur le lance ». Il leur faut donc un emblème, comme
// aux autres.
//
// UN SEUL FICHIER POUR LES QUATRE. Chacun tient en quelques mesures ; quatre
// fichiers de vingt lignes auraient surtout multiplié les endroits où l'un peut
// diverger des autres. Ce qui les tient ensemble est ici : la même grille de 100,
// le même trait, les mêmes bouts arrondis.
//
// LES DESSINS VIENNENT DES RÉFÉRENCES FOURNIES, redessinées au trait sur la
// grille du système — jamais importées : le dépôt n'admet aucune icône
// matricielle, et un PNG ne prendrait ni la couleur du texte, ni l'épaisseur du
// système, et se pixelliserait à 300 px sur la toile du stream.
export const TRAIT_JEUX = 6;

// Ce qui reste de la grille autour d'un dessin — la mesure que le contrôle
// regarde. Un emblème qui déborde n'est pas signalé par le navigateur : il est
// RECADRÉ, et arrive rogné sur la toile du stream.
//
// LA BOÎTE EST CELLE DE L'ENCRE, trait compris. Elle a d'abord été écrite sur les
// COORDONNÉES des tracés, la marge retranchant partout une demi-épaisseur de
// trait : c'était faux dans les deux sens. Sur le quiz, dont les quatre pavés
// sont PLEINS et sans contour, elle retranchait une épaisseur qui n'existe pas et
// annonçait un débordement imaginaire ; sur les emblèmes tracés, elle donnait la
// bonne valeur pour la mauvaise raison. Chaque emblème déclare donc directement
// jusqu'où son encre va — demi-trait ajouté là où la forme est tracée, rien là où
// elle est pleine — et la marge n'est plus qu'une soustraction.
function marge(boite, grille) {
  return Math.min(boite.g, boite.h, grille.l - boite.d, grille.h - boite.b);
}

// ---------------------------------------------------------------------------
// QUIZ — quatre réponses, une question
// ---------------------------------------------------------------------------
// Quatre pavés pleins en deux rangées, surmontés d'un point d'interrogation :
// c'est le choix multiple, dit en une image. Le « ? » est du TEXTE et non un
// tracé — même raison que les chiffres de « Retour de flamme » : la police du
// projet le dessine mieux qu'un chemin écrit à la main, et il reste lisible à
// toutes les tailles.
const QUIZ_PAVE = { l: 40, h: 17, r: 3 };
export const QUIZ = {
  viewBox: '0 0 100 96',
  grille: { l: 100, h: 96 },
  interro: { x: 50, y: 24, taille: 46 },
  paves: [
    { x: 4, y: 54 }, { x: 56, y: 54 },
    { x: 4, y: 77 }, { x: 56, y: 77 },
  ],
  pave: QUIZ_PAVE,
  // Tout est PLEIN ici — le « ? » et les quatre pavés : l'encre s'arrête aux
  // coordonnées, sans demi-trait à ajouter.
  boite: { g: 4, d: 96, h: 4, b: 94 },
};

// ---------------------------------------------------------------------------
// VOTE — le bulletin dans son enveloppe
// ---------------------------------------------------------------------------
// Une enveloppe ouverte d'où sort un bulletin : c'est le geste du vote, et il dit
// aussi le secret de la voix — on glisse, on ne montre pas.
export const VOTE = {
  viewBox: '0 0 100 96',
  grille: { l: 100, h: 96 },
  // TROIS COUCHES, ET L'ORDRE COMPTE. Le bulletin d'abord, l'enveloppe PLEINE
  // par-dessus — sans quoi le bulletin se voit au travers et l'image devient un
  // rectangle dans un rectangle —, le pli en dernier.
  //
  // Le premier essai posait l'enveloppe au-dessus d'un bulletin déjà bas : les
  // lignes du bulletin disparaissaient entièrement, et il ne restait qu'une
  // enveloppe. Le bulletin doit DÉPASSER par le haut, c'est ce qui fait lire
  // « on glisse un bulletin dedans » plutôt que « voici une enveloppe ».
  bulletin: 'M28 6h44v48H28z',
  lignes: ['M37 20h26', 'M37 30h26', 'M37 40h17'],
  corps: 'M8 36h84v50a4 4 0 01-4 4H12a4 4 0 01-4-4z',
  pli: ['M8 36l42 34 42-34'],
  // Tracés : trois unités d'encre au-delà de chaque coordonnée extrême.
  boite: { g: 5, d: 95, h: 3, b: 93 },
};

// ---------------------------------------------------------------------------
// ESTIMATION — le cadran et son aiguille
// ---------------------------------------------------------------------------
// Un demi-cadran gradué, une aiguille au milieu : on vise, on est plus ou moins
// près. C'est exactement ce que le barème mesure.
export const ESTIMATION = {
  viewBox: '0 0 100 72',
  grille: { l: 100, h: 72 },
  arc: 'M8 64a42 42 0 0184 0',
  // Les graduations, aux quarts et aux bords — pas plus : un cadran trop gradué
  // devient une horloge.
  graduations: ['M13 44l-6-3', 'M28 21l-4-5', 'M50 12v-7', 'M72 21l4-5', 'M87 44l6-3'],
  // L'aiguille : du centre vers midi, un peu en biais pour qu'elle ait l'air de
  // pointer une valeur plutôt que de dormir.
  aiguille: 'M50 64L44 20',
  moyeu: { cx: 50, cy: 64, r: 4 },
  // Tracés, sauf le moyeu qui est plein : en bas, l'encre s'arrête au cercle.
  boite: { g: 4, d: 96, h: 2, b: 68 },
};

// ---------------------------------------------------------------------------
// VRAI / FAUX — la coche et la croix, séparées
// ---------------------------------------------------------------------------
// Les deux issues, et la barre qui les sépare : il n'y a rien entre les deux.
export const VRAI_FAUX = {
  viewBox: '0 0 100 96',
  grille: { l: 100, h: 96 },
  // LA BARRE PASSE ENTRE LES DEUX, elle ne les traverse pas.
  //
  // Le premier tracé partait de (88,8) à (28,88) et coupait la coche en haut et
  // la croix en bas : les trois signes se mêlaient en un nœud illisible. La coche
  // s'est resserrée en haut à gauche, la croix en bas à droite, et la barre passe
  // désormais dans le couloir qu'elles laissent — vérifié à l'écran.
  coche: 'M10 40l14 14L48 18',
  croix: ['M60 58l28 28', 'M88 58l-28 28'],
  barre: 'M88 14L26 84',
  boite: { g: 7, d: 91, h: 11, b: 89 },
};

export const EMBLEMES_JEUX = {
  quiz: QUIZ,
  vote: VOTE,
  estimation: ESTIMATION,
  true_false: VRAI_FAUX,
};

// Le rapport hauteur/largeur d'un emblème : les surfaces demandent une LARGEUR,
// la hauteur en découle. Un emblème qui recevrait les deux serait écrasé.
export function rapportDe(type) {
  const e = EMBLEMES_JEUX[type];
  return e ? e.grille.h / e.grille.l : 1;
}

// La marge d'un emblème dans sa grille — ce que le contrôle vérifie.
export function margeDe(type) {
  const e = EMBLEMES_JEUX[type];
  return e ? marge(e.boite, e.grille) : 0;
}
