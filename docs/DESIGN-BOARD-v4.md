---
artifact_type: design_board
app: root
version: 4
change_set: forward
produced_by: design-board
created_at: 2026-08-18
created_by: design-board
status: validated
supersedes: 3
source: claude-design/cc29109f-93eb-48ca-840f-fb60118f438c
---

# Design board v4 — Project Game Show

**Supersede** la v3 « feu-de-camp convivial ». La v4 est la charte du projet : toute
nouvelle page, tout nouveau type de jeu doit s'y conformer.

- **Planches de référence** : [`design/design-board.html`](../design/design-board.html) (page Système)
- **Source unique des valeurs** : [`design/tokens/tokens.css`](../design/tokens/tokens.css) (v2, 18 sections)
- **Écrans** : [`design/design-manifest.yaml`](../design/design-manifest.yaml) → 20 maquettes dans `design/mockups/`
- **Origine** : projet Claude Design `cc29109f-93eb-48ca-840f-fb60118f438c`

---

## 1. L'intention

Camping, feu de bois, nuit tombée. Pas « soirée jeux TV clinquante » : on est assis
autour d'un foyer et l'émission se joue là. Cette phrase tranche toutes les décisions
qui suivent — si un élément ne tient pas dans cette image, il sort.

**La nuit autour, le feu comme seule source.** Un écran porte **un seul geste
lumineux** : `--g-hearth` (le foyer, chaleur montant du bas) **ou** `--g-dusk` (le
crépuscule, froid et en retrait). Jamais les deux. `--g-dusk` marque les moments où
l'on est hors du jeu : salon expiré, erreur, partie close sans manche.

## 2. Couleur — trois familles, jamais plus

| Famille | Teintes OKLCH | Rôle |
|---|---|---|
| **Feu** | 30–85 | braise, flamme, lueur — l'action, la chaleur, le score |
| **Bois** | 45–75 | fonds, surfaces, encres — la structure |
| **Feuille** | 135–160 | mousse, pin, fougère — le juste, le validé, le connecté |

`--c-bad` est la seule sortie de ces trois familles, et seulement pour l'erreur.

### La prune est réservée

`--c-secret` (prune) ne sert **qu'à une chose** : marquer ce que le public ne voit pas.
Classement en direct, panneau bonus/malus, lien stream, rangs 4-8 — tout ce qui est
« toi et le stream uniquement ». Cette couleur n'a aucun autre usage décoratif.

Elle est doublée d'un **second signal non chromatique** : `--tex-secret`, une hachure
appliquée en `background-image`. Un daltonien voit la zone privée à la texture. Au
moment de la révélation, la classe passe en `.private--public` : la hachure et la
teinte prune disparaissent ensemble — le changement d'état est lisible sans la couleur.

## 3. Typographie — deux échelles parallèles

Aucune police à charger. Piles substituables uniquement.

- `--f-display` : grotesque condensée (Avenir Next Condensed / Futura / DIN) — titres, rangs, codes
- `--f-ui` : humaniste système — corps, libellés
- `--f-mono` : chiffres, scores, codes de salon, compteurs

Deux échelles **qui ne se mélangent pas** :

- `--fs-100 … --fs-1000` : surfaces **joueur, animateur, studio** (lecture à 40 cm)
- `--fs-st-*` : surface **stream** (lecture à 3 m, sur un flux compressé)

Un canvas stream qui utilise `--fs-400` est un bug de design, pas un choix.
Les légendes hors-canvas des planches sont l'exception admise.

Le **chrono a deux tailles** : normale, puis agrandie au passage sous
`--urgent-threshold`. C'est le seul élément de l'interface autorisé à changer de taille
en cours de vie.

## 4. Espace et relief

Le relief vient de l'ombre, jamais du trait. `--sh-1 … --sh-3` pour l'élévation,
`--sh-edge` pour le liseré, `--sh-inset` pour les champs creusés, `--sh-ember` /
`--sh-pine` pour les lueurs colorées. Les bordures se limitent à `--bw-hair` sur les
séparateurs structurels.

Cibles : **44 px** au tactile (`--hit`), **40 px** au pointeur (`--hit-dense`).
Focus : anneau flamme de 3 px, jamais supprimé.

## 5. Mouvement

**Tout entre par le bas et s'apaise.** Rien ne rebondit, rien ne clignote — à une
exception près : l'urgence du chrono.

| Token | Durée | Usage |
|---|---|---|
| `--mo-fast` | 140 ms | retour tactile immédiat |
| `--mo-base` | 240 ms | changement d'état d'un composant |
| `--mo-slow` | 420 ms | apparition d'un bloc |
| `--mo-scene` | 640 ms | changement de scène (podium, révélation) |

Keyframes nommées `om-*` : `om-rise`, `om-pop`, `om-flame`, `om-spark`, `om-ember-rise`,
`om-flicker`, `om-breathe`, `om-draw`, `om-shimmer`, `om-spin`.

## 6. Icônes

SVG au trait, inline, `stroke-width` 1.6–2.2 selon la taille. **Jamais d'emoji** —
règle dure du dépôt (`[CONVENTIONS] no_emoji: true`).

## 7. Règles de produit portées par le design

Ce ne sont pas des choix esthétiques : ce sont des décisions produit que le design
rend visibles, et qu'aucune évolution ne doit défaire.

1. **Le joueur ne voit jamais son rang en cours de partie.** J4 montre les points
   gagnés et les places gagnées/perdues. Le rang n'apparaît qu'en J5, à la fin — c'est
   pour ça qu'il y est le plus gros élément de l'écran.
2. **Une seule action dominante à la fois** sur la barre du pilotage (A5) : révéler,
   puis question suivante. Les sorties dangereuses vivent dans le menu, en deux temps.
3. **Toute action irréversible se confirme en deux temps**, avec la conséquence écrite
   en toutes lettres, et se ré-arme au bout de 4 s.
4. **Le stream porte en permanence** code, QR et lien : un spectateur qui arrive à
   n'importe quel moment peut entrer.
5. **Une erreur nomme son remède.** Jamais « une erreur est survenue » : ce qui s'est
   passé, ce qu'on peut faire, et le bouton pour le faire.
6. **Un état se lit sans la couleur** — forme, poids, texture ou libellé le doublent.

## 8. Ce qui fait respecter la charte

| Mécanisme | Ce qu'il empêche |
|---|---|
| `tokens.css` source unique | une valeur de design écrite ailleurs |
| `check-convention.sh` (Phase Z) | couleur / espacement / police en dur dans `src/` |
| Bijection manifeste ↔ `design/mockups/` | un écran livré sans maquette, une maquette orpheline |
| `AGENTS.md [DESIGN]` / `[ASSETS]` | un agent qui devine les chemins ou la direction |
| `data-testid` préservés | un redesign qui casse silencieusement les tests |

**Pour toute nouvelle page ou tout nouveau jeu** : lire `design/design-board.html`,
n'utiliser que des tokens existants, ajouter l'écran au manifeste **avec sa maquette**,
et vérifier les six règles de la section 7.
