// LE BARÈME DU CHANTIER v4 — actions 4 et 5.
//
// Deux changements de règle, pas des corrections de défaut :
//   - le complément de vitesse passe de 300 à 250, et le supplément du plus
//     rapide disparaît du calcul : une manche de quiz plafonne à 950 (et non
//     1150). Le plus rapide reste NOMMÉ, comme la série — pour l'honneur ;
//   - l'estimation gagne deux bonus cumulables et un second jeu de plages,
//     réservé aux ANNÉES.
//
// POURQUOI LES ANNÉES ONT LEURS PROPRES PLAGES. Un pourcentage n'a aucun sens sur
// une année : 2 % de 1789 valent PRÈS DE TRENTE-SIX ANS. Répondre 1753 tombait donc
// « dans le mille » et rapportait le maximum — le premier palier était trois fois
// plus large que le siècle. C'est ce chiffre-là, énoncé en réunion, qui a
// justifié le second jeu ; c'est lui que ce fichier vérifie.
import { describe, it, expect } from 'vitest';
import { modules } from '../../src/server/modules.js';

function round(mod, q) {
  const rt = mod.buildRound(q);
  rt.startedAt = 1_000;
  rt.deadline = rt.startedAt + rt.durationMs;
  rt.answers = new Map();
  return rt;
}

describe('le complément de vitesse (action 4)', () => {
  const Q = { id: 'q', text: '?', options: ['a', 'b'], correctIndex: 0, durationSec: 20 };

  it('plafonne à 250, et une manche de quiz à 950', () => {
    const rt = round(modules.quiz, Q);
    rt.answers.set('immediat', { value: 0, at: rt.startedAt });
    const { results } = modules.quiz.score(rt);
    const r = results.get('immediat');
    expect(r.speed).toBe(250);
    expect(r.base + r.speed, 'le maximum d\'une manche de quiz doit être 950').toBe(950);
  });
});

