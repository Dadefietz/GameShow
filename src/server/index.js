// Point d'entrée serveur — Fastify (HTTP + statique) + Socket.IO (temps réel autoritaire).
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { Server as IOServer } from 'socket.io';
import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { config } from './config.js';
import { roomManager, RoomState } from './rooms.js';
import { verifyHostSession, verifyGameToken, makePlayerToken, makeHostToken, makeOverlayToken } from './auth.js';
import { MODULE_TYPES, modules } from './modules.js';
import {
  contenuDeLaBanque, GABARITS_PAR_DEFAUT, VARIABLES_PAR_FORME, LIBELLES_PAR_FORME,
} from './cache-cache.js';
import { BASSIN_OBJETS, COULEURS, srcDObjet } from './objets.js';
import { srcDeVisage } from './visages.js';
import { getServiceClient } from './supabase.js';
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
    // LES IMAGES DÉPOSÉES AU STUDIO SONT SERVIES PAR SUPABASE STORAGE. Sans cette
    // autorisation, elles seraient bloquées par la CSP — silencieusement, et sur
    // toutes les surfaces à la fois : la case resterait une plaque vide au stream
    // et sur les téléphones, sans message ni erreur visible.
    "img-src 'self' data: https://*.supabase.co; connect-src 'self' https://*.supabase.co wss://*.supabase.co ws: wss:; " +
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

// LES IMAGES D'OBJETS DÉPOSÉES AU STUDIO.
//
// Le seau Supabase est le rangement de production — durable, c'est la leçon de
// M1. Le dossier local ne sert qu'au développement et aux contrôles de bout en
// bout, pour que la chaîne entière reste vérifiable sans clé de service. Il vit
// sous DATA_DIR, donc jamais dans le dépôt.
const SEAU_OBJETS = 'objets';
const POIDS_IMAGE_MAX = 2 * 1024 * 1024;
const DOSSIER_IMAGES = path.resolve(process.cwd(), process.env.DATA_DIR || 'data', 'objets-perso');
fs.mkdirSync(DOSSIER_IMAGES, { recursive: true });
// `wildcard: true` ET C'EST NÉCESSAIRE ICI. Le service statique en mode « sans
// joker » parcourt le dossier AU DÉMARRAGE et enregistre une route par fichier
// trouvé : une image déposée ensuite n'existe pour personne, et répond 404 alors
// qu'elle est bien sur le disque. Le dossier du build, lui, ne bouge jamais en
// cours d'exécution — il garde son réglage.
app.register(fastifyStatic, {
  root: DOSSIER_IMAGES, prefix: '/objets-perso/', decorateReply: false, wildcard: true,
});

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

// LA BANQUE DE « CACHE-CACHE » NE CONTIENT PAS DES QUESTIONS MAIS SON CONTENU
// MODÉRÉ : les gabarits de questions et la base d'images. Elle emprunte le même
// champ — c'est ce qui la rend durable sans table nouvelle — mais elle n'a ni
// énoncé ni bonne réponse, et le schéma des questions la refuserait.
const contenuCacheSchema = z.object({
  kind: z.literal('contenu-cache'),
  gabarits: z.array(z.object({
    id: z.string().min(1),
    forme: z.string().min(1),
    gabarit: z.string().min(1),
    min: z.number().int().min(0).max(5),
    max: z.number().int().min(0).max(5),
    actif: z.boolean().optional(),
  })).optional(),
  objets: z.array(z.object({
    id: z.string().min(1),
    nom: z.string().min(1),
    couleur: z.string().min(1),
    src: z.string().min(1).optional(),
  })).optional(),
}).passthrough();
const moduleSchema = z.object({
  id: z.string().min(1),
  type: z.enum(MODULE_TYPES),
  name: z.string().min(1),
  duration: z.number().positive().optional(),
  color: z.string().optional(),
  questions: z.array(z.union([contenuCacheSchema, questionSchema])),
}).passthrough();
const modulesSchema = z.array(moduleSchema);

