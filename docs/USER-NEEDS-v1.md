---
artifact_type: user_needs
app: root
version: 1
change_set: bootstrap
produced_by: product-discovery
created_at: "2026-07-22"
---

# USER-NEEDS — Project Game Show (v1)

## Contexte

**Project Game Show** est une plateforme web d'animation : le streamer présente un vrai jeu télévisé et **toute sa communauté joue depuis son téléphone**. L'animateur pilote entièrement la partie (quel module, quand révéler, quand terminer) ; les viewers rejoignent en quelques secondes via un code ou un QR code, sans compte ni installation. Une partie est une **succession libre de modules** (Quiz, Vote, Estimation…) sans durée imposée, diffusée sur le stream via des **overlays OBS**.

## Le problème

Les streamers veulent transformer leur audience passive en participants actifs, mais chaque famille d'outils impose un compromis :

- Les outils d'engagement **webinaire** (StreamAlive, Slido) ne sont pas pensés pour le stream et sont payants avec peu de personnalisation.
- Les **jeux party** (Jackbox, Kahoot) plafonnent le nombre de joueurs (Jackbox 3-10 actifs ; Kahoot gratuit 10) et ne s'intègrent pas à OBS.
- Les **jeux « chat »** (Marbles, Kukoro) limitent la participation à des commandes de chat Twitch, souvent au simple vote, et restent mono-plateforme.

Personne n'offre une plateforme **stream-native, multi-plateforme, téléphone-manette pour chaque viewer, sans compte, à grande échelle, modulaire et pilotée par l'animateur**. C'est précisément le créneau visé.

## Le marché (benchmark sourcé)

