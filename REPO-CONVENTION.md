# REPO-CONVENTION.md — Repository contract

> Created by `product-discovery` at project init. **Mandatory read for every skill and every
> worker agent.** This is the "repository logic" all agents must respect.

## Pipeline order (all steps mandatory unless marked parallel)

```
1   product-discovery     → USER-NEEDS, PROJECT.md, REPO-CONVENTION.md
1.5 design-benchmark      → DESIGN-DOMAIN-EXPLORE, domain-knowledge cache   (MANDATORY)
2   tech-spec-writer      → TECH-SPEC, AGENTS.md
3   design-board          → DESIGN-BOARD, AGENTS.md [DESIGN]
3.5 design-explorer       → design/directions/*
4   design-builder        → tokens.css, design-manifest, AGENTS.md [ASSETS]
4.x asset-imagery         → design/assets/ (PNG + sidecars), design-manifest.assets rempli (PER-APP)
4.5 design-audit          → DESIGN-AUDIT
5   app-builder           → src/, AGENTS.md [BUILD]
6   tester        ┐ run in parallel — neither needs the other's output
7   security-tester ┘
8   deployer              → live app, .vault/deploy-state.yaml

(change-only) design-proposer → design/proposals/_candidates/*   alternatives de design auditables,
              piloté par saas-change-orchestrator (type: design-proposal) — jamais en forward
(change-only) design-handoff-extract → design/handoff/_candidates/*   page extraite pour retravail
              dans Claude Design ; design-handoff-integrate réintègre le retour via
              saas-change-orchestrator (type: design-handoff) — jamais en forward
```

## Folder layout

```
docs/                         USER-NEEDS, TECH-SPEC, DESIGN-BOARD, DESIGN-DOMAIN-EXPLORE, reports
                              + PIPELINE-INDEX.yaml (shared, project-level — one instance)
design/tokens/                tokens.json, tokens.css      (SHARED, read-only for app-builder)
design/fonts/  design/icons/  downloaded assets (SHARED)
design/assets/                image_asset PNG + sidecars + assets-manifest.yaml (PER-APP, mono-app à plat ; voir §image_asset)
design/proposals/_candidates/ design-proposer alternatives (PER-APP, gate-EXEMPT, gitignored, transient — voir design-proposer)
apps/subapps/<app>/design/    design-manifest-<app>.yaml, mockups/<screen>.html, assets/   (PER-APP)
apps/subapps/<app>/src/       the live application in MULTI-APP topology (app-builder owns this)
src/                          the live application in MONO-APP topology (app-builder owns this)
.vault/                       BLIND — credentials + deploy/build state (never pushed)
PROJECT.md  AGENTS.md         committed pipeline state (see boundary below)
```

> **App-scoping (one level).** A project is either **mono-app** (no `apps/subapps/`, `src/` at root,
> implicit app id `root`) or **multi-app** (one+ `apps/subapps/<app>/`, each with its own
> `design/` + `src/`). Exactly ONE level under `apps/subapps/` — no recursive nesting. See
> "## App-scoping" below for the full PARTAGÉ vs PER-APP table.

## App-scoping (un seul niveau — plafonné)

**Topologie.** Un projet est soit **MONO-APP**, soit **MULTI-APP** :

- **MONO-APP** : pas de dossier `apps/subapps/`. Le code vit dans `src/` à la racine. App id
  **implicite = `root`**. C'est le **comportement actuel** (rétro-compatible, chemins à plat).
- **MULTI-APP** : un ou plusieurs `apps/subapps/<app>/`, **exactement UN niveau**. `<app>` = slug
  **kebab-case** (ex. `admin-console`, `customer-portal`). Chaque app a son propre `design/` et son
  propre `src/`.

**Cap (plafond strict).** **PAS de nesting récursif** : interdit `apps/subapps/<app>/apps/subapps/…`
ou tout sous-niveau d'app. Le plafond est **un seul niveau** sous `apps/subapps/`.

**Détection.** Énumérer `apps/subapps/*` (un seul niveau de profondeur) :

- **0 entrée** → **mono-app** (id implicite `root`, chemins à plat `src/`, `design/`).
- **≥1 entrée** → **multi-app** (une instance par `<app>`).

La liste des apps est **déclarée ici, dans cette section** (voir « Apps déclarées » ci-dessous) et
**reflétée** dans `docs/PIPELINE-INDEX.yaml` sous la clé `apps:`.

