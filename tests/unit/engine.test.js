// Tests unitaires — moteur de révélation : base + complément de vitesse, série,
// places, rang masqué. Plus aucune pénalité (T1), la série ne rapporte rien (T3).
import { describe, it, expect, beforeEach } from 'vitest';
import { modules } from '../../src/server/modules.js';
import { roomManager, RoomState } from '../../src/server/rooms.js';
import * as engine from '../../src/server/engine.js';
import { GRILLES_DESSINS } from '../../src/server/dessins-grilles.js';
import { copisteDe, gribouillis } from '../outils/copiste.js';

// Faux io : capture chaque emit avec sa cible (room, canal staff ou socket joueur).
function mockIo() {
  const emitted = [];
  return {
    emitted,
    to(target) {
      return { emit: (ev, payload) => emitted.push({ target, ev, payload }) };
    },
  };
}

const QUIZ_Q = { id: 'q1', text: 'Q ?', options: ['A', 'B', 'C', 'D'], correctIndex: 1, durationSec: 20 };

function setRound(room, moduleType, q, answers) {
  const rt = modules[moduleType].buildRound(q);
  rt.answers = new Map(answers);
  rt.startedAt = Date.now() - 5000;
  rt.deadline = Date.now() + 15000;
  rt.revealed = false;
  rt.closed = false;
  room.currentModule = rt;
  room.state = RoomState.PLAYING;
  return rt;
}

