---
artifact_type: tech_spec
app: root
version: 1
change_set: forward
produced_by: tech-spec-writer
date: 2026-07-22
---

# TECH-SPEC — Project Game Show (v1.0)

## Section 0 — Préambule et références

- **Date de création :** 2026-07-22 · **Auteur :** tech-spec-writer (pipeline) · **Version doc :** 1.0
- **Documents amont (source de vérité) :** `docs/USER-NEEDS-v1.yaml` (besoins), `docs/DESIGN-DOMAIN-EXPLORE-v1.md` (conventions du domaine), `REPO-CONVENTION.md` (contrat du dépôt).
- **Versioning du document :** MAJOR.MINOR — MAJOR pour refonte d'une section, MINOR pour ajout/clarification.
- **Traçabilité des décisions :** table « Journal des décisions » en fin de document.
- **Destinataires :** `design-board` (direction créative), `design-builder`, `app-builder`, `tester`, `security-tester`, `deployer`. Ce document fige la stack et l'architecture ; il ne réinterroge pas les besoins déjà tranchés dans USER-NEEDS.

Termes techniques (WebSocket, Socket.IO, JWT, RLS, PKCE, CSP) conservés en anglais ; le reste du document est en français.

## Section 1 — Vision et périmètre

### 1.1 Proposition de valeur

Project Game Show est une plateforme web d'animation : un streamer présente un jeu télévisé en direct et toute sa communauté joue depuis son téléphone-manette, sans compte ni installation, tandis que le spectacle s'affiche sur le stream via des overlays OBS. La v1 est un **outil personnel mono-animateur / mono-salon**. Ce qui le différencie des outils existants (cf. DESIGN-DOMAIN-EXPLORE) : rejoindre une partie déjà en cours, reconnexion sans perte de score, tolérance au délai de diffusion, format multi-modules enchaînable, et overlays OBS de première classe intégrés au moteur de jeu.

### 1.2 Périmètre v1 et roadmap

Le produit est **mono-app** (topologie `root`), composé de quatre surfaces d'une même application :

| Surface | Rôle | Statut v1 |
|---|---|---|
| Host (dashboard animateur) | Piloter la partie en direct | active |
| Play (manette joueur mobile) | Rejoindre et jouer | active |
| Overlay (sources OBS) | Afficher question/timer/classement/podium | active |
| Studio (gestion de contenu admin) | Créer modules, banques de questions | active (périmètre réduit) |

Priorité de dev : (1) socle salon + temps réel + surface Play/Host, (2) 4 modules de lancement, (3) overlays OBS, (4) événements + bonus/malus, (5) Studio de contenu. Critère « prêt à livrer » : une partie complète jouable de bout en bout (salon → 4 modules → podium) en conditions de stream réelles. Versioning produit : semver, démarrage `0.1.0`.

### 1.3 Contraintes non-fonctionnelles

- **Sécurité :** serveur de jeu autoritaire (le client ne calcule jamais son score) ; auth animateur par token signé ; isolation stricte entre salons ; secrets jamais côté front (détail Section 3).
- **Performance :** latence d'aller-retour d'une réponse < 200 ms côté serveur (hors réseau joueur) ; overlays à 60 fps ; surface Play : LCP < 2,5 s, INP < 200 ms sur mobile 4G ; charge de départ ciblée **200-500 joueurs simultanés sur une instance** (montée vers 1000+ documentée en 2.7).
- **Accessibilité :** WCAG 2.2 AA sur Host et Play (contraste, focus visible, cibles tactiles ≥ 44 px, `prefers-reduced-motion`). Overlays exemptés (display-only, non interactifs).
- **Compatibilité navigateurs :** Chrome/Edge 120+, Safari 17+ (iOS 17+), Firefox 120+. Overlays : moteur CEF d'OBS (Chromium récent).
- **Internationalisation :** français en v1 ; chaînes UI externalisées (fichier de messages) pour extension ultérieure.

### 1.4 Hors périmètre v1

Application mobile native ; comptes/persistance de profil joueur ; multi-animateurs et multi-salons simultanés ; dépendance obligatoire à Twitch ; classement mondial persistant ; modération lourde (limitée au filtrage de pseudo). Ces exclusions reprennent les `Won't` de USER-NEEDS (W1-W5).

## Section 2 — Architecture système

### 2.1 Vue macro

