# Plan d'action — séance d'essais du mardi 25 août 2026

**Source** : compte rendu « Tests Mardi 25/08 soir » (liste d'actions + notes de
réunion + tâches de suivi), transmis le 30 août 2026, complété le même jour par
deux apports oraux de l'auteur (police sur tous les écrans, zones de saisie du
« Lien »).

**Participants au compte rendu** : RMA, Theodore.

## Comment lire ce document

Il fait foi. Chaque décision porte un numéro (`A4.2`, `T1`…) et se lit comme un
énoncé vérifiable, jamais comme une intention : elle doit pouvoir être confrontée
au code. La **table d'avancement** (§8) dit où en est chaque action et **par quelle
preuve** elle a été constatée — « fait » sans preuve n'est pas fait. L'**audit de
clôture** (§9) confronte les décisions une à une à la réalisation.

Ce plan couvre **26 actions**, dont 24 extraites du compte rendu et 2 apportées en
cours de route. Cinq éléments du compte rendu ont été retirés du périmètre par
l'auteur : ils étaient déjà traités (§6).

---

## 2. Décisions transversales

| N° | Décision | Ce qu'elle impose |
| --- | --- | --- |
| **T1** | Seuls sont soumis à l'arbitrage de l'auteur les choix qui **changent ce que voient les joueurs, l'animateur ou le public** — un mot, un chiffre, une règle du jeu, une disposition. Tout choix de mécanique interne est tranché et annoncé. | Interdit de faire arbitrer une structure de code, un ordre de feuilles de style ou une forme de contrôle automatique. S'il n'y a pas trois vraies questions de jeu dans une action, on en pose moins. |
| **T2** | Un contrôle automatique n'est adopté qu'après avoir été **vu échouer sur le défaut qu'il prétend attraper**. | Interdit d'écrire un contrôle après la correction sans le confronter à l'état d'avant. Appliqué à A5, A27, A30, A31 et à la garantie du nom (A23). |
| **T3** | On mesure **le rendu, jamais l'intention** : une couleur, une police ou une géométrie se relèvent dans un vrai navigateur, sur l'élément calculé. | Interdit de conclure d'une lecture du CSS ou d'un jeton. C'est ce qui a fait tomber A27, qu'une lecture des jetons aurait déclaré saine. |
| **T4** | Une exception assumée dans un garde-fou est une **dette**, pas une décision : elle se solde. | La liste `MUETS_ASSUMES` du registre de voix est vide (A11). |

---

## 3. Chemin critique

### Ce qui commande l'ordre

Trois pannes en commandaient d'autres, et une seule d'entre elles était connue au
départ :

1. **A27 — aucune police n'était chargée.** Les jetons ne nommaient que des
   familles installées sur la machine. Tant que ce n'était pas réparé, **toute
   vérification visuelle ne valait que pour le Mac qui la faisait** : un écart de
   chasse déplace un bloc, et la toile du stream est calée au pixel. A27 devait
   donc précéder A17 et A22.
2. **A31 — deux champs de saisie sans aucun style.** Même famille : le rendu natif
   du navigateur s'invitait sur une console sombre. Réparé avec A27 parce que la
   cause profonde est commune — une déclaration écrite à un endroit, nommée à un
   autre, et rien qui vérifie le lien.
3. **A30 — les variables des phrases n'étaient pas garanties.** A6 en est un cas
   particulier, et **A13, A14 et A21 allaient créer de nouvelles phrases à
   variables**. Le contrat devait exister avant qu'on en écrive d'autres, sous
   peine de multiplier le défaut.

### L'ordre retenu

| Rang | Action(s) | Pourquoi ici |
| --- | --- | --- |
| 1 | **A31** — lisibilité des champs | Régression introduite par « Le lien », bloquante à l'antenne. La plus urgente. |
| 2 | **A27** — polices auto-hébergées | Commande toute vérification visuelle ultérieure. |
| 3 | **A30, A6** — contrat des variables, `{rang}` | Doit précéder toute nouvelle phrase à variable. |
| 4 | **A1, A2, A3, A7** — marqueur de série, lignes explicatives, redites | Même écran, même passe de relecture. |
| 5 | **A4, A18** — filet du plus proche | Barème serveur, indépendant du reste. |
| 6 | **A5, A15, A16** — studio | Le retrait du bouton de création (A15) impose de refaire le décor de dix contrôles ; à faire d'un bloc. |
| 7 | **A11, A12, A13, A14, A21** — contenu de la voix | S'appuie sur le contrat d'A30. |
| 8 | **A20, A22, A23** — frontières et nom | Vérifications et corrections de surface. |
| 9 | **A25, A26** — sons, clavier | Confort, sans dépendance. |
| 10 | **A17, A24** | Constat et report. |

### Jalons de vérification

- **J1** — après A31 : contrôle de lisibilité vu rouge puis vert. *(fait)*
- **J2** — après A27 : **suite E2E complète**, parce qu'un changement de police
  déplace la mise en page partout. *(fait : 112 contrôles verts)*
- **J3** — après A30/A6 : partie menée jusqu'au classement final, aucune accolade
  sur aucune surface. *(fait)*
- **J4** — après le barème : suite unitaire complète, maximums consignés. *(fait)*
- **J5** — clôture : unitaire + intégration + E2E, deux exécutions.

---

## 4. Les actions

### Action A1 — La phrase des séries · RETENUE

**Problématique initiale** — « Remplacer la phrase des séries par #🔥 ». Rien
d'autre dans le compte rendu. Le mot « la phrase des séries » recouvrait **deux
textes affichés en même temps sur le même écran** : la phrase de voix
`juste.serie` et la ligne d'information « 3 bonnes réponses d'affilée. » sous le
relevé de points.

**Proposition** — Arbitrage de l'auteur : il s'agit de **la ligne sous le relevé
de score**, pas de la voix. Elle devient un marqueur : le nombre suivi d'une
flamme.

**Plan d'action** — Remplacer la ligne `streak-count` par un marqueur ;
ajouter l'icône flamme au registre SVG ; conserver `data-testid`.

**Impacts** — La voix garde ses cinq phrases. Le nombre apparaissait dès lors deux
fois (phrase + marqueur) : traité en A7.

**Risques** — Un marqueur nu peut se lire comme un score ou un rang.

**Mitigations** — `aria-label` explicite (« série de 3 bonnes réponses ») ; pas de
« # », qui se lirait comme un rang.

**Décisions entérinées**
- **A1.1** — « La phrase des séries » désigne la ligne sous le relevé de score. Le
  moment de voix `juste.serie` est conservé.
