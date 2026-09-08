// E2E — « LE JUSTE TEMPS », de bout en bout.
//
// CE QUE CE JEU A DE PARTICULIER, ET QUE SEUL UN CONTRÔLE DE BOUT EN BOUT PEUT
// VOIR. Son compte à rebours ne vient d'aucune donnée : il est CALCULÉ par le
// navigateur, à partir d'une durée envoyée par le serveur et de sa propre horloge
// monotone. Un chrono figé, un chrono qui repart de zéro à la reconnexion, un
// chrono qui ne s'efface jamais — rien de tout cela ne se voit dans un contrôle
// unitaire, et tout se voit ici.
//
// ET SURTOUT : la cible ne doit JAMAIS atteindre un écran avant la révélation.
// C'est le jeu tout entier, et c'est la seule faute dont on ne se relève pas en
// direct.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer, lancerJeu } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.setTimeout(120_000);

const JEU = 'Le juste temps';
// Un cache HAUT : le chrono s'efface au bout d'une seconde de jeu, ce qui rend
// l'effacement observable sans faire durer le contrôle quinze secondes.
const CACHE = '14.00';
const CIBLE = '11.50';

test.describe('Le juste temps', () => {
  let hote = null;
  const joueurs = [];
  let stream = null;

  test.afterEach(async () => {
    if (stream) { await stream.close().catch(() => {}); stream = null; }
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    for (const j of joueurs.splice(0)) await j.ctx.close();
  });

  async function annoncer(browser, pseudos = ['Chrono']) {
    hote = await openHost(browser);
    for (const p of pseudos) joueurs.push(await joinAsPlayer(browser, hote.code, p));
    stream = await hote.ctx.newPage();
    const token = await hote.page.evaluate(() => JSON.parse(localStorage.getItem('host')).overlayToken);
    await stream.goto(`/overlay?token=${token}`);
    await expect(stream.getByTestId('stream-room-code')).toHaveText(hote.code);
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await lancerJeu(hote.page, JEU);
  }

  test('l\'annonce précède le jeu, et la diffusion attend le temps cible', async ({ browser }) => {
    await annoncer(browser);

    // LE JINGLE D'ABORD, sur les deux surfaces publiques : le cercle voit le nom
    // du jeu pendant que l'animateur saisit ses temps. C'est la raison d'être des
    // deux temps — le temps de saisie ne doit pas être décompté du chrono.
    await expect(joueurs[0].page.getByRole('heading', { name: JEU })).toBeVisible({ timeout: 15_000 });
    await expect(stream.getByTestId('stream-annonce')).toBeVisible({ timeout: 15_000 });

    // LE BOUTON RESTE INERTE TANT QUE LA CIBLE EST VIDE. « ne s'active que si le
    // champ "Temps cible" n'est pas vide » : diffuser sans cible lancerait une
    // manche que personne ne peut gagner, et l'animateur le découvrirait à
    // l'antenne.
    const saisie = hote.page.getByTestId('saisie-juste-temps');
    await expect(saisie).toBeVisible();
    const bouton = hote.page.getByTestId('jt-diffuser');
    await expect(bouton).toBeDisabled();

    // Le cache seul ne suffit pas : c'est bien la CIBLE qui commande.
    await hote.page.getByTestId('jt-cache').fill(CACHE);
    await expect(bouton).toBeDisabled();
    await hote.page.getByTestId('jt-cible').fill(CIBLE);
    await expect(bouton).toBeEnabled();
  });

  test('le chrono défile au centième, puis se consume sans s\'arrêter', async ({ browser }) => {
    await annoncer(browser);
    await hote.page.getByTestId('jt-cache').fill(CACHE);
    await hote.page.getByTestId('jt-cible').fill(CIBLE);
    await hote.page.getByTestId('jt-diffuser').click();

    const cadran = joueurs[0].page.getByTestId('jt-chrono');
    await expect(cadran).toBeVisible({ timeout: 15_000 });

    // IL DÉFILE, ET AU CENTIÈME. Deux lectures rapprochées doivent différer : un
    // chrono figé sur sa valeur de départ est le défaut le plus probable d'un
    // compteur calculé côté client, et il ne casse rien — il fausse.
    const lire = async () => (await cadran.innerText()).trim().split('\n')[0];
    const t1 = await lire();
    expect(t1, `le cadran n'affiche pas un temps : « ${t1} »`).toMatch(/^\d\d,\d\d$/);
    await joueurs[0].page.waitForTimeout(400);
    const t2 = await lire();
    expect(t2, 'le chrono ne défile pas').not.toBe(t1);
    // Il DESCEND : un compte à rebours qui monte serait un chrono.
    expect(Number(t2.replace(',', '.'))).toBeLessThan(Number(t1.replace(',', '.')));

    // PUIS IL S'EFFACE — « le compte à rebours doit disparaitre lorsqu'il atteint
    // le Temps de cache ». Le cache est à 14,00 : l'effacement tombe une seconde
    // après le départ.
    await expect(cadran).toHaveAttribute('data-cache', 'true', { timeout: 10_000 });

    // ET IL COURT TOUJOURS. C'est le cœur du jeu : effacé ne veut pas dire arrêté.
    // On le lit dans le DOM, que le masque de consumation rend invisible à l'œil
    // sans le retirer — c'est exactement ce qu'il faut vérifier.
    const cache1 = await lire();
    await joueurs[0].page.waitForTimeout(400);
    expect(await lire(), 'le chrono s\'est arrêté en se cachant').not.toBe(cache1);

    // LE STREAM MONTRE LA MÊME CHOSE, au même moment.
    await expect(stream.getByTestId('stream-jt-chrono')).toHaveAttribute('data-cache', 'true');
  });

  test('AUCUN AUTRE CHRONO ne trahit le temps caché', async ({ browser }) => {
    // LE DÉFAUT GARDÉ, ET IL VIDAIT LE JEU SANS RIEN CASSER.
    //
    // Toutes les manches portent un chrono de fenêtre de réponse : un anneau qui
    // égrène les secondes, en haut de l'écran du joueur et sur la toile du
    // stream. Vu à l'écran sur ce jeu : le cadran s'effaçait à 14,00 comme prévu,
    // et l'anneau continuait de compter 14, 13, 12 — en clair, sur le même écran,
    // devant tout le monde. Il n'y avait plus qu'à lire.
    //
    // Rien ne cassait, rien ne rougissait : le jeu tournait parfaitement, et ne
    // demandait plus aucune estimation. C'est le pire genre de défaut que ce
    // module puisse avoir, et il fallait le regarder pour le voir.
    await annoncer(browser);
    await hote.page.getByTestId('jt-cache').fill(CACHE);
    await hote.page.getByTestId('jt-cible').fill(CIBLE);
    await hote.page.getByTestId('jt-diffuser').click();

    const cadran = joueurs[0].page.getByTestId('jt-chrono');
    await expect(cadran).toHaveAttribute('data-cache', 'true', { timeout: 15_000 });

    // Une fois le cadran consumé, AUCUN nombre lisible ne doit plus courir sur
    // les deux surfaces publiques hormis le cadran lui-même — qui est masqué.
    for (const [nom, page, garder] of [
      ['le joueur', joueurs[0].page, '[data-testid="jt-chrono"]'],
      ['le stream', stream, '[data-testid="stream-jt-chrono"]'],
    ]) {
      const chronos = await page.evaluate((sel) => [...document.querySelectorAll('[role="timer"]')]
        .filter((e) => !e.closest(sel))
        .map((e) => e.getAttribute('aria-label') || e.textContent.trim()), garder);
      expect(chronos, `un second chrono tourne sur ${nom} : ${chronos.join(' · ')}`).toEqual([]);
    }
  });

  test('LE TEMPS CIBLE EST ANNONCÉ AU CERCLE, et le temps de cache jamais', async ({ browser }) => {
    // CE CONTRÔLE DISAIT LE CONTRAIRE, ET IL AVAIT TORT.
    //
    // Il gardait la cible comme un secret : « le temps cible n'atteint aucun
    // écran ». C'était ma lecture de l'énoncé, et elle rendait le jeu injouable —
    // on demandait au cercle d'arrêter un chrono à un instant que personne ne lui
    // avait dit. La règle est explicite : « il faut afficher le Temps cible sur
    // l'écran du joueur et du stream lorsque le compte à rebours descend ». La
    // cible est une CONSIGNE, comme la proportion de « Coupe ta bûche ».
    //
    // CE QUI RESTE CACHÉ, c'est le TEMPS DE CACHE : l'instant où le chrono
    // s'efface. Annoncé, il donnerait au joueur un repère à soustraire, et il
    // n'aurait plus qu'à compter à partir de là — le jeu ne mesurerait plus rien.
    await annoncer(browser);
    await hote.page.getByTestId('jt-cache').fill(CACHE);
    await hote.page.getByTestId('jt-cible').fill(CIBLE);
    await hote.page.getByTestId('jt-diffuser').click();
    await expect(joueurs[0].page.getByTestId('jt-chrono')).toBeVisible({ timeout: 15_000 });

    // LA CIBLE EST LÀ, sur les deux surfaces publiques, dans les mêmes termes.
    await expect(joueurs[0].page.getByTestId('jt-cible-joueur')).toContainText('11,50 s');
    await expect(stream.getByTestId('stream-jt-cible')).toContainText('11,50 s');

    // LE CACHE N'Y EST PAS. On ne se contente pas de regarder le texte affiché :
    // on fouille le HTML ENTIER. Un temps transporté dans un attribut, un `data-`
    // ou une charge utile inerte serait tout aussi lisible par qui ouvre
    // l'inspecteur — et c'est là qu'il se cacherait.
    for (const [nom, page] of [['le joueur', joueurs[0].page], ['le stream', stream]]) {
      const html = await page.content();
      expect(html, `le temps de cache est lisible sur ${nom}`).not.toContain('14.00');
      expect(html, `le temps de cache est lisible sur ${nom}`).not.toContain('14,00');
    }

    // L'ANIMATEUR, LUI, A LES DEUX. C'est lui qui commente à l'antenne, et son
    // panneau de répartition porte la cible dès la première réponse (canal
    // animateur seul). Le panneau de SAISIE, lui, a disparu avec la diffusion :
    // c'est le graphique qui prend le relais.
    await joueurs[0].page.getByTestId('answer-submit').click();
    await expect(hote.page.getByTestId('histo-cible')).toContainText('11,50 s', { timeout: 15_000 });
  });

  test("LA RELANCE ne renvoie personne à l'écran d'attente", async ({ browser }) => {
    // « Après cela, l'animateur peut relancer, et dans ce cas, il passe sur
    // l'écran avec les 2 champs à remplir, mais les joueurs et le stream restent
    // sur les écrans de résultat, pas nécessaire de les ramener sur l'écran
    // d'attente. » La même phrase figure dans l'énoncé de « Coupe ta bûche ».
    //
    // CE QUE CE CONTRÔLE A COÛTÉ DE NE PAS EXISTER. En donnant un écran d'attente
    // aux quatre jeux classiques, j'ai fait passer TOUTES les relances par
    // l'annonce — celle-ci comprise. L'animateur reprenait ses deux champs comme
    // prévu, mais le cercle et l'antenne retournaient au jingle : le résultat
    // qu'ils étaient en train de commenter disparaissait sous eux, en direct.
    await annoncer(browser);
    await hote.page.getByTestId('jt-cache').fill('2.00');
    await hote.page.getByTestId('jt-cible').fill('13.00');
    await hote.page.getByTestId('jt-diffuser').click();
    const j = joueurs[0].page;
    await expect(j.getByTestId('answer-submit')).toBeVisible({ timeout: 15_000 });
    await j.getByTestId('answer-submit').click();
    await hote.page.getByRole('button', { name: /Révéler/ }).first().click();
    await expect(j.getByTestId('points-gained')).toBeVisible({ timeout: 15_000 });

    // L'ANIMATEUR RELANCE : ses deux champs reviennent.
    await hote.page.getByRole('button', { name: 'Question suivante' }).click();
    await expect(hote.page.getByTestId('saisie-juste-temps')).toBeVisible({ timeout: 15_000 });

    // LE CERCLE ET L'ANTENNE N'ONT PAS BOUGÉ. On laisse passer un instant : un
    // écran qui retournerait au jingle le ferait dans la seconde, et un contrôle
    // qui regarde trop tôt ne verrait rien.
    await j.waitForTimeout(800);
    await expect(j.getByTestId('points-gained'),
      'le joueur a été renvoyé à l\'écran d\'attente').toBeVisible();
    await expect(j.getByRole('heading', { name: JEU })).toHaveCount(0);
    await expect(stream.getByTestId('stream-annonce'),
      'l\'antenne est retournée au jingle en pleine analyse').toHaveCount(0);
  });

  test('le STOP part une seule fois, et la révélation rend le graphique du barème', async ({ browser }) => {
    // PSEUDOS CHOISIS AVEC SOIN : « Second » est refusé par le filtre de pseudos
    // du projet, qui rejette tout ce qui contient « con ». Le contrôle échouait
    // alors sur un joueur jamais entré dans le salon — un faux rouge coûteux à
    // lire, puisqu'il désigne l'écran de jeu.
    await annoncer(browser, ['Chrono', 'Deuxieme']);
    await hote.page.getByTestId('jt-cache').fill('2.00');
    await hote.page.getByTestId('jt-cible').fill('13.00');
    await hote.page.getByTestId('jt-diffuser').click();

    for (const j of joueurs) {
      const stop = j.page.getByTestId('answer-submit');
      await expect(stop).toBeVisible({ timeout: 15_000 });
      await expect(stop).toHaveText('STOP');
      await stop.click();
      // UN SEUL APPUI, ET IL EST DÉFINITIF — même règle que le buzz des visages.
      // Le libellé le dit : sans quoi un joueur appuierait deux fois dans le vide
      // en croyant jouer.
      await expect(stop).toBeDisabled();
      await expect(stop).toHaveText('Temps envoyé');
    }

    await hote.page.getByRole('button', { name: /Révéler/ }).first().click();

    // LE GRAPHIQUE DU BARÈME, sur les deux écrans qui le demandent — « il faut
    // reprendre exactement le graphique du module Estimation ».
    await expect(hote.page.getByTestId('histogramme')).toBeVisible({ timeout: 15_000 });
    await expect(hote.page.getByTestId('histo-cible')).toBeVisible();
    await expect(stream.getByTestId('stream-histogramme')).toBeVisible();

    // ET SES NOMBRES SONT DES SECONDES, jamais des entiers. C'est la seule chose
    // qui distingue ce graphique de celui de l'estimation, et c'est aussi la
    // seule qui puisse s'y perdre en silence : « 13,00 s » ramené à « 13 » ferait
    // disparaître le centième, c'est-à-dire le jeu.
    await expect(hote.page.getByTestId('histo-cible')).toContainText('13,00 s');
    await expect(stream.getByTestId('reveal-value')).toContainText('13,00 s');
    await expect(hote.page.getByTestId('histo-plages')).toContainText('± 0,1 s');

    // LE JOUEUR REÇOIT SON VERDICT, sa phrase et son temps — celui de l'arbitre.
    const j = joueurs[0].page;
    await expect(j.getByTestId('points-gained')).toBeVisible({ timeout: 15_000 });
    await expect(j.getByTestId('voix-resultat')).toBeVisible();
    await expect(j.getByTestId('reveal-value')).toContainText('13,00 s');
    // Aucune accolade non substituée n'arrive jamais à un joueur (A30).
    expect(await j.getByTestId('voix-resultat').innerText()).not.toMatch(/\{\w+\}/);
  });
});
