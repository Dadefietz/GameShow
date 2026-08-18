# Contrat d'intégration — Project Game Show

> **Ce document n'est pas un design.** C'est l'inventaire exhaustif de ce que chaque écran
> **reçoit**, **affiche** et **émet**. Le langage visuel est entièrement libre : couleurs,
> typographie, formes, motion, mise en page — tout est à réinventer. Ce qui est figé, c'est
> le comportement : aucun élément listé ici ne peut disparaître, et aucun écran ne peut
> apparaître qui ne soit listé ici.
>
> Généré depuis le code de production le 2026-08-18 (branche `main`).

---

## 1. Architecture — 4 surfaces

| Surface | Routes | Support cible | Nature |
|---|---|---|---|
| **Joueur** | `/` et `/play` | Mobile portrait (manette) | Interactif, une action à la fois |
| **Animateur** | `/host` | Desktop large (poste de pilotage) | Dense, temps réel |
| **Stream** | `/overlay` | Scène 16:9 diffusée en source navigateur OBS | Lecture seule, lisible de loin |
| **Studio** | `/studio` | Desktop | Éditeur de questionnaires (CRUD) |

**Décision produit du 2026-08-18 :** les trois overlays OBS transparents historiques
(`/overlay/question`, `/overlay/leaderboard`, `/overlay/podium`) sont **abandonnés**. La
page stream les remplace définitivement : c'est la seule source à ajouter dans OBS.

**Le serveur est autoritaire.** Le client n'envoie jamais de score : il envoie une réponse,
le serveur calcule et renvoie le résultat.

---

## 2. Contrat temps réel (Socket.IO)

### 2.1 Reçu du serveur (à afficher)

