// E2E — LE CLAVIER DU TÉLÉPHONE NE CACHE PAS LA SAISIE (27/09).
//
// « Lorsqu'en tant que joueur on saisit un texte dans la zone de saisie et que
// son clavier apparaît sur mobile, il va venir cacher la zone de saisie. » Vu
// dans « Cache-cache ».
//
// CE QUE CE CONTRÔLE REPRODUIT, ET CE QU'IL NE PEUT PAS. Aucun navigateur de
// contrôle n'ouvre de clavier virtuel. Il reproduit le modèle d'ANDROID tel que
// la page le demande (`interactive-widget=resizes-content`) : un clavier qui
// s'ouvre, c'est la fenêtre qui passe de 874 à 440 pixels de haut pendant qu'un
// champ a le focus. Le modèle de l'iPhone — la page garde sa hauteur, seule la
// zone visible rétrécit — est éprouvé par `tests/unit/clavier.test.js` ; la
// feuille de style est la même dans les deux cas : elle ne lit que la hauteur
// visible.
//
// CE QUI EST EXIGÉ : dans les 440 pixels restants, tout ce dont le joueur a besoin
// pour répondre — l'énoncé, la grille qu'il désigne, le chrono, le champ, le
// bouton d'envoi — et le bouton fonctionne au doigt.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer, lancerJeu, creerJeu, retirerJeux } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.setTimeout(150_000);

const TELEPHONE = { viewport: { width: 402, height: 874 }, hasTouch: true, isMobile: true };
const AVEC_CLAVIER = 440;

// Tout l'élément dans la zone visible, ni rogné en haut ni caché en bas.
async function visible(page, locator, nom) {
  const b = await locator.boundingBox();
  expect(b, `« ${nom} » n'est pas affiché`).toBeTruthy();
  expect(b.y, `« ${nom} » passe au-dessus de l'écran`).toBeGreaterThanOrEqual(0);
  expect(b.y + b.height, `« ${nom} » est caché par le clavier`).toBeLessThanOrEqual(AVEC_CLAVIER + 0.5);
}

// LE MODÈLE DE L'IPHONE, par le zoom de la page — voir le contrôle qui porte ce
// nom. Chaque élément doit tenir dans la zone VISIBLE, en coordonnées de page.
async function dansLaZoneVisibleIphone(ctx, page, champ, elements) {
  await page.setViewportSize({ width: 402, height: 874 });
  await champ.focus();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });
  await expect(page.locator('html')).toHaveAttribute('data-clavier', 'ouvert');
  const zone = await page.evaluate(() => ({ haut: visualViewport.offsetTop, bas: visualViewport.offsetTop + visualViewport.height, page: innerHeight }));
  expect(zone.page, 'la page doit garder sa hauteur — sinon ce n’est plus le modèle de l’iPhone').toBe(874);
  for (const [nom, loc] of elements) {
    const b = await loc.evaluate((e) => { const r = e.getBoundingClientRect(); return { haut: r.top + scrollY, bas: r.bottom + scrollY }; });
    expect(b.haut, `« ${nom} » est au-dessus de la zone visible`).toBeGreaterThanOrEqual(zone.haut - 0.5);
    expect(b.bas, `« ${nom} » est sous le clavier`).toBeLessThanOrEqual(zone.bas + 0.5);
  }
  await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
}

async function ouvrirLeClavier(page, champ) {
  await champ.focus();
  await page.setViewportSize({ width: 402, height: AVEC_CLAVIER });
  await expect(page.locator('html')).toHaveAttribute('data-clavier', 'ouvert');
}

test('L’ACCUEIL : le code, le pseudo et « Entrer » tiennent au-dessus du clavier', async ({ browser }) => {
  const ctx = await browser.newContext(TELEPHONE);
  const page = await ctx.newPage();
  await page.goto('/');
  const pseudo = page.getByTestId('join-pseudo');
  await expect(pseudo).toBeVisible();
  // LE FOCUS SEUL NE RESSERRE RIEN : sans clavier, l'écran reste entier.
  await pseudo.focus();
  await expect(page.locator('html')).not.toHaveAttribute('data-clavier', 'ouvert');

  await ouvrirLeClavier(page, pseudo);
  await visible(page, page.getByTestId('join-code'), 'le code du salon');
  await visible(page, pseudo, 'le pseudo');
  await visible(page, page.getByTestId('join-submit'), 'Entrer dans le salon');
  // Et c'est l'écran qui porte tout : la page, elle, ne défile pas sous le clavier.
  const defile = await page.evaluate(() => document.scrollingElement.scrollHeight - window.innerHeight);
  expect(defile).toBeLessThanOrEqual(1);

  // LE CLAVIER DESCEND : l'écran retrouve sa forme.
  await page.setViewportSize({ width: 402, height: 874 });
  await pseudo.blur();
  await expect(page.locator('html')).not.toHaveAttribute('data-clavier', 'ouvert');
  await ctx.close();
});

