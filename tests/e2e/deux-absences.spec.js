// E2E — DEUX ABSENCES, ET NON UNE.
//
// CE QUI A ÉTÉ DEMANDÉ : « Es-tu capable de faire la différence entre les
// messages affichés à une personne qui vient d'arriver et qui n'a pas joué la
// manche, et les messages affichés à une personne qui était connectée mais qui
// n'a pas répondu à temps ? »
//
// LA RÉPONSE ÉTAIT NON. L'écran n'avait qu'une condition — `answered === false`,
// « aucune réponse enregistrée » — et affirmait dans les deux cas : « Tu es
// arrivé après le lancement. » Faux pour qui jouait depuis vingt minutes et
// venait de voir la question en entier.
//
// POURQUOI AUCUN CONTRÔLE NE POUVAIT LE VOIR. Un contrôle existant jouait bien le
// second cas — un joueur présent qui ne répond pas à la manche 2 — et vérifiait
// qu'on lui DISAIT quelque chose plutôt que de lui remontrer le relevé d'avant.
// Il vérifiait donc que le titre s'affichait, jamais qu'il était VRAI. C'est le
// seul contrôle du projet qui affirmait le contraire de ce qu'on corrige ici :
// il a été mis à jour, pas supprimé.
//
// CE FICHIER JOUE LES DEUX CAS DANS LA MÊME PARTIE, sur la même manche : c'est la
// seule disposition qui prouve qu'ils ne se ressemblent pas. Deux parties
// séparées auraient pu afficher le même écran sans qu'on s'en aperçoive.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer } from './helpers.js';
import { terminerPartie } from './cloture.js';
import { MOMENTS } from '../../src/client/shared/voix.js';

test.setTimeout(90_000);

test.describe('Les deux absences', () => {
  let hote = null;
  const joueurs = [];

  test.afterEach(async () => {
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    for (const j of joueurs.splice(0)) await j.ctx.close();
  });

  // Ce qu'on relève : le titre du verdict et la phrase de la voix. Pas une
  // présence à l'écran — le CONTENU, puisque c'est lui qui était faux.
  async function verdict(j) {
    const titre = (await j.page.locator('#verdict').textContent())?.replace(/\s+/g, ' ').trim() || '';
    const voix = (await j.page.getByTestId('voix-resultat').textContent().catch(() => null))
      ?.replace(/\s+/g, ' ').trim() || '';
    return { titre, voix };
  }

  test('le présent muet et l\'arrivant tardif ne lisent pas la même chose', async ({ browser }) => {
    hote = await openHost(browser);

    // LE PRÉSENT : il est là avant que la question ne parte, et ne répondra pas.
    const present = await joinAsPlayer(browser, hote.code, 'Present');
    joueurs.push(present);
    await expect(hote.page.getByTestId('player-count')).toContainText('1');

    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: 'Lancer Quiz' }).first().click();
    await expect(present.page.getByTestId('answer-option').first()).toBeVisible({ timeout: 15_000 });

    // L'ARRIVANT : il rejoint APRÈS le lancement. C'est la borne — le
    // déclenchement de la question — qui sépare les deux cas.
    const tardif = await joinAsPlayer(browser, hote.code, 'Tardif');
    joueurs.push(tardif);
    // La preuve qu'il est bien entré, c'est SON écran : `player-count` n'existe
    // qu'au salon d'attente, et l'animateur est déjà en direct.
    await expect(tardif.page.getByTestId('answer-option').first(),
      'le retardataire n\'a pas rejoint la manche en cours').toBeVisible({ timeout: 15_000 });

    // Ni l'un ni l'autre ne répond, et l'on révèle.
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();
    await expect(present.page.locator('#verdict')).toBeVisible({ timeout: 15_000 });
    await expect(tardif.page.locator('#verdict')).toBeVisible({ timeout: 15_000 });
    await present.page.waitForTimeout(900); // la voix se pose

    const p = await verdict(present);
    const t = await verdict(tardif);
    console.log(`  présent → « ${p.titre} » · « ${p.voix} »`);
    console.log(`  tardif  → « ${t.titre} » · « ${t.voix} »`);

    // 1. LES DEUX TITRES DIFFÈRENT. C'est tout l'objet : avant, ils étaient
    //    identiques.
    expect(p.titre, 'les deux absences affichent encore le même titre').not.toBe(t.titre);

    // 2. ET CHACUN EST LE SIEN. Sans cette moitié, deux titres faux mais
    //    différents passeraient.
    expect(t.titre, 'l\'arrivant tardif devrait lire qu\'il est arrivé après').toMatch(/sans toi/i);
    expect(p.titre, 'le joueur présent ne doit pas lire qu\'il est arrivé après').not.toMatch(/sans toi/i);

    // 3. LA VOIX SUIT LA MÊME DISTINCTION. Elle disait « Tu arrives : le cercle
    //    avait déjà commencé » à quelqu'un qui jouait depuis le début.
    // `temps.ecoule`, et non un moment neuf : celui-ci EXISTAIT depuis l'origine,
    // avec ses phrases, sans qu'aucun code ne l'atteigne. J'en avais créé un
    // doublon sans le voir ; le doublon a été supprimé.
    expect(MOMENTS['temps.ecoule'].phrases,
      `« ${p.voix} » n'appartient pas au moment du joueur devancé par le temps`).toContain(p.voix);
    expect(MOMENTS['manche.sans-toi'].phrases,
      `« ${t.voix} » n'appartient pas au moment de l'arrivant tardif`).toContain(t.voix);
  });

  test('celui qui a répondu ne tombe dans aucune des deux', async ({ browser }) => {
    // LE REVERS. Un drapeau mal branché pourrait faire lire « le temps t'a
    // devancé » à quelqu'un qui a répondu : il est présent au lancement, et son
    // absence de réponse est la seule chose qui devrait le distinguer.
    hote = await openHost(browser);
    const j = await joinAsPlayer(browser, hote.code, 'Repond');
    joueurs.push(j);
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: 'Lancer Quiz' }).first().click();
    await expect(j.page.getByTestId('answer-option').first()).toBeVisible({ timeout: 15_000 });
    await j.page.getByTestId('answer-option').first().click();
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();

    await expect(j.page.locator('#verdict')).toBeVisible({ timeout: 15_000 });
    const v = await verdict(j);
    console.log(`  a répondu → « ${v.titre} »`);
    expect(v.titre).not.toMatch(/sans toi/i);
    expect(v.titre).not.toMatch(/devancé/i);
    // Il a un relevé de points, ce qu'aucune des deux absences n'affiche.
    await expect(j.page.locator('.gain__value'), 'le joueur qui a répondu n\'a pas de relevé')
      .toHaveCount(1);
  });
});
