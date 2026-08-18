// Les 4 modules de lancement. Chaque module est INDÉPENDANT (modularité, USER-NEEDS M4/M5).
// Interface commune :
//   meta: { type, name, icon, color, scored, malus }
//     scored: le module alimente points/série (false = participation seule, ex. vote)
//     malus:  une mauvaise réponse coûte des points (quiz, vrai/faux)
//   buildRound(question) -> runtime
//   publicQuestion(runtime) -> payload envoyé aux joueurs / stream (jamais la bonne réponse)
//   validateAnswer(runtime, value) -> valeur normalisée ou null si invalide
//   score(runtime) -> { results: Map<playerId, { base, correct }>, reveal: {...} }
//     reveal contient la bonne réponse ET stats (répartition des réponses, diffusée
//     à l'animateur + page stream à la fin du chrono).
// Le SERVEUR est autoritaire : il ne reçoit que des réponses, jamais des scores.

const BASE_POINTS = 1000;

// Prime de vitesse MODÉRÉE : une réponse immédiate vaut 1000, une réponse à la
// dernière seconde vaut 700 (dégressif linéaire). Récompense la rapidité sans
// écraser l'exactitude.
function speedPoints(runtime, answeredAt) {
  const total = runtime.durationMs;
  const elapsed = Math.min(Math.max(answeredAt - runtime.startedAt, 0), total);
  const frac = total > 0 ? 1 - elapsed / total : 1; // 1 (tôt) -> 0 (tard)
  return Math.round(BASE_POINTS * (0.7 + 0.3 * frac));
}

// Répartition des réponses sur des options indexées (quiz, vote) ou binaires (vrai/faux).
function tallyOptions(runtime, size) {
  const tally = new Array(size).fill(0);
  for (const [, a] of runtime.answers) tally[Number(a.value)] += 1;
  return tally;
}

export const modules = {
  quiz: {
    meta: { type: 'quiz', name: 'Quiz', icon: 'help-circle', color: 'primary', scored: true, malus: true },
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
        results.set(pid, { base: correct ? speedPoints(rt, a.at) : 0, correct });
      }
      const stats = { kind: 'options', options: rt.options, tally: tallyOptions(rt, rt.options.length), total: rt.answers.size };
      return { results, reveal: { correctIndex: rt.correctIndex, text: rt.text, options: rt.options, stats } };
    },
  },

  true_false: {
    meta: { type: 'true_false', name: 'Vrai / Faux', icon: 'check-square', color: 'forest', scored: true, malus: true },
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
        results.set(pid, { base: correct ? speedPoints(rt, a.at) : 0, correct });
      }
      const stats = { kind: 'options', options: ['Vrai', 'Faux'], tally: [vrai, rt.answers.size - vrai], total: rt.answers.size };
      return { results, reveal: { correct: rt.correct, text: rt.text, stats } };
    },
  },

  estimation: {
    meta: { type: 'estimation', name: 'Estimation', icon: 'target', color: 'flame', scored: true, malus: false },
    buildRound(q) {
      return {
        type: 'estimation',
        questionId: q.id,
        text: q.text,
        target: Number(q.target),
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
      // Points selon la proximité relative à la cible, pondérés légèrement par la
      // vitesse (85 %..100 %). « Correct » (pour la série) = à moins de 10 % de la cible.
      const results = new Map();
      const spread = Math.max(Math.abs(rt.target), 1);
      const values = [];
      let closest = null;
      for (const [pid, a] of rt.answers) {
        values.push(a.value);
        const err = Math.abs(a.value - rt.target) / spread; // 0 = exact
        const acc = Math.max(0, 1 - Math.min(err, 1));
        const total = rt.durationMs;
        const elapsed = Math.min(Math.max(a.at - rt.startedAt, 0), total);
        const frac = total > 0 ? 1 - elapsed / total : 1;
        const base = Math.round(BASE_POINTS * acc * (0.85 + 0.15 * frac));
        results.set(pid, { base, correct: err <= 0.1 });
        if (!closest || Math.abs(a.value - rt.target) < Math.abs(closest - rt.target)) closest = a.value;
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
      };
      return { results, reveal: { target: rt.target, text: rt.text, stats } };
    },
  },

  vote: {
    meta: { type: 'vote', name: 'Vote', icon: 'bar-chart-2', color: 'info', scored: false, malus: false },
    buildRound(q) {
      return {
        type: 'vote',
        questionId: q.id,
        text: q.text,
        options: q.options,
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
      // Sondage d'opinion : pas de bonne réponse. Participation = petits points fixes.
      const results = new Map();
      for (const [pid] of rt.answers) results.set(pid, { base: 100, correct: null });
      const tally = tallyOptions(rt, rt.options.length);
      const stats = { kind: 'options', options: rt.options, tally, total: rt.answers.size };
      return { results, reveal: { tally, options: rt.options, text: rt.text, stats } };
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
