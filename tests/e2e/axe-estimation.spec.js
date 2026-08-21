// E2E — L'AXE DE L'HISTOGRAMME, SUR LES DEUX ÉCRANS.
//
// CE QUI A ÉTÉ RAPPORTÉ : « aussi bien sur l'histogramme de l'animateur que sur
// l'histogramme du public il manque deux choses. Les valeurs des axes afin qu'on
// sache ce que chaque portion représente. Et aussi la valeur juste bien
// identifiée sur l'axe. Ainsi que les +/- 2, 10, 20 et 30 %. »
//
// CE QUE CE FICHIER MESURE, ET QU'AUCUN TEST UNITAIRE NE PEUT VOIR : que les
// valeurs sont RENDUES, et que le repère de la bonne réponse tombe à la bonne
// place en pixels — pas au centre d'une tranche large de plusieurs unités, comme
// c'était le cas quand « la cible » n'était qu'une barre colorée.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer, retirerJeux } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.setTimeout(90_000);

test.describe('L\'axe de l\'histogramme', () => {
  let hote = null;
  const joueurs = [];

  test.afterEach(async () => {
    // Les jeux fabriqués par ce fichier sont retirés : la bibliothèque est
    // PARTAGÉE, et dix contrôles lancent « le premier module de la liste ».
    await retirerJeux('Axe — ');
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    for (const j of joueurs.splice(0)) await j.ctx.close();
  });

  // Une question dont on connaît la cible : sans elle, l'axe ne serait comparable
  // à rien. Les questions livrées d'office ont des cibles très diverses.
  async function jeuAvecCible(page, nom, cible, annee = false) {
    await page.goto('/studio');
    await page.getByLabel('Gestion des modules')
      .getByRole('button', { name: 'Nouveau module' }).click();
    const ed = page.getByRole('complementary');
    await expect(ed).toBeVisible();
    await ed.getByLabel('Nom').fill(nom);
    await ed.getByRole('radiogroup', { name: 'Type' }).getByRole('radio', { name: 'Estimation' }).click();
    await ed.getByRole('button', { name: 'Ajouter une question' }).click();
    await ed.getByPlaceholder('Rédige la question').fill(`Cible ${cible} ?`);
    await ed.getByLabel('Cible').fill(String(cible));
    if (annee) await ed.getByRole('radio', { name: 'Année' }).click();
    await ed.getByRole('button', { name: /^Enregistrer$/ }).click();
    await expect(ed.locator('[data-bind="module.validation"]')).toHaveCount(0);
  }

  async function jouer(browser, nom, valeurs) {
    hote = await openHost(browser);
    for (const [i] of valeurs.entries()) joueurs.push(await joinAsPlayer(browser, hote.code, `J${i}`));
    await expect(hote.page.getByTestId('player-count')).toHaveText(String(valeurs.length));
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: `Lancer ${nom}` }).first().click();
    const stream = await hote.ctx.newPage();
    const token = await hote.page.evaluate(() => JSON.parse(localStorage.getItem('host')).overlayToken);
    await stream.goto(`/overlay?token=${token}`);
    await expect(joueurs[0].page.getByLabel('Ta réponse')).toBeVisible({ timeout: 15_000 });
    for (const [i, j] of joueurs.entries()) {
      await j.page.getByLabel('Ta réponse').fill(String(valeurs[i]));
      await j.page.getByTestId('answer-submit').click();
    }
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();
    return stream;
  }

  const nombres = (t) => t.match(/-?[\d\u202f\u00a0 ]*\d/g)?.map((n) => Number(n.replace(/[^\d-]/g, ''))) || [];

  test('les deux écrans portent les valeurs d\'axe, dans l\'ordre', async ({ browser, page }) => {
    const JEU = 'Axe — nombres';
    await jeuAvecCible(page, JEU, 100);
    const stream = await jouer(browser, JEU, [98, 101, 88, 135, 60]);
    await expect(stream.getByTestId('stream-histogramme')).toBeVisible({ timeout: 15_000 });

    for (const [quoi, axe] of [
      ['console', hote.page.getByTestId('histo-axe')],
      ['stream', stream.getByTestId('stream-histo-axe')],
    ]) {
      const ticks = await axe.locator('span').allInnerTexts();
      const vals = ticks.map((t) => Number(t.replace(/[^\d-]/g, '')));
      console.log(`  ${quoi} → ${ticks.join(' | ')}`);
      // CINQ repères : une borne de tranche sur deux, extrémités comprises.
      expect(vals.length, `${quoi} : pas de valeurs d'axe`).toBe(5);
      // STRICTEMENT CROISSANTS. Un axe qui repart en arrière ne situe plus rien.
      for (let i = 1; i < vals.length; i += 1) {
        expect(vals[i], `${quoi} : l'axe n'est pas croissant (${vals.join(', ')})`).toBeGreaterThan(vals[i - 1]);
      }
      // Et l'échelle contient la bonne réponse : sans cela, le repère de cible
      // serait forcément faux.
      expect(vals[0]).toBeLessThanOrEqual(100);
      expect(vals[vals.length - 1]).toBeGreaterThanOrEqual(100);
    }
  });

  test('la bonne réponse est marquée à sa place exacte, en pixels', async ({ browser, page }) => {
    const JEU = 'Axe — repère';
    const CIBLE = 100;
    await jeuAvecCible(page, JEU, CIBLE);
    const stream = await jouer(browser, JEU, [98, 101, 88, 135, 60]);
    await expect(stream.getByTestId('stream-histogramme')).toBeVisible({ timeout: 15_000 });
    await stream.waitForTimeout(800);

    for (const [quoi, cadre, repere, axe] of [
      ['console', hote.page.locator('.histo__cadre'), hote.page.getByTestId('histo-cible'), hote.page.getByTestId('histo-axe')],
      ['stream', stream.locator('.st-histo__cadre'), stream.getByTestId('stream-histo-cible'), stream.getByTestId('stream-histo-axe')],
    ]) {
      await expect(repere, `${quoi} : la bonne réponse n'est pas repérée sur l'axe`).toBeVisible();
      const boite = await cadre.boundingBox();
      const marque = await repere.boundingBox();
      const ticks = (await axe.locator('span').allInnerTexts()).map((t) => Number(t.replace(/[^\d-]/g, '')));
      const min = ticks[0];
      const max = ticks[ticks.length - 1];
      const attendu = boite.x + ((CIBLE - min) / (max - min)) * boite.width;
      const mesure = marque.x + marque.width / 2;
      console.log(`  ${quoi} → repère à ${Math.round(mesure - boite.x)} px, attendu ${Math.round(attendu - boite.x)} px (largeur ${Math.round(boite.width)})`);
      // Trois pixels de tolérance : bordures arrondies et arrondi du pourcentage.
      expect(Math.abs(mesure - attendu),
        `${quoi} : le repère de la bonne réponse est décalé`).toBeLessThan(4);
      // Et il porte la VALEUR, pas seulement un trait.
      expect(nombres(await repere.innerText()), `${quoi} : le repère ne dit pas la valeur`).toContain(CIBLE);
    }
  });

  test('les plages du barème sont annoncées, dans l\'ordre des points', async ({ browser, page }) => {
    const JEU = 'Axe — plages';
    await jeuAvecCible(page, JEU, 100);
    const stream = await jouer(browser, JEU, [98, 101, 88, 135, 60]);
    await expect(stream.getByTestId('stream-histo-plages')).toBeVisible({ timeout: 15_000 });

    for (const [quoi, legende] of [
      ['console', hote.page.getByTestId('histo-plages')],
      ['stream', stream.getByTestId('stream-histo-plages')],
    ]) {
      const cles = await legende.locator('span[class*="cle"]').allInnerTexts();
      const texte = cles.join(' ').replace(/\s+/g, ' ');
      console.log(`  ${quoi} → ${texte}`);
      for (const seuil of ['2 %', '10 %', '20 %', '30 %']) {
        expect(texte, `${quoi} : la plage ± ${seuil} n'est pas annoncée`).toContain(seuil);
      }
      // L'ORDRE DU BARÈME. Il partait de la LARGEUR DESSINÉE, bornée à l'échelle :
      // deux plages débordant du même côté finissaient à égalité et sortaient
      // « ± 2, ± 10, ± 30, ± 20 ».
      const ordre = ['2 %', '10 %', '20 %', '30 %'].map((s) => texte.indexOf(s));
      for (let i = 1; i < ordre.length; i += 1) {
        expect(ordre[i], `${quoi} : plages dans le désordre — ${texte}`).toBeGreaterThan(ordre[i - 1]);
      }
    }
  });

  test('sur une question en ANNÉES, l\'axe parle en années et jamais en pourcentage', async ({ browser, page }) => {
    // LE CONTRÔLE QUI INTERDIT LE POURCENTAGE RECOPIÉ. 2 % de 1789 valent
    // trente-six ans : un axe qui afficherait « ± 2 % » sur une année annoncerait
    // une plage vingt fois plus large que celle qui rapporte réellement.
    const JEU = 'Axe — années';
    await jeuAvecCible(page, JEU, 1789, true);
    const stream = await jouer(browser, JEU, [1789, 1791, 1780, 1810, 1750]);
    await expect(stream.getByTestId('stream-histo-plages')).toBeVisible({ timeout: 15_000 });

    for (const [quoi, legende] of [
      ['console', hote.page.getByTestId('histo-plages')],
      ['stream', stream.getByTestId('stream-histo-plages')],
    ]) {
      const texte = (await legende.innerText()).replace(/\s+/g, ' ');
      console.log(`  ${quoi} → ${texte}`);
      expect(texte, `${quoi} : un pourcentage sur une question en années`).not.toContain('%');
      expect(texte, `${quoi} : les plages en années ne sont pas annoncées`).toMatch(/ans/);
    }
  });
});
