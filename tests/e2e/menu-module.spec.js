// E2E — LE MENU DE MODULE NE POUSSE PLUS LA PAGE (action 16 du PLAN-CHANTIER-v1).
//
// Le défaut corrigé : le menu s'ouvrait VERS LE BAS depuis un bouton situé dans la
// barre d'actions, elle-même tout en bas de l'écran (host.css .actions). Il partait
// donc sous le pied de la page, qui devait défiler pour l'atteindre — en plein
// direct. Le menu était pourtant déjà une surcouche : ce n'est pas « au-dessus de
// la page » qui manquait, c'est le SENS d'ouverture.
//
// Piège évité au passage : les deux menus de l'animateur partagent la même classe,
// mais pas la même barre. Le menu de sortie vit en HAUT et doit continuer de
// s'ouvrir vers le bas. Ce test vérifie les deux.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.describe('Menus de l\'écran animateur', () => {
  let hote = null;
  let joueur = null;

  test.afterEach(async () => {
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    if (joueur) { await joueur.ctx.close(); joueur = null; }
  });

  test('le menu de module s\'ouvre vers le haut et tient dans l\'écran', async ({ browser }) => {
    hote = await openHost(browser);
    joueur = await joinAsPlayer(browser, hote.code, 'Menu');

    // Il faut une manche en cours : c'est le seul écran qui porte ce menu.
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem').first().click();
    await expect(joueur.page.getByTestId('question-text')).toBeVisible();

    const declencheur = hote.page.getByRole('button', { name: 'Changer de module' });
    const avant = await hote.page.evaluate(() => window.scrollY);
    await declencheur.click();

    // Ciblé par la BARRE qui le porte, jamais par la classe corrigée : sinon le
    // test se contenterait de vérifier qu'on a bien écrit « --up » quelque part,
    // au lieu de mesurer où le menu se pose réellement.
    const menu = hote.page.locator('.actions .exit-menu__pop');
    await expect(menu).toBeVisible();

    const boite = await menu.boundingBox();
    const bouton = await declencheur.boundingBox();
    const hauteurEcran = await hote.page.evaluate(() => window.innerHeight);

    // 1. Il s'ouvre AU-DESSUS du bouton : son bas ne descend pas sous le haut
    //    du déclencheur. Avant correction, il commençait sous le bouton.
    expect(boite.y + boite.height).toBeLessThanOrEqual(bouton.y + 1);

    // 2. Il tient ENTIÈREMENT dans la fenêtre — c'est la plainte d'origine.
    expect(boite.y).toBeGreaterThanOrEqual(0);
    expect(boite.y + boite.height).toBeLessThanOrEqual(hauteurEcran);

    // 3. Et l'ouvrir n'a pas fait défiler la page.
    expect(await hote.page.evaluate(() => window.scrollY)).toBe(avant);
  });

  test('le menu de sortie, lui, reste ouvert vers le bas (il est en haut)', async ({ browser }) => {
    hote = await openHost(browser);

    const declencheur = hote.page.getByRole('button', { name: 'Menu' });
    await declencheur.click();

    // Ce menu-là n'est PAS marqué --up : renverser la classe partagée l'aurait
    // envoyé hors de l'écran par le haut. Il doit s'ouvrir sous son bouton.
    const menu = hote.page.locator('.exit-menu__pop');
    await expect(menu).toBeVisible();

    const boite = await menu.boundingBox();
    const bouton = await declencheur.boundingBox();
    const hauteurEcran = await hote.page.evaluate(() => window.innerHeight);

    expect(boite.y).toBeGreaterThanOrEqual(bouton.y + bouton.height - 1);
    expect(boite.y + boite.height).toBeLessThanOrEqual(hauteurEcran);
  });
});
