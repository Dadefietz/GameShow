// E2E — flux complet animateur + joueurs (F1/F2/F3) : M1, M3, M4, M5, M6, M7, M9, M10, M11.
// Deux contextes navigateur : l'animateur sur /host, les joueurs sur /.
// Sélecteurs stables (data-testid) partout où le texte peut évoluer avec le design.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer } from './helpers.js';

test.describe('Partie complète animateur + joueurs', () => {
  test('création salon -> join -> quiz -> réponse -> révélation -> module suivant -> fin', async ({ browser }) => {
    // ---- M1 : l'animateur crée un salon avec code + QR ----
    const { ctx: hostCtx, page: host, code } = await openHost(browser);
    await expect(host.getByTestId('room-code')).toHaveText(code);
    expect(code).toMatch(/^[A-Z2-9]{5}$/);

    // ---- M2/F2 : une joueuse rejoint avec code + pseudo ----
    const { ctx: p1Ctx, page: p1 } = await joinAsPlayer(browser, code, 'Lea');
    await expect(p1.getByTestId('player-count')).toBeVisible();
    await expect(host.getByTestId('player-count')).toHaveText('1');

    // ---- M4/M7 : l'animateur choisit et lance un module librement ----
    await host.getByRole('button', { name: 'Lancer la partie' }).click();
    await host.getByRole('menuitem', { name: 'Lancer Quiz' }).click();

    // ---- M11/M9 : la joueuse voit la question et répond depuis sa manette ----
    await expect(p1.getByTestId('question-text')).toBeVisible();
    await p1.getByTestId('answer-option').first().click();
    // L'option choisie porte l'état du système.
    await expect(p1.getByTestId('answer-option').first()).toHaveAttribute('data-state', 'selected');

    // ---- M10 : le dashboard animateur montre compteur de réponses + chrono ----
    await expect(host.getByTestId('answers-count')).toHaveText('1');
    await expect(host.getByText('temps restant')).toBeVisible();

    // ---- M3/F3 : un retardataire rejoint PENDANT la question en cours ----
    const { ctx: p2Ctx, page: p2 } = await joinAsPlayer(browser, code, 'Tard');
    await expect(p2.getByTestId('question-text')).toBeVisible(); // intégré immédiatement

    // ---- M7 : révélation anticipée par l'animateur ----
    await host.getByRole('button', { name: 'Révéler maintenant' }).click();
    await expect(host.getByTestId('reveal-value')).toBeVisible();
    await expect(host.getByTestId('stats-panel')).toBeVisible(); // répartition des réponses

    // ---- M6 + R7 : la joueuse voit ses points et sa progression, JAMAIS son rang ----
    await expect(p1.getByTestId('points-gained')).toBeVisible();
    await expect(p1.getByTestId('places-delta')).toBeVisible();
    await expect(p1.getByTestId('reveal-value')).toBeVisible(); // bonne réponse montrée
    await expect(p1.getByText('Ton rang')).toHaveCount(0); // rang masqué en cours de partie

    // ---- M6 : classement recalculé côté animateur ----
    await expect(host.getByText('Top 5 en direct')).toBeVisible();
    // Le pseudo figure aussi dans le panneau Bonus/Malus : on cible le classement.
    await expect(host.getByLabel('Classement en direct').getByText('Lea')).toBeVisible();

    // ---- M4/M5 : enchaîner librement sur un AUTRE module (Vrai/Faux) via le menu ----
    await host.getByRole('button', { name: 'Changer de module' }).click();
    await host.getByRole('menuitem', { name: 'Vrai / Faux' }).click();
    await expect(p1.getByTestId('answer-option')).toHaveCount(2); // deux tuiles
    await p1.getByTestId('answer-option').first().click();
    await host.getByRole('button', { name: 'Révéler maintenant' }).click();
    await expect(p1.getByTestId('points-gained')).toBeVisible();

    // ---- M7/F1 : classement puis fin de partie (menu à confirmation en 2 temps) ----
    await host.getByRole('button', { name: 'Voir le classement' }).click();
    await expect(host.getByRole('heading', { name: 'Classement' })).toBeVisible();
    await host.getByRole('button', { name: 'Menu' }).click();
    await host.getByRole('menuitem', { name: 'Terminer la partie' }).click();
    await host.getByRole('menuitem', { name: 'Confirmer — terminer la partie' }).click();

    // Le rang FINAL est le seul moment où le rang est révélé au joueur. Il n'existe
    // que si le joueur a marqué — la question tirée étant aléatoire, on couvre les
    // deux issues plutôt que de dépendre du hasard.
    await expect(p1.getByTestId('end-screen')).toBeVisible();
    if (await p1.getByTestId('final-rank').count()) {
      await expect(p1.getByTestId('final-rank')).toBeVisible();
    } else {
      await expect(p1.getByText("Personne n'a marqué")).toBeVisible();
    }
    // Et l'écran de fin ne montre plus les repères de manche.
    await expect(p1.getByTestId('places-delta')).toHaveCount(0);

    await hostCtx.close();
    await p1Ctx.close();
    await p2Ctx.close();
  });
});

test.describe('Après la fin de partie', () => {
  // Régression : une fois la partie terminée, le menu proposait encore
  // « Terminer la partie » (sans objet) et aucune sortie non destructrice
  // n'existait — il fallait fermer le salon pour repartir.
  test('le menu ne propose plus de terminer, et un clic ramène au salon', async ({ browser }) => {
    const { ctx: hostCtx, page: host, code } = await openHost(browser);
    const { ctx: pCtx, page: p } = await joinAsPlayer(browser, code, 'Lea');

    await host.getByRole('button', { name: 'Lancer la partie' }).click();
    await host.getByRole('menuitem', { name: 'Lancer Quiz' }).click();
    await p.getByTestId('answer-option').first().click();
    await host.getByRole('button', { name: 'Révéler maintenant' }).click();

    await host.getByRole('button', { name: 'Voir le classement' }).click();
    await host.getByRole('button', { name: 'Menu' }).click();
    await host.getByRole('menuitem', { name: 'Terminer la partie' }).click();
    await host.getByRole('menuitem', { name: 'Confirmer — terminer la partie' }).click();

    // L'option devenue sans objet a disparu du menu.
    await host.getByRole('button', { name: 'Menu' }).click();
    await expect(host.getByRole('menuitem', { name: 'Terminer la partie' })).toHaveCount(0);
    await host.keyboard.press('Escape');

    // Un seul clic ramène au salon d'attente : le code est de nouveau affiché.
    await host.getByTestId('back-to-lobby').click();
    await expect(host.getByTestId('room-code')).toHaveText(code);
    // Le joueur quitte son podium et retrouve l'attente.
    await expect(p.getByTestId('end-screen')).toHaveCount(0);

    await hostCtx.close();
    await pCtx.close();
  });
});
