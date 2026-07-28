# Audit produit — 5 personas utilisateurs
### Project Game Show · plateau de jeu télévisé en livestream
*Réalisé sur la version en ligne après livraison des Lots 1 à 5 · 28 juillet 2026*

---

## Méthode

Cet audit rejoue le produit **tel qu'il tourne réellement**, pas sur maquette : chaque parcours a été exécuté de bout en bout (création de salon, connexion de joueurs, lancement d'un module, réponses, révélation, podium, fin de partie), avec captures d'écran à chaque étape clé, sur desktop 1440 px, mobile 390 px et overlay OBS 1920×1080.

Cinq personas distincts, choisis pour couvrir les cinq points de vue qui font (ou défont) l'expérience : celui qui anime, celle qui joue, celui qui découvre, celle qui prépare, et celui qui a des besoins d'accessibilité.

Chaque section note **ce qui fonctionne** puis **les frictions**, avec une sévérité : 🔴 bloquant · 🟠 majeur · 🟡 mineur · 🟢 confort.

Deux défauts détectés pendant l'audit ont déjà été **corrigés et déployés** — ils sont signalés ✅ *corrigé* ci-dessous. Le reste constitue un backlog priorisé en fin de document.

---

## Persona 1 — Théo, l'animateur streamer
> *28 ans, streame deux soirs par semaine. Il pilote depuis un PC avec OBS ouvert à côté. Sa hantise : fumbler en direct devant 200 personnes.*

**Parcours vécu.** Théo arrive sur la page d'accueil : la proposition de valeur est claire (« Anime ton propre jeu télévisé… »), il comprend en 3 secondes ce que le produit fait et se connecte par lien email. Une fois dans le salon, il partage le code + QR, colle les trois liens overlays dans OBS, lance un Quiz. En direct, la **répartition des réponses A/B/C/D s'affiche pour lui seul** avec barres et pourcentages — il voit le public hésiter entre Atlantique et Pacifique et peut relancer le suspense avant de révéler. Les sorties sont regroupées dans un **menu unique** avec confirmation en deux temps : il ne risque plus de fermer le salon par erreur en cliquant à côté.

**Ce qui fonctionne 🟢**
- La distribution en direct est la vraie valeur ajoutée « régie » : elle transforme l'animateur en présentateur qui commente, au lieu d'un simple opérateur.
- Le regroupement des actions destructives derrière un menu + confirmation supprime le risque n°1 en live (fermer/déconnecter par accident).
- Les liens overlays portent une consigne OBS explicite (source navigateur 1920×1080, fond transparent) + un bouton Aperçu.

**Frictions**
- 🟡 **Le bandeau d'état reste « En direct » (rouge) pendant la phase Résultats.** Après révélation, la fenêtre de réponse est fermée mais le chip laisse croire qu'elle est encore ouverte. Un chip « Résultats » lèverait l'ambiguïté.
- 🟡 **Progression « Épreuve 1 / 1 ».** Avec un seul module joué, l'indicateur affiche 1/1, ce qui n'aide pas à se repérer dans une partie longue. Le total devrait refléter un objectif de partie (ou disparaître tant qu'il vaut 1).
- 🟡 **Deux verbes proches pour avancer** : « Passer à la suivante » (live) et « Module suivant » (résultats) ramènent tous deux au choix de module. Unifier le vocabulaire réduirait la charge mentale en direct.
- 🟢 **Classement « Top 5 en direct » avant le premier score** : les joueurs sont listés dans l'ordre d'arrivée avec le n°1 surligné à 0 pt, ce qui suggère faussement une avance. Neutraliser le surlignage tant que tous les scores valent 0.

---

## Persona 2 — Léa, la spectatrice mobile
> *22 ans, connectée depuis son canapé, une main sur le téléphone. Elle veut jouer, pas s'inscrire. Si ça rame ou si ça scrolle mal, elle décroche.*

**Parcours vécu.** Léa scanne le QR, tombe sur l'écran « rejoindre », tape le code (clavier alpha, pas numérique — corrigé lors d'un lot précédent) et un pseudo, puis attend. Question lancée : gros compte à rebours, barre de temps, réponses en gros boutons tactiles. Elle se trompe. La **révélation est franche** : croix rouge, « Raté… », **« +0 point »**, et surtout **« La bonne réponse : Pacifique »** — elle apprend quelque chose au lieu de rester frustrée. Son rang et son total s'affichent, puis le mini-classement. En fin de partie, un bouton **« Partager mon score »** et **« Rejouer »**.

**Ce qui fonctionne 🟢**
- La boucle réponse → révélation → score est lisible et gratifiante ; l'affichage de la bonne réponse en cas d'erreur est un vrai plus pédagogique.
- Zéro compte, zéro installation : la promesse est tenue.
- Les points gagnés s'animent en compte à rebours (et respectent `prefers-reduced-motion`).

