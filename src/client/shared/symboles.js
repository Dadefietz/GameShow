// LES QUINZE IMAGES DE « RETOUR DE FLAMME » — dix chiffres, cinq figures.
//
// POURQUOI ELLES SONT DESSINÉES ET NON PHOTOGRAPHIÉES. « Les visages » a sa
// banque de deux cents portraits, servie en fichiers. Ici les images sont des
// SIGNES : un carré, un losange, un 7. Les fabriquer en fichiers, ce serait quinze
// adresses à tenir, quinze chargements à attendre sur le téléphone d'un joueur en
// 4G — pour un dessin qui tient en une ligne de tracé. Le dépôt n'admet d'ailleurs
// aucune icône matricielle : « SVG au trait inline, jamais d'emoji ».
//
// ET LES CHIFFRES SONT DU TEXTE, pas des tracés.
//
// La consigne dit « créer les 10 images des chiffres ». On aurait pu en dessiner
// les contours à la main — quinze chemins de plus, illisibles, impossibles à
// contrôler, et moins beaux que ce que la police du projet rend déjà. Un chiffre
// posé en grand dans la même tuile que les figures EST une image : c'est ce que le
// joueur voit, et c'est ce que le graphique de la révélation redessine. Ce qui
// compte pour le jeu, c'est que les quinze signes soient également reconnaissables
// et également distincts — pas la technique qui les produit.
//
// CE FICHIER NE CONTIENT AUCUNE LISTE, et c'est délibéré. La liste des signes qui
// peuvent défiler appartient au SERVEUR, qui tire la série (`src/server/symboles.js`).
// Ici on sait seulement DESSINER un identifiant qu'on reçoit — et répondre « je ne
// sais pas » pour tout autre, plutôt que d'inventer.
//
// Les deux fichiers ne peuvent pas s'importer sans faire entrer du code serveur
// dans le paquet du navigateur : un contrôle automatique les confronte, exactement
// comme pour l'icône d'onglet et la marque. Sans lui, un signe ajouté d'un côté
// ferait défiler une case VIDE sur le téléphone d'un joueur.

// La grille et le trait des figures : ceux du système, comme les emblèmes.
export const GRILLE = 24;
export const TRAIT = 2.4;

// LES CINQ FIGURES. Chacune occupe franchement sa tuile : un losange et un carré
// se distinguent mal quand ils sont petits et timides, et le graphique de la
// révélation les montre à moins d'un centimètre.
export const FIGURES = {
  cercle: { type: 'cercle', cx: 12, cy: 12, r: 8.6 },
  carre: { type: 'trace', d: 'M4 4h16v16H4z' },
  losange: { type: 'trace', d: 'M12 3.2l8.8 8.8-8.8 8.8L3.2 12z' },
  triangle: { type: 'trace', d: 'M12 3.6l8.8 15.6H3.2z' },
  croix: { type: 'trace', d: 'M5.4 5.4l13.2 13.2M18.6 5.4L5.4 18.6' },
};

// Ce qu'un identifiant désigne : un chiffre à écrire, ou une figure à tracer.
// Renvoie `null` pour un identifiant inconnu — l'écran ne dessine alors rien
// plutôt que d'inventer, et le contrôle de la banque rougit.
export function symboleDe(id) {
  const s = String(id || '');
  if (s.startsWith('ch-')) {
    const c = s.slice(3);
    // UN SEUL CARACTÈRE, DE 0 À 9 — reconnu par sa forme et non par une liste.
    // Une liste ici serait une seconde déclaration du bassin, à côté de celle du
    // serveur : deux listes finissent toujours par différer d'une entrée.
    return /^[0-9]$/.test(c) ? { famille: 'chiffre', chiffre: c } : null;
  }
  if (s.startsWith('fg-')) {
    const f = s.slice(3);
    return FIGURES[f] ? { famille: 'figure', nom: f, figure: FIGURES[f] } : null;
  }
  return null;
}

// Le nom lisible d'un signe — pour les lecteurs d'écran et les titres du
// graphique. Un défilé de tuiles muettes n'est pas jouable sans les yeux ; il ne
// l'est pas davantage avec un lecteur d'écran qui annonce « image ».
const LIBELLES = {
  cercle: 'cercle', carre: 'carré', losange: 'losange',
  triangle: 'triangle', croix: 'croix',
};
export function libelleDe(id) {
  const s = symboleDe(id);
  if (!s) return '';
  return s.famille === 'chiffre' ? `chiffre ${s.chiffre}` : LIBELLES[s.nom];
}
