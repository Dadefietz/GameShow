// E2E — UN SALON MORT NE CONDAMNE PAS LE SUIVANT.
//
// LE DÉFAUT (signalé le 26/09, capture à l'appui) : « Salon expiré » en boucle.
// L'animateur arrivait sur un salon mort — Render l'avait endormi ou redéployé,
// ce qui est normal —, cliquait « Ouvrir un nouveau salon »… et retombait sur
// « Salon expiré ». Le serveur, lui, avait bel et bien créé le salon neuf.
//
// LA CAUSE : `useGame` posait un drapeau « salon mort » sur `connect_error` et ne
// le levait jamais. Le jeton passait à `null`, l'effet s'arrêtait avant la remise
// à zéro, et au jeton SUIVANT la console relisait l'ancien verdict et jetait le
// salon neuf. Même maladie, deux fois, côté joueur : `roomClosed` restait vrai,
// et un joueur dont le salon avait été fermé était éjecté de la partie qu'il
// rejoignait ensuite.
//
// Aucun contrôle ne passait par cet écran : le défaut avait vécu depuis l'audit
// des états rémanents, invisible tant qu'un serveur ne redémarrait pas sous les
// pieds d'une console ouverte.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer } from './helpers.js';
import { terminerPartie } from './cloture.js';

// UNE SESSION D'ANIMATEUR FACTICE, dans le format que Supabase range lui-même.
// Le serveur de test tourne en mode ouvert (pas de liste d'animateurs) : il ne
// lit pas ce jeton. La console, elle, a besoin d'une session pour que « Ouvrir
// un nouveau salon » ouvre un salon au lieu de renvoyer à l'écran de connexion.
const CLE_SUPABASE = 'sb-sajdeadrrchahtuxmqxk-auth-token';

test('ANIMATEUR — « Ouvrir un nouveau salon » ouvre un salon, au lieu de retomber sur « Salon expiré »', async ({ browser }) => {
  const ctx = await browser.newContext();
  await ctx.addInitScript((cle) => {
    // Une seule fois : sans cette garde, le rechargement du salon neuf
    // replanterait le salon mort.
    if (sessionStorage.getItem('essai-plante')) return;
    sessionStorage.setItem('essai-plante', '1');
    const maintenant = Math.floor(Date.now() / 1000);
    localStorage.setItem(cle, JSON.stringify({
      access_token: 'jeton-factice', refresh_token: 'factice', token_type: 'bearer',
      expires_in: 86400, expires_at: maintenant + 86400,
      user: { id: 'animateur-essai', email: 'essai@local.test', aud: 'authenticated', role: 'authenticated' },
    }));
    // LE SALON MORT : un jeton que le serveur refuse — exactement ce que voit une
    // console restée ouverte pendant un redémarrage.
    localStorage.setItem('host', JSON.stringify({
      code: 'MORTS', hostToken: 'jeton-d-un-salon-disparu', overlayToken: 'x', ownerId: 'animateur-essai',
    }));
  }, CLE_SUPABASE);
  const page = await ctx.newPage();
  await page.goto('/host');

  // Le premier écran est JUSTE : ce salon-là est bien mort.
  await expect(page.getByText('Salon expiré')).toBeVisible();

  await page.getByRole('button', { name: 'Ouvrir un nouveau salon' }).click();

  // Le salon neuf s'affiche, avec son code…
  await expect(page.getByText('Code du salon', { exact: false })).toBeVisible();
  // …ET Y RESTE. Le défaut ne se voyait qu'un instant après : la console
  // affichait le salon neuf, puis le jetait au rendu suivant.
  await page.waitForTimeout(1500);
  await expect(page.getByText('Salon expiré')).toHaveCount(0);
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('host')));
  expect(session?.code, 'la console a perdu la session du salon neuf').toMatch(/^[A-Z0-9]{5}$/);
  expect(session.code).not.toBe('MORTS');

  await terminerPartie(page);
  await ctx.close();
});

test("JOUEUR — après un salon fermé, rejoindre une autre partie ne l'en éjecte pas", async ({ browser }) => {
  const a = await openHost(browser);
  const joueur = await joinAsPlayer(browser, a.code, 'Revenante');
  await expect(joueur.page.getByTestId('join-code')).toHaveCount(0);

  // L'animateur ferme le premier salon : le joueur est renvoyé, avec la raison.
  await terminerPartie(a.page);
  await expect(joueur.page.getByText("L'animateur a fermé le salon")).toBeVisible();
  await a.ctx.close();

  // Un second salon, rejoint DEPUIS LA MÊME PAGE — c'est là que le vieux
  // verdict « salon fermé » ressortait.
  const b = await openHost(browser);
  const cases = joueur.page.getByTestId('join-code').getByRole('textbox');
  for (const [i, ch] of [...b.code].entries()) await cases.nth(i).fill(ch);
  await joueur.page.getByTestId('join-pseudo').fill('Revenante');
  await joueur.page.getByTestId('join-submit').click();

  await expect(joueur.page.getByTestId('join-code')).toHaveCount(0);
  await joueur.page.waitForTimeout(1500);
  await expect(joueur.page.getByTestId('join-code'), 'le joueur a été éjecté du salon qu\'il venait de rejoindre').toHaveCount(0);
  await expect(joueur.page.getByText("L'animateur a fermé le salon")).toHaveCount(0);

  await terminerPartie(b.page);
  await b.ctx.close();
  await joueur.ctx.close();
});
