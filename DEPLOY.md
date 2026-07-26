# Déploiement — Project Game Show

Mise en ligne en **un seul service** : le serveur Node sert le front buildé + l'API REST + le WebSocket temps réel. Une seule URL publique, pas de Cloudflare (le WebSocket ne peut pas tourner sur Cloudflare Workers).

## Prérequis
- Un compte **GitHub** (le repo du projet).
- Un compte **Render** (gratuit) — https://render.com, « Sign in with GitHub ».
- (Optionnel, plus tard) un projet **Supabase** pour l'auth animateur réelle et les questions durables.

## Étapes

### 1. Pousser le code sur GitHub
Le repo doit contenir tout le projet **sauf** `node_modules/`, `dist/`, `.vault/` (déjà exclus par `.gitignore`).

### 2. Créer le service Render
Deux options :

**A. Blueprint (automatique, recommandé)**
1. Sur Render → **New** → **Blueprint**.
2. Sélectionne le repo GitHub du projet.
3. Render lit `render.yaml` et configure tout seul : build (`npm install --include=dev && npm run build`), start (`npm start`), health check (`/api/health`), et génère un `GAME_JWT_SECRET` aléatoire fort.
4. **Create** → attends le build (~2-3 min).

**B. Manuel**
1. **New** → **Web Service** → connecte le repo.
2. Runtime **Node**, Build `npm install --include=dev && npm run build`, Start `npm start`.
3. Variables d'environnement : `NODE_ENV=production`, `GAME_JWT_SECRET=<32+ caractères aléatoires>`.

### 3. Accéder à l'app
Render fournit une URL type `https://project-game-show.onrender.com`.
- Animateur : `/` ou `/host`
- Joueur : `/play` (ou via le QR code affiché dans le lobby)
- Overlay OBS : `/overlay`
- Studio (gestion questions) : `/studio`

> ⚠️ Offre gratuite Render : le service s'endort après ~15 min d'inactivité et met ~30 s à se réveiller à la première requête. Pour un usage live sans latence de réveil, passer au plan payant (~7 $/mois) ou pinger l'URL périodiquement.

## Brancher Supabase (plus tard, optionnel)
Sans Supabase, l'app tourne en **mode démo** : login animateur local + questions d'exemple. Pour l'auth animateur réelle et tes propres questions :
1. Crée un projet Supabase (⚠️ ton org a déjà 2 projets gratuits — il faudra en libérer un ou passer en payant).
2. Applique le schéma SQL (tables + RLS) — voir `docs/TECH-SPEC-v1.md`.
3. Ajoute sur Render (server, secrets) : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWKS_URL`.
4. Ajoute au build front (variables publiques) : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

Le `service_role` reste **strictement côté serveur** (jamais dans le bundle front). Seule la clé `anon` (protégée par RLS) va au front.

## Rappels de sécurité
- `GAME_JWT_SECRET` et `SUPABASE_SERVICE_ROLE_KEY` : uniquement en variables d'environnement Render, **jamais** commités.
- Phases **test** et **sécurité** de la pipeline non exécutées ; login animateur en **mode dev** tant que Supabase n'est pas branché. OK pour un test perso, à durcir avant ouverture large.
