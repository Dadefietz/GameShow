# PROJECT — Project Game Show

> Manifeste vivant du projet. Mis à jour par chaque skill à la fin de son exécution.
> Ne pas modifier manuellement — les skills maintiennent ce fichier.

## État du pipeline

| Phase | Skill | Statut | Livrable actif | Date |
|---|---|---|---|---|
| 1 — Discovery | product-discovery | completed | docs/USER-NEEDS-v1.yaml | 2026-07-22 |
| 1.5 — Domain Benchmark | design-benchmark | completed | docs/DESIGN-DOMAIN-EXPLORE-v1.md | 2026-07-22 |
| 2 — Tech Spec | tech-spec-writer | completed | docs/TECH-SPEC-v1.md | 2026-07-22 |
| 3 — Design Board | design-board | completed | docs/DESIGN-BOARD-v3.md | 2026-07-22 |
| 3.5 — Design Explorer (optionnel) | design-explorer | completed | feu-de-camp-v2 retenu | 2026-07-22 |
| 4 — Design Build | design-builder | completed | design/tokens/ + design/design-manifest.yaml + 12 mockups | 2026-07-22 |
| 4.x — Assets image | asset-imagery | completed | design/assets/ (3 assets promus) | 2026-07-22 |
| 4.5 — Design Audit | design-audit | completed | docs/DESIGN-AUDIT-v1.md (PASS) | 2026-07-22 |
| 5 — App Build | app-builder | completed | src/ (serveur + 4 surfaces, build vérifié) | 2026-07-22 |
| 6 — Tests (∥ 7) | tester | completed | docs/TEST-REPORT-v1.yaml (66/66 PASS) | 2026-08-18 |
| 7 — Sécurité (∥ 6) | security-tester | completed | docs/SECURITY-AUDIT-v1.md (score A) | 2026-08-18 |
| 8 — Déploiement | deployer | pending | — | — |

Notes de table : 3.5 est le seul nœud optionnel (marquer `skipped` si non retenu).
4 → 8 sont PER-APP (mono-app = app implicite `root`) ; 6 et 7 tournent en parallèle.

## Livrables actifs

user_needs: docs/USER-NEEDS-v1.yaml
design_domain_explore: docs/DESIGN-DOMAIN-EXPLORE-v1.md
tech_spec: docs/TECH-SPEC-v1.md
design_board: docs/DESIGN-BOARD-v3.md
design_directions: design/directions/ (feu-de-camp-v2 convivial retenu)
tokens: design/tokens/tokens.css
design_manifest: design/design-manifest.yaml   # per-app (root)
image_asset: design/assets/assets-manifest.yaml   # per-app (root) : 3 assets promus
design_audit: docs/DESIGN-AUDIT-v1.md   # per-app (root) — PASS
src: src/                 # per-app (root) — serveur Node/Socket.IO + front React/Vite, build vérifié
test_report: docs/TEST-REPORT-v1.yaml   # per-app (root) — 66/66 PASS, coverage 83%/81%/67%
security_audit: docs/SECURITY-AUDIT-v1.yaml   # per-app (root) — + .md, score A, F-006 ouvert (migrations RLS)
deploy: null              # per-app (.vault/deploy-state.yaml)

## Prochaine étape

**Skill à lancer :** deployer (Phase 8, adapter-required — serveur WS long-lived : STOP documenté + guide manuel TECH-SPEC §9)
**Entrée attendue :** src/ v1.1 testé (TEST-REPORT v1, 66/66) + SECURITY-AUDIT v1 (score A)
**But :** déployer en suivant la checklist pré-déploiement de SECURITY-AUDIT-v1.md (env prod : GAME_JWT_SECRET, HOST_EMAIL, SUPABASE_JWKS_URL ; F-006 migrations RLS requis si Supabase branché — routé app-builder PATCH).

## Notes & décisions projet

