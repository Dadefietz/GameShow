---
artifact_type: plan_chantier
app: root
version: 4
change_set: forward
produced_by: plan-daction-reunion
created_at: 2026-08-21
created_by: R.M.A + Claude
status: validated
source_meetings: 1
actions_total: 11
actions_retained: 10
decisions_total: 72
effort_estimate_days: 7
---

# PLAN DE CHANTIER v4 — Project Game Show

> Référence d'implémentation issue du compte rendu de réunion du 2026-08-21
> (CR#5, Theodore et R.M.A.). **Chaque décision listée ici a été explicitement
> entérinée.** Rien ne doit être ré-arbitré pendant l'implémentation : en cas de
> doute, ce document fait foi.
>
> Il fait suite aux chantiers [v1](PLAN-CHANTIER-v1.md), [v2](PLAN-CHANTIER-v2.md)
> et [v3](PLAN-CHANTIER-v3.md). Leurs décisions restent en vigueur, **sauf les
> deux que celui-ci périme explicitement** — voir TR1 et la décision 4.8.

## Comment lire ce document

**72 décisions** : 70 numérotées sur onze actions, plus deux transversales. Une
action **mise de côté** avec sa condition de réouverture. Un **point ouvert**.

Chaque action suit la même structure : la problématique telle qu'elle a été
formulée, le diagnostic avec ses références de code et ses mesures, les décisions
entérinées — **numérotées, ce sont elles qui engagent** — les étapes, les
impacts, les risques avec leurs mitigations.

## Une précaution de méthode, propre à ce chantier

Le compte rendu porte la mention « Généré par l'IA. Veillez à vérifier
l'exactitude », et l'auteur a précisé que **les problèmes ne sont pas réglés**
alors que plusieurs recoupaient des décisions déjà livrées.

**Chaque défaut a donc été reproduit avant d'être analysé** — le geste réel, pas
une simulation. C'est ce qui a permis de trouver que les contrôles du chantier v1
simulaient une coupure réseau là où l'utilisateur appuie sur F5 : deux pannes
différentes, dont une seule était couverte.

**Un fait à connaître pour lire ce chantier.** Au moment de la réunion, le site
déployé servait le chantier **v2**, pas le v3 — vérifié par comparaison des
empreintes de fichiers construits. L'élément 21 du compte rendu décrit donc un
défaut **déjà corrigé mais pas encore en ligne**. Aucun autre élément n'est dans
ce cas.

---

# 1. Décisions transversales

**TR1 — Le classement ne circule vers les téléphones des joueurs qu'À LA FIN DE
PARTIE.** Pendant toute la partie — attente, question, révélation, entre deux
manches — il ne part jamais.

*Ce qu'elle périme.* Les actions 3+4+5 du chantier v1 posaient : « le classement
ne circule jamais vers les téléphones des joueurs ». La levée est **bornée à
l'écran de fin** et **ne vaut pas précédent** : ce qui était protégé, c'est le jeu
en cours, pour que personne ne joue en fonction de sa place. À la fin, il n'y a
plus rien à protéger.

**TR2 — Tout graphique du projet est gardé par un contrôle qui MESURE ses hauteurs
contre des effectifs connus**, sur toutes les surfaces où il est dessiné.

*Pourquoi elle existe.* Deux fois sur quatre chantiers, l'écran animateur a montré
un graphique faux quand le stream allait bien : jauge **entièrement pleine** à
l'action 14 du v1, histogramme **entièrement plat** ici. Dans les deux cas le
graphique était présent, visible, et faux. Un contrôle qui vérifie la présence
d'un élément ne voit ni l'un ni l'autre.

---

# 2. Chemin critique

## 2.1 Ordre d'exécution

| Ordre | Lot | Contenu | Ordre de grandeur |
|---|---|---|---|
| 1 | **Le joueur retrouve sa partie** | 1 → 3 → 2 → 10 | ~2,75 j |
| 2 | **Le barème** | 4 → 5 → 6 | ~2,5 j |
| 3 | **La console de l'animateur** | 7, 8, 9 | ~2 j |

**Environ 7 jours.**

## 2.2 Dépendances réelles

| Contrainte | Raison |
|---|---|
| **1 avant 3** | Sans session restaurée, il n'y a personne à qui rejouer l'état de fin |
| **3 avant 2** | Le classement ne peut pas s'afficher pour un joueur reconnecté si l'état de fin n'arrive pas |
| **2, 3 et 10 ensemble** | Même écran de fin — les séparer ferait passer trois fois au même endroit |
| **5 avant 6** | Le calcul du « plus proche » est **mutualisé** (décision 6.1) ; deux définitions finiraient par diverger |
| **4 avant 5** | Le tableau des maximums par module (4.9, 5.13) s'écrit une fois, complet |
| 7, 8, 9 | Indépendantes de tout le reste |

## 2.3 Justification de l'ordre

Le **lot 1** corrige ce qui casse le jeu **en direct** : un joueur qui recharge
perd tout — identité, score, place, écran de fin. C'est le grief le plus lourd du
compte rendu, et le seul qui rende une soirée injouable.

Le **lot 2** change des règles. Important, mais rien n'est cassé.

Le **lot 3** rend la console confortable. Sans urgence.

## 2.4 Jalons

- **Fin du lot 1** — un joueur recharge à chaque étape et retrouve son identité,
  son score et sa place ; un arrivant tardif se voit au classement ; aucune redite
  sur l'écran de fin.
- **Fin du lot 2** — totaux vérifiés au chiffre près, tableau des maximums
  consigné, nom du plus proche chez l'animateur et **jamais dans ce que reçoit le
  stream**.
- **Fin du lot 3** — histogramme mesuré proportionnel sur les deux écrans, énoncé
  en police d'interface, aller-retour vers le Studio **reproduit** sans perdre le
  salon.

## 2.5 Ce que la relecture d'ensemble a établi

**Aucune contradiction entre les 72 décisions.** Elles ont été relues d'un bloc en
les cherchant. Deux points méritaient examen et n'en sont pas : TR1 lève une règle
du v1 mais l'auteur l'a fait sciemment et bornée ; la décision 5.6 laisse une
estimation atteindre 1600 points quand un quiz plafonne à 950, déséquilibre
accepté en connaissance de cause.

**Aucune décision de ce chantier ne modifie les phrases du registre de voix.** La
4.6 change la *condition* d'un moment, pas son texte ; les paliers d'estimation
gardent leurs noms, donc leurs moments. **La liste des 181 textes déjà remise
reste valable** — c'est ce qui permet de mettre l'action 11 de côté sans bloquer
le travail de Theodore.

---

# 3. Actions

---

## Action 1 — Le rechargement éjecte le joueur · **RETENUE**

*Couvre les éléments 2, 3, 4 et 5.*

**Problématique initiale.** « l'actualisation de la page provoque des bugs,
notamment la perte de session ou l'affichage incorrect des scores » · « il n'est
pas possible de se reconnecter avec le même pseudo après déconnexion » ·
« Lorsqu'on actualise la page on est éjecté du jeu ou alors on n'a plus les
écrans de résultats aux question » · « n'a plus non plus accès au résultat final
(podium) à la fin de la partie ».

### Diagnostic

**Reproduit dès le premier essai**, et plus tôt qu'attendu : un F5 en **salle
d'attente**, avant toute question, renvoie déjà le joueur au formulaire.

La cause tient en deux lignes (`PlayApp.jsx:995`) :

```js
const urlCode = (params.get('code') || '').trim();
const stored  = urlCode ? store.load('play:' + urlCode) : null;
```

La session est enregistrée sous `play:<CODE>` et la restauration lit ce code
**dans l'URL**. Or `handleJoin` met le code dans l'état React — **jamais dans
l'URL**.

**Le défaut dépend donc du chemin d'entrée :**

| Chemin | URL | Rechargement |
|---|---|---|
| QR code du stream | `/play?code=XXXX` | **restaure** |
| Code tapé au formulaire | `/` | **éjecte** |

C'est le chemin de quiconque lit le code sur le stream et le tape — la majorité.

**Un seul défaut, quatre symptômes**, qui s'enchaînent mécaniquement :

1. Éjecté, le joueur retape son code et son pseudo ;
2. le serveur refuse — `409 pseudo-taken` (`index.js:104`) — **parce que sa propre
   inscription est encore dans le salon** ;
3. il invente un autre pseudo : c'est un **nouveau joueur**, score à zéro ;
4. n'ayant pas participé aux manches précédentes, il n'a **ni écrans de résultats
   ni place au podium**. « L'affichage incorrect des scores » en est le cinquième
   maillon : le score affiché est celui du nouveau joueur.

**Pourquoi l'action 12 du chantier v1 ne l'a pas vu.** Ses deux contrôles simulent
une **coupure Socket.IO** — la page reste en mémoire, l'état React survit. Un
**rechargement** détruit tout. Deux pannes différentes ; une seule était traitée.

**Les deux autres surfaces sont saines**, vérifié : l'animateur stocke sous une clé
fixe (`'host'`), le stream porte son jeton en query. Le joueur est la seule
surface dont la restauration dépend d'une donnée que l'application ne met jamais
dans l'URL.

### Décisions entérinées

1. **Le code de salon est écrit dans l'URL** quand le joueur rejoint
   (`history.replaceState`, sans ajouter d'entrée à l'historique). Les deux
   chemins d'entrée produisent alors la même adresse.
2. **Repli** : à défaut de code dans l'URL, la session est reprise si le stockage
   n'en contient **qu'une seule**. En cas d'ambiguïté — plusieurs salons rejoints
   depuis le même navigateur — rien n'est deviné.
3. **Le refus du pseudo déjà pris est maintenu.** Autoriser la reprise ouvrirait
   l'usurpation d'un pseudo lu sur le stream. Le message d'erreur dira enfin
   pourquoi.
4. **Le choix de réponse non révélé n'est pas restauré** après rechargement.
   *Arbitrage de l'auteur : « pas grave ».*
5. **Contrôle : rechargement RÉEL** à chaque étape — attente, question posée,
   question répondue, résultat révélé, entre deux manches, podium. Jamais une
   coupure simulée.
6. Le contrôle vérifie l'**identité, le score et la place**, jamais la seule
   présence d'un écran.
7. Le rechargement est éprouvé sur les **trois surfaces**, pas seulement le joueur.
8. Les deux contrôles de coupure réseau de l'action 12 du v1 sont **conservés** :
   ils couvrent une panne distincte et réelle, celle du téléphone en veille.

### Étapes

1. Poser le code dans l'URL à l'inscription. *≈ 1 h.*
2. Repli sur la session unique en stockage. *≈ 1 h.*
3. Message d'erreur du pseudo occupé, qui nomme la cause. *≈ 30 min.*
4. Contrôles de rechargement, six étapes, trois surfaces. *≈ 4 h.*

### Impacts

Le joueur retrouve sa partie. Le code de salon devient visible dans la barre
d'adresse — sans conséquence, il est déjà sur le stream à l'intention de tous.
Aucun impact sur le serveur, les scores ou le moteur.

### Risques et mitigations

- *Croire le défaut réglé parce qu'un écran s'affiche* → le contrôle vérifie
  identité et score (décision 6).
- *Corriger le joueur et laisser les autres surfaces* → décision 7.
- *Le repli qui choisit le mauvais salon* → décision 2, une seule session ou rien.

**Charge : ≈ 1 j.**

---

## Action 2 — Le classement sur l'écran de fin · **RETENUE**

*Couvre l'élément 22.*

**Problématique initiale.** « quand un joueur rejoint la partie en cours de route,
il doit être classé sur le podium et se voir sur le podium » — précisé en séance :
**« Enfin sur le classement. »**

### Diagnostic

**Le serveur ne filtre personne.** `leaderboard()` (`rooms.js:103`) prend tous les
joueurs du salon, les trie, les numérote. Ni score minimal, ni date d'arrivée. Un
joueur arrivé à la troisième manche y est, à sa place. **Le stream l'affiche
déjà.**

**Ce qui manque est plus large que le cas signalé : l'écran de fin du joueur n'a
aucune liste de classement.** Il affiche un chiffre — « Ton rang final : 4ᵉ » — et
rien d'autre (`PlayApp.jsx:912`). Personne ne « se voit sur le classement » depuis
son téléphone. Ce n'est pas un défaut du joueur tardif : c'est un écran qui
n'existe pas.

**Deux découvertes en reproduisant**, absentes du compte rendu :

**Le classement disparaît quand personne ne marque.** La condition est
`scored = podium.filter(score > 0)` où `podium` **ne contient que les trois
premiers**. Sans malus depuis T1, une partie où chacun se trompe finit ainsi — la
reproduction l'a produite du premier coup.

**« Victoire » s'affiche à un joueur à zéro point.** `PlayApp.jsx:909` :
`rank === 1 ? 'Victoire'`, sans vérifier que quelqu'un ait marqué. L'écran annonce
donc « VICTOIRE » en titre et « personne n'a marqué » trois lignes plus bas —
contradiction sur le même écran, interdite par la décision 8 de l'action 7 du v1.

### Décisions entérinées

1. **L'écran de fin du joueur affiche le classement**, sa propre ligne distinguée.
2. **La condition d'affichage regarde le classement complet**, pas les trois
   premiers.
3. Une partie où **personne n'a marqué** affiche quand même le classement, tous à
   égalité à zéro.
4. **Aucun titre de victoire sans point marqué** : le titre ne contredit pas les
   chiffres affichés en dessous (décision 8 de l'action 7 du v1).
5. Contrôle : un joueur **arrivé en cours de partie** apparaît au classement, à sa
   place, sur son propre écran de fin.
6. Contrôle : une partie sans point marqué affiche un classement **cohérent avec
   son titre**.
7. La liste **défile dans son bloc**, jamais la page.
8. **Balayage des écrans de fin**, à la recherche d'un autre titre contredisant ses
   propres chiffres.

### Étapes

1. Afficher le classement sur l'écran de fin, ligne du joueur distinguée. *≈ 3 h.*
2. Corriger la condition d'affichage. *≈ 30 min.*
3. Aligner le titre sur la réalité. *≈ 30 min.*
4. Contrôles. *≈ 2 h.*

### Impacts

TR1 s'applique : la règle de confidentialité change de portée, bornée à l'écran de
fin. Aucun impact sur le serveur, les scores ou le moteur.

### Risques et mitigations

- *La levée qui glisse vers le pendant de la partie* → TR1 l'écrit comme bornée et
  sans précédent.
- *Une liste longue sur petit écran* → décision 7.
- *Un autre titre qui ment ailleurs* → décision 8.

**Charge : ≈ 0,75 j.**

---

## Action 3 — L'état de fin rejoué, et le partage rendu à tous · **RETENUE**

*Couvre les éléments 23 et 24.*

**Problématique initiale.** « tout le monde n'a pas l'option de partage » · « la
personne qui a actualisé en pleine partie n'a même pas d'écran final pour le
résultat ».

### Diagnostic

Le bouton de partage est conditionné par `ranked` (`PlayApp.jsx:973`) — la même
variable fausse que l'action 2 vient d'établir. Mais `scored.length > 0` est
**global** : il ne peut pas expliquer une différence **entre joueurs**, que
l'auteur a pourtant constatée — « un bouton présent chez certains et absent chez
d'autres ».

**C'est donc `rank` qui manque à certains. Et voici pourquoi.**

Le bloc de reconnexion (`index.js:320`) est **tout entier à l'intérieur d'un
`if (cur)`** — s'il n'y a pas de manche en cours, rien n'est rejoué. Une partie
terminée n'a plus de manche en cours.

**L'état de fin de partie n'est donc jamais rejoué à la reconnexion.** Ni podium,
ni classement, ni rang final. C'est la cause commune du bouton absent **et** de
l'absence d'écran final après actualisation.

**Le mécanisme de partage, lui, est sain** : `navigator.share` sur téléphone,
repli sur le presse-papiers ailleurs. Ce qui manque n'est jamais la fonction,
c'est le bouton.

### Décisions entérinées

1. **Le bouton de partage est découplé** de la condition de classement : offert à
   chaque joueur en fin de partie, quels que soient son score et sa place.
   *« Les joueurs sont libres de faire ce qu'ils veulent. »*
2. Sans classement, la carte partagée dit le **salon et le nombre d'épreuves**,
   jamais un rang absent.
3. **L'état de fin de partie est rejoué à la reconnexion** — podium, classement,
   rang final. Le bloc de reconnexion ne doit plus dépendre de l'existence d'une
   manche en cours.
4. Contrôle : le bouton est présent pour **chaque** joueur — gagnant, à zéro,
   arrivé en cours de route, **et reconnecté après la fin**.

### Étapes

1. Sortir la reprise de l'état de fin du `if (cur)`. *≈ 2 h.*
2. Découpler le bouton de partage. *≈ 30 min.*
3. Texte partagé sans rang. *≈ 1 h.*
4. Contrôles. *≈ 1 h.*

### Impacts

Un joueur qui recharge après la fin retrouve son podium — c'est l'élément 23, dont
la correction se joue **ici** et non dans l'action 1 : ce n'est pas la session du
joueur qui manquait, c'est le serveur qui ne renvoyait rien.

### Risques et mitigations

- *Croire l'élément 24 réglé par la seule correction de condition* → la décision 3
  traite la vraie cause.
- *Partager une carte vide* → décision 2.

**Charge : ≈ 0,5 j.**

---

## Action 4 — Le complément de vitesse ramené à 250 · **RETENUE**

*Couvre l'élément 20.*

**Problématique initiale.** « Réduire le bonus de vitesse maximal à 250 points pour
équilibrer le score par rapport à la base de 700 points. » *(Theodore)*

### Diagnostic

Rien n'est cassé : c'est un **changement de règle**. Barème actuel
(`modules.js:35`, `engine.js:28`) : base 700, complément 0 à 300, supplément au
plus rapide +150 — maximum **1150** par manche.

**Le joueur ne voit qu'une ligne**, « Complément de vitesse », qui additionne le
complément et le supplément — jusqu'à 450. D'où l'ambiguïté levée en séance.

**Ce que ce changement périme.** La décision 3 de l'action 17 du v1 posait une
décomposition **à totaux inchangés**. Descendre à 250 rompt cette propriété.

### Décisions entérinées

1. Le complément de vitesse maximal passe de **300 à 250** points.
2. **Le supplément de 150 au plus rapide est supprimé** du calcul.
3. Maximum par manche sur quiz et vrai/faux : **950** points (700 + 250).
4. **L'estimation devient le module au maximum le plus élevé** — 1000 contre 950.
   *Accepté par l'auteur.*
5. **Le plus rapide reste désigné, comme information et non comme points** — même
   traitement que la série (T3 du v1). Le serveur transmet un drapeau.
6. Le moment de voix `juste.plus-rapide` s'adosse à ce **drapeau**, plus à un seuil
   de points. *Décidé sans consulter l'auteur : le précédent T3 ne laissait pas
   d'autre réponse raisonnable.* Sans cela, `speed >= 150` (`PlayApp.jsx:590`)
   ferait dire « Le plus rapide du cercle » à qui répond vite sans être premier —
   ce qu'interdit la décision 8 de l'action 7 du v1.
7. L'**énoncé du barème** présenté au joueur est mis à jour pour les quatre jeux.
8. La propriété « décomposition à **totaux inchangés** » de la décision 3 de
   l'action 17 du v1 est **périmée**, et consignée comme telle.
9. Contrôle : totaux vérifiés au chiffre près ; **tableau des maximums par module**
   consigné.

### Étapes

1. Ajuster les constantes. *≈ 30 min.*
2. Drapeau du plus rapide, et condition de voix qui s'y adosse. *≈ 1 h.*
3. Énoncé du barème, quatre jeux. *≈ 1 h.*
4. Contrôles et tableau des maximums. *≈ 1 h.*

### Impacts

Les scores baissent d'au plus 200 points par manche. Le classement devient moins
sensible à la rapidité — c'est l'intention.

### Risques et mitigations

- *Changer la constante et oublier l'énoncé* → étape 3, dans le plan.
- *La voix qui ment sur le plus rapide* → décisions 5 et 6.

**Charge : ≈ 0,5 j.**

---

## Action 5 — Les règles de l'estimation · **RETENUE**

*Couvre les éléments 14 à 18.*

**Problématique initiale.** « lorsqu'un joueur est dans les bonnes plages (10 %,
20 %, 30 %), il obtient les points correspondants, sans modification de cette
règle » · « Le joueur le plus proche gagne un bonus de 400 points » · « les plages
doivent être plus restrictives lorsqu'il s'agit d'année à trouver […] pouvoir
préciser dans la création de la question lorsque la réponse est une année » ·
« Un bonus d'exactitude de 200 points […] en plus des points de la plage » ·
« adapter la règle en fonction du nombre de joueurs ».

### Diagnostic

Barème actuel (`modules.js:64`) : ≤ 2 % → 1000, ≤ 10 % → 750, ≤ 20 % → 500,
≤ 30 % → 250, au-delà 0. Plus une **tolérance absolue d'une unité**, et aucune
composante de vitesse.

**Les années : le compte rendu a raison, et le chiffre le prouve.** Sur une cible
de 1789, 2 % valent **±36 ans**. Répondre 1753 tombe « au mille » et rapporte
1000 points — le premier palier est trois fois plus large que le siècle. La
tolérance absolue d'une unité ne change rien à cette échelle.

**Le cumul dépasse largement le quiz.** Un joueur exact, au premier palier et le
plus proche toucherait **1600 points** contre 950 au quiz.

**L'adaptation au nombre de joueurs n'a pas été décidée en réunion** — le compte
rendu dit « ils ont discuté de la nécessité ». Elle devient **point ouvert O-A**.

### Décisions entérinées

1. Les **paliers relatifs restent inchangés** : ≤ 2 % → 1000, ≤ 10 % → 750,
   ≤ 20 % → 500, ≤ 30 % → 250, au-delà 0.
2. La **tolérance absolue d'une unité** est conservée (décision 5 de l'action 13
   du v1).
