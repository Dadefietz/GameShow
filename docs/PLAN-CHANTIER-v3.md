---
artifact_type: plan_chantier
app: root
version: 3
change_set: forward
produced_by: plan-daction-reunion
created_at: 2026-08-20
created_by: R.M.A + Claude
status: validated
source_meetings: 1
actions_total: 1
actions_retained: 1
decisions_total: 7
effort_estimate_days: 0.5
---

# PLAN DE CHANTIER v3 — Project Game Show

> Référence d'implémentation issue du compte rendu de test du 2026-08-20 (CR#4).
> **Chaque décision listée ici a été explicitement entérinée.** Rien ne doit être
> ré-arbitré pendant l'implémentation : en cas de doute, ce document fait foi.
>
> Il fait suite à [PLAN-CHANTIER-v2.md](PLAN-CHANTIER-v2.md). Les décisions des
> chantiers v1 et v2 restent en vigueur ; ce chantier n'en périme aucune — il en
> **restaure** une, aujourd'hui annulée en pratique sans que personne ne l'ait su.

## Comment lire ce document

Une seule action, sept décisions numérotées — ce sont elles qui engagent. La
table de traçabilité relie chaque élément du compte rendu à sa décision ; la
table d'avancement se tient à jour pendant l'implémentation.

**Aucune décision transversale.** Un chantier d'une action n'en produit pas, et
en inventer une pour faire nombre affaiblirait celles qui existent.

---

# 1. Chemin critique

**Il n'y en a pas, et c'est un fait, pas un oubli.** Une seule action : rien ne
précède rien. La signaler vaut mieux que de fabriquer un ordonnancement pour la
forme.

**Charge : environ une demi-journée.**

**Jalon unique** — sur un écran de résultat gagnant, la phrase relevée à cinq
instants de l'animation du score est la même cinq fois.

---

# 2. Action 1 — Une phrase choisie, pas la liste entière · **RETENUE**

**Problématique initiale.** « Lorsqu'un joueur gagne, ou répond bien. Tous les
messages contextuels apparaissent à la suite en une seconde. Ce n'est pas un
message parmi la liste qui est sélectionné. »

## Diagnostic

**`dire()` fait son travail.** Elle tire bien **une** phrase au hasard parmi
celles non encore servies (`voix.js:517`). Le registre n'est pas en cause.

Le défaut est à l'appel, `PlayApp.jsx:612` :

```js
const phraseVoix = momentVoix ? dire(momentVoix, { … }) : null;
```

Cette ligne est **dans le corps du rendu** — ni dans un état, ni dans un effet,
ni dans un mémo. Elle s'exécute donc à **chaque re-rendu**, et chaque re-rendu
tire une phrase différente.

**Ce qui provoque les re-rendus, et d'où vient « une seconde ».** L'écran de
résultat anime le score qui monte : `useCountUp` (`PlayApp.jsx:23`) lance une
boucle d'animation qui appelle `setVal` à **chaque image pendant 900 ms**. À
soixante images par seconde, cela fait une cinquantaine de re-rendus, donc une
cinquantaine de phrases, en un peu moins d'une seconde. **Le « une seconde » du
compte rendu est la durée exacte de cette animation.**

**Pourquoi ces deux situations-là précisément, et aucune autre.** L'animation ne
démarre que si le gain n'est pas nul : `if (goal === 0) return`. Une mauvaise
réponse ne rapporte ni ne coûte rien depuis la décision T1 du chantier v1 — donc
pas d'animation, donc presque pas de re-rendus, donc le défaut ne se voit pas. Il
n'apparaît **que quand on gagne des points**. C'est exactement ce qui a été
décrit en réunion, et c'est ce qui confirme le diagnostic.

**Une seconde conséquence, invisible celle-là.** `dire()` **mémorise** la phrase
servie pour ne pas la répéter. Cinquante appels épuisent le vivier d'un moment —
quatre à huit phrases — puis le remettent à zéro, une dizaine de fois par écran
de résultat. **La décision 7 de l'action 7 du chantier v1, « pas de répétition
dans une même partie », est donc déjà annulée en pratique**, et rien ne pouvait
le montrer.

**Le reste du projet est sain**, vérifié site par site : le stream appelle la
voix depuis un effet (`OverlayApp.jsx:505`), l'écran d'attente depuis
`usePhraseQuiTourne`, qui garde sa phrase en état. **Un seul site d'appel est
fautif.**

## Proposition

**Figer la phrase sur la manche, pas sur le rendu.** La phrase se calcule une
fois quand la manche change et ne bouge plus — le mécanisme déjà en place pour
l'écran d'attente, état plus effet, sans la rotation : la décision 4 de l'action
7 impose **une seule phrase fixe sur les écrans courts**.

