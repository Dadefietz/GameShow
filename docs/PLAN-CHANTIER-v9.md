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

---

## 5. Audit de clôture — 18/09

Vingt demandes numérotées (C1–C20) et sept décisions (§2.1–2.7), confrontées une à
une à la réalisation. **Un seul écart**, et c'était une promesse que ce plan se
faisait à lui-même contre son propre risque principal :

> « des dessins de synthèse dont on SAIT l'ordre attendu, **et une planche visuelle
> avant de livrer** »

Les dessins de synthèse existaient. La planche, non. Elle est désormais
`tests/outils/planche-cueillette.mjs`, et son résultat justifie à lui seul le
chantier de clôture.

### 5.1 — Ce que la planche a trouvé, et que 363 contrôles verts laissaient passer

Sur de VRAIS dessins de la banque, le barème était injuste de trois façons :

| Ce qu'on voyait | Mesuré |
| --- | --- |
| Un GRIBOUILLIS au hasard rapportait des points | 140 pts sur le chêne, 380 sur le tournesol |
| Une ROSE dessinée pour un TOURNESOL payait presque plein tarif | 73 %, soit 760 pts — plus qu'un tournesol à moitié dessiné |
| Un dessin JUSTE mais tracé petit s'effondrait | 35 % sur la pomme, c'est-à-dire ZÉRO point, derrière le gribouillis |

**La cause, mesurée et non devinée.** Les quatre mesures s'ADDITIONNAIENT. Or les
proportions et la densité donnaient 0,89 et 0,66 au gribouillis, 0,95 et 0,81 à la
rose : elles offraient **quarante pour cent de la note** à quiconque pose à peu près
la bonne quantité d'encre dans à peu près la bonne boîte — ce qu'un gribouillis fait
par construction. Pendant ce temps le dessin juste mais petit était puni **trois
fois pour le même écart** : par le recouvrement, par la densité (moins d'encre) et
par les proportions (boîte plus petite).

**Pourquoi aucun contrôle ne le voyait.** Ils travaillent tous sur un carré, un
cercle, un rectangle — des figures petites et simples. Un carré ne dit rien d'une
fleur. C'est la limite que cet outil existe pour couvrir, et elle était écrite dans
le plan avant d'être rencontrée.

### 5.2 — Ce qui a changé dans le calcul

1. **Deux mesures paient, deux mesures retiennent.** Le recouvrement (55 %) et la
   forme (45 %) — celles qui regardent la FIGURE — composent la note. Les
   proportions et la densité deviennent des gardes MULTIPLICATIVES, bornées à 0,55 :
   elles ne peuvent que réduire une note gagnée par ressemblance. *Tenir compte
   n'est pas payer.* Un gribouillis n'a rien gagné, il n'a donc rien à retenir.
2. **« Les proportions » = le rapport de la figure, non sa taille.** Un carré plus
   petit reste un carré ; c'est sa POSITION qui a changé, et le recouvrement la
   punit déjà. Ce qui perd sur les proportions, c'est un bouleau dessiné dans un
   carré.
3. **« La densité » = l'encre rapportée à l'ÉTENDUE de la figure.** Un dessin est
   fait de lignes : son encre croît comme une longueur, pas comme une surface. Deux
   rédactions intermédiaires ont été mesurées fausses — l'encre brute (punissait la
   taille deux fois), puis l'encre des dessins normalisés (la main HÉSITANTE passait
   devant la copie fidèle, par artefact de normalisation).
4. **La normalisation gagne une marge de deux cases et demie.** Sans elle la figure
   touchait les quatre bords, `poser` rognait l'épaisseur du trait, et la part
   rognée dépendait de l'échantillonnage : quatre pour cent d'écart sur la forme
   entre deux tracés du MÊME carré. C'était le tout premier défaut du jeu — la note
   qui dépend de la cadence du téléphone — revenu par une autre porte.
5. **La grille de FORME n'est plus stockée, elle est DÉRIVÉE.** C'est le défaut le
   plus grave qu'ait causé le point 4 : la seconde grille de chaque dessin était une
   photographie de ce que `normaliser` faisait le jour de la conversion. En changeant
   la fonction, la cible serait restée sur l'ancienne règle et le joueur passé à la
   nouvelle — les deux figures dans deux unités différentes, toute la banque notée de
   travers, et **rien n'aurait pu le signaler : une donnée ne se compare pas à une
   fonction.** Le fichier des grilles est passé de 68 à 36 ko.

