// E2E — LE VOTE SE JOUE EN DEUX TOURS.
//
// AVANT : un tour unique, et l'on marquait en faisant partie de la réponse
// majoritaire. Le joueur qui votait sincèrement gagnait par chance ; celui qui
// votait stratégiquement ne pouvait pas dire ce qu'il pensait.
//
// MAINTENANT : « Que penses-tu ? » puis « Que pense le cercle ? ». Le premier
// tour désigne LA bonne réponse sans la montrer ; le second demande de la
// deviner, et lui seul rapporte des points.
//
// CE QUE SEUL UN CONTRÔLE DE BOUT EN BOUT PEUT VOIR ICI :
//   - LE SILENCE ENTRE LES DEUX TOURS. Si le décompte du premier atteignait un
//     écran de joueur ou la toile du stream, le second n'aurait plus rien à
//     deviner. Rien ne casserait : le jeu tournerait, vide.
//   - L'ÉCRAN QUI SE REMET À NEUF au second tour. La sélection du premier restait
//     cochée — le joueur arrivait sur « Que pense le cercle ? » avec sa réponse
//     déjà en vert, et pouvait croire qu'il avait répondu.
//   - LE BOUTON DE L'ANIMATEUR, qui ouvre le second tour au lieu de révéler.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer, lancerJeu } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.describe('Module vote', () => {
  let hote = null;
  const joueurs = [];

  test.afterEach(async () => {
    if (stream) { await stream.close().catch(() => {}); stream = null; }
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    for (const j of joueurs.splice(0)) await j.ctx.close();
  });

  let stream = null;

  async function lancer(browser, pseudos) {
    hote = await openHost(browser);
    for (const nom of pseudos) joueurs.push(await joinAsPlayer(browser, hote.code, nom));
    await expect(hote.page.getByTestId('player-count')).toHaveText(String(pseudos.length));
    stream = await hote.ctx.newPage();
    await stream.setViewportSize({ width: 1920, height: 1080 });
    const token = await hote.page.evaluate(() => JSON.parse(localStorage.getItem('host')).overlayToken);
    await stream.goto(`/overlay?token=${token}`);
    await expect(stream.getByTestId('stream-room-code')).toHaveText(hote.code);
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await lancerJeu(hote.page, 'Vote');
    await expect(joueurs[0].page.getByTestId('question-text')).toBeVisible();
  }

  test('deux tours : le premier désigne la réponse, le second la fait deviner', async ({ browser }) => {
    // PSEUDOS CHOISIS AVEC SOIN : le filtre du projet refuse tout ce qui contient
    // « con » — « Contrariant » n'entrait jamais dans le salon, et le contrôle
    // échouait sur un joueur absent en désignant l'écran de jeu.
    await lancer(browser, ['Lucide', 'Suiveur', 'Rebelle']);

    // TOUR 1 — « Que penses-tu ? », sur les trois surfaces.
    for (const [nom, page] of [['le joueur', joueurs[0].page], ['le stream', stream]]) {
      const consigne = page.getByTestId(nom === 'le stream' ? 'stream-vote-consigne' : 'vote-consigne');
      await expect(consigne, `${nom} ne dit pas à quel tour il répond`).toContainText('Que penses-tu');
      await expect(consigne).toContainText('Tour 1/2');
    }

    // Le cercle pense « B », à deux voix contre une.
    await joueurs[0].page.getByTestId('answer-option').nth(1).click();
    await joueurs[1].page.getByTestId('answer-option').nth(1).click();
    await joueurs[2].page.getByTestId('answer-option').nth(0).click();

    // LE BOUTON DE L'ANIMATEUR OUVRE LE SECOND TOUR, il ne révèle pas. S'il
    // révélait, la bonne réponse s'afficherait avant qu'on ait demandé de la
    // deviner — le second tour n'aurait plus d'objet.
    await expect(hote.page.getByTestId('host-reveler')).toHaveText('Passer au tour 2');
    await hote.page.getByTestId('host-reveler').click();

    // TOUR 2 — la question ne change pas, la consigne si.
    await expect(joueurs[0].page.getByTestId('vote-consigne')).toContainText('Que pense le cercle');
    await expect(stream.getByTestId('stream-vote-consigne')).toContainText('Que pense le cercle');
    // Et la manche n'est PAS révélée : aucun écran ne montre de résultat.
    await expect(joueurs[0].page.getByTestId('points-gained')).toHaveCount(0);

    // L'ÉCRAN EST NEUF. La réponse du premier tour ne doit plus être cochée : le
    // joueur croirait avoir déjà répondu et laisserait passer le tour qui compte.
    await expect(joueurs[0].page.locator('[data-testid="answer-option"][data-state="selected"]'),
      'la réponse du premier tour est restée cochée').toHaveCount(0);

    // Deux devinent « B » (juste), un devine « A ».
    await joueurs[0].page.getByTestId('answer-option').nth(1).click();
    await joueurs[1].page.getByTestId('answer-option').nth(1).click();
    await joueurs[2].page.getByTestId('answer-option').nth(0).click();
    await expect(hote.page.getByTestId('host-reveler')).toHaveText('Révéler maintenant');
    await hote.page.getByTestId('host-reveler').click();

    // ON NE GAGNE QU'AU SECOND TOUR, et en devinant.
    await expect(joueurs[0].page.getByTestId('points-gained')).toHaveText('+700');
    await expect(joueurs[2].page.getByTestId('points-gained')).toHaveText('0');
    // Et zéro, pas moins : mal lire le cercle n'est pas une faute.
    await expect(joueurs[2].page.getByTestId('places-delta')).toBeVisible();

    // LA RÉVÉLATION MONTRE LES DEUX DÉCOMPTES — c'est l'histoire de la manche :
    // ce que le cercle pense, et ce qu'il croyait penser.
    const deux = stream.getByTestId('stream-vote-deux-tours');
    await expect(deux).toBeVisible();
    await expect(deux).toContainText('Ce que le cercle pense');
    await expect(deux).toContainText("Ce qu'il croyait penser");
  });

  test('LE PREMIER TOUR NE FUIT PAS avant la révélation', async ({ browser }) => {
    // LA FAUTE DONT ON NE SE RELÈVE PAS. Le stream est capturé par OBS et souvent
    // regardé en direct par des gens qui jouent : le décompte du premier tour qui
    // y apparaîtrait donnerait la réponse à tout le monde, et le second tour
    // n'aurait plus rien à deviner.
    await lancer(browser, ['Un', 'Deux', 'Trois']);
    // Le cercle pense « B », nettement : deux voix contre une.
    await joueurs[0].page.getByTestId('answer-option').nth(1).click();
    await joueurs[1].page.getByTestId('answer-option').nth(1).click();
    await joueurs[2].page.getByTestId('answer-option').nth(0).click();
    await hote.page.getByTestId('host-reveler').click();
    await expect(joueurs[0].page.getByTestId('vote-consigne')).toContainText('Que pense le cercle');

    // CE QUE CE CONTRÔLE COUVRE, ET CE QU'IL NE COUVRE PAS. Il fouille le HTML
    // rendu des deux surfaces publiques : il attrape un décompte AFFICHÉ, ou posé
    // dans un attribut. Il n'attrape PAS une valeur reçue par le client et jamais
    // dessinée — React ne la sérialise nulle part, et aucune inspection du DOM ne
    // la verrait. C'est le contrôle unitaire de `publicQuestion` qui garde la
    // charge utile ; les deux sont nécessaires, et ni l'un ni l'autre ne suffit.
    for (const [nom, page] of [['le joueur', joueurs[0].page], ['le stream', stream]]) {
      const html = await page.content();
      expect(html, `un décompte du premier tour est lisible sur ${nom}`)
        .not.toMatch(/answersTour|winners/);
      // Et aucune des options ne porte de marque de tête : au second tour, rien à
      // l'écran ne doit désigner la réponse.
      const marques = await page.locator('[data-state="correct"], .st-opt--correct, .opt--correct').count();
      expect(marques, `une réponse est déjà désignée sur ${nom}`).toBe(0);
    }

    // L'ANIMATEUR, LUI, DOIT L'AVOIR — sinon ce contrôle serait content d'un jeu
    // où personne ne connaît la réponse. C'est lui qui commente à l'antenne.
    await expect(hote.page.getByTestId('host-tour')).toContainText('Tour 2/2');
    await expect(hote.page.getByTestId('host-tour-precedent'),
      "l'animateur ne voit plus la réponse qu'il doit commenter").toBeVisible();
  });

  test('LE STUDIO RANGE LE VOTE EN TROIS SECTIONS, et la catégorie décide des points', async ({ page }) => {
    // CE QUI A ÉTÉ DEMANDÉ (26/09) : « dans le vote, il faut qu'il y ait trois
    // catégories : vie, dilemme et sondage […] on ne doit pas sélectionner si ça
    // rapporte des points ou pas, vraiment automatiquement » — et « quand je
    // suis sur une section, j'ai que les questions de ma section ».
    await page.goto('/studio');
    await page.getByRole('article').filter({ hasText: 'Vote' }).first()
      .getByRole('button').first().click();
    const editeur = page.getByTestId('studio-editeur');
    await expect(editeur).toBeVisible();

    // LA PAGE D'ÉDITION REMPLACE LA LISTE (26/09) — elle ne s'ouvre plus à côté.
    await expect(page.getByRole('article')).toHaveCount(0);
    expect(new URL(page.url()).searchParams.get('jeu'), 'la page d’édition n’a pas d’adresse').toBeTruthy();

    // TROIS SECTIONS, dans l'ordre du serveur.
    const sections = editeur.getByTestId('studio-sections');
    await expect(sections.getByRole('tab')).toHaveText([/Vie/, /Dilemme/, /Sondage/]);
    // L'interrupteur « Rapporte des points / Sondage sans points » a disparu.
    await expect(editeur.getByRole('radiogroup', { name: 'Nature du vote' })).toHaveCount(0);

    // Une question ajoutée DEPUIS la section « Sondage » est un sondage, et ne
    // rapporte rien — sans que personne ait eu à le dire.
    await editeur.getByTestId('studio-section-sondage').click();
    await expect(editeur.getByTestId('studio-section-regle')).toContainText('personne ne gagne de points');
    await editeur.getByRole('button', { name: /Ajouter une question « Sondage »/ }).click();
    await expect(editeur.getByTestId('vote-cat-sondage')).toHaveAttribute('aria-checked', 'true');
    await expect(editeur.getByTestId('vote-points')).toContainText('Sans points');
    await expect(sections.getByTestId('studio-section-sondage')).toContainText('1');

    // LA SECTION NE MONTRE QUE SES QUESTIONS : une seule ligne ici, alors que la
    // banque en compte une vingtaine en « Vie ».
    await expect(editeur.locator('.qlist .qrow')).toHaveCount(1);

    // Changer la catégorie change la section — et les points suivent seuls.
    await editeur.getByTestId('vote-cat-dilemme').click();
    await expect(editeur.getByTestId('studio-section-dilemme')).toHaveAttribute('aria-selected', 'true');
    await expect(editeur.getByTestId('vote-points')).toContainText('Rapporte des points');

    // Et le retour à la liste passe par un bouton — ou par « précédent ».
    await page.goBack();
    await expect(page.getByTestId('studio-editeur')).toHaveCount(0);
    await expect(page.getByRole('article').first()).toBeVisible();
  });
});
