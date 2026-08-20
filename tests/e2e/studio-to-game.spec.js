// E2E — LE MAILLON MANQUANT : ce qu'on crée dans le Studio doit se jouer en partie.
//
// Aucune des onze vérifications existantes ne relie les deux surfaces : le Studio
// est testé seul (navigation, validation, suppression), la partie est testée seule
// (déroulé, révélation, podium). Le pont entre les deux n'a jamais été regardé —
// et c'est précisément là que le défaut vivait, invisible depuis des mois.
//
// Ce scénario est le FILET du chantier (PLAN-CHANTIER-v1, lot 0). Il est écrit
// AVANT les corrections et DOIT échouer en l'état. Un contrôle qui n'a jamais
// échoué ne prouve rien.
//
// Il échouait pour deux raisons, toutes deux corrigées par l'action 2 :
//   1. l'animateur ne pouvait pas lancer un jeu par son nom — son menu ne
//      proposait que les quatre types en dur (« Lancer Quiz ») ;
//   2. même lancé, le jeu piochait dans TOUTES les questions de son type
//      confondues, et affichait le nom générique du type.
//
// Il a été vu échouer, puis vu passer. Il garde désormais le pont : si quelqu'un
// réintroduit un aplatissement par type, c'est ici que ça se saura.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer } from './helpers.js';
import { terminerPartie } from './cloture.js';

// Marqueurs volontairement improbables : s'ils apparaissent à l'écran, ils ne
// peuvent venir que du Studio — jamais des questions d'exemple embarquées.
const JEU = 'Épreuve témoin';
const ENONCE = 'Quel est le mot de passe du feu de camp E2E ?';
const BONNE_REPONSE = 'Braise-2026';

test.describe('Studio → partie (le pont)', () => {
  // Salon gardé hors du test : le nettoyage doit avoir lieu MÊME quand le test
  // échoue, sinon le salon resté ouvert est redonné au test suivant qui hérite
  // d'une partie en cours (src/server/index.js:80).
  let hote = null;
  let joueur = null;

  test.afterEach(async () => {
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    if (joueur) { await joueur.ctx.close(); joueur = null; }
  });

  // L'annotation « échec attendu » a été RETIRÉE le 2026-08-20, quand l'action 2
  // a livré les jeux nommés : Playwright a signalé « attendu en échec, a réussi ».
  // Ce scénario est désormais la garantie permanente du pont Studio → partie.
  test('une question créée dans le Studio est jouée, sous le nom de son jeu', async ({ browser, page }) => {
    // ---- 1. Studio : créer un jeu nommé, avec UNE question reconnaissable ----
    await page.goto('/studio');
    // Deux boutons portent ce nom (navigation et grille) : on vise celui de la grille.
    await page.getByLabel('Gestion des modules')
      .getByRole('button', { name: 'Nouveau module' }).click();

    const editeur = page.getByRole('complementary');
    await expect(editeur).toBeVisible();
    await editeur.getByLabel('Nom').fill(JEU);

    await editeur.getByRole('button', { name: 'Ajouter une question' }).click();
    await editeur.getByPlaceholder('Rédige la question').fill(ENONCE);
    // `exact` obligatoire : sans lui, « Option 1 » attrape aussi le bouton radio
    // « Option 1 est la bonne réponse » posé juste à côté du champ.
    await editeur.getByLabel('Option 1', { exact: true }).fill('Cendre-1999');
    await editeur.getByLabel('Option 2', { exact: true }).fill(BONNE_REPONSE);
    await editeur.getByLabel('Option 3', { exact: true }).fill('Fumée-0000');
    await editeur.getByLabel('Option 4', { exact: true }).fill('Tison-1234');
    await editeur.getByRole('radio', { name: 'Option 2 est la bonne réponse' }).click();

    await editeur.getByRole('button', { name: /^Enregistrer$/ }).click();
    // L'enregistrement doit ABOUTIR : un échec silencieux ici masquerait la suite.
    await expect(editeur.getByRole('button', { name: /Enregistré|^Enregistrer$/ })).toBeVisible();
    await expect(editeur.locator('[data-bind="module.validation"]')).toHaveCount(0);

    // ---- 2. Animateur : ouvrir un salon et lancer CE jeu, par son nom ----
    hote = await openHost(browser);
    joueur = await joinAsPlayer(browser, hote.code, 'Témoin');
    await expect(hote.page.getByTestId('player-count')).toContainText('1');

    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    // Le menu liste les JEUX de la bibliothèque, sous leur nom.
    const entree = hote.page.getByRole('menuitem', { name: `Lancer ${JEU}` });
    await expect(entree).toBeVisible({ timeout: 3_000 });
    await entree.click();

    // ---- 3. Joueur : la question du Studio, sous le nom du jeu du Studio ----
    await expect(joueur.page.getByTestId('question-text')).toHaveText(ENONCE);
    await expect(joueur.page.locator('[data-bind="module.meta.name"]')).toContainText(JEU);
    // La bonne réponse saisie dans le Studio est bien proposée au joueur.
    await expect(joueur.page.getByRole('button', { name: BONNE_REPONSE })).toBeVisible();

  });
});