describe('l\'estimation (action 5)', () => {
  const CIBLE = { id: 'e', text: '?', target: 100, durationSec: 20 };
  const ANNEE = { id: 'a', text: '?', target: 1789, nature: 'annee', durationSec: 20 };

  it('sur une ANNÉE, les plages sont en années et non en pourcentage', () => {
    const rt = round(modules.estimation, ANNEE);
    rt.answers.set('exact', { value: 1789, at: rt.startedAt });
    rt.answers.set('deux-ans', { value: 1791, at: rt.startedAt });
    rt.answers.set('cinq-ans', { value: 1794, at: rt.startedAt });
    rt.answers.set('dix-ans', { value: 1799, at: rt.startedAt });
    rt.answers.set('trente-six-ans', { value: 1753, at: rt.startedAt });
    const { results } = modules.estimation.score(rt);

    expect(results.get('deux-ans').palier).toBe('proche');
    expect(results.get('cinq-ans').palier).toBe('correct');
    expect(results.get('dix-ans').palier).toBe('loin');
    // LE CHIFFRE DE LA RÉUNION. 1753 est à 36 ans de 1789, soit 2 % — il tombait
    // « dans le mille » et rapportait 1000 points. Il ne rapporte plus rien.
    expect(results.get('trente-six-ans').palier,
      '1753 sur 1789 doit être hors plage : 36 ans d\'écart').toBe('hors');
    expect(results.get('trente-six-ans').base).toBe(0);
  });

  it('la nature est DÉCLARÉE, jamais devinée de la valeur', () => {
    // DÉCISION 5.9 — 1789 peut être un nombre d'habitants. Sans déclaration, on
    // reste en plages relatives : c'est le comportement d'aujourd'hui, donc les
    // questions existantes ne changent pas de règle (décision 5.10).
    const rt = round(modules.estimation, { id: 'h', text: '?', target: 1789, durationSec: 20 });
    // 1755 est à 34 de 1789, soit 1,9 % — franchement dans le premier palier.
    // (2 % de 1789 valent 35,8 : 36 d'écart tomberait tout juste à côté, ce qui
    // rendrait ce contrôle illisible pour une raison sans rapport avec son objet.)
    rt.answers.set('a', { value: 1755, at: rt.startedAt });
    const { results } = modules.estimation.score(rt);
    expect(results.get('a').palier,
      'sans nature déclarée, 1789 reste un nombre et 34 d\'écart valent 1,9 %').toBe('mille');
  });

  it('le bonus du plus proche va à TOUS les ex æquo', () => {
    // DÉCISION 5.4 — même principe que l'égalité au vote : une égalité parfaite ne
    // doit pas produire un vainqueur arbitraire.
    const rt = round(modules.estimation, CIBLE);
    rt.answers.set('dessous', { value: 60, at: rt.startedAt });
    rt.answers.set('dessus', { value: 140, at: rt.startedAt });
    const { results } = modules.estimation.score(rt);
    // Les deux sont à 40 d'écart : hors plage (40 %), donc zéro de palier, mais
    // tous deux les plus proches.
    expect(results.get('dessous').base).toBe(400);
    expect(results.get('dessus').base).toBe(400);
  });

  it('le plus proche marque même si personne n\'est dans une plage', () => {
    // DÉCISION 5.3 — c'est sa raison d'être : sans lui, une manche où tout le monde
    // vise trop large ne rapporte rien à personne et le module devient muet.
    const rt = round(modules.estimation, CIBLE);
    rt.answers.set('loin', { value: 500, at: rt.startedAt });
    rt.answers.set('tres-loin', { value: 900, at: rt.startedAt });
    const { results } = modules.estimation.score(rt);
    expect(results.get('loin').palier).toBe('hors');
    expect(results.get('loin').base, 'le plus proche doit marquer malgré tout').toBe(400);
    expect(results.get('tres-loin').base).toBe(0);
  });

  it('les bonus se cumulent, sans plafond', () => {
    // DÉCISION 5.6 — 1000 + 200 + 400 = 1600, quand un quiz plafonne à 950. Écart
    // accepté par l'auteur en connaissance de cause : c'est consigné ici pour
    // qu'il ne soit jamais pris pour un défaut.
    const rt = round(modules.estimation, CIBLE);
    rt.answers.set('parfait', { value: 100, at: rt.startedAt });
    const { results } = modules.estimation.score(rt);
    expect(results.get('parfait').base).toBe(1600);
    expect(results.get('parfait').exact).toBe(true);
  });

  // DÉCISION 5.12 — LES ÉCHELLES EXTRÊMES. Un barème en pourcentage se comporte
  // très différemment selon l'ordre de grandeur de la cible : c'est justement ce
  // qui a rendu les années fautives. Ces trois cas fixent les deux bouts de
  // l'échelle et le cas de l'aberration.
  it('sur une cible d\'un MILLION, les plages restent relatives', () => {
    const rt = round(modules.estimation, { id: 'm', text: '?', target: 1_000_000, durationSec: 20 });
    rt.answers.set('deux-pourcent', { value: 990_000, at: rt.startedAt });   // 1 %
    rt.answers.set('dix-pourcent', { value: 1_090_000, at: rt.startedAt });  // 9 %
    rt.answers.set('hors', { value: 1_400_000, at: rt.startedAt });          // 40 %
    const { results } = modules.estimation.score(rt);
    expect(results.get('deux-pourcent').palier).toBe('mille');
    expect(results.get('dix-pourcent').palier).toBe('proche');
    expect(results.get('hors').palier).toBe('hors');
  });

  it('sur une cible À UN CHIFFRE, la tolérance d\'une unité sauve la réponse', () => {
    // 2 % de 6 valent 0,12 : sans tolérance absolue, répondre 7 sur une cible de 6
    // ne rapporterait RIEN — sur une question à laquelle on ne peut pas répondre
    // plus près. C'est la décision 5 de l'action 13 du chantier v1, conservée
    // telle quelle (décision 5.2).
    const rt = round(modules.estimation, { id: 'c', text: '?', target: 6, durationSec: 20 });
    rt.answers.set('a-un-pres', { value: 7, at: rt.startedAt });
    rt.answers.set('a-deux-pres', { value: 8, at: rt.startedAt });
    const { results } = modules.estimation.score(rt);
    expect(results.get('a-un-pres').palier,
      'une unité d\'écart sur une cible de 6 doit valoir le premier palier').toBe('mille');
    // Et deux unités ne bénéficient pas de la tolérance : 33 % d'écart, hors plage.
    expect(results.get('a-deux-pres').palier).toBe('hors');
  });

  it('une valeur ABERRANTE ne rapporte rien et ne casse rien', () => {
    const rt = round(modules.estimation, { id: 'a', text: '?', target: 100, durationSec: 20 });
    rt.answers.set('juste', { value: 100, at: rt.startedAt });
    rt.answers.set('aberrante', { value: 1e12, at: rt.startedAt });
    const { results, reveal } = modules.estimation.score(rt);
    expect(results.get('aberrante').palier).toBe('hors');
    expect(results.get('aberrante').base).toBe(0);
    // L'histogramme survit : l'aberrante est RAMENÉE dans la zone d'extrémité,
    // elle n'étire pas l'échelle et n'écrase pas les autres.
    const h = reveal.stats.histogramme;
    expect(h.zones.reduce((s, z) => s + z.count, 0) + h.exact,
      'une estimation a disparu de l\'histogramme').toBe(2);
    expect(Number.isFinite(reveal.stats.avg)).toBe(true);
  });

  it('désigne les joueurs les plus proches, pas seulement la valeur', () => {
    // DÉCISION 6.1 — un seul calcul sert au bonus ET à l'affichage du nom chez
    // l'animateur. Deux définitions du « plus proche » finiraient par diverger.
    const rt = round(modules.estimation, CIBLE);
    rt.answers.set('p1', { value: 99, at: rt.startedAt });
    rt.answers.set('p2', { value: 101, at: rt.startedAt });
    rt.answers.set('p3', { value: 200, at: rt.startedAt });
    const { prives, reveal } = modules.estimation.score(rt);
    expect(prives.plusProches.sort()).toEqual(['p1', 'p2']);
    // DÉCISION 6.3 — les stats PUBLIQUES gardent la valeur, jamais un nom.
    expect(reveal.stats.closest).toBe(99);
    expect(JSON.stringify(reveal)).not.toContain('p1');
  });
});

