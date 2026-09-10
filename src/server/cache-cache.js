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
import { BASSIN_OBJETS, COULEURS } from './objets.js';

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
export function construireMatrice(alea = Math.random) {
  const noms = [...new Set(BASSIN_OBJETS.map((o) => o.nom))];
  const neufNoms = melanger(noms, alea).slice(0, CASES);

  const couleurs = melanger(COULEURS, alea);
  const seule = couleurs[0];
  const parts = [];
  for (const c of couleurs) parts.push(c, ...(c === seule ? [] : [c]));

  const affectees = melanger(parts, alea);
  const parCle = new Map(BASSIN_OBJETS.map((o) => [`${o.nom}|${o.couleur}`, o]));
  return neufNoms.map((nom, i) => {
    const objet = parCle.get(`${nom}|${affectees[i]}`);
    // Un couple absent de la banque signifierait que la banque n'est plus le
    // produit cartésien annoncé. On ne bricole pas : on refuse.
    if (!objet) throw new Error(`objet introuvable : ${nom} ${affectees[i]}`);
    return { place: i + 1, id: objet.id, nom: objet.nom, couleur: objet.couleur };
  });
}

// La couleur qui n'apparaît qu'une fois — il y en a toujours exactement une.
export function couleurUnique(matrice) {
  const compte = new Map();
  for (const o of matrice) compte.set(o.couleur, (compte.get(o.couleur) || 0) + 1);
  for (const [c, n] of compte) if (n === 1) return c;
  return null;
}

// ---------------------------------------------------------------------------
// LES QUESTIONS
// ---------------------------------------------------------------------------

export const QUESTIONS_PAR_PARTIE = 5;
export const DUREE_QUESTION_MS = 10_000;

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

// LES CINQ FORMES, ET LEURS QUOTAS. Ils viennent de l'énoncé, tels quels.
export const FORMES = {
  couleur_de: { min: 1, max: 3, choix: true },
  objet_derriere: { min: 1, max: 3, choix: false },
  entre_noms: { min: 0, max: 2, choix: false },
  entre_cases: { min: 0, max: 2, choix: false },
  couleur_unique: { min: 0, max: 1, choix: true },
};
const CLES_FORMES = Object.keys(FORMES);

// Les répartitions de cinq questions qui respectent tous les quotas. Elles sont
// ÉNUMÉRÉES plutôt que tirées au petit bonheur : un tirage forme par forme finit
// coincé — trois « couleur du » et deux « derrière » remplissent le compte sans
// laisser de place aux autres, et rien ne l'aurait signalé sinon par une manche
// qui refuse de démarrer, en direct.
export function repartitionsPossibles(total = QUESTIONS_PAR_PARTIE) {
  const sorties = [];
  const marcher = (i, reste, courant) => {
    if (i === CLES_FORMES.length) { if (reste === 0) sorties.push({ ...courant }); return; }
    const cle = CLES_FORMES[i];
    const { min, max } = FORMES[cle];
    for (let n = min; n <= Math.min(max, reste); n += 1) {
      marcher(i + 1, reste - n, { ...courant, [cle]: n });
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
export function construireQuestions(matrice, alea = Math.random) {
  const parPlace = new Map(matrice.map((o) => [o.place, o]));
  const repartition = melanger(repartitionsPossibles(), alea)[0];

  const prises = new Set();       // places déjà utilisées comme RÉPONSE
  const questions = [];

  const placesLibres = () => melanger(matrice.map((o) => o.place).filter((p) => !prises.has(p)), alea);
  const pairesLibres = () => melanger(PAIRES.filter(({ paire, milieu }) => (
    !prises.has(milieu) && !prises.has(paire[0]) && !prises.has(paire[1])
  )), alea);

  const fabriques = {
    couleur_de: () => {
      const place = placesLibres()[0];
      if (place == null) return null;
      const o = parPlace.get(place);
      // Même raison : « la couleur du marteau » demande le bon article, « la
      // couleur de "Marteau" » n'en demande aucun.
      return { forme: 'couleur_de', place, texte: `Quelle est la couleur de « ${o.nom} » ?`, reponse: o.couleur };
    },
    objet_derriere: () => {
      const place = placesLibres()[0];
      if (place == null) return null;
      const o = parPlace.get(place);
      // La formulation est celle de l'énoncé : « Quel objet se cache derrière 2 ? »
      return { forme: 'objet_derriere', place, texte: `Quel objet se cache derrière ${place} ?`, reponse: o.nom };
    },
    entre_noms: () => {
      const p = pairesLibres()[0];
      if (!p) return null;
      const [a, b] = p.paire;
      const o = parPlace.get(p.milieu);
      return {
        forme: 'entre_noms',
        place: p.milieu,
        bornes: [a, b],
        // LES NOMS SE CITENT ENTRE GUILLEMETS plutôt qu'avec leur article.
        // L'énoncé écrit « entre l'ampoule et les ciseaux » ; le faire demanderait
        // de connaître le genre et le nombre des quarante noms, et un « le
        // enveloppe » à l'antenne coûterait plus que la citation ne coûte.
        texte: `Quel objet se trouve entre « ${parPlace.get(a).nom} » et « ${parPlace.get(b).nom} » ?`,
        reponse: o.nom,
      };
    },
    entre_cases: () => {
      const p = pairesLibres()[0];
      if (!p) return null;
      const [a, b] = p.paire;
      const o = parPlace.get(p.milieu);
      return {
        forme: 'entre_cases',
        place: p.milieu,
        bornes: [a, b],
        // Formulation de l'énoncé : « Quel objet se trouve entre 4 et 6 ? »
        texte: `Quel objet se trouve entre ${a} et ${b} ?`,
        reponse: o.nom,
      };
    },
    couleur_unique: () => {
      const c = couleurUnique(matrice);
      const o = matrice.find((x) => x.couleur === c);
      if (!o || prises.has(o.place)) return null;
      return {
        forme: 'couleur_unique',
        place: o.place,
        texte: "Quelle couleur n'est présente qu'une seule fois ?",
        reponse: c,
      };
    },
  };

  // LES FORMES LES PLUS CONTRAINTES D'ABORD. « La couleur unique » ne vise qu'une
  // case précise, les « entre » n'ont que huit paires : tirées en dernier, elles
  // se retrouvent sans place libre. Servies d'abord, les deux formes libres —
  // qui peuvent viser n'importe quelle case — comblent ce qui reste.
  const ordre = ['couleur_unique', 'entre_noms', 'entre_cases', 'couleur_de', 'objet_derriere'];
  for (const cle of ordre) {
    for (let i = 0; i < (repartition[cle] || 0); i += 1) {
      const q = fabriques[cle]();
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
export function tirerLaManche(alea = Math.random, essais = 40) {
  for (let i = 0; i < essais; i += 1) {
    const matrice = construireMatrice(alea);
    const questions = construireQuestions(matrice, alea);
    if (questions && questions.length === QUESTIONS_PAR_PARTIE) {
      return { matrice, questions, ordre: melanger(matrice.map((o) => o.place), alea) };
    }
  }
  return null;
}
