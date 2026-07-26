---
artifact_type: design_board
app: root
version: 2
change_set: none
produced_by: design-board
supersedes: docs/DESIGN-BOARD-v1.md
---
# DESIGN BOARD — Project Game Show (v2 — direction « feu-de-camp »)

> v2 remplace la direction « game-show TV néon » de v1. Après exploration (design-explorer, 4 pistes),
> l'utilisateur a retenu **feu-de-camp v2** : ambiance forêt / bois / feu de camp près du tipi,
> chaleureuse et intime, avec imagerie générée. La v1 (violet néon) est superseded.

## 1. Intent & audience

- **Adjectifs d'intent (révisés) :** Chaleureux, Boisé, Intime — premium cosy « veillée au coin du feu ». (Remplace « Spectaculaire/Énergique/Premium » de v1 ; à répercuter dans USER-NEEDS.design_feeling au prochain passage produit.)
- **Domaine :** jeu télévisé interactif en livestream (entertainment / gaming), mais **mood délibérément à contre-courant** du marché.
- **Audience :** animateur sur desktop (poste de pilotage), viewer-joueur sur mobile (manette), overlays OBS pour l'audience du stream.
- **Conventions du benchmark (sourcées) :** split écran-scène / téléphone-manette (source: https://kahoot.fandom.com/wiki/Quiz) ; overlays OBS transparents, typo large, motion de reveal (source: https://obsproject.com/kb/browser-source) ; **le marché est froid et néon (violet Twitch)** — cette direction chaude/organique s'en écarte franchement et c'est le pari de distinctivité.

## 2. Vibe & signature

Hiérarchie : **Chaleureux** (dominant) → **Boisé** → **Intime** → premium → lisible-en-live.

**Élément signature — « le grand chiffre en braise ».** Le moment qu'on retient : un chiffre géant en serif (Fraunces) qui rougeoie comme une braise (halo orange chaud) au cœur d'une ambiance de forêt nocturne et de feu de camp. La lumière du feu monte du bas de l'écran ; le bois habille les surfaces ; le vert mousse ponctue. Trois matières en dialogue — **forêt (vert), bois (brun), feu (braise)** — au lieu du néon froid convenu.

## 3. Palette OKLCH

UI **dark-first** (veillée nocturne). Format `oklch(L C H)`. Palette à **trois pôles** : primary = **braise** (action + signature), neutres = **bois** (chaleur boisée assumée), accent secondaire = **mousse** (forêt).

**Ancrage.** `primary` = braise, hue **55** (orange-feu), chroma d'ancrage **0.16** (registre chaleureux/vivant, tempéré premium). Ancre `primary-500 = oklch(0.62 0.16 55)`. Écart au domaine (marché violet/froid H≈300) : **ΔH ≈ 115°**, divergence assumée et justifiée par le mood retenu.

**Échelle primary — braise (9 teintes, chroma en cloche, H=55) :**

| 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 |
|---|---|---|---|---|---|---|---|---|
| 0.95 0.048 | 0.88 0.080 | 0.79 0.115 | 0.70 0.144 | 0.62 0.160 | 0.53 0.160 | 0.44 0.141 | 0.35 0.115 | 0.26 0.088 |

**Échelle neutral — bois (9 teintes, H=58, chroma volontairement chaud pour le « boisé ») :**

| 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 |
|---|---|---|---|---|---|---|---|---|
| 0.95 0.010 | 0.88 0.016 | 0.79 0.024 | 0.70 0.030 | 0.62 0.034 | 0.53 0.034 | 0.44 0.030 | 0.35 0.026 | 0.26 0.020 |

Note : la chroma des neutres (jusqu'à 0.034) est plus élevée que l'usuel (0.005–0.02) — choix **délibéré** pour que les surfaces « soient » du bois et non un gris froid.

**Surfaces dark-first :** `bg-deep = oklch(0.16 0.018 60)` (nuit brun-noir) · `surface = oklch(0.26 0.035 55)` (bois) · `elevated = oklch(0.31 0.04 58)` (bois clair).

**Accent forêt (secondaire) :** `moss = oklch(0.58 0.09 145)`, `moss-300 = oklch(0.72 0.10 145)` (titres, ponctuations vertes). **Bois plein** (boutons/bordures) : `wood = oklch(0.48 0.07 60)`, `wood-border = oklch(0.42 0.06 58)`.

**4 couleurs sémantiques :** `success oklch(0.62 0.15 150)` · `warning oklch(0.80 0.16 85)` · `danger oklch(0.65 0.21 27)` · `info oklch(0.66 0.10 235)` (bleu désaturé, usage rare/système). Toutes ≥ 25° du primary(55) sauf warning (ΔH 30°) et success/danger distincts par chroma/lightness.

**Contrastes WCAG — calculés (script OKLCH→sRGB→ratio) :**

| Paire (dark-first) | Ratio | Verdict |
|---|---|---|
| texte crème `neutral-100` / `bg-deep` | 17.31:1 | AAA |
| texte secondaire `neutral-300` / `bg-deep` | 10.40:1 | AAA |
| texte crème / `surface` bois | 13.94:1 | AAA |
| encre foncée / `primary-500` braise (bouton) | 4.74:1 | AA |
| grand chiffre `ember` (primary-100/bright) / `bg-deep` (large) | 10.43:1 | AAA |
| titre `moss-300` / `surface` (large) | 6.56:1 | AAA |
| `moss` / `bg-deep` | 4.72:1 | AA |
| crème / `wood` (bouton bois) | 5.94:1 | AA |
| `success` / `bg-deep` | 5.70:1 | AA |
| `warning` / `bg-deep` | 10.29:1 | AAA |
| `danger` / `bg-deep` | 5.45:1 | AA |
| `info` / `bg-deep` | 6.37:1 | AA |

**Règles de token :** bouton braise = **`primary-500` + encre foncée** (`oklch(0.20 0.03 55)`) → 4.74:1 AA. Sur une braise plus sombre (`primary-600/700`), utiliser du texte **crème** (`primary-600` en encre foncée échoue : 3.27:1). Mode clair optionnel (surface Studio admin), re-dérivé (fonds `neutral-100`, textes `neutral-900`).

## 4. Typographie

Registre : **chaleureux-crédible / éditorial-premium** (adjectifs « chaleureux, boisé, intime, premium »). 2 familles.

| Famille | Rôle | Source | Licence | Justification |
|---|---|---|---|---|
| **Fraunces** | display (titres, question, **grand chiffre signature**) | google-fonts | OFL | Serif « soft » à optical-size variable : chaleureux et premium sans être rustique ; ses chiffres portent le moment-braise avec caractère — incarne « chaleureux/intime ». |
| **Inter** | texte / UI (dashboard, manette, données inline) | google-fonts | OFL | Grotesque neutre ultra-lisible à 14-16px sur mobile, `tabular-nums` pour scores/timers/codes ; contraste de forme fort avec la serif Fraunces. |

Choix **sans famille mono dédiée** assumé (comme le registre « neutre-produit » assume une famille unique) : les chiffres signature sont en Fraunces, les données inline en Inter `tabular-nums`. Appariement vérifié : serif douce vs grotesque neutre (fort contraste de forme), x-heights compatibles, diacritiques latin (français) couverts.

## 5. Motion

Philosophie : **organique-doux (variante braise)** — mapping des adjectifs « chaleureux/organique/intime ». Décélérations douces, zéro rebond mécanique ; un seul registre d'emphase = la montée de braise (glow chaud) sur les révélations.

- **Durées de référence :** fast **140 ms** (feedback) · base **240 ms** (transitions locales) · slow **320 ms** (navigation, panneaux). Emphase de révélation exceptionnelle jusqu'à **600 ms** (reveal, montée du classement, podium) — bloom de halo ember, rare et intentionnel.
- **feedback** (press, hover, focus, toggle) : `fast`, opacité + douce montée de lueur ember, scale ≤ 1.02, aucun bounce.
- **navigation** (changement de module, panneaux) : `slow`, entrée décélérée, sortie ~60 % de l'entrée.
- **emphasis** (révélation, grand chiffre, podium) : le seul moment expressif — le chiffre s'embrase (halo chaud) et le classement monte en stagger ; ≤ 600 ms.
- **prefers-reduced-motion :** sous `reduce`, translations/scale/rotation supprimées (0 ms) ; seuls des fondus d'opacité ≤ 150 ms subsistent. Aucune info portée uniquement par le mouvement (gain de points/rang toujours doublé par couleur + texte).

## 6. Accessibilité

- **Cible :** WCAG 2.2 **AA** (toutes les paires ci-dessus AA, la plupart AAA). Overlays OBS display-only mais lisibles (AA large) sur gameplay.
- **touch_target_min : 44 px** (critique sur la manette mobile).
- **focus_ring :** `2px solid primary-500 (braise)`, offset 2px — visible sur fond sombre, jamais supprimé.
- **dark_mode : true (dark-first).** L'ambiance veillée EST sombre ; mode clair réservé au Studio admin, re-dérivé et non inversé.
- **Imagerie & lisibilité :** les visuels de forêt/feu (fond d'ambiance) sont toujours assombris par un calque dégradé (garantissant les contrastes de texte déclarés) ; le texte ne repose jamais directement sur une zone claire de l'image.

## 7. Seeds & provenance

- **USER-NEEDS-v1** — feeling initial (à réviser vers « chaleureux/boisé/intime »), personas, contexte.
- **DESIGN-DOMAIN-EXPLORE-v1** — conventions du domaine (split scène/manette, overlays OBS) et constat du marché froid/néon dont on s'écarte : sources https://kahoot.fandom.com/wiki/Quiz , https://obsproject.com/kb/browser-source .
- **Exploration design-explorer** — 4 pistes proposées ; direction retenue par l'utilisateur = **feu-de-camp v2** (`design/directions/feu-de-camp-v2.html`), palette forêt + bois brun + braise, vocabulaire neutre.
- **Imagerie générée (seed visuel) :** visuels feu de camp / tipi / forêt générés dans **Higgsfield (nano-banana)** et embarqués en base64 dans le prototype v2 — jetables. La production propre des assets (hero d'ambiance, emblème tipi) revient à **asset-imagery (Phase 4.x)** avec sidecars et codification ; le prototype n'est pas promu.
- **MCP design (Figma/Canva/Adobe) :** non consultés (dérivation depuis benchmark + intent + exploration).
- **Proposition ratifiée :** aucune (raffinement forward suite à design-explorer, mode NORMAL).
