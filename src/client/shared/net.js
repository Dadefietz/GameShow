// Couche réseau client : REST minimal + connexion Socket.IO (temps réel).
import { io } from 'socket.io-client';

const API = '';

export async function createRoom(accessToken) {
  const res = await fetch(`${API}/api/rooms`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}) },
    body: '{}', // corps JSON vide explicite (Fastify rejette un POST application/json sans corps)
  });
  const data = await res.json().catch(() => ({}));
  // Le code d'erreur du serveur est PROPAGÉ (ex. 'not-host') : l'appelant doit pouvoir
  // distinguer un refus d'autorisation d'une simple panne réseau — jamais d'échec muet.
  if (!res.ok) throw new Error(data.error || 'create-room-failed');
  return data;
}

export async function joinRoom(code, pseudo) {
  const res = await fetch(`${API}/api/rooms/${encodeURIComponent(code)}/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pseudo }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'join-failed');
  return data;
}

// Ouvre une connexion Socket.IO avec un token de jeu (reconnexion auto par défaut).
export function connectSocket(token) {
  return io({
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 4000,
  });
}
