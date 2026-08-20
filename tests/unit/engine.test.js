// Tests unitaires — moteur de révélation : base + complément de vitesse, série,
// places, rang masqué. Plus aucune pénalité (T1), la série ne rapporte rien (T3).
import { describe, it, expect, beforeEach } from 'vitest';
import { modules } from '../../src/server/modules.js';
import { roomManager, RoomState } from '../../src/server/rooms.js';
import * as engine from '../../src/server/engine.js';

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
    b.score = 500; // Bob devant avant la manche
    const rt = setRound(room, 'quiz', QUIZ_Q, [[a.id, { value: 1, at: Date.now() - 4000 }]]);
    engine.reveal(io, room);
    const ya = youOf(a);
    expect(ya.placesDelta).toBeGreaterThan(0); // Alice passe devant Bob
  });

  it('un SONDAGE laisse la série intacte et ne note personne', () => {
    a.streak = 3;
    const VO = { id: 'vo', text: '?', options: ['X', 'Y'], durationSec: 10, poll: true };
    setRound(room, 'vote', VO, [[a.id, { value: 0, at: Date.now() - 2000 }]]);
    engine.reveal(io, room);
    const ya = youOf(a);
    expect(ya.base).toBe(100);
    expect(ya.speed).toBe(0);
    expect(ya.streak).toBe(3); // ni nourrie, ni rompue
  });

  it('un VOTE-JEU nourrit la série pour la majorité, la rompt pour la minorité', () => {
    a.streak = 2; b.streak = 2;
    const VO = { id: 'vo', text: '?', options: ['X', 'Y'], durationSec: 10 };
    setRound(room, 'vote', VO, [
      [a.id, { value: 0, at: Date.now() - 3000 }],
      [b.id, { value: 1, at: Date.now() - 3000 }],
      [c.id, { value: 0, at: Date.now() - 2000 }],
    ]);
    engine.reveal(io, room);
    const ya = youOf(a), yb = youOf(b);
    expect(ya.streak).toBe(3);  // majoritaire : la série continue
    expect(yb.streak).toBe(0);  // minoritaire : elle se rompt
    // Mais elle ne coûte aucun point : zéro, pas moins que zéro.
    expect(yb.delta).toBe(0);
    // Et aucun supplément de rapidité, même pour le premier majoritaire arrivé.
    expect(ya.speed).toBe(0);
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
