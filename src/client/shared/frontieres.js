// « FRONTIÈRES » — CE QUE LES TROIS ÉCRANS PARTAGENT.
//
// Le téléphone et l'antenne affichent les MÊMES quatre indices, aux mêmes
// secondes. Écrire la mise en forme deux fois, c'est accepter qu'un jour la
// taille se lise « 1300 km × 1000 km » sur l'un et « 1300 km,1000 km » sur
// l'autre — ce dépôt a déjà payé ce prix ailleurs (voir la note de `memeNom`
// dans modules.js, dont on avait écrit un second exemplaire).
//
// RIEN ICI NE CONNAÎT LA RÉPONSE : ces fonctions mettent en forme ce que le
// serveur a déjà décidé d'envoyer, et la liste des noms que le joueur voit de
// toute façon dans son aide à la saisie.

// UN INDICE, MIS EN PAGE.
//
// Trois des quatre sont du texte simple. LA TAILLE ARRIVE EN DEUX NOMBRES —
// « 1300 km » et « 1000 km » — et se lit comme un seul indice : le serveur
// envoie ce que la base contient, et c'est l'écran qui les joint. Rend `null`
// quand l'indice n'a rien à dire, pour que l'écran affiche son « ? ».
export function texteDUnIndice(valeur) {
  if (valeur == null) return null;
  if (typeof valeur === 'object') {
    const bouts = [valeur.longueur, valeur.largeur].map((x) => String(x || '').trim()).filter(Boolean);
    return bouts.length ? bouts.join(' × ') : null;
  }
  const t = String(valeur).trim();
  return t || null;
}

// LA COMPARAISON DE L'AIDE À LA SAISIE — accents, casse et ponctuation ignorés.
//
// C'EST LA MÊME RÈGLE QUE CELLE DU SERVEUR (`memeNom`, dans cache-cache.js), et
// il le faut : une aide qui ne proposerait « Côte d'Ivoire » qu'à qui tape déjà
// l'accent circonflexe et l'apostrophe typographique ne servirait personne,
// alors que le serveur, lui, accepte « cote d ivoire ». Elle n'est pas importée
// de là : `memeNom` répond « ces deux noms sont-ils le même », cette fonction
// réduit UN nom pour le chercher dans une liste. Deux questions différentes,
// deux fonctions, et un contrôle qui vérifie qu'elles s'accordent.
export function sansOrnement(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export const SUGGESTIONS_MAX = 6;

// L'AIDE À LA SAISIE.
//
// Les cent soixante-quinze noms arrivent avec la question et ne révèlent rien :
// le joueur sait déjà que la réponse est un pays. Sans eux, pas d'aide possible
// — et « Bosnie-Herzégovine » se tape mal sur un téléphone, en quarante-cinq
// secondes, sous la pression.
//
// CE QUI COMMENCE PAR LA SAISIE D'ABORD, le reste ensuite : qui tape « ir »
// cherche l'Iran ou l'Irak avant le Liberia.
export function suggerer(noms, saisie) {
  const q = sansOrnement(saisie);
  if (!q) return [];
  const nus = (noms || []).map((n) => [n, sansOrnement(n)]);
  const debut = nus.filter(([, nu]) => nu.startsWith(q)).map(([n]) => n);
  const dedans = nus.filter(([, nu]) => !nu.startsWith(q) && nu.includes(q)).map(([n]) => n);
  return [...debut, ...dedans].slice(0, SUGGESTIONS_MAX);
}
