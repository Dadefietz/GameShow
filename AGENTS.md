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
frontend: react-vite                   # SPA statique : /host, /play, /overlay/:type, /studio
realtime: socketio                     # serveur de jeu AUTORITAIRE (WebSocket), rooms = salons, état en mémoire
package_manager: pnpm
node_version: 22
auth: supabase-auth                    # animateur uniquement (email OTP / PKCE) ; joueurs = anonymes (playerToken JWT HS256 signé serveur)
css: vanilla-tokens                    # BEM + tokens.css ; direction game-show TV spectaculaire
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
icons: lucide-svg

[SECURITY]
rls_on_all_tables: true                # tables de contenu durable (owner = animateur)
authoritative_server: true             # le client n'envoie JAMAIS de score ; réponses validées serveur
service_role_frontend: false           # service_role + GAME_JWT_SECRET : serveur uniquement
service_role_git: false
user_metadata_in_policies: false
player_auth: signed-jwt-per-room       # playerToken HS256, portée = salon, TTL = durée du salon
room_isolation: true                   # un socket ne reçoit/agit que dans sa room
security_advisor_before_deploy: true

[DESIGN]
# Renseigné par design-board (Phase 3, board v3 = feu-de-camp convivial). Le QUOI/POURQUOI visuel.
scope_type: product-interface
intent_keywords: chaleureux, convivial, accueillant, premium-doux, lisible-en-live
color_format: oklch
primary_anchor_hue: 58
primary_anchor_chroma: 0.17
palette_poles: feu(primary H58) + chaud-neutre(neutres H80 chroma basse, SANS brun) + vert-frais(accent H150)
signature_accent: feu oklch(0.62 0.17 58) ; grand chiffre en flamme (Fraunces)
surfaces: dark-first (bg-deep oklch(0.20 0.014 80), surface 0.26 0.018 80, elevated 0.32 0.02 80)
fonts: [{family: Fraunces, role: display, source: google-fonts, licence: OFL}, {family: Inter, role: text, source: google-fonts, licence: OFL}]
icon_library: lucide
motion_philosophy: organique-doux (variante flamme) — fast 140ms / base 240ms / slow 320ms, reveal glow <=600ms, zéro bounce
accessibility: WCAG 2.2 AA (contrastes calculés, majorité AAA)
touch_target_min: 44px
focus_ring: 2px solid primary-500 (feu), offset 2px
dark_mode: true
imagery: feu de camp/tipi/forêt LUMINEUX et accueillants (asset-imagery Phase 4.x) ; image éclaircie mais assombrie sous le texte
board_version: 3 (feu-de-camp convivial, sans brun ; supersedes v2 brun et v1 néon)

[ASSETS]
# Renseigné par design-builder. Source de vérité des chemins design (mono-app, à plat).
design_manifest: design/design-manifest.yaml
mockups_dir: design/mockups/
tokens_css: design/tokens/tokens.css
tokens_json: design/tokens/tokens.json
design_board_html: design/design-board.html
fonts_dir: design/fonts/           # Fraunces + Inter self-hostés (woff2, OFL), aucun CDN
coverage: 12/12 écrans (100%)

[BUILD]
src_dir: src/
server_entry: src/server/index.js
client_entry: src/client/main.jsx
output_dir: dist/
env_example: .env.example
security_headers: src/public/_headers
surfaces: host (/host) · play (/play) · overlay (/overlay/:type) · studio (/studio)
features_built: M1 salon+code+QR · M2 join sans compte · M3 join en cours · M4 modules libres · M5 4 modules (quiz/vrai-faux/estimation/vote) · M6 score+classement · M7 contrôle animateur · M8 overlays OBS · M9 temps réel Socket.IO · M10 dashboard · M11 manette · S1/S2 bonus-malus · S5 reconnexion
manifest_coverage: { total: 11, done: 11, deviated: 0, missing: 0, coverage_pct: 100% }
build_verified: true (vite build OK, 183 modules ; serveur node --check OK ; boucle e2e host/join/module/reveal/score vérifiée)
build_date: 2026-07-22

[AUDIT]
verdict: PASS
coverage: 12/12 (100.0%)
violations: blocking=0 major=0 warn=0
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
