# Chantier v9 — « Cueillette »

Source : `260916 Prompt création Cueillette.docx` (séance du 16/09/2026), plus une
image de référence pour l'emblème — une tulipe et un crayon, au trait noir.

Un module entier, le second depuis « Cache-cache ». Il apporte quelque chose
qu'aucun autre jeu du projet n'a jamais fait : **le joueur ne répond pas, il
produit**. Tout ce qui suit découle de là.

---

## 1. Ce qui est demandé — dépouillement exhaustif

Numérotation continuée depuis le chantier v8.

### Le jeu

| № | Demande | Verbatim |
| --- | --- | --- |
| C1 | Un nouveau module nommé **« Cueillette »** | « il faut créer un nouveau module (jeu) qui s'appellera "Cueillette" » |
| C2 | Un dessin cible paraît **10 s**, puis disparaît | « un dessin va apparaître 10 secondes à l'écran puis disparaître » |
| C3 | Les joueurs ont **30 s** pour le reproduire — au doigt sur téléphone, à la souris sur ordinateur | « les joueurs auront alors 30 secondes pour dessiner le dessin qu'ils viennent de voir » |
| C4 | Les gagnants sont ceux dont le dessin **ressemble le plus** à la cible | « les gagnants sont ceux qui auront produit un dessin le plus ressemblant » |
| C5 | L'animateur **choisit le dessin cible** avant de démarrer | « l'animateur doit avoir la possibilité de choisir quel sera le dessin cible » |

### Les écrans, phase par phase

