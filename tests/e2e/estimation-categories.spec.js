// E2E — LES CATÉGORIES DE L'ESTIMATION.
//
// CE QUI A ÉTÉ DEMANDÉ (02/11) : « Dans Estimation, il faut rajouter un champ
// Catégorie pour les questions (à l'image du champ Catégorie pour les questions
// de Vote, il faut prendre exemple pour l'interface Studio). Les questions
// Estimation peuvent être de catégorie Culture ou de catégorie Approximation. »
//
// CE QUE CE CONTRÔLE TIENT, ET POURQUOI IL NE DOUBLONNE PAS CELUI DU VOTE.
// Le câblage des catégories était déjà générique — `meta.categories` traverse
// jusqu'au Studio et jusqu'à la file. Mais DEUX ENDROITS SUPPOSAIENT ENCORE LE
// VOTE, et un seul jeu à catégories ne pouvait pas les révéler :
//
//   1. la file du serveur nommait la catégorie avec `categorieDe`, la fonction
//      DU VOTE : une question d'estimation en serait ressortie rangée dans
//      « Vie », une catégorie que son jeu ne connaît pas ;
//   2. l'écran de l'animateur repliait sur `'vie'` en dur quand la catégorie
//      manquait — la ligne serait tombée dans AUCUN onglet, et la question
//      aurait disparu de la file sous ses yeux.
//
// On vérifie donc les deux bouts : les onglets portent les bons noms, et chaque
// question est rangée dans le sien. Plus la reprise des questions écrites avant
// le 02/11, qui doivent atterrir dans « Culture » et non nulle part.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer, lancerJeu, creerJeu, retirerJeux } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.setTimeout(120_000);

const JEU = 'Estimation catégorisée';

const QUESTIONS = [
  { text: 'CULTURE 1 — En quelle année la tour Eiffel a-t-elle été inaugurée ?', target: 1889, nature: 'annee', categorie: 'culture' },
  { text: 'APPROX 1 — Combien de bus alignés feraient un kilomètre ?', target: 80, nature: 'nombre', categorie: 'approximation' },
  { text: 'CULTURE 2 — Combien de chromosomes dans une cellule humaine ?', target: 46, nature: 'nombre', categorie: 'culture' },
  { text: 'APPROX 2 — Combien de pas pour traverser un terrain de foot ?', target: 130, nature: 'nombre', categorie: 'approximation' },
  // SANS CATÉGORIE DÉCLARÉE : les questions écrites avant cette séance.
  { text: 'ANCIENNE — Hauteur de la tour Eiffel en mètres ?', target: 330, nature: 'nombre' },
];

test.describe("Les catégories de l'estimation", () => {
  let hote = null;
  const joueurs = [];

  test.afterEach(async () => {
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    for (const j of joueurs.splice(0)) await j.ctx.close();
    await retirerJeux(JEU);
  });

  const lignes = () => hote.page.locator('[data-testid="file-row"] .file__text')
    .evaluateAll((els) => els.map((e) => e.textContent.trim()));

  test('la file se range en deux onglets, et l\'ancienne question tombe dans « Culture »', async ({ browser }) => {
    await creerJeu({ name: JEU, type: 'estimation', questions: QUESTIONS });
    hote = await openHost(browser);
    joueurs.push(await joinAsPlayer(browser, hote.code, 'Estimateur'));
    await expect(hote.page.getByTestId('player-count')).toHaveText('1');
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    // SANS DONNER LE TOP : le top retire la tête de file, tirée au sort — une
    // fois sur cinq c'est « ANCIENNE » qui part, et le contrôle crierait à la
    // disparition d'une question que le produit a bel et bien rangée.
    await lancerJeu(hote.page, JEU, { demarrer: false });

    const onglets = hote.page.getByTestId('file-onglets');
    await expect(onglets).toBeVisible({ timeout: 15_000 });
    // L'ORDRE VIENT DU SERVEUR, comme pour le vote.
    await expect(onglets.getByRole('tab')).toHaveText([/Culture/, /Approximation/]);
    await expect(hote.page.getByTestId('file-onglet-culture'))
      .toHaveAttribute('aria-selected', 'true');

    // « CULTURE » : ses deux questions, PLUS l'ancienne sans catégorie.
    const culture = await lignes();
    expect(culture.some((t) => t.startsWith('ANCIENNE')),
      "une question sans catégorie déclarée a disparu de la file").toBe(true);
    expect(culture.filter((t) => t.startsWith('APPROX')),
      "une approximation s'est glissée dans l'onglet « Culture »").toEqual([]);
    expect(culture.length).toBe(3);

    await hote.page.getByTestId('file-onglet-approximation').click();
    const approx = await lignes();
    expect(approx.every((t) => t.startsWith('APPROX')),
      `l'onglet « Approximation » montre autre chose : ${approx.join(' | ')}`).toBe(true);
    expect(approx.length).toBe(2);
  });

  test('le Studio propose les deux catégories, et enregistre le choix', async ({ page }) => {
    await creerJeu({ name: JEU, type: 'estimation', questions: QUESTIONS.slice(0, 1) });
    await page.goto('/studio');

    // Ouvrir le jeu, puis sa première question.
    await page.getByRole('button', { name: new RegExp(JEU) }).first().click();
    await page.getByRole('button', { name: /Déplier|^1$/ }).first().click()
      .catch(() => page.locator('[data-action="studio:toggleQuestion"]').first().click());

    // LES DEUX TUILES SONT LÀ, et celle de la question est cochée.
    await expect(page.getByTestId('estimation-cat-culture')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('estimation-cat-approximation')).toBeVisible();
    await expect(page.getByTestId('estimation-cat-culture'))
      .toHaveAttribute('aria-checked', 'true');

    // LE CHOIX SE PREND, et il tient.
    await page.getByTestId('estimation-cat-approximation').click();
    await expect(page.getByTestId('estimation-cat-approximation'))
      .toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('estimation-cat-culture'))
      .toHaveAttribute('aria-checked', 'false');
  });
});
