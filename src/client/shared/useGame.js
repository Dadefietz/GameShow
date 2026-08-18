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
  const [fatal, setFatal] = useState(null);               // salon mort / token invalide (irrécupérable)
  const [serverError, setServerError] = useState(null);   // erreur signalée par le serveur (host:error)

  useEffect(() => {
    if (!token) return;
    setFatal(null);
    const s = connectSocket(token);
    socketRef.current = s;
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    // Salon disparu (redéploiement serveur, expiration) ou token invalide :
    // inutile de réessayer — on le signale pour que la surface purge sa session
    // locale au lieu de rester figée sur des informations périmées.
    s.on('connect_error', (err) => {
      const msg = err && err.message;
      if (msg === 'room-not-found' || msg === 'unauthorized') {
        setFatal(msg);
        s.close();
      }
    });
    s.on('room:state', (st) => { setRoom(st); if (st.leaderboard) setLeaderboard(st.leaderboard); });
    s.on('module:started', (m) => {
      // `answered` restauré par le serveur (reconnexion/retardataire : pas de double réponse).
      setCurrent(m); setReveal(null); setAnswered(!!m.answered); setDistribution(null); setPodium(null);
      // Temps restant RÉEL (deadline serveur) — un rechargement en cours de manche
      // n'affiche plus la durée totale comme s'il restait tout le temps.
      const left = m.deadline ? Math.max(0, Math.ceil((m.deadline - Date.now()) / 1000)) : Math.ceil((m.durationMs || 0) / 1000);
      setTick({ timeLeft: left, answers: 0 });
    });
    s.on('module:distribution', (d) => setDistribution(d));
    s.on('host:error', (e) => setServerError({ ...e, at: Date.now() }));
    s.on('module:tick', (t) => setTick(t));
    s.on('module:answersCount', (c) => setTick((prev) => ({ ...(prev || {}), answers: c.count })));
    s.on('module:closed', () => setTick((prev) => ({ ...(prev || {}), timeLeft: 0 })));
    s.on('module:reveal', (r) => setReveal(r));
    s.on('leaderboard:update', (d) => setLeaderboard(d.leaderboard || []));
    s.on('play:you', (y) => setYou(y));
    s.on('play:accepted', (res) => { if (res && (res.ok || res.reason === 'already')) setAnswered(true); });
    s.on('game:ended', (d) => { setPodium(d.podium || []); setLeaderboard(d.leaderboard || []); setHistory(d.history || []); });
    // Retour au salon d'attente : on efface tout le résiduel de la partie précédente,
    // sinon le joueur resterait sur son podium et l'animateur sur son classement.
    s.on('game:lobby', () => {
      // podium à null, pas à [] : la surface joueur teste sa simple présence
      // pour afficher l'écran de fin, et un tableau vide reste « vrai ».
      setPodium(null); setLeaderboard([]); setHistory([]);
      setReveal(null); setTick(null); setYou(null); setAnswered(false);
    });
    s.on('room:closed', () => setRoomClosed(true));
    return () => s.close();
  }, [token]);

  const emit = useCallback((event, payload, ack) => {
    socketRef.current?.emit(event, payload, ack);
  }, []);

  return { connected, room, current, tick, reveal, leaderboard, you, podium, answered, roomClosed, distribution, history, fatal, serverError, emit };
}

// Persistance légère (reconnexion sans perte).
export const store = {
  save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} },
  load(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  clear(key) { try { localStorage.removeItem(key); } catch {} },
};