describe('engine.reveal', () => {
  let io, room, a, b, c;

  beforeEach(() => {
    io = mockIo();
    room = roomManager.createRoom('owner');
    a = roomManager.addPlayer(room, 'Alice');
    b = roomManager.addPlayer(room, 'Bob');
    c = roomManager.addPlayer(room, 'Chloe');
    for (const [i, p] of [a, b, c].entries()) { p.connected = true; p.socketId = 's' + i; }
  });

  function youOf(player) {
    return io.emitted.find((e) => e.target === player.socketId && e.ev === 'play:you')?.payload;
  }

  it('applique base + complément de vitesse, sans aucune pénalité, et n\'envoie JAMAIS de rang', () => {
    const t0 = Date.now() - 5000; // = startedAt posé par setRound
    setRound(room, 'quiz', QUIZ_Q, [
      [a.id, { value: 1, at: t0 }],           // bonne, la plus rapide
      [b.id, { value: 1, at: t0 + 4000 }],    // bonne, plus lente
      [c.id, { value: 0, at: t0 + 1000 }],    // mauvaise
    ]);
    engine.reveal(io, room);

    const ya = youOf(a), yb = youOf(b), yc = youOf(c);
    // La base ne dépend plus de la rapidité : c'est le complément qui départage.
    expect(ya.base).toBe(yb.base);
    expect(ya.speed).toBeGreaterThan(yb.speed);
    expect(ya.speed).toBeGreaterThanOrEqual(150);       // supplément du plus rapide
    // Mauvaise réponse : zéro point, aucune pénalité (T1).
    expect(yc.base).toBe(0);
    expect(yc.speed).toBe(0);
    expect(yc.delta).toBe(0);
    expect(yc.score).toBe(0);
    // Les champs de l'ancien barème ont disparu du contrat.
    for (const y of [ya, yb, yc]) {
      expect(y).not.toHaveProperty('bonus');
      expect(y).not.toHaveProperty('malus');
    }
    expect(ya.streak).toBe(1);
    expect(yc.streak).toBe(0);
    for (const y of [ya, yb, yc]) {
      expect(y).not.toHaveProperty('rank');             // rang jamais envoyé en cours de partie
      expect(y).toHaveProperty('placesDelta');
    }
  });

  it('la série est comptée mais ne rapporte plus rien', () => {
    a.streak = 1; // une bonne réponse déjà en poche
    setRound(room, 'quiz', QUIZ_Q, [[a.id, { value: 1, at: Date.now() - 4000 }]]);
    engine.reveal(io, room);
    const ya = youOf(a);
    expect(ya.streak).toBe(2);
    // Le total reste base + complément : la série n'y ajoute pas un point.
    expect(ya.delta).toBe(ya.base + ya.speed);
  });

  it('la série se rompt aussi quand le joueur ne répond pas', () => {
    a.streak = 4;
    setRound(room, 'quiz', QUIZ_Q, []); // manche lancée, personne ne répond
    engine.reveal(io, room);
    const ya = youOf(a);
    expect(ya.streak).toBe(0);
    // Rompue, mais gratuite : une absence ne coûte aucun point.
    expect(ya.delta).toBe(0);
  });

  it('le classement part sur le canal :staff, jamais sur la room globale', () => {
    setRound(room, 'quiz', QUIZ_Q, [[a.id, { value: 1, at: Date.now() - 4000 }]]);
    engine.reveal(io, room);
    const leaderboardEmits = io.emitted.filter((e) => e.ev === 'leaderboard:update');
    expect(leaderboardEmits.length).toBeGreaterThan(0);
    for (const e of leaderboardEmits) expect(e.target).toBe(room.code + ':staff');
    const roomState = io.emitted.find((e) => e.target === room.code && e.ev === 'room:state');
    expect(roomState.payload).not.toHaveProperty('leaderboard');
  });

  it('diffuse la bonne réponse et les stats à tout le salon à la révélation', () => {
    setRound(room, 'quiz', QUIZ_Q, [[a.id, { value: 1, at: Date.now() - 4000 }]]);
    engine.reveal(io, room);
    const reveal = io.emitted.find((e) => e.target === room.code && e.ev === 'module:reveal');
    expect(reveal.payload.correctIndex).toBe(1);
    expect(reveal.payload.stats.kind).toBe('options');
  });

  it('placesDelta reflète les places gagnées', () => {
    // Bob devant avant la manche, mais d'assez peu pour qu'une bonne réponse de
    // quiz suffise à le doubler. Le repère était 500, calibré sur l'ancien barème
    // (700 de base) ; depuis le 10/09 une manche de quiz vaut 250 + rapidité, et
    // 500 était devenu hors d'atteinte — le contrôle ne mesurait plus les places
    // gagnées mais l'échelle des points.
    b.score = 300;
    const rt = setRound(room, 'quiz', QUIZ_Q, [[a.id, { value: 1, at: Date.now() - 4000 }]]);
    engine.reveal(io, room);
    const ya = youOf(a);
    expect(ya.placesDelta).toBeGreaterThan(0); // Alice passe devant Bob
  });

  it('un SONDAGE laisse la série intacte, ne note personne — et ne rapporte AUCUN point', () => {
    // « Quand les joueurs jouent à sondage ils ne devraient pas gagner de point »
    // (07/10). Chaque réponse valait 100 points de présence, ajoutés au total
    // pendant que l'écran du joueur affirmait « Position inchangée ».
    a.streak = 3;
    a.score = 500; b.score = 550;
    const VO = { id: 'vo', text: '?', options: ['X', 'Y'], durationSec: 10, poll: true };
    setRound(room, 'vote', VO, [[a.id, { value: 0, at: Date.now() - 2000 }]]);
    engine.reveal(io, room);
    const ya = youOf(a);
    expect(ya.base, 'un sondage a payé sa participation').toBe(0);
    expect(ya.delta).toBe(0);
    expect(ya.speed).toBe(0);
    expect(ya.score, 'le total a bougé sur un sondage').toBe(500);
    // Alice était derrière Bob, elle y reste : 100 points l'auraient fait passer devant.
    expect(ya.placesDelta, 'un sondage a remué le classement').toBe(0);
    expect(ya.streak).toBe(3); // ni nourrie, ni rompue
  });

  it('LA CATÉGORIE « Sondage » NE RAPPORTE RIEN, quelle que soit la façon dont la question a été écrite', () => {
    // Le Studio écrit `categorie: 'sondage'` ; les questions d'avant le 26/09
    // portent `poll: true`. Les deux chemins, et aucun point sur aucun.
    for (const q of [
      { id: 'vs1', text: '?', options: ['X', 'Y'], durationSec: 10, categorie: 'sondage' },
      { id: 'vs2', text: '?', options: ['X', 'Y'], durationSec: 10, poll: true, categorie: 'vie' },
    ]) {
      io.emitted.length = 0;
      a.score = 0; b.score = 0;
      setRound(room, 'vote', q, [[a.id, { value: 0, at: Date.now() - 2000 }], [b.id, { value: 1, at: Date.now() - 1000 }]]);
      engine.reveal(io, room);
      for (const p of [a, b]) {
        expect(youOf(p).delta, `${q.id} : un sondage a rapporté des points`).toBe(0);
        expect(p.score).toBe(0);
      }
    }
  });

  it('un VOTE-JEU nourrit la série pour qui a LU LE CERCLE, la rompt pour les autres', () => {
    // LE VOTE SE JOUE EN DEUX TOURS. Le premier dit ce que le cercle pense, le
    // second demande de le deviner — et c'est le second seul qui compte. Ce
    // contrôle vérifiait l'ancienne règle (« être dans la majorité ») ; il vérifie
    // maintenant la nouvelle, sur le même mécanisme de série.
    a.streak = 2; b.streak = 2;
    const VO = { id: 'vo', text: '?', options: ['X', 'Y'], durationSec: 10 };
    // Le second tour est celui que porte `answers` — le premier a été mis de côté.
    const rt = setRound(room, 'vote', VO, [
      [a.id, { value: 0, at: Date.now() - 3000 }],   // devine X — juste
      [b.id, { value: 1, at: Date.now() - 3000 }],   // devine Y — à côté
      [c.id, { value: 0, at: Date.now() - 2000 }],
    ]);
    rt.tour = 2;
    rt.answersTour1 = new Map([
      [a.id, { value: 0, at: 0 }],
      [b.id, { value: 0, at: 0 }],   // le cercle pense X, à deux voix contre une
      [c.id, { value: 1, at: 0 }],
    ]);
    engine.reveal(io, room);
    const ya = youOf(a), yb = youOf(b);
    expect(ya.streak).toBe(3);  // a deviné juste : la série continue
    expect(yb.streak).toBe(0);  // a mal lu le cercle : elle se rompt
    // Mais elle ne coûte aucun point : zéro, pas moins que zéro.
    expect(yb.delta).toBe(0);
    // Et aucun supplément de rapidité, même pour le premier arrivé.
    expect(ya.speed).toBe(0);
  });

  it('LE PREMIER TOUR NE RÉVÈLE RIEN : il ouvre le second', () => {
    // LE DÉFAUT GARDÉ, ET IL VIDERAIT LE JEU. L'échéance du chrono révélait
    // jusqu'ici la manche ; sur un vote, elle doit ouvrir le second tour. Si elle
    // révélait, la bonne réponse s'afficherait avant qu'on ait demandé de la
    // deviner — le second tour n'aurait plus d'objet.
    const VO = { id: 'vo2', text: '?', options: ['X', 'Y'], durationSec: 10 };
    const rt = setRound(room, 'vote', VO, [[a.id, { value: 0, at: Date.now() }]]);
    expect(rt.tour).toBe(1);
    engine.finDeFenetre(io, room);
    expect(rt.revealed, 'le premier tour a révélé la réponse').toBeFalsy();
    expect(rt.tour, 'le second tour ne s\'est pas ouvert').toBe(2);
    // Les réponses du premier tour sont MISES DE CÔTÉ, jamais perdues : elles
    // portent la bonne réponse.
    expect(rt.answersTour1.size).toBe(1);
    expect(rt.answers.size, 'le second tour ne repart pas à zéro').toBe(0);
    // Et la seconde fin de fenêtre, elle, révèle.
    engine.finDeFenetre(io, room);
    expect(rt.revealed).toBe(true);
  });

  it('submitAnswer refuse à la deadline exacte, les doublons et les inconnus', () => {
    const rt = setRound(room, 'quiz', QUIZ_Q, []);
    expect(engine.submitAnswer(io, room, a.id, 1).ok).toBe(true);
    expect(engine.submitAnswer(io, room, a.id, 2)).toEqual({ ok: false, reason: 'already' });
    expect(engine.submitAnswer(io, room, 'ghost', 1)).toEqual({ ok: false, reason: 'unknown-player' });
    rt.deadline = Date.now();
    expect(engine.submitAnswer(io, room, b.id, 1)).toEqual({ ok: false, reason: 'closed' });
  });

  it('endGame publie le podium à tous et le rang final à chaque joueur', () => {
    a.score = 300; b.score = 200; c.score = 100;
    engine.endGame(io, room);
    const ended = io.emitted.find((e) => e.target === room.code && e.ev === 'game:ended');
    expect(ended.payload.podium).toHaveLength(3);
    const ya = io.emitted.find((e) => e.target === a.socketId && e.ev === 'play:you').payload;
    expect(ya.rank).toBe(1);
    expect(ya.final).toBe(true);
  });
});

