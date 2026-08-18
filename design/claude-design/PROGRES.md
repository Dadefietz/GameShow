# Chantier refonte design — état d'avancement

Source : projet Claude Design cc29109f-93eb-48ca-840f-fb60118f438c
Contrat : docs/DESIGN-HANDOFF-CONTRACT-v1.md

## Décisions figées
- tokens.css de Claude Design = source unique (design/tokens/tokens.css, v2) — FAIT
- Systeme.dc.html = design system du projet -> design/design-board.html
- S1-S4 à corriger AVANT réintégration (typo, pièces de base, options, animations)
- Overlays OBS transparents : supprimés (page stream seule)
- Aucune fonction perdue ; fonctions manquantes à coder

## Ordre de travail
1. [x] tokens.css (v2 installé, source unique)
2. [~] Systeme -> design/claude-design/Systeme.html (à promouvoir en design-board.html)
3. [x] S1-S4 : analyse -> CONFORMES, aucun correctif (validé utilisateur)
4. [ ] Surface JOUEUR (J1-J6) -> PlayApp.jsx + play.css
5. [ ] Surface ANIMATEUR (A1-A6) -> HostApp.jsx + host.css
6. [x] Surface STREAM (S1-S4) -> OverlayApp.jsx + overlay.css REFAITS (43 unit + 28 integ + 7 E2E verts, gate PASS)
7. [ ] Surface STUDIO (E1-E4) -> StudioApp.jsx + studio.css
8. [ ] Tests (migrer vers data-testid), gate, build, push

## Contraintes d'intégration à ne jamais perdre
- data-testid conservés : room-code, player-count, question-text, points-gained,
  places-delta, answers-count, reveal-value, stats-panel, stream-room-code,
  stream-question, end-screen, denied-card
- Règle absolue : aucun rang joueur en cours de partie (points + places seulement)
- Verrouillage à 0, reveal auto, classement sur canal staff
- Zéro valeur de design en dur hors tokens.css (le gate bloque)

## Analyse de conformité S1-S4 vs Système (2026-08-18)

Méthode : comparaison programmatique des tokens, pièces et animations entre
`Systeme.html` (planches 04 Pièces de base / 05 Options 5 états) et S1-S4.

| Point vérifié | Résultat |
|---|---|
| Typographie dans les cadres de scène | CONFORME — 115 usages de l'échelle stream `--fs-st-*`, 0 palier joueur à l'intérieur d'un canvas (les 9 trouvés sont dans les légendes de la planche, hors écran) |
| Trois rôles typo (display/ui/mono) | CONFORME sur S1-S4 |
| Rangée d'option (S3) | CONFORME — `--row-st`, pastille `--dot-st` mono, libellé `--fs-st-300`/`--f-ui` 500, marqueur `--mark-st` cercle vide `--c-line-strong` |
| Cascade des options | CONFORME — `om-slide-in` avec décalage 40 ms/index |
| Chrono deux tailles + seuil urgence | CONFORME — `--fs-st-chrono` / `--fs-st-chrono-urgent`, `om-urgent`, passage en braise |
| Fill de feu | CONFORME — `--g-ember` + `--c-ink-on-flame` sur la 1re marche de S4 ; absent de S3 car l'état `selected` n'existe pas sur le stream (personne n'interagit) |
| Un seul geste lumineux par écran | CONFORME — `g-dusk` seul sur S3, `g-hearth` seul sur S2/S4 |
| Pièces du système réemployées | CONFORME — champ creusé (code), capsule (lien), carte, marque animée |

### Seul écart net trouvé
- **Rayon des rangées d'option en S3** : `--r-l` (20 px) × 16, là où le Système
  dessine la pièce « option » en `--r-m` (14 px). Le Système réserve `--r-st`
  (28 px) aux blocs de scène, pas aux options.

Conclusion : je ne reproduis pas le diagnostic « pièces de base, typographie,
options et animations non respectées ». Question posée à l'utilisateur avant
toute correction, pour ne pas dégrader des écrans conformes.

## Journal d'intégration

### STREAM — terminé le 2026-08-18
- `overlay.css` réécrit intégralement : blocs BEM `.stream`, `.st-cap`, `.st-opt`,
  `.st-stats`, `.st-podium`, `.join-panel` — 100 % tokens, 0 valeur en dur.
- `OverlayApp.jsx` réécrit : S1 panneau permanent (QR/code/lien), S2 attente
  (3 variantes : vide / joueurs / entre deux manches), S3 question (live, urgent,
  révélée × 3 formes de stats), S4 podium (+ variante sans score).
- Marque animée du système (flamme qui respire, braise, escarbille).
- Overlays OBS transparents supprimés du code (décision produit).
- Repères stables ajoutés : `stream-qr`, `stream-podium`. Migration de 3 assertions
  E2E du libellé vers le testid.
- Écart mockup/contrat tranché : le stream porte `stream-question` (contrat), pas
  `question-text` (mockup) — ce dernier reste réservé à la surface joueur.

### JOUEUR — terminé le 2026-08-18
- `play.css` réécrit intégralement : ossature d'écran, pièces de base (label,
  capsule, bouton, marque animée, points qui respirent), J1 code en 5 cases +
  erreur rattachée au champ, J2 attente, J3 option 5 états / tuiles vrai-faux /
  estimation / anneau de chrono deux tailles, J4 gain + places + détail, J5
  podium + récap, J6 loader. 100 % tokens.
