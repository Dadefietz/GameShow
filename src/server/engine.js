// Moteur de jeu — cycle de vie d'un module dans un salon. Le serveur est AUTORITAIRE.
import { modules } from './modules.js';
import { RoomState, roomManager } from './rooms.js';

// Diffusion ciblée : le namespace par défaut, room Socket.IO = code du salon.
function toRoom(io, room) {
  return io.to(room.code);
}

// Sous-room réservée à l'animateur (distribution des réponses en direct — jamais aux joueurs).
function toHost(io, room) {
  return io.to(room.code + ':host');
}

// Répartition agrégée des réponses en cours, alignée sur les options (jamais le détail joueur).
// Renvoyée UNIQUEMENT à l'animateur pour piloter la partie (relancer/révéler au bon moment).
export function answerDistribution(rt) {
  if (!rt) return null;
  if (rt.type === 'quiz' || rt.type === 'vote') {
    const counts = new Array((rt.options || []).length).fill(0);
    for (const a of rt.answers.values()) {
      if (Number.isInteger(a.value) && a.value >= 0 && a.value < counts.length) counts[a.value] += 1;
    }
    return { kind: 'options', counts, total: rt.answers.size };
  }
  if (rt.type === 'true_false') {
    let t = 0, f = 0;
    for (const a of rt.answers.values()) (a.value ? t++ : f++);
    return { kind: 'boolean', counts: [f, t], total: rt.answers.size };
  }
  if (rt.type === 'estimation') {
    // Pas de catégories : on remonte min/max/moyenne pour donner du grain à l'animateur.
    const vals = [...rt.answers.values()].map((a) => a.value);
    if (!vals.length) return { kind: 'numeric', total: 0 };
    const sum = vals.reduce((s, v) => s + v, 0);
    return {
      kind: 'numeric',
      total: vals.length,
      min: Math.min(...vals),
      max: Math.max(...vals),
      avg: Math.round(sum / vals.length),
    };
  }
  return null;
}

function emitDistribution(io, room) {
  const rt = room.currentModule;
  if (!rt) return;
  toHost(io, room).emit('module:distribution', answerDistribution(rt));
}

export function publicRoomState(room) {
  return {
    code: room.code,
    state: room.state,
    playerCount: room.players.size,
    progression: room.progression,
    leaderboard: roomManager.leaderboard(room, 5),
  };
}

export function emitRoomState(io, room) {
  toRoom(io, room).emit('room:state', publicRoomState(room));
}

// Lance un module avec une question. answers vidées, deadline serveur posée.
export function startModule(io, room, moduleType, question) {
  const mod = modules[moduleType];
  if (!mod) throw new Error('module inconnu: ' + moduleType);
  const rt = mod.buildRound(question);
  rt.answers = new Map(); // playerId -> { value, at }
  rt.startedAt = Date.now();
  rt.deadline = rt.startedAt + rt.durationMs;
  rt.revealed = false;
  rt.closed = false;
  room.currentModule = rt;
  room.state = RoomState.PLAYING;
  room.progression = {
    index: room.progression.index + 1,
    total: Math.max(room.progression.total, room.progression.index + 1),
  };
  roomManager.touch(room);

  // Question publique (sans la bonne réponse) aux joueurs + overlays.
  const payload = {
    ...mod.publicQuestion(rt),
    durationMs: rt.durationMs,
    deadline: rt.deadline,
    meta: mod.meta,
    index: room.progression.index,
    total: room.progression.total,
  };
  toRoom(io, room).emit('module:started', payload);
  emitRoomState(io, room);
  emitDistribution(io, room); // remet la répartition à zéro côté animateur

  // Chrono serveur : ferme la fenêtre de réponse à l'échéance (mais NE révèle PAS —
  // la révélation est déclenchée par l'animateur pour absorber le délai de diffusion).
  if (room._timer) clearTimeout(room._timer);
  room._timer = setTimeout(() => closeWindow(io, room), rt.durationMs + 50);
  // Tick de compte à rebours (1s) pour les overlays.
  if (room._tick) clearInterval(room._tick);
  room._tick = setInterval(() => {
    const rem = Math.max(0, Math.ceil((room.currentModule?.deadline - Date.now()) / 1000));
    toRoom(io, room).emit('module:tick', { timeLeft: rem, answers: room.currentModule?.answers.size || 0 });
    if (rem <= 0) clearInterval(room._tick);
  }, 1000);
  return rt;
}

