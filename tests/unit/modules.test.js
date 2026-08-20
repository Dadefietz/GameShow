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

  // La vitesse ne se cache plus dans la base : elle a sa propre ligne (action 17).
  // Les TOTAUX sont inchangés — immédiat 1000, dernier instant 700 — mais ils se
  // lisent désormais comme 700 de base plus 0 à 300 de complément.
  it('base fixe à 700 ; la vitesse vit dans un complément séparé (totaux inchangés)', () => {
    const rt = round(modules.quiz, QUIZ_Q);
    rt.answers.set('fast', { value: 1, at: rt.startedAt });
    rt.answers.set('slow', { value: 1, at: rt.deadline });
    const { results } = modules.quiz.score(rt);
    const rapide = results.get('fast');
    const lent = results.get('slow');

    expect(rapide.base).toBe(700);
    expect(lent.base).toBe(700);
    expect(rapide.speed).toBe(300);
    expect(lent.speed).toBe(0);
    // Les totaux d'avant, au point près.
    expect(rapide.base + rapide.speed).toBe(1000);
    expect(lent.base + lent.speed).toBe(700);
    expect(rapide.correct).toBe(true);
  });

  it('mauvaise réponse : base 0, correct false ; sans réponse : absent des résultats', () => {
    const rt = round(modules.quiz, QUIZ_Q);
    rt.answers.set('wrong', { value: 0, at: rt.startedAt });
    const { results } = modules.quiz.score(rt);
    // Ni base ni complément : une mauvaise réponse ne rapporte rien. Et elle ne
    // coûte rien non plus — plus aucune pénalité dans aucun jeu (T1).
    expect(results.get('wrong')).toEqual({ base: 0, speed: 0, correct: false });
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

  // LE DÉFAUT CORRIGÉ : la vitesse pesait plus lourd que la justesse. Sur une
  // cible de 100, une réponse EXACTE mais tardive valait 850, quand une réponse
  // à 10 % près mais immédiate en valait 900. Le plus juste perdait.
  it('la rapidité ne joue plus AUCUN rôle : seule la justesse décide', () => {
    const rt = round(modules.estimation, ES_Q);
    rt.answers.set('exact-lent', { value: 100, at: rt.deadline });
    rt.answers.set('approx-rapide', { value: 110, at: rt.startedAt });
    const { results } = modules.estimation.score(rt);
    const exact = results.get('exact-lent');
    const approx = results.get('approx-rapide');

    expect(exact.speed).toBe(0);
    expect(approx.speed).toBe(0);
    // Le plus juste gagne, même arrivé dernier.
    expect(exact.base).toBeGreaterThan(approx.base);
  });

  it('les paliers valent des points fixes', () => {
    const rt = round(modules.estimation, ES_Q);
    rt.answers.set('mille', { value: 101, at: rt.startedAt });   // 1 %
    rt.answers.set('proche', { value: 108, at: rt.startedAt });  // 8 %
    rt.answers.set('correct', { value: 118, at: rt.startedAt }); // 18 %
    rt.answers.set('loin', { value: 128, at: rt.startedAt });    // 28 %
    rt.answers.set('hors', { value: 200, at: rt.startedAt });    // 100 %
    const { results } = modules.estimation.score(rt);
    expect(results.get('mille').base).toBe(1000);
    expect(results.get('proche').base).toBe(750);
    expect(results.get('correct').base).toBe(500);
    expect(results.get('loin').base).toBe(250);
    expect(results.get('hors').base).toBe(0);
    // Le palier atteint voyage jusqu'au client (affichage + messages).
    expect(results.get('mille').palier).toBe('mille');
    expect(results.get('hors').palier).toBe('hors');
  });

  // LA GARANTIE : c'est elle qui empêche le défaut de revenir par une évolution
  // future. Aucune réponse d'un palier inférieur ne peut atteindre le palier du
  // dessus, quelles que soient les circonstances.
  it('aucun palier inférieur ne peut dépasser un palier supérieur', () => {
    const rt = round(modules.estimation, ES_Q);
    // Le meilleur cas possible de chaque palier, joué instantanément.
    rt.answers.set('a', { value: 100, at: rt.startedAt });   // palier 1
    rt.answers.set('b', { value: 103, at: rt.startedAt });   // palier 2
    rt.answers.set('c', { value: 111, at: rt.startedAt });   // palier 3
    rt.answers.set('d', { value: 121, at: rt.startedAt });   // palier 4
    const { results } = modules.estimation.score(rt);
    const total = (id) => results.get(id).base + results.get(id).speed;
    expect(total('a')).toBeGreaterThan(total('b'));
    expect(total('b')).toBeGreaterThan(total('c'));
    expect(total('c')).toBeGreaterThan(total('d'));
  });

  // LES GRANDS NOMBRES : c'était la « base bloquée » constatée en test. Sur une
  // cible d'un million, se tromper de cent mille comptait pour 10 % et tout le
  // monde décrochait presque le maximum — les scores se tassaient.
  it('sur une cible d\'un million, l\'écart se voit encore', () => {
    const rt = round(modules.estimation, { id: 'm', text: '?', target: 1_000_000, durationSec: 20 });
    rt.answers.set('juste', { value: 1_000_000, at: rt.startedAt });
    rt.answers.set('cent-mille-a-cote', { value: 1_100_000, at: rt.startedAt });
    const { results } = modules.estimation.score(rt);
    expect(results.get('juste').base).toBe(1000);
    expect(results.get('cent-mille-a-cote').base).toBe(750); // pas 900 : l'écart se paie
  });

  // LES PETITS NOMBRES : sans tolérance absolue, sur une cible de 3, dix pour
  // cent valent trois dixièmes — répondre 4 tomberait à 33 % d'écart, donc zéro.
  it('sur une cible à un chiffre, être à une unité près reste excellent', () => {
    const rt = round(modules.estimation, { id: 'p', text: '?', target: 3, durationSec: 20 });
    rt.answers.set('exact', { value: 3, at: rt.startedAt });
    rt.answers.set('une-unite', { value: 4, at: rt.startedAt });
    rt.answers.set('loin', { value: 30, at: rt.startedAt });
    const { results } = modules.estimation.score(rt);
    expect(results.get('exact').base).toBe(1000);
    expect(results.get('une-unite').base).toBe(1000);
    expect(results.get('loin').base).toBe(0);
  });

  it('le seuil de série reste à 10 %, et les faits de révélation sont publiés', () => {
    const rt = round(modules.estimation, ES_Q);
    rt.answers.set('close', { value: 109, at: rt.startedAt });   // 9 % d'écart
    rt.answers.set('meh', { value: 150, at: rt.startedAt });     // 50 %
    rt.answers.set('far', { value: 1000, at: rt.startedAt });    // 900 %
    const { results, reveal } = modules.estimation.score(rt);
    expect(results.get('close').correct).toBe(true);
    expect(results.get('meh').correct).toBe(false);
    expect(results.get('far').base).toBe(0);
    expect(reveal.stats.kind).toBe('numeric');
    expect(reveal.stats.closest).toBe(109);
    expect(reveal.stats.total).toBe(3);
  });

  // L'HISTOGRAMME : spécifié par la maquette A5, jamais construit — le serveur ne
  // calculait même pas les tranches.
  it('publie un histogramme en 8 tranches, cible repérée', () => {
    const rt = round(modules.estimation, ES_Q);
    for (const [i, v] of [80, 90, 95, 100, 105, 110].entries()) {
      rt.answers.set('p' + i, { value: v, at: rt.startedAt });
    }
    const { reveal } = modules.estimation.score(rt);
    const h = reveal.stats.histogramme;
    expect(h.counts).toHaveLength(8);
    expect(h.counts.reduce((s, c) => s + c, 0)).toBe(6); // personne n'est perdu
    expect(h.cibleIndex).toBeGreaterThanOrEqual(0);
    expect(h.cibleIndex).toBeLessThan(8);
  });

  it('une valeur aberrante est ramenée à l\'extrémité, sans écraser l\'échelle', () => {
    const rt = round(modules.estimation, ES_Q);
    for (const [i, v] of [95, 98, 100, 102, 105].entries()) {
      rt.answers.set('p' + i, { value: v, at: rt.startedAt });
    }
    rt.answers.set('plaisantin', { value: 999_999_999, at: rt.startedAt });
    const { reveal } = modules.estimation.score(rt);
    const h = reveal.stats.histogramme;

    // L'échelle reste celle du groupe : elle ne part pas jusqu'au milliard.
    expect(h.max).toBeLessThan(1000);
    // Et l'aberrante n'est pas perdue : elle est comptée dans la dernière tranche.
    expect(h.counts.reduce((s, c) => s + c, 0)).toBe(6);
    expect(h.counts[7]).toBeGreaterThanOrEqual(1);
  });
});

