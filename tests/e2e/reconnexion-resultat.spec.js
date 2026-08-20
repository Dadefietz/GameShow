// E2E — RESTITUTION DU RÉSULTAT APRÈS COUPURE (action 12 du PLAN-CHANTIER-v1).
//
// Le défaut corrigé : à la reconnexion, le serveur rejouait la question et la
// révélation, mais jamais le résultat PERSONNEL du joueur. L'écran de résultat,
// qui se décidait sur la seule présence de cette donnée, en concluait que le
// joueur n'avait pas participé et affichait « Manche jouée sans toi » — à
// quelqu'un qui venait de répondre. De la même cause venaient le score décalé et
// les bonus/malus d'une manche antérieure affichés sur la suivante.
//
// Pourquoi le défaut ne se voyait que sur mobile : Safari iOS suspend les onglets
// en arrière-plan et coupe les connexions temps réel. Chaque verrouillage d'écran
// provoquait une reconnexion, donc le défaut, plusieurs fois par partie — quand un
// joueur sur ordinateur ne le rencontrait presque jamais.
//
// C'est pourquoi ce test COUPE VRAIMENT le réseau (setOffline) au lieu de recharger
// la page : un rechargement ne reproduit pas le scénario qui casse en vrai.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.describe('Reconnexion en cours de partie', () => {
  // Nettoyage garanti même en cas d'échec — voir cloture.js.
  let hote = null;
  let joueur = null;

  test.afterEach(async () => {
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    if (joueur) { await joueur.ctx.close(); joueur = null; }
  });

  test('après une vraie coupure réseau, le joueur retrouve SON résultat', async ({ browser }) => {
    hote = await openHost(browser);
    joueur = await joinAsPlayer(browser, hote.code, 'Coupure');
    await expect(hote.page.getByTestId('player-count')).toHaveText('1');

    // Une manche jouée normalement : question, réponse, révélation.
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem').first().click();
    await expect(joueur.page.getByTestId('question-text')).toBeVisible();
    await joueur.page.getByTestId('answer-option').first().click();
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();

    // Le résultat est là avant la coupure : score chiffré, pas un tiret.
    await expect(joueur.page.getByTestId('points-gained')).toBeVisible();
    const scoreAvant = await joueur.page.locator('[data-bind="you.score"]').innerText();
    expect(scoreAvant).not.toBe('—');

    // ---- LA COUPURE : le lien temps réel tombe, puis revient ----
    await joueur.ctx.setOffline(true);
    await joueur.page.waitForTimeout(1200);
    await joueur.ctx.setOffline(false);

    // ---- CE QUI DOIT ÊTRE VRAI APRÈS ----
    // 1. On ne lui dit JAMAIS qu'il n'était pas là : il a répondu.
    await expect(joueur.page.getByText('sans toi')).toHaveCount(0);
    // 2. Son résultat de manche est de retour.
    await expect(joueur.page.getByTestId('points-gained')).toBeVisible({ timeout: 15_000 });
    // 3. Son score cumulé est inchangé — c'est son décalage qui déroutait.
    await expect(joueur.page.locator('[data-bind="you.score"]')).toHaveText(scoreAvant);

  });

  test('les points de la manche précédente ne survivent pas à la manche suivante', async ({ browser }) => {
    hote = await openHost(browser);
    joueur = await joinAsPlayer(browser, hote.code, 'Fantome');
    await expect(hote.page.getByTestId('player-count')).toHaveText('1');

    // Manche 1 : le joueur répond et voit ses points.
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem').first().click();
    await joueur.page.getByTestId('answer-option').first().click();
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();
    await expect(joueur.page.getByTestId('points-gained')).toBeVisible();

    // Manche 2 : lancée, mais le joueur NE RÉPOND PAS et on révèle aussitôt.
    await hote.page.getByRole('button', { name: 'Question suivante' }).click();
    await expect(joueur.page.getByTestId('question-text')).toBeVisible();
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();

    // Le joueur n'a pas répondu à la manche 2 : on le lui DIT, au lieu de lui
    // montrer un relevé — et surtout au lieu de lui remontrer celui de la manche
    // précédente. Sans identité de manche, l'écran affichait les points, bonus et
    // malus d'avant jusqu'à l'arrivée du nouveau résultat : les « points
    // fantômes ». C'est cette garantie que ce test protège.
    await expect(joueur.page.getByText('sans toi')).toBeVisible();
    await expect(joueur.page.getByTestId('points-gained')).toHaveCount(0);
    await expect(joueur.page.getByTestId('points-base')).toHaveCount(0);

  });
});