| № | Écran | Demande |
| --- | --- | --- |
| C6 | joueur, attente | un jingle avec le nom du jeu |
| C7 | stream, attente | le même, au format de l'antenne |
| C8 | emblème | « une fleur avec un crayon à côté pour simuler le dessin » |
| C9 | joueur, diffusion | la cible **au maximum de la place**, 10 s ; puis une zone de dessin **exactement de la même taille** |
| C10 | stream, diffusion | la cible 10 s ; puis « Nos joueurs sont en train de cueillir… que vont-ils nous ramener ? » |
| C11 | animateur, dévoilement | un graphique en barres **de 0 % à 100 % par tranches de 5 %** — vingt tranches — avec le nombre de personnes par tranche |
| C12 | animateur, dévoilement | la cible **et tous les dessins**, avec le **nom du joueur**, et un bouton **« Partager ! »** |
| C13 | joueur, dévoilement | une phrase selon la réussite, les points, et **la cible avec son propre dessin superposé en vert clair** — les traits seuls, sans fond |
| C14 | stream, dévoilement | une phrase de situation (**celles de l'Estimation**) et **le même graphique** que l'animateur |
| C15 | stream, partage | le dessin partagé **en grand**, à la place de la phrase et du graphique |
| C16 | relance | sans repasser par l'écran d'attente |

### Le score

| № | Demande | Verbatim |
| --- | --- | --- |
| C17 | La ressemblance est une **estimation algorithmique cohérente**, pas une vérité | « ce score ne représentera pas une vérité absolue » |
| C18 | Elle tient compte de : position des traits, forme générale, proportions, éléments manquants ou ajoutés, densité | liste explicite |
| C19 | L'objectif est de **classer de façon amusante et perçue comme juste** | « pas de produire une évaluation artistique parfaite » |
| C20 | Barème, **maximum 1200** : moins de 40 % → 0 ; 40 % → 100 ; 95 % et plus → 1200 ; entre les deux, proportionnel | « un joueur ne peut pas gagner entre 1 et 100 pts » |

### Ce qui a été écarté, et pourquoi

Rien. La banque d'images, annoncée dans l'énoncé et absente du premier envoi, est
arrivée en cours de chantier — cinquante dessins. Voir §2.1.

---

## 2. Ce que le document ne dit pas, et qui a été tranché

### 2.1 — La banque d'images

Annoncée manquante au début du chantier, **elle est arrivée en cours de route** :
cinquante dessins au trait, dix arbres, vingt fleurs, vingt fruits. Le repli
provisoire envisagé — les quarante icônes noires de « Cache-cache » — n'a pas été
nécessaire.

**Trois décisions de traitement, aucune dans l'énoncé.**

1. **Recadrage sur l'encre.** Les originaux portaient de larges marges : l'encre
   n'occupait que 31 % à 79 % de l'image. Affichés tels quels, les dessins auraient
   paru minuscules au centre de l'écran, et les joueurs auraient dessiné petit dans
   une grande zone — ce que le calcul de ressemblance aurait puni sur les
   proportions, pour une raison qui ne les regarde pas.
2. **Une toile CARRÉE pour tous.** Les rapports des encres vont de 0,25 — un
   bouleau tout en hauteur — à 1,68 pour une tranche de pastèque. Une zone de
   dessin qui changerait de forme à chaque manche désorienterait les joueurs, et
   rendrait invérifiable la règle « exactement la même taille que l'image du dessin
   cible ». Le carré donne une seule forme, mesurable au pixel.
3. **Une FAMILLE par dessin**, qui n'est pas demandée : cinquante vignettes en vrac
   ne se choisissent pas en direct, trois groupes se parcourent d'un coup d'œil.

Traitement : 512 px, détourage par les bords, WebP 82/méthode 6 — le réglage du
dépôt. **50 Mo d'originaux ramenés à 573 ko.** Vérifié sur planche contact : aucun
dessin troué, les blancs enclos — le creux d'un avocat, la chair d'une noix de
coco, le cœur d'une figue — sont intacts.

### 2.2 — Un dessin est une SUITE DE TRAITS, pas une image

C'est la décision structurante du chantier, et elle n'est pas dans le document.

Un dessin pourrait voyager comme une image matricielle. Trois raisons de ne pas le
faire, et la troisième est décisive :

1. **Le poids.** Mille joueurs qui envoient chacun une image de 400 × 400, c'est
   plusieurs dizaines de mégaoctets sur le réseau du salon, en trente secondes.
   Les mêmes dessins en traits pèsent quelques kilo-octets.
2. **L'échelle.** Le même dessin doit s'afficher sur un téléphone, dans la console
   de l'animateur, et **en grand** sur une toile de 1920 × 1080 au moment du
   partage. Une image tirée d'un téléphone y serait floue ; des traits se
   redessinent à n'importe quelle taille.
3. **La superposition.** C13 demande le dessin du joueur **par-dessus la cible, en
   vert clair, traits seuls et sans fond**. Avec une image matricielle il faudrait
   détourer le fond du dessin d'un joueur — le piège du blanc enclos, déjà connu
   ici. Avec des traits, la couleur est un attribut de tracé : il n'y a rien à
   détourer.

Un dessin est donc une liste de traits, chaque trait une liste de points en
coordonnées **normalisées** (0 à 1) sur la boîte du dessin. Normalisées, parce que
la boîte n'a pas la même taille sur un téléphone et sur la toile — et que C9 exige
qu'elle ait exactement celle de la cible affichée.

### 2.3 — Le score se calcule SUR LE SERVEUR

Le laisser au client, c'est laisser chaque téléphone décider de ses propres points.
Le serveur reçoit les traits, les rastérise lui-même sur une grille fixe, et
compare. Aucun navigateur n'a voix au chapitre — même règle que partout ailleurs
dans ce projet.

### 2.4 — Comment la ressemblance est calculée

C18 énumère cinq choses à prendre en compte. Elles se ramènent à **quatre mesures**
sur une grille de 64 × 64, la cible et le dessin rastérisés de la même façon :

| Ce que le document demande | Comment on le mesure | Poids |
| --- | --- | --- |
| la position des traits | **recouvrement** des deux tracés, après un flou qui pardonne le tremblement de la main | 35 % |
| la forme générale | le même recouvrement, mais sur les deux dessins **ramenés à la même boîte** — ni taille ni place n'y jouent plus | 25 % |
| les proportions | comparaison des **boîtes englobantes** — largeur, hauteur, centre | 15 % |
| les éléments manquants ou ajoutés, la densité | rapport des **quantités d'encre** | 25 % |

**POURQUOI LA FORME EST SÉPARÉE DE LA POSITION**, alors qu'une seule mesure avait
d'abord paru suffire : mesuré, un dessin JUSTE mais deux fois trop petit obtenait
trois pour cent quand un gribouillis au hasard en obtenait neuf. Le gribouillis
gagnait parce qu'il recouvre la cible par accident — il noircit tout. Un spectateur
aurait objecté, et C19 demande un classement « perçu comme juste ».

**LE FLOU N'EST PAS UN DÉTAIL, C'EST LE CŒUR.** Sans lui, deux traits parallèles
distants de deux pixels ne se recouvrent pas du tout : un dessin très ressemblant
obtiendrait un score proche de zéro, et le jeu serait perçu comme injuste — ce que
C19 interdit explicitement. Le flou transforme « au même endroit » en « à peu près
au même endroit », ce qui est la question qu'un spectateur se pose.

**LE SCORE EST ÉTALÉ.** Un recouvrement brut donne des valeurs basses et tassées —
tout le monde entre 10 % et 30 %, personne ne se distingue. Une courbe de
présentation étire cette plage sur 0–100 %, de sorte que les tranches de 5 % de C11
soient réellement peuplées. Le classement ne change pas ; sa lisibilité, si.

### 2.5 — Le nom du joueur NE PART PAS à l'antenne

C12 demande le nom à côté de chaque dessin, **sur l'écran de l'animateur**. C15
demande de partager **le dessin**. Le document ne dit pas de partager le nom, et
la règle du projet est constante depuis le début : les pseudonymes ne quittent
jamais le canal de l'animateur. **Le dessin part seul.** Signalé.

### 2.6 — Le barème, écrit en clair

- moins de 40 % → **0**
- exactement 40 % → **100**
- de 40 % à 95 % → linéaire de 100 à 1200
- 95 % et plus → **1200**

Le palier de 100 points à l'entrée est ce qui rend vraie la phrase « un joueur ne
peut pas gagner entre 1 et 100 pts ».

### 2.7 — Dix secondes, puis trente

La manche a **deux temps** dans une seule manche : la cible paraît dix secondes,
puis la fenêtre de dessin s'ouvre pour trente. C'est la mécanique de « Cache-cache »
— une grille, puis des questions — et elle se redit ici de la même façon plutôt que
d'inventer un second mécanisme de tours.

---

## 3. Chemin critique

```
Lot 0 — la banque provisoire ────────────┐
                                          ▼
Lot A — le SCORE (serveur, sans écran) ──▶ Lot B — le MODULE (manche, tours, barème)
                                                        │
                                                        ▼
                              Lot C — l'écran JOUEUR (dessiner, envoyer, superposer)
                                                        │
                                                        ▼
                    Lot D — ANIMATEUR (graphique, galerie, partager) ──┐
                    Lot E — STREAM (attente, cible, phrase, partage) ──┘
                                                        │
                                                        ▼
                                              Lot F — les VERROUS du dépôt
```

**Pourquoi cet ordre.**

- **Le score d'abord, et sans écran.** C'est la seule partie du jeu dont personne
  ne sait à l'avance si elle « marche » : un barème qu'on trouve injuste ne se voit
  qu'en le faisant tourner sur de vrais dessins. Écrit en premier, il se règle sur
  des dessins de synthèse — le même dessin, le même décalé, le même à moitié, un
  gribouillis — avant qu'un seul pixel d'écran n'existe.
- **Le module ensuite** : il ne peut pas noter avant que noter existe.
- **Le joueur avant l'animateur et l'antenne** : les deux autres écrans montrent ce
  que le joueur a produit. Sans production, il n'y a rien à montrer.
- **Les verrous en dernier**, parce qu'ils portent sur l'ensemble : un type de jeu
  doit avoir son écran d'attente sur les deux surfaces, ses moments de voix, sa
  place dans la semence et dans le Studio. Ils échouent tant que le module n'est
  pas entier — c'est leur rôle.

**Le risque principal est le score (C17-C19).** Il n'a pas de « bonne réponse » à
comparer : il peut être parfaitement implémenté et parfaitement ridicule. C'est le
seul endroit de ce chantier où un contrôle vert ne prouve rien — d'où des dessins
de synthèse dont on SAIT l'ordre attendu, et une planche visuelle avant de livrer.

**Le second risque est la taille de la zone de dessin (C9).** « Exactement la même
taille que l'image du Dessin cible » est une contrainte mesurable, donc vérifiable
au pixel — et elle casse silencieusement dès qu'une marge change.

---

## 4. Journal d'exécution

### Lot 0 — la banque
Cinquante dessins convertis, 573 ko pour 50 Mo d'originaux. Familles : dix arbres,
vingt fleurs, vingt fruits.

### Lot A — le score
Écrit et réglé AVANT tout écran, sur une échelle de figures dont on connaît le
classement attendu : le carré exact, le même tremblé, le même décalé, la moitié, le
quart, le même deux fois trop petit, un cercle à sa place, un gribouillis, et le
dessin juste noyé sous un gribouillage.

**Trois défauts trouvés en réglant, tous invisibles sans mesure.**

1. **Le score dépendait de la CADENCE DU TÉLÉPHONE.** Le pas d'échantillonnage le
   long d'un trait se déduisait de la longueur du segment : un appareil rapportant
   cent points par seconde produisait un quart d'encre de plus qu'un appareil plus
   lent, POUR LE MÊME GESTE — 164 unités contre 132, mesuré. Le classement aurait
   dépendu du matériel, ce qui est la définition d'un jeu injuste. Pas rendu
   constant.
2. **Un gribouillis au hasard battait un dessin juste mais trop petit** — neuf pour
   cent contre trois. Le gribouillis recouvre la cible PAR ACCIDENT, en noircissant
   tout. La forme se mesure désormais sur les deux dessins ramenés à la même boîte,
   séparément des proportions — que l'énoncé cite d'ailleurs à part.
3. **Une moitié de dessin valait 98 %.** L'intersection sur union ne distingue pas
   ce qui manque de ce qui est en trop. Deux mesures distinctes — quelle part de la
   cible est couverte, quelle part du trait est utile — et leur moyenne harmonique.

**Et deux défauts dans mes propres contrôles**, trouvés en les sabotant : le
contrôle du flou regardait le score final, que la mesure de forme rattrapait — le
sabotage passait au vert ; et la justification écrite de la garde « feuille
blanche » était fausse deux fois de suite, jusqu'à ce qu'un sabotage montre que
cette garde ne répare rien et ne fait que nommer un cas connu.

### Lot B — l'emblème et la toile
L'emblème a connu **deux dessins fautifs** avant celui qu'on garde. Le premier
était illégal en lecture : le crayon traversait le pétale droit, sa pointe coupait
la feuille, et l'ensemble se lisait comme un enchevêtrement — ni fleur ni crayon.
Les nombres, eux, étaient bons. Le second avait une **boîte déclarée à la main**,
33 là où l'encre réelle commençait à 26,5 : le pétale latéral gauche sortait du
cadre de six unités et demie, et le navigateur l'aurait rogné en silence, à trois
cents pixels de haut, devant le public. La boîte est désormais CALCULÉE en
évaluant chaque commande de tracé.

La toile est **un composant partagé par les quatre écrans** (joueur, bilan du
joueur, console, antenne), rangé dans `shared/app.css`. Écrite par surface, elle
aurait divergé : c'est l'histoire de `SerieGraphique`, né de deux graphiques
jumeaux qui n'en formaient qu'un.

### Lot C — l'écran du joueur
Le vert de la superposition n'est **pas** le vert clair du système. `--c-pine` a
été essayé et MESURÉ : 1,57:1 sur la plaque claire — un fantôme pâle, alors que
c'est justement son propre dessin que le joueur vient chercher. `--c-moss` ne monte
qu'à 2,53. `--c-trace-joueur` est le vert le plus clair qui passe la barre des 3:1
exigée d'un élément graphique porteur de sens : 3,15:1 sur la plaque, 5,68:1 sur le
trait noir de la cible — car les deux tracés doivent aussi se distinguer **l'un de
l'autre**, ce qui est tout l'objet de la superposition. Écart signalé avec
l'énoncé, qui demandait « vert clair ».

### Lot D — la console de l'animateur
Le partage ne voyage qu'en **index** : les tracés vivent sur la manche, côté
serveur, depuis la révélation. Renvoyer les tracés eux-mêmes aurait fait de la
console une source de contenu pour l'antenne — une porte que rien d'autre n'ouvre
dans ce projet. Le nom s'arrête à la console (décision 2.5).

### Lot E — l'antenne
Quatre moments de plateau, calqués sur la FORME de ceux de l'Estimation et non sur
leurs mots : les phrases de l'Estimation parlent de nombres (« une estimation au
millimètre »), et commenteraient un jeu qui n'est pas à l'écran. Ce qui se reprend,
c'est la structure — les deux extrêmes du groupe, les deux extrêmes de l'individu,
et le silence entre les deux.

