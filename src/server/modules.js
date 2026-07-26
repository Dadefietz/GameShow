// Les 4 modules de lancement. Chaque module est INDÉPENDANT (modularité, USER-NEEDS M4/M5).
// Interface commune :
//   meta: { type, name, icon, color }
//   buildRound(question) -> runtime
//   publicQuestion(runtime, role) -> payload envoyé aux joueurs (role 'player') ou overlay
//   validateAnswer(runtime, value) -> valeur normalisée ou null si invalide
//   score(runtime) -> { points: Map<playerId, delta>, reveal: {...} }
// Le SERVEUR est autoritaire : il ne reçoit que des réponses, jamais des scores.

const BASE_POINTS = 1000;

// Points vitesse+exactitude : plein si répondu tôt, dégressif jusqu'à la moitié en fin de fenêtre.
function speedPoints(runtime, answeredAt) {
  const total = runtime.durationMs;
  const elapsed = Math.min(Math.max(answeredAt - runtime.startedAt, 0), total);
  const frac = total > 0 ? 1 - elapsed / total : 1; // 1 (tôt) -> 0 (tard)
  return Math.round(BASE_POINTS * (0.5 + 0.5 * frac));
}

export const modules = {
  quiz: {
    meta: { type: 'quiz', name: 'Quiz', icon: 'help-circle', color: 'primary' },
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
      const points = new Map();
      for (const [pid, a] of rt.answers) {
        if (a.value === rt.correctIndex) points.set(pid, speedPoints(rt, a.at));
      }
      return { points, reveal: { correctIndex: rt.correctIndex, text: rt.text } };
    },
  },

  true_false: {
    meta: { type: 'true_false', name: 'Vrai / Faux', icon: 'check-square', color: 'forest' },
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
      const points = new Map();
      for (const [pid, a] of rt.answers) {
        if (a.value === rt.correct) points.set(pid, speedPoints(rt, a.at));
      }
      return { points, reveal: { correct: rt.correct, text: rt.text } };
    },
  },

  estimation: {
    meta: { type: 'estimation', name: 'Estimation', icon: 'target', color: 'flame' },
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
      // Points selon la proximité relative à la cible ; le plus proche marque le plus.
      const points = new Map();
      const spread = Math.max(Math.abs(rt.target), 1);
      for (const [pid, a] of rt.answers) {
        const err = Math.abs(a.value - rt.target) / spread; // 0 = exact
        const acc = Math.max(0, 1 - Math.min(err, 1));
        points.set(pid, Math.round(BASE_POINTS * acc));
      }
      return { points, reveal: { target: rt.target, text: rt.text } };
    },
  },

  vote: {
    meta: { type: 'vote', name: 'Vote', icon: 'bar-chart-2', color: 'info' },
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
      // Sondage d'opinion : pas de bonne réponse. Participation = petits points ; on révèle le décompte.
      const points = new Map();
      const tally = new Array(rt.options.length).fill(0);
      for (const [pid, a] of rt.answers) {
        tally[a.value] += 1;
        points.set(pid, 100);
      }
      return { points, reveal: { tally, options: rt.options, text: rt.text } };
    },
  },
};

export const MODULE_TYPES = Object.keys(modules);

// Jeu de questions de démonstration (seed) — permet une partie complète sans Studio.
export const demoQuestions = {
  quiz: [
    { id: 'q-ocean', text: 'Quel est le plus grand océan ?', options: ['Atlantique', 'Indien', 'Pacifique', 'Arctique'], correctIndex: 2, durationSec: 15 },
    { id: 'q-montagne', text: "Quelle est la plus haute montagne d'Europe ?", options: ['Mont Blanc', 'Elbrouz', 'Cervin', 'Etna'], correctIndex: 1, durationSec: 20 },
  ],
  true_false: [
    { id: 'tf-soleil', text: 'Le Soleil est une étoile.', correct: true, durationSec: 10 },
  ],
  estimation: [
    { id: 'es-tourEiffel', text: 'Hauteur de la Tour Eiffel en mètres ?', target: 330, durationSec: 20 },
  ],
  vote: [
    { id: 'vo-saison', text: 'Meilleure saison ?', options: ['Printemps', 'Été', 'Automne', 'Hiver'], durationSec: 15 },
  ],
};
