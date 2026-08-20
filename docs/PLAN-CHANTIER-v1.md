---
artifact_type: plan_chantier
app: root
version: 1
change_set: forward
produced_by: discussion-reunions
created_at: 2026-08-20
created_by: R.M.A + Claude
status: validated
source_meetings: 2
actions_total: 19
actions_retained: 18
effort_estimate_days: 25
---

# PLAN DE CHANTIER v1 — Project Game Show

> Référence d'implémentation issue de deux réunions de test et de leur analyse
> action par action. **Chaque décision listée ici a été explicitement entérinée.**
> Rien ne doit être ré-arbitré pendant l'implémentation : en cas de doute, ce
> document fait foi. Les points non tranchés sont regroupés en fin de document,
> section « Points ouverts » — ils doivent être posés avant que l'action
> concernée démarre.

## Comment lire ce document

Chaque action suit la même structure : l'origine dans les comptes rendus, le
diagnostic technique avec les références de code, les décisions entérinées
(numérotées — ce sont elles qui engagent), les étapes, les dépendances, les
impacts, les risques avec leurs mitigations, et la charge.

Les décisions transversales de la section suivante s'appliquent à **toutes** les
actions et priment sur toute formulation locale qui les contredirait.

## État d'avancement

| Lot / action | État | Vérifié par |
|---|---|---|
| Lot 0 — le filet | **fait, et refermé** | `tests/e2e/studio-to-game.spec.js` — écrit, **vu échouer**, puis **vu passer** à la livraison de l'action 2. Playwright a signalé « attendu en échec, a réussi » ; l'annotation a été retirée le 2026-08-20. |
| 2 — modules nommés | **fait** | le filet ci-dessus + `tests/unit/store.test.js` réécrit (10 tests) + boucle d'intégration |
| 12 — restitution des résultats | **fait** | `tests/e2e/reconnexion-resultat.spec.js` (2 tests, coupure réseau réelle) |
| 14 — jauge et couleurs | **fait** | `tests/e2e/jauge-repartition.spec.js` (2 tests, géométrie mesurée) |
| 15 — bouton quitter | **fait** | `tests/e2e/fin-de-partie-joueur.spec.js` (2 tests) |
| 16 — menu changer de module | **fait** | `tests/e2e/menu-module.spec.js` (2 tests, géométrie mesurée) |
| 17 — lisibilité du calcul | **fait** | `tests/e2e/bareme.spec.js` + unitaires + intégration réécrits |
| 8 — barème énoncé, panneau supprimé | **fait** | `tests/e2e/bareme.spec.js` (3 tests) |
| 13 — estimation : paliers et histogrammes | **fait** | `tests/e2e/estimation.spec.js` + 7 unitaires (cible d'un million, cible à un chiffre, aberrante) |
| 18 — le vote devient un jeu | **fait** | `tests/e2e/vote.spec.js` + unitaires (majorité, égalité, sondage) |
| **Lot 2 (barème) : COMPLET** | | 17 → 13 → 18 → 8 → 14 |
| 9 — mot de passe et masquage | **fait** | `tests/unit/authErrors.test.js` réécrit, `host-login.spec.js` ajusté |
| 10 — comptes, migrations, cloisonnement | **fait** | migrations récupérées et versionnées ; durcissement appliqué ; cloisonnement disque livré avec l'action 2 |
| 3+4+5 — refonte du stream | **fait** | `tests/e2e/stream-disposition.spec.js` (8 tests, géométrie et lisibilité mesurées) + `stream.spec.js` réécrit au nouveau contrat |
| 6 — non-répétition et file d'attente | **fait** | `tests/e2e/file-attente.spec.js` (4 tests) — le test de non-répétition a été **rendu déterministe** après avoir constaté qu'il ne catchait pas le défaut |
| 7 — la voix du jeu | **fait** | `tests/unit/voix.test.js` (17 tests, **contrôle bloquant**) + `tests/e2e/voix.spec.js` (4 tests) ; convention inscrite dans `AGENTS.md [VOIX]` |
| 19 — nom et identité | **fait, sauf le choix du nom** | `tests/unit/marque.test.js` — le nom vit dans `src/client/shared/marque.js`, une seule ligne à changer le jour du choix |
| 11 — clôture | **fait** | vérifications réparties au fil des actions ; une contradiction trouvée et corrigée à la clôture (ci-dessous) |
| **TOUTES LES ACTIONS SONT LIVRÉES** | | reste le choix du nom et du domaine (O2) |

### Audit exhaustif du plan — 2026-08-20

Les **167 décisions** (7 transversales + 160 numérotées) ont été confrontées une à
une au code. **Cinq écarts trouvés, tous corrigés :**

1. **Action 2, décision 6** — le bouton « restaurer les questions de base »
   n'existait pas. La route serveur et la fonction de stockage étaient en place,
   le bouton n'avait jamais été posé dans le Studio. *Ajouté.*
2. **Action 7, décision 3** — 125 phrases livrées pour ~200 annoncées, et 24
   moments sur 34 tenaient sur moins de quatre phrases. *Porté à 181 phrases,
   aucun moment en dessous de quatre.*
3. **Action 7, décision 11** — aucune phrase de repli pour le joueur arrivé en
   cours de partie ni pour celui qui attend son résultat, alors que la décision
   dit « jamais d'écran muet ». *Deux moments ajoutés et câblés.*
4. **Actions 8 et 17, décision 6** — l'énoncé du barème ne décrivait que le quiz.
   Ni les paliers d'estimation, ni la règle du vote, ni les trois cas de rupture
   de série n'y figuraient. *Complété pour les quatre jeux.*
5. **Action 12, décision 5** — un joueur arrivé après le lancement voyait un
   relevé à zéro au lieu du message « cette manche s'est jouée sans toi ». Le
   serveur envoie un relevé à tous les connectés, y compris aux non-participants ;
   l'écran se fiait à sa présence plutôt qu'à la participation réelle. *Corrigé :
   c'est désormais la participation qui décide.*

**Une assertion superstitieuse retirée au passage** : un test rejetait toute
phrase contenant « perdu », et échouait donc sur « Rien de perdu — tu entres
maintenant », qui est accueillante. Un contrôle qui échoue sur une bonne phrase
est pire qu'aucun contrôle ; le registre reste affaire de relecture, comme la
convention le dit elle-même.

**Observation hors périmètre, traitée ensuite** : trois valeurs `oklch()` étaient
écrites en dur dans le CSS client (`host.css:139`, `play.css:391` et `:400`), ce
que la convention du projet interdit. Elles **préexistaient au chantier** —
vérifié : aucune n'apparaît dans le diff. Voir la section suivante.

### Rapatriement des trois couleurs en dur, et le gate qui manquait

**Les trois valeurs.** Toutes trois relevaient du même angle mort du système : un
jeton *à un certain niveau de transparence*. Le système décrit des couleurs
pleines ; il ne dit rien de « cette couleur, à 22 % ». Faute de vocabulaire, la
valeur avait été recopiée à la main.

| Nouveau jeton | Rôle | Emplacement d'origine |
| --- | --- | --- |
| `--c-ember-ring` | halo de la braise qui tourne, accueil animateur | `host.css` `.home-spin` |
| `--c-veil-on-flame` | voile sombre sur la pastille d'une réponse choisie | `play.css` `.opt--selected .opt__key` |
| `--c-veil-on-leaf` | le même voile, sur une réponse votée | `play.css` `.opt--voted .opt__key` |

**Aucun changement visible.** Les valeurs sont reprises au chiffre près, et
`tests/e2e/jetons-rapatries.spec.js` le prouve dans un vrai navigateur : il pose
côte à côte la valeur littérale et le `var()`, et compare la couleur calculée.
Les trois paires sont identiques.

**Ce que le rapatriement a mis au jour.** `AGENTS.md` affirme depuis le début que
« le gate refuse **mécaniquement** toute valeur de design écrite hors de
tokens.css », et la convention de build répète « zéro couleur/spacing/police
hardcodé ». **Ce gate n'existait pas.** Aucun contrôle ne le vérifiait — ce qui
explique que trois couleurs aient vécu des mois sans que rien ne les signale, et
qu'elles n'aient été trouvées qu'à la main.

Une règle annoncée mais non tenue est pire qu'une règle absente : elle donne
l'assurance sans la garantie. `tests/unit/design-tokens.test.js` la tient
désormais — couleurs, piles de polices, rayons, et existence réelle de chaque
jeton employé (un jeton mal orthographié ne casse rien de visible : la propriété
est ignorée et l'écran s'affiche « presque » bien).

**Le contrôle a été éprouvé dans les deux sens**, comme les autres filets de ce
chantier : les quatre fautes qu'il prétend attraper ont été réintroduites une à
une, et il a échoué à chaque fois. Il a d'ailleurs commencé par crier au loup sur
huit lignes correctes — deux motifs mal écrits de ma part, corrigés avant de le
retenir. Un contrôle qui échoue sur du bon code ne vaut pas mieux que pas de
contrôle du tout.

**Ce qu'il ne vérifie pas, délibérément** : les longueurs en pixels. Une hauteur
de piste ou un décalage d'un pixel relèvent de la géométrie d'un composant, pas
du système ; les jetonner tous produirait un dictionnaire illisible. Le système
tient les espacements (`--sp-*`), qui eux sont partagés.

### Ce que la clôture a trouvé

Une **contradiction introduite par ma propre simplification de l'action 2**. Le
serveur consultait encore Supabase pour le même TYPE et versait le résultat dans
la réserve du jeu lancé — c'est-à-dire exactement l'aplatissement par type que
l'action 2 venait de supprimer, réintroduit par une autre porte. Lancer « Culture
générale » aurait de nouveau pu tirer dans toutes les questions de type quiz.

Le filet ne l'aurait pas attrapé : il ne joue que sur le stockage disque. La
fusion est retirée, et la garantie — la réserve d'un jeu est celle de ce jeu — est
désormais vérifiée au plus près du code.

**Sur le mode Supabase (décision 3 de l'action 11)** : la décision demandait une
vérification automatique complète avec une base dédiée. La simplification de
l'action 2 l'a rendue en grande partie sans objet — le Studio ne parle plus qu'au
serveur, et plus rien n'écrit dans la table `modules`. Ce qui restait de ce
chemin était la contradiction ci-dessus ; elle est supprimée. Il n'y a donc plus
de « second mode de stockage » à vérifier : il n'y en a qu'un.

### Le contrôle de la voix, éprouvé dans son rôle de garde-fou

Il ne suffit pas qu'il passe : il doit **échouer** quand la convention est violée.
Vérifié dans les deux cas, avec des messages qui disent quoi faire :

- un type de jeu ajouté sans ses phrases → *« le type de jeu "duel" n'a aucun
  moment de voix déclaré »* ;
- une route ajoutée sans sa surface → *« la route "/coulisses" n'est pas déclarée
  dans SURFACES »*.

Volume livré : **36 moments déclarés, 181 phrases**, moyenne de 5 par moment,
aucun en dessous de 4. Les moments fréquents — attente, bonne réponse, échec —
sont les plus fournis : c'est la fréquence réelle qui commande le volume, pas une
répartition uniforme.

*(Chiffre corrigé après audit : une première note annonçait « environ 150
phrases » pour 125 réelles, et 24 moments sur 34 tenaient sur moins de quatre
phrases — trop peu pour ceux qui reviennent à chaque manche.)*

### Limite assumée — lisibilité de l'adresse sur le stream

La vérification promise à trois tailles réelles a été faite, et **mesurée** :

| Taille de rendu | Code du salon | Adresse |
|---|---|---|
| Canevas 1920 | 62 px | 34 px |
| Ordinateur portable 1440 | 46,5 px | 25,5 px |
| Téléphone en paysage 844 | 22,4 px | 12,3 px |
| Téléphone en portrait 390 | 12,6 px | **6,9 px** |

L'adresse a été remontée d'un cran dans l'échelle après une première mesure à
5,3 px en portrait. Elle tient désormais jusqu'au téléphone en paysage. **En
portrait elle reste sous le seuil de lisibilité, et aucune taille raisonnable ne
l'y sauverait** : à cette échelle le stream entier occupe 390 px de large et
l'énoncé de la question lui-même n'y fait que 17 px. Lui donner la taille d'un
titre ramènerait l'encombrement du panneau qu'on vient de retirer.

Limite assumée, pas oubli : **le code du salon, lui, reste lisible partout**, et
l'animateur peut annoncer l'adresse à l'oral. Le test consigne les chiffres à
chaque exécution pour que la décision reste révisable sur des faits.

Suite au vert : **63 tests unitaires, 27 bout-en-bout** et la boucle d'intégration
complète.

### Simplification actée pendant l'action 2

Le Studio avait **deux chemins de persistance** — Supabase depuis le navigateur si
une session existait, le serveur sinon. Deux défauts en découlaient : le chemin
serveur n'était emprunté que si le client Supabase était *totalement absent*, ce
qui n'arrive jamais (URL et clé sont intégrées au build), si bien que le Studio
gardait sa graine locale de démonstration et **l'écrasait par-dessus la vraie
bibliothèque** au premier enregistrement ; et deux chemins d'écriture signifiaient
deux vérités possibles pour un même compte.

**Décision : le Studio ne parle plus qu'au serveur.** Le serveur est seul
propriétaire de la persistance — il écrit sur disque et reste seul à consulter
Supabase pour alimenter les parties. Un chemin, une vérité. Le refus
d'autorisation (403) se distingue désormais d'une panne réseau et dit quoi faire,
au lieu de basculer silencieusement en « local » — ce silence est ce qui a laissé
croire pendant des mois que le Studio enregistrait.

### Ce que le constat de la base a révélé (action 10)

Le diagnostic du plan était **partiellement faux**, et la vérité est plus simple.

- Le schéma, les politiques d'accès et les index sont **corrects et complets**.
  `owner_id` prend même `auth.uid()` par défaut : l'hypothèse d'un propriétaire
  laissé vide par le Studio était erronée.
- Une migration **avait bel et bien été appliquée** (`20260726135949`) ; c'est son
  **fichier** qui n'avait jamais été versionné. F-006 n'était pas un schéma absent
  mais un dépôt muet. Le SQL réellement exécuté a été récupéré depuis l'historique
  de la base et versionné tel quel — il contenait un déclencheur de création de
  profil qu'une reconstitution de mémoire aurait manqué.
- La table `modules` est **vide** : rien n'y a jamais été écrit. Le blocage était
  entièrement côté client, et il était double.

**Les deux causes réelles du lien studio-jeu rompu :**

1. Le Studio appelait `/api/banks` **sans aucun en-tête d'autorisation**. En
   développement `requireHost` est ouvert et ça passait ; en production, où
   `HOST_EMAIL` est configuré, le serveur répondait 403 et l'enregistrement
   échouait en basculant silencieusement en « local ».
2. Le chemin Supabase n'est emprunté que si une session existe dans le navigateur
   — or `/studio` n'a aucun écran de connexion.

Les deux sont corrigés : le Studio joint désormais le jeton de session à ses
appels disque, et le serveur accepte une liste d'adresses animateur.

**Durcissement appliqué** : la fonction de création de profil était appelable
publiquement via l'API REST avec des privilèges élevés (avertissements Supabase
0028 et 0029). Le droit d'exécution a été retiré aux rôles `anon` et
`authenticated` — le déclencheur continue de fonctionner, l'insertion dans
`auth.users` étant faite par le rôle d'administration.

**Risque accepté — protection contre les mots de passe compromis.** L'option
(vérification auprès de HaveIBeenPwned) est réservée aux plans payants de
Supabase ; le projet reste sur une offre qui n'y donne pas accès. Décision prise
le 2026-08-20 de s'en passer. Mitigation partielle disponible sur tous les plans
et recommandée : longueur minimale d'au moins 12 caractères et exigence de
chiffres, minuscules, majuscules et symboles. Conséquence anticipée dans le code :
durcir ces règles fait apparaître une erreur de mot de passe trop faible **à la
connexion, avec pourtant le bon mot de passe** — le message dédié existe et
renvoie vers la réinitialisation.

**Preuves recueillies en cours de route**, qui confirment le diagnostic du plan :

- Le marqueur d'une question créée au Studio est bien écrit sur disque, mais le
  **nom du jeu n'y figure pas** (0 occurrence) et le fichier reste organisé par
  type — action 2 confirmée dans son diagnostic comme dans son remède.
- Avant correction de l'action 14, une option **que personne n'avait choisie**
  affichait une barre de 782 pixels, pleine ; et la barre majoritaire occupait
  100 % de la piste. Mesuré, puis re-mesuré après correction.
- Avant correction de l'action 16, le bas du menu se situait à **886 pixels pour
  une fenêtre de 656** — il dépassait de 230 pixels sous le pli.

**Deux pièges débusqués et traités**, hors périmètre initial :

- `POST /api/rooms` redonne à l'animateur son salon encore ouvert
  (`src/server/index.js:80`). Un test qui ne clôt pas son salon lègue au suivant
  une partie en cours. D'où `tests/e2e/cloture.js`, appelé après chaque test même
  en cas d'échec. Bénéfice annexe : la suite est passée de 56 à 21 secondes.
- Les deux menus de l'animateur partagent une classe mais **pas la même barre** :
  celui de sortie est en haut, celui des modules en bas. Renverser la classe
  partagée aurait cassé le premier ; une variante a été posée à la place.

---

# 1. Décisions transversales

Ces décisions ont été prises en cours de discussion et modifient rétroactivement
plusieurs actions. Elles sont la première chose à respecter.

**T1 — Aucune pénalité, dans aucun jeu.** Le malus de mauvaise réponse
(`WRONG_MALUS = -100`, `src/server/engine.js:20`) est supprimé. Le drapeau
`meta.malus` devient sans objet sur tous les modules. La ligne « Malus »
disparaît de l'écran du joueur. Conséquence assumée : répondre au hasard ne
coûte rien.

**T2 — Grammaire de score unifiée sur les quatre modules.** Le détail des points
se lit partout de la même façon : une **base**, puis un **complément de
vitesse**. Rien d'autre.

| Module | Base | Complément de vitesse |
|---|---|---|
| Quiz | 700 si bonne réponse | 0 à 300 selon la rapidité, +150 au plus rapide de la manche |
| Vrai/Faux | idem quiz | idem quiz |
| Estimation | valeur du palier atteint (action 13) | **aucun** — la justesse seule décide |
| Vote | base fixe si majoritaire | aucun |

Les totaux du quiz et du vrai/faux sont **rigoureusement ceux d'aujourd'hui**,
série et malus mis à part : la décomposition ne fait que dire la vérité sur un
calcul inchangé (`speedPoints` vaut déjà `700 + 300 × rapidité`,
`src/server/modules.js:19`).

**T3 — La série est une information, pas une source de points.** Le bonus de
série (`STREAK_STEP`, `STREAK_CAP`) est retiré du calcul. Le compteur reste
suivi et affiché sous le libellé « Série de bonnes réponses ». La notation
« ×N », qui laissait croire à une multiplication, disparaît.

**T4 — La série se rompt dans trois cas** : une mauvaise réponse, une manche
sans réponse, une position minoritaire au vote (à partir de l'action 18).

**T5 — Libellé « Complément de vitesse »** partout, y compris sur grand écran.

**T6 — Conventions du projet inchangées** : aucun emoji, aucune valeur de design
écrite hors de `design/tokens/tokens.css`, icônes SVG au trait. Le contrôle
mécanique existant s'applique à tout ce qui est produit ici.

**T7 — Règle de séquencement.** Ne jamais enchaîner deux changements de
fondation (authentification, base de données, stockage, modèle de jeu) sans
avoir rejoué une partie complète entre les deux.

---

# 2. Chemin critique

## 2.1 Les deux pannes qui commandent l'ordre

Deux défauts cassent le produit aujourd'hui ; tout le reste est amélioration.

1. **Les questions du studio n'arrivent pas dans le jeu** (confirmé par
   l'utilisateur). Cause : le studio enregistre dans Supabase sans renseigner le
   propriétaire (`src/client/studio/StudioApp.jsx:303`) alors que le serveur
   relit en filtrant dessus (`src/server/supabase.js:50`). → **Action 10.**
2. **Les joueurs voient de faux résultats** à chaque reconnexion. → **Action 12.**

## 2.2 Ordre d'exécution

| Lot | Contenu | Charge |
|---|---|---|
| 0 — Le filet | Scénario de bout en bout de l'action 11, **écrit et vu échouer** | 0,5 j |
| 1 — Les deux pannes | 9 → 10 → 12 | 4,25 j |
| 2 — Le barème | 17 → 13 → 18 → 8 → 14 | 4,75 j |
| 3 — Contenu et pilotage | 16 → 2 → 6 → 15 | 6,5 j |
| 4 — Le stream | 3 + 4 + 5 ensemble | 2,75 j |
| 5 — La voix | 7 (écriture en parallèle dès la fin du lot 2) | 4,5 j |
| 6 — Clôture | 11 (fin) + 19 | 2 j |

**Chaîne la plus longue : environ 20 jours.** Les 25 jours de charge tiennent
dedans grâce au parallélisme de l'écriture de l'action 7.

## 2.3 Justification de l'ordre

- Le **lot 0** passe en premier parce que la décision est prise d'écrire le
  scénario central avant les corrections, et de le voir échouer : un contrôle
  qui n'a jamais échoué ne prouve rien.
- L'action **9 précède 10** : ouvrir un compte à Theodore n'a de sens qu'une
  fois le mot de passe en place.
- Le **lot 2 est indivisible** : ses cinq actions touchent toutes la notation ou
  sa lecture. Les séparer reviendrait à expliquer une règle qui bouge encore.
- L'action **16 précède 2** : elle prépare le menu à recevoir une liste longue
  (les jeux nommés) au lieu de quatre entrées fixes.
- L'action **6 dépend de 2** pour sa file d'attente (une file par jeu nommé).
  Ses corrections de non-répétition, elles, sont indépendantes.
- Le **lot 4 est indépendant** de tout le reste et peut se glisser où l'on veut.
- L'action **7 dépend du lot 2** (barème figé) et bénéficie du lot 4 (écrans du
  stream dans leur forme définitive).

## 2.4 Jalons

- **Après 5 jours** : le produit fonctionne — le contenu du studio se joue, les
  joueurs voient juste.
- **Après 10 jours** : la notation est cohérente et explicable en une phrase.
  Moment idéal pour une session de test avec Theodore.
- **Après 20 jours** : tout est livré sauf la voix, qui enrichit sans bloquer.

## 2.5 Session de test à deux jours

Le second compte rendu prévoit de retester sous deux jours. Périmètre proposé
pour que la session porte sur du jeu et non sur des artefacts :

- **Action 12** — sans elle, chaque test mobile produit du bruit qu'on prendra
  pour des bugs nouveaux.
- **Action 14** — une demi-journée, et l'animateur peut enfin lire ce que font
  ses joueurs pendant qu'il pilote.
- **Action 16** — deux heures, et il arrête de se battre avec son écran.

Environ deux jours au total.

---

# 3. Actions

---

## Action 1 — Édition des textes depuis le site · **MISE DE CÔTÉ**

**Origine.** CR#1 — Theodore demande à pouvoir modifier les textes des écrans
sans passer par GitHub ; R.M.A propose un mode édition sur le site.

**Décision.** L'action est **abandonnée en l'état** : trop lourde à mettre en
œuvre pour la valeur immédiate. Elle est remplacée par un fonctionnement à la
demande : sur sollicitation, produire **l'inventaire des textes en dur avec leur
contexte** (écran, état d'affichage, texte exact) ; l'utilisateur désigne les
modifications ; elles sont appliquées directement dans le code.

**Volumétrie constatée**, pour dimensionner l'inventaire le jour venu : environ
140 chaînes entre balises (joueur 37, animateur 51, stream 20, studio 31), plus
les libellés d'accessibilité, les textes de substitution et les dictionnaires de
messages d'erreur — total estimé entre 180 et 220 chaînes.

**Élément acquis pour une reprise éventuelle.** La persistance ne nécessite ni
Supabase ni politiques d'accès : le motif du stockage disque protégé par le
contrôle animateur (`src/server/store.js`, `src/server/index.js:129`) suffit et
est déjà éprouvé.

---

## Action 2 — Le module nommé devient l'unité de jeu

**Origine.** CR#1 — différence constatée entre les noms des jeux créés dans le
studio et ceux affichés en partie ; R.M.A propose une « phase de cohérence ».

**Diagnostic.** Le studio et le serveur ne parlent pas le même langage. Le studio
raisonne en modules nommés ; le serveur ne connaît que quatre mécaniques de jeu
et affiche leurs noms génériques figés (`src/server/modules.js`). L'animateur
lance un *type*, pas un jeu (`src/server/index.js:245`).

Trois conséquences, dont deux non vues en réunion :

1. Le nom ne voyage jamais jusqu'aux écrans de jeu.
2. **Sans Supabase, le nom est détruit à l'enregistrement** : la préparation de
   la sauvegarde n'garde que les questions, aplaties par type
   (`src/client/studio/StudioApp.jsx:105`). « Culture générale » redevient
   « Quiz » après rechargement.
3. **Deux modules du même type fusionnent** en un seul au rechargement.

Le menu de lancement de l'animateur ne liste même pas les modules du studio,
mais quatre types en dur (`src/client/host/HostApp.jsx:570`).

**Décisions entérinées.**

1. **Voie retenue : le module nommé devient l'unité de jeu réelle.** Le serveur
   apprend ce qu'est un jeu (identifiant, nom, type, durée, questions).
   L'animateur lance « Culture générale », pas « Quiz ».
2. **Les deux temps sont menés d'affilée** (arrêt de la destruction de données,
   puis voyage du nom jusqu'aux écrans).
3. **La pioche est restreinte au module lancé** : lancer un jeu ne tire plus que
   dans ses propres questions.
4. **Les vingt questions d'exemple sont semées une seule fois** dans le stockage
   au premier démarrage, puis deviennent de la donnée ordinaire : éditables et
   **supprimables question par question**. La fusion permanente à la pioche
   (`src/server/index.js:140`) disparaît.
5. **Un repère « semence déjà effectuée » est écrit dans le stockage**, sinon des
   questions supprimées repousseraient au redémarrage suivant.
6. **Un bouton « restaurer les questions de base »** évite qu'une suppression
   massive soit irréversible.
7. **L'écran animateur signale un module vide avant le lancement**, plutôt que
   d'échouer en direct.
8. **La conversion du fichier existant est non destructive** : l'ancien fichier
   est sauvegardé sous un autre nom avant la première écriture au nouveau
   format, et le code sait relire les deux formats.
9. **Le serveur accepte les deux formes de lancement** (par type, ancienne ; par
   identifiant de module, nouvelle) pour qu'un écran animateur non rechargé
   continue de fonctionner.
10. **Le format disque est aligné sur la forme déjà utilisée par Supabase**, pour
    n'avoir qu'une seule structure de module dans tout le projet.
11. **Le stockage disque est cloisonné par compte, un fichier par compte**
    (décision issue de l'action 10 — voir sa décision 3).

**Étapes.**
1. Arrêter de détruire les données : le fichier conserve les modules entiers ;
   le studio cesse d'aplatir et de reconstruire des noms génériques. Conversion
   automatique du fichier existant. *≈ 1 j.*
2. Faire voyager le nom : liste réelle des modules exposée, menu de lancement
   alimenté, lancement par identifiant, nom porté jusqu'aux trois écrans,
   questions piochées dans le module lancé. *≈ 1,5 j.*

**Dépendances.** Précédée de l'action 16 (menu prêt pour une liste longue).
Partage `src/server/store.js` avec l'action 10 → les deux sont menées ensemble.
Bloque la file d'attente de l'action 6.

**Impacts.** Le comportement de pioche change réellement. Le contrat réseau du
lancement d'épreuve évolue. Les tests d'affichage ne bougent pas tant qu'aucun
module n'est renommé (noms par défaut identiques au caractère près).

**Risques et mitigations.**
- *Perdre les questionnaires existants* → conversion à la lecture, sauvegarde
  préalable, relecture des deux formats.
- *Casser une partie en cours pendant la mise à jour* → double forme acceptée
  par le serveur.
- *Divergence entre les deux modes de stockage* → format disque aligné sur
  Supabase.
- *Casser les 66 tests existants* → suite rejouée à chaque étape.
- *Module vide lancé en partie* → refus explicite et signalement en amont.

**Charge : 2,75 j.**

---

## Actions 3 + 4 + 5 — Refonte de la disposition du stream

Ces trois tâches du CR#1 ont été fusionnées en un seul chantier : elles portent
sur le même écran et la décision de l'une conditionne les autres.

**Origine.** CR#1 — afficher le classement complet sur le stream ; réduire la
taille du QR code ; retirer le QR à la fin de la partie.

**Diagnostic.**
- Le classement complet **circule déjà** jusqu'au stream, sur un canal réservé à
  l'animateur et au stream (`src/server/engine.js:23`) : dix joueurs après
  chaque révélation, cinquante à la fin (`src/server/engine.js:274`). L'écran
  n'en affiche que trois (`src/client/overlay/OverlayApp.jsx:405`).
- Côté animateur la troncature est **double** : le serveur n'envoie que dix
  (`src/server/engine.js:86`) et l'écran n'affiche que cinq en pilotage direct
  (`src/client/host/HostApp.jsx:715`) ou huit sur l'écran de résultats.
- Le panneau de connexion est une colonne de 460 px sur toute la hauteur d'un
  canevas de 1920×1080 (`design/tokens/tokens.css:266`,
  `src/client/overlay/OverlayApp.jsx:504`), pour un QR de 260 px.
- Le panneau est explicitement permanent, contrat inscrit dans le code
  (`src/client/overlay/OverlayApp.jsx:8`).

**Décisions entérinées.**

1. **Chez l'animateur, le classement complet remplace la vue tronquée** — pas de
   bouton de bascule. La liste est défilable ; le premier reste en tête, donc le
   coup d'œil en direct est préservé.
2. **Le serveur cesse de tronquer**, avec une limite haute de sécurité très
   au-dessus des effectifs réels.
3. **Sur le stream, la colonne accueille le classement au podium uniquement.**
   Défilement automatique bouclé, **une seule colonne**, dimensionnée à la
   hauteur de ligne (environ quinze lignes visibles, à confirmer sur canevas
   réel).
4. **Le classement défilant part du premier**, pas du quatrième.
5. **Pendant la partie, la colonne n'existe pas** : la scène prend toute la
   largeur (1792 px utiles au lieu de 1332).
6. **Aucun nouveau canal de pilotage** : l'affichage suit l'état du jeu comme les
   autres écrans. Rien à mémoriser, aucun risque de rester bloqué dans un
   mauvais affichage en direct.
7. **Le QR passe à 180 px**, plancher assumé pour rester scannable à distance
   d'écran. Le gain de discrétion vient de la disparition de la colonne, pas du
   QR : l'emprise passe d'une colonne de 460 px pleine hauteur à une pastille
   d'environ 240 px.
8. **La pastille est ancrée en bas à gauche** — seul coin calme dans les deux
   phases (le geste lumineux est en haut pendant la question, en bas au centre
   pendant l'attente, `src/client/overlay/overlay.css:44`) et coin le moins
   utilisé par les habillages de streamers.
9. **Composition de la pastille** : QR 180 px, code du salon à 62 px (au lieu de
   104, `src/client/overlay/overlay.css:487`), adresse à 34 px. Valeurs déjà
   présentes dans l'échelle typographique du stream, aucune n'est créée.
10. **Le bloc de marque du jeu disparaît du stream.**
11. **Une zone réservée est définie en bas à gauche** : la scène n'y dessine
    jamais. Contrainte de mise en page, pas espoir de non-recouvrement.
12. **La largeur du contenu est plafonnée** pour que le gain d'espace serve la
    respiration et n'allonge pas les lignes au-delà du confort de lecture.
13. **Au podium, plus de QR — mais le code reste**, en tout petit (34 px), au
    même ancrage, **avec l'adresse du site sur la même ligne** (forme
    `adresse.fr/play · K7P2M9`) : un code seul ne dit pas où le taper.
14. **La pastille revient dès le retour au salon d'attente**, pour qu'une
    seconde partie ne soit pas privée de moyen de rejoindre.
15. **Le contrat R8 est réécrit dans le code**, avec sa nouvelle justification.
16. Les repères d'identification utilisés par les tests sur le QR et le code du
    salon sont **conservés à l'identique**.

**Étapes.**
1. Lever la troncature côté serveur. *≈ 1 h.*
2. Écran animateur : classement complet défilable, nombre total affiché. *≈ 0,5 j.*
3. Stream : la colonne accueille le classement au podium, défilement automatique
   par déplacement graphique (pas par position de défilement). *≈ 1 j.*
4. Extraire la pastille du panneau, positionner, dimensionner via valeurs
   nommées. *≈ 5 h.*
5. Conditionner la pastille à la phase, réécrire le contrat, vérifier le cycle
   complet (accueil → partie → podium → retour salon → seconde partie). *≈ 2 h.*
6. Vérifications : lisibilité à trois tailles réelles (canevas complet,
   ordinateur portable, téléphone) ; scan réel du QR à distance d'écran ; les
   quatre types de jeu dans leurs deux états (question posée, réponse révélée
   avec barres de répartition). *≈ 3 h.*

**Dépendances.** Aucune. Peut se glisser à n'importe quel moment.

**Impacts.** L'écran de stream change d'allure sur toutes les phases. Le moteur
n'est pas touché. La règle de confidentialité tient : le classement ne circule
jamais vers les téléphones des joueurs. Le test qui vérifie aujourd'hui la
présence inconditionnelle du QR devient un test de la nouvelle règle.

**Risques et mitigations.**
- *QR devenu inutilisable* (risque silencieux : personne ne signale qu'il
  n'arrive pas à scanner) → plancher à 180 px et scan réel avant validation.
- *Pastille en conflit avec l'habillage du streamer* → position et taille
  pilotées par valeurs nommées, ajustables en une ligne.
- *Tache blanche qui vole la vedette* → plaque sobre et compacte ; le contraste
  du QR lui-même n'est pas touché (fiabilité du scan prioritaire).
- *Classement illisible sur grand effectif* → défilement automatique lent et
  bouclé ; vitesse calée sur le temps de lecture d'une ligne et jugée à l'œil
  sur canevas réel.
- *Pseudo à rallonge* → troncature propre, alignée sur la limite de longueur à
  l'inscription (à vérifier).
- *Le QR ne revient pas pour la seconde partie* → vérification du cycle complet
  et test automatique du retour au salon d'attente.
- *Coût du défilement continu dans OBS* → animation par déplacement graphique.

**Charge : 2,75 j.**

---

## Action 6 — Non-répétition des questions et file d'attente

**Origine.** CR#1 — vérifier qu'une question déjà posée n'est pas reposée ;
CR#2 — permettre à l'animateur de voir et choisir la prochaine question, à la
manière d'une liste de lecture.

**Diagnostic.** Le mécanisme de non-répétition existe et fonctionne dans le cas
courant (`src/server/index.js:156`). Trois défauts néanmoins :

1. **La couverture de test est mince** : un seul contrôle, qui compare deux
   questions consécutives (`tests/integration/game-loop.mjs:160`).
2. **Répétition immédiate possible au changement de cycle** : quand la banque est
   épuisée, le code efface la liste puis pioche au hasard dans la banque
   entière — y compris la question qui vient d'être posée.
3. **Porte latérale non refermée** : une question imposée au lancement n'est pas
   enregistrée comme jouée (`src/server/index.js:250`). Défaut dormant
   aujourd'hui, réveillé le jour où une sélection manuelle existe.

Pour la file : l'écran d'attente permet déjà de **choisir quelles questions
entrent en jeu** par cases à cocher, avec un interrupteur d'ordre aléatoire
(`src/client/host/HostApp.jsx:588`). Ce qui manque, c'est l'**ordre**, décidé au
moment du lancement et n'existant nulle part avant.

**Décisions entérinées.**

1. **La liste des questions jouées est indexée sur l'identifiant de question
   seul** — plus de préfixe de type ni de module. Une question posée ne ressort
   dans aucun autre jeu de la soirée. Supprime la dépendance à l'action 2 pour
   cette partie.
2. **Répétition immédiate interdite** au changement de cycle : la question qui
   vient d'être posée est exclue du nouveau tirage.
3. **Une question imposée est enregistrée comme jouée**, exactement comme une
   question piochée.
4. **Jamais deux fois la même question dans un même salon.** La liste survit aux
   relances de partie et n'est vidée qu'à la fermeture du salon. Elle n'est donc
   plus remise à zéro par le retour au salon d'attente
   (`src/server/engine.js:259`).
5. **Conséquence assumée de la décision 4 : l'épuisement d'une banque est un
   cul-de-sac.** Le filet de recyclage disparaît. L'animateur doit donc voir
   venir la fin de sa banque bien à l'avance — ce que la file rend visible.
6. **Une file ordonnée par jeu**, construite quand le jeu entre en séance
   (mélangée ou dans l'ordre du studio selon l'interrupteur existant, dont le
   sens change : il décide de la construction initiale, plus de chaque tirage).
7. **La file est visible au lancement du jeu**, pas dans le salon d'attente.
8. **La file part uniquement vers l'écran de l'animateur** — pas sur le canal
   animateur-et-stream utilisé pour le classement. C'est la seule donnée de
   l'application qui révèle les questions **à venir** ; elle n'a rien à faire
   dans une source capturée par OBS.
9. **Réordonnancement par glisser-déposer**, implémenté sans nouvelle
   dépendance (le projet tient sur douze bibliothèques, toutes essentielles),
   fonctionnant à la souris comme au doigt.
10. **Boutons monter/descendre en complément** — pas seulement pour
    l'accessibilité : en direct, un bouton ne rate jamais sa cible.
11. **Retrait d'une question de la file possible** d'un geste.
12. **Le glisser ne part que d'une poignée dédiée**, jamais de toute la ligne, et
    un seuil de déplacement fait qu'un clic reste un clic.
13. **La question en cours est affichée hors de la file**, comme un titre en
    cours de lecture — elle ne peut pas être déplacée.
14. **Le serveur prend la tête de file de façon atomique** ; un réordonnancement
    arrivé après ne s'applique qu'au reste.
15. **La longueur de la file est l'indicateur de questions fraîches restantes** —
    rien de plus à construire.
16. **Les cases à cocher du salon d'attente sont conservées** : elles remplissent
    une autre fonction, en amont.

**Étapes.**
1. Simplifier la clé de la liste des questions jouées. *≈ 1 h.*
2. Corriger la répétition immédiate au changement de cycle. *≈ 1 h.*
3. Refermer la porte de la question imposée. *≈ 30 min.*
4. Faire survivre la liste à la relance. *≈ 30 min.*
5. Modèle de file côté serveur : construction, exposition, consommation par la
   tête, commande de réordonnancement, retrait. *≈ 1 j.*
6. Panneau de file chez l'animateur : poignée, boutons, retrait. *≈ 1 j.*
7. Fin de banque annoncée : la file montre qu'elle se vide, le lancement d'un jeu
   épuisé est refusé en le disant. *≈ 2 h.*
8. Tests : partie complète sans répétition, épuisement, question imposée,
   relance, ordre respecté, réordonnancement pendant une question en cours. *≈ 0,5 j.*

**Dépendances.** Les étapes 1 à 4 sont indépendantes. Les étapes 5 à 7 dépendent
de l'action 2 (la file est attachée à un jeu nommé).

**Impacts.** Le modèle de tirage passe d'un tirage au lancement à la consommation
d'une file établie : plus prévisible, plus testable, et la non-répétition devient
vraie par construction.

**Risques et mitigations.**
- *Se retrouver sans question en direct* → la file rend l'épuisement visible très
  à l'avance ; refus explicite plutôt que panne ; deux échappatoires (ajouter des
  questions au studio, restaurer les questions de base — action 2).
- *Glisser malencontreux en direct* → poignée dédiée et seuil de déplacement.
- *Réordonner ce qui est déjà parti* → question en cours hors de la file.
- *Course entre réordonnancement et lancement* → prise de tête atomique côté
  serveur.
- *Glisser tactile décevant sur tablette* → les boutons couvrent le besoin ; si
  la qualité n'y est pas, le glisser est retiré sans perte de fonctionnalité.
- *Banque courte rendant la répétition arithmétiquement inévitable* → problème de
  contenu, pas de code ; l'indicateur de questions fraîches le rend visible.

**Charge : 3,25 j.**

---

## Action 7 — La voix du jeu

**Origine.** CR#1 — ajouter des phrases amusantes pour les joueurs qui attendent
seuls autour du feu, étendu en discussion aux victoires, défaites, bonnes et
mauvaises réponses, résultats et podium ; CR#2 — préférer des messages
humoristiques au retrait de points, et adapter les messages selon la précision de
l'estimation.

**Diagnostic.** Le jeu est juste et froid : il annonce des faits (« Réponse
envoyée », « Position inchangée ») aux moments où le joueur ressent quelque
chose. Mais il **sait déjà** tout ce qu'il faut pour parler juste : chaque joueur
reçoit personnellement son score, ses points, le détail de sa vitesse, sa série
et ses places gagnées ou perdues (`src/server/engine.js:223`). Côté collectif,
le serveur publie le décompte par option et le total pour le quiz, le vrai/faux
et le vote (`src/server/modules.js:25`), et la cible, la moyenne, la médiane et
**la réponse la plus proche** pour l'estimation (`src/server/modules.js:130`).
**Aucune donnée n'est à créer.**

**Décisions entérinées.**

1. **Trois strates.** La *voix intime* sur le téléphone du joueur ; la *voix de
   plateau* sur le stream ; la *convention* qui fait survivre le dispositif aux
   développements futurs.
2. **Règle éditoriale maîtresse : on peut taquiner en privé, jamais en public.**
   L'écran du joueur n'est vu que par lui. Le stream commente **le groupe**,
   jamais un individu nommé — sauf au podium, où c'est pour célébrer.
3. **Environ 25 situations, 8 à 10 phrases chacune, soit ~200 phrases.**
4. **Deux mécanismes distincts.** Rotation sur les écrans à longue durée
   (attente, une phrase toutes les six secondes) ; **une seule phrase fixe**,
   choisie selon la situation, sur les écrans courts (résultats).
5. **Le titre ne bouge pas** : il donne son nom accessible à la page
   (`src/client/play/PlayApp.jsx:317`). La ligne rotative est **exclue des
   annonces vocales** — sinon un lecteur d'écran réciterait une phrase toutes les
   six secondes.
6. **Respect de la préférence « sans animation »** : le fondu devient un
   changement net, la rotation continue.
7. **Pas de répétition dans une même partie.**
8. **Jamais de phrase qui contredit les chiffres affichés à côté** : chaque
   phrase est attachée à une condition vérifiée sur les données réelles.
9. **Registre feu de camp**, chaleureux et pince-sans-rire, jamais la vanne
   appuyée. Aucun emoji.
10. **Une ligne, deux au maximum** — contrainte tenue à l'écriture, vérifiée sur
    le plus petit téléphone visé.
11. **Une phrase de repli neutre par situation**, pour le joueur arrivé en cours
    de partie : jamais d'écran muet.
12. **Le stream ne parle que sur les répartitions remarquables**, et se tait
    sinon. Le silence est une fonctionnalité.

**Seuils de « remarquable » (valeurs par défaut, réglables après observation).**

- **Préalable absolu : en dessous de cinq réponses, le stream se tait.**
- *Quiz et vrai/faux* : unanimité juste ; personne ne trouve ; piège avéré (une
  mauvaise option recueille plus de voix que la bonne) ; quasi-unanimité au-delà
  de 9/10 ; égalité parfaite entre les deux options de tête à une voix près ;
  option morte (aucune voix).
- *Vote* : consensus au-delà de 8/10 ; division (les deux premières options à une
  voix) ; option que personne n'a choisie.
- *Estimation* : moyenne du groupe à moins de 10 % de la cible ; moyenne à plus
  du double ; quelqu'un à moins de 2 % ; personne en dessous de 50 % d'écart.
- **Arbitrage** : si plusieurs conditions se déclenchent, **une seule parle**,
  selon un ordre de priorité fixé (unanimité > piège > quasi-unanimité).
- **Jamais deux manches commentées d'affilée.**

**Convention et contrôle (décision : contrôle bloquant).**

13. **Un registre unique** où chaque moment est déclaré avec sa condition et ses
    phrases. Aucune phrase perdue dans un composant.
14. **Une règle écrite dans le fichier de conventions du projet** : toute
    nouvelle surface, tout nouveau type de jeu déclare ses moments de voix.
15. **Un contrôle mécanique bloquant**, dans la suite de tests : chaque type de
    jeu déclaré côté serveur possède son jeu de phrases ; chaque moment déclaré a
    au moins une phrase ; chaque phrase respecte les contraintes (pas d'emoji,
    longueur tenue, repères dynamiques présents). Les routes étant énumérées à un
    seul endroit (`src/client/main.jsx:21`), **une route ajoutée sans entrée au
    registre fait aussi échouer le contrôle.**
16. **Le contrôle exige une déclaration, pas une œuvre** : une phrase de repli
    suffit à passer, pour ne jamais bloquer un travail en cours.
17. **Limite honnête assumée** : le contrôle garantit qu'une déclaration existe,
    jamais qu'elle est bonne. La qualité reste affaire de relecture.
18. **Livraison en trois vagues** : moments fréquents (chaque manche) → moments
    propres à chaque type de jeu (écarts d'estimation, pourcentages de vote,
    répartitions du stream) → moments rares (fin de classement). Chaque vague est
    utilisable seule.

**Ajustements imposés par les décisions transversales.**

- La situation « mauvaise réponse qui coûte des points » **sort de la carte** (T1).
  La voix prend le relais : encourager plutôt que sanctionner.
- Les séries ne rapportant plus de points (T3), **la reconnaissance devient leur
  seule récompense** — ce qui rend la voix d'autant plus nécessaire.
- Le vote devenant un jeu (action 18), il **gagne des situations** : être seul de
  son avis, faire partie d'une majorité écrasante, voir la salle se couper en deux.
- La suppression du bouton « Rejouer » (action 15) crée un moment à commenter :
  « reste là, ça repart ».

**Étapes.**
1. Cartographie des moments, conditions, registre, convention et contrôle. *≈ 1 j.*
2. Écriture des ~200 phrases. *≈ 1,5 à 2 j.*
3. Câblage côté joueur. *≈ 0,5 j.*
4. Câblage côté stream. *≈ 0,5 j.*
5. Vérification sur vrai téléphone et sur canevas de stream. *≈ 0,5 j.*

**Dépendances.** Dépend du lot 2 (barème figé : actions 17, 13, 18, 8) et
bénéficie du lot 4 (écrans du stream définitifs). **L'écriture se mène en
parallèle du code** — c'est le principal levier du calendrier.

**Impacts.** Aucun sur le moteur, le réseau ou les scores. Le projet gagne une
convention permanente et un contrôle de plus : chaque futur jeu coûtera un peu
plus cher à écrire. C'est le prix assumé de la demande.

**Risques et mitigations.**
- *Humilier un joueur* → règle privé/public ; relecture de toutes les phrases
  d'échec avec la question « est-ce que je dirais ça en face à quelqu'un qui vient
  de rater ? ».
- *Marcher sur les pieds de l'animateur* (commenter la répartition est son métier)
  → le stream ne parle que sur le remarquable, et se tait le reste du temps.
- *Usure* → répartir le volume selon la fréquence réelle, pas uniformément.
- *Phrase qui ment* → conditions vérifiées sur données réelles ; protégé par le
  contrôle mécanique.
- *Phrase trop longue pour le temps d'écran* → une ligne, deux au maximum.
- *Contrôle qui devient un frein* → il exige une déclaration minimale.
- *Chantier qui s'étale* → trois vagues indépendamment livrables ; après la
  première, le jeu est déjà transformé.

**Charge : 4,5 j.**

---

## Action 8 — Barème énoncé, panneau de correction supprimé

**Origine.** CR#1 — griser ou retirer l'affichage des bonus et malus tant qu'une
règle claire n'est pas définie.

**Diagnostic.** Trois objets distincts portaient le même nom.

1. **Le barème automatique** existe et ses règles sont définies
   (`src/server/engine.js:12`). Il n'est simplement **énoncé nulle part** — d'où
   l'impression d'arbitraire.
2. **Un panneau sur l'écran animateur, littéralement intitulé « Bonus / Malus »**
   (`src/client/host/HostApp.jsx:830`), avec des boutons ± 100 points par joueur.
   Celui-là n'a effectivement aucune règle.
3. **Des pouvoirs spéciaux à ajouter**, évoqués en réunion — n'existent pas dans
   le code.

Theodore a vu le deuxième et pensait au troisième.

**Décisions entérinées.**

1. **Le barème automatique est conservé et enfin énoncé** au joueur, en un
   endroit court et discret, atteignable pendant l'attente. Le retirer aplatirait
   le jeu.
2. **Le panneau de l'animateur est supprimé complètement** : l'écran
   (`src/client/host/HostApp.jsx:830`), la commande serveur
   (`src/server/index.js:262`), la fonction du moteur
   (`src/server/engine.js:239`) et la ligne du test d'intégration qui s'en sert
   (`tests/integration/game-loop.mjs:137`).
3. **Conséquence assumée** : plus aucun moyen de rattraper un score en direct si
   un téléphone plante.
4. **Aucune trace des corrections** n'est mise en place, puisque la fonction
   disparaît.
5. **Les pouvoirs spéciaux restent hors périmètre**, explicitement. Le jour où
   ils seront définis, ce sera une action neuve.
6. **L'énoncé doit refléter le barème final** issu des actions 17, 13 et 18 et
   de la décision transversale T1 (aucune pénalité). Il est donc écrit **après**
   elles.

**Étapes.**
1. Supprimer le panneau et ses trois points d'ancrage, ajuster le test. *≈ 2 h.*
2. Énoncer le barème au joueur. *≈ 3 h.*
3. Vérifier la cohérence de vocabulaire entre le barème, le détail des points
   affiché après chaque manche, et le nouvel énoncé. *≈ 1 h.*

**Dépendances.** Doit venir **après** les actions 17, 13 et 18.

**Impacts.** Aucun changement de score, aucun changement de moteur. Le jeu se
comporte pareil ; il s'explique enfin.

**Risques et mitigations.**
- *Aller contre la lettre de la réunion* (qui disait « griser ») → assumé et
  arbitré : masquer un affichage tout en continuant à compter les points en
  douce aurait été le pire des trois choix.
- *Énoncé qui alourdit un écran volontairement épuré* → non affiché en
  permanence, atteignable depuis l'attente.

**Charge : 0,5 j.**

---

## Action 9 — Connexion par mot de passe et masquage de l'adresse

**Origine.** CR#1 — cacher l'adresse mail sur l'écran animateur ; préférer une
connexion par mot de passe à l'envoi de liens, notamment à cause d'une limite du
nombre de liens par jour.

**Diagnostic.** La connexion se fait par lien envoyé par mail
(`src/client/host/HostApp.jsx:236`). L'adresse s'affiche en clair à trois
endroits, dont la barre d'accueil (`src/client/host/HostApp.jsx:363`). La limite
de liens vient du service d'envoi intégré à Supabase, bridé sur les offres
gratuites — contrainte du fournisseur, pas erreur de configuration.

**Point décisif** : la vérification côté serveur est **indifférente au mode de
connexion** (`src/server/auth.js:58`). Elle valide une session, peu importe
comment elle a été obtenue. Passer au mot de passe ne touche pas une ligne de
cette mécanique.

**Ce que le masquage protège vraiment** : non pas un voisin qui lirait l'écran,
mais **l'écran animateur qui passe à l'antenne**. Le système de design a déjà une
couleur réservée à ce que le public ne doit pas voir.

**Décisions entérinées.**

1. **Abandon complet du lien par mail** au profit du mot de passe. Garder les deux
   doublerait les chemins d'entrée pour aucun gain.
2. **Réinitialisation par mail conservée en secours** — même envoi bridé, mais en
   cas d'oubli seulement, pas à chaque connexion.
3. **Adresse masquée avec dévoilement temporaire** sur la barre d'accueil, façon
   application bancaire. L'animateur doit pouvoir vérifier sous quel compte il est.
4. **Pas de masquage sur l'écran de refus.**
5. **L'écran de refus est conservé mais reformulé.** Après le passage au mot de
   passe avec inscription fermée, il devient atteignable dans un seul cas : un
   compte légitimement créé mais absent de la liste autorisée côté serveur. Son
   texte actuel (`src/client/host/HostApp.jsx:323`) sera faux sur deux points — il
   ne s'agira plus d'un seul compte, et la cause ne sera plus une intrusion mais
   un oubli de configuration. **Il doit nommer la cause probable et dire quoi faire.**
6. **L'inscription est fermée côté Supabase**, et c'est **vérifié**, pas supposé.
7. **La création des comptes revient à l'utilisateur**, dans l'interface Supabase.
   Aucun compte n'est créé et aucun mot de passe n'est saisi côté implémentation.
8. **Les messages d'erreur existants** (`src/client/shared/authErrors.js`), qui
   parlent d'envoi de lien, sont réécrits pour parler de mot de passe.

**Étapes.**
1. Masquer l'adresse avec dévoilement temporaire. *≈ 2 h.*
2. Remplacer la connexion par lien par une connexion par mot de passe ; l'écran
   « va voir tes mails » disparaît. *≈ 3 h.*
3. Ajouter le chemin de réinitialisation. *≈ 2 h.*
4. Vérifier le verrouillage : inscription fermée, adresse non autorisée refusée,
   session expirée bien traitée, limitation des tentatives constatée. *≈ 1 h.*

**Dépendances.** Précède obligatoirement l'action 10.

**Impacts.** L'écran de connexion change d'aspect et de parcours. Le serveur
n'est pas touché.

**Risques et mitigations.**
- *Mot de passe faible ou partagé* → exigence de longueur minimale côté Supabase ;
  deux comptes distincts plutôt qu'un compte partagé (action 10).
- *Inscription libre laissée ouverte* → fermeture explicite et vérifiée (étape 4).
- *Mot de passe oublié juste avant un direct* → réinitialisation, et deux comptes
  distincts permettant à l'un de prendre la main.
- *Tentatives répétées* → limitation Supabase vérifiée plutôt que supposée.

**Charge : 1 j.**

---

## Action 10 — Deux comptes animateur, cloisonnement, migrations

**Origine.** CR#1 — R.M.A indique que seule son adresse fonctionne et qu'il
ajoutera celle de Theodore. Formulé comme une ligne de configuration ; c'est une
question de modèle.

**Diagnostic.**
- La variable d'adresse autorisée est une **chaîne unique**, comparée par égalité
  stricte (`src/server/config.js:17`, `src/server/index.js:63`). Elle sert aussi
  de drapeau « verrou actif » en production (`src/server/auth.js:95`).
- Les questions Supabase sont **déjà filtrées par propriétaire**
  (`src/server/supabase.js:50`). Le stockage disque, lui, **n'est pas cloisonné**
  (`src/server/store.js`) : une banque unique, partagée.
- Les salons sont **déjà parfaitement cloisonnés** : un salon appartient à son
  créateur (`src/server/rooms.js:34`), l'animateur n'est reconnu que sur le sien
  (`src/server/index.js:200`), les codes sont uniques par construction
  (`src/server/rooms.js:35`), un joueur reçoit un jeton limité à un salon. Deux
  animateurs peuvent animer **en même temps** sans se voir. Limite à connaître :
  **un animateur n'a qu'un salon actif à la fois** (`src/server/rooms.js:37`).
- **Anomalie confirmée par l'utilisateur** : le studio enregistre dans Supabase
  **sans renseigner le propriétaire** (`src/client/studio/StudioApp.jsx:303`)
  alors que le serveur relit en filtrant dessus. En mode Supabase, les questions
  du studio ne sont donc jamais jouées ; seules les questions d'exemple
  alimentent la partie. **C'est cette action qui répare le lien, pas l'action 2** :
  le chemin disque, lui, fonctionne déjà.
- `supabase/migrations/` est **vide** (`docs/SECURITY-AUDIT-v1.md:194`, finding
  F-006) : les tables ont été créées à la main, rien ne garantit leur forme.

**Décisions entérinées.**

1. **Liste d'adresses autorisées**, séparées par des virgules, **en conservant le
   nom de variable actuel** : une seule adresse reste une liste d'un élément, et
   rien ne change dans la configuration de déploiement au-delà de la valeur. Le
   drapeau « verrou actif » devient « liste non vide ».
2. **Deux bibliothèques différentes** — pas de partage entre les deux comptes.
3. **Le stockage disque est cloisonné par compte, avec un fichier par compte** —
   et non un fichier unique contenant les deux. Raison : le fichier est réécrit
   en entier à chaque enregistrement (`src/server/store.js:39`) ; deux studios
   qui enregistrent en même temps s'écraseraient mutuellement.
4. **Renoncement au pilotage du même salon à deux.** La reprise de salon en cas
   de panne pourra être traitée plus tard, pour ce qu'elle est.
5. **L'écran de refus est reformulé** (voir action 9, décision 5).
6. **Le chantier F-006 est traité dans la foulée** : migrations des tables,
   activation des règles d'accès, une politique par opération, index, et
   **correction du rattachement au propriétaire**.
7. **Constat préalable de l'état réel des tables Supabase autorisé** avant
   d'écrire les migrations.
8. **Pas de branche d'essai Supabase.**
9. **Migrations additives et rejouables, jamais destructives** sur une base
   contenant les questionnaires.
10. **Les politiques sont écrites et vérifiées AVANT activation** des règles
    d'accès — jamais l'inverse.
11. **Le serveur utilise une clé de service qui contourne les règles d'accès** :
    les activer ne peut donc pas casser le jeu en cours de partie. C'est le
    studio, qui parle à Supabase depuis le navigateur, qui y sera soumis.
12. **Theodore ne démarrera pas sur une bibliothèque vide** : les vingt questions
    de base semées à l'action 2 le sont pour chaque compte.

**Étapes.**
1. Liste d'adresses autorisées. *≈ 1 h.*
2. Cloisonner le stockage disque par compte, un fichier par compte — **mené avec
   l'action 2**, qui réécrit le même fichier. *≈ 3 h.*
3. Reformuler l'écran de refus. *≈ 30 min.*
4. Constater l'état réel des tables, puis écrire les migrations : tables, règles
   d'accès, politiques, index, rattachement au propriétaire. *≈ 1 j.*
5. Vérifier à deux comptes : chacun se connecte, chacun ne voit que sa
   bibliothèque, chacun ouvre son salon, **et une question enregistrée dans le
   studio est réellement jouée en partie**. *≈ 1 h.*

**Dépendances.** Après l'action 9. L'étape 2 est menée avec l'action 2.

**Impacts.** Le projet gagne enfin des migrations : une définition écrite et
reproductible de sa base, condition posée par l'audit avant tout déploiement avec
Supabase.

**Risques et mitigations.**
- *Écrire des migrations sans connaître l'état réel de la base* → constat
  préalable (décision 7), migrations additives et rejouables.
- *Activer les règles d'accès et bloquer le studio* → politiques écrites et
  vérifiées avant activation.
- *Découvrir que les questions du studio n'étaient jamais jouées* → confirmé ;
  l'étape 5 le prouve dans un sens ou dans l'autre.
- *Deux bibliothèques qui divergent avec le temps* → aucune mitigation technique ;
  décision assumée, signalée pour qu'elle ne soit pas découverte plus tard.
- *Oubli de configuration lors de l'ajout d'un compte* → l'écran de refus
  reformulé nomme la cause probable.

**Charge : 2 j.**

---

## Action 11 — Vérification de bout en bout

**Origine.** CR#1 — R.M.A évoque une « phase de cohérence » et une « phase de
vérification à venir » sur le studio.

**Diagnostic.** Le projet a onze vérifications de bout en bout (`tests/e2e/`) :
connexion animateur, arrivée du joueur, déroulé d'une partie, écran de stream, et
trois sur le studio. **Aucune ne relie les deux** : il n'existe pas une seule
vérification qui enregistre une question dans le studio puis contrôle qu'elle est
posée en partie. C'est précisément le maillon cassé, et personne ne l'a vu parce
que rien ne le regardait.

**Décisions entérinées.**

1. **Le scénario central est écrit d'abord, et vu échouer**, avant toute
   correction : créer un jeu nommé dans le studio, y mettre une question
   reconnaissable, enregistrer, ouvrir un salon, lancer ce jeu, vérifier que
   c'est bien cette question qui apparaît, sous ce nom-là, sur le téléphone du
   joueur et sur le stream.
2. **Le scénario tourne dans les deux modes de stockage**, disque et Supabase —
   c'est la différence entre les deux qui a masqué le problème.
3. **Vérification automatique complète du mode Supabase, avec une base dédiée aux
   tests.**
4. **Pas de liste de contrôle manuelle.** Conséquence : les vérifications qu'aucune
   machine ne peut faire — le QR qui se scanne vraiment, la vitesse de défilement
   lisible, le ton des phrases, la tenue sur petit téléphone — **retombent sur
   l'implémentation, une fois, comme étapes des actions concernées**, et non
   comme protocole rejouable.
5. **Les vérifications découlant des décisions sont ajoutées au fil de chaque
   action**, pas entassées à la fin.

**Vérifications à couvrir** (au-delà du scénario central) : deux jeux du même
type qui ne fusionnent plus ; une question supprimée qui ne revient pas ; la file
qui respecte l'ordre imposé ; aucune question reposée dans un salon ; deux comptes
qui ne voient pas la bibliothèque l'un de l'autre ; une barre à 30 % qui mesure
30 % ; une reconnexion en cours de manche et après révélation ; le cycle podium
puis relance sans intervention du joueur ; la non-superposition des paliers
d'estimation.

**Étapes.**
1. Le scénario du bout en bout, dans les deux modes. *≈ 0,5 j.* **(lot 0)**
2. Les vérifications découlant des décisions, au fil de l'eau. *≈ 0,5 j cumulé.*
3. Rassemblement final et base de test dédiée pour le mode Supabase. *≈ 0,5 j.*

**Dépendances.** L'étape 1 passe **avant tout le reste**. L'étape 3 vient en
dernier.

**Risques et mitigations.**
- *Vérification écrite après coup, à l'image de ce qu'on a construit* → le
  scénario central s'écrit avant les corrections et doit être **vu échouer**.
- *Mode Supabase difficile à automatiser* → base dédiée aux tests (décision 3).

**Charge : 1,5 j.**

---

## Action 12 — Restitution des résultats au joueur

**Origine.** CR#2 — « manche jouée sans toi » affiché alors que le joueur a
participé ; score individuel qui ne reflète pas la réalité ; sur mobile, écrans
de résultats erronés et malus inexpliqués, apparaissant et disparaissant de façon
aléatoire.

**Diagnostic — ce n'est pas quatre bugs, c'en est un seul.**

**Quand un joueur se reconnecte, le serveur lui rejoue la question et la
révélation, mais jamais son résultat personnel** (`src/server/index.js:229`).
Or l'écran de résultat décide de ce qu'il affiche uniquement sur la présence de
cette donnée (`src/client/play/PlayApp.jsx:554`). Absente, il conclut que le
joueur est arrivé après le lancement.

Le reste en découle :
- **Score désynchronisé** : le classement est recalculé par le serveur, le score
  du téléphone est une copie locale que la reconnexion ne rafraîchit jamais.
- **Malus inexpliqués** : au lancement d'une nouvelle manche, le client remet à
  zéro la question, la révélation et la répartition — **mais pas le résultat
  personnel** (`src/client/shared/useGame.js:43`). Le bonus et le malus de la
  manche précédente survivent à l'écran.
- **Pourquoi seulement sur mobile, de façon aléatoire** : Safari iOS suspend les
  onglets en arrière-plan et coupe les connexions temps réel. Chaque verrouillage
  d'écran provoque une reconnexion. Un joueur mobile déclenche le défaut plusieurs
  fois par partie ; un joueur sur ordinateur presque jamais.

Point déjà sain : le jeton du joueur est conservé localement
(`src/client/play/PlayApp.jsx:885`) — une actualisation ne crée pas de doublon et
ne redemande pas le pseudo.

**Décisions entérinées.**

1. **Le serveur mémorise le dernier résultat de chaque joueur**, rattaché à la
   manche qui l'a produit. Il le calcule déjà puis le jette
   (`src/server/engine.js:204`).
2. **Il le rejoue à la reconnexion**, **et seulement s'il correspond à la manche
   en cours** — sinon on recréerait le bug qu'on corrige.
3. **Le client purge les données de manche** au démarrage d'une nouvelle, en ne
   conservant que le score cumulé.
4. **Trois situations à l'écran** au lieu de deux : tu as répondu et voici ton
   résultat ; tu as répondu et le résultat n'est pas encore tombé ; tu n'étais pas
   là pour cette manche. Le serveur transmet déjà l'information nécessaire
   (`src/server/index.js:239`), personne ne s'en sert.
5. **Un joueur arrivé après le lancement se voit dire clairement qu'il n'était pas
   là**, avec son score et sa position — et **non** les résultats de la manche
   précédente : lui présenter les résultats d'une question qu'il n'a jamais vue
   serait plus déroutant qu'utile.
6. **Pas de session de test sur iPhone réel côté implémentation** : l'utilisateur
   teste de toute façon. La vérification automatique **simule une vraie coupure de
   connexion**, pas un simple rechargement — c'est elle qui prouve la correction.

**Étapes.**
1. Mémoriser le résultat par joueur, rattaché à sa manche. *≈ 2 h.*
2. Le rejouer à la reconnexion, sous condition de correspondance. *≈ 2 h.*
3. Purger les données de manche côté client. *≈ 1 h.*
4. Les trois situations à l'écran, avec un message juste pour chacune. *≈ 3 h.*
5. Vérifications, dont déconnexion/reconnexion en cours de manche puis après
   révélation. *≈ 3 h.*

**Dépendances.** Aucune. **Priorité haute** : c'est le défaut qui abîme le plus
l'expérience du joueur.

**Impacts.** C'est une correction, pas une évolution : aucun score recalculé,
aucune règle changée.

**Risques et mitigations.**
- *Rejouer un résultat périmé* → le résultat porte l'identifiant de sa manche.
- *Croire que c'est réglé parce que ça marche sur ordinateur* → la vérification
  simule une vraie coupure.
- *Reconnexions en rafale sur mobile* → vérifier qu'aucun doublon ni double
  comptabilisation n'est possible, plutôt que de le supposer.
- *Bugs mobiles d'une autre nature subsistant* → l'action n'est pas fermée sur la
  seule foi du diagnostic ; ce qui resterait fera l'objet d'une action distincte
  dûment décrite.

**Charge : 1,25 j.**

---

## Action 13 — Estimation : paliers de précision et histogrammes

**Origine.** CR#2 — la base de calcul reste parfois bloquée, une très bonne
réponse ne rapporte pas plus qu'une approximative, les écarts de points ne
représentent pas la précision. Theodore rappelle que le système devait
fonctionner par plages de précision (10 %, 20 %, 30 %). Demande également de
revoir « le graphique d'affichage ».

**Diagnostic — trois défauts.**

La formule multiplie 1000 points par une justesse linéaire et par un facteur de
vitesse (`src/server/modules.js:128`).

1. **La précision rapporte très peu** : sur une cible de 100, répondre exactement
   rapporte à peine 11 % de plus que répondre 90.
2. **La vitesse pèse plus lourd que la précision.** Le facteur de vitesse fait
   varier de 15 %, l'écart exact/10 % de 11 %. Concrètement : **une réponse
   exacte mais tardive vaut 850 points, une réponse à 10 % près mais immédiate en
   vaut 900.** Le plus juste perd contre le plus rapide — l'inversion de ce que
   le jeu prétend récompenser.
3. **Le comportement dépend de la taille du nombre.** L'écart est mesuré en
   proportion de la cible : sur une cible d'un million, se tromper de cent mille
   compte pour 10 %, tout le monde décroche presque le maximum et les scores se
   tassent — la « base bloquée ». Sur une cible de 3, répondre 6 vaut zéro.

**Point de la discussion non confirmé par le code** : aucun mécanisme ne pénalise
une réponse trop rapide. La vitesse ne fait qu'ajouter. La perte de points
évoquée vient soit du malus de mauvaise réponse (supprimé par T1), soit du
deuxième défaut vécu à l'envers.

**Sur le graphique** : la maquette animateur en direct
(`design/claude-design/A5.html:374`) spécifie un **histogramme à huit barres**
pour la répartition numérique, avec minimum, moyenne, maximum et total, dans la
zone réservée à l'animateur. **Il n'a jamais été construit** : l'écran affiche
trois chiffres (`src/client/host/HostApp.jsx:649`), et le serveur **ne calcule
même pas les tranches** (`src/server/engine.js:52`). Aucun histogramme n'a jamais
été dessiné dans les maquettes joueur — cohérent avec le principe rappelé en
réunion : le joueur ne doit pas voir la répartition.

**Décisions entérinées.**

1. **Paliers de précision** : ≤ 2 % → 100 % des points ; ≤ 10 % → 75 % ;
   ≤ 20 % → 50 % ; ≤ 30 % → 25 % ; **au-delà de 30 % → zéro**.
2. **Aucune composante de rapidité sur l'estimation.** Ni supplément du plus
   rapide, ni modulation à l'intérieur du palier : les points ne dépendent que de
   la justesse. Les points d'un palier sont donc une valeur fixe — 1000, 750,
   500, 250 ou 0. Motif : l'estimation est le seul module où la précision est le
   sujet ; y récompenser la vitesse, même marginalement, rouvrait le défaut que
   l'action corrige. Le facteur de vitesse actuel de la formule
   (`src/server/modules.js:128`) disparaît entièrement.
   **Conséquence sur T2** : l'estimation rejoint le vote parmi les modules sans
   complément de vitesse ; l'écran du joueur n'affiche donc qu'une ligne de base
   sur ce module, conformément à la décision 8 de l'action 17.
3. **La non-superposition des paliers devient absolue** — les valeurs étant
   discrètes, aucune réponse d'un palier inférieur ne peut approcher un palier
   supérieur. La propriété reste **testée mécaniquement**, pour qu'aucune
   évolution future ne la rouvre.
4. **Le seuil « bonne réponse » pour la série reste à 10 %.**
5. **Tolérance absolue en plus de la tolérance relative** : être à une unité près
   compte comme le meilleur palier. Règle les petits nombres sans rien changer
   aux grands.
6. **Les paliers donnent leur condition aux messages de feedback** de l'action 7 :
   un message par plage, « bien joué » réservé aux deux premières. (Résout la
   troisième tâche du CR#2 pour la logique ; l'écriture est à l'action 7.)
7. **Les tranches sont calculées côté serveur.**
8. **Histogramme conforme à la maquette A5 sur l'écran animateur**, avec la bonne
   réponse marquée sur le graphique.
9. **Histogramme sur le stream à la révélation.**
10. **Pas d'histogramme chez le joueur** : il garde sa comparaison à deux cases
    (`src/client/play/play.css:558`).
11. **Les valeurs aberrantes sont ramenées dans les barres d'extrémité** plutôt
    que d'étirer l'échelle — sinon un plaisantin qui tape un nombre absurde
    efface la répartition réelle.
12. **Tests sur une cible d'un million et sur une cible à un chiffre**, pas sur un
    cas moyen confortable.

**Étapes.**
1. Nouvelle échelle par paliers, suppression complète du facteur de vitesse. *≈ 3 h.*
2. Exposer le palier atteint au client, pour l'affichage et les messages. *≈ 2 h.*
3. Calculer les tranches côté serveur. *≈ 2 h.*
4. Histogramme sur l'écran animateur, conforme à la maquette. *≈ 4 h.*
5. Histogramme sur le stream à la révélation. *≈ 4 h.*
6. Tests : non-superposition, très grands et très petits nombres, valeurs
   aberrantes. *≈ 3 h.*

**Dépendances.** Après l'action 17 (décomposition base + complément). Alimente
l'action 7.

**Impacts.** Le barème de l'estimation change : les scores ne seront plus
comparables à ceux d'avant. C'est le but. Le module devient le seul dont la
notation est explicable en une phrase.

**Risques et mitigations.**
- *Petits nombres maltraités* → tolérance absolue (décision 5).
- *Réponse hors plage qui ne rapporte rien* → assumé (décision 1) ; la voix du jeu
  prend le relais pour ne pas décourager.
- *Histogramme illisible à cause d'une valeur aberrante* → décision 11.
- *Croire que c'est réglé sans éprouver les cas extrêmes* → décision 12.

**Charge : 2,25 j.**

---

## Action 14 — Jauge et couleurs de la répartition (écran animateur)

**Origine.** CR#2 — la jauge d'animation n'est pas correctement affichée sur
l'écran animateur pour le vrai/faux ; la couleur de la mauvaise réponse devrait
être améliorée, elle ne doit pas se remplir en rouge.

**Diagnostic — un seul défaut, deux symptômes, plus un troisième non signalé.**

Le système de design pose un contrat explicite : l'animation pousse la barre de
zéro jusqu'à une valeur nommée, **« à piloter par `--om-to` côté intégration »**
(`design/tokens/tokens.css:324`, `:331`). Toutes les maquettes la renseignent.
L'écran de stream la renseigne (`src/client/overlay/OverlayApp.jsx:225`).

**L'écran animateur ne la renseigne pas** (`src/client/host/HostApp.jsx:689`) :
il fixe la largeur en ligne sans fournir la valeur d'arrivée. L'animation retombe
sur sa valeur par défaut (100 %) et, conservant son état final
(`src/client/host/host.css:649`), **écrase la largeur réelle : toutes les barres
finissent pleines.**

- **Jauge illisible** : deux barres pleines côte à côte ne disent rien — d'où
  l'évidence du défaut sur le vrai/faux, qui n'en a que deux.
- **Mauvaise réponse « en rouge »** : à la révélation, les barres non gagnantes
  passent en teinte de braise (`src/client/host/host.css:651`) ; pleines sur toute
  la largeur, elles se lisent comme une sanction.
- **Troisième défaut non signalé** : la largeur est calculée par rapport à
  **l'option la plus choisie**, pas au total (`src/client/host/HostApp.jsx:678`).
  L'option de tête est donc toujours à 100 %, alors que l'étiquette à côté affiche
  un pourcentage du total. Les maquettes, elles, dimensionnent par rapport au total.

Le défaut est **propre à l'écran animateur** — le stream respecte le contrat, ce
qui colle au compte rendu.

**Décisions entérinées.**

1. **Rétablir le contrat d'animation** : fournir la valeur d'arrivée.
2. **Dimensionner par rapport au total**, pour que la barre et son étiquette
   racontent la même chose.
3. **Conserver la braise pour la mauvaise réponse** — écart volontaire par
   rapport aux maquettes, qui prévoyaient un neutre de bois. Justification : la
   plainte portait sur une barre qui se remplissait entièrement, pas sur la
   teinte ; une fois la largeur juste, la braise redevient une couleur de la
   palette et non un verdict. Reste dans les familles de couleurs autorisées,
   donc le contrôle du système de design ne s'y oppose pas.
4. **Balayer le reste de l'application dans la foulée**, à la recherche d'autres
   barres qui auraient oublié la même valeur.
5. **L'étiquette chiffrée reste affichée même sans barre** : une option à zéro
   n'aura plus de barre, mais on lira toujours « 0 · 0 % ».

**Étapes.**
1. Rétablir le contrat d'animation. *≈ 1 h.*
2. Dimensionner par rapport au total. *≈ 30 min.*
3. Vérifier le rendu de la braise à la révélation avec la largeur corrigée. *≈ 30 min.*
4. Balayage de l'application. *≈ 1 h.*
5. Vérifier les trois modules à barres, en direct puis à la révélation. *≈ 2 h.*

**Dépendances.** Aucune. **Candidate à la session de test à deux jours.**

**Impacts.** Uniquement visuel, uniquement sur l'écran animateur. L'animateur
récupère une lecture fiable de ce que font ses joueurs — l'outil dont il a besoin
pour décider quand révéler.

**Risques et mitigations.**
- *Même oubli ailleurs, non détecté* → balayage (décision 4) et vérification
  automatique qu'une barre à 30 % mesure bien 30 %, ce qu'aucun test ne fait
  aujourd'hui.
- *Barre à zéro devenue invisible* → étiquette chiffrée conservée (décision 5).

**Charge : 0,5 j.**

---

## Action 15 — Suppression du bouton « quitter »

**Origine.** CR#2 — supprimer le bouton « quitter » pour les joueurs, jugé
inutile et source de confusion, afin d'éviter les problèmes de reconnexion et de
noms déjà utilisés.

**Diagnostic.** Le bouton **n'efface que la session locale, sans prévenir le
serveur** (`src/client/play/PlayApp.jsx:937`). Le joueur reste inscrit dans le
salon avec son pseudo et son score, mais a perdu le jeton qui lui permettait d'y
revenir. S'il tente de rejoindre avec le même pseudo, le serveur le refuse
(`src/client/play/PlayApp.jsx:144`) — son pseudo est occupé par lui-même.

**Le bouton « Rejouer » de l'écran de fin appelle exactement la même fonction**
(`src/client/play/PlayApp.jsx:867`, `:980`) : le bouton qui promet de rejouer est
celui qui empêche de rejouer.

**Le bouton n'a aucun usage légitime** : la session est déjà rattachée à un salon
précis, donc rejoindre une autre partie ne demande pas de quitter la première ;
fermer l'onglet suffit ; une session périmée est purgée toute seule
(`src/client/play/PlayApp.jsx:901`).

**Décisions entérinées.**

1. **Suppression du bouton « quitter »** sur les trois écrans où il apparaît.
2. **Suppression du bouton « Rejouer »** et de sa fonction destructrice.
3. **Après le podium, le joueur ne fait rien et attend** : quand l'animateur
   relance, le serveur ramène tout seul les joueurs au salon d'attente. Une phrase
   suffit à le dire — l'un des premiers endroits où la voix du jeu (action 7) aura
   quelque chose à dire.
4. **Le changement de pseudo en cours de partie est écarté définitivement** — le
   besoin n'existera pas.

**Étapes.**
1. Retirer le bouton des trois écrans. *≈ 30 min.*
2. Neutraliser « Rejouer », le remplacer par un message. *≈ 1 h.*
3. Vérifier les tests s'appuyant sur ces actions ; couvrir le cycle podium puis
   relance sans intervention du joueur. *≈ 1 h.*

**Dépendances.** Aucune. **Fiabilise l'action 12** : moins il existe de moyens de
perdre sa session, moins il y a de chemins vers la désynchronisation.

**Risques et mitigations.**
- *Joueur qui se sent enfermé* → il ne l'est pas ; c'est une page web, fermer
  l'onglet suffit.
- *Tests s'appuyant sur les boutons supprimés* → étape 3, avec un remplacement
  bien plus utile.

**Charge : 0,3 j.**

---

## Action 16 — Menu « changer de module » sans défilement

**Origine.** CR#2 — demander que la fenêtre modale s'ouvre au-dessus de la page
sans défilement pour l'animateur lors du changement de module.

**Diagnostic.** Le menu est **déjà** une surcouche positionnée en absolu
au-dessus du reste (`src/client/host/host.css:790`). Le problème est la
**direction** : il se déploie vers le bas à partir d'un bouton situé dans la
barre d'actions, tout en bas de l'écran (`src/client/host/HostApp.jsx:855`,
`src/client/host/host.css:728`). Il part donc sous le pied de la page.

**Décisions entérinées.**

1. **Ouverture vers le haut.** La barre d'actions est structurellement le dernier
   élément de l'écran : il y a toujours de la place au-dessus. Comportement
   prévisible, ce qui compte en direct.
2. **Pas de vraie fenêtre modale centrée**, malgré le mot du compte rendu : elle
   masquerait la répartition et le classement au moment précis où l'animateur
   fonde son choix dessus.
3. **Hauteur bornée avec défilement interne**, en prévision de l'action 2 : le
   menu listera les jeux réels de Theodore (potentiellement dix ou quinze) au lieu
   de quatre types. Faire défiler une liste dans un menu est normal ; faire
   défiler la page ne l'est pas.
4. **Pas de fermeture par la touche d'échappement.**
5. **Le second menu de l'écran animateur** (`src/client/host/HostApp.jsx:128`)
   est vérifié et corrigé de la même façon s'il en a besoin.
6. **La liste laisse deviner qu'elle continue** — une entrée coupée en bas plutôt
   qu'une coupure nette.

**Étapes.**
1. Inverser le sens d'ouverture. *≈ 30 min.*
2. Hauteur bornée avec défilement interne. *≈ 30 min.*
3. Vérifier et corriger le second menu. *≈ 30 min.*

**Dépendances.** **Précède l'action 2** : le menu doit savoir gérer une liste
longue avant qu'on la lui donne. **Candidate à la session de test à deux jours.**

**Charge : 0,2 j.**

---

## Action 17 — Lisibilité du calcul des points

**Origine.** CR#2 — le multiplicateur de série n'apporte pas toujours le bonus
attendu ; le calcul des points manque de clarté.

**Diagnostic.** Le bonus de série est **correctement calculé et appliqué**
(`src/server/engine.js:190`) : +50 à la deuxième bonne réponse consécutive, +100
à la troisième, jusqu'à un plafond de 250. La série est incrémentée avant le
calcul, rien ne décale.

Le défaut est double :

1. **Le bonus de série est fusionné avec le bonus de vitesse, sous une étiquette
   qui ment.** Le serveur additionne les deux dans un seul champ, affiché sous le
   libellé « Bonus vitesse » (`src/client/play/PlayApp.jsx:629`). Un joueur en
   série de trois qui n'a pas été le plus rapide voit « Bonus vitesse : +100 »
   alors qu'il n'a pas été rapide. **Le bonus est versé — il est invisible, rangé
   sous le nom d'un autre.**
2. **La notation contredit la mécanique.** L'écran affiche « ×3 », ce qui se lit
   comme un triplement ; c'est une addition forfaitaire. Le malentendu vient de
   l'écran, pas de Theodore.

Vérifications au passage : **le module vote ne casse pas les séries** (il n'est
pas noté, la mécanique l'ignore) ; **ne pas répondre casse la série** sans coûter
de points, mais cette règle n'a jamais été énoncée.

**Décisions entérinées.**

1. **La série est retirée du calcul** et conservée comme information (T3).
2. **Le champ de bonus ne contient plus que la vitesse**, sous le libellé
   « Complément de vitesse » (T5).
3. **Décomposition honnête, à totaux inchangés** : base fixe de 700 points pour
   une bonne réponse, puis jusqu'à 300 points complémentaires selon la rapidité,
   plus 150 pour le plus rapide de la manche. Ce sont exactement les chiffres
   d'aujourd'hui (`speedPoints` vaut `1000 × (0,7 + 0,3 × rapidité)`), simplement
   dits en vérité. Motif : le libellé « complément de vitesse » serait tout aussi
   trompeur si la vitesse restait cachée dans la base.
4. **La même grammaire s'applique aux quatre modules** (T2), avec cette réserve :
   l'estimation et le vote n'ont **pas** de complément de vitesse. Pour
   l'estimation, la valeur du palier fait la base et rien ne s'y ajoute
   (action 13, décision 2) ; pour le vote, la base est fixe (action 18,
   décision 4). Sur ces deux modules, l'écran du joueur n'affiche donc qu'une
   ligne.
5. **Plus de notation « ×N »** ; le compteur s'affiche sous « Série de bonnes
   réponses ».
6. **La série se rompt dans trois cas** (T4), et cette règle est énoncée dans le
   barème de l'action 8.
7. **Aucune pénalité** (T1) : la ligne « Malus » disparaît de l'écran du joueur,
   qui se réduit à deux lignes.
8. **Les deux lignes ne s'affichent que quand elles valent quelque chose** — pas
   de ligne à zéro sur une manche ordinaire.

**Étapes.**
1. Retirer la série du calcul, conserver son suivi. *≈ 30 min.*
2. Supprimer le malus du calcul et de l'affichage. *≈ 30 min.*
3. Décomposer base et complément de vitesse dans ce que le serveur transmet. *≈ 1 h.*
4. Libellés et affichage. *≈ 1 h.*
5. Tests : totaux inchangés hors série et malus, série qui compte juste et se
   rompt quand il faut. *≈ 1 h.*

**Dépendances.** **Ouvre le lot 2.** Précède les actions 13, 18 et 8.

**Impacts.** Les scores baissent (disparition du bonus de série jusqu'à 250 points
par manche) et remontent légèrement (disparition du malus). Le classement devient
plus dépendant de la régularité que des coups d'éclat.

**Risques et mitigations.**
- *Série qui ne sert plus à rien aux yeux du joueur* → c'est la voix du jeu
  (action 7) qui porte la récompense. **Sans l'action 7, afficher un compteur sans
  conséquence serait déconseillé.**
- *Libellé trop long sur petit écran* → décision prise de conserver « Complément
  de vitesse » partout, y compris sur grand écran.
- *Totaux qui changent sans qu'on s'en aperçoive* → les tests comparent
  explicitement avant/après hors série et malus.

**Charge : 0,5 j.**

---

## Action 18 — Le vote devient un jeu

**Origine.** CR#2 — le module vote ne rapporte pas de points et sert uniquement à
choisir la suite de la soirée ; Theodore propose d'en refaire un jeu où faire
partie de la majorité rapporterait des points, et d'ajouter la possibilité pour
l'animateur de créer ses propres questions de sondage.

**Diagnostic.** Le vote est explicitement hors barème
(`src/server/modules.js:148`) : cent points forfaitaires par participant et aucune
notion de bonne réponse. La répartition est déjà calculée et diffusée. **Tout est
en place sauf la décision : il manque de désigner un gagnant.**

**La création de questions de sondage existe déjà** : le studio permet de créer
des modules de vote avec énoncé et options, et refuse d'enregistrer en dessous de
deux options remplies (`src/client/studio/StudioApp.jsx:267`,
`src/client/studio/StudioApp.jsx:32`). Si Theodore a eu l'impression que ça
manquait, c'est le symptôme du lien studio-jeu rompu que **l'action 10 répare**.

**Décisions entérinées.**

1. **La majorité l'emporte** : l'option la plus choisie devient la bonne réponse
   de la manche.
2. **En cas d'égalité entre deux options en tête, les deux camps gagnent** —
   sinon une égalité parfaite ne produirait aucun vainqueur.
3. **Pas de malus** (T1). Être minoritaire n'est pas une faute : c'est un pari
   perdu.
4. **Pas de complément de vitesse.** Dans les autres jeux, la rapidité mesure une
   maîtrise ; ici elle ne mesure rien, et pousserait à cliquer avant d'avoir lu.
   **Le vote est le seul module à base fixe, sans complément.**
5. **La série suit** : majoritaire, elle continue ; minoritaire, elle se rompt (T4).
6. **Un interrupteur sondage ou jeu, par question.** Coché, c'est un jeu ;
   décoché, c'est un vrai sondage sans points ni série. Motif : un vote noté n'est
   plus un sondage — le joueur répond ce qu'il croit que les autres vont répondre,
   et on perdrait l'outil qui permet de demander sincèrement à la salle ce dont
   elle a envie.
7. **L'option gagnante est désignée dans ce que le serveur diffuse**, pour que les
   trois écrans la mettent en valeur avec le mécanisme déjà en place pour le quiz
   et le vrai/faux.

**Étapes.**
1. Règle de majorité côté serveur, égalités comprises ; passage au barème. *≈ 3 h.*
2. Désigner l'option gagnante dans la diffusion. *≈ 1 h.*
3. Interrupteur sondage ou jeu, dans le studio et respecté en partie. *≈ 2 h.*
4. Tests : majorité nette, égalité parfaite, unanimité, sondage non noté sans
   effet sur points ni séries. *≈ 2 h.*

**Dépendances.** Après l'action 17 (grammaire de score). Alimente l'action 7.

**Impacts.** Le vote entre dans le barème et dans les séries : il pèse désormais
sur le classement, alors qu'il en était neutre.

**Risques et mitigations.**
- *Tout le monde choisit la même option* → aucune différenciation, et c'est très
  bien : l'unanimité est un moment de jeu, et la voix du jeu a une phrase prévue.
- *Concours de conformisme* → l'interrupteur (décision 6).
- *Petits effectifs rendant la majorité anecdotique* → raison de plus pour
  l'interrupteur.
- *Maquettes n'ayant pas prévu de gagnant sur le vote* → le mécanisme d'option
  gagnante existe déjà pour le quiz et le vrai/faux, avec ses couleurs.

**Charge : 1 j.**

---

## Action 19 — Nom et identité du jeu

**Origine.** CR#2 — plusieurs noms proposés (« Game Show », « Fire Game Show »,
« Le Feu de Camp »), préférence pour un nom chaleureux et évocateur ; discussion
sur la disponibilité des noms de domaine.

**Diagnostic.** Le nom provisoire est présent dans les titres de page, la carte
sociale de partage, le bloc de marque du stream (supprimé par l'action 4), le
paquet (`package.json:2`), le service de déploiement (`render.yaml:5`) et le
dépôt GitHub — qui s'appelle d'ailleurs déjà `GameShow`, ce que personne n'a
jamais remarqué.

**Le domaine n'est pas qu'une affaire de marque, c'est une contrainte de
design** : l'adresse s'affiche sur le stream, dans la pastille qu'on vient de
réduire. L'historique récent montre que le sujet a déjà posé problème (lien qui
se coupe au mauvais endroit, lien qui sort du panneau). Un domaine court vaut une
lisibilité que rien d'autre ne rachètera.

**Décisions entérinées.**

1. **Préparer le terrain maintenant**, sans attendre le nom : rassembler le nom
   visible en une valeur unique lue partout, et recenser tout ce qui devra changer.
2. **Le paquet, le dépôt GitHub et le service de déploiement restent inchangés**
   pour l'instant. Renommer le paquet n'apporte rien ; renommer le dépôt casse les
   liens et le déploiement pour zéro bénéfice.
3. **Le nom du service de déploiement se traitera avec le domaine** — sur ce type
   d'hébergement il détermine souvent l'adresse par défaut, donc potentiellement
   l'adresse que tapent les joueurs.
4. **Pas de recherche de disponibilité de domaines** pour l'instant.
5. **Une vérification automatique échoue si le nom provisoire réapparaît** quelque
   part après le changement.
6. **Le jour du choix** : écrire le nom, régénérer la carte de partage, vérifier
   l'affichage de l'adresse sur le stream à sa nouvelle longueur.

**Étapes.**
1. Recenser toutes les occurrences du nom et les visuels qui le portent. *≈ 1 h.*
2. Rassembler le nom en une valeur unique. *≈ 2 h.*
3. *(en attente de la décision)* Écrire le nom, régénérer la carte, vérifier le
   stream. *≈ 2 h.*

**Charge : 0,5 j**, dont la dernière partie attend la décision.

---

# 4. Points ouverts

Ces points **doivent être tranchés avant que l'action concernée démarre**.

**O1 — Rapidité et estimation. → TRANCHÉ le 2026-08-20 : aucune composante de
rapidité sur l'estimation.** Voir action 13, décisions 2 et 3, et le tableau T2.
Ni supplément du plus rapide, ni modulation à l'intérieur du palier : les points
d'un palier sont une valeur fixe. L'estimation et le vote sont désormais les deux
seuls modules sans complément de vitesse — l'un récompense la précision, l'autre
la prédiction du groupe.

**O2 — Le nom du jeu et le domaine.** *(bloque l'étape 3 de l'action 19)*

**O3 — Le périmètre exact de la session de test à deux jours.** Proposition en
section 2.5 : actions 12, 14 et 16.

---

# 5. Hors périmètre

- **Les pouvoirs spéciaux** (bonus et malus « pour pimenter le jeu ») : n'existent
  pas dans le code, rien à griser. Action neuve le jour où les règles seront
  définies.
- **Le pilotage d'un même salon à deux animateurs**, et la reprise de salon en cas
  de panne (action 10, décision 4).
- **Le changement de pseudo en cours de partie** (action 15, décision 4).
- **L'édition des textes depuis le site** (action 1) : remplacée par un inventaire
  à la demande.
- **Le partage d'archives pour développer à distance** : les deux comptes de
  l'action 10 en règlent la moitié ; le reste est une question d'organisation, pas
  de développement.

---

# 6. Traçabilité

| Tâche du CR#1 | Action |
|---|---|
| Modification des textes sur les écrans | 1 (mise de côté) |
| Cohérence des noms des jeux | 2 |
| Affichage du classement complet sur le stream | 3 |
| Réduction de la taille du QR code | 4 |
| Suppression du QR code à la fin de la partie | 5 |
| Vérification de la non-répétition des questions | 6 |
| Ajout de phrases amusantes pour les joueurs en attente | 7 |
| Cohérence de l'affichage des bonus et malus | 8 |
| Masquage de l'adresse mail animateur | 9 |
| *(implicite)* Ajout de l'adresse de Theodore | 10 |
| *(implicite)* Phase de vérification du studio | 11 |

| Tâche du CR#2 | Action |
|---|---|
| Affichage des résultats du joueur | 12 |
| Calcul des points dans le module Estimation | 13 |
| Messages de feedback dans le module Estimation | 13 (logique) + 7 (écriture) |
| Affichage de la jauge dans le module Vrai/Faux | 14 |
| Affichage du bouton quitter | 15 |
| Affichage du module Changer de module | 16 |
| Bonus de série dans le calcul des points | 17 |
| Transformation du module Vote | 18 |
| Accès à la prochaine question pour l'animateur | 6 (file d'attente) |
| *(discussion)* Module d'administration pour gérer les questions | Le Studio le fait déjà : création, édition et suppression de modules et de questions pour les quatre types (`src/client/studio/StudioApp.jsx`). Restructuré par l'action 2 (jeux nommés, questions de base supprimables), réparé par l'action 10 (le contenu enregistré arrive enfin en partie), et vérifié par le scénario central de l'action 11. **Aucune action neuve.** |
| *(discussion)* Nom et identité du jeu | 19 |
