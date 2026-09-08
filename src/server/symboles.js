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
// DEUX FAMILLES, ET UNE SÉRIE N'EN EMPLOIE QU'UNE.
//
// L'HISTOIRE DE CETTE DÉCISION, parce qu'elle a changé deux fois. L'énoncé
// d'origine disait « les images sont soit des Figures, soit les chiffres de 0 à
// 9 » et annotait ses exemples « (avec les chiffres) » : deux lectures se
// défendaient — une série par famille, ou une série tirée dans les quinze. La
// question a été posée, l'auteur a d'abord répondu « garde le mélange », puis a
// tranché l'inverse par écrit, en ajoutant une option de style sur l'écran de
// l'animateur : « une série ne peut pas comporter les 2 styles ».
//
// C'est cette dernière consigne qui vaut, et elle est la plus détaillée : elle
// vient avec le contrôle qui la rend jouable — l'animateur CHOISIT la famille,
// comme il choisit déjà le mode.
//
// POURQUOI C'EST UN MEILLEUR JEU, d'ailleurs : dix signes d'une même famille se
// confondent plus qu'un chiffre au milieu de figures. Mélanger donnait à l'œil un
// repère gratuit — « c'était une figure » — qui remplaçait la mémoire du signe.
export const FAMILLES_RETOUR = ['chiffres', 'figures'];
export const CHIFFRES_RETOUR = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
export const FIGURES_RETOUR = ['cercle', 'carre', 'losange', 'triangle', 'croix'];

// Le préfixe dit la famille : un identifiant nu — « 7 », « croix » — se lirait mal
// dans un journal et se confondrait au premier voisinage.
// Les deux bassins, séparés — c'est l'un OU l'autre par manche.
export const BASSIN_CHIFFRES = CHIFFRES_RETOUR.map((c) => `ch-${c}`);
export const BASSIN_FIGURES = FIGURES_RETOUR.map((f) => `fg-${f}`);

// Le bassin d'une famille. Une famille inconnue retombe sur les chiffres : dix
// signes valent mieux que cinq, et une valeur venue du réseau ne doit pas choisir
// le jeu le plus difficile par accident.
export function bassinDe(famille) {
  return famille === 'figures' ? BASSIN_FIGURES : BASSIN_CHIFFRES;
}

// TOUS LES SIGNES, toutes familles confondues — pour les contrôles et pour rien
// d'autre : aucune série ne les emploie ensemble.
export const BASSIN_RETOUR = [...BASSIN_CHIFFRES, ...BASSIN_FIGURES];
