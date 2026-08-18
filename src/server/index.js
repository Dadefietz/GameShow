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
import * as banksStore from './store.js';
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

// Headers de sécurité (SECURITY-AUDIT F-005) : le fichier _headers ne s'applique que
// sur CF Pages ; ici c'est CE serveur (Render) qui sert le front, il pose donc les
// headers lui-même. CSP stricte : même origine + Supabase (auth) + WebSocket + QR data:.
const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; " +
    "img-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co ws: wss:; " +
    "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
};
app.addHook('onSend', (req, reply, payload, done) => {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) reply.header(k, v);
  done(null, payload);
});

// Statique : build front + assets publics.
const distDir = path.resolve(process.cwd(), config.clientDist);
app.register(fastifyStatic, { root: distDir, prefix: '/', decorateReply: true, wildcard: false });

// ANIMATEUR UNIQUE (R1) : vérifie la session ET, si HOST_EMAIL est configuré,
// que l'email correspond. Sans Supabase ni HOST_EMAIL : mode dev ouvert.
async function requireHost(req, reply) {
  const auth = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const host = await verifyHostSession(auth);
  if (config.hostEmail) {
    const email = (host?.email || '').trim().toLowerCase();
    if (!host || email !== config.hostEmail) {
      reply.code(403).send({ error: 'not-host' });
      return null;
    }
  }
  return { sub: host?.sub || 'dev-host', email: host?.email || null };
}

// --- REST minimal ---
app.get('/api/health', async () => ({ ok: true, rooms: roomManager.rooms.size }));
app.get('/api/config', async () => ({ modules: MODULE_TYPES }));

// Création de salon — réservé à L'animateur (unique). Renvoie code + hostToken.
app.post('/api/rooms', async (req, reply) => {
  const host = await requireHost(req, reply);
  if (!host) return;
  // Reconnexion : si l'animateur a déjà un salon ouvert, on le lui redonne (même compte).
  let room = roomManager.getByOwner(host.sub);
  const reused = !!room;
  if (!room) room = roomManager.createRoom(host.sub);
  return {
    code: room.code,
    reused,
    hostToken: makeHostToken(room.code, host.sub),
    overlayToken: makeOverlayToken(room.code),
  };
});

// Rejoindre — anonyme, sans compte. Nécessite un salon EXISTANT (créé par l'animateur).
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
  // Dédup (insensible à la casse) : deux joueurs ne peuvent pas partager un pseudo.
  const low = pseudo.toLowerCase();
  for (const p of room.players.values()) {
    if (p.pseudo.toLowerCase() === low) return reply.code(409).send({ error: 'pseudo-taken' });
  }
  const player = roomManager.addPlayer(room, pseudo);
  return { playerId: player.id, pseudo, playerToken: makePlayerToken(code, player.id), state: room.state };
});

// --- Banques de questions (R4) : le Studio écrit ici, le moteur lit ici. ---
const questionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  options: z.array(z.string()).optional(),
  correctIndex: z.number().int().optional(),
  correct: z.boolean().optional(),
  target: z.number().optional(),
  durationSec: z.number().positive().optional(),
}).passthrough();
const banksSchema = z.object(Object.fromEntries(MODULE_TYPES.map((t) => [t, z.array(questionSchema).optional()])));

app.get('/api/banks', async (req, reply) => {
  const host = await requireHost(req, reply);
  if (!host) return;
  return banksStore.getBanks();
});

app.put('/api/banks', async (req, reply) => {
  const host = await requireHost(req, reply);
  if (!host) return;
  const parsed = banksSchema.safeParse(req.body || {});
  if (!parsed.success) return reply.code(400).send({ error: 'bad-banks' });
  return banksStore.setBanks(parsed.data);
});

// Réservoir de questions d'un module : banque Studio (disque) + Supabase (si
// configuré) + seed embarqué. Dédoublonné par id — une question ajoutée dans le
// Studio est TOUJOURS jouable en partie.
async function poolFor(ownerId, moduleType) {
  const fromDb = (await loadQuestions(ownerId, moduleType)) || [];
  const fromStudio = banksStore.getBank(moduleType);
  const seed = demoQuestions[moduleType] || [];
  const seen = new Set();
  const pool = [];
  for (const q of [...fromStudio, ...fromDb, ...seed]) {
    if (!q || q.id == null || seen.has(q.id)) continue;
    seen.add(q.id);
    pool.push(q);
  }
  return pool;
}

