// « CACHE-CACHE » — LA MATRICE, LES QUESTIONS, ET CE QUI LES CONTRAINT.
//
// POURQUOI CE FICHIER EXISTE À PART. Les autres jeux tiennent en une entrée de
// `modules.js` parce que leur manche est une question et une réponse. Celle-ci
// est une SÉQUENCE : une grille qui se dévoile pendant trente-huit secondes, cinq
// questions tirées sous quotas, cinq réponses rendues une par une. Le tirage seul
// demande plus de lignes que la plupart des modules entiers.
//
// LE TIRAGE EST LA PARTIE DÉLICATE, et pas pour la raison qu'on croit. Ce n'est
// pas l'aléatoire qui est difficile, ce sont les CONTRAINTES CROISÉES : neuf noms
// distincts, cinq couleurs présentes, aucune plus de deux fois, cinq questions
// dont les quotas se répondent, et jamais deux questions sur la même image. Un
// tirage qui violerait l'une d'elles ne casse rien — il produit une manche
// injouable ou une question sans réponse, en direct.
import { BASSIN_OBJETS, BASSIN_NOIR, COULEUR_RESERVEE } from './objets.js';

// ---------------------------------------------------------------------------
// LA GRILLE
// ---------------------------------------------------------------------------

export const CASES = 9;

// LE DÉROULÉ DU DÉVOILEMENT, à la milliseconde près.
//
// « La matrice 3x3 est à l'écran des joueurs, tous les objets sont cachés, ça dure
// 3 secondes. [...] Un objet se dévoile pendant 3 secondes, puis lorsqu'il se
// cache à nouveau, le prochain objet se dévoilera 1 seconde après. »
//
// Trois secondes d'ouverture, neuf fois trois secondes de dévoilement, huit fois
// une seconde de noir : 3 + 27 + 8 = 38. L'énoncé fait le compte lui-même, et il
// tombe juste — le contrôle le refait.
export const OUVERTURE_MS = 3000;
export const DEVOILEMENT_MS = 3000;
export const NOIR_MS = 1000;
export const DUREE_GRILLE_MS = OUVERTURE_MS + CASES * DEVOILEMENT_MS + (CASES - 1) * NOIR_MS;

// L'instant où la case de rang `i` (0-indexé dans l'ordre de dévoilement)
// s'allume, puis s'éteint.
export function momentsDuDevoilement(i) {
  const debut = OUVERTURE_MS + i * (DEVOILEMENT_MS + NOIR_MS);
  return { debut, fin: debut + DEVOILEMENT_MS };
}

function melanger(liste, alea = Math.random) {
  const t = liste.slice();
  for (let i = t.length - 1; i > 0; i -= 1) {
    const j = Math.floor(alea() * (i + 1));
    [t[i], t[j]] = [t[j], t[i]];
  }
  return t;
}

// LA MATRICE DE NEUF OBJETS.
//
// DEUX RÈGLES, ET LA SECONDE A UNE CONSÉQUENCE QUE L'ÉNONCÉ REMARQUE LUI-MÊME :
//   « Chacune des 9 images doit avoir un Nom différent des autres » ;
//   « Chaque couleur doit apparaître minimum une fois et maximum deux fois. »
//
// Cinq couleurs, neuf cases, chacune une ou deux fois : la seule répartition
// possible est QUATRE COULEURS EN DOUBLE ET UNE SEULE. Il y a donc toujours,
// mécaniquement, exactement une couleur unique — c'est ce qui rend la cinquième
// forme de question (« quelle couleur n'est présente qu'une seule fois ? »)
// toujours posable et toujours sans ambiguïté. L'énoncé le dit : « normalement il
// doit y avoir 4*2 couleurs + 1 couleur ». Ce n'est pas « normalement », c'est
// forcé — et le contrôle le vérifie sur des milliers de tirages.
// LES COULEURS D'UNE BANQUE SONT CELLES QU'ELLE CONTIENT.
//
// LE DÉFAUT QUE CECI RÉPARE. La matrice tirait ses couleurs de la CONSTANTE du
// dépôt, pas de la banque reçue. L'écran de modération laissait pourtant changer
// la couleur d'un objet : la renommer « Turquoise » faisait chercher au tirage un
// couple « nom|Bleu » qui n'existait plus, les quarante essais échouaient, le
// serveur levait — et l'animateur cliquait « Lancer » sans que rien ne parte. Un
// formulaire qui accepte une valeur que le jeu ne sait pas lire est pire qu'un
// formulaire absent : il promet.
export function couleursDuBassin(bassin = BASSIN_OBJETS) {
  return [...new Set(bassin.map((o) => o.couleur).filter(Boolean))];
}

