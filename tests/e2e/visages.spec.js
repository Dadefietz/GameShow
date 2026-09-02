// E2E — « LES VISAGES », de l'annonce au graphique de la série.
//
// CE QUE CE JEU A DE PARTICULIER, ET QU'AUCUN CONTRÔLE EXISTANT NE COUVRAIT :
//   - sa question n'est pas un texte mais une SÉRIE de trente visages, poussés un
//     par un par le serveur, une toutes les deux secondes ;
//   - la réponse ne se lit pas dans ce qu'on répond mais dans QUAND on répond ;
//   - et surtout : la série ne doit JAMAIS atteindre le client d'un bloc. Trente
//     identifiants dont un figure deux fois, c'est la réponse en clair dans
//     l'onglet réseau — et ce jeu ne consiste qu'à retrouver cette répétition.
//
// Le tirage et le barème sont vérifiés au chiffre près dans
// `tests/unit/visages.test.js`, sur mille séries. Ici on vérifie ce qu'aucun
// contrôle unitaire ne peut voir : que les écrans existent, qu'ils s'enchaînent,
// que les visages défilent vraiment, et que la série ne fuit pas.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.setTimeout(120_000);

test.describe('Les visages', () => {
  let hote = null;
  const joueurs = [];

  test.afterEach(async () => {
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    for (const j of joueurs.splice(0)) await j.ctx.close();
  });

  async function annoncer(browser, pseudos) {
    hote = await openHost(browser);
    for (const p of pseudos) joueurs.push(await joinAsPlayer(browser, hote.code, p));
    await expect(hote.page.getByTestId('player-count')).toHaveText(String(pseudos.length));
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: 'Lancer Les visages' }).first().click();
  }

  test('l\'annonce précède la série, et le départ appartient à l\'animateur', async ({ browser }) => {
    await annoncer(browser, ['Un', 'Deux']);

    // L'ANIMATEUR a son bouton de départ, et rien d'autre à saisir : la série est
    // tirée par le serveur.
    await expect(hote.page.getByTestId('depart-visages'),
      'le panneau de départ ne s\'ouvre pas').toBeVisible({ timeout: 15_000 });
    await expect(hote.page.getByTestId('visages-demarrer')).toBeEnabled();

    // LE CERCLE voit le jingle — le nom du jeu — et rien à répondre encore.
    for (const j of joueurs) {
      await expect(j.page.getByRole('heading', { name: 'Les visages' }),
        'le joueur ne voit pas l\'annonce du jeu').toBeVisible({ timeout: 15_000 });
      await expect(j.page.getByTestId('answer-submit'),
        'il ne devrait rien avoir à buzzer pendant l\'annonce').toHaveCount(0);
      await expect(j.page.getByTestId('visage-courant'),
        'aucun visage ne doit défiler avant le départ').toHaveCount(0);
    }
  });

  test('les visages défilent, un seul à la fois, et le buzz ne part qu\'une fois', async ({ browser }) => {
    await annoncer(browser, ['Oeil']);
    await hote.page.getByTestId('visages-demarrer').click();

    const j = joueurs[0].page;
    const cadre = j.getByTestId('visage-courant');
    await expect(cadre, 'aucun visage n\'apparaît au départ').toBeVisible({ timeout: 15_000 });

    // UN SEUL VISAGE À LA FOIS. Deux cadres à l'écran voudraient dire que le
    // précédent n'a pas cédé la place — et dans ce jeu, un visage vu est un
    // visage qui compte.
    await expect(cadre, 'plusieurs visages sont affichés en même temps').toHaveCount(1);

    // ILS DÉFILENT VRAIMENT. On relève la place affichée, on laisse passer deux
    // cadences, et on exige qu'elle ait avancé. Sans ce contrôle, une série figée
    // sur son premier visage passerait tous les autres.
    const place = async () => Number(await cadre.getAttribute('data-place'));
    const depart = await place();
    expect(depart, 'la première place devrait être 1').toBe(1);
    await expect.poll(place, { timeout: 15_000, message: 'la série ne défile pas' })
      .toBeGreaterThanOrEqual(3);
    console.log(`  la série a avancé jusqu'à la place ${await place()}`);

    // LE BUZZ, UNE FOIS ET UNE SEULE.
    const buzz = j.getByTestId('answer-submit');
    await expect(buzz).toHaveText('Déjà vu ce visage !');
    await buzz.click();
    await expect(buzz, 'le buzz ne se dit pas parti').toHaveText('Buzz envoyé', { timeout: 10_000 });
    await expect(buzz, 'on peut buzzer une seconde fois').toBeDisabled();
  });

  test('la révélation montre la série entière, et le visage doublé à ses deux places', async ({ browser }) => {
    await annoncer(browser, ['Regard']);
    await hote.page.getByTestId('visages-demarrer').click();

    const j = joueurs[0].page;
    await expect(j.getByTestId('visage-courant')).toBeVisible({ timeout: 15_000 });
    await j.getByTestId('answer-submit').click();

    // On ne laisse pas courir la minute entière : l'animateur révèle, comme il le
    // ferait pour couper court à l'antenne.
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();

    // ---- LA CONSOLE : la série entière, trente places ----
    const graf = hote.page.getByTestId('visages-graphique');
    await expect(graf, 'le graphique de la série manque à la console').toBeVisible({ timeout: 15_000 });
    await expect(graf.locator('.vsgraf__col')).toHaveCount(30);

    // Les deux apparitions du visage doublé sont MARQUÉES, et distinguées l'une
    // de l'autre : buzzer sur la première est une erreur, sur la seconde une
    // réussite. Les afficher pareillement rendrait le graphique inutile.
    await expect(graf.locator('[data-role="premiere"]'),
      'la première apparition n\'est pas marquée').toHaveCount(1);
    await expect(graf.locator('[data-role="seconde"]'),
      'la seconde apparition n\'est pas marquée').toHaveCount(1);

    const places = await graf.locator('[data-role="premiere"], [data-role="seconde"]')
      .evaluateAll((els) => els.map((e) => Number(e.dataset.place)).sort((a, b) => a - b));
    console.log(`  visage doublé aux places ${places.join(' et ')}`);
    // LES QUATRE CONTRAINTES, VÉRIFIÉES SUR UNE VRAIE PARTIE et pas seulement sur
    // le générateur : c'est le seul endroit où l'on constate que la série jouée
    // est bien celle que le générateur promet.
    expect(places[0], '1re apparition hors bornes').toBeGreaterThanOrEqual(1);
    expect(places[0], '1re apparition hors bornes').toBeLessThanOrEqual(20);
    expect(places[1], '2e apparition hors bornes').toBeGreaterThanOrEqual(10);
    expect(places[1], '2e apparition hors bornes').toBeLessThanOrEqual(30);
    expect(places[1] - places[0] - 1, 'moins de cinq visages entre les deux apparitions')
      .toBeGreaterThanOrEqual(5);

    // ---- LE STREAM : la même série, à l'échelle de l'antenne ----
    const stream = await hote.ctx.newPage();
    const jeton = await hote.page.evaluate(() => JSON.parse(localStorage.getItem('host')).overlayToken);
    await stream.goto(`/overlay?token=${jeton}`);
    const serie = stream.getByTestId('stream-visages-serie');
    await expect(serie, 'la série manque à l\'antenne').toBeVisible({ timeout: 15_000 });
    await expect(serie.locator('.st-serie__col')).toHaveCount(30);
    await expect(serie.locator('[data-role="seconde"]')).toHaveCount(1);

    // Les deux surfaces racontent la MÊME série : un désaccord ici voudrait dire
    // que le public et l'animateur commentent deux manches différentes.
    const placesStream = await serie.locator('[data-role="premiere"], [data-role="seconde"]')
      .evaluateAll((els) => els.map((e) => Number(e.dataset.place)).sort((a, b) => a - b));
    expect(placesStream, 'la console et l\'antenne montrent deux séries différentes').toEqual(places);

    // ---- LE JOUEUR : un verdict TRANCHÉ, et une phrase qui dit laquelle des trois issues ----
    await expect(j.getByTestId('voix-resultat'),
      'le joueur n\'a aucune phrase sur son buzz').toBeVisible({ timeout: 15_000 });

    // LE VERDICT NE PEUT PAS RESTER INDÉCIS. C'est le défaut qui a été trouvé en
    // regardant l'écran : l'écran de résultat RECONSTITUAIT le verdict en
    // comparant la réponse à la révélation, ce qui est impossible ici — un buzz
    // ne se compare à rien, il a une heure. Faute de verdict, le joueur qui
    // venait de perdre voyait une COCHE VERTE au-dessus de « Manche close ».
    //
    // On n'affirme pas LAQUELLE des trois issues : la place du visage doublé est
    // tirée au sort, donc un buzz immédiat tombe parfois sur sa première
    // apparition. On affirme que l'écran TRANCHE, ce qui est exactement la
    // garantie perdue.
    const titre = j.locator('#verdict');
    // `innerText` rend le texte TEL QU'IL EST PEINT : le titre est en capitales
    // par la feuille de style, pas dans le code. On compare donc sans la casse —
    // sinon le contrôle échoue sur une règle de typographie, pas sur un verdict.
    const dit = (await titre.innerText()).trim().toLocaleUpperCase('fr-FR');
    console.log(`  verdict joueur → « ${dit} » · ${await j.getByTestId('voix-resultat').innerText()}`);
    expect(['BIEN VU', 'TROP TÔT', 'RATÉ'],
      `verdict indécis après un buzz : « ${dit} »`).toContain(dit);
    await expect(j.locator('.verdict__badge--neutral'),
      'la pastille reste neutre alors que le buzz a été tranché').toHaveCount(0);
  });
});