// ============================================================
// « CUEILLETTE » — LE COUP DE CŒUR DE L'ANIMATEUR (07/10)
// ============================================================
// « Après la notation du jeu, l'animateur doit avoir la possibilité de désigner un
// coup de cœur. Il remplacerait donc sa note par la note du meilleur joueur. (Le
// meilleur joueur conserverait sa note.) »
describe('engine.coupDeCoeur', () => {
  let io, room, a, b, c, rt;
  const CIBLE = Object.keys(GRILLES_DESSINS)[0];
  const dessin = (traits) => modules.cueillette.validateAnswer({ tour: 2 }, traits);

  beforeEach(() => {
    io = mockIo();
    room = roomManager.createRoom('owner');
    a = roomManager.addPlayer(room, 'Alice');    // dessin fidèle — le meilleur
    b = roomManager.addPlayer(room, 'Bob');      // gribouillis — zéro
    c = roomManager.addPlayer(room, 'Chloe');    // dessin approché
    for (const [i, p] of [a, b, c].entries()) { p.connected = true; p.socketId = 's' + i; }
    rt = setRound(room, 'cueillette', { id: 'cu', dessinId: CIBLE }, [
      [a.id, { value: dessin(copisteDe(GRILLES_DESSINS[CIBLE])), at: Date.now() - 3000 }],
      [b.id, { value: dessin(gribouillis({ graine: 7, traits: 4, points: 20 })), at: Date.now() - 3000 }],
      [c.id, { value: dessin(copisteDe(GRILLES_DESSINS[CIBLE], { bruit: 0.05 })), at: Date.now() - 3000 }],
    ]);
    rt.tour = 2;
    // Des totaux d'avant la manche, pour que les places aient un sens.
    a.score = 3000; b.score = 2500; c.score = 2000;
    engine.reveal(io, room);
    io.emitted.length = 0;
  });

  const idxDe = (p) => rt.dessins.findIndex((d) => d.pid === p.id);
  const pointsDe = (p) => rt.dessins[idxDe(p)].points;
  const dernierYou = (p) => io.emitted.filter((e) => e.target === p.socketId && e.ev === 'play:you').at(-1)?.payload;

  it('le dessin choisi prend la note du meilleur ; le meilleur garde la sienne', () => {
    const meilleur = pointsDe(a);
    const avantB = pointsDe(b);
    expect(meilleur, 'le jeu de test doit séparer les dessins').toBeGreaterThan(avantB);
    const scoreA = a.score; const scoreB = b.score;
    const r = engine.coupDeCoeur(io, room, idxDe(b));
    expect(r.ok).toBe(true);
    expect(b.score - scoreB, 'Bob n’a pas reçu la note du meilleur').toBe(meilleur - avantB);
    expect(a.score, 'le meilleur a perdu ou gagné des points').toBe(scoreA);
    // SON TÉLÉPHONE LE SAIT, et le calcul se lit : la base de son dessin, plus
    // l'écart que le coup de cœur a comblé.
    const yb = dernierYou(b);
    expect(yb.coupDeCoeur).toBe(true);
    expect(yb.bonusCoeur).toBe(meilleur - avantB);
    expect(yb.base + yb.bonusCoeur, 'la note de manche n’est pas celle du meilleur').toBe(meilleur);
    expect(yb.delta).toBe(meilleur);
    expect(yb.score).toBe(b.score);
    expect(yb.roundId, 'le relevé corrigé ne porte plus sa manche').toBe(rt.roundId);
    // LA RESSEMBLANCE NE CHANGE PAS : c'est une mesure.
    expect(yb.pourcent).toBe(rt.dessins[idxDe(b)].pourcent);
    // Le relevé mémorisé aussi : un joueur qui se reconnecte doit le retrouver.
    expect(b.lastResult.coupDeCoeur).toBe(true);
    // Le classement de l'animateur et du stream, et la console.
    expect(io.emitted.some((e) => e.ev === 'leaderboard:update')).toBe(true);
    const confirme = io.emitted.find((e) => e.ev === 'host:coupDeCoeur');
    expect(confirme.target).toBe(room.code + ':host');
    expect(confirme.payload).toMatchObject({ roundId: rt.roundId, idx: idxDe(b), points: meilleur });
  });

  it('UN SEUL PAR MANCHE : en désigner un autre rend au précédent sa note', () => {
    const scoreB = b.score; const scoreC = c.score;
    engine.coupDeCoeur(io, room, idxDe(b));
    engine.coupDeCoeur(io, room, idxDe(c));
    expect(b.score, 'le précédent coup de cœur a gardé ses points').toBe(scoreB);
    expect(dernierYou(b).coupDeCoeur).toBe(false);
    expect(dernierYou(b).bonusCoeur).toBe(0);
    expect(dernierYou(b).delta).toBe(pointsDe(b));
    expect(c.score - scoreC).toBe(pointsDe(a) - pointsDe(c));
    expect(dernierYou(c).coupDeCoeur).toBe(true);
  });

  it('se retire : `null` rend à chacun sa note d’origine', () => {
    const scores = [a.score, b.score, c.score];
    engine.coupDeCoeur(io, room, idxDe(b));
    engine.coupDeCoeur(io, room, null);
    expect([a.score, b.score, c.score]).toEqual(scores);
    expect(rt.coupDeCoeur).toBe(null);
    expect(io.emitted.filter((e) => e.ev === 'host:coupDeCoeur').at(-1).payload.idx).toBe(null);
  });

  it('sur le meilleur lui-même, il est désigné mais ne change aucun point', () => {
    const scoreA = a.score;
    engine.coupDeCoeur(io, room, idxDe(a));
    expect(a.score).toBe(scoreA);
    expect(dernierYou(a).coupDeCoeur).toBe(true);
    expect(dernierYou(a).bonusCoeur).toBe(0);
  });

  it('LES PLACES SUIVENT : celui qui monte en fait descendre un autre, et son écran le dit', () => {
    // Avant la manche : Alice 3000, Bob 2500, Chloé 2000. Après la révélation,
    // Chloé (≈ +1080) passe devant Bob (+0). Le coup de cœur de Bob le remet devant.
    const avantB = b.lastResult.placesDelta; const avantC = c.lastResult.placesDelta;
    expect(avantC, 'le scénario suppose que Chloé est passée devant Bob').toBeGreaterThan(0);
    engine.coupDeCoeur(io, room, idxDe(b));
    expect(dernierYou(b).placesDelta).toBeGreaterThan(avantB);
    expect(dernierYou(c), 'Chloé a perdu une place sans que son écran le sache').toBeDefined();
    expect(dernierYou(c).placesDelta).toBeLessThan(avantC);
  });

  it('refuse ce qui n’est pas un dessin de la manche révélée — et ne touche alors à aucun score', () => {
    const scores = () => [a.score, b.score, c.score];
    const avant = scores();
    expect(engine.coupDeCoeur(io, room, 99).ok).toBe(false);
    expect(engine.coupDeCoeur(io, room, -1).ok).toBe(false);
    expect(engine.coupDeCoeur(io, room, 'x').ok).toBe(false);
    expect(scores()).toEqual(avant);
    // Une manche d'un autre jeu.
    setRound(room, 'quiz', QUIZ_Q, [[a.id, { value: 1, at: Date.now() }]]);
    engine.reveal(io, room);
    const avantQuiz = scores();
    expect(engine.coupDeCoeur(io, room, 0).ok).toBe(false);
    expect(scores()).toEqual(avantQuiz);
  });

  // ---- À L'ANTENNE (11/10) — « le coup de cœur doit aussi apparaître sur le
  // stream si l'animateur a décidé d'un coup de cœur ».
  const versStaff = (ev) => io.emitted.filter((e) => e.target === room.code + ':staff' && e.ev === ev);

  it('À L’ANTENNE : le désigner le montre en grand, avec son auteur et la mention — et le nomme au stream', () => {
    engine.coupDeCoeur(io, room, idxDe(b));
    const p = versStaff('cueillette:partage').at(-1)?.payload;
    expect(p, 'le coup de cœur n’est pas parti à l’antenne').toBeDefined();
    expect(p).toMatchObject({ roundId: rt.roundId, idx: idxDe(b), coupDeCoeur: true });
    expect(p.dessin.pseudo).toBe('Bob');
    expect(p.dessin, 'la note est partie à l’antenne').not.toHaveProperty('points');
    const c = versStaff('cueillette:coupDeCoeur').at(-1)?.payload;
    expect(c).toEqual({ roundId: rt.roundId, idx: idxDe(b), pseudo: 'Bob' });
    expect(JSON.stringify(c), 'des points sont partis au stream').not.toMatch(/points|gain/);
  });

  it('il se déplace à l’antenne, et en sort quand on le retire', () => {
    engine.coupDeCoeur(io, room, idxDe(b));
    engine.coupDeCoeur(io, room, idxDe(c));
    expect(versStaff('cueillette:partage').at(-1).payload).toMatchObject({ idx: idxDe(c), coupDeCoeur: true });
    expect(versStaff('cueillette:coupDeCoeur').at(-1).payload.pseudo).toBe('Chloe');
    engine.coupDeCoeur(io, room, null);
    expect(versStaff('cueillette:partage').at(-1).payload.dessin, 'le coup de cœur retiré est resté à l’antenne').toBe(null);
    expect(versStaff('cueillette:coupDeCoeur').at(-1).payload).toEqual({ roundId: rt.roundId, idx: null, pseudo: null });
  });

  it('un autre dessin partagé ensuite le remplace à l’antenne — et le retirer alors ne coupe pas ce dessin-là', () => {
    engine.coupDeCoeur(io, room, idxDe(b));
    engine.partagerDessin(io, room, idxDe(a));
    expect(versStaff('cueillette:partage').at(-1).payload).toMatchObject({ idx: idxDe(a), coupDeCoeur: false });
    const avant = versStaff('cueillette:partage').length;
    engine.coupDeCoeur(io, room, null);
    expect(versStaff('cueillette:partage').length, 'retirer le coup de cœur a coupé le dessin d’Alice').toBe(avant);
    expect(rt.antenne).toBe(idxDe(a));
  });

  it('« Partager ! » sur le coup de cœur lui-même garde la mention', () => {
    engine.coupDeCoeur(io, room, idxDe(c));
    engine.partagerDessin(io, room, null);
    engine.partagerDessin(io, room, idxDe(c));
    expect(versStaff('cueillette:partage').at(-1).payload).toMatchObject({ idx: idxDe(c), coupDeCoeur: true });
  });

  it('UN ÉCRAN QUI SE RATTACHE LE RETROUVE : le stream, le dessin à l’antenne et le nom ; la console, en plus, ses dessins et sa note', () => {
    engine.coupDeCoeur(io, room, idxDe(b));
    const recus = (estHote) => {
      const sock = { emitted: [], emit(ev, payload) { this.emitted.push({ ev, payload }); } };
      engine.rejouerCueillette(io, room, sock, estHote);
      return sock.emitted;
    };
    const stream = recus(false);
    expect(stream.map((e) => e.ev).sort()).toEqual(['cueillette:coupDeCoeur', 'cueillette:partage']);
    expect(stream.find((e) => e.ev === 'cueillette:partage').payload).toMatchObject({ idx: idxDe(b), coupDeCoeur: true });
    const console_ = recus(true);
    expect(console_.map((e) => e.ev)).toEqual(expect.arrayContaining(['host:dessins', 'host:coupDeCoeur', 'cueillette:partage', 'cueillette:coupDeCoeur']));
    expect(console_.find((e) => e.ev === 'host:coupDeCoeur').payload).toMatchObject({ idx: idxDe(b), points: pointsDe(a) });
    // Le stream ne reçoit jamais la liste des dessins avec les noms et les notes.
    expect(stream.some((e) => e.ev === 'host:dessins')).toBe(false);
  });

  // ---- LE HAUT LE CŒUR (22/10) — « l'inverse : […] un malus de moins 500 au
  // niveau de ce jeu-là. Il va forcément sélectionner une personne qui a mal
  // dessiné. »
  it('HAUT LE CŒUR : 500 points de moins, lus sur le relevé du joueur — et personne d’autre ne bouge', () => {
    const [sa, sb, sc] = [a.score, b.score, c.score];
    const r = engine.hautLeCoeur(io, room, idxDe(b));
    expect(r.ok).toBe(true);
    expect(sb - b.score, 'le malus n’est pas de 500').toBe(engine.MALUS_HAUT_LE_COEUR);
    expect(engine.MALUS_HAUT_LE_COEUR).toBe(500);
    expect([a.score, c.score]).toEqual([sa, sc]);
    const yb = dernierYou(b);
    expect(yb.hautLeCoeur).toBe(true);
    expect(yb.malusHaut).toBe(500);
    expect(yb.delta, 'le relevé ne montre pas le malus').toBe(pointsDe(b) - 500);
    expect(yb.score).toBe(b.score);
    expect(yb.pourcent, 'la ressemblance a changé').toBe(rt.dessins[idxDe(b)].pourcent);
    expect(b.lastResult.hautLeCoeur).toBe(true);
    // La console, avec ses points ; le stream, un nom ; l'antenne, avec la mention.
    expect(io.emitted.filter((e) => e.ev === 'host:hautLeCoeur').at(-1)).toMatchObject({
      target: room.code + ':host', payload: { idx: idxDe(b), retrait: 500, points: pointsDe(b) - 500 },
    });
    const pub = versStaff('cueillette:hautLeCoeur').at(-1).payload;
    expect(pub).toEqual({ roundId: rt.roundId, idx: idxDe(b), pseudo: 'Bob' });
    expect(versStaff('cueillette:partage').at(-1).payload).toMatchObject({ idx: idxDe(b), hautLeCoeur: true, coupDeCoeur: false });
    expect(io.emitted.some((e) => e.ev === 'leaderboard:update')).toBe(true);
  });

  it('HAUT LE CŒUR : 500 ENTIERS, quitte à passer sous zéro — et l’annulation les rend exactement', () => {
    // Borné à zéro, il ne retirait RIEN au joueur qui n'avait encore rien marqué :
    // « Haut le cœur −0 pts » sur la console, vu à la capture.
    b.score = 0;
    engine.hautLeCoeur(io, room, idxDe(b));
    expect(b.score, 'le malus a été absorbé par un plancher à zéro').toBe(-500);
    expect(dernierYou(b).malusHaut).toBe(500);
    expect(dernierYou(b).score).toBe(-500);
    engine.hautLeCoeur(io, room, null);
    expect(b.score, 'l’annulation n’a pas rendu ce qui avait été pris').toBe(0);
    expect(dernierYou(b).hautLeCoeur).toBe(false);
    expect(dernierYou(b).malusHaut).toBe(0);
  });

  it('UN TOTAL NÉGATIF SURVIT À LA MANCHE SUIVANTE — la révélation ne le remet plus à zéro', () => {
    b.score = 0;
    engine.hautLeCoeur(io, room, idxDe(b));
    expect(b.score).toBe(-500);
    // Manche suivante : Bob rate (0 point) — il reste à −500, au lieu d'être
    // remis à zéro par le plancher de la révélation, qui effaçait le malus.
    setRound(room, 'quiz', QUIZ_Q, [[b.id, { value: 0, at: Date.now() - 4000 }], [a.id, { value: 1, at: Date.now() - 4000 }]]);
    engine.reveal(io, room);
    expect(b.score, 'la manche suivante a effacé le haut le cœur').toBe(-500);
    // Et une bonne réponse s'y ajoute normalement.
    setRound(room, 'quiz', QUIZ_Q, [[b.id, { value: 1, at: Date.now() - 4000 }]]);
    engine.reveal(io, room);
    expect(b.score).toBeGreaterThan(-500);
    expect(b.score).toBe(-500 + dernierYou(b).delta);
  });

  it('un total POSITIF ne passe toujours pas sous zéro à la révélation', () => {
    // Le plancher historique, conservé pour tout ce qui n'est pas un haut le cœur.
    a.score = 50;
    const rt2 = setRound(room, 'quiz', QUIZ_Q, [[a.id, { value: 1, at: Date.now() - 4000 }]]);
    const score0 = modules.quiz.score;
    modules.quiz.score = (r) => { const out = score0(r); for (const v of out.results.values()) { v.base = -200; v.speed = 0; } return out; };
    try { engine.reveal(io, room); } finally { modules.quiz.score = score0; }
    expect(rt2.revealed).toBe(true);
    expect(a.score).toBe(0);
  });

  it('le coup de cœur annulé rend EXACTEMENT son gain, même à un total négatif', () => {
    b.score = -500;
    engine.coupDeCoeur(io, room, idxDe(b));
    const gain = rt.coupDeCoeur.gain;
    engine.coupDeCoeur(io, room, null);
    expect(b.score, 'l’annulation a arrondi un total négatif').toBe(-500);
    expect(gain).toBeGreaterThan(0);
  });

  it('HAUT LE CŒUR : un seul par manche — le déplacer rend au précédent ses points, le retirer aussi', () => {
    const [sb, sc] = [b.score, c.score];
    engine.hautLeCoeur(io, room, idxDe(b));
    engine.hautLeCoeur(io, room, idxDe(c));
    expect(b.score).toBe(sb);
    expect(c.score).toBe(sc - 500);
    expect(dernierYou(b).hautLeCoeur).toBe(false);
    engine.hautLeCoeur(io, room, null);
    expect(c.score).toBe(sc);
    expect(rt.hautLeCoeur).toBe(null);
    expect(versStaff('cueillette:partage').at(-1).payload.dessin, 'le haut le cœur retiré est resté à l’antenne').toBe(null);
    expect(versStaff('cueillette:hautLeCoeur').at(-1).payload.pseudo).toBe(null);
  });

  it('UN MÊME DESSIN NE PORTE PAS LES DEUX : le haut le cœur retire le coup de cœur, et inversement', () => {
    const sc = c.score;
    engine.coupDeCoeur(io, room, idxDe(c));
    const gain = rt.coupDeCoeur.gain;
    expect(gain).toBeGreaterThan(0);
    engine.hautLeCoeur(io, room, idxDe(c));
    expect(rt.coupDeCoeur, 'le coup de cœur a survécu au haut le cœur').toBe(null);
    expect(c.score, 'le gain du coup de cœur n’a pas été rendu avant le malus').toBe(sc - 500);
    expect(dernierYou(c)).toMatchObject({ coupDeCoeur: false, bonusCoeur: 0, hautLeCoeur: true, malusHaut: 500 });
    // La console et le stream apprennent que le coup de cœur est tombé.
    expect(io.emitted.filter((e) => e.ev === 'host:coupDeCoeur').at(-1).payload.idx).toBe(null);
    expect(versStaff('cueillette:coupDeCoeur').at(-1).payload.pseudo).toBe(null);
    // Et l'inverse.
    engine.coupDeCoeur(io, room, idxDe(c));
    expect(rt.hautLeCoeur).toBe(null);
    expect(c.score).toBe(sc + gain);
  });

  it('les deux distinctions sur deux joueurs différents coexistent ; l’antenne montre la dernière', () => {
    engine.coupDeCoeur(io, room, idxDe(c));
    engine.hautLeCoeur(io, room, idxDe(b));
    expect(rt.coupDeCoeur.pid).toBe(c.id);
    expect(rt.hautLeCoeur.pid).toBe(b.id);
    expect(versStaff('cueillette:partage').at(-1).payload).toMatchObject({ idx: idxDe(b), hautLeCoeur: true });
    // Rendre l'antenne au coup de cœur garde SA mention.
    engine.partagerDessin(io, room, idxDe(c));
    expect(versStaff('cueillette:partage').at(-1).payload).toMatchObject({ idx: idxDe(c), coupDeCoeur: true, hautLeCoeur: false });
  });

  it('HAUT LE CŒUR : les places suivent pour tout le cercle', () => {
    // Après la révélation : Alice 4200, Chloé ≈ 3080, Bob 2500 — porté ici à 2700.
    // Le haut le cœur de Chloé (−500 → ≈ 2580) la fait passer sous Bob.
    b.score = 2700;
    const avantB = b.lastResult.placesDelta; const avantC = c.lastResult.placesDelta;
    engine.hautLeCoeur(io, room, idxDe(c));
    expect(c.score, 'le scénario ne fait changer personne de place').toBeLessThan(b.score);
    expect(dernierYou(c).placesDelta).toBeLessThan(avantC);
    expect(dernierYou(b), 'Bob a gagné une place sans que son écran le sache').toBeDefined();
    expect(dernierYou(b).placesDelta).toBeGreaterThan(avantB);
  });

  it('HAUT LE CŒUR : refusé hors d’une manche révélée, ou sur un dessin inconnu', () => {
    const avant = [a.score, b.score, c.score];
    expect(engine.hautLeCoeur(io, room, 42).ok).toBe(false);
    expect([a.score, b.score, c.score]).toEqual(avant);
    const rt2 = setRound(room, 'cueillette', { id: 'cu3', dessinId: CIBLE }, []);
    rt2.dessins = [{ pid: b.id, pourcent: 0, points: 0, traits: [] }];
    expect(engine.hautLeCoeur(io, room, 0).ok).toBe(false);
    expect(b.score).toBe(avant[1]);
  });

  it('UN ÉCRAN QUI SE RATTACHE RETROUVE AUSSI LE HAUT LE CŒUR', () => {
    engine.hautLeCoeur(io, room, idxDe(b));
    const sock = { emitted: [], emit(ev, payload) { this.emitted.push({ ev, payload }); } };
    engine.rejouerCueillette(io, room, sock, false);
    expect(sock.emitted.find((e) => e.ev === 'cueillette:hautLeCoeur')?.payload.pseudo).toBe('Bob');
    expect(sock.emitted.find((e) => e.ev === 'cueillette:partage')?.payload.hautLeCoeur).toBe(true);
    expect(sock.emitted.some((e) => e.ev === 'host:hautLeCoeur'), 'la note du malus est partie au stream').toBe(false);
    const hote = { emitted: [], emit(ev, payload) { this.emitted.push({ ev, payload }); } };
    engine.rejouerCueillette(io, room, hote, true);
    expect(hote.emitted.find((e) => e.ev === 'host:hautLeCoeur')?.payload).toMatchObject({ idx: idxDe(b), retrait: 500 });
  });

  it('pas avant la révélation : la notation doit être faite', () => {
    const rt2 = setRound(room, 'cueillette', { id: 'cu2', dessinId: CIBLE }, []);
    rt2.dessins = [{ pid: b.id, pourcent: 0, points: 0, traits: [] }];
    expect(engine.coupDeCoeur(io, room, 0).ok).toBe(false);
  });
});