Pourquoi pas un simple mémo de rendu ? Parce que `dire()` a un **effet de bord** :
elle inscrit la phrase au registre des déjà-dites. Un effet de bord pendant le
rendu se paie double en mode strict, qui rejoue les rendus — deux phrases
consommées au lieu d'une.

## Décisions entérinées

1. **La phrase de résultat est calculée une fois par manche**, hors du corps de
   rendu, et ne change plus jusqu'à la manche suivante. **Le repère est
   l'identifiant de manche** (`roundId`). Motif du repère : le figer sur le
   moment (`juste.simple`, `juste.serie`…) ferait dire la même chose à deux
   manches consécutives de même résultat.
2. **Garde-fou mécanique** : un contrôle **bloquant** refuse tout appel à
   `dire()` hors d'un état, d'un effet ou d'un mémo, et nomme le fichier fautif.
   *Forme retenue : un contrôle **statique** sur les sources. Détecter la phase de
   rendu à l'exécution obligerait à lire les entrailles de React, qui changent de
   version en version. Le contrôle statique attrape la faute à sa source plutôt
   que d'en masquer l'effet.*
3. **Le vivier de non-répétition n'est pas remis à zéro entre deux parties** : il
   vit sur la session du navigateur. `reinitialiserVoix()` existe mais reste
   réservée aux tests. *Arbitrage de l'auteur, assumé : « à un moment ou à un
   autre le texte se répétera ».*
4. **Les quatre surfaces sont balayées** à la recherche du même motif — un appel
   à la voix hors état et hors effet. Constat consigné au 2026-08-20 : **un seul
   site fautif**, `PlayApp.jsx:612`.
5. **Contrôle temporel** : sur un écran de résultat gagnant, la phrase est
   **échantillonnée plusieurs fois pendant l'animation du score** et doit être
   identique à chaque relevé. Un contrôle qui ne regarderait qu'une image ne
   verrait rien — le défaut n'existe que dans le temps.
6. **Contrôle d'appel** : **un seul appel** à `dire()` par manche. Il protège
   aussi le vivier de non-répétition, brûlé aujourd'hui une dizaine de fois par
   écran.
7. **La phrase reste fixe** sur l'écran de résultat, sans rotation — décision 4
   de l'action 7 du chantier v1, rappelée ici pour qu'elle ne soit pas rouverte
   par inadvertance.

## Étapes

1. Sortir l'appel du corps de rendu : la phrase vit en état, recalculée quand la
   manche change. *≈ 1 h.*
2. Poser le garde-fou statique et le rendre bloquant. *≈ 1 h.*
3. Balayer les quatre surfaces et consigner le constat. *≈ 30 min.*
4. Contrôle temporel : échantillonnage pendant l'animation. *≈ 1 h.*
5. Contrôle d'appel : un seul appel par manche. *≈ 30 min.*

## Impacts

Aucun sur les scores, le réseau ou le moteur — c'est un défaut d'affichage. Le
joueur verra enfin une phrase lisible au lieu d'un défilement.

Effet collatéral **positif** : la non-répétition redevient vraie. Aujourd'hui, le
vivier tournant une dizaine de fois par manche, les phrases se répètent en
réalité bien davantage que ce que le chantier v1 annonçait.

## Risques et mitigations

- *Corriger ce site d'appel et laisser le motif renaître ailleurs* → garde-fou
  bloquant (décision 2), qui vaut pour toute surface future.
- *Un contrôle qui ne regarde qu'une image ne verrait rien* → échantillonnage
  pendant l'animation (décision 5).
- *Figer sur le mauvais repère* → le repère est nommé et motivé (décision 1).
- *Croire le balayage exhaustif sans l'avoir fait* → son constat est consigné
  avec sa date (décision 4), donc révisable.

---

# 3. Points ouverts

**O2 — Le nom du jeu et le domaine.** Hérité de la v1, toujours différé par
l'auteur. Sans objet pour ce chantier.

Aucun point ouvert neuf.

---

# 4. Hors périmètre

- **La remise à zéro du vivier entre deux parties** (décision 3) : écartée par
  l'auteur, qui accepte que le texte finisse par se répéter.
- **Une détection de la phase de rendu à l'exécution** (décision 2) : écartée au
  profit d'un contrôle statique, pour ne pas dépendre des entrailles de React.
- **L'élément 6 du compte rendu** — « mettre la liste sous la pastille
  Répartition » — est **déjà livré** par la décision 3.1 du chantier v2, poussée
  le 2026-08-20. Vérifié par capture sur le code du dépôt. Aucune action neuve.