describe('vote', () => {
  const VO_Q = { id: 'vo1', text: 'Choix ?', options: ['X', 'Y'], durationSec: 15 };

  // LE VOTE EST DEVENU UN JEU (action 18) : faire partie de la majorité rapporte.
  it('la majorité gagne, la minorité ne perd rien', () => {
    const rt = round(modules.vote, VO_Q);
    rt.answers.set('majo1', { value: 0, at: rt.startedAt });
    rt.answers.set('majo2', { value: 0, at: rt.startedAt });
    rt.answers.set('mino', { value: 1, at: rt.startedAt });
    const { results, reveal } = modules.vote.score(rt);

    expect(results.get('majo1').base).toBe(700);
    expect(results.get('majo1').correct).toBe(true);
    // Minoritaire : zéro point, aucune pénalité. Un pari perdu n'est pas une faute.
    expect(results.get('mino').base).toBe(0);
    expect(results.get('mino').correct).toBe(false);
    // Aucun complément de vitesse : on ne devine pas plus vite ce que pense la salle.
    expect(results.get('majo1').speed).toBe(0);
    expect(reveal.winners).toEqual([0]);
  });

  it('en cas d\'égalité parfaite, les deux camps gagnent', () => {
    const rt = round(modules.vote, VO_Q);
    rt.answers.set('a', { value: 0, at: rt.startedAt });
    rt.answers.set('b', { value: 1, at: rt.startedAt });
    const { results, reveal } = modules.vote.score(rt);
    // Sinon une égalité ne produirait aucun vainqueur : arbitraire et frustrant.
    expect(reveal.winners).toEqual([0, 1]);
    expect(results.get('a').correct).toBe(true);
    expect(results.get('b').correct).toBe(true);
  });

  it('en mode sondage, personne ne gagne et la participation suffit', () => {
    const rt = round(modules.vote, { ...VO_Q, poll: true });
    rt.answers.set('p1', { value: 0, at: rt.startedAt });
    rt.answers.set('p2', { value: 1, at: rt.startedAt });
    const { results, reveal } = modules.vote.score(rt);
    expect(results.get('p1')).toEqual({ base: 100, speed: 0, correct: null });
    expect(reveal.poll).toBe(true);
    expect(reveal.winners).toBeUndefined();
    // La manche n'est pas notée : ni série nourrie, ni série rompue.
    expect(rt.scored).toBe(false);
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
