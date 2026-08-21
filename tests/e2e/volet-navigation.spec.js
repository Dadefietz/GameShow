// E2E — LE VOLET DE NAVIGATION (chantier v4, action 9).
//
// CE QUI A ÉTÉ DEMANDÉ, DANS LES MOTS DE L'AUTEUR : « Ce qu'il faut en fait c'est
// même avec le salon ouvert avoir la capacité via un volet de navigation de passer
// au studio ou à la page initiale de lancement des jeux. […] Par contre il doit
// pouvoir revenir à l'animation sans problématique, déconnexion, fermeture du
// salon ou fin de la partie non désirée. »
//
// L'ÉTAT D'AVANT. L'adresse du stream n'était offerte QUE dans le salon d'attente :
// l'écran de direct ne recevait même pas le jeton — `LiveScreen` n'avait pas de
// propriété `overlayToken`. Une fois la partie lancée, l'animateur qui fermait son
// onglet OBS n'avait plus aucun moyen de retrouver l'adresse, ni d'atteindre le
// Studio autrement qu'en tapant l'URL à la main.
//
// CE QUE CE FICHIER PROUVE, ET QUI NE SE DÉDUIT PAS DE LA LECTURE DU CODE :
// que l'aller-retour est SANS CONSÉQUENCE. Le salon vit dans la mémoire du
// serveur, la session de l'animateur dans le stockage local ; rien ne garantit
// a priori qu'un aller-retour les retrouve tous les deux — et surtout pas la
// manche en cours, qui n'est rejouée qu'à la reconnexion.
//
// CE QU'IL A TROUVÉ AU PASSAGE. Le classement de la console revenait VIDE, sur
// une partie déjà jouée : il n'était diffusé que sur événement, jamais rejoué à
// un rattachement. Le défaut n'appartenait pas au volet — un simple F5 sur la
// console le produisait aussi — mais aucun contrôle ne regardait la console
// après une reconnexion. D'où le second contrôle, sur le score.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer, retirerJeux } from './helpers.js';
import { terminerPartie } from './cloture.js';

// Un aller-retour complet coûte deux chargements de page et deux reprises de
// session ; le plafond commun de 45 s laisse trop peu de marge.
test.setTimeout(90_000);