// COMBIEN DE COULEURS UNE GRILLE DE NEUF CASES ADMET-ELLE ?
//
// Chaque couleur présente une ou deux fois, les neuf cases remplies : il faut au
// moins CEIL(9/2) = 5 couleurs — quatre couleurs n'en couvrent que huit — et au
// plus 9, une par case. Entre les deux, `CASES - n` couleurs sont doublées.
//
// À CINQ COULEURS, ET SEULEMENT À CINQ, il y a exactement UNE couleur unique
// (4 doublées + 1 seule). C'est ce qui rend la question « quelle couleur n'est
// présente qu'une seule fois ? » toujours posable et sans ambiguïté. À six, il y
// en a trois ; la question n'a plus de réponse, et elle n'est plus tirée.
export const COULEURS_MIN = Math.ceil(CASES / 2);
export const COULEURS_MAX = CASES;

export function construireMatrice(alea = Math.random, bassin = BASSIN_OBJETS, mode = MODES.couleur) {
  const noms = [...new Set(bassin.map((o) => o.nom))];
  if (noms.length < CASES) return null;
  const neufNoms = melanger(noms, alea).slice(0, CASES);

  const palette = couleursDuBassin(bassin);

  // EN MODE « CLASSIQUE », IL N'Y A QU'UNE COULEUR, ET C'EST TOUT LE POINT.
  //
  // La règle « chaque couleur une ou deux fois, les cinq présentes » n'a plus
  // d'objet : elle existait pour garantir qu'une couleur soit unique, donc qu'on
  // puisse la demander. Ici on ne demande pas les couleurs. Ne reste que la
  // contrainte que le document répète — « chacune des images doit avoir un nom
  // différent » — déjà tenue par `neufNoms`.
  const caseDe = (objet, i) => (objet
    ? { place: i + 1, id: objet.id, nom: objet.nom, couleur: objet.couleur, src: objet.src || null }
    : null);

  if (mode.formes) {
    if (palette.length !== 1) return null;
    const parNom = new Map(bassin.map((o) => [o.nom, o]));
    const sortie = neufNoms.map((nom, i) => caseDe(parNom.get(nom), i));
    return sortie.some((o) => o === null) ? null : sortie;
  }

  if (palette.length < COULEURS_MIN || palette.length > COULEURS_MAX) return null;
  const couleurs = melanger(palette, alea);
  // Les `CASES - n` PREMIÈRES sont doublées ; les autres ne paraissent qu'une
  // fois. À cinq couleurs on retrouve exactement les quatre doubles et l'unique.
  const doublees = CASES - couleurs.length;
  const parts = [];
  couleurs.forEach((c, i) => parts.push(c, ...(i < doublees ? [c] : [])));

  const affectees = melanger(parts, alea);
  const parCle = new Map(bassin.map((o) => [`${o.nom}|${o.couleur}`, o]));
  // Un couple absent de la banque signifierait que la banque n'est plus le produit
  // cartésien annoncé. On ne bricole pas : on REFUSE — et le tirage recommence
  // avec d'autres noms. C'est le cas d'une banque modérée à la main où un nom
  // n'existe pas dans toutes les couleurs.
  const sortie = neufNoms.map((nom, i) => caseDe(parCle.get(`${nom}|${affectees[i]}`), i));
  return sortie.some((o) => o === null) ? null : sortie;
}

// La couleur qui n'apparaît qu'une fois — À CONDITION QU'IL N'Y EN AIT QU'UNE.
//
// Avec les cinq couleurs du dépôt, c'est toujours le cas. Avec une banque modérée
// à six couleurs ou plus, il y en a plusieurs : la question « quelle couleur n'est
// présente qu'une seule fois ? » aurait alors trois bonnes réponses et une seule
// acceptée. On rend `null`, la question n'est pas fabriquée, et le tirage se
// rabat sur une autre répartition — plutôt que de poser une question truquée.
export function couleurUnique(matrice) {
  const compte = new Map();
  for (const o of matrice) compte.set(o.couleur, (compte.get(o.couleur) || 0) + 1);
  const seules = [...compte].filter(([, n]) => n === 1);
  return seules.length === 1 ? seules[0][0] : null;
}