3. **Bonus du plus proche : 400 points** au joueur dont la réponse est la plus
   proche, **même si personne n'est dans une plage**.
4. En cas d'**égalité**, tous les joueurs à distance identique touchent le bonus —
   même principe que l'égalité au vote (décision 2 de l'action 18 du v1).
5. **Bonus d'exactitude : 200 points** si la valeur saisie est exactement la cible,
   **en plus** des points de la plage.
6. Les bonus **se cumulent, sans plafond** : exact + premier palier + plus proche
   = **1600 points**. *Accepté par l'auteur, en connaissance de l'écart avec les
   950 du quiz.*
7. La **nature de la réponse** est déclarée à la création dans le Studio :
   **nombre** (plages relatives) ou **année** (plages absolues).
8. Plages des **années**, en écart absolu : exact → 1000, ±2 ans → 750, ±5 ans →
   500, ±10 ans → 250, au-delà 0.
9. La nature est **déclarée, jamais devinée** de la valeur : 1789 peut être un
   nombre d'habitants.
10. Les questions existantes, sans nature, restent en **plages relatives**. Aucune
    migration.
11. L'**énoncé du barème** décrit les deux jeux de plages.
12. Contrôle : cible d'un million, cible à un chiffre, **cible en années**, valeur
    aberrante, **égalité au plus proche**, personne dans aucune plage.
