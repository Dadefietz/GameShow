// E2E — LA FILE, LISIBLE ET MANIPULABLE (chantier v2, actions 3 et 4).
//
// CE QUI A ÉTÉ RAPPORTÉ EN TEST : « Le positionnement de la playlist de question
// ne permet à l'animateur ni de lire les questions, ni de réellement savoir ce
// qu'il fait. » Chaque ligne affichait « Q. ».
//
// LA CAUSE. La file vivait dans la colonne latérale de 336 px. Trois commandes
// au plancher tactile de 44 px y consomment 132 px, plus la poignée, le numéro,
// les gouttières et le rembourrage. Il restait quelques dizaines de pixels à
// l'énoncé. Et `overflow: hidden` sur le texte ramenait à ZÉRO le minimum
// automatique de sa colonne de grille : elle se laissait comprimer EN SILENCE,
// au lieu de déborder — ce qui se serait vu.
//
// CE QUE CE FICHIER MESURE, et que rien ne mesurait :
//   - combien de caractères d'un énoncé sont RÉELLEMENT lisibles ;
//   - combien de lignes sont visibles sans défiler ;
//   - où se trouve la barre d'actions par rapport au pli — c'est le vrai enjeu
//     du nombre de lignes : en direct, perdre « Question suivante » coûte plus
//     cher que défiler ;
//   - qu'un glisser n'envoie QU'UN message et déplace vraiment la ligne.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.describe('La file dans la colonne centrale', () => {
  let hote = null;
  let joueur = null;

  test.afterEach(async () => {
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    if (joueur) { await joueur.ctx.close(); joueur = null; }
  });

  async function lancer(browser) {
    hote = await openHost(browser);
    joueur = await joinAsPlayer(browser, hote.code, 'File');
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    // LE JEU EST NOMMÉ, et ce n'est pas un détail de style : ces contrôles ont
    // besoin d'une file de PLUS DE QUATRE questions. En lançant « le premier de la
    // liste », ils tombaient sur le jeu fabriqué par un autre contrôle — une seule
    // question — et attendaient quinze secondes une cinquième ligne qui
    // n'existait pas. Ils passaient seuls et échouaient dans la suite complète.
    await hote.page.getByRole('menuitem', { name: 'Lancer Quiz' }).first().click();
    await expect(hote.page.getByTestId('file-attente')).toBeVisible();
  }

  test('les énoncés sont réellement lisibles, pas réduits à « Q. »', async ({ browser }) => {
    await lancer(browser);

    // On ne se contente pas de vérifier que le texte EXISTE dans le DOM : il y
    // était déjà quand l'écran affichait « Q. ». On mesure combien de caractères
    // tiennent dans la largeur rendue, avec la vraie police.
    const mesures = await hote.page.locator('.file__row .file__text').evaluateAll((els) => els.map((n) => {
      const cs = getComputedStyle(n);
      const c = document.createElement('canvas').getContext('2d');
      c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const texte = n.textContent || '';
      let tiennent = 0;
      while (tiennent < texte.length && c.measureText(texte.slice(0, tiennent + 1)).width <= n.clientWidth) tiennent += 1;
      return { total: texte.length, tiennent, largeur: Math.round(n.clientWidth) };
    }));

    expect(mesures.length).toBeGreaterThan(0);
    for (const m of mesures) {
      console.log(`  énoncé de ${m.total} caractères — ${m.tiennent} lisibles sur ${m.largeur}px`);
    }
    // Vingt caractères, c'est le début d'une question — « Quel est le plus g… ».
    // Le défaut rapporté en donnait un ou deux.
    for (const m of mesures) {
      expect(m.tiennent, `seulement ${m.tiennent} caractères lisibles sur ${m.largeur}px`)
        .toBeGreaterThanOrEqual(Math.min(20, m.total));
    }
  });

  test('quatre lignes visibles, et la barre d\'actions reste au-dessus du pli', async ({ browser }) => {
    await lancer(browser);

    const lignes = hote.page.getByTestId('file-row');
    await expect(lignes.nth(4)).toBeAttached();
    const total = await lignes.count();
    expect(total, 'il faut une file plus longue que la fenêtre pour que le contrôle ait un sens')
      .toBeGreaterThan(4);

    // Combien de lignes sont ENTIÈREMENT dans la fenêtre défilante — pas une
    // cinquième coupée en bande vide, qui était le symptôme du plafond en 34vh.
    const fenetre = await hote.page.locator('.file').boundingBox();
    let entieres = 0;
    for (let i = 0; i < total; i++) {
      const b = await lignes.nth(i).boundingBox();
      if (!b) continue;
      if (b.y >= fenetre.y - 1 && b.y + b.height <= fenetre.y + fenetre.height + 1) entieres += 1;
    }
    console.log(`  ${entieres} lignes entières visibles sur ${total}`);
    expect(entieres).toBe(4);

    // LE VRAI ENJEU. C'est le défaut que l'action 16 du chantier v1 avait déjà
    // corrigé une fois, mesuré alors à 886 px pour une fenêtre de 656.
    const barre = await hote.page.getByRole('button', { name: 'Question suivante' }).boundingBox();
    const pli = hote.page.viewportSize().height;
    console.log(`  bas de « Question suivante » à ${Math.round(barre.y + barre.height)}px, pli à ${pli}px`);
    expect(barre.y + barre.height).toBeLessThanOrEqual(pli);
  });

  test('la question en cours est affichée hors de la file', async ({ browser }) => {
    await lancer(browser);
    // Décision 13 de l'action 6 du chantier v1, jamais réalisée : rien ne
    // distinguait ce qui venait d'être posé de ce qui vient.
    const enCours = hote.page.getByTestId('file-en-cours');
    await expect(enCours).toBeVisible();
    const texte = await hote.page.getByTestId('question-text').innerText();
    await expect(enCours).toContainText(texte.slice(0, 20));
    // Et ce n'est PAS une ligne de file : ni poignée, ni commandes.
    await expect(enCours.locator('.file__grip, .file__btn')).toHaveCount(0);
  });

  test('l\'intitulé du classement ne se coupe pas en deux', async ({ browser }) => {
    await lancer(browser);
    // « CLASSEMENT — TOI SEUL » se repliait, « SEUL » tombant sous le reste.
    // On mesure le nombre de lignes rendues, pas la présence d'une propriété.
    const lignes = await hote.page.locator('.rail .private__title').first().evaluate((n) => {
      const h = n.getBoundingClientRect().height;
      const ligne = parseFloat(getComputedStyle(n).fontSize);
      return Math.round(h / ligne);
    });
    expect(lignes, `l'intitulé se rend sur ${lignes} ligne(s)`).toBe(1);
  });

  test('le menu « changer de module » s\'ouvre par-dessus la file, pas sous le pli', async ({ browser }) => {
    await lancer(browser);
    // Décision 3.11 — le menu s'ouvre VERS LE HAUT depuis la barre d'actions
    // (action 16 du chantier v1). La file étant désormais juste au-dessus, il
    // faut le vérifier ouvert, pas sur un écran au repos.
    await hote.page.getByRole('button', { name: /Changer de module/ }).click();
    const menu = hote.page.locator('[role="menu"]').last();
    await expect(menu).toBeVisible();
    const b = await menu.boundingBox();
    const pli = hote.page.viewportSize().height;
    console.log(`  menu ouvert de ${Math.round(b.y)} à ${Math.round(b.y + b.height)}px, pli à ${pli}px`);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.y + b.height).toBeLessThanOrEqual(pli + 1);
  });
});