| Date | Auteur | Note |
|---|---|---|
| 2026-07-22 | product-discovery | Projet initialisé. Idée : plateforme web de jeu télévisé interactif pour streamers (Twitch/Kick/YouTube), viewers jouent depuis leur mobile. Spec fonctionnelle v1.0 + infographie promotionnelle fournies en entrée. |
| 2026-07-22 | design-benchmark | 6 références benchmarkées (Kahoot, Jackbox, Mentimeter, skribbl.io/Gartic, overlays OBS, Slido). Convention dominante : WebSocket temps réel (6/6), join sans compte par code+QR, écran-scène/téléphone-manette. Slug de cache : interactive-stream-game-show. |
| 2026-07-22 | tech-spec-writer | Stack : Node.js + Socket.IO (serveur autoritaire, salons en mémoire) + React/Vite statique + Supabase (Postgres/Auth EU). Joueurs anonymes. Déployabilité : adapter-required (serveur WS long-lived hors du chemin natif du deployer). Stack-pattern DRAFT enregistré. |
| 2026-07-22 | design-board | Direction v1 : game-show TV néon violet (superseded). |
| 2026-07-22 | design-explorer | 4 pistes explorées (plateau-neon, prime-time, arcade-pop, feu-de-camp). L'utilisateur retient feu-de-camp v2 (forêt/bois/feu de camp, visuels Higgsfield). Recommandation de raffiner le board. |
| 2026-07-22 | design-board (v2) | Board raffiné → feu-de-camp (braise + bois brun + mousse). Superseded par v3. |
| 2026-07-22 | design-board (v3) | Board réaligné → feu-de-camp CONVIVIAL (sans brun). Palette : feu (primary H58) + chaud-neutre discret (neutres H80 chroma basse) + vert frais (accent H150) ; contrastes AA/AAA. Typo Fraunces + Inter. Imagerie feu de camp lumineuse/accueillante. Actif. |
| 2026-07-22 | design-builder | tokens.json/css (DTCG, validate pass), échelle typo clamp, motion organique-doux, polices Fraunces/Inter self-hostées (woff2), design-board.html, 12 mockups (4 surfaces, coverage 100%, 0 couleur en dur, BEM+A11Y), design-manifest + 3 slots d'assets. Gate PASS. |
| 2026-07-22 | asset-imagery | 3 assets promus (hero-ambiance-campfire, avatar-emblem-tipi, social-card-join) depuis les visuels Higgsfield conviviaux validés ; sidecars + spec.json + assets-manifest ; slots design-manifest remplis (path/version) ; registre image_assets. Moteur : Higgsfield MCP (pas de clé Gemini pour generate.py). |
| 2026-07-22 | design-audit | Verdict PASS. Coverage 12/12 (100%), 0 blocking/major/warn. BEM 475/475 conformes, tokens tous résolus, A11Y complets sur mockups interactifs, 3 assets conformes (bijections + codification OK). Prêt pour app-builder. |
| 2026-08-18 | correctif sécurité post-déploiement | Faille signalée en production par l'utilisateur : un second compte Supabase connecté dans le MÊME navigateur héritait du salon et du JETON D'ANIMATEUR du compte précédent (session localStorage non rattachée à un compte + court-circuit de l'appel serveur tant qu'une session existait). Le verrou HOST_EMAIL, lui, était bien actif (403 `not-host` vérifié en prod). Correctifs : (1) session animateur rattachée à l'ownerId Supabase et purgée dès qu'un autre compte se connecte — règle conservatrice `shouldPurgeHostSession` (pas de purge quand personne n'est authentifié, pour ne pas couper une partie en cours) ; (2) refus serveur rendu visible (écran « Accès réservé à l'animateur ») au lieu d'un écran muet ; (3) page /host épurée (carte de connexion seule) + suppression du CSS mort. Portée : navigateur partagé uniquement (aucune fuite à distance). À formaliser en SECURITY-AUDIT-v2 au prochain passage de security-tester. Inscriptions publiques Supabase désactivées par l'utilisateur le même jour. |
| 2026-08-18 | portage-main (change-only) | v1.1 PORTÉE sur le main du 28 juillet (responsive/Mobbin) par merge 3-voies (base = archive du 25/07). Conservé de main : responsive, BrandLoader+lazy routes, reconnexion animateur (ownerRooms), répartition live :host, host:error, magic link, ExitMenu/ModuleMenu, fermeture/expiration de salon, partage de score, récap B3, overlays OBS transparents + aperçu, Studio Supabase (table modules lue par le serveur). Conservé de v1.1 : verrous sécurité (JWT vérifié — getUser prioritaire —, fail-fast, headers, staff channel), reveal auto, rang masqué + placesDelta, bonus/malus auto, séance (shuffle+sélection), banques disque (repli sans Supabase), 85 questions, page stream (/overlay), / = accueil joueur, suppression pause. Tests re-verts : 33 unit + 28 intégration + 5 E2E (helpers session localStorage car magic link). |
| 2026-08-18 | tester | Phase 6 : 66/66 PASS (33 unitaires Vitest sur modules/rooms/engine/store, 28 checks d'intégration Socket.IO boucle complète, 5 E2E Playwright multi-contextes sur les 3 surfaces). Coverage 83/81/67 (seuils 70/70/60). 11/11 MUST couverts — M7 sans pause (retiré par retours R9), M8 via page stream unique (R8). 0 bug app ; 1 fix de test (sélecteur ambigu, cycle 1). data-testid ajoutés aux éléments clés des 3 surfaces. |
| 2026-08-18 | security-tester | Audit OWASP 2025 : score A. 11 findings (1 Critical, 3 High, 2 Medium, 3 Low, 2 Info) — cycle unique de corrections : F-001 JWT Supabase désormais VÉRIFIÉ (JWKS RS256/ES256 natif ou HS256, fail-closed), F-002 .vault gitignoré, F-003 npm audit 7 High → 0 (fastify 5, vite 8, @fastify/static 10), F-004 fail-fast GAME_JWT_SECRET en prod, F-005 headers servis par Fastify, F-007 .env.example. Re-scan prouvé + e2e 28/28. OUVERT : F-006 migrations RLS absentes (Medium, routé app-builder PATCH). SBOM 221 composants. git init effectué (dépôt local, aucun commit). |
| 2026-08-18 | retours-produit (change-only) | 9 retours appliqués sur src/ (v1.1) : animateur unique (HOST_EMAIL, /host séparé, / = accueil joueur) ; audit points (bug truefalse→true_false corrigé — Vrai/Faux inlançable ; vitesse modérée 0.7+0.3, estimation pondérée vitesse) ; Studio→jeu réparé (PUT/GET /api/banks + data/banks.json, l'ancien insert Supabase 'modules' n'était jamais lu) ; randomisation par défaut + sélection manuelle de séance ; +20 questions/module (85 au total) ; reveal auto à 0 + verrouillage serveur strict (>= deadline) ; rang masqué en cours de partie (classement sur canal :staff uniquement, joueur = points gagnés + places ±) ; page stream unique /overlay (QR/lien/code permanents + stats répartition) ; pause/resume supprimés ; bonus/malus auto (Éclair +150, série +50×cran cap +250, mauvaise réponse −100 plancher 0) + panneau manuel conservé. e2e 28/28 PASS, gate 403 vérifié, build Vite OK. |
| 2026-07-22 | app-builder | Application réelle construite : serveur Node.js + Socket.IO (autoritaire, salons en mémoire, 4 modules, auth Supabase animateur + jetons signés joueurs, anti-triche) + front React/Vite (host/play/overlay/studio, 12 écrans portés des mockups, classes manifeste 11/11). Assets câblés. Build Vite OK (183 modules) ; serveur node --check OK ; boucle e2e vérifiée (join→module→réponse→reveal→score). Déployabilité : adapter-required. |
