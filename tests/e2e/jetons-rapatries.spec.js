// Preuve de NON-RÉGRESSION VISUELLE : les trois jetons rapatriés doivent résoudre
// exactement la même couleur que les valeurs qu'ils remplacent. Un déplacement de
// valeur ne doit rien changer à l'écran — c'est ce qui le distingue d'un
// changement de design déguisé en rangement.
import { test, expect } from '@playwright/test';

const PAIRES = [
  ['--c-ember-ring',    'oklch(0.70 0.185 46 / 0.3)'],
  ['--c-veil-on-flame', 'oklch(0.19 0.03 50 / 0.22)'],
  ['--c-veil-on-leaf',  'oklch(0.18 0.03 150 / 0.22)'],
];

test('les jetons rapatriés rendent la couleur d\'origine, au caractère près', async ({ page }) => {
  await page.goto('/');
  for (const [jeton, litteral] of PAIRES) {
    const [avant, apres] = await page.evaluate(([j, l]) => {
      const a = document.createElement('div');
      const b = document.createElement('div');
      a.style.color = l;
      b.style.color = `var(${j})`;
      document.body.append(a, b);
      const r = [getComputedStyle(a).color, getComputedStyle(b).color];
      a.remove(); b.remove();
      return r;
    }, [jeton, litteral]);
    console.log(`  ${jeton} : ${apres}  (origine ${avant})`);
    expect(apres, `${jeton} ne rend pas la couleur d'origine`).toBe(avant);
  }
});
