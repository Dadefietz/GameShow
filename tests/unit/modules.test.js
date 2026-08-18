// Tests unitaires — barème et validation des 4 modules (logique pure).
import { describe, it, expect } from 'vitest';
import { modules, demoQuestions, MODULE_TYPES } from '../../src/server/modules.js';

function round(mod, q) {
  const rt = mod.buildRound(q);
  rt.answers = new Map();
  rt.startedAt = 1_000_000;
  rt.deadline = rt.startedAt + rt.durationMs;
  return rt;
}

const QUIZ_Q = { id: 'q1', text: 'Q ?', options: ['A', 'B', 'C', 'D'], correctIndex: 1, durationSec: 20 };

describe('quiz', () => {
  it('valide un index dans les bornes, rejette le reste', () => {
    const rt = round(modules.quiz, QUIZ_Q);
    expect(modules.quiz.validateAnswer(rt, 2)).toBe(2);
    expect(modules.quiz.validateAnswer(rt, '3')).toBe(3);
    expect(modules.quiz.validateAnswer(rt, 4)).toBeNull();
    expect(modules.quiz.validateAnswer(rt, -1)).toBeNull();
    expect(modules.quiz.validateAnswer(rt, 1.5)).toBeNull();
    expect(modules.quiz.validateAnswer(rt, 'abc')).toBeNull();
  });

  it('récompense la vitesse modérément : immédiat 1000, dernier instant 700', () => {
    const rt = round(modules.quiz, QUIZ_Q);
    rt.answers.set('fast', { value: 1, at: rt.startedAt });
    rt.answers.set('slow', { value: 1, at: rt.deadline });
    const { results } = modules.quiz.score(rt);
    expect(results.get('fast').base).toBe(1000);
    expect(results.get('slow').base).toBe(700);
    expect(results.get('fast').correct).toBe(true);
  });

  it('mauvaise réponse : base 0, correct false ; sans réponse : absent des résultats', () => {
    const rt = round(modules.quiz, QUIZ_Q);
    rt.answers.set('wrong', { value: 0, at: rt.startedAt });
    const { results } = modules.quiz.score(rt);
    expect(results.get('wrong')).toEqual({ base: 0, correct: false });
    expect(results.has('absent')).toBe(false);
  });

  it('révèle la bonne réponse et la répartition par option', () => {
    const rt = round(modules.quiz, QUIZ_Q);
    rt.answers.set('p1', { value: 1, at: rt.startedAt });
    rt.answers.set('p2', { value: 1, at: rt.startedAt });
    rt.answers.set('p3', { value: 3, at: rt.startedAt });
    const { reveal } = modules.quiz.score(rt);
    expect(reveal.correctIndex).toBe(1);
    expect(reveal.stats).toEqual({ kind: 'options', options: QUIZ_Q.options, tally: [0, 2, 0, 1], total: 3 });
  });
});

describe('true_false', () => {
  const TF_Q = { id: 'tf1', text: 'V ?', correct: true, durationSec: 10 };

  it('valide booléens et chaînes true/false uniquement', () => {
    const rt = round(modules.true_false, TF_Q);
    expect(modules.true_false.validateAnswer(rt, true)).toBe(true);
    expect(modules.true_false.validateAnswer(rt, 'false')).toBe(false);
    expect(modules.true_false.validateAnswer(rt, 1)).toBeNull();
    expect(modules.true_false.validateAnswer(rt, 'oui')).toBeNull();
  });

  it('compte Vrai/Faux dans les stats', () => {
    const rt = round(modules.true_false, TF_Q);
    rt.answers.set('p1', { value: true, at: rt.startedAt });
    rt.answers.set('p2', { value: false, at: rt.startedAt });
    rt.answers.set('p3', { value: false, at: rt.startedAt });
    const { reveal, results } = modules.true_false.score(rt);
    expect(reveal.stats.options).toEqual(['Vrai', 'Faux']);
    expect(reveal.stats.tally).toEqual([1, 2]);
    expect(results.get('p1').correct).toBe(true);
    expect(results.get('p2').correct).toBe(false);
  });
});

describe('estimation', () => {
  const ES_Q = { id: 'es1', text: 'Combien ?', target: 100, durationSec: 20 };

  it('valide tout nombre fini', () => {
    const rt = round(modules.estimation, ES_Q);
    expect(modules.estimation.validateAnswer(rt, '42')).toBe(42);
    expect(modules.estimation.validateAnswer(rt, -5)).toBe(-5);
    expect(modules.estimation.validateAnswer(rt, 'NaN')).toBeNull();
    expect(modules.estimation.validateAnswer(rt, Infinity)).toBeNull();
  });

  it('exact et immédiat = 1000 ; exact et tardif = 850 (pondération vitesse 15 %)', () => {
    const rt = round(modules.estimation, ES_Q);
    rt.answers.set('fast', { value: 100, at: rt.startedAt });
    rt.answers.set('slow', { value: 100, at: rt.deadline });
    const { results } = modules.estimation.score(rt);
    expect(results.get('fast').base).toBe(1000);
    expect(results.get('slow').base).toBe(850);
  });

  it('correct (série) = à moins de 10 % de la cible ; très loin = 0 point', () => {
    const rt = round(modules.estimation, ES_Q);
    rt.answers.set('close', { value: 109, at: rt.startedAt });   // 9 % d'écart
    rt.answers.set('meh', { value: 150, at: rt.startedAt });     // 50 %
    rt.answers.set('far', { value: 1000, at: rt.startedAt });    // 900 %
    const { results, reveal } = modules.estimation.score(rt);
    expect(results.get('close').correct).toBe(true);
    expect(results.get('meh').correct).toBe(false);
    expect(results.get('meh').base).toBeGreaterThan(0);
    expect(results.get('far').base).toBe(0);
    expect(reveal.stats.kind).toBe('numeric');
    expect(reveal.stats.closest).toBe(109);
    expect(reveal.stats.total).toBe(3);
  });
});

describe('vote', () => {
  const VO_Q = { id: 'vo1', text: 'Choix ?', options: ['X', 'Y'], durationSec: 15 };

  it('participation = 100 points fixes, pas de notion de correct', () => {
    const rt = round(modules.vote, VO_Q);
    rt.answers.set('p1', { value: 0, at: rt.startedAt });
    rt.answers.set('p2', { value: 1, at: rt.startedAt });
    const { results, reveal } = modules.vote.score(rt);
    expect(results.get('p1')).toEqual({ base: 100, correct: null });
    expect(reveal.tally).toEqual([1, 1]);
    expect(modules.vote.meta.scored).toBe(false);
  });
});

describe('banque embarquée (R6 — 20 questions par module)', () => {
  it.each(MODULE_TYPES)('%s contient au moins 20 questions aux ids uniques', (type) => {
    const bank = demoQuestions[type];
    expect(bank.length).toBeGreaterThanOrEqual(20);
    expect(new Set(bank.map((q) => q.id)).size).toBe(bank.length);
  });

  it('chaque quiz a un correctIndex valide, chaque estimation une cible finie', () => {
    for (const q of demoQuestions.quiz) {
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(q.options.length);
    }
    for (const q of demoQuestions.estimation) expect(Number.isFinite(q.target)).toBe(true);
    for (const q of demoQuestions.true_false) expect(typeof q.correct).toBe('boolean');
    for (const q of demoQuestions.vote) expect(q.options.length).toBeGreaterThanOrEqual(2);
  });
});
