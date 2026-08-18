# Graph Report - theo  (2026-08-17)

## Corpus Check
- 10 files · ~227,973 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 177 nodes · 167 edges · 19 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- TECH-SPEC — Project Game Show (v1.0)
- 5. Fiches de référence
- REPO-CONVENTION.md — Repository contract
- USER-NEEDS — Project Game Show (v1)
- Section 3 — Sécurité et contrôle d'accès
- Codification & intégration `image_asset` (images de marque — produit par asset-imagery)
- DESIGN BOARD — Project Game Show
- DESIGN BOARD — Project Game Show (v2 — direction « feu-de-camp »)
- DESIGN BOARD — Project Game Show (v3 — « feu-de-camp convivial »)
- DESIGN-AUDIT — Project Game Show — v1
- Section 5 — Design system
- AGENTS.md
- Section 2 — Architecture système
- Section 9 — Déploiement et opérations
- Codification — titre (primaire) + tag (backstop)
- Section 4 — Modèle de données
- Section 8 — Données personnelles et conformité RGPD
- PROJECT — Project Game Show
- Section 7 — Liens et flux de données entre surfaces

## God Nodes (most connected - your core abstractions)
1. `REPO-CONVENTION.md — Repository contract` - 15 edges
2. `TECH-SPEC — Project Game Show (v1.0)` - 14 edges
3. `USER-NEEDS — Project Game Show (v1)` - 12 edges
4. `Codification & intégration `image_asset` (images de marque — produit par asset-imagery)` - 10 edges
5. `Section 3 — Sécurité et contrôle d'accès` - 10 edges
6. `DESIGN BOARD — Project Game Show` - 8 edges
7. `DESIGN BOARD — Project Game Show (v2 — direction « feu-de-camp »)` - 8 edges
8. `DESIGN BOARD — Project Game Show (v3 — « feu-de-camp convivial »)` - 8 edges
9. `Section 5 — Design system` - 8 edges
10. `Codification — titre (primaire) + tag (backstop)` - 7 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities (19 total, 0 thin omitted)

### Community 0 - "TECH-SPEC — Project Game Show (v1.0)"
Cohesion: 0.10
Nodes (19): 10.1 Nommage, 10.2 Structure du code, 10.3 Sécurité (règles dures), 10.4 Zéro emoji, 1.1 Proposition de valeur, 1.2 Périmètre v1 et roadmap, 1.3 Contraintes non-fonctionnelles, 1.4 Hors périmètre v1 (+11 more)

### Community 1 - "5. Fiches de référence"
Cohesion: 0.12
Nodes (15): 1. Synthèse du domaine, 2. Conventions techniques agrégées, 3. Conventions d'expérience, 4. Opportunités de différenciation, 5. Fiches de référence, 6. Table des sources, Anti-patterns à éviter (≥ 1), DESIGN-DOMAIN-EXPLORE — Jeu télévisé interactif en livestream (téléphone-manette) (+7 more)

### Community 2 - "REPO-CONVENTION.md — Repository contract"
Cohesion: 0.14
Nodes (13): App-scoping (un seul niveau — plafonné), Change-sets & CHANGELOG, DAG — pipeline-dag.yaml, Design proposals (change-only, design-proposer), Folder layout, Hard rules, Invariant de cohérence aval, Nothing is optional (+5 more)

### Community 3 - "USER-NEEDS — Project Game Show (v1)"
Cohesion: 0.15
Nodes (12): Contexte, Décisions clés, Le feeling design, Le marché (benchmark sourcé), Le MVP, Le problème, Les besoins (MoSCoW), Les contraintes (+4 more)

### Community 4 - "Section 3 — Sécurité et contrôle d'accès"
Cohesion: 0.20
Nodes (10): 3.1 Modèle de menace, 3.2 Authentification, 3.3 Autorisation temps réel (Socket.IO), 3.4 Contrôle d'accès base de données (Supabase RLS), 3.5 Fonctions helper / index, 3.6 Clés et secrets, 3.7 Headers de sécurité, 3.8 Validation des entrées (+2 more)

### Community 5 - "Codification & intégration `image_asset` (images de marque — produit par asset-imagery)"
Cohesion: 0.20
Nodes (10): A. Layout `design/assets/` (PER-APP, un seul niveau), B. Grammaire de titre (codification primaire), C. Sidecar `.asset.yaml` (tag backstop — schéma exact), Codification & intégration `image_asset` (images de marque — produit par asset-imagery), D. `.spec.json` (re-génération déterministe), E. `assets-manifest.yaml` (index per-app des assets promus), F. Carte d'usage — section `assets:` du `design-manifest`, G. Règle de copie servie — app-builder vers `src/public/assets/` (+2 more)

### Community 6 - "DESIGN BOARD — Project Game Show"
Cohesion: 0.22
Nodes (8): 1. Intent & audience, 2. Vibe & signature, 3. Palette OKLCH, 4. Typographie, 5. Motion, 6. Accessibilité, 7. Seeds & provenance, DESIGN BOARD — Project Game Show

### Community 7 - "DESIGN BOARD — Project Game Show (v2 — direction « feu-de-camp »)"
Cohesion: 0.22
Nodes (8): 1. Intent & audience, 2. Vibe & signature, 3. Palette OKLCH, 4. Typographie, 5. Motion, 6. Accessibilité, 7. Seeds & provenance, DESIGN BOARD — Project Game Show (v2 — direction « feu-de-camp »)

### Community 8 - "DESIGN BOARD — Project Game Show (v3 — « feu-de-camp convivial »)"
Cohesion: 0.22
Nodes (8): 1. Intent & audience, 2. Vibe & signature, 3. Palette OKLCH, 4. Typographie, 5. Motion, 6. Accessibilité, 7. Seeds & provenance, DESIGN BOARD — Project Game Show (v3 — « feu-de-camp convivial »)