---

# 5. Traçabilité — compte rendu → décisions

| Élément du CR#4 | Décisions | Statut |
|---|---|---|
| Le défaut se produit quand un joueur **gagne** | 1, 5 | RETENUE |
| Il se produit aussi quand il **répond bien** | 1, 5 | RETENUE |
| **Tous** les messages apparaissent au lieu d'un seul | 1, 2 | RETENUE |
| Ils défilent **en une seconde** | 1, 5 | RETENUE |
| Attendu : **un message choisi dans la liste** | 1, 7 | RETENUE |
| *(apport en cours de route)* La liste sous la pastille « Répartition » | — | **déjà livré** (v2, décision 3.1) |

**Six éléments extraits, tous tracés.** Aucun écarté.

---

# 6. Table d'avancement

| Action | Décisions | Tenues | Statut | Vérifié par |
|---|---|---|---|---|
| 1 — une phrase choisie | 7 | 7 | **fait** | `voix-une-phrase.spec.js` — échantillonnage toutes les 30 ms pendant 1,4 s : **1** phrase distincte, contre **19** avant correction · `voix-appels.test.js` — le portier, éprouvé sur la faute d'origine |

La colonne « vérifié par » nomme la **preuve** — un contrôle, une mesure, un
constat. « Fait » sans preuve n'est pas fait.

---

# 7. Audit de clôture — 2026-08-20

**Sept décisions confrontées une par une au code. Sept tenues, aucun écart, aucune
dette.** Mais la décision 2 a été tenue par un tout autre moyen que celui prévu,
et c'est le fait marquant de ce chantier.

## Le garde-fou a d'abord échoué à son propre examen

La décision 2 annonçait un **contrôle statique** balayant les sources à la
recherche d'appels hors état, effet ou mémo. Il a été écrit, il est passé au vert,
et il a été soumis à l'épreuve d'usage de ce projet : rétablir le code fautif
d'origine et vérifier qu'il échoue.

**Il l'a laissé passer.** Sa neutralisation des chaînes de caractères prenait
toute apostrophe pour un début de littéral — y compris celles du texte JSX,
« n'a », « d'écran » — et blanchissait donc des pans entiers du fichier, dont
l'appel même qu'elle devait attraper.

C'est la troisième fois dans ces chantiers qu'un contrôle écrit à la va-vite
donne une assurance qu'il ne porte pas. La leçon est constante : **un contrôle qui
n'a jamais échoué sur la faute qu'il prétend garder ne prouve rien.**

## Ce qui l'a remplacé

Plutôt que de rafistoler un analyseur naïf, la faute a été rendue **impossible par
construction**. Les trois crochets de voix — attente, résultat, plateau — vivent
désormais dans un module unique, `src/client/shared/voix-hooks.js`, et le contrôle
vérifie qu'**aucun autre fichier n'importe la voix**. Un composant qui ne peut pas
l'importer ne peut pas l'appeler au mauvais endroit.

Le contrôle ne cherche plus à comprendre le code : il lit des imports. Rien à
analyser, rien à tromper. Éprouvé sur la faute d'origine, il l'attrape.

**Ce que cela a coûté** : le crochet de plateau du stream a quitté `OverlayApp` et
celui d'attente a quitté `PlayApp`, sans changer une ligne de leur logique. Le
module portier fait quatre-vingt-dix lignes, sans JSX, et sa justesse est tenue
par les deux contrôles de bout en bout.

## La mesure, avant et après

| | phrases distinctes pendant l'animation |
| --- | --- |
| Avant correction | **19** |
| Après correction | **1** |

Les dix-neuf relevés comportaient des **répétitions** — « Le plus rapide du
cercle » revenait cinq fois. C'est la preuve visible de la seconde conséquence
diagnostiquée : le vivier de non-répétition était épuisé puis remis à zéro
plusieurs fois par écran. La décision 7 de l'action 7 du chantier v1 est donc
réellement restaurée, pas seulement en principe.

## Le revers, vérifié aussi

Figer la phrase ne doit pas la figer pour toujours. Sur trois manches
consécutives, trois phrases distinctes — un état sans dépendance aurait passé le
premier contrôle et échoué à celui-ci.

## Vérification finale

| | |
| --- | --- |
| `lint:server` · `build` | passent |
| Unitaires | **97** (11 fichiers) |
| Bout en bout | **65** |
| Boucle d'intégration | tous contrôles |

*Pour mémoire : l'audit du chantier v1 a trouvé cinq décisions entérinées et
jamais réalisées ; celui du chantier v2, deux écarts et une dette — dont un écart
sur une décision prise seul, sur une prémisse périmée.*