app.get('/api/modules', async (req, reply) => {
  const host = await requireHost(req, reply);
  if (!host) return;
  // ON RELIT LA BASE À L'OUVERTURE DU STUDIO. Le disque de l'hébergement est
  // éphémère : après un redémarrage, il ne connaît plus rien. C'est la base qui
  // sait — voir la note de `store.js`.
  const modules = await banksStore.rafraichirDepuisLaBase(host.sub);
  return { modules, types: typesPourLeStudio() };
});

app.put('/api/modules', async (req, reply) => {
  const host = await requireHost(req, reply);
  if (!host) return;
  const parsed = modulesSchema.safeParse(req.body?.modules ?? req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'bad-modules' });
  // L'ÉCHEC DE LA BASE REMONTE JUSQU'AU STUDIO. Un « Enregistré » affiché sur une
  // écriture perdue est précisément le défaut qu'on vient de corriger.
  try {
    const modules = await banksStore.enregistrerModules(host.sub, parsed.data);
    return { modules, types: typesPourLeStudio() };
  } catch (e) {
    app.log.error({ err: e }, 'enregistrement en base impossible');
    return reply.code(503).send({ error: 'save-failed', detail: String(e.message || e) });
  }
});

app.post('/api/modules/restore', async (req, reply) => {
  const host = await requireHost(req, reply);
  if (!host) return;
  const modules = banksStore.restaurerModulesDeDepart(host.sub);
  await banksStore.sauverEnBase(host.sub, modules).catch(() => {});
  return { modules, types: typesPourLeStudio() };
});

// DÉPOSER UNE IMAGE D'OBJET DEPUIS LE STUDIO.
//
// CE QUI A ÉTÉ DEMANDÉ : « déposer une image et codifier (nom, couleur) ».
//
// LE SERVEUR NE DÉCODE JAMAIS L'IMAGE. Elle arrive déjà détourée et convertie en
// WebP par le navigateur (voir `src/client/studio/imageObjet.js`) ; ici on
// VÉRIFIE — le type par sa signature d'octets, le poids, l'identifiant — puis on
// range. Décoder un fichier venu du dehors, c'est ouvrir un décodeur d'images à
// une entrée non maîtrisée ; s'en abstenir supprime la classe entière de défauts,
// et évite trente mégaoctets de binaire natif sur l'hébergeur.
//
// DEUX RANGEMENTS, ET IL LE DIT. En production, Supabase Storage — durable, servi
// publiquement, c'est la leçon de M1 : le disque de l'hébergeur repart vierge à
// chaque redémarrage. En développement, faute de clé de service, le disque local
// sous DATA_DIR, pour que la chaîne complète reste vérifiable. La réponse porte
// `durable`, et le Studio le montre : une image posée sur un rangement qui
// s'efface ne doit jamais passer pour rangée.
const SIGNATURE_WEBP = (buf) => buf.length > 12
  && buf.toString('ascii', 0, 4) === 'RIFF'
  && buf.toString('ascii', 8, 12) === 'WEBP';

const imageSchema = z.object({
  id: z.string().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'identifiant attendu en minuscules, chiffres et tirets'),
  webp: z.string().min(1).max(4_000_000),
});