### Community 9 - "DESIGN-AUDIT — Project Game Show — v1"
Cohesion: 0.25
Nodes (7): Audit des assets (image_asset), Coverage, DESIGN-AUDIT — Project Game Show — v1, Plan de remédiation, Provenance, Verdict, Violations

### Community 10 - "Section 5 — Design system"
Cohesion: 0.25
Nodes (8): 5.1 Tokens CSS partagés, 5.2 Couleurs par module / contexte, 5.3 Typographie, 5.4 Composants partagés, 5.5 Iconographie, 5.6 Motion, 5.7 Responsive, Section 5 — Design system

### Community 11 - "AGENTS.md"
Cohesion: 0.29
Nodes (6): AGENTS.md — project-game-show, artifact_type: agents | app: root | version: 1 | change_set: forward | produced_by: tech-spec-writer, Créé par tech-spec-writer. Enrichi par design-benchmark, design-board, design-builder, app-builder, tester, security-tester., Miroir des regles dures de REPO-CONVENTION.md — toujours en contexte, Renseigné par design-board (Phase 3, board v3 = feu-de-camp convivial). Le QUOI/POURQUOI visuel., Renseigné par design-builder. Source de vérité des chemins design (mono-app, à plat).

### Community 12 - "Section 2 — Architecture système"
Cohesion: 0.29
Nodes (7): 2.1 Vue macro, 2.2 Front-end, 2.3 Serveur de jeu (Node.js + Socket.IO), 2.4 Hébergement et réseau, 2.5 Stratégie offline / réseau, 2.6 Flux d'authentification, Section 2 — Architecture système

### Community 13 - "Section 9 — Déploiement et opérations"
Cohesion: 0.29
Nodes (7): 9.1 CI/CD, 9.2 Environnements, 9.3 Variables d'environnement, 9.4 Procédure de déploiement (manuelle, serveur de jeu), 9.5 Monitoring, 9.6 Montée en charge (au-delà de 500 joueurs), Section 9 — Déploiement et opérations

### Community 14 - "Codification — titre (primaire) + tag (backstop)"
Cohesion: 0.29
Nodes (7): A. Grammaire canonique des TITRES (codification primaire), B. Schéma du TAG minimal (backstop) — par format, C. enum `artifact_type` (valeurs autorisées), Codification — titre (primaire) + tag (backstop), D. Règle d'accord (gate) — titre ↔ tag ↔ registre, E. Bijection mockups ↔ manifest (par app), F. Tolérance legacy (Class B) & repo-tidy

### Community 15 - "Section 4 — Modèle de données"
Cohesion: 0.33
Nodes (6): 4.1 Données durables (Supabase Postgres), 4.2 État de partie éphémère (en mémoire serveur — PAS en base), 4.3 Index obligatoires, 4.4 Migrations, 4.5 Données de référence (seeds), Section 4 — Modèle de données

### Community 16 - "Section 8 — Données personnelles et conformité RGPD"
Cohesion: 0.33
Nodes (6): 8.1 Localisation et souveraineté, 8.2 Minimisation (atout du modèle), 8.3 Droits (animateur), 8.4 Données sensibles / mentions, 8.5 Backup, Section 8 — Données personnelles et conformité RGPD

### Community 17 - "PROJECT — Project Game Show"
Cohesion: 0.33
Nodes (5): Livrables actifs, Notes & décisions projet, Prochaine étape, PROJECT — Project Game Show, État du pipeline

### Community 18 - "Section 7 — Liens et flux de données entre surfaces"
Cohesion: 0.40
Nodes (5): 7.1 Source de vérité unique, 7.2 Catalogue d'events (contrat temps réel), 7.3 Règles d'écriture, 7.4 Gestion du délai de diffusion (stream delay), Section 7 — Liens et flux de données entre surfaces

## Knowledge Gaps
- **144 isolated node(s):** `AGENTS.md — project-game-show`, `artifact_type: agents | app: root | version: 1 | change_set: forward | produced_by: tech-spec-writer`, `Créé par tech-spec-writer. Enrichi par design-benchmark, design-board, design-builder, app-builder, tester, security-tester.`, `Renseigné par design-board (Phase 3, board v3 = feu-de-camp convivial). Le QUOI/POURQUOI visuel.`, `Renseigné par design-builder. Source de vérité des chemins design (mono-app, à plat).` (+139 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TECH-SPEC — Project Game Show (v1.0)` connect `TECH-SPEC — Project Game Show (v1.0)` to `Section 3 — Sécurité et contrôle d'accès`, `Section 5 — Design system`, `Section 2 — Architecture système`, `Section 9 — Déploiement et opérations`, `Section 4 — Modèle de données`, `Section 8 — Données personnelles et conformité RGPD`, `Section 7 — Liens et flux de données entre surfaces`?**
  _High betweenness centrality (0.136) - this node is a cross-community bridge._
- **Why does `Section 3 — Sécurité et contrôle d'accès` connect `Section 3 — Sécurité et contrôle d'accès` to `TECH-SPEC — Project Game Show (v1.0)`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Why does `Section 5 — Design system` connect `Section 5 — Design system` to `TECH-SPEC — Project Game Show (v1.0)`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **What connects `AGENTS.md — project-game-show`, `artifact_type: agents | app: root | version: 1 | change_set: forward | produced_by: tech-spec-writer`, `Créé par tech-spec-writer. Enrichi par design-benchmark, design-board, design-builder, app-builder, tester, security-tester.` to the rest of the system?**
  _144 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `TECH-SPEC — Project Game Show (v1.0)` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `5. Fiches de référence` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `REPO-CONVENTION.md — Repository contract` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._