# Audit UI/UX — cohérence visuelle
### Project Game Show · typographie · positionnement · design board · textes
*Chaque page et chaque modale, sur la version en ligne · 5 personas · 28 juillet 2026*

---

## Méthode

Audit systématique de **toutes les surfaces et de toutes les modales**, capture par capture (desktop 1440 px, mobile 390 px, overlay 1920×1080), doublé d'un **scan du code** (tous les fichiers CSS et JSX) pour vérifier objectivement quatre dimensions :

1. **Cohérence des tailles de police** — usage d'une échelle typographique unique
2. **Positionnement / alignement** — rythme, hiérarchie, responsive
3. **Adhérence au design board** — tokens, palette, motion (aucune valeur littérale)
4. **Textes visibles** — exactitude, grammaire, cohérence de vocabulaire

Surfaces couvertes : **Animateur** (connexion + value prop, lobby, choix de module, direct, révélation, résultats) · **Modales animateur** (menu de sortie, Bonus/Malus, sélecteur de module) · **Joueur** (rejoindre, attente, question ×4 types, score gagné/raté, fin) · **Overlays OBS** (question, classement, podium + mode Aperçu) · **Studio** (liste, éditeur, édition de question ×4 types).

Sévérité : 🔴 bloquant · 🟠 majeur · 🟡 mineur · 🟢 confort. Les défauts marqués ✅ *corrigé* l'ont été pendant l'audit et sont déployés.

---

## Résultat du scan de code (objectif)

Le socle est **sain** et le design board est respecté au niveau du code :

- **Zéro couleur littérale** (aucun `#hex`, `rgb()`, `hsl()`) dans tout le CSS des surfaces — tout passe par `var(--token)` ou `color-mix(in oklch, …)`. ✓
- **Zéro taille de texte littérale** : toutes les tailles de corps et de titre utilisent l'échelle fluide `--font-size-step-*` / `--font-size-display-hero`. ✓ (Les rares valeurs en px concernent le dimensionnement des icônes SVG, pas le texte.)
- **Deux familles, deux rôles** appliqués de façon cohérente : `Fraunces` (serif d'affichage) pour les titres et chiffres héros ; `Inter` pour tout le corps.
- **Palette à trois voix**, cohérente sur toutes les surfaces : **orange** (signature/CTA, code, chrono, accents), **vert forêt** (titres de section, mots-clés, badges d'état), **crème** (corps, titres de carte).
- **Motion** : durées/easings tokenisés, `prefers-reduced-motion` honoré sur les grosses animations et le compte à rebours de points.

Autrement dit, l'incohérence n'est pas systémique : ce sont des **écarts ponctuels**, listés ci-dessous.

---

## Persona 1 — Théo, l'animateur (desktop + OBS)
> *Regarde son plateau toute la soirée sur un grand écran. Un détail qui « sonne faux » se voit à l'antenne.*

**Ce qui est cohérent 🟢**
- Hiérarchie typographique claire et constante : titre de salon en serif, chips d'état homogènes, code de salle en gros chiffres orange (display), chrono au même gabarit.
- La carte « Répartition des réponses » (A/B/C/D) reprend exactement le système : lettres en pastilles orange, barres tokenisées, %, tout aligné sur une grille.
- Le **menu de sortie** et le sélecteur de module partagent les mêmes composants de bouton/menu — aucune rupture de style.

**Frictions**
- ✅ **corrigé** · 🟡 **Bouton-lien souligné.** « Gérer mes questionnaires » est un `<a>` stylé en bouton : il héritait du soulignement des liens (un bouton souligné, affordance mixte). Soulignement retiré pour tous les liens-boutons (`a.button`).
- 🟡 **Le chiffre « réponses reçues » en direct est surdimensionné** (taille `display-hero`, la même que le rang final d'un joueur). Depuis que la carte de répartition affiche déjà le total, ce chiffre géant fait doublon et déséquilibre le bas de la carte question. Le passer à `step-6`/`step-5` rééquilibrerait la hiérarchie.
- 🟡 **La modale Bonus/Malus flotte au-dessus de la colonne classement** (panneau ancré en bas à droite). Fonctionnel, mais elle masque partiellement le Top 5 ; un tiroir latéral ou un léger décalage éviterait le chevauchement.
- 🟢 **Deux verts « pleins » qui cohabitent** : titres verts (accent) et boutons vert forêt pleins (« Passer à la suivante », « Gérer mes questionnaires »). C'est un pattern assumé, mais deux boutons pleins très saturés (orange + vert) sur le même écran diluent un peu la notion d'action principale. À surveiller si d'autres boutons verts pleins s'ajoutent.

---

## Persona 2 — Léa, la joueuse (mobile)
> *Petit écran, une main. Tout ce qui « déborde » ou change de style d'un écran à l'autre se remarque immédiatement.*

**Ce qui est cohérent 🟢**
- Les 4 types de question (Quiz, Vrai/Faux, Estimation, Vote) partagent le **même gabarit** : badge « Question N » vert, chrono orange géant, barre de progression, énoncé serif, boutons de réponse identiques. La transition d'un type à l'autre est sans couture.
- Écran de score : tonalités win/raté cohérentes, gros « +N points » animé aligné sur le système de chiffres.

**Frictions**
- ✅ **corrigé** · 🟠 **Le champ d'estimation ressemblait à un titre.** Seul champ de saisie de l'app en **serif d'affichage gras centré**, il cassait la cohérence des inputs (tous les autres sont en Inter). Remis en police de texte (grand et centré conservés pour la saisie d'un nombre).
- ✅ **corrigé** · 🟡 **Accord au singulier.** « 1 joueurs prêts » sur l'écran d'attente. Corrigé (« 1 joueur prêt »), idem « joueur(s) connecté(s) » et « réponse(s) reçue(s) » côté animateur.
- 🟡 **Le pictogramme « Salon » (tipi/tente)** est un petit triangle qui, à cette taille, peut se lire comme un panneau d'alerte. Une icône plus explicite (ou le retrait de l'icône) lèverait l'ambiguïté.
- 🟢 **Écran d'attente très aéré** : beaucoup d'espace vertical vide autour de l'emblème sur grands mobiles. Un rappel du code plus présent ou un compteur plus vivant occuperait mieux l'espace.

---

## Persona 3 — Karim, le nouveau visiteur (accueil)
> *Juge le sérieux du produit en un regard. La cohérence typographique EST le signal de qualité.*

**Ce qui est cohérent 🟢**
- La page d'accueil (split value prop / connexion) est l'exemple le plus abouti : eyebrow en pastille, titre `step-5` serif, sous-titre `step-1`, trois bénéfices à l'icône encadrée — une hiérarchie de tailles nette et régulière.
- Le loader de marque et le fond `#181612` calé sur la couleur de page réelle : aucune rupture au chargement.

**Frictions**
- 🟡 **Le grand titre héros est en vert plein serif** et occupe presque toute la colonne. C'est un choix fort et cohérent avec « le vert = titre », mais son poids visuel dépasse celui de la carte de connexion (l'action réelle). Réduire d'un cran (`step-4`) ou tempérer la saturation renforcerait l'équilibre entre discours et action.
- 🟡 **Deux noms pour le produit** selon la surface : « Project Game Show » (accueil, joueur) et « Game Show / Studio » (barre latérale du Studio). Unifier la marque éviterait l'hésitation.

