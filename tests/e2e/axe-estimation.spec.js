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
      const cles = await legende.locator('[class*="regle-lbl"]').allInnerTexts();
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

  // ------------------------------------------------------------------
  // L'ÉCHELLE CONTIENT LE BARÈME (arbitrage de l'auteur : « étendre »).
  // ------------------------------------------------------------------
  const ETENDUES = [
    ['réponses au-dessus', [3000, 2600, 2900]],
    ['réponses en dessous', [400, 600, 500]],
    ['réponses des deux côtés', [900, 1600, 1300]],
  ];

  for (const [nom, valeurs] of ETENDUES) {
    test(`les quatre plages sont entières — ${nom}`, async ({ browser, page }) => {
      // CE QUI ÉTAIT FAUX, ET MESURÉ. L'échelle était tirée des seules RÉPONSES,
      // quand les plages sont une propriété de la QUESTION. Quand tout le monde
      // répondait au-dessus, seules les bornes HAUTES entraient dans le cadre :
      // l'écran écrivait « ± 10 % » à un endroit qui n'était que « +10 % ». Le
      // miroir se produisait en dessous. Et sur une étendue serrée, ± 30 % ne se
      // dessinait PAS DU TOUT tout en restant annoncé.
      const JEU = `Axe — ${nom}`;
      const CIBLE = 1235;
      await jeuAvecCible(page, JEU, CIBLE);
      const stream = await jouer(browser, JEU, valeurs);
      await expect(stream.getByTestId('stream-histogramme')).toBeVisible({ timeout: 15_000 });

      for (const [quoi, cadre] of [
        ['console', hote.page.locator('.histo__cadre')],
        ['stream', stream.locator('.st-histo__cadre')],
      ]) {
        const seuils = await cadre.locator('[data-seuil]').evaluateAll(
          (els) => els.map((e) => e.dataset.seuil));
        const parPlage = {};
        for (const n of seuils) parPlage[n] = (parPlage[n] || 0) + 1;
        console.log(`  ${quoi} · ${nom} → ${JSON.stringify(parPlage)}`);
        // QUATRE plages, DEUX bornes chacune. Une plage à une seule borne est un
        // « ± » qui ment ; une plage à zéro borne est une plage annoncée et
        // invisible.
        for (const plage of ['mille', 'proche', 'correct', 'loin']) {
          expect(parPlage[plage],
            `${quoi} · ${nom} : la plage « ${plage} » n'a pas ses deux bornes`).toBe(2);
        }
      }
    });
  }

  test('aucune étiquette n\'en cache une autre, sur aucune des deux surfaces', async ({ browser, page }) => {
    // L'AUTEUR L'A POSÉ EN RÈGLE : « il faut que toutes les infos soient visibles
    // et ne soient pas cachées. » Sur les captures qui ont motivé ce chantier, la
    // pastille de la bonne réponse recouvrait « ± 10 % », et les trois autres
    // libellés se touchaient — tous posés à la même hauteur au-dessus du
    // graphique. Ils vivent désormais dans une règle, une ligne par palier.
    const JEU = 'Axe — collisions';
    await jeuAvecCible(page, JEU, 1235);
    const stream = await jouer(browser, JEU, [3000, 2600, 2900]);
    await expect(stream.getByTestId('stream-histo-plages')).toBeVisible({ timeout: 15_000 });

    for (const [quoi, racine] of [
      ['console', hote.page.getByTestId('histogramme')],
      ['stream', stream.getByTestId('stream-histogramme')],
    ]) {
      const boites = await racine
        .locator('[class*="regle-lbl"], [class*="cible-val"], [class*="__tick"]')
        .evaluateAll((els) => els
          .filter((e) => e.checkVisibility?.())
          .map((e) => {
            const r = e.getBoundingClientRect();
            return { t: (e.textContent || '').replace(/\s+/g, ' ').trim(), x: r.x, y: r.y, w: r.width, h: r.height };
          }));
      expect(boites.length, `${quoi} : rien à mesurer`).toBeGreaterThan(5);
      const chevauche = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      const collisions = [];
      for (let i = 0; i < boites.length; i += 1) {
        for (let j = i + 1; j < boites.length; j += 1) {
          if (chevauche(boites[i], boites[j])) collisions.push(`« ${boites[i].t} » × « ${boites[j].t} »`);
        }
      }
      console.log(`  ${quoi} → ${boites.length} étiquettes, ${collisions.length} collision(s)`);
      expect(collisions, `${quoi} : des étiquettes se recouvrent — ${collisions.join(', ')}`).toEqual([]);
    }
  });

  test('les deux surfaces disent la même chose, dans le même ordre', async ({ browser, page }) => {
    // ARBITRAGE DE L'AUTEUR : « dans le développement il faut que les deux soient
    // similaires ». La géométrie est partagée (`echelle-estimation.js`), mais rien
    // n'empêcherait une surface de dériver — un libellé oublié, une plage peinte
    // d'un côté seulement. On l'ÉTABLIT au lieu de le supposer.
    const JEU = 'Axe — parité';
    await jeuAvecCible(page, JEU, 1235);
    const stream = await jouer(browser, JEU, [900, 1600, 1300]);
    await expect(stream.getByTestId('stream-histo-plages')).toBeVisible({ timeout: 15_000 });

    const releve = async (racine, prefixe) => ({
      ticks: (await racine.locator(`[data-testid$="histo-axe"] span`).allInnerTexts())
        .map((t) => t.replace(/\s+/g, '')),
      plages: (await racine.locator(`.${prefixe}__regle-ligne`).evaluateAll(
        (els) => els.map((e) => e.dataset.plage))),
      libelles: (await racine.locator(`.${prefixe}__regle-lbl`).allInnerTexts())
        .map((t) => t.replace(/\s+/g, ' ').trim()),
      zones: (await racine.locator(`.${prefixe}__plage`).evaluateAll(
        (els) => els.map((e) => e.dataset.plage))),
      cible: (await racine.locator(`.${prefixe}__cible-val`).first().innerText()).replace(/\s+/g, ''),
    });

    const console_ = await releve(hote.page.getByTestId('histogramme'), 'histo');
    const direct = await releve(stream.getByTestId('stream-histogramme'), 'st-histo');
    console.log(`  console → ${console_.plages.join(',')} | cible ${console_.cible}`);
    console.log(`  stream  → ${direct.plages.join(',')} | cible ${direct.cible}`);

    expect(direct.ticks, 'les axes ne portent pas les mêmes valeurs').toEqual(console_.ticks);
    expect(direct.plages, 'les paliers ne sont pas les mêmes, ni dans le même ordre').toEqual(console_.plages);
    expect(direct.libelles, 'les libellés diffèrent d\'une surface à l\'autre').toEqual(console_.libelles);
    expect(direct.zones, 'le fond n\'est pas peint sur les mêmes paliers').toEqual(console_.zones);
    expect(direct.cible, 'la bonne réponse n\'est pas la même').toEqual(console_.cible);
    // Et le fond n'est peint QUE pour le point de mire : quatre fonds empilés
    // noyaient les barres sous un aplat continu.
    expect(console_.zones, 'plus d\'un fond peint').toEqual(['mille']);
  });

  test('les deux surfaces emploient les MÊMES tailles de texte', async ({ browser, page }) => {
    // ARBITRAGE DE L'AUTEUR : « utilise vraiment les mêmes tailles de police que
    // sur l'animation ; je veux exactement le même histogramme entre les deux ».
    //
    // Le stream avait sa propre échelle typographique (`--fs-st-*`, pensée pour
    // deux mètres de recul). Elle est abandonnée POUR CE BLOC : la scène du stream
    // est un canevas 1920 ramené à l'échelle de la fenêtre, et tout y grandit dans
    // la même proportion. On mesure la police CALCULÉE, pas la déclaration.
    const JEU = 'Axe — tailles';
    await jeuAvecCible(page, JEU, 1235);
    const stream = await jouer(browser, JEU, [3000, 2600, 2900]);
    await expect(stream.getByTestId('stream-histogramme')).toBeVisible({ timeout: 15_000 });

    const tailles = (pg, prefixe) => pg.evaluate((p) => {
      const px = (sel) => {
        const e = document.querySelector(`.${p}${sel}`);
        return e ? getComputedStyle(e).fontSize : null;
      };
      return { tick: px('__tick'), etiquette: px('__regle-lbl'), points: px('__regle-pts'), cible: px('__cible-val') };
    }, prefixe);

    const console_ = await tailles(hote.page, 'histo');
    const direct = await tailles(stream, 'st-histo');
    console.log(`  console → ${JSON.stringify(console_)}`);
    console.log(`  stream  → ${JSON.stringify(direct)}`);
    for (const cle of Object.keys(console_)) {
      expect(console_[cle], `la console n'a pas de « ${cle} » à mesurer`).toBeTruthy();
      expect(direct[cle], `« ${cle} » : le stream n'emploie pas la taille de la console`).toBe(console_[cle]);
    }
  });

  test('chaque étiquette se tient contre son seuil, sans jamais sortir du cadre', async ({ browser, page }) => {
    // ARBITRAGE DE L'AUTEUR : « les étiquettes 20 % et 30 %, mets-les à droite de
    // la bande. En l'état ça ne signifie rien. » Elles étaient centrées sur leur
    // plage — un libellé flottant au milieu d'un long trait, rattaché à rien.
    // Elles s'ancrent désormais à la borne HAUTE. Quand cette borne touche le bord
    // du cadre — la plage la plus large, celle qui définit l'échelle — l'étiquette
    // bascule à sa gauche : contre le même seuil, sans déborder.
    const JEU = 'Axe — ancrage';
    await jeuAvecCible(page, JEU, 1235);
    // Réponses des DEUX CÔTÉS : c'est le cas où ± 30 % touche le bord droit.
    const stream = await jouer(browser, JEU, [900, 1600, 1300]);
    await expect(stream.getByTestId('stream-histo-plages')).toBeVisible({ timeout: 15_000 });

    for (const [quoi, pg, prefixe] of [
      ['console', hote.page, 'histo'], ['stream', stream, 'st-histo'],
    ]) {
      const releve = await pg.evaluate((p) => {
        const cadre = document.querySelector(`.${p}__regle`).getBoundingClientRect();
        return [...document.querySelectorAll(`.${p}__regle-ligne`)].map((ligne) => {
          const barre = ligne.querySelector(`.${p}__regle-barre`).getBoundingClientRect();
          const lbl = ligne.querySelector(`.${p}__regle-lbl`).getBoundingClientRect();
          return {
            plage: ligne.dataset.plage,
            // Distance entre le bord de l'étiquette et la BORNE HAUTE de la bande.
            ecart: Math.round(Math.min(Math.abs(lbl.left - barre.right), Math.abs(lbl.right - barre.right))),
            deborde: Math.round(Math.max(0, cadre.left - lbl.left, lbl.right - cadre.right)),
          };
        });
      }, prefixe);
      console.log(`  ${quoi} → ${releve.map((r) => `${r.plage}: écart ${r.ecart}px, déborde ${r.deborde}px`).join(' | ')}`);
      for (const r of releve) {
        // CONTRE le seuil : quelques pixels de marge typographique, pas davantage.
        // Centrée sur la bande, une étiquette de ± 30 % en serait à des centaines.
        expect(r.ecart, `${quoi} · ${r.plage} : l'étiquette flotte loin de son seuil`).toBeLessThan(12);
        expect(r.deborde, `${quoi} · ${r.plage} : l'étiquette sort du cadre`).toBe(0);
      }
    }
  });
});