test.describe('Le volet de navigation', () => {
  let hote = null;
  let joueur = null;

  test.afterEach(async () => {
    // Les jeux fabriqués par ce fichier sont retirés : la bibliothèque est
    // PARTAGÉE, et dix contrôles lancent « le premier module de la liste ».
    await retirerJeux('Épreuve de podium');
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    if (joueur) { await joueur.ctx.close(); joueur = null; }
  });

  async function ouvrirVolet(page) {
    const volet = page.getByTestId('volet-navigation');
    await expect(volet, 'le volet de navigation est absent de cet écran').toBeVisible();
    await volet.getByRole('button', { name: 'Naviguer' }).click();
    return volet;
  }

  // L'aller-retour lui-même : le Studio, son chemin de retour (décision 9.4),
  // puis l'attente que la console ait VRAIMENT repris sa session.
  //
  // Cette attente n'est pas une précaution de confort. Le volet réapparaît dès le
  // premier rendu, avant que le socket n'ait rien reçu : relever l'état à cet
  // instant donne un salon vide sans qu'il le soit, et le contrôle accuserait à
  // tort. On attend donc une donnée qui NE PEUT venir que du serveur.
  async function allerRetour(page) {
    await page.getByRole('menuitem', { name: /Studio/ }).click();
    await expect(page.getByRole('heading', { name: 'Questionnaires' })).toBeVisible({ timeout: 15_000 });
    const retour = page.getByTestId('studio-retour-animation');
    await expect(retour, 'le Studio est un cul-de-sac : aucun retour vers l\'animation').toBeVisible();
    await retour.click();
    await expect(page.getByTestId('volet-navigation')).toBeVisible({ timeout: 15_000 });
    // On attend une donnée QUE LE SERVEUR SEUL peut fournir, et il y en a une par
    // phase : le compteur de joueurs au salon, celui des réponses en direct, le
    // décompte du classement au podium. Attendre le simple rendu ne prouverait
    // rien — le volet réapparaît avant que le socket n'ait rien reçu.
    await expect(page.getByTestId('player-count')
      .or(page.getByTestId('answers-count'))
      .or(page.locator('[data-bind="leaderboard.length"]'))
      .first())
      .toBeVisible({ timeout: 15_000 });
  }

  test('depuis le salon d\'attente : le salon et ses joueurs survivent', async ({ browser }) => {
    hote = await openHost(browser);
    joueur = await joinAsPlayer(browser, hote.code, 'Volet');
    await expect(hote.page.getByTestId('player-count')).toContainText('1');

    const volet = await ouvrirVolet(hote.page);
    // DÉCISION 9.8 — le volet DIT que le salon reste ouvert. Sans cette phrase,
    // l'animateur croit fermer son salon en le quittant et en rouvre un second,
    // avec un autre code, pendant que ses joueurs restent dans le premier.
    await expect(volet.getByTestId('nav-salon-ouvert')).toContainText('reste ouvert');
    await expect(volet.getByRole('menuitem', { name: 'Animation' })).toBeVisible();
    await expect(volet.getByRole('menuitem', { name: /Studio/ })).toBeVisible();

    await allerRetour(hote.page);

    // NI DÉCONNEXION, NI FERMETURE DU SALON (décision 9.6).
    await expect(hote.page.getByTestId('room-code'),
      'le code du salon a changé au retour').toHaveText(hote.code);
    await expect(hote.page.getByTestId('player-count'),
      'le joueur a été perdu au retour').toContainText('1');
    // Le joueur, lui, n'a rien vu passer : pas d'éjection vers le formulaire.
    await expect(joueur.page.getByTestId('join-form')).toHaveCount(0);
  });

  test('depuis le direct : la manche en cours est retrouvée', async ({ browser }) => {
    hote = await openHost(browser);
    joueur = await joinAsPlayer(browser, hote.code, 'Direct');
    await expect(hote.page.getByTestId('player-count')).toContainText('1');
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: 'Lancer Quiz' }).click();
    await expect(hote.page.getByTestId('question-text')).toBeVisible({ timeout: 15_000 });
    const enonce = (await hote.page.getByTestId('question-text').textContent())?.trim();

    const volet = await ouvrirVolet(hote.page);
    // LE CONTRÔLE QUI ÉCHOUE SUR LE DÉFAUT D'ORIGINE. En direct, la console ne
    // recevait pas le jeton du stream : ce lien ne pouvait pas exister.
    const lienStream = volet.getByTestId('nav-stream');
    await expect(lienStream, 'l\'adresse du stream est hors de portée en direct').toBeVisible();
    const href = await lienStream.getAttribute('href');
    expect(href, `adresse de stream inattendue : ${href}`).toMatch(/\/overlay\?token=.+/);
    // DÉCISION 9.3 — un ONGLET SÉPARÉ : le stream ne doit jamais remplacer la
    // console en plein direct.
    expect(await lienStream.getAttribute('target'),
      'le stream remplacerait la console au lieu de s\'ouvrir à côté').toBe('_blank');

    await allerRetour(hote.page);

    // NI FIN DE PARTIE NON DÉSIRÉE (décision 9.6) : la manche est toujours là,
    // c'est la vérification la plus fragile et la seule qui distingue un vrai
    // retour d'un salon rouvert à vide.
    await expect(hote.page.getByTestId('question-text'),
      'l\'énoncé en cours n\'a pas survécu à l\'aller-retour').toHaveText(enonce);
    await expect(joueur.page.getByTestId('join-form')).toHaveCount(0);
  });

  test('le classement gagné avant l\'excursion est encore là au retour', async ({ browser }) => {
    // Le revers des contrôles précédents. Un salon retrouvé « ouvert » avec les
    // bons joueurs mais des scores remis à zéro les passerait tous les deux, et
    // serait pourtant la pire des pertes en direct.
    hote = await openHost(browser);
    joueur = await joinAsPlayer(browser, hote.code, 'Marqueur');
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: 'Lancer Quiz' }).click();
    await expect(joueur.page.getByTestId('answer-option').first()).toBeVisible({ timeout: 15_000 });
    await joueur.page.getByTestId('answer-option').first().click();
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();
    await expect(hote.page.getByTestId('host-leaderboard')).toBeVisible({ timeout: 15_000 });
    const avant = (await hote.page.getByTestId('host-leaderboard').textContent())?.trim();

    await ouvrirVolet(hote.page);
    await allerRetour(hote.page);

    console.log(`  classement avant l'excursion : ${avant}`);
    // Assertion AUTO-RÉESSAYÉE : le classement arrive par socket, quelques
    // dizaines de millisecondes après le rendu. Une lecture unique mesurerait la
    // vitesse du réseau, pas la survie du score.
    await expect(hote.page.getByTestId('host-leaderboard'),
      'le classement a été perdu pendant l\'excursion').toHaveText(avant, { timeout: 15_000 });
  });

  test('depuis le podium final : la partie reste terminée, elle ne repart pas', async ({ browser, page }) => {
    // LA PHASE QUE LES TROIS CONTRÔLES PRÉCÉDENTS NE COUVRAIENT PAS.
    //
    // « Depuis chaque phase » (décision 9.7) en compte quatre, pas trois : le salon,
    // le direct, les résultats d'épreuve et LE PODIUM FINAL. Cette dernière est la
    // seule où la décision 9.6 a vraiment quelque chose à craindre — « ni fin de
    // partie non désirée » n'a de sens qu'une fois la partie terminée, et c'est le
    // seul écran de la console dont l'état vient du SERVEUR (`state === ended`) et
    // non d'un simple drapeau d'affichage.
    // IL FAUT QUE QUELQU'UN MARQUE. Sans point, la console affiche « Pas encore de
    // podium » et il n'y a pas de marches à retrouver : le contrôle échouait sur
    // l'absence d'un podium, non sur sa perte. On fabrique donc une question dont
    // on connaît la bonne réponse, plutôt que de cliquer au hasard et d'espérer.
    const JEU = 'Épreuve de podium';
    const BONNE = 'Braise-Podium';
    await page.goto('/studio');
    await page.getByLabel('Gestion des modules')
      .getByRole('button', { name: 'Nouveau module' }).click();
    const editeur = page.getByRole('complementary');
    await expect(editeur).toBeVisible();
    await editeur.getByLabel('Nom').fill(JEU);
    await editeur.getByRole('button', { name: 'Ajouter une question' }).click();
    await editeur.getByPlaceholder('Rédige la question').fill('Quelle braise pour le podium ?');
    await editeur.getByLabel('Option 1', { exact: true }).fill(BONNE);
    await editeur.getByLabel('Option 2', { exact: true }).fill('Cendre-0000');
    await editeur.getByLabel('Option 3', { exact: true }).fill('Fumée-1111');
    await editeur.getByLabel('Option 4', { exact: true }).fill('Suie-2222');
    await editeur.getByRole('radio', { name: 'Option 1 est la bonne réponse' }).click();
    await editeur.getByRole('button', { name: /^Enregistrer$/ }).click();
    await expect(editeur.locator('[data-bind="module.validation"]')).toHaveCount(0);

    hote = await openHost(browser);
    joueur = await joinAsPlayer(browser, hote.code, 'Podium');
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: `Lancer ${JEU}` }).first().click();
    await expect(joueur.page.getByRole('button', { name: BONNE })).toBeVisible({ timeout: 15_000 });
    await joueur.page.getByRole('button', { name: BONNE }).click();
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();

    // Fin de partie : c'est le podium final qui s'affiche, et lui seul.
    await hote.page.getByRole('button', { name: 'Menu' }).click();
    await hote.page.getByRole('menuitem', { name: 'Terminer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: /Confirmer/ }).click();
    await expect(hote.page.getByRole('heading', { name: 'Podium final' })).toBeVisible({ timeout: 15_000 });
    // Le podium n'a PAS de `host-leaderboard` : c'est un écran à part, avec ses
    // marches et son décompte. Une première version de ce contrôle l'attendait et
    // restait pendue quatre-vingt-dix secondes — le contrôle mesurait un sélecteur
    // d'un autre écran, pas la survie de la partie.
    const marches = hote.page.locator('[data-bind="podium"]');
    const total = hote.page.locator('[data-bind="leaderboard.length"]');
    await expect(marches).toBeVisible();
    const avant = (await marches.textContent())?.trim();
    const avantTotal = (await total.textContent())?.trim();

    await ouvrirVolet(hote.page);
    await allerRetour(hote.page);

    // On revient AU PODIUM, pas dans un salon rouvert : la partie est toujours
    // terminée, et son classement est celui d'avant l'excursion.
    await expect(hote.page.getByRole('heading', { name: 'Podium final' }),
      'la partie ne s\'est pas retrouvée terminée au retour').toBeVisible({ timeout: 15_000 });
    await expect(hote.page.locator('[data-bind="podium"]'),
      'le podium a été perdu pendant l\'excursion').toHaveText(avant, { timeout: 15_000 });
    // Le décompte vient du classement. VÉRIFIÉ, ET PAS SUPPOSÉ : sur une partie
    // TERMINÉE, il arrive par le rejeu de fin de partie (décision 3.3) et non par
    // le rejeu du classement au staff — désactiver ce dernier ne fait pas échouer
    // ce contrôle-ci. C'est en pleine partie qu'il manquait, et c'est le contrôle
    // du classement, plus haut, qui l'établit.
    await expect(hote.page.locator('[data-bind="leaderboard.length"]'),
      'le décompte des joueurs est reparti à zéro').toHaveText(avantTotal);
    console.log(`  podium retrouvé : ${avant} · ${avantTotal} joueur(s)`);
  });
});