// ---------------------------------------------------------------------------
// LES QUESTIONS
// ---------------------------------------------------------------------------

export const QUESTIONS_PAR_PARTIE = 5;

// SEIZE SECONDES PAR QUESTION, et non plus dix (séance du 11/09).
//
// « Le temps pour répondre aux questions est actuellement de 10sec, on passe
// maintenant à 16sec. »
//
// LA COURBE DE RAPIDITÉ SUIT, ET IL LE FAUT. Ses seuils sont des secondes
// RESTANTES : avec un plateau à 9 s sur une fenêtre de 16, les sept premières
// secondes vaudraient toutes le maximum et la moitié du jeu ne se jouerait plus.
// On garde donc la FORME de la courbe — un plateau court en tête, un plancher de
// deux secondes en queue — en la reportant sur la nouvelle fenêtre.
export const DUREE_QUESTION_MS = 16_000;

// LES PAIRES ALIGNÉES, telles que l'énoncé les donne — et la case qu'elles
// encadrent. Ce sont les seules paires admises pour les deux questions « entre » :
// une paire quelconque n'a pas de « milieu », et la question n'aurait pas de
// réponse.
export const PAIRES = [
  { paire: [1, 3], milieu: 2 },
  { paire: [1, 7], milieu: 4 },
  { paire: [1, 9], milieu: 5 },
  { paire: [2, 8], milieu: 5 },
  { paire: [3, 9], milieu: 6 },
  { paire: [3, 7], milieu: 5 },
  { paire: [4, 6], milieu: 5 },
  { paire: [7, 9], milieu: 8 },
];

// LE CONTENU MODÉRABLE DE « CACHE-CACHE ».
//
// CE QUI A ÉTÉ DEMANDÉ (séance du 11/09) :
//   « il faudrait que j'aie accès aux questions possibles [...] Je dois pouvoir
//     voir, modifier et créer : la question avec ses variables [...] le nombre
//     d'apparitions minimum et maximum de la question par manche » ;
//   « il faudrait que j'aie accès dans le studio à la base de données des images
//     [...] l'image (et son ID), son Nom et sa Couleur. Il faut que je puisse
//     modifier les informations et ajouter de nouvelle ligne. »
//
// OÙ CE CONTENU EST RANGÉ, ET POURQUOI PAS AILLEURS. Il vit dans la BANQUE DU
// MODULE — le champ `questions` de sa ligne, jusqu'ici inutilisé puisque ce jeu
// se prépare à l'antenne. Trois conséquences, toutes voulues :
//   - il est durable du jour au lendemain, sans table nouvelle : il emprunte le
//     chemin de persistance des modules, qui va en base ;
//   - il s'enregistre par LE BOUTON « ENREGISTRER » du Studio, et par lui seul —
//     c'est la règle posée par l'auteur ;
//   - il appartient à l'animateur : deux comptes peuvent nommer leurs objets
//     autrement sans se marcher dessus.
//
// CE QU'ON NE PEUT PAS MODÉRER, ET IL FAUT LE DIRE : la FORME d'une question.
// « Quelle est la couleur de … » et « derrière quel numéro … » ne diffèrent pas
// par leur texte mais par ce que le serveur doit calculer — la bonne réponse, la
// liste de choix, la case à dévoiler. On peut donc réécrire l'énoncé d'une forme,
// changer ses quotas, en ajouter une variante, la désactiver ; on ne peut pas
// inventer une forme sans code.
export const MARQUE_CONTENU = 'contenu-cache';

