---
artifact_type: design_board
app: root
version: 1
change_set: none
produced_by: design-board
---
# DESIGN BOARD — Project Game Show

## 1. Intent & audience

- **Adjectifs d'intent :** Spectaculaire, Énergique, Premium (USER-NEEDS `design_feeling`).
- **Domaine :** jeu télévisé interactif en livestream (créatif / entertainment / gaming).
- **Audience :** deux profils opposés à servir d'un même langage — l'**animateur** sur desktop (poste de pilotage dense, en direct, sous OBS) et le **viewer-joueur** sur mobile (manette minimale, grand public, tout âge). Plus une troisième surface non interactive : les **overlays OBS** vus par toute l'audience du stream.
- **Conventions du benchmark (sourcées) :** (1) séparation « écran-scène / téléphone-manette minimaliste », l'écran porte le contenu et les gros résultats, le téléphone une saisie réduite (source: https://kahoot.fandom.com/wiki/Quiz) ; (2) overlays stream sur fond transparent, typographie large et contrastée, motion pour les révélations (source: https://obsproject.com/kb/browser-source). Le marché du streaming est massivement violet (Twitch) — signature à assumer puis singulariser par un accent néon.

## 2. Vibe & signature

Hiérarchie d'adjectifs : **Spectaculaire** (dominant) → **Énergique** → **Premium** → net → lisible-en-live.

**Élément signature — « le grand chiffre néon qui explose ».** Le moment qu'on retient : un chiffre géant en display (réponses reçues, score, compte à rebours, points gagnés) qui surgit et pulse avec un halo **cyan néon** sur un violet-noir profond de plateau. C'est l'ADN visuel directement issu de la maquette (les énormes « 832 » / « 1 250 pts ») : tout l'écran respire autour de ce chiffre. Partout ailleurs l'UI se tient sobre et sombre pour que ce moment ait tout l'espace dramatique.

## 3. Palette OKLCH

UI **dark-first** (plateau télé). Format `oklch(L C H)`.

**Ancrage.** Hue = **300** (violet-magenta) — table domaine « créatif/entertainment/gaming » = 280–320 ; 300 assume la convention streaming (Twitch) tout en restant distinctif. Chroma d'ancrage = **0.18** (registre « énergique/audacieux » = 0.15–0.22, tempéré côté haut pour le « premium »). Ancre `primary-500 = oklch(0.62 0.18 300)`.

**Échelle primary (9 teintes, chroma en cloche, H=300 constant) :**

| Cran | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 |
|---|---|---|---|---|---|---|---|---|---|
| OKLCH | 0.95 0.054 | 0.88 0.090 | 0.79 0.130 | 0.70 0.162 | 0.62 0.180 | 0.53 0.180 | 0.44 0.158 | 0.35 0.130 | 0.26 0.099 |

**Échelle neutral (9 teintes, teintées H=300, C=0.012 — « appartiennent » à la marque) :**

| Cran | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 |
|---|---|---|---|---|---|---|---|---|---|
| OKLCH | 0.95 0.012 | 0.88 0.012 | 0.79 0.012 | 0.70 0.012 | 0.62 0.012 | 0.53 0.012 | 0.44 0.012 | 0.35 0.012 | 0.26 0.012 |

**Surfaces dark-first (neutres profonds étendus, jamais noir pur) :** `bg-deep = oklch(0.17 0.014 300)` (fond de plateau) · `bg-surface = oklch(0.22 0.014 300)` (cartes) · `bg-elevated = oklch(0.27 0.016 300)` (éléments surélevés).

**Accent signature — glow-cyan** (rôle : chiffres signature, halos de révélation, focus ring, points chauds de CTA sur fond sombre) : `accent = oklch(0.82 0.15 195)` · `accent-deep = oklch(0.72 0.17 195)` (remplissages). Duo violet + cyan néon = signature « stream/plateau ». ΔH(300,195)=105° → aucune collision avec primary.

**4 couleurs sémantiques :**

| Rôle | OKLCH | ΔH vs primary(300) |
|---|---|---|
| success | `oklch(0.62 0.15 150)` | 150° |
| warning | `oklch(0.80 0.16 85)` | 145° |
| danger | `oklch(0.65 0.21 27)` | 87° |
| info | `oklch(0.64 0.14 240)` | 60° |

Toutes ≥ 25° de la primary : pas de collision. `info` (240) et `accent` (195) distants de 45° et de rôles disjoints (info = message système ; accent = emphase signature).

**Contrastes WCAG — calculés (script OKLCH→sRGB→ratio), jamais estimés :**

| Paire (dark-first) | Ratio | Verdict |
|---|---|---|
| texte principal `neutral-100` / `bg-deep` | 16.51:1 | AAA |
| texte secondaire `neutral-300` / `bg-deep` | 9.88:1 | AAA |
| texte `neutral-100` / `bg-surface` | 14.96:1 | AAA |
| texte blanc / action `primary-600` | 5.58:1 | AA |
| titre display `primary-300` / `bg-deep` (large) | 9.48:1 | AAA |
| chiffre signature `accent` / `bg-deep` (large) | 11.77:1 | AAA |
| texte `accent` / `bg-deep` | 11.77:1 | AAA |
| `success` / `bg-deep` | 5.61:1 | AA |
| `warning` / `bg-deep` | 10.14:1 | AAA |
| `danger` / `bg-deep` | 5.37:1 | AA |
| `info` / `bg-deep` | 5.79:1 | AA |
| focus ring `accent` / `bg-surface` (graphique) | 10.67:1 | AAA |

