# AGENTS.md — project-game-show
# artifact_type: agents | app: root | version: 1 | change_set: forward | produced_by: tech-spec-writer
# Créé par tech-spec-writer. Enrichi par design-benchmark, design-board, design-builder, app-builder, tester, security-tester.

[PROJECT]
name: project-game-show
description: Jeu télévisé interactif en livestream — l'animateur pilote, les viewers jouent au téléphone
language: fr
version: 0.1.0

[STACK]
platform: render-or-railway            # serveur de jeu Node conteneur (EU) ; front statique sur CDN/CF Pages
database: supabase                     # Postgres + Auth (EU eu-central-1), contenu durable + auth animateur
frontend: react-vite                   # SPA statique : /host, /play, /overlay, /studio
realtime: socketio                     # serveur de jeu AUTORITAIRE (WebSocket), rooms = salons, état en mémoire
package_manager: pnpm
node_version: 22
auth: supabase-auth                    # animateur uniquement (email OTP / PKCE) ; joueurs = anonymes (playerToken JWT HS256 signé serveur)
css: vanilla-tokens                    # BEM + tokens.css ; direction camping / feu de bois (board v4)
deployability: adapter-required        # deployer (Phase 8) = CF Workers statique + Supabase seulement ; serveur WS long-lived => STOP documenté + guide manuel (TECH-SPEC §9)
pattern_id: interactive-stream-game-show-node-socketio-supabase-20260722

[COMMANDS]
dev: npm run dev:server & npm run dev:client
build: npm run build          # vite build -> dist/
start: npm start              # node src/server/index.js (sert dist/ + WebSocket)
check_server: npm run check:server
lint: npm run lint:server
deploy: manuel (adapter-required) — Render/Railway pour le serveur WS ; voir TECH-SPEC §9
db_migrate: supabase db push --linked

[CONVENTIONS]
file_naming: kebab-case
component_naming: PascalCase
variable_naming: camelCase
socket_events: role:action            # host:startModule, play:answer, overlay:leaderboard
branch_naming: feature/[description]
commit_format: type(scope): description
sql_tables: snake_case_plural
sql_migrations: YYYYMMDD_description.sql
rls_policies: [table]_[op]_[who]
no_emoji: true
icons: svg-inline-stroke        # trait 1.6-2.2, jamais d'emoji

[SECURITY]
rls_on_all_tables: true                # tables de contenu durable (owner = animateur) — migrations À ÉCRIRE (F-006 ouvert)
authoritative_server: true             # le client n'envoie JAMAIS de score ; réponses validées serveur
service_role_frontend: false           # service_role + GAME_JWT_SECRET : serveur uniquement
service_role_git: false
user_metadata_in_policies: false
player_auth: signed-jwt-per-room       # playerToken HS256, portée = salon, TTL = durée du salon
room_isolation: true                   # un socket ne reçoit/agit que dans sa room ; classement sur canal :staff uniquement
host_jwt_verification: jwks-or-hs256   # signature Supabase VÉRIFIÉE (F-001 fixé) ; fail-closed si HOST_EMAIL/prod
security_advisor_before_deploy: true
owasp_baseline: true
secrets_scan: passed
headers_configured: true               # _headers (CF Pages) + hook onSend Fastify (adapter-required)
npm_audit_critical: 0
npm_audit_high: 0
sbom_file: audit/sbom.json
last_audit: 2026-08-18
audit_report: docs/SECURITY-AUDIT-v1.md
pre_deploy_checklist: passed           # sous réserve F-006 (migrations RLS) si Supabase branché + env prod défini