// ---------------------------------------------------------------------------
// LES DEUX MODES DE « CACHE-CACHE »
// ---------------------------------------------------------------------------
//
// CE QUI A ÉTÉ DEMANDÉ (12/09) : « Nous avons actuellement le jeu qui est super
// avec des couleurs. Appelons ce mode : le mode "Couleur", ce sera le mode
// difficile du jeu. » Et pour le nouveau : « des images uniquement de couleur
// noir […] chacune des images doit avoir un nom différent », « on ne peut pas
// poser de questions liées aux couleurs », et, en capitales : « les nouvelles
// images de couleur noir ne doivent PAS être utilisées dans le mode Couleur ».
//
// UN MODE N'EST PAS UN JEU DIFFÉRENT : même grille, même déroulé, même barème.
// Ce qui change tient en deux lignes — quelles images entrent dans la matrice, et
// quelles formes de questions ont encore un sens. On les déclare donc ICI, à côté
// l'une de l'autre, plutôt que d'éparpiller des « si classique » dans le tirage.
//
// LA RÈGLE NÉGATIVE EST LA PLUS DANGEREUSE des deux : une icône noire qui se
// glisserait dans une manche « Couleur » ne casserait rien, ne lèverait rien, et
// rendrait simplement la question de couleur absurde — à l'antenne. Elle a son
// contrôle, sur des milliers de tirages, dans les deux sens.
// L'ORDRE DE CETTE TABLE EST CELUI DU PANNEAU DE L'ANIMATEUR.
//
// « Il faudrait que le mode "Classique" soit le premier proposé et le mode
// "Couleur" le second proposé, il faut juste intervertir leurs positions. »
// Classique est donc écrit en premier. La SÉLECTION par défaut, elle, ne change
// pas — l'auteur a demandé d'intervertir des positions, pas de changer le mode
// qui part quand on ne touche à rien.
export const MODES = {
  classique: {
    cle: 'classique',
    nom: 'Classique',
    sous: 'Neuf objets, sans couleur',
    difficile: false,
    // Les noires, et elles seules.
    admet: (o) => o.couleur === COULEUR_RESERVEE,
    // AUCUNE QUESTION DE COULEUR. Les quatre formes que le document énumère —
    // et c'est bien une liste blanche : une forme ajoutée plus tard ne doit pas
    // se retrouver ici par défaut sans qu'on ait décidé qu'elle y a sa place.
    formes: ['objet_derriere', 'numero_de', 'entre_noms', 'entre_cases'],
  },
  couleur: {
    cle: 'couleur',
    nom: 'Couleur',
    sous: 'Neuf objets, cinq couleurs',
    // Le mode difficile : la couleur est une information de plus à retenir.
    difficile: true,
    // Toutes les images SAUF les noires.
    admet: (o) => o.couleur !== COULEUR_RESERVEE,
    // Toutes les formes de questions.
    formes: null,
  },
};
export const MODE_PAR_DEFAUT = 'couleur';
export function modeDe(cle) {
  return MODES[cle] || MODES[MODE_PAR_DEFAUT];
}

// LES GABARITS PAR DÉFAUT — la formulation d'origine de chaque forme, et ses
// quotas. Les accolades sont des VARIABLES, remplies au tirage.
export const GABARITS_PAR_DEFAUT = [
  { id: 'g-couleur', forme: 'couleur_de', gabarit: 'Quelle est la couleur de « {objet} » ?', min: 1, max: 3, actif: true },
  { id: 'g-derriere', forme: 'objet_derriere', gabarit: 'Quel objet se cache derrière {case} ?', min: 1, max: 3, actif: true },
  { id: 'g-numero', forme: 'numero_de', gabarit: 'Derrière quel numéro se cache « {objet} » ?', min: 1, max: 3, actif: true },
  { id: 'g-entre-noms', forme: 'entre_noms', gabarit: 'Quel objet se trouve entre « {objetA} » et « {objetB} » ?', min: 0, max: 2, actif: true },
  { id: 'g-entre-cases', forme: 'entre_cases', gabarit: 'Quel objet se trouve entre {caseA} et {caseB} ?', min: 0, max: 2, actif: true },
  { id: 'g-couleur-unique', forme: 'couleur_unique', gabarit: "Quelle couleur n'est présente qu'une seule fois ?", min: 0, max: 1, actif: true },
];

// LES VARIABLES ADMISES PAR FORME — ce que le Studio propose, et ce que le
// tirage sait remplir. Une accolade inconnue reste telle quelle : mieux vaut une
// question visiblement fautive qu'une question silencieusement fausse.
// COMMENT UNE FORME S'APPELLE DEVANT L'ANIMATEUR. `couleur_de` est un nom de
// code : lisible par le serveur, illisible dans un formulaire. Le libellé est
// déclaré ICI, à côté de la forme, et non côté Studio — une forme ajoutée sans
// son libellé se verrait immédiatement, au lieu de sortir « undefined » à
// l'écran. Un contrôle unitaire exige qu'elles en aient toutes un.
export const LIBELLES_PAR_FORME = {
  couleur_de: "La couleur d'un objet",
  objet_derriere: "L'objet derrière un numéro",
  numero_de: "Le numéro d'un objet",
  entre_noms: 'L\'objet entre deux objets',
  entre_cases: "L'objet entre deux numéros",
  couleur_unique: 'La couleur présente une seule fois',
};

