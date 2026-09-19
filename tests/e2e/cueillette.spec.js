// E2E — « CUEILLETTE », de bout en bout.
//
// CE QUI SE GARDE ICI, ET QU'AUCUN AUTRE CONTRÔLE NE VERRAIT.
//
// Le module est déjà tenu par ailleurs : `cueillette.test.js` règle le barème sur
// une échelle de figures, et la boucle d'intégration suit les charges utiles d'un
// bout à l'autre du réseau. Ce fichier ne refait ni l'un ni l'autre. Il regarde
// trois choses qui n'existent QUE dans un navigateur :
//
//   1. LA CIBLE A UNE TAILLE. « Le Dessin cible doit prendre le maximum de place
//      sur l'écran. » Elle a mesuré 0 × 0 à l'antenne — présente dans le document,
//      son image chargée, et invisible : une hauteur en pourcentage dans une
//      chaîne d'éléments dont la hauteur dépendait du contenu. Rien, côté
//      serveur, ne pouvait s'en apercevoir ; la manche partait, les points
//      tombaient, et le public regardait un écran vide pendant dix secondes.
//      Corrigée une fois, la même boucle est revenue un étage plus haut.
//
//   2. LE DOIGT TRACE. La toile n'écoute que des événements de pointeur avec
//      capture ; un défaut de ce câblage ne se voit qu'en dessinant.
//
//   3. L'ÉCRAN NE SE CONTREDIT PAS. Il a montré le dessin du joueur par-dessus la
//      cible en écrivant dessous « pas de dessin envoyé ».
//
// LA CIBLE EST IMPOSÉE par l'animateur : sans cela, le tirage changerait de dessin
// à chaque exécution et le contrôle mesurerait un jour un chêne, le lendemain une
// tranche de pastèque.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer, lancerJeu } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.setTimeout(180_000);

const JEU = 'Cueillette';