### Ce que la vérification EN NAVIGATEUR a trouvé, et que rien d'autre n'aurait vu

1. **La cible mesurait 0 × 0 pendant les dix secondes où elle est tout le jeu.**
   Elle était dans le document, son image était chargée — 512 px de large — et le
   public ne voyait rien. `height: 100%` sur un carré centré dans une grille : la
   hauteur de la case dépendait de son contenu, le contenu de la hauteur de la
   case, le navigateur tranchait par zéro. Corrigé, **puis retrouvé un étage plus
   haut** : le composant emballe la toile dans `.toile__bloc`, et la chaîne
   flexible devait traverser les deux niveaux.
2. **« À toi de dessiner ! » restait affiché à la révélation**, à moitié recouvert
   par le bandeau vert « C'était Tournesol » : deux phrases superposées, dont une
   périmée, sur la toile du stream. Même défaut, au mot près, que la question 5
   restée sous la grille finale de « Cache-cache ».
3. **`pourcent` disparaissait entre le module et le téléphone.** Un champ de module
   traverse DEUX recopies écrites à la main — `results` → `perPlayer` → `you` — et
   il manquait aux deux. Le serveur notait le dessin à 18 %, l'animateur le
   recevait, et le joueur lisait « ton dessin n'est pas arrivé à temps » au-dessus
   d'une cible sans son tracé. Le contrôle d'intégration suit désormais le champ
   sur tout le trajet.
