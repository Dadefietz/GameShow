// Les 4 modules de lancement. Chaque module est INDÉPENDANT (modularité, USER-NEEDS M4/M5).
// Interface commune :
//   meta: { type, name, icon, color, scored, malus }
//     scored: le module alimente points/série (false = participation seule, ex. vote)
//     malus:  HÉRITÉ, PLUS UTILISÉ — plus aucune pénalité dans aucun jeu (T1).
//     vitesse: la rapidité est-elle récompensée sur ce module ?
//             VRAI pour le quiz et le vrai/faux, où répondre vite prouve qu'on
//             savait. FAUX pour l'estimation, dont la précision est le seul sujet
//             et où récompenser la vitesse rouvrirait le défaut corrigé en
//             action 13 ; FAUX pour le vote, où l'on ne devine pas plus vite ce
//             que pense la salle — et où la prime pousserait à cliquer avant
//             d'avoir lu.
//   buildRound(question) -> runtime
//   publicQuestion(runtime) -> payload envoyé aux joueurs / stream (jamais la bonne réponse)
//   validateAnswer(runtime, value) -> valeur normalisée ou null si invalide
//   score(runtime) -> { results: Map<playerId, { base, speed, correct }>, reveal: {...} }
//     base  : points de la bonne réponse, indépendants de la rapidité
//     speed : complément de vitesse, 0 si la réponse est fausse
//     reveal contient la bonne réponse ET stats (répartition des réponses, diffusée
//     à l'animateur + page stream à la fin du chrono).
// Le SERVEUR est autoritaire : il ne reçoit que des réponses, jamais des scores.

const BASE_POINTS = 1000;

// GRAMMAIRE DE SCORE, commune aux quatre modules (PLAN-CHANTIER T2) :
//   points = BASE + COMPLÉMENT DE VITESSE
// Rien d'autre. Aucune pénalité nulle part (T1), et la série ne rapporte plus
// rien : elle est suivie et affichée, mais comme une information (T3).
//
// Les totaux du quiz et du vrai/faux sont EXACTEMENT ceux d'avant : la formule
// valait déjà 700 + 300 × rapidité, mais présentait le tout comme une seule
// « base », si bien que l'écran du joueur annonçait un « bonus vitesse » alors
// que la vitesse agissait déjà, invisible, dans la ligne du dessus. On ne change
// pas le calcul, on cesse de le cacher.
const BASE_BONNE_REPONSE = 700;
// CHANTIER v4, décision 4.1 : de 300 à 250. Motif donné en réunion — « équilibrer
// le score par rapport à la base de 700 points ». Le maximum d'une manche de quiz
// tombe ainsi de 1150 à 950, le supplément du plus rapide étant supprimé (4.2).
const COMPLEMENT_VITESSE_MAX = 250;

// Part de la durée restant au moment de la réponse : 1 (immédiate) -> 0 (dernière seconde).
function fractionRestante(runtime, answeredAt) {
  const total = runtime.durationMs;
  const elapsed = Math.min(Math.max(answeredAt - runtime.startedAt, 0), total);
  return total > 0 ? 1 - elapsed / total : 1;
}

// Complément de vitesse d'une bonne réponse : 0 à 250 points selon la rapidité.
function complementVitesse(runtime, answeredAt) {
  return Math.round(COMPLEMENT_VITESSE_MAX * fractionRestante(runtime, answeredAt));
}

// PALIERS DE PRÉCISION DE L'ESTIMATION (action 13).
//
// L'ancienne échelle était linéaire et plate : sur une cible de 100, répondre
// exactement rapportait à peine 11 % de plus que répondre 90. Pire, la vitesse
// pesait plus lourd que la justesse — une réponse exacte mais tardive valait 850
// quand une réponse à 10 % près mais immédiate en valait 900. Le plus juste
// perdait contre le plus rapide, l'inverse de ce que le module prétend mesurer.
// Et l'écart étant relatif à la cible, tout le monde se tassait au maximum sur
// les grands nombres : c'est la « base bloquée » constatée en test.
//
// Désormais : des valeurs FIXES par palier, et AUCUNE composante de rapidité.
// Se presser ne prouve rien sur une estimation ; seule la justesse décide.
// Les paliers étant discrets, aucune réponse d'un palier inférieur ne peut
// approcher un palier supérieur — propriété vérifiée par les tests.
const PALIERS_ESTIMATION = [
  { nom: 'mille',    ecartMax: 0.02, points: 1000 },
  { nom: 'proche',   ecartMax: 0.10, points: 750 },
  { nom: 'correct',  ecartMax: 0.20, points: 500 },
  { nom: 'loin',     ecartMax: 0.30, points: 250 },
];
// Tolérance ABSOLUE, en plus de la tolérance relative : sur une cible de 3, dix
// pour cent valent trois dixièmes, si bien que seul le nombre exact entrerait
// dans le premier palier et que répondre 4 tomberait déjà à 33 % d'écart. Être à
// une unité près compte donc comme le meilleur palier, sans rien changer aux
// grands nombres.
const TOLERANCE_ABSOLUE = 1;