//
// LA LIMITE DE CORPS EST DÉCLARÉE, ET ACCORDÉE À CELLE DE L'IMAGE. Fastify coupe
// à un mégaoctet par défaut : la route annonçait deux mégaoctets d'image et en
// refusait déjà à sept cent cinquante kilo-octets, le base64 pesant un tiers de
// plus que les octets. Le refus venait du cadre, avant le gestionnaire, avec un
// message que le Studio ne pouvait pas traduire. Deux limites qui se contredisent
// valent moins qu'une seule qui se voit.
app.post('/api/cache/image', {
  bodyLimit: Math.ceil(POIDS_IMAGE_MAX * 4 / 3) + 64 * 1024,
}, async (req, reply) => {
  const host = await requireHost(req, reply);
  if (!host) return;
  const parsed = imageSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'image-invalide', detail: parsed.error.issues[0]?.message });

  const { id, webp } = parsed.data;
  const brut = webp.startsWith('data:') ? webp.slice(webp.indexOf(',') + 1) : webp;
  let octets;
  try { octets = Buffer.from(brut, 'base64'); } catch { return reply.code(400).send({ error: 'base64-invalide' }); }
  if (!SIGNATURE_WEBP(octets)) return reply.code(400).send({ error: 'pas-un-webp' });
  if (octets.length > POIDS_IMAGE_MAX) {
    return reply.code(413).send({ error: 'image-trop-lourde', octets: octets.length, max: POIDS_IMAGE_MAX });
  }

  const chemin = `${host.sub}/${id}.webp`;
  const sb = getServiceClient();
  if (sb) {
    const { error } = await sb.storage.from(SEAU_OBJETS)
      .upload(chemin, octets, { contentType: 'image/webp', upsert: true });
    if (error) {
      req.log.error({ err: error }, 'dépôt image : Supabase a refusé');
      return reply.code(503).send({ error: 'depot-refuse', detail: error.message });
    }
    const { data } = sb.storage.from(SEAU_OBJETS).getPublicUrl(chemin);
    return { id, src: data.publicUrl, octets: octets.length, durable: true };
  }

  // Pas de Supabase : on range sur le disque, et on le DIT.
  const dossier = path.join(DOSSIER_IMAGES, String(host.sub));
  await fs.promises.mkdir(dossier, { recursive: true });
  await fs.promises.writeFile(path.join(dossier, `${id}.webp`), octets);
  return { id, src: `/objets-perso/${host.sub}/${id}.webp`, octets: octets.length, durable: false };
});

// LE CATALOGUE DE « CACHE-CACHE » — ce que le Studio a besoin de connaître pour
// laisser l'animateur modérer le jeu.
//
// Il ne porte PAS le contenu de l'animateur (qui vit dans sa banque, avec ses
// modules) mais ce qui l'encadre : les objets livrés avec le dépôt, les couleurs
// admises, les formes de questions existantes et les variables que chacune sait
// remplir. Le Studio ne recopie rien de tout cela.
app.get('/api/cache/catalogue', async (req, reply) => {
  const host = await requireHost(req, reply);
  if (!host) return;
  return {
    objets: BASSIN_OBJETS.map((o) => ({ ...o, src: srcDObjet(o.id) })),
    couleurs: COULEURS,
    gabarits: GABARITS_PAR_DEFAUT,
    variables: VARIABLES_PAR_FORME,
    libelles: LIBELLES_PAR_FORME,
  };
});

