# Chantier v7 — le mode « Classique », et quatre corrections

Source : `260912 Modif.docx` (séance du 12/09/2026), plus l'archive
`icones_noir_40.zip` — quarante icônes noires, les quarante mêmes noms que la
banque existante.

---

## 1. Ce qui est demandé — dépouillement exhaustif

Numérotation continuée depuis le chantier v6 : elle sert à l'audit de clôture.

| № | Demande | Verbatim |
| --- | --- | --- |
| M21 | Vote : à plus de cinq choix, tous les choix doivent être visibles au stream | « lorsqu'il y a plus de 5 choix, on ne voit pas les autres propositions sur l'écran de stream […] comme dans le dévoilement des réponses (réduire la police) » |
| M22 | Studio : accéder à la base d'images de « Cache-cache » | « Je n'ai accès à aucune image, il faut remédier à ça » |
| M23 | « Le juste temps » : la ligne « ± 0,5 s 500 pts » est raccourcie à droite | « n'est pas bien calibré, elle est raccourcie sur la droite (légende mal placée peut-être) » |
| M24 | « Cache-cache », écran joueur au dévoilement : montrer aussi la réponse DONNÉE quand elle est fausse | « il faut juste rajouter la réponse qu'a donnée le joueur lorsqu'il n'a pas la bonne réponse » |
| M25 | Nouveau mode **« Classique »**, l'actuel devenant le mode **« Couleur »** (difficile) | voir §1.1 |

### 1.1 — Le mode « Classique » (M25), règle par règle

| № | Règle | Verbatim |
| --- | --- | --- |
| M25a | Le mode actuel s'appelle désormais « Couleur », et c'est le mode DIFFICILE | « Nous avons actuellement le jeu qui est super avec des couleurs. Appelons ce mode : le mode "Couleur", ce sera le mode difficile du jeu » |
| M25b | En « Classique », la matrice n'emploie que des images **noires**, chacune d'un nom différent | « des images uniquement de couleur "noir" devront être utilisées et chacune des images doit avoir un nom différent » |
| M25c | Aucune question liée aux couleurs. Quatre formes seulement : « derrière quel numéro », « quel objet derrière n », « entre deux noms », « entre deux numéros » | liste explicite dans le document |
| M25d | Les images noires ne servent **JAMAIS** au mode « Couleur » | « ATTENTION : Les nouvelles images de couleur "noir" ne doivent PAS être utilisées dans le mode "Couleur" » |

### Ce qui a été écarté, et pourquoi

Rien. Les cinq demandes sont traitées. **M22 était déjà corrigé** avant la
réception du document — le défaut des en-têtes d'animateur (M20, commit
`52da6a6`) : le Studio appelait `/api/cache/catalogue` sans en-tête, la route
répondait 403 en production, et l'écran affichait « 0 image ». La demande est
donc vérifiée, pas réimplémentée.

---

## 2. Ce que le document ne dit pas, et qui a été tranché

1. **« Noir » devient une couleur RÉSERVÉE de la banque**, et non une sixième
   couleur ordinaire. C'est la seule lecture qui satisfasse M25d : une banque
   unique, une seule page de modération, et le MODE décide de la tranche
   employée. Couleur prend tout sauf le noir ; Classique ne prend que le noir.
   La règle « de 5 à 9 couleurs » (M18) ne compte donc plus le noir, sans quoi
   ajouter ces quarante images ferait six couleurs et rendrait impossible la
   question « quelle couleur n'est présente qu'une seule fois ? ».
2. **Le mode se choisit AU LANCEMENT, par l'animateur**, comme l'allure de
   « Coupe ta bûche » — et non par un module distinct au Studio. Même jeu, même
   banque, même modération : c'est une difficulté qu'on décide à l'antenne.
3. **En « Classique », la contrainte de couleur de la matrice tombe** — il n'y a
   qu'une couleur. Seule subsiste celle des neuf noms distincts, que M25b répète.
4. **Les quotas des quatre formes restantes suffisent déjà** à faire cinq
   questions : minimums 1+1+0+0 = 2, maximums 3+3+2+2 = 10. Rien à changer.
5. **Le traitement des quarante icônes est celui des deux cents autres** :
   détourage PAR LES BORDS, 512 px, WebP qualité 82 méthode 6. Vérifié sur
   planche contact — aucune icône trouée : le siège de la chaise, l'écran de la
   télévision, les fentes de la clé à molette et la roue de la poubelle ont gardé
   leur blanc enclos.

---

## 3. Chemin critique

```
Lot 0 — les 40 icônes noires ────────────┐
                                          ▼
M21 (vote au stream)   — indépendant   M25 (mode Classique)
M23 (règle du juste temps) — indépendant
M24 (réponse donnée)   — indépendant
M22 (déjà fait) — À VÉRIFIER EN LIGNE d'abord
```

**Pourquoi cet ordre.**

