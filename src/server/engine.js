// Moteur de jeu — cycle de vie d'un module dans un salon. Le serveur est AUTORITAIRE.
// Règles d'affichage (retours produit 2026-08-18) :
//  - À la fin du chrono, la fenêtre de réponse est fermée ET la révélation est
//    automatique (bonne réponse + stats de répartition diffusées à tous).
//  - Le rang d'un joueur ne lui est JAMAIS envoyé en cours de partie : il reçoit
//    uniquement ses points gagnés et les places gagnées/perdues. Le classement
//    complet ne circule que sur le canal "staff" (animateur + stream). Le podium
//    final est public à la fin de la partie.
import { modules } from './modules.js';
import { RoomState, roomManager } from './rooms.js';

// Bonus / malus automatiques (conçus au retour R9, valeurs par défaut raisonnables) :
//  - Éclair : la réponse correcte la plus rapide de la manche gagne +150.
//  - Série : à partir de 2 bonnes réponses consécutives, +50 par cran (max +250).
//  - Malus : mauvaise réponse sur un module à bonne réponse ferme (quiz, vrai/faux)
//    = -100. Ne s'applique pas à l'estimation ni au vote. Le score plancher est 0.
const FASTEST_BONUS = 150;
const STREAK_STEP = 50;
const STREAK_CAP = 250;
const WRONG_MALUS = -100;

