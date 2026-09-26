// E2E — « CACHE-CACHE », de bout en bout.
//
// C'EST LE SEUL JEU DU PROJET QUI SE DÉROULE EN PLUSIEURS TEMPS : une grille qui
// se dévoile pendant trente-huit secondes, cinq questions enchaînées par
// l'animateur, cinq réponses rendues une par une, puis la grille entière. Aucun
// contrôle unitaire ne peut voir cet enchaînement — il ne vit que dans le moteur,
// les trois écrans et le réseau qui les relie.
//
// CE QUI SE GARDE ICI, ET QU'UN TEST UNITAIRE NE VERRAIT PAS :
//   - la grille N'ARRIVE PAS AVEC LA QUESTION. Elle est poussée objet par objet :
//     une charge utile qui la contiendrait rendrait la partie lisible dans
//     l'inspecteur avant d'être vue, et le jeu de mémoire deviendrait un
//     copier-coller ;
//   - les cinq questions ne s'enchaînent PAS toutes seules ;
//   - les réponses se dévoilent une par une, et le total du joueur suit.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer, lancerJeu } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.setTimeout(180_000);

const JEU = 'Cache-cache';

test.describe('Cache-cache', () => {
  let hote = null;
  const joueurs = [];
  let stream = null;

  test.afterEach(async () => {
    if (stream) { await stream.close().catch(() => {}); stream = null; }
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    for (const j of joueurs.splice(0)) await j.ctx.close();
  });

  async function annoncer(browser, pseudos = ['Memo']) {
    hote = await openHost(browser);
    for (const p of pseudos) joueurs.push(await joinAsPlayer(browser, hote.code, p));
    stream = await hote.ctx.newPage();
    await stream.setViewportSize({ width: 1920, height: 1080 });
    const token = await hote.page.evaluate(() => JSON.parse(localStorage.getItem('host')).overlayToken);
    await stream.goto(`/overlay?token=${token}`);
    await expect(stream.getByTestId('stream-room-code')).toHaveText(hote.code);
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await lancerJeu(hote.page, JEU);
  }

  test("l'annonce précède le jeu, sur les deux surfaces", async ({ browser }) => {
    await annoncer(browser);
    await expect(joueurs[0].page.getByRole('heading', { name: JEU })).toBeVisible({ timeout: 15_000 });
    await expect(stream.getByTestId('stream-annonce')).toBeVisible({ timeout: 15_000 });
    await expect(stream.getByTestId('stream-annonce')).toContainText('Neuf objets');
    await expect(hote.page.getByTestId('depart-cache')).toBeVisible();
  });

  test('LA GRILLE NE FUIT PAS : les objets arrivent un par un', async ({ browser }) => {
    await annoncer(browser);
    await hote.page.getByTestId('cache-demarrer').click();

    const j = joueurs[0].page;
    await expect(j.getByTestId('cc-grille')).toBeVisible({ timeout: 15_000 });

    // AUCUN OBJET DANS LA CHARGE UTILE. On fouille le HTML entier de la surface
    // publique : une grille transportée dans un attribut ou une charge inerte
    // serait lisible par qui ouvre l'inspecteur.
    const htmlAuDepart = await j.content();
    const images = (htmlAuDepart.match(/\/objets\//g) || []).length;
    expect(images, "la grille entière est arrivée d'un coup").toBeLessThanOrEqual(1);

    // ET ILS ARRIVENT. Trois secondes d'ouverture, puis le premier objet.
    await expect(j.locator('[data-testid="cc-grille"] [data-pleine]')).toHaveCount(1, { timeout: 15_000 });
    const premier = await j.locator('[data-testid="cc-grille"] [data-pleine]').getAttribute('data-place');
    // Il s'éteint, et un autre s'allume ailleurs.
    await expect(j.locator('[data-testid="cc-grille"] [data-pleine]')).toHaveCount(0, { timeout: 15_000 });
    await expect(j.locator('[data-testid="cc-grille"] [data-pleine]')).toHaveCount(1, { timeout: 15_000 });
    const second = await j.locator('[data-testid="cc-grille"] [data-pleine]').getAttribute('data-place');
    expect(second, 'le même objet se rallume au lieu du suivant').not.toBe(premier);

    // L'ANTENNE MONTRE LA MÊME CHOSE.
    await expect(stream.getByTestId('stream-cc-grille')).toBeVisible();
  });

  test('LES CINQ QUESTIONS NE S\'ENCHAÎNENT PAS TOUTES SEULES', async ({ browser }) => {
    await annoncer(browser);
    await hote.page.getByTestId('cache-demarrer').click();
    const j = joueurs[0].page;

    // La grille dure trente-huit secondes ; la première question arrive après.
    await expect(j.getByTestId('cc-numero')).toContainText('Question 1/5', { timeout: 60_000 });
    await expect(j.getByTestId('cc-grille-hud')).toBeVisible();
    // La grille numérotée est là, et elle porte bien les numéros.
    await expect(j.locator('[data-testid="cc-grille-hud"] [data-place="5"]')).toHaveText('5');

    // ON RÉPOND, puis on attend : sans l'animateur, la question 2 ne vient pas.
    await repondre(j);
    await j.waitForTimeout(12_000);
    await expect(j.getByTestId('cc-numero'), "la question a changé sans l'animateur")
      .toContainText('Question 1/5');

    await hote.page.getByTestId('host-reveler').click();
    await expect(j.getByTestId('cc-numero')).toContainText('Question 2/5', { timeout: 15_000 });
  });

  test('« Réponse envoyée » à qui a répondu, « Trop tard » à qui n\'a pas eu le temps', async ({ browser }) => {
    // L'ÉNONCÉ DONNE LES DEUX PHRASES MOT POUR MOT : « Les joueurs ayant répondu
    // ont le petit message "Réponse envoyée", alors que ceux qui n'ont pas eu le
    // temps vont avoir le petit message "Trop tard pour celle-là..." ».
    //
    // Les trois points comptent : il reste quatre questions derrière. « Temps
    // écoulé », la phrase des autres jeux, laisserait croire la manche finie.
    await annoncer(browser, ['Rapide', 'Lambin']);
    await hote.page.getByTestId('cache-demarrer').click();
    const [vif, lent] = joueurs.map((j) => j.page);
    await expect(vif.getByTestId('cc-numero')).toContainText('Question 1/5', { timeout: 60_000 });

    await repondre(vif);
    await expect(vif.getByTestId('answer-status')).toContainText('Réponse envoyée');

    // L'autre laisse filer les dix secondes.
    await expect(lent.getByTestId('answer-status'))
      .toContainText('Trop tard pour celle-là', { timeout: 20_000 });
  });

  test('LA GRILLE FINALE clôt le jeu au lieu de reposer la question 5', async ({ browser }) => {
    // CE QUI A ÉTÉ RAPPORTÉ (15/09) : « lors du dévoilement de la grille à la fin
    // du jeu, la question 5 est toujours écrite, il faudrait qu'il y ait écrit à
    // la place "Le cache-cache est terminé ! Voici la grille" ».
    //
    // POURQUOI LE MASQUAGE DU CHANTIER v6 NE SUFFISAIT PAS : il ne valait que
    // pendant le dévoilement des réponses. La manche RÉVÉLÉE est un troisième
    // état, et l'énoncé y revenait intact au-dessus d'une grille qui ne
    // l'illustre plus.
    await annoncer(browser);
    await hote.page.getByTestId('cache-demarrer').click();
    const j = joueurs[0].page;
    await expect(j.getByTestId('cc-numero')).toContainText('Question 1/5', { timeout: 60_000 });
    for (let n = 1; n <= 5; n += 1) {
      await expect(j.getByTestId('cc-numero')).toContainText(`Question ${n}/5`, { timeout: 20_000 });
      await repondre(j);
      if (n < 5) await hote.page.getByTestId('host-reveler').click();
    }
    const cinquieme = await stream.getByTestId('question-text').textContent();

    for (let n = 1; n <= 6; n += 1) await hote.page.getByTestId('host-reveler').click();
    await expect(stream.getByTestId('stream-cc-finale')).toBeVisible({ timeout: 20_000 });

    const titre = stream.getByTestId('question-text');
    await expect(titre).toHaveText('Le cache-cache est terminé ! Voici la grille');
    expect((await titre.textContent()).trim(),
      "l'énoncé de la cinquième question est resté au-dessus de la grille")
      .not.toBe((cinquieme || '').trim());
  });

  test('LA RELANCE propose de nouveau LES DEUX modes, Classique en premier', async ({ browser }) => {
    // CE QUI A ÉTÉ RAPPORTÉ : « lorsque l'on a joué à Cache-cache une fois et que
    // l'on clique sur "Nouvelle partie", il n'y a que le mode "Couleur" de
    // disponible. » Et : « il faudrait que le mode "Classique" soit le premier
    // proposé et le mode "Couleur" le second ».
    //
    // CE QUE CE CONTRÔLE GARDE, ET QU'AUCUN AUTRE NE VOYAIT : le panneau de départ
    // était vérifié AU LANCEMENT, jamais À LA RELANCE. Or ce sont deux chemins
    // différents — le premier reçoit le jeu depuis la bibliothèque, le second le
    // refabriquait depuis la manche en cours, en perdant ses modes en route.
    await annoncer(browser);
    await expect(hote.page.getByTestId('cc-mode-classique')).toBeVisible();

    // L'ORDRE, AU LANCEMENT COMME À LA RELANCE.
    const ordre = () => hote.page.locator('[data-testid^="cc-mode-"]:not([data-testid$="-aide"])')
      .evaluateAll((els) => els.map((e) => e.textContent.trim()));
    expect(await ordre(), 'Classique doit être proposé en premier').toEqual(['Classique', 'Couleur']);

    await hote.page.getByTestId('cache-demarrer').click();
    const j = joueurs[0].page;
    await expect(j.getByTestId('cc-numero')).toContainText('Question 1/5', { timeout: 60_000 });
    for (let n = 1; n <= 5; n += 1) {
      await expect(j.getByTestId('cc-numero')).toContainText(`Question ${n}/5`, { timeout: 20_000 });
      await repondre(j);
      if (n < 5) await hote.page.getByTestId('host-reveler').click();
    }
    for (let n = 1; n <= 6; n += 1) await hote.page.getByTestId('host-reveler').click();

    // LA RELANCE. Le jeu n'a pas de banque écrite : le bouton dit « Nouvelle partie ».
    await hote.page.getByRole('button', { name: 'Nouvelle partie' }).click();
    await expect(hote.page.getByTestId('depart-cache')).toBeVisible({ timeout: 15_000 });
    await expect(hote.page.getByTestId('cc-mode-classique'),
      'le mode Classique a disparu de la relance').toBeVisible();
    await expect(hote.page.getByTestId('cc-mode-couleur')).toBeVisible();
    expect(await ordre(), "l'ordre des modes change à la relance").toEqual(['Classique', 'Couleur']);

    // ET ELLE PART VRAIMENT, dans le mode choisi.
    await hote.page.getByTestId('cc-mode-classique').click();
    await hote.page.getByTestId('cache-demarrer').click();
    await expect(j.getByTestId('cc-numero')).toContainText('Question 1/5', { timeout: 60_000 });
  });

  test('LE MODE CLASSIQUE : neuf images noires, aucune question de couleur', async ({ browser }) => {
    // CE QUI A ÉTÉ DEMANDÉ (12/09) : « Pour la création de la matrice, des images
    // uniquement de couleur "noir" devront être utilisées et chacune des images
    // doit avoir un nom différent », et « on ne peut pas poser de questions liées
    // aux couleurs ».
    //
    // LE TIRAGE EST GARDÉ PAR LES CONTRÔLES UNITAIRES, sur des milliers de
    // manches. Ce qu'on vérifie ICI est le seul maillon qu'ils ne voient pas : que
    // le choix fait par l'animateur dans son panneau arrive JUSQU'AUX ÉCRANS.
    // Entre les deux il y a un bouton, un top de départ, un moteur et trois
    // surfaces — et le mode n'est qu'un mot qui peut se perdre à chaque étape.
    await annoncer(browser, ['Classique']);
    await expect(hote.page.getByTestId('cc-mode-classique')).toBeVisible();
    await expect(hote.page.getByTestId('cc-mode-couleur')).toBeVisible();
    // Le mode difficile est proposé par défaut : c'est le jeu tel qu'il existait.
    await expect(hote.page.getByTestId('cc-mode-couleur')).toHaveAttribute('aria-checked', 'true');

    await hote.page.getByTestId('cc-mode-classique').click();
    await expect(hote.page.getByTestId('cc-mode-aide')).toContainText('sans couleur');
    await hote.page.getByTestId('cache-demarrer').click();

    const j = joueurs[0].page;
    await expect(j.getByTestId('cc-numero')).toContainText('Question 1/5', { timeout: 60_000 });

    // AUCUNE QUESTION DE COULEUR sur les cinq. Elles se reconnaissent à leur
    // écran : une question de couleur propose des boutons de couleur.
    for (let n = 1; n <= 5; n += 1) {
      await expect(j.getByTestId('cc-numero')).toContainText(`Question ${n}/5`, { timeout: 20_000 });
      const enonce = await j.getByTestId('question-text').textContent();
      expect(enonce, `question ${n} : « ${enonce} » porte sur la couleur`).not.toMatch(/couleur/i);
      if (await j.getByTestId('cc-couleurs').count()) {
        const libelles = await j.locator('[data-testid="cc-couleurs"] .opt__label')
          .evaluateAll((els) => els.map((e) => e.textContent.trim()));
        // Les seuls choix admis en Classique sont les neuf numéros de cases.
        expect(libelles, `question ${n} : des choix de couleur`).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
      }
      await repondre(j, 'Zibeline');
      if (n < 5) await hote.page.getByTestId('host-reveler').click();
    }

    // LES NEUF IMAGES SONT NOIRES. On les compte sur la GRILLE FINALE du stream,
    // seul écran où les neuf cases sont dévoilées en même temps — pendant le jeu,
    // c'est précisément ce qu'il ne faut pas montrer.
    for (let n = 1; n <= 6; n += 1) await hote.page.getByTestId('host-reveler').click();
    await expect(stream.getByTestId('stream-cc-finale')).toBeVisible({ timeout: 20_000 });
    const sources = await stream.locator('[data-testid="stream-cc-matrice-finale"] img')
      .evaluateAll((els) => els.map((e) => e.getAttribute('src')));
    expect(sources.length, 'la grille finale devrait porter neuf images').toBe(9);
    for (const src of sources) {
      expect(src, `« ${src} » n'est pas une image noire`).toMatch(/-noir\.webp$/);
    }
  });

  test('AU DÉVOILEMENT, LE JOUEUR REVOIT SA PROPRE RÉPONSE quand elle était fausse', async ({ browser }) => {
    // CE QUI A ÉTÉ DEMANDÉ (12/09) : « lors du dévoilement des réponses, il faut
    // rajouter la réponse qu'a donnée le joueur lorsqu'il n'a pas la bonne
    // réponse ».
    //
    // POURQUOI CELA COMPTE : l'écran donnait le verdict et la solution, jamais ce
    // que le joueur avait proposé. Il apprenait s'être trompé sans savoir de quoi
    // — et sur une grille vue une seule fois, c'est justement l'écart entre les
    // deux qui lui apprend quelque chose.
    //
    // UN MOT QU'AUCUN OBJET NE PORTE, pour que la réponse soit fausse à coup sûr
    // quelle que soit la matrice tirée : la banque n'a ni « Zibeline » ni couleur
    // qui lui ressemble.
    await annoncer(browser, ['Maladroit']);
    await hote.page.getByTestId('cache-demarrer').click();
    const j = joueurs[0].page;
    await expect(j.getByTestId('cc-numero')).toContainText('Question 1/5', { timeout: 60_000 });

    const donnees = [];
    for (let n = 1; n <= 5; n += 1) {
      await expect(j.getByTestId('cc-numero')).toContainText(`Question ${n}/5`, { timeout: 20_000 });
      donnees.push(await repondre(j, 'Zibeline'));
      if (n < 5) await hote.page.getByTestId('host-reveler').click();
    }

    let vues = 0;
    for (let n = 1; n <= 5; n += 1) {
      await hote.page.getByTestId('host-reveler').click();
      await expect(j.getByTestId('cc-dev-numero')).toContainText(`Réponse ${n}/5`, { timeout: 15_000 });
      const verdict = await j.getByTestId('cc-dev-verdict').textContent();
      if (/Raté/.test(verdict)) {
        const donnee = j.getByTestId('cc-dev-donnee');
        await expect(donnee, `réponse ${n} ratée, mais la réponse donnée n'est pas montrée`).toBeVisible();
        // Le mot tapé, ou la couleur choisie — jamais un indice brut comme « 0 ».
        // MOT POUR MOT CE QU'IL A RÉPONDU. Comparer à autre chose laisserait
        // passer l'indice brut — une réponse de couleur voyage comme « 0 », et
        // « 0 » affiché à l'écran ne veut rien dire pour personne.
        const texte = (await donnee.textContent()).replace('Ta réponse', '').trim();
        expect(texte, `réponse ${n} : l'écran montre « ${texte} », il a répondu « ${donnees[n - 1]} »`)
          .toBe(donnees[n - 1]);
        vues += 1;
      } else {
        // TROUVÉE PAR HASARD — une couleur sur cinq. On ne redit pas la réponse
        // donnée : la bonne est déjà à l'écran, la répéter n'apprend rien.
        await expect(j.getByTestId('cc-dev-donnee')).toHaveCount(0);
      }
    }
    expect(vues, 'aucune réponse fausse sur cinq : le contrôle n\'a rien vérifié').toBeGreaterThan(0);
  });

  test('la manche entière : cinq questions, cinq réponses, la grille', async ({ browser }) => {
    // SIX JOUEURS : c'est ce qui rend visible la coupe à cinq du classement de
    // l'antenne (26/09) — avec moins, « les cinq premiers » ne coupe rien.
    await annoncer(browser, ['Memo', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six']);
    await hote.page.getByTestId('cache-demarrer').click();
    const j = joueurs[0].page;
    await expect(j.getByTestId('cc-numero')).toContainText('Question 1/5', { timeout: 60_000 });

    // LES CINQ QUESTIONS. L'animateur enchaîne — sauf après la dernière, où le
    // même bouton passe aux réponses.
    for (let n = 1; n <= 5; n += 1) {
      await expect(j.getByTestId('cc-numero')).toContainText(`Question ${n}/5`, { timeout: 20_000 });
      for (const x of joueurs) {
        await expect(x.page.getByTestId('cc-numero')).toContainText(`Question ${n}/5`, { timeout: 20_000 });
        await repondre(x.page);
      }
      if (n < 5) await hote.page.getByTestId('host-reveler').click();
    }

    // LES RÉPONSES TOMBENT UNE PAR UNE, à la demande de l'animateur.
    for (let n = 1; n <= 5; n += 1) {
      await expect(hote.page.getByTestId('host-reveler'))
        .toHaveText(new RegExp(`Dévoiler la réponse ${n}`), { timeout: 20_000 });
      await hote.page.getByTestId('host-reveler').click();
      await expect(j.getByTestId('cc-dev-numero')).toContainText(`Réponse ${n}/5`, { timeout: 15_000 });
      await expect(hote.page.getByTestId('cache-reponses')).toBeVisible();
      // Le classement de l'animateur gagne une colonne à chaque réponse.
      await expect(hote.page.locator('[data-testid="cache-classement"] .clsm__ligne--tete .clsm__col'))
        .toHaveCount(n + 1);
      // ET CELUI DE L'ANTENNE AUSSI (26/09) — même construction, cinq lignes.
      const aLAntenne = stream.getByTestId('stream-cc-classement');
      await expect(aLAntenne.locator('.st-clsm__ligne--tete .st-clsm__col')).toHaveCount(n + 1);
      await expect(aLAntenne.locator('.st-clsm__ligne:not(.st-clsm__ligne--tete)'),
        'l’antenne doit montrer les cinq premiers, pas plus').toHaveCount(5);
    }
    // La console, elle, garde tout le monde.
    await expect(hote.page.locator('[data-testid="cache-classement"] .clsm__ligne:not(.clsm__ligne--tete)')).toHaveCount(6);

    // ET LE DERNIER GESTE RÉVÈLE LA GRILLE — c'est aussi la révélation de la manche.
    await expect(hote.page.getByTestId('host-reveler')).toHaveText(/Dévoiler la grille/);
    await hote.page.getByTestId('host-reveler').click();
    // LE CLASSEMENT RESTE À L'ANTENNE À CÔTÉ DE LA GRILLE FINALE, et il tient
    // dans le canevas de 1920 × 1080.
    await expect(stream.getByTestId('stream-cc-finale').getByTestId('stream-cc-classement')).toBeVisible({ timeout: 15_000 });
    const bas = await stream.getByTestId('stream-cc-classement').evaluate((e) => e.getBoundingClientRect().bottom);
    expect(bas, 'le classement déborde du canevas du stream').toBeLessThanOrEqual(1080);
    await expect(j.getByTestId('points-gained')).toBeVisible({ timeout: 15_000 });
    await expect(j.getByTestId('voix-resultat')).toBeVisible();
    expect(await j.getByTestId('voix-resultat').innerText()).not.toMatch(/\{\w+\}/);
  });
});

// Répond à la question affichée, quelle que soit sa forme : cinq couleurs à
// toucher, ou un mot à taper.
// Rend CE QUI A ÉTÉ RÉPONDU, tel que le joueur l'a vu : le libellé du bouton
// cliqué, ou le mot tapé. C'est la seule référence honnête pour vérifier ensuite
// que l'écran de dévoilement lui rend sa propre réponse — et non l'indice brut
// avec lequel elle voyage sur le réseau.
async function repondre(page, mot = 'quelque chose') {
  const choix = page.getByTestId('cc-couleurs');
  if (await choix.count()) {
    const bouton = choix.getByTestId('answer-option').first();
    // LE LIBELLÉ SEUL, PAS LE BOUTON ENTIER : celui-ci porte aussi sa touche
    // clavier, et « A1 » n'est pas une réponse.
    const libelle = (await bouton.locator('.opt__label').textContent()).trim();
    await bouton.click();
    return libelle;
  }
  await page.getByTestId('cc-saisie').fill(mot);
  await page.getByTestId('answer-submit').click();
  return mot;
}