- **A1.2** — La ligne devient un marqueur : le nombre suivi d'une flamme.
- **A1.3** — La flamme est un **SVG au trait**, pas un emoji : `no_emoji: true`
  reste tenu.
- **A1.4** — Le marqueur s'affiche **à partir d'une série de 2**.
- **A1.5** — Pas de « # » devant le nombre.

---

### Action A2 / A3 — Les lignes explicatives des deux absences · RETENUES

**Problématique initiale** — « Enlever la phrase explicative en dessous de "Le
temps t'a devancé" » et « … de "Manche jouée sans toi" ».

**Proposition** — Retirer les deux lignes. Chaque écran disait trois fois le même
fait : le titre en grand, la ligne explicative en gris, la phrase de voix en
dessous.

**Plan d'action** — Supprimer les deux `<p className="p-lead" role="status">` ;
déplacer `role="status"` sur la phrase de voix.

**Impacts** — Aucun autre écran.

**Risques** — Perdre l'annonce vocale portée par `role="status"`.

**Mitigations** — L'attribut migre sur la phrase de voix, qui subsiste.

**Décisions entérinées**
- **A2.1 / A3.1** — Les deux lignes explicatives sont supprimées. Le titre porte le
  fait, la voix le commente.
- **A2.2 / A3.2** — `role="status"` passe sur la phrase de voix : l'annonce ne
  disparaît pas avec le texte retiré.

---

### Action A4 — Le filet du plus proche · RETENUE

**Problématique initiale** — « N'activer le bonus du plus proche dans Estimation
uniquement si tous les joueurs sont hors palier. »

**Proposition** — Retour à sa raison d'être, telle qu'elle était déjà écrite dans
le code : « le plus proche marque, même si personne n'est dans une plage. Sans
lui, une manche où tout le monde vise trop large ne rapporte rien à personne. »
Le filet avait été posé pour ce cas, puis distribué dans tous les autres — y
compris à qui touchait déjà 1000 de palier, où il n'était qu'un supplément sans
objet.

**Plan d'action** — N'attribuer `BONUS_PLUS_PROCHE` que si **tous** les joueurs
ayant répondu ont le palier `hors`.

**Impacts** — **Le maximum d'une manche d'estimation passe de 1600 à 1200.** Cinq
contrôles unitaires consignaient l'ancienne règle et ont été réécrits.

**Risques** — Prendre ce changement de maximum pour une régression.

**Mitigations** — Il est consigné explicitement dans les contrôles, avec sa raison.
La frontière est éprouvée **des deux côtés** : un seul joueur dans une plage
suffit à effacer le filet ; personne dans une plage le fait revenir.

**Décisions entérinées**
- **A4.1** — Le bonus du plus proche n'est attribué **que si aucun joueur ayant
  répondu n'atteint de palier**.
- **A4.2** — « Tous les joueurs » = tous ceux qui **ont répondu**. Un joueur
  silencieux n'empêche pas le filet de jouer.
