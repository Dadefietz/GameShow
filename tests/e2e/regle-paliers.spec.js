// E2E — LA RÈGLE DES PALIERS DIT LA VÉRITÉ SUR L'AXE.
//
// CE QUI A ÉTÉ RAPPORTÉ (12/09) : « dans le graphique des résultats, la ligne
// "± 0,5 s 500 pts" n'est pas bien calibrée, elle est raccourcie sur la droite
// (légende mal placée peut-être) ».
//
// LA PARENTHÈSE ÉTAIT JUSTE, ET C'EST ELLE QUI A DÉSIGNÉ LA CAUSE. L'étiquette
// d'un palier porte un FOND OPAQUE — il lui sert à rester lisible par-dessus les
// barres de l'histogramme — et elle est posée à la borne de son propre trait.
// Elle en recouvre donc la fin. Sur les paliers larges, le morceau caché se compte
// en dizaines de pixels : le trait de « ± 0,5 s » s'arrêtait visiblement AVANT
// celui de « ± 0,3 s », qu'il contient pourtant. Une plage emboîtée dessinée plus
// courte que la plage qu'elle contient, c'est un graphique qui ment.
//
// CE QUE CE CONTRÔLE MESURE :
//   1. l'EMBOÎTEMENT — chaque palier plus large que le précédent, des deux côtés ;
//   2. la SYMÉTRIE autour de la cible — un palier est « ± quelque chose » ;
//   3. l'ABSENCE DE RECOUVREMENT entre une étiquette et un trait, le sien comme
//      celui des autres. C'est la mesure qui aurait attrapé le défaut.
//
// SUR LES DEUX SURFACES. La console de l'animateur et la toile du stream
// dessinent la MÊME géométrie à deux tailles (`shared/echelle-estimation.js`).
// Un défaut de placement s'y produit des deux côtés, et se corrige une fois.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer, lancerJeu, creerJeu, retirerJeux } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.setTimeout(120_000);