4. **L'écran montrait le dessin ET disait qu'aucun dessin n'avait été envoyé.**
   `myAnswer` est posé au clic, avant toute réponse du serveur : un envoi parti à
   la dernière seconde laisse le téléphone en possession d'un dessin que la manche
   ne compte pas. C'est `pourcent`, et lui seul, qui décide désormais d'afficher
   le tracé.

### Un défaut trouvé dans la suite existante, en passant

La campagne complète a rendu UN rouge, sur un contrôle du chantier v8 :
« une question sans catégorie déclarée a disparu de la file ». Le même contrôle
passait en isolation, et la campagne suivante l'a rendu vert — le signe d'un aléa,
qui est la pire chose qu'une suite puisse produire : il apprend qu'un rouge ne
veut rien dire.

**La cause.** Le contrôle donnait le top avant d'inspecter la file. Or le top
CONSOMME une question : la file est tirée au sort (`session.shuffle`), sa tête part
à l'antenne et devient « en cours ». Sur cinq questions, la question sans catégorie
était en tête une fois sur cinq — et le contrôle accusait le produit d'avoir perdu
ce qu'il avait rangé correctement.

**La correction.** `lancerJeu` accepte de s'arrêter au panneau de préparation, où
la file est déjà visible. Le contrôle regarde la file entière, sans en retirer
quoi que ce soit. Cinq exécutions consécutives, vertes.
