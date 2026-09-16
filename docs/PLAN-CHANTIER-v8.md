# Chantier v8 — les catégories de vote, et cinq corrections

Source : `260915 Modif.docx` (séance du 15/09/2026), deux captures à l'appui.

---

## 1. Ce qui est demandé — dépouillement exhaustif

Numérotation continuée depuis le chantier v7.

| № | Demande | Verbatim |
| --- | --- | --- |
| M26 | « Coupe ta bûche » : une réponse à ± 1 pt de la cible marque bien ses points, mais le graphique la range dans la plage ± 3 pt | « les points sont bien comptabilisés mais le graphique est erroné […] le joueur a fait 9 % pour une Proportion cible de 10 % et il se trouve dans la plage "7 % à 9 %". Cette fameuse plage doit plutôt être "7 % à 8 %" » |
| M27 | Estimation en mode « Année » : nouveaux paliers | exact → **± 1 an** : 1000 ; ± 2 → **± 3 ans** : 750 ; ± 5 → **± 6 ans** : 500 ; ± 10 inchangé : 250 |
| M28 | Les choix sont lettrés jusqu'à six, puis chiffrés. Il en faut **uniquement des lettres** | « les choix 7, 8 et 9 devraient être G, H et I » |
| M29 | « Cache-cache », stream, grille finale : l'énoncé de la question 5 reste affiché | remplacer par « Le cache-cache est terminé ! Voici la grille » |
| M30 | Après une partie de « Cache-cache », « Nouvelle partie » ne propose plus que le mode « Couleur » | et « intervertir leurs positions » : Classique en premier, Couleur en second |
| M31 | Les questions de « Vote » appartiennent à une **catégorie** — « Vie » ou « Dilemme » — et la file « à venir » gagne un onglet par catégorie | « La "Question suivante" doit être la question 1 de l'onglet sur lequel est l'animateur. Cela ne change rien aux règles du jeu » |

### Ce qui a été écarté, et pourquoi

Rien. Les six demandes sont traitées.

---

## 2. Ce que le document ne dit pas, et qui a été tranché

1. **M26 n'est pas un défaut de la bûche, c'est un défaut de l'histogramme** — donc
   il touche aussi l'estimation et « Le juste temps ». Diagnostic mesuré : une
   valeur posée EXACTEMENT sur une borne est rangée correctement à DROITE de la
   cible et mal à GAUCHE. Le commentaire du code promettait déjà « le palier le
   plus généreux » ; la recherche partait du bord au lieu de partir de la cible.
   Ce n'est donc pas une règle à inventer, c'est une règle écrite et non tenue.
2. **La plage « 7 % à 8 % » est la CONSÉQUENCE, pas la cause.** Une fois la valeur
   de borne rangée du bon côté, la bande ± 3 pt à gauche d'une cible à 10 %
   contient 7 et 8 — ce que l'auteur décrit. On corrige le rangement, pas
   l'étiquette.
3. **M27 change un barème que d'autres écrans lisent** : l'étiquette « exact »
   disparaît, remplacée par « ± 1 an ». Le singulier est traité (« ± 1 an » et non
   « ± 1 ans »).
4. **M28 — jusqu'où vont les lettres ?** Le document en demande neuf (jusqu'à I).
   On va jusqu'à Z : vingt-six choix est au-delà de ce qu'un écran de stream peut
   montrer, et la règle « uniquement des lettres » cesse ainsi d'avoir un bord.
5. **M30 — l'ordre change, la sélection par défaut NON.** L'auteur écrit « il faut
   juste intervertir leurs positions » : on intervertit l'affichage. « Couleur »
   reste pré-sélectionné, faute de demande contraire. Signalé.
6. **M31 — la catégorie est un champ de la QUESTION**, pas un module séparé. Deux
   modules « Vote » dédoubleraient la banque et les règles ; l'auteur écrit
   d'ailleurs « cela ne change rien aux règles du jeu ».
7. **M31 — « Question suivante » DÉSIGNE désormais sa question.** Jusqu'ici
   l'animateur demandait « la suivante » et le serveur choisissait. Avec des
   onglets, c'est l'onglet ouvert qui décide : le top de départ porte donc un
   identifiant de question. Le serveur reste maître du CONTENU — il ne reçoit
   qu'un identifiant qu'il doit déjà connaître dans la file.
8. **Les questions existantes n'ont pas de catégorie.** Elles sont rangées en
   « Vie » par défaut : c'est la catégorie générique, et aucune question déjà
   écrite ne devient injouable.

---

## 3. Chemin critique

```
M26  M27        — barèmes et géométrie, indépendants, purement serveur
M28  M29  M30   — trois écrans, indépendants
M31             — serveur + Studio + animateur : le seul lot à trois étages
```

