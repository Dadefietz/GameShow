// LA BANQUE DE DESSINS DE « CUEILLETTE ».
//
// ============================================================================
// D'OÙ VIENNENT CES IMAGES
// ============================================================================
//
// CINQUANTE DESSINS AU TRAIT FOURNIS PAR L'AUTEUR : dix arbres, vingt fleurs,
// vingt fruits. Les droits et la licence relèvent de lui ; ce dépôt les sert, il
// ne les revendique pas. Voir docs/CREDITS.md.
//
// LE NOM EST DÉCLARÉ ICI, pas lu dans le nom de fichier. C'est la règle du projet
// depuis la banque de « Cache-cache » : un jeu qui lirait ses données dans un nom
// de fichier se casserait au premier renommage, sans que personne sache pourquoi.
// Les fichiers d'origine portaient des intitulés anglais et un identifiant de
// trente-deux caractères ; ils sont rangés sous « d001 » à « d050 ».
//
// LA FAMILLE N'EST PAS DEMANDÉE PAR L'ÉNONCÉ. Elle est là parce que l'animateur
// doit « avoir la possibilité de choisir quel sera le dessin cible » : cinquante
// vignettes en vrac ne se choisissent pas en direct, trois groupes de dix à vingt
// se parcourent d'un coup d'œil.
//
// ============================================================================
// TRAITEMENT
// ============================================================================
//
// Recadrage sur l'ENCRE, centrage sur un CARRÉ avec six pour cent de marge,
// 512 px, détourage du fond par les bords, WebP qualité 82 méthode 6 — le réglage
// du dépôt, celui des portraits et des objets.
//
// POURQUOI UN CARRÉ, alors que les originaux sont en portrait. Les rapports de
// leurs encres vont de 0,25 — un bouleau tout en hauteur — à 1,68 pour une tranche
// de pastèque. Une zone de dessin qui changerait de forme à chaque manche
// désorienterait les joueurs et rendrait invérifiable la règle « une zone de
// dessin d'exactement la même taille que l'image du dessin cible ». Le carré donne
// une seule forme, la même partout, mesurable au pixel.
//
// POURQUOI RECADRER. Les originaux portent de larges marges blanches : l'encre
// n'occupait que 31 % à 79 % de l'image. Affichés tels quels, les dessins auraient
// paru minuscules au centre de l'écran, et les joueurs auraient dessiné petit dans
// une grande zone — ce que le calcul de ressemblance aurait puni sur les
// proportions, pour une raison qui ne les regarde pas.
//
// LE DÉTOURAGE PART DES BORDS et non de « tout le blanc » : le creux d'un avocat,
// la chair d'une noix de coco et le cœur d'une figue sont blancs eux aussi. Un
// détourage naïf les aurait percés, et le dessin serait apparu troué sur la plaque
// claire de sa case. Vérifié sur planche contact avant intégration.

export const FAMILLES = [
  { cle: 'arbres', nom: 'Arbres' },
  { cle: 'fleurs', nom: 'Fleurs' },
  { cle: 'fruits', nom: 'Fruits' },
];