export const VARIABLES_PAR_FORME = {
  couleur_de: ['{objet}'],
  objet_derriere: ['{case}'],
  numero_de: ['{objet}'],
  entre_noms: ['{objetA}', '{objetB}'],
  entre_cases: ['{caseA}', '{caseB}'],
  couleur_unique: [],
};

// Le contenu d'un module, lu dans sa banque — avec repli sur les valeurs du dépôt.
export function contenuDeLaBanque(questions) {
  const entree = (Array.isArray(questions) ? questions : []).find((q) => q && q.kind === MARQUE_CONTENU);
  return {
    gabarits: Array.isArray(entree?.gabarits) && entree.gabarits.length ? entree.gabarits : GABARITS_PAR_DEFAUT,
    objets: Array.isArray(entree?.objets) && entree.objets.length ? entree.objets : null,
  };
}

// LES SIX FORMES, ET LEURS QUOTAS. Ils viennent de l'énoncé, tels quels.
//
// `choix` DIT DANS QUELLE LISTE ON RÉPOND, et non plus seulement « y a-t-il une
// liste ». Deux listes existent : les cinq couleurs, et les neuf numéros de case
// — cette seconde est arrivée avec la question « derrière quel numéro se cache
// … ? » (séance du 11/09). Un booléen n'aurait pas pu les distinguer.
export const FORMES = {
  couleur_de: { min: 1, max: 3, choix: 'couleurs' },
  objet_derriere: { min: 1, max: 3, choix: null },
  numero_de: { min: 1, max: 3, choix: 'cases' },
  entre_noms: { min: 0, max: 2, choix: null },
  entre_cases: { min: 0, max: 2, choix: null },
  couleur_unique: { min: 0, max: 1, choix: 'couleurs' },
};

// Les neuf numéros, tels qu'ils s'affichent en choix de réponse.
export const NUMEROS = Array.from({ length: CASES }, (_, i) => String(i + 1));
const CLES_FORMES = Object.keys(FORMES);

// Les répartitions de cinq questions qui respectent tous les quotas. Elles sont
// ÉNUMÉRÉES plutôt que tirées au petit bonheur : un tirage forme par forme finit
// coincé — trois « couleur du » et deux « derrière » remplissent le compte sans
// laisser de place aux autres, et rien ne l'aurait signalé sinon par une manche
// qui refuse de démarrer, en direct.
export function repartitionsPossibles(total = QUESTIONS_PAR_PARTIE, gabarits = GABARITS_PAR_DEFAUT) {
  // LES QUOTAS VIENNENT DES GABARITS, pas des formes : c'est ce que l'animateur
  // règle au Studio. Un gabarit éteint ne compte pour rien.
  const actifs = gabarits.filter((g) => g.actif !== false && FORMES[g.forme]);
  const sorties = [];
  const marcher = (i, reste, courant) => {
    if (i === actifs.length) { if (reste === 0) sorties.push({ ...courant }); return; }
    const g = actifs[i];
    const min = Math.max(0, Number(g.min) || 0);
    const max = Math.max(min, Number(g.max) || 0);
    for (let n = min; n <= Math.min(max, reste); n += 1) {
      marcher(i + 1, reste - n, { ...courant, [g.id]: n });
    }
  };
  marcher(0, total, {});
  return sorties;
}

// ---------------------------------------------------------------------------
// LA COMPARAISON DES RÉPONSES ÉCRITES
// ---------------------------------------------------------------------------

