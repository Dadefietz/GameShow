// E2E — LA POLICE DE LA CONSOLE (chantier v4, action 8, décision 8.5).
//
// CE QUI A ÉTÉ RAPPORTÉ : « la question en cours est affichée avec une police
// bizarre » sur l'écran de l'animateur.
//
// CE QUE C'ÉTAIT. L'énoncé employait `--f-display` — une grotesque CONDENSÉE
// (Avenir Next Condensed, Futura, DIN Alternate…), faite pour le stream vu à deux
// mètres en 84 ou 116 px. Le projet ne charge aucune police : le rendu dépend de
// la machine, et sur un Mac Avenir Next Condensed existe bel et bien. D'où une
// console dont l'énoncé était dessiné dans une police d'affiche, au milieu de
// texte d'interface.
//
// POURQUOI CE CONTRÔLE MESURE LA POLICE **CALCULÉE** ET NON LA DÉCLARATION.
// Chercher `--f-display` dans le CSS ne prouve rien : la valeur peut être héritée,
// écrasée par une règle plus spécifique, ou posée en ligne depuis le JSX. Seul
// `getComputedStyle` dit ce que le navigateur a RÉELLEMENT choisi de dessiner.
// C'est la règle du projet depuis le chantier v2 : on mesure le rendu, pas
// l'intention.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.setTimeout(90_000);

test.describe('La police de la console', () => {
  let hote = null;
  let joueur = null;

  test.afterEach(async () => {
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    if (joueur) { await joueur.ctx.close(); joueur = null; }
  });

  test('les textes de lecture emploient la pile d\'interface, pas celle d\'affiche', async ({ browser }) => {
    hote = await openHost(browser);
    joueur = await joinAsPlayer(browser, hote.code, 'Police');
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: 'Lancer Quiz' }).click();
    await expect(hote.page.getByTestId('question-text')).toBeVisible({ timeout: 15_000 });

    // Les deux piles, telles que le navigateur les résout — jamais recopiées à la
    // main dans le contrôle : si les jetons changent, le contrôle suit.
    // NORMALISATION. La valeur brute d'un jeton garde ses guillemets tels
    // qu'écrits (`"Avenir"`), là où `fontFamily` calculé les retire des noms d'un
    // seul mot (`Avenir`). Comparer les deux sans les mettre au même format fait
    // échouer le contrôle sur une différence de PONCTUATION, pas de police.
    const piles = await hote.page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const propre = (v) => v.trim().replace(/\s+/g, ' ').replace(/["']/g, '');
      return { ui: propre(cs.getPropertyValue('--f-ui')), display: propre(cs.getPropertyValue('--f-display')) };
    });
    expect(piles.ui, 'jeton --f-ui introuvable').not.toBe('');
    expect(piles.display, 'jeton --f-display introuvable').not.toBe('');
    expect(piles.ui, 'les deux piles sont identiques : le contrôle ne distinguerait rien')
      .not.toBe(piles.display);
    // La marque distinctive de la pile d'affiche : sa première famille. C'est elle
    // qu'on cherchera dans les polices calculées.
    const premiereAffiche = piles.display.split(',')[0].trim();

    async function police(page, sel) {
      return page.locator(sel).first().evaluate(
        (el) => getComputedStyle(el).fontFamily.trim().replace(/\s+/g, ' ').replace(/["']/g, ''),
      );
    }

    // ---- L'ÉNONCÉ (décision 8.1), puis la ligne « En cours » de la file
    // (décision 8.2). La bonne réponse révélée vient après la révélation.
    const releves = [
      ['énoncé', await police(hote.page, '.stage__question')],
      ['file — en cours', await police(hote.page, '.file__encours-texte')],
    ];

    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();
    await expect(hote.page.getByTestId('reveal-value')).toBeVisible({ timeout: 15_000 });
    releves.push(['bonne réponse', await police(hote.page, '.reveal__value')]);

    for (const [quoi, calculee] of releves) {
      console.log(`  ${quoi} → ${calculee.slice(0, 60)}…`);
      expect(calculee, `« ${quoi} » est dessiné dans la police d'affiche`)
        .not.toContain(premiereAffiche);
      expect(calculee, `« ${quoi} » n'emploie pas la pile d'interface`).toBe(piles.ui);
    }
  });

  test('le stream, lui, GARDE sa police d\'affiche', async ({ browser }) => {
    // Le revers du contrôle précédent. Déplacer toute la typographie vers la pile
    // d'interface passerait le premier contrôle et détruirait l'antenne : à deux
    // mètres, l'énoncé du stream a besoin d'une condensée. Décision 8.1 : « --f-display
    // reste au stream. »
    hote = await openHost(browser);
    joueur = await joinAsPlayer(browser, hote.code, 'Antenne');
    const stream = await hote.ctx.newPage();
    const token = await hote.page.evaluate(() => JSON.parse(localStorage.getItem('host')).overlayToken);
    await stream.goto(`/overlay?token=${token}`);
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: 'Lancer Quiz' }).click();

    const enonce = stream.locator('[data-bind="module.text"]').first();
    await expect(enonce).toBeVisible({ timeout: 15_000 });
    const { calculee, affiche } = await enonce.evaluate((el) => {
      const propre = (v) => v.trim().replace(/\s+/g, ' ').replace(/["']/g, '');
      return {
        calculee: propre(getComputedStyle(el).fontFamily),
        affiche: propre(getComputedStyle(document.documentElement).getPropertyValue('--f-display')),
      };
    });
    console.log(`  stream → ${calculee.slice(0, 60)}…`);
    expect(calculee, 'l\'énoncé du stream a perdu sa police d\'affiche').toBe(affiche);
  });
});