**Règles de token :** le texte blanc sur remplissage primary exige **`primary-600` minimum** (`primary-500` = 3.82:1, réservé aux grands aplats/halos, jamais au petit texte). Mode clair optionnel (surface Studio admin) : `neutral-900`/`neutral-100` = 13.43:1 (AAA), `neutral-700`/`neutral-100` = 6.72:1 (AA) — vérifiés.

## 4. Typographie

Registre : **expressif-brutal** tempéré premium (adjectifs « spectaculaire/énergique/audacieux » avec une exigence de lisibilité live). 2 familles + 1 mono.

| Famille | Rôle | Source | Licence | Justification |
|---|---|---|---|---|
| **Unbounded** | display (titres, chiffres signature, reveals) | google-fonts | OFL | Display géométrique large et rond, très « plateau/entertainment » : porte le chiffre néon signature avec impact — incarne « spectaculaire ». |
| **Archivo** | texte / UI (dashboard, manette, labels) | google-fonts | OFL | Grotesque de labeur, immense éventail de graisses et une version condensée : dense et calme pour le poste animateur, lisible à 14-16px sur mobile — porte le « premium » et sert de contraste sobre à Unbounded. |
| **JetBrains Mono** | données (scores, timer, code de salon) | google-fonts | OFL | Chiffres tabulaires nets (`tabular-nums`) : lisibilité chiffrée sans ambiguïté sur les scores/classements en direct, priorité à la clarté sur le décor. |

Appariement vérifié : contraste de forme fort (display rond expressif vs grotesque neutre), x-heights compatibles, graisses suffisantes (Archivo 400/500/600/700, Unbounded 600/800), diacritiques latin étendu (français) couverts.

## 5. Motion

Philosophie : **vif-rebondi (variante plateau)** — mapping des adjectifs « énergique/vivant/spectaculaire ». Rapide et réactif au quotidien, avec un unique registre d'emphase dramatique réservé aux révélations.

- **Durées de référence :** fast **100 ms** (feedback) · base **180 ms** (transitions locales) · slow **260 ms** (navigation, panneaux). Emphase de révélation exceptionnelle jusqu'à **600 ms** (reveal de réponse, montée du leaderboard, podium) — rare et intentionnelle, jamais sur une interaction fréquente.
- **feedback** (press buzzer, hover, focus, toggle) : confirmer sans distraire — `fast`, scale ≤ 1.03 + halo accent, léger overshoot toléré au press.
- **navigation** (changement de module, ouverture d'overlay, drawer host) : donner la géographie — `slow`, entrée décélérée, sortie ~60 % de la durée d'entrée.
- **emphasis** (révélation, podium, chiffre signature) : le SEUL endroit où la personnalité explose — apparition du grand chiffre avec pulse de halo cyan, stagger du classement ; ≤ 600 ms, rare.
- **prefers-reduced-motion :** sous `reduce`, toute translation/scale/rotation est supprimée (durée 0) ; seuls des fondus d'opacité ≤ 150 ms subsistent. Aucune information (bonne réponse, gain de points, changement de rang) n'est portée UNIQUEMENT par le mouvement — toujours doublée par couleur/texte.

## 6. Accessibilité

- **Cible :** WCAG 2.2 **AA** (contrastes ci-dessus atteints, la plupart AAA). Overlays OBS exemptés d'interaction (display-only) mais conservent des contrastes AA large pour rester lisibles sur n'importe quel fond de gameplay.
- **touch_target_min : 44 px** — critique sur la surface manette mobile (buzzers, boutons de réponse), une action visible à la fois.
- **focus_ring :** `2px solid accent (glow-cyan)`, offset 2px — haute visibilité sur fond sombre (10.67:1), jamais supprimé.
- **dark_mode : true (dark-first).** Le plateau EST sombre par nature ; le mode clair n'existe que pour la surface **Studio** (gestion de contenu admin), re-dérivé (fonds `neutral-100`, textes `neutral-900`) et non inversé. Sur fond sombre, les couleurs d'action sont remontées d'un cran (usage de `primary-500/400` pour les aplats, texte sur `primary-600+`).

## 7. Seeds & provenance

- **USER-NEEDS-v1** — adjectifs d'intent (Spectaculaire, Énergique, Premium), personas, feeling « game-show TV » : source d'ancrage de toute la direction.
- **DESIGN-DOMAIN-EXPLORE-v1** — conventions du domaine : split écran-scène/manette (source: https://kahoot.fandom.com/wiki/Quiz), overlays OBS transparents + typo large + motion de reveal (source: https://obsproject.com/kb/browser-source), duo violet dominant du marché streaming.
- **Maquette fournie** (`PHOTO-2026-07-22-19-48-14.jpg`) — seed direct du signature visuel : violet/néon, chiffres géants, contraste sombre, énergie de plateau.
- **MCP design consultés :** aucun (Figma/Canva/Adobe non connectés à ce run) — dérivation intégrale depuis benchmark + intent, conformément au repli.
- **Proposition ratifiée :** aucune (premier board, mode NORMAL).
