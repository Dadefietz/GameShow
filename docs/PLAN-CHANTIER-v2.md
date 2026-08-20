---
artifact_type: plan_chantier
app: root
version: 2
change_set: forward
produced_by: plan-daction-reunion
created_at: 2026-08-20
created_by: R.M.A + Claude
status: validated
source_meetings: 1
actions_total: 5
actions_retained: 5
decisions_total: 48
effort_estimate_days: 4
---

# PLAN DE CHANTIER v2 — Project Game Show

> Référence d'implémentation issue du compte rendu de test du 2026-08-20 (CR#3)
> et de son analyse action par action. **Chaque décision listée ici a été
> explicitement entérinée.** Rien ne doit être ré-arbitré pendant
> l'implémentation : en cas de doute, ce document fait foi.
>
> Il fait suite à [PLAN-CHANTIER-v1.md](PLAN-CHANTIER-v1.md), dont il corrige
> quatre livrables. Les décisions de la v1 restent en vigueur sauf mention
> contraire ici.

## Comment lire ce document

Chaque action suit la même structure : la problématique telle qu'elle a été
formulée, le diagnostic avec ses références de code, les décisions entérinées —
**numérotées, ce sont elles qui engagent** — les étapes, les impacts, les risques
avec leurs mitigations.

**48 décisions** : 47 numérotées sur cinq actions, plus une transversale. La
table de traçabilité en fin de document relie chaque élément du compte rendu à
son action ; la table d'avancement se tient à jour pendant l'implémentation.

---

# 1. Décision transversale

**TR1 — Toute contrainte géométrique se vérifie par mesure.** Un recouvrement,
une troncature, un débordement, une position par rapport au pli : ces choses se
constatent **en chiffres, dans un vrai navigateur**, jamais par relecture d'une
capture ni par lecture du CSS.

*Pourquoi elle existe.* Les quatre défauts de ce compte rendu ont tous survécu à
la livraison de la v1 parce que rien ne les mesurait. Trois d'entre eux étaient
visibles à l'œil sur la première partie jouée. Un contrôle qui regarde la
présence d'une classe ou d'une propriété CSS ne les aurait pas vus non plus :
c'est le **résultat rendu** qu'il faut mesurer.

TR1 s'applique aux actions 1, 2, 3 et 4.

---

# 2. Chemin critique

## 2.1 Ordre d'exécution

| Ordre | Lot | Contenu | Ordre de grandeur |
|---|---|---|---|
| 1 | **La pastille** | Action 2, puis action 1 | ~1,5 j |
| 2 | **La file** | Action 3, puis action 4 | ~1,75 j |
| 3 | **La marque** | Action 5 | ~0,75 j |

**Environ 4 jours.** Aucun parallélisme utile : les lots sont courts et deux
d'entre eux touchent les mêmes écrans.

## 2.2 Dépendances réelles

| Contrainte | Raison |
|---|---|
| **2 avant 1** | L'adresse détermine la hauteur de la pastille, dont l'action 1 doit réserver la place. Corriger 1 avant 2 donnerait une réservation calée sur une pastille qui va rétrécir de 230 px |
| **3 avant 4** | L'animation porte sur les lignes que l'action 3 déplace |
| **5 après 1** | Les deux touchent `/overlay` ; les mener ensemble ferait travailler à deux sur le même écran |
| 1 et 3 indépendantes | L'une est le stream, l'autre l'écran animateur |

## 2.3 Justification de l'ordre

Le **lot 1** passe en premier parce qu'il corrige ce qui est visible **à
l'antenne** : un spectateur voit aujourd'hui trois réponses amputées par la
pastille. Le **lot 2** corrige ce que seul l'animateur voit — gênant, mais
privé. Le **lot 3** est du soin d'identité, sans urgence.

## 2.4 Jalons

- **Fin du lot 1** — les quatre écrans du stream mesurés sans recouvrement ;
  l'adresse lisible, ses tailles re-mesurées et **consignées**.
- **Fin du lot 2** — l'animateur lit ses énoncés, déplace une question de la
  place 1 à la place 15 au glisser, et la barre d'actions reste au-dessus du
  pli. Les trois sont mesurés.
- **Fin du lot 3** — une seule géométrie de flamme, présente sur les quatre
  surfaces ; aucun PNG de tipi dans le dépôt ni dans le registre.

## 2.5 Ce que la discussion a corrigé en chemin

Consigné parce qu'un lecteur ultérieur retrouverait sinon ces erreurs dans les
échanges sans savoir qu'elles ont été redressées :

- **Au podium, la pastille ne déborde pas sur la marche.** Ma première
  formulation le disait ; la mesure de la capture le dément — plaque x 55–300,
  marche à partir de x 300. Le défaut du podium relève **entièrement** de
  l'action 2.
- **Le pas d'une ligne de file est de 68 px**, non de 52 : 44 px de plancher
  tactile, 8 px de rembourrage haut et bas, 8 px d'écart. Quatre lignes font
  donc ~272 px pour ~260 disponibles. La décision 3.5 tient, mais elle est
  **juste** : c'est le contrôle 3.10 qui tranchera, pas une estimation.
