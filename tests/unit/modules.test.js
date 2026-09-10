// Tests unitaires — barème et validation des 4 modules (logique pure).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
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
  // CHANTIER v4, décisions 4.1 et 4.8. Ce contrôle s'appelait « totaux inchangés »
  // et vérifiait que la décomposition du chantier v1 reproduisait exactement le
  // barème d'avant — 700 + 300. Cette propriété est PÉRIMÉE : Theodore a demandé
  // en réunion de ramener le complément à 250 « pour équilibrer le score par
  // rapport à la base de 700 ». Ce n'est pas une régression, c'est une règle qui
  // change ; le contrôle change avec elle et dit pourquoi.
  it('base de 250 et rapidité jusqu\'à 200 (séance du 10/09)', () => {
    // LE BARÈME A CHANGÉ DE VALEURS ET DE FORME. Il valait 700 de base plus un
    // complément linéaire de 250 ; il vaut désormais « une bonne réponse donne
    // 250 points de base » plus « un bonus de rapidité allant de 0 à 200 points »,
    // avec un plateau et un plancher — voir `bonusRapidite`.
    const rt = round(modules.quiz, QUIZ_Q);
    rt.answers.set('fast', { value: 1, at: rt.startedAt });
    rt.answers.set('slow', { value: 1, at: rt.deadline });
    const { results } = modules.quiz.score(rt);
    const rapide = results.get('fast');
    const lent = results.get('slow');

    expect(rapide.base).toBe(250);
    expect(lent.base).toBe(250);
    expect(rapide.speed).toBe(200);
    expect(lent.speed).toBe(0);
    // Le maximum d'une manche de quiz : 450.
    expect(rapide.base + rapide.speed).toBe(450);
    expect(lent.base + lent.speed).toBe(250);
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

// `base` ne porte plus que les points du PALIER : les bonus voyagent à part pour
// que l'écran du joueur montre le calcul au lieu d'une somme opaque.
const totalManche = (r) => (r.base || 0) + (r.bonusExact || 0) + (r.bonusProche || 0) + (r.speed || 0);

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

  // CHANTIER v4 — les paliers relatifs sont INCHANGÉS (décision 5.1). Deux bonus
  // s'y ajoutent : 200 à l'exactitude (5.5) et, DANS LE SEUL CAS OÙ PERSONNE
  // N'ATTEINT DE PALIER, 400 au plus proche (5.3, resserrée par A4).
  // Ici quelqu'un est dans une plage : le filet du plus proche ne joue pas, et
  // chaque palier vaut exactement ses points.
  it('les paliers valent des points fixes', () => {
    const rt = round(modules.estimation, ES_Q);
    rt.answers.set('mille', { value: 101, at: rt.startedAt });   // 1 %
    rt.answers.set('proche', { value: 108, at: rt.startedAt });  // 8 %
    rt.answers.set('correct', { value: 118, at: rt.startedAt }); // 18 %
    rt.answers.set('loin', { value: 128, at: rt.startedAt });    // 28 %
    rt.answers.set('hors', { value: 200, at: rt.startedAt });    // 100 %
    const { results } = modules.estimation.score(rt);
    // « mille » est le plus proche, mais des joueurs sont dans une plage : le
    // filet ne se déclenche pas. Son palier suffit.
    expect(totalManche(results.get('mille'))).toBe(1000);
    expect(totalManche(results.get('proche'))).toBe(750);
    expect(totalManche(results.get('correct'))).toBe(500);
    expect(totalManche(results.get('loin'))).toBe(250);
    expect(totalManche(results.get('hors'))).toBe(0);
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
    // « juste » est exact : 1000 de palier + 200 d'exactitude. Pas de filet du
    // plus proche — les deux joueurs sont dans une plage (A4).
    expect(totalManche(results.get('juste'))).toBe(1000 + 200);
    expect(totalManche(results.get('cent-mille-a-cote'))).toBe(750); // pas 900 : l'écart se paie
  });

  // LES PETITS NOMBRES : sans tolérance absolue, sur une cible de 3, dix pour
  // cent valent trois dixièmes — répondre 4 tomberait à 33 % d'écart, donc zéro.
  it('sur une cible à un chiffre, être à une unité près reste excellent', () => {
    const rt = round(modules.estimation, { id: 'p', text: '?', target: 3, durationSec: 20 });
    rt.answers.set('exact', { value: 3, at: rt.startedAt });
    rt.answers.set('une-unite', { value: 4, at: rt.startedAt });
    rt.answers.set('loin', { value: 30, at: rt.startedAt });
    const { results } = modules.estimation.score(rt);
    expect(totalManche(results.get('exact'))).toBe(1000 + 200);
    // Être à une unité près reste le MEILLEUR PALIER — c'est ce que ce contrôle
    // garde — mais sans l'exactitude.
    expect(totalManche(results.get('une-unite'))).toBe(1000);
    expect(totalManche(results.get('loin'))).toBe(0);
  });

  it('le seuil de série reste à 10 %, et les faits de révélation sont publiés', () => {
    const rt = round(modules.estimation, ES_Q);
    rt.answers.set('close', { value: 109, at: rt.startedAt });   // 9 % d'écart
    rt.answers.set('meh', { value: 150, at: rt.startedAt });     // 50 %
    rt.answers.set('far', { value: 1000, at: rt.startedAt });    // 900 %
    const { results, reveal } = modules.estimation.score(rt);
    expect(results.get('close').correct).toBe(true);
    expect(results.get('meh').correct).toBe(false);
    expect(totalManche(results.get('far'))).toBe(0);
    expect(reveal.stats.kind).toBe('numeric');
    expect(reveal.stats.closest).toBe(109);
    expect(reveal.stats.total).toBe(3);
  });

  // L'HISTOGRAMME : spécifié par la maquette A5, jamais construit — le serveur ne
  // calculait même pas les tranches.
  it('publie un histogramme CALÉ SUR LE BARÈME, la réponse exacte à part', () => {
    // CE CONTRÔLE A CHANGÉ D'OBJET. Il vérifiait huit tranches ÉGALES, dont les
    // bornes ne tombaient nulle part : une même barre pouvait réunir des joueurs à
    // 1 000 points et d'autres à 750. Les bornes SONT désormais celles des paliers
    // — arbitrage de l'auteur : « la largeur de l'intervalle doit coïncider avec
    // les ± 2 % ». Les tranches sont donc inégales, et c'est le but.
    const rt = round(modules.estimation, ES_Q);
    for (const [i, v] of [80, 90, 95, 100, 105, 110].entries()) {
      rt.answers.set('p' + i, { value: v, at: rt.startedAt });
    }
    const { reveal } = modules.estimation.score(rt);
    const h = reveal.stats.histogramme;

    // Personne n'est perdu : la réponse exacte est comptée À PART, parce qu'elle
    // est de largeur nulle et se dessine en trait, pas en barre.
    expect(h.exact, 'la réponse exacte devrait être comptée à part').toBe(1);
    expect(h.zones.reduce((s, z) => s + z.count, 0) + h.exact).toBe(6);

    // Chaque zone porte SON palier, et ses bornes sont celles du barème.
    for (const z of h.zones) {
      expect(['hors', 'loin', 'correct', 'proche', 'mille']).toContain(z.palier);
      expect(['g', 'd']).toContain(z.cote);
      expect(z.haut, 'une zone de largeur nulle n\'a rien à dessiner').toBeGreaterThan(z.bas);
    }
    // Les zones se suivent sans trou ni recouvrement, de min à max.
    expect(h.zones[0].bas).toBeCloseTo(h.min, 6);
    expect(h.zones[h.zones.length - 1].haut).toBeCloseTo(h.max, 6);
    for (let i = 1; i < h.zones.length; i += 1) {
      expect(h.zones[i].bas, 'trou ou recouvrement entre deux zones').toBeCloseTo(h.zones[i - 1].haut, 6);
    }
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
    // Et l'aberrante n'est pas perdue : elle est ramenée dans la zone d'extrémité.
    expect(h.zones.reduce((s, z) => s + z.count, 0) + h.exact).toBe(6);
    expect(h.zones[h.zones.length - 1].count,
      'l\'aberrante a disparu du graphique').toBeGreaterThanOrEqual(1);
  });
});

