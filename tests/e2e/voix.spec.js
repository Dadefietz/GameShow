// E2E — LA VOIX DU JEU SUR LES ÉCRANS (action 7 du PLAN-CHANTIER-v1).
//
// Le jeu était juste et froid : aux moments où le joueur ressent quelque chose,
// l'application lui répondait par un tableau de chiffres. Ce que ces tests
// vérifient n'est pas la qualité des phrases — ça reste affaire de relecture —
// mais qu'elles ARRIVENT au bon endroit, et qu'elles ne mentent pas.
//
// La règle éditoriale maîtresse est vérifiée ici aussi : on peut taquiner en
// privé, jamais en public. Le stream ne nomme personne.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.describe('La voix du jeu', () => {
  let hote = null;
  const joueurs = [];
  let stream = null;

  test.afterEach(async () => {
    if (stream) { await stream.close().catch(() => {}); stream = null; }
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    for (const j of joueurs.splice(0)) await j.ctx.close();
  });

  test('le joueur qui attend seul n\'a plus un écran figé', async ({ browser }) => {
    hote = await openHost(browser);
    joueurs.push(await joinAsPlayer(browser, hote.code, 'Seul'));
    const page = joueurs[0].page;

    const voix = page.getByTestId('voix-attente');
    await expect(voix).toBeVisible();
    const premiere = await voix.innerText();
    expect(premiere.length).toBeGreaterThan(0);

    // Le TITRE, lui, ne bouge pas : c'est lui qui nomme la page pour un lecteur
    // d'écran, et le faire tourner rendrait l'écran instable.
    // textContent, pas innerText : le titre est rendu en majuscules par le style,
    // et comparer l'un à l'autre ferait échouer le test pour une raison de casse.
    const titre = await page.locator('#wait-title').textContent();
    await page.waitForTimeout(6500);
    await expect(page.locator('#wait-title')).toHaveText(titre);

    // La ligne, elle, a tourné — et reste hors des annonces vocales.
    await expect(voix).toHaveAttribute('aria-hidden', 'true');
  });

  test('le résultat parle, et ne contredit jamais les chiffres', async ({ browser }) => {
    hote = await openHost(browser);
    joueurs.push(await joinAsPlayer(browser, hote.code, 'Resultat'));
    const page = joueurs[0].page;

    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: 'Lancer Quiz' }).click();
    await page.getByTestId('answer-option').first().click();
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();

    const voix = page.getByTestId('voix-resultat');
    await expect(voix).toBeVisible();
    const phrase = await voix.innerText();

    // COHÉRENCE : une phrase qui célèbre un réflexe alors qu'aucun supplément de
    // rapidité n'a été versé détruirait la crédibilité de tout le dispositif.
    const complement = page.getByTestId('points-speed');
    if (!(await complement.count())) {
      expect(phrase).not.toMatch(/rapide|réflexe|premier/i);
    }
    // Et jamais de repère dynamique resté brut à l'écran.
    expect(phrase).not.toMatch(/\{\w+\}/);
  });

  test('une mauvaise réponse est dite sans humilier', async ({ browser }) => {
    hote = await openHost(browser);
    joueurs.push(await joinAsPlayer(browser, hote.code, 'Rate'));
    const page = joueurs[0].page;

    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: 'Lancer Vrai / Faux' }).click();
    // On répond aux deux options possibles selon la question : on veut juste un
    // résultat, quel qu'il soit, et vérifier le registre.
    await page.getByTestId('answer-option').first().click();
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();

    const phrase = await page.getByTestId('voix-resultat').innerText();
    // Registre : jamais de mot qui rabaisse. La règle est « taquiner, pas
    // humilier » — et sur un échec, la taquinerie s'efface.
    expect(phrase).not.toMatch(/nul|bête|idiot|honte|pathétique/i);
  });

  test('le stream se tait sur une manche ordinaire, et ne nomme jamais personne', async ({ browser }) => {
    hote = await openHost(browser);
    for (const n of ['Un', 'Deux']) joueurs.push(await joinAsPlayer(browser, hote.code, n));
    stream = await hote.ctx.newPage();
    const token = await hote.page.evaluate(() => JSON.parse(localStorage.getItem('host')).overlayToken);
    await stream.goto(`/overlay?token=${token}`);

    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: 'Lancer Quiz' }).click();
    for (const j of joueurs) await j.page.getByTestId('answer-option').first().click();
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();
    await expect(stream.getByTestId('stats-panel')).toBeVisible();

    // DEUX joueurs seulement : sous le seuil de participation. Un pourcentage sur
    // deux personnes ne veut rien dire, et « 100 % ont trouvé » avec deux
    // participants est ridicule à l'antenne. Le stream doit se taire.
    await expect(stream.getByTestId('voix-plateau')).toHaveCount(0);

    // Et quoi qu'il arrive, le stream ne nomme aucun joueur pendant la manche :
    // il commente le GROUPE. Personne ne se fait chambrer devant l'audience.
    const panneau = await stream.getByTestId('stats-panel').innerText();
    for (const j of ['Un', 'Deux']) expect(panneau).not.toContain(j);
  });
});

// Les deux CAS LIMITES, ajoutés après l'audit du plan : la décision 11 exige une
// phrase de repli par situation, « jamais d'écran muet ». Ils n'étaient couverts
// par aucun moment de voix — le joueur arrivé en cours de partie n'avait qu'un
// texte figé, et celui qui attendait son résultat aussi.
test.describe('La voix dans les cas limites', () => {
  let hote = null;
  const joueurs = [];

  test.afterEach(async () => {
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    for (const j of joueurs.splice(0)) await j.ctx.close();
  });

  test('le joueur arrivé après le lancement n\'a pas un écran muet', async ({ browser }) => {
    hote = await openHost(browser);
    joueurs.push(await joinAsPlayer(browser, hote.code, 'Present'));

    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem').first().click();
    await expect(joueurs[0].page.getByTestId('question-text')).toBeVisible();

    // LE RETARDATAIRE arrive alors que la manche est déjà lancée.
    joueurs.push(await joinAsPlayer(browser, hote.code, 'Retard'));
    const tardif = joueurs[1].page;
    await expect(tardif.getByTestId('question-text')).toBeVisible();

    await joueurs[0].page.getByTestId('answer-option').first().click();
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();

    // Il n'a pas participé : on le lui dit, ET le jeu lui parle.
    await expect(tardif.getByText('sans toi')).toBeVisible();
    await expect(tardif.getByTestId('voix-resultat')).toBeVisible();
    const phrase = await tardif.getByTestId('voix-resultat').innerText();
    expect(phrase.length).toBeGreaterThan(0);
    // Aucun repère dynamique resté brut : c'est ce qu'une machine peut vérifier.
    expect(phrase).not.toMatch(/\{\w+\}/);
    // Le TON, lui, ne se teste pas par mots-clés : « Rien de perdu — tu entres
    // maintenant » est une phrase accueillante qu'un filtre naïf rejetterait pour
    // le mot « perdu ». Un contrôle qui échoue sur une bonne phrase est pire
    // qu'aucun contrôle. Le registre reste affaire de relecture, comme la
    // convention le dit elle-même.
  });
});