// PALIERS DES ANNÉES (chantier v4, décision 5.8).
//
// POURQUOI UN SECOND JEU. Un pourcentage n'a aucun sens sur une année : 2 % de
// 1789 valent TRENTE-SIX ANS. Répondre 1753 tombait donc « dans le mille » et
// rapportait 1000 points — le premier palier était trois fois plus large que le
// siècle. La tolérance absolue d'une unité ne change rien à cette échelle.
// Ici les écarts sont ABSOLUS, en années, comme on les compte réellement.
const PALIERS_ANNEE = [
  { nom: 'mille',    ecartMax: 0,  points: 1000 },
  { nom: 'proche',   ecartMax: 2,  points: 750 },
  { nom: 'correct',  ecartMax: 5,  points: 500 },
  { nom: 'loin',     ecartMax: 10, points: 250 },
];

// DÉCISION 5.3 — le plus proche marque, même si personne n'est dans une plage.
// Sans lui, une manche où tout le monde vise trop large ne rapporte rien à
// personne : le module devient muet.
const BONUS_PLUS_PROCHE = 400;
// DÉCISION 5.5 — l'exactitude, que les paliers ne distinguent pas : sur une cible
// de 1000, répondre 1000 ou 1015 rapporte le même palier.
const BONUS_EXACTITUDE = 200;

const HORS = { nom: 'hors', ecartMax: Infinity, points: 0 };

// DÉCISION 5.9 — la nature est DÉCLARÉE à la création de la question, jamais
// devinée de la valeur : 1789 peut être un nombre d'habitants.
// DÉCISION 5.10 — sans nature déclarée, on reste en plages relatives : c'est le
// comportement d'aujourd'hui, donc aucune migration des questions existantes.
function palierEstimation(valeur, cible, nature) {
  const ecartAbsolu = Math.abs(valeur - cible);
  if (nature === 'annee') {
    return PALIERS_ANNEE.find((p) => ecartAbsolu <= p.ecartMax) || HORS;
  }
  if (ecartAbsolu <= TOLERANCE_ABSOLUE) return PALIERS_ESTIMATION[0];
  const ecart = ecartAbsolu / Math.max(Math.abs(cible), 1);
  return PALIERS_ESTIMATION.find((p) => ecart <= p.ecartMax) || HORS;
}

// Histogramme de répartition numérique, en 8 tranches (maquette A5).
//
// Les bornes écartent les valeurs extrêmes dès que l'effectif le permet : sans
// ça, un joueur qui tape un nombre absurde étire l'échelle et écrase tout le
// monde dans une seule barre. Les aberrantes ne disparaissent pas pour autant —
// elles sont RAMENÉES dans la barre d'extrémité, donc toujours comptées.
// La cible est incluse dans les bornes, pour qu'on voie toujours où tombe la
// vérité par rapport au groupe.
const TRANCHES = 8;

export function histogrammeNumerique(values, cible, tranches = TRANCHES) {
  if (!values.length) return null;
  const tries = [...values].sort((a, b) => a - b);

  // Bornes par ÉCART INTERQUARTILE plutôt que par centiles : avec six réponses,
  // écarter « les 10 % du haut » n'écarte personne, et l'aberrante reste dans
  // l'échelle. La règle des quartiles, elle, tient sur un petit effectif — ce qui
  // est le cas courant d'une soirée autour du feu.
  let bas = tries[0];
  let haut = tries[tries.length - 1];
  if (tries.length >= 4) {
    const quartile = (p) => tries[Math.min(tries.length - 1, Math.floor(p * (tries.length - 1)))];
    const q1 = quartile(0.25);
    const q3 = quartile(0.75);
    const interquartile = q3 - q1;
    const limiteBasse = q1 - 1.5 * interquartile;
    const limiteHaute = q3 + 1.5 * interquartile;
    const dedans = tries.filter((v) => v >= limiteBasse && v <= limiteHaute);
    if (dedans.length) { bas = dedans[0]; haut = dedans[dedans.length - 1]; }
  }

  let min = Math.min(bas, cible);
  let max = Math.max(haut, cible);
  if (min === max) { min -= 1; max += 1; } // tout le monde d'accord : une échelle quand même
  const pas = (max - min) / tranches;

  const indice = (v) => Math.min(tranches - 1, Math.max(0, Math.floor((v - min) / pas)));
  const counts = new Array(tranches).fill(0);
  for (const v of values) counts[indice(v)] += 1;

  return { min, max, pas, counts, cibleIndex: indice(cible) };
}