test.describe('La règle des paliers', () => {
  let hote = null;
  let stream = null;
  const joueurs = [];

  test.afterEach(async () => {
    if (stream) { await stream.close().catch(() => {}); stream = null; }
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    for (const j of joueurs.splice(0)) await j.ctx.close();
    await retirerJeux('Règle —');
  });

  // « LE JUSTE TEMPS » plutôt qu'une estimation : ses paliers sont ABSOLUS
  // (± 0,1 s, ± 0,3 s, ± 0,5 s, ± 1 s), donc leurs bornes se calculent de tête et
  // le contrôle peut dire ce qu'il attend. C'est aussi le jeu de la capture.
  async function jouer(browser) {
    hote = await openHost(browser);
    for (const n of ['Chrono', 'Deuxieme']) joueurs.push(await joinAsPlayer(browser, hote.code, n));
    await expect(hote.page.getByTestId('player-count')).toHaveText('2');
    stream = await hote.ctx.newPage();
    await stream.setViewportSize({ width: 1920, height: 1080 });
    const token = await hote.page.evaluate(() => JSON.parse(localStorage.getItem('host')).overlayToken);
    await stream.goto(`/overlay?token=${token}`);
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await lancerJeu(hote.page, 'Le juste temps');
    await hote.page.getByTestId('jt-cache').fill('2.00');
    await hote.page.getByTestId('jt-cible').fill('5.00');
    await hote.page.getByTestId('jt-diffuser').click();
    // LES JOUEURS RÉPONDENT PRÈS DE LA CIBLE, ET C'EST INDISPENSABLE.
    //
    // L'échelle du graphique S'OUVRE pour contenir les réponses : deux joueurs qui
    // arrêtent le chrono aussitôt l'étirent jusqu'à onze secondes, les paliers s'y
    // écrasent à un cinquième de la largeur, et aucun n'approche plus le bord
    // droit — le défaut ne peut alors PAS se produire. Un contrôle vert dans ces
    // conditions n'aurait rien gardé du tout.
    //
    // En arrêtant vers 4,9 s, les deux réponses tombent dans le palier le plus
    // large : l'échelle se referme sur [4 s, 6 s], le palier « ± 1 s » occupe
    // toute la largeur, et son étiquette bascule vers la gauche — sur son propre
    // trait. C'est exactement la situation de la capture.
    for (const j of joueurs) {
      await expect(j.page.getByTestId('answer-submit')).toBeVisible({ timeout: 15_000 });
    }
    await joueurs[0].page.waitForTimeout(4_850);
    for (const j of joueurs) await j.page.getByTestId('answer-submit').click();
    await hote.page.getByRole('button', { name: /Révéler/ }).first().click();
    return stream;
  }

  // Relève, pour une surface, la géométrie de chaque ligne de la règle : le trait
  // et l'étiquette, en pourcentage du cadre — la seule unité comparable entre une
  // console de 1 200 px et une toile de 1 920.
  async function relever(page, prefixe) {
    return page.evaluate((p) => {
      const regle = document.querySelector(`.${p}__regle`);
      if (!regle) return null;
      const cadre = regle.getBoundingClientRect();
      const pct = (x) => ((x - cadre.left) / cadre.width) * 100;
      const lignes = [...regle.querySelectorAll(`.${p}__regle-ligne`)];
      // LE REPÈRE DE CIBLE, ET NON LE MILIEU DU CADRE. L'échelle s'ouvre pour
      // contenir les réponses : une réponse très éloignée la décentre, et c'est
      // voulu — le graphique doit montrer où le groupe s'est dispersé. La cible
      // n'est donc pas à cinquante pour cent, et c'est sur ELLE que la symétrie
      // des paliers se vérifie.
      const marque = document.querySelector(`.${p}__cible`);
      const cible = marque ? ((marque.getBoundingClientRect().left
        + marque.getBoundingClientRect().width / 2 - cadre.left) / cadre.width) * 100 : null;
      const boite = { h: cadre.top, b: cadre.bottom };
      return { cible, boite, lignes: lignes.map((ligne) => {
        const barre = ligne.querySelector(`.${p}__regle-barre`).getBoundingClientRect();
        const lbl = ligne.querySelector(`.${p}__regle-lbl`).getBoundingClientRect();
        return {
          nom: ligne.dataset.plage,
          texte: ligne.textContent.trim(),
          barre: { g: pct(barre.left), d: pct(barre.right), h: barre.top, b: barre.bottom },
          lbl: { g: pct(lbl.left), d: pct(lbl.right), h: lbl.top, b: lbl.bottom },
        };
      }) };
    }, prefixe);
  }

  function verifier(lignes, surface, cible, boite) {
    expect(lignes, `${surface} : aucune règle dessinée`).toBeTruthy();
    expect(lignes.length, `${surface} : quatre paliers attendus`).toBe(4);

    // 0. CHAQUE TRAIT EST ENTIÈREMENT DANS LA RÈGLE. Descendre le trait au bas de
    //    sa bande met le dernier au ras du cadre : un pixel de rognage de plus, et
    //    le palier le plus large disparaîtrait sans que personne ne le cherche.
    for (const l of lignes) {
      expect(l.barre.b,
        `${surface} : le trait de « ${l.texte} » dépasse du cadre de la règle`
        + ` (${l.barre.b.toFixed(0)} contre ${boite.b.toFixed(0)})`).toBeLessThanOrEqual(boite.b + 0.5);
      expect(l.barre.h,
        `${surface} : le trait de « ${l.texte} » sort par le haut`).toBeGreaterThanOrEqual(boite.h - 0.5);
    }

    // 1. L'EMBOÎTEMENT. Du plus étroit au plus large, chaque trait doit contenir
    //    le précédent — des DEUX côtés. C'est ce qui manquait : « ± 0,5 s »
    //    s'arrêtait avant « ± 0,3 s » sur sa droite.
    const ordre = ['mille', 'proche', 'correct', 'loin'];
    const par = new Map(lignes.map((l) => [l.nom, l]));
    for (let i = 1; i < ordre.length; i += 1) {
      const large = par.get(ordre[i]);
      const etroit = par.get(ordre[i - 1]);
      if (!large || !etroit) continue;
      expect(large.barre.g,
        `${surface} : « ${large.texte} » commence APRÈS « ${etroit.texte} » qu'il contient`)
        .toBeLessThanOrEqual(etroit.barre.g + 0.5);
      expect(large.barre.d,
        `${surface} : « ${large.texte} » s'arrête AVANT « ${etroit.texte} » qu'il contient`
        + ` (${large.barre.d.toFixed(1)}% contre ${etroit.barre.d.toFixed(1)}%)`)
        .toBeGreaterThanOrEqual(etroit.barre.d - 0.5);
    }

    // 2. LA SYMÉTRIE. Un palier est « ± quelque chose » : son trait doit être
    //    centré sur la CIBLE — pas sur le milieu du cadre, que l'échelle décale
    //    dès qu'une réponse s'éloigne.
    expect(cible, `${surface} : pas de repère de cible à quoi comparer`).not.toBeNull();
    for (const l of lignes) {
      const centre = (l.barre.g + l.barre.d) / 2;
      expect(Math.abs(centre - cible),
        `${surface} : « ${l.texte} » n'est pas centré sur la cible`
        + ` (centre ${centre.toFixed(1)}%, cible ${cible.toFixed(1)}%)`)
        .toBeLessThan(1.5);
    }

    // 3. AUCUNE ÉTIQUETTE NE RECOUVRE SON PROPRE TRAIT — et c'est la cause.
    //
    //    Chaque palier occupe SA ligne : une étiquette ne peut pas cacher le trait
    //    d'un autre palier, elles ne se croisent jamais. Ce qu'elle cache, c'est le
    //    sien. Son fond est OPAQUE — il lui sert à rester lisible par-dessus les
    //    barres de l'histogramme — et elle est ancrée à la borne de ce trait. Quand
    //    la borne approche du bord droit, l'étiquette bascule VERS LA GAUCHE pour
    //    ne pas sortir du cadre : elle se pose alors SUR la fin du trait, et le
    //    palier se lit plus court qu'il n'est. C'est ce que l'auteur a vu.
    //    DANS LES DEUX SENS. Une étiquette qui déborde horizontalement au-dessus
    //    de son trait ne le cache pas : elle est sur une autre bande. C'est le
    //    recoupement des deux axes qui fait le masquage — et c'est aussi la forme
    //    de la correction : on leur a donné chacune leur bande.
    for (const l of lignes) {
      const enX = Math.min(l.lbl.d, l.barre.d) - Math.max(l.lbl.g, l.barre.g);
      const enY = Math.min(l.lbl.b, l.barre.b) - Math.max(l.lbl.h, l.barre.h);
      const cache = enX > 0.3 && enY > 0.5;
      expect(cache,
        `${surface} : l'étiquette « ${l.texte} » couvre son propre trait`
        + ` — ${enX.toFixed(1)}% de largeur commune et ${enY.toFixed(1)}px de hauteur commune`)
        .toBe(false);
    }
  }

  // UNE ESTIMATION, POUR FORCER LE CAS. L'échelle du graphique S'OUVRE pour
  // contenir les réponses : une seule réponse lointaine l'étire, les paliers s'y
  // écrasent, aucun n'approche plus le bord droit — et le défaut ne peut PAS se
  // produire. Un contrôle vert dans ces conditions n'aurait rien gardé.
  //
  // Avec des réponses toutes proches de la cible, l'échelle se referme sur le
  // palier le plus large : celui-ci occupe alors TOUTE la largeur, son étiquette
  // bascule vers la gauche pour ne pas sortir du cadre, et se pose sur son propre
  // trait. C'est la situation de la capture, obtenue à coup sûr.
  async function estimer(browser, cible, valeurs) {
    await creerJeu({
      name: 'Règle — estimation',
      type: 'estimation',
      questions: [{ text: `Combien vaut la cible ?`, target: cible }],
    });
    hote = await openHost(browser);
    for (const [i] of valeurs.entries()) joueurs.push(await joinAsPlayer(browser, hote.code, `J${i}`));
    await expect(hote.page.getByTestId('player-count')).toHaveText(String(valeurs.length));
    stream = await hote.ctx.newPage();
    await stream.setViewportSize({ width: 1920, height: 1080 });
    const token = await hote.page.evaluate(() => JSON.parse(localStorage.getItem('host')).overlayToken);
    await stream.goto(`/overlay?token=${token}`);
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await lancerJeu(hote.page, 'Règle — estimation');
    for (const [i, j] of joueurs.entries()) {
      await expect(j.page.getByLabel('Ta réponse')).toBeVisible({ timeout: 15_000 });
      await j.page.getByLabel('Ta réponse').fill(String(valeurs[i]));
      await j.page.getByTestId('answer-submit').click();
    }
    await hote.page.getByRole('button', { name: /Révéler/ }).first().click();
  }

  test('LE PALIER LE PLUS LARGE — son étiquette ne se pose pas sur son trait', async ({ browser }) => {
    // Toutes les réponses dans le palier le plus large : l'échelle se referme sur
    // lui, il occupe 0 → 100 %, et son étiquette n'a plus de place à sa droite.
    await estimer(browser, 1000, [1000, 1010, 990]);
    await expect(hote.page.getByTestId('histo-plages')).toBeVisible({ timeout: 15_000 });

    const { cible: cc, boite: bc, lignes: console_ } = await relever(hote.page, 'histo');
    console.log('  console →', console_.map((l) => `${l.nom} ${l.barre.g.toFixed(0)}→${l.barre.d.toFixed(0)}%`).join('  '));
    const plusLarge = console_.find((l) => l.nom === 'loin');
    expect(plusLarge.barre.d,
      "le palier le plus large devrait toucher le bord droit : sans cela le cas n'est pas reproduit")
      .toBeGreaterThan(98);
    verifier(console_, 'console', cc, bc);

    await expect(stream.getByTestId('stream-histo-plages')).toBeVisible({ timeout: 15_000 });
    const { cible: ct, boite: bt, lignes: toile } = await relever(stream, 'st-histo');
    console.log('  stream  →', toile.map((l) => `${l.nom} ${l.barre.g.toFixed(0)}→${l.barre.d.toFixed(0)}%`).join('  '));
    verifier(toile, 'stream', ct, bt);
    if (process.env.PLANCHE) {
      await hote.page.locator('[data-testid="histogramme"]').screenshot({ path: '/tmp/regle-console.png' });
      await stream.locator('.st-histo').screenshot({ path: '/tmp/regle-stream.png' });
    }
  });

  test('« LE JUSTE TEMPS » — le cas rapporté, avec ses paliers en secondes', async ({ browser }) => {
    await jouer(browser);
    await expect(hote.page.getByTestId('histo-plages')).toBeVisible({ timeout: 15_000 });

    const { cible: cc, boite: bc, lignes: console_ } = await relever(hote.page, 'histo');
    console.log('  console →', console_.map((l) => `${l.nom} ${l.barre.g.toFixed(0)}→${l.barre.d.toFixed(0)}%`).join('  '));
    verifier(console_, 'console', cc, bc);

    await expect(stream.getByTestId('stream-histo-plages')).toBeVisible({ timeout: 15_000 });
    const { cible: ct, boite: bt, lignes: toile } = await relever(stream, 'st-histo');
    console.log('  stream  →', toile.map((l) => `${l.nom} ${l.barre.g.toFixed(0)}→${l.barre.d.toFixed(0)}%`).join('  '));
    verifier(toile, 'stream', ct, bt);
  });
});