**Apps déclarées (à remplir par product-discovery à l'init) :**

```
apps:
  - root        # mono-app : seule entrée, implicite. En multi-app : remplacer par la liste kebab-case.
```

**PARTAGÉ (niveau projet — UNE instance par projet) vs PER-APP (une instance par `<app>`) :**

| Artefact (nœud DAG) | Portée | Chemin exact |
|---|---|---|
| user_needs (1) | **PARTAGÉ** | `docs/USER-NEEDS-vN.yaml` (+ `.md`) |
| design_domain_explore (1.5) | **PARTAGÉ** | `docs/DESIGN-DOMAIN-EXPLORE-vN.md` |
| tech_spec (2) | **PARTAGÉ** | `docs/TECH-SPEC-vN.md` |
| design_board (3) | **PARTAGÉ** | `docs/DESIGN-BOARD.md` |
| tokens (4) | **PARTAGÉ** | `design/tokens/` (`tokens.css` + `tokens.json`) |
| design_manifest (4) | **PER-APP** | `apps/subapps/<app>/design/design-manifest-<app>.yaml` |
| mockups (4) | **PER-APP** | `apps/subapps/<app>/design/mockups/` |
| image_asset (4.x) | **PER-APP** | `apps/subapps/<app>/design/assets/<asset-type>-<slug>[-<app>]-vN.png` (mono-app : `design/assets/`) |
| assets_manifest (4.x) | **PER-APP** | `apps/subapps/<app>/design/assets/assets-manifest.yaml` (mono-app : `design/assets/assets-manifest.yaml`) |
| src (5) | **PER-APP** | `apps/subapps/<app>/src/` (multi-app) · `src/` racine (mono-app) |
| test_report (6) | **PER-APP** | `docs/TEST-REPORT-<app>-vN.yaml` (+ `.md`) |
| security_audit (7) | **PER-APP** | `docs/SECURITY-AUDIT-<app>-vN.md` |
| deploy (8) | **PER-APP** | entrée per-app dans `.vault/deploy-state.yaml` (`apps.<app>`) |

> **Mono-app = à plat.** En mono-app (app `root`), les artefacts PER-APP gardent leurs **chemins
> actuels à plat** : `src/` à la racine, `design-manifest.yaml`/`mockups/` au chemin existant,
> `TEST-REPORT-vN`, `SECURITY-AUDIT-vN` sans suffixe d'app. **Tout est ADDITIF** : un projet mono-app
> se comporte exactement comme avant.

> **La colonne « Chemin exact » ci-dessus EST la codification primaire (le titre).** La grammaire
> complète des titres, le `artifact_type` associé à chaque ligne, le schéma de **tag** backstop par
> format, la **règle d'accord titre↔tag↔registre** et la **bijection mockups↔manifest** sont
> spécifiés en bas de ce fichier — voir §« Codification — titre (primaire) + tag (backstop) ».
> Le gate `check-convention.sh` vérifie cet accord ; `check-coherence.sh` vérifie le versionnage.

**Change-set scopé.** Un scope de changement porte un champ app : `{ app: <app>, screens/modules:
[...] }`. Conséquence de portée : un changement d'un nœud **PARTAGÉ** (1/1.5/2/3/3.5) **fan-out vers
TOUTES les apps en aval** (chaque app doit re-dériver son design_manifest/src/test/security) ; un
changement d'un nœud **PER-APP** (4/4.5/5/6/7/8) reste **confiné à l'app ciblée**.

## Hard rules

1. **`design/` vs `src/` frontier.** design-* skills write `design/` and `apps/subapps/*/design/`.
   `app-builder` reads them and writes the app's `src/` only (`src/` racine en mono-app,
   `apps/subapps/<app>/src/` en multi-app) — it never edits tokens, manifest, or mockups, and never
   touches `src/` nor `apps/subapps/*/src/` from a design skill.
2. **Canonical design paths** are recorded in `AGENTS.md [ASSETS]` (`design_manifest:`, `mockups_dir:`
   en mono-app ; `design_manifest@<app>` / `mockups_dir@<app>` par app en multi-app).
   Consumers (app-builder, design-audit) read the path from `[ASSETS]` — never hardcode it.
3. **BEM + tokens.** CSS classes follow `.block__element--variant`; no hardcoded colors/spacing/fonts
   outside `tokens.css`. Icons = Lucide SVG, no emoji.
4. **Orchestrator-only writes.** When a skill runs as orchestrator + workers, only the orchestrator
   writes shared state (`PROJECT.md`, `AGENTS.md`, manifest-coverage checklist, `.vault/` ledger).
5. **Blind rule.** `.vault/` is never staged, never committed, never pushed. See `.vault` spec.

## Nothing is optional

- **Class A — pipeline deliverables** (USER-NEEDS, DESIGN-DOMAIN-EXPLORE, TECH-SPEC, DESIGN-BOARD,
  design-manifest, tokens.css, REPO-CONVENTION.md, AGENTS.md, PROJECT.md): if a required input is
  missing, **STOP and report which upstream step must run** — never "continue without it".
- **Class B — global learning caches** (`~/.claude/skill-knowledge/{stack-patterns,pitfalls}.yaml`,
  `design-benchmark-cache/domain-knowledge/`): on first encounter, **create them (bootstrap, empty/seeded)
  then proceed**; thereafter they are always present and always read/updated. Never silently skipped.

## Public vs blind — source of truth

- `PROJECT.md` (committed): pipeline phase status only.
- `AGENTS.md` (committed): config + build metadata (`[STACK] [DESIGN] [ASSETS] [BUILD] [TESTS] [SECURITY]`).
- `.vault/deploy-state.yaml` (blind): credentials, created infra, push/build history.
  **Authoritative for "does resource X exist / was it already pushed/built".**


