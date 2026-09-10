// LA COURBE DE RAPIDITÉ — une seule, trois réglages.
//
// CE QUI A ÉTÉ DEMANDÉ (séance du 10/09) : « un bonus de rapidité allant de 0
// point à 200 points, le chrono partant de 15sec jusqu'à 0sec, de 15sec à 13sec
// = 200pts, et de 2sec à 0 = 0pt, je te laisse ajuster l'entre deux (exemple :
// une réponse à 7.5sec vaudra surement 100pts de rapidité) ».
//
// L'ÉNONCÉ DONNE DEUX POINTS DE CONTRÔLE CHIFFRÉS — 7,5 s sur le quiz, 5,5 s sur
// « Cache-cache » — et ils sont ici. C'est le seul moyen de vérifier que
// « l'entre-deux ajusté » est bien celui qui était attendu, et non une autre
// interpolation qui passerait aussi par les deux bouts.
import { describe, it, expect } from 'vitest';
import { modules, bonusRapidite, DUREE_QUESTION_COURTE } from '../../src/server/modules.js';

const COURTE = { plateau: 13, plancher: 2, max: 200 };
const CACHE = { plateau: 9, plancher: 2, max: 100 };

function manche(mod, q, at) {
  const rt = mod.buildRound(q);
  rt.startedAt = 1_000;
  rt.deadline = rt.startedAt + rt.durationMs;
  rt.answers = new Map([['p', { value: q.bonne, at: rt.startedAt + at }]]);
  return mod.score(rt).results.get('p');
}

describe('la courbe de rapidité', () => {
  it("REPRODUIT LES DEUX EXEMPLES DE L'ÉNONCÉ, à l'unité", () => {
    // « une réponse à 7.5sec vaudra surement 100pts de rapidité » — fenêtre de 15 s.
    expect(bonusRapidite(7.5 * 1000, COURTE)).toBe(100);
    // « une réponse à 5.5sec vaudra surement 50pts » — fenêtre de 10 s.
    expect(bonusRapidite(5.5 * 1000, CACHE)).toBe(50);
  });

  it('a un plateau haut : les premières secondes valent toutes le maximum', () => {
    // Sans lui, deux joueurs qui buzzent au dixième près se sépareraient de
    // plusieurs points pour un réflexe que rien ne distingue.
    for (const reste of [15, 14, 13]) expect(bonusRapidite(reste * 1000, COURTE)).toBe(200);
    for (const reste of [10, 9.5, 9]) expect(bonusRapidite(reste * 1000, CACHE)).toBe(100);
  });

  it('a un plancher : les dernières secondes ne rapportent rien', () => {
    // C'est ce qui distingue « répondre » de « répondre à temps ».
    for (const reste of [2, 1, 0.5, 0]) expect(bonusRapidite(reste * 1000, COURTE)).toBe(0);
    for (const reste of [2, 1, 0]) expect(bonusRapidite(reste * 1000, CACHE)).toBe(0);
  });

  it('décroît sans jamais remonter, et reste dans ses bornes', () => {
    let precedent = Infinity;
    for (let ms = 15_000; ms >= 0; ms -= 50) {
      const v = bonusRapidite(ms, COURTE);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(200);
      expect(v, `la courbe remonte à ${ms} ms`).toBeLessThanOrEqual(precedent);
      precedent = v;
    }
  });

  it('supporte une valeur absente ou aberrante sans inventer de points', () => {
    expect(bonusRapidite(null, COURTE)).toBe(0);
    expect(bonusRapidite(-5000, COURTE)).toBe(0);
    expect(bonusRapidite(NaN, COURTE)).toBe(0);
  });
});

describe('le barème des deux jeux à questions courtes', () => {
  const QUIZ = { id: 'q', text: '?', options: ['a', 'b'], correctIndex: 0, bonne: 0 };
  const VF = { id: 't', text: '?', correct: true, bonne: true };

  it('donne au quiz une fenêtre de 15 s, une base de 250 et 200 de rapidité', () => {
    expect(modules.quiz.buildRound(QUIZ).durationMs).toBe(DUREE_QUESTION_COURTE * 1000);
    const immediat = manche(modules.quiz, QUIZ, 0);
    expect(immediat.base).toBe(250);
    expect(immediat.speed).toBe(200);
    // « une réponse à 7.5sec » : la moitié du bonus, la base entière.
    const milieu = manche(modules.quiz, QUIZ, 7_500);
    expect(milieu.base).toBe(250);
    expect(milieu.speed).toBe(100);
  });

  it('donne au vrai/faux la même fenêtre et la même rapidité, mais 200 de base', () => {
    expect(modules.true_false.buildRound(VF).durationMs).toBe(DUREE_QUESTION_COURTE * 1000);
    const immediat = manche(modules.true_false, VF, 0);
    expect(immediat.base).toBe(200);
    expect(immediat.speed).toBe(200);
  });

  it('ne donne RIEN à une mauvaise réponse, ni base ni rapidité, ni pénalité', () => {
    // « Une mauvaise réponse vaut toujours 0 point. » Y compris immédiate : la
    // vitesse récompense une bonne réponse, elle ne rachète pas une fausse.
    const rate = manche(modules.quiz, { ...QUIZ, bonne: 1 }, 0);
    expect(rate.base).toBe(0);
    expect(rate.speed).toBe(0);
    expect(rate.correct).toBe(false);
  });

  it("N'ÉCOUTE PLUS la durée écrite dans la banque", () => {
    // « Fixer le temps pour répondre à 15 secondes. » La fenêtre est une règle du
    // jeu, pas un réglage : les seuils du bonus sont des SECONDES RESTANTES, et
    // « plateau jusqu'à 13 s » ne voudrait plus rien dire sur une fenêtre de 30.
    // Un ancien module de la bibliothèque porte encore `duration: 20`.
    expect(modules.quiz.buildRound({ ...QUIZ, durationSec: 30 }).durationMs).toBe(15_000);
    expect(modules.true_false.buildRound({ ...VF, durationSec: 5 }).durationMs).toBe(15_000);
  });
});