- **M22 en premier, et c'est une vérification, pas un travail.** L'auteur signale
  un symptôme déjà corrigé ; tant qu'on ne l'a pas constaté résolu en ligne, on ne
  sait pas si le correctif a suffi — et tout le reste de la modération en dépend.
- **Lot 0 avant M25** : le mode Classique ne peut rien tirer sans ses images.
- **M21, M23, M24 sont indépendants** entre eux et du reste. Ce sont trois
  défauts d'affichage sur trois surfaces différentes.

**Le risque principal est M25d.** « Les images noires ne doivent PAS être
utilisées dans le mode Couleur » est une règle NÉGATIVE : elle ne se voit pas
quand elle est respectée, et une manche en mode Couleur qui tirerait une icône
noire passerait pour un simple hasard malheureux. Elle a donc son propre contrôle,
sur des milliers de tirages, dans les deux sens.

---

## 4. Journal d'exécution

### Lot 0 — les quarante icônes noires
Converties au traitement du dépôt : 249 ko pour quarante fichiers, 6,4 ko pièce.
Le fond retiré va de 36 % (ballon) à 83 % (avion) de la surface — cohérent avec
des silhouettes de tailles différentes.

### M21 — les choix au stream
Quatre défauts empilés, dont le plus discret : la pastille de droite gardait sa
taille fixe et mordait sur ses voisines sans jamais sortir de l'écran. La hauteur
disponible est désormais MESURÉE sur la boîte qui contient exactement les rangées,
et non plus déduite d'une constante. Détail en commit `8815b3a`.

### M22 — l'accès à la base d'images
**Vérifié résolu, pas réimplémenté.** Le symptôme venait du défaut des en-têtes
d'animateur (M20) : `/api/cache/catalogue` répondait 403 en production et l'écran
affichait « 0 image ». Le bundle déployé a été relu — les deux routes portent
l'en-tête, et le catalogue sert bien ses objets.

### M23 — la règle des paliers
L'étiquette et le trait se disputaient la même bande. Chacune a désormais la
sienne. Ce qu'il a fallu comprendre pour seulement VOIR le défaut : l'échelle
s'ouvre pour contenir les réponses, et deux joueurs qui répondent n'importe quoi
l'étirent au point que le défaut ne peut plus se produire.

### M24 — la réponse donnée
Un piège en chemin : une réponse de choix voyage comme un INDICE. Le serveur la
traduit, parce que lui seul sait dans quelle liste la lire — et d'autant plus
depuis que la banque est modérable.

### M25 — le mode « Classique »

| Ce qui change | Ce qui ne change pas |
| --- | --- |
| la tranche de banque employée | la grille, le déroulé, le barème |
| les formes de questions admises | la modération, unique pour les deux modes |

**Le mode se choisit au lancement**, dans le panneau de départ, comme l'allure du
curseur de « Coupe ta bûche ». Les modes viennent du SERVEUR : un écran qui les
recopierait finirait par proposer un mode que le tirage ne connaît pas.

**Deux défauts trouvés par les contrôles, tous deux muets :**

1. **`srcDObjet` ne connaissait que la banque en couleur.** Les quarante icônes
   noires n'avaient donc pas d'adresse : les neuf cases du mode Classique se
   seraient affichées VIDES sur les trois surfaces à la fois, sans erreur, sans
   trace. Un index qui ignore la moitié de ce qu'on lui confie ne se signale
   jamais lui-même.
2. **Le premier contrôle de la règle négative ne pouvait pas échouer.** Il tirait
   sur la banque PAR DÉFAUT, qui ne contient aucune icône noire : « Couleur ne
   voit jamais de noir » y était vrai gratuitement. Découvert en sabotant la règle
   — le contrôle est resté vert. Réécrit sur la banque COMPLÈTE, celle que
   l'animateur modère réellement.

---

## 5. Audit de clôture

| № | État | Où cela se vérifie |
| --- | --- | --- |
| M21 | fait | `tests/e2e/choix-visibles.spec.js` — quiz, vote, dévoilement |
| M22 | vérifié | bundle déployé relu ; les deux routes portent l'en-tête |
| M23 | fait | `tests/e2e/regle-paliers.spec.js` — emboîtement, symétrie, recouvrement |
| M24 | fait | `tests/e2e/cache-cache.spec.js` — comparé au libellé réellement cliqué |
| M25a | fait | `MODES.couleur.difficile`, nommé « Couleur » dans le panneau |
| M25b | fait | 400 manches : que du noir, neuf noms distincts |
| M25c | fait | liste blanche de quatre formes, 400 manches |
| M25d | fait | 400 manches sur la banque COMPLÈTE : zéro case noire en mode Couleur |

**Ce qui reste ouvert.** Rien de cette séance. Les deux points hérités du chantier
v6 demeurent : l'exemple à −3 de « Retour de flamme » contredit sa propre règle, et
la comparaison des réponses écrites est un peu plus indulgente que la lettre de
l'énoncé.
