// Gestion des salons — état ÉPHÉMÈRE en mémoire (jamais en base). Source de vérité du jeu.
import { customAlphabet } from 'nanoid';
import { config } from './config.js';

// Code de salon : 5 caractères non ambigus (ni 0/O ni 1/I).
const codeGen = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 5);

// États du salon (spec §6).
export const RoomState = {
  WAITING: 'waiting',
  PLAYING: 'playing',
  PAUSED: 'paused',
  RESULTS: 'results',
  ENDED: 'ended',
};

export class RoomManager {
  constructor() {
    /** @type {Map<string, Salon>} */
    this.rooms = new Map();
  }

  createRoom(ownerId) {
    let code = codeGen();
    while (this.rooms.has(code)) code = codeGen();
    const room = {
      code,
      ownerId,
      state: RoomState.WAITING,
      players: new Map(), // playerId -> { id, pseudo, score, connected, socketId }
      currentModule: null, // { type, question, questionId, deadline, answers:Map, revealed }
      progression: { index: 0, total: 0 },
      history: [], // [{ moduleType, question, results }]
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
    const player = { id, pseudo, score: 0, connected: false, socketId: null };
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

  // Purge des salons inactifs (appelée périodiquement).
  sweep() {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      if (room.state === RoomState.ENDED || now - room.lastActivity > config.roomIdleTtlMs) {
        this.rooms.delete(code);
      }
    }
  }
}

export const roomManager = new RoomManager();
