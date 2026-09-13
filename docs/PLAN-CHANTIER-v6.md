# Chantier v6 — la séance du 11/09

Source : `260911 Modif.docx`. Seize demandes, dont huit portent sur « Cache-cache »
livré la veille et testé depuis.

Ce document sert deux choses : dire **ce qui est demandé**, sans rien perdre en
route, et dire **dans quel ordre** on l'exécute. La différence avec le chantier v5
est que presque rien ici n'est neuf : ce sont des corrections sur du code qui
tourne, c'est-à-dire l'endroit exact où une régression ne se voit qu'à l'antenne.

---

## 1. Ce qui est demandé — dépouillement exhaustif

Numérotation stable : elle sert à l'audit de clôture, en fin de document.

### Transverses

| № | Demande | Verbatim |
| --- | --- | --- |
| M1 | Les questions ajoutées ou modifiées survivent à un redémarrage du serveur ; seul « Enregistrer » écrit | « Il faut que ces modifications survivent à tout […] Seul le bouton "Enregistrer" dans le Studio doit permettre des changements » |
| M2 | Le Studio affiche les durées RÉELLES des jeux, et la carte dit la même chose que l'éditeur | « pour le jeu "Coupe ta bûche", il est inscrit 20sec, or, le jeu dure 10 secondes » |
| M3 | Un seul libellé sur les cartes : « Modifier » | « il faut modifier pour qu'il y ait écrit toujours "Modifier" » |
| M4 | Le bouton « + Ajouter une question » sur une seule ligne, centré | « Il faut que ce soit sur une même ligne et centré » |
| M5 | Les choix multiples s'adaptent au nombre de choix sur l'écran stream | « Si j'ai 9 choix à la question, alors je dois voir les 9 choix à l'écran » |
| M6 | Écran animateur : le bloc de relance tout en haut, et « Nouvelle partie » pour les jeux sans questions | « devrait s'afficher tout en haut de l'écran […] il ne devrait pas y avoir écrit "Question suivante" mais "Nouvelle partie" » |

### « Cache-cache »

| № | Demande | Verbatim |
| --- | --- | --- |
| M7 | Modérer les questions : les voir, les modifier, en créer — avec leurs **variables en balises** et leurs quotas min/max par manche | « mets moi directement la balise ou autre […] le nombre d'apparitions minimum et maximum de la question par manche » |
| M8 | Modérer la base d'images : image, ID, Nom, Couleur — modifiables, avec ajout de lignes | « Il faut que je puisse modifier les informations et ajouter de nouvelle ligne » |
| M9 | Le fond blanc d'une case et son image apparaissent ENSEMBLE | « un fond blanc apparaît 1 demi-seconde avant que l'image apparaisse » |
| M10 | Écran joueur au dévoilement : points de **base** et bonus de **vitesse** séparés | « l'information du nombre de points de Base (+200) et du nombre de points bonus grâce à la vitesse (entre 0 et 100) » |
| M11 | La fenêtre de réponse passe de 10 s à **16 s** | « on passe maintenant à 16sec » |
| M12 | Écran joueur, saisie au clavier : tout tient dans un téléphone vertical | « tout dépasse de l'écran, il faut revoir ce design » |
| M13 | Écran stream au dévoilement : seulement la question en cours, sa réponse et la matrice ; police réduite | « la dernière question posée est toujours affichée […] baisser la police d'écriture pour que tout soit affiché » |
| M14 | Écran animateur : « Répartition en direct » ne remonte rien | « Les données des joueurs ne remontent pas » |
| M15 | Écran animateur : retirer « Répartition en direct » pendant le dévoilement | « n'est pas important lors du dévoilement des réponses. Il faut l'enlever » |
| M16 | Sixième forme de question : « Derrière quel numéro se cache &lt;nom&gt; ? », 1 à 3 fois, jamais deux fois la même image, neuf choix, la case se dévoile | énoncé complet en fin de document source |

### Ce qui a été écarté, et pourquoi

Rien. Les seize lignes du document sont des demandes, y compris celles rédigées
comme des constats (M14, « ne fonctionne pas ») — un constat de panne est une
demande de réparation.

---

## 2. Ce que le document ne dit pas, et qui a été tranché

1. **M1 n'était pas un défaut de code.** Le serveur écrivait bien sur disque. Le
   disque de Render, en formule gratuite, est ÉPHÉMÈRE : il repart vierge à chaque
   redémarrage. Aucune correction du code de sauvegarde n'aurait pu tenir la
   promesse. La persistance passe donc par Supabase, en plus du disque.
