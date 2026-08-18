// E2E — M2 : la racine du site est l'accueil joueur, join par code + pseudo.
// Sélecteurs stables (data-testid) : le texte de l'interface peut évoluer avec le
// design sans casser la garantie fonctionnelle.
import { test, expect } from '@playwright/test';

test.describe('Accueil joueur (M2)', () => {
  test("la page d'accueil est le formulaire joueur : code + pseudo, sans compte", async ({ page }) => {
    await page.goto('/');
    // Code saisi en 5 cases (une par caractère), puis le pseudo, puis l'action.
    await expect(page.getByTestId('join-code')).toBeVisible();
    await expect(page.getByTestId('join-code').getByRole('textbox')).toHaveCount(5);
    await expect(page.getByTestId('join-pseudo')).toBeVisible();
    await expect(page.getByTestId('join-submit')).toBeVisible();
    // La promesse produit reste affichée : aucun compte, aucune installation.
    await expect(page.getByText('Aucun compte, aucune installation.')).toBeVisible();
  });

  test('un code de salon inexistant affiche une erreur claire, sans crash', async ({ page }) => {
    await page.goto('/');
    const boxes = page.getByTestId('join-code').getByRole('textbox');
    for (const [i, ch] of [...'ZZZZZ'].entries()) await boxes.nth(i).fill(ch);
    await page.getByTestId('join-pseudo').fill('Testeuse');
    await page.getByTestId('join-submit').click();
    // L'erreur est rattachée au champ code, et reste lisible.
    await expect(page.getByTestId('join-error')).toContainText("Ce salon n'existe pas");
  });

  test('le lien du jeu pré-remplit le code (?code=...)', async ({ page }) => {
    await page.goto('/?code=ABCDE');
    const boxes = page.getByTestId('join-code').getByRole('textbox');
    await expect(boxes.nth(0)).toHaveValue('A');
    await expect(boxes.nth(4)).toHaveValue('E');
  });
});
