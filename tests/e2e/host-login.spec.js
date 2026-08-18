// E2E — page de connexion animateur : carte d'authentification SEULE (l'argumentaire
// produit vit sur la page joueur), et refus explicite pour un compte non-animateur.
import { test, expect } from '@playwright/test';

test.describe('Connexion animateur (/host)', () => {
  test("affiche la carte de connexion, sans l'argumentaire de la page d'accueil", async ({ page }) => {
    await page.goto('/host');
    // La carte de connexion est là — libellés de la maquette A1.
    await expect(page.getByRole('heading', { name: 'Poste de pilotage' })).toBeVisible();
    await expect(page.getByLabel('Adresse email')).toBeVisible();
    await expect(page.getByText('Un seul animateur')).toBeVisible();
    // Le bloc marketing et la porte joueur ont disparu de cette page.
    await expect(page.getByText('Anime ton propre jeu télévisé')).toHaveCount(0);
    await expect(page.getByText('Tu viens pour jouer ?')).toHaveCount(0);
    await expect(page.getByText('overlays transparents prêts pour OBS')).toHaveCount(0);
  });

  test("un salon mémorisé d'un autre compte n'ouvre pas la console animateur", async ({ browser }) => {
    // Session animateur volée/héritée : jeton valide, mais propriétaire inconnu du
    // compte connecté. Sans compte Supabase connecté ici, la console ne doit de toute
    // façon jamais s'ouvrir sur un salon inexistant côté serveur.
    const ctx = await browser.newContext();
    await ctx.addInitScript(() => {
      localStorage.setItem('host', JSON.stringify({
        code: 'ZZZZZ',
        hostToken: 'jeton-invalide',
        overlayToken: 'ov',
        ownerId: 'un-autre-compte',
      }));
    });
    const page = await ctx.newPage();
    await page.goto('/host');
    // Aucun code de salon exploitable ne doit s'afficher.
    await expect(page.getByTestId('room-code')).toHaveCount(0);
    await ctx.close();
  });
});