2. **La durée d'un jeu est une RÈGLE, pas un réglage** (M2). Plutôt que de corriger
   les nombres inscrits dans la banque — qui redeviendraient faux au premier
   changement de règle — chaque module DÉCLARE sa durée et si elle est fixe. Le
   Studio l'affiche et verrouille le champ quand elle l'est.
3. **Le contenu modéré de « Cache-cache » (M7, M8) est rangé dans le champ
   `questions` du module**, sous une marque à lui. Ce jeu n'a pas de questions
   écrites : le champ était libre. Aucune table nouvelle, aucune migration, et le
   contenu est enregistré par le même bouton « Enregistrer » que tout le reste —
   ce que M1 exige.
4. **Les quotas appartiennent au GABARIT, plus à la forme.** L'animateur peut
   écrire deux variantes d'une même forme avec des quotas différents ; la
   répartition est donc indexée par identifiant de gabarit.
5. **Le Studio n'envoie pas de fichier image.** Il n'existe pas de route pour
   cela. La base d'images règle le nom, la couleur et le CHEMIN ; le fichier doit
   déjà être servi. C'est écrit sur l'écran plutôt que deviné.
6. **Le plateau de rapidité suit la fenêtre** (M11) : « de 10 s à 9 s = 100 pts »
   devient « de 16 s à 15 s », le plancher reste à 2 s, la pente s'étire.

---

## 3. Chemin critique

```
M1 (persistance durable) ──────────────┐
                                        ▼
M2 (durées déclarées) ──▶ M3 M4 ──▶ M7 M8 (modération au Studio)
                                        ▲
M16 (sixième forme) ────────────────────┘

M5 M13 (les écrans de choix)   — indépendants
M6 M14 M15 (écran animateur)   — indépendants
M9 M10 M11 M12 (écran joueur)  — indépendants
```

**Pourquoi cet ordre.**

- **M1 d'abord, et seul.** Tant que la persistance ne tient pas, TOUTE modération
  faite au Studio est perdue au redémarrage suivant. M7 et M8 ne valent rien avant
  elle : on livrerait un formulaire qui oublie.
- **M2 avant M7/M8** : la modération s'ajoute au panneau d'édition, qui est
  précisément l'écran que M2 corrige. Les faire dans l'autre sens, c'est écrire la
  modération sur un panneau qu'on va refondre.
- **M16 avant M7** : le Studio propose les formes que le SERVEUR sait calculer.
  Ajouter la sixième après coup ferait un catalogue en retard d'une forme.
- **Les trois autres groupes sont indépendants** entre eux et du reste.

**Le risque principal est M11.** Seize secondes au lieu de dix, c'est un nombre lu
par le barème, par l'affichage du chronomètre, par la fenêtre de refus des réponses
tardives et par le calcul du bonus de rapidité. Changé à un seul de ces endroits,
le jeu reste jouable et devient faux — sans rien pour le dire.

---

## 4. Journal d'exécution

### M1 — la persistance durable
Diagnostic d'abord : le code de sauvegarde était correct, l'infrastructure ne
l'était pas. Le serveur écrit désormais dans Supabase EN PLUS du disque, relit la
base au démarrage et à chaque ouverture du Studio, et **remonte l'échec** — un
enregistrement qui n'atteint pas la base répond 503 plutôt que de mentir. La table
`public.modules` existait déjà et était vide : aucune migration.

### M2 — les durées déclarées
Chaque module déclare `dureeS` et `dureeFixe`. Le Studio les reçoit par l'API et
les affiche : la carte et l'éditeur lisent le même nombre, et ce nombre est celui
du jeu. Le champ est verrouillé quand la règle l'impose, et le dit.

### M3, M4 — les deux corrections d'écran
Un seul libellé. Le bouton d'ajout n'avait aucune mise en page : son icône et son
texte étaient deux enfants d'un bloc, donc empilés et collés à gauche.

### M5, M13 — les choix et le dévoilement au stream
Les tailles des choix se calculent désormais à partir de leur nombre et de la place
disponible — hauteur, corps, gouttière, pastille. Neuf choix tiennent.
Au dévoilement, la question périmée disparaît avec le chronomètre ; il ne reste que
la question révélée, sa réponse et la matrice.