// « Réponse du joueur doit être égal au Nom de l'image (sans prendre en compte
// les majuscules et les accents). »
//
// ON VA UN PEU PLUS LOIN, ET IL FAUT LE DIRE : tout ce qui n'est pas une lettre ou
// un chiffre est retiré, et un article de tête est ignoré. « T-shirt », « t
// shirt » et « tshirt » désignent la même chose ; « la clé à molette » et « clé a
// molette » aussi. Refuser ces réponses-là ne mesurerait pas la mémoire du
// joueur mais sa dactylographie, sur un téléphone, en dix secondes.
const ARTICLES = ['le', 'la', 'les', 'l', 'un', 'une', 'des', 'du', 'de'];
export function normaliserReponse(texte) {
  const brut = String(texte == null ? '' : texte)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim();
  const mots = brut.split(/[^a-z0-9]+/).filter(Boolean);
  while (mots.length > 1 && ARTICLES.includes(mots[0])) mots.shift();
  return mots.join('');
}

export function memeNom(reponse, nom) {
  const a = normaliserReponse(reponse);
  return a.length > 0 && a === normaliserReponse(nom);
}

// ---------------------------------------------------------------------------
// LE TIRAGE DES CINQ QUESTIONS
// ---------------------------------------------------------------------------
//
// CE QUI EST INTERDIT, ET POURQUOI :
//   - deux questions dont la RÉPONSE est la même image. L'énoncé l'écrit forme par
//     forme (« jamais sur la même image ») ; on l'applique à l'ensemble, parce que
//     deux formes différentes peuvent viser la même case — « quel objet se cache
//     derrière 5 » et « quel objet se trouve entre 4 et 6 » ont la même réponse ;
//   - deux paires « entre » qui encadrent la même case, pour la même raison :
//     quatre des huit paires admises encadrent toutes la case 5.
export function construireQuestions(matrice, alea = Math.random, gabarits = GABARITS_PAR_DEFAUT) {
  const parPlace = new Map(matrice.map((o) => [o.place, o]));
  const actifs = gabarits.filter((g) => g.actif !== false && FORMES[g.forme]);
  const repartition = melanger(repartitionsPossibles(QUESTIONS_PAR_PARTIE, gabarits), alea)[0];
  if (!repartition) return null;

  const prises = new Set();       // places déjà utilisées comme RÉPONSE
  const questions = [];

  const placesLibres = () => melanger(matrice.map((o) => o.place).filter((p) => !prises.has(p)), alea);
  const pairesLibres = () => melanger(PAIRES.filter(({ paire, milieu }) => (
    !prises.has(milieu) && !prises.has(paire[0]) && !prises.has(paire[1])
  )), alea);

  // LE TEXTE VIENT DU GABARIT, LES VALEURS DU TIRAGE. Une variable inconnue reste
  // écrite telle quelle : mieux vaut une question visiblement fautive — que
  // l'animateur voit et corrige — qu'une question silencieusement fausse.
  const ecrire = (gabarit, valeurs) => String(gabarit || '').replace(/\{(\w+)\}/g, (tout, cle) => (
    Object.prototype.hasOwnProperty.call(valeurs, cle) ? valeurs[cle] : tout
  ));

  const fabriques = {
    couleur_de: (g) => {
      const place = placesLibres()[0];
      if (place == null) return null;
      const o = parPlace.get(place);
      return { forme: 'couleur_de', place, texte: ecrire(g.gabarit, { objet: o.nom }), reponse: o.couleur };
    },
    objet_derriere: (g) => {
      const place = placesLibres()[0];
      if (place == null) return null;
      const o = parPlace.get(place);
      return { forme: 'objet_derriere', place, texte: ecrire(g.gabarit, { case: place }), reponse: o.nom };
    },
    // « Derrière quel numéro se cache … ? » — l'inverse exact de « quel objet se
    // cache derrière <n> ? ». La même paire objet/case, lue dans l'autre sens.
    numero_de: (g) => {
      const place = placesLibres()[0];
      if (place == null) return null;
      const o = parPlace.get(place);
      return { forme: 'numero_de', place, texte: ecrire(g.gabarit, { objet: o.nom }), reponse: String(place) };
    },
    entre_noms: (g) => {
      const p = pairesLibres()[0];
      if (!p) return null;
      const [a, b] = p.paire;
      const o = parPlace.get(p.milieu);
      return {
        forme: 'entre_noms', place: p.milieu, bornes: [a, b],
        texte: ecrire(g.gabarit, { objetA: parPlace.get(a).nom, objetB: parPlace.get(b).nom }),
        reponse: o.nom,
      };
    },
    entre_cases: (g) => {
      const p = pairesLibres()[0];
      if (!p) return null;
      const [a, b] = p.paire;
      const o = parPlace.get(p.milieu);
      return {
        forme: 'entre_cases', place: p.milieu, bornes: [a, b],
        texte: ecrire(g.gabarit, { caseA: a, caseB: b }),
        reponse: o.nom,
      };
    },
    couleur_unique: (g) => {
      const c = couleurUnique(matrice);
      const o = matrice.find((x) => x.couleur === c);
      if (!o || prises.has(o.place)) return null;
      return { forme: 'couleur_unique', place: o.place, texte: ecrire(g.gabarit, {}), reponse: c };
    },
  };

  // LES FORMES LES PLUS CONTRAINTES D'ABORD. « La couleur unique » ne vise qu'une
  // case précise, les « entre » n'ont que huit paires : tirées en dernier, elles
  // se retrouvent sans place libre. Servies d'abord, les deux formes libres —
  // qui peuvent viser n'importe quelle case — comblent ce qui reste.
  const rang = { couleur_unique: 0, entre_noms: 1, entre_cases: 2, couleur_de: 3, numero_de: 4, objet_derriere: 5 };
  const ordonnes = [...actifs].sort((a, b) => (rang[a.forme] ?? 9) - (rang[b.forme] ?? 9));
  for (const g of ordonnes) {
    for (let i = 0; i < (repartition[g.id] || 0); i += 1) {
      const q = fabriques[g.forme](g);
      // Un tirage qui n'aboutit pas est REJETÉ EN BLOC plutôt que rapiécé : une
      // manche à quatre questions serait une manche fausse, et silencieuse.
      if (!q) return null;
      prises.add(q.place);
      if (q.bornes) { prises.add(q.bornes[0]); prises.add(q.bornes[1]); }
      questions.push(q);
    }
  }
  return melanger(questions, alea);
}

