---
artifact_type: security_audit
app: root
version: 1
change_set: none
produced_by: security-tester
created_at: 2026-08-18
created_by: security-tester
status: validated
owasp_version: "2025"
severity_summary: critical:1 high:3 medium:2 low:3 info:2
---

# Audit de Sécurité — Project Game Show

**Date :** 2026-08-18
**Auditeur :** security-tester (pipeline automatisé)
**Stack :** render-or-railway + react-vite + socketio + supabase (Node 24 local, fastify 5)
**Scope :** Code source (`src/`), configuration, dépendances

---

## Résumé exécutif

| Sévérité | Findings | Corrigés | Ouverts |
|---|---|---|---|
| Critical | 1 | 1 | 0 |
| High | 3 | 3 | 0 |
| Medium | 2 | 1 | 1 |
| Low | 3 | 1 | 2 |
| Info | 2 | 0 | — |

**Score de sécurité global : A** (0 Critical ouvert + 0 High ouvert)
Le seul finding Medium ouvert (F-006, migrations RLS absentes) ne bloque pas tant que
Supabase n'est pas branché — il est routé vers app-builder PATCH et repris dans la
checklist pré-déploiement.

---

## OWASP Top 10 — Analyse détaillée

### A01 — Broken Access Control
**Statut :** PASS

- Une seule requête DB (`src/server/supabase.js:22`, `.from('questions')`) : filtrée par
  `question_banks.owner_id = ownerId`, exécutée serveur uniquement.
- Événements Socket.IO autorisés par rôle + salon : `isHost()` vérifie `role === 'host'`
  ET `room.ownerId === socket.data.sub` (`src/server/index.js`) ; `play:answer` refusé si
  `role !== 'player'` ; l'overlay n'a aucun event entrant accepté.
- Isolation par room : middleware de handshake vérifie le token, `socket.join(claims.room)`
  uniquement. Le classement circule sur le canal `:staff` (host + overlay), jamais aux joueurs.
- Verrou animateur unique : `requireHost()` (HOST_EMAIL) sur `POST /api/rooms`,
  `GET/PUT /api/banks`. Preuve : token forgé → 403, mauvais email → 403, valide → 200.

**Findings :** aucun.

---

### A02 — Cryptographic Failures
**Statut :** PASS (après correction F-004)

- `grep localStorage.setItem src/` → 1 occurrence (`useGame.js:46`) : tokens de session de
  jeu uniquement (comportement attendu, portée salon, TTL 6 h).
- `grep "http://" src/` (hors localhost) → 0 URL en clair.
- HSTS présent (`_headers` + middleware Fastify).

**Findings :**
- [High — F-004, CORRIGÉ] `GAME_JWT_SECRET` avait un repli `'dev-only-insecure-change-me'`
  utilisable en production (`src/server/config.js:10` avant fix) → tous les jetons de jeu
  forgeables. Correction : fail-fast au démarrage en prod. Preuve du re-scan :
  `NODE_ENV=production node src/server/index.js` → `Error: [config] GAME_JWT_SECRET doit
  être défini en production.`

---

### A03 — Injection
**Statut :** PASS

- `grep innerHTML|dangerouslySetInnerHTML src/` → 0. React échappe par défaut.
- `grep eval|new Function|document.write src/` → 0.
- SQLi : requêtes Supabase paramétrées nativement (mitigation par construction) ; entrées
  joueur validées par module (`validateAnswer`) et par `zod` sur les routes REST.
- Pseudo : borné 20 car., liste de bannis, strip `<>` (`src/server/index.js`, `cleanPseudo`).

**Findings :** aucun.

---

### A04 — Insecure Design
**Statut :** PARTIAL

- Rate limiting Socket.IO : token bucket 8 events/s par socket (`src/server/index.js:160-165`) — OK.
- OTP : rate limits gérés côté Supabase Auth (spec §3.2) — hors périmètre du code.
- Anti-triche : serveur autoritaire, fenêtre de réponse fermée à `>= deadline`, doublons
  refusés, points jamais reçus du client — vérifié par e2e (28/28 PASS).

**Findings :**
- [Low — F-008, OUVERT] Pas de rate limiting sur les routes REST `POST /api/rooms` et
  `POST /api/rooms/:code/join` (`src/server/index.js`). Mitigé : création verrouillée par
  HOST_EMAIL ; join borné par `maxPlayersPerRoom` et l'espace de codes non énumérable
  (32^5). Recommandation : `@fastify/rate-limit` sur ces deux routes avant montée en charge.

---