**Un défaut trouvé en chemin, et il était de moi** : des surcharges CSS écrites la
veille pour « Cache-cache » (`min-height: 0`, corps fixe) battaient les nouvelles
variables adaptatives. Le calcul était juste et n'arrivait pas jusqu'au pixel.

### M6, M14, M15 — l'écran de l'animateur
Les panneaux de préparation remontent en tête de scène. « Nouvelle partie » pour
les jeux sans banque. La répartition disparaît pendant le dévoilement, et elle
fonctionne pour les réponses ÉCRITES — ce qui manquait : la jauge ne savait rendre
que des choix numérotés, et « Cache-cache » a trois formes qui se tapent.

### M7, M8 — la modération au Studio
Un panneau qui remplace la liste de questions pour ce type de jeu, parce que sa
banque n'est pas une liste de questions : c'est un jeu de gabarits et une base
d'images, dont le serveur tire cinq questions par manche.

Les **variables restent des balises** à l'écran, comme demandé — `{objet}`,
`{case}`, `{objetA}` — et l'écran dit lesquelles chaque forme accepte. On peut
réécrire un énoncé, changer ses quotas, éteindre une question, en ajouter une
variante ; on ne peut pas inventer une FORME, parce qu'une forme n'est pas un
texte mais un calcul — la bonne réponse, la liste de choix, la case à dévoiler.

**Trois défauts trouvés à l'écran, pas dans le code.** Le panneau était juste et
l'écran mentait :

1. **La carte du jeu disait « Aucune question — rien à préparer ici »**, ce qui
   était faux des deux côtés : six énoncés et deux cents images se règlent dans
   cet éditeur. La carte détournait de l'écran qu'elle aurait dû désigner.
2. **Les formes s'affichaient en noms de code** — `couleur_de`, `objet_derriere` —
   devant l'animateur. Les libellés sont désormais déclarés côté SERVEUR, à côté
   de la forme, et un contrôle unitaire exige que chacune en ait un : une forme
   ajoutée sans libellé se verrait tout de suite, au lieu d'écrire « undefined ».
3. **Deux cents rangées sans filtre ne se modèrent pas.** Mesuré : 228 px par
   rangée, soit plus de cent écrans de défilement pour atteindre une image. La
   capacité demandée existait sans être utilisable. Un filtre a été ajouté, et la
   rangée resserrée à 168 px — avec le contrôle du piège qui va avec : un filtre
   qui réindexe la liste écrit dans la mauvaise ligne, deux cents rangs plus haut,
   là où personne ne regarde.

**Le réglage qui tue la manche, et qui ne se voit pas.** Cinq questions sont tirées
par manche. Si les minimums en réclament plus de cinq, ou si les maximums n'en
permettent pas cinq, aucune répartition n'existe : le serveur lève une erreur et
l'animateur clique « Lancer » sans que rien ne parte. Le formulaire, lui, n'a l'air
de rien — six lignes chacune plausible. Le Studio refuse donc l'enregistrement et
dit lequel des deux plafonds est franchi.

### M9 — le fond et l'image ensemble
La case n'allume sa plaque qu'une fois l'image décodée, et retombe sur la plaque
seule si l'image n'arrive jamais.

### M10, M12 — l'écran du joueur
Base et rapidité affichées séparément : un joueur qui lit « +240 » ne sait pas ce
qu'il a gagné en justesse et ce qu'il a gagné en vitesse, et c'est pourtant la
seconde seule qu'il peut améliorer. La saisie au clavier est remise au format
vertical du téléphone.

### M11 — seize secondes
La fenêtre, le barème et le plateau de rapidité changent ensemble.

### M16 — la sixième forme
« Derrière quel numéro se cache &lt;nom&gt; ? » — l'inverse exact de « quel objet se
cache derrière 2 ? », la même paire objet/case lue dans l'autre sens. Neuf choix,
la réponse EST la case, et la case se dévoile.

---

## 5. Audit de clôture

Décision par décision, confrontée au code — pas un balayage d'ensemble.

