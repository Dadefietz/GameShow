# Plan d'action UI/UX — benchmark Mobbin × Project Game Show
### Bonnes pratiques modernes des funnels et workflows, collisionnées avec notre site
*Recherche Mobbin (flows & screens réels) · 28 juillet 2026 — **STATUT : les 17 actions sont implémentées et déployées** (commit « Sprints 1-4 »)*

---

## Méthode

J'ai interrogé Mobbin sur nos quatre parcours critiques — **rejoindre une partie**, **boucle de question live**, **fin de partie / partage**, **création de quiz** — plus le **funnel d'accueil double audience**. Les références retenues sont des flows réels d'apps en production : [Quizlet — Enter a game code](https://mobbin.com/flows/91657b58-9419-437f-b1d4-cc06c60140b7), [NBA Play — Playing a quiz game](https://mobbin.com/flows/27b1169b-37ba-4886-a361-13b6ec6ef923), [Nibble — Completing a trivia quiz](https://mobbin.com/flows/a45743e4-c7fc-49ca-ada6-d69713c36cac), [Best Buy — Playing a quiz game](https://mobbin.com/flows/a18277fb-d97a-4ebc-8b3b-1fd0ee0dde16), [Contra — dual-audience footer](https://mobbin.com/sites/sections/0e71cc83-e290-499f-8060-cdae5f763d98), [Partiful — Invite guests](https://mobbin.com/sites/sections/c92bb248-7eb7-4856-90b2-128b4f413f84), [Podia — Adding a quiz](https://mobbin.com/flows/65eafd1d-8214-4f12-8273-24d69486d28a), [Circle — Adding questions](https://mobbin.com/flows/327fbad0-5e87-48c9-b7cf-fb0f5bcce035).

Chaque pattern est ensuite **collisionné** avec notre implémentation actuelle (que je connais écran par écran après les trois audits) : ✅ déjà acquis · ⚠️ partiel · ❌ écart. Le plan final ne retient que les écarts à vrai impact, priorisés par ratio impact/effort (S < 1 h · M ≈ une demi-journée · L ≈ une journée+).

---

## 1 · Funnel « rejoindre une partie » (joueur)

**Ce que font les meilleurs.** Quizlet valide le code **en ligne, sous le champ** (« We could not find a game for that code » en rouge, champ borduré rouge, bouton **désactivé tant que le code est invalide/vide**) ; une microcopy de réassurance (« Do not enter any personal information ») désamorce la peur de s'inscrire ; le scan QR et la saisie manuelle sont **deux chemins équivalents et permutables**.

**Collision avec notre site.**
- ✅ QR → arrivée avec code prérempli ; messages d'erreur inline (`room-not-found`, `pseudo-taken`…) ; clavier alpha + majuscules ; « Aucun compte, aucune installation » (notre équivalent de la réassurance Quizlet).
- ❌ **Le bouton « Rejoindre » est actif même à vide** — l'erreur n'arrive qu'après soumission. Quizlet désactive tant que le champ n'est pas plausible (5 caractères chez nous).
- ❌ **Pas de validation à la frappe** : un code de 3 caractères part au serveur au lieu d'être bloqué localement.
- ⚠️ L'erreur s'affiche en bloc générique, pas rattachée visuellement au champ fautif (code vs pseudo).

**Actions.**
| # | Action | Effort | Impact |
|---|--------|--------|--------|
| A1 | Désactiver « Rejoindre » tant que code ≠ 5 car. ou pseudo vide ; état visuel disabled | S | Fort — supprime la 1re classe d'erreurs |
| A2 | Rattacher l'erreur au champ : bordure danger + message sous le champ concerné | S | Moyen |

---

## 2 · Boucle de question live (joueur)

**Ce que font les meilleurs.** NBA Play affiche une **progression par question** (« 1 / 5 » + barre) ; Nibble met **le score cumulé en permanence dans l'en-tête** avec une barre segmentée (un segment par question) ; Best Buy **verrouille la réponse choisie en vert avec ✓ et lance des confettis** à la bonne réponse — le feedback est **sur l'option elle-même**, pas dans un texte à côté ; NBA propose « **Show answers** » en fin de partie pour revoir les bonnes réponses.