// LES DURÉES RÉELLES, DÉCLARÉES PAR LES MODULES.
//
// Le Studio affichait la durée écrite dans la BANQUE — un nombre réglable que la
// plupart des jeux ne lisent pas : « Coupe ta bûche » y annonçait vingt secondes
// pour un jeu qui en dure dix. Elles viennent maintenant du serveur, d'un seul
// endroit, et le Studio ne les recopie pas.
function typesPourLeStudio() {
  const sortie = {};
  for (const t of MODULE_TYPES) {
    const meta = modules[t].meta;
    sortie[t] = {
      dureeS: meta.dureeS ?? null,
      dureeFixe: meta.dureeFixe === true,
      direct: meta.direct === true,
    };
  }
  return sortie;
}

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

  // LE CLASSEMENT, REJOUÉ AU STAFF (chantier v4, décision 9.6).
  //
  // TROUVÉ PAR LE CONTRÔLE DE L'ACTION 9, ET NON PRÉVU PAR ELLE. Le classement
  // n'est diffusé que sur ÉVÉNEMENT — `leaderboard:update` part à la révélation
  // et à la fin d'une épreuve. Une console qui se rattache entre deux événements
  // n'en reçoit donc jamais : elle affichait « Aucun score pour l'instant » sur
  // une partie déjà bien engagée.
  //
  // Ce n'est pas propre au volet de navigation : un simple F5 sur la console
  // produisait le même écran. Le défaut vivait depuis toujours ; il fallait
  // seulement qu'un contrôle regarde la console APRÈS un rattachement.
  if (socket.data.role === 'host' || socket.data.role === 'overlay') {
    socket.emit('leaderboard:update', { leaderboard: roomManager.leaderboard(room, engine.CLASSEMENT_MAX) });
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
  // L'ANNONCE EN COURS, rejouée : sans elle, un joueur qui recharge pendant le
  // jingle du « Lien » retombe sur l'écran d'attente du salon, comme si rien
  // n'était en train de se passer.
  if (room.annonce) socket.emit('module:annonce', room.annonce);
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
      // CE QU'IL RESTE, mesuré ici et pas déduit d'une horloge de téléphone —
      // voir la note de `startModule`. C'est ce rejeu-ci qui en a le plus besoin :
      // un joueur qui recharge en pleine manche du « juste temps » doit retrouver
      // son chrono à la bonne fraction de seconde, pas au début.
      resteMs: Math.max(0, cur.deadline - Date.now()),
      meta: { ...mod.meta, name: cur.moduleName || mod.meta.name },
      index: room.progression.index,
      total: room.progression.total,
      answered: socket.data.role === 'player' && socket.data.sub ? cur.answers.has(socket.data.sub) : false,
      // LA RÉPONSE DU JOUEUR, REJOUÉE AVEC LE RESTE.
      //
      // La décision 1.4 du chantier v4 posait que le choix non révélé « n'est pas
      // restauré » — arbitrage de l'auteur, « pas grave », pris quand la seule
      // conséquence connue était une case non recochée.
      //
      // ELLE EN AVAIT UNE AUTRE, INVISIBLE ALORS. L'écran de résultat déduit le
      // verdict en comparant LE CHOIX DU JOUEUR à la bonne réponse. Sans son
      // choix, il ne peut plus conclure : un joueur qui rechargeait après avoir
      // répondu voyait « Manche close » là où il lisait « Raté » ou « Bien joué »
      // l'instant d'avant. Mesuré, puis corrigé ici.
      monChoix: socket.data.role === 'player' && socket.data.sub
        ? (cur.answers.get(socket.data.sub)?.value ?? null) : null,
      // PRÉSENT AU LANCEMENT ? La diffusion à tout le salon ne peut pas porter une
      // information PAR JOUEUR : elle ne part qu'à ceux qui sont déjà là. C'est
      // donc ce rejeu-ci — envoyé à une seule liaison — qui la porte, et lui seul
      // peut dire `false`. Côté écran, l'absence du champ vaut « présent », ce qui
      // est exact : on ne reçoit la diffusion que si l'on était dans le salon.
      //
      // La borne est le DÉCLENCHEMENT DE LA QUESTION : c'est lui qui sépare avoir
      // vu la question depuis le début de ne pas l'avoir vue commencer.
      presentAuLancement: (() => {
        if (socket.data.role !== 'player' || !socket.data.sub) return true;
        const moi = room.players.get(socket.data.sub);
        if (!moi || moi.joinedAt == null || cur.startedAt == null) return true;
        return moi.joinedAt <= cur.startedAt;
      })(),
    });
    // LES JEUX DE DÉFILÉ : L'IMAGE COURANTE, REJOUÉE.
    //
    // Les images sont poussées une par une et non portées par la question — sans
    // quoi la série entière, donc la réponse, serait lisible dans la charge
    // utile. Conséquence : un joueur qui recharge en pleine série ne recevrait
    // plus RIEN jusqu'à l'image suivante, et resterait deux secondes devant un
    // écran vide au milieu d'une manche qui n'en dure qu'une.
    //
    // On lui renvoie donc la place où en est la série — calculée sur l'horloge du
    // serveur, la même que celle qui juge les buzz — et le visage qui l'occupe.
    const defile = mod.meta.defile;
    if (defile && Array.isArray(cur.ordre) && !cur.revealed) {
      const place = Math.min(cur.ordre.length,
        Math.max(1, Math.floor((Date.now() - cur.startedAt) / defile.cadenceMs) + 1));
      const id = cur.ordre[place - 1];
      socket.emit('serie:element', {
        roundId: cur.roundId, place, id,
        src: cur.type === 'visages' ? srcDeVisage(id) : null,
      });
    }
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

  // L'ÉTAT DE FIN DE PARTIE, REJOUÉ (chantier v4, décision 3.3).
  //
  // CE QUI ÉTAIT FAUX. Tout ce qui précède vit dans un `if (cur)` — donc sous
  // condition qu'une manche soit EN COURS. Une partie terminée n'en a plus. Un
  // joueur qui se reconnectait ou rechargeait après la fin ne recevait donc
  // RIEN : ni podium, ni classement, ni rang final.
  //
  // Deux griefs de la réunion en découlaient, sans qu'on voie qu'ils n'en font
  // qu'un : « la personne qui a actualisé n'a même pas d'écran final », et « tout
  // le monde n'a pas l'option de partage » — ce bouton étant conditionné au rang,
  // il disparaissait avec lui. D'où un défaut qui frappait certains joueurs et pas
  // d'autres : ceux qui avaient rechargé, et eux seuls.
  if (room.state === RoomState.ENDED) {
    const classement = roomManager.leaderboard(room, engine.CLASSEMENT_MAX);
    socket.emit('game:ended', {
      podium: roomManager.leaderboard(room, 3),
      leaderboard: classement,
      history: room.history.map((h) => ({ type: h.moduleType, text: h.text, reveal: h.reveal, options: h.options })),
    });
    if (socket.data.role === 'player' && socket.data.sub) {
      const moi = room.players.get(socket.data.sub);
      const rang = roomManager.rankOf(room, socket.data.sub);
      if (moi) socket.emit('play:you', { rank: rang?.rank, score: moi.score, delta: 0, final: true });
    }
  }

  // ---- Commandes ANIMATEUR (host:*) — vérifiées par rôle + salon ----
  // ANNONCER un jeu sans le lancer — voir `engine.annoncerModule`.
  socket.on('host:announceModule', ({ moduleId, ecart } = {}) => {
    const r = requireRoom(socket); if (!isHost(socket, r)) return;
    const module_ = banksStore.getModule(r.ownerId, moduleId);
    if (!module_) return socket.emit('host:error', { code: 'no-module' });
    // LE MODE, QUAND LE JEU EN A UN. Il est BLANCHI ici plutôt que cru : une
    // valeur venue du réseau ne doit pas se retrouver telle quelle sur l'écran
    // d'attente du cercle, où elle commanderait un dessin.
    const ecarts = modules[module_.type]?.meta?.ecarts;
    const choisi = Array.isArray(ecarts) && ecarts.includes(Number(ecart)) ? Number(ecart) : null;
    engine.annoncerModule(io, r, module_, { ecart: choisi });
  });

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
      // « CACHE-CACHE » EMPORTE SON CONTENU MODÉRÉ. Les gabarits de questions et
      // la banque d'objets sont rangés dans la banque du module — c'est ce qui
      // les rend durables et modifiables au Studio. Le moteur ne va pas les
      // chercher : ils voyagent avec le top de départ.
      if (module_.type === 'cache_cache' && question) {
        question.contenu = contenuDeLaBanque(module_.questions);
      }
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
      // UN JEU « EN DIRECT » N'A PAS DE BANQUE, et n'en manque donc pas. Sans ce
      // drapeau, l'écran de l'animateur le grisait comme un jeu vide — « Lancer
      // Le lien — aucune question » — et le rendait injouable.
      direct: modules[m.type]?.meta?.direct === true,
      // La durée du cadran, pour les jeux qui en ont un. C'est elle qui borne les
      // champs de saisie de l'animateur — voir la note dans la meta du module.
      dureeCompteMs: modules[m.type]?.meta?.dureeCompteMs ?? null,
    })));
  });
  // RÉVÉLATION ANTICIPÉE — qui, sur une manche à deux tours, OUVRE LE SECOND au
  // lieu de révéler tant qu'il reste un tour à jouer. Si ce bouton révélait la
  // bonne réponse au milieu du premier tour, le second n'aurait plus rien à
  // deviner : c'est `finDeFenetre` qui tranche, à un seul endroit.
  socket.on('host:reveal', () => { const r = requireRoom(socket); if (isHost(socket, r)) engine.finDeFenetre(io, r); });
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
      // SEULEMENT SI C'EST ENCORE SA LIAISON. Sur un rechargement, le navigateur
      // ouvre souvent la nouvelle avant que l'ancienne n'ait fini de mourir :
      // l'adieu de l'ancienne arrivait APRÈS le rattachement de la neuve et
      // effaçait `socketId`. Le joueur passait alors pour déconnecté, et surtout
      // son résultat de manche — envoyé à `p.socketId` — n'était plus envoyé
      // nulle part. Il restait sur « ta réponse est bien partie », révélation
      // comprise.
      if (p && p.socketId === socket.id) { p.connected = false; p.socketId = null; }
      engine.emitRoomState(io, r);
    }
  });
});

