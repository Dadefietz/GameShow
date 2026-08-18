// Tests unitaires — moteur de révélation : points, bonus/malus, places, rang masqué.
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

  it('applique base + Éclair + malus, plancher 0, et n\'envoie JAMAIS de rang', () => {
    const t0 = Date.now() - 5000; // = startedAt posé par setRound
    setRound(room, 'quiz', QUIZ_Q, [
      [a.id, { value: 1, at: t0 }],           // bonne, la plus rapide
      [b.id, { value: 1, at: t0 + 4000 }],    // bonne, plus lente
      [c.id, { value: 0, at: t0 + 1000 }],    // mauvaise
    ]);
    engine.reveal(io, room);

    const ya = youOf(a), yb = youOf(b), yc = youOf(c);
    expect(ya.base).toBeGreaterThan(yb.base);           // vitesse récompensée
    expect(ya.bonus).toBeGreaterThanOrEqual(150);       // Éclair
    expect(yb.bonus).toBe(0);
    expect(yc.malus).toBe(-100);                        // malus mauvaise réponse
    expect(yc.score).toBe(0);                           // plancher 0
    expect(ya.streak).toBe(1);
    expect(yc.streak).toBe(0);
    for (const y of [ya, yb, yc]) {
      expect(y).not.toHaveProperty('rank');             // rang jamais envoyé en cours de partie
      expect(y).toHaveProperty('placesDelta');
    }
  });

  it('bonus de série dès la 2e bonne réponse consécutive (+50 par cran, cap 250)', () => {
    a.streak = 1; // une bonne réponse déjà en poche
    const rt = setRound(room, 'quiz', QUIZ_Q, [[a.id, { value: 1, at: Date.now() - 4000 }]]);
    engine.reveal(io, room);
    const ya = youOf(a);
    expect(ya.streak).toBe(2);
    expect(ya.bonus).toBe(150 + 50); // Éclair (seul correct) + série cran 1
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

  it('le vote n\'alimente ni série ni malus (participation seule)', () => {
    a.streak = 3;
    const VO = { id: 'vo', text: '?', options: ['X', 'Y'], durationSec: 10 };
    setRound(room, 'vote', VO, [[a.id, { value: 0, at: Date.now() - 2000 }]]);
    engine.reveal(io, room);
    const ya = youOf(a);
    expect(ya.base).toBe(100);
    expect(ya.bonus).toBe(0);
    expect(ya.malus).toBe(0);
    expect(ya.streak).toBe(3); // série intacte
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
