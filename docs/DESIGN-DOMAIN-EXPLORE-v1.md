---
artifact_type: design_domain_explore
app: root
version: 1
change_set: forward
produced_by: design-benchmark
date: 2026-07-22
domain_slug: interactive-stream-game-show
mode: discovery
---

# DESIGN-DOMAIN-EXPLORE — Jeu télévisé interactif en livestream (téléphone-manette)

<!-- FORMAT IMPOSÉ : 6 sections numérotées, chaque fait sourcé inline (source: https://…). -->

## 1. Synthèse du domaine

- Le **WebSocket est le transport temps réel universel** du domaine : Kahoot utilise CometD/Bayeux sur WebSockets avec repli long-polling (source: https://gist.github.com/0efaaa7d5d0904de591db416784498ff), Jackbox des WebSockets bruts (module `ws`) en moderne et Socket.IO en legacy (source: https://github.com/InvoxiPlayGames/johnbox), Mentimeter des WebSockets via le pub/sub managé **Ably** (source: https://dev.to/ably/how-mentimeter-deliver-reliable-live-experiences-at-scale-25fg), skribbl.io du Socket.IO sur WebSocket (source: https://gist.github.com/MrDiamond64/b2081f2cb4ca6d11e848edaeb5ae1814). 6 réfs sur 6 poussent l'état en WebSocket — c'est l'input n°1 pour la stack.
- **La montée en charge se délègue à un pub/sub managé quand elle est massive** : Mentimeter encaisse « from zero to 70,000+ participants in a matter of seconds » en s'appuyant sur Ably plutôt que de gérer le fan-out lui-même (source: https://dev.to/ably/how-mentimeter-deliver-reliable-live-experiences-at-scale-25fg). Jackbox annonce jusqu'à 10 000 spectateurs en mode audience (source: https://www.jackboxgames.com/blog/how-to-play-party-pack-nine-remotely).
- **Le join sans compte par code court (+ QR + lien) est le standard absolu** : PIN Kahoot (source: https://support.kahoot.com/hc/en-us/articles/360039890713-Kahoot-join-How-to-join-a-Kahoot-game), code 4 lettres Jackbox (source: https://www.jackboxgames.com/blog/how-to-play-party-pack-nine-remotely), code menti.com (source: https://help.mentimeter.com/en/articles/410537-how-to-participate-in-a-menti), code d'événement Slido « join without any logins or downloads » (source: https://community.slido.com/slido-fundamentals-205/how-to-join-slido-as-a-participant-472).
- **Le modèle « grand écran = source de vérité / téléphone = manette minimaliste » est constant** : chez Kahoot le téléphone n'affiche que 4 formes-couleurs, la question se lit sur l'écran partagé (source: https://kahoot.fandom.com/wiki/Quiz) ; Jackbox sépare explicitement jeu / contrôleur / serveurs (source: https://www.jackboxgames.com/blog/behind-the-scenes-of-pp10-engineering).
- **La manette est une web-app statique servie par CDN, jamais une app native** : jackbox.tv est du HTML servi par S3+CloudFront avec meta `apple-mobile-web-app-capable` (source: https://jackbox.tv). Cette approche « zéro installation » est la norme.
- **React domine le front là où il est observable** (Kahoot en React+TS+Vite — source: https://kahoot.com/tech-blog/webpack-to-vite/ ; Mentimeter en React — source: https://stackshare.io/companies/mentimeter ; Gartic Phone en Next.js/React — source: https://hypestat.com/info/garticphone.com), mais des SPA JS vanilla existent (skribbl.io, overlays OBS).
- **La boucle « game-show » est déjà codifiée** : timer par question + scoring vitesse/exactitude + leaderboard/podium, chez Kahoot (jusqu'à 1000 pts selon la vitesse — source: https://support.kahoot.com/hc/en-us/articles/115002303908-How-points-work), Mentimeter (quiz competition, leaderboard top 10, musique de plateau — source: https://help.mentimeter.com/en/articles/410463-how-to-create-a-quiz-competition) et Slido (leaderboard top 5 — source: https://community.slido.com/interactive-poll-types-210/create-and-run-a-quiz-538).
- **Les overlays OBS forment un monde technique à part, non intégré aux jeux d'audience** : une Browser Source OBS rend une URL via Chromium/CEF sur fond transparent (`body{background:rgba(0,0,0,0)}`), alimentée par push WebSocket (source: https://obsproject.com/kb/browser-source ; source: https://docs.streamelements.com/overlays/custom-widget). Aucun des outils de quiz benchmarkés ne fournit d'overlay OBS natif — c'est une couche à construire.

## 2. Conventions techniques agrégées

<!-- N = 6 références (Kahoot, Jackbox, Mentimeter, skribbl.io/Gartic Phone, overlays OBS, Slido). -->
<!-- Note transversale : le transport temps réel (WebSocket) est la convention la plus forte du domaine — 6/6 — détaillée en §1 ; il n'entre pas dans les 5 catégories fixes ci-dessous mais conditionne le choix de stack. -->

| Catégorie | Convention dominante | Observée sur | Alternatives vues | Sources |
|---|---|---|---|---|
| Framework front | **React** (souvent TypeScript) | 3 réfs / 6 | Next.js (Gartic Phone) ; SPA JS vanilla + Canvas (skribbl.io, overlays OBS) ; non observable (Jackbox, Slido) | https://kahoot.com/tech-blog/webpack-to-vite/ · https://stackshare.io/companies/mentimeter · https://hypestat.com/info/garticphone.com |
| CSS / styling | **Non concluant** — vanilla CSS / CSS-in-JS selon les cas | observable sur 2 réfs / 6 | CSS-in-JS Fela (Mentimeter) ; CSS transparent + Google Fonts (overlays OBS) ; reste non observable | https://stackshare.io/companies/mentimeter · https://docs.streamelements.com/overlays/widget-structure |
| Composants | **Composants maison** — aucune librairie UI tierce dominante observée | 6 réfs / 6 | D3.js pour la dataviz live (Mentimeter) ; Canvas HTML5 (skribbl.io) | https://www.mentimeter.com/features/word-cloud · https://gist.github.com/MrDiamond64/b2081f2cb4ca6d11e848edaeb5ae1814 |
| Auth / DB | **Sans compte joueur ; appariement par code de room** (comptes créateurs seulement) | 5 réfs / 6 (pertinentes) | Persistance où observable : PostgreSQL + Redis (Mentimeter) ; rooms en mémoire par process Node (skribbl.io) ; reste non observable | https://support.kahoot.com/hc/en-us/articles/360039890713-Kahoot-join-How-to-join-a-Kahoot-game · https://stackshare.io/companies/mentimeter · https://hypestat.com/info/skribbl.io |
| Déploiement | **Cloud + CDN en façade** (statique servi au bord) | 3 réfs / 6 | CloudFront/AWS (Jackbox : S3+CloudFront+EC2+GameLift ; Mentimeter : Heroku+Lambda+CloudFront+K8s) ; Cloudflare+Varnish (Gartic) ; self-host OVH+Nginx sans CDN (skribbl.io) ; non observable (Kahoot, Slido) | https://jackbox.tv · https://dev.to/ably/how-mentimeter-deliver-reliable-live-experiences-at-scale-25fg · https://hypestat.com/info/garticphone.com |

## 3. Conventions d'expérience

### Patterns UX dominants (≥ 3)

- **Join sans friction par code court + QR + lien** — universel (6/6). Le joueur saisit un code affiché à l'écran, scanne un QR, ou suit un lien, puis choisit un pseudo, sans compte ni installation (source: https://support.kahoot.com/hc/en-us/articles/360039890713-Kahoot-join-How-to-join-a-Kahoot-game ; source: https://community.slido.com/slido-fundamentals-205/how-to-join-slido-as-a-participant-472).
- **Séparation « écran-scène / téléphone-manette »** — le grand écran (projeté ou en stream) porte la question, le code, le timer et les résultats qui s'agrègent en direct ; le téléphone n'affiche qu'une interface de saisie minimale (source: https://kahoot.fandom.com/wiki/Quiz ; source: https://www.jackboxgames.com/blog/behind-the-scenes-of-pp10-engineering).
- **Lobby temps réel + contrôle hôte** — salle d'attente listant les joueurs en direct, bouton start réservé à l'hôte, barre de contrôle présentateur (verrouiller le vote, révéler la réponse, avancer, afficher le leaderboard) (source: https://community.slido.com/interactive-poll-types-210/create-and-run-a-quiz-538 ; source: https://support.kahoot.com/hc/en-us/articles/360039422694-How-to-host-a-live-kahoot).
- **Boucle timer → reveal → leaderboard/podium** — compte à rebours par question synchronisé serveur→clients, feedback bon/mauvais, scoring vitesse+exactitude, classement entre les manches et podium final, souvent souligné par une musique de plateau (source: https://support.kahoot.com/hc/en-us/articles/115002303908-How-points-work ; source: https://help.mentimeter.com/en/articles/410463-how-to-create-a-quiz-competition).
- **Overlays stream « display-only »** — layout plein-canvas transparent, typographie large et contrastée (halos/ombres), motion CSS pour les révélations, résolution 1080p, aucune interaction (piloté par events poussés) (source: https://obsproject.com/kb/browser-source ; source: https://docs.streamelements.com/overlays/custom-widget).

### Anti-patterns à éviter (≥ 1)

- **Reconnexion punitive** — chez Kahoot, une déconnexion oblige à reprendre un nouveau pseudo et **perd le score accumulé** (source: https://support.kahoot.com/hc/en-us/articles/360039890713-Kahoot-join-How-to-join-a-Kahoot-game) ; côté Jackbox la reconnexion joueur fine n'est même pas triviale à répliquer (source: https://github.com/InvoxiPlayGames/johnbox). À proscrire : notre spec exige une reconnexion automatique sans perte.
- **Code de join périssable / session unique** — Mentimeter et Slido reposent sur un code qui expire et une logique « une session à la fois » (« one single slido event per presentation ») (source: https://community.slido.com/integrations-242), ce qui bloque un spectateur qui arrive en retard. Notre spec impose au contraire de **rejoindre une partie déjà commencée**.
- **Ignorer le délai de diffusion (stream delay)** — Mentimeter et Slido sont conçus pour le présentiel « même salle » ; en livestream, le décalage vidéo désynchronise le compte-à-rebours perçu et la fenêtre réelle de réponse (source: https://www.mentimeter.com/blog/menti-news/live-presentation-or-survey-the-ultimate-guide-to-voting-pace). À traiter explicitement pour un jeu diffusé.

## 4. Opportunités de différenciation

- **Rejoindre une partie en cours + reconnexion sans perte de score** — non couvert par Kahoot (nouveau pseudo, score perdu) ni par le code périssable de Mentimeter/Slido ; reconnexion joueur non garantie chez Jackbox. C'est un différenciateur natif imposé par la spec (M3 + S5) (source: https://support.kahoot.com/hc/en-us/articles/360039890713-Kahoot-join-How-to-join-a-Kahoot-game).
- **Compensation native du délai de diffusion** — explicitement non traité par Mentimeter/Slido (conçus présentiel) ; offrir des fenêtres de réponse tolérantes au stream delay différencie sur le cas d'usage livestream (source: https://www.mentimeter.com/blog/menti-news/live-presentation-or-survey-the-ultimate-guide-to-voting-pace).
- **Format game-show modulaire multi-jeux dans une même partie** — Kahoot/Slido se limitent au quiz, Jackbox impose de relancer une app par jeu (source: https://www.jackboxgames.com/blog/how-to-play-party-pack-nine-remotely) ; personne n'enchaîne librement des modules variés (Quiz, Vote, Estimation…) dans une session pilotée par l'animateur.
- **Overlays OBS de première classe intégrés au moteur de jeu** — les outils de quiz benchmarkés ne fournissent aucun overlay OBS natif (couche séparée type StreamElements) ; livrer question/timer/leaderboard/podium comme sources navigateur transparentes directement alimentées par le même moteur temps réel est un avantage net (source: https://obsproject.com/kb/browser-source).

## 5. Fiches de référence

### Kahoot — https://kahoot.com
- **Proposition de valeur / audience :** quiz-jeu en direct, hôte sur grand écran, joueurs sur leur appareil sans compte (classe, entreprise, événementiel) (source: https://support.kahoot.com/hc/en-us/articles/360039890713-Kahoot-join-How-to-join-a-Kahoot-game).
- **Conventions techniques observables :** front React+TypeScript, migration Webpack→Vite (source: https://kahoot.com/tech-blog/webpack-to-vite/) ; temps réel CometD/Bayeux sur WebSockets avec repli long-polling, endpoint `kahoot.it/cometd/{pin}/{token}` (source: https://gist.github.com/0efaaa7d5d0904de591db416784498ff) ; auth/DB et CDN non observables précisément (source: https://builtwith.com/create.kahoot.it).
- **Patterns UX/UI récurrents :** join par PIN/QR, pseudo + lobby, téléphone = 4 formes-couleurs, écran hôte = contenu + timer, scoring à la vitesse, leaderboard entre questions + podium (source: https://kahoot.fandom.com/wiki/Quiz ; source: https://support.kahoot.com/hc/en-us/articles/115002303908-How-points-work).
- **Forces / faiblesses d'expérience :** force = barrière d'entrée quasi nulle et tension compétitive ; faiblesses = reconnexion punitive (score perdu) et scoring qui sur-pénalise la vitesse (source: https://support.kahoot.com/hc/en-us/articles/360039890713-Kahoot-join-How-to-join-a-Kahoot-game).

### Jackbox Games (jackbox.tv) — https://jackbox.tv
- **Proposition de valeur / audience :** le smartphone devient la manette web (« zéro app »), écran TV/stream = jeu ; jusqu'à 10 000 spectateurs (source: https://www.jackboxgames.com/blog/how-to-play-party-pack-nine-remotely).
- **Conventions techniques observables :** contrôleur = web-app statique sur S3+CloudFront (headers `server: AmazonS3`, `via: CloudFront`) (source: https://jackbox.tv) ; temps réel WebSockets bruts (`ws`) moderne / Socket.IO legacy, serveurs de synchro custom (CRDT « text map ») (source: https://github.com/InvoxiPlayGames/johnbox ; source: https://www.jackboxgames.com/blog/behind-the-scenes-of-pp10-engineering).
- **Patterns UX/UI récurrents :** code 4 lettres + QR, manette minimaliste plein écran, mode audience massif, filtres famille/profanité + modération live, pause 5 min à la déconnexion hôte (source: https://www.jackboxgames.com/blog/streaming-moderation-accessibility-features-jackbox-party-pack-eight).
- **Forces / faiblesses d'expérience :** force = onboarding sans friction + modération intégrée + infra CDN mondiale ; faiblesses = plafond ~8-10 joueurs actifs, dépendance à un écran hôte partagé, reconnexion joueur non triviale (source: https://www.jackboxgames.com/blog/how-to-play-party-pack-nine-remotely).

### Mentimeter — https://www.mentimeter.com
- **Proposition de valeur / audience :** présentation interactive, résultats live (polls, quiz, word cloud) sur téléphone ; formateurs, entreprises, conférenciers (source: https://www.mentimeter.com/features/word-cloud).
- **Conventions techniques observables :** front React (+Gatsby, Redux, CSS-in-JS Fela), dataviz D3.js (source: https://stackshare.io/companies/mentimeter) ; temps réel WebSockets via **Ably** (pub/sub managé, feature presence), ~70 000 participants en secondes (source: https://dev.to/ably/how-mentimeter-deliver-reliable-live-experiences-at-scale-25fg) ; PostgreSQL + Redis, Heroku + AWS + Kubernetes (source: https://whatsthatstack.com/companies/mentimeter/).
- **Patterns UX/UI récurrents :** join par code menti.com + QR, split grand écran/téléphone, visualisation qui s'agrège en direct, mode presenter-pace (game-show) vs audience-pace, quiz competition (scoring temps, leaderboard, musique) (source: https://help.mentimeter.com/en/articles/410463-how-to-create-a-quiz-competition ; source: https://www.mentimeter.com/blog/menti-news/live-presentation-or-survey-the-ultimate-guide-to-voting-pace).
- **Forces / faiblesses d'expérience :** force = fiabilité à très forte concurrence + feedback visuel « waouh » ; faiblesses = code périssable, délai de diffusion non géré, cadence dépendante d'un opérateur humain (source: https://www.mentimeter.com/blog/menti-news/live-presentation-or-survey-the-ultimate-guide-to-voting-pace).

### skribbl.io & Gartic Phone (jeux party navigateur temps réel de masse) — https://skribbl.io
- **Proposition de valeur / audience :** jeux gratuits sans compte, join par lien de room, forte viralité (skribbl ~6 M visites/mois ; Gartic ~9 M, dominante mobile) (source: https://hypestat.com/info/skribbl.io ; source: https://hypestat.com/info/garticphone.com).
- **Conventions techniques observables :** skribbl = Node.js + Express + Socket.IO sur WebSocket, Nginx, hébergé OVH sans CDN (source: https://gist.github.com/MrDiamond64/b2081f2cb4ca6d11e848edaeb5ae1814 ; source: https://hypestat.com/info/skribbl.io) ; Gartic = Next.js/React derrière Cloudflare + Varnish, canal WS exact non observable (source: https://hypestat.com/info/garticphone.com) ; rooms en mémoire par process, broadcast Socket.IO par room.
- **Patterns UX/UI récurrents :** création de room instantanée + lien partageable, pseudo/avatar en un écran, lobby avec réglages hôte, timer par round, état partagé répliqué en direct, reconnexion via heartbeat Socket.IO (source: https://gist.github.com/MrDiamond64/b2081f2cb4ca6d11e848edaeb5ae1814).
- **Forces / faiblesses d'expérience :** force = friction nulle + latence faible cross-device ; faiblesses = peu de persistance/anti-triche (protocole reverse-engineeré → bots), skribbl sans CDN plus exposé aux pics que Gartic (source: https://hypestat.com/info/skribbl.io).

### Overlays « browser source » OBS (StreamElements / Streamlabs / custom) — https://obsproject.com/kb/browser-source
- **Proposition de valeur / audience :** pages web affichées par-dessus le flux vidéo (alertes, chat, question, timer, leaderboard, podium) pour streamers/productions live (source: https://obsproject.com/kb/browser-source).
- **Conventions techniques observables :** rendu Chromium/CEF d'une URL (plugin `obs-browser`), fond transparent par convention `body{background:rgba(0,0,0,0)}`, données live poussées par WebSocket / events `onWidgetLoad`+`onEventReceived`, stack HTML/CSS/JS (parfois React), `SE_API` + `fieldData` pour le no-code (source: https://github.com/obsproject/obs-browser ; source: https://docs.streamelements.com/overlays/custom-widget).
- **Patterns UX/UI récurrents :** layout plein-canvas transparent, safe margins, typo large lisible + Google Fonts, transitions CSS pour les reveals, résolution 1080p, display-only (source: https://docs.streamelements.com/overlays/widget-structure).
- **Forces / faiblesses d'expérience :** force = un simple URL suffit + temps réel par push + compositing propre ; faiblesses = sandbox restreint (pas de cookie/IndexedDB), transparence cassée si fond opaque, CEF figé (soucis GPU/alpha) (source: https://github.com/obsproject/obs-studio/issues/5347).

### Slido — https://www.slido.com
- **Proposition de valeur / audience :** interaction live (Q&A, sondages, quiz) « join without any logins or downloads », orienté meetings/événements ; racheté par Cisco/Webex en 2020 (source: https://www.slido.com/ ; source: https://techcrunch.com/2020/12/07/cisco-acquires-slido-to-improve-qa-polls-and-engagement-in-webex-videoconferencing/).
- **Conventions techniques observables :** résultats temps réel type push (protocole exact non observable) ; accès participant sans compte par code/QR/lien ; front/DB/CDN non observables faute d'accès StackShare/BuiltWith ; intégrations PowerPoint/Google Slides/Webex/Teams/Zoom (source: https://www.slido.com/features-integrations ; source: https://community.slido.com/integrations-242).
- **Patterns UX/UI récurrents :** join par code d'événement, quiz timer 20 s + verrouillage + reveal, scoring vitesse+exactitude, leaderboard top 5, barre de contrôle présentateur (source: https://community.slido.com/interactive-poll-types-210/create-and-run-a-quiz-538).
- **Forces / faiblesses d'expérience :** force = friction nulle + boucle game-show éprouvée + insertion dans l'outil du présentateur ; faiblesses = « un seul événement Slido par présentation », pile technique opaque, orientation présentiel (délai de diffusion non géré) (source: https://community.slido.com/integrations-242).

## 6. Table des sources

| # | URL | Utilisée pour |
|---|---|---|
| 1 | https://kahoot.com/tech-blog/webpack-to-vite/ | §1, §2, §5 (React/Vite Kahoot) |
| 2 | https://gist.github.com/0efaaa7d5d0904de591db416784498ff | §1, §5 (temps réel CometD/WebSockets Kahoot) |
| 3 | https://support.kahoot.com/hc/en-us/articles/360039890713-Kahoot-join-How-to-join-a-Kahoot-game | §1, §3, §5 (join, reconnexion) |
| 4 | https://support.kahoot.com/hc/en-us/articles/115002303908-How-points-work | §1, §3, §5 (scoring) |
| 5 | https://support.kahoot.com/hc/en-us/articles/360039422694-How-to-host-a-live-kahoot | §3 (vue hôte) |
| 6 | https://kahoot.fandom.com/wiki/Quiz | §1, §3, §5 (formes-couleurs) |
| 7 | https://builtwith.com/create.kahoot.it | §5 (CDN non observable) |
| 8 | https://jackbox.tv | §1, §2, §5 (manette statique S3/CloudFront) |
| 9 | https://github.com/InvoxiPlayGames/johnbox | §1, §3, §5 (protocole WebSockets/Socket.IO Jackbox) |
| 10 | https://www.jackboxgames.com/blog/behind-the-scenes-of-pp10-engineering | §1, §3, §5 (architecture, CRDT) |
| 11 | https://www.jackboxgames.com/blog/how-to-play-party-pack-nine-remotely | §1, §4, §5 (code 4 lettres, audience 10k) |
| 12 | https://www.jackboxgames.com/blog/streaming-moderation-accessibility-features-jackbox-party-pack-eight | §5 (modération, filtres) |
| 13 | https://aws.amazon.com/blogs/gametech/jackbox-games-unlocks-new-opportunities-with-amazon-gamelift-streams | §2 (infra AWS) |
| 14 | https://dev.to/ably/how-mentimeter-deliver-reliable-live-experiences-at-scale-25fg | §1, §2, §5 (WebSockets/Ably, scale) |
| 15 | https://stackshare.io/companies/mentimeter | §2, §5 (React/Fela/Postgres) |
| 16 | https://whatsthatstack.com/companies/mentimeter/ | §2 (Postgres/Redis/K8s) |
| 17 | https://www.mentimeter.com/features/word-cloud | §1, §5 (dataviz live D3) |
| 18 | https://help.mentimeter.com/en/articles/410537-how-to-participate-in-a-menti | §1 (join par code) |
| 19 | https://help.mentimeter.com/en/articles/410463-how-to-create-a-quiz-competition | §1, §3, §5 (quiz competition) |
| 20 | https://www.mentimeter.com/blog/menti-news/live-presentation-or-survey-the-ultimate-guide-to-voting-pace | §3, §4, §5 (presenter pace, délai) |
| 21 | https://gist.github.com/MrDiamond64/b2081f2cb4ca6d11e848edaeb5ae1814 | §1, §2, §3, §5 (protocole Socket.IO skribbl) |
| 22 | https://hypestat.com/info/skribbl.io | §2, §5 (stack/hosting skribbl) |
| 23 | https://hypestat.com/info/garticphone.com | §1, §2, §5 (Next.js/Cloudflare Gartic) |
| 24 | https://obsproject.com/kb/browser-source | §1, §3, §5 (Browser Source CEF, transparence) |
| 25 | https://github.com/obsproject/obs-browser | §5 (plugin CEF) |
| 26 | https://docs.streamelements.com/overlays/custom-widget | §1, §3, §5 (events push, SE_API) |
| 27 | https://docs.streamelements.com/overlays/widget-structure | §2, §3, §5 (HTML/CSS/JS, fields) |
| 28 | https://github.com/obsproject/obs-studio/issues/5347 | §5 (bugs transparence CEF) |
| 29 | https://www.slido.com/ | §5 (proposition de valeur) |
| 30 | https://community.slido.com/slido-fundamentals-205/how-to-join-slido-as-a-participant-472 | §1, §3 (join sans compte) |
| 31 | https://community.slido.com/interactive-poll-types-210/create-and-run-a-quiz-538 | §1, §3, §5 (quiz, leaderboard) |
| 32 | https://community.slido.com/integrations-242 | §3, §4, §5 (une session à la fois) |
| 33 | https://www.slido.com/features-integrations | §5 (intégrations) |
| 34 | https://techcrunch.com/2020/12/07/cisco-acquires-slido-to-improve-qa-polls-and-engagement-in-webex-videoconferencing/ | §5 (rachat Cisco) |
