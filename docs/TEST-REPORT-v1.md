---
artifact_type: test_report
app: root
version: 1
change_set: none
produced_by: tester
created_at: 2026-08-18
created_by: tester
status: validated
---

# TEST-REPORT v1 — Project Game Show

**Date :** 2026-08-18 · **Stack testé :** Node/Fastify 5 + Socket.IO (serveur autoritaire) + React/Vite 8 · **src v1.1** (après retours produit du 2026-08-18)

## Résumé

| Suite | Outil | Tests | Résultat | Durée |
|---|---|---|---|---|
| Unitaires (logique serveur) | Vitest | 33 | 33 PASS | 0,1 s |
| Intégration (boucle de jeu Socket.IO réelle) | node + socket.io-client | 28 checks | 28 PASS | ~14 s |
| E2E navigateur (3 surfaces, multi-contextes) | Playwright/Chromium | 5 | 5 PASS | 4,5 s |
| **Total** | | **66** | **66 PASS — 0 échec** | ~19 s |

**Couverture (logique serveur pure — modules, rooms, engine, store) :** 83,5 % lignes ·
80,8 % fonctions · 67,4 % branches (seuils 70/70/60 atteints). `index.js`/`auth.js` sont
exercés par l'intégration et les E2E (serveur réel démarré).

## Couverture des MUST (USER-NEEDS v1)

| MUST | Vérifié par | Statut |
|---|---|---|
| M1 Salon + code + QR | game-flow.spec | PASS |
| M2 Join code+pseudo sans compte | player-join.spec + game-flow | PASS |
| M3 Join en cours de partie | game-flow.spec (retardataire pendant une question) | PASS |
| M4 Modules libres, ordre libre | game-flow.spec (quiz puis vrai/faux enchaînés) | PASS |
| M5 4 modules jouables | game-flow (quiz, VF) + unit/intégration (estimation, vote) | PASS |
| M6 Points + classement recalculé | engine.test + game-flow | PASS |
| M7 Contrôles animateur | game-flow (révéler, passer, terminer) | PASS* |
| M8 Overlays OBS (page stream) | stream.spec | PASS* |
| M9 Temps réel joueurs + stream | intégration + stream.spec | PASS |
| M10 Dashboard animateur | game-flow (compteurs, chrono, top 5) | PASS |
| M11 Manette mobile minimaliste | game-flow + player-join | PASS |

\* M7 : « mettre en pause » retiré du périmètre (retours produit 2026-08-18, R9).
\* M8 : les 3 overlays historiques sont remplacés par la page stream unique (R8).

Les invariants des retours produit sont aussi couverts : révélation automatique à 0,
verrouillage serveur strict, rang jamais visible en cours de partie (assertion explicite
`"Ton rang"` absent), bonus Éclair/série, malus, stats de répartition sur le stream.

## Bugs trouvés et corrigés

Aucun bug applicatif découvert pendant cette phase. 1 correction de test (cycle 1) :
sélecteur Playwright ambigu « Vrai / Faux » (strict mode, collision avec le panneau
Séance) → `exact: true`. Classification : `test_fragile`. Aucun fichier `src/` modifié.

## Known failures

Aucun.

## Commandes

```
npm run test              # unitaires
npm run test:coverage     # unitaires + couverture
npm run test:integration  # boucle de jeu complète (serveur auto-géré)
npm run test:e2e          # Playwright (build + serveur via webServer)
npm run test:all          # tout
```

**Prochaine étape : deployer (Phase 8)** — suivre la checklist pré-déploiement de SECURITY-AUDIT-v1.md.