13. **Tableau des maximums par module** consigné.

### Étapes

1. Bonus du plus proche, avec sa règle d'égalité. *≈ 2 h.*
2. Bonus d'exactitude. *≈ 1 h.*
3. Nature « année » au Studio, et son jeu de plages. *≈ 4 h.*
4. Énoncé du barème, deux jeux de plages. *≈ 1 h.*
5. Contrôles. *≈ 3 h.*

### Impacts

Le Studio gagne un champ à la création d'une question d'estimation. Le barème
change à nouveau, un chantier après l'action 13 : les scores ne seront comparables
ni à ceux d'avant, ni à ceux d'aujourd'hui.

### Risques et mitigations

- *Les questions existantes traitées comme des années par erreur* → décision 9.
- *Le bonus du plus proche à deux joueurs, acquis d'avance* → point ouvert O-A.
- *Un énoncé de barème qui ne suit pas* → décision 11.

**Charge : ≈ 1,5 j.**

---

## Action 6 — Le nom du plus proche, chez l'animateur seul · **RETENUE**

*Couvre l'élément 19.*

**Problématique initiale.** « afficher le nom du joueur ayant donné la réponse la
plus proche sur l'écran de l'animateur, avec une liste si plusieurs joueurs sont
concernés, tout en préservant l'anonymat sur l'écran du Stream ».

