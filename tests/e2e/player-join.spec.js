// E2E — M2 : la racine du site est l'accueil joueur, join par code + pseudo.
import { test, expect } from '@playwright/test';

test.describe('Accueil joueur (M2)', () => {
  test("la page d'accueil est le formulaire joueur : code + pseudo, sans compte", async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel('Code de la partie')).toBeVisible();
    await expect(page.getByLabel('Ton pseudo')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rejoindre' })).toBeVisible();
    await expect(page.getByText('Aucun compte, aucune installation.')).toBeVisible();
  });

  test('un code de salon inexistant affiche une erreur claire, sans crash', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Code de la partie').fill('ZZZZZ');
    await page.getByLabel('Ton pseudo').fill('Testeuse');
    await page.getByRole('button', { name: 'Rejoindre' }).click();
    await expect(page.getByRole('alert')).toContainText("Ce salon n'existe pas");
  });

  test('le lien du jeu pré-remplit le code (?code=...)', async ({ page }) => {
    await page.goto('/?code=ABCDE');
    await expect(page.getByLabel('Code de la partie')).toHaveValue('ABCDE');
  });
});