export const BASSIN_DESSINS = [
  { id: 'd001', nom: 'Chêne', famille: 'arbres' },
  { id: 'd002', nom: 'Sapin', famille: 'arbres' },
  { id: 'd003', nom: 'Palmier', famille: 'arbres' },
  { id: 'd004', nom: 'Saule pleureur', famille: 'arbres' },
  { id: 'd005', nom: 'Cerisier', famille: 'arbres' },
  { id: 'd006', nom: 'Baobab', famille: 'arbres' },
  { id: 'd007', nom: 'Bouleau', famille: 'arbres' },
  { id: 'd008', nom: 'Érable', famille: 'arbres' },
  { id: 'd009', nom: 'Acacia', famille: 'arbres' },
  { id: 'd010', nom: 'Cyprès', famille: 'arbres' },
  { id: 'd011', nom: 'Rose', famille: 'fleurs' },
  { id: 'd012', nom: 'Tulipe', famille: 'fleurs' },
  { id: 'd013', nom: 'Tournesol', famille: 'fleurs' },
  { id: 'd014', nom: 'Marguerite', famille: 'fleurs' },
  { id: 'd015', nom: 'Coquelicot', famille: 'fleurs' },
  { id: 'd016', nom: 'Lys', famille: 'fleurs' },
  { id: 'd017', nom: 'Iris', famille: 'fleurs' },
  { id: 'd018', nom: 'Jonquille', famille: 'fleurs' },
  { id: 'd019', nom: 'Orchidée', famille: 'fleurs' },
  { id: 'd020', nom: 'Hibiscus', famille: 'fleurs' },
  { id: 'd021', nom: 'Lotus', famille: 'fleurs' },
  { id: 'd022', nom: 'Pivoine', famille: 'fleurs' },
  { id: 'd023', nom: 'Œillet', famille: 'fleurs' },
  { id: 'd024', nom: 'Pensée', famille: 'fleurs' },
  { id: 'd025', nom: 'Lavande', famille: 'fleurs' },
  { id: 'd026', nom: 'Chrysanthème', famille: 'fleurs' },
  { id: 'd027', nom: 'Fleur de cerisier', famille: 'fleurs' },
  { id: 'd028', nom: 'Jacinthe', famille: 'fleurs' },
  { id: 'd029', nom: 'Bouton de lotus', famille: 'fleurs' },
  { id: 'd030', nom: 'Campanule', famille: 'fleurs' },
  { id: 'd031', nom: 'Pomme', famille: 'fruits' },
  { id: 'd032', nom: 'Poire', famille: 'fruits' },
  { id: 'd033', nom: 'Banane', famille: 'fruits' },
  { id: 'd034', nom: 'Orange', famille: 'fruits' },
  { id: 'd035', nom: 'Citron', famille: 'fruits' },
  { id: 'd036', nom: 'Fraise', famille: 'fruits' },
  { id: 'd037', nom: 'Pastèque', famille: 'fruits' },
  { id: 'd038', nom: 'Raisin', famille: 'fruits' },
  { id: 'd039', nom: 'Ananas', famille: 'fruits' },
  { id: 'd040', nom: 'Cerises', famille: 'fruits' },
  { id: 'd041', nom: 'Pêche', famille: 'fruits' },
  { id: 'd042', nom: 'Noix de coco', famille: 'fruits' },
  { id: 'd043', nom: 'Kiwi', famille: 'fruits' },
  { id: 'd044', nom: 'Mangue', famille: 'fruits' },
  { id: 'd045', nom: 'Avocat', famille: 'fruits' },
  { id: 'd046', nom: 'Figue', famille: 'fruits' },
  { id: 'd047', nom: 'Framboises', famille: 'fruits' },
  { id: 'd048', nom: 'Myrtilles', famille: 'fruits' },
  { id: 'd049', nom: 'Grenade', famille: 'fruits' },
  { id: 'd050', nom: 'Melon', famille: 'fruits' },
];

// L'ADRESSE D'UN DESSIN, ET LE SEUL ENDROIT QUI LA CONNAISSE. Même règle que les
// visages et les objets : le client ne déduit JAMAIS une adresse d'un identifiant,
// il reçoit l'une et l'autre du serveur.
const PAR_ID = new Map(BASSIN_DESSINS.map((d) => [d.id, d]));

export function dessinDe(id) {
  return PAR_ID.get(id) || null;
}

export function srcDeDessin(id) {
  return PAR_ID.has(id) ? `/dessins/${id}.webp` : null;
}

// Le catalogue tel que les écrans le reçoivent : chaque dessin avec son adresse.
export function catalogueDesDessins() {
  return BASSIN_DESSINS.map((d) => ({ ...d, src: srcDeDessin(d.id) }));
}

// ============================================================================
// LA BANQUE MODÉRABLE (26/09)
// ============================================================================
//
// CE QUI A ÉTÉ DEMANDÉ : « Dans Cueillette, il faut qu'on ait le même mode de
// gestion d'images que dans Cache-cache. Au cas où on aimerait rajouter ou
// modifier les images, il faut qu'on puisse gérer la banque d'images pour le
// jeu. »
//
// LE MÊME CHEMIN QUE « CACHE-CACHE », pour les mêmes raisons : la banque modérée
// est rangée dans la banque du MODULE, sous une entrée marquée — c'est ce qui la
// rend durable (la base la conserve avec les questions) sans table nouvelle.
// Sans entrée, le jeu reprend les cinquante dessins du dépôt : un compte qui n'a
// jamais ouvert la page de modération joue exactement comme avant.
//
// CE QU'UN DESSIN AJOUTÉ DOIT APPORTER, ET QUE CACHE-CACHE N'A PAS À FOURNIR : SA
// GRILLE. Le jeu compare le tracé du joueur à la cible par une grille de 64 × 64
// (voir `dessins-grilles.js`), et le serveur n'a pas de décodeur d'images — il
// n'en aura pas, c'est une règle du dépôt. La grille est donc calculée par le
// NAVIGATEUR au dépôt, avec la même règle que le script d'origine, et elle
// voyage avec la ligne. Le serveur la VÉRIFIE (taille exacte, encre présente) ;
// il ne la fabrique pas.
//
// UN DESSIN DU DÉPÔT GARDE SA GRILLE D'ORIGINE tant que son image n'est pas
// remplacée. Renommer « Chêne » ou le changer de famille ne touche pas à la
// figure : recalculer serait refaire, en moins bien, un calcul déjà juste.
export const MARQUE_CUEILLETTE = 'contenu-cueillette';