### Diagnostic

Le serveur trouve déjà la réponse la plus proche (`modules.js:239`) — mais n'en
garde que **le nombre**, pas qui l'a donnée. Et cette valeur part dans `stats`,
**diffusé à tout le salon**, stream compris.

**Le projet a déjà résolu ce problème une fois** : la décision 8 de l'action 6 du
v1, pour la file d'attente — « la seule donnée de l'application qui révèle les
questions à venir ; elle n'a rien à faire dans une source capturée par OBS ». Le
nom du plus proche est le second cas de cette famille.

### Décisions entérinées

1. Le serveur désigne **le ou les joueurs** les plus proches, pas la seule valeur.
   Calcul **mutualisé** avec le bonus de la décision 5.3.
2. Les noms partent sur le **canal animateur seul**, jamais sur le canal partagé
   avec le stream.
3. Les `stats` publiques gardent la **valeur**, sans nom.
4. L'écran animateur affiche une **poignée de noms, plus un « + »** qui déplie les
   autres.
5. Chaque nom est affiché **avec sa valeur** : « Loula · 1 750 ».
6. Affichage **à la révélation seulement**, jamais pendant que les réponses
   arrivent.
7. Contrôle : le nom apparaît chez l'animateur et **n'apparaît pas dans ce que le
   stream reçoit** — vérifié sur la trame réseau, pas sur l'écran.

### Étapes

1. Désigner les joueurs les plus proches — mutualisé avec l'action 5. *≈ 30 min.*
2. Émettre sur le canal animateur seul. *≈ 1 h.*
3. Affichage avec repli « + ». *≈ 2 h.*
4. Contrôle sur la trame réseau. *≈ 1 h.*

### Impacts

L'écran animateur gagne une ligne à la révélation. Le stream ne change pas.

### Risques et mitigations

- *Le nom qui fuit par le canal partagé* → décision 7, qui inspecte ce que le
  stream **reçoit**.
- *Une liste à rallonge* → décision 4.

**Charge : ≈ 0,5 j.**

---

## Action 7 — L'histogramme de l'animateur est plat · **RETENUE**

*Couvre les éléments 6 et 7.*

**Problématique initiale.** « les écrans de réponse ne sont pas toujours corrects,
et […] l'histogramme ne fonctionne pas ou affiche des valeurs incohérentes. Ils
ont proposé de rétablir le graphique côté animateur ».

### Diagnostic

**Reproduit et mesuré** sur une manche d'estimation à quatre réponses dispersées :

| | Hauteurs des huit barres |
|---|---|
| Animateur | `2, 2, 2, 2, 2, 2, 2, 2` px |
| Stream | `93, 2, 47, 2, 2, 2, 2, 47` px |

**Et les styles de l'animateur sont corrects** : `height: 100%`, `50%`, `0%`. Le
calcul est bon, la donnée arrive, le pourcentage est écrit. C'est ce qui rend le
défaut invisible à la relecture.

**La cause tient en un mot.** Le conteneur du stream déclare `height: 180px` — une
hauteur **définie**. Celui de l'animateur déclare `min-height: 96px` — un
**minimum**. Un pourcentage de hauteur ne se résout que contre une hauteur
définie ; face à un minimum, `height: 100%` devient `auto` et la barre s'effondre
sur son contenu, qui est vide.

### Décisions entérinées

1. Le conteneur du graphique de l'animateur reçoit une **hauteur définie**, comme
   celui du stream.
2. **Balayage** de tous les graphiques du projet à la recherche du même écart,
   constat consigné avec sa date.
3. L'élément 6 désigne bien **l'histogramme plat**. *Confirmé par l'auteur* —
   aucune action neuve.
4. Contrôle : sur une répartition **connue**, les hauteurs rendues sont
   **proportionnelles aux effectifs**, sur les **deux** écrans. *(TR2)*

### Étapes

1. Hauteur définie sur le graphique de l'animateur. *≈ 15 min.*
2. Balayage des autres graphiques. *≈ 1 h.*
3. Contrôle de proportionnalité, deux écrans. *≈ 2 h.*

### Impacts

Visuel, sur l'écran animateur. Il récupère l'instrument que la maquette A5
spécifiait et que l'action 13 croyait avoir livré.

### Risques et mitigations

- *Un troisième graphique qui attend son tour* → décision 2 et TR2.
- *Un contrôle qui vérifie la présence du graphique* → TR2 mesure des hauteurs.

**Charge : ≈ 0,5 j.**

---

## Action 8 — La police de l'énoncé chez l'animateur · **RETENUE**

*Couvre les éléments 8 et 9.*

**Problématique initiale.** « en corrigeant les problèmes de police et d'affichage
sur différents écrans (exemple écran de l'animateur, la question en cours est
affichée avec une police bizarre) ».

### Diagnostic

L'énoncé de l'animateur emploie `--f-display` (`host.css:741`) — une **grotesque
condensée** : Avenir Next Condensed, Futura, DIN Alternate, Oswald, Arial Narrow.

**Le projet ne charge aucune police** : le socle l'assume, trois piles
substituables. Le rendu dépend de la machine — et sur un Mac, Avenir Next
Condensed existe.

**Ce n'est pas un accident, c'est un mauvais emplacement.** `--f-display` est une
police **d'affiche**, faite pour l'énoncé du stream vu à deux mètres en 84 ou
116 pixels. Sur la console, lue à cinquante centimètres et entourée de texte en
`--f-ui`, elle détonne — et elle ralentit la lecture de près, ce pour quoi elle
n'est pas faite.

### Décisions entérinées

1. L'énoncé de l'animateur emploie **`--f-ui`**, la police de sa console, à une
   taille adaptée à la lecture de près. `--f-display` reste au **stream**.
2. La **bonne réponse révélée** et la ligne **« En cours »** de la file suivent le
   même traitement.
3. La hiérarchie de l'énoncé se tient par la **taille et la graisse**, pas par le
   dessin.
4. L'élément 8 ne recouvre **rien d'autre** que la police. *Confirmé par l'auteur.*
5. Contrôle : les textes de lecture de la console emploient la pile d'interface —
   mesuré sur la police **calculée**, pas sur la déclaration.

### Étapes

1. Passer l'énoncé, la révélation et la ligne « En cours » en `--f-ui`. *≈ 1 h.*
2. Vérifier les autres textes de la console. *≈ 30 min.*
3. Contrôle sur la police calculée. *≈ 1 h.*

### Impacts

Visuel, sur l'écran animateur. Le contraste entre les deux surfaces devient
délibéré : affiche à l'antenne, interface au pilotage.

### Risques et mitigations

- *Perdre la hiérarchie* → décision 3.
- *Un contrôle qui lit la déclaration* → décision 5, `getComputedStyle`.

**Charge : ≈ 0,5 j.**

---

## Action 9 — Un volet de navigation sur la console · **RETENUE**

*Couvre l'élément 1.*

**Problématique initiale.** Formulée d'abord comme « une fois dans le menu de
l'animateur, il n'est plus possible de revenir à l'écran du Stream », puis
**reformulée par l'auteur** : « ce qu'il faut en fait c'est même avec le salon
ouvert avoir la capacité via un volet de navigation de passer au studio ou à la
page initiale de lancement des jeux ».

### Diagnostic

L'adresse du stream est affichée **dans le salon d'attente uniquement**
(`HostApp.jsx:833`). L'écran de direct ne reçoit même pas le jeton.

**Mais le besoin est plus large, et le point qui commande tout est vérifié : le
salon survit au départ de l'animateur.** Le gestionnaire de déconnexion
(`index.js:484`) ne touche que les **joueurs** ; la session de l'animateur vit
sous une clé fixe et se restaure au retour.