- **Deux marques coexistent bien**, comme vous l'avez signalé. Ma première
  analyse concluait le contraire parce qu'elle n'avait cherché que les
  déclarations `rel="icon"`.
- **Il n'y a aucune contradiction** entre la décision 10 des actions 3+4+5 de la
  v1 et la décision 5.2. Ce que cette décision retirait du stream était le
  **panneau latéral de 460 px** qui portait un bloc de marque parmi d'autres
  choses, non la marque elle-même — laquelle est d'ailleurs déjà sur le stream,
  en couronne du podium.

---

# 3. Actions

---

## Action 1 — La pastille recouvre la scène · **RETENUE**

**Problématique initiale.** « des bug énorme du positionnement du QR code et du
code de salon sur la page stream (voir pièce jointe) ». Pendant une question, la
pastille ampute trois options de réponse ; en salle d'attente et en salon
ouvert, elle passe par-dessus la carte du compteur de joueurs.

La v1 avait pourtant entériné l'inverse — décision 11 des actions 3+4+5 : *« Une
zone réservée est définie en bas à gauche : la scène n'y dessine jamais.
Contrainte de mise en page, pas espoir de non-recouvrement. »*

**Diagnostic.** La zone réservée existe, et elle est fausse sur trois plans.

```css
.stream[data-state="live"] .stream__stage {
  padding-bottom: calc(var(--pad-st) + var(--qr-st) + 190px);
}
```

1. **Elle ne s'applique pas au podium.** L'état du conteneur vaut `ended` au
   podium, `live` partout ailleurs (`OverlayApp.jsx:634`). Le sélecteur ne vise
   que `live`.
2. **Le nombre est deviné, et faux.** `--qr-st + 190px` = 434 px. Le commentaire
   avoue sur quoi repose ce 190 : *« une adresse longue se replie sur **deux
   lignes** »*. Elle s'en replie quatre. La pastille mesure ~530 px, la
   réservation 434 : **elle crève sa propre zone d'environ 100 px** — la bande
   exacte où se trouve la carte du compteur.
3. **`padding-bottom` ne protège que si le contenu tient.** Sur l'écran de
   question : 1080 px de canevas, 64 en haut et 434 réservés en bas laissent
   582 px ; l'énoncé et quatre options en demandent ~720. Un enfant de boîte
   flexible ne se laisse pas rogner par le remplissage de son parent — il
   déborde, et `.stream` le clippe au bord du canevas, pas au bord du
   remplissage.

Et un gaspillage de fond : on réserve une **bande de 434 × 1920** pour protéger
un **coin de 232 × 530**. C'est cette bande qui étrangle l'écran de question.

**Décisions entérinées.**

1. **La réservation s'applique à tous les états** du conteneur, podium compris.
   Elle n'est plus conditionnée à `data-state="live"`.
2. **La réservation est une exclusion de coin** : seuls les éléments de la scène
   atteignant le bord gauche s'écartent. La bande pleine largeur disparaît, et
   l'écran de question récupère la hauteur qu'il perd aujourd'hui.
3. **Sa taille est mesurée, pas devinée** : la géométrie réelle de la pastille
   (hauteur et largeur) est publiée en variables CSS depuis le même effet que
   `--stream-scale` (`OverlayApp.jsx:605`), recalculée au redimensionnement et au
   changement de phase.
4. **Une valeur de repli couvre le premier rendu**, avant l'arrivée de la
   mesure : plancher = QR plus ses marges.
5. **Au podium, la pastille garde son ancrage bas-gauche** ; c'est la marche qui
   recule. Motif : un élément qui change de place entre deux phases se cherche
   du regard.