// ---------------------------------------------------------------------------
test.describe('Le glisser de la file', () => {
  let hote = null;
  let joueur = null;

  test.afterEach(async () => {
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    if (joueur) { await joueur.ctx.close(); joueur = null; }
  });

  test('déplace vraiment la ligne, et n\'envoie QU\'UN message', async ({ browser }) => {
    hote = await openHost(browser);

    // On compte les trames envoyées AVANT d'ouvrir la partie : l'ancienne version
    // émettait un message par rang franchi — cinq pour un glisser de cinq places.
    let reordonnancements = 0;
    hote.page.on('websocket', (ws) => {
      ws.on('framesent', (f) => {
        if (typeof f.payload === 'string' && f.payload.includes('host:reorderQueue')) reordonnancements += 1;
      });
    });

    joueur = await joinAsPlayer(browser, hote.code, 'Glisse');
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: 'Lancer Quiz' }).first().click();
    await expect(hote.page.getByTestId('file-attente')).toBeVisible();

    const lignes = hote.page.getByTestId('file-row');
    // La file arrive par le réseau, après le montage : attendre la QUATRIÈME
    // ligne, pas se contenter de compter tout de suite. Sans cela le contrôle
    // échoue une fois sur deux sur une file encore vide.
    await expect(lignes.nth(3)).toBeVisible();
    const premier = await lignes.nth(0).locator('.file__text').innerText();

    // Le corps de l'écran défile depuis le chantier v2 : sans cela la poignée
    // peut se trouver hors du champ, la souris cliquer dans le vide, et le
    // contrôle passer pour de mauvaises raisons.
    await lignes.nth(0).scrollIntoViewIfNeeded();
    const poignee = await lignes.nth(0).locator('.file__grip').boundingBox();
    const boite = await lignes.nth(0).boundingBox();
    const cible = await lignes.nth(3).boundingBox();

    await hote.page.mouse.move(poignee.x + poignee.width / 2, poignee.y + poignee.height / 2);
    await hote.page.mouse.down();

    // Pendant le geste : la ligne DOIT bouger. Avant, elle changeait de teinte et
    // restait rigoureusement à sa place — c'est tout ce que voyait l'animateur.
    await hote.page.mouse.move(poignee.x + poignee.width / 2, cible.y + cible.height / 2, { steps: 12 });
    const pendant = await lignes.nth(0).boundingBox();
    const parcouru = Math.round(pendant.y - boite.y);
    console.log(`  la ligne tenue s'est déplacée de ${parcouru}px pendant le geste`);
    expect(parcouru, 'la ligne tenue ne suit pas le pointeur').toBeGreaterThan(40);

    await hote.page.mouse.up();

    // Après le lâcher : l'ordre est celui qu'on visait, et il vient du serveur.
    await expect(lignes.nth(3).locator('.file__text')).toHaveText(premier);
    expect(reordonnancements, `${reordonnancements} messages de réordonnancement envoyés`).toBe(1);
  });

  test('l\'échappement annule le geste sans rien envoyer', async ({ browser }) => {
    hote = await openHost(browser);
    let reordonnancements = 0;
    hote.page.on('websocket', (ws) => {
      ws.on('framesent', (f) => {
        if (typeof f.payload === 'string' && f.payload.includes('host:reorderQueue')) reordonnancements += 1;
      });
    });

    joueur = await joinAsPlayer(browser, hote.code, 'Annule');
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: 'Lancer Quiz' }).first().click();
    await expect(hote.page.getByTestId('file-attente')).toBeVisible();

    const lignes = hote.page.getByTestId('file-row');
    await expect(lignes.nth(3)).toBeVisible();
    const premier = await lignes.nth(0).locator('.file__text').innerText();
    await lignes.nth(0).scrollIntoViewIfNeeded();
    const poignee = await lignes.nth(0).locator('.file__grip').boundingBox();
    const boite = await lignes.nth(0).boundingBox();
    const cible = await lignes.nth(3).boundingBox();

    await hote.page.mouse.move(poignee.x + poignee.width / 2, poignee.y + poignee.height / 2);
    await hote.page.mouse.down();
    await hote.page.mouse.move(poignee.x + poignee.width / 2, cible.y + cible.height / 2, { steps: 8 });
    // Le geste doit avoir COMMENCÉ, sinon « rien n'a été envoyé » ne prouve rien :
    // un contrôle qui passe parce qu'il ne s'est rien passé est un faux vert.
    const pendant = await lignes.nth(0).boundingBox();
    expect(Math.round(pendant.y - boite.y), 'le geste n\'a pas démarré').toBeGreaterThan(40);
    await hote.page.keyboard.press('Escape');
    await hote.page.mouse.up();

    // La ligne est revenue à sa place, et le serveur n'a rien appris.
    await expect(lignes.nth(0).locator('.file__text')).toHaveText(premier);
    expect(reordonnancements, 'un geste annulé ne doit rien envoyer').toBe(0);
  });

  test('le défilement automatique permet d\'aller au-delà des quatre lignes visibles', async ({ browser }) => {
    // DÉCISION 4.5 — sans lui, avec quatre lignes visibles sur vingt et une, le
    // pointeur atteint le bord de la fenêtre et plus rien ne se passe : déplacer
    // une question de la place 1 à la place 15 devient impossible au glisser, et
    // les boutons monter/descendre restent le seul chemin.
    hote = await openHost(browser);
    joueur = await joinAsPlayer(browser, hote.code, 'Defile');
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: 'Lancer Quiz' }).first().click();
    await expect(hote.page.getByTestId('file-attente')).toBeVisible();

    const lignes = hote.page.getByTestId('file-row');
    await expect(lignes.nth(4)).toBeAttached();
    await lignes.nth(0).scrollIntoViewIfNeeded();

    const avant = await hote.page.locator('.file').evaluate((n) => n.scrollTop);
    const fenetre = await hote.page.locator('.file').boundingBox();
    const poignee = await lignes.nth(0).locator('.file__grip').boundingBox();

    await hote.page.mouse.move(poignee.x + poignee.width / 2, poignee.y + poignee.height / 2);
    await hote.page.mouse.down();
    // On TIENT le pointeur au bord bas : chaque mouvement déclenche un cran de
    // défilement, comme un doigt maintenu en bas d'une liste.
    for (let i = 0; i < 25; i += 1) {
      await hote.page.mouse.move(poignee.x + poignee.width / 2, fenetre.y + fenetre.height - 4);
    }
    const pendant = await hote.page.locator('.file').evaluate((n) => n.scrollTop);
    await hote.page.mouse.up();

    console.log(`  défilement de la file : ${Math.round(avant)} → ${Math.round(pendant)}px`);
    expect(pendant, 'la file ne défile pas quand on glisse vers le bas').toBeGreaterThan(avant + 20);
  });
});