- **A4.3** — Le maximum d'une manche d'estimation est **1200** (1000 de palier +
  200 d'exactitude).

---

### Action A5 — Les modifications de module ne survivaient pas · RETENUE

**Problématique initiale** — « Rendre les modifications de module persistantes. »

**Proposition** — Deux défauts distincts sous un même symptôme, tous deux
corrigés :

1. **La suppression ne partait jamais au serveur.** Le seul chemin vers le serveur
   était le bouton « Enregistrer » du panneau d'édition ; or supprimer un module
   **ferme** ce panneau, et l'enregistrement sortait aussitôt faute de module
   sélectionné.
2. **Un jeu en direct ne pouvait pas être enregistré du tout.** La validation du
   studio exigeait « au moins une question ». « Le lien » n'en a pas et n'en aura
   jamais. Le serveur connaissait l'exception depuis toujours ; le studio la
   redéclarait à sa façon et se trompait.

**Plan d'action** — Écrire au serveur dès la suppression ; exempter les jeux
`direct` de la règle « au moins une question ».

**Impacts** — Aucun sur le jeu en cours ; la bibliothèque devient fidèle.

**Risques** — Une suppression devient immédiate et définitive.

**Mitigations** — Elle demandait déjà une confirmation en deux temps.

**Décisions entérinées**
- **A5.1** — La suppression d'un module est **envoyée au serveur immédiatement**,
  sans passer par le bouton d'enregistrement.
- **A5.2** — La règle « au moins une question » **ne s'applique pas** aux jeux
  déclarés `direct`.

---

### Action A6 — `{rang}` en fin de partie · RETENUE

**Problématique initiale** — « Dans les phrases de fin de partie, {rang} ne doit
pas être écrit mais doit indiquer le rang du joueur dans le classement. »

**Proposition** — Cas particulier d'A30 pour la mécanique. Restait le choix de la
**forme** du rang.

**Plan d'action** — Câbler `rang` depuis l'écran de fin ; la valeur y existait déjà
sous le nom `rank`.

**Impacts** — Sept phrases sur huit de `fin.podium` et `fin.classe` redeviennent
lisibles. Le défaut frappait **tout joueur classé, à chaque fin de partie**.

**Risques** — Choisir une notation qui jure avec l'écran.

**Mitigations** — Le relevé du contrôle a montré que l'écran affiche déjà
« Ton rang final — 2e » à dix lignes de là.

**Décisions entérinées**
- **A6.1** — `{rang}` est substitué par l'ordinal **« 1er », « 2e », « 3e »** —
  celui que l'écran affiche déjà sous « Ton rang final ». Une seconde notation
  aurait cohabité avec la première dans le même bloc.

---

### Action A7 — Les formulations redondantes · RETENUE

**Problématique initiale** — « l'objectif de supprimer les formulations
redondantes ».

**Proposition** — Trois redites identifiées et traitées :
1. les deux lignes explicatives sous les titres d'absence (A2, A3) ;
2. le nombre de la série, dit par la phrase **et** par le marqueur (A1) ;
3. — pour mémoire — la ligne « N bonnes réponses d'affilée », supprimée par A1.

**Plan d'action** — Réécrire les cinq phrases de `juste.serie` sans le nombre ;
retirer `requiert: ['serie']`, ce que le contrat d'A30 vérifie.

**Impacts** — La voix garde le ton, le marqueur porte le compte.

**Risques** — Des redites subsistent ailleurs, non détectées.

**Mitigations** — L'outil `tests/outils/balayage-redites.mjs` existe pour un
balayage ultérieur ; il a été remis en état (il pilotait le bouton retiré par A15).

**Décisions entérinées**
- **A7.1** — Les phrases de `juste.serie` **ne citent plus le nombre** ; le
  marqueur le porte.
- **A7.2** — Le moment `juste.serie` ne déclare plus aucune variable.

---

### Action A8 — La rapidité · RETENUE, DÉJÀ TENUE

**Problématique initiale** — « la rapidité devait être traitée comme une condition
prioritaire ou un supplément, et non comme une catégorie générale applicable à
toutes les bonnes réponses ».

**Proposition** — Vérification : c'est déjà le cas, et depuis une décision
antérieure explicite. La phrase de rapidité s'adosse au **drapeau `fastest` du
serveur** — le plus rapide de la manche, un seul — et non à un seuil de vitesse
qui l'aurait donnée à quiconque répond vite.

**Plan d'action** — Aucune modification. Constat consigné.

**Impacts** — A1 améliore le cas de figure : un joueur à la fois le plus rapide
**et** en série voit désormais les deux — la phrase pour la rapidité, le marqueur
pour la série. La collision de priorité a disparu.

**Risques** — Aucun.

**Mitigations** — Sans objet.

**Décisions entérinées**
- **A8.1** — La rapidité reste une **condition prioritaire** adossée au drapeau
  `fastest`, jamais une catégorie applicable à toute bonne réponse. Aucune
  modification n'était requise.

---

### Action A11 — Réintégration des textes · RETENUE

**Problématique initiale** — « il fallait réinsérer les formulations nécessaires ».

**Proposition** — Le classeur corrigé de l'auteur a été intégré lors d'une séance
antérieure. Restait une contradiction en suspens : le moment `reponse.envoyee`,
six phrases conservées pour un écran que l'auteur avait fait retirer. Il figurait
en **exception assumée** du contrôle d'atteignabilité — une dette (T4).

**Plan d'action** — Supprimer le moment et ses six phrases ; vider la liste des
exceptions.

**Impacts** — Le registre passe de 180 à 174 phrases sur ce point, puis remonte
avec les moments créés par A13, A14 et A21.

**Risques** — Supprimer des phrases que l'auteur voudrait garder.

**Mitigations** — Elles sont récupérables dans l'historique ; l'écran qu'elles
commentaient n'existe plus.

**Décisions entérinées**
- **A11.1** — Le moment `reponse.envoyee` et ses six phrases sont **supprimés**,
  avec l'écran qu'ils servaient.
- **A11.2** — La liste des moments volontairement muets est **vide**.

---

### Action A12 — La réponse exacte prime · RETENUE, DÉJÀ TENUE

**Problématique initiale** — « Le cas d'une personne ayant trouvé exactement la
réponse doit pouvoir prendre le dessus et être mis en avant, car il ne s'agit pas
du même événement qu'une simple estimation proche. »

**Proposition** — Vérification : déjà tenu des deux côtés. Côté joueur,
`estimation.exact` est évalué **avant** toute autre branche d'estimation. Côté
plateau, `stream.estim-exact-unique` existe et prime.

**Décisions entérinées**
- **A12.1** — L'exactitude prime sur la proximité, côté joueur comme côté plateau.
  Aucune modification n'était requise.

---

### Action A13 — Les seuils portent sur les réponses données · RETENUE

**Problématique initiale** — « des règles basées sur le nombre de réponses
effectivement données, et non uniquement sur le nombre de joueurs présents » ; et
la couverture des cas « la majorité s'est trompée », « plusieurs réponses presque
à égalité ».

**Proposition** — Deux volets :
1. **Le comptage** était déjà juste : le serveur publie `total = answers.size`.
   Constat consigné et **figé par un contrôle**, pour qu'il ne dérive pas.
2. **« La majorité s'est trompée » n'était pas couvert.** Le moment `stream.piege`
   ne se déclenche que si **une** mauvaise option dépasse la bonne. Quand l'erreur
   se répartit sur trois options, chacune sous la bonne réponse, la majorité s'est
   bel et bien trompée et le plateau se taisait.

**Plan d'action** — Créer `stream.majorite-trompee` ; le placer après le piège dans
l'ordre de priorité.

**Impacts** — Le plateau parle dans un cas de plus. Il reste silencieux par
défaut : c'est une fonctionnalité.

**Risques** — Faire parler le plateau trop souvent.

**Mitigations** — La priorité place le piège devant : quand une option piège
domine, c'est elle l'histoire.

**Décisions entérinées**
- **A13.1** — Les seuils du plateau portent sur les **réponses données**, jamais
  sur les joueurs présents. Figé par un contrôle.
- **A13.2** — Nouveau moment `stream.majorite-trompee` : moins de la moitié des
  réponses sont justes, sans qu'une seule mauvaise option domine.
- **A13.3** — Il passe **après** `stream.piege` dans l'ordre de priorité.

---

### Action A14 — Les cas de vote · RETENUE

**Problématique initiale** — « des cas de vote où une option dépasse largement les
autres, où les deux premières options sont séparées d'une seule voix ou où les
camps sont parfaitement à égalité ».

**Proposition** — Les trois cas étaient réduits à deux : une **même condition**,
« à une voix près », servait l'égalité parfaite et l'écart d'une voix. Le plateau
pouvait donc annoncer « Wow ! Égalité parfaite » sur un écart d'une voix, où c'est
faux.

**Plan d'action** — Séparer `stream.vote-egalite` (égalité stricte) de
`stream.vote-division` (une voix exactement) ; appliquer la même distinction au
quiz, où `stream.egalite` souffrait du même défaut.

**Impacts** — Quatre nouvelles phrases pour le vote ; les phrases existantes de
`vote-division` reformulées pour dire « une seule voix d'écart ».

**Risques** — Aucun : les deux conditions sont exclusives.

**Mitigations** — Contrôle unitaire sur les trois répartitions.

**Décisions entérinées**
- **A14.1** — `stream.vote-egalite` : les deux premières options sont **exactement**
  à égalité.
- **A14.2** — `stream.vote-division` : **une seule voix** les sépare.
- **A14.3** — `stream.egalite` (quiz, vrai/faux) est resserré à l'**égalité
  stricte**.
- **A14.4** — Le consensus de vote reste au seuil de 80 %, inchangé.

---

### Action A15 — La création de module quitte le studio · RETENUE

**Problématique initiale** — « la création d'un nouveau module devait passer par le
code plutôt que par le chemin actuellement visible ».

**Proposition** — Un module n'est pas qu'un nom et une couleur : son **type**
commande un barème, un enchaînement d'écrans et des phrases de voix, tous écrits
dans le code. Le bouton laissait croire qu'on pouvait en inventer un depuis le
studio, alors qu'il ne savait produire qu'un quiz de plus.

**Plan d'action** — Retirer les **trois** boutons (barre d'outils, navigation,
écran vide) ; remplacer le texte de l'écran vide, qui deviendrait sinon un
cul-de-sac.