### A05 — Security Misconfiguration
**Statut :** PASS (après correction F-005)

- `grep console.log src/` → 1 occurrence : ligne de démarrage serveur (aucune donnée
  utilisateur). 0 mode debug, 0 commentaire sensible.

**Findings :**
- [Medium — F-005, CORRIGÉ] Les headers de sécurité n'existaient que dans
  `src/public/_headers` (format Cloudflare Pages) alors que le déploiement adapter-required
  sert le front depuis le serveur Fastify → aucun header réellement servi. Correction :
  hook `onSend` Fastify posant CSP, X-Frame-Options, X-Content-Type-Options, HSTS,
  Referrer-Policy, Permissions-Policy (`src/server/index.js`). Preuve re-scan :
  `curl -D - /api/health` → les 6 headers présents.
- [Info — F-010] CSP `style-src 'unsafe-inline'` requis par les styles inline React
  (barres de stats). Risque faible (pas de `script-src` inline). Backlog : nonce CSP.

---

### A06 — Vulnerable and Outdated Components
**Statut :** PASS (après correction F-003)

**Findings :**
- [High — F-003, CORRIGÉ] `npm audit` initial : **0 Critical / 7 High / 1 Moderate**
  (fastify ≤4, find-my-way, @fastify/static ≤7, vite 5/esbuild, nanoid, brace-expansion,
  fast-uri). Correction : `npm audit fix` + montées majeures fastify 5.12, @fastify/cors 10,
  @fastify/static 10.1, vite 8.2, @vitejs/plugin-react 5. Preuve re-scan :
  `RE-SCAN npm audit — Critical: 0 High: 0 Moderate: 0 Low: 0` ; build Vite OK ;
  e2e 28/28 PASS sur le stack mis à jour.
- 0 CDN externe (polices et scripts self-hostés) — aucun risque SRI.

---

### A07 — Identification and Authentication Failures
**Statut :** PASS (après correction F-001)

- Client Supabase : `flowType: 'pkce', autoRefreshToken: true` (`supabaseClient.js:12`).
- Jetons de jeu : HS256, portée `{role, room, sub}`, vérifiés à chaque handshake.

**Findings :**
- [High — F-001, CORRIGÉ] `verifyHostSession()` décodait le JWT Supabase **sans vérifier
  la signature** (`src/server/auth.js:51` avant fix) : quiconque connaissant l'email de
  l'animateur pouvait forger un jeton et passer le verrou. Correction : vérification
  réelle — JWKS RS256/ES256 (clé publique importée via `node:crypto`, cache 10 min) ou
  `SUPABASE_JWT_SECRET` HS256 ; **fail-closed** (si `HOST_EMAIL` est défini ou
  `NODE_ENV=production` sans vérificateur configuré → rejet). Preuve re-scan :
  token forgé (mauvais secret) → 403 ; bon secret mauvais email → 403 ; valide → 200 ;
  sans token → 403.

---

### A08 — Software and Data Integrity Failures
**Statut :** PASS

- 0 script CDN (`grep cdn.|unpkg|jsdelivr src/ index.html` → vide) : SRI sans objet.
- Banques de questions : validées par `zod` à l'écriture (`banksSchema`), stockées sur
  disque serveur (`data/`, gitignoré).

**Findings :** aucun.

---

### A09 — Security Logging and Monitoring Failures
**Statut :** PARTIAL

- Erreurs jamais exposées à l'UI avec détails (`error.message` → messages génériques
  côté client, mapping `ERROR_MESSAGES`).