// LE TABLEAU DES MAXIMUMS (décisions 4.9 et 5.13). Consigné dans un contrôle et
// non dans un commentaire : un tableau qui vit dans la suite ne peut pas devenir
// faux en silence.
describe('les maximums par module, consignés', () => {
  it('quiz 950 · vrai-faux 950 · estimation 1600 · vote base fixe', () => {
    const q = round(modules.quiz, { id: 'q', text: '?', options: ['a', 'b'], correctIndex: 0, durationSec: 20 });
    q.answers.set('x', { value: 0, at: q.startedAt });
    const rq = modules.quiz.score(q).results.get('x');

    const t = round(modules.true_false, { id: 't', text: '?', correct: true, durationSec: 20 });
    t.answers.set('x', { value: true, at: t.startedAt });
    const rt = modules.true_false.score(t).results.get('x');

    const e = round(modules.estimation, { id: 'e', text: '?', target: 100, durationSec: 20 });
    e.answers.set('x', { value: 100, at: e.startedAt });
    const re = modules.estimation.score(e).results.get('x');

    const maxima = {
      quiz: rq.base + rq.speed,
      vrai_faux: rt.base + rt.speed,
      estimation: re.base + re.speed,
    };
    console.log(`  maximums par manche : ${JSON.stringify(maxima)}`);
    expect(maxima).toEqual({ quiz: 950, vrai_faux: 950, estimation: 1600 });
  });
});
