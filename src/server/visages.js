// LE BASSIN DE VISAGES DE « LES VISAGES ».
//
// UN SEUL FICHIER À REMPLACER. La base de visages définitive n'est pas encore
// livrée ; en attendant, le jeu tourne sur un bassin de substitution dont les
// portraits sont DESSINÉS par le client, sans aucun fichier image. Le jeu est
// donc jouable, mesurable et éprouvé de bout en bout dès maintenant.
//
// COMMENT BRANCHER LA VRAIE BASE, LE JOUR VENU :
//   1. poser les images dans `src/public/visages/` ;
//   2. remplacer la liste ci-dessous par `{ id, src: '/visages/<fichier>' }` ;
//   3. rien d'autre. Le client affiche l'image dès qu'une entrée porte un `src`,
//      et retombe sur le portrait dessiné sinon.
// Un contrôle vérifie que le bassin est assez grand pour une série (29 visages
// distincts au minimum) — il rougira si la base livrée en compte moins.
//
// POURQUOI DES PORTRAITS DESSINÉS PLUTÔT QUE DES PHOTOS LIBRES TÉLÉCHARGÉES :
// une photo de personne réelle engage un droit à l'image, et un jeu diffusé en
// direct n'est pas l'endroit où l'improviser. Le substitut ne ressemble à
// personne, et c'est exactement ce qu'on veut d'un substitut.

// Quarante entrées pour vingt-neuf requises : la marge fait que deux séries
// consécutives ne se ressemblent pas.
export const BASSIN_VISAGES = Array.from({ length: 40 }, (_, i) => ({
  id: `v${String(i + 1).padStart(2, '0')}`,
  // src: '/visages/...'  ← la vraie base viendra ici
}));

export function idsDuBassin() {
  return BASSIN_VISAGES.map((v) => v.id);
}

// L'ADRESSE D'UN VISAGE, ET LE SEUL ENDROIT QUI LA CONNAISSE.
//
// Le client ne déduit JAMAIS une adresse d'un identifiant : il reçoit l'une et
// l'autre du serveur. Sans cette règle, la convention de nommage vivrait à deux
// endroits — ici et dans le client — et le jour où la banque arrivera avec des
// noms de fichiers différents, il faudrait s'en souvenir des deux côtés.
const PAR_ID = new Map(BASSIN_VISAGES.map((v) => [v.id, v]));
export function srcDeVisage(id) {
  return PAR_ID.get(id)?.src || null;
}