**La navigation est donc déjà sûre. Il n'en manque que le moyen.** Aucun travail
serveur.

*Proposition abandonnée en séance* : exposer l'adresse du stream dans le menu.
Elle traitait un symptôme quand le besoin est de circuler.

### Décisions entérinées

1. L'adresse du stream est **dévoilée**, non masquée. *Arbitrage de l'auteur,
   contre la proposition initiale.*
2. **Volet de navigation permanent** sur la console, atteignable à toute phase.
3. **Trois destinations** : Studio, page de lancement, stream — ce dernier dans un
   onglet séparé, jamais en remplaçant la console.
4. Le volet existe **aussi dans le Studio**, pour revenir à la console : un aller
   sans retour n'est pas une navigation.
5. **Aucune confirmation** en pleine manche : on fait confiance à l'animateur.
6. **Le retour à l'animation est sans conséquence** : ni déconnexion, ni fermeture
   du salon, ni fin de partie non désirée. L'animateur retrouve sa partie
   **exactement où il l'a laissée**.
7. Contrôle : l'aller-retour est **reproduit** depuis chaque phase, et l'on vérifie
   au retour le salon ouvert, ses joueurs, leurs scores et la manche en cours.
8. Le volet **dit que le salon reste ouvert**, pour qu'on n'en rouvre pas un
   second.

### Étapes

1. Passer le jeton de stream à l'écran de direct. *≈ 30 min.*
2. Volet de navigation sur la console. *≈ 3 h.*
3. Volet de retour dans le Studio. *≈ 1 h.*
4. Contrôle d'aller-retour depuis chaque phase. *≈ 3 h.*

### Impacts

Le Studio devient atteignable en direct : l'animateur pourra ajouter une question
pendant la partie. Le jeton de stream circule en clair — déjà le cas, classé
ouvert et accepté par l'audit du v1 (F-009).

### Risques et mitigations

- *Croire le salon fermé en le quittant, et en rouvrir un second* → décision 8.
- *Un retour qui ne restaure pas* → la décision 6 a été vérifiée **en lecture**,
  pas en reproduisant ; c'est le contrôle 7 qui l'établira.

**Charge : ≈ 1 j.**

---

## Action 10 — Le texte qui se répète au podium · **RETENUE**

*Couvre l'élément 13.*

**Problématique initiale.** « il y a du texte qui se répète notamment sur la page
de résultat final (podium) ».

### Diagnostic

Deux phrases disent **exactement la même chose**, à dix-sept lignes d'intervalle
dans le même écran (`PlayApp.jsx:969` et `:986`) :

> « Reste connecté — si l'animateur relance une partie dans le salon **XXXXX**, tu
> y seras automatiquement. »
>
> « Reste là : si l'animateur relance une partie, tu y seras ramené sans rien
> faire. »

**Ni l'une ni l'autre ne vient du registre de voix** : les deux sont écrites en
dur. Ce sont **deux rédactions concurrentes du même message**, ajoutées à des
moments différents. La seconde apporte « sans rien faire », la première apporte le
**code du salon**.

### Décisions entérinées

1. **Une seule phrase**, portant le code du salon **et** la nuance « sans rien
   faire ».
2. Le balayage des redites couvre **toutes les surfaces** — joueur, animateur,
   stream, studio. *Arbitrage de l'auteur.*
3. Le contrôle de non-redite **n'est pas généralisé** en garde-fou permanent : on
   vérifie tous les écrans **une fois**, et c'est tout. *Conséquence assumée : une
   redite pourra revenir sans être signalée.*
4. Le constat du balayage est **consigné avec sa date**, donc révisable.

### Étapes

1. Fusionner les deux phrases. *≈ 30 min.*
2. Balayage des quatre surfaces. *≈ 2 h.*
3. Vérification du résultat sur le texte rendu. *≈ 1 h.*

### Impacts

Un écran de fin plus court, donc plus lisible — ce qui sert aussi la décision 2.1,
qui va y ajouter le classement.

### Risques et mitigations

- *Perdre une nuance en fusionnant* → décision 1, les deux apports listés.
- *Ce qui se répète est le SENS, pas la chaîne* → la vérification porte sur le
  texte rendu, pas sur les littéraux du code.

**Charge : ≈ 0,5 j.**

---

## Action 11 — Le procédé de remplacement des phrases · **MISE DE CÔTÉ**

*Couvre les éléments 11 et 12.*

**Problématique initiale.** « trouver des phrases liées au feu de camp […] avec une
numérotation pour faciliter le remplacement » · « en mettant devant chaque phrase
celle qui la remplace ».

**Décision : mise de côté.** *« On traitera ce point après. »*

**Condition de réouverture :** quand Theodore aura ses phrases prêtes à
transmettre, **ou** quand le registre sera sur le point de bouger — la première
des deux.

### Ce qui reste acquis pour ce jour-là

Trois pièges ont été identifiés et ne devront pas être redécouverts :

1. **Les numéros ne sont pas des identifiants.** Ils sont dérivés de l'**ordre** du
   registre. Ajouter une phrase au moment 3 décale les 150 suivantes, et la
   numérotation de Theodore ne désignerait plus les mêmes phrases — sans que rien
   ne le signale. Un identifiant stable par phrase referme ce risque.
2. **Dix-sept phrases portent des repères dynamiques** — `{serie}`, `{places}`,
   `{pseudo}`, `{rang}`. Une réécriture qui perdrait les accolades afficherait le
   texte brut au joueur. Le fichier livré ne les distingue pas.
3. **Le fichier ne dit pas les contraintes du registre** : 120 caractères maximum,
   aucun emoji, jamais moins de quatre phrases par moment, jamais de phrase qui
   contredise les chiffres affichés à côté.

**La liste des 181 textes déjà remise reste valable** tant que le registre ne
bouge pas — et aucune décision de ce chantier ne le modifie (voir §2.5).

---

# 4. Points ouverts

**O-A — L'adaptation des règles au nombre de joueurs.** *(élément 18)* Non décidée
en réunion : le compte rendu dit « ils ont discuté de la nécessité ». Ce qu'il faut
pour trancher : à **deux joueurs**, le bonus du plus proche est acquis d'avance à
l'un des deux et perd son sens ; à **trente**, il devient rare et décisif. La même
question vaut pour le bonus d'exactitude.

**O2 — Le nom du jeu et le domaine.** Hérité du chantier v1, toujours différé.

---

# 5. Hors périmètre

- **L'intégration avec OBS.** Une page web ne peut pas piloter le logiciel. Ce que
  le compte rendu appelle « accès direct à l'Obs » est l'ouverture de la page de
  stream dans un onglet, ce que traite la décision 9.3.
- **Le listing des phrases** *(élément 10)* : **déjà livré** — 181 textes numérotés,
  en Markdown et en tableur, générés depuis le registre.
- **Le défilement des phrases sur l'écran de succès** *(élément 21)* : **déjà
  corrigé** par le chantier v3, poussé le 2026-08-20. Au moment de la réunion, le
  site déployé servait encore le v2 — vérifié par comparaison des empreintes de
  fichiers construits.
- **Un garde-fou permanent contre les redites** : écarté par l'auteur
  (décision 10.3).
- **La confirmation avant de quitter la console en pleine manche** : écartée par
  l'auteur (décision 9.5).

---

# 6. Traçabilité — compte rendu → action → décisions