**Pourquoi cet ordre.** M26 et M27 touchent le CALCUL, qui se vérifie sans
navigateur et dont dépendent quatre jeux : ils passent d'abord, et la suite
complète tourne derrière eux. M28, M29 et M30 sont trois corrections d'écran sans
rapport entre elles. M31 est le seul lot qui traverse les trois étages — banque,
serveur, animateur — et c'est le seul qui puisse casser une partie en cours.

**Le risque principal est M31.** « Question suivante » est le bouton le plus
utilisé de l'écran animateur, sur TOUS les jeux. Lui faire désigner une question
pour le vote sans changer son comportement ailleurs est le point exact où une
régression passerait inaperçue jusqu'à l'antenne.

---

## 4. Journal d'exécution

### M26 — le graphique et le barème s'accordent enfin
La règle était ÉCRITE et non tenue : le commentaire du code promettait « le palier
le plus généreux — c'est ce que le barème lui verse », et la recherche de bande
partait du BORD au lieu de partir de la cible. À droite elle tombait juste, à
gauche elle donnait systématiquement la bande la plus sévère. Le défaut touchait
donc l'estimation et « Le juste temps » autant que la bûche.

Le contrôle ne vérifie pas des bornes recopiées à la main : il compare, valeur par
valeur et sur les quatre natures, la bande du graphique au palier que le barème
paie réellement. Il a nommé d'un coup toutes les bornes fautives.

### M27 — les paliers de l'année
Un, trois, six, dix ans. Le premier palier n'est plus la réponse EXACTE : c'est le
vrai changement, et il se lit ailleurs que dans la table — l'étiquette « exact »
disparaît des deux histogrammes, et le SINGULIER apparaît (« ± 1 an »).

### M28 — uniquement des lettres
**La cause n'était pas le repli, c'était la recopie.** La table `['A' … 'F']` était
écrite TROIS FOIS, une par surface, chacune avec son propre `|| i + 1`. Corriger
une table en aurait laissé deux. Elle est désormais dans `shared/lettres.js`, et un
contrôle lit la source des trois surfaces pour qu'elle n'y revienne pas.

Un défaut trouvé dans ma propre correction : `Number(null)` vaut ZÉRO, donc une
absence rendait « A » — la première réponse, à la place de rien.

### M29 — la grille finale clôt le jeu
Le masquage du chantier v6 ne valait que pendant le dévoilement des réponses. La
manche RÉVÉLÉE est un troisième état, et l'énoncé y revenait intact.

### M30 — la relance retrouve ses deux modes
**La cause n'était pas dans les modes.** L'objet « jeu en cours » était refabriqué
à partir de la MANCHE, avec trois champs choisis à la main ; tout le reste de ce
que le serveur dit du jeu disparaissait au passage. Le panneau retombait alors sur
sa liste de secours, qui ne connaissait qu'un mode — et affichait un choix
plausible et faux.

Cette liste de secours a été SUPPRIMÉE. C'est elle qui a rendu le défaut
invisible : sans elle, l'absence se voit.

### M31 — les catégories du vote

| Étage | Ce qui change |
| --- | --- |
| serveur | `CATEGORIES_VOTE`, la file porte la catégorie de chaque ligne, le top de départ accepte un `questionId` |
| Studio | un sélecteur de catégorie sur les questions de vote |
| animateur | des onglets sur la file, et « Question suivante » qui pioche dans l'onglet ouvert |

**L'animateur DÉSIGNE, il n'écrit pas.** Le top de départ ne porte qu'un
identifiant : le serveur reste seul maître des énoncés et des bonnes réponses. Un
identifiant qu'il ne connaît pas est ignoré et le tirage reprend son cours — ni
porte d'entrée, ni refus de départ en direct. Vérifié par sabotage.

**Un onglet est une VUE, pas une file.** Déplacer une question dans « Dilemme » ne
doit pas faire glisser les questions « Vie » qui l'entourent : la liste réordonnée
se réinjecte dans ses propres places. Sans cela, rien n'aurait planté — une autre
question aurait changé de rang, ailleurs.

**Les questions écrites avant cette séance** n'ont pas de catégorie : elles vont en
« Vie ». Aucune ne devient injouable, aucune ne disparaît d'un onglet.

---

## 5. Audit de clôture

| № | État | Où cela se vérifie |
| --- | --- | --- |
| M26 | fait | `echelle-estimation.test.js` — graphique contre barème, quatre natures |
| M27 | fait | `bareme-v4.test.js` — chaque borne, des deux côtés |
| M28 | fait | `lettres.test.js` — la règle, ET la non-recopie dans les trois surfaces |
| M29 | fait | `cache-cache.spec.js` — la grille finale |
| M30 | fait | `cache-cache.spec.js` — la RELANCE, chemin distinct du lancement |
| M31 | fait | `vote-categories.spec.js` (3 contrôles) + suite d'intégration |

**Ce qui reste ouvert.** Rien de cette séance. Les deux points hérités du chantier
v6 demeurent : l'exemple à −3 de « Retour de flamme » contredit sa propre règle, et
la comparaison des réponses écrites est un peu plus indulgente que la lettre de
l'énoncé.