| № | État | Où cela se vérifie |
| --- | --- | --- |
| M1 | fait | `src/server/store.js` (`sauverEnBase`, `rafraichirDepuisLaBase`, `restaurerTousLesComptes`) ; 503 `save-failed` dans `index.js` |
| M2 | fait | `meta.dureeS` / `meta.dureeFixe` sur chaque module ; `typesPourLeStudio()` ; `duree-fixe` au Studio |
| M3 | fait | `ModuleCard` — un seul libellé |
| M4 | fait | `.qadd` en boîte flexible centrée |
| M5 | fait | `mesuresDesChoix()` dans `OverlayApp.jsx` |
| M6 | fait | panneaux de préparation en tête de `.stage` ; `current?.meta?.direct` → « Nouvelle partie » |
| M7 | fait | `ModerationCache` au Studio ; `GABARITS_PAR_DEFAUT`, `VARIABLES_PAR_FORME`, `/api/cache/catalogue` |
| M8 | fait | même panneau, section « Base d'images », avec filtre |
| M9 | fait | `useObjetPret()` dans `GrilleCache.jsx` |
| M10 | fait | `breakdown` de `DevoilementScreen` (`cc-dev-base`, `cc-dev-vitesse`) |
| M11 | fait | `DUREE_QUESTION_MS = 16_000` ; `RAPIDITE_CACHE = { plateau: 15, … }` |
| M12 | fait | `.ccsaisie` dans `play.css` |
| M13 | fait | `enDevoilement` masque question périmée et chronomètre ; `--st-q-fs` |
| M14 | fait | `dist.kind === 'mots'` dans `HostApp.jsx` |
| M15 | fait | `cacheAuxReponses` masque le bloc |
| M16 | fait | `FORMES.numero_de`, `NUMEROS`, gabarit `g-numero` |

**Écarts trouvés pendant l'audit, et corrigés.**

1. **Un contrôle existant lisait les quotas par FORME** alors que la modération les
   a déplacés sur le GABARIT. Il tombait en erreur de type, pas en assertion — le
   genre de rouge qu'on lit comme un accident de test.
2. **Le filtre de la base d'images n'était pas demandé**, et il a pourtant été
   ajouté : sans lui, « modifier les informations » restait vrai sur le papier et
   impraticable à l'usage. C'est un ajout au périmètre, signalé comme tel.
3. **Un contrôle de « Cache-cache » échouait une fois sur six**, et pour une
   raison qui n'était pas un défaut du jeu : il posait ses réponses dans le tour
   *n* en laissant la manche sur le DERNIER tour ; quand le tirage plaçait la
   question visée en dernier, les deux coïncidaient et le moteur lisait une carte
   vide. Un contrôle qui échoue une fois sur six finit par être cru à tort, dans
   un sens ou dans l'autre.

**Ce qui reste ouvert, et qui appartient à l'auteur.**

- **L'exemple à −3 de l'énoncé « Retour de flamme » est incohérent** avec sa propre
  règle : la règle donne SEPT retours (5, 12, 15, 21, 23, 25, 27), l'exemple en
  écrit six. Le code suit la RÈGLE ; un contrôle fige cette lecture.
- **La comparaison des réponses écrites est un peu plus indulgente que la lettre
  de l'énoncé** : casse, accents ET ponctuation sont ignorés. À l'antenne, sur un
  clavier de téléphone, c'est le bon sens ; c'est dit ici parce que ce n'est pas
  écrit dans le document source.


---

## 6. Suite de séance — la banque d'images gérée en ligne

Demande postérieure au chantier, formulée le 12/09 : « Est-ce que je peux gérer la
banque d'image moi-même en ligne ? ajouter des images, des couleurs etc. »

### M17 — les couleurs modérées commandent vraiment le jeu (DÉFAUT)

**Ce n'était pas une évolution, c'était une panne**, et elle a été livrée avec M8.
L'écran laissait changer la couleur d'un objet ; le tirage lisait la CONSTANTE du
dépôt. Renommer « Bleu » en « Turquoise » faisait chercher un couple « nom|Bleu »
disparu : les quarante essais échouaient, le serveur levait, et l'animateur
cliquait « Lancer » sans que rien ne parte. Mesuré avant correction.