// Le tirage complet d'une manche, contraintes comprises. Il réessaie plutôt que
// de rendre une manche bancale — et il s'arrête plutôt que de tourner sans fin.
export function tirerLaManche(alea = Math.random, contenu = {}, essais = 40, cleDuMode = MODE_PAR_DEFAUT) {
  const mode = modeDe(cleDuMode);

  // LE MODE DÉCOUPE LA BANQUE, ET C'EST LE SEUL ENDROIT OÙ IL LE FAIT.
  //
  // La banque de l'animateur porte les deux tranches côte à côte — les images en
  // couleur et les noires — parce qu'il n'a qu'une page à modérer. Le partage se
  // fait ICI, au tirage, plutôt qu'au rangement : deux listes séparées auraient
  // fini par diverger, et c'est la règle « les images noires ne servent JAMAIS au
  // mode Couleur » qui en aurait souffert en silence.
  const toutes = Array.isArray(contenu.objets) && contenu.objets.length ? contenu.objets : BASSIN_OBJETS;
  const noirs = Array.isArray(contenu.objets) && contenu.objets.length ? contenu.objets : BASSIN_NOIR;
  const bassin = (mode.formes ? noirs : toutes).filter(mode.admet);

  const tousLesGabarits = Array.isArray(contenu.gabarits) && contenu.gabarits.length
    ? contenu.gabarits : GABARITS_PAR_DEFAUT;
  // LES FORMES AUTORISÉES SONT UNE LISTE BLANCHE. En « Classique », toute question
  // qui porte sur la couleur est écartée — non pas parce qu'elle serait fausse,
  // mais parce qu'elle n'aurait qu'UNE réponse possible, la même à chaque fois.
  const gabarits = mode.formes
    ? tousLesGabarits.filter((g) => mode.formes.includes(g.forme))
    : tousLesGabarits;

  for (let i = 0; i < essais; i += 1) {
    const matrice = construireMatrice(alea, bassin, mode);
    if (!matrice) continue;
    const questions = construireQuestions(matrice, alea, gabarits);
    if (questions && questions.length === QUESTIONS_PAR_PARTIE) {
      // LA PALETTE VOYAGE AVEC LA MANCHE. Sans elle, les boutons proposés au
      // joueur seraient ceux du dépôt alors que la bonne réponse serait celle de
      // la banque modérée : une question sans réponse possible.
      return {
        matrice,
        questions,
        mode: mode.cle,
        couleurs: couleursDuBassin(bassin),
        ordre: melanger(matrice.map((o) => o.place), alea),
      };
    }
  }
  return null;
}
