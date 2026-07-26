---
artifact_type: design_board
app: root
version: 3
change_set: none
produced_by: design-board
supersedes: docs/DESIGN-BOARD-v2.md
---
# DESIGN BOARD — Project Game Show (v3 — « feu-de-camp convivial »)

> v3 affine v2 : même univers feu de camp / forêt / tipi, mais **sans brun** et avec une palette
> **chaleureuse et conviviale** (feu orange lumineux + vert frais + crème) au lieu du brun/mystique.
> Retenu par l'utilisateur sur le prototype `design/directions/feu-de-camp-v2.html` (version conviviale).
> v2 (brun) et v1 (néon violet) sont superseded.

## 1. Intent & audience

- **Adjectifs d'intent :** Chaleureux, Convivial, Accueillant — l'esprit « on se retrouve autour du feu », lumineux et amical (et non sombre/mystique). À répercuter dans USER-NEEDS.design_feeling.
- **Domaine :** jeu télévisé interactif en livestream (entertainment / gaming), mood chaleureux à contre-courant du marché froid.
- **Audience :** animateur sur desktop, viewer-joueur sur mobile, overlays OBS pour l'audience du stream.
- **Conventions du benchmark (sourcées) :** split écran-scène / téléphone-manette (source: https://kahoot.fandom.com/wiki/Quiz) ; overlays OBS transparents + typo large + motion de reveal (source: https://obsproject.com/kb/browser-source) ; marché dominé par le néon violet froid (Twitch) — cette direction chaude et conviviale s'en écarte volontairement.

## 2. Vibe & signature

Hiérarchie : **Chaleureux** (dominant) → **Convivial** → **Accueillant** → premium doux → lisible-en-live.

**Élément signature — « le grand chiffre en flamme ».** Un chiffre géant en serif (Fraunces) qui rayonne comme une flamme dorée, au cœur d'une ambiance de feu de camp lumineux et accueillant. La chaleur vient de la **lumière du feu** (orange doré) et d'un **vert frais** de forêt — pas de matières sombres ni de brun. L'imagerie (feu, tipi, pins au soleil couchant) baigne l'écran d'une lueur chaude.

## 3. Palette OKLCH

UI **dark-first** (fond chaud-neutre, pour rester lisible en overlay OBS et laisser rayonner le feu). Palette : primary = **feu** (action + signature), neutres = **chaud-neutre discret** (surfaces qui ne virent pas au brun), accent = **vert frais** (forêt conviviale).

**Ancrage.** `primary` = feu, hue **58** (orange doré), chroma d'ancrage **0.17** (chaleureux/vivant). Ancre `primary-500 = oklch(0.62 0.17 58)`. Écart au domaine (marché H≈300 froid) : divergence assumée.

**Échelle primary — feu (9 teintes, chroma en cloche, H=58) :**

| 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 |
|---|---|---|---|---|---|---|---|---|
| 0.95 0.051 | 0.88 0.085 | 0.79 0.122 | 0.70 0.153 | 0.62 0.170 | 0.53 0.170 | 0.44 0.150 | 0.35 0.122 | 0.26 0.094 |

**Échelle neutral — chaud-neutre (9 teintes, H=80, chroma bas pour rester chaud SANS brun) :**

| 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 |
|---|---|---|---|---|---|---|---|---|
| 0.95 0.005 | 0.88 0.008 | 0.79 0.012 | 0.70 0.014 | 0.62 0.016 | 0.53 0.016 | 0.44 0.014 | 0.35 0.012 | 0.26 0.009 |

Note : chroma des neutres volontairement **basse** (≤ 0.016) — la chaleur vient du feu et de l'imagerie, pas des surfaces (évite le brun jugé « mystique »).

**Surfaces dark-first :** `bg-deep = oklch(0.20 0.014 80)` (chaud-neutre profond) · `surface = oklch(0.26 0.018 80)` · `elevated = oklch(0.32 0.02 80)`. En overlay sur imagerie, ces surfaces sont translucides (glass) et l'image de feu est éclaircie (moins d'assombrissement qu'en v2) pour l'effet convivial.

**Accent forêt (vert frais) :** `green = oklch(0.70 0.14 150)`, `green-300 = oklch(0.80 0.13 150)` (titres), `green-600 = oklch(0.55 0.12 150)` (boutons). `fire-bright = oklch(0.80 0.15 65)` pour le grand chiffre et les halos.

**4 couleurs sémantiques :** `success oklch(0.66 0.15 150)` · `warning oklch(0.82 0.16 88)` · `danger oklch(0.66 0.21 28)` · `info oklch(0.66 0.10 235)` (bleu désaturé, usage système rare). success partage la famille verte de l'accent (cohérent avec l'univers), distingué par usage.

**Contrastes WCAG — calculés (script OKLCH→sRGB→ratio) :**