| # | Élément du CR#5 | Action | Décisions | Statut |
|---|---|---|---|---|
| 1 | Impossible de revenir à l'écran du stream | 9 | 9.1 à 9.8 | RETENUE |
| 2 | L'actualisation fait perdre la session ou fausse les scores | 1 | 1.1 à 1.8 | RETENUE |
| 3 | Impossible de se reconnecter avec le même pseudo | 1 | 1.3 | RETENUE |
| 4 | Éjecté du jeu, ou plus d'écrans de résultats | 1 | 1.1, 1.2, 1.5 | RETENUE |
| 5 | Plus accès au podium en fin de partie | 1 et 3 | 1.5, 3.3 | RETENUE |
| 6 | Les écrans de réponse ne sont pas toujours corrects | 7 | 7.3 | RETENUE |
| 7 | L'histogramme ne fonctionne pas | 7 | 7.1 à 7.4 | RETENUE |
| 8 | Améliorer la visibilité et la lisibilité | 8 | 8.4 | RETENUE |
| 9 | Police bizarre sur la question en cours | 8 | 8.1 à 8.5 | RETENUE |
| 10 | Listing complet des phrases | — | — | **déjà livré** |
| 11 | Theodore fournira des phrases feu de camp | 11 | — | **MISE DE CÔTÉ** |
| 12 | Procédé d'intégration des remplacements | 11 | — | **MISE DE CÔTÉ** |
| 13 | Du texte se répète au podium | 10 | 10.1 à 10.4 | RETENUE |
| 14 | Plages 10/20/30 % confirmées sans modification | 5 | 5.1, 5.2 | RETENUE |
| 15 | Bonus de 400 points au plus proche | 5 | 5.3, 5.4 | RETENUE |
| 16 | Plages plus restrictives pour les années | 5 | 5.7 à 5.10 | RETENUE |
| 17 | Bonus d'exactitude de 200 points | 5 | 5.5 | RETENUE |
| 18 | Adapter les règles au nombre de joueurs | — | — | **POINT OUVERT O-A** |
| 19 | Nom du plus proche chez l'animateur | 6 | 6.1 à 6.7 | RETENUE |
| 20 | Bonus de vitesse maximal à 250 | 4 | 4.1 à 4.9 | RETENUE |
| 21 | Les phrases défilent sur l'écran de succès | — | — | **déjà corrigé (v3)** |
| 22 | Le joueur arrivé en cours de route au classement | 2 | 2.1 à 2.8 | RETENUE |
| 23 | Aucun écran final après actualisation | 3 | 3.3 | RETENUE |
| 24 | Tout le monde n'a pas l'option de partage | 3 | 3.1 à 3.4 | RETENUE |

**Vingt-quatre éléments extraits, tous tracés.** Deux écartés à l'énumération, avec
leur motif : une reformulation identique de l'élément 18, et une reprise de
l'élément 8.

---

# 7. Table d'avancement

| Lot | Action | Décisions | Tenues | Statut | Vérifié par |
|---|---|---|---|---|---|
| 1 | 1 — le rechargement éjecte le joueur | 8 | 8 | **faite** | `tests/e2e/rechargement.spec.js` — 7 contrôles, F5 réel à six étapes |
| 1 | 3 — l'état de fin rejoué, le partage rendu | 4 | 3 + 1 écart | **faite** | `rechargement.spec.js`, partage vérifié jusqu'au joueur reconnecté · écart É-2 sur 3.2 |
| 1 | 2 — le classement sur l'écran de fin | 8 | 8 | **faite** | `rechargement.spec.js` · balayage 2.8 → défaut É-4, corrigé |
| 1 | 10 — le texte qui se répète | 4 | 4 | **faite** | `docs/BALAYAGE-REDITES-2026-08-21.md`, 26 phrases sur 11 écrans |
| 2 | 4 — le complément de vitesse à 250 | 9 | 8 + 1 écart | **faite** | `tests/unit/bareme-v4.test.js` · écart É-1 sur 4.4 |
| 2 | 5 — les règles de l'estimation | 13 | 13 | **faite** | `bareme-v4.test.js` — 11 contrôles, dont les échelles extrêmes |
| 2 | 6 — le nom du plus proche | 7 | 7 | **faite** | `tests/e2e/estimation-v4.spec.js` — trames réseau des deux destinataires |
| 3 | 7 — l'histogramme plat | 4 | 4 | **faite** | `estimation-v4.spec.js` — hauteurs mesurées · balayage 7.2 ci-dessous |
| 3 | 8 — la police de l'énoncé | 5 | 5 | **faite** | `tests/e2e/police-console.spec.js` — police calculée, deux sens |
| 3 | 9 — le volet de navigation | 8 | 8 | **faite** | `tests/e2e/volet-navigation.spec.js` — aller-retour depuis quatre phases |
| — | TR1 — le classement à la fin seulement | 1 | 1 | **faite** | `estimation-v4.spec.js` — aucun `leaderboard:update` chez le joueur |
| — | TR2 — les graphiques mesurés | 1 | 1 | **faite** | `estimation-v4.spec.js` — 3:64 px contre 1:21 px, les deux écrans |
| — | 11 — le procédé de remplacement | — | — | **mise de côté** | — |

**70 décisions numérotées + 2 transversales = 72. Tenues : 70. Écarts : 2.**
Trois défauts non prévus par le plan ont été trouvés par les contrôles eux-mêmes
et corrigés (É-3, É-4, É-5 ci-dessous).

La colonne « vérifié par » nomme la **preuve** — un contrôle, une mesure, un
constat. « Fait » sans preuve n'est pas fait.

---

# 8. Audit de clôture — 2026-08-21

Chacune des **72 décisions** confrontée à la réalisation, une par une. Le verdict
ne s'appuie jamais sur l'intention : il nomme la preuve, ou il constate l'écart.

**Décompte : 70 tenues · 2 écarts · 3 défauts trouvés par les contrôles et
corrigés en cours de chantier · 3 affirmations de cet audit corrigées à sa
relecture** (§8.13).

*Pour mémoire : l'audit du v1 a trouvé cinq décisions entérinées et jamais
réalisées ; celui du v2, deux écarts et une dette ; celui du v3, un garde-fou qui
avait échoué à son propre examen.*

## 8.1 Action 1 — le rechargement

| # | Décision | Verdict | Preuve |
|---|---|---|---|
| 1.1 | Code de salon écrit dans l'URL, sans entrée d'historique | tenue | `poserCodeDansUrl` (`PlayApp.jsx`), `replaceState` · contrôle : `url` contient `code=` aux six étapes |
| 1.2 | Repli sur une session unique, rien de deviné si ambiguïté | tenue | `sessionInitiale` refuse dès que `cles.length !== 1` |
| 1.3 | Refus du pseudo pris maintenu, message expliqué | tenue | `'pseudo-taken'` dit « c'est peut-être toi, sur un autre onglet » |
| 1.4 | Choix non révélé non restauré | tenue | le serveur rejoue `answered`, jamais la valeur — *arbitrage « pas grave »* |
| 1.5 | Rechargement **réel** aux six étapes | tenue | `rechargement.spec.js`, `page.reload()` — jamais une coupure simulée |
| 1.6 | Identité, score et place vérifiés | tenue | `identite()` relève l'URL, le stockage et l'écran ; le rang est comparé |
| 1.7 | Éprouvé sur les trois surfaces | tenue | joueur, console et stream rechargés dans le même fichier |
| 1.8 | Les deux contrôles de coupure du v1 conservés | tenue | `reconnexion-resultat.spec.js`, 2 contrôles — panne distincte, téléphone en veille |

## 8.2 Action 2 — le classement sur l'écran de fin

| # | Décision | Verdict | Preuve |
|---|---|---|---|
| 2.1 | Classement affiché, ligne propre distinguée | tenue | `data-testid="classement-final"`, `.board__row--me` |
| 2.2 | Condition sur le classement complet, pas le podium | tenue | `rangs = classement.length ? classement : podium` |
| 2.3 | Partie sans point : classement quand même | tenue | contrôle « partie sans score » |
| 2.4 | Aucun titre de victoire sans point marqué | tenue | `rank === 1 && aMarque` |
| 2.5 | Le retardataire se voit à sa place | tenue | contrôle du joueur arrivé en cours de partie |
| 2.6 | Titre cohérent avec les chiffres sur une partie à zéro | tenue | contrôle à partie **fabriquée**, zéro garanti — voir É-7 |
| 2.7 | La liste défile dans son bloc | tenue | `.board--defile { max-height: 42dvh; overflow-y: auto }` |
| 2.8 | Balayage des écrans de fin | tenue | **a trouvé É-4** — voir §8.11 |

## 8.3 Action 3 — l'état de fin rejoué, le partage rendu