### 5.3 — Les bornes, après correction, sur les cinquante dessins

| | Avant | Après |
| --- | --- | --- |
| La plus mauvaise copie fidèle des 50 | — | **96 %** → 1200 pts |
| Le gribouillis le mieux noté des 50 | 380 pts | **37 %** → **0 pt** |
| Le pire des 2450 intrus | 760 pts | 900 pts (voir 5.4) |

### 5.4 — Une limite assumée, et mesurée

Un **coquelicot dessiné pour une rose** paie presque plein tarif. À 64 × 64 cases,
adoucies par le flou qui pardonne la main tremblante, ce sont le même dessin.

Un terme de DÉTAIL, mesuré sans le flou, a été essayé pour les séparer — **et
abandonné sur mesure** : le pire intrus y obtient 0,666 quand une main humaine
ordinaire obtient 0,651 et une main lourde 0,579. Il aurait puni l'honnête plus que
le tricheur. L'information n'est pas dans la grille ; l'y chercher plus finement
reviendrait à punir d'abord ceux qui tremblent.

L'énoncé l'admet d'avance : « ce score ne représentera pas une vérité absolue […]
pas de produire une évaluation artistique parfaite ». C'est consigné ici pour que
personne ne rouvre le sujet à l'aveugle.

### 5.5 — Et deux de mes propres contrôles étaient faux

- « un quart du dessin passe avant un gribouillis » — le quart y est UN SEGMENT
  DROIT. Personne ne tranche d'un coup d'œil entre un trait et un gribouillage. La
  ligne n'a tenu que tant que les proportions et la densité distribuaient des points
  à tout le monde ; j'ai failli retoucher le barème pour sauver une affirmation
  indéfendable. Elle est retirée, et ce qui compte — **ni l'un ni l'autre ne paie** —
  est vérifié à côté.
- « un carré deux fois plus petit devrait perdre sur les proportions » — il exigeait
  la troisième punition. Le contrôle disait l'inverse de ce qu'il fallait.

