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
import { MODULE_TYPES, modules } from './modules.js';
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

// ANIMATEURS AUTORISÉS (R1) : vérifie la session ET, si HOST_EMAIL est configuré,
// que l'email figure dans la liste. Sans Supabase ni HOST_EMAIL : mode dev ouvert.
async function requireHost(req, reply) {
  const auth = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const host = await verifyHostSession(auth);
  if (config.hostEmails.length) {
    const email = (host?.email || '').trim().toLowerCase();
    if (!host || !config.hostEmails.includes(email)) {
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

// --- Bibliothèque de JEUX NOMMÉS (R4) : le Studio écrit ici, le moteur lit ici. ---
// L'unité n'est plus le type mais le jeu nommé (action 2), et la bibliothèque est
// propre à chaque compte (action 10).
const questionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  options: z.array(z.string()).optional(),
  correctIndex: z.number().int().optional(),
  correct: z.boolean().optional(),
  target: z.number().optional(),
  durationSec: z.number().positive().optional(),
}).passthrough();
const moduleSchema = z.object({
  id: z.string().min(1),
  type: z.enum(MODULE_TYPES),
  name: z.string().min(1),
  duration: z.number().positive().optional(),
  color: z.string().optional(),
  questions: z.array(questionSchema),
}).passthrough();
const modulesSchema = z.array(moduleSchema);

app.get('/api/modules', async (req, reply) => {
  const host = await requireHost(req, reply);
  if (!host) return;
  return { modules: banksStore.getModules(host.sub) };
});

app.put('/api/modules', async (req, reply) => {
  const host = await requireHost(req, reply);
  if (!host) return;
  const parsed = modulesSchema.safeParse(req.body?.modules ?? req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'bad-modules' });
  return { modules: banksStore.setModules(host.sub, parsed.data) };
});

app.post('/api/modules/restore', async (req, reply) => {
  const host = await requireHost(req, reply);
  if (!host) return;
  return { modules: banksStore.restaurerModulesDeDepart(host.sub) };
});

// Questions d'un JEU précis. Plus de fusion de toutes les questions d'un type :
// lancer « Culture générale » tire dans « Culture générale », et nulle part
// ailleurs. C'est tout l'intérêt de nommer ses jeux.
async function poolFor(ownerId, module_) {
  if (!module_) return [];
  const local = Array.isArray(module_.questions) ? module_.questions : [];
  // PLUS DE FUSION AVEC SUPABASE ICI, et c'est une correction (clôture action 11).
  //
  // Le code consultait Supabase pour le même TYPE et versait le résultat dans la
  // réserve du jeu lancé. C'était précisément l'aplatissement par type que
  // l'action 2 avait supprimé : lancer « Culture générale » aurait de nouveau
  // tiré dans toutes les questions de type quiz, en contradiction directe avec la
  // décision « la pioche est restreinte au module lancé ».
  //
  // Ce chemin ne pouvait de toute façon plus rien apporter : depuis que le Studio
  // ne parle qu'au serveur (action 2), plus rien n'écrit dans la table `modules`
  // de Supabase — constatée vide. Le serveur reste seul maître de la persistance,
  // sur disque, et la bibliothèque d'un jeu est celle de ce jeu.
  const seen = new Set();
  const pool = [];
  for (const q of local) {
    if (!q || q.id == null || seen.has(q.id)) continue;
    seen.add(q.id);
    pool.push(q);
  }
  return pool;
}

