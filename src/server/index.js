// Point d'entrée serveur — Fastify (HTTP + statique) + Socket.IO (temps réel autoritaire).
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { Server as IOServer } from 'socket.io';
import { z } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from './config.js';
import { roomManager, RoomState } from './rooms.js';
import { verifyHostSession, verifyGameToken, makePlayerToken, makeHostToken, makeOverlayToken } from './auth.js';
import { demoQuestions, MODULE_TYPES, modules } from './modules.js';
import { loadQuestions } from './supabase.js';
import * as engine from './engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- Filtrage de pseudo (anti-contenu offensant, basique + bornage) ----
const BANNED = ['con', 'pute', 'salope', 'nazi', 'admin', 'moderator'];
function cleanPseudo(raw) {
  const s = String(raw || '').trim().slice(0, 20);
  if (s.length < 1) return null;
  const low = s.toLowerCase();
  if (BANNED.some((b) => low.includes(b))) return null;
  return s.replace(/[<>]/g, ''); // pas d'HTML (React échappe déjà)
}

const app = Fastify({ logger: false });
await app.register(cors, { origin: config.corsOrigins });

// Statique : build front + assets publics.
const distDir = path.resolve(process.cwd(), config.clientDist);
app.register(fastifyStatic, { root: distDir, prefix: '/', decorateReply: true, wildcard: false });

// --- REST minimal ---
app.get('/api/health', async () => ({ ok: true, rooms: roomManager.rooms.size }));
app.get('/api/config', async () => ({ modules: MODULE_TYPES }));

// Création de salon — réservé à l'animateur authentifié (Supabase). Renvoie code + hostToken.
app.post('/api/rooms', async (req, reply) => {
  const auth = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const host = await verifyHostSession(auth);
  const ownerId = host?.sub || 'dev-host'; // en dev sans Supabase, animateur local
  const room = roomManager.createRoom(ownerId);
  return {
    code: room.code,
    hostToken: makeHostToken(room.code, ownerId),
    overlayToken: makeOverlayToken(room.code),
  };
});

// Rejoindre — anonyme, sans compte. Accepte un salon en attente OU en cours (M3).
app.post('/api/rooms/:code/join', async (req, reply) => {
  const schema = z.object({ pseudo: z.string() });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) return reply.code(400).send({ error: 'bad-request' });
  const code = String(req.params.code || '').toUpperCase();
  const room = roomManager.get(code);
  if (!room || room.state === RoomState.ENDED) return reply.code(404).send({ error: 'room-not-found' });
  if (room.players.size >= config.maxPlayersPerRoom) return reply.code(429).send({ error: 'room-full' });
  const pseudo = cleanPseudo(parsed.data.pseudo);
  if (!pseudo) return reply.code(422).send({ error: 'invalid-pseudo' });
  const player = roomManager.addPlayer(room, pseudo);
  return { playerId: player.id, pseudo, playerToken: makePlayerToken(code, player.id), state: room.state };
});

// --- Socket.IO ---
const io = new IOServer(app.server, { cors: { origin: config.corsOrigins } });

// Middleware d'auth : chaque socket présente un token de jeu ; isolation par room = salon.
io.use((socket, next) => {
  const { token } = socket.handshake.auth || {};
  const claims = verifyGameToken(token);
  if (!claims || !claims.room) return next(new Error('unauthorized'));
  const room = roomManager.get(claims.room);
  if (!room) return next(new Error('room-not-found'));
  socket.data.role = claims.role; // host | player | overlay
  socket.data.roomCode = claims.room;
  socket.data.sub = claims.sub || null;
  next();
});

// Rate limit simple par socket (anti-flood).
function rateLimited(socket) {
  const now = Date.now();
  socket.data._bucket = (socket.data._bucket || []).filter((t) => now - t < 1000);
  if (socket.data._bucket.length >= 8) return true;
  socket.data._bucket.push(now);
  return false;
}

