# Récapitulatif des 19 actions — des réunions au code livré

> Mémo de rappel. Pour chaque action : ce qui s'est dit en réunion, ce que le
> diagnostic a trouvé, ce qui a été décidé, ce qui a réellement été fait.
>
> Ce document **résume** ; il ne remplace pas [PLAN-CHANTIER-v1.md](PLAN-CHANTIER-v1.md),
> qui porte les 167 décisions numérotées, les impacts, les risques et les
> mitigations. En cas de doute pendant une reprise, c'est le plan qui fait foi.
>
> Sources : deux comptes rendus — **CR#1** (revue de fonctionnalités) et **CR#2**
> (session de test approfondi). 19 actions, 18 retenues, toutes livrées.

---

## Action 1 — Édition des textes depuis le site · **MISE DE CÔTÉ**

**En réunion (CR#1).** Theodore demande à pouvoir modifier les textes des écrans
sans passer par GitHub. R.M.A propose un mode édition sur le site.

**Diagnostic.** Volumétrie chiffrée pour dimensionner : environ 140 chaînes entre
balises (joueur 37, animateur 51, stream 20, studio 31), plus les libellés
d'accessibilité, les textes de substitution et les dictionnaires de messages
d'erreur — total estimé entre 180 et 220 chaînes. La persistance ne nécessiterait
ni Supabase ni politiques d'accès : le motif du stockage disque protégé par le
contrôle animateur suffit et est déjà éprouvé.

**Décision.** Abandonnée en l'état — trop lourde pour la valeur immédiate.
Remplacée par un fonctionnement à la demande : sur sollicitation, produire
l'inventaire des textes en dur avec leur contexte (écran, état d'affichage, texte
exact) ; vous désignez les modifications ; elles sont appliquées dans le code.

**Réalisé.** Rien de codé — c'est le sens de la mise de côté. Ce qui reste acquis
pour une reprise : la volumétrie est chiffrée, le motif de persistance identifié.

---

## Action 2 — Le module nommé devient l'unité de jeu

