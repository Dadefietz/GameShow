// Hook temps réel partagé par toutes les surfaces. Se connecte avec un token de jeu,
// maintient l'état reçu du serveur (autoritaire), et expose une fonction d'émission.
import { useEffect, useRef, useState, useCallback } from 'react';
import { connectSocket } from './net.js';

export function useGame(token) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState(null);        // { code, state, playerCount, progression, leaderboard }
  const [current, setCurrent] = useState(null);   // module en cours (question publique)
  const [tick, setTick] = useState(null);         // { timeLeft, answers }
  const [reveal, setReveal] = useState(null);     // résultat révélé
  const [leaderboard, setLeaderboard] = useState([]);
  const [you, setYou] = useState(null);           // { rank, score, delta } (joueur)
  const [podium, setPodium] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [roomClosed, setRoomClosed] = useState(false);
  const [distribution, setDistribution] = useState(null); // répartition des réponses (animateur)
  const [history, setHistory] = useState([]);             // récap des manches (fin de partie)

  useEffect(() => {
    if (!token) return;
    const s = connectSocket(token);
    socketRef.current = s;
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('room:state', (st) => { setRoom(st); if (st.leaderboard) setLeaderboard(st.leaderboard); });
    s.on('module:started', (m) => { setCurrent(m); setReveal(null); setAnswered(false); setDistribution(null); setPodium(null); setTick({ timeLeft: Math.ceil((m.durationMs || 0) / 1000), answers: 0 }); });
    s.on('module:distribution', (d) => setDistribution(d));
    s.on('module:tick', (t) => setTick(t));
    s.on('module:answersCount', (c) => setTick((prev) => ({ ...(prev || {}), answers: c.count })));
    s.on('module:closed', () => setTick((prev) => ({ ...(prev || {}), timeLeft: 0 })));
    s.on('module:reveal', (r) => setReveal(r));
    s.on('leaderboard:update', (d) => setLeaderboard(d.leaderboard || []));
    s.on('play:you', (y) => setYou(y));
    s.on('play:accepted', (res) => { if (res && res.ok) setAnswered(true); });
    s.on('game:ended', (d) => { setPodium(d.podium || []); setLeaderboard(d.leaderboard || []); setHistory(d.history || []); });
    s.on('room:closed', () => setRoomClosed(true));
    return () => s.close();
  }, [token]);

  const emit = useCallback((event, payload) => {
    socketRef.current?.emit(event, payload);
  }, []);

  return { connected, room, current, tick, reveal, leaderboard, you, podium, answered, roomClosed, distribution, history, emit };
}

// Persistance légère (reconnexion sans perte).
export const store = {
  save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} },
  load(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  clear(key) { try { localStorage.removeItem(key); } catch {} },
};