// LES PLAGES DU BARÈME, EN VALEURS ABSOLUES, POUR LES DEUX HISTOGRAMMES.
//
// CE QUI MANQUAIT À L'ÉCRAN. Les barres se lisaient sans échelle : ni les valeurs
// que chaque tranche recouvre, ni où tombe la bonne réponse, ni jusqu'où il
// fallait viser pour marquer. Un graphique sans axe ne dit rien de ce qu'il
// montre — l'animateur commentait des rectangles.
//
// POURQUOI C'EST LE SERVEUR QUI LES CALCULE. Les bornes sont celles du BARÈME :
// `PALIERS_ESTIMATION` en relatif, `PALIERS_ANNEE` en absolu, et la tolérance
// d'une unité qui élargit le premier palier sur les petites cibles. Les recopier
// dans deux écrans, c'est garantir qu'ils finiront par annoncer une plage que le
// barème ne récompense plus — le même piège que la double définition du « plus
// proche » (décision 6.1). Un seul calcul, ici, à côté des constantes.
export function plagesEstimation(cible, nature) {
  const paliers = nature === 'annee' ? PALIERS_ANNEE : PALIERS_ESTIMATION;
  return paliers.map((p) => {
    // Même règle que `palierEstimation` : en relatif, la tolérance absolue d'une
    // unité l'emporte quand elle est plus large que le pourcentage.
    const demi = nature === 'annee'
      ? p.ecartMax
      : Math.max(p.ecartMax * Math.abs(cible), TOLERANCE_ABSOLUE);
    return {
      nom: p.nom,
      points: p.points,
      // L'étiquette telle qu'elle doit s'écrire à l'antenne : « ± 10 % » n'a pas
      // de sens sur une année, « ± 2 ans » n'en a pas sur un nombre d'habitants.
      libelle: nature === 'annee'
        ? (p.ecartMax === 0 ? 'exact' : `± ${p.ecartMax} ans`)
        : `± ${Math.round(p.ecartMax * 100)} %`,
      bas: cible - demi,
      haut: cible + demi,
    };
  });
}

// Répartition des réponses sur des options indexées (quiz, vote) ou binaires (vrai/faux).
function tallyOptions(runtime, size) {
  const tally = new Array(size).fill(0);
  for (const [, a] of runtime.answers) tally[Number(a.value)] += 1;
  return tally;
}