// ============================================================
// LES PLACES ENTRE EX ÆQUO (24/10)
// ============================================================
// « Le haut le cœur ne fonctionne pas bien quand il y a beaucoup de joueurs. »
// Mesuré au banc (40 joueurs) : le rang était POSITIONNEL — deux joueurs à égalité
// recevaient deux rangs différents, départagés par leur ordre d'arrivée dans le
// salon. Avec beaucoup de joueurs, beaucoup finissent la manche à égalité (zéro
// pour un dessin raté) ; le haut le cœur de l'un faisait « gagner une place » à
// six autres qui n'avaient rien fait, et la révélation leur annonçait déjà des
// pertes arbitraires (−11, −9, −7… pour des joueurs partis tous à zéro).
describe('les places entre ex æquo', () => {
  let io, room, a, b, c, d;
  const CIBLE = Object.keys(GRILLES_DESSINS)[0];
  const dessin = (traits) => modules.cueillette.validateAnswer({ tour: 2 }, traits);
  const youOf = (p) => io.emitted.filter((e) => e.target === p.socketId && e.ev === 'play:you').at(-1)?.payload;
  const nbReleves = (p) => io.emitted.filter((e) => e.target === p.socketId && e.ev === 'play:you').length;

  beforeEach(() => {
    io = mockIo();
    room = roomManager.createRoom('owner');
    [a, b, c, d] = ['Alice', 'Bob', 'Chloe', 'David'].map((n) => roomManager.addPlayer(room, n));
    for (const [i, p] of [a, b, c, d].entries()) { p.connected = true; p.socketId = 's' + i; }
  });

  it('À LA RÉVÉLATION : deux joueurs dépassés par un troisième lisent −1 place — tous deux', () => {
    // Tous partent à zéro, ex æquo. Seule Alice répond juste : Bob et Chloé ont
    // été dépassés, chacun d'une place. En rang positionnel, Bob (2e → 2e) et
    // Chloé (3e → 3e) lisaient « Position inchangée ».
    setRound(room, 'quiz', QUIZ_Q, [[a.id, { value: 1, at: Date.now() - 4000 }], [b.id, { value: 0, at: Date.now() - 4000 }], [c.id, { value: 0, at: Date.now() - 4000 }]]);
    engine.reveal(io, room);
    expect(youOf(a).placesDelta).toBe(0);
    expect(youOf(b).placesDelta, 'Bob a été dépassé par Alice').toBe(-1);
    expect(youOf(c).placesDelta, 'Chloé a été dépassée par Alice — son rang d’arrivée n’y change rien').toBe(-1);
  });

  it('AU HAUT LE CŒUR : celui qui tombe ne fait gagner aucune place à ses ex æquo', () => {
    // Alice copie la cible, les trois autres gribouillent : Bob, Chloé et David
    // sont ex æquo à zéro. Le haut le cœur de Bob le fait passer derrière eux —
    // mais il n'était pas DEVANT eux : ils n'ont rien gagné.
    const rt = setRound(room, 'cueillette', { id: 'cu', dessinId: CIBLE }, [
      [a.id, { value: dessin(copisteDe(GRILLES_DESSINS[CIBLE])), at: Date.now() - 3000 }],
      ...[b, c, d].map((p, k) => [p.id, { value: dessin(gribouillis({ graine: 11 + k, traits: 4, points: 20 })), at: Date.now() - 3000 }]),
    ]);
    rt.tour = 2;
    engine.reveal(io, room);
    expect([b, c, d].map((p) => p.score), 'le scénario suppose trois ex æquo').toEqual([0, 0, 0]);
    const avant = new Map([c, d].map((p) => [p.id, [nbReleves(p), youOf(p).placesDelta]]));
    engine.hautLeCoeur(io, room, rt.dessins.findIndex((x) => x.pid === b.id));
    for (const p of [c, d]) {
      expect(youOf(p).placesDelta, `${p.pseudo} « gagne une place » qu’il n’a pas gagnée`).toBe(avant.get(p.id)[1]);
      expect(nbReleves(p), `${p.pseudo} a reçu un relevé alors que rien n’a changé pour lui`).toBe(avant.get(p.id)[0]);
    }
    // Bob, lui, est bien passé derrière ses deux ex æquo.
    expect(youOf(b).placesDelta).toBeLessThan(0);
  });
});