**Impacts** — **Dix contrôles E2E** fabriquaient leur décor par ce bouton. Ils
passent par l'API. Un seul l'a gardé — celui qui garde le pont Studio → partie —
et il édite désormais un module existant plutôt que d'en créer un.

**Risques** — Casser dix contrôles ; affaiblir le contrôle du pont.

**Mitigations** — Le contrôle du pont conserve la saisie à la main pour le nom,
l'énoncé, les options, la bonne réponse et l'enregistrement : seule la création
passe par l'API, faute de bouton.

**Décisions entérinées**
- **A15.1** — Les trois boutons « Nouveau module » sont supprimés.
- **A15.2** — L'écran vide dit où aller au lieu de proposer une création.
- **A15.3** — Les contrôles automatiques posent leur décor par l'API (`creerJeu`),
  sauf celui du pont Studio → partie, qui garde la saisie à la main.

---

### Action A16 — « Restaurer les questions de base » · RETENUE

**Problématique initiale** — « supprimer ou masquer l'option inutile de
restauration des questions de base ».

**Proposition** — Retirer le bouton, **garder la route serveur**. C'est le chemin
de récupération si la bibliothèque est vidée par accident — du même côté que la
création, le code.

**Décisions entérinées**
- **A16.1** — Le bouton « Restaurer les questions de base » est supprimé du studio.
- **A16.2** — La route `POST /api/modules/restore` **subsiste**, comme chemin de
  récupération.

---

### Action A17 — Les repères de l'histogramme · RETENUE, DÉJÀ FAITE

**Problématique initiale** — « les seuils devaient être affichés ou matérialisés
clairement » ; « afficher les seuils de 2 %, 20 % et les autres paliers ».

**Proposition** — Livré lors d'un chantier antérieur : axe, valeurs, cible
identifiée, bandes ±2/10/20/30 %, barres calées sur les paliers, étiquettes ancrées
à leur seuil.

**Décisions entérinées**
- **A17.1** — Constat : onze contrôles de géométrie couvrent l'axe, les seuils et
  le positionnement des étiquettes, sur la console et sur le stream. Aucune
  modification n'était requise.
- **A17.2** — La vérification visuelle a été **refaite après A27** : un changement
  de police déplace la mise en page.

---

### Action A18 — Le plus proche sans les points standards · RETENUE, RÉSOLUE PAR A4

**Problématique initiale** — « RMA a reçu 400 points pour être la personne la plus
proche, mais pas les points standards liés à une réponse correcte. »

**Proposition** — La situation observée est explicable et conforme : la réponse
était **hors de tous les paliers**, donc sans points de palier, et seul le filet du
plus proche avait joué. Le second volet de la remarque — « la base attendue
semblait être de 1 000 points avec les bonus affichés séparément » — portait sur
l'**affichage du détail**, livré depuis.

Il n'y a donc **pas de contradiction avec A4**, contrairement à ce qui était
signalé en phase 1 : A4 rend ce cas *exclusif*, et le détail (A19) le rend lisible.

**Décisions entérinées**
- **A18.1** — Aucun changement de barème. Une réponse hors de tous les paliers ne
  rapporte pas de points de palier : c'est la règle, et le détail affiché la rend
  vérifiable par le joueur.
- **A18.2** — La contradiction A4 / A18 relevée en phase 1 est **levée** : les deux
  demandes décrivent le même cas, vu de deux côtés.

---

### Action A20 — Les plus proches sur la console, pas dans le flux · RETENUE, DÉJÀ TENUE

**Problématique initiale** — « les informations sur les joueurs les plus proches,
comme Philippe et Romain, devaient apparaître sur l'écran de l'animateur et non
directement dans le flux OBS destiné aux spectateurs ».

**Proposition** — Vérification : les **noms** partent sur le canal `:host` seul ; le
stream ne reçoit que la **valeur** la plus proche, sans aucun pseudo.

**Décisions entérinées**
- **A20.1** — Constat : la frontière est tenue. Aucune modification n'était requise.
- **A20.2** — Elle est **étendue à A21** : la phrase de mise en avant cite un
  pseudo, elle vit donc sur la console et nulle part ailleurs — et un contrôle
  vérifie qu'elle ne fuit pas à l'antenne.

---

### Action A21 — Une phrase à dire pour l'animateur · RETENUE

**Problématique initiale** — « une phrase permettant à l'animateur d'indiquer
qu'une seule personne a trouvé la réponse exacte ou qu'un joueur a obtenu la
meilleure estimation. Cette formulation doit servir à mettre en avant un
participant lorsque la condition correspondante est remplie. »

**Proposition** — L'animateur avait la liste des noms et des valeurs ; il n'avait
pas de quoi la **dire**. Deux moments de voix, **première surface `host` du
registre**, avec quatre phrases chacun.

**Plan d'action** — Faire voyager `exact` avec le nom depuis le serveur ; brancher
la phrase au-dessus de la liste des plus proches.

**Impacts** — Le drapeau d'exactitude vient du **barème**, pas d'une comparaison
refaite côté console : une seconde définition de l'exactitude aurait divergé.

**Risques** — Que la phrase, qui cite un pseudo, atteigne le stream.

**Mitigations** — Un contrôle vérifie qu'elle est absente de l'antenne, et que le
pseudo ne s'y affiche pas.

**Décisions entérinées**
- **A21.1** — Deux moments `host.exact-unique` et `host.meilleure-estimation`,
  surface `host`, quatre phrases chacun, citant `{nom}`.
- **A21.2** — `host.exact-unique` ne se déclenche que si **une seule** personne est
  exacte. À plusieurs, la console se tait — même arbitrage que le plateau.
- **A21.3** — Le drapeau `exact` est publié par le **barème** et voyage avec le nom
  sur le canal `:host`.
- **A21.4** — Ces phrases ne peuvent jamais atteindre le stream.

---

### Action A22 — La place des textes du flux · RETENUE

**Problématique initiale** — Theodore : « il faudrait réserver de l'espace pour les
insérer » ; RMA : « les placer sous la réponse ou dans une zone distincte afin
d'éviter de perturber l'affichage principal ».

**Proposition** — Les deux demandes tenues ensemble. La phrase du plateau
s'affichait **au-dessus** de la répartition et seulement quand elle avait quelque
chose à dire : son apparition poussait tout le bloc vers le bas, d'une manche à
l'autre, sur une toile de 1920 × 1080 calée au pixel.