## Permissions setup (user-level — required once)

These skills run web research (product-discovery, design-benchmark), download fonts/icons
(design-builder), spawn worker agents (`Task`), call other skills (`Skill`), and use the Supabase
MCP (deployer). To pre-grant them so the pipeline never stops on per-tool prompts, merge
`pipeline.settings.json` into your **user-level** `~/.claude/settings.json`:

```json
{
  "permissions": {
    "allow": ["WebSearch","WebFetch","Skill","Task","Read","Write","Edit","Grep","Glob","Bash","mcp__supabase__*"]
  }
}
```

- User-level (`~/.claude/settings.json`) applies wherever you run these skills.
- `permissions.allow` is the real enforcement; **subagents/workers inherit it**, so the orchestrator's
  workers do not re-prompt. The `allowed-tools` frontmatter in each SKILL.md is an intent signal only
  (parsed, not reliably enforced).
- `permissions.deny` overrides `allow` — keep deny clear of these tools.
- Known issue: WebSearch may still prompt occasionally in some UI contexts even when allowed.

---

> The sections below cover **incremental change** of an already-built project. They are **additive**:
> a project that never uses the change-pipeline behaves exactly as before (forward-only). They are
> read by the forward pipeline (version resolution) and by `saas-change-orchestrator` (impact
> analysis, coherence). All four are **Class B**: bootstrap-if-missing, then always present.

## Registre de versions — docs/PIPELINE-INDEX.yaml

**Rôle.** Source unique de vérité « quel document est le bon ». Remplace l'heuristique fragile
« le `vN` le plus élevé dans `/docs/` » par une **résolution explicite par registre**. Fichier
**committé** (public, comme `PROJECT.md` / `AGENTS.md`). **Écrit UNIQUEMENT par un orchestrateur**
(forward bootstrap, ou `saas-change-orchestrator`) — jamais par un worker.

**Schéma (une entrée par artefact logique) — étendu rétro-compatible pour l'app-scoping :**

```yaml
schema_version: 1
updated_at: ""          # ISO 8601 UTC — dernière mutation
updated_by: ""          # "bootstrap" | "forward:<skill>" | "CS-<id>"

apps: [root]            # APP-SCOPING : liste des apps. Mono-app = [root] (implicite). Multi-app =
                        # [admin-console, customer-portal, …] (slugs kebab-case ; cf. §App-scoping).

artifacts:              # ── PARTAGÉS (niveau projet, UNE instance) ──────────────────────────────
  <artefact>:                       # user_needs, design_domain_explore, tech_spec, design_board, tokens
    node: <id>                      # nœud DAG producteur (cf. pipeline-dag.yaml ; project={1,1.5,2,3,3.5})
    producer_skill: <skill>
    active_version: <N>             # LA version active de cet artefact
    path: <chemin du fichier actif>
    companion_paths: []             # livrables liés (même version) — optionnel
    agents_sections: []             # section(s) AGENTS.md possédées — optionnel
    change_set: <bootstrap|CS-id>   # CS qui a produit la version active
    derived_from: { <amont>: <version amont active AU MOMENT du build> }
    updated_at: ""
    hash: ""                        # OPTIONNEL (sha256/git tree). JAMAIS de secret (cf. .vault aveugle).

app_artifacts:          # ── PER-APP (une instance par <app>) ───────────────────────────────────
  <app>:                            # ex. root (mono-app) | admin-console | customer-portal
    design_manifest: { node: 4,   active_version: <N>, path: apps/subapps/<app>/design/design-manifest-<app>.yaml, mockups_dir: apps/subapps/<app>/design/mockups/, derived_from: { design_board: <N>, tokens: <N> } }
    image_assets:                   # 4.x — index per-app des image_asset PROMUS (clé = id stable, cf. §image_asset)
      <id>:          { active_version: <N>, path: apps/subapps/<app>/design/assets/<asset-type>-<slug>[-<app>]-vN.png, derived_from: { design_board: <N>, tokens: <N> } }
    src:             { node: 5,   active_version: <N>, path: apps/subapps/<app>/src/,            derived_from: { tech_spec: <N>, tokens: <N>, user_needs: <N>, design_manifest: <N>, image_assets: { <id>: <N> } } }
    test_report:     { node: 6,   active_version: <N>, path: docs/TEST-REPORT-<app>-vN.yaml,     derived_from: { src: <N> } }
    security_audit:  { node: 7,   active_version: <N>, path: docs/SECURITY-AUDIT-<app>-vN.md,    derived_from: { src: <N> } }
```