// Choix de la prochaine question selon la configuration de séance (R5) :
// sélection manuelle éventuelle, pas de répétition, ordre aléatoire par défaut.
function pickQuestion(room, moduleType, pool) {
  const sel = room.session.selected[moduleType];
  let candidates = Array.isArray(sel) && sel.length ? pool.filter((q) => sel.includes(q.id)) : pool;
  if (!candidates.length) candidates = pool;
  let fresh = candidates.filter((q) => !room.session.used.has(moduleType + ':' + q.id));
  if (!fresh.length) {
    // Banque épuisée pour ce module : on recommence un cycle.
    for (const q of candidates) room.session.used.delete(moduleType + ':' + q.id);
    fresh = candidates;
  }
  const q = room.session.shuffle ? fresh[Math.floor(Math.random() * fresh.length)] : fresh[0];
  if (q) room.session.used.add(moduleType + ':' + q.id);
  return q || null;
}

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
  // Canal staff (classement) : animateur + stream uniquement — jamais les joueurs.
  // L'animateur rejoint EN PLUS une sous-room privée : répartition des réponses en direct.
  if (socket.data.role === 'host' && room.ownerId === socket.data.sub) {
    socket.join(room.code + ':staff');
    socket.join(room.code + ':host');
    socket.emit('module:distribution', engine.answerDistribution(room.currentModule));
  } else if (socket.data.role === 'overlay') {
    socket.join(room.code + ':staff');
  }

  // Rattachement joueur (reconnexion sans perte de score — S5).
  if (socket.data.role === 'player' && socket.data.sub) {
    const p = room.players.get(socket.data.sub);
    if (p) { p.connected = true; p.socketId = socket.id; }
    io.to(room.code).emit('player:joined', { count: room.players.size });
    engine.emitRoomState(io, room); // rafraîchit le compteur côté animateur/stream
  }
  // État courant à la connexion.
  socket.emit('room:state', engine.publicRoomState(room));
  // Restauration complète à la (re)connexion : question en cours si la fenêtre est
  // ouverte (avec le statut « déjà répondu » du joueur), OU question + révélation si
  // la manche est déjà révélée — un rechargement retrouve son écran, sans état fantôme.
  const cur = room.currentModule;
  if (cur && (!cur.closed || cur.revealed)) {
    const mod = modules[cur.type];
    socket.emit('module:started', {
      ...mod.publicQuestion(cur),
      durationMs: cur.durationMs,
      deadline: cur.deadline,
      meta: mod.meta,
      index: room.progression.index,
      total: room.progression.total,
      answered: socket.data.role === 'player' && socket.data.sub ? cur.answers.has(socket.data.sub) : false,
    });
    if (cur.revealed && cur.revealPayload) socket.emit('module:reveal', cur.revealPayload);
  }

  // ---- Commandes ANIMATEUR (host:*) — vérifiées par rôle + salon ----
  socket.on('host:startModule', async ({ moduleType, question } = {}) => {
    const r = requireRoom(socket); if (!isHost(socket, r)) return;
    if (!MODULE_TYPES.includes(moduleType)) return;
    // Un échec ne doit JAMAIS être silencieux : l'animateur reçoit host:error.
    try {
      let q = question;
      if (!q) {
        const pool = await poolFor(r.ownerId, moduleType);
        q = pickQuestion(r, moduleType, pool);
      }
      if (!q) return socket.emit('host:error', { code: 'no-question' });
      engine.startModule(io, r, moduleType, q);
    } catch {
      socket.emit('host:error', { code: 'start-failed' });
    }
  });
  socket.on('host:reveal', () => { const r = requireRoom(socket); if (isHost(socket, r)) engine.reveal(io, r); });
  socket.on('host:adjustScore', ({ playerId, delta } = {}) => {
    const r = requireRoom(socket); if (isHost(socket, r)) engine.adjustScore(io, r, playerId, delta);
  });
  socket.on('host:nextModule', () => {
    const r = requireRoom(socket); if (!isHost(socket, r)) return;
    r.state = RoomState.WAITING; r.currentModule = null; engine.emitRoomState(io, r);
  });
  socket.on('host:endGame', () => { const r = requireRoom(socket); if (isHost(socket, r)) engine.endGame(io, r); });
  // Retour au salon d'attente après le podium, sans fermer le salon.
  socket.on('host:backToLobby', () => { const r = requireRoom(socket); if (isHost(socket, r)) engine.backToLobby(io, r); });
  // Fermer le salon : le supprime (mémoire + mapping propriétaire), notifie les joueurs.
  // L'animateur reste authentifié et pourra rouvrir un salon neuf.
  socket.on('host:closeRoom', () => {
    const r = requireRoom(socket); if (!isHost(socket, r)) return;
    r.state = RoomState.ENDED;
    io.to(r.code).emit('room:closed');
    roomManager.rooms.delete(r.code);
    if (r.ownerId && roomManager.ownerRooms.get(r.ownerId) === r.code) roomManager.ownerRooms.delete(r.ownerId);
  });

  // Configuration de séance (R5) : ordre aléatoire on/off + sélection manuelle.
  socket.on('host:sessionConfig', ({ shuffle, selected } = {}) => {
    const r = requireRoom(socket); if (!isHost(socket, r)) return;
    if (typeof shuffle === 'boolean') r.session.shuffle = shuffle;
    if (selected && typeof selected === 'object') {
      const clean = {};
      for (const t of MODULE_TYPES) {
        if (Array.isArray(selected[t])) clean[t] = selected[t].map(String).slice(0, 500);
      }
      r.session.selected = clean;
    }
  });
  // Liste des questions disponibles d'un module (id + intitulé) pour la sélection.
  socket.on('host:getBank', async ({ moduleType } = {}, cb) => {
    const r = requireRoom(socket);
    if (!isHost(socket, r) || !MODULE_TYPES.includes(moduleType) || typeof cb !== 'function') return;
    const pool = await poolFor(r.ownerId, moduleType);
    cb(pool.map((q) => ({ id: q.id, text: q.text })));
  });

  // ---- Réponse JOUEUR (validée serveur, anti-triche) ----
  socket.on('play:answer', ({ value } = {}) => {
    if (rateLimited(socket)) return;
    if (socket.data.role !== 'player') return;
    const r = requireRoom(socket);
    const res = engine.submitAnswer(io, r, socket.data.sub, value);
    socket.emit('play:accepted', res);
  });

  // Stream : lecture seule, n'émet rien d'accepté.

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