Quatre points de contact, pas un :
`construireMatrice` (la matrice), `listeDeChoix` (les boutons du joueur),
`validateAnswer` (la borne de l'indice reçu) et `couleurUnique`.

**Pourquoi le contrôle de M8 ne l'avait pas vu** : sa fausse banque était bâtie
AVEC `COULEURS`. Il vérifiait les noms et croyait vérifier les couleurs.

### M18 — combien de couleurs une grille de neuf cases admet

Généralisation, décidée ici. Chaque couleur une ou deux fois, neuf cases
remplies : il en faut de **5 à 9**. Quatre n'en couvrent que huit ; dix n'en
remplissent que dix. Le Studio refuse en dehors, et le dit.

**« Quelle couleur n'est présente qu'une seule fois ? » n'existe qu'à cinq.**
Quatre doublées et une seule : c'est la seule répartition possible, et c'est ce
qui rend la question sans ambiguïté. À six, il y a trois couleurs uniques — la
question aurait trois bonnes réponses et une seule acceptée. Elle n'est alors plus
tirée, et le Studio refuse qu'on lui impose un minimum.

### M19 — déposer une image, et la codifier

Le champ couleur devient LIBRE, avec les couleurs connues en suggestion : une
liste fermée ne laisserait que choisir, jamais codifier.

| Où | Quoi |
| --- | --- |
| Navigateur | détourage par les bords, 512 px, WebP 82 — le traitement des 200 icônes |
| Serveur | ne décode jamais : signature d'octets, poids, identifiant, puis rangement |
| Rangement | seau Supabase `objets` (public en lecture, écriture service role) ; disque local en développement, et l'écran le DIT |
| Identifiant | déduit du nom et de la couleur (`guitare-bleu`) — donc redéposer remplace au lieu d'accumuler |

**Deux pièges rencontrés, tous deux silencieux :**

1. **La CSP n'autorisait que `img-src 'self' data:`.** Une image servie par
   Supabase aurait été bloquée — sur le stream ET sur les téléphones, sans
   message, sans erreur visible. La case serait restée une plaque vide.
2. **Le service statique enregistrait ses routes AU DÉMARRAGE** (`wildcard:
   false`). Une image déposée ensuite répondait 404 tout en étant bien sur le
   disque. C'est ce que garde le contrôle de bout en bout, vu rouge.

### Ce qui reste ouvert

- **Le chemin Supabase Storage n'est pas couvert par la suite.** Le seau existe,
  sa politique de lecture publique est vérifiée, le code est relu — mais aucune
  clé de service ne vit hors de l'hébergeur, donc la première écriture réelle se
  fera en production. Le chemin disque, lui, est couvert de bout en bout.
- **Ajouter une couleur, c'est ajouter QUARANTE images**, une par objet : la
  banque doit rester complète, chaque nom présent dans toutes les couleurs. Le
  Studio le vérifie et nomme les objets incomplets.


---

## 7. M20 — le Studio n'était animateur QUE chez moi

Rapporté le 13/09 : « ce que je veux c'est changer le nom des images, la couleur,
et les images déjà chargées, le tout **en ligne via mon compte animateur** ».

La demande décrivait ce qui venait d'être livré. C'était donc que rien ne
marchait — et c'était le cas.

### Le défaut

Les deux routes ajoutées la veille appelaient l'API **sans en-tête d'animateur** :

| Route | Effet en production |
| --- | --- |
| `GET /api/cache/catalogue` | 403 → le catalogue n'arrive jamais → l'écran de modération affiche **zéro question et zéro image**, sans message |
| `POST /api/cache/image` | 403 → aucun dépôt ne peut aboutir |

En développement, `requireHost` est OUVERT — ni HOST_EMAIL ni Supabase — et
l'appel passe. Le symptôme est donc **invisible là où l'on travaille et total là
où l'on diffuse**. Mesuré : un serveur lancé avec `HOST_EMAIL` répond 403 aux
trois routes.

**C'est la troisième fois que ce défaut se produit dans ce dépôt**, et ce fichier
le documentait déjà pour `/api/modules`. Une note dans le code ne l'a pas empêché
de revenir : ce qui se répète a besoin d'un CONTRÔLE, pas d'un avertissement.

`tests/unit/studio-entetes.test.js` lit désormais la source du Studio et exige que
tout `fetch` vers `/api` passe par `entetesHote()`. Il nomme les routes fautives.
Un contrôle de bout en bout ne pouvait pas le voir : la campagne tourne
précisément dans le mode où l'autorisation est ouverte.

**Et l'échec se voit désormais.** Un panneau vide ne se distingue pas d'une banque
effacée : le Studio affiche la raison, et invite à se reconnecter.

### Le défaut voisin, trouvé en vérifiant

La route annonçait deux mégaoctets d'image et en refusait déjà à **sept cent
cinquante kilo-octets** : Fastify coupe le corps à un mégaoctet par défaut, et le
base64 pèse un tiers de plus que les octets. Le refus venait du cadre, avant le
gestionnaire, avec un message que le Studio ne pouvait pas traduire. La limite est
maintenant déclarée sur la route et accordée à celle de l'image ; le Studio
traduit 403 et 413 en phrases que l'animateur peut suivre.
