// Configuration serveur — résolue depuis l'environnement. Aucun secret en dur.
export const config = {
  port: Number(process.env.PORT || 8787),
  host: process.env.HOST || '0.0.0.0',
  // Supabase — service role UNIQUEMENT côté serveur (jamais exposé au front).
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRole: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  supabaseJwksUrl: process.env.SUPABASE_JWKS_URL || '',
  // Secret de signature des tokens de jeu (host/player/overlay). Jamais côté front.
  gameJwtSecret: process.env.GAME_JWT_SECRET || 'dev-only-insecure-change-me',
  // Origines autorisées (CORS / Socket.IO). En prod, on ajoute automatiquement l'URL publique
  // fournie par l'hébergeur (Render : RENDER_EXTERNAL_URL) pour accepter la connexion same-origin
  // du front sans connaître le domaine à l'avance.
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:8787')
    .split(',')
    .concat(process.env.RENDER_EXTERNAL_URL ? [process.env.RENDER_EXTERNAL_URL] : [])
    .filter(Boolean),
  // Répertoire du build front statique servi par le serveur.
  clientDist: process.env.CLIENT_DIST || 'dist',
  // Bornes de salon.
  roomIdleTtlMs: Number(process.env.ROOM_IDLE_TTL_MS || 4 * 60 * 60 * 1000), // 4h
  maxPlayersPerRoom: Number(process.env.MAX_PLAYERS_PER_ROOM || 1000),
};

export const isProd = process.env.NODE_ENV === 'production';
