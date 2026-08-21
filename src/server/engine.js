// Moteur de jeu — cycle de vie d'un module dans un salon. Le serveur est AUTORITAIRE.
// Règles d'affichage (retours produit 2026-08-18) :
//  - À la fin du chrono, la fenêtre de réponse est fermée ET la révélation est
//    automatique (bonne réponse + stats de répartition diffusées à tous).
//  - Le rang d'un joueur ne lui est JAMAIS envoyé en cours de partie : il reçoit
//    uniquement ses points gagnés et les places gagnées/perdues. Le classement
//    complet ne circule que sur le canal "staff" (animateur + stream). Le podium
//    final est public à la fin de la partie.
import { modules, histogrammeBareme, plagesEstimation } from './modules.js';

// L'ouverture minimale de l'échelle : la demi-largeur de la plage la plus large
// du barème. Un seul endroit la calcule ici comme à la révélation, pour que les
// deux histogrammes — celui du direct et celui de la révélation — partagent
// exactement la même échelle.
function plagesDe(rt) {
  return plagesEstimation(rt.target, rt.nature === 'annee' ? 'annee' : 'nombre');
}
function margeBareme(rt) {
  return Math.max(0, ...plagesDe(rt).map((p) => p.haut - rt.target));
}
import { RoomState, roomManager } from './rooms.js';

// BARÈME (PLAN-CHANTIER, actions 8 et 17) — deux lignes, pas quatre :
//   points = BASE + COMPLÉMENT DE VITESSE
//
//  - Base : les points de la bonne réponse, indépendants de la rapidité.
//  - Complément de vitesse : croît avec la rapidité, plus 150 pour la réponse
//    correcte la plus rapide de la manche.
//
// Ce qui a disparu, et pourquoi :
//  - Le BONUS DE SÉRIE ne rapporte plus rien. Il était fusionné avec le bonus de
//    vitesse et affiché sous ce nom : un joueur en série de trois lisait « bonus
//    vitesse +100 » sans avoir été rapide, pendant que la case « série » montrait
//    « ×3 » sans le moindre point en face. La série reste SUIVIE et affichée,
//    comme une information — la reconnaissance remplace les points.
//  - Le MALUS n'existe plus, dans aucun jeu. Une mauvaise réponse ne rapporte
//    rien ; elle ne coûte rien. Contrepartie assumée : répondre au hasard est
//    gratuit, ce qui est la norme du genre et sert la participation.
// CHANTIER v4, décision 4.2 : le supplément du plus rapide est SUPPRIMÉ du calcul.
// Décision 4.5 : le plus rapide reste DÉSIGNÉ, comme information et non comme
// points — exactement le traitement que T1 du chantier v1 a réservé à la série.
// La constante disparaît ; le drapeau `fastest` la remplace dans ce que le serveur
// transmet au joueur.

// Le classement circule ENTIER vers l'animateur et le stream (action 3). Il était
// tronqué à dix en cours de partie et à cinquante à la fin : le onzième joueur
// n'arrivait jamais jusqu'à l'écran, quoi qu'on affiche. La borne qui subsiste
// n'est qu'un garde-fou contre un cas aberrant — très au-dessus de tout effectif
// réel de soirée — et jamais une règle d'affichage.
// Exporté depuis le chantier v4 : la reconnexion après la fin de partie doit
// rejouer le MÊME classement que celui envoyé à la fin (décision 3.3). Deux
// plafonds différents finiraient par diverger.
export const CLASSEMENT_MAX = 500;

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
    // Min / moyenne / max POUR SITUER, et l'histogramme en 8 tranches POUR VOIR :
    // la maquette animateur (A5) le spécifiait depuis le début, il n'avait jamais
    // été construit — et le serveur ne calculait même pas les tranches.
    const vals = [...rt.answers.values()].map((a) => a.value);
    if (!vals.length) return { kind: 'numeric', total: 0 };
    const sum = vals.reduce((s, v) => s + v, 0);
    return {
      kind: 'numeric',
      total: vals.length,
      min: Math.min(...vals),
      max: Math.max(...vals),
      avg: Math.round(sum / vals.length),
      // LA MÊME ÉCHELLE, ET LES MÊMES REPÈRES, DÈS LE DIRECT.
      //
      // Ce panneau ne part QUE sur le canal de l'animateur (`toHost`, plus haut) :
      // y porter la cible et les plages ne dévoile rien de plus — il voit déjà la
      // tranche de la vérité en couleur, et la révélation rend le tout public une
      // seconde plus tard.
      //
      // Ce que ça corrige, en revanche : l'échelle et les repères CHANGEAIENT à la
      // révélation, si bien que le graphique sur lequel l'animateur décidait
      // n'était pas celui qu'il commentait ensuite.
      histogramme: histogrammeBareme(vals, rt.target, plagesDe(rt), margeBareme(rt)),
      target: rt.target,
      plages: plagesDe(rt),
      nature: rt.nature === 'annee' ? 'annee' : 'nombre',
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
  toStaff(io, room).emit('leaderboard:update', { leaderboard: roomManager.leaderboard(room, CLASSEMENT_MAX) });
}

