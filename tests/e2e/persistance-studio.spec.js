// E2E — CE QU'ON MODIFIE DANS LE STUDIO SURVIT AU RECHARGEMENT (A5).
//
// CE QUI A ÉTÉ DEMANDÉ : « Rendre les modifications de module persistantes. »
//
// DEUX DÉFAUTS DISTINCTS, LE MÊME SYMPTÔME.
//
// 1. LA SUPPRESSION NE PARTAIT JAMAIS AU SERVEUR. Le seul chemin vers le serveur
//    était le bouton « Enregistrer » du panneau d'édition. Or supprimer un module
//    FERME ce panneau, et `saveModule` sortait aussitôt — « if (!m) return » —
//    faute de module sélectionné. L'animateur supprimait un jeu, le voyait
//    disparaître, et le retrouvait intact au rechargement suivant.
//
// 2. UN JEU EN DIRECT NE POUVAIT PAS ÊTRE ENREGISTRÉ DU TOUT. La validation du
//    studio exigeait « au moins une question ». « Le lien » n'en a pas et n'en
//    aura jamais : sa question se tape à l'antenne. Le renommer, changer sa durée
//    ou sa couleur était donc refusé — pour une question qu'il ne peut pas avoir.
//    Le serveur connaissait pourtant l'exception depuis toujours (store.js écarte
//    les jeux sans question « sauf direct ») ; le studio la redéclarait à sa
//    façon, et se trompait.
//
// POURQUOI CE CONTRÔLE RECHARGE LA PAGE. Vérifier que l'écran a changé ne prouve
// rien : l'écran changeait déjà, c'était le serveur qui n'était pas prévenu. Seul
// un rechargement, qui relit la bibliothèque du serveur, distingue les deux.
import { test, expect } from '@playwright/test';
import { creerJeu, retirerJeux } from './helpers.js';

test.setTimeout(90_000);

const JEU = 'Épreuve de persistance';

test.describe('La persistance du studio', () => {
  test.afterEach(async () => { await retirerJeux(JEU, 'Le lien renommé'); });

  test('un module supprimé ne revient pas au rechargement', async ({ page }) => {
    await creerJeu({
      name: JEU,
      type: 'quiz',
      questions: [{ text: 'Question à supprimer avec son jeu', options: ['a', 'b'], correctIndex: 0 }],
    });

    await page.goto('/studio');
    await page.getByRole('button', { name: JEU }).first().click();
    const editeur = page.getByRole('complementary');
    await expect(editeur).toBeVisible();

    await editeur.getByRole('button', { name: /Supprimer ce module/ }).click();
    await editeur.getByRole('button', { name: 'Oui, supprimer' }).click();
    await expect(page.getByRole('button', { name: JEU })).toHaveCount(0);

    // LE SEUL CONTRÔLE QUI COMPTE : on relit depuis le serveur.
    await page.reload();
    await expect(page.locator('.studio')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: JEU }),
      'le module supprimé est revenu : la suppression n\'a jamais atteint le serveur').toHaveCount(0);
  });

  test('un jeu EN DIRECT, sans banque, peut être renommé et enregistré', async ({ page }) => {
    await page.goto('/studio');
    await expect(page.locator('.studio')).toBeVisible({ timeout: 15_000 });

    // « Le lien » est le jeu en direct livré d'office : aucune question, par
    // construction.
    const entree = page.getByRole('button', { name: 'Le lien', exact: false }).first();
    await expect(entree, 'le jeu en direct est introuvable dans la bibliothèque').toBeVisible();
    await entree.click();

    const editeur = page.getByRole('complementary');
    await expect(editeur).toBeVisible();
    await editeur.getByLabel('Nom').fill('Le lien renommé');
    await editeur.getByRole('button', { name: /^Enregistrer$/ }).click();

    // Aucune plainte de validation : c'est elle qui rendait l'enregistrement
    // impossible.
    await expect(editeur.locator('[data-bind="module.validation"]'),
      'la validation réclame une question à un jeu qui ne peut pas en avoir').toHaveCount(0);

    await page.reload();
    await expect(page.locator('.studio')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Le lien renommé' }).first(),
      'le nouveau nom n\'a pas survécu au rechargement').toBeVisible();

    // On remet le nom d'origine : la bibliothèque est partagée par toute
    // l'exécution, et un jeu renommé changerait ce que lancent les autres
    // contrôles (« Lancer Le lien »).
    await page.getByRole('button', { name: 'Le lien renommé' }).first().click();
    await editeur.getByLabel('Nom').fill('Le lien');
    await editeur.getByRole('button', { name: /^Enregistrer$/ }).click();
    await expect(editeur.locator('[data-bind="module.validation"]')).toHaveCount(0);
  });
});