describe('vote — deux tours : ce que tu penses, puis ce que pense le cercle', () => {
  const VO_Q = { id: 'vo1', text: 'Choix ?', options: ['X', 'Y', 'Z'], durationSec: 15 };

  // Fabrique une manche à deux tours DÉJÀ ARRIVÉE AU SECOND : le premier tour est
  // mis de côté comme le fait le moteur (`tourSuivant`), le second vit dans
  // `answers`. C'est l'état exact dans lequel `score` est appelé.
  function deuxTours(sincere, pari) {
    const rt = round(modules.vote, VO_Q);
    rt.answersTour1 = new Map(Object.entries(sincere).map(([k, v]) => [k, { value: v, at: rt.startedAt }]));
    rt.tour = 2;
    rt.answers = new Map(Object.entries(pari).map(([k, v]) => [k, { value: v, at: rt.startedAt }]));
    return rt;
  }

  it('LA BONNE RÉPONSE SORT DU PREMIER TOUR, les points du second', () => {
    // L'exemple de l'énoncé, transposé : le cercle pense « Y » (deux voix contre
    // une). Marquent ceux qui ont DEVINÉ « Y » au second tour — pas ceux qui
    // l'avaient voté au premier.
    const rt = deuxTours(
      { a: 1, b: 1, c: 0 },        // ce que chacun pense : Y, Y, X → Y l'emporte
      { a: 0, b: 1, c: 1 },        // ce que chacun devine : X, Y, Y
    );
    const { results, reveal } = modules.vote.score(rt);
    expect(reveal.winners, 'la bonne réponse n\'est pas celle du premier tour').toEqual([1]);

    // `a` pensait Y mais a parié X : il ne marque pas, alors qu'il avait raison
    // au premier tour. C'est tout le jeu — on ne gagne pas en ayant bon goût.
    expect(totalManche(results.get('a'))).toBe(0);
    expect(results.get('a').correct).toBe(false);
    // `c` pensait X et a parié Y : il marque, sans être d'accord avec le cercle.
    expect(totalManche(results.get('c'))).toBe(700);
    expect(results.get('c').correct).toBe(true);
    // `b` a fait les deux : il pensait Y et l'a parié.
    expect(totalManche(results.get('b'))).toBe(700);
    expect(results.get('b').choixSincere).toBe(1);
    // Aucun complément de vitesse : on ne devine pas plus vite ce que pense la salle.
    expect(results.get('b').speed).toBe(0);
  });

  it('ne compte QUE le second tour : voter sincèrement ne rapporte rien', () => {
    // LE DÉFAUT GARDÉ : si `score` lisait `rt.answers` sans distinguer les tours,
    // il paierait les électeurs du premier — l'ancienne règle, silencieusement
    // remise en place.
    const rt = deuxTours({ seul: 0, autre: 0 }, {});
    const { results } = modules.vote.score(rt);
    expect(results.size, 'un joueur a marqué sans avoir joué le second tour').toBe(0);
  });

  it('un joueur qui n\'a joué QUE le second tour peut marquer', () => {
    // Il n'a pas dit ce qu'il pensait, il a quand même lu le cercle. Rien dans la
    // règle ne l'en empêche.
    const rt = deuxTours({ a: 0, b: 0 }, { tardif: 0 });
    const { results } = modules.vote.score(rt);
    expect(totalManche(results.get('tardif'))).toBe(700);
    expect(results.get('tardif').choixSincere).toBeNull();
  });

  it('en cas d\'égalité au premier tour, les réponses de tête gagnent toutes', () => {
    // Sinon une égalité ne produirait AUCUNE bonne réponse, et la manche ne
    // rapporterait rien à personne quoi qu'on ait parié.
    const rt = deuxTours({ a: 0, b: 1 }, { a: 0, b: 1, c: 2 });
    const { results, reveal } = modules.vote.score(rt);
    expect(reveal.winners).toEqual([0, 1]);
    expect(results.get('a').correct).toBe(true);
    expect(results.get('b').correct).toBe(true);
    expect(results.get('c').correct).toBe(false);
  });

  it('publie les DEUX décomptes — c\'est l\'histoire de la manche', () => {
    // Le premier dit ce que le cercle pense, le second s'il a su se reconnaître.
    // Sans les deux, la révélation ne répond pas à la question qu'on vient de
    // poser au cercle.
    const rt = deuxTours({ a: 1, b: 1, c: 0 }, { a: 1, b: 0, c: 1 });
    const { reveal } = modules.vote.score(rt);
    expect(reveal.stats.tally, 'le décompte de référence est celui du premier tour').toEqual([1, 2, 0]);
    expect(reveal.stats.pari.tally, 'le décompte du pari manque').toEqual([1, 2, 0]);
    expect(reveal.stats.total).toBe(3);
    expect(reveal.stats.pari.total).toBe(3);
    expect(reveal.stats.deuxTours).toBe(true);
  });

  it('LE PREMIER TOUR NE FUIT PAS dans la question publique', () => {
    // Si le décompte du premier tour atteignait un écran de joueur avant la
    // révélation, le second tour n'aurait plus rien à deviner : le jeu entier
    // tient sur ce silence.
    const rt = round(modules.vote, VO_Q);
    rt.answers.set('a', { value: 1, at: rt.startedAt });
    const publique = modules.vote.publicQuestion(rt);
    expect(JSON.stringify(publique)).not.toMatch(/tally|winners|answersTour/);
    // L'écran doit en revanche savoir À QUEL TOUR il répond, sans quoi le joueur
    // ne sait pas ce qu'on lui demande.
    expect(publique.tour).toBe(1);
    expect(publique.tours).toBe(2);
  });

  it('en mode sondage, un seul tour, personne ne gagne', () => {
    // Un sondage n'a rien à deviner : demander « que pense le cercle ? » après
    // « que penses-tu ? » sans compter les points n'aurait aucun sens.
    const rt = round(modules.vote, { ...VO_Q, poll: true });
    expect(rt.tours, 'un sondage ne doit avoir qu\'un tour').toBe(1);
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
  // LES JEUX « EN DIRECT » N'ONT PAS DE BANQUE, ET C'EST LEUR DÉFINITION.
  // « Le lien » se joue sur deux mots que l'animateur tape à l'antenne, en
  // fonction de ce qui vient de se dire. Lui réclamer vingt questions n'aurait
  // pas de sens — mais le contrôle doit le dire, pas le contourner en silence.
  const AVEC_BANQUE = MODULE_TYPES.filter((t) => modules[t].meta.direct !== true);

  it('LE STUDIO CONNAÎT TOUS LES TYPES DU SERVEUR', () => {
    // CE QUE CE CONTRÔLE A COÛTÉ DE NE PAS EXISTER. Le Studio normalise un module
    // inconnu en le convertissant EN SILENCE en « quiz ». « Le lien », dont le
    // type ne figurait pas dans son référentiel, se transformait donc en quiz vide
    // dès que l'animateur enregistrait quoi que ce soit — le jeu disparaissait de
    // son menu, sans un message, et seul un contrôle de bout en bout l'a révélé.
    //
    // Un type ajouté au serveur sans être déclaré au Studio échoue désormais ici.
    const studio = fs.readFileSync('src/client/studio/StudioApp.jsx', 'utf8');
    const bloc = studio.slice(studio.indexOf('const MODULE_TYPES = {'), studio.indexOf('const TYPE_KEYS'));
    for (const type of MODULE_TYPES) {
      expect(bloc.includes(`${type}:`), `le Studio ignore le type « ${type} » et le convertirait en quiz`).toBe(true);
    }
  });

  it('un jeu EN DIRECT est déclaré comme tel, et n\'a donc pas de banque', () => {
    const directs = MODULE_TYPES.filter((t) => modules[t].meta.direct === true);
    expect(directs, 'aucun jeu en direct — ce contrôle ne mesure plus rien').not.toHaveLength(0);
    for (const t of directs) {
      expect(demoQuestions[t], `« ${t} » est en direct mais porte une banque`).toBeUndefined();
    }
  });

  it.each(AVEC_BANQUE)('%s contient au moins 20 questions aux ids uniques', (type) => {
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


// LE DÉFILÉ EST DÉCLARÉ PAR LE MODULE, ET LE MOTEUR NE CONNAÎT PLUS AUCUN NOM DE
// JEU.
//
// CE QUI EST ARRIVÉ, ET QUE CE CONTRÔLE EMPÊCHE DE REFAIRE. Le moteur poussait la
// série des visages avec un `if (rt.type === 'visages')` écrit en dur. « Retour de
// flamme » demandant exactement le même défilé, la boucle a été généralisée sur
// `meta.defile` — et la déclaration a été posée sur le jeu NEUF en oubliant
// l'ancien. Les visages ne défilaient plus du tout : la série restait figée sur
// son premier portrait, et le jeu n'avait plus de réponse.
//
// Rien ne plantait. Le contrôle de bout en bout des visages l'a vu, mais après
// cinq minutes d'exécution ; celui-ci le voit en quelques millisecondes, et il le
// dira au prochain jeu de défilé comme il l'a dit à celui-là.
describe('les jeux à défilé le DÉCLARENT', () => {
  it('tout module dont la manche porte un `ordre` déclare son défilé', () => {
    for (const type of MODULE_TYPES) {
      const mod = modules[type];
      let rt;
      try { rt = mod.buildRound({ id: 'q' }); } catch { continue; }
      if (!Array.isArray(rt.ordre)) continue;
      // DEUX FAÇONS DE POUSSER UNE SÉRIE, et le moteur les connaît toutes les deux.
      //   - `defile` : une CADENCE régulière, une image après l'autre, sans blanc.
      //     C'est le cas des visages et de « Retour de flamme ».
      //   - `devoilementGrille` : un HORAIRE irrégulier, où chaque objet s'allume
      //     puis s'éteint avec un intervalle noir entre deux. C'est
      //     « Cache-cache », dont la série ne tient pas dans une cadence : trois
      //     secondes visibles, une seconde de noir, et une ouverture de trois
      //     secondes avant la première.
      // Ce qui reste interdit, c'est de produire un `ordre` sans déclarer NI l'un
      // NI l'autre : le moteur ne pousserait jamais rien, et l'écran resterait
      // vide sans que rien ne le signale.
      if (mod.meta.devoilementGrille) {
        expect(rt.matrice, `« ${type} » dévoile une grille mais n'en produit pas`).toBeDefined();
        expect(rt.ordre.length, `« ${type} » : l'ordre de dévoilement ne couvre pas la grille`)
          .toBe(rt.matrice.length);
        continue;
      }
      const defile = mod.meta.defile;
      expect(defile, `« ${type} » produit une série mais ne déclare aucun défilé : le moteur ne la poussera jamais`).toBeDefined();
      expect(defile.cadenceMs, `« ${type} » : cadence de défilé absente`).toBeGreaterThan(0);
      // Le défilé doit couvrir la série ENTIÈRE : un total plus court laisserait
      // les dernières images à quai, un plus long désignerait des places vides.
      expect(defile.total, `« ${type} » : le défilé ne couvre pas sa série`).toBe(rt.ordre.length);
      // Et la manche dure exactement le temps du défilé.
      expect(rt.durationMs, `« ${type} » : la manche ne dure pas le temps de sa série`)
        .toBe(defile.total * defile.cadenceMs);
    }
  });

  it('un seul module accepte plusieurs réponses, et il déclare aussi son défilé', () => {
    // `multi` change le comportement du moteur pour TOUS les joueurs de la manche.
    // Il ne s'accorde pas à la légère, et jamais à un jeu sans images qui passent :
    // c'est le défilé qui donne un sens à « plusieurs buzz ».
    const multi = MODULE_TYPES.filter((t) => modules[t].meta.multi === true);
    expect(multi).toEqual(['retour_flamme']);
    for (const t of multi) expect(modules[t].meta.defile).toBeDefined();
  });
});
