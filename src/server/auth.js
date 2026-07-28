// Authentification — deux mondes distincts :
//  - Animateur : session Supabase (JWT vérifié via JWKS) pour ouvrir un salon.
//  - Joueur / overlay : anonymes, jetons courts signés par le serveur (HS256), portée = salon.
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { getServiceClient } from './supabase.js';

// --- Jetons de jeu signés par le serveur (le client ne calcule jamais rien de sensible) ---
export function signGameToken(payload, expiresIn) {
  return jwt.sign(payload, config.gameJwtSecret, { expiresIn: expiresIn || '6h' });
}

export function verifyGameToken(token) {
  try {
    return jwt.verify(token, config.gameJwtSecret);
  } catch {
    return null;
  }
}

export function makePlayerToken(roomCode, playerId) {
  return signGameToken({ role: 'player', room: roomCode, sub: playerId });
}
export function makeHostToken(roomCode, ownerId) {
  return signGameToken({ role: 'host', room: roomCode, sub: ownerId });
}
export function makeOverlayToken(roomCode) {
  return signGameToken({ role: 'overlay', room: roomCode });
}

// --- Vérification de la session animateur Supabase ---
// Prod : le token est VALIDÉ auprès de Supabase (auth.getUser) — la signature et
// l'expiration sont vérifiées côté Supabase, ce qui empêche toute usurpation d'identité.
// Repli dev (Supabase non configuré) : décodage sans vérif (aucune sécurité, dev only).
// Retourne { sub, email } ou null.
export async function verifyHostSession(accessToken) {
  if (!accessToken) return null;
  const sb = getServiceClient();
  if (sb) {
    try {
      const { data, error } = await sb.auth.getUser(accessToken);
      if (error || !data || !data.user) return null;
      return { sub: data.user.id, email: data.user.email || null };
    } catch {
      return null;
    }
  }
  // --- Repli DEV uniquement (pas de Supabase) : décodage non vérifié ---
  try {
    const decoded = jwt.decode(accessToken, { complete: true });
    if (!decoded || !decoded.payload || !decoded.payload.sub) return null;
    const { sub, email, exp } = decoded.payload;
    if (exp && Date.now() / 1000 > exp) return null;
    return { sub, email: email || null };
  } catch {
    return null;
  }
}