// FILE D'ATTENTE DU JEU (action 6). L'ordre existe désormais À L'AVANCE : c'est
// ce qui permet à l'animateur de le voir et de le réarranger, alors qu'il était
// jusqu'ici tiré au dernier moment, à l'aveugle.
//
// Trois défauts corrigés au passage, tous constatés en relisant le code :
//   1. la liste des questions jouées était indexée par TYPE. Elle l'est
//      maintenant sur l'identifiant de question seul : une question posée ne
//      ressort dans aucun autre jeu de la soirée ;
//   2. au changement de cycle, le code effaçait la liste puis retirait au hasard
//      dans la banque redevenue entière — y compris la question qui venait d'être
//      posée. Une chance sur vingt de la reposer COUP SUR COUP, ce qui est
//      exactement le symptôme qu'on cherchait à supprimer ;
//   3. une question IMPOSÉE au lancement n'était pas enregistrée comme jouée, et
//      pouvait donc ressortir plus tard. Défaut dormant, réveillé le jour où une
//      sélection manuelle existe — c'est-à-dire aujourd'hui.
function construireFile(room, moduleId, pool) {
  const sel = room.session.selected[moduleId];
  let candidates = Array.isArray(sel) && sel.length ? pool.filter((q) => sel.includes(q.id)) : pool;
  if (!candidates.length) candidates = pool;

  // « Jamais deux fois la même question dans un même salon » : les questions déjà
  // posées ne reviennent pas dans la file. La banque épuisée est donc un vrai
  // cul-de-sac — l'ancien recyclage silencieux a disparu — et c'est précisément
  // pour ça que la file doit être VISIBLE : l'animateur voit sa réserve fondre
  // longtemps avant d'être à sec.
  const fraiches = candidates.filter((q) => !room.session.used.has(q.id));

  const ids = fraiches.map((q) => q.id);
  if (room.session.shuffle) {
    for (let i = ids.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
  }
  // La question qui vient d'être posée ne peut pas ouvrir la file suivante.
  if (ids.length > 1 && ids[0] === room.session.lastQuestionId) {
    [ids[0], ids[1]] = [ids[1], ids[0]];
  }
  return ids;
}

// File courante d'un jeu, construite à la demande puis conservée : c'est elle
// que l'animateur voit et réordonne.
function fileDe(room, moduleId, pool) {
  const q = room.session.queues;
  if (!Array.isArray(q[moduleId])) q[moduleId] = construireFile(room, moduleId, pool);
  return q[moduleId];
}

// Prend la TÊTE de file, de façon atomique : un réordonnancement arrivé entre
// temps ne s'applique qu'au reste.
function prendreProchaine(room, moduleId, pool) {
  const file = fileDe(room, moduleId, pool);
  const connues = new Map(pool.map((q) => [q.id, q]));
  while (file.length) {
    const id = file.shift();
    // Une question retirée de la bibliothèque entre-temps, ou déjà posée par un
    // autre jeu, est simplement sautée — jamais servie deux fois.
    if (!connues.has(id) || room.session.used.has(id)) continue;
    marquerPosee(room, id);
    return connues.get(id);
  }
  return null;
}

function marquerPosee(room, questionId) {
  room.session.used.add(questionId);
  room.session.lastQuestionId = questionId;
}

// Ce que l'animateur voit de sa file : la suite, dans l'ordre, avec les intitulés.
function fileVisible(room, moduleId, pool) {
  const connues = new Map(pool.map((q) => [q.id, q]));
  return fileDe(room, moduleId, pool)
    .filter((id) => connues.has(id) && !room.session.used.has(id))
    .map((id) => ({ id, text: connues.get(id).text }));
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
      roundId: cur.roundId,
      moduleId: cur.moduleId,
      durationMs: cur.durationMs,
      deadline: cur.deadline,
      meta: { ...mod.meta, name: cur.moduleName || mod.meta.name },
      index: room.progression.index,
      total: room.progression.total,
      answered: socket.data.role === 'player' && socket.data.sub ? cur.answers.has(socket.data.sub) : false,
    });
    if (cur.revealed && cur.revealPayload) socket.emit('module:reveal', cur.revealPayload);
    // Résultat PERSONNEL de la manche affichée. Sans lui, l'écran du joueur
    // conclut qu'il n'a pas participé — c'est l'origine unique de « manche jouée
    // sans toi », du score décalé et des malus fantômes (R12).
    // Rejoué UNIQUEMENT s'il appartient à la manche en cours : un souvenir d'une
    // manche antérieure recréerait exactement le défaut qu'on corrige.
    if (socket.data.role === 'player' && socket.data.sub) {
      const moi = room.players.get(socket.data.sub);
      if (moi && moi.lastResult && moi.lastResult.roundId === cur.roundId) {
        socket.emit('play:you', moi.lastResult);
      }
    }
  }

  // ---- Commandes ANIMATEUR (host:*) — vérifiées par rôle + salon ----
  socket.on('host:startModule', async ({ moduleId, moduleType, question } = {}) => {
    const r = requireRoom(socket); if (!isHost(socket, r)) return;
    // DEUX FORMES ACCEPTÉES. La nouvelle désigne un jeu nommé par son identifiant.
    // L'ancienne, par type, est conservée pour qu'un écran animateur resté ouvert
    // pendant une mise à jour ne se retrouve pas muet en plein direct : elle prend
    // alors le premier jeu de ce type.
    const module_ = moduleId
      ? banksStore.getModule(r.ownerId, moduleId)
      : (MODULE_TYPES.includes(moduleType) ? banksStore.getModuleParType(r.ownerId, moduleType) : null);
    if (!module_) return socket.emit('host:error', { code: 'no-module' });
    // Un échec ne doit JAMAIS être silencieux : l'animateur reçoit host:error.
    try {
      const pool = await poolFor(r.ownerId, module_);
      let q = question;
      if (q) {
        // Une question IMPOSÉE compte comme posée : sans ça elle pouvait
        // ressortir plus tard dans la même soirée.
        marquerPosee(r, q.id);
        r.session.queues[module_.id] = (r.session.queues[module_.id] || []).filter((id) => id !== q.id);
      } else {
        q = prendreProchaine(r, module_.id, pool);
      }
      if (!q) return socket.emit('host:error', { code: 'no-question', moduleName: module_.name });
      engine.startModule(io, r, module_, q);
      // La file suivante part vers l'ANIMATEUR SEUL : c'est la seule donnée de
      // l'application qui révèle les questions À VENIR, et le stream est une
      // source capturée par OBS.
      socket.emit('host:queue', { moduleId: module_.id, queue: fileVisible(r, module_.id, pool) });
    } catch {
      socket.emit('host:error', { code: 'start-failed' });
    }
  });
  // File d'attente d'un jeu — À L'ANIMATEUR SEUL, jamais sur le canal partagé
  // avec le stream : elle révèle les questions à venir.
  socket.on('host:getQueue', async ({ moduleId } = {}, cb) => {
    const r = requireRoom(socket);
    if (!isHost(socket, r) || typeof cb !== 'function') return;
    const module_ = banksStore.getModule(r.ownerId, moduleId);
    if (!module_) return cb({ queue: [] });
    const pool = await poolFor(r.ownerId, module_);
    cb({ moduleId, queue: fileVisible(r, moduleId, pool) });
  });

  // Réordonnancement : l'animateur renvoie l'ordre voulu. Le serveur ne fait
  // confiance qu'aux identifiants qu'il connaît déjà dans cette file — un ordre
  // reçu ne peut donc pas y INTRODUIRE une question, seulement la déplacer.
  socket.on('host:reorderQueue', async ({ moduleId, order } = {}, cb) => {
    const r = requireRoom(socket);
    if (!isHost(socket, r)) return;
    const module_ = banksStore.getModule(r.ownerId, moduleId);
    if (!module_ || !Array.isArray(order)) return;
    const pool = await poolFor(r.ownerId, module_);
    const actuelle = new Set(fileDe(r, moduleId, pool));
    const voulu = order.map(String).filter((id) => actuelle.has(id));
    // Ce que l'animateur n'a pas cité reste à la fin, dans son ordre : une file
    // tronquée par un message incomplet ferait disparaître des questions.
    const reste = [...actuelle].filter((id) => !voulu.includes(id));
    r.session.queues[moduleId] = [...voulu, ...reste];
    if (typeof cb === 'function') cb({ moduleId, queue: fileVisible(r, moduleId, pool) });
  });

  // Retrait d'une question de la file — une question qui tombe mal, un sujet qui
  // vient d'être évoqué à l'antenne. Elle n'est PAS marquée comme posée : elle
  // pourra resservir dans une autre soirée.
  socket.on('host:removeFromQueue', async ({ moduleId, questionId } = {}, cb) => {
    const r = requireRoom(socket);
    if (!isHost(socket, r)) return;
    const module_ = banksStore.getModule(r.ownerId, moduleId);
    if (!module_) return;
    const pool = await poolFor(r.ownerId, module_);
    r.session.queues[moduleId] = fileDe(r, moduleId, pool).filter((id) => id !== String(questionId));
    if (typeof cb === 'function') cb({ moduleId, queue: fileVisible(r, moduleId, pool) });
  });

  // Bibliothèque de l'animateur : sert à construire son menu de lancement. Envoyée
  // à la demande ET à la connexion, pour qu'un écran rouvert soit à jour.
  socket.on('host:modules', (_p, cb) => {
    const r = requireRoom(socket);
    if (!isHost(socket, r) || typeof cb !== 'function') return;
    cb(banksStore.getModules(r.ownerId).map((m) => ({
      id: m.id, type: m.type, name: m.name, questions: (m.questions || []).length,
    })));
  });
  socket.on('host:reveal', () => { const r = requireRoom(socket); if (isHost(socket, r)) engine.reveal(io, r); });
  // La commande host:adjustScore a été supprimée avec le panneau « Bonus / Malus »
  // de l'écran animateur (action 8) : correction manuelle sans règle ni trace.
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
  // Liste des questions disponibles d'un JEU (id + intitulé) pour la sélection.
  socket.on('host:getBank', async ({ moduleId, moduleType } = {}, cb) => {
    const r = requireRoom(socket);
    if (!isHost(socket, r) || typeof cb !== 'function') return;
    const module_ = moduleId
      ? banksStore.getModule(r.ownerId, moduleId)
      : (MODULE_TYPES.includes(moduleType) ? banksStore.getModuleParType(r.ownerId, moduleType) : null);
    if (!module_) return cb([]);
    const pool = await poolFor(r.ownerId, module_);
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