- `PlayApp.jsx` réécrit : toutes les fonctions préservées (useCountUp,
  drawScoreCard mis à la palette, historyAnswer, deriveYou, roomClosed/fatal,
  share/replay/leave, reset de manche).
- Code de salon : saisie en 5 cases avec avance auto, retour arrière, collage.
  Fonction NOUVELLE (le contrat la demandait, l'ancien champ unique ne l'avait pas).
- `BrandLoader` refait (J6) + `brand-loader.css` : 3 temps (attente, réassurance
  à 4 s, sortie de secours à 10 s avec bouton Recharger).
- Repères stables ajoutés : join-form, join-code, join-pseudo, join-submit,
  join-error, answer-zone, answer-option, answer-submit.
- Helper de test `joinAsPlayer` : le parcours joueur est factorisé, les specs ne
  dépendent plus des libellés.
- RÈGLE TENUE : aucun rang en cours de partie (assertion E2E explicite).

### ANIMATEUR — terminé le 2026-08-18
- `host.css` réécrit : carte centrée (A1/A2/A3), grille 3 colonnes du lobby (A4),
  bandeau d'antenne + scène + rail + barre d'action (A5), podium 3 marches (A6),
  et les transverses (menu de sortie 2 temps, bandeau d'alerte, reconnexion, toast).
- CONTREPOINT PRUNE : `.private` porte la couleur ET la hachure `--tex-secret`
  (second signal non coloré). À la révélation, `.private--public` retire la
  hachure — le panneau devient public, mention « Affichée sur le stream ».
- `HostApp.jsx` réécrit : toutes les fonctions préservées (magic link avec
  shouldCreateUser:false, otpErrorMessage, cloisonnement par compte, salon
  fermé/expiré, ouverture explicite, reconnexion à 1,2 s, toast, bonus/malus,
  séance shuffle + sélection, changement de module).
- Fonctions NOUVELLES codées : confirmation en 2 temps avec conséquence chiffrée
  et réarmement à 4 s ; bandeau d'erreur avec les trois issues nommées ; barre de
  progression d'épreuve ; compteur « n / total réponses » ; bonus/malus désarmé
  pendant une coupure ; lancement en UN aller-retour (menu direct).
- Repères ajoutés : final-rank. Assertions E2E rendues déterministes (le rang
  final n'existe que si le joueur a marqué — les deux issues sont couvertes).