export function closeWindow(io, room) {
  const rt = room.currentModule;
  if (!rt || rt.closed) return;
  rt.closed = true;
  if (room._tick) clearInterval(room._tick);
  toRoom(io, room).emit('module:closed', { answers: rt.answers.size });
}

// Enregistre une réponse joueur (validée serveur, fenêtre ouverte, pas de doublon).
export function submitAnswer(io, room, playerId, rawValue) {
  const rt = room.currentModule;
  if (!rt || rt.closed || Date.now() > rt.deadline) return { ok: false, reason: 'closed' };
  const player = room.players.get(playerId);
  if (!player) return { ok: false, reason: 'unknown-player' };
  if (rt.answers.has(playerId)) return { ok: false, reason: 'already' };
  const mod = modules[rt.type];
  const value = mod.validateAnswer(rt, rawValue);
  if (value === null) return { ok: false, reason: 'invalid' };
  rt.answers.set(playerId, { value, at: Date.now() });
  roomManager.touch(room);
  // Compteur agrégé (jamais le détail) vers l'animateur + overlays.
  toRoom(io, room).emit('module:answersCount', { count: rt.answers.size });
  // Répartition détaillée par option — animateur seulement.
  emitDistribution(io, room);
  return { ok: true };
}

// Révélation déclenchée par l'animateur : calcule les points, met à jour les scores, diffuse.
export function reveal(io, room) {
  const rt = room.currentModule;
  if (!rt || rt.revealed) return;
  if (!rt.closed) closeWindow(io, room);
  const mod = modules[rt.type];
  const { points, reveal } = mod.score(rt);
  for (const [pid, delta] of points) {
    const p = room.players.get(pid);
    if (p) p.score += delta;
  }
  rt.revealed = true;
  room.state = RoomState.RESULTS;
  const board = roomManager.leaderboard(room, 10);
  room.history.push({ moduleType: rt.type, text: rt.text, reveal, options: rt.options || null, at: Date.now() });
  toRoom(io, room).emit('module:reveal', { ...reveal, type: rt.type });
  toRoom(io, room).emit('leaderboard:update', { leaderboard: board });
  emitRoomState(io, room);

  // Feedback perso à chaque joueur (rang + delta).
  for (const [pid, p] of room.players) {
    if (p.socketId) {
      const rank = roomManager.rankOf(room, pid);
      const gained = points.get(pid) || 0;
      io.to(p.socketId).emit('play:you', { rank: rank?.rank, score: p.score, delta: gained });
    }
  }
  roomManager.touch(room);
}

export function adjustScore(io, room, playerId, delta) {
  const p = room.players.get(playerId);
  if (!p) return false;
  p.score += Number(delta) || 0;
  toRoom(io, room).emit('leaderboard:update', { leaderboard: roomManager.leaderboard(room, 10) });
  emitRoomState(io, room);
  return true;
}

export function pause(io, room) {
  room.state = RoomState.PAUSED;
  if (room._tick) clearInterval(room._tick);
  emitRoomState(io, room);
}

// Reprise après pause : si un module est encore en cours (fenêtre ouverte), on repasse
// en PLAYING et on relance le tick ; sinon on revient en attente.
export function resume(io, room) {
  const rt = room.currentModule;
  if (rt && !rt.closed && !rt.revealed && Date.now() < rt.deadline) {
    room.state = RoomState.PLAYING;
    if (room._tick) clearInterval(room._tick);
    room._tick = setInterval(() => {
      const rem = Math.max(0, Math.ceil((room.currentModule?.deadline - Date.now()) / 1000));
      toRoom(io, room).emit('module:tick', { timeLeft: rem, answers: room.currentModule?.answers.size || 0 });
      if (rem <= 0) clearInterval(room._tick);
    }, 1000);
  } else {
    room.state = rt && rt.revealed ? RoomState.RESULTS : RoomState.WAITING;
  }
  emitRoomState(io, room);
}

export function endGame(io, room) {
  room.state = RoomState.ENDED;
  if (room._timer) clearTimeout(room._timer);
  if (room._tick) clearInterval(room._tick);
  const podium = roomManager.leaderboard(room, 3);
  // Récap des manches (B3) : question + révélation, jamais le détail par joueur.
  const history = room.history.map((h) => ({ type: h.moduleType, text: h.text, reveal: h.reveal, options: h.options }));
  toRoom(io, room).emit('game:ended', { podium, leaderboard: roomManager.leaderboard(room, 50), history });
  emitRoomState(io, room);
}