**Findings :**
- [Info — F-011] Logging serveur minimal (logger Fastify désactivé, pas de trace des
  403/tentatives d'auth échouées). Recommandation : `logger: true` en prod + alerte sur
  les 403 répétés de `/api/rooms`.

---

### A10 — Server-Side Request Forgery (SSRF)
**Statut :** PASS

Un seul appel sortant serveur : `fetch(config.supabaseJwksUrl)` (`src/server/auth.js:38`) —
URL issue de l'environnement, jamais d'une entrée utilisateur. Aucun autre `fetch` serveur.

**Findings :** aucun.

---

## Findings hors OWASP (convention dépôt)

- [Critical — F-002, CORRIGÉ] `.vault` non couvert par `.gitignore` (dépôt git initialisé
  pendant l'audit). Correction : entrée `.vault` ajoutée. Preuve re-scan :
  `git check-ignore .vault` → OK ; `git ls-files | grep .vault` → vide.
- [Medium — F-006, OUVERT] `supabase/migrations/` est **vide** : les tables et politiques
  RLS de TECH-SPEC §3.4/§4 n'ont jamais été codées en migrations. Sans objet tant que
  Supabase n'est pas branché (repli banques disque), mais **bloquant avant tout
  déploiement avec Supabase**. Routé : app-builder en mode PATCH (via
  saas-change-orchestrator) — écrire les migrations (tables + ENABLE RLS + policies
  par opération + index, spec §4.4).
- [Low — F-007, CORRIGÉ] `.env.example` absent (déclaré dans AGENTS.md [BUILD]). Créé,
  sans aucune vraie valeur.
- [Low — F-009, OUVERT/ACCEPTÉ] `overlayToken` passé en query string (`/overlay?token=`) :
  peut fuiter via historique/logs. Risque accepté v1 : rôle overlay strictement lecture,
  portée un salon, TTL 6 h ; c'est le pattern standard des browser sources OBS.

---

## SBOM

Voir `audit/sbom.json` (CycloneDX) — **221 composants** inventoriés, 14 dépendances
directes. Dépendances CDN externes : **aucune** (tout est self-hosté).

---

## Secrets Scan

Patterns scannés : `service_role`, JWT complets, `sk-…`, `PRIVATE KEY`, `supabase secret`,
`password=`, `api_key=`, `ghp_…` sur `src/**/*.{js,jsx,ts,html}` → **0 secret dans les
sources**. `.env` présent (PAT GitHub de l'utilisateur) mais **ignoré par git** (vérifié
`git check-ignore`). `.env.example` : aucune vraie valeur. `.vault` : ignoré, non tracké.

---

## Corrections automatiques (Phase 8 — cycle unique)

- Fichiers modifiés : `src/server/auth.js` (F-001), `src/server/config.js` (F-004),
  `src/server/index.js` (F-005), `.gitignore` (F-002), `.env.example` (F-007),
  `package.json` + `package-lock.json` (F-003).
- Re-scan complet : npm audit `Critical: 0 High: 0 Moderate: 0 Low: 0` ; secrets scan → 0 ;
  `.vault` ignoré ; headers présents au curl ; matrice auth 403/403/200/403 ; fail-fast
  prod vérifié ; e2e fonctionnel 28/28 PASS sur le stack corrigé.
- Findings Critical/High résiduels : **0**. Le Medium F-006 (structurel, migrations RLS)
  est documenté OUVERT et routé vers app-builder en mode PATCH via saas-change-orchestrator.

---

## Corrections recommandées (par priorité)

### Priorité 1 — Critical/High (bloquer le déploiement)

Aucune restante — F-001, F-002, F-003, F-004 corrigés et re-scannés.

### Priorité 2 — Medium (corriger avant v1)

1. **Migrations RLS absentes (F-006)**
   - Impact : dès que Supabase est branché, tables sans RLS = contenu de l'animateur lisible/modifiable par tout `authenticated`.
   - Fichier : `supabase/migrations/` (vide)
   - Correction : migrations `YYYYMMDD_description.sql` avec tables + `ENABLE ROW LEVEL SECURITY` + policies par opération (`modules_[op]_owner` etc., spec §3.4) + index §4.3 ; puis Security Advisor Supabase (0 alerte).

### Priorité 3 — Low/Info (backlog)

1. **Rate limit REST (F-008)** : `@fastify/rate-limit` sur `POST /api/rooms` et `POST /api/rooms/:code/join`.
2. **Overlay token en query (F-009)** : accepté v1 ; option future — cookie de session overlay.
3. **CSP nonce (F-010)** : remplacer `style-src 'unsafe-inline'` par des nonces.
4. **Logging prod (F-011)** : activer le logger Fastify + surveiller les 403 d'auth.

---

## Checklist pré-déploiement

- [x] 0 finding Critical
- [x] 0 finding High
- [x] `_headers` ET headers servis par Fastify en place
- [x] Aucune clé service_role dans `src/`
- [x] npm audit : 0 vulnérabilité critical ou high
- [x] `.env` dans `.gitignore`
- [x] Versions CDN pinnées — sans objet (0 CDN)
- [ ] F-006 : migrations RLS écrites + Security Advisor Supabase 0 alerte (REQUIS si Supabase branché)
- [ ] Env prod défini : `GAME_JWT_SECRET`, `HOST_EMAIL`, `SUPABASE_JWKS_URL` (ou `SUPABASE_JWT_SECRET`)

**Prochaine étape : deployer (Phase 8).** (Phase 6 — tester — reste à exécuter en parallèle.)
