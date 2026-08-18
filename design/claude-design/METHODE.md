# Méthode — aligner une surface sur les maquettes Claude Design

<!-- Procédure éprouvée sur A1-A6. À suivre telle quelle pour S1-S4, E1-E4, J2-J6. -->

Les maquettes de `design/mockups/` sont écrites **en styles inline**. Elles ne
sont donc pas une illustration : elles **sont** la spécification, lisible
mécaniquement. Ne jamais « interpréter » une planche — en extraire les valeurs.

## 1. Lister les états d'un écran

```bash
grep -o 'data-screen-label="[^"]*"' design/mockups/A5.html
```

Chaque planche porte plusieurs canevas (repos, saisie, erreur, cas limite…).
Chacun est un état à reproduire, pas une variante décorative.

## 2. Extraire le contrat d'un état

```bash
python3 design/claude-design/spec.py design/mockups/A5.html "A5 direct options"
```

Sort l'arbre du canevas avec, pour chaque nœud : ses styles retenus
(`background`, `box-shadow`, `border-radius`, `padding`, `gap`, `font`,
`height`, `width`, `color`, `grid-template`…), ses annotations d'intégration
(`data-bind`, `data-action`, `data-testid`, `data-state`, `role`, `aria-label`)
et son texte. Les SVG sont filtrés.

Pour cibler : `| grep -E "grid-template|TEXTE|c-secret|box-shadow"`.

## 3. Comparer au rendu réel, pas au code

Le CSS peut être juste et le rendu faux (voir les pièges plus bas). **Lire le
code ne suffit pas** : une comparaison par `grep` de `data-state`/`data-bind`
a déjà conclu « conforme » sur un écran qui débordait de 450 px. Il faut
mesurer **les deux côtés** et les soustraire :

1. servir les planches en statique et mesurer chaque canevas
   (`getBoundingClientRect` sur chaque nœud porteur de dimension) ;
2. piloter l'app jusqu'au même état — par socket plutôt que par l'interface,
   c'est plus court et plus stable — et mesurer les mêmes nœuds ;
3. comparer grandeur par grandeur, et **chercher les débordements** : tout
   descendant dont `bottom`/`right` dépasse le canevas est un défaut, même si
   la capture « a l'air » correcte.

Refaire la mesure à **plusieurs tailles de fenêtre** : un écran juste à sa
taille nominale peut être faux partout ailleurs.

Servir l'app, puis mesurer dans le navigateur :

```js
const s = getComputedStyle(document.querySelector('.mon-element'));
({ taille: s.fontSize, poids: s.fontWeight, ombre: s.boxShadow, fond: s.backgroundColor })
```

Pour atteindre les écrans animateur sans lien magique :

```js
fetch('/api/rooms', { method:'POST', headers:{'content-type':'application/json'}, body:'{}' })
  .then(r => r.json())
  .then(s => { localStorage.setItem('host', JSON.stringify(
    { code: s.code, hostToken: s.hostToken, overlayToken: s.overlayToken })); location.href = '/host'; });
```

## 4. Corriger, vérifier à l'écran, puis livrer

```bash
npm run build && npx vitest run && npx playwright test && npm run test:integration
bash ~/.claude/hooks/check-convention.sh . design-builder
```

Un écart de libellé se répercute dans les tests E2E : **la planche fait foi**,
c'est le test qu'on aligne, pas l'inverse.

## Pièges rencontrés (tous ont produit un rendu faux avec un CSS juste)

| Piège | Symptôme | Correctif |
|---|---|---|
| Règle **hors cascade layer** | tous les boutons/champs en poids 400 | ordre `@layer` déclaré en tête de `tokens.css` ; tout reset dans `@layer reset` |
| Raccourci `font:` | un modificateur perd son `font-weight` | propriétés séparées sur les composants réutilisables |
| Classe utilisée sans règle | bouton natif gris/blanc | garde global dans le reset + vérifier chaque `className` |
| Deux classes sur le même nœud | `.live` annulait le `100dvh` de `.page` | sélecteur combiné (`.page.live`) |
| Tableau vide *truthy* | écran de fin qui ne se ferme pas | remettre à `null`, pas à `[]` |
| Canevas **élastique** là où la planche est **fixe** | proportions fausses dès que la fenêtre change de taille ; tout déborde | reproduire le canevas fixe et le mettre à l'échelle (`transform: scale`), jamais l'étirer |
| Texte d'exemple **court** dans la planche | tient en maquette, déborde avec la vraie donnée | rejouer chaque champ avec sa valeur de production (domaine, pseudo long) |

## Ce qui varie d'un écran à l'autre

Certains écrans ne demandent que des **valeurs** (A1 : deux écarts). D'autres
demandent de refaire la **structure entière** (A3 : j'avais réutilisé une carte
là où la planche montre une page à bandeau). On ne sait pas lequel avant
d'avoir comparé — toujours extraire la spec avant d'estimer.

## Avancement

- **Faits** : A1, A2, A3, A4, A5, A6
- **Restent** : S1-S4 (stream), E1-E4 (studio), J2-J6 (joueur — J1 fait)