// Lance un module avec une question. answers vidées, deadline serveur posée.
// `jeu` est le module NOMMÉ de la bibliothèque de l'animateur : { id, type, name }.
// C'est lui qui donne son nom à la manche — les écrans affichaient jusqu'ici le
// nom générique du type (« Quiz »), et celui que l'animateur avait choisi dans le
// Studio ne voyageait nulle part.
export function startModule(io, room, jeu, question) {
  const mod = modules[jeu.type];
  if (!mod) throw new Error('module inconnu: ' + jeu.type);
  const rt = mod.buildRound(question);
  rt.moduleId = jeu.id;
  rt.moduleName = jeu.name;
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
  // Identité de cette manche : voyage avec la question ET avec le résultat perso,
  // pour qu'un client sache toujours si son résultat est celui de la manche affichée.
  room.roundSeq = (room.roundSeq || 0) + 1;
  rt.roundId = room.roundSeq;
  roomManager.touch(room);

  // Question publique (sans la bonne réponse) aux joueurs + stream.
  const payload = {
    ...mod.publicQuestion(rt),
    roundId: rt.roundId,
    // Identifiant du JEU en cours : permet à l'animateur d'enchaîner « question
    // suivante » DANS CE JEU, et non dans le premier venu de ce type.
    moduleId: rt.moduleId,
    durationMs: rt.durationMs,
    deadline: rt.deadline,
    // Le nom du JEU remplace le nom générique du type : « Culture générale »
    // plutôt que « Quiz », sur les trois écrans à la fois.
    meta: { ...mod.meta, name: jeu.name },
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
// Calcule base + complément de vitesse, met à jour scores et séries, diffuse la
// bonne réponse et les stats à tous, et envoie à chaque joueur SON delta (sans rang).
export function reveal(io, room) {
  const rt = room.currentModule;
  if (!rt || rt.revealed) return;
  if (!rt.closed) closeWindow(io, room);
  const mod = modules[rt.type];
  const ranksBefore = roomManager.rankMap(room);
  const { results, reveal: revealPayload, prives } = mod.score(rt);

  // Le caractère « noté » se lit sur la MANCHE, plus sur le type de module : un
  // vote peut être un jeu ou un sondage selon la question (action 18). Le repli
  // sur meta.scored couvre les trois autres modules, où il ne varie pas.
  const noté = rt.scored !== undefined ? rt.scored : mod.meta.scored;

  // LE PLUS RAPIDE — désigné, jamais payé (chantier v4, décisions 4.2 et 4.5).
  // Réservé aux modules où la rapidité prouve quelque chose : ni l'estimation
  // (la précision y est le seul sujet) ni le vote (on ne devine pas plus vite ce
  // que pense la salle).
  // Il ne rapporte plus de points, mais il continue d'être NOMMÉ : c'est ce
  // drapeau, et non un seuil de points, qui déclenche la phrase « le plus rapide
  // du cercle » côté joueur. Sans lui, cette phrase se dirait à quiconque répond
  // vite sans être premier — ce qu'interdit la décision 8 de l'action 7 du v1.
  let fastestPid = null;
  if (noté && mod.meta.vitesse) {
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
    const base = r ? r.base : 0;
    let speed = r ? r.speed || 0 : 0;
    if (noté) {
      if (r && r.correct === true) {
        p.streak += 1;
      } else {
        // La série se rompt sur une mauvaise réponse ET sur une absence de
        // réponse : une manche non jouée n'est pas une bonne réponse. Elle ne
        // coûte aucun point pour autant.
        p.streak = 0;
      }
    }
    const delta = base + speed;
    p.score = Math.max(0, p.score + delta);
    perPlayer.set(pid, {
      base, speed, delta, streak: p.streak, palier: r ? r.palier : null,
      // DÉCISION 4.5 — information, pas points. C'est ce drapeau qui autorise la
      // phrase « le plus rapide du cercle », désormais qu'aucun supplément ne la
      // trahit plus par un seuil.
      fastest: pid === fastestPid,
    });
  }

  rt.revealed = true;
  room.state = RoomState.RESULTS;
  const ranksAfter = roomManager.rankMap(room);
  room.history.push({ moduleType: rt.type, text: rt.text, reveal: revealPayload, options: rt.options || null, at: Date.now() });
  rt.revealPayload = { ...revealPayload, type: rt.type }; // mémorisé pour la restauration à la reconnexion

  // Bonne réponse + stats de répartition : diffusées à TOUTES les surfaces.
  toRoom(io, room).emit('module:reveal', rt.revealPayload);
  // Classement : canal staff uniquement (animateur + stream).
  toStaff(io, room).emit('leaderboard:update', { leaderboard: roomManager.leaderboard(room, CLASSEMENT_MAX) });

  // LE NOM DU PLUS PROCHE — CANAL ANIMATEUR SEUL (chantier v4, décision 6.2).
  // Le stream est une source capturée par OBS : y faire apparaître un nom
  // romprait l'anonymat que la réunion a explicitement demandé de préserver.
  // Les `stats` publiques, elles, gardent la VALEUR sans le nom (décision 6.3).
  if (prives && Array.isArray(prives.plusProches) && prives.plusProches.length) {
    io.to(room.code + ':host').emit('host:closest', {
      roundId: rt.roundId,
      joueurs: prives.plusProches
        .map((pid) => {
          const p = room.players.get(pid);
          const a = rt.answers.get(pid);
          return p ? { pseudo: p.pseudo, valeur: a ? a.value : null } : null;
        })
        .filter(Boolean),
    });
  }
  emitRoomState(io, room);

  // Feedback perso à chaque joueur : points gagnés + places gagnées/perdues. JAMAIS le rang.
  // Le résultat est MÉMORISÉ avant d'être émis : sans ça, un joueur qui se
  // reconnecte (verrouillage d'écran sur mobile) ne le recevrait jamais et son
  // écran conclurait qu'il n'a pas participé (R12).
  for (const [pid, p] of room.players) {
    const d = perPlayer.get(pid) || { base: 0, speed: 0, delta: 0, streak: p.streak, palier: null, fastest: false };
    const placesDelta = (ranksBefore.get(pid) || 0) - (ranksAfter.get(pid) || 0);
    const you = {
      roundId: rt.roundId,
      score: p.score,
      delta: d.delta,
      base: d.base,
      speed: d.speed,
      streak: d.streak,
      fastest: d.fastest,
      // Palier de précision atteint (estimation seulement) : porte l'affichage
      // et, plus tard, le message adapté à la justesse (action 7).
      palier: d.palier,
      placesDelta,
    };
    // Mémorisé pour les seuls participants : un absent n'a pas de résultat à
    // revoir, il doit lire « tu n'étais pas là », pas un relevé à zéro.
    if (rt.answers.has(pid)) p.lastResult = you;
    if (p.socketId) io.to(p.socketId).emit('play:you', you);
  }
  roomManager.touch(room);
}

// La correction manuelle de score a été SUPPRIMÉE (action 8). Elle s'affichait
// sous le titre « Bonus / Malus » et permettait d'ajouter ou retirer 100 points à
// n'importe quel joueur, sans règle, sans trace et sans retour arrière — le seul
// objet du projet à porter ce nom sans avoir de règle. Conséquence assumée : plus
// aucun moyen de rattraper un score en direct si un téléphone plante.

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
  // La liste des questions déjà posées N'EST PAS remise à zéro : « jamais deux
  // fois la même question dans un même salon » vaut pour la soirée entière, pas
  // pour une partie. Elle ne se vide qu'à la fermeture du salon.
  // Les files, elles, repartent : une nouvelle partie mérite un nouvel ordre.
  room.session.queues = {};
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
  toRoom(io, room).emit('game:ended', { podium, leaderboard: roomManager.leaderboard(room, CLASSEMENT_MAX), history });
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