| Paire (dark-first) | Ratio | Verdict |
|---|---|---|
| texte crème `neutral-100` / `bg-deep` | 16.61:1 | AAA |
| texte secondaire `neutral-300` / `bg-deep` | 11.08:1 | AAA |
| texte crème / `surface` | 14.26:1 | AAA |
| encre foncée / `primary-500` feu (bouton) | 4.55:1 | AA |
| crème / `primary-700` feu (bouton sombre) | 7.43:1 | AAA |
| grand chiffre `fire-bright` / `bg-deep` (large) | 9.40:1 | AAA |
| titre `green-300` / `surface` (large) | 8.74:1 | AAA |
| `green` / `bg-deep` | 7.18:1 | AAA |
| encre foncée / `green` (bouton) | 6.90:1 | AA |
| `success` / `bg-deep` | 6.20:1 | AA |
| `warning` / `bg-deep` | 10.30:1 | AAA |
| `danger` / `bg-deep` | 5.28:1 | AA |
| `info` / `bg-deep` | 5.93:1 | AA |

**Règles de token :** bouton feu clair = **`primary-500` + encre foncée** (`oklch(0.22 0.03 55)`, 4.55:1 AA) ; feu sombre (`primary-700`) = texte **crème** (7.43:1). Bouton vert = **encre foncée** (6.90:1). Mode clair optionnel (Studio admin), re-dérivé.

## 4. Typographie

Registre **chaleureux-crédible** (adjectifs « chaleureux, convivial, accueillant, premium doux »). 2 familles.

| Famille | Rôle | Source | Licence | Justification |
|---|---|---|---|---|
| **Fraunces** | display (titres, question, **grand chiffre-flamme**) | google-fonts | OFL | Serif « soft » à optical-size variable : chaleureux et amical sans être froid ; ses chiffres portent la flamme signature. |
| **Inter** | texte / UI (dashboard, manette, données inline) | google-fonts | OFL | Grotesque neutre très lisible à 14-16px sur mobile, `tabular-nums` pour scores/timers ; fort contraste de forme avec Fraunces. |

Sans famille mono dédiée (choix assumé) : chiffres signature en Fraunces, données inline en Inter `tabular-nums`. Appariement vérifié : serif douce vs grotesque neutre, x-heights compatibles, diacritiques français couverts.

## 5. Motion

Philosophie : **organique-doux (variante flamme)** — chaleureux, décélérations douces, zéro rebond mécanique ; l'unique registre d'emphase = l'embrasement chaud du chiffre/reveal.

- **Durées :** fast **140 ms** (feedback) · base **240 ms** (transitions locales) · slow **320 ms** (navigation). Emphase de révélation jusqu'à **600 ms** (reveal, montée du classement, podium) — bloom de lueur dorée, rare.
- **feedback** : `fast`, opacité + douce montée de lueur, scale ≤ 1.02, aucun bounce.
- **navigation** : `slow`, entrée décélérée, sortie ~60 % de l'entrée.
- **emphasis** : le chiffre s'embrase (halo doré), le classement monte en stagger ; ≤ 600 ms.
- **prefers-reduced-motion :** translations/scale/rotation supprimées (0 ms) ; seuls fondus d'opacité ≤ 150 ms ; aucune info portée uniquement par le mouvement.

## 6. Accessibilité

- **Cible :** WCAG 2.2 **AA** (toutes paires AA, majorité AAA). Overlays OBS display-only, lisibles sur gameplay.
- **touch_target_min : 44 px** (manette mobile).
- **focus_ring :** `2px solid primary-500 (feu)`, offset 2px — visible sur fond sombre.
- **dark_mode : true (dark-first)**, mode clair réservé au Studio admin.
- **Imagerie & lisibilité :** les visuels de feu/forêt sont éclaircis pour l'ambiance conviviale MAIS toujours suffisamment assombris sous le texte (calque dégradé + text-shadow) pour tenir les contrastes déclarés ; le texte ne repose jamais sur une zone claire de l'image.

## 7. Seeds & provenance

- **USER-NEEDS-v1** — feeling à réviser vers « chaleureux/convivial/accueillant » ; personas, contexte.
- **DESIGN-DOMAIN-EXPLORE-v1** — conventions (split scène/manette, overlays OBS) et marché froid dont on s'écarte : https://kahoot.fandom.com/wiki/Quiz , https://obsproject.com/kb/browser-source .
- **Exploration design-explorer** — direction retenue = **feu-de-camp v2 convivial** (`design/directions/feu-de-camp-v2.html`), sans brun, chaleureuse.
- **Imagerie générée (seed) :** feu de camp / tipi / forêt lumineux et accueillants, générés dans **Higgsfield (nano-banana)**, embarqués base64 dans le prototype (jetable). Production propre → **asset-imagery (Phase 4.x)** avec sidecars/codification ; prototype non promu.
- **MCP design (Figma/Canva/Adobe) :** non consultés.
- **Proposition ratifiée :** aucune (raffinement forward, mode NORMAL).