// Diffusion : room Socket.IO = code du salon (tout le monde) ;
// canal staff = code + ':staff' (animateur + stream uniquement — classement).
function toRoom(io, room) {
  return io.to(room.code);
}
function toStaff(io, room) {
  return io.to(room.code + ':staff');
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

// État public d'un salon — SANS classement (les joueurs ne doivent pas voir leur rang).
export function publicRoomState(room) {
  return {
    code: room.code,
    state: room.state,
    playerCount: room.players.size,
    progression: room.progression,
  };
}

export function emitRoomState(io, room) {
  toRoom(io, room).emit('room:state', publicRoomState(room));
  toStaff(io, room).emit('leaderboard:update', { leaderboard: roomManager.leaderboard(room, 10) });
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

  // Question publique (sans la bonne réponse) aux joueurs + stream.
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

  // Chrono serveur : à l'échéance, fermeture + révélation AUTOMATIQUES (retour R7).
  if (room._timer) clearTimeout(room._timer);
  room._timer = setTimeout(() => reveal(io, room), rt.durationMs + 50);
  // Tick de compte à rebours (1s) pour toutes les surfaces.
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
// À l'échéance exacte (>= deadline), la réponse est REFUSÉE.
export function submitAnswer(io, room, playerId, rawValue) {
  const rt = room.currentModule;
  if (!rt || rt.closed || rt.revealed || Date.now() >= rt.deadline) return { ok: false, reason: 'closed' };
  const player = room.players.get(playerId);
  if (!player) return { ok: false, reason: 'unknown-player' };
  if (rt.answers.has(playerId)) return { ok: false, reason: 'already' };
  const mod = modules[rt.type];
  const value = mod.validateAnswer(rt, rawValue);
  if (value === null) return { ok: false, reason: 'invalid' };
  rt.answers.set(playerId, { value, at: Date.now() });
  roomManager.touch(room);
  // Compteur agrégé (jamais le détail) vers l'animateur + stream.
  toRoom(io, room).emit('module:answersCount', { count: rt.answers.size });
  // Répartition détaillée par option — animateur seulement.
  emitDistribution(io, room);
  return { ok: true };
}

// Révélation — automatique à la fin du chrono (ou anticipée par l'animateur).
// Calcule points + bonus/malus, met à jour scores et séries, diffuse la bonne
// réponse et les stats à tous, et envoie à chaque joueur SON delta (sans rang).
export function reveal(io, room) {
  const rt = room.currentModule;
  if (!rt || rt.revealed) return;
  if (!rt.closed) closeWindow(io, room);
  const mod = modules[rt.type];
  const ranksBefore = roomManager.rankMap(room);
  const { results, reveal: revealPayload } = mod.score(rt);

  // Bonus Éclair : réponse correcte la plus rapide de la manche.
  let fastestPid = null;
  if (mod.meta.scored) {
    let fastestAt = Infinity;
    for (const [pid, r] of results) {
      const a = rt.answers.get(pid);
      if (r.correct === true && a && a.at < fastestAt) {
        fastestAt = a.at;
        fastestPid = pid;
      }
    }
  }

  const perPlayer = new Map();
  for (const [pid, p] of room.players) {
    const r = results.get(pid);
    const answered = rt.answers.has(pid);
    let base = r ? r.base : 0;
    let bonus = 0;
    let malus = 0;
    if (mod.meta.scored) {
      if (r && r.correct === true) {
        p.streak += 1;
        if (pid === fastestPid) bonus += FASTEST_BONUS;
        if (p.streak >= 2) bonus += Math.min(STREAK_STEP * (p.streak - 1), STREAK_CAP);
      } else {
        p.streak = 0;
        if (answered && mod.meta.malus) malus = WRONG_MALUS;
      }
    }
    const delta = base + bonus + malus;
    p.score = Math.max(0, p.score + delta);
    perPlayer.set(pid, { base, bonus, malus, delta, streak: p.streak });
  }

  rt.revealed = true;
  room.state = RoomState.RESULTS;
  const ranksAfter = roomManager.rankMap(room);
  room.history.push({ moduleType: rt.type, text: rt.text, reveal: revealPayload, options: rt.options || null, at: Date.now() });
  rt.revealPayload = { ...revealPayload, type: rt.type }; // mémorisé pour la restauration à la reconnexion

  // Bonne réponse + stats de répartition : diffusées à TOUTES les surfaces.
  toRoom(io, room).emit('module:reveal', rt.revealPayload);
  // Classement : canal staff uniquement (animateur + stream).
  toStaff(io, room).emit('leaderboard:update', { leaderboard: roomManager.leaderboard(room, 10) });
  emitRoomState(io, room);

  // Feedback perso à chaque joueur : points gagnés + places gagnées/perdues. JAMAIS le rang.
  for (const [pid, p] of room.players) {
    if (p.socketId) {
      const d = perPlayer.get(pid) || { base: 0, bonus: 0, malus: 0, delta: 0, streak: p.streak };
      const placesDelta = (ranksBefore.get(pid) || 0) - (ranksAfter.get(pid) || 0);
      io.to(p.socketId).emit('play:you', {
        score: p.score,
        delta: d.delta,
        base: d.base,
        bonus: d.bonus,
        malus: d.malus,
        streak: d.streak,
        placesDelta,
      });
    }
  }
  roomManager.touch(room);
}

// Bonus/malus MANUELS de l'animateur (complément des bonus automatiques).
export function adjustScore(io, room, playerId, delta) {
  const p = room.players.get(playerId);
  if (!p) return false;
  p.score = Math.max(0, p.score + (Number(delta) || 0));
  toStaff(io, room).emit('leaderboard:update', { leaderboard: roomManager.leaderboard(room, 10) });
  emitRoomState(io, room);
  return true;
}

// pause/resume supprimés (retour produit R9 du 2026-08-18).
// Retour au salon d'attente après une partie terminée. Le salon reste ouvert
// (même code, mêmes joueurs connectés) mais la séance repart à zéro : sans ça,
// l'animateur n'avait aucun moyen de relancer une soirée sans fermer le salon.
export function backToLobby(io, room) {
  if (room._timer) clearTimeout(room._timer);
  if (room._tick) clearInterval(room._tick);
  room.state = RoomState.WAITING;
  room.currentModule = null;
  room.history = [];
  room.progression = { index: 0, total: 0 };
  room.session.used = new Set();
  for (const p of room.players.values()) { p.score = 0; p.streak = 0; }
  toRoom(io, room).emit('game:lobby');
  emitRoomState(io, room);
  roomManager.touch(room);
}

export function endGame(io, room) {
  room.state = RoomState.ENDED;
  if (room._timer) clearTimeout(room._timer);
  if (room._tick) clearInterval(room._tick);
  const podium = roomManager.leaderboard(room, 3);
  // Fin de partie : le classement final devient public + récap des manches (B3,
  // question + révélation — jamais le détail par joueur).
  const history = room.history.map((h) => ({ type: h.moduleType, text: h.text, reveal: h.reveal, options: h.options }));
  toRoom(io, room).emit('game:ended', { podium, leaderboard: roomManager.leaderboard(room, 50), history });
  // Chaque joueur reçoit son rang FINAL (seul moment où le rang est envoyé).
  for (const [pid, p] of room.players) {
    if (p.socketId) {
      const rank = roomManager.rankOf(room, pid);
      io.to(p.socketId).emit('play:you', { rank: rank?.rank, score: p.score, delta: 0, final: true });
    }
  }
  emitRoomState(io, room);
  roomManager.touch(room); // fenêtre de grâce : relance possible après le podium
}