| # | Décision | Verdict | Preuve |
|---|---|---|---|
| 3.1 | Partage découplé du classement | tenue | bouton inconditionnel, « Partager ma partie » |
| 3.2 | Sans classement, la carte dit le salon et les épreuves | **écart É-2** | le texte dit le NOM DU JEU et le nombre d'épreuves, jamais le code du salon |
| 3.3 | État de fin rejoué à la reconnexion | tenue | `if (room.state === ENDED)` hors du `if (cur)` (`index.js`) |
| 3.4 | Le bouton présent pour **chaque** joueur | tenue | contrôle : à zéro, retardataire, et **reconnecté après la fin** — ce dernier cas ajouté à la relecture, voir É-8 |

## 8.4 Action 4 — le complément de vitesse

| # | Décision | Verdict | Preuve |
|---|---|---|---|
| 4.1 | Complément maximal 300 → 250 | tenue | `COMPLEMENT_VITESSE_MAX = 250` · contrôle au chiffre près |
| 4.2 | Supplément de 150 au plus rapide supprimé | tenue | `FASTEST_BONUS` supprimé du calcul |
| 4.3 | Maximum quiz et vrai/faux : 950 | tenue | tableau des maximums, consigné dans un contrôle |
| 4.4 | L'estimation devient le maximum le plus élevé — « 1000 contre 950 » | **écart É-1** | le chiffre est **1600**, non 1000 : la décision 5.6 (bonus cumulés) a été prise APRÈS et périme le nombre écrit ici. Le fait — l'estimation passe devant — reste vrai, et l'auteur l'a accepté en connaissance de l'écart |
| 4.5 | Le plus rapide reste désigné, sans points | tenue | drapeau `fastest` transmis dans `play:you` |
| 4.6 | `juste.plus-rapide` adossé au drapeau | tenue | `if (monResultat.fastest)` remplace `speed >= 150` |
| 4.7 | Énoncé du barème mis à jour pour les quatre jeux | tenue | contrôle `bareme.spec.js` — 700, 250, « pour l'honneur », 1000, ±2, 400 |
| 4.8 | « Totaux inchangés » du v1 périmée, consignée | tenue | consignée en §3, action 4, et rappelée en tête de document |
| 4.9 | Totaux au chiffre près, tableau des maximums | tenue | `{"quiz":950,"vrai_faux":950,"estimation":1600}` |

## 8.5 Action 5 — les règles de l'estimation

| # | Décision | Verdict | Preuve |
|---|---|---|---|
| 5.1 | Paliers relatifs inchangés | tenue | `PALIERS_ESTIMATION` intact · contrôle sur une cible d'un million |
| 5.2 | Tolérance absolue d'une unité conservée | tenue | contrôle « cible à un chiffre » : 7 sur 6 vaut le premier palier |
| 5.3 | Bonus du plus proche : 400, même hors plage | tenue | contrôle dédié |
| 5.4 | Égalité : tous les ex æquo | tenue | contrôle dédié |
| 5.5 | Bonus d'exactitude : 200, en plus | tenue | contrôle dédié |
| 5.6 | Cumul sans plafond : 1600 | tenue | contrôle dédié — écart avec les 950 du quiz accepté |
| 5.7 | Nature déclarée au Studio : nombre ou année | tenue | radiogroupe « Nature de la réponse » |
| 5.8 | Plages des années : exact / ±2 / ±5 / ±10 | tenue | `PALIERS_ANNEE` · contrôle sur 1789 |
| 5.9 | Nature déclarée, jamais devinée | tenue | contrôle : 1789 sans nature reste un nombre |
| 5.10 | Questions existantes : aucune migration | tenue | même contrôle |
| 5.11 | L'énoncé décrit les deux jeux de plages | tenue | trois entrées de barème, vérifiées par `bareme.spec.js` |
| 5.12 | Contrôles : million, un chiffre, années, aberrante, égalité, personne dans aucune plage | tenue | les six cas, 11 contrôles dans `bareme-v4.test.js` |
| 5.13 | Tableau des maximums consigné | tenue | consigné dans un contrôle, pas dans un commentaire |

## 8.6 Action 6 — le nom du plus proche

| # | Décision | Verdict | Preuve |
|---|---|---|---|
| 6.1 | Le serveur désigne les JOUEURS, calcul mutualisé | tenue | un seul `plusProches` sert au bonus et à l'affichage |
| 6.2 | Canal animateur seul | tenue | `io.to(code + ':host')` |
| 6.3 | Les stats publiques gardent la valeur, sans nom | tenue | `reveal.stats.closest` sans pseudo |
| 6.4 | Poignée de noms, plus un « + » | tenue | contrôle : quatre ex æquo → trois lignes et « + 1 autre », puis quatre après le clic |
| 6.5 | Chaque nom avec sa valeur | tenue | contrôle : le panneau porte le pseudo ET la valeur relevée dans la révélation |
| 6.6 | À la révélation seulement | tenue | contrôle : le panneau est absent avant |
| 6.7 | Vérifié **sur la trame réseau** | tenue | trames du stream ET d'un joueur : ni `host:closest` ni `plusProches`, et aucun pseudo dans la révélation publique |

## 8.7 Action 7 — l'histogramme plat

| # | Décision | Verdict | Preuve |
|---|---|---|---|
| 7.1 | Hauteur définie sur le conteneur | tenue | `height: 96px` · le défaut réintroduit fait échouer le contrôle : huit barres de 2 px |
| 7.2 | Balayage de tous les graphiques, consigné avec sa date | tenue | **balayage du 2026-08-21, ci-dessous** |
| 7.3 | L'élément 6 désigne bien l'histogramme | tenue | confirmé par l'auteur, aucune action neuve |
| 7.4 | Hauteurs proportionnelles, sur les deux écrans *(TR2)* | tenue | console 3:64 px / 1:21 px · stream 3:93 px / 1:31 px |

**Balayage des graphiques du projet — 2026-08-21.** Le projet compte **deux
graphiques à hauteur proportionnelle** : l'histogramme de la console et celui du
stream. Seul le premier était fautif ; il est corrigé. Tous les autres tracés
proportionnels — barres de répartition, jauge de progression, chrono — portent leur
pourcentage sur la **largeur**, résolue contre une largeur définie (`flex: 1`), et
leur `height: 100%` s'appuie sur une hauteur explicite. **Aucun autre écart du même
genre.** Constat révisable : il vaut pour l'état du 2026-08-21.

## 8.8 Action 8 — la police de l'énoncé

| # | Décision | Verdict | Preuve |
|---|---|---|---|
| 8.1 | L'énoncé de la console en `--f-ui`, le stream garde `--f-display` | tenue | police **calculée** relevée sur les deux surfaces |
| 8.2 | Bonne réponse révélée et ligne « En cours » suivent | tenue | `.reveal__value` et `.file__encours-texte` mesurées |
| 8.3 | Hiérarchie par la taille et la graisse | tenue | `600 var(--fs-800)` conservés |
| 8.4 | L'élément 8 ne recouvre rien d'autre | tenue | confirmé par l'auteur |
| 8.5 | Mesuré sur la police calculée | tenue | `getComputedStyle`, jamais la déclaration — et un contrôle inverse protège le stream |

*Vérification des autres textes de la console (étape 2).* Quatre déclarations
`--f-display` subsistent : le titre d'accueil, le titre de la carte
d'authentification, le titre de panneau et le titre de salon vide. Ce sont des
**titres courts**, l'emploi légitime d'une police d'affiche — non des textes de
lecture. Aucun changement.

## 8.9 Action 9 — le volet de navigation

| # | Décision | Verdict | Preuve |
|---|---|---|---|
| 9.1 | Adresse du stream dévoilée | tenue | le lien porte l'adresse complète, jeton compris |
| 9.2 | Volet permanent, atteignable à toute phase | tenue | salon d'attente, direct et résultats — les trois écrans |
| 9.3 | Trois destinations, le stream dans un onglet séparé | tenue | contrôle : `target="_blank"` et l'adresse `/overlay?token=…` |
| 9.4 | Le volet existe aussi dans le Studio | tenue | « Retour à l'animation », emprunté par chaque aller-retour du contrôle |
| 9.5 | Aucune confirmation en pleine manche | tenue | le volet n'arme rien, contrairement au menu de sortie |
| 9.6 | Le retour est sans conséquence | tenue | contrôles depuis quatre phases ; salon, joueurs, scores, manche en cours et podium retrouvés — **a trouvé É-3** |
| 9.7 | Aller-retour reproduit depuis chaque phase | tenue | quatre contrôles distincts : salon, direct, après révélation, **podium final** — voir É-6 |
| 9.8 | Le volet dit que le salon reste ouvert | tenue | phrase vérifiée à l'ouverture du volet |

