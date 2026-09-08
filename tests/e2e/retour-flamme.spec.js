// E2E — « RETOUR DE FLAMME », de bout en bout.
//
// CE QUE SEUL UN CONTRÔLE DE BOUT EN BOUT PEUT VOIR ICI :
//   - le BUZZ MULTIPLE. C'est le seul jeu du projet où l'on répond plusieurs
//     fois ; tout le reste de l'application est construit sur « une réponse et on
//     ferme ». Le premier montage figeait l'écran au premier buzz, et le second
//     disait « le temps t'a devancé » à un joueur qui venait d'en envoyer quatre.
//     Ni l'un ni l'autre ne casse quoi que ce soit : ils faussent, en silence.
//   - la SÉRIE À L'ANTENNE. Trente images ne tiennent pas comme vingt : la
//     première mise en page sortait du cadre ET passait sous la pastille du QR,
//     devant le public.
//   - la SÉRIE QUI NE DOIT PAS FUIR avant la révélation.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer, lancerJeu } from './helpers.js';
import { terminerPartie } from './cloture.js';
import { TOTAL_RETOUR, RETOURS_PAR_SERIE, CADENCE_RETOUR } from '../../src/server/modules.js';

test.setTimeout(180_000);

const JEU = 'Retour de flamme';

test.describe('Retour de flamme', () => {
  let hote = null;
  const joueurs = [];
  let stream = null;
  // CE QUE L'ANTENNE A JETÉ. Un écran de stream qui plante ne dit rien : il
  // devient NOIR. La console de l'animateur, elle, continue de fonctionner — il
  // ne peut donc ni le voir ni le comprendre, et le public regarde du vide.
  //
  // LE DÉFAUT QUE CE RELEVÉ A ATTRAPÉ : le blanc entre deux images lisait la place
  // de l'image AVANT que celle-ci ne soit déclarée. Comme la place n'est lue que
  // sur ce jeu-là, l'antenne ne s'éteignait que sur « Retour de flamme » —
  // « ReferenceError: Cannot access before initialization », jetée à chaque rendu.
  let jetees = [];

  test.afterEach(async () => {
    if (stream) { await stream.close().catch(() => {}); stream = null; }
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    for (const j of joueurs.splice(0)) await j.ctx.close();
  });

  async function annoncer(browser, pseudos = ['Braise']) {
    hote = await openHost(browser);
    for (const p of pseudos) joueurs.push(await joinAsPlayer(browser, hote.code, p));
    stream = await hote.ctx.newPage();
    jetees = [];
    stream.on('pageerror', (e) => jetees.push(String(e.message)));
    await stream.setViewportSize({ width: 1920, height: 1080 });
    const token = await hote.page.evaluate(() => JSON.parse(localStorage.getItem('host')).overlayToken);
    await stream.goto(`/overlay?token=${token}`);
    await expect(stream.getByTestId('stream-room-code')).toHaveText(hote.code);
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await lancerJeu(hote.page, JEU);
  }

  test('l\'écran d\'attente MONTRE le mode, et le suit quand l\'animateur en change', async ({ browser }) => {
    // L'emblème EST la règle en image : trois tuiles en −2, quatre en −3. Un
    // dessin figé mentirait la moitié du temps — celle où l'animateur choisit
    // l'autre mode —, et le cercle jouerait sur une règle qu'on ne lui a pas dite.
    await annoncer(browser);
    const j = joueurs[0].page;
    await expect(j.getByRole('heading', { name: JEU })).toBeVisible({ timeout: 15_000 });

    const tuiles = () => j.locator('.annonce__emblem rect').count();
    await expect.poll(tuiles, { timeout: 10_000 }).toBe(3);
    await expect(j.getByText(/deux images plus tard/)).toBeVisible();

    await hote.page.getByTestId('retour-mode-3').click();
    await expect.poll(tuiles, { timeout: 10_000 }).toBe(4);
    await expect(j.getByText(/trois images plus tard/)).toBeVisible();

    // Et le stream dit la même chose au même moment.
    await expect(stream.locator('.st-annonce__emblem rect, [data-testid="stream-annonce"] rect'))
      .toHaveCount(4);
  });

  test('LA SÉRIE NE FUIT PAS avant la révélation', async ({ browser }) => {
    // Trente identifiants dont six répètent celui d'il y a deux places, c'est la
    // réponse en clair. On fouille le HTML ENTIER des deux surfaces publiques :
    // une série transportée dans un attribut ou une charge utile inerte serait
    // tout aussi lisible par qui ouvre l'inspecteur.
    await annoncer(browser);
    await hote.page.getByTestId('retour-demarrer').click();
    const j = joueurs[0].page;
    await expect(j.getByTestId('retour-image')).toBeVisible({ timeout: 15_000 });

    for (const [nom, page] of [['le joueur', j], ['le stream', stream]]) {
      // Une image est affichée : le HTML contient donc UN signe, celui qu'on voit.
      // Il ne doit pas en contenir trente.
      const signes = await page.evaluate(() => {
        const html = document.documentElement.outerHTML;
        return ['ch-0', 'ch-1', 'ch-2', 'ch-3', 'ch-4', 'ch-5', 'ch-6', 'ch-7', 'ch-8', 'ch-9',
          'fg-cercle', 'fg-carre', 'fg-losange', 'fg-triangle', 'fg-croix']
          .filter((id) => html.includes(id)).length;
      });
      expect(signes, `la série est lisible sur ${nom} (${signes} signes trouvés)`).toBeLessThanOrEqual(1);
    }
  });

  test('LE BUZZ NE SE FIGE PAS, et chaque appui compte', async ({ browser }) => {
    // LE DÉFAUT GARDÉ. Tous les autres jeux ferment l'écran à la première réponse.
    // Ici il en faut six : un bouton qui se verrouille laisse le joueur regarder
    // passer les cinq retours suivants sans rien pouvoir faire. Rien ne casse —
    // le jeu tourne, il devient seulement injouable.
    await annoncer(browser);
    await hote.page.getByTestId('retour-demarrer').click();
    const j = joueurs[0].page;
    const bouton = j.getByTestId('answer-submit');
    await expect(bouton).toBeVisible({ timeout: 15_000 });
    await expect(bouton).toHaveText('Retour de flamme !');

    // TROIS BUZZ SUR TROIS IMAGES DIFFÉRENTES. On attend que l'image CHANGE, on
    // n'attend pas une durée : les créneaux du serveur sont décalés de la grâce
    // réseau (350 ms), si bien qu'attendre « une cadence » fait parfois retomber
    // dans le même créneau. Le contrôle devenait instable — et c'était mon rythme
    // qui l'était, pas le jeu.
    const place = () => j.getByTestId('retour-image').getAttribute('data-place');
    for (let n = 1; n <= 3; n += 1) {
      await expect(bouton, `le bouton s'est figé après ${n - 1} buzz`).toBeEnabled();
      const avant = await place();
      await bouton.click();
      await expect(j.getByTestId('retour-compte')).toContainText(`${n} buzz`);
      if (n < 3) await expect.poll(place, { timeout: 2 * CADENCE_RETOUR }).not.toBe(avant);
    }

    // DEUX APPUIS SUR LA MÊME IMAGE NE COMPTENT QU'UNE FOIS. Sur une fenêtre de
    // deux secondes, au doigt, sur un téléphone, le second est presque toujours un
    // rebond du premier — le compter coûterait 200 points pour un tremblement.
    await bouton.click();
    await j.waitForTimeout(200);
    await expect(j.getByTestId('retour-compte')).toContainText('3 buzz');
  });

  test('la révélation rend le graphique de la série, sur les deux écrans', async ({ browser }) => {
    await annoncer(browser, ['Braise', 'Ada']);
    await hote.page.getByTestId('retour-demarrer').click();
    const j = joueurs[0].page;
    await expect(j.getByTestId('answer-submit')).toBeVisible({ timeout: 15_000 });
    await j.getByTestId('answer-submit').click();
    await hote.page.getByRole('button', { name: /Révéler/ }).first().click();

    // LA CONSOLE. Trente images, six grossies — « les Retours d'image doivent être
    // mis en évidence ».
    const graf = hote.page.getByTestId('retour-graphique');
    await expect(graf).toBeVisible({ timeout: 15_000 });
    await expect(graf.locator('.vsgraf__col')).toHaveCount(TOTAL_RETOUR);
    await expect(graf.locator('[data-role="retour"]')).toHaveCount(RETOURS_PAR_SERIE);

    // L'ANTENNE N'A RIEN JETÉ. À vérifier AVANT de chercher le graphique : une
    // page morte ne montre rien, et l'absence du graphique serait alors le
    // symptôme, pas la faute.
    expect(jetees, `l'antenne a planté : ${jetees.join(' · ')}`).toEqual([]);

    // L'ANTENNE, la même chose.
    const serie = stream.getByTestId('stream-retour-serie');
    await expect(serie).toBeVisible();
    await expect(serie.locator('.st-serie__col')).toHaveCount(TOTAL_RETOUR);
    await expect(serie.locator('[data-role="retour"]')).toHaveCount(RETOURS_PAR_SERIE);

    // ET LES DEUX DÉSIGNENT LES MÊMES PLACES : deux graphiques du même jeu qui ne
    // montreraient pas les mêmes retours, c'est l'animateur qui commente autre
    // chose que ce que le public voit.
    const places = (l) => l.locator('[data-role="retour"]').evaluateAll(
      (els) => els.map((e) => Number(e.dataset.place)).sort((a, b) => a - b));
    expect(await places(serie)).toEqual(await places(graf));

    // LE JOUEUR reçoit son bilan, et le solde y figure MÊME NÉGATIF : la ligne
    // « Points gagnés » affiche 0 pour un joueur à −800, et ce zéro serait
    // incompréhensible sans le calcul en face.
    await expect(j.getByTestId('points-gained')).toBeVisible({ timeout: 15_000 });
    await expect(j.getByTestId('retour-bilan')).toBeVisible();
    await expect(j.getByTestId('voix-resultat')).toBeVisible();
    expect(await j.getByTestId('voix-resultat').innerText()).not.toMatch(/\{\w+\}/);
  });

  test('la série de l\'antenne TIENT DANS LE CADRE et laisse la pastille tranquille', async ({ browser }) => {
    // LE DÉFAUT GARDÉ, ET IL A ÉTÉ MESURÉ. À quinze colonnes, la série s'étendait
    // de 401 à 1949 sur une toile de 1920 : elle sortait du cadre à droite et
    // passait sous la pastille « rejoindre » à gauche, devant le public.
    //
    // ON MESURE LES COLONNES, PAS LA BOÎTE. Le conteneur, lui, tenait dans ses
    // bornes — c'est son CONTENU qui débordait, et aucune mesure de la boîte ne
    // l'aurait vu. C'est l'erreur qui m'a fait conclure « tout va bien » sur une
    // capture où les images étaient visiblement coupées.
    await annoncer(browser);
    await hote.page.getByTestId('retour-demarrer').click();
    await expect(joueurs[0].page.getByTestId('answer-submit')).toBeVisible({ timeout: 15_000 });
    await joueurs[0].page.getByTestId('answer-submit').click();
    await hote.page.getByRole('button', { name: /Révéler/ }).first().click();
    await expect(stream.getByTestId('stream-retour-serie')).toBeVisible({ timeout: 15_000 });

    const m = await stream.evaluate(() => {
      const boite = (q) => {
        const e = document.querySelector(q);
        if (!e) return null;
        const r = e.getBoundingClientRect();
        return { g: Math.round(r.left), d: Math.round(r.right), h: Math.round(r.top), b: Math.round(r.bottom) };
      };
      const cols = [...document.querySelectorAll('[data-testid="stream-retour-serie"] > *')]
        .map((e) => e.getBoundingClientRect());
      return {
        scene: boite('.stream'),
        past: boite('.rejoindre'),
        colonnes: cols.length,
        serie: {
          g: Math.round(Math.min(...cols.map((r) => r.left))),
          d: Math.round(Math.max(...cols.map((r) => r.right))),
          h: Math.round(Math.min(...cols.map((r) => r.top))),
          b: Math.round(Math.max(...cols.map((r) => r.bottom))),
        },
      };
    });
    console.log(`  série ${m.serie.g}..${m.serie.d} · scène ${m.scene.g}..${m.scene.d} · pastille ${m.past.g}..${m.past.d}`);
    expect(m.colonnes).toBe(TOTAL_RETOUR);
    expect(m.serie.g, 'la série sort du cadre à gauche').toBeGreaterThanOrEqual(m.scene.g);
    expect(m.serie.d, 'la série sort du cadre à droite').toBeLessThanOrEqual(m.scene.d);
    const recouvre = m.serie.g < m.past.d && m.serie.d > m.past.g
      && m.serie.h < m.past.b && m.serie.b > m.past.h;
    expect(recouvre, 'la série passe sous la pastille « rejoindre »').toBe(false);
  });
});
