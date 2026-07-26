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
| 6 — Tests (∥ 7) | tester | pending | — | — |
| 7 — Sécurité (∥ 6) | security-tester | pending | — | — |
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
test_report: null         # per-app
security_audit: null      # per-app
deploy: null              # per-app (.vault/deploy-state.yaml)

## Prochaine étape

**Skills à lancer :** tester (Phase 6) ∥ security-tester (Phase 7) — en parallèle
**Entrée attendue :** src/ (build vérifié) + TECH-SPEC v1 + USER-NEEDS v1
**But :** tester (fonctionnel : boucle de jeu, join, reconnexion, modules) et auditer la sécurité (auth, isolation salon, anti-triche serveur, RLS, secrets) avant déploiement (Phase 8, adapter-required).

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
| 2026-07-22 | app-builder | Application réelle construite : serveur Node.js + Socket.IO (autoritaire, salons en mémoire, 4 modules, auth Supabase animateur + jetons signés joueurs, anti-triche) + front React/Vite (host/play/overlay/studio, 12 écrans portés des mockups, classes manifeste 11/11). Assets câblés. Build Vite OK (183 modules) ; serveur node --check OK ; boucle e2e vérifiée (join→module→réponse→reveal→score). Déployabilité : adapter-required. |