> **`image_assets` (4.x — produit par asset-imagery).** Sous-carte PER-APP : une entrée par
> `image_asset` **promu**, indexée par son `id` stable. Chaque entrée porte `active_version` (le `vN`
> actif), `path` (la source canonique PNG sous `design/assets/`) et `derived_from`
> (`{design_board: <N>, tokens: <N>}` — l'asset hérite de la direction visuelle). `src` (app-builder)
> enregistre en plus `derived_from.image_assets: { <id>: <N> }` (provenance de la copie servie). Si un
> asset passe à `v(N+1)` ou si `design_board`/`tokens` bougent, l'invariant de cohérence aval signale
> l'asset (régénération) puis `src` (re-câblage app-builder PATCH). **Bootstrap si absent**
> (rétro-compat : un projet sans asset n'a tout simplement pas la sous-clé `image_assets`).

`derived_from` enregistre **les amonts ET leur version active au moment du build** : c'est la clé de
l'invariant de cohérence aval (voir plus bas). `hash` est optionnel (pas de blocage si absent).

**Rétro-compat mono-app (chemins à plat).** En mono-app, deux écritures équivalentes sont admises :
soit `app_artifacts: { root: { design_manifest, src, test_report, security_audit } }` avec les
chemins à plat (`src/`, `docs/TEST-REPORT-vN.yaml`, etc.), soit — **schéma legacy** — garder
`design_manifest`/`src`/`test_report`/`security_audit` **à plat sous `artifacts:`** (= équivalent à
`app_artifacts.root`). Les deux formes sont lues. `derived_from` de `app_artifacts.<app>.src` =
amonts **partagés** (`tech_spec`, `tokens`, `user_needs`) **+** `app_artifacts.<app>.design_manifest`
(per-app). L'invariant de cohérence aval s'applique aux deux blocs (`artifacts:` plat **et**
`app_artifacts.<app>`).

> **`[ASSETS]` per-app.** En multi-app, `AGENTS.md [ASSETS]` indexe les chemins par app —
> `design_manifest@<app>` / `mockups_dir@<app>` (une paire par app). En mono-app, `[ASSETS]` garde la
> forme **à plat** actuelle (`design_manifest:` / `mockups_dir:`, app `root` implicite).

**Règle de résolution d'une entrée `X` :**

1. Si `docs/PIPELINE-INDEX.yaml` existe → lire `artifacts.<X>.path` + `active_version`. Utiliser ce
   chemin. (Fin.)
2. Si le registre est **absent** → appliquer l'ancienne heuristique exacte (« version `N` la plus
   élevée dans `/docs/` », inchangée) **PUIS bootstrapper** le registre. **Jamais de skip silencieux.**

Cette règle est strictement **additive** : elle encapsule l'heuristique « plus haut `vN` » derrière
un `if registre présent`. Le manifest reste résolu via `AGENTS.md [ASSETS]` (source unique) ; le
registre n'en est qu'un **miroir indexé par version**, il ne le contredit pas.

**Doctrine Class B (bootstrap-then-mandatory).** Si le registre est absent : scanner l'état observé
(`/docs/`, `design/`, `apps/subapps/*/design/`, `src/`, `PROJECT.md`, `AGENTS.md [ASSETS]`), poser
`active_version` = `vN` le plus haut, `change_set: bootstrap`, `derived_from` best-effort
(`# provenance partielle` si indéterminable), écrire le fichier, **logger explicitement** à
l'utilisateur. Ensuite : toujours présent, toujours lu/écrit.

## Change-sets & CHANGELOG

Tout changement incrémental est tracé deux fois :

- **Machine — `docs/changes/CS-<YYYYMMDD-nn>.yaml`** (committé). Un fichier par change-set. Champs
  clés : `id`, `date`, `trigger` (demande verbatim), `entry_node`, `classification_rationale`,
  `affected_artifacts` (**aval uniquement**), `skills_run` (ordre du DAG + `parallel_group`),
  `version_transitions` (`from→to` par artefact), `git` (`branch: cs/<id>`, `base_branch`,
  `commits`), `phase_z_result`, `coherence_result`, `deploy_impact`, `status`
  (`open | merged | rolled-back`).
- **Humain — `CHANGELOG.md`** (committé, **append-only**, racine projet). Une entrée lisible par
  change-set : demande, nœud d'entrée, artefacts refaits (`vX→vY`), branche, résultat du gate,
  impact déploiement, statut.

**Un seul change-set `open` à la fois** : refuser d'en ouvrir un second tant que le précédent n'est
pas `merged` ou `rolled-back` (sérialisation, anti-conflit de registre/branches). Ces deux fichiers
sont **écrits uniquement par `saas-change-orchestrator`**.

## Invariant de cohérence aval

**Énoncé.** Pour tout artefact `Y` ayant des dépendances : pour chaque amont `X` dans
`Y.derived_from`, la version enregistrée `Y.derived_from[X]` doit être **égale** à
`artifacts.X.active_version`. Sinon → **INCOHÉRENT** : un amont a bougé sans que l'aval soit
rebuildé.

Exemple : `src.derived_from = { tech_spec: 1, design_manifest: 1, tokens: 1, user_needs: 1 }`. Si
`tech_spec` passe à `v2` (un change-set a bumpé la spec) mais que `src` n'a pas été rebuildé, alors
`src.derived_from.tech_spec (=1) ≠ artifacts.tech_spec.active_version (=2)` → INCOHÉRENT.

**Vérifié par `~/.claude/hooks/check-coherence.sh <project_root>`** (déterministe, parse le registre
en python3, aucune dépendance jq). Tolérant : registre absent → exit 0 (legacy, non vérifié). Sinon
exit 1 si ≥1 violation, exit 0 sinon. Appelé par `saas-change-orchestrator` au gate (Phase 5), et à
la demande de l'utilisateur. C'est le **filet déterministe contre le sous-rebuild**.

## DAG — pipeline-dag.yaml

**Source unique d'ordre** du pipeline. Fichier dédié machine-lisible à la **racine du projet**
(committé), miroir machine du « Pipeline order » ci-dessus (qui reste la version humaine). Décrit les
**nœuds** (phases 1…8 + leurs artefacts produits), les **arêtes** (dépendances **entre artefacts** :
« target dépend de sources »), et les **groupes parallèles** (`tester ∥ security-tester`).

**Deux consommateurs, une seule source :**

- le **forward** : résolution « prochaine étape » (migration douce — le forward ne dérive du DAG que
  s'il existe, sinon il garde son « Prochaine étape → X » en dur ; jamais deux logiques d'ordre
  contradictoires actives).
- **`saas-change-orchestrator`** : analyse d'impact aval (parcours des `edges` depuis le nœud
  d'entrée).

Absent → `saas-change-orchestrator` le **bootstrappe** depuis le « Pipeline order » de ce fichier
(jamais de skip). Aucune logique d'ordre n'est dupliquée ailleurs.

## Codification — titre (primaire) + tag (backstop)

> **Doctrine.** Tout artefact du pipeline est identifié par **deux couches redondantes** : (1) son
> **TITRE de fichier** = la **codification primaire** (visible, greppable, c'est ce qu'un humain ou
> un `grep`/`Glob` lit en premier) ; (2) un **TAG minimal dans le contenu** = le **backstop** (résiste
> au renommage : si le fichier est déplacé/renommé, le tag permet encore de l'identifier). Les deux
> doivent **s'accorder** entre eux **et** avec l'entrée active du registre `docs/PIPELINE-INDEX.yaml`.
> Source unique de cette spec — réifiée par le gate `check-convention.sh`. **Additif & rétro-compatible.**

### A. Grammaire canonique des TITRES (codification primaire)

Le titre encode `{type, app, version}`. La colonne « Chemin exact » de la table placement-rules
(§App-scoping) est l'application de cette grammaire.

**Artefacts PARTAGÉS (niveau projet) :**

| `artifact_type` | Titre canonique |
|---|---|
| `user_needs` | `docs/USER-NEEDS-vN.yaml` (+ `docs/USER-NEEDS-vN.md`) |
| `design_domain_explore` | `docs/DESIGN-DOMAIN-EXPLORE-vN.md` |
| `tech_spec` | `docs/TECH-SPEC-vN.md` |
| `design_board` | `docs/DESIGN-BOARD.md` (ou `docs/DESIGN-BOARD-vN.md`) |
| `tokens` | `design/tokens/tokens.css` + `design/tokens/tokens.json` |

**Artefacts PER-APP** (multi-app sous `apps/subapps/<app>/`) :

| `artifact_type` | Titre canonique (multi-app) | Mono-app (segment `-<app>` OMIS) |
|---|---|---|
| `design_manifest` | `apps/subapps/<app>/design/design-manifest-<app>.yaml` | `design/design-manifest.yaml` (chemin à plat existant) |
| `mockup` | `apps/subapps/<app>/design/mockups/<screen>.html` | `design/mockups/<screen>.html` |
| `image_asset` | `apps/subapps/<app>/design/assets/<asset-type>-<slug>-<app>-vN.png` | `design/assets/<asset-type>-<slug>-vN.png` |
| `assets_manifest` | `apps/subapps/<app>/design/assets/assets-manifest.yaml` | `design/assets/assets-manifest.yaml` |
| `src` | `apps/subapps/<app>/src/` | `src/` racine |
| `test_report` | `docs/TEST-REPORT-<app>-vN.yaml` (+ `.md`) | `docs/TEST-REPORT-vN.yaml` (+ `.md`) |
| `security_audit` | `docs/SECURITY-AUDIT-<app>-vN.md` | `docs/SECURITY-AUDIT-vN.md` |

> **`<screen>` = id d'écran kebab-case du manifest.** Chaque mockup `<screen>.html` correspond à
> l'id d'écran exact déclaré dans `design-manifest-<app>.yaml` (voir bijection, §D).

> **RÉTRO-COMPAT mono-app (NON-NÉGOCIABLE).** En mono-app (app implicite `root`), le segment
> `-<app>` est **OMIS** : les noms à plat actuels restent **inchangés** (`TEST-REPORT-vN`,
> `SECURITY-AUDIT-vN`, `design-manifest.yaml`, `mockups/<screen>.html`, `src/`). Un projet mono-app
> existant n'est jamais renommé.

**Artefacts du change-pipeline :**

| `artifact_type` | Titre canonique |
|---|---|
| `change_set` | `docs/changes/CS-<YYYYMMDD-nn>.yaml` |
| `changelog` | `CHANGELOG.md` (racine) |
| `pipeline_index` | `docs/PIPELINE-INDEX.yaml` |
| `pipeline_dag` | `pipeline-dag.yaml` (racine) |
| `repo_convention` | `REPO-CONVENTION.md` (racine) |
| `project` | `PROJECT.md` (racine) |
| `agents` | `AGENTS.md` (racine) |

### B. Schéma du TAG minimal (backstop) — par format

Le tag est le **strict minimum** qui survit au renommage. Clés communes : `artifact_type`, `app`,
`version`, `change_set`, `produced_by`.

- **Frontmatter YAML / Markdown** (`.yaml`, `.md` à frontmatter `---`) :
  ```yaml
  ---
  artifact_type: tech_spec        # un des enum (§C)
  app: root                       # root en mono-app ; slug kebab en multi-app
  version: 2                      # entier, == vN du titre
  change_set: CS-20260531-01      # CS producteur (ou "bootstrap")
  produced_by: tech-spec-writer   # skill productrice
  ---
  ```
- **Mockups HTML** (`<screen>.html`) — commentaire d'en-tête (première ligne utile du fichier) :
  ```html
  <!-- artifact: mockup; app:<app>; screen:<id>; version:N; change_set:<id>; produced_by:design-builder -->
  ```
- **Tokens CSS** (`tokens.css`) — commentaire d'en-tête (mêmes clés que le frontmatter) :
  ```css
  /* artifact_type: tokens; app: root; version: 1; change_set: bootstrap; produced_by: design-builder */
  ```
- **Code `src/`** — **AUCUN tag par fichier.** L'identité d'un fichier source = son **emplacement**
  (`apps/subapps/<app>/src/…` ou `src/…`) + un **marqueur de racine d'app**
  `apps/subapps/<app>/.artifact.yaml` (en mono-app : `.artifact.yaml` à la racine) + l'entrée
  `src` du registre. Le marqueur porte le frontmatter : `artifact_type: src`, `app`, `version`,
  `change_set`, `produced_by: app-builder`.

### C. enum `artifact_type` (valeurs autorisées)

```
user_needs · design_domain_explore · tech_spec · design_board · tokens · design_manifest ·
mockup · image_asset · assets_manifest · src · test_report · security_audit · change_set ·
repo_convention · pipeline_index · pipeline_dag · project · agents · changelog · design_proposals
```

### D. Règle d'accord (gate) — titre ↔ tag ↔ registre

Pour **tout livrable tagué**, les trois doivent coïncider :

```
{type, app, version} du TITRE  ==  {artifact_type, app, version} du TAG  ==  entrée active du REGISTRE
```

Tout **désaccord** ⇒ le fichier est **mal nommé / mal rangé / mal tagué** ⇒ **VIOLATION**. Exemples :
un titre `TECH-SPEC-v2.md` avec un tag `version: 3` → violation ; un mockup `login.html` taggé
`screen:signup` → violation ; un `TEST-REPORT-admin-console-v1.yaml` taggé `app: customer-portal`
→ violation.

### E. Bijection mockups ↔ manifest (par app)

Pour **chaque app**, l'ensemble des écrans déclarés dans `design-manifest-<app>.yaml` et l'ensemble
des fichiers `…/mockups/<screen>.html` sont en **bijection exacte** :

- chaque écran du manifest a **exactement un** `<screen>.html` ;
- chaque mockup correspond à **exactement un** écran du manifest ;
- **zéro orphelin des deux côtés** (ni écran sans mockup, ni mockup sans écran). Tout orphelin ⇒
  VIOLATION.

L'id d'écran du manifest (clés de `screens:` ou champ `screen:`/`id:` des entrées) **est** le
basename kebab-case du mockup.

### F. Tolérance legacy (Class B) & repo-tidy

- **Fichier existant non tagué** ⇒ le gate **AVERTIT** (`WARN`), il **n'échoue pas**. Les projets
  antérieurs à cette codification ne sont jamais cassés par l'ajout du tag.
- **Fichier nouvellement produit** sans titre canonique **+** tag conforme ⇒ le gate **BLOQUE**
  (`FAIL`). Toute nouvelle production doit naître codifiée.
- **Contradiction** : si le **titre** matche un pattern d'artefact canonique **mais que le tag le
  contredit** (type/app/version) ⇒ **FAIL** même sur fichier pré-existant (un tag présent mais
  faux n'est pas du legacy, c'est une erreur de codification).
- **Back-fill** : `repo-tidy` (ou l'orchestrateur au premier change-set touchant l'artefact)
  ajoute les tags manquants aux fichiers legacy et corrige les titres non canoniques, faisant
  passer le projet de l'état « WARN » à « conforme ».

---

## Codification & intégration `image_asset` (images de marque — produit par asset-imagery)

> **Additif & rétro-compatible.** Un projet **sans aucun asset** n'a pas de dossier `design/assets/` :
> rien n'est exigé, le gate ne signale rien (zéro effet). Cette section décrit comment les **images
> réelles** de l'app (hero, og-image, illustrations, packshots…) sont **codifiées**, **promues** et
> **consommées** par l'app, au **même niveau de redondance** que les autres artefacts (titre primaire +
> tag backstop + entrée registre). `image_asset` est un artefact **PER-APP**, famille **design**,
> produit par **asset-imagery** (nœud 4.x), consommé par **app-builder** (nœud 5).

### A. Layout `design/assets/` (PER-APP, un seul niveau)

```
apps/subapps/<app>/design/assets/        # multi-app ; mono-app → design/assets/ à plat (app implicite root)
  _candidates/                           # STAGING : brouillons générés. GITIGNORÉ + EXEMPT DU GATE.
  <asset-type>-<slug>[-<app>]-vN.png     # asset PROMU = source canonique (binaire, jamais éditée par app-builder)
  <asset-type>-<slug>[-<app>]-vN.asset.yaml   # sidecar TAG backstop (le PNG ne peut pas porter de frontmatter)
  <asset-type>-<slug>[-<app>]-vN.spec.json     # json-spec de RE-GÉNÉRATION déterministe (flags du moteur)
  assets-manifest.yaml                   # index PER-APP des assets promus (bijection avec les PNG/sidecars)
```

- **`_candidates/`** est la zone tampon (comme `docs/_inbox/`) : `generate.py` y écrit les brouillons
  Gemini ; l'humain (forward) ou l'orchestrateur (change) **promeut** le retenu. **Gitignoré et exempt
  du gate de codification** — aucun fichier sous un segment `_candidates/` n'est jamais contrôlé.
- **Seuls les assets PROMUS** (au nom canonique, à la racine de `design/assets/`) sont commités,
  taggés (sidecar) et inscrits au registre + à `assets-manifest.yaml`.

### B. Grammaire de titre (codification primaire)

`<asset-type>-<slug>[-<app>]-vN.png`

- **`<asset-type>`** ∈ { `hero`, `og-image`, `illustration`, `packshot`, `avatar`,
  `icon-illustration`, `background`, `social-card`, `favicon-source`, `texture`, `spot` }
  — **liste ouverte** (de nouveaux types peuvent être ajoutés ici ; le gate ne ferme pas l'enum des
  types d'asset, il vérifie l'accord titre↔sidecar).
- **`<slug>`** : identifiant kebab-case stable du sujet (`landing-main`, `feature-sync`, …).
- **`[-<app>]`** : segment app **OMIS en mono-app** (rétro-compat) ; en multi-app, suffixe slug de l'app.
- **`-vN`** : version entière (`v1`, `v2`, …). Re-promotion → `…-v(N+1).png` + `superseded_by` sur vN.

Le `<asset-type>` et le `<slug>` du titre **doivent** correspondre aux champs `asset_type`/`slug` du
sidecar (accord, §E).

### C. Sidecar `.asset.yaml` (tag backstop — schéma exact)

Le PNG étant binaire, le tag vit dans un **fichier compagnon** au même basename + `.asset.yaml` :

```yaml
artifact_type: image_asset
app: <app|root>                         # root en mono-app ; slug kebab en multi-app
version: N                              # entier, == vN du titre
asset_type: hero                        # == <asset-type> du titre (un des types §B, liste ouverte)
slug: landing-main                      # == <slug> du titre
change_set: <id|null>                   # CS producteur (forward → null/bootstrap)
produced_by: asset-imagery
derived_from: { design_board: vK, tokens: vM }   # direction visuelle dont l'asset dérive
spec_ref: hero-landing-main-vN.spec.json         # la json-spec de re-gen, à côté
backend: gemini|pollinations            # moteur ayant produit l'image
```

### D. `.spec.json` (re-génération déterministe)

À côté de chaque asset promu, `<même-nom>.spec.json` enregistre la **json-spec** (sujet, scène, mood,
copy, couleurs exactes issues de `tokens.css`, flags du moteur) ayant servi à `generate.py`. Permet une
re-génération déterministe ultérieure. Non taggé (artefact technique de provenance) ; référencé par
`spec_ref` du sidecar.

### E. `assets-manifest.yaml` (index per-app des assets promus)

Index **PER-APP** listant les assets promus de l'app. Schéma minimal par entrée :

```yaml
assets:
  - id: hero-landing-main               # id stable (== clé registre image_assets.<id>)
    asset_type: hero
    slug: landing-main
    version: 2
    path: design/assets/hero-landing-main-v2.png   # relative à l'app
    sidecar: design/assets/hero-landing-main-v2.asset.yaml
```

**Bijection (vérifiée par le gate).** Pour chaque `design/assets/assets-manifest.yaml` (racine si
mono-app, per-app sinon) : toute entrée listée ↔ un PNG promu **existant** + son sidecar ; tout PNG
promu **non listé** = stray (signalé) ; toute entrée **sans fichier** = pointeur cassé (signalé).
`_candidates/` exclu de la bijection.

### F. Carte d'usage — section `assets:` du `design-manifest`

Le **design-manifest** gagne une section `assets:` = **contrat consommé par app-builder**. Schéma par
entrée :

```yaml
assets:
  - id: hero-landing-main               # stable, référencé par les composants ; == id assets-manifest
    asset_type: hero
    path: design/assets/hero-landing-main-v2.png   # source canonique (relative à l'app)
    version: 2
    usage:                              # OÙ l'asset est consommé (le contrat pour app-builder)
      - screen: landing
        slot: hero-background
      - component: HeroBanner
    alt: "Bannière d'accueil — ..."     # accessibilité (OBLIGATOIRE)
```

**Ownership (écriture coordonnée, sections disjointes du même fichier) :**

- **design-builder** crée les entrées en **slots** (id + `usage` + `brief` créatif + `alt`),
  `path`/`version` **vides** → c'est la *commande* d'image.
- **asset-imagery** **remplit** `path`/`version` à la promotion (et crée/maj `assets-manifest.yaml`).
  Il ne touche pas aux `screens`/`components` (possédés par design-builder).
- **design-audit** vérifie : tout slot rempli, tout `path` existe, bijection assets-manifest↔fichiers,
  chaque `usage` pointe un screen/component réel, `alt` présent.

### G. Règle de copie servie — app-builder vers `src/public/assets/`

À la lecture de `design-manifest.assets`, pour chaque entrée :

1. **Copier** le PNG canonique `design/assets/<...>-vN.png` → `…/src/public/assets/<id>.<ext>`
   (artefact **DÉRIVÉ** ; app-builder écrit `src/`, autorisé par la frontière design/src). app-builder
   **ne modifie JAMAIS** la source `design/assets/` (binaire de référence, propriété design).
2. **Référencer** au point d'`usage` (img / background-image / `<link rel=icon>` / meta og:image…) via
   le chemin servi (`/assets/<id>.<ext>`), avec l'`alt` fourni.
3. Inscrire dans `src/.artifact.yaml` la provenance : `derived_from.image_assets: { <id>: vN, … }`
   (en plus des dépendances existantes) → `check-coherence` signale `src` à re-câbler si un asset bouge.
4. Asset manquant / slot non rempli → **STOP** (dépendance amont manquante) ; app-builder **ne
   régénère jamais** d'image (aucun appel asset-imagery).

### H. Registre — `PIPELINE-INDEX.app_artifacts.<app>.image_assets.<id>`

```yaml
app_artifacts:
  <app>:
    image_assets:
      <id>: { active_version: <N>, path: design/assets/<...>-vN.png, derived_from: { design_board: <N>, tokens: <N> } }
```

(Voir le schéma complet du registre plus haut, §« Registre de versions ».) Écrit **uniquement** par un
orchestrateur (forward bootstrap, ou `saas-change-orchestrator`). `src.derived_from.image_assets.<id>`
miroite la version servie. Bootstrap si absent.

### I. Tolérance legacy & `.gitignore`

- **Legacy / tolérance.** Asset promu **pré-existant** sans sidecar ⇒ le gate **AVERTIT** (`WARN`,
  repo-tidy back-fill). Asset **nouvellement produit** ce run sans sidecar conforme (ou désaccord
  titre↔sidecar) ⇒ **FAIL**. `design-manifest.assets[].path` absent du disque ⇒ **FAIL** si le manifest
  a changé ce run, **WARN** sinon. **Aucun asset / aucun manifest ⇒ aucun effet.**
- **`.gitignore`** : ajouter `design/assets/_candidates/` (staging gitignoré, jamais commité) — pour
  les deux topologies ajouter aussi `apps/subapps/*/design/assets/_candidates/`. **Git LFS optionnel**
  pour les PNG promus (binaires versionnés) : si activé, `*.png` sous `design/assets/` peut être suivi
  par LFS (`.gitattributes`) — non obligatoire, recommandé au-delà de quelques assets lourds.

## Design proposals (change-only, design-proposer)

`design-proposer` (DAG node 3.6, `optional`, **change-only**) propose des alternatives de design
**auditables** pour une app déjà construite, piloté par `saas-change-orchestrator` via un change-set
`type: design-proposal`.

- **Buffer** (per-app ; mono = racine) : `design/proposals/_candidates/CS-<id>/` (`alt-<k>/`,
  `index.html`, `mock-data.json`, `analysis.md`, `RATIFIED.yaml`).
- **Gate-EXEMPT** : sous le segment `_candidates/`, donc jamais contrôlé (cf. §image_asset I) —
  **aucune dépendance aux hooks**. `design_proposals` est ajouté à l'énum §C pour la
  complétude documentaire seulement (un éventuel ajout miroir dans `check-convention.sh` est
  **optionnel**).
- **Transient** : `design_proposals` n'est **pas** enregistré dans `PIPELINE-INDEX.yaml`. Seul le
  résultat **appliqué** est versionné (par design-board / design-builder / app-builder).
- **Provenance** : à la ratification, l'orchestrateur bumpe `design_board` avec
  `provenance: { ratified_proposal: CS-<id>/alt-k }` (lien **dynamique**, pas d'arête statique →
  DAG **acyclique**).
- **`.gitignore`** : ajouter `design/proposals/_candidates/` et
  `apps/subapps/*/design/proposals/_candidates/`.
