// L'EMBLÈME DE « RETOUR DE FLAMME » — la flèche qui revient en arrière.
//
// LE DESSIN VIENT DES DEUX IMAGES DE RÉFÉRENCE fournies : une rangée de tuiles,
// une flèche qui part de la dernière, passe au-dessus et redescend sur la
// première, et un signe « égal » posé au sommet. Trois tuiles pour le mode
// « Retour −2 », quatre pour le « Retour −3 » — et c'est exactement ce que
// l'emblème doit dire : la tuile d'arrivée est la même que celle d'il y a deux
// (ou trois) images.
//
// UN SEUL DESSIN POUR LES DEUX MODES, paramétré par l'écart. Deux emblèmes
// recopiés diveregeraient au premier retouchage — c'est l'histoire de la flamme du
// projet, en trois exemplaires avant de diverger. Ici le nombre de tuiles EST le
// mode : l'emblème ne peut pas mentir sur la règle en cours.
//
// LES MESURES SONT ÉCRITES ET LES TRACÉS EN DÉCOULENT. C'est la troisième fois
// que ce projet le fait, et pour la même raison : un tracé SVG écrit à la main est
// illisible pour une machine, et les deux emblèmes précédents ont chacun connu
// deux dessins fautifs qu'il a fallu voir à l'écran.
export const TRAIT = 5;

// La tuile, et ce qui la sépare de sa voisine.
export const TUILE = 26;
export const ECART_TUILES = 15;

// La hauteur au-dessus des tuiles : le crochet de la flèche, puis le signe égal.
const HAUT_CROCHET = 30;   // de combien la flèche monte au-dessus des tuiles
const HAUT_EGAL = 22;      // ce que le signe égal occupe encore au-dessus
const RAYON_CROCHET = 9;

// La largeur totale pour `n` tuiles.
export function largeurDe(n) {
  return n * TUILE + (n - 1) * ECART_TUILES;
}

// LA GÉOMÉTRIE D'UN MODE. `ecart` vaut 2 ou 3 ; il y a donc 3 ou 4 tuiles — la
// tuile de départ, celles qu'on traverse, et la tuile d'arrivée.
export function geometrieDe(ecart) {
  const n = ecart + 1;
  const largeur = largeurDe(n);
  const hauteur = HAUT_EGAL + HAUT_CROCHET + TUILE;
  // Le haut des tuiles, une fois la place laissée au crochet et au signe égal.
  const yTuiles = HAUT_EGAL + HAUT_CROCHET;
  // Les centres des colonnes.
  const centres = Array.from({ length: n }, (_, i) => i * (TUILE + ECART_TUILES) + TUILE / 2);
  const premier = centres[0];
  const dernier = centres[n - 1];
  // Le crochet : il monte du bord droit, file vers la gauche, et redescend en
  // flèche sur la première tuile. Le `y` du palier est celui du crochet.
  const yPalier = HAUT_EGAL + RAYON_CROCHET;
  const yDepart = yTuiles - 4;      // il part juste au-dessus de la dernière tuile
  const yPointe = yTuiles - 5;      // et pointe juste au-dessus de la première

  const crochet = [
    `M${dernier} ${yDepart}`,
    `V${yPalier + RAYON_CROCHET}`,
    `a${RAYON_CROCHET} ${RAYON_CROCHET} 0 00-${RAYON_CROCHET} -${RAYON_CROCHET}`,
    `H${premier + RAYON_CROCHET}`,
    `a${RAYON_CROCHET} ${RAYON_CROCHET} 0 00-${RAYON_CROCHET} ${RAYON_CROCHET}`,
    `V${yPointe}`,
  ].join('');
  // La pointe de la flèche, sur la première tuile.
  const pointe = `M${premier - 6.5} ${yPointe - 7}L${premier} ${yPointe}l6.5 -7`;
  // Le signe égal, centré au sommet — c'est lui qui dit « la même image ».
  const egal = [
    `M${(premier + dernier) / 2 - 8} 5h16`,
    `M${(premier + dernier) / 2 - 8} 12h16`,
  ];

  return {
    ecart,
    n,
    viewBox: `0 0 ${largeur} ${hauteur}`,
    rapport: hauteur / largeur,
    trait: TRAIT,
    tuile: TUILE,
    yTuiles,
    centres,
    crochet,
    pointe,
    egal,
  };
}

// Ce qui sépare le palier du crochet du haut des tuiles — la seule mesure que le
// contrôle regarde : un crochet qui toucherait les tuiles ferait une masse, et
// l'emblème cesserait de montrer un RETOUR par-dessus.
export function jourDuCrochet(ecart) {
  const g = geometrieDe(ecart);
  return (g.yTuiles - 4) - (HAUT_EGAL + RAYON_CROCHET) - TRAIT;
}