// SPA fallback (routes client) — sert index.html pour les chemins non-API.
//
// UN FICHIER ABSENT DOIT RÉPONDRE 404, PAS UNE PAGE.
//
// Ce repli répondait `index.html` avec un code 200 à TOUT chemin hors `/api` —
// `/favicon.ico` compris. Le navigateur demandait donc une icône et recevait
// cinq kilo-octets de HTML, annoncés comme un succès.
//
// Ce n'est pas une subtilité : `/favicon.ico` est la requête que TOUT navigateur
// émet de lui-même, sans qu'on la déclare. Une réponse 200 ne remplace jamais
// l'icône déjà mémorisée pour le domaine — seule une vraie 404 la fait
// abandonner. Un ancien favicon pouvait ainsi survivre indéfiniment à son
// remplacement, y compris après un rechargement forcé.
//
// La règle : un chemin qui porte une EXTENSION désigne un fichier. S'il n'existe
// pas, c'est 404. Les routes du client — `/play`, `/host`, `/overlay`, `/studio`
// — n'en portent aucune et continuent de recevoir la page.
// Douze caractères d'extension, et non huit : `site.webmanifest` en compte onze,
// et c'est exactement le genre de fichier qu'un navigateur va chercher tout seul.
// Aucune route du client ne porte de point, la borne peut donc être large.
const CHEMIN_DE_FICHIER = /\.[a-z0-9]{1,12}(\?|$)/i;

