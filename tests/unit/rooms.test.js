// Tests unitaires — salons, classement, rangs (logique pure en mémoire).
import { describe, it, expect } from 'vitest';
import { RoomManager, RoomState } from '../../src/server/rooms.js';

describe('RoomManager', () => {
  it('génère un code de 5 caractères non ambigus (ni 0/O ni 1/I)', () => {
    const rm = new RoomManager();
    const room = rm.createRoom('owner');
    expect(room.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/);
    expect(rm.get(room.code)).toBe(room);
  });

  it('initialise la configuration de séance : aléatoire par défaut, aucune sélection', () => {
    const rm = new RoomManager();
    const room = rm.createRoom('owner');
    expect(room.session.shuffle).toBe(true);
    expect(room.session.selected).toEqual({});
    expect(room.session.used.size).toBe(0);
  });

  it('classe par score décroissant avec rangs 1..N', () => {
    const rm = new RoomManager();
    const room = rm.createRoom('owner');
    const a = rm.addPlayer(room, 'Alice');
    const b = rm.addPlayer(room, 'Bob');
    const c = rm.addPlayer(room, 'Chloe');
    a.score = 500; b.score = 900; c.score = 100;
    const board = rm.leaderboard(room);
    expect(board.map((r) => r.pseudo)).toEqual(['Bob', 'Alice', 'Chloe']);
    expect(board.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(rm.leaderboard(room, 2)).toHaveLength(2);
  });

  it('rankMap donne le rang de chaque joueur (pour les places gagnées/perdues)', () => {
    const rm = new RoomManager();
    const room = rm.createRoom('owner');
    const a = rm.addPlayer(room, 'A');
    const b = rm.addPlayer(room, 'B');
    a.score = 10; b.score = 20;
    const map = rm.rankMap(room);
    expect(map.get(b.id)).toBe(1);
    expect(map.get(a.id)).toBe(2);
  });

  it('les joueurs démarrent à streak 0 et score 0', () => {
    const rm = new RoomManager();
    const room = rm.createRoom('owner');
    const p = rm.addPlayer(room, 'X');
    expect(p.score).toBe(0);
    expect(p.streak).toBe(0);
  });

  it('sweep : grâce de 5 min pour un salon terminé, purge après, purge des inactifs', () => {
    const rm = new RoomManager();
    // Terminé À L'INSTANT : conservé (l'animateur peut relancer après le podium).
    const endedFresh = rm.createRoom('o1');
    endedFresh.state = RoomState.ENDED;
    // Terminé depuis plus de 5 min : purgé.
    const endedOld = rm.createRoom('o2');
    endedOld.state = RoomState.ENDED;
    endedOld.lastActivity = Date.now() - 6 * 60 * 1000;
    // Inactif au-delà du TTL : purgé.
    const stale = rm.createRoom('o3');
    stale.lastActivity = Date.now() - 100 * 60 * 60 * 1000;
    const alive = rm.createRoom('o4');
    rm.sweep();
    expect(rm.get(endedFresh.code)).toBeDefined();
    expect(rm.get(endedOld.code)).toBeUndefined();
    expect(rm.get(stale.code)).toBeUndefined();
    expect(rm.get(alive.code)).toBeDefined();
  });
});
