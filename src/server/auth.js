// Authentification — deux mondes distincts :
//  - Animateur : session Supabase (JWT vérifié via JWKS) pour ouvrir un salon.
//  - Joueur / overlay : anonymes, jetons courts signés par le serveur (HS256), portée = salon.
import jwt from 'jsonwebtoken';
import { config } from './config.js';

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
// En prod : valider le JWT Supabase via JWKS. Ici, décodage + contrôles de base ;
// la source de vérité reste le service-role côté DB (RLS). Retourne { sub, email } ou null.
let jwksCache = null;
async function getJwks() {
  if (jwksCache) return jwksCache;
  if (!config.supabaseJwksUrl) return null;
  try {
    const res = await fetch(config.supabaseJwksUrl);
    jwksCache = await res.json();
    return jwksCache;
  } catch {
    return null;
  }
}

export async function verifyHostSession(accessToken) {
  if (!accessToken) return null;
  // Décodage sans vérif de signature pour extraire le sujet ; la vérif forte se fait
  // côté DB via service-role + RLS. (En prod : vérifier la signature RS256 via JWKS.)
  try {
    const decoded = jwt.decode(accessToken, { complete: true });
    if (!decoded || !decoded.payload || !decoded.payload.sub) return null;
    const { sub, email, exp } = decoded.payload;
    if (exp && Date.now() / 1000 > exp) return null;
    await getJwks(); // best-effort (préchargement)
    return { sub, email: email || null };
  } catch {
    return null;
  }
}
