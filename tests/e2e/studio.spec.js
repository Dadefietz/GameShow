// E2E — surface STUDIO (E1-E4) : navigation, grille, édition, validation.
// Le studio alimente les banques que le moteur joue : une question invalide
// enregistrée serait silencieusement écartée en partie — d'où le test de garde.
import { test, expect } from '@playwright/test';

test.describe('Studio (E1-E4)', () => {
  test('navigation, grille de modules et ouverture du panneau d\'édition', async ({ page }) => {
    await page.goto('/studio');

    // E1 — la navigation liste les modules et indique la source des banques.
    await expect(page.getByRole('navigation', { name: 'Navigation du studio' })).toBeVisible();
    await expect(page.getByRole('status')).toBeVisible(); // indicateur de source

    // E2 — la grille présente au moins un module avec ses capsules.
    const cards = page.getByRole('article');
    await expect(cards.first()).toBeVisible();

    // E3 — éditer ouvre le panneau, avec les quatre réglages du module.
    await cards.first().getByRole('button').first().click();
    const editor = page.getByRole('complementary');
    await expect(editor).toBeVisible();
    await expect(editor.getByLabel('Nom')).toBeVisible();
    await expect(editor.getByRole('radiogroup', { name: 'Type' })).toBeVisible();
    await expect(editor.getByLabel('Durée')).toBeVisible();
    await expect(editor.getByRole('radiogroup', { name: "Couleur d'accent" })).toBeVisible();
  });

  test('une question sans énoncé bloque l\'enregistrement et dit pourquoi', async ({ page }) => {
    await page.goto('/studio');
    await page.getByRole('article').first().getByRole('button').first().click();
    const editor = page.getByRole('complementary');

    // E4 — ajouter une question vierge, puis tenter d'enregistrer.
    await editor.getByRole('button', { name: 'Ajouter une question' }).click();
    await editor.getByRole('button', { name: /^Enregistrer/ }).click();

    // Deux niveaux, tous deux exigés par le design : l'erreur s'accroche à la
    // ligne concernée, ET le pied de panneau récapitule les points à corriger.
    await expect(editor.locator('p.qerror', { hasText: 'Aucune bonne réponse cochée' })).toBeVisible();
    await expect(editor.locator('[data-bind="module.validation"]')).toContainText("À corriger avant d'enregistrer");
    // Et le bouton porte le compte des points à corriger.
    await expect(editor.getByRole('button', { name: /à corriger/ })).toBeVisible();
  });

  test('la suppression d\'un module demande une confirmation', async ({ page }) => {
    await page.goto('/studio');
    await page.getByRole('article').first().getByRole('button').first().click();
    const editor = page.getByRole('complementary');

    // Le libellé en « … » ouvre la confirmation, il ne supprime jamais directement.
    await editor.getByRole('button', { name: /Supprimer ce module/ }).click();
    await expect(editor.getByRole('button', { name: 'Oui, supprimer' })).toBeVisible();
    await editor.getByRole('button', { name: 'Annuler' }).click();
    await expect(editor.getByRole('button', { name: 'Oui, supprimer' })).toHaveCount(0);
  });
});