[DESIGN]
# Design system du projet — page de référence : design/design-board.html
# Toute nouvelle page, tout nouveau jeu DOIT s'y conformer. Le gate refuse
# mécaniquement toute valeur de design écrite hors de tokens.css.
scope_type: product-interface
design_system: design/design-board.html      # planches : palette, typo, espace/relief, pièces de base, options 5 états, marque/icônes/chrono/motion
source: claude-design (projet cc29109f-93eb-48ca-840f-fb60118f438c)
intent_keywords: camping, feu de bois, nuit tombee, cozy, chaleureux
color_format: oklch
families: feu(30-85) + bois(45-75) + feuille(135-160)   # TROIS familles, jamais plus
reserved_accent: prune (--c-secret) — EXCLUSIVEMENT pour marquer ce que le public ne voit pas (animateur)
light_principle: la nuit autour, le feu seule source ; UN seul geste lumineux par ecran (g-hearth OU g-dusk)
fonts: display=grotesque condensee (Avenir Next Condensed/Futura/DIN) · ui=humaniste systeme · mono=chiffres et codes
font_loading: aucune police a charger — piles substituables
type_scales: joueur(--fs-100..900) · stream(--fs-st-*) · chrono deux tailles au seuil --urgent-threshold
icon_library: SVG au trait inline, stroke 1.6, jamais d'emoji
motion_philosophy: tout entre par le bas et s'apaise ; rien ne rebondit, rien ne clignote — sauf l'urgence du chrono
motion_durations: fast 140ms / base 240ms / slow 420ms / scene 640ms
accessibility: WCAG 2.2 AA — cibles 44px tactile / 40px pointeur, focus flamme 3px, etat lisible SANS la couleur (forme + poids)
dark_mode: true (dark-first, unique)
board_version: 4 (camping feu de bois ; supersedes v3 feu-de-camp convivial)

[ASSETS]
# Source de verite des chemins design (mono-app, a plat).
design_manifest: design/design-manifest.yaml
mockups_dir: design/mockups/
tokens_css: design/tokens/tokens.css          # v2 — 18 sections, source UNIQUE
design_board_html: design/design-board.html   # page Systeme = charte du projet
claude_design_src: design/claude-design/      # extractions brutes + journal d'integration
fonts_dir: design/fonts/
coverage: 4 surfaces / 20 ecrans (joueur J1-J6, animateur A1-A6, stream S1-S4, studio E1-E4)

[BUILD]
src_dir: src/
server_entry: src/server/index.js
client_entry: src/client/main.jsx
output_dir: dist/
env_example: .env.example
security_headers: src/public/_headers
surfaces: host (/host) · play (/play) · overlay (/overlay) · studio (/studio)
features_built: M1 salon+code+QR · M2 join sans compte · M3 join en cours · M4 modules libres · M5 4 modules (quiz/vrai-faux/estimation/vote) · M6 score+classement · M7 contrôle animateur · M9 temps réel Socket.IO · M10 dashboard · M11 manette · S1/S2 bonus-malus · S5 reconnexion
manifest_coverage: { total: 11, done: 11, deviated: 0, missing: 0, coverage_pct: 100% }
build_verified: true (vite build OK, 183 modules ; serveur node --check OK ; boucle e2e host/join/module/reveal/score vérifiée)
build_date: 2026-07-22

[TESTS]
test_framework: vitest + playwright (+ suite d'intégration socket.io-client)
test_dir: tests/
unit_dir: tests/unit/
e2e_dir: tests/e2e/
integration: tests/integration/game-loop.mjs
results_dir: tests/results/
coverage_min: 70
test_command: npm run test
e2e_command: npm run test:e2e
integration_command: npm run test:integration
all_tests_command: npm run test:all
last_run_passed: 80
last_run_failed: 0
last_run_date: 2026-08-18
test_report: docs/TEST-REPORT-v1.md

[AUDIT]
verdict: PASS
coverage: 20/20 (100.0%)
violations: blocking=0 major=0 warn=0
board: docs/DESIGN-BOARD-v4.md
report: docs/DESIGN-AUDIT-v1.md
machine_report: docs/DESIGN-AUDIT-v1.yaml
remediation_cycles: 0

[CONVENTION]
# Miroir des regles dures de REPO-CONVENTION.md — toujours en contexte
repo_contract: REPO-CONVENTION.md
frontier: design-* ecrivent design/ ; app-builder ecrit src/ uniquement (jamais tokens/manifest/mockups)
design_paths: lire depuis AGENTS.md [ASSETS] (design_manifest, mockups_dir) — jamais hardcode
css: BEM + tokens.css uniquement ; zero couleur/spacing/police hardcode
shared_writes: seul l'orchestrateur ecrit PROJECT.md/AGENTS.md/checklist/ledger
blind: .vault/ jamais stage/commite/pousse (hook PreToolUse l'empeche)
optionality: Class A obligatoire (STOP si absent) ; Class B bootstrap
compliance_gate: ~/.claude/hooks/check-convention.sh (Phase Z ; livre par product-discovery references/hooks/)