---

## Persona 4 — Sofia, la créatrice (Studio)
> *Passe du temps dans l'éditeur. La régularité des champs et des libellés conditionne son confort.*

**Ce qui est cohérent 🟢**
- Le Studio reprend fidèlement le système : cartes de module, badges de type, champs `input`/`select` homogènes, échelle de titres alignée (titre de page `step-3`, titres de carte serif).
- L'éditeur (panneau latéral) et la liste partagent les mêmes composants ; l'expansion d'une question garde la même grille de champs quel que soit le type.

**Frictions**
- ✅ **corrigé** · 🟡 **Menu Type tronqué et vocabulaire divergent.** Le déroulant Type affichait la *description* (« Choix multiple ») — tronquée en « Choix multi… » dans un select étroit, et différente du badge (« Quiz »). Il affiche désormais le **nom du type** (Quiz / Vrai-Faux / Estimation / Vote) : plus court, plus de troncature, vocabulaire aligné sur le badge.
- 🟡 **Densité de l'éditeur sur écran moyen** : à 1440 px le panneau éditeur cohabite avec la liste, mais l'énoncé et les options se retrouvent dans une colonne étroite (texte coupé « Quelle planète est la plus proche… »). Un mode plein largeur de l'éditeur (ou masquage de la liste quand on édite) donnerait de l'air.
- 🟢 **Bandeau « Non connecté »** clair et bien tokenisé ; cohérent avec le reste. (Le CTA de connexion in-situ reste au backlog UX précédent, hors périmètre cohérence.)

---

