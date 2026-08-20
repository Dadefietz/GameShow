// Authentification — deux mondes distincts :
//  - Animateur : session Supabase (JWT VÉRIFIÉ) pour ouvrir un salon.
//  - Joueur / overlay : anonymes, jetons courts signés par le serveur (HS256), portée = salon.
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { config, isProd } from './config.js';
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
// La session est VÉRIFIÉE (SECURITY-AUDIT F-001), par ordre de préférence :
//  1. Supabase auth.getUser (service client) — validation côté Supabase, la plus forte ;
//  2. JWKS (RS256/ES256) si SUPABASE_JWKS_URL est configurée — clés publiques Supabase ;
//  3. secret JWT du projet (HS256) si SUPABASE_JWT_SECRET est configuré ;
//  4. sinon : mode dev UNIQUEMENT — refusé si HOST_EMAIL est défini (une adresse
//     ou plusieurs) ou en production
//     (fail-closed : jamais de décodage sans vérification quand le verrou animateur est actif).
let jwksCache = null;
let jwksFetchedAt = 0;
const JWKS_TTL_MS = 10 * 60 * 1000;

async function getJwks() {
  if (jwksCache && Date.now() - jwksFetchedAt < JWKS_TTL_MS) return jwksCache;
  if (!config.supabaseJwksUrl) return null;
  try {
    const res = await fetch(config.supabaseJwksUrl);
    if (!res.ok) return jwksCache;
    jwksCache = await res.json();
    jwksFetchedAt = Date.now();
    return jwksCache;
  } catch {
    return jwksCache; // réseau en panne : on garde la dernière copie connue
  }
}

export async function verifyHostSession(accessToken) {
  if (!accessToken) return null;

  // 1. Validation auprès de Supabase (signature + expiration vérifiées côté Supabase).
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

  try {
    const decoded = jwt.decode(accessToken, { complete: true });
    if (!decoded || !decoded.payload || !decoded.payload.sub) return null;

    // 2. Vérification asymétrique via JWKS (RS256 / ES256).
    if (config.supabaseJwksUrl) {
      const jwks = await getJwks();
      const keys = jwks?.keys || [];
      const jwk = keys.find((k) => k.kid === decoded.header.kid) || (keys.length === 1 ? keys[0] : null);
      if (!jwk) return null;
      const pem = crypto.createPublicKey({ key: jwk, format: 'jwk' }).export({ type: 'spki', format: 'pem' });
      const payload = jwt.verify(accessToken, pem, { algorithms: ['RS256', 'ES256'] });
      return { sub: payload.sub, email: payload.email || null };
    }

    // 3. Vérification symétrique (secret JWT du projet Supabase, HS256).
    if (config.supabaseJwtSecret) {
      const payload = jwt.verify(accessToken, config.supabaseJwtSecret, { algorithms: ['HS256'] });
      return { sub: payload.sub, email: payload.email || null };
    }

    // 4. Aucun vérificateur configuré : accepté en DEV seulement, jamais quand le
    // verrou animateur unique est actif ni en production.
    if (config.hostEmails.length || isProd) return null;
    const { sub, email, exp } = decoded.payload;
    if (exp && Date.now() / 1000 > exp) return null;
    return { sub, email: email || null };
  } catch {
    return null;
  }
}