function requireRoom(socket) {
  return roomManager.get(socket.data.roomCode);
}
function isHost(socket, room) {
  return socket.data.role === 'host' && room && room.ownerId === socket.data.sub;
}

io.on('connection', (socket) => {
  const room = requireRoom(socket);
  if (!room) return socket.disconnect(true);
  socket.join(room.code);

  // Rattachement joueur (reconnexion sans perte de score — S5).
  if (socket.data.role === 'player' && socket.data.sub) {
    const p = room.players.get(socket.data.sub);
    if (p) { p.connected = true; p.socketId = socket.id; }
    io.to(room.code).emit('player:joined', { count: room.players.size });
    engine.emitRoomState(io, room); // rafraîchit le compteur côté animateur/overlays
  }
  // État courant à la connexion.
  socket.emit('room:state', engine.publicRoomState(room));
  // Un retardataire (M3) reçoit la question en cours si la fenêtre est ouverte.
  const cur = room.currentModule;
  if (cur && !cur.revealed && !cur.closed) {
    const mod = modules[cur.type];
    socket.emit('module:started', {
      ...mod.publicQuestion(cur),
      durationMs: cur.durationMs,
      deadline: cur.deadline,
      meta: mod.meta,
    });
  }

  // ---- Commandes ANIMATEUR (host:*) — vérifiées par rôle + salon ----
  socket.on('host:startModule', async ({ moduleType, question } = {}) => {
    const r = requireRoom(socket); if (!isHost(socket, r)) return;
    if (!MODULE_TYPES.includes(moduleType)) return;
    let q = question;
    if (!q) {
      const fromDb = await loadQuestions(r.ownerId, moduleType);
      const pool = (fromDb && fromDb.length ? fromDb : demoQuestions[moduleType]) || [];
      q = pool[Math.floor((r.progression.index) % Math.max(pool.length, 1))] || pool[0];
    }
    if (!q) return;
    engine.startModule(io, r, moduleType, q);
  });
  socket.on('host:pause', () => { const r = requireRoom(socket); if (isHost(socket, r)) engine.pause(io, r); });
  socket.on('host:reveal', () => { const r = requireRoom(socket); if (isHost(socket, r)) engine.reveal(io, r); });
  socket.on('host:adjustScore', ({ playerId, delta } = {}) => {
    const r = requireRoom(socket); if (isHost(socket, r)) engine.adjustScore(io, r, playerId, delta);
  });
  socket.on('host:nextModule', () => {
    const r = requireRoom(socket); if (!isHost(socket, r)) return;
    r.state = RoomState.WAITING; r.currentModule = null; engine.emitRoomState(io, r);
  });
  socket.on('host:endGame', () => { const r = requireRoom(socket); if (isHost(socket, r)) engine.endGame(io, r); });

  // ---- Réponse JOUEUR (validée serveur, anti-triche) ----
  socket.on('play:answer', ({ value } = {}) => {
    if (rateLimited(socket)) return;
    if (socket.data.role !== 'player') return;
    const r = requireRoom(socket);
    const res = engine.submitAnswer(io, r, socket.data.sub, value);
    socket.emit('play:accepted', res);
  });

  // Overlay : lecture seule, n'émet rien d'accepté.

  socket.on('disconnect', () => {
    const r = requireRoom(socket);
    if (r && socket.data.role === 'player' && socket.data.sub) {
      const p = r.players.get(socket.data.sub);
      if (p) { p.connected = false; p.socketId = null; }
      engine.emitRoomState(io, r);
    }
  });
});

// SPA fallback (routes client) — sert index.html pour les chemins non-API.
app.setNotFoundHandler((req, reply) => {
  if (req.raw.url.startsWith('/api') || req.raw.url.startsWith('/socket.io')) {
    return reply.code(404).send({ error: 'not-found' });
  }
  return reply.sendFile('index.html');
});

// Purge périodique des salons inactifs.
setInterval(() => roomManager.sweep(), 60 * 1000);

app.listen({ port: config.port, host: config.host }).then(() => {
  console.log(`[game-server] écoute sur ${config.host}:${config.port}`);
});