## 8.10 Action 10 — le texte qui se répète

| # | Décision | Verdict | Preuve |
|---|---|---|---|
| 10.1 | Une seule phrase, code du salon **et** « sans rien faire » | tenue | les deux apports conservés dans une phrase unique |
| 10.2 | Balayage sur les quatre surfaces | tenue | 26 phrases, 11 écrans — joueur, animateur, stream, studio |
| 10.3 | Pas de garde-fou permanent | tenue | l'outil vit hors de `tests/e2e/`, il ne s'exécute pas avec la suite |
| 10.4 | Constat consigné avec sa date | tenue | `docs/BALAYAGE-REDITES-2026-08-21.md`, avec la liste de ce qui a été lu |

**L'instrument s'étalonne.** Les deux rédactions concurrentes rapportées par
l'auteur se recouvrent à 63 % pour un seuil de 60 % : le balayage voit la redite
pour laquelle il a été écrit. Sans cet étalonnage, « aucune redite » ne voudrait
rien dire.

## 8.11 Les écarts et les défauts trouvés

**É-1 — décision 4.4, un chiffre périmé par une décision postérieure.** « 1000
contre 950 » a été écrit avant que la décision 5.6 n'autorise le cumul des bonus.
Le maximum réel de l'estimation est **1600**. Le fait énoncé — l'estimation devient
le module au maximum le plus élevé — reste vrai ; seul le nombre est faux. Il est
consigné ici plutôt que réécrit dans la décision : un plan qu'on retouche après
coup ne dit plus ce qui a été décidé, ni quand.

**É-2 — décision 3.2, le code du salon n'est pas partagé.** La décision demandait
que la carte partagée dise « le salon et le nombre d'épreuves ». Le texte dit le
nom du jeu et le nombre d'épreuves. Le code du salon en est délibérément absent :
un code de partie EN COURS publié sur un réseau social est une invitation ouverte
à des inconnus, ce que ni la décision ni la réunion n'ont envisagé. **Écart assumé,
soumis à l'auteur** — le rétablir est l'affaire d'une ligne.

**É-3 — le classement de la console revenait vide après tout rattachement.**
*Trouvé par le contrôle de la décision 9.6, non prévu par le plan.* Le classement
n'était diffusé que sur ÉVÉNEMENT : une console qui se rattachait entre deux
révélations n'en recevait jamais et affichait « Aucun score pour l'instant » sur
une partie déjà bien engagée. Le défaut n'appartenait pas au volet de navigation —
un simple F5 sur la console le produisait aussi, depuis toujours. Il manquait
seulement un contrôle qui regarde la console APRÈS un rattachement. **Corrigé** :
le classement est rejoué au staff à la connexion.

**É-4 — la voix démentait le gain affiché.** *Trouvé par le balayage de la décision
2.8.* Le moment `estimation.hors` déclare « au-delà de 30 % : ZÉRO POINT », et ses
phrases le disent — « Complètement à côté — et ça ne coûte rien. » Depuis le bonus
du plus proche (décision 5.3), un joueur hors de toute plage peut toucher 400
points : la phrase contredisait alors le « +400 » affiché juste au-dessus, et la
condition déclarée du moment était devenue fausse. **C'est un défaut créé par ce
chantier, pas hérité.** **Corrigé** par un moment neuf, `estimation.plus-proche`,
et cinq phrases — le registre passe de 181 à **186 phrases sur 37 moments**, et le
listing livré à l'auteur a été régénéré en conséquence.

**É-5 — trois contrôles verts pour de mauvaises raisons.** Consignés parce qu'un
contrôle qui passe sans rien mesurer est plus dangereux qu'un contrôle absent :
- le contrôle de confidentialité (6.7) cherchait le pseudo dans TOUT le flux du
  stream — or le stream est du staff et reçoit légitimement le classement. Il
  accusait le classement, qui n'y est pour rien ;
- le contrôle de l'histogramme (7.4) supposait la cible de la question livrée
  d'office ; selon les tests exécutés avant lui, les quatre réponses tombaient dans
  une seule tranche. Vert seul, rouge dans la suite complète ;
- le contrôle de la voix (É-4) cherchait deux tournures : trois des cinq phrases du
  moment fautif ne les contiennent pas, et il passait au vert **avec la correction
  désactivée**.

Les trois ont été refaits, et chacun **échoue désormais quand on réintroduit le
défaut** — vérifié une fois par contrôle.

## 8.13 Ce que la relecture de l'audit a trouvé

L'audit ci-dessus a été relu ligne à ligne, ses affirmations confrontées au code
et aux contrôles plutôt qu'à l'intention. **Trois d'entre elles étaient trop
larges.** Elles sont corrigées ci-dessus ; le détail est ici, parce qu'un audit
qu'on corrige en silence ne vaut pas mieux qu'un audit qu'on ne relit pas.

**É-6 — « depuis chaque phase » n'en couvrait que trois sur quatre.** La décision
9.7 demande l'aller-retour depuis chaque phase. Les contrôles partaient du salon,
du direct et du direct après révélation — jamais du **podium final**, qui est
pourtant la seule phase où « ni fin de partie non désirée » (décision 9.6) veut
dire quelque chose, et le seul écran de la console dont l'état vient du serveur
plutôt que d'un drapeau d'affichage. Le contrôle manquant a été écrit. Il a aussi
montré que la fonction d'aller-retour, elle-même, était bâtie pour deux phases :
elle attendait un compteur qui n'existe pas au podium, et le contrôle serait resté
pendu quatre-vingt-dix secondes. **Corrigé, et vert.**

**É-7 — un contrôle qui ne s'exécutait qu'une fois sur quatre.** Le contrôle de la
décision 2.6 — « une partie sans point marqué ne crie pas victoire » — jouait la
première épreuve venue et cliquait la première option. Quand celle-ci se trouvait
juste, la partie n'était plus à zéro et l'assertion, gardée par un `if (!aMarque)`,
était **purement et simplement sautée**. Le contrôle finissait vert sans avoir rien
vérifié, trois fois sur quatre. La partie est désormais **fabriquée** — question
connue, mauvaise réponse choisie délibérément — et la prémisse est vérifiée avant
l'assertion : `scores au classement : 0 · 0`.

**É-8 — le quatrième cas du partage n'était pas couvert.** La décision 3.4 nomme
quatre joueurs : gagnant, à zéro, arrivé en cours de route, **et reconnecté après
la fin**. Le contrôle n'en vérifiait que trois — et le quatrième est précisément
celui de la réunion : « un bouton présent chez certains et absent chez d'autres »,
c'est-à-dire chez qui avait rechargé. L'assertion manquante a été ajoutée au
contrôle du rechargement sur le podium.

**Une affirmation retirée.** Le contrôle du podium portait, en commentaire, que le
décompte des joueurs y prouvait la correction É-3. **C'est faux, et vérifié comme
tel** : sur une partie terminée, le classement arrive par le rejeu de fin de partie
(décision 3.3) ; désactiver le rejeu au staff ne fait pas échouer ce contrôle-là.
C'est en pleine partie que le classement manquait, et c'est le contrôle du
classement qui l'établit. Le commentaire dit maintenant ce qui est vrai.

## 8.12 Ce que la suite prouve

| Suite | Résultat |
|---|---|
| Unitaires (`vitest`) | **108 contrôles**, tous verts |
| Boucle d'intégration | **toutes les vérifications passées** |
| Bout en bout (`playwright`) | **82 contrôles**, tous verts, deux exécutions consécutives sans intermittence |

Une intermittence héritée a été corrigée au passage : le contrôle de reconnexion
cherchait « sans toi » n'importe où sur l'écran et tombait, une fois sur trois, sur
une phrase de la voix qui contient les mêmes mots. Il vise désormais le titre.
