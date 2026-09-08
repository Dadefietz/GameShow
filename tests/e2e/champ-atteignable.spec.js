// E2E — LES CHAMPS SONT ATTEIGNABLES AU DOIGT.
//
// CE QUI A ÉTÉ MESURÉ. Sur l'écran d'accueil, la plaque du pseudo fait 335 × 68
// px — large, visible, engageante. Le champ QU'ELLE CONTIENT n'en offrait que 24
// de haut : `align-items: center` posait l'`<input>` à sa hauteur de texte au
// milieu d'une plaque quatre fois plus haute, et la plaque, un simple `<div>`,
// ne renvoyait rien au champ. Les 44 px restants ne faisaient rien. Le projet
// s'impose pourtant un plancher, écrit dans ses jetons : `--row-form: 52px`.
//
// POURQUOI C'EST GRAVE ICI PLUTÔT QU'AILLEURS. C'est le PREMIER geste du jeu, sur
// un téléphone, souvent debout, souvent pressé — et le seul écran où un raté ne
// se rattrape pas : un joueur qui n'arrive pas à saisir son pseudo n'entre pas
// dans la partie, et ne le dira à personne.
//
// CE QUE CE CONTRÔLE MESURE : la hauteur RÉELLEMENT ATTEIGNABLE de chaque champ
// de saisie, c'est-à-dire la boîte du champ lui-même — pas celle de la plaque qui
// l'entoure. C'est la distinction que l'œil ne fait pas, et c'est exactement là
// que le défaut se logeait.
import { test, expect } from '@playwright/test';

// Le plancher du projet, lu dans les jetons plutôt que recopié : le jour où il
// monte, le contrôle monte avec lui.
async function plancher(page) {
  return page.evaluate(() => parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--row-form')));
}

test.describe('Les champs de saisie sont atteignables', () => {
  test('chaque champ de l\'écran d\'accueil tient le plancher du projet', async ({ page }) => {
    await page.goto('/');
    const min = await plancher(page);
    expect(min, '--row-form introuvable dans les jetons').toBeGreaterThan(0);

    const champs = await page.locator('input:visible').all();
    expect(champs.length, 'aucun champ sur l\'écran d\'accueil').toBeGreaterThan(0);

    for (const champ of champs) {
      const nom = await champ.getAttribute('data-testid')
        || await champ.getAttribute('aria-label') || await champ.getAttribute('id');
      const b = await champ.boundingBox();
      // Consigné : c'est le chiffre qui dit s'il faut remonter, pas le verdict.
      console.log(`  ${nom} — ${b.width.toFixed(0)} × ${b.height.toFixed(0)} px atteignables`);
      expect(b.height, `« ${nom} » n'offre que ${b.height.toFixed(0)} px au doigt`)
        .toBeGreaterThanOrEqual(min);
    }
  });

  test('toute la plaque du pseudo appartient au champ, bord à bord', async ({ page }) => {
    // L'AUTRE MOITIÉ DU DÉFAUT. Une plaque peinte qui ne réagit pas au doigt est
    // pire qu'une petite cible : elle en PROMET une grande. Le joueur vise le
    // rectangle qu'il voit, rien ne se passe, et il croit l'écran figé.
    //
    // ON SONDE LES QUATRE BORDS EN LEUR MILIEU, à trois pixels du bord — et NON
    // les coins : la plaque est arrondie (--r-m), un point à trois pixels d'un
    // coin tombe hors de la forme peinte. Une sonde qui vise à côté rougirait
    // sur une cible parfaite, et on la « corrigerait » en la déplaçant.
    //
    // Ces quatre points suffisent à voir le défaut : le champ ne faisait que 27
    // px de haut au milieu d'une plaque de 68 — le haut et le bas le manquaient —
    // et le bord droit est celui que le compteur « 0/20 » recouvrait.
    await page.goto('/');
    const plaque = page.locator('.field-shell');
    await expect(plaque).toBeVisible();
    const b = await plaque.boundingBox();

    for (const [nom, x, y] of [
      ['bord haut', b.x + b.width / 2, b.y + 3],
      ['bord bas', b.x + b.width / 2, b.y + b.height - 3],
      ['bord gauche', b.x + 3, b.y + b.height / 2],
      ['bord droit (le compteur)', b.x + b.width - 3, b.y + b.height / 2],
    ]) {
      await page.mouse.click(x, y);
      const cible = await page.evaluate(() => document.activeElement?.dataset?.testid || null);
      expect(cible, `un appui sur le ${nom} de la plaque n'atteint pas le champ`)
        .toBe('join-pseudo');
      await page.locator('body').click({ position: { x: 2, y: 2 } });
    }
  });
});
