// LE BASSIN DE « RETOUR DE FLAMME » — les quinze signes qui peuvent défiler.
//
// POURQUOI LA LISTE EST ICI ET LE DESSIN AILLEURS. C'est le serveur qui tire la
// série : il lui faut la liste, comme il lui faut celle des portraits pour « Les
// visages » (`src/server/visages.js`, même rôle, même place). Mais un signe n'est
// pas un fichier : il se DESSINE, et son tracé n'a rien à faire côté serveur — il
// vit dans `src/client/shared/symboles.js`, avec les autres tracés du projet.
//
// LES DEUX NE PEUVENT PAS S'IMPORTER L'UN L'AUTRE sans faire entrer du code
// serveur dans le paquet du navigateur. C'est exactement la situation de l'icône
// d'onglet, qui ne peut pas lire le module de la marque : là-bas, un contrôle
// automatique compare les deux. Ici aussi — `tests/unit/retour-flamme.test.js`
// vérifie que chaque identifiant tiré par le serveur est dessinable par le client.
// Sans lui, un signe ajouté d'un côté ferait défiler une case VIDE sur le
// téléphone d'un joueur, et fausserait la manche sans rien signaler.
//
// DIX CHIFFRES ET CINQ FIGURES, MÊLÉS DANS LA MÊME SÉRIE — ARBITRÉ, PLUS OUVERT.
//
// L'énoncé disait « les images sont soit des Figures, soit les chiffres de 0 à 9 »
// et annotait ses deux exemples « (avec les chiffres) » : on pouvait y lire une
// série par famille, ou une série tirée dans les quinze. La question a été posée à
// l'auteur, qui a tranché pour le mélange — « garde le mélange des quinze signes ».
//
// LA RÉSERVE EST DONC LEVÉE, et ce commentaire la remplace pour qu'elle ne se
// rouvre pas d'elle-même à la prochaine lecture. Ce qui reste vrai : basculer sur
// l'autre lecture ne demanderait qu'un changement ici, puisque le bassin n'est
// déclaré qu'à cet endroit.
export const CHIFFRES_RETOUR = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
export const FIGURES_RETOUR = ['cercle', 'carre', 'losange', 'triangle', 'croix'];

// Le préfixe dit la famille : un identifiant nu — « 7 », « croix » — se lirait mal
// dans un journal et se confondrait au premier voisinage.
export const BASSIN_RETOUR = [
  ...CHIFFRES_RETOUR.map((c) => `ch-${c}`),
  ...FIGURES_RETOUR.map((f) => `fg-${f}`),
];