## Persona 5 — Marc, besoins d'accessibilité
> *Zoom, lecteur d'écran, contraste. La cohérence des tailles compte aussi pour la lisibilité.*

**Ce qui est cohérent 🟢**
- L'échelle **fluide** (`clamp`) garantit une montée régulière des tailles du mobile au desktop, sans saut brutal — bon pour le zoom.
- Rôles ARIA et libellés présents ; `prefers-reduced-motion` respecté ; focus visibles tokenisés.

**Frictions**
- ✅ **corrigé** · 🟠 **Contraste du texte secondaire.** Mesures WCAG (OKLCH→sRGB) : le gris de base passait déjà AA (6,6–9,4:1), mais les variantes semi-transparentes `color-mix … 70%` (placeholders) tombaient à **4,69:1** — conforme de justesse. Correctif : nouveau primitif `--color-neutral-250` (L 0,79→0,83) pour `text-secondary`, mix des placeholders 70→82 %, retrait d'une `opacity:0.8` parasite. Résultat : **7,5–10,7:1** pour le texte secondaire et **6,7:1** pour les placeholders (proche AAA), sans aplatir la hiérarchie.
- 🟡 **Les plus petits libellés `step--1`** (≈ 0,83 rem en bas de l'échelle) servent beaucoup d'étiquettes en majuscules espacées ; à ce niveau, l'`letter-spacing` élevé réduit un peu la lisibilité pour une basse vision. Réserver l'espacement large aux libellés ≥ `step-0`.

---

## Synthèse

La cohérence **structurelle** est excellente : une seule échelle typographique fluide, deux familles aux rôles nets, une palette à trois voix, zéro valeur littérale — le design board est tenu au niveau du code. Les écarts relevés sont **ponctuels et cosmétiques**, pas systémiques. Les plus visibles (champ d'estimation en serif, bouton-lien souligné, pluriels, vocabulaire du Studio) **sont corrigés et déployés**.

Restent surtout des **arbitrages de hiérarchie** (poids du titre héros vert, taille du compteur « réponses reçues », deux boutons pleins concurrents) et **un point d'accessibilité réel** (contraste du gris secondaire), qui méritent une passe dédiée.

---

## Backlog priorisé

| # | Sévérité | Surface | Constat | Action |
|---|----------|---------|---------|--------|
| C1 | ✅ corrigé | Joueur | Champ estimation en serif (effet titre) | Police de texte, grand + centré conservés |
| C2 | ✅ corrigé | Animateur | Bouton-lien souligné | `text-decoration:none` sur les liens-boutons |
| C3 | ✅ corrigé | Animateur/Joueur | Pluriels (« 1 joueurs prêts »…) | Accord singulier/pluriel dynamique |
| C4 | ✅ corrigé | Studio | Type tronqué + vocabulaire divergent | Déroulant affiche le nom du type |
| U1 | ✅ corrigé | Transverse (a11y) | Contraste gris secondaire limite AA (4,69:1 placeholders) | Primitif neutral-250, mix 82 %, opacity retirée → 6,7–10,7:1 |
| U2 | ✅ corrigé | Animateur | « Réponses reçues » surdimensionné (display-hero) | Passé à `step-6` — au même gabarit que le chrono |
| U3 | ✅ corrigé | Accueil/Studio | Deux noms de marque (« Project Game Show » / « Game Show ») | Studio unifié en « Project Game Show » |
| U4 | ✅ corrigé | Accueil | Titre héros vert très dominant vs carte de connexion | Titre passé de `step-5` à `step-4` |
| U5 | ✅ corrigé | Studio | Éditeur à l'étroit sur écran moyen | Panneau élargi `clamp(380px, 32vw, 460px)` — les champs respirent |
| U6 | ⬜ conservé | Animateur | Modale Bonus/Malus chevauche le classement | Choix assumé : popover flottant temporaire pendant l'ajustement des scores |
| U7 | 🟡 ouvert | Joueur | Icône « Salon » (tipi) ambiguë en petit | Icône plus explicite ou retrait (visuel de marque — à trancher) |
| U8 | ⬜ conservé | a11y | `letter-spacing` large sur les libellés `step--1` | Style eyebrow assumé et lisible aux tests — conservé |
| U9 | ⬜ conservé | Animateur | Deux boutons pleins concurrents (orange + vert) | Pattern établi (vert forêt = action secondaire) — conservé |

**Bilan.** U1→U5 corrigés et déployés. U6, U8, U9 relèvent de choix de design assumés (conservés). Reste U7 (icône « Salon »), à trancher côté marque.