| Événement | Charge utile | Qui le reçoit |
|---|---|---|
| `room:state` | `{ code, state, playerCount, progression:{index,total} }` | tous |
| `module:started` | `{ type, questionId, text, options?, durationMs, deadline, meta:{type,name,icon,color}, index, total, answered }` | tous |
| `module:tick` | `{ timeLeft (s), answers (nb) }` — 1×/seconde | tous |
| `module:answersCount` | `{ count }` | tous |
| `module:closed` | `{ answers }` | tous |
| `module:reveal` | `{ type, …bonne réponse…, stats }` (détail §2.3) | tous |
| `module:distribution` | `{ kind:'options'\|'boolean'\|'numeric', counts[], total, min?, max?, avg? }` | **animateur seul** |
| `leaderboard:update` | `{ leaderboard:[{id,pseudo,score,rank}] }` | **animateur + stream seuls** |
| `play:you` | en jeu : `{ score, delta, base, bonus, malus, streak, placesDelta }` — fin : `{ rank, score, delta:0, final:true }` | **le joueur concerné seul** |
| `play:accepted` | `{ ok:true }` ou `{ ok:false, reason:'closed'\|'already'\|'unknown-player'\|'invalid' }` | joueur |
| `game:ended` | `{ podium[], leaderboard[], history[] }` | tous |
| `player:joined` | `{ count }` | tous |
| `room:closed` | — (salon fermé par l'animateur) | tous |
| `host:error` | `{ code:'no-question'\|'start-failed' }` | animateur |

### 2.2 Envoyé au serveur (actions de l'interface)

| Action | Charge utile | Déclencheur dans l'UI |
|---|---|---|
| `play:answer` | `{ value }` | le joueur choisit/soumet sa réponse |
| `host:startModule` | `{ moduleType }` | « Lancer la partie », « Question suivante », « Changer de module » |
| `host:reveal` | — | « Révéler maintenant » |
| `host:adjustScore` | `{ playerId, delta }` | boutons +100 / −100 du panneau Bonus-Malus |
| `host:sessionConfig` | `{ shuffle:bool, selected:{moduleType:[questionIds]} }` | panneau « Séance » |
| `host:getBank` | `{ moduleType }` + callback → `[{id,text}]` | dépliage d'un module dans « Séance » |
| `host:endGame` | — | « Terminer la partie » (confirmation en 2 temps) |
| `host:closeRoom` | — | « Fermer le salon » (confirmation en 2 temps) |

### 2.3 Forme de `module:reveal` selon le module

| Module | Bonne réponse | `stats` (répartition, affichée animateur + stream) |
|---|---|---|
| `quiz` | `correctIndex` + `options[]` | `{kind:'options', options[], tally[], total}` |
| `true_false` | `correct` (booléen) | `{kind:'options', options:['Vrai','Faux'], tally[], total}` |
| `estimation` | `target` (nombre) | `{kind:'numeric', total, avg, median, closest, target}` |
| `vote` | *aucune* — l'option en tête | `{kind:'options', options[], tally[], total}` |

### 2.4 Valeur attendue de `play:answer` selon le module

| Module | Type envoyé | Contrainte |
|---|---|---|
| `quiz` | entier | index d'option valide |
| `true_false` | booléen | `true` / `false` |
| `estimation` | nombre | fini, positif ou négatif |
| `vote` | entier | index d'option valide |

---

## 3. Contrat REST

| Route | Retour | Erreurs à afficher |
|---|---|---|
| `POST /api/rooms` | `{ code, reused, hostToken, overlayToken }` | `403 not-host` → écran « accès réservé » |
| `POST /api/rooms/:code/join` | `{ playerId, pseudo, playerToken, state }` | `404 room-not-found`, `409 pseudo-taken`, `422 invalid-pseudo`, `429 room-full`, `400 bad-request` |
| `GET / PUT /api/banks` | banques de questions par module | `403 not-host`, `400 bad-banks` |
| `GET /api/health`, `GET /api/config` | technique | — |

---

## 4. États du salon

`waiting` (salle d'attente) → `playing` (question en cours) → `results` (manche révélée)
→ retour `playing` … → `ended` (partie terminée).
Il n'existe **pas** d'état « pause » : la fonction a été retirée du produit.

---

## 5. Inventaire écran par écran

> Légende : **[IN]** = donnée reçue à afficher · **[OUT]** = action émise · **[VAR]** = variante
> ou état · **[LIM]** = cas limite à couvrir visuellement.

### SURFACE JOUEUR — mobile portrait

#### J1. Rejoindre (`/`, `/play`) — écran d'entrée du jeu
- **[IN]** code pré-rempli depuis l'URL (`?code=ABCDE`), message d'information contextuel
- Champs : **code du salon** (5 caractères, non ambigus, saisie en majuscules) et **pseudo** (≤ 20 car.)
- **[OUT]** soumission du formulaire → tentative de connexion
- **[VAR]** repos · saisie en cours · envoi en cours (bouton occupé) · erreur
- **[LIM]** chaque erreur est **rattachée à son champ** : `room-not-found`/`room-full` → champ code ; `invalid-pseudo`/`pseudo-taken` → champ pseudo ; échec réseau → message général
- **[LIM]** message d'accueil après éjection : « L'animateur a fermé le salon » / « Ce salon n'existe plus »
- Argument de réassurance à conserver : aucun compte, aucune installation

#### J2. Salle d'attente
- **[IN]** pseudo du joueur, code du salon, nombre de joueurs connectés (évolue en direct)
- **[VAR]** attente du lancement (animation d'attente)
- Bouton **Quitter** présent

#### J3. Question — 4 variantes de module
- **[IN]** énoncé, numéro de question (`index` / `total`), temps restant, score courant, options selon le module
- **[OUT]** `play:answer`
- **[VAR par module]**
  - `quiz` : 2 à 6 options en liste, chacune avec une lettre-repère (A, B, C…)
  - `true_false` : deux choix opposés
  - `estimation` : champ numérique + bouton d'envoi
  - `vote` : options en liste, sans notion de bonne réponse
- **[VAR d'état]** non répondu · **répondu** (options figées, celle choisie mise en avant, confirmation « Réponse envoyée ») · **temps écoulé** (tout figé, mention « Temps écoulé »)
- **[LIM]** le chrono doit être lisible d'un coup d'œil et **s'intensifier sous 5 secondes**
- **[LIM]** pas de bouton Quitter ici : l'écran reste focalisé sur la réponse

#### J4. Résultat de manche
- **[IN]** `play:you` : points gagnés (`delta`), détail (`base`, `bonus`, `malus`, `streak`), **places gagnées ou perdues** (`placesDelta`) ; `module:reveal` : la bonne réponse
- **[VAR]** bonne réponse (célébration) · mauvaise réponse · vote enregistré (ni bon ni mauvais)
- **[LIM] RÈGLE ABSOLUE : le rang du joueur n'est JAMAIS affiché en cours de partie.** On montre uniquement les points gagnés et le déplacement au classement (▲ +2 places / ▼ −1 place / stable). Aucun classement, aucun top 5, aucune position chiffrée.
- **[LIM]** afficher la bonne réponse même quand le joueur a bon
- Bouton **Quitter** présent

#### J5. Fin de partie
- **[IN]** rang **final** (seul moment où le rang est montré), score total, podium, historique des manches
- **[OUT]** partage du score (image générée), rejouer
- **[VAR]** vainqueur · sur le podium · hors podium
- **[LIM]** récapitulatif des questions dépliable (énoncé + bonne réponse de chaque manche)
- **[LIM]** message « reste connecté, l'animateur peut relancer une partie »

#### J6. Chargement de marque
- Écran transitoire pendant la résolution de la session — doit exister, doit être bref et non anxiogène

---

### SURFACE ANIMATEUR — desktop

#### A1. Connexion animateur (`/host`)
- Champ email + bouton d'envoi du lien de connexion
- **[VAR]** formulaire · **lien envoyé** (confirmation, bouton « utiliser une autre adresse ») · erreur
- **[LIM]** messages d'erreur distincts : aucun compte pour cette adresse / quota d'emails atteint / adresse invalide
- **[LIM]** mention « un seul animateur — accès par lien email »
- **Cet écran ne contient QUE la carte de connexion** : l'argumentaire produit vit sur la page joueur

#### A2. Accès refusé
- S'affiche quand un compte authentifié **n'est pas** celui de l'animateur (403)
- **[IN]** email du compte refusé
- **[OUT]** aller rejoindre en joueur · se déconnecter

#### A3. Accueil stable (salon fermé / expiré)
- **[VAR]** « Salon fermé » (choix de l'animateur) · « Salon expiré » (serveur redémarré ou inactivité)
- **[OUT]** ouvrir un nouveau salon (état « ouverture en cours ») · gérer les questionnaires · déconnexion

#### A4. Salon d'attente (lobby)
- **[IN]** code du salon (très grand, lisible à l'écran d'un stream), **QR code**, lien de partage, nombre de joueurs, liste des pseudos qui arrivent
- **[OUT]** lancer la partie → choix du module (4 modules) → lancement
- **[OUT]** panneau **Séance** : bascule « ordre aléatoire », et par module une liste de questions cochables (sélection manuelle) avec compteur `n/total`
- **[IN]** lien de la **page stream** à ajouter dans OBS, copiable en un geste, avec explication du réglage (source navigateur)
- **[VAR]** aucun joueur (guide en 3 étapes) · joueurs présents (liste)
- **[LIM]** avertissement si on lance une épreuve sans aucun joueur connecté
- Menu de sortie : fermer le salon / déconnexion, **avec confirmation en deux temps**

#### A5. Pilotage en direct
- **[IN]** énoncé en cours, module, progression (épreuve n/total), chrono, nombre de réponses reçues, **répartition des réponses en direct** (réservée à l'animateur), top 5 en direct, bonne réponse après révélation, stats de répartition finales
- **[OUT]** révéler maintenant · question suivante · changer de module (menu) · panneau bonus/malus (±100 par joueur) · voir le classement · terminer la partie · fermer le salon
- **[VAR]** en direct · résultats (manche révélée)
- **[VAR répartition]** options (barres par choix) · booléen (Vrai/Faux) · numérique (min / moyenne / max)
- **[LIM]** la répartition en direct est explicitement marquée « visible par toi seul »
- **[LIM]** bandeau de reconnexion si la liaison serveur tombe (seulement après 1,2 s de coupure)
- **[LIM]** notification d'erreur serveur (« aucune question disponible pour ce module »)

#### A6. Classement / podium
- **[IN]** podium (3 premiers, mise en scène) + rangs 4 à 8
- **[OUT]** retour au direct · continuer (question suivante / relancer une partie) · terminer · fermer le salon
- **[LIM]** pas de « leader » mis en avant tant que personne n'a marqué

---

### SURFACE STREAM (`/overlay`) — scène diffusée, seule source OBS

#### S1. Panneau de connexion — **permanent, sur tous les états**
- **[IN]** QR code du salon, lien du jeu, code du salon
- **[LIM]** doit rester lisible en permanence, quelle que soit la phase de jeu

#### S2. Attente
- **[IN]** nombre de joueurs connectés · message d'accroche

#### S3. Question
- **[IN]** module, progression, énoncé, options proposées, nombre de réponses, chrono
- **[VAR révélée]** bonne réponse mise en avant + **répartition des réponses** (les mêmes statistiques que l'animateur)
- **[LIM]** à la révélation, le stream montre la répartition — **jamais** les points ou places d'un joueur

#### S4. Podium
- **[IN]** 3 premiers avec scores

---

### SURFACE STUDIO (`/studio`) — éditeur de questionnaires

#### E1. Navigation latérale
- **[IN]** liste des modules, indicateur de source du contenu (synchronisé / hors ligne)
- **[OUT]** sélectionner un module · créer un module
- **[VAR]** chargement (squelettes) · contenu

#### E2. Grille des modules
- **[IN]** par module : nom, type, durée, nombre de questions, couleur d'accent
- **[OUT]** éditer · supprimer

#### E3. Panneau d'édition
- Champs : nom, **type** (Quiz / Vrai-Faux / Estimation / Vote), durée en secondes, couleur d'accent (4 choix)
- **[OUT]** ajouter une question · enregistrer · supprimer le module · fermer
- **[VAR bouton d'enregistrement]** repos · enregistrement en cours · enregistré · échec · **contenu invalide**
- **[LIM]** liste des erreurs de validation avant enregistrement : nom vide, durée < 3 s, aucune question, énoncé vide, moins de 2 options remplies, aucune bonne réponse cochée, cible d'estimation non numérique

#### E4. Question (ligne + formulaire dépliable)
- **[IN]** numéro, énoncé (ou « nouvelle question »)
- **[OUT]** déplier/replier · supprimer
- **[VAR de formulaire selon le type du module]**
  - `quiz` : énoncé + 4 options + sélection de la bonne réponse
  - `true_false` : énoncé + choix Vrai/Faux
  - `estimation` : énoncé + valeur cible numérique
  - `vote` : énoncé + liste d'options extensible (ajouter / retirer un choix)
- **[LIM]** l'erreur de validation doit pouvoir se rattacher à la question concernée

---

## 6. Règles produit non négociables

1. **Le rang d'un joueur n'apparaît jamais en cours de partie** — uniquement les points gagnés et les places gagnées/perdues. Le rang final est révélé à la toute fin.
2. **Le classement complet n'est visible que par l'animateur et sur le stream**, jamais sur l'écran d'un joueur en cours de partie.
3. **À la fin du chrono, tout se verrouille** : plus aucune réponse possible, la bonne réponse s'affiche partout.
4. **La répartition des réponses en direct est réservée à l'animateur** ; elle devient publique (stream) uniquement à la révélation.
5. **Aucune fonction « pause »** — elle a été retirée du produit.
6. **Aucun emoji** dans l'interface ; iconographie en SVG au trait.
7. Le code de salon fait 5 caractères sans caractères ambigus (ni O/0, ni I/1).

---

## 7. Contraintes d'intégration — ce qui rend la reprise mécanique

Le design sera réintégré dans une application React existante. Pour que ce soit du
branchement direct, chaque livrable doit respecter ces trois règles :

1. **Annoter les données affichées** : tout élément dont le contenu vient du serveur porte
   `data-bind="<clé du contrat>"` — par exemple `data-bind="tick.timeLeft"`,
   `data-bind="room.code"`, `data-bind="you.placesDelta"`, `data-bind="reveal.stats"`.
2. **Annoter les actions** : tout élément interactif porte `data-action="<action du contrat>"` —
   par exemple `data-action="play:answer"`, `data-action="host:reveal"`,
   `data-action="host:adjustScore:+100"`.
3. **Annoter les variantes** : chaque état d'un écran est livré et porte
   `data-state="<nom de la variante>"` — par exemple `data-state="answered"`,
   `data-state="time-up"`, `data-state="empty"`.

Conserver également les repères de test déjà en place lorsqu'ils existent :
`room-code`, `player-count`, `question-text`, `points-gained`, `places-delta`,
`answers-count`, `reveal-value`, `stats-panel`, `stream-room-code`, `stream-question`,
`end-screen`, `denied-card` (attribut `data-testid`).

**Contraintes techniques :** HTML + CSS autonomes (aucune dépendance externe, polices
incluses ou substituables), variables CSS pour toutes les valeurs de design, accessibilité
WCAG 2.2 AA (contrastes, cibles tactiles ≥ 44 px, focus visible, libellés de formulaire),
et pour la page stream un rendu pensé pour un canvas 1920×1080 diffusé en source navigateur.