**Frictions**
- ✅ **corrigé** · 🟠 **Les points gagnés étaient affichés comme « +N places ».** Le serveur envoie des *points* (`delta`), l'écran les libellait « places » — chiffre juste, mot faux. Désormais : grand **« +N points »** animé.
- ✅ **corrigé** · 🟠 **Vrai/Faux : faux positif.** La logique « Bonne réponse » se basait sur la valeur correcte seule, pas sur *la réponse du joueur* — un joueur pouvait voir « Bonne réponse ! » à tort. Corrigé (comparaison à la réponse réelle).
- ✅ **corrigé** · 🟡 **« Raté… » s'affichait en vert** (couleur « bonne réponse »). Passé en couleur neutre ; « Bonne réponse ! » reste en vert.
- 🟡 **Re-tap après réponse sans retour visuel.** Le serveur refuse le doublon (anti-triche OK), mais l'UI laisse re-cliquer sans message. Un état « déjà répondu » plus explicite éviterait le doute « est-ce que ça a marché ? ».

---

## Persona 3 — Karim, le nouveau visiteur
> *Tombé sur un lien pendant un live, il ouvre la page sans contexte. En 5 secondes il décide : je reste ou je ferme l'onglet.*

**Parcours vécu.** Karim n'a pas de flash blanc au chargement — un **écran de marque** (emblème + points animés) apparaît instantanément sur fond sombre, puis l'app prend le relais sans couture. Sur desktop, la page de connexion est un **split** : à gauche la proposition de valeur (concept + trois bénéfices concrets : joueurs sans compte, overlays OBS, modules Studio), à droite la carte de connexion. Il comprend l'offre avant même de savoir s'il doit se connecter.