// Une grille est 64 × 64 bits : 512 octets, soit 684 caractères en base 64.
export const OCTETS_GRILLE = 512;

// UNE GRILLE RECEVABLE : la bonne taille, et de l'encre. Une grille vide
// noterait chaque joueur à zéro quoi qu'il dessine — une manche perdue pour tout
// le salon, sans que personne sache pourquoi.
export function grilleValide(b64) {
  if (typeof b64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return false;
  const octets = Buffer.from(b64, 'base64');
  if (octets.length !== OCTETS_GRILLE) return false;
  let encre = 0;
  for (const o of octets) { let v = o; while (v) { encre += v & 1; v >>= 1; } }
  // Moins de vingt cases d'encre sur quatre mille : un point, pas un dessin.
  return encre >= 20;
}

// LA FAMILLE SE SAISIT PAR SON NOM, comme on la lit : « Arbres », pas « arbres ».
// Un nom qui désigne une famille du dépôt — quelle que soit sa casse — la
// rejoint, au lieu d'ouvrir un second onglet « Arbres » à côté du premier.
function familleNormalisee(brute) {
  const t = String(brute || '').trim();
  if (!t) return 'Autres';
  const bas = t.toLowerCase();
  const connue = FAMILLES.find((f) => f.cle === bas || f.nom.toLowerCase() === bas);
  return connue ? connue.cle : t;
}

// LA BANQUE D'UN MODULE, TELLE QUE LE JEU LA JOUE : chaque dessin avec son
// adresse et sa grille. Une ligne sans grille utilisable est ÉCARTÉE — elle ne
// pourrait pas être notée. Une banque modérée entièrement inutilisable retombe
// sur celle du dépôt : un jeu en direct ne doit jamais partir sans cible.
export function banqueDeCueillette(questions, grillesDuDepot) {
  const entree = (Array.isArray(questions) ? questions : []).find((q) => q && q.kind === MARQUE_CUEILLETTE);
  const depot = BASSIN_DESSINS.map((d) => ({ ...d, src: srcDeDessin(d.id), grille: grillesDuDepot[d.id] || null }));
  if (!Array.isArray(entree?.dessins) || !entree.dessins.length) return depot.filter((d) => d.grille);
  const vus = new Set();
  const lus = [];
  for (const d of entree.dessins) {
    const id = String(d?.id || '').trim();
    const nom = String(d?.nom || '').trim();
    if (!id || !nom || vus.has(id)) continue;
    const grille = grilleValide(d.grille) ? d.grille : (grillesDuDepot[id] || null);
    const src = String(d.src || '').trim() || srcDeDessin(id);
    if (!grille || !src) continue;
    vus.add(id);
    lus.push({ id, nom, famille: familleNormalisee(d.famille), src, grille });
  }
  return lus.length ? lus : depot.filter((d) => d.grille);
}

// LES FAMILLES D'UNE BANQUE, DANS L'ORDRE OÙ ELLES APPARAISSENT. Celles du dépôt
// gardent leur nom (« arbres » → « Arbres ») ; une famille inventée au Studio est
// son propre nom. C'est ce qui fait les onglets de la console de l'animateur.
export function famillesDe(dessins) {
  const connues = new Map(FAMILLES.map((f) => [f.cle, f.nom]));
  const ordre = [];
  for (const d of dessins) if (!ordre.includes(d.famille)) ordre.push(d.famille);
  return ordre.map((cle) => ({ cle, nom: connues.get(cle) || cle }));
}
