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
    await annoncer(browser);
    await hote.page.getByTestId('cache-demarrer').click();
    const j = joueurs[0].page;
    await expect(j.getByTestId('cc-numero')).toContainText('Question 1/5', { timeout: 60_000 });

    // LES CINQ QUESTIONS. L'animateur enchaîne — sauf après la dernière, où le
    // même bouton passe aux réponses.
    for (let n = 1; n <= 5; n += 1) {
      await expect(j.getByTestId('cc-numero')).toContainText(`Question ${n}/5`, { timeout: 20_000 });
      await repondre(j);
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
    }

    // ET LE DERNIER GESTE RÉVÈLE LA GRILLE — c'est aussi la révélation de la manche.
    await expect(hote.page.getByTestId('host-reveler')).toHaveText(/Dévoiler la grille/);
    await hote.page.getByTestId('host-reveler').click();
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