```
Navigateur joueur (mobile)  ─┐
Navigateur animateur (desktop)├─ HTTPS (statique) ─→ Front React/Vite (build statique)
OBS Browser Source (overlay) ─┘                         │
                                                        │ WebSocket (Socket.IO)
                                                        ▼
                                   Serveur de jeu Node.js + TypeScript (AUTORITAIRE)
                                   ├── Socket.IO (rooms = salons, namespaces host/play/overlay)
                                   ├── Moteur de modules (Quiz, Vrai/Faux, Estimation, Vote)
                                   ├── Moteur de score + timers (source de vérité)
                                   └── État des salons EN MÉMOIRE (éphémère)
                                                        │ SQL (service_role, server-side)
                                                        ▼
                                   Supabase (région EU) : Postgres + Auth
                                   ├── Auth : animateur uniquement (email OTP / PKCE)
                                   └── Postgres : modules, banques de questions, historique
```

**Justification de l'architecture :** contrairement au chemin CRUD statique + Supabase, ce domaine exige un **serveur autoritaire à connexions longues** : timers, fenêtres de réponse, scoring et anti-triche doivent vivre côté serveur (le client ne peut pas être source de vérité). C'est le pattern des références du domaine (skribbl.io, Jackbox = Node + Socket.IO + rooms en mémoire — cf. DESIGN-DOMAIN-EXPLORE §1). L'état de jeu (salon, joueurs, scores de la partie) est **éphémère et en mémoire** ; seul le contenu durable (modules, questions, historique) va en base.

### 2.2 Front-end

- **Pattern :** SPA **React + Vite** en TypeScript, buildée en statique, avec trois points d'entrée routés : `/host` (dashboard), `/play` (manette), `/overlay/:type` (sources OBS transparentes). Studio admin sous `/studio`.
- **Justification :** React domine le domaine là où c'est observable (Kahoot, Mentimeter, Gartic — DESIGN-DOMAIN-EXPLORE §2) ; Vite donne un build statique léger, servi par CDN. Limite assumée : pas de SSR (inutile ici, tout est temps réel côté client).
- **Dépendances :** `socket.io-client` (pin de version explicite), `@supabase/supabase-js` (chargé uniquement sur `/host` et `/studio`, jamais sur `/play` ni `/overlay`). Aucune dépendance en `@latest`.
- **Client temps réel :** une seule connexion Socket.IO par surface, (re)connexion automatique gérée par le client (backoff), ré-abonnement au salon au retour réseau.

### 2.3 Serveur de jeu (Node.js + Socket.IO)

- **Runtime :** Node.js 22, TypeScript, serveur HTTP **Fastify** (santé + endpoints REST minimes : création de salon signée, healthcheck) + **Socket.IO** attaché.
- **Rooms Socket.IO :** un salon = une room Socket.IO identifiée par le code de salon. Trois namespaces/rôles par salon : `host` (1 animateur authentifié), `play` (N joueurs anonymes), `overlay` (M sources OBS en lecture seule).
- **État en mémoire :** map `salonCode → { état, joueurs[], moduleEnCours, scores, timerHandle }`. Aucune écriture de l'état de partie en base. TTL : un salon inactif est purgé après une période configurable ; l'animateur peut le fermer explicitement.
- **Moteur de modules :** interface commune `Module` (présentation → instructions → jeu → fin du chrono → révélation → calcul des points → classement), chaque module (Quiz, Vrai/Faux, Estimation, Vote) implémenté indépendamment (modularité imposée par USER-NEEDS). Ajouter un module ne modifie aucun module existant.
- **Autorité du score :** le serveur reçoit des **réponses** (jamais des scores) ; il valide la fenêtre de temps, calcule les points et diffuse les résultats. Le client n'envoie jamais de point.

### 2.4 Hébergement et réseau