export const modules = {
  quiz: {
    meta: { type: 'quiz', name: 'Quiz', icon: 'help-circle', color: 'primary', scored: true, malus: true, vitesse: true },
    buildRound(q) {
      return {
        type: 'quiz',
        questionId: q.id,
        text: q.text,
        options: q.options,
        correctIndex: q.correctIndex,
        durationMs: (q.durationSec || 20) * 1000,
      };
    },
    publicQuestion(rt) {
      return { type: 'quiz', questionId: rt.questionId, text: rt.text, options: rt.options };
    },
    validateAnswer(rt, value) {
      const i = Number(value);
      return Number.isInteger(i) && i >= 0 && i < rt.options.length ? i : null;
    },
    score(rt) {
      const results = new Map();
      for (const [pid, a] of rt.answers) {
        const correct = a.value === rt.correctIndex;
        results.set(pid, {
          base: correct ? BASE_BONNE_REPONSE : 0,
          speed: correct ? complementVitesse(rt, a.at) : 0,
          correct,
        });
      }
      const stats = { kind: 'options', options: rt.options, tally: tallyOptions(rt, rt.options.length), total: rt.answers.size };
      return { results, reveal: { correctIndex: rt.correctIndex, text: rt.text, options: rt.options, stats } };
    },
  },

  true_false: {
    meta: { type: 'true_false', name: 'Vrai / Faux', icon: 'check-square', color: 'forest', scored: true, malus: true, vitesse: true },
    buildRound(q) {
      return {
        type: 'true_false',
        questionId: q.id,
        text: q.text,
        correct: !!q.correct,
        durationMs: (q.durationSec || 12) * 1000,
      };
    },
    publicQuestion(rt) {
      return { type: 'true_false', questionId: rt.questionId, text: rt.text };
    },
    validateAnswer(rt, value) {
      if (value === true || value === false) return value;
      if (value === 'true' || value === 'false') return value === 'true';
      return null;
    },
    score(rt) {
      const results = new Map();
      let vrai = 0;
      for (const [pid, a] of rt.answers) {
        if (a.value === true) vrai += 1;
        const correct = a.value === rt.correct;
        results.set(pid, {
          base: correct ? BASE_BONNE_REPONSE : 0,
          speed: correct ? complementVitesse(rt, a.at) : 0,
          correct,
        });
      }
      const stats = { kind: 'options', options: ['Vrai', 'Faux'], tally: [vrai, rt.answers.size - vrai], total: rt.answers.size };
      return { results, reveal: { correct: rt.correct, text: rt.text, stats } };
    },
  },

  estimation: {
    meta: { type: 'estimation', name: 'Estimation', icon: 'target', color: 'flame', scored: true, malus: false, vitesse: false },
    buildRound(q) {
      return {
        type: 'estimation',
        questionId: q.id,
        text: q.text,
        target: Number(q.target),
        // DÉCISION 5.7 — la nature de la réponse, déclarée à la création dans le
        // Studio. Deux jeux de plages : relatives pour un nombre, ABSOLUES pour
        // une année. Sans déclaration, on reste en relatif (décision 5.10) : les
        // questions existantes gardent leur comportement, aucune migration.
        nature: q.nature === 'annee' ? 'annee' : 'nombre',
        durationMs: (q.durationSec || 20) * 1000,
      };
    },
    publicQuestion(rt) {
      return { type: 'estimation', questionId: rt.questionId, text: rt.text };
    },
    validateAnswer(rt, value) {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    },
    score(rt) {
      // Points par PALIER de précision, valeur fixe, aucune composante de vitesse.
      // « Correct » (pour la série) = les deux meilleurs paliers, soit à moins de
      // 10 % de la cible — le seuil d'avant, inchangé.
      const results = new Map();
      const values = [];
      let closest = null;
      // DÉCISIONS 5.3, 5.4 et 6.1 — on désigne LES JOUEURS les plus proches, pas
      // seulement la valeur. Un seul calcul sert au bonus et à l'affichage du nom
      // chez l'animateur : deux définitions du « plus proche » finiraient par
      // diverger.
      let ecartMini = Infinity;
      let plusProches = [];
      const nature = rt.nature === 'annee' ? 'annee' : 'nombre';

      for (const [pid, a] of rt.answers) {
        values.push(a.value);
        const palier = palierEstimation(a.value, rt.target, nature);
        const ecart = Math.abs(a.value - rt.target);
        // DÉCISION 5.5 — l'exactitude s'ajoute AUX points de la plage.
        const exact = ecart === 0;
        results.set(pid, {
          base: palier.points + (exact ? BONUS_EXACTITUDE : 0),
          speed: 0,
          correct: nature === 'annee' ? palier.ecartMax <= 2 : palier.ecartMax <= 0.10,
          palier: palier.nom, // sert à l'affichage et aux messages (action 7)
          exact,
        });
        if (closest === null || ecart < Math.abs(closest - rt.target)) closest = a.value;
        // DÉCISION 5.4 — égalité : TOUS les joueurs à distance identique. Même
        // principe que l'égalité au vote (décision 2 de l'action 18 du v1).
        if (ecart < ecartMini) { ecartMini = ecart; plusProches = [pid]; }
        else if (ecart === ecartMini) plusProches.push(pid);
      }

      // DÉCISION 5.6 — les bonus SE CUMULENT, sans plafond. Un joueur exact, au
      // premier palier et le plus proche touche 1000 + 200 + 400 = 1600, quand un
      // quiz plafonne à 950. Écart accepté par l'auteur en connaissance de cause.
      for (const pid of plusProches) {
        const r = results.get(pid);
        if (r) r.base += BONUS_PLUS_PROCHE;
      }
      values.sort((a, b) => a - b);
      const avg = values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
      const median = values.length ? values[Math.floor(values.length / 2)] : null;
      const stats = {
        kind: 'numeric',
        total: values.length,
        avg: avg != null ? Math.round(avg * 100) / 100 : null,
        median,
        closest,
        target: rt.target,
        histogramme: histogrammeNumerique(values, rt.target),
        // Les plages du barème, pour que les deux histogrammes portent un axe qui
        // dit quelque chose (voir `plagesEstimation`).
        plages: plagesEstimation(rt.target, nature),
        nature,
      };
      // `prives` : ce qui ne doit JAMAIS partir dans `reveal`, lequel est diffusé
      // à tout le salon, stream compris. Les noms des plus proches en font partie
      // (décision 6.2) — même famille que la file d'attente, décision 8 de
      // l'action 6 du chantier v1.
      return { results, reveal: { target: rt.target, text: rt.text, stats }, prives: { plusProches } };
    },
  },

  vote: {
    // `scored` par défaut : un vote est désormais un JEU (action 18) — faire
    // partie de la majorité rapporte des points. Chaque question peut néanmoins
    // repasser en sondage (`poll: true`), et c'est le runtime qui tranche.
    meta: { type: 'vote', name: 'Vote', icon: 'bar-chart-2', color: 'info', scored: true, malus: false, vitesse: false },
    buildRound(q) {
      return {
        type: 'vote',
        questionId: q.id,
        text: q.text,
        options: q.options,
        // SONDAGE ou JEU, question par question. Un vote noté n'est plus un
        // sondage : le joueur ne répond plus ce qu'il pense mais ce qu'il croit
        // que les autres vont répondre. L'interrupteur préserve les deux usages —
        // demander sincèrement à la salle, ou en faire un pari collectif.
        poll: !!q.poll,
        scored: !q.poll,
        durationMs: (q.durationSec || 15) * 1000,
      };
    },
    publicQuestion(rt) {
      return { type: 'vote', questionId: rt.questionId, text: rt.text, options: rt.options };
    },
    validateAnswer(rt, value) {
      const i = Number(value);
      return Number.isInteger(i) && i >= 0 && i < rt.options.length ? i : null;
    },
    score(rt) {
      const results = new Map();
      const tally = tallyOptions(rt, rt.options.length);
      const stats = { kind: 'options', options: rt.options, tally, total: rt.answers.size };

      if (rt.poll) {
        // SONDAGE : pas de bonne réponse, pas de gagnant. Participation seule, et
        // la série n'est ni nourrie ni rompue (le runtime n'est pas noté).
        for (const [pid] of rt.answers) results.set(pid, { base: 100, speed: 0, correct: null });
        return { results, reveal: { tally, options: rt.options, text: rt.text, poll: true, stats } };
      }

      // JEU : la majorité l'emporte. En cas d'ÉGALITÉ entre deux options de tête,
      // les deux camps gagnent — sinon une égalité parfaite ne produirait aucun
      // vainqueur, ce qui serait arbitraire et frustrant.
      const meilleur = Math.max(0, ...tally);
      const gagnantes = tally.map((n, i) => (n === meilleur && n > 0 ? i : -1)).filter((i) => i >= 0);
      for (const [pid, a] of rt.answers) {
        const gagne = gagnantes.includes(a.value);
        // Base fixe, aucun complément de vitesse : on ne devine pas plus vite ce
        // que pense la salle, et récompenser la rapidité pousserait à cliquer
        // avant d'avoir lu. Aucune pénalité pour les minoritaires : être minoritaire
        // n'est pas une faute, c'est un pari perdu.
        results.set(pid, { base: gagne ? BASE_BONNE_REPONSE : 0, speed: 0, correct: gagne });
      }
      return { results, reveal: { tally, options: rt.options, text: rt.text, winners: gagnantes, stats } };
    },
  },
};