**Plan d'action** — Déplacer la phrase **sous** la réponse ; lui donner une fente
dont la hauteur est tenue, pleine ou vide.

**Impacts** — Le plateau se tait la plupart du temps : la fente est vide bien plus
souvent que pleine.

**Risques** — Une phrase sur deux lignes déborderait la fente.

**Mitigations** — La fente donne une hauteur **minimale**, pas fixe : elle grandit
si nécessaire, elle ne rétrécit jamais.

**Décisions entérinées**
- **A22.1** — La phrase du plateau passe **sous la réponse**.
- **A22.2** — Sa place est **réservée** : la mise en page ne bouge plus selon qu'elle
  parle ou se tait.

---

### Action A23 — Le nom du jeu partout · RETENUE

**Problématique initiale** — « Appliquer le nom "Le cercle du feu" aux titres et
textes du jeu afin qu'il remplace le nom provisoire "Project". »

**Proposition** — Le nom avait été appliqué lors d'une séance antérieure, et une
garantie automatique interdisait tout ancien nom. **Elle n'a rien vu.** L'écran de
chargement des quatre surfaces affichait encore `Project<br />Game Show` : le
`<br />` planté au milieu faisait que la chaîne « Project Game Show » n'existait
nulle part, et le contrôle la cherchait telle quelle.

C'est la **toute première chose** que voient un joueur, un animateur, un spectateur.

**Plan d'action** — Tirer le nom du registre ; **renforcer la garantie** en
normalisant le code avant la recherche — les balises deviennent des espaces, les
commentaires sont retirés.

**Impacts** — La garantie couvre désormais un nom coupé par une balise.

**Risques** — Que la normalisation efface du code utile.

**Mitigations** — Les commentaires sont retirés **avant** les balises ; le contrôle
a été vu échouer sur l'état d'avant et passer sur l'état d'après.

**Décisions entérinées**
- **A23.1** — L'écran de chargement tire son nom du registre `NOM_DU_JEU`.
- **A23.2** — La garantie « aucun ancien nom » **normalise** le code (balises et
  commentaires) avant de chercher : un nom coupé par une balise est désormais
  détecté.

---

### Action A24 — Le domaine internet · POINT OUVERT

Voir §5.

---

### Action A25 — Les effets sonores · RETENUE

**Problématique initiale** — « l'ajout d'effets sonores afin de mieux signaler la
fin du chronomètre et les événements du jeu » ; « l'absence de signal sonore
rendait difficile la perception de la fin des 20 secondes de réponse ».

**Proposition** — Des sons **synthétisés**, pas des fichiers. Le projet vient de
passer une demi-journée sur des polices présentes dans le dépôt, servies,
préchargées — et jamais déclarées. Un fichier audio est le même piège en plus
lourd : un octet à héberger, une adresse à tenir, un cache à invalider, et un
silence qui ne se voit sur aucune capture. Deux oscillateurs et une enveloppe ne
peuvent pas manquer à l'appel.

**Plan d'action** — Un module partagé ; un bip par seconde sur les cinq dernières,
une chute à zéro, une montée à la révélation sur le stream.

**Impacts** — Le joueur et le stream sonnent. **La console reste muette** :
l'animateur parle par-dessus, et un bip dans son casque est une gêne. Il entend le
stream comme tout le monde.

**Risques** — Aucun navigateur ne joue de son sans geste préalable. Sur le
téléphone d'un joueur, le geste existe. Sur une source OBS, il n'y en a aucun.

**Mitigations** — Le contexte se réveille sans qu'on l'attende ; un son perdu ne
casse jamais l'écran. Le contrôle visuel du chrono ne dépend d'aucun son.

**Décisions entérinées**
- **A25.1** — Les sons sont **synthétisés** (Web Audio), sans aucun fichier.
- **A25.2** — Un bip par seconde sur les **cinq dernières secondes**, une chute à
  zéro.
- **A25.3** — Le joueur qui a **déjà répondu** n'entend rien.
- **A25.4** — Ils sonnent sur **le joueur et le stream**, jamais sur la console.
- **A25.5** — Une montée courte à la **révélation**, sur le stream seulement, une
  fois par manche.

---

### Action A26 — La touche du clavier envoie la réponse · RETENUE

**Problématique initiale** — « après la saisie d'une estimation, le bouton de
validation du clavier du téléphone devrait envoyer directement la réponse ».

**Proposition** — Le champ était déjà dans un formulaire à `onSubmit`, donc la
touche d'action validait — mais elle s'annonçait « Entrée » ou « OK », sans dire ce
qu'elle allait faire. `enterKeyHint="send"` demande au clavier de l'appeler
« Envoyer ».

**Impacts** — Champ d'estimation et champ du « Lien ».

**Risques** — **Réserve honnête** : sur iOS, le pavé **numérique** n'a aucune touche
d'action. Il n'y a donc rien à renommer ni à presser, et le bouton « Envoyer » de
l'écran reste le seul chemin sur ce clavier-là. Sur Android et sur les claviers qui
en ont une, la touche porte « Envoyer » et valide.

**Mitigations** — Le contrôle vérifie l'attribut **et** l'envoi effectif.

**Décisions entérinées**
- **A26.1** — Les champs d'estimation et du « Lien » portent `enterKeyHint="send"`.
- **A26.2** — La touche d'action envoie réellement la réponse, vérifié sans toucher
  au bouton de l'écran.
- **A26.3** — Réserve consignée : sur le pavé numérique iOS, aucune touche d'action
  n'existe.

---

### Action A27 — Les polices · RETENUE

**Problématique initiale** — « Theodore a constaté une police différente ou
incorrecte sur ses écrans de streaming, alors que RMA ne rencontrait pas le même
problème », amendé par l'auteur : « sur **tous** les écrans de Théodore, pas que
sur les écrans de streaming. Comme si dans le code github, la police n'était pas
poussée. »

**Proposition** — L'intuition était bonne, le diagnostic un cran plus loin. **Le
jeu ne chargeait aucune police.** Les trois piles de jetons ne nommaient que des
familles installées sur la machine — Avenir Next, Avenir Next Condensed, Optima,
SF Mono (macOS) ; Segoe UI (Windows). Chacun voyait donc une autre police, sur les
quatre surfaces, jusque dans les chiffres des scores et le code de salon.

