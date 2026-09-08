// E2E — « COUPE TA BÛCHE », de bout en bout.
//
// CE QUE CE JEU A DE PARTICULIER, ET QUE SEUL UN CONTRÔLE DE BOUT EN BOUT PEUT
// VOIR. Le curseur n'est envoyé par personne : chaque écran le CALCULE, à partir
// d'une période reçue du serveur et de sa propre horloge monotone. Un curseur
// figé, un curseur qui repart à zéro, un curseur qui court encore quand le jeu
// est fini — rien de tout cela ne casse quoi que ce soit, et rien ne se voit dans
// un contrôle unitaire.
//
// LE CONTRÔLE UNITAIRE, LUI, GARDE L'ACCORD DES DEUX FORMULES (voir
// `tests/unit/coupe-buche.test.js`). Ici on garde ce qu'il ne peut pas voir : que
// le curseur bouge vraiment à l'écran, que le chrono affiche les DIX secondes du
// jeu et non la fenêtre de réponse, et que la proportion à trouver soit annoncée
// aux joueurs — c'est une consigne, pas une réponse cachée.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer, lancerJeu } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.setTimeout(120_000);

const JEU = 'Coupe ta bûche';
const CIBLE = '80';

test.describe('Coupe ta bûche', () => {
  let hote = null;
  const joueurs = [];
  let stream = null;

  test.afterEach(async () => {
    if (stream) { await stream.close().catch(() => {}); stream = null; }
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    for (const j of joueurs.splice(0)) await j.ctx.close();
  });

  async function annoncer(browser, pseudos = ['Bucheron']) {
    hote = await openHost(browser);
    for (const p of pseudos) joueurs.push(await joinAsPlayer(browser, hote.code, p));
    stream = await hote.ctx.newPage();
    const token = await hote.page.evaluate(() => JSON.parse(localStorage.getItem('host')).overlayToken);
    await stream.goto(`/overlay?token=${token}`);
    await expect(stream.getByTestId('stream-room-code')).toHaveText(hote.code);
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await lancerJeu(hote.page, JEU);
  }

  test("l'annonce précède le jeu, sur les deux surfaces publiques", async ({ browser }) => {
    // « Chaque module doit comporter un écran d'attente lorsque l'animateur le
    // lance. » LE DÉFAUT GARDÉ : le jingle existait sur les téléphones et PAS à
    // l'antenne — le public voyait un titre sur fond vide pendant que le cercle
    // regardait une bûche et une hache. Rien ne cassait.
    await annoncer(browser);
    await expect(joueurs[0].page.getByRole('heading', { name: JEU })).toBeVisible({ timeout: 15_000 });
    await expect(stream.getByTestId('stream-annonce')).toBeVisible({ timeout: 15_000 });
    await expect(stream.getByTestId('stream-annonce')).toContainText('curseur');

    // LE BOUTON RESTE INERTE TANT QUE LA PROPORTION EST VIDE : diffuser sans
    // cible lancerait une manche que personne ne peut gagner, et l'animateur le
    // découvrirait à l'antenne.
    await expect(hote.page.getByTestId('saisie-buche')).toBeVisible();
    const bouton = hote.page.getByTestId('cb-diffuser');
    await expect(bouton).toBeDisabled();
    await hote.page.getByTestId('cb-cible').fill(CIBLE);
    await expect(bouton).toBeEnabled();
  });

  test('le curseur balaie la bûche, et le chrono compte les dix secondes du jeu', async ({ browser }) => {
    await annoncer(browser);
    await hote.page.getByTestId('cb-cible').fill(CIBLE);
    await hote.page.getByTestId('cb-diffuser').click();

    const buche = joueurs[0].page.getByTestId('cb-buche');
    await expect(buche).toBeVisible({ timeout: 15_000 });

    // IL BOUGE. Un curseur figé sur sa position de départ est le défaut le plus
    // probable d'un balayage calculé côté client, et il ne casse rien — il rend
    // le jeu impossible en silence. On lit la position par l'étiquette
    // d'accessibilité, qui la porte en clair pour les lecteurs d'écran.
    const lire = async () => await buche.getAttribute('aria-label');
    const p1 = await lire();
    expect(p1, `la bûche n'annonce pas de position : « ${p1} »`).toMatch(/curseur à \d+ %/);
    await joueurs[0].page.waitForTimeout(300);
    expect(await lire(), 'le curseur ne bouge pas').not.toBe(p1);

    // LE CHRONO DIT DIX. LE DÉFAUT VU À L'ÉCRAN : il affichait 12 — la fenêtre de
    // réponse, marge de réseau comprise — là où l'énoncé demande dix secondes de
    // jeu. Le joueur voyait le curseur s'arrêter deux secondes avant la fin de son
    // propre compte à rebours.
    const chrono = joueurs[0].page.locator('[role="timer"]').first();
    const secondes = Number((await chrono.innerText()).trim());
    expect(secondes, `le chrono affiche ${secondes} au lieu des dix secondes du jeu`).toBeLessThanOrEqual(10);

    // LE STREAM MONTRE LA MÊME BÛCHE, au même moment.
    await expect(stream.getByTestId('stream-buche')).toBeVisible();
  });

  test("LA CONSIGNE EST ANNONCÉE, et une seule fois", async ({ browser }) => {
    // ICI LA PROPORTION N'EST PAS UN SECRET : c'est la consigne du jeu, et le
    // joueur ne peut pas viser sans elle. C'est l'inverse exact du « juste
    // temps », dont la cible ne doit atteindre aucun écran — la même donnée
    // suivant deux règles opposées, d'où ce contrôle.
    //
    // MAIS UNE SEULE FOIS : la phrase générique des questions la répétait sous la
    // consigne du jeu, et l'écran du joueur disait deux fois la même chose.
    await annoncer(browser);
    await hote.page.getByTestId('cb-cible').fill(CIBLE);
    await hote.page.getByTestId('cb-diffuser').click();

    const j = joueurs[0].page;
    await expect(j.getByTestId('cb-consigne')).toContainText('80 %', { timeout: 15_000 });
    await expect(stream.getByTestId('stream-buche')).toContainText('80 %');
    // La phrase générique de question a disparu de cet écran.
    await expect(j.locator('#q-text')).toHaveCount(0);
  });

  test('la coupe part une seule fois, et la révélation rend le graphique du barème', async ({ browser }) => {
    // PSEUDOS CHOISIS AVEC SOIN : le filtre de pseudos du projet rejette tout ce
    // qui contient « con ». Un pseudo refusé fait échouer le contrôle sur un
    // joueur jamais entré dans le salon — un faux rouge qui désigne l'écran de jeu.
    await annoncer(browser, ['Bucheron', 'Hachette']);
    await hote.page.getByTestId('cb-cible').fill(CIBLE);
    await hote.page.getByTestId('cb-diffuser').click();

    for (const j of joueurs) {
      const couper = j.page.getByTestId('answer-submit');
      await expect(couper).toBeVisible({ timeout: 15_000 });
      await expect(couper).toHaveText('COUPE !');
      await couper.click();
      // UN SEUL COUP, ET IL EST DÉFINITIF — même règle que le buzz des visages et
      // que le STOP du juste temps. Le libellé le dit : sans quoi un joueur
      // frapperait deux fois dans le vide en croyant jouer.
      await expect(couper).toBeDisabled();
      await expect(couper).toHaveText('Coupe envoyée');
    }

    // LES TRAITS DES COUPES APPARAISSENT À L'ANTENNE, et là seulement : sur les
    // téléphones, ils feraient viser le trait le plus fourni plutôt que la
    // proportion demandée.
    await expect(stream.locator('.st-buche__trait').first()).toBeVisible({ timeout: 15_000 });
    await expect(joueurs[0].page.locator('.cbj__trait')).toHaveCount(0);

    await hote.page.getByRole('button', { name: /Révéler/ }).first().click();

    // LE GRAPHIQUE DU BARÈME, comme l'estimation et le juste temps.
    await expect(hote.page.getByTestId('histogramme')).toBeVisible({ timeout: 15_000 });
    await expect(stream.getByTestId('stream-histogramme')).toBeVisible();

    // ET SES NOMBRES SONT DES POINTS DE POURCENTAGE — la seule chose qui
    // distingue ce graphique des deux autres, et la seule qui puisse s'y perdre
    // en silence : « ± 1 pt » écrit « ± 100 % » changerait le barème sans erreur.
    await expect(hote.page.getByTestId('histo-cible')).toContainText('80 %');
    await expect(hote.page.getByTestId('histo-plages')).toContainText('± 1 pt');

    // LE JOUEUR REÇOIT SON VERDICT, sa phrase et la coupe retenue par l'arbitre.
    const j = joueurs[0].page;
    await expect(j.getByTestId('points-gained')).toBeVisible({ timeout: 15_000 });
    await expect(j.getByTestId('voix-resultat')).toBeVisible();
    await expect(j.getByTestId('reveal-value')).toContainText('80 %');
    // Aucune accolade non substituée n'arrive jamais à un joueur (A30).
    expect(await j.getByTestId('voix-resultat').innerText()).not.toMatch(/\{\w+\}/);
  });
});
