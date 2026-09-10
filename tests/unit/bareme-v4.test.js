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

// LE TOTAL D'UNE MANCHE, recomposé à partir de ses parties.
//
// `base` ne porte plus que les points du PALIER : les bonus de l'estimation
// voyagent à part, pour que l'écran du joueur puisse montrer le calcul au lieu
// d'afficher une somme opaque. Ces contrôles lisaient `base` comme le total — ils
// disent désormais explicitement ce qu'ils additionnent.
const total = (r) => (r.base || 0) + (r.bonusExact || 0) + (r.bonusProche || 0) + (r.speed || 0);

function round(mod, q) {
  const rt = mod.buildRound(q);
  rt.startedAt = 1_000;
  rt.deadline = rt.startedAt + rt.durationMs;
  rt.answers = new Map();
  return rt;
}

describe('le complément de vitesse (action 4)', () => {
  const Q = { id: 'q', text: '?', options: ['a', 'b'], correctIndex: 0, durationSec: 20 };

  it('plafonne à 200, et une manche de quiz à 450 (séance du 10/09)', () => {
    const rt = round(modules.quiz, Q);
    rt.answers.set('immediat', { value: 0, at: rt.startedAt });
    const { results } = modules.quiz.score(rt);
    const r = results.get('immediat');
    expect(r.speed).toBe(200);
    expect(r.base + r.speed, 'le maximum d\'une manche de quiz doit être 450').toBe(450);
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
    expect(total(results.get('dessous'))).toBe(400);
    expect(total(results.get('dessus'))).toBe(400);
    // Et c'est bien un BONUS, pas un palier : la distinction est ce que l'écran
    // du joueur montre désormais.
    expect(results.get('dessous').bonusProche).toBe(400);
    expect(results.get('dessous').base).toBe(0);
  });

  it('le plus proche marque même si personne n\'est dans une plage', () => {
    // DÉCISION 5.3 — c'est sa raison d'être : sans lui, une manche où tout le monde
    // vise trop large ne rapporte rien à personne et le module devient muet.
    const rt = round(modules.estimation, CIBLE);
    rt.answers.set('loin', { value: 500, at: rt.startedAt });
    rt.answers.set('tres-loin', { value: 900, at: rt.startedAt });
    const { results } = modules.estimation.score(rt);
    expect(results.get('loin').palier).toBe('hors');
    expect(total(results.get('loin')), 'le plus proche doit marquer malgré tout').toBe(400);
    expect(total(results.get('tres-loin'))).toBe(0);
  });

  it('les bonus se cumulent, et le plus proche ne joue plus quand un palier est touché', () => {
    // A4 — « n'activer le bonus du plus proche dans Estimation uniquement si tous
    // les joueurs sont hors palier ».
    //
    // CE QUE CE CONTRÔLE DISAIT AVANT : 1000 + 200 + 400 = 1600. Le filet du plus
    // proche tombait dans la poche de qui touchait DÉJÀ le meilleur palier — un
    // supplément sans objet, puisque le barème avait déjà tranché en sa faveur.
    // Il ne se déclenche plus que là où il a été inventé : quand personne n'est
    // dans une plage et que la manche ne rapporterait rien à personne.
    //
    // LE MAXIMUM D'UNE MANCHE D'ESTIMATION PASSE DONC DE 1600 À 1200. C'est un
    // fait de jeu, pas un effet de bord : consigné ici pour qu'il ne soit jamais
    // pris pour une régression.
    const rt = round(modules.estimation, CIBLE);
    rt.answers.set('parfait', { value: 100, at: rt.startedAt });
    const { results } = modules.estimation.score(rt);
    const r = results.get('parfait');
    expect(total(r)).toBe(1200);
    expect(r.exact).toBe(true);
    // LE DÉTAIL, ET NON LA SOMME. Tout tombait dans `base` : le joueur lisait
    // « 1 600 » sans savoir d'où venaient les six cents points de plus, et le
    // barème qu'on venait de lui expliquer devenait invérifiable.
    expect({ palier: r.base, exactitude: r.bonusExact, plusProche: r.bonusProche })
      .toEqual({ palier: 1000, exactitude: 200, plusProche: 0 });
  });

  it('le filet du plus proche s\'efface dès qu\'UN SEUL joueur atteint un palier', () => {
    // La frontière exacte de A4, éprouvée des deux côtés — c'est elle qui compte,
    // pas les cas confortables.
    const rt = round(modules.estimation, CIBLE);
    rt.answers.set('dedans', { value: 108, at: rt.startedAt }); // 8 % : palier « proche »
    rt.answers.set('dehors', { value: 200, at: rt.startedAt }); // 100 % : hors
    const { results } = modules.estimation.score(rt);
    expect(results.get('dedans').palier).toBe('proche');
    expect(results.get('dedans').bonusProche, 'le mieux placé n\'a pas besoin du filet').toBe(0);
    expect(total(results.get('dehors')), 'le plus loin ne marque rien').toBe(0);

    // Le même tirage, mais SANS personne dans une plage : le filet revient.
    const rt2 = round(modules.estimation, CIBLE);
    rt2.answers.set('moins-loin', { value: 200, at: rt2.startedAt });
    rt2.answers.set('tres-loin', { value: 900, at: rt2.startedAt });
    const r2 = modules.estimation.score(rt2).results;
    expect(r2.get('moins-loin').bonusProche, 'personne dans un palier : le filet doit jouer').toBe(400);
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
  it('quiz 450 · vrai-faux 400 · estimation 1200 · vote base fixe', () => {
    const q = round(modules.quiz, { id: 'q', text: '?', options: ['a', 'b'], correctIndex: 0, durationSec: 20 });
    q.answers.set('x', { value: 0, at: q.startedAt });
    const rq = modules.quiz.score(q).results.get('x');

    const t = round(modules.true_false, { id: 't', text: '?', correct: true, durationSec: 20 });
    t.answers.set('x', { value: true, at: t.startedAt });
    const rt = modules.true_false.score(t).results.get('x');

    const e = round(modules.estimation, { id: 'e', text: '?', target: 100, durationSec: 20 });
    e.answers.set('x', { value: 100, at: e.startedAt });
    const re = modules.estimation.score(e).results.get('x');

    const maxima = { quiz: total(rq), vrai_faux: total(rt), estimation: total(re) };
    console.log(`  maximums par manche : ${JSON.stringify(maxima)}`);
    // 1200 depuis A4, et non plus 1600 : le joueur seul en lice touche son palier
    // (1000) et son exactitude (200), mais plus le filet du plus proche — il est
    // dans une plage, la manche rapporte déjà.
    //
    // LE QUIZ ET LE VRAI/FAUX ONT CHANGÉ D'ÉCHELLE le 10/09 : 250 + 200 pour le
    // premier, 200 + 200 pour le second. Ils ne valent plus la même chose, et
    // c'est voulu — on tombe juste une fois sur deux au vrai/faux en tirant à
    // pile ou face, ce que le quiz ne permet pas.
    expect(maxima).toEqual({ quiz: 450, vrai_faux: 400, estimation: 1200 });
  });
});
