// E2E — « CACHE-CACHE », de bout en bout.
//
// C'EST LE SEUL JEU DU PROJET QUI SE DÉROULE EN PLUSIEURS TEMPS : une grille qui
// se dévoile pendant trente-huit secondes, cinq questions enchaînées par
// l'animateur, cinq réponses rendues une par une, puis la grille entière. Aucun
// contrôle unitaire ne peut voir cet enchaînement — il ne vit que dans le moteur,
// les trois écrans et le réseau qui les relie.
//
// CE QUI SE GARDE ICI, ET QU'UN TEST UNITAIRE NE VERRAIT PAS :
//   - la grille N'ARRIVE PAS AVEC LA QUESTION. Elle est poussée objet par objet :
//     une charge utile qui la contiendrait rendrait la partie lisible dans
//     l'inspecteur avant d'être vue, et le jeu de mémoire deviendrait un
//     copier-coller ;
//   - les cinq questions ne s'enchaînent PAS toutes seules ;
//   - les réponses se dévoilent une par une, et le total du joueur suit.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer, lancerJeu } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.setTimeout(180_000);

const JEU = 'Cache-cache';

test.describe('Cache-cache', () => {
  let hote = null;
  const joueurs = [];
  let stream = null;

  test.afterEach(async () => {
    if (stream) { await stream.close().catch(() => {}); stream = null; }
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    for (const j of joueurs.splice(0)) await j.ctx.close();
  });

  async function annoncer(browser, pseudos = ['Memo']) {
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

  test("l'annonce précède le jeu, sur les deux surfaces", async ({ browser }) => {
    await annoncer(browser);
    await expect(joueurs[0].page.getByRole('heading', { name: JEU })).toBeVisible({ timeout: 15_000 });
    await expect(stream.getByTestId('stream-annonce')).toBeVisible({ timeout: 15_000 });
    await expect(stream.getByTestId('stream-annonce')).toContainText('Neuf objets');
    await expect(hote.page.getByTestId('depart-cache')).toBeVisible();
  });

  test('LA GRILLE NE FUIT PAS : les objets arrivent un par un', async ({ browser }) => {
    await annoncer(browser);
    await hote.page.getByTestId('cache-demarrer').click();

    const j = joueurs[0].page;
    await expect(j.getByTestId('cc-grille')).toBeVisible({ timeout: 15_000 });

    // AUCUN OBJET DANS LA CHARGE UTILE. On fouille le HTML entier de la surface
    // publique : une grille transportée dans un attribut ou une charge inerte
    // serait lisible par qui ouvre l'inspecteur.
    const htmlAuDepart = await j.content();
    const images = (htmlAuDepart.match(/\/objets\//g) || []).length;
    expect(images, "la grille entière est arrivée d'un coup").toBeLessThanOrEqual(1);

    // ET ILS ARRIVENT. Trois secondes d'ouverture, puis le premier objet.
    await expect(j.locator('[data-testid="cc-grille"] [data-pleine]')).toHaveCount(1, { timeout: 15_000 });
    const premier = await j.locator('[data-testid="cc-grille"] [data-pleine]').getAttribute('data-place');
    // Il s'éteint, et un autre s'allume ailleurs.
    await expect(j.locator('[data-testid="cc-grille"] [data-pleine]')).toHaveCount(0, { timeout: 15_000 });
    await expect(j.locator('[data-testid="cc-grille"] [data-pleine]')).toHaveCount(1, { timeout: 15_000 });
    const second = await j.locator('[data-testid="cc-grille"] [data-pleine]').getAttribute('data-place');
    expect(second, 'le même objet se rallume au lieu du suivant').not.toBe(premier);

    // L'ANTENNE MONTRE LA MÊME CHOSE.
    await expect(stream.getByTestId('stream-cc-grille')).toBeVisible();
  });

  test('LES CINQ QUESTIONS NE S\'ENCHAÎNENT PAS TOUTES SEULES', async ({ browser }) => {
    await annoncer(browser);
    await hote.page.getByTestId('cache-demarrer').click();
    const j = joueurs[0].page;

    // La grille dure trente-huit secondes ; la première question arrive après.
    await expect(j.getByTestId('cc-numero')).toContainText('Question 1/5', { timeout: 60_000 });
    await expect(j.getByTestId('cc-grille-hud')).toBeVisible();
    // La grille numérotée est là, et elle porte bien les numéros.
    await expect(j.locator('[data-testid="cc-grille-hud"] [data-place="5"]')).toHaveText('5');

    // ON RÉPOND, puis on attend : sans l'animateur, la question 2 ne vient pas.
    await repondre(j);
    await j.waitForTimeout(12_000);
    await expect(j.getByTestId('cc-numero'), "la question a changé sans l'animateur")
      .toContainText('Question 1/5');

    await hote.page.getByTestId('host-reveler').click();
    await expect(j.getByTestId('cc-numero')).toContainText('Question 2/5', { timeout: 15_000 });
  });

  test('« Réponse envoyée » à qui a répondu, « Trop tard » à qui n\'a pas eu le temps', async ({ browser }) => {
    // L'ÉNONCÉ DONNE LES DEUX PHRASES MOT POUR MOT : « Les joueurs ayant répondu
    // ont le petit message "Réponse envoyée", alors que ceux qui n'ont pas eu le
    // temps vont avoir le petit message "Trop tard pour celle-là..." ».
    //
    // Les trois points comptent : il reste quatre questions derrière. « Temps
    // écoulé », la phrase des autres jeux, laisserait croire la manche finie.
    await annoncer(browser, ['Rapide', 'Lambin']);
    await hote.page.getByTestId('cache-demarrer').click();
    const [vif, lent] = joueurs.map((j) => j.page);
    await expect(vif.getByTestId('cc-numero')).toContainText('Question 1/5', { timeout: 60_000 });

    await repondre(vif);
    await expect(vif.getByTestId('answer-status')).toContainText('Réponse envoyée');

    // L'autre laisse filer les dix secondes.
    await expect(lent.getByTestId('answer-status'))
      .toContainText('Trop tard pour celle-là', { timeout: 20_000 });
  });

  test('la manche entière : cinq questions, cinq réponses, la grille', async ({ browser }) => {
    await annoncer(browser);
    await hote.page.getByTestId('cache-demarrer').click();
    const j = joueurs[0].page;
    await expect(j.getByTestId('cc-numero')).toContainText('Question 1/5', { timeout: 60_000 });

    // LES CINQ QUESTIONS. L'animateur enchaîne — sauf après la dernière, où le
    // même bouton passe aux réponses.
    for (let n = 1; n <= 5; n += 1) {
      await expect(j.getByTestId('cc-numero')).toContainText(`Question ${n}/5`, { timeout: 20_000 });
      await repondre(j);
      if (n < 5) await hote.page.getByTestId('host-reveler').click();
    }

    // LES RÉPONSES TOMBENT UNE PAR UNE, à la demande de l'animateur.
    for (let n = 1; n <= 5; n += 1) {
      await expect(hote.page.getByTestId('host-reveler'))
        .toHaveText(new RegExp(`Dévoiler la réponse ${n}`), { timeout: 20_000 });
      await hote.page.getByTestId('host-reveler').click();
      await expect(j.getByTestId('cc-dev-numero')).toContainText(`Réponse ${n}/5`, { timeout: 15_000 });
      await expect(hote.page.getByTestId('cache-reponses')).toBeVisible();
      // Le classement de l'animateur gagne une colonne à chaque réponse.
      await expect(hote.page.locator('[data-testid="cache-classement"] .clsm__ligne--tete .clsm__col'))
        .toHaveCount(n + 1);
    }

    // ET LE DERNIER GESTE RÉVÈLE LA GRILLE — c'est aussi la révélation de la manche.
    await expect(hote.page.getByTestId('host-reveler')).toHaveText(/Dévoiler la grille/);
    await hote.page.getByTestId('host-reveler').click();
    await expect(j.getByTestId('points-gained')).toBeVisible({ timeout: 15_000 });
    await expect(j.getByTestId('voix-resultat')).toBeVisible();
    expect(await j.getByTestId('voix-resultat').innerText()).not.toMatch(/\{\w+\}/);
  });
});

// Répond à la question affichée, quelle que soit sa forme : cinq couleurs à
// toucher, ou un mot à taper.
async function repondre(page) {
  const couleurs = page.getByTestId('cc-couleurs');
  if (await couleurs.count()) {
    await couleurs.getByTestId('answer-option').first().click();
    return;
  }
  await page.getByTestId('cc-saisie').fill('quelque chose');
  await page.getByTestId('answer-submit').click();
}