6. **Un contrôle mesure le recouvrement** — boîte de la pastille contre boîte de
   chaque élément de scène — sur les quatre écrans (salon ouvert, salle
   d'attente, question, podium) et les deux états de révélation.
7. **Le podium se vérifie avec un classement plein**, pas avec un joueur unique :
   c'est la capture à un seul nom qui a masqué la contrainte.
8. **L'action 2 passe avant ou avec celle-ci** — la hauteur de la pastille est
   leur paramètre commun.

**Étapes.**
1. Publier la géométrie réelle de la pastille en variables CSS. *≈ 2 h.*
2. Étendre la réservation à tous les états. *≈ 30 min.*
3. Transformer la bande en exclusion de coin. *≈ 3 h.*
4. Mesurer les quatre écrans et les quatre types de jeu dans leurs deux états. *≈ 2 h.*
5. Contrôle automatique de non-recouvrement. *≈ 2 h.*

**Dépendances.** Après l'action 2. Précède l'action 5 (même écran).

**Impacts.** L'écran de question **gagne** de la place. Le podium en **perd** un
peu, n'en réservant aucune aujourd'hui. Aucun impact sur le moteur, les scores
ou le réseau. Effet de bord : un calcul au redimensionnement — dans OBS la
source est de taille fixe, il ne s'exécutera qu'au chargement.

**Risques et mitigations.**
- *Mesure arrivant après le premier rendu, donc saut visible à l'antenne* →
  valeur de repli (décision 4).
- *Podium à effectif nombreux devenu à l'étroit* → mesure avec classement plein
  (décision 7).
- *Corriger l'action 2 change la hauteur en cours de route* → décision 8.
- *Croire que c'est réglé sur une seule capture* → le contrôle mesure des
  boîtes sur quatre écrans (décision 6).

**Charge : ≈ 1 j.**

---

## Action 2 — L'adresse est illisible dans la pastille · **RETENUE**

**Problématique initiale.** Sous le même point du compte rendu. Au podium,
l'adresse se replie en **colonne de deux caractères par ligne** —
`pr|oj|ec|t-|ga|me|…` — et le code du salon vient se poser à côté du premier
fragment : « pr · 2Z78R ». Sur les trois autres écrans, elle se coupe **au
milieu d'un mot** : « show.onre / nder.com/ ».

**Diagnostic.** Une seule ligne de CSS produit les deux :

```css
.rejoindre__lien { overflow-wrap: anywhere; }
```

`anywhere` autorise la coupure entre deux caractères quelconques et — point
décisif — ramène la **largeur minimale** de l'élément à un caractère. Dans une
boîte flexible, un élément qui peut se réduire à un caractère s'y réduit.

**Ce défaut avait déjà été corrigé.** Deux commits l'attestent :

| Commit | Ce qu'il posait |
|---|---|
| `c92e7d7` | *« le lien reste dans le panneau avec un domaine réel »* — descente d'un cran de typo pour adresse longue |
| `2712880` | *« le lien se coupe après un point, pas au milieu d'un mot »* — remplace précisément `anywhere` par `break-word` |

Ces correctifs portaient sur `.join-panel__url`, l'ancien panneau de 460 px que
les actions 3+4+5 ont supprimé. La pastille a été écrite avec une classe neuve,
`.rejoindre__lien`, qui a réintroduit la valeur exacte que `2712880` avait
retirée. **La correction n'a pas été perdue : elle n'a jamais été reportée.**
Elle vivait sur un élément qui n'existe plus, et un test visant une classe
disparue disparaît avec elle.

**Deux défauts propres au podium s'y ajoutent.** La plaque du podium hérite de
`max-width: calc(--qr-st + …)` = 232 px — une largeur **dictée par le QR**,
alors qu'il n'y a pas de QR au podium. Et `align-items: baseline` aligne le code
sur la **première** ligne de la colonne, d'où « pr · 2Z78R ».

**Cause de fond.** `project-game-show.onrender.com/play` fait 34 caractères.
C'est la deuxième fois que cette adresse impose un compromis de mise en page.

**Décisions entérinées.**

1. **`overflow-wrap: break-word`**, jamais `anywhere` : la coupure se fait aux
   tirets et aux points, jamais au milieu d'un mot.
2. **Au podium, la plaque mince n'hérite plus de la largeur dictée par le QR** :
   elle s'élargit autant qu'il faut pour tenir adresse et code sur **une seule
   ligne**, conformément à la décision 13 des actions 3+4+5 de la v1
   (`adresse.fr/play · K7P2M9`).
3. **Dans la pastille haute, l'adresse tient sur deux lignes au maximum** ;
   au-delà elle descend d'un cran de typo — le mécanisme de `c92e7d7`, reporté.
4. **Le code du salon ne s'aligne jamais sur la première ligne** d'une adresse
   repliée.
5. **Les quatre tailles de rendu sont re-mesurées et consignées** après
   correction. Si le portrait passe sous le seuil de lisibilité, c'est écrit
   comme limite assumée, pas tu.
6. **Le contrôle mesure un résultat** — nombre de lignes, absence de coupure
   intra-mot, ligne unique au podium — **jamais la présence d'une propriété
   CSS**. Un résultat survit à une réécriture ; une propriété non.
7. **Le contrôle s'exécute avec l'adresse d'hébergement réelle**, jamais avec un
   domaine court de démonstration : c'est le domaine court des maquettes qui a
   masqué le défaut la première fois.
8. **O2 n'est pas rouvert.** La correction vaut pour l'adresse actuelle ;
   l'étape 3 de l'action 19 de la v1 re-mesurera le jour du domaine.

**Étapes.**
1. Remettre `break-word`, vérifier les points de coupure sur l'adresse réelle. *≈ 30 min.*
2. Reporter la variante typographique pour adresse longue, avec son seuil. *≈ 1 h.*
3. Podium : largeur propre, ligne unique, alignement du code. *≈ 1 h.*
4. Mesurer la hauteur obtenue, la confronter à la réservation de l'action 1. *≈ 30 min.*
5. Contrôle automatique. *≈ 1 h.*

**Dépendances.** Précède l'action 1.

**Impacts.** Visuel seulement. La pastille rétrécit d'environ 230 px en hauteur,
ce qui **détend l'action 1** au lieu de la contraindre. La mesure de lisibilité
consignée en v1 — 6,9 px en portrait — devra être refaite après la descente de
typo.

**Risques et mitigations.**
- *La descente de typo pousse l'adresse sous le seuil de lisibilité* → re-mesure
  et consignation (décision 5) ; une limite assumée s'écrit.
- *Une adresse sans tiret ni point se couperait mal quand même* → connu ;
  la mitigation réelle est O2, hors périmètre ici.
- *Le contrôle vise une classe qui sera un jour réécrite* → il mesure un
  résultat (décision 6).
- *Corriger pour l'adresse d'aujourd'hui* → l'action 19 de la v1 re-mesurera.

**Charge : ≈ 0,5 j.**

---

## Action 3 — La file ne montre pas les questions · **RETENUE**

**Problématique initiale.** « Le positionnement de la playlist de question ne
permet à l'animateur ni de lire les question, ni de réellement savoir ce qu'il
fait. » Le panneau annonce 21 questions à venir, en montre quatre, et chaque
ligne affiche « **Q.** » à la place de l'énoncé.

**Diagnostic.** La ligne est une grille à quatre colonnes dans une colonne
latérale de 336 px : `poignée | position | ÉNONCÉ (1fr) | ↑ ↓ ×`.

Les trois commandes portent chacune un **plancher tactile de 44 px**
(`--hit-min`), soit 132 px, plus leurs écarts. Avec la poignée, le numéro, les
gouttières et le rembourrage, il ne reste à l'énoncé que quelques dizaines de
pixels.

Et `.file__text` porte `overflow: hidden`, ce qui **autorise la colonne `1fr` à
se réduire à zéro**. Sans cela, la grille aurait refusé de comprimer le texte
sous sa largeur minimale et aurait débordé — un débordement visible qu'on aurait
corrigé. Ici, elle se comprime en silence.

Le plancher de 44 px est juste. **Ce n'est pas lui qui est faux, c'est de
vouloir tenir un énoncé et trois cibles tactiles sur une ligne de 336 px.**

Les deux observations annexes : la **bande vide** est une ligne coupée par le
plafond de hauteur (`max-height: 34vh`) ; l'intitulé **« CLASSEMENT — TOI
SEUL »** est plus long que sa colonne.

**Ce que la v1 avait décidé et qui n'est pas tenu.** Décision 13 de l'action 6 :
*« La question en cours est affichée hors de la file, comme un titre en cours de
lecture. »* Rien ne distingue aujourd'hui ce qui vient d'être posé de ce qui
vient — c'est précisément le « savoir ce qu'il fait ».

**Décisions entérinées.**

1. **La file quitte la colonne latérale et s'installe dans la colonne centrale,
   sous le bloc du jeu en cours.** *(Placement arbitré par l'auteur, contre une
   proposition initiale qui la gardait à droite.)*
2. **La ligne reste sur un seul étage** : à la largeur de la colonne centrale
   (~1100 px contre 336), énoncé, numéro, poignée et les trois commandes y
   tiennent. Le placement règle la lisibilité par la géométrie.
3. **`.file__text` n'emploie plus `overflow: hidden` comme instrument de
   compression** : une compression future doit **déborder visiblement** au lieu
   de se taire.
4. **La question en cours est affichée hors de la file**, distincte et non
   déplaçable — décision 13 de l'action 6 de la v1, réalisée ici.
5. **Quatre lignes visibles sans défiler** ; au-delà, la file défile dans son
   bloc. **La barre d'actions reste au-dessus du pli en toutes circonstances** —
   en direct, perdre « Question suivante » coûte plus cher que défiler.
6. **La file est visible en permanence** pendant la séance, y compris pendant
   une question : la voir fondre est ce qui empêche de se retrouver à sec.
7. **La file ne part que vers l'écran de l'animateur** — jamais sur le canal
   partagé avec le stream. Confirme la décision 8 de l'action 6 de la v1.
8. **La colonne de droite reste en l'état** : le classement n'est pas remonté.
9. **L'intitulé « CLASSEMENT — TOI SEUL » ne se coupe plus.**
10. **Contrôle** : sur une file de vingt questions, mesure du nombre de
    caractères réellement rendus par énoncé, des quatre lignes visibles sans
    défiler, et de **la position du bas de la barre d'actions par rapport au
    pli**.
11. **Le menu « Changer de module » est vérifié ouvert par-dessus la file**, pas
    sur un écran au repos.

**Étapes.**
1. Déplacer le panneau vers la colonne centrale, sous le jeu en cours. *≈ 2 h.*
2. Garder la ligne sur un étage, l'énoncé occupant l'espace rendu. *≈ 1 h.*
3. Retirer `overflow: hidden` de la contrainte de largeur. *≈ 15 min.*
4. Afficher la question en cours hors de la file. *≈ 1 h.*
5. Régler la hauteur pour quatre lignes. *≈ 30 min.*
6. Corriger l'intitulé du classement. *≈ 15 min.*
7. Contrôles automatiques. *≈ 2 h.*

**Dépendances.** Précède l'action 4.

**Impacts.** Le panneau change de colonne : la latérale droite ne garde que le
classement. **Point à mesurer, et il est juste** : quatre lignes à 68 px de pas
font ~272 px pour ~260 px libres sous la répartition. Le contrôle 10 tranchera.
Aucun impact sur le serveur, le modèle de file ou le réordonnancement.

**Risques et mitigations.**
- *La barre d'actions passe sous le pli* → mesurée par le contrôle 10. C'est
  exactement le défaut de l'action 16 de la v1, mesuré alors à 886 px pour une
  fenêtre de 656.
- *Le menu de module s'ouvre vers le haut depuis cette barre* → vérifié ouvert
  par-dessus la file (décision 11).
- *Énoncé long encore tronqué* → l'infobulle existante (`title`) reste.
- *Défaire l'action 3 par l'action 4* → ordre imposé, sans intercalage.

**Charge : ≈ 0,75 j.**

---

## Action 4 — L'animation du glisser-déposer · **RETENUE**

**Problématique initiale.** « Aussi je souhaite qu'il y ait une animation
correcte du drag and drop. »

**Diagnostic.** Le glisser fonctionne, mais **rien ne bouge**. Tout le retour
visuel tient dans `.file__row--pris { background: var(--c-secret-wash); }` : la
ligne prise change de teinte et reste sur place.

```js
const SEUIL = 28; // hauteur approximative d'une ligne
if (Math.abs(dy) < SEUIL) return;
deplacer(pris, vers);
```

Cinq défauts, du plus visible au plus sournois :

1. **La ligne ne suit pas le doigt.** Aucun retour sur ce que l'animateur tient.
2. **Le réordonnancement se téléporte.** Aucune transition sur `.file__row` : la
   liste clignote dans son nouvel ordre. C'est ce clignotement qui se lit comme
   « pas d'animation ».
3. **Le seuil est faux.** Le commentaire l'avoue — « hauteur **approximative**
   d'une ligne ». La ligne fait 60 px, le seuil 28 : elle saute d'un rang avant
   que le pointeur ait parcouru un rang.
4. **Chaque pas part sur le réseau.** Un glisser de cinq places envoie **cinq
   messages** ; un seul compte, celui du lâcher.
5. **Aucun défilement automatique.** Avec quatre lignes visibles sur vingt et
   une, déplacer une question de la place 1 à la place 15 est **impossible au
   glisser**.

Ce que la v1 avait prévu et qui tient : la poignée dédiée et le principe du
seuil (décision 12 de l'action 6). C'est sa **valeur** qui est fausse, pas son
principe.

**Décisions entérinées.**

1. **La ligne prise suit le pointeur** et se soulève — ombre et léger
   agrandissement. C'est le seul retour qui dit « je tiens ça ».
2. **Les autres lignes s'écartent en transition** et marquent la place
   d'atterrissage.
3. **Le seuil est dérivé de la hauteur mesurée de la ligne**, jamais d'une
   constante approchée.
4. **Le serveur n'est prévenu qu'au lâcher** : un glisser émet **un seul**
   message de réordonnancement, quel que soit le nombre de rangs parcourus.
   Supprime quatre messages sur cinq et toute course avec la prise de tête de
   file (décision 14 de l'action 6 de la v1).
5. **Défilement automatique** quand le pointeur approche le haut ou le bas de la
   fenêtre de quatre lignes ; vitesse proportionnelle à la distance au bord,
   avec plafond.
6. **L'annulation ramène la ligne à sa place d'origine** : touche d'échappement
   et perte du pointeur.
7. **Sous la préférence « sans animation »**, la ligne prise **suit toujours** le
   pointeur — c'est de l'information, pas de la décoration — mais les autres se
   replacent sans transition.
8. **L'affichage suit l'ordre confirmé par le serveur** (`host:queue`), pas
   l'ordre supposé : un échec réseau ne peut pas rester silencieux.
9. **Contrôle** : un glisser de la place 1 à la place 4 donne l'ordre attendu,
   **n'émet qu'un seul message**, et la ligne prise se déplace réellement
   pendant le geste.
10. **Le glisser est vérifié au doigt sur une vraie tablette.** S'il déçoit, la
    décision 9 de l'action 6 de la v1 s'applique : il est retiré sans perte de
    fonctionnalité, les boutons couvrant le besoin.
11. **Les durées viennent des jetons de mouvement existants** — aucune valeur
    inventée.

**Étapes.**
1. Faire suivre le pointeur à la ligne prise, avec son relief. *≈ 2 h.*
2. Faire s'écarter les autres lignes, marquer la place d'atterrissage. *≈ 2 h.*
3. Dériver le seuil de la hauteur mesurée. *≈ 30 min.*
4. N'émettre qu'au lâcher ; le glisser reste local. *≈ 1 h.*
5. Défilement automatique aux bords. *≈ 1 h.*
6. Annulation par échappement et perte de pointeur. *≈ 30 min.*
7. Contrôle automatique. *≈ 1 h.*

**Dépendances.** Après l'action 3.

**Impacts.** Le réseau s'allège nettement. Comportement changé sur un point :
**tant que l'animateur n'a pas lâché, le serveur ignore le déplacement** — ce
qui est le comportement attendu d'un glisser. Aucun impact sur le modèle de
file, le tirage ou la non-répétition.

**Risques et mitigations.**
- *Animation qui tient l'animateur en otage* → durées courtes issues des jetons
  (décision 11).
- *Glisser tactile décevant sur tablette* → décision 10, avec sa porte de sortie.
- *Défilement automatique qui s'emballe* → vitesse plafonnée (décision 5).
- *Échec réseau masqué par un ordre local* → affichage de l'ordre confirmé
  (décision 8).

**Charge : ≈ 1 j.**

---

## Action 5 — Une seule marque, sur toutes les surfaces · **RETENUE**

**Problématique initiale.** « La favicon feu de bois en motion design n'est pas
présente sur toute les pages. »

**Diagnostic.** Le projet fait vivre **trois exemplaires** d'une même flamme au
trait, plus un emblème sans rapport.

| | Icône d'onglet | Marque du chargement | Marque du stream | Emblème d'amorçage |
|---|---|---|---|---|
| Où | `index.html:10` | `BrandLoader.jsx:27` | `OverlayApp.jsx:24` | `index.html:43` |
| Grille | **32** | 24 | 24 | — (PNG) |
| Trait | **2,6**, `#f59a3c` en dur | 2,1, `currentColor` | 2,1, `currentColor` | — |
| Fond | plaque brune | aucun | aucun | image pleine |
| Animation | aucune | `brand-flame` + `brand-spark` | idem, plus `brand-ember` | `boot-pulse` |
| Portée | tous les onglets | toutes sauf `/overlay` | couronne du podium | avant le montage de React |

Deux copies conformes — `BrandLoader` et `OverlayApp`, strictement identiques —
et **une qui a divergé** : celle de l'onglet, sur une autre grille et une autre
épaisseur. Tant que le dessin est recopié, il redivergera.

Or la planche de design est explicite (`design/claude-design/S1.html:60`) :
*« Version animée — flamme qui respire, braise qui scintille, escarbille qui
monte. La version statique n'existe qu'en favicon. »* **Une seule marque, deux
états.** C'est cette règle qui n'est pas tenue.

**Le constat du compte rendu est littéralement vrai.** La marque animée est
absente de deux endroits : de **`/overlay`**, dont le montage exclut
délibérément l'écran de chargement (`main.jsx:29`), et d'**avant le montage de
React** sur toutes les surfaces, où `index.html` affiche le PNG du tipi.
L'identité change donc **trois fois** pendant un chargement.

**Observation hors périmètre.** `#f59a3c` est écrit en dur dans `index.html`. Le
contrôle du système de design ne balaie que les feuilles `.css` de `src/client` :
ce fichier lui échappe. Signalé, non traité ici.

**Décisions entérinées.**

1. **Une seule géométrie de flamme** fait référence pour tout le projet :
   l'onglet en prend l'état fixe, l'application l'état animé.
2. **La marque animée est présente sur toutes les surfaces, `/overlay`
   compris.** Concrètement : ce qui manque à `/overlay` n'est pas la marque —
   elle y est déjà en couronne du podium — mais l'**écran de chargement**.
3. **L'icône d'onglet ne s'anime pas.** Aucune minuterie JavaScript n'est posée.
   Motif : les navigateurs n'animent pas un SVG d'onglet ; il faudrait redessiner
   un canevas en permanence sur chaque page ouverte, pour un effet que les
   joueurs — en plein écran sur téléphone — ne verraient pas.
4. **Le PNG `avatar-emblem-tipi` disparaît du projet** : écran d'amorçage,
   `src/public/assets/`, `design/assets/` (image, sidecar, spécification), et ses
   entrées de registre — `.artifact.yaml`, `PIPELINE-INDEX.yaml`,
   `assets-manifest.yaml`. Le supprimer sans toucher au registre ferait échouer
   le contrôle de cohérence du dépôt.
5. **L'écran d'amorçage affiche la flamme au trait**, la même que partout
   ailleurs : l'identité cesse de changer en cours de chargement.
6. **La plaque de fond n'existe que pour l'état d'onglet** — contrainte du
   support, pas variante de marque. Une marque sans fond disparaît sur un onglet
   clair.
7. **Sur `/overlay`, l'écran de chargement conserve son fond transparent** : un
   rectangle opaque à chaque rechargement passerait à l'antenne.
8. **Contrôle** : les deux états dérivent de la **même** géométrie, et la marque
   est présente sur chacune des quatre surfaces. Le contrôle compare les
   géométries — il ne vérifie pas la présence d'un fichier — pour que deux
   marques ne puissent plus diverger en silence.
9. **L'adresse de l'icône est versionnée** pour contourner le cache, agressif
   dans tous les navigateurs.

**Étapes.**
1. Établir la géométrie unique et la sortir en une source unique. *≈ 2 h.*
2. En dériver l'état fixe pour l'onglet, l'état animé pour l'application. *≈ 1 h.*
3. Remplacer l'emblème d'amorçage par cette flamme. *≈ 1 h.*
4. Supprimer le PNG du tipi et ses entrées de registre. *≈ 1 h.*
5. Ajouter l'écran de chargement à `/overlay`, fond transparent. *≈ 1 h.*
6. Contrôle automatique. *≈ 1 h.*

**Dépendances.** Après l'action 1 (même écran).

**Impacts.** L'identité devient cohérente d'un bout à l'autre du chargement —
gain visible à chaque ouverture. Aucun impact sur le jeu. Le registre d'actifs du
pipeline perd une entrée, ce qui doit être fait proprement sous peine d'échec du
contrôle de cohérence.

**Risques et mitigations.**
- *Unifier les géométries change l'aspect de l'une des deux* → poser les deux
  dessins côte à côte avant de trancher ; c'est un choix visuel, il revient à
  l'auteur.
- *Une marque sans fond disparaît sur onglet clair* → plaque conservée pour le
  seul état d'onglet (décision 6).
- *Cache de favicon* → adresse versionnée (décision 9).
- *Suppression du PNG cassant le contrôle de cohérence* → les entrées de
  registre font partie de la décision 4, elles ne sont pas un après-coup.

**Charge : ≈ 0,75 j.**

---

# 4. Points ouverts

**O2 — Le nom du jeu et le domaine.** Hérité de la v1, **non rouvert**
(décision 2.8). Ce chantier apporte une deuxième preuve que l'adresse
d'hébergement force des compromis de mise en page ; la décision reste différée
par l'auteur.

Aucun point ouvert neuf. Un **point à mesurer** subsiste, consigné dans l'action
3 : quatre lignes de file font ~272 px pour ~260 px disponibles. Ce n'est pas un
arbitrage en attente mais une vérification que le contrôle 3.10 tranchera.

---

# 5. Hors périmètre

- **Animer l'icône d'onglet** (décision 5.3) : refusé pour son coût — minuterie
  permanente sur chaque page — au regard d'un effet invisible pour les joueurs.
- **`#f59a3c` écrit en dur dans `index.html`** : le contrôle du système de design
  ne balaie pas ce fichier. Signalé, non traité.
- **Élargir la colonne latérale de l'animateur** : écarté au profit du
  déplacement de la file au centre (décision 3.1).
- **Remonter le classement dans la colonne de droite** libérée (décision 3.8).
- **Cacher les commandes de file derrière un menu compact** : écarté — en
  direct, un bouton visible ne se cherche pas.

---

# 6. Traçabilité — compte rendu → action → décisions

| Élément du CR#3 (source) | Action | Décisions | Statut |
|---|---|---|---|
| Pastille recouvrant la scène pendant une question *(capture 3)* | 1 | 1.1 à 1.8 | RETENUE |
| Pastille recouvrant la carte du compteur *(captures 4, 5)* | 1 | 1.1 à 1.8 | RETENUE |
| Adresse repliée en colonne verticale au podium *(capture 1)* | 2 | 2.1, 2.2, 2.4 | RETENUE |
| Adresse coupée au milieu d'un mot *(captures 3, 4, 5)* | 2 | 2.1, 2.3 | RETENUE |
| Énoncés illisibles, réduits à « Q. » *(capture 2)* | 3 | 3.1, 3.2, 3.3 | RETENUE |
| « ni de réellement savoir ce qu'il fait » | 3 | 3.4, 3.5, 3.6 | RETENUE |
| « une animation correcte du drag and drop » | 4 | 4.1 à 4.11 | RETENUE |
| Favicon animée absente de certaines pages | 5 | 5.1 à 5.9 | RETENUE |
| Périmètre annoncé : page stream, QR **et** code de salon | 1 et 2 | — | couvert |
| *(observé)* Bande vide en bas de la file *(capture 2)* | 3 | 3.5 | RETENUE |
| *(observé)* « CLASSEMENT — TOI SEUL » coupé *(capture 2)* | 3 | 3.9 | RETENUE |
| *(écarté)* « pr · 2Z78R » compté comme défaut distinct | — | — | même défaut que la colonne verticale |
| *(écarté)* Les cinq captures comme demandes | — | — | traitées comme preuves |

**Onze éléments extraits, tous tracés.** Deux écartés, avec leur motif.

---

# 7. Table d'avancement

| Lot | Action | Décisions | Tenues | Statut | Vérifié par |
|---|---|---|---|---|---|
| 1 | 2 — adresse dans la pastille | 8 | 7 | **fait**, écart 2.3 | `pastille-stream.spec.js` — lignes rendues reconstruites caractère par caractère, sur l'adresse RÉELLE ; quatre tailles consignées (34 / 25,5 / 12,3 / 6,9 px) |
| 1 | 1 — réservation de coin | 8 | 8 | **fait** | `pastille-stream.spec.js` — aire d'intersection mesurée sur cinq points de la partie |
| 2 | 3 — place et lisibilité de la file | 11 | 11 | **fait** | `file-lisible.spec.js` — caractères réellement lisibles (668 px, énoncés entiers), 4 lignes entières, barre d'actions à 704 px pour un pli à 720 |
| 2 | 4 — animation du glisser | 11 | 10 | **fait**, dette 4.10 | `file-lisible.spec.js` — 201 px de déplacement pendant le geste, **un seul** message, échappement sans envoi, défilement 0 → 375 px |
| 3 | 5 — une seule marque | 9 | 8 | **fait**, écart 5.7 | `marque-flamme.test.js` (icône identique à la référence, au caractère près) + `marque-surfaces.spec.js` (flamme sur les quatre surfaces) |
| — | TR1 — vérification par mesure | 1 | 1 | **fait** | tous les contrôles ci-dessus mesurent des boîtes, des lignes ou des caractères — jamais la présence d'une propriété CSS |

La colonne « vérifié par » nomme la **preuve** — un contrôle, une mesure, un
constat. « Fait » sans preuve n'est pas fait.

---

# 8. Audit de clôture — 2026-08-20

**48 décisions confrontées une par une au code. 45 tenues, 2 écarts, 1 dette.**

## Les deux écarts

**Décision 2.3 — « l'adresse tient sur deux lignes au maximum ». Non tenue :
trois lignes.** Elle reposait sur une arithmétique fausse — la mienne : j'avais
divisé la largeur totale de l'adresse par deux, comme si l'on pouvait couper
n'importe où. Les points de coupure sont **discrets**. Une fois `anywhere`
remplacé par `break-word` — ce qui est justement la correction demandée — le
segment `show.onrender.com/play` devient insécable et mesure 450 px à lui seul.
Deux lignes exigeraient une plaque de **482 px**, plus large que les 460 px du
panneau permanent que le chantier v1 a retiré. Trois lignes tiennent dans 380 px.
Mesuré dans le navigateur, consigné dans `tokens.css` et dans le contrôle.

**Décision 5.7 — « sur `/overlay`, le chargement conserve son fond transparent ».
Retirée : sa prémisse était périmée.** Je l'avais prise seul, en annonçant que la
réponse ne faisait pas débat. La scène du stream est elle-même **opaque** depuis
qu'elle est un canevas fixe (`.stream-fit` peint `--c-canvas`) ; les overlays
transparents ont été abandonnés le 2026-08-18, seul un commentaire avait survécu.
Un chargement transparent laisserait voir le même brun.

**Ce que la vérification a trouvé à la place, et qui était un vrai défaut** : la
feuille critique d'`index.html` peignait `oklch(0.200 0.008 80)` — un brun
**neutre** — quand le jeton `--c-canvas` est un brun **chaud**,
`oklch(0.198 0.024 55)`. Chaque chargement virait de l'un à l'autre, sur les
quatre surfaces. Corrigé, et mesuré par un contrôle.

## La dette

**Décision 4.10 — « le glisser est vérifié au doigt sur une vraie tablette ».
Non faite.** Elle demande un appareil réel ; aucun contrôle automatique ne peut
la remplacer. Elle reste **due**, avec sa porte de sortie déjà écrite : si le
geste déçoit au doigt, la décision 9 de l'action 6 du chantier v1 s'applique — le
glisser est retiré sans perte, les boutons couvrant le besoin.

## Ce que l'implémentation a corrigé au-delà du plan

- **La réservation partait de zéro** au lieu de partir de l'ancrage de la
  pastille : elle finissait 24 px trop tôt, et le recouvrement subsistait. Faute
  arithmétique trouvée par la mesure, pas par la relecture.
- **La géométrie n'était jamais mesurée** : l'effet interrogeait le DOM une fois,
  pendant que la connexion s'établissait et que la pastille n'existait pas
  encore. Il ne revenait jamais, la phase n'ayant pas changé.
- **La page de l'animateur grandissait avec son contenu** (`min-height` au lieu
  de `height`) : la file passée au centre, elle atteignait 994 px pour une
  fenêtre de 720 et emportait la barre d'actions sous le pli. C'est le corps qui
  défile désormais.
- **`tests/.data` n'était jamais remis à zéro** : le scénario studio → partie y
  laissait un jeu « Épreuve témoin » à chaque exécution. Après cinq passages, le
  menu en proposait cinq et le contrôle échouait sur une ambiguïté — pas sur un
  défaut du produit. Même famille que la clôture de salon posée au chantier v1.

## Deux contrôles qui criaient au loup

Corrigés avant d'être retenus — un contrôle qui échoue sur du bon comportement
ne vaut pas mieux que pas de contrôle :

- La coupure de l'adresse : je ne regardais que la **fin** de ligne, alors que le
  navigateur coupe aussi **avant** une barre oblique. Il échouait sur
  `show.onrender.com | /play`, qui est propre.
- L'annulation du glisser : elle passait sans que le geste ait démarré. Un
  contrôle qui passe parce qu'il ne s'est rien passé est un faux vert.

## Vérification finale

| | |
| --- | --- |
| `lint:server` | passe |
| `build` | passe |
| Unitaires | **94** (10 fichiers) |
| Bout en bout | **62** |
| Boucle d'intégration | tous contrôles |

Chaque correctif a été éprouvé **dans les deux sens** : le code défectueux
d'origine a été temporairement rétabli — plaque à 232 px, plaque du podium
d'origine, réservation `live` seule, colonne étroite de 336 px, ligne qui ne suit
pas le doigt, un message par rang franchi, icône sur l'ancienne grille 32,
emblème du tipi, défilement automatique retiré — et le contrôle correspondant a
échoué à chaque fois.

*Pour mémoire : l'audit du chantier v1 a trouvé cinq décisions entérinées et
jamais réalisées, dans un plan de 167 que personne n'aurait songé à suspecter.*