Le dépôt contenait pourtant **quinze fichiers de polices** (Fraunces, Inter) et en
préchargeait trois à chaque visite. Leur feuille de déclarations n'était importée
par personne : le CSS construit n'en portait **aucune trace**, et aucune règle ne
nommait ces deux familles. Soixante kilooctets téléchargés par visiteur, jamais
dessinés.

Pour un jeu diffusé en direct, ce n'est pas une option : ce que l'animateur voit,
ce que la caméra diffuse et ce que le joueur lit doivent être le même dessin.

**Plan d'action** — Trois familles libres reproduisant au plus près le rendu macOS
d'origine ; déclarations écrites **dans le fichier de jetons**, à côté des piles
qui les nomment ; préchargements corrigés ; anciens fichiers supprimés.

**Impacts** — 18 fichiers, 168 ko en latin. Les écrans de l'auteur changent peu ;
ceux des autres convergent vers eux. **Commande toute vérification visuelle
ultérieure.**

**Risques** — Une police plus large déplace un bloc quelque part, et la toile du
stream est calée au pixel.

**Mitigations** — **Suite E2E complète** relancée après le changement : 112
contrôles verts, dont les contrôles de géométrie de l'axe, de la file et de la
disposition du stream.

**Décisions entérinées**
- **A27.1** — La typographie est **auto-hébergée**. Le jeu ne dépend plus des
  polices installées sur la machine du lecteur.
- **A27.2** — Le couple retenu reproduit au plus près l'aspect macOS actuel.
- **A27.3** — **Fraunces et Inter sont supprimés**, ainsi que les trois
  préchargements morts.
- **A27.4** — **Les trois familles** sont auto-hébergées — et non deux : `--f-mono`
  porte les scores et le code de salon, et variait autant que les autres.
- **A27.5** — Les `@font-face` vivent dans `tokens.css`, au même endroit que les
  piles qui les nomment.
- **A27.6** — Correspondances : Avenir Next → **Mulish** ; Avenir Next Condensed →
  **Barlow Semi Condensed** ; SF Mono → **IBM Plex Mono**. Toutes sous licence
  libre, servies depuis `/fonts`, sans CDN.
- **A27.7** — Seules les graisses réellement employées sont embarquées.
- **A27.8** — Un contrôle exige que la police **réellement dessinée** soit celle du
  jeton, et que rien ne soit préchargé sans être déclaré.

---

### Action A30 — Le contrat des variables de la voix · RETENUE

**Problématique initiale** — « le "{serie}" s'affiche vraiment en tant que
"{serie}" dans le texte. Le nombre de série n'est pas hérité. Vérifie que ces
éléments dans le texte utilisent bien de vraies variables dans le code. »

**Proposition** — Le mécanisme existait et laissait le texte brut quand la valeur
manquait, **sans rien signaler**. Le registre **déclarait** pourtant le contrat
(`requiert: ['rang']`) : un champ décoratif que personne ne lisait. Trois niveaux
de garantie mis en place : le registre, le passage, l'exécution.

**Plan d'action** — Passage des valeurs en **objet nommé** plutôt qu'en paramètres
positionnels ; filtrage des phrases non servables ; contrôles de registre et de
bout en bout.

**Impacts** — A6 résolue. A13, A14 et A21 allaient créer de nouvelles phrases à
variables : le contrat devait exister avant.

**Risques** — Un repli silencieux masquerait le défaut suivant.

**Mitigations** — Erreur en console dès la première partie d'essai ; contrôle de
bout en bout sur une partie complète.

**Décisions entérinées**
- **A30.1** — `requiert` devient un **contrat vérifié** : toute variable écrite doit
  être déclarée, et réciproquement.
- **A30.2** — Une valeur manquante **ne casse jamais l'écran** : la phrase est
  écartée au profit d'une autre, et à défaut la ligne disparaît. **Jamais
  d'accolade affichée à un joueur.**
- **A30.3** — Une seule partie complète de contrôle couvre les trois variables ; le
  message d'échec nomme la variable fautive.
- **A30.4** — Si une valeur arrive en retard, **la phrase attend** au lieu de
  changer sous les yeux du joueur.
- **A30.5** — Les valeurs voyagent en **objet nommé**, jamais en paramètres
  positionnels.

---

### Action A31 — Les zones de saisie du « Lien » · RETENUE

**Problématique initiale** — « dans le nouveau jeu, les zones de saisie du texte
pour l'animateur sont très mal pensées (texte blanc sur zone de saisie blanche) ».

**Proposition** — Ce n'était pas un mauvais choix de couleur : **ces deux champs
n'avaient aucun style**. Ils portaient une classe définie dans la seule feuille du
studio, que la console ne charge jamais. Ils retombaient donc sur le rendu natif —
et aucune déclaration `color-scheme` n'existait dans le projet, si bien que le
navigateur supposait un fond clair.

Le dépôt savait déjà : le réinitialiseur neutralise `<button>` avec le commentaire
« c'est ce qui faisait apparaître des boutons blancs quand une classe n'était pas
stylée ». La leçon n'avait pas été étendue aux champs.

**Mesure de l'état d'avant** : encre `oklch(0.96 0.018 84)` sur
`rgb(255, 255, 255)` — **1,12 pour 1**. Après : **14,4 pour 1**.

**Décisions entérinées**
- **A31.1** — Seule **la couleur** est corrigée ; la disposition reste inchangée.
- **A31.2** — Les primitives de formulaire **montent** dans la feuille partagée. Une
  copie dans la feuille de la console aurait divergé de celle du studio.
- **A31.3** — `color-scheme: dark` s'applique **globalement**. Le stream n'a aucun
  contrôle natif ; le joueur en a un — le champ d'estimation, sur un téléphone, le
  soir — et c'est la surface qu'il faut le moins exclure.
- **A31.4** — Le réinitialiseur couvre `input`, `textarea`, `select`.
- **A31.5** — Un contrôle exige, sur les quatre surfaces, un contraste ≥ 4,5:1 et,
  pour un champ qui peint sa propre boîte, qu'elle soit **plus sombre que son
  encre**.

---

## 5. Points ouverts

| N° | Ce qui bloque | Ce qui se décide | Ce que ça débloque |
| --- | --- | --- | --- |
| **O1 — A24, le domaine** | « ils ont décidé de modifier d'abord le nom du jeu et de revoir le choix du domaine ultérieurement ». Le nom est fait. | Quelle extension, quel libellé, et l'achat. | La mise en ligne sous une adresse propre, la carte de partage, le QR du stream. |
| **O2 — la persistance à travers un redéploiement** | La bibliothèque est écrite sur le disque du serveur. Sur l'hébergement actuel, ce disque n'est pas garanti d'un déploiement à l'autre. **A5 corrige la persistance dans une session ; elle ne garantit rien contre un redéploiement.** | Monter un disque persistant, ou faire écrire la bibliothèque dans Supabase. | Des questions préparées qui survivent aux mises en ligne. |
| **O3 — le dépôt public** | Reporté par l'auteur lors d'une séance antérieure : « attendons un peu, on verra plus tard ». | Rendre le dépôt privé, ou assumer l'exposition. | — |