**Collision avec notre site.**
- ✅ Chrono géant + barre de temps réelle, « Question N » + score dans l'en-tête, état `answer--selected`, révélation dramatisée (win/lose, +N points animés, bonne réponse affichée en cas d'erreur).
- ⚠️ **Le feedback post-tap est un texte** (« Réponse envoyée ») : l'option choisie reste visuellement identique aux autres (juste `--selected`). Le pattern moderne : l'option choisie se fige en surbrillance franche + ✓, les autres s'estompent — c'est aussi la réponse au « re-tap sans retour » relevé en audit (P8).
- ❌ **Aucune célébration** à la bonne réponse (confetti/éclat). Notre écran win a la tonalité verte mais aucun moment de joie — c'est LE différenciateur émotionnel des références.
- ❌ **Pas de récap des réponses** en fin de partie (« Revoir les questions ») : le joueur qui a raté ne peut pas apprendre.
- ⚠️ Progression « Question 1 » sans total la plupart du temps (le total serveur ne reflète pas un objectif de partie — déjà relevé, P6).

**Actions.**
| # | Action | Effort | Impact |
|---|--------|--------|--------|
| B1 | Feedback sur l'option : choisie = surbrillance + ✓, autres estompées, bouton d'état « Envoyé ✓ » (remplace le texte seul) | M | Fort — clôt P8 avec le pattern de référence |
| B2 | Célébration bonne réponse : burst de confettis/étincelles CSS sur l'écran score win (léger, `prefers-reduced-motion` respecté) | M | Fort — émotion = rétention |
| B3 | Récap de fin : « Revoir les questions » sur l'écran de fin (historique room.history déjà stocké serveur — l'exposer) | L | Moyen-fort |
| B4 | Progression honnête : masquer le total tant qu'il n'est pas défini par l'animateur (clôt P6) | S | Moyen |

---

## 3 · Fin de partie, partage & rétention (joueur)

**Ce que font les meilleurs.** NBA : carte de score + **Share** + **More games** — la fin est une bifurcation vers le replay, jamais un cul-de-sac. Best Buy : trophée + « Come back soon to keep playing » (rendez-vous donné). Partiful : l'invitation est **multi-plateforme avec aperçu visuel** de ce que reçoit l'invité.

**Collision avec notre site.**
- ✅ « Partager mon score » (navigator.share + repli presse-papiers) et « Rejouer » — on est déjà au standard NBA.
- ⚠️ Le partage est **texte brut**. Partiful/NBA partagent un objet visuel (carte de score). Une carte de partage générée (canvas → image) est le cran au-dessus.
- ❌ Pas de **rendez-vous** : après « Rejouer », le joueur retombe sur l'écran code sans rien qui le rattache au salon/streamer (« Reviens quand [streamer] relance une partie »).

**Actions.**
| # | Action | Effort | Impact |
|---|--------|--------|--------|
| C1 | Carte de score partageable (canvas 1080×1920 : rang, pts, pseudo, marque) jointe au share | L | Moyen-fort — boucle virale |
| C2 | Écran de fin : rappel du code du salon + « Reste ici, l'animateur peut relancer » (le socket reste connecté → nouveau module = retour auto en jeu, déjà fonctionnel côté serveur) | S | Moyen |

---

## 4 · Funnel d'accueil double audience

**Ce que font les meilleurs.** Contra tranche le dilemme double audience avec **deux cartes côte à côte, égales, à CTA distincts** (« Start your independent journey » / « Hire top independents ») — pas un lien secondaire sous le formulaire.

**Collision avec notre site.**
- ✅ P1 livré : lien « Rejoindre une partie » sous la carte de connexion. Fonctionnel, mais **hiérarchiquement secondaire** : le spectateur (audience majoritaire) reste un second citoyen visuel.
- ❌ Pas d'**aperçu visuel du produit** (vignette d'un overlay/podium) sur l'accueil — relevé en audit (preuve sociale), confirmé par le benchmark : tous les références montrent le produit.

**Actions.**
| # | Action | Effort | Impact |
|---|--------|--------|--------|
| D1 | Accueil en double porte façon Contra : deux cartes « Je suis animateur » (→ connexion) / « Je viens jouer » (→ /play), la value prop au-dessus | M | Fort — le funnel spectateur devient premier |
| D2 | Vignette produit (capture stylisée du podium/overlay) dans la colonne value prop | M | Moyen |

---

## 5 · Studio (création de quiz)

**Ce que font les meilleurs.** Podia marque la bonne réponse **par un toggle Right/Wrong sur chaque option** (pas un menu séparé), et valide : « *You must have at least one right answer* » ; Circle ouvre une **modale focalisée** « Add question » avec le type en toggle en tête, radios de bonne réponse inline, et gère **Draft/Published** ; les deux ont un **empty state** actif (« Start your quiz by adding questions » + bouton).