export const MODULE_TYPES = Object.keys(modules);

// Banque de questions embarquée (seed) — permet une partie complète sans Studio.
// 20+ questions par module (retour produit du 2026-08-18).
export const demoQuestions = {
  quiz: [
    { id: 'q-ocean', text: 'Quel est le plus grand océan ?', options: ['Atlantique', 'Indien', 'Pacifique', 'Arctique'], correctIndex: 2, durationSec: 15 },
    { id: 'q-montagne', text: "Quelle est la plus haute montagne d'Europe ?", options: ['Mont Blanc', 'Elbrouz', 'Cervin', 'Etna'], correctIndex: 1, durationSec: 20 },
    { id: 'q-australie', text: "Quelle est la capitale de l'Australie ?", options: ['Sydney', 'Canberra', 'Melbourne', 'Perth'], correctIndex: 1, durationSec: 15 },
    { id: 'q-vangogh', text: 'Quel peintre a réalisé « La Nuit étoilée » ?', options: ['Monet', 'Van Gogh', 'Picasso', 'Dalí'], correctIndex: 1, durationSec: 15 },
    { id: 'q-foot11', text: "Combien de joueurs d'une équipe de football sont sur le terrain ?", options: ['9', '10', '11', '12'], correctIndex: 2, durationSec: 12 },
    { id: 'q-loire', text: 'Quel est le plus long fleuve entièrement situé en France ?', options: ['La Seine', 'Le Rhône', 'La Loire', 'La Garonne'], correctIndex: 2, durationSec: 15 },
    { id: 'q-mars', text: 'Quelle planète est surnommée « la planète rouge » ?', options: ['Vénus', 'Mars', 'Jupiter', 'Saturne'], correctIndex: 1, durationSec: 10 },
    { id: 'q-hugo', text: 'Qui a écrit « Les Misérables » ?', options: ['Émile Zola', 'Victor Hugo', 'Honoré de Balzac', 'Gustave Flaubert'], correctIndex: 1, durationSec: 15 },
    { id: 'q-azote', text: "Quel gaz compose majoritairement l'air que nous respirons ?", options: ['Oxygène', 'Azote', 'Dioxyde de carbone', 'Hydrogène'], correctIndex: 1, durationSec: 15 },
    { id: 'q-hexagone', text: 'Combien de côtés possède un hexagone ?', options: ['5', '6', '7', '8'], correctIndex: 1, durationSec: 10 },
    { id: 'q-yen', text: 'Quelle est la monnaie du Japon ?', options: ['Le yuan', 'Le won', 'Le yen', 'Le ringgit'], correctIndex: 2, durationSec: 12 },
    { id: 'q-coeur', text: 'Quel organe pompe le sang dans le corps humain ?', options: ['Le foie', 'Le cœur', 'Le poumon', 'Le rein'], correctIndex: 1, durationSec: 10 },
    { id: 'q-1914', text: 'En quelle année la Première Guerre mondiale a-t-elle éclaté ?', options: ['1912', '1914', '1916', '1918'], correctIndex: 1, durationSec: 15 },
    { id: 'q-sahara', text: 'Quel est le plus grand désert chaud du monde ?', options: ['Le Gobi', 'Le Kalahari', 'Le Sahara', "L'Atacama"], correctIndex: 2, durationSec: 15 },
    { id: 'q-joconde', text: 'Qui a peint la Joconde ?', options: ['Michel-Ange', 'Raphaël', 'Léonard de Vinci', 'Botticelli'], correctIndex: 2, durationSec: 12 },
    { id: 'q-jo', text: 'Dans quel pays les Jeux olympiques antiques sont-ils nés ?', options: ['En Italie', 'En Grèce', 'En Égypte', 'En Chine'], correctIndex: 1, durationSec: 15 },
    { id: 'q-mandarin', text: 'Quelle langue compte le plus de locuteurs natifs au monde ?', options: ["L'anglais", "L'espagnol", 'Le mandarin', "L'hindi"], correctIndex: 2, durationSec: 15 },
    { id: 'q-piano36', text: 'Combien de touches noires possède un piano standard ?', options: ['30', '36', '42', '48'], correctIndex: 1, durationSec: 20 },
    { id: 'q-oxygene', text: 'Quel élément chimique a pour symbole « O » ?', options: ["L'or", "L'osmium", "L'oxygène", "L'étain"], correctIndex: 2, durationSec: 12 },
    { id: 'q-mediterranee', text: 'Quelle mer borde la ville de Marseille ?', options: ['La Manche', 'La Méditerranée', "L'Adriatique", 'La Baltique'], correctIndex: 1, durationSec: 12 },
    { id: 'q-faucon', text: "Quel est l'animal le plus rapide du monde ?", options: ['Le guépard', 'Le faucon pèlerin', "L'antilope", "L'espadon"], correctIndex: 1, durationSec: 15 },
    { id: 'q-foot90', text: 'Combien de minutes dure un match de football (temps réglementaire) ?', options: ['80', '90', '100', '120'], correctIndex: 1, durationSec: 10 },
  ],
  true_false: [
    { id: 'tf-soleil', text: 'Le Soleil est une étoile.', correct: true, durationSec: 10 },
    { id: 'tf-muraille', text: "La Grande Muraille de Chine est visible à l'œil nu depuis la Lune.", correct: false, durationSec: 12 },
    { id: 'tf-autruche', text: 'Les autruches peuvent voler.', correct: false, durationSec: 10 },
    { id: 'tf-nil', text: "Le Nil traverse l'Égypte.", correct: true, durationSec: 10 },
    { id: 'tf-ebullition', text: "Au niveau de la mer, l'eau bout à 90 °C.", correct: false, durationSec: 12 },
    { id: 'tf-seine', text: 'Paris est traversée par la Seine.', correct: true, durationSec: 8 },
    { id: 'tf-bissextile', text: 'Une année bissextile compte 365 jours.', correct: false, durationSec: 12 },
    { id: 'tf-requin', text: 'Le requin est un mammifère.', correct: false, durationSec: 10 },
    { id: 'tf-photosynthese', text: "La photosynthèse produit de l'oxygène.", correct: true, durationSec: 12 },
    { id: 'tf-mozart', text: 'Mozart était un compositeur français.', correct: false, durationSec: 10 },
    { id: 'tf-os206', text: "Le corps humain adulte compte 206 os.", correct: true, durationSec: 12 },
    { id: 'tf-belgique', text: "La Belgique partage une frontière avec l'Espagne.", correct: false, durationSec: 10 },
    { id: 'tf-tomate', text: 'Botaniquement, la tomate est un fruit.', correct: true, durationSec: 12 },
    { id: 'tf-everest', text: "Le mont Everest est le plus haut sommet du monde.", correct: true, durationSec: 10 },
    { id: 'tf-planetes8', text: 'Le Système solaire compte 8 planètes.', correct: true, durationSec: 12 },
    { id: 'tf-chauvesouris', text: 'Les chauves-souris sont aveugles.', correct: false, durationSec: 12 },
    { id: 'tf-miel', text: 'Le miel peut se conserver des années sans périmer.', correct: true, durationSec: 12 },
    { id: 'tf-lumiere', text: "La vitesse de la lumière est d'environ 300 000 km par heure.", correct: false, durationSec: 15 },
    { id: 'tf-amazone', text: "L'Amazone est un fleuve d'Afrique.", correct: false, durationSec: 10 },
    { id: 'tf-octet', text: 'Un octet contient 8 bits.', correct: true, durationSec: 10 },
    { id: 'tf-manchots', text: "Les manchots vivent principalement dans l'hémisphère Sud.", correct: true, durationSec: 12 },
  ],
  estimation: [
    { id: 'es-tourEiffel', text: 'Hauteur de la Tour Eiffel en mètres ?', target: 330, durationSec: 20 },
    { id: 'es-communes', text: 'Combien de communes compte la France (environ) ?', target: 35000, durationSec: 20 },
    { id: 'es-gutenberg', text: "En quelle année Gutenberg a-t-il mis au point l'imprimerie (environ) ?", target: 1450, durationSec: 20 },
    { id: 'es-montblanc', text: 'Altitude du mont Blanc en mètres ?', target: 4806, durationSec: 20 },
    { id: 'es-onu', text: "Combien de pays sont membres de l'ONU ?", target: 193, durationSec: 20 },
    { id: 'es-lune', text: 'Distance moyenne Terre-Lune en kilomètres ?', target: 384400, durationSec: 20 },
    { id: 'es-os', text: "Combien d'os compte le corps humain adulte ?", target: 206, durationSec: 15 },
    { id: 'es-berlin', text: 'En quelle année le mur de Berlin est-il tombé ?', target: 1989, durationSec: 15 },
    { id: 'es-marathon', text: "Longueur officielle d'un marathon en mètres ?", target: 42195, durationSec: 20 },
    { id: 'es-france', text: 'Population de la France en millions d\'habitants (environ) ?', target: 68, durationSec: 15 },
    { id: 'es-piano', text: 'Combien de touches possède un piano standard ?', target: 88, durationSec: 15 },
    { id: 'es-son', text: "Vitesse du son dans l'air en km/h (environ) ?", target: 1235, durationSec: 20 },
    { id: 'es-lumiere1895', text: 'En quelle année les frères Lumière ont-ils projeté leur premier film ?', target: 1895, durationSec: 20 },
    { id: 'es-departements', text: 'Combien de départements compte la France (métropole + outre-mer) ?', target: 101, durationSec: 15 },
    { id: 'es-cartes', text: 'Combien de cartes dans un jeu de 52 cartes avec ses 2 jokers ?', target: 54, durationSec: 10 },
    { id: 'es-mariannes', text: 'Profondeur de la fosse des Mariannes en mètres (environ) ?', target: 11000, durationSec: 20 },
    { id: 'es-iphone', text: 'En quelle année le premier iPhone est-il sorti ?', target: 2007, durationSec: 15 },
    { id: 'es-languesonu', text: "Combien de langues officielles à l'ONU ?", target: 6, durationSec: 15 },
    { id: 'es-soleil', text: 'Température de surface du Soleil en °C (environ) ?', target: 5500, durationSec: 20 },
    { id: 'es-marches', text: "Combien de marches pour monter au sommet de la Tour Eiffel ?", target: 1665, durationSec: 20 },
    { id: 'es-napoleon', text: 'En quelle année est né Napoléon Bonaparte ?', target: 1769, durationSec: 20 },
  ],
  vote: [
    { id: 'vo-saison', text: 'Meilleure saison ?', options: ['Printemps', 'Été', 'Automne', 'Hiver'], durationSec: 15 },
    { id: 'vo-matin', text: 'Plutôt quoi le matin ?', options: ['Thé', 'Café', 'Chocolat', 'Rien'], durationSec: 12 },
    { id: 'vo-repas', text: 'Le meilleur repas ?', options: ['Pizza', 'Burger', 'Sushi', 'Raclette'], durationSec: 15 },
    { id: 'vo-vacances', text: 'Vacances idéales ?', options: ['Plage', 'Montagne', 'Ville', 'Campagne'], durationSec: 15 },
    { id: 'vo-animal', text: 'Chien ou chat ?', options: ['Chien', 'Chat', 'Les deux', 'Aucun'], durationSec: 12 },
    { id: 'vo-rythme', text: 'Plutôt matin ou soir ?', options: ['Lève-tôt', 'Couche-tard', 'Les deux', 'Ni l\'un ni l\'autre'], durationSec: 12 },
    { id: 'vo-pouvoir', text: 'Le meilleur super-pouvoir ?', options: ['Voler', 'Invisibilité', 'Téléportation', 'Lire les pensées'], durationSec: 15 },
    { id: 'vo-dessert', text: 'Le dessert ultime ?', options: ['Tiramisu', 'Crêpes', 'Mousse au chocolat', 'Tarte au citron'], durationSec: 15 },
    { id: 'vo-soiree', text: 'Cinéma ou canapé ?', options: ['Cinéma', 'Canapé', 'Les deux', 'Théâtre'], durationSec: 12 },
    { id: 'vo-pire', text: 'Le pire au quotidien ?', options: ['Les bouchons', 'Les réunions', 'Les pubs', 'Le lundi matin'], durationSec: 15 },
    { id: 'vo-gout', text: 'Sucré ou salé ?', options: ['Sucré', 'Salé', 'Les deux', 'Ça dépend'], durationSec: 12 },
    { id: 'vo-boisson', text: 'Votre boisson de soirée ?', options: ['Soda', 'Jus de fruits', 'Eau pétillante', 'Cocktail'], durationSec: 12 },
    { id: 'vo-console', text: 'La meilleure plateforme de jeu ?', options: ['PlayStation', 'Xbox', 'Switch', 'PC'], durationSec: 15 },
    { id: 'vo-accompagnement', text: 'Frites ou purée ?', options: ['Frites', 'Purée', 'Gratin', 'Riz'], durationSec: 12 },
    { id: 'vo-musique', text: 'De la musique en travaillant ?', options: ['Toujours', 'Jamais', 'Parfois', 'Plutôt un podcast'], durationSec: 12 },
    { id: 'vo-baignade', text: 'Plutôt mer ou piscine ?', options: ['Mer', 'Piscine', 'Lac', 'Aucun'], durationSec: 12 },
    { id: 'vo-plateforme', text: 'Votre plateforme préférée ?', options: ['Twitch', 'YouTube', 'TikTok', 'Instagram'], durationSec: 15 },
    { id: 'vo-ananas', text: "L'ananas sur la pizza ?", options: ['Pour', 'Contre', 'Indifférent', 'Jamais goûté'], durationSec: 12 },
    { id: 'vo-film', text: 'Votre film du soir ?', options: ['Comédie', 'Action', 'Horreur', 'Documentaire'], durationSec: 15 },
    { id: 'vo-petitdej', text: 'Le meilleur petit-déjeuner ?', options: ['Croissant', 'Tartines', 'Œufs', 'Céréales'], durationSec: 12 },
    { id: 'vo-fin', text: 'Fromage ou dessert ?', options: ['Fromage', 'Dessert', 'Les deux', 'Aucun'], durationSec: 12 },
  ],
};