| Concurrent | Force | Faiblesse clé | Source |
|---|---|---|---|
| **StreamAlive / Slido** | Interaction temps réel, faible friction, intuitif | Pas de palier bas, personnalisation limitée, orienté Zoom/Teams (pas OBS) | [Capterra](https://www.capterra.com/p/10010918/StreamAlive/reviews/) |
| **Jackbox** | Rejoindre par téléphone (jackbox.tv), jeux polis | Plafond 3-10 joueurs actifs, audience passive, pas d'overlays OBS, pas de format game-show | [Support Jackbox](https://support.jackboxgames.com/hc/en-us/articles/15794756085015-How-many-players-can-join-each-game) |
| **Kahoot** | Join par code, grande échelle sur plans payants | Gratuit plafonné à 10, échelle payante, orienté éducation, un seul type de jeu | [Support Kahoot](https://support.kahoot.com/hc/en-us/articles/115003072287-How-many-participants-can-play-a-kahoot) |
| **Marbles / jeux chat** | Grande échelle (~900), stream-natif | Commandes de chat / vote seulement, mono-plateforme Twitch, bugs de synchro, peu de variété | [Board Game Fight Club](https://www.boardgamefightclub.com/articles/Every-Twitch-Chat-Integrated-Video-Game/) · [Steam](https://steamcommunity.com/app/1170970/discussions/0/4516632983095949848) |

**Tendance** : le jeu-avec-l'audience reste « un nouveau concept encore peu servi ». **Opportunité** : la combinaison stream-natif + multi-plateforme + manette mobile universelle + sans compte + grande échelle + modulaire + OBS n'est couverte par aucun acteur.

> **Note sur les sources voix-utilisateur** : Reddit étant inexploitable via le proxy de recherche de cet environnement, les insights utilisateurs proviennent de substituts équivalents prévus par la procédure de repli (avis vérifiés Capterra, discussions Steam Community, devlog itch.io).

## Les utilisateurs

**Théo — le streamer-animateur (persona principal).** Streamer Twitch/Kick/YouTube avec une communauté trop grande pour les jeux party classiques. Son job : transformer son live en émission interactive sans setup lourd ni dépendance à un jeu tiers. Il veut faire jouer un maximum de viewers, créer du suspense qu'il révèle au bon moment, et garder le contrôle total du rythme.

**Léa — la viewer-joueuse (persona secondaire).** Elle regarde le stream sur un écran et veut jouer depuis son téléphone-manette. Son job : rejoindre en moins de 10 secondes, sans compte, comprendre l'écran sans explication, et rester impliquée même sans gagner — y compris si elle arrive en cours de partie.

## Les besoins (MoSCoW)

**Must (le socle indispensable)** — créer un salon (code + QR) ; rejoindre sans compte en < 10 s ; rejoindre en cours de partie ; enchaîner librement les modules ; jouer aux 4 modules de lancement (**Quiz, Vrai/Faux, Estimation, Vote**) ; score par module + classement recalculé ; contrôle animateur (afficher/masquer réponses, pause, suivant, terminer) ; overlays OBS (question, chrono, classement/podium, résultats) ; temps réel ; dashboard animateur ; interface joueur minimaliste.

**Should (visé pour la v1 « complète »)** — événements spéciaux (Double Points, Mort Subite…) ; bonus/malus manuels ; relancer une manche ; modules additionnels (Blind Test, Image Mystère, Rapidité, Mémoire, Classement/ordre, Texte libre) ; reconnexion automatique ; choix de l'affichage du classement ; états de salon explicites ; historique/journal ; montée en charge vers ~1000 simultanés.

**Could (souhaitable, plus tard)** — modules « signature » originaux (Le Menteur, Le Saboteur, Le Banquier, Puzzle, Emoji) ; thèmes/personnalisation ; intégrations Twitch optionnelles ; crowdsourcing de questions ; stats admin ; sons/animations de plateau avancés.

**Won't (hors périmètre délibéré)** — application native ; comptes/persistance joueurs ; multi-animateurs/multi-salons ; dépendance obligatoire à Twitch ; classement mondial persistant + modération lourde.

## Le feeling design

Trois adjectifs : **Spectaculaire, Énergique, Premium** — l'ambiance d'un plateau de jeu télévisé (violet/néon, gros chiffres animés, suspense, contraste sombre), inspirée de l'infographie fournie. Référence de simplicité à égaler : le join-en-un-code de Kahoot. À éviter absolument : le rendu « corporate/plat » des outils webinaire type Slido.

## Les flux principaux

1. **Animer une partie** (Théo) : connexion → création du salon → affichage code/QR → salle d'attente → lancement → choix d'un module → animation (chrono, pause, événement, reveal) → classement → nouveau module → podium final.
2. **Rejoindre et jouer** (Léa) : scan QR / code → pseudo → salle d'attente → participation → score → classement → manche suivante → fin.
3. **Rejoindre en cours** : scan/code pendant une partie active → pseudo → intégration immédiate à la partie.

## Les contraintes

Plateforme **web responsive** (joueur mobile, animateur desktop, overlays comme sources navigateur OBS). Budget bootstrap/perso, pas de deadline stricte, cible v1 « complète ». **RGPD léger** (pseudo seul, aucun compte, données éphémères) + filtrage des pseudos. Contraintes techniques : temps réel WebSockets, overlays OBS, reconnexion mobile, indépendance vis-à-vis de Twitch.

## Le MVP

**Hypothèse à valider** : un jeu-show stream-natif où chaque viewer joue depuis son téléphone sans compte génère un engagement massif et des moments mémorables qu'aucun outil existant ne permet.

**Périmètre** : les 11 Must (M1-M11), avec les événements (S1) et bonus/malus (S2) visés dans la v1 « complète ». **Métrique de succès** : fort taux de participation (joueurs actifs / viewers), parties enchaînées sans friction, onboarding joueur < 10 s, et retours qualitatifs « moment mémorable ».

## Décisions clés

Périmètre perso mono-animateur (v1) · 4 modules de lancement · 1000 joueurs traité comme objectif progressif (seuil de départ fixé en tech-spec) · direction game-show TV spectaculaire · indépendance Twitch (intégrations optionnelles).

## Les sources

- StreamAlive — avis vérifiés : https://www.capterra.com/p/10010918/StreamAlive/reviews/
- Jackbox — nombre de joueurs : https://support.jackboxgames.com/hc/en-us/articles/15794756085015-How-many-players-can-join-each-game
- Kahoot — nombre de participants : https://support.kahoot.com/hc/en-us/articles/115003072287-How-many-participants-can-play-a-kahoot
- Board Game Fight Club — jeux Twitch intégrés : https://www.boardgamefightclub.com/articles/Every-Twitch-Chat-Integrated-Video-Game/
- Steam Community — Marbles on Stream : https://steamcommunity.com/app/1170970/discussions/0/4516632983095949848
- itch.io — Streamers Interactive Quiz Game (devlog) : https://bareth87.itch.io/streaming-quiz-game/devlog
- HeyNau Games — jeux pour streamers : https://heynaugames.com/best-games-for-streamers
