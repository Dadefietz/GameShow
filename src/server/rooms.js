// Gestion des salons — état ÉPHÉMÈRE en mémoire (jamais en base). Source de vérité du jeu.
import { customAlphabet } from 'nanoid';
import { config } from './config.js';

// Code de salon : 5 caractères non ambigus (ni 0/O ni 1/I).
const codeGen = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 5);

// États du salon (spec §6). PAUSED supprimé (retour produit 2026-08-18).
export const RoomState = {
  WAITING: 'waiting',
  PLAYING: 'playing',
  RESULTS: 'results',
  ENDED: 'ended',
};

export class RoomManager {
  constructor() {
    /** @type {Map<string, Salon>} */
    this.rooms = new Map();
    /** @type {Map<string, string>} ownerId -> code du salon actif (reconnexion animateur) */
    this.ownerRooms = new Map();
  }

  // Salon actif d'un animateur (pour reconnecter le même compte à son salon ouvert).
  getByOwner(ownerId) {
    if (!ownerId) return null;
    const code = this.ownerRooms.get(ownerId);
    if (!code) return null;
    const room = this.rooms.get(code);
    if (!room || room.state === RoomState.ENDED) { this.ownerRooms.delete(ownerId); return null; }
    return room;
  }

  createRoom(ownerId) {
    let code = codeGen();
    while (this.rooms.has(code)) code = codeGen();
    if (ownerId) this.ownerRooms.set(ownerId, code);
    const room = {
      code,
      ownerId,
      state: RoomState.WAITING,
      players: new Map(), // playerId -> { id, pseudo, score, streak, connected, socketId }
      currentModule: null, // { type, question, questionId, deadline, answers:Map, revealed }
      progression: { index: 0, total: 0 },
      history: [], // [{ moduleType, question, results }]
      // Configuration de séance (retours R5) : ordre aléatoire par défaut,
      // sélection manuelle facultative (moduleType -> [questionIds]), et
      // questions déjà jouées (pas de répétition tant que la banque n'est pas épuisée).
      session: { shuffle: true, selected: {}, used: new Set() },
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };
    this.rooms.set(code, room);
    return room;
  }

  get(code) {
    return this.rooms.get(code);
  }

  touch(room) {
    if (room) room.lastActivity = Date.now();
  }

  addPlayer(room, pseudo) {
    const id = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 10)();
    const player = { id, pseudo, score: 0, streak: 0, connected: false, socketId: null };
    room.players.set(id, player);
    this.touch(room);
    return player;
  }

  removeRoom(code) {
    this.rooms.delete(code);
  }

  // Classement trié décroissant. limit optionnel.
  leaderboard(room, limit) {
    const rows = [...room.players.values()]
      .map((p) => ({ id: p.id, pseudo: p.pseudo, score: p.score }))
      .sort((a, b) => b.score - a.score);
    rows.forEach((r, i) => (r.rank = i + 1));
    return typeof limit === 'number' ? rows.slice(0, limit) : rows;
  }

  rankOf(room, playerId) {
    const rows = this.leaderboard(room);
    return rows.find((r) => r.id === playerId) || null;
  }

  // Rang de chaque joueur (playerId -> rank), pour calculer les places gagnées/perdues.
  rankMap(room) {
    const map = new Map();
    for (const r of this.leaderboard(room)) map.set(r.id, r.rank);
    return map;
  }

  // Purge des salons inactifs (appelée périodiquement). Un salon ENDED reste
  // vivant 5 minutes : l'animateur peut relancer une partie après le podium
  // sans que ses joueurs aient à rejoindre de nouveau.
  sweep() {
    const now = Date.now();
    const ENDED_GRACE_MS = 5 * 60 * 1000;
    for (const [code, room] of this.rooms) {
      const idle = now - room.lastActivity;
      if ((room.state === RoomState.ENDED && idle > ENDED_GRACE_MS) || idle > config.roomIdleTtlMs) {
        this.rooms.delete(code);
        if (room.ownerId && this.ownerRooms.get(room.ownerId) === code) this.ownerRooms.delete(room.ownerId);
      }
    }
  }
}

export const roomManager = new RoomManager();