- **Serveur de jeu :** plateforme conteneur supportant les WebSockets longues — **Render** ou **Railway** (région EU). Un service web unique en v1 (sticky non requis tant qu'une seule instance). WebSocket + healthcheck HTTP.
- **Front statique :** servi par CDN (Cloudflare Pages ou le CDN de l'hébergeur), même origine logique que l'API via un domaine/reverse-proxy pour simplifier CORS et CSP.
- **Supabase :** un seul projet, région `eu-central-1` (Frankfurt) — cf. Section 8.
- **Cache :** assets front `Cache-Control: public, max-age=31536000, immutable` (fingerprintés par Vite) ; `index.html` et overlays `no-cache`.

### 2.5 Stratégie offline / réseau

Connectivité requise (jeu temps réel). La résilience passe par la **reconnexion automatique sans perte de score** (différenciateur, S5) : à la connexion, le joueur reçoit un `playerToken` signé (JWT court) encodant `{salon, playerId}` ; en cas de coupure, le client se reconnecte et présente ce token — le serveur le rattache à son état en mémoire (pseudo + score conservés). Pas de nouveau pseudo, pas de remise à zéro (anti-pattern Kahoot évité, cf. DESIGN-DOMAIN-EXPLORE §3).

### 2.6 Flux d'authentification

**Animateur (Host + Studio)** — flow PKCE via Supabase Auth :
1. L'animateur saisit son email sur `/host`.
2. `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser:false } })` (inscription fermée : compte animateur créé manuellement).
3. OTP par email ; supabase-js échange le code contre access token + refresh token (PKCE).
4. Session en `localStorage` (surface Host uniquement).
5. Pour ouvrir un salon, `/host` appelle `POST /api/rooms` avec l'access token Supabase dans l'en-tête ; le serveur vérifie le JWT Supabase (clé publique JWKS), crée le salon en mémoire et renvoie un `hostToken` signé par le serveur.
6. Redirect URLs whitelistées dans Supabase : Site URL + URLs de preview/prod exhaustives (Section 3.2).

**Joueur (Play)** — anonyme, sans compte :
1. Le joueur ouvre `/play`, saisit le **code de salon** (ou scanne le QR) et un **pseudo**.
2. `POST /api/rooms/:code/join` (pseudo) → le serveur valide le code + filtre le pseudo, crée un `playerId` et renvoie un `playerToken` signé (JWT HS256, TTL = durée de vie du salon).
3. Le client ouvre la connexion Socket.IO du namespace `play` en présentant `playerToken` au handshake.
4. **Rejoindre en cours (M3) :** `/api/rooms/:code/join` accepte un salon en état `En jeu` ; le joueur est intégré et jouable dès le module suivant (ou immédiatement si le module l'autorise).

**Overlay (OBS)** — lecture seule : URL contenant un `overlayToken` signé (généré par le Host), donnant un accès `overlay` en réception uniquement (aucune émission acceptée).

## Section 3 — Sécurité et contrôle d'accès

### 3.1 Modèle de menace

Protégé explicitement contre : **triche/spoof de score** (client falsifiant ses points), **accès horizontal** (un joueur écoutant ou agissant sur un autre salon), **usurpation d'animateur** (prise de contrôle du salon), **injection** (pseudo/réponse malveillants, injection SQL), **replay** d'un token expiré, **exposition de la `service_role`**, **DoS** sur la création de salon et le join, **crash de salon** par flood d'events. Hors périmètre v1 (justifié) : compromission de l'infra Supabase/hébergeur, attaques supply-chain CDN, attaque physique sur l'appareil.

### 3.2 Authentification

- **Animateur :** flow **PKCE** (Supabase), access token 1 h, refresh token 7 jours, rotation activée. OTP expiry ≤ 1 h. Rate limits Auth (Supabase) : OTP 1/60 s, 5 échecs avant blocage temporaire. Redirect URLs whitelistées exhaustivement (Site URL prod + `*.pages.dev`/preview + `localhost` dev).
- **Joueur :** aucun compte. `playerToken` = JWT **HS256** signé par un secret serveur (`GAME_JWT_SECRET`), claims `{ sub: playerId, room: salonCode, role: 'player', exp }`, TTL = durée de vie du salon. Vérifié à chaque handshake Socket.IO et sur chaque event sensible. Un token d'un autre salon est rejeté (isolation).
- **Host/Overlay tokens :** `hostToken` (role `host`) et `overlayToken` (role `overlay`) signés du même secret, portée limitée au salon. L'`overlay` ne peut qu'écouter.

### 3.3 Autorisation temps réel (Socket.IO)

- **Middleware de handshake :** valide le token, vérifie que `room` du token == salon rejoint, `socket.join(room)`. Un socket ne reçoit que les events de sa room (isolation par room Socket.IO).
- **Autorisation par rôle et par event :** table d'autorisation serveur — seuls les events `host:*` (lancer module, pause, révéler, événement, bonus/malus, terminer) sont acceptés d'un socket `role:host` ; les events `play:answer` uniquement d'un `role:player` de la room ; aucun event entrant accepté d'un `role:overlay`.
- **Anti-triche :** le serveur est autoritaire. Il n'accepte du joueur qu'une **réponse** (`{questionId, choix|valeur}`), horodatée serveur ; il rejette toute réponse hors fenêtre de temps, tout doublon, toute réponse à un `questionId` inactif. Points calculés côté serveur ; jamais reçus du client.
- **Anti-flood :** rate limiting par socket (token bucket, ex. 5 events/s) ; taille de payload plafonnée ; déconnexion sur abus répété.

### 3.4 Contrôle d'accès base de données (Supabase RLS)

Le contenu durable appartient à l'animateur. **RLS activé sur toutes les tables** du schéma `public`, DENY par défaut, policies décomposées par opération, `TO authenticated`, `user_metadata` interdit dans les policies.

| Table | Opération | Policy | USING / WITH CHECK | Justification |
|---|---|---|---|---|
| `profiles` | SELECT/UPDATE | `profiles_[op]_self` | `auth.uid() = id` | L'animateur ne lit/modifie que son propre profil (email = PII) |
| `profiles` | INSERT | `profiles_insert_self` | `WITH CHECK auth.uid() = id` | Ligne créée à l'inscription (trigger `handle_new_user`) ; pas de DELETE direct — supprimée par la cascade de suppression de compte (Section 8.3) |
| `modules` | SELECT/INSERT/UPDATE/DELETE | `modules_[op]_owner` | `auth.uid() = owner_id` | L'animateur ne gère que ses modules |
| `question_banks` | idem | `question_banks_[op]_owner` | `auth.uid() = owner_id` | idem |
| `questions` | idem | `questions_[op]_owner` | `auth.uid() = (SELECT owner_id FROM question_banks WHERE id = bank_id)` | Rattachement via la banque |
| `matches` | SELECT/INSERT/DELETE | `matches_[op]_owner` | `auth.uid() = owner_id` | Historique privé de l'animateur |

Le **serveur de jeu lit le contenu via la `service_role`** (server-side uniquement, jamais exposée), car il sert des questions à des joueurs anonymes qui n'ont pas de session Supabase. Les joueurs n'accèdent jamais directement à Supabase.

### 3.5 Fonctions helper / index

Chaque colonne de policy est indexée (Section 4.3). La sous-requête `questions → question_banks` utilise un `SELECT` wrapper pour être cachée par statement. Pas de foyer/team ici (mono-animateur), donc pas de Custom Access Token Hook en v1.

### 3.6 Clés et secrets

| Clé | Exposition autorisée | Localisation | Interdit |
|---|---|---|---|
| Supabase `anon key` | Front Host/Studio (RLS protège) | build front | — |
| Supabase `service_role` | Serveur de jeu uniquement | env serveur (Render/Railway secrets) | front, Git, logs |
| `GAME_JWT_SECRET` | Serveur uniquement | env serveur | front, Git |
| JWT secret Supabase | Interne Supabase | géré par Supabase | jamais exposé |

`service_role` et `GAME_JWT_SECRET` ne sont **jamais** inclus dans le bundle front, ni commités (`.vault/` + secrets d'hébergeur). Vérifié par le gate `check-convention.sh` (no-secret) et la Section 9.

### 3.7 Headers de sécurité

Servis par l'hébergeur du front (`_headers` Cloudflare Pages ou middleware Fastify) :

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://<projet>.supabase.co wss://<serveur-de-jeu>; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

`connect-src` autorise le domaine Supabase (Host/Studio) et le WebSocket du serveur de jeu. **Overlays :** `frame-ancestors` non pertinent (rendus par CEF OBS, pas en iframe web) ; ils n'exposent aucune saisie. Le QR code du salon est généré côté client (pas d'appel tiers).

### 3.8 Validation des entrées

Pseudo : longueur bornée, filtrage anti-contenu offensant (liste + normalisation), pas d'HTML (échappé au rendu, React échappe par défaut). Réponses : schéma validé côté serveur (`zod`) — type attendu par module (index de choix, booléen, nombre borné, id d'option). Code de salon : format fixe (ex. 5 caractères alphanumériques non ambigus), généré serveur, non devinable par énumération (rate limit sur join).

### 3.9 Security Advisor / checklist pré-déploiement

Security Advisor Supabase exécuté avant chaque mise en production et après toute migration ajoutant une table (0 alerte requis). Checklist reprise en Section 9.4 et dans la DoD sécurité (Section 10.3).

## Section 4 — Modèle de données

### 4.1 Données durables (Supabase Postgres)

```sql
-- Étend auth.users (Supabase Auth) — l'animateur / admin
CREATE TABLE profiles (
  id         uuid REFERENCES auth.users PRIMARY KEY,
  email      text NOT NULL,
  display_name text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE modules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid REFERENCES profiles NOT NULL,
  type        text NOT NULL,            -- 'quiz' | 'true_false' | 'estimation' | 'vote' | ...
  name        text NOT NULL,
  description text,
  config      jsonb NOT NULL DEFAULT '{}',  -- durée, barème, couleur, icône
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE question_banks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid REFERENCES profiles NOT NULL,
  name       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE questions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id    uuid REFERENCES question_banks ON DELETE CASCADE NOT NULL,
  module_type text NOT NULL,            -- compat du module cible
  payload    jsonb NOT NULL,            -- énoncé, options, bonne réponse, valeur cible…
  created_at timestamptz DEFAULT now()
);

-- Historique optionnel d'une partie (pas l'état live)
CREATE TABLE matches (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid REFERENCES profiles NOT NULL,
  started_at timestamptz DEFAULT now(),
  ended_at   timestamptz,
  summary    jsonb NOT NULL DEFAULT '{}' -- modules joués, nb joueurs, podium final
);
```

Chaque migration créant une table contient dans l'ordre : `ENABLE ROW LEVEL SECURITY` + policies (SELECT/INSERT/UPDATE/DELETE, `TO authenticated`, `owner_id = auth.uid()`) + index (Section 4.3).

### 4.2 État de partie éphémère (en mémoire serveur — PAS en base)

Modélisé en TypeScript côté serveur, jamais persisté (sauf `matches.summary` en fin de partie, optionnel) :

```ts
type Salon = {
  code: string;                 // 5 car. non ambigus
  state: 'waiting'|'playing'|'paused'|'results'|'ended';
  hostSocketId: string;
  players: Map<PlayerId, { pseudo: string; score: number; connected: boolean; token: string }>;
  currentModule?: ModuleRuntime; // état du module + questionId actif + fenêtre de temps
  history: RoundResult[];       // journal des manches (S8)
  createdAt: number;
};
```

Justification : l'état live change à haute fréquence (chaque réponse) et n'a aucune valeur de persistance ; le garder en mémoire élimine la latence base et le coût. Les joueurs n'ont **aucune ligne** en base (anonymes, éphémères) — allègement RGPD (Section 8).

### 4.3 Index obligatoires

```sql
CREATE INDEX ON modules        USING btree (owner_id);
CREATE INDEX ON question_banks USING btree (owner_id);
CREATE INDEX ON questions      USING btree (bank_id);
CREATE INDEX ON matches        USING btree (owner_id);
```

### 4.4 Migrations

Supabase CLI (`supabase migration new`, `supabase db push --linked`), nommage `YYYYMMDD_description.sql`. Aucune modification directe en production hors migration versionnée. RLS + policies + index obligatoires dans toute migration créant une table.

### 4.5 Données de référence (seeds)

Modules de lancement pré-déclarés côté serveur (types `quiz`, `true_false`, `estimation`, `vote`) ; un jeu de questions de démonstration inséré via seed pour tester une partie complète.

## Section 5 — Design system

### 5.1 Tokens CSS partagés

Source unique `design/tokens/tokens.css` (produit par design-builder). Direction **game-show TV spectaculaire** (feeling USER-NEEDS : Spectaculaire, Énergique, Premium) : fond sombre profond, accent **violet/néon** + une couleur d'énergie secondaire, halos/glow pour les moments forts, gros chiffres animés. Tokens : couleurs (background, surface, texte, accent, succès/erreur, couleurs de module), typographie, radii, shadows/glow, motion (easing, durées).

### 5.2 Couleurs par module / contexte

Chaque module porte une couleur sémantique (icône + accents) déclarée dans `modules.config.color`. Règle : la couleur de module habille le module, jamais le chrome global du dashboard.

### 5.3 Typographie

- **UI :** sans-serif géométrique lisible (ex. Geist/Inter).
- **Display / plateau :** famille à fort caractère pour les gros chiffres et titres de reveal (compteurs de réponses, timer, scores).
- **Mono :** pour scores/codes de salon (lisibilité chiffrée).
- Échelle et poids documentés par design-builder ; contraste AA minimum sur Host/Play.

### 5.4 Composants partagés

Boutons-réponse (buzzer) grands et tactiles ; anneau de timer ; grand compteur de réponses (overlay) ; leaderboard (lignes animées) ; podium ; carte de salon (code + QR) ; barre de contrôle animateur ; états `default/hover/focus/disabled/loading/reveal`. Icônes = SVG Lucide (strokeWidth 1.6, `currentColor`). **Aucun emoji.**

### 5.5 Iconographie

SVG inline stroke style Lucide, héritant `currentColor`, définies en registre. Aucune image raster pour les icônes, aucun emoji (labels de statut = nom Lucide).

### 5.6 Motion

Easing standard `cubic-bezier(.22,.61,.36,1)`. Durées : hover 160-200 ms, apparition 400-600 ms, reveal/transition de plateau 550-800 ms. Chaque animation traduit un changement d'état (reveal d'une réponse, montée du leaderboard, podium). `prefers-reduced-motion` respecté (Host/Play) ; les overlays gardent le motion (destiné au spectacle, non interactif).

### 5.7 Responsive

- **Play :** mobile-first strict (manette), cibles ≥ 44 px, une action visible à la fois.
- **Host :** desktop-first (poste de pilotage dense : joueurs, épreuve, timer, classement, contrôles).
- **Overlay :** canvas fixe **1920×1080**, fond transparent (`body{background:rgba(0,0,0,0)}`), safe margins, typo large — convention OBS (DESIGN-DOMAIN-EXPLORE §3).

## Section 6 — Surfaces — description fonctionnelle et technique

### 6.1 Host (dashboard animateur)
Objectif : piloter la partie en direct. Vues : connexion (OTP), création/ouverture de salon (code + QR), salle d'attente (liste joueurs temps réel), pilotage de module (lancer, chrono, pause, afficher/masquer réponses, déclencher événement, bonus/malus, relancer manche, passer au suivant, terminer), classement (Top 10/Podium/position/évolution — S6), historique/journal (S8). Entités : `modules`, `questions` (lecture), état de salon (mémoire). Realtime : émet les events `host:*`, reçoit compteurs et scores agrégés. Auth : Supabase (animateur). Partageabilité : privée.

### 6.2 Play (manette joueur mobile)
Objectif : rejoindre en < 10 s et jouer. Vues : join (code/QR + pseudo), salle d'attente, écran de module (question, réponses, chrono, feedback), score + classement, écran de fin. Entités : aucune en base (session mémoire). Realtime : reçoit l'état du module, émet `play:answer`. Auth : anonyme (`playerToken`). Rejoindre en cours supporté (M3). Reconnexion sans perte (S5).

### 6.3 Overlay (sources OBS)
Objectif : afficher le spectacle sur le stream. Types d'overlay (URLs distinctes) : `question`, `timer`, `leaderboard`, `podium`, `results`, `transition`. Display-only, transparent, alimenté par push serveur (`overlay:*`). Aucune interaction, aucune émission acceptée. Auth : `overlayToken` (lecture seule).

### 6.4 Studio (gestion de contenu admin)
Objectif : créer/éditer modules, banques de questions. Vues : liste modules, éditeur de module (config), banques et questions. Entités : `modules`, `question_banks`, `questions` (CRUD, RLS owner). Realtime : aucun. Auth : Supabase (admin = animateur en v1). Périmètre réduit : suffisant pour alimenter une partie.

## Section 7 — Liens et flux de données entre surfaces

### 7.1 Source de vérité unique
Le **serveur de jeu** est l'unique intermédiaire entre surfaces. Aucune surface n'écrit dans l'état d'une autre ; tout passe par des events serveur. Host et Studio lisent/écrivent le contenu durable via Supabase (RLS owner) ; Play et Overlay ne touchent jamais Supabase.

### 7.2 Catalogue d'events (contrat temps réel)

| Émetteur | Event | Destinataires | Payload |
|---|---|---|---|
| Host | `host:createRoom` / `host:startModule(type,questionSet)` / `host:pause` / `host:reveal` / `host:event(name)` / `host:adjustScore(playerId,delta)` / `host:nextModule` / `host:endGame` | serveur | commandes de pilotage |
| Serveur | `room:state` / `player:joined` / `module:started` / `module:tick(timeLeft)` / `module:answersCount(n)` / `module:reveal(result)` / `leaderboard:update` / `game:ended(podium)` | Host, Play, Overlay (selon rôle) | état diffusé |
| Play | `play:join(code,pseudo)` (REST) / `play:answer(questionId,value)` | serveur | participation |
| Serveur → Play | `play:accepted` / `play:you(rank,score,delta)` | joueur concerné | feedback perso |
| Serveur → Overlay | `overlay:question` / `overlay:timer` / `overlay:leaderboard` / `overlay:podium` | overlays abonnés | rendu spectacle |

### 7.3 Règles d'écriture
Un joueur n'émet que `play:answer` (validé serveur). Un overlay n'émet rien. Seul le Host émet des commandes `host:*`, vérifiées par rôle et par salon. Toute commande hors rôle/salon est rejetée (Section 3.3).

### 7.4 Gestion du délai de diffusion (stream delay)
Différenciateur (DESIGN-DOMAIN-EXPLORE §4). La **fenêtre de réponse** d'une question est fermée par le timer serveur (autoritaire), mais la **révélation** est déclenchée séparément par l'animateur (`host:reveal`), quand il le décide. Ainsi le décalage vidéo n'invalide pas la fenêtre de réponse perçue : l'animateur ouvre la question à l'écran, laisse le temps réel courir, et révèle au bon moment. Option de configuration : tolérance de fin de fenêtre (grâce de N ms) pour absorber la latence réseau des joueurs.

## Section 8 — Données personnelles et conformité RGPD

### 8.1 Localisation et souveraineté
Projet Supabase en région **EU `eu-central-1` (Frankfurt)**. Distinction consciente : **résidence** en UE assurée ; **souveraineté** non garantie (Supabase Inc. = Delaware C-corp, CLOUD Act) — documenté. Alternative si la souveraineté devient bloquante : Supabase self-hosted EU (Hetzner/OVH/Scaleway) ou Postgres EU managé. DPA Supabase signé avant mise en production.

### 8.2 Minimisation (atout du modèle)
Les **joueurs sont anonymes et éphémères** : seul un pseudo transite, en mémoire, purgé à la fin du salon — aucune donnée joueur en base, aucun cookie tiers, aucun analytics. La seule PII persistée est l'**email de l'animateur** (compte unique). Pas d'IP brute conservée (au plus un hash en logs de sécurité, rétention courte).

### 8.3 Droits (animateur)
Export JSON de son contenu (modules, banques, historique) ; suppression de compte en cascade (`modules`, `question_banks`, `questions`, `matches`). Les joueurs n'ayant pas de compte, il n'y a pas de données joueur à exporter/supprimer au-delà de l'éphémère.

### 8.4 Données sensibles / mentions
Aucune catégorie sensible traitée. Mentions légales minimales sur `/play` (traitement du pseudo, éphémère). Filtrage de pseudo (anti-offensant) documenté Section 3.8.

### 8.5 Backup
Contenu durable : backup Supabase (daily, rétention selon tier) + export manuel périodique JSON. L'état de partie étant éphémère, il n'est pas sauvegardé (par conception). Test de restauration du contenu documenté trimestriellement.

## Section 9 — Déploiement et opérations

> **Encart déployabilité (IMPORTANT) — `deployability: adapter-required`.**
> La skill `deployer` (Phase 8) n'automatise QUE **Cloudflare Workers (app statique) + Supabase**. Le serveur de jeu Node.js + Socket.IO à connexions longues **n'est pas couvert** : la Phase 8 s'arrêtera proprement (STOP documenté) et fournira un guide de sortie. Le déploiement effectif du serveur temps réel suit la procédure manuelle ci-dessous. Le front statique et Supabase, eux, restent déployables de façon standard.

### 9.1 CI/CD
Git → build. `main` = production, branches = preview. Conventional Commits. Checks pré-merge : `lint` + `test`. Deux artefacts : (a) front statique (build Vite → CDN/Pages), (b) serveur de jeu (image conteneur → Render/Railway).

### 9.2 Environnements
| Env | Front | Serveur de jeu | Supabase |
|---|---|---|---|
| Local | `vite dev` | `node` local | projet staging |
| Preview | `*.pages.dev` | service preview Render/Railway | staging |
| Production | domaine custom | service prod Render/Railway (EU) | projet prod (EU) |

### 9.3 Variables d'environnement
| Variable | Où | Exposition |
|---|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | build front (Host/Studio) | public (RLS protège) |
| `VITE_GAME_WS_URL` | build front | public (URL WebSocket) |
| `SUPABASE_SERVICE_ROLE_KEY` | serveur de jeu | secret (jamais front/Git) |
| `GAME_JWT_SECRET` | serveur de jeu | secret |
| `SUPABASE_JWKS_URL` | serveur de jeu | non sensible |

### 9.4 Procédure de déploiement (manuelle, serveur de jeu)
1. Provisionner le projet Supabase EU, appliquer les migrations (`supabase db push --linked`), vérifier le **Security Advisor** (0 alerte).
2. Déployer le serveur de jeu (Render/Railway, EU) : build conteneur, définir les secrets (`SUPABASE_SERVICE_ROLE_KEY`, `GAME_JWT_SECRET`), activer le WebSocket, healthcheck HTTP.
3. Builder le front (Vite) avec `VITE_*`, déployer sur CDN/Pages, poser le fichier `_headers` (Section 3.7).
4. Configurer les Redirect URLs Supabase (prod + preview).
5. Valider `securityheaders.com` + un test de partie complète (join, module, reveal, podium, reconnexion).

### 9.5 Monitoring
Logs serveur de jeu (Render/Railway) : connexions actives, salons ouverts, erreurs socket. Supabase : Logs Postgres/Auth, quotas. Alertes de dépassement free tier documentées. Métrique clé à surveiller : nb de connexions WebSocket simultanées (seuil de scale, Section 2.7 → 9.6).

### 9.6 Montée en charge (au-delà de 500 joueurs)
Une instance en mémoire suffit à la cible de départ (200-500). Chemin documenté pour 1000+ : (a) activer l'**adaptateur Redis Socket.IO** pour partager l'état de présence entre instances, (b) affinité de session (sticky) sur le salon, (c) externaliser l'état de salon vers Redis si l'horizontalité devient nécessaire. Décision différée (objectif progressif, USER-NEEDS S9) — non requis en v1.

## Section 10 — Conventions de développement

### 10.1 Nommage
| Domaine | Convention | Exemple |
|---|---|---|
| Fichiers | kebab-case | `player-controller.tsx`, `quiz-module.ts` |
| Composants React | PascalCase | `HostDashboard`, `TimerRing` |
| Variables/fonctions | camelCase | `startModule`, `computeScore` |
| Events Socket.IO | `role:action` | `host:startModule`, `play:answer`, `overlay:leaderboard` |
| Tables SQL | snake_case pluriel | `question_banks` |
| Policies RLS | `[table]_[op]_[who]` | `modules_select_owner` |
| Migrations | `YYYYMMDD_description.sql` | `20260722_init_content.sql` |
| Variables CSS | `--[catégorie]-[nom]` | `--color-accent`, `--radius-card` |

### 10.2 Structure du code
Monorepo léger : `src/server/` (Node/Socket.IO : modules, moteur de score, auth, rooms), `src/client/` (React : `host/`, `play/`, `overlay/`, `studio/`, `shared/`), `supabase/migrations/`. Frontière REPO-CONVENTION respectée : les skills design écrivent `design/`, app-builder écrit `src/` uniquement.

### 10.3 Sécurité (règles dures)
RLS sur toutes les tables ; policies par opération `TO authenticated` ; aucun `user_metadata` en policy ; `service_role`/`GAME_JWT_SECRET` hors front et hors Git ; serveur autoritaire (aucun score client) ; validation `zod` des entrées ; headers de sécurité posés ; Security Advisor = 0 alerte avant déploiement.

### 10.4 Zéro emoji
Aucun emoji dans le code, commentaires, docs, labels UI, notifications, commits. Toute icône = SVG Lucide nommé.

## Traçabilité — besoins Must → spec

| Must | Couvert par |
|---|---|
| M1 salon code+QR | 2.6, 6.1, 4.2 |
| M2 join sans compte < 10 s | 2.6, 6.2, 3.2 |
| M3 rejoindre en cours | 2.6, 6.2, 7 |
| M4 modules libres | 2.3, 6.1 |
| M5 4 modules (Quiz/VF/Estimation/Vote) | 2.3, 4.5, 6 |
| M6 score + classement | 2.3, 3.3, 7.2 |
| M7 contrôle animateur | 6.1, 7.2 |
| M8 overlays OBS | 5.7, 6.3, 7 |
| M9 temps réel | 2.1-2.3, 7.2 |
| M10 dashboard animateur | 6.1 |
| M11 interface joueur minimaliste | 5.7, 6.2 |
| S1 événements / S2 bonus-malus (v1 complète) | 6.1, 7.2 |
| S5 reconnexion sans perte | 2.5 |

## Journal des décisions

| Date | Décision | Justification | Alternatives écartées |
|---|---|---|---|
| 2026-07-22 | Serveur de jeu autoritaire Node.js + Socket.IO, état de salon en mémoire | Domaine temps réel à connexions longues ; pattern des leaders (skribbl, Jackbox) ; timers/scoring/anti-triche doivent être serveur | CF Pages statique + Supabase seul (inadapté au temps réel autoritaire) ; Cloudflare Durable Objects (edge, mais moins conventionnel — écarté à la confirmation utilisateur) |
| 2026-07-22 | Supabase (Postgres + Auth, EU) pour le contenu durable + auth animateur ; joueurs anonymes hors base | Free tier EU (RGPD), auth OTP simple pour un seul animateur, minimisation des données joueur | SQLite/Postgres embarqué + auth maison (écarté : Supabase mieux outillé et connu du pipeline) |
| 2026-07-22 | Déployabilité `adapter-required` | `deployer` n'automatise que CF Workers statique + Supabase ; le serveur WS long-lived exige un déploiement manuel Render/Railway | Contraindre la stack au chemin natif du deployer (rejeté : casserait l'exigence temps réel) |
| 2026-07-22 | Révélation déclenchée par l'animateur, séparée de la fermeture de fenêtre serveur | Absorbe le délai de diffusion (stream delay), différenciateur non couvert par Mentimeter/Slido | Reveal automatique en fin de timer (rejeté : désynchronise avec le stream) |
| 2026-07-22 | Charge de départ 200-500 joueurs / instance, scale Redis documenté | Objectif 1000 traité comme progressif (USER-NEEDS S9) ; livrer vite sans surdimensionner | Viser 1000 simultanés dès la v1 (surcoût injustifié au démarrage) |
