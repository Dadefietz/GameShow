// E2E — « LE LIEN », de l'annonce au résultat, sur les trois surfaces.
//
// CE QUE CE JEU A DE PARTICULIER, ET QU'AUCUN CONTRÔLE EXISTANT NE COUVRAIT :
//   - sa question ne sort pas de la bibliothèque, l'animateur la TAPE à l'antenne ;
//   - il se joue en DEUX TEMPS — annonce, puis diffusion des mots — et le temps de
//     saisie ne doit pas être décompté du chrono ;
//   - on n'y gagne pas en ayant raison mais en ayant pensé COMME LES AUTRES.
//
// Le barème est vérifié au chiffre près dans `tests/unit/lien.test.js`. Ici on
// vérifie ce qu'aucun test unitaire ne peut voir : que les écrans existent, qu'ils
// s'enchaînent, et que les noms des joueurs ne franchissent pas la frontière.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer, lancerJeu } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.setTimeout(120_000);

test.describe('Le lien', () => {
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
    await lancerJeu(hote.page, 'Le lien');
  }

  test('l\'annonce précède les mots, et le chrono ne court pas encore', async ({ browser }) => {
    await annoncer(browser, ['Un', 'Deux']);

    // L'ANIMATEUR a ses deux champs, et son bouton reste inerte tant qu'il en
    // manque un : diffuser un lien à moitié posé n'a aucun sens, et il le
    // découvrirait devant son public.
    const saisie = hote.page.getByTestId('saisie-lien');
    await expect(saisie, 'la saisie des deux mots ne s\'ouvre pas').toBeVisible({ timeout: 15_000 });
    const bouton = hote.page.getByTestId('lien-diffuser');
    await expect(bouton, 'le bouton devrait être inerte sans les deux mots').toBeDisabled();
    await hote.page.getByTestId('lien-mot1').fill('Pigeon');
    await expect(bouton, 'un seul mot ne suffit pas').toBeDisabled();
    await hote.page.getByTestId('lien-mot2').fill('Avion');
    await expect(bouton, 'les deux mots sont là, le bouton devrait s\'activer').toBeEnabled();

    // LE CERCLE voit le jingle — le nom du jeu — et rien à répondre encore.
    for (const j of joueurs) {
      await expect(j.page.getByRole('heading', { name: 'Le lien' }),
        'le joueur ne voit pas l\'annonce du jeu').toBeVisible({ timeout: 15_000 });
      await expect(j.page.getByTestId('answer-submit'),
        'il ne devrait rien avoir à répondre pendant l\'annonce').toHaveCount(0);
    }
  });

  test('les deux mots partent ensemble, et le mot partagé rapporte', async ({ browser }) => {
    await annoncer(browser, ['Ana', 'Bo', 'Cy']);
    const stream = await hote.ctx.newPage();
    const token = await hote.page.evaluate(() => JSON.parse(localStorage.getItem('host')).overlayToken);
    await stream.goto(`/overlay?token=${token}`);
    await expect(stream.getByTestId('stream-annonce'),
      'le stream ne montre pas l\'annonce').toBeVisible({ timeout: 15_000 });

    await hote.page.getByTestId('lien-mot1').fill('Pigeon');
    await hote.page.getByTestId('lien-mot2').fill('Avion');
    await hote.page.getByTestId('lien-diffuser').click();

    // LES DEUX MOTS, sur les téléphones ET à l'antenne.
    // Ciblé sur le BLOC DES DEUX MOTS : le mot figure aussi dans le repère
    // d'épreuve en haut d'écran, et une recherche large tombe sur les deux.
    for (const j of joueurs) {
      const mots = j.page.locator('.lien__mots');
      await expect(mots, 'les deux mots ne sont pas affichés').toBeVisible({ timeout: 15_000 });
      await expect(mots).toContainText('Pigeon');
      await expect(mots).toContainText('Avion');
    }
    const enonce = stream.getByTestId('question-text');
    await expect(enonce).toBeVisible({ timeout: 15_000 });
    await expect(enonce).toContainText('Pigeon');
    await expect(enonce).toContainText('Avion');

    // DEUX JOUEURS PENSENT PAREIL — à la casse et à l'accent près, ce qui doit
    // suffire à les réunir — et le troisième est seul.
    for (const [i, mot] of ['Aile', 'AILE', 'Kérosène'].entries()) {
      await joueurs[i].page.getByLabel('Le mot qui les relie').fill(mot);
      await joueurs[i].page.getByTestId('answer-submit').click();
    }
    await expect(hote.page.getByTestId('answers-count')).toHaveText('3');
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();

    // LE JOUEUR : sa base, son bonus de groupe, et le total qui en découle.
    const j0 = joueurs[0].page;
    await expect(j0.getByTestId('points-gained')).toBeVisible({ timeout: 15_000 });
    await j0.waitForTimeout(1200);
    const lire = async (page, id) => {
      if (!(await page.getByTestId(id).count())) return null;
      return Number((await page.getByTestId(id).innerText()).replace(/[^\d-]/g, ''));
    };
    const base = await lire(j0, 'points-base');
    const bonus = await lire(j0, 'points-bonus-groupe');
    const gagne = await lire(j0, 'points-gained');
    console.log(`  partagé → base ${base} · bonus ${bonus} · total ${gagne}`);
    expect(base, 'la base du mot partagé').toBe(250);
    expect(bonus, 'le bonus du groupe de tête').toBe(750);
    expect(base + bonus, 'le détail ne redonne pas le total').toBe(gagne);

    // LE VERDICT DIT QU'IL A GAGNÉ — et il ne le disait pas.
    //
    // DÉFAUT TROUVÉ EN REGARDANT L'ÉCRAN, des semaines après la livraison de ce
    // jeu. L'écran de résultat RECONSTITUAIT le verdict en comparant la réponse à
    // la révélation : une option, un booléen, une cible. « Le lien » ne se compare
    // à rien de tel — on y gagne en ayant PARTAGÉ son mot, ce que la révélation ne
    // permet pas de recalculer. Le verdict restait donc indéterminé, et un joueur
    // qui venait de rafler mille points lisait « Manche close » sous une pastille
    // neutre. Le serveur publiait pourtant ce drapeau depuis toujours : il
    // servait à la série, il ne partait pas au joueur.
    await expect(j0.locator('#verdict'),
      'le gagnant du lien n\'a pas de verdict').toHaveText('Bien joué');
    await expect(j0.locator('.verdict__badge--good'),
      'la pastille du gagnant n\'est pas celle de la réussite').toHaveCount(1);

    // LE SOLITAIRE ne marque rien, et on le lui dit sans le punir.
    const j2 = joueurs[2].page;
    await expect(j2.getByTestId('points-gained')).toBeVisible({ timeout: 15_000 });
    expect(await lire(j2, 'points-gained'), 'être seul ne rapporte rien').toBe(0);
    await expect(j2.locator('#verdict'), 'le solitaire non plus n\'a pas de verdict').toHaveText('Raté');

    // L'ANIMATEUR voit les groupes AVEC les noms — c'est lui qui commente.
    const groupes = hote.page.getByTestId('groupes-lien');
    await expect(groupes, 'l\'animateur ne voit pas les groupes').toBeVisible({ timeout: 15_000 });
    await expect(groupes).toContainText('Ana');
    await expect(groupes).toContainText('Bo');

    // LE STREAM voit les mots, JAMAIS les noms. Même frontière que le plus proche
    // de l'estimation : c'est une source capturée par OBS.
    const liste = stream.getByTestId('stream-lien-groupes');
    await expect(liste).toBeVisible({ timeout: 15_000 });
    await expect(liste).toContainText('Aile');
    const texteStream = await stream.getByTestId('stream-histogramme').count()
      ? '' : (await stream.locator('.stream__stage').innerText());
    for (const pseudo of ['Ana', 'Bo', 'Cy']) {
      expect(texteStream, `« ${pseudo} » est affiché sur le stream`).not.toContain(pseudo);
    }
    await stream.close();
  });

  test('relancer ramène l\'animateur à ses champs, sans déranger le cercle', async ({ browser }) => {
    // DEMANDE DE L'AUTEUR : « les joueurs et le stream restent sur les écrans de
    // résultat ». Faire clignoter les téléphones entre deux manches n'apporte rien.
    await annoncer(browser, ['Ana', 'Bo']);
    await hote.page.getByTestId('lien-mot1').fill('Feu');
    await hote.page.getByTestId('lien-mot2').fill('Bois');
    await hote.page.getByTestId('lien-diffuser').click();
    for (const j of joueurs) {
      await j.page.getByLabel('Le mot qui les relie').fill('Cheminée');
      await j.page.getByTestId('answer-submit').click();
    }
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();
    await expect(joueurs[0].page.getByTestId('points-gained')).toBeVisible({ timeout: 15_000 });

    // « POUR LES MODULES SANS QUESTIONS, IL NE DEVRAIT PAS Y AVOIR ÉCRIT
    // "QUESTION SUIVANTE" MAIS "NOUVELLE PARTIE". » Ce jeu n'a pas de banque : sa
    // manche se saisit à l'antenne. Le bouton le dit désormais, et le contrôle
    // vérifie le LIBELLÉ avant de cliquer — sans quoi il ne garderait que la
    // relance, et le renommage pourrait repartir sans que rien ne le signale.
    await expect(hote.page.getByRole('button', { name: 'Question suivante' }),
      'un jeu sans banque annonce encore « Question suivante »').toHaveCount(0);
    await hote.page.getByRole('button', { name: 'Nouvelle partie' }).click();
    await expect(hote.page.getByTestId('saisie-lien'),
      'l\'animateur ne revient pas à ses deux champs').toBeVisible();
    // Le joueur, lui, n'a pas bougé.
    await expect(joueurs[0].page.getByTestId('points-gained'),
      'le joueur a été ramené ailleurs alors qu\'il devait rester sur son résultat').toBeVisible();
  });
});