**En réunion (CR#1).** Différence constatée entre les noms des jeux créés dans le
studio et ceux affichés en partie. R.M.A propose une « phase de cohérence ».

**Diagnostic.** Le studio et le serveur ne parlent pas le même langage : le studio
raisonne en modules nommés, le serveur ne connaît que quatre mécaniques et affiche
leurs noms génériques figés. L'animateur lance un *type*, pas un jeu. Trois
conséquences, **dont deux non vues en réunion** :

1. Le nom ne voyage jamais jusqu'aux écrans de jeu.
2. Sans Supabase, **le nom est détruit à l'enregistrement** : la sauvegarde ne
   garde que les questions, aplaties par type. « Culture générale » redevient
   « Quiz » après rechargement.
3. **Deux modules du même type fusionnent** en un seul au rechargement.

Le menu de lancement ne listait pas les modules du studio, mais quatre types
écrits en dur.

**Décisions (11).** Le module nommé devient l'unité de jeu réelle — l'animateur
lance « Culture générale », pas « Quiz ». La pioche est restreinte au module
lancé. Les vingt questions d'exemple sont semées **une seule fois** puis
deviennent de la donnée ordinaire, éditables et supprimables ; un repère de
semence empêche qu'elles repoussent au redémarrage ; un bouton « restaurer les
questions de base » rend la suppression réversible. Conversion non destructive de
l'ancien fichier. Le serveur accepte les deux formes de lancement pour qu'un écran
non rechargé continue de fonctionner. Stockage cloisonné par compte, un fichier
par compte.

**Réalisé.** `store.js` réécrit : bibliothèque par compte dans
`data/owners/<id>.json`, marqueur de semence, reprise non destructive de
`data/banks.json`. Le moteur reçoit le jeu nommé. Le menu est alimenté par la
vraie liste.

Deux choses ont été trouvées en chemin :

- **Une simplification actée.** Le Studio avait deux chemins de persistance —
  Supabase depuis le navigateur, le serveur sinon. Le chemin serveur n'était
  emprunté que si le client Supabase était *totalement absent*, ce qui n'arrive
  jamais : le Studio gardait sa graine locale de démonstration et **l'écrasait
  par-dessus la vraie bibliothèque** au premier enregistrement. Décision : le
  Studio ne parle plus qu'au serveur. Un chemin, une vérité.
- **Une contradiction que j'avais moi-même introduite**, trouvée à la clôture : le
  serveur fusionnait encore dans la réserve d'un jeu toutes les questions Supabase
  du même *type* — l'aplatissement que cette action venait de supprimer,
  réintroduit par une autre porte. Retiré.

Le bouton « restaurer » (décision 6) n'avait jamais été posé dans le Studio :
trouvé à l'audit, ajouté.

---

## Actions 3 + 4 + 5 — Refonte de la disposition du stream

Trois tâches du CR#1 fusionnées : même écran, et la décision de l'une conditionne
les autres.

**En réunion (CR#1).** Afficher le classement complet sur le stream ; réduire la
taille du QR code ; retirer le QR à la fin de la partie.

**Diagnostic.** Le classement complet **circule déjà** jusqu'au stream — dix
joueurs après chaque révélation, cinquante à la fin — mais l'écran n'en affiche
que trois. Côté animateur la troncature est **double** : le serveur n'envoie que
dix, l'écran n'affiche que cinq. Le panneau de connexion occupe une colonne de
460 px sur toute la hauteur d'un canevas de 1920×1080, pour un QR de 260 px. Sa
permanence était un contrat inscrit dans le code.

**Décisions (16).** Chez l'animateur, le classement complet **remplace** la vue
tronquée — pas de bouton de bascule, liste défilable, le premier reste en tête.
Le serveur cesse de tronquer. Sur le stream, la colonne accueille le classement
**au podium uniquement**, en une seule colonne, défilement bouclé partant du
premier ; pendant la partie la colonne n'existe pas et la scène prend toute la
largeur. QR à 180 px, plancher assumé pour rester scannable. Pastille ancrée en
bas à gauche — seul coin calme dans les deux phases, et le moins utilisé par les
habillages de streamers. Au podium, plus de QR mais le code reste en tout petit,
**avec l'adresse sur la même ligne** : un code seul ne dit pas où le taper. La
pastille revient au salon d'attente pour qu'une seconde partie ne soit pas privée
de moyen de rejoindre.

**Réalisé.** Livré et mesuré : `stream-disposition.spec.js` (8 tests, géométrie et
lisibilité), `stream.spec.js` réécrit au nouveau contrat.

**Limite assumée, mesurée** : l'adresse tient jusqu'au téléphone en paysage
(12,3 px) mais tombe à **6,9 px en portrait**, sous le seuil de lisibilité —
et aucune taille raisonnable ne l'y sauverait, l'énoncé de la question lui-même
n'y faisant que 17 px. Le code du salon, lui, reste lisible partout, et
l'animateur peut annoncer l'adresse à l'oral. Le test consigne les chiffres à
chaque exécution pour que la décision reste révisable sur des faits.

---

## Action 6 — Non-répétition des questions et file d'attente

**En réunion.** CR#1 — vérifier qu'une question déjà posée n'est pas reposée.
CR#2 — permettre à l'animateur de voir et choisir la prochaine question, « un peu
comme une liste de file d'attente Spotify ».

**Diagnostic.** Le mécanisme de non-répétition existe et fonctionne dans le cas
courant. Trois défauts néanmoins : la couverture de test est mince (un seul
contrôle, qui compare deux questions consécutives) ; **répétition immédiate
possible au changement de cycle** — quand la banque est épuisée, le code efface la
liste puis pioche dans la banque entière, y compris la question qui vient d'être
posée ; et une **porte latérale** — une question imposée au lancement n'est pas
enregistrée comme jouée, défaut dormant que réveillerait toute sélection manuelle.

Pour la file : l'écran d'attente permet déjà de choisir *quelles* questions entrent
en jeu. Ce qui manque, c'est **l'ordre**.

**Décisions (16).** Jamais deux fois la même question dans un même salon — la
liste survit aux relances et n'est vidée qu'à la fermeture du salon. Conséquence
assumée : l'épuisement d'une banque devient un cul-de-sac, le filet de recyclage
disparaît, et c'est la file qui rend la fin visible à l'avance. Une file ordonnée
**par jeu**, visible au lancement, réordonnable par glisser-déposer **sans
nouvelle dépendance**, avec boutons monter/descendre en complément — pas seulement
pour l'accessibilité : en direct, un bouton ne rate jamais sa cible. La file part
**uniquement vers l'écran de l'animateur**, jamais sur le canal partagé avec le
stream : c'est la seule donnée de l'application qui révèle les questions *à
venir*, elle n'a rien à faire dans une source capturée par OBS.

**Réalisé.** `file-attente.spec.js` (4 tests).

**Point à retenir** : le test de non-répétition **passait même avec l'ancien
comportement restauré**. Il a été rendu déterministe (mélange désactivé), puis
vérifié dans les deux sens. Un test qui ne peut pas échouer ne prouve rien.

---

## Action 7 — La voix du jeu

**En réunion.** CR#1 — ajouter des phrases amusantes pour les joueurs qui
attendent seuls autour du feu ; étendu en discussion aux victoires, défaites,
bonnes et mauvaises réponses, résultats et podium. CR#2 — préférer des messages
humoristiques au retrait de points, et adapter les messages selon la précision de
l'estimation. Vous avez ajouté : le stream est concerné aussi, notamment sur les
répartitions ; couvrir tout, pas à pas ; et **que ce soit pris en compte dans la
logique de développement future**, pour les nouvelles pages et les nouveaux jeux.

**Diagnostic.** Le jeu est juste et froid : il annonce des faits (« Réponse
envoyée », « Position inchangée ») aux moments où le joueur ressent quelque chose.
Mais il **sait déjà** tout ce qu'il faut pour parler juste — score, points,
vitesse, série, places gagnées, décompte par option, cible, moyenne, médiane,
réponse la plus proche. **Aucune donnée n'était à créer.**

**Décisions (18).** Trois strates : voix intime sur le téléphone, voix de plateau
sur le stream, convention qui fait survivre le dispositif. Règle éditoriale
maîtresse : **on peut taquiner en privé, jamais en public** — l'écran du joueur
n'est vu que par lui ; le stream commente le groupe, jamais un individu nommé,
sauf au podium où c'est pour célébrer. Jamais de phrase qui contredit les chiffres
affichés à côté. Registre feu de camp, aucun emoji. Le stream **ne parle que sur
les répartitions remarquables** et se tait sinon — le silence est une
fonctionnalité, et commenter la répartition est le métier de l'animateur. Une
phrase de repli par situation : jamais d'écran muet. Vous avez tranché pour un
**contrôle mécanique bloquant** plutôt qu'indicatif.

**Réalisé.** `voix.js` — **36 moments, 181 phrases**, moyenne de 5 par moment.
`voix.test.js` (17 tests bloquants), `voix.spec.js` (4 tests), convention inscrite
dans `AGENTS.md [VOIX]`.

Le contrôle a été **éprouvé dans son rôle de garde-fou** : un type de jeu ajouté
sans ses phrases le fait échouer, une route ajoutée sans sa surface aussi.

Deux écarts trouvés à l'audit : **125 phrases livrées pour ~200 annoncées**, et 24
moments sur 34 tenaient sur moins de quatre phrases — trop peu pour ceux qui
reviennent à chaque manche. Porté à 181, aucun moment sous quatre. Et aucune
phrase de repli n'existait pour le joueur arrivé en cours de partie ni pour celui
qui attend son résultat, alors que la décision dit « jamais d'écran muet » : deux
moments ajoutés et câblés.

**Une assertion superstitieuse retirée** : un test rejetait toute phrase contenant
« perdu », et échouait donc sur « Rien de perdu — tu entres maintenant », qui est
accueillante. Le ton reste affaire de relecture humaine, comme la convention le
dit elle-même.

---

## Action 8 — Barème énoncé, panneau de correction supprimé

**En réunion (CR#1).** Griser ou retirer l'affichage des bonus et malus tant
qu'une règle claire n'est pas définie.

**Diagnostic.** **Trois objets distincts portaient le même nom.** Le barème
automatique existe et ses règles sont définies — il n'est simplement énoncé nulle
part, d'où l'impression d'arbitraire. Un panneau sur l'écran animateur,
littéralement intitulé « Bonus / Malus », avec des boutons ±100 points par joueur :
celui-là n'a effectivement aucune règle. Et des pouvoirs spéciaux évoqués en
réunion, qui n'existent pas dans le code. **Theodore a vu le deuxième et pensait
au troisième.**

**Décisions (6).** Vous avez tranché : garder le barème, retirer complètement le
panneau, aucune trace des corrections puisque la fonction disparaît. Conséquence
assumée : plus aucun moyen de rattraper un score en direct si un téléphone plante.
Les pouvoirs spéciaux restent hors périmètre. L'énoncé doit refléter le barème
final — il est donc écrit **après** les actions 17, 13 et 18.

**Réalisé.** Panneau supprimé sur ses quatre points d'ancrage : l'écran, la
commande serveur, la fonction du moteur, la ligne du test d'intégration. Barème
énoncé au joueur. `bareme.spec.js` (3 tests).

Écart trouvé à l'audit : l'énoncé **ne décrivait que le quiz**. Ni les paliers
d'estimation, ni la règle du vote, ni les trois cas de rupture de série n'y
figuraient. Complété pour les quatre jeux.

---

## Action 9 — Connexion par mot de passe et masquage de l'adresse

**En réunion (CR#1).** Cacher l'adresse mail sur l'écran animateur ; préférer une
connexion par mot de passe à l'envoi de liens, à cause d'une limite du nombre de
liens par jour.

**Diagnostic.** La limite vient du service d'envoi intégré à Supabase, bridé sur
les offres gratuites — **contrainte du fournisseur, pas erreur de
configuration.** Point décisif : la vérification côté serveur est **indifférente
au mode de connexion**, elle valide une session peu importe comment elle a été
obtenue. Passer au mot de passe ne touche donc pas une ligne de cette mécanique.
Et ce que le masquage protège n'est pas un voisin qui lirait l'écran, mais
**l'écran animateur qui passe à l'antenne**.

**Décisions (8).** Abandon complet du lien par mail ; réinitialisation conservée
en secours. Adresse masquée avec dévoilement temporaire, façon application
bancaire — l'animateur doit pouvoir vérifier sous quel compte il est. L'écran de
refus est conservé mais **reformulé** : après le passage au mot de passe avec
inscription fermée, il ne devient atteignable que dans un seul cas — un compte
légitimement créé mais absent de la liste autorisée. Son texte parlait d'intrusion
et d'un compte unique ; il doit désormais nommer la cause probable (un oubli de
configuration) et dire quoi faire.

**Réalisé.** `authErrors.js` réécrit (`passwordErrorMessage`, `resetErrorMessage`,
`masquerEmail`, traitement explicite de `weak_password`), tests unitaires réécrits,
`host-login.spec.js` ajusté. **Vous avez créé les deux comptes et fermé les
inscriptions vous-même** — aucun compte créé ni mot de passe saisi de mon côté.

**Renoncement assumé.** La protection contre les mots de passe compromis
(vérification auprès de HaveIBeenPwned) est réservée aux plans payants de
Supabase. Décision du 2026-08-20 : on s'en passe.

---

## Action 10 — Deux comptes animateur, cloisonnement, migrations

**En réunion (CR#1).** R.M.A indique que seule son adresse fonctionne et qu'il
ajoutera celle de Theodore. Formulé comme une ligne de configuration — c'était une
question de modèle. Vous avez ensuite tranché : deux comptes, **deux bibliothèques
différentes**, sans partage.

**Diagnostic — partiellement faux, et corrigé par le constat réel.** Le plan
supposait un schéma absent et un studio n'inscrivant pas le propriétaire. La base
a dit autre chose :

- Le schéma, les politiques d'accès et les index sont **corrects et complets**.
  `owner_id` prend même `auth.uid()` par défaut — l'hypothèse du propriétaire
  laissé vide était erronée.
- Une migration **avait bel et bien été appliquée** ; c'est son **fichier** qui
  n'avait jamais été versionné. F-006 n'était pas un schéma absent mais un dépôt
  muet.
- La table `modules` est **vide** : rien n'y a jamais été écrit. Le blocage était
  entièrement côté client, et il était double.

**Les deux causes réelles du lien studio-jeu rompu :** le Studio appelait
`/api/banks` **sans aucun en-tête d'autorisation** — en développement ça passait,
en production le serveur répondait 403 et l'enregistrement basculait
silencieusement en « local » ; et le chemin Supabase n'est emprunté que si une
session existe dans le navigateur, or `/studio` n'a aucun écran de connexion.

**Décisions (12).** Liste d'adresses autorisées, **en conservant le nom de
variable actuel** — une seule adresse reste une liste d'un élément. Stockage
cloisonné avec **un fichier par compte**, et non un fichier unique : le fichier
est réécrit en entier à chaque enregistrement, deux studios enregistrant en même
temps s'écraseraient. Constat préalable de l'état réel des tables autorisé.
Migrations additives et rejouables, jamais destructives. Politiques écrites et
vérifiées **avant** activation. Renoncement au pilotage du même salon à deux.

**Réalisé.** `HOST_EMAIL` accepte une liste séparée par des virgules.
Cloisonnement disque livré avec l'action 2. La migration a été **récupérée verbatim
depuis l'historique de la base elle-même** plutôt que reconstituée — elle
contenait un déclencheur de création de profil qu'une reconstitution de mémoire
aurait manqué. Durcissement appliqué en production : la fonction de création de
profil était appelable publiquement avec des privilèges élevés ; le droit
d'exécution a été retiré aux rôles `anon` et `authenticated`.

---

## Action 11 — Vérification de bout en bout

**En réunion (CR#1).** R.M.A évoque une « phase de cohérence » et une « phase de
vérification à venir » sur le studio.

**Diagnostic.** Le projet avait onze vérifications de bout en bout — connexion,
arrivée du joueur, déroulé d'une partie, stream, studio. **Aucune ne reliait les
deux.** Il n'existait pas une seule vérification qui enregistre une question dans
le studio puis contrôle qu'elle est posée en partie. C'est précisément le maillon
cassé, et personne ne l'avait vu **parce que rien ne le regardait**.

**Décisions (5).** Le scénario central est écrit **d'abord, et vu échouer**, avant
toute correction — un contrôle qui n'a jamais échoué ne prouve rien. Pas de liste
de contrôle manuelle : les vérifications qu'aucune machine ne peut faire (le QR
qui se scanne vraiment, la vitesse de défilement, le ton des phrases) retombent
sur l'implémentation, une fois, comme étapes des actions concernées.

**Réalisé.** `studio-to-game.spec.js` écrit, **vu échouer**, puis vu passer à la
livraison de l'action 2.

La décision 3 (vérification automatique du mode Supabase avec base dédiée) est
devenue **sans objet** : la simplification de l'action 2 fait qu'il n'y a plus
qu'un seul mode de stockage.

**Un piège découvert en chemin** : `POST /api/rooms` redonne à l'animateur son
salon encore ouvert. Un test qui ne clôt pas son salon lègue au suivant une partie
en cours — d'où `tests/e2e/cloture.js`, appelé après chaque test même en cas
d'échec. Bénéfice annexe : la suite est passée de 56 à 21 secondes.

---

## Action 12 — Restitution des résultats au joueur

**En réunion (CR#2).** « Manche jouée sans toi » affiché alors que le joueur a
participé ; score individuel qui ne reflète pas la réalité ; sur mobile, écrans de
résultats erronés et malus inexpliqués, apparaissant et disparaissant de façon
aléatoire.

**Diagnostic — ce n'est pas quatre bugs, c'en est un seul.** Quand un joueur se
reconnecte, le serveur lui rejoue la question et la révélation, **mais jamais son
résultat personnel**. Or l'écran de résultat décide de ce qu'il affiche uniquement
sur la présence de cette donnée : absente, il conclut que le joueur est arrivé
après le lancement.

Le reste en découle. Le score du téléphone est une copie locale que la reconnexion
ne rafraîchit jamais. Au lancement d'une manche, le client remet à zéro la
question, la révélation et la répartition — **mais pas le résultat personnel** :
le bonus et le malus de la manche précédente survivent à l'écran. Et **pourquoi
seulement sur mobile, de façon aléatoire** : Safari iOS suspend les onglets en
arrière-plan et coupe les connexions temps réel ; chaque verrouillage d'écran
provoque une reconnexion. Un joueur mobile déclenche le défaut plusieurs fois par
partie, un joueur sur ordinateur presque jamais.

**Décisions (6).** Le serveur mémorise le dernier résultat de chaque joueur,
rattaché à la manche qui l'a produit — il le calculait déjà puis le jetait. Il le
rejoue à la reconnexion, **et seulement s'il correspond à la manche en cours**,
sinon on recréerait le bug qu'on corrige. **Trois situations à l'écran au lieu de
deux** : tu as répondu et voici ton résultat ; tu as répondu et le résultat n'est
pas tombé ; tu n'étais pas là. La vérification automatique **simule une vraie
coupure de connexion**, pas un simple rechargement.

**Réalisé.** `reconnexion-resultat.spec.js` (2 tests, coupure réseau réelle).

Écart trouvé à l'audit : la décision 5 n'était pas tenue — un joueur arrivé après
le lancement voyait un relevé à zéro au lieu du message adapté. Le serveur envoie
un relevé à **tous les connectés**, y compris aux non-participants, et l'écran se
fiait à sa présence plutôt qu'à sa participation réelle. Corrigé : c'est désormais
la participation qui décide.

---

## Action 13 — Estimation : paliers de précision et histogrammes

**En réunion (CR#2).** La base de calcul reste parfois bloquée ; une très bonne
réponse ne rapporte pas plus qu'une approximative ; les écarts de points ne
représentent pas la précision. Theodore rappelle que le système devait fonctionner
par plages (10 %, 20 %, 30 %). Demande également de revoir « le graphique
d'affichage ».

**Diagnostic — trois défauts.**

1. **La précision rapporte très peu** : sur une cible de 100, répondre exactement
   rapporte à peine 11 % de plus que répondre 90.
2. **La vitesse pèse plus lourd que la précision.** Concrètement : une réponse
   **exacte mais tardive vaut 850 points, une réponse à 10 % près mais immédiate
   en vaut 900**. Le plus juste perd contre le plus rapide — l'inversion exacte de
   ce que le jeu prétend récompenser.
3. **Le comportement dépend de la taille du nombre.** Sur une cible d'un million,
   se tromper de cent mille compte pour 10 % : tout le monde décroche presque le
   maximum et les scores se tassent — c'est la « base bloquée ». Sur une cible
   de 3, répondre 6 vaut zéro.

**Point de la discussion non confirmé par le code** : aucun mécanisme ne pénalise
une réponse trop rapide. La perte de points évoquée venait soit du malus de
mauvaise réponse, soit du deuxième défaut vécu à l'envers.

**Sur le graphique** : la maquette animateur spécifie un histogramme à huit barres
avec minimum, moyenne, maximum et total. **Il n'avait jamais été construit** —
l'écran affichait trois chiffres, et le serveur ne calculait même pas les tranches.
Aucun histogramme n'a jamais été dessiné dans les maquettes joueur, cohérent avec
le principe rappelé en réunion.

**Décisions (12).** Paliers : ≤ 2 % → 1000 points ; ≤ 10 % → 750 ; ≤ 20 % → 500 ;
≤ 30 % → 250 ; au-delà → zéro. **Aucune composante de rapidité** — ni supplément
du plus rapide, ni modulation à l'intérieur du palier : l'estimation est le seul
module où la précision est le sujet, y récompenser la vitesse rouvrirait le défaut
qu'on corrige. **Tolérance absolue d'une unité** en plus de la tolérance relative,
qui règle les petits nombres sans rien changer aux grands. Histogramme sur l'écran
animateur et sur le stream — **pas chez le joueur**, conformément à votre
arbitrage. Les valeurs aberrantes sont ramenées dans les barres d'extrémité, sinon
un plaisantin qui tape un nombre absurde efface la répartition réelle.

**Réalisé.** `PALIERS_ESTIMATION`, `TOLERANCE_ABSOLUE`, `histogrammeNumerique`.
`estimation.spec.js` plus 7 tests unitaires — sur une **cible d'un million**, une
**cible à un chiffre** et une **valeur aberrante**, pas sur un cas moyen
confortable.

---

## Action 14 — Jauge et couleurs de la répartition (écran animateur)

**En réunion (CR#2).** La jauge n'est pas correctement affichée sur l'écran
animateur pour le vrai/faux ; la couleur de la mauvaise réponse devrait être
améliorée, elle ne doit pas se remplir en rouge.

**Diagnostic — un seul défaut, deux symptômes, plus un troisième non signalé.**
Le système de design pose un contrat explicite : l'animation pousse la barre de
zéro jusqu'à une valeur nommée, à renseigner par l'intégration. Toutes les
maquettes la renseignent, le stream la renseigne. **L'écran animateur ne la
renseigne pas** : l'animation retombe sur sa valeur par défaut (100 %) et,
conservant son état final, **écrase la largeur réelle — toutes les barres
finissent pleines.**

Deux barres pleines côte à côte ne disent rien, d'où l'évidence du défaut sur le
vrai/faux qui n'en a que deux. Et « en rouge » : à la révélation, les barres non
gagnantes passent en teinte de braise ; pleines sur toute la largeur, elles se
lisent comme une sanction. **Troisième défaut non signalé** : la largeur était
calculée par rapport à l'option la plus choisie, pas au total — l'option de tête
était donc toujours à 100 %, alors que l'étiquette à côté affichait un pourcentage
du total.

Mesuré avant correction : **une option que personne n'avait choisie affichait une
barre de 782 pixels, pleine.**

**Décisions (5).** Rétablir le contrat d'animation. Dimensionner par rapport au
total, pour que la barre et son étiquette racontent la même chose. **Conserver la
braise** — écart volontaire par rapport aux maquettes, qui prévoyaient un neutre :
la plainte portait sur une barre qui se remplissait entièrement, pas sur la
teinte, et une fois la largeur juste la braise redevient une couleur de la palette
et non un verdict. Balayer le reste de l'application à la recherche du même oubli.
L'étiquette chiffrée reste affichée même sans barre.

**Réalisé.** `jauge-repartition.spec.js` (2 tests, géométrie mesurée).

---

## Action 15 — Suppression du bouton « quitter »

**En réunion (CR#2).** Supprimer le bouton « quitter » pour les joueurs, jugé
inutile et source de confusion, afin d'éviter les problèmes de reconnexion et de
noms déjà utilisés.

**Diagnostic.** Le bouton **n'efface que la session locale, sans prévenir le
serveur**. Le joueur reste inscrit dans le salon avec son pseudo et son score,
mais a perdu le jeton qui lui permettait d'y revenir. S'il tente de rejoindre avec
le même pseudo, le serveur le refuse — **son pseudo est occupé par lui-même.**

Et le bouton « Rejouer » de l'écran de fin appelle exactement la même fonction :
**le bouton qui promet de rejouer est celui qui empêche de rejouer.**

Le bouton n'a par ailleurs aucun usage légitime : la session est déjà rattachée à
un salon précis, fermer l'onglet suffit, et une session périmée est purgée toute
seule.

**Décisions (4).** Suppression du bouton sur les trois écrans où il apparaît.
Suppression du bouton « Rejouer » et de sa fonction destructrice. Après le podium,
le joueur ne fait rien et attend : quand l'animateur relance, le serveur ramène
tout seul les joueurs au salon. Le changement de pseudo en cours de partie est
écarté définitivement.

**Réalisé.** `fin-de-partie-joueur.spec.js` (2 tests).

---

## Action 16 — Menu « changer de module » sans défilement

**En réunion (CR#2).** Demander que la fenêtre modale s'ouvre au-dessus de la page
sans défilement pour l'animateur lors du changement de module.

**Diagnostic.** Le menu est **déjà** une surcouche positionnée au-dessus du reste.
Le problème est la **direction** : il se déploie vers le bas à partir d'un bouton
situé dans la barre d'actions, tout en bas de l'écran. Il part donc sous le pied
de la page. Mesuré : le bas du menu se situait à **886 pixels pour une fenêtre de
656** — il dépassait de 230 pixels sous le pli.

**Décisions (6).** Ouverture vers le haut : la barre d'actions est
structurellement le dernier élément de l'écran, il y a toujours de la place
au-dessus, et le comportement est prévisible — ce qui compte en direct. **Pas de
vraie fenêtre modale centrée**, malgré le mot du compte rendu : elle masquerait la
répartition et le classement au moment précis où l'animateur fonde son choix
dessus. Hauteur bornée avec défilement interne, en prévision de l'action 2 : faire
défiler une liste dans un menu est normal, faire défiler la page ne l'est pas.

**Réalisé.** `menu-module.spec.js` (2 tests, géométrie mesurée).

**Piège traité** : les deux menus de l'animateur partagent une classe mais **pas
la même barre** — celui de sortie est en haut, celui des modules en bas.
Renverser la classe partagée aurait cassé le premier ; une variante a été posée.

---

## Action 17 — Lisibilité du calcul des points

**En réunion (CR#2).** Le multiplicateur de série n'apporte pas toujours le bonus
attendu ; le calcul des points manque de clarté.

**Diagnostic.** Le bonus de série est **correctement calculé et appliqué** : +50 à
la deuxième bonne réponse consécutive, +100 à la troisième, plafonné à 250. Rien
ne décale. Le défaut est double :

1. **Le bonus de série est fusionné avec celui de vitesse, sous une étiquette qui
   ment.** Un joueur en série de trois qui n'a pas été le plus rapide voit « Bonus
   vitesse : +100 » alors qu'il n'a pas été rapide. **Le bonus est versé — il est
   invisible, rangé sous le nom d'un autre.**
2. **La notation contredit la mécanique.** L'écran affiche « ×3 », ce qui se lit
   comme un triplement ; c'est une addition forfaitaire. **Le malentendu vient de
   l'écran, pas de Theodore.**

**Votre arbitrage.** J'avais proposé de conserver un multiplicateur. Vous avez
refusé : « il faut juste dire *Points complémentaires de vitesse*, et ensuite
*Série de bonnes réponses* pour suivre le nombre de bonnes réponses d'affilée,
sans multiplicateur. C'est juste de l'information. » C'est votre formulation qui a
été retenue, et elle s'est imposée à tous les modules — la série est devenue une
information, et « Complément de vitesse » le libellé unique.

**Décisions (8).** Décomposition honnête, **à totaux inchangés** : base fixe de
700 points pour une bonne réponse, puis jusqu'à 300 points complémentaires selon
la rapidité, plus 150 pour le plus rapide de la manche — exactement les chiffres
d'avant, simplement dits en vérité. Sur l'estimation et le vote, pas de complément
de vitesse : l'écran n'affiche qu'une ligne. Les lignes ne s'affichent que
lorsqu'elles valent quelque chose.

**Réalisé.** `BASE_BONNE_REPONSE = 700`, `COMPLEMENT_VITESSE_MAX = 300`.
`bareme.spec.js`, unitaires et boucle d'intégration réécrits — les tests comparent
explicitement les totaux avant/après, hors série et malus.

---

## Action 18 — Le vote devient un jeu

**En réunion (CR#2).** Le module vote ne rapporte pas de points et sert uniquement
à choisir la suite de la soirée. Theodore propose d'en refaire un jeu où faire
partie de la majorité rapporterait des points, et d'ajouter la possibilité pour
l'animateur de créer ses propres questions de sondage.

**Diagnostic.** Le vote est explicitement hors barème : cent points forfaitaires
par participant, aucune notion de bonne réponse. La répartition est déjà calculée
et diffusée. **Tout est en place sauf la décision : il manque de désigner un
gagnant.**

Quant à la création de questions de sondage, **elle existe déjà** : le studio
permet de créer des modules de vote avec énoncé et options, et refuse d'enregistrer
en dessous de deux options remplies. Si Theodore a eu l'impression que ça manquait,
c'est le symptôme du lien studio-jeu rompu que l'action 10 répare.

**Décisions (7).** La majorité l'emporte : l'option la plus choisie devient la
bonne réponse. **En cas d'égalité entre deux options en tête, les deux camps
gagnent** — sinon une égalité parfaite ne produirait aucun vainqueur. Pas de
malus : être minoritaire n'est pas une faute, c'est un pari perdu. **Pas de
complément de vitesse** — dans les autres jeux la rapidité mesure une maîtrise ;
ici elle ne mesure rien, et pousserait à cliquer avant d'avoir lu. **Un
interrupteur sondage ou jeu, par question** : un vote noté n'est plus un sondage —
le joueur répond ce qu'il croit que les autres vont répondre, et on perdrait
l'outil qui permet de demander sincèrement à la salle ce dont elle a envie.

**Réalisé.** Le serveur calcule l'ensemble des options gagnantes (tous les indices
à égalité au maximum) et honore l'interrupteur de sondage. `vote.spec.js` plus
unitaires : majorité nette, égalité parfaite, sondage non noté.

---

## Action 19 — Nom et identité du jeu

**En réunion (CR#2).** Plusieurs noms proposés — « Game Show », « Fire Game
Show », « Le Feu de Camp » — avec une préférence pour un nom chaleureux et
évocateur ; discussion sur la disponibilité des noms de domaine.

**Diagnostic.** Le nom provisoire était présent dans les titres de page, la carte
sociale de partage, le bloc de marque du stream, le paquet, le service de
déploiement, et le dépôt GitHub — **qui s'appelle d'ailleurs déjà `GameShow`, ce
que personne n'avait jamais remarqué**, preuve de l'insignifiance de cet
identifiant.

Le domaine n'est pas qu'une affaire de marque, **c'est une contrainte de design** :
l'adresse s'affiche sur le stream, dans la pastille qu'on venait de réduire.
L'historique récent montre que le sujet avait déjà posé problème — lien qui se
coupe au mauvais endroit, lien qui sort du panneau. Un domaine court vaut une
lisibilité que rien d'autre ne rachètera.

**Décisions (6).** Préparer le terrain **sans attendre le nom** : rassembler le nom
visible en une valeur unique lue partout. Le paquet, le dépôt et le service de
déploiement restent inchangés — renommer le dépôt casserait les liens et le
déploiement pour zéro bénéfice. Le nom du service de déploiement se traitera
**avec** le domaine, puisque sur ce type d'hébergement il détermine souvent
l'adresse par défaut. Une vérification automatique échoue si le nom provisoire
réapparaît quelque part.

**Réalisé.** `src/client/shared/marque.js` — une seule ligne à changer le jour du
choix. `marque.test.js` vérifie la cohérence avec la page d'accueil, qui ne peut
pas lire ce fichier (elle est servie avant l'exécution du code).

**Reste à faire : le choix du nom et du domaine** — point ouvert O2, que vous avez
délibérément différé.

---

# Ce que l'audit final a trouvé

Les 167 décisions ont été confrontées une à une au code. **Cinq écarts**, tous
corrigés, tous rappelés ci-dessus dans leur action :

| Action | Décision | Écart |
| --- | --- | --- |
| 2 | 6 | Le bouton « restaurer les questions de base » n'avait jamais été posé dans le Studio |
| 7 | 3 | 125 phrases livrées pour ~200 annoncées ; 24 moments sur 34 sous quatre phrases |
| 7 | 11 | Aucune phrase de repli pour le joueur arrivé en cours de partie |
| 8 et 17 | 6 | L'énoncé du barème ne décrivait que le quiz |
| 12 | 5 | Un joueur arrivé après le lancement voyait un relevé à zéro |

**Ce que cela dit** : un plan complet n'empêche pas les oublis. Ces cinq
décisions étaient écrites, numérotées, entérinées — et non réalisées. Seule une
relecture décision par décision les a trouvées.

# Ce qui reste ouvert

- **O2 — le nom du jeu et le domaine.** Différé par vous. Le nom vit désormais en
  un seul endroit ; le jour du choix, il n'y a qu'une ligne à écrire, puis à
  régénérer la carte de partage et à vérifier l'affichage de l'adresse sur le
  stream à sa nouvelle longueur.
- **Hors périmètre, explicitement** : les pouvoirs spéciaux (action neuve le jour
  où les règles seront définies), le pilotage d'un même salon à deux animateurs,
  le changement de pseudo en cours de partie, l'édition des textes depuis le site.