**Collision avec notre site.**
- ✅ Édition inline par question, types homogènes, feedback de sauvegarde (saved/local/error), bandeau non-connecté avec CTA (P2 livré), empty state texte (« Aucune question. Ajoutez-en une… »).
- ❌ **La bonne réponse est un `<select>` séparé** sous les options : deux zones à corréler mentalement. Le pattern de référence : **radio directement sur chaque option** (« ◉ Mercure ○ Vénus… »).
- ❌ **Aucune validation à l'enregistrement** : on peut sauver un quiz avec options vides, énoncé vide, pas de bonne réponse marquée sur un vote… Le serveur filtre (`isUsable`) mais **silencieusement** : Sofia sauve un module qui ne sortira jamais en jeu, sans le savoir.
- ⚠️ Pas de notion brouillon/publié ni d'autosave — acceptable à notre échelle, mais la validation (ci-dessus) est le vrai manque.

**Actions.**
| # | Action | Effort | Impact |
|---|--------|--------|--------|
| E1 | Bonne réponse en radio inline sur chaque option (quiz), remplace le select séparé | M | Fort — moins d'erreurs de saisie |
| E2 | Validation à l'enregistrement : énoncé non vide, ≥ 2 options non vides, bonne réponse définie ; erreurs listées sous le bouton, question fautive surlignée | M | Fort — plus de modules « fantômes » injouables |
| E3 | Empty state actif : le message + bouton « Ajouter une question » directement dans la zone vide | S | Faible-moyen |

---

## 6 · Régie animateur (écarts restants des audits, confirmés par le benchmark)

Les références live (Kahoot-like) distinguent toujours **l'état « réponses ouvertes » de l'état « résultats »** — notre chip reste « En direct » pendant les résultats (P5), et nos deux verbes d'avancement (« Passer à la suivante » / « Module suivant ») cohabitent (P7).

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| F1 | Chip d'état à 3 valeurs : En direct / Résultats / En pause (clôt P5) | S | Moyen |
| F2 | Un seul verbe d'avancement partout : « Question suivante » (clôt P7) | S | Faible-moyen |
| F3 | Top 5 : neutraliser le surlignage n°1 tant que tous les scores sont à 0 (clôt P10) | S | Faible |

---

## Plan d'exécution proposé

**Sprint 1 — la boucle de jeu au standard (impact max)** : B1 (feedback option) → B2 (célébration) → A1/A2 (validation join) → F1/F2/F3 (finitions régie). *Tout S/M, une session.*

**Sprint 2 — le funnel d'acquisition** : D1 (double porte Contra) → D2 (vignette produit) → C2 (rendez-vous fin de partie) → B4 (progression honnête).

**Sprint 3 — le Studio fiable** : E2 (validation, prioritaire) → E1 (radio inline) → E3 (empty state).

**Sprint 4 — la boucle virale (optionnel)** : C1 (carte de score partageable) → B3 (récap des réponses).

Chaque sprint est livrable indépendamment ; l'ordre interne des sprints maximise l'impact joueur d'abord (c'est lui qui fait la réputation du jeu en live), puis l'acquisition, puis la création.

---

## Sources Mobbin

- [Quizlet — Enter a game code (flow)](https://mobbin.com/flows/91657b58-9419-437f-b1d4-cc06c60140b7) — validation inline, bouton désactivé, réassurance, QR ↔ code
- [NBA Play — Playing a quiz game (flow)](https://mobbin.com/flows/27b1169b-37ba-4886-a361-13b6ec6ef923) — progression 1/N, Share + More games, Show answers
- [Nibble — Completing a trivia quiz (flow)](https://mobbin.com/flows/a45743e4-c7fc-49ca-ada6-d69713c36cac) — score en en-tête, barre segmentée, timer scrubber
- [Best Buy — Playing a quiz game (flow)](https://mobbin.com/flows/a18277fb-d97a-4ebc-8b3b-1fd0ee0dde16) — verrouillage vert + confettis, trophée de complétion
- [Contra — dual-audience cards (section)](https://mobbin.com/sites/sections/0e71cc83-e290-499f-8060-cdae5f763d98) — double porte d'entrée égalitaire
- [Partiful — Invite guests on any platform (section)](https://mobbin.com/sites/sections/c92bb248-7eb7-4856-90b2-128b4f413f84) — partage multi-canal avec aperçu
- [Podia — Adding a quiz (flow)](https://mobbin.com/flows/65eafd1d-8214-4f12-8273-24d69486d28a) — Right/Wrong par option, validation « at least one right answer »
- [Circle — Adding questions (flow)](https://mobbin.com/flows/327fbad0-5e87-48c9-b7cf-fb0f5bcce035) — modale focalisée, radio inline, Draft/Published, empty state actif