test('LE MODÈLE DE L’IPHONE : la page garde sa hauteur, seule la zone visible rétrécit', async ({ browser }) => {
  // C'EST L'IPHONE QUI A MONTRÉ LE DÉFAUT, et son modèle se reproduit fidèlement
  // dans Chrome par le ZOOM DE LA PAGE : à ×2, la page garde ses 874 pixels de
  // haut et la zone visible tombe à 437 — exactement ce que fait un clavier posé
  // dessus dans Safari. Sans le calage de l'écran sur la zone visible, le champ
  // et le bouton restent en bas de la page, hors de la zone : c'est le défaut
  // rapporté, et ce contrôle le voit.
  const ctx = await browser.newContext(TELEPHONE);
  const page = await ctx.newPage();
  await page.goto('/');
  const pseudo = page.getByTestId('join-pseudo');
  await expect(pseudo).toBeVisible();
  await dansLaZoneVisibleIphone(ctx, page, pseudo, [
    ['le pseudo', pseudo], ['Entrer dans le salon', page.getByTestId('join-submit')],
  ]);
  await ctx.close();
});

test.describe('en partie', () => {
  const JEU = 'Cache-cache clavier';
  let hote = null;
  let joueur = null;

  test.afterEach(async () => {
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    if (joueur) { await joueur.ctx.close(); joueur = null; }
    await retirerJeux(JEU);
  });

  test('« CACHE-CACHE » : la question, la grille, le champ et « Envoyer » au-dessus du clavier — et l’envoi part au doigt', async ({ browser }) => {
    // UNE BANQUE QUI NE POSE QUE DES QUESTIONS À TAPER : « quel objet se cache
    // derrière… ». C'est l'écran de la capture de l'auteur.
    await creerJeu({
      name: JEU, type: 'cache_cache', questions: [{
        kind: 'contenu-cache',
        gabarits: [{ id: 'g-mot', forme: 'objet_derriere', gabarit: 'Quel objet se cache derrière {case} ?', min: 5, max: 5, actif: true }],
      }],
    });
    hote = await openHost(browser);
    joueur = await joinAsPlayer(browser, hote.code, 'Pouce', TELEPHONE);
    await expect(hote.page.getByTestId('player-count')).toHaveText('1');
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await lancerJeu(hote.page, JEU);
    await hote.page.getByTestId('cache-demarrer').click();

    const j = joueur.page;
    const champ = j.getByTestId('cc-saisie');
    await expect(champ).toBeVisible({ timeout: 90_000 });
    await ouvrirLeClavier(j, champ);

    await visible(j, j.getByTestId('question-text'), 'la question');
    await visible(j, j.getByTestId('cc-grille-hud'), 'la grille numérotée');
    await visible(j, j.getByRole('timer'), 'le chrono');
    await visible(j, champ, 'le champ');
    await visible(j, j.getByTestId('answer-submit'), 'Envoyer');

    // LE MÊME ÉCRAN, SUR LE MODÈLE DE L'IPHONE — celui de la capture.
    await dansLaZoneVisibleIphone(joueur.ctx, j, champ, [
      ['la question', j.getByTestId('question-text')], ['la grille numérotée', j.getByTestId('cc-grille-hud')],
      ['le champ', champ], ['Envoyer', j.getByTestId('answer-submit')],
    ]);

    // ET LE BOUTON FONCTIONNE AU DOIGT, clavier ouvert.
    await ouvrirLeClavier(j, champ);
    await champ.fill('Guitare');
    await j.getByTestId('answer-submit').tap();
    await expect(j.getByTestId('answer-submit')).toHaveText('Réponse envoyée');
  });
});
