// E2E — « CHASSE AUX ÉTOILES », de bout en bout.
//
// L'arbitre, la séquence et les canaux sont tenus ailleurs (tests unitaires,
// boucle d'intégration). Ce fichier regarde ce qui n'existe QUE dans un
// navigateur :
//   1. la console impose l'ordre — le mode, puis le niveau, puis le départ ;
//   2. le ciel a une taille, vingt points, et LE MÊME sur le téléphone et à
//      l'antenne ;
//   3. le compte à rebours de trois secondes, puis des étoiles qui s'allument ;
//   4. un doigt sur une étoile allumée l'éteint TOUT DE SUITE et marque ; un
//      doigt sur un point éteint coûte ;
//   5. le tableau des dix meilleurs bouge à l'antenne, et le bilan des trois
//      écrans dit les bons, les ratés et le solde ;
//   6. le Studio règle les quatre combinaisons, et dit quand l'une ne tient pas.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer, lancerJeu, creerJeu, retirerJeux, BASE } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.setTimeout(180_000);

const JEU = 'Étoiles du contrôle';
const TELEPHONE = { viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true };

test.describe('Chasse aux étoiles', () => {
  let hote = null;
  const joueurs = [];
  let stream = null;

  test.beforeEach(async () => {
    await retirerJeux(JEU);
    await creerJeu({ name: JEU, type: 'etoiles', duration: 20, questions: [] });
  });

  test.afterEach(async () => {
    if (stream) { await stream.close().catch(() => {}); stream = null; }
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    for (const j of joueurs.splice(0)) await j.ctx.close();
    await retirerJeux(JEU);
  });

  async function annoncer(browser, { avecStream = false, pseudos = ['Comète'] } = {}) {
    hote = await openHost(browser);
    for (const p of pseudos) joueurs.push(await joinAsPlayer(browser, hote.code, p, TELEPHONE));
    if (avecStream) {
      stream = await hote.ctx.newPage();
      await stream.setViewportSize({ width: 1920, height: 1080 });
      const token = await hote.page.evaluate(() => JSON.parse(localStorage.getItem('host')).overlayToken);
      await stream.goto(`/overlay?token=${token}`);
      await expect(stream.getByTestId('stream-room-code')).toHaveText(hote.code);
    }
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await lancerJeu(hote.page, JEU, { demarrer: false });
    await expect(hote.page.getByTestId('depart-etoiles')).toBeVisible();
  }

  test('LA CONSOLE : LE MODE, PUIS LE NIVEAU, PUIS LE DÉPART', async ({ browser }) => {
    await annoncer(browser);
    const h = hote.page;
    // Rien ne part tant que les deux ne sont pas choisis.
    await expect(h.getByTestId('etoiles-demarrer')).toBeDisabled();
    await expect(h.getByTestId('etoiles-niveau-facile')).toHaveCount(0);
    await h.getByTestId('etoiles-mode-ciel').click();
    await expect(h.getByTestId('etoiles-niveau-facile')).toBeVisible();
    await expect(h.getByTestId('etoiles-demarrer')).toBeDisabled();
    await h.getByTestId('etoiles-niveau-difficile').click();
    // CE QUE LA MANCHE DONNERA, en clair : le maximum annoncé par le document.
    await expect(h.getByTestId('etoiles-apercu')).toContainText('60 étoiles');
    await expect(h.getByTestId('etoiles-apercu')).toContainText('1500 au plus');
    await h.getByTestId('etoiles-mode-chasse').click();
    await expect(h.getByTestId('etoiles-apercu')).toContainText('20 étoiles');
    await expect(h.getByTestId('etoiles-apercu')).toContainText('1200 au plus');
    await expect(h.getByTestId('etoiles-demarrer')).toBeEnabled();
  });

  test('LE CIEL, LE COMPTE À REBOURS, UNE ÉTOILE TOUCHÉE, UN POINT ÉTEINT, ET LES TROIS BILANS', async ({ browser }) => {
    await annoncer(browser, { avecStream: true });
    const h = hote.page;
    await h.getByTestId('etoiles-mode-chasse').click();
    await h.getByTestId('etoiles-niveau-facile').click();
    await h.getByTestId('etoiles-demarrer').click();

    const j = joueurs[0].page;
    // LE COMPTE À REBOURS COMMUN, sur le téléphone et à l'antenne.
    await expect(j.getByTestId('etoiles-compte')).toBeVisible({ timeout: 20_000 });
    await expect(stream.getByTestId('stream-etoiles-compte')).toBeVisible();
    await expect(j.getByTestId('question-text')).toHaveText('Chasse · Facile');

    // VINGT POINTS, ET LE CIEL A UNE TAILLE.
    const etoiles = j.getByTestId('ciel-etoile');
    await expect(etoiles).toHaveCount(20);
    const ciel = await j.getByTestId('ciel').boundingBox();
    expect(ciel.width, 'le ciel est trop petit sur le téléphone').toBeGreaterThan(280);
    expect(ciel.height, 'le ciel n’a pas de hauteur').toBeGreaterThan(370);
    const grand = await stream.getByTestId('stream-ciel').boundingBox();
    // LE CIEL DU STREAM A GRANDI (19/11) — « la zone de jeu des étoiles doit être
    // plus grande ». 630 pixels de haut avant ; plus de 680 maintenant, et dans
    // la scène.
    expect(grand.height, 'le ciel est trop petit à l’antenne').toBeGreaterThan(680);
    expect(grand.y + grand.height).toBeLessThanOrEqual(1080);
    // LE MÊME CIEL À L'ANTENNE : chaque point au même endroit, en proportion.
    const positions = async (page, id) => page.locator(`[data-testid="${id}"]`).evaluateAll(
      (els) => els.map((e) => `${e.style.left}|${e.style.top}`));
    expect(await positions(stream, 'stream-ciel-etoile')).toEqual(await positions(j, 'ciel-etoile'));

    // UNE ÉTOILE S'ALLUME — on la touche.
    const allumee = j.locator('[data-testid="ciel-etoile"][data-allumee="oui"]').first();
    await expect(allumee).toBeVisible({ timeout: 15_000 });
    // Elle est plus grande qu'un point éteint : la forme et la taille changent, pas
    // seulement la couleur.
    const eclat = await allumee.locator('.ciel__halo').boundingBox();
    const point = await j.locator('[data-testid="ciel-etoile"][data-allumee="non"] .ciel__point').first().boundingBox();
    expect(eclat.width).toBeGreaterThan(point.width * 3);
    const i = await allumee.getAttribute('data-i');
    const b = await allumee.boundingBox();
    await j.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    // ELLE S'ÉTEINT TOUT DE SUITE sur cet écran, et le score monte.
    await expect(j.locator(`[data-testid="ciel-etoile"][data-i="${i}"]`)).toHaveAttribute('data-allumee', 'non', { timeout: 300 });
    const score = j.locator('[data-testid="etoiles-score"] .etj__score-valeur');
    await expect(score).toHaveText('60', { timeout: 5_000 });

    // UN POINT ÉTEINT TOUCHÉ COÛTE AUTANT.
    const eteint = j.locator('[data-testid="ciel-etoile"][data-allumee="non"]').nth(5);
    const e = await eteint.boundingBox();
    await j.touchscreen.tap(e.x + e.width / 2, e.y + e.height / 2);
    await expect(score).toHaveText('0', { timeout: 5_000 });

    // LE TABLEAU EN DIRECT, À L'ANTENNE, avec le nom du joueur.
    await expect(stream.getByTestId('stream-etoiles-top-ligne').first()).toContainText('Comète', { timeout: 5_000 });

    // LA RÉVÉLATION.
    await h.getByRole('button', { name: 'Révéler maintenant' }).click();
    await expect(j.getByTestId('etoiles-bilan')).toBeVisible({ timeout: 20_000 });
    await expect(j.getByTestId('etoiles-bons')).toContainText('1');
    await expect(j.getByTestId('etoiles-rates')).toHaveText('1');
    await expect(j.getByTestId('etoiles-gagnes')).toHaveText('+60');
    await expect(j.getByTestId('etoiles-perdus')).toHaveText('−60');
    await expect(j.locator('#verdict')).toHaveText('Trop pressé');
    await expect(j.getByTestId('voix-resultat')).not.toBeEmpty();

    // LA CONSOLE : le classement, avec bons et ratés.
    const ligne = h.getByTestId('classement-ligne').first();
    await expect(ligne).toContainText('Comète', { timeout: 10_000 });
    await expect(ligne).toContainText('0');

    // L'ANTENNE : les chiffres du cercle, le tableau figé, et une phrase.
    await expect(stream.getByTestId('stream-etoiles-reveal')).toBeVisible({ timeout: 10_000 });
    await expect(stream.getByTestId('stream-etoiles-top')).toHaveAttribute('data-final', 'oui');
    await expect(stream.getByTestId('stream-etoiles-top-ligne').first()).toContainText('Comète');
    await expect(stream.getByTestId('voix-plateau')).not.toBeEmpty();
  });

  test('LE STUDIO RÈGLE LES QUATRE COMBINAISONS, ET DIT QUAND L’UNE NE TIENT PAS', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await page.goto(`${BASE}/studio`);
      await page.getByRole('article').filter({ hasText: JEU }).getByRole('button').first().click();
      const editeur = page.getByTestId('studio-editeur');
      await expect(editeur.getByTestId('etoiles-reglages')).toBeVisible();
      for (const k of ['ciel-facile', 'ciel-difficile', 'chasse-facile', 'chasse-difficile']) {
        await expect(editeur.getByTestId(`etoiles-reglage-${k}`)).toBeVisible();
      }
      await expect(editeur.getByTestId('etoiles-bilan-ciel-facile')).toContainText('1000 points au plus');
      // LES VALEURS DU DOCUMENT, QUI NE TENAIENT PAS : le Studio le dit.
      await editeur.getByTestId('etoiles-ciel-facile-duree').fill('1.5');
      await expect(editeur.getByTestId('etoiles-bilan-ciel-facile')).toContainText('ne tiennent pas');
      // ON RÈGLE, ON ENREGISTRE, LE SERVEUR LE GARDE.
      await editeur.getByTestId('etoiles-ciel-facile-duree').fill('0.9');
      await editeur.getByTestId('etoiles-chasse-facile-points').fill('50');
      await expect(editeur.getByTestId('etoiles-bilan-chasse-facile')).toContainText('750 points au plus');
      await editeur.getByRole('button', { name: /^Enregistrer/ }).click();
      await expect(editeur.getByRole('button', { name: /^Enregistrer/ })).toBeEnabled({ timeout: 20_000 });
      const apres = await fetch(`${BASE}/api/modules`).then((r) => r.json());
      const jeu = (apres.modules || []).find((m) => m.name === JEU);
      const reglages = (jeu?.questions || []).find((q) => q.kind === 'contenu-etoiles')?.reglages;
      expect(reglages?.ciel?.facile?.duree).toBe(0.9);
      expect(reglages?.chasse?.facile?.points).toBe(50);
    } finally {
      await ctx.close();
    }
  });
});