app.setNotFoundHandler((req, reply) => {
  const url = req.raw.url;
  if (url.startsWith('/api') || url.startsWith('/socket.io')) {
    return reply.code(404).send({ error: 'not-found' });
  }
  if (CHEMIN_DE_FICHIER.test(url)) {
    return reply.code(404).type('text/plain').send('not-found');
  }
  return reply.sendFile('index.html');
});

// Purge périodique des salons inactifs.
setInterval(() => roomManager.sweep(), 60 * 1000);

// AVANT D'OUVRIR LE PORT : on rapatrie les bibliothèques depuis la base.
//
// L'hébergement repart d'un disque vierge à chaque déploiement. Sans ce rappel,
// une console qui se reconnecte par le seul socket — sans passer par le Studio —
// jouerait sur un compte vide, et l'animateur découvrirait ses questions perdues
// à l'antenne.
await banksStore.restaurerTousLesComptes()
  .then(({ comptes }) => { if (comptes) app.log.info(`bibliothèques restaurées : ${comptes} compte(s)`); })
  .catch((e) => app.log.warn({ err: e }, 'restauration des bibliothèques impossible'));

app.listen({ port: config.port, host: config.host }).then(() => {
  console.log(`[game-server] écoute sur ${config.host}:${config.port}`);
});