La planche elle-même a dû être corrigée deux fois : son ordre attendu sur-affirmait
(vingt « désordres » dont la plupart n'en étaient pas), et son candidat « à moitié
fait » enlevait des traits au hasard partout — un dessin complet en pointillé, pas
une moitié. Un outil de jugement qui ment sur ses propres figures est pire qu'aucun
outil.

---

## 6. Le jeu était introuvable en production — 19/09

> « Impossible de lancer la cueillette dans le menu du host. »

Le jeu était écrit, contrôlé sur trois suites, déployé — et absent du menu de la
seule personne qui s'en sert.

### 6.1 — La cause

La bibliothèque d'un animateur monte de semence en semence : un jeu ajouté au
projet apparaît chez ceux qui étaient déjà installés. Cette montée **fonctionnait
sur le disque**, et un contrôle le vérifiait.

En production, la bibliothèque ne vient pas du disque : **elle vient de la base**.
Et ce chemin-là posait la semence à la valeur COURANTE avant d'appeler la montée :

```js
const etat = { seeded: true, semence: SEMENCE, modules: enBase };
const monte = monterLaSemence(etat);   // commence par : if (depuis >= SEMENCE) return false
```

La montée n'a donc **jamais rien fait** sur ce chemin. Le commentaire juste
au-dessus de l'appel promettait pourtant le contraire, mot pour mot : « la semence
s'applique aussi à ce qui vient de la base […] sinon Cache-cache resterait
invisible ». Une règle annoncée et non tenue — le défaut que `design-tokens.test.js`
avait déjà coûté à ce dépôt.

**Ce n'était pas « Cueillette ».** C'était tout jeu à venir, indéfiniment, en
silence.

### 6.2 — Pourquoi aucun contrôle ne l'a vu

Le contrôle de la montée suit **le chemin du disque**. Celui qui tourne devant le
public est l'autre. Un contrôle qui n'emprunte qu'un des deux chemins ne dit rien
du second.

### 6.3 — La correction : la semence se DÉDUIT du contenu

La table `modules` ne porte pas de numéro de semence, et le disque ne peut pas le
porter à sa place — l'hébergement l'efface à chaque déploiement. La semence est
donc déduite, par une règle qui ne se trompe que dans un sens :

> Si la bibliothèque contient un jeu apporté à la semence *v*, le compte est passé
> par *v* — donc tout ce qui a été apporté avant lui a été proposé, et ce qui en
> manque a été **supprimé exprès**. On n'y retouche pas.

La semence déduite est la plus haute dont un apport est encore présent.

**Ce que cette règle coûte, et il faut le dire** : supprimer le jeu *le plus
récent* le fait revenir au redémarrage suivant — lui seul, et seulement tant
qu'aucun jeu plus récent n'est arrivé. Le défaut inverse est sans commune mesure :
l'un s'efface d'un clic, l'autre annule le travail.

**Elle se répare toute seule** : la montée réenregistre la bibliothèque en base,
qui contient dès lors le jeu neuf ; la déduction suivante rend la semence courante,
et plus rien n'est ajouté.

### 6.4 — Ce qui est désormais gardé

Le raisonnement a été **extrait** de la fonction d'entrées-sorties (`etatDepuisLaBase`)
précisément parce que ce qui était faux n'était ni la lecture ni l'écriture, mais
lui — et qu'il ne se contrôlait pas sans une base sous la main. Quatre contrôles
suivent maintenant le chemin de la base, avec la même exigence que ceux du disque :
aucun type du serveur hors de portée, le jeu le plus récent qui arrive, rien qui
ressuscite, et la montée qui ne se rejoue pas. Vus rouges sur le défaut exact de
production — « *« cueillette » n'apparaît pas alors que la base porte tout ce qui le
précède* ».

---

## 7. Le dessin au téléphone — 19/09

> « Le dessin au téléphone ne fonctionne pas. La zone de dessin disparaît. »

**Deux défauts**, tous deux propres au téléphone, tous deux passés sous une
campagne de 178 contrôles verts.

### 7.1 — L'écran entier tombait

```
TypeError: d.current is not iterable
```

`suivre` écrivait `setTraits((t) => [...t.slice(0, -1), [...enCours.current]])`.
**La fonction passée à `setTraits` n'est pas exécutée tout de suite** : React la met
en file et l'appelle au rendu suivant. Entre les deux, le doigt se lève, `finir`
remet `enCours.current` à `null`, et la fonction en file déréférence ce `null`. Le
rendu jette, **React démonte l'arbre**, et le joueur se retrouve devant une page
noire au milieu de ses trente secondes. Ce n'est pas la zone qui disparaissait :
c'était tout.

**Pourquoi la souris ne le voyait pas.** Un glissé de souris produit des événements
espacés et bien ordonnés ; un doigt qui trace vite en produit des rafales que React
regroupe, et c'est le regroupement qui ouvre la fenêtre. Le contrôle de bout en
bout dessinait à la souris — il ne pouvait pas le voir.

**La règle maintenant** : on capture la valeur AVANT, et la fonction de mise à jour
ne lit plus que ses propres arguments. Elle ne peut plus rien apprendre du monde
entre le moment où on l'écrit et celui où elle s'exécute. Au passage, l'état ne
reçoit plus le tableau VIVANT du trait en cours, qui était muté sous lui.

**Et `pointerleave` ne termine plus le trait** : c'était défaire la capture qu'on
venait de prendre. Un doigt qui sort du cadre continue d'être suivi, son tracé
borné au cadre — ce que le commentaire du fichier promettait déjà.

### 7.2 — Tout ne tenait pas dans l'écran

Mesuré sur **375 × 553** — un téléphone courant, barre d'adresse comprise :

| | Position | |
| --- | --- | --- |
| Toile | 252 → **562** | dépasse le bas (553) |
| Outils | **574** | hors écran |
| « Envoyer mon dessin » | **642** | **89 px sous le pli** |

Et la toile porte `touch-action: none` — indispensable pour tracer au doigt : **le
seul geste qui aurait permis d'atteindre le bouton est celui que le jeu
confisque.**

**La cause** : la taille de la toile était devinée en fraction de la hauteur
d'écran — `56vh` — au lieu d'être déduite de la place réellement libre. Sur un
écran haut le compte tombait juste ; sur un écran court, bandeau, chrono et énoncé
prenaient déjà 228 px. *Un nombre choisi au jugé rend juste sur l'écran où on l'a
choisi.*

**La correction** : la colonne distribue, la toile prend le reste. Aucune fraction
d'écran, aucune constante de bandeau. Et les deux cadres restent identiques **par
construction** — sous la toile, chaque temps porte une rangée de même hauteur puis
une fente de même hauteur —, et non par un nombre recopié.

**L'énoncé y gagne aussi** : « le Dessin cible doit prendre le MAXIMUM de place ».
L'énoncé écrit au-dessus coûtait 55 px et ne disait rien — « Regarde bien… » est
déjà sous l'image, « À toi de dessiner ! » est déjà sur le bouton. Retiré, comme
pour « Le lien » et « Coupe ta bûche ». Sur 375 × 553 la toile passe de **141 à
196 px** ; sur 375 × 700, elle fait **288 px**.

### 7.3 — Ce qui est désormais gardé

Un contrôle de bout en bout **sur un contexte tactile** (`hasTouch`) et une fenêtre
de téléphone court. Il vérifie que la cible, la zone, les outils et le bouton
tiennent tous dans l'écran, que la page ne déborde pas, qu'un tracé au doigt qui
**sort du cadre** ne fait pas tomber la page, et que le trait continue après la
sortie. Vu rouge deux fois, sur chacun des deux défauts : « la page a planté
pendant le tracé : d.current is not iterable », puis « cueillette-cible finit sous
le pli — l'écran fait 553 px ».

---

## 8. Le barème rendu indulgent — 21/09

> « Il faut rendre beaucoup plus indulgent le calcul de la proportion dans le jeu
> Cueillette ? En se basant bien plus sur la forme générale et les proportions. »

Trois points arbitrés avant d'agir : il s'agit bien du **pourcentage de
ressemblance** (et non du critère interne `proportions`) ; l'indulgence porte **à
la fois** sur le score général et sur le cas du dessin juste mais mal placé ou
trop petit ; et le surcoût sur les intrus est **accepté**.

### 8.1 — Ce que la mesure a dit, et qui commandait la correction

Un dessin **juste tracé à 62 %** de la taille et un **gribouillis au hasard** ont
EXACTEMENT le même recouvrement : **0,48 tous les deux**. La position des traits ne
les distingue pas. Ce qui les sépare :

| | recouvrement | forme | proportions | densité |
| --- | --- | --- | --- | --- |
| copie fidèle | 1,00 | 0,98 | 1,00 | 1,00 |
| main humaine | 0,92 | 0,85 | 0,97 | 0,93 |
| **main lourde** | 0,82 | 0,76 | 0,94 | **0,74** |
| **dessin juste, petit** | **0,48** | **0,98** | 0,96 | **0,70** |
| **gribouillis** | **0,48** | **0,46** | **0,70** | **0,80** |

Deux enseignements, tous deux contre-intuitifs :

1. **La forme et les proportions discriminent ; la position, non.** Peser sur la
   position revenait à confondre le joueur appliqué qui dessine petit avec celui
   qui noircit la page. C'est exactement ce que l'auteur avait senti.
2. **La densité est perverse.** Elle punit la main qui tremble — un trait hésitant
   est plus long, donc plus encré à étendue égale — et le dessin tracé petit, dont
   les traits sont relativement plus épais sur 64 cases. Et elle **épargne le
   gribouillis**, mieux noté qu'eux deux. Elle mesure une régularité de geste, pas
   une ressemblance.

### 8.2 — Le réglage

| | avant | après |
| --- | --- | --- |
| `POIDS.recouvrement` / `POIDS.forme` | 0,55 / 0,45 | **0,28 / 0,72** |
| `GARDE_MIN` | 0,55 (unique) | **{ proportions : 0,20 ; densité : 0,85 }** |
| `BRUT_PLANCHER` | 0,24 | **0,28** |

Le plancher **contrebalance** : assouplir la densité relève tout le monde,
gribouillis compris. Les deux planchers de garde remplacent un plancher unique
parce que **les deux gardes ne se valent pas** — celle qui discrimine mord, celle
qui ne discrimine pas s'efface. La densité reste au calcul : l'énoncé la cite, et
elle seule voit le dessin surchargé.

### 8.3 — Le résultat, sur les cinquante dessins

| cas | avant (méd, pire) | après (méd, pire) |
| --- | --- | --- |
| copie fidèle | 99 %, 96 → 1200 pts | 99 %, 93 → 1160 pts |
| main légère | 83 % | **86 %** |
| main humaine | 81 % | 79 % |
| main lourde | 59 %, 50 | 60 %, 48 |
| **juste mais petit** | 49 %, **32 → 0 pt** | **71 %, 56 → 340 pts** |
| **juste mais de travers** | 43 %, **28 → 0 pt** | **54 %, 40 → 100 pts** |
| gribouillis, part payante | 4,28 % | **2,78 %** |
| pire des 2450 intrus | 900 pts | 880 pts |

**Un dessin complet et juste ne tombe plus à zéro** parce qu'il a été tracé petit
ou posé de côté. Et le tricheur paie MOINS qu'avant, alors que l'indulgence a
augmenté : le réglage ne relâche pas, il redirige.

Prix assumé, consigné dans le code : la plus mauvaise copie fidèle passe de 1200 à
1160 points.

### 8.4 — Une garantie que j'avais écrite et qui était fausse

Le commit du 18/09 affirmait : « le gribouillis le mieux noté vaut 37 %, soit ZÉRO
point ». C'était vrai **d'un seul gribouillis** — une graine, une densité. Balayé
sur quarante graines et trois densités, soit **six mille tirages**, le pire en
valait **56 %, quatre cent vingt points**, et **4,28 %** d'entre eux rapportaient
quelque chose.

Un échantillon de un ne mesure pas une population, et il m'avait permis d'écrire
une garantie que le produit ne tenait pas. Le contrôle porte désormais sur une
**borne de population** — la part payante et le pire cas — et non sur un absolu
impossible à tenir : à 64 cases floutées, un gribouillage dense finira toujours par
tomber juste sur un saule pleureur, qui est lui-même une masse de traits fins.

Le balayage complet vit dans l'outil (dix secondes) ; la suite en garde un
échantillon de mille deux cents mesures (deux secondes). Une suite qu'on hésite à
lancer ne protège plus rien.

### 8.5 — Deux autres corrections d'honnêteté

- Le contrôle « la copie fidèle paie LE MAXIMUM » exigeait le maximum EXACT. La
  copie fidèle n'est pas un joueur : c'est le copiste qui retrace la grille, et sa
  note dépend au point près d'un artefact de normalisation. La barre est posée là
  où elle détecte ce qu'elle prétend détecter — la tranche haute du barème. Le
  défaut d'origine, à 56 %, en reste à des lieues.
- La planche citait « un coquelicot dessiné pour une rose » en dur, alors que la
  mesure désigne désormais « Marguerite pour Tournesol ». L'exemple est dérivé de
  la mesure : un texte figé à côté d'un chiffre vivant finit par mentir.

---

## 9. Deux fois plus généreux — 23/09

> « Le jeu est encore trop compliqué. Il faudrait vraiment que l'analyse de
> reconnaissance soit franchement deux fois plus généreuse. »

### 9.1 — Je cherchais au mauvais endroit

Les deux réglages précédents travaillaient les **poids**. C'était l'erreur : les
poids décident QUI est devant qui, pas **à quelle hauteur** tout le monde se
situe. La hauteur, c'est la courbe de présentation — restée une droite depuis le
premier jour.

### 9.2 — La mesure qui a tout décidé

La séparation entre honnêtes et tricheurs existe **en score brut**, et elle est
nette :

| | p05 | médiane | p95 |
| --- | --- | --- | --- |
| gribouillis | 0,194 | 0,337 | **0,526** |
| juste, de travers (le pire honnête) | **0,584** | 0,666 | 0,711 |
| main lourde | 0,656 | 0,710 | 0,761 |
| copie fidèle | 0,963 | 0,991 | 0,999 |

Le pire dessin honnête part à **0,58** quand 95 % des gribouillages plafonnent à
**0,53**. En pourcentage affiché, la droite écrasait cette séparation et les deux
se retrouvaient côte à côte. **Le travail n'était pas de mieux mesurer : c'était
d'arrêter de gâcher une mesure déjà bonne.**

### 9.3 — Le réglage, et pourquoi cette forme de courbe

`BRUT_PLANCHER` 0,28 → **0,46** (juste au-dessus du plafond des gribouillages) et
une courbe concave `COURBE = 2,7`.

**Une puissance `t^γ` a été essayée et écartée sur mesure.** Sa pente est INFINIE
en zéro : dès qu'un dessin dépasse le plancher d'un cheveu il saute à 40 %, et
**cinq des vingt tranches du graphique deviennent mathématiquement inatteignables**
— alors que l'énoncé dit qu'une tranche vide signifie « personne ici ». Elle se
serait mise à signifier « impossible ». `1 − (1 − t)^k` a la même concavité avec
une pente finie : les vingt tranches restent atteignables, ce qu'un contrôle
vérifie.

### 9.4 — Le résultat

| cas (médiane sur 50) | avant | après | points |
| --- | --- | --- | --- |
| copie fidèle | 99 % · 1200 | 100 % · 1200 | ×1,0 |
| main légère | 86 % · 1020 | 100 % · 1200 | ×1,2 |
| main humaine | 79 % · 880 | 100 % · 1200 | ×1,4 |
| **main lourde** | 60 % · 500 | **82 % · 940** | **×1,9** |
| **juste mais petit** | 71 % · 720 | **91 % · 1140** | ×1,6 |
| **juste, de travers** | 54 % · 380 | **72 % · 760** | **×2,0** |
| **dessin pointillé** | 59 % · 480 | **80 % · 900** | **×1,9** |

Deux fois plus généreux là où le joueur souffrait, et le maximum atteint plus tôt
là où il ne pouvait plus doubler.

### 9.5 — Ce que ça coûte, dit sans détour

1. **Le gribouillis chanceux paie davantage** : la part qui rapporte passe de
   2,45 % à 3,68 %, et le mieux noté de 340 à 700 points. Le plancher retient la
   masse ; il ne peut rien contre le tirage heureux, qui tombe dans la même bande
   que le dessin honnête le plus faible.
2. **L'intrus atteint le maximum.** Une marguerite dessinée pour un tournesol
   valait 900 points ; elle en vaut **1200**. La limite était connue et acceptée le
   21/09 — l'indulgence la pousse à son terme.
3. **Le haut du classement se tasse.** Copie fidèle, main tremblante et main
   hésitante obtiennent toutes 1200 : le jeu ne sépare plus les excellents dessins.
   La cause n'est pas la courbe mais le **plafond du barème** — « 95 % et plus →
   1200 », règle de l'énoncé — désormais atteint par un bon dessin ordinaire.
   Deux molettes si l'on veut y revenir : relever `PLAFOND_POURCENT`, ou baisser
   `COURBE`.

### 9.6 — Deux contrôles qui ne gardaient pas ce qu'ils annonçaient

- **L'indulgence n'était gardée par rien.** Après le réglage, j'ai remis l'ancienne
  droite pour éprouver la suite : **elle est restée entièrement verte**. Le travail
  pouvait être défait par mégarde sans qu'une ligne rougisse. Un contrôle fixe
  désormais un plancher de points pour les trois manières ordinaires de rater un
  dessin sans démériter, et vérifie que la hiérarchie tient malgré la générosité.
- **L'intitulé du contrôle du gribouillis mentait.** Il annonçait « six mille
  tirages », son commentaire « mille deux cents » ; la boucle en fait **huit
  cents** depuis qu'elle a été réduite pour le temps d'exécution. Les deux chiffres
  étaient restés. Même défaut que l'exemple figé de la planche, corrigé le 21/09 :
  un nombre écrit à côté d'une boucle finit par mentir.

---

## 10. Le pourcentage, pas les points — 24/09

> « Je n'arrive pas à aller au-dessus de 62 %, je trouve le barème trop dur. »
> « On s'en fout des points, c'est le pourcentage de ressemblance qu'on aimerait
> rendre plus facile à atteindre. Mets le poids de la forme à 0,8. »

### 10.1 — L'aveu : mon joueur modèle dessinait mieux qu'un humain

62 % affichés correspondaient à un score **brut de 0,62**. Or le pire cas honnête
de l'étalonnage — un dessin complet, correct, posé 12 % de travers — a un brut
médian de **0,666**. **Il est meilleur que la meilleure tentative de l'auteur.**

Le copiste des contrôles retrace la grille de la cible **elle-même**, avec du
tremblement : il ne dessine jamais *une autre fleur reconnaissable*, il dessine *la
même fleur, secouée*. Sa topologie est parfaite par construction. Un humain qui
redessine de mémoire en trente secondes produit une forme franchement différente —
c'est exactement l'écart que le modèle ne sait pas fabriquer.

**J'ai annoncé trois fois « c'est plus généreux » pendant que l'auteur plafonnait
à 62 %**, parce que mes « médiane à 100 % » décrivaient un copiste.

### 10.2 — Deux changements, mesurés séparément

| | brut 0,62 | de travers | trop petit |
| --- | --- | --- | --- |
| état du 23/09 | **61 %** | 73 % | 92 % |
| poids forme 0,80 seul | 61 % | **78 %** | **95 %** |
| poids 0,80 **+ courbe** | **72 %** | **82 %** | 92 % |

C'est **la courbe** qui déplace le plafond de l'auteur ; **le poids** qui aide les
dessins mal placés. Les deux sont retenus.

### 10.3 — Pourquoi un logarithme, et pas une puissance

En cherchant « deux fois plus généreux » on arrivait à `1 − (1 − t)^4`. Un contrôle
a rougi : **« le dessin exact 100 % ne bat pas un dessin tremblé 100 % »**. Sur la
bande réelle, **quatre niveaux de brut sur neuf s'écrasaient sur le même 1200** :
le jeu ne savait plus désigner un gagnant. Une manche où les trois premiers sont à
égalité n'a aucun intérêt à l'antenne.

`log(1 + c·t) / log(1 + c)` monte aussi vite en bas et **garde de la pente en
haut** : **neuf niveaux distincts sur neuf**.

Réglage : `BRUT_PLANCHER` 0,46 → **0,54**, `COURBE` **500** (coefficient de
logarithme — plus l'exposant d'avant). Le plancher relevé compense ce que la courbe
donne : la part des gribouillages qui rapportent passe de 3,25 % à **3,35 %**.

### 10.4 — Ce que le jeu rend aujourd'hui (médiane sur 50, puis la pire)

| | note |
| --- | --- |
| copie fidèle | 100 % (pire 98) |
| main légère | 96 % (pire 94) |
| main humaine | 93 % (pire 90) |
| main lourde | 84 % (pire 72) |
| juste mais petit | 92 % (pire 85) |
| juste mais de travers | 82 % (pire 68) |

### 10.5 — Deux contrôles qui accusaient à tort, et un qui manquait

- **« 17 tranches sur 20 »** — faux. Les vingt étaient atteignables ; les trois
  premières le sont sur une bande de brut large d'un centième, que le pas
  d'échantillonnage enjambait. *Un contrôle dont la conclusion dépend de son pas ne
  mesure pas le code, il se mesure lui-même.* Pas affiné cent fois.
- **L'indulgence n'était toujours pas gardée.** Après le réglage du 23/09, remettre
  l'ancienne courbe laissait toute la suite verte — une seconde fois. Le contrôle
  ajouté alors s'appuyait sur le copiste, généreux dans les deux cas.
- **Le contrôle qui manquait** ne passe plus par le copiste : il éprouve la courbe
  **là où le joueur se trouve réellement**, en brut, et fixe ce que la manche doit
  afficher — 0,62 de brut ≥ 70 %. Vu rouge sur le retour en arrière.

### 10.6 — Ce qui manque encore

**De vrais dessins.** Une seule manche jouée suffirait : l'animateur reçoit déjà
tous les tracés avec leur note. Tant qu'on n'a qu'**un** point de mesure humain, ce
réglage est une interpolation autour de lui, pas une distribution.