test.describe('Cueillette', () => {
  let hote = null;
  const joueurs = [];
  let stream = null;

  test.afterEach(async () => {
    if (stream) { await stream.close().catch(() => {}); stream = null; }
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    for (const j of joueurs.splice(0)) await j.ctx.close();
  });

  async function annoncer(browser, pseudos = ['Crayon']) {
    hote = await openHost(browser);
    for (const p of pseudos) joueurs.push(await joinAsPlayer(browser, hote.code, p));
    stream = await hote.ctx.newPage();
    await stream.setViewportSize({ width: 1920, height: 1080 });
    const token = await hote.page.evaluate(() => JSON.parse(localStorage.getItem('host')).overlayToken);
    await stream.goto(`/overlay?token=${token}`);
    await expect(stream.getByTestId('stream-room-code')).toHaveText(hote.code);
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await lancerJeu(hote.page, JEU);
  }

  // DESSINER AVEC LA SOURIS, comme un doigt sur un téléphone : on descend, on
  // bouge, on relève. La toile ne prévient le dehors qu'au relevé.
  async function tracer(page, forme = 'carre') {
    const boite = await page.getByTestId('cueillette-toile').boundingBox();
    const P = (fx, fy) => [boite.x + boite.width * fx, boite.y + boite.height * fy];
    const chemins = forme === 'carre'
      ? [[[0.25, 0.25], [0.75, 0.25], [0.75, 0.75], [0.25, 0.75], [0.25, 0.25]]]
      : [[[0.4, 0.3], [0.6, 0.7]], [[0.6, 0.3], [0.4, 0.7]]];
    for (const trait of chemins) {
      const [x0, y0] = P(...trait[0]);
      await page.mouse.move(x0, y0);
      await page.mouse.down();
      for (const [fx, fy] of trait.slice(1)) {
        // Plusieurs pas par segment : un seul saut ne produirait que deux points,
        // et le tracé n'aurait pas de longueur mesurable.
        const [x1, y1] = P(fx, fy);
        for (let k = 1; k <= 8; k += 1) {
          const t = k / 8;
          await page.mouse.move(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
        }
        await page.mouse.move(x1, y1);
      }
      await page.mouse.up();
    }
  }

  test("LA CIBLE PREND LA PLACE QU'ON LUI PROMET, sur les deux écrans", async ({ browser }) => {
    await annoncer(browser);
    await expect(hote.page.getByTestId('depart-cueillette')).toBeVisible();

    // La cible est choisie, et non tirée : le contrôle doit mesurer deux fois le
    // même dessin.
    await hote.page.getByTestId('cu-famille-arbres').click();
    await hote.page.getByTestId('cu-dessin').first().click();
    await expect(hote.page.getByTestId('cu-cible')).toContainText('Cible :');
    await hote.page.getByTestId('cueillette-demarrer').click();

    const j = joueurs[0].page;
    const cibleJoueur = j.getByTestId('cueillette-cible');
    await expect(cibleJoueur).toBeVisible({ timeout: 20_000 });

    // ELLE A UNE TAILLE, ET C'EST UN CARRÉ. Le carré n'est pas un ornement : la
    // zone de dessin qui suit doit être « exactement la même taille », et les deux
    // ne peuvent l'être que si la forme est fixe.
    const surJoueur = await cibleJoueur.boundingBox();
    expect(surJoueur.width, 'la cible est invisible sur le téléphone').toBeGreaterThan(150);
    expect(Math.abs(surJoueur.width - surJoueur.height), 'la cible du joueur n’est pas carrée')
      .toBeLessThanOrEqual(2);

    // À L'ANTENNE : « le maximum de place sur l'écran ». Sur une toile de
    // 1920 × 1080, un carré qui prend la hauteur disponible dépasse largement la
    // moitié de la hauteur. C'est ce seuil, et non une valeur au pixel, qui
    // distingue « en grand » de « rogné » — et surtout de zéro.
    const surStream = stream.getByTestId('stream-cueillette-toile');
    await expect(surStream).toBeVisible({ timeout: 10_000 });
    const grande = await surStream.boundingBox();
    expect(grande.width, 'la cible est invisible à l’antenne').toBeGreaterThan(540);
    expect(Math.abs(grande.width - grande.height), 'la cible de l’antenne n’est pas carrée')
      .toBeLessThanOrEqual(2);

    // PUIS LA ZONE DE DESSIN, DE LA MÊME TAILLE QUE LA CIBLE. C'est la demande,
    // mot pour mot, et le joueur rejoue de mémoire un geste calé sur ce cadre.
    const toile = j.getByTestId('cueillette-toile');
    await expect(toile).toBeVisible({ timeout: 20_000 });
    const zone = await toile.boundingBox();
    expect(Math.abs(zone.width - surJoueur.width), 'la zone de dessin n’a pas la taille de la cible')
      .toBeLessThanOrEqual(2);
    expect(Math.abs(zone.height - surJoueur.height)).toBeLessThanOrEqual(2);

    // ET LA CIBLE A DISPARU DE L'ANTENNE : le stream est regardé en direct par des
    // gens qui jouent. La laisser reviendrait à la laisser aux joueurs.
    await expect(stream.getByTestId('stream-cueillette-toile')).toHaveCount(0);
    await expect(stream.getByTestId('question-text'))
      .toContainText('en train de cueillir');
  });

  test('LE DOIGT TRACE, et le dessin part', async ({ browser }) => {
    await annoncer(browser);
    await hote.page.getByTestId('cueillette-demarrer').click();

    const j = joueurs[0].page;
    await expect(j.getByTestId('cueillette-toile')).toBeVisible({ timeout: 25_000 });

    // Avant de dessiner : aucun trait, et rien à envoyer.
    await expect(j.locator('[data-testid="cueillette-toile"] polyline')).toHaveCount(0);
    await expect(j.getByTestId('answer-submit')).toBeDisabled();

    await tracer(j, 'carre');
    await expect(j.locator('[data-testid="cueillette-toile"] polyline')).toHaveCount(1);
    await expect(j.getByTestId('answer-submit')).toBeEnabled();

    // « ANNULER LE TRAIT » retire le dernier, « TOUT EFFACER » vide la toile.
    await tracer(j, 'croix');
    await expect(j.locator('[data-testid="cueillette-toile"] polyline')).toHaveCount(3);
    await j.getByTestId('toile-annuler').click();
    await expect(j.locator('[data-testid="cueillette-toile"] polyline')).toHaveCount(2);
    await j.getByTestId('toile-effacer').click();
    await expect(j.locator('[data-testid="cueillette-toile"] polyline')).toHaveCount(0);
    await expect(j.getByTestId('answer-submit')).toBeDisabled();

    await tracer(j, 'carre');
    await j.getByTestId('answer-submit').click();
    await expect(j.getByTestId('answer-submit')).toHaveText('Dessin envoyé');
  });

  // ==========================================================================
  // LE TÉLÉPHONE — CE QU'AUCUN DES CONTRÔLES CI-DESSUS NE POUVAIT VOIR
  // ==========================================================================
  //
  // Ils dessinent À LA SOURIS, dans une fenêtre d'ordinateur. Deux défauts sont
  // passés sous eux, tous deux rapportés par l'animateur en une phrase : « le
  // dessin au téléphone ne fonctionne pas, la zone de dessin disparaît ».
  //
  //   1. TOUT NE TENAIT PAS DANS L'ÉCRAN. Mesuré sur 375 × 553 — un téléphone
  //      courant, barre d'adresse comprise : la toile finissait neuf pixels sous
  //      le bord, les outils à 574, et le bouton d'envoi à 642, QUATRE-VINGT-NEUF
  //      PIXELS SOUS LE PLI. Et comme la toile porte `touch-action: none` pour
  //      qu'on puisse y tracer, glisser dessus DESSINE au lieu de faire défiler :
  //      le seul geste qui aurait permis d'atteindre le bouton est celui que le
  //      jeu confisque.
  //
  //   2. L'ÉCRAN ENTIER TOMBAIT — « TypeError: d.current is not iterable ». Le
  //      trait en cours était lu DANS la fonction de mise à jour de React, qui
  //      s'exécute plus tard : le doigt se levait entre-temps, la référence était
  //      déjà nulle, le rendu jetait, React démontait tout. Page noire au milieu
  //      des trente secondes.
  //
  // POURQUOI LA SOURIS NE LE VOYAIT PAS : un glissé de souris produit des
  // événements espacés et bien ordonnés ; un doigt qui trace vite en produit des
  // rafales que React regroupe, et c'est le regroupement qui ouvre la fenêtre.
  const TELEPHONE = { viewport: { width: 375, height: 553 }, hasTouch: true, isMobile: true };

  // UN DOIGT, ET IL SORT DU CADRE. La sortie est le geste qui déclenchait le
  // plantage, et c'est aussi celui que la capture de pointeur doit absorber : le
  // trait continue, borné au cadre.
  const doigt = (page) => page.evaluate(() => {
    const t = document.querySelector('.toile');
    const r = t.getBoundingClientRect();
    const ev = (type, fx, fy) => t.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, composed: true, pointerId: 1, pointerType: 'touch',
      isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1,
      clientX: r.left + r.width * fx, clientY: r.top + r.height * fy,
    }));
    ev('pointerdown', 0.25, 0.25);
    let [px, py] = [0.25, 0.25];
    for (const [fx, fy] of [[0.75, 0.25], [0.75, 0.75], [0.25, 0.75], [0.25, 0.25]]) {
      for (let k = 1; k <= 10; k += 1) ev('pointermove', px + (fx - px) * k / 10, py + (fy - py) * k / 10);
      [px, py] = [fx, fy];
    }
    t.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true, pointerId: 1, pointerType: 'touch' }));
    for (let k = 1; k <= 6; k += 1) ev('pointermove', 0.25 - k * 0.06, 0.25);
    ev('pointerup', 0.05, 0.25);
  });

  test('AU TÉLÉPHONE : tout tient dans l\'écran, et le doigt ne fait pas tomber la page', async ({ browser }) => {
    hote = await openHost(browser);
    joueurs.push(await joinAsPlayer(browser, hote.code, 'Pouce', TELEPHONE));
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await lancerJeu(hote.page, JEU);
    await hote.page.getByTestId('cueillette-demarrer').click();

    const j = joueurs[0].page;
    const dedans = async (quoi) => {
      const b = await j.getByTestId(quoi).boundingBox();
      const h = j.viewportSize().height;
      expect(b, `« ${quoi} » n'est pas à l'écran`).toBeTruthy();
      expect(Math.round(b.y + b.height),
        `« ${quoi} » finit sous le pli — l'écran fait ${h} px`).toBeLessThanOrEqual(h);
      return b;
    };

    // LA CIBLE, ENTIÈRE, DANS L'ÉCRAN.
    await expect(j.getByTestId('cueillette-cible')).toBeVisible({ timeout: 20_000 });
    const cible = await dedans('cueillette-cible');

    // PUIS LA ZONE DE DESSIN, DE LA MÊME TAILLE, ET TOUT CE QUI VA AVEC.
    await expect(j.getByTestId('cueillette-toile')).toBeVisible({ timeout: 20_000 });
    const toile = await dedans('cueillette-toile');
    expect(Math.abs(toile.width - cible.width),
      'la zone de dessin n\'a pas la taille de la cible sur un écran court')
      .toBeLessThanOrEqual(2);
    await dedans('toile-annuler');
    await dedans('answer-submit');

    // ET RIEN NE DÉBORDE : la page ne défile pas, puisque le doigt ne le peut pas.
    const debord = await j.evaluate(() => document.scrollingElement.scrollHeight - window.innerHeight);
    expect(debord, 'la page déborde, et le doigt ne peut pas la faire défiler').toBeLessThanOrEqual(1);

    // LE DOIGT TRACE, ET L'ÉCRAN SURVIT.
    const plantages = [];
    j.on('pageerror', (e) => plantages.push(String(e.message)));
    await doigt(j);
    await j.waitForTimeout(400);
    expect(plantages, `la page a planté pendant le tracé : ${plantages.join(' | ')}`).toEqual([]);
    await expect(j.getByTestId('cueillette-toile'), 'la zone de dessin a disparu').toBeVisible();
    await expect(j.locator('[data-testid="cueillette-toile"] polyline')).toHaveCount(1);
    await expect(j.getByTestId('answer-submit')).toBeEnabled();

    // LE TRAIT A CONTINUÉ APRÈS LA SORTIE DU CADRE — c'est le rôle de la capture,
    // et le brancher sur `pointerleave` revenait à la défaire.
    const points = await j.locator('[data-testid="cueillette-toile"] polyline')
      .evaluate((p) => p.getAttribute('points').split(' ').length);
    expect(points, 'le trait s\'est arrêté au bord du cadre').toBeGreaterThan(41);
  });

  test("LE BILAN NE SE CONTREDIT PAS : le tracé n'est montré que s'il a compté", async ({ browser }) => {
    await annoncer(browser);
    await hote.page.getByTestId('cu-famille-arbres').click();
    await hote.page.getByTestId('cu-dessin').first().click();
    await hote.page.getByTestId('cueillette-demarrer').click();

    const j = joueurs[0].page;
    await expect(j.getByTestId('cueillette-toile')).toBeVisible({ timeout: 25_000 });
    await tracer(j, 'carre');
    await j.getByTestId('answer-submit').click();

    // La manche se ferme d'elle-même au bout des trente secondes.
    await expect(j.getByTestId('cueillette-superpose')).toBeVisible({ timeout: 45_000 });
    await expect(j.getByTestId('cueillette-nom')).not.toBeEmpty();

    // LE DESSIN A COMPTÉ : la phrase annonce une ressemblance, et le tracé du
    // joueur est bien SUPERPOSÉ à la cible. Les deux vont ensemble ou ne vont pas.
    await expect(j.getByTestId('cueillette-ressemblance')).toContainText('ressemblance');
    await expect(j.locator('[data-testid="cueillette-superpose"] .toile__trait--sien'))
      .toHaveCount(1);

    // L'ANIMATEUR, LUI, A LE NOM — et personne d'autre. C'est la frontière du
    // projet : les pseudonymes ne quittent pas sa console.
    await expect(hote.page.getByTestId('cueillette-dessins')).toBeVisible({ timeout: 20_000 });
    await expect(hote.page.getByTestId('cueillette-dessins')).toContainText('Crayon');
    await expect(stream.locator('body')).not.toContainText('Crayon');

    // « PARTAGER ! » — le dessin passe à l'antenne, en grand, sans son auteur.
    await hote.page.getByTestId('cueillette-partager').first().click();
    const grand = stream.getByTestId('stream-cueillette-grand');
    await expect(grand).toBeVisible({ timeout: 10_000 });
    const boite = await grand.boundingBox();
    expect(boite.width, 'le dessin partagé n’est pas « en grand »').toBeGreaterThan(540);
    await expect(stream.locator('body')).not.toContainText('Crayon');
    // Il REMPLACE le graphique, il ne s'y ajoute pas.
    await expect(stream.getByTestId('stream-cueillette-histo')).toHaveCount(0);

    // Et l'animateur peut le reprendre.
    await hote.page.getByTestId('cueillette-partager').first().click();
    await expect(stream.getByTestId('stream-cueillette-grand')).toHaveCount(0);
    await expect(stream.getByTestId('stream-cueillette-histo')).toBeVisible();
  });
});
