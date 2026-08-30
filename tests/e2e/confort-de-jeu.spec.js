// E2E — LES TROIS DEMANDES DE CONFORT DE LA SÉANCE (A21, A25, A26).
//
// Elles n'ont rien en commun sinon d'être nées de la même soirée de test, et
// d'être toutes les trois invisibles pour les contrôles existants :
//
//   A21 — « une phrase permettant à l'animateur d'indiquer qu'une seule personne a
//         trouvé la réponse exacte ou qu'un joueur a obtenu la meilleure
//         estimation ». Il avait la liste des noms, pas de quoi la DIRE.
//   A25 — « l'absence de signal sonore rendait difficile la perception de la fin
//         des 20 secondes de réponse ».
//   A26 — « le bouton de validation du clavier du téléphone devrait envoyer
//         directement la réponse ».
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer, creerJeu, retirerJeux } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.setTimeout(120_000);

const JEU = 'Épreuve de confort';
const CIBLE = 100;

test.describe('Le confort de jeu', () => {
  let hote = null;
  const joueurs = [];

  test.afterEach(async () => {
    await retirerJeux(JEU);
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    for (const j of joueurs.splice(0)) await j.ctx.close();
  });

  test('la touche de validation du clavier envoie l\'estimation (A26)', async ({ browser }) => {
    await creerJeu({
      name: JEU, type: 'estimation', duration: 30,
      questions: [{ text: 'Combien de braises ?', target: CIBLE }],
    });
    hote = await openHost(browser);
    joueurs.push(await joinAsPlayer(browser, hote.code, 'Clavier'));
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: `Lancer ${JEU}` }).first().click();

    const champ = joueurs[0].page.getByLabel('Ta réponse');
    await expect(champ).toBeVisible({ timeout: 15_000 });

    // Le champ doit ANNONCER au clavier ce que fait sa touche d'action. Sans cet
    // attribut elle s'affiche « Entrée » ou « OK » — et l'animateur ne sait pas
    // qu'elle envoie.
    await expect(champ, 'la touche d\'action du clavier ne s\'annonce pas comme un envoi')
      .toHaveAttribute('enterkeyhint', 'send');

    // ET ELLE ENVOIE VRAIMENT : on ne touche pas au bouton de l'écran.
    await champ.fill(String(CIBLE));
    await champ.press('Enter');
    // On observe le BANDEAU DE STATUT, pas le bouton : une fois la réponse
    // partie, l'écran change et le formulaire s'en va. Guetter un bouton disparu
    // ferait échouer le contrôle au moment précis où il réussit.
    await expect(joueurs[0].page.locator('[data-bind="play.accepted"]'),
      'la touche d\'action n\'a pas envoyé la réponse').toContainText('Réponse envoyée', { timeout: 10_000 });
  });

  test('l\'animateur reçoit une phrase à dire sur celui qui a trouvé (A21)', async ({ browser }) => {
    await creerJeu({
      name: JEU, type: 'estimation', duration: 30,
      questions: [{ text: 'Combien de braises exactement ?', target: CIBLE }],
    });
    hote = await openHost(browser);
    joueurs.push(await joinAsPlayer(browser, hote.code, 'Pile'));
    joueurs.push(await joinAsPlayer(browser, hote.code, 'Loin'));
    await expect(hote.page.getByTestId('player-count')).toHaveText('2');
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: `Lancer ${JEU}` }).first().click();

    for (const [i, valeur] of [CIBLE, CIBLE * 7].entries()) {
      const champ = joueurs[i].page.getByLabel('Ta réponse');
      await expect(champ).toBeVisible({ timeout: 15_000 });
      await champ.fill(String(valeur));
      await joueurs[i].page.getByTestId('answer-submit').click();
    }
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();

    const phrase = hote.page.getByTestId('host-mise-en-avant');
    await expect(phrase, 'aucune phrase de mise en avant sur la console').toBeVisible({ timeout: 15_000 });
    await expect(phrase, 'la phrase ne nomme pas la personne à mettre en avant').toContainText('Pile');
    console.log(`  phrase animateur → ${await phrase.innerText()}`);

    // LA FRONTIÈRE. Cette phrase cite un pseudo : elle ne doit exister que sur la
    // console. Le stream affiche les pseudos devant toute l'audience — c'est la
    // même règle que le panneau des plus proches.
    const stream = await hote.ctx.newPage();
    const jeton = await hote.page.evaluate(() => JSON.parse(localStorage.getItem('host')).overlayToken);
    await stream.goto(`/overlay?token=${jeton}`);
    await expect(stream.getByTestId('stats-panel')).toBeVisible({ timeout: 15_000 });
    await expect(stream.getByTestId('host-mise-en-avant'),
      'la phrase de l\'animateur a fuité sur le stream').toHaveCount(0);
    await expect(stream.locator('body'), 'un pseudo est affiché à l\'antenne')
      .not.toContainText('Pile');

    // A22 — LA PLACE DE LA VOIX DE PLATEAU EST TENUE MÊME QUAND ELLE SE TAIT.
    // Ici le plateau est muet : deux réponses seulement, sous le seuil de cinq.
    // C'est justement le cas qui déplaçait la mise en page — la phrase absente,
    // tout le bloc remontait, puis redescendait à la manche suivante si elle
    // parlait. Sur une toile de 1920 × 1080 calée au pixel, ça se voit.
    const fente = stream.getByTestId('voix-plateau-fente');
    await expect(fente, 'la fente de la voix de plateau n\'existe pas').toHaveCount(1);
    await expect(stream.getByTestId('voix-plateau'), 'le plateau devrait se taire ici').toHaveCount(0);
    const hauteur = await fente.evaluate((el) => el.getBoundingClientRect().height);
    console.log(`  fente de la voix (plateau muet) → ${Math.round(hauteur)} px réservés`);
    expect(hauteur, 'la fente ne réserve aucune hauteur : la mise en page bougera')
      .toBeGreaterThan(0);
  });

  test('le chrono se fait entendre sur les dernières secondes (A25)', async ({ browser }) => {
    // ON NE PEUT PAS ÉCOUTER, ON PEUT COMPTER. Le navigateur d'un contrôle
    // automatique n'a pas de haut-parleur : on remplace donc `AudioContext` par un
    // témoin qui recense les oscillateurs créés. Ce qu'on prouve n'est pas que le
    // son est beau, mais qu'il est ÉMIS — et qu'il ne l'est pas n'importe quand.
    const temoin = () => {
      window.__sons = [];
      class OscillateurTemoin {
        constructor() { this.frequency = { setValueAtTime: (f) => { this.f = f; } }; this.type = ''; }
        connect(n) { return n; }
        start() { window.__sons.push(this.f); }
        stop() {}
      }
      class ContexteTemoin {
        constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; }
        createOscillator() { return new OscillateurTemoin(); }
        createGain() {
          const rampe = () => {};
          return { gain: { setValueAtTime: rampe, exponentialRampToValueAtTime: rampe }, connect: (n) => n };
        }
        resume() { return Promise.resolve(); }
        close() { return Promise.resolve(); }
      }
      window.AudioContext = ContexteTemoin;
      window.webkitAudioContext = ContexteTemoin;
    };

    await creerJeu({
      name: JEU, type: 'quiz', duration: 6,
      questions: [{ text: 'Une question courte', options: ['a', 'b'], correctIndex: 0 }],
    });

    hote = await openHost(browser);
    const ctx = await browser.newContext();
    await ctx.addInitScript(temoin);
    const page = await ctx.newPage();
    await page.goto('/');
    const cases = page.getByTestId('join-code').getByRole('textbox');
    for (const [i, ch] of [...hote.code].entries()) await cases.nth(i).fill(ch);
    await page.getByTestId('join-pseudo').fill('Oreille');
    await page.getByTestId('join-submit').click();
    joueurs.push({ ctx, page });

    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: `Lancer ${JEU}` }).first().click();
    await expect(page.getByTestId('question-text')).toBeVisible({ timeout: 15_000 });

    // Rien ne doit sonner AVANT les cinq dernières secondes : un bip par seconde
    // sur toute la manche serait insupportable.
    await expect(page.getByTestId('answer-option').first()).toBeVisible();

    // ON ATTEND LES SONS EUX-MÊMES, pas un écran. Guetter le bandeau « Temps
    // écoulé » revenait à parier sur l'état de l'interface au moment où le chrono
    // tombe — un détour, alors que le témoin dit directement ce qu'on mesure.
    // On attend LA CHUTE DE FIN, dernier son de la manche : s'arrêter au nombre
    // de bips faisait lire le témoin pendant que le chrono courait encore, et le
    // contrôle concluait à l'absence d'un son qui n'était pas encore dû.
    await expect.poll(async () => (await page.evaluate(() => window.__sons || [])).includes(415),
      { timeout: 30_000, message: 'la manche s\'est terminée sans un son' })
      .toBe(true);

    const sons = await page.evaluate(() => window.__sons || []);
    console.log(`  ${sons.length} son(s) émis : ${sons.join(', ')} Hz`);
    expect(sons.length, 'le chrono n\'a émis aucun son sur ses dernières secondes')
      .toBeGreaterThanOrEqual(3);
    expect(sons, 'le bip du compte à rebours n\'a pas été émis').toContain(880);
    expect(sons, 'la chute de fin de temps n\'a pas été émise').toContain(415);
  });

  test('le stream sonne la révélation, une fois et une seule (A25)', async ({ browser }) => {
    // L'AUTRE MOITIÉ DE A25, ET LA RAISON DE CE CONTRÔLE : l'écran de révélation
    // se re-rend plusieurs fois (animations, arrivée des statistiques). Sans
    // repère de manche, le son repartirait à chaque rendu — un hoquet à
    // l'antenne, devant tout le monde. Le « une fois et une seule » est donc
    // l'essentiel de la garantie, pas un détail.
    const temoin = () => {
      window.__sons = [];
      class O {
        constructor() { this.frequency = { setValueAtTime: (f) => { this.f = f; } }; this.type = ''; }
        connect(n) { return n; } start() { window.__sons.push(this.f); } stop() {}
      }
      class C {
        constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; }
        createOscillator() { return new O(); }
        createGain() { const r = () => {}; return { gain: { setValueAtTime: r, exponentialRampToValueAtTime: r }, connect: (n) => n }; }
        resume() { return Promise.resolve(); } close() { return Promise.resolve(); }
      }
      window.AudioContext = C; window.webkitAudioContext = C;
    };

    await creerJeu({
      name: JEU, type: 'quiz', duration: 30,
      questions: [{ text: 'Une question à révéler', options: ['a', 'b'], correctIndex: 0 }],
    });
    hote = await openHost(browser);
    joueurs.push(await joinAsPlayer(browser, hote.code, 'Antenne'));

    const ctx = await browser.newContext();
    await ctx.addInitScript(temoin);
    const stream = await ctx.newPage();
    const jeton = await hote.page.evaluate(() => JSON.parse(localStorage.getItem('host')).overlayToken);
    await stream.goto(`/overlay?token=${jeton}`);

    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: `Lancer ${JEU}` }).first().click();
    await joueurs[0].page.getByTestId('answer-option').first().click();
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();
    await expect(stream.getByTestId('stats-panel')).toBeVisible({ timeout: 15_000 });

    await expect.poll(async () => (await stream.evaluate(() => window.__sons || [])).includes(784),
      { timeout: 15_000, message: 'le stream n\'a pas sonné la révélation' }).toBe(true);

    // On laisse le temps à d'éventuels re-rendus de se produire, PUIS on compte.
    await stream.waitForTimeout(1500);
    const sons = await stream.evaluate(() => window.__sons || []);
    const montees = sons.filter((f) => f === 523).length;
    console.log(`  stream → ${sons.join(', ')} Hz (${montees} révélation(s) sonnée(s))`);
    expect(montees, 'la révélation a sonné plusieurs fois sur la même manche').toBe(1);

    await ctx.close();
  });
});