---

## 6. Hors périmètre

**Retirés par l'auteur**, déjà traités avant cette séance :

| Élément du compte rendu | Motif |
| --- | --- |
| Logique de priorité entre les phrases | Déjà traité |
| Distinction arrivant tardif / présent sans réponse | Déjà traité |
| Suppression des phrases de gain et perte de place | Déjà traité |
| Paramètres d'estimation par année (±2, ±5, ±10 ans) | Déjà traité |
| Affichage du score de base et des bonus en estimation | Déjà traité |

**Écartés à l'extraction**, sans action attendue :

| Passage | Motif |
| --- | --- |
| « Propagation Des Modifications » | Constat de test réussi |
| Chapeaux de section (sept au total) | Résumés introductifs ; leurs demandes propres sont extraites ailleurs |
| « Fichier De Référence » | Le classeur a été transmis et intégré |
| « Vérification Du Code » | Correction déjà appliquée |
| « Prochains Tests » | Logistique de séance |

---

## 7. Traçabilité — compte rendu → action → décisions

| Élément du CR (abrégé) | Action | Décisions | Statut |
| --- | --- | --- | --- |
| « Remplacer la phrase des séries par #🔥 » | A1 | A1.1–A1.5 | Fait |
| « Enlever la phrase explicative sous "Le temps t'a devancé" » | A2 | A2.1, A2.2 | Fait |
| « Enlever la phrase explicative sous "Manche jouée sans toi" » | A3 | A3.1, A3.2 | Fait |
| « N'activer le bonus du plus proche que si tous hors palier » | A4 | A4.1–A4.3 | Fait |
| « Rendre les modifications de module persistantes » | A5 | A5.1, A5.2 | Fait |
| « {rang} ne doit pas être écrit » | A6 | A6.1 | Fait |
| « supprimer les formulations redondantes » | A7 | A7.1, A7.2 | Fait |
| « la rapidité, condition prioritaire ou supplément » | A8 | A8.1 | Vérifié, sans modification |
| « réinsérer les formulations nécessaires » | A11 | A11.1, A11.2 | Fait |
| « la réponse exacte doit prendre le dessus » | A12 | A12.1 | Vérifié, sans modification |
| « règles basées sur le nombre de réponses données » | A13 | A13.1–A13.3 | Fait |
| « une voix d'écart / camps parfaitement à égalité » | A14 | A14.1–A14.4 | Fait |
| « la création d'un module doit passer par le code » | A15 | A15.1–A15.3 | Fait |
| « supprimer l'option de restauration des questions de base » | A16 | A16.1, A16.2 | Fait |
| « afficher les seuils de 2 %, 20 % et les autres paliers » | A17 | A17.1, A17.2 | Vérifié, déjà fait |
| « 400 points pour le plus proche, mais pas les points standards » | A18 | A18.1, A18.2 | Résolue par A4 |
| « les plus proches sur l'écran de l'animateur, pas dans le flux » | A20 | A20.1, A20.2 | Vérifié, étendu |
| « une phrase pour mettre en avant un participant » | A21 | A21.1–A21.4 | Fait |
| « réserver de l'espace pour les textes du flux » | A22 | A22.1, A22.2 | Fait |
| « appliquer le nom "Le cercle du feu" » | A23 | A23.1, A23.2 | Fait |
| « revoir le choix du domaine ultérieurement » | A24 | O1 | Point ouvert |
| « ajouter les effets sonores, fin du chronomètre » | A25 | A25.1–A25.5 | Fait |
| « le bouton de validation du clavier envoie la réponse » | A26 | A26.1–A26.3 | Fait |
| « police différente sur tous les écrans de Théodore » | A27 | A27.1–A27.8 | Fait |
| « {serie} s'affiche en tant que {serie} » *(apport oral)* | A30 | A30.1–A30.5 | Fait |
| « zones de saisie du Lien, blanc sur blanc » *(apport oral)* | A31 | A31.1–A31.5 | Fait |
| « Propagation Des Modifications » | — | — | Écarté (constat) |
| Sept chapeaux de section | — | — | Écartés (résumés) |
| « Fichier De Référence » | — | — | Écarté (transmis) |
| « Vérification Du Code » | — | — | Écarté (fait) |
| « Prochains Tests » | — | — | Écarté (logistique) |
| Logique de priorité des phrases | — | — | Retiré par l'auteur (déjà traité) |
| Cas des joueurs absents | — | — | Retiré par l'auteur (déjà traité) |
| Phrases de placement | — | — | Retiré par l'auteur (déjà traité) |
| Paramètres des années | — | — | Retiré par l'auteur (déjà traité) |
| Affichage des scores en estimation | — | — | Retiré par l'auteur (déjà traité) |

---

## 8. Table d'avancement