**Ce qui fonctionne 🟢**
- Fin du flash blanc : la couleur du loader (#181612) est calée sur la couleur de page réelle, aucune bande claire, aucune bascule visible.
- La proposition de valeur répond aux trois questions du nouveau venu (c'est quoi, pour qui, pourquoi c'est simple) sans jargon.
- En mobile, le split s'empile proprement : argumentaire en haut, connexion en dessous.

**Frictions**
- 🟠 **La page ne distingue pas l'animateur du spectateur.** Un nouveau venu qui veut *jouer* (et non animer) arrive quand même sur l'écran de connexion animateur. Il n'y a pas de porte d'entrée « Je veux rejoindre une partie » → `/play`. Or Karim, spectateur, est le cas le plus fréquent. Ajouter un lien secondaire « Tu es spectateur ? Rejoins une partie ».
- 🟡 **Aucune preuve sociale ni aperçu visuel** de ce à quoi ressemble une partie (overlay, podium). Une vignette ou un court GIF rassurerait sur la qualité avant connexion.
- 🟢 **« Un seul animateur — accès par lien email »** peut surprendre sans explication (pourquoi un seul ?). Une infobulle « un compte = un plateau » suffirait.

---

## Persona 4 — Sofia, la créatrice de questionnaires
> *Prépare ses soirées à l'avance. Elle veut composer ses quiz tranquillement et les retrouver le soir du live.*

**Parcours vécu.** Sofia ouvre le Studio depuis le lobby (« Gérer mes questionnaires »). L'interface est claire : liste de modules (Quiz, Vrai/Faux, Estimation, Vote), durée, nombre de questions, Éditer/Supprimer, « Nouveau module ». Un **bandeau l'avertit** : « Non connecté : tes modifications restent locales. Connecte-toi d'abord côté animateur (même navigateur) pour enregistrer tes questionnaires en ligne. »

**Ce qui fonctionne 🟢**
- Le Studio est lisible et les types de modules sont homogènes avec le jeu.
- Le bandeau « Mode local » est honnête : il prévient AVANT que Sofia ne perde son travail (leçon d'un incident précédent où les sauvegardes échouaient en silence).

**Frictions**
- 🟠 **La persistance dépend d'une auth invisible et le chemin pour s'y mettre est une phrase, pas un bouton.** Sofia a ouvert le Studio dans un nouvel onglet ; si elle n'est pas connectée comme animatrice dans ce navigateur, rien ne se sauvegarde en ligne. Le bandeau *décrit* la solution mais ne l'*offre* pas. → Ajouter un CTA **« Se connecter pour enregistrer »** directement dans le bandeau (ouvre `/host` / déclenche le lien magique).
- 🟠 **Aucun indicateur par-module de l'état de sauvegarde** (local vs synchronisé). Sofia ne peut pas savoir, module par module, ce qui est déjà en ligne. Un badge « Synchronisé / Local » par carte fermerait le doute.
- 🟡 **Pas de lien retour évident vers le plateau** depuis le Studio (il s'ouvre en onglet séparé, ce qui va, mais un fil d'Ariane aiderait).

---

## Persona 5 — Marc, besoins d'accessibilité
> *Malvoyant, navigue au clavier et au lecteur d'écran, active « réduire les animations ». Il joue avec ses enfants.*

**Parcours vécu.** Marc perçoit une interface globalement bien structurée : rôles ARIA (`role="timer"`, `role="status"`, `aria-live`), libellés sur les icônes utiles, focus visibles, ordre de lecture cohérent. Les animations lourdes (podium, couronne, révélation) respectent désormais `prefers-reduced-motion`, tout comme le compte à rebours des points (valeur affichée directement).

**Ce qui fonctionne 🟢**
- Les surfaces exposent des libellés et des régions live ; les touches A/B/C/D sont `aria-hidden` avec un libellé texte lisible à côté.
- `prefers-reduced-motion` est honoré sur les grosses animations (overlay, host, points).
- Le contraste du texte principal sur fond sombre est confortable.

**Frictions**
- 🟠 **Le texte secondaire (gris) sur fond sombre frôle le seuil AA** dans plusieurs zones (indices, sous-titres, `dist__pct`, « temps restant »). Un audit de contraste chiffré (viser AA 4.5:1 pour le texte courant) est à mener ; remonter d'un cran la luminance du gris secondaire réglerait l'essentiel.
- 🟡 **La barre de répartition (animateur) n'a pas de rôle `progressbar`/`meter`** : un lecteur d'écran lit le nombre et le %, mais pas la proportion. Les valeurs sont présentes, l'expérience est acceptable, mais un `role="meter"` + `aria-valuenow` la rendrait exemplaire.
- 🟡 **La cible tactile de certaines actions ghost (Aperçu, Copier)** peut passer sous 44 px sur mobile. À vérifier au réglet.

---

## Synthèse transversale

Le produit, après les cinq lots, tient une **boucle de jeu solide et lisible** : l'animateur pilote avec une vraie régie (distribution en direct, sorties sécurisées), le joueur vit une révélation gratifiante et pédagogique, le nouveau venu comprend l'offre sans friction, et l'accessibilité de base est en place. Les défauts de correctness les plus visibles (points libellés « places », faux positif Vrai/Faux, vainqueur reconnecté affiché à 0) **ont été corrigés pendant l'audit**.

Ce qui reste tient à **deux angles morts récurrents** :
1. **La bifurcation animateur / spectateur** n'existe pas à l'entrée — or le spectateur est le public majoritaire.
2. **La persistance Studio** est conditionnée à une auth que l'utilisateur ne voit pas et ne peut pas déclencher depuis là où le besoin naît.

---

## Backlog priorisé

| # | Sévérité | Persona | Constat | Action recommandée |
|---|----------|---------|---------|--------------------|
| A1 | ✅ corrigé | Léa | Points gagnés libellés « +N places » | Grand « +N points » animé |
| A2 | ✅ corrigé | Léa | Vrai/Faux : « Bonne réponse » à tort | Comparaison à la réponse du joueur |
| A3 | ✅ corrigé | Léa | « Raté… » affiché en vert | Couleur neutre (succès reste vert) |
| A4 | ✅ corrigé | Karim/Léa | Reconnecté = « rang — / 0 pts » (même vainqueur) | Repli rang+score depuis le classement |
| P1 | ✅ corrigé | Karim | Pas de porte d'entrée spectateur | Lien « Rejoindre une partie » → `/play` ajouté sur l'accueil |
| P2 | ✅ corrigé | Sofia | Persistance dépend d'une auth invisible | Bouton « Se connecter » (nouvel onglet) ajouté au bandeau Studio |
| P3 | 🟠 majeur | Sofia | Pas d'état de sync par module | Badge « Synchronisé / Local » par carte |
| P4 | 🟠 majeur | Marc | Contraste du gris secondaire limite AA | Audit chiffré + remontée de luminance |
| P5 | 🟡 mineur | Théo | Chip « En direct » pendant Résultats | Chip « Résultats » distinct |
| P6 | 🟡 mineur | Théo | « Épreuve 1/1 » peu utile | Masquer/repenser le total de progression |
| P7 | 🟡 mineur | Théo | Verbes « Passer/Suivant » redondants | Unifier le vocabulaire d'avancement |
| P8 | 🟡 mineur | Léa | Re-tap sans retour après réponse | État « déjà répondu » explicite |
| P9 | 🟡 mineur | Marc | Barre de répartition sans rôle sémantique | `role="meter"` + `aria-valuenow` |
| P10 | 🟢 confort | Théo | Surlignage n°1 à 0 pt | Neutraliser tant que scores = 0 |
| P11 | 🟢 confort | Karim | Pas d'aperçu visuel avant connexion | Vignette/GIF d'une partie |

**Suggestion de séquencement.** P1 et P2 d'abord — ce sont les deux frictions qui coûtent des utilisateurs (spectateurs perdus à l'entrée, questionnaires perdus faute d'auth). Puis P3–P4 (confiance créatrice + accessibilité). Le reste (P5–P11) est du polissage d'après-live, groupable en un lot.