| Action | Décisions | Faites | Statut | Vérifié par |
| --- | --- | --- | --- | --- |
| A1 | 5 | 5 | Fait | `confort-de-jeu`, suite E2E ; marqueur rendu et libellé accessible |
| A2 | 2 | 2 | Fait | `deux-absences.spec.js`, `reconnexion-resultat.spec.js` |
| A3 | 2 | 2 | Fait | idem |
| A4 | 3 | 3 | Fait | `bareme-v4.test.js` (frontière éprouvée des deux côtés), `modules.test.js` |
| A5 | 2 | 2 | Fait | `persistance-studio.spec.js` — vu rouge avant, vert après |
| A6 | 1 | 1 | Fait | `variables-voix.spec.js` — « {rang} du cercle » capturé avant |
| A7 | 2 | 2 | Fait | `voix.test.js` (contrat des variables), relecture d'écran |
| A8 | 1 | 1 | Vérifié | Lecture du sélecteur de moment ; aucune modification |
| A11 | 2 | 2 | Fait | `voix.test.js` — liste des muets vide |
| A12 | 1 | 1 | Vérifié | Lecture de l'ordre des branches ; `voix.test.js` |
| A13 | 3 | 3 | Fait | `voix.test.js` — trois répartitions éprouvées |
| A14 | 4 | 4 | Fait | `voix.test.js` — égalité stricte / une voix / consensus |
| A15 | 3 | 3 | Fait | Suite E2E complète après conversion des dix décors |
| A16 | 2 | 2 | Fait | `studio.spec.js`, suite complète |
| A17 | 2 | 2 | Vérifié | `axe-estimation.spec.js` (11 contrôles), rejoué après A27 |
| A18 | 2 | 2 | Fait | `bareme-v4.test.js` ; analyse consignée |
| A20 | 2 | 2 | Vérifié | `confort-de-jeu.spec.js` — la phrase ne fuit pas à l'antenne |
| A21 | 4 | 4 | Fait | `confort-de-jeu.spec.js` — « Pile poil, et une seule fois : Pile. » |
| A22 | 2 | 2 | Fait | `stream-disposition.spec.js`, suite complète |
| A23 | 2 | 2 | Fait | `marque.test.js` renforcé — vu rouge avant, vert après |
| A24 | — | — | Point ouvert | — |
| A25 | 5 | 5 | Fait | `confort-de-jeu.spec.js` — `880 ×5`, puis `660, 415` |
| A26 | 3 | 3 | Fait | `confort-de-jeu.spec.js` — attribut **et** envoi effectif |
| A27 | 8 | 8 | Fait | `polices.spec.js` — vu rouge avant ; suite E2E complète après |
| A30 | 5 | 5 | Fait | `voix.test.js` (4 contrôles), `variables-voix.spec.js` |
| A31 | 5 | 5 | Fait | `lisibilite-champs.spec.js` — 1,12:1 avant, 14,4:1 après |

---

## 9. Audit de clôture

Confrontation **décision par décision**, pas un balayage d'ensemble : chaque
énoncé numéroté a été relu, puis cherché dans le code ou dans le relevé du
contrôle qui le garde.

### Le décompte

**66 décisions confrontées** — 4 transversales et 62 d'action. **Quatre écarts
trouvés**, dont trois corrigés séance tenante et un déclaré ouvert.

### Les écarts

**Écart 1 — A25.5 était réalisée et ne l'était par personne.**
La montée de révélation sur le stream était écrite, branchée, et **aucun contrôle
ne la regardait**. Le contrôle des sons ne couvrait que le compte à rebours du
joueur. Or c'est la décision la plus fragile du lot : l'écran de révélation se
re-rend plusieurs fois, et sans repère de manche le son repartirait à chaque
rendu — un hoquet à l'antenne, devant tout le monde.
*Corrigé* : contrôle ajouté, qui laisse passer 1,5 s de re-rendus avant de
compter. Relevé : `660, 415, 523, 784 Hz — 1 révélation sonnée`.

**Écart 2 — A22.2 était réalisée et ne l'était par personne.**
La fente réservée pour la voix de plateau existait, et rien ne vérifiait qu'elle
tenait sa hauteur quand la phrase se tait — c'est-à-dire dans le cas le plus
fréquent, puisque le plateau est muet la plupart du temps.
*Corrigé* : contrôle ajouté sur une manche où le plateau se tait. Relevé :
**45 px réservés**, phrase absente.

**Écart 3 — A6.1 a changé de contenu en cours de réalisation.**
La forme décidée était « N° 1, N° 2, N° 3 », choisie pour ne pas genrer le
premier rang. Le relevé du contrôle de bout en bout a montré, dans la capture de
l'état d'avant, que l'écran de fin **affiche déjà** « Ton rang final — 2e » à dix
lignes de la phrase. Deux notations pour la même chose, dans le même bloc.
*Corrigé* : la décision a été révisée sur preuve, et l'ordinal de l'écran adopté.
La révision est consignée dans A6.1, avec sa raison.

**Écart 4 — A30.4 n'est pas gardée par un contrôle automatique. OUVERT.**
« Si une valeur arrive en retard, la phrase attend au lieu de changer sous les
yeux du joueur. » La garantie est tenue **par construction** — le crochet ne sert
rien tant qu'une valeur déclarée manque — et vérifiée **par lecture**. Elle n'est
gardée par aucun contrôle : l'éprouver demanderait de rendre le crochet hors d'un
navigateur, et le projet n'embarque pas de moteur de rendu de composants dans ses
dépendances de développement. En ajouter un pour cette seule garantie serait
disproportionné ; le taire serait malhonnête. **C'est le seul énoncé de ce plan
dont la réalisation n'est pas opposable à un contrôle.**

### Ce qui a été observé en chemin, hors périmètre

- **La chute de fin de temps sonne aussi sur une révélation anticipée.** Quand
  l'animateur révèle avant la fin du chrono, la fenêtre de réponse se ferme et le
  client passe à zéro : les joueurs et le stream entendent la chute, puis la
  montée de révélation, à trois dixièmes de seconde d'écart. C'est cohérent — la
  chute dit « les réponses sont closes », quelle qu'en soit la cause — et c'est
  visible dans le relevé du contrôle. Signalé, pas modifié.
- **Le contrôle « aucun ancien nom » avait un angle mort de conception**, pas
  seulement un défaut de couverture : il cherchait une chaîne, là où le nom était
  coupé par une balise. Corrigé en A23.2, mais la leçon dépasse ce cas — tout
  contrôle qui cherche du texte dans du JSX doit normaliser avant de chercher.
- **Deux contrôles ont dû être réparés avant de pouvoir servir** : ma première
  mesure de contraste lisait les couleurs `oklch()` comme du rouge-vert-bleu et
  donnait 1,06:1 sur des champs parfaitement lisibles. Un contrôle faux est pire
  qu'un contrôle absent : il rassure.

### Ce qui reste ouvert à la clôture

| N° | Objet |
| --- | --- |
| **O1** | Le domaine internet (A24) — décision de l'auteur, différée. |
| **O2** | La persistance de la bibliothèque **à travers un redéploiement**. A5 corrige la persistance dans une session ; elle ne garantit rien contre un redéploiement, le disque du serveur n'étant pas garanti d'une mise en ligne à l'autre. |
| **O3** | Le dépôt public — reporté par l'auteur lors d'une séance antérieure. |
| **Écart 4** | A30.4 sans contrôle automatique (ci-dessus). |

### État de la suite au moment de la clôture

| Suite | Avant le chantier | À la clôture |
| --- | --- | --- |
| Unitaire | 130 | **137** |
| Intégration | verte | **verte** |
| Bout en bout | 106 | **119** |

**Vingt contrôles écrits pour ce plan** — 7 unitaires, 13 de bout en bout — dont
**cinq ont été vus rouges sur le défaut qu'ils gardent** avant d'être adoptés
(A5, A23, A27, A30, A31), conformément à la décision transversale T2.
