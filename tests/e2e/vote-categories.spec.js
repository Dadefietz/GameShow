// E2E — LES CATÉGORIES DU VOTE, ET L'ONGLET QUI DÉCIDE.
//
// CE QUI A ÉTÉ DEMANDÉ (15/09) : « il faut que les questions du jeu Vote puissent
// appartenir à une catégorie. Il doit y avoir la catégorie "Vie" et la catégorie
// "Dilemme". […] ce bloc doit posséder un onglet avec la liste des questions de
// catégorie "Vie" et un onglet avec la liste des questions de catégorie
// "Dilemme". La "Question suivante" doit être la question 1 de l'onglet sur lequel
// est l'animateur. Cela ne change rien aux règles du jeu Vote. »
//
// CE QUE CE CONTRÔLE GARDE, ET QU'AUCUN AUTRE NE PEUT VOIR. Le rangement des
// questions par catégorie se vérifie sans navigateur. Ce qui ne se vérifie QUE de
// bout en bout, c'est le maillon entre le doigt de l'animateur et la question qui
// part : il ouvre un onglet, clique « Question suivante », et c'est la première
// ligne DE CET ONGLET qui doit arriver sur les téléphones. Entre les deux il y a
// un état d'écran, un aller-retour avec la file, un identifiant envoyé au serveur
// et un tirage — et le mot « catégorie » peut se perdre à chacune de ces étapes
// sans que rien ne casse : une autre question part, c'est tout.
//
// ET LE BOUTON NE DOIT RIEN CHANGER AILLEURS. « Question suivante » est le bouton
// le plus utilisé de l'écran animateur, sur TOUS les jeux. Le dernier contrôle
// vérifie qu'un jeu sans catégories continue de l'ignorer.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer, lancerJeu, creerJeu, retirerJeux, BASE } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.setTimeout(120_000);

const JEU = 'Vote catégorisé';

// Trois questions par catégorie, reconnaissables à leur énoncé : c'est ce qui
// permet d'affirmer LAQUELLE est partie, et pas seulement qu'une question est
// partie.
const QUESTIONS = [
  { text: 'VIE 1 — Le matin, café ou thé ?', options: ['Café', 'Thé'], categorie: 'vie' },
  { text: 'DILEMME 1 — Sauver un ami ou dix inconnus ?', options: ['L\'ami', 'Les dix'], categorie: 'dilemme' },
  { text: 'VIE 2 — Vacances à la mer ou à la montagne ?', options: ['Mer', 'Montagne'], categorie: 'vie' },
  { text: 'DILEMME 2 — Dire une vérité qui blesse ?', options: ['Dire', 'Se taire'], categorie: 'dilemme' },
  // SANS CATÉGORIE DÉCLARÉE : les questions écrites avant cette séance. Elles
  // doivent atterrir dans « Vie », et non dans aucun onglet.
  { text: 'ANCIENNE — Écrite avant les catégories', options: ['Oui', 'Non'] },
];

test.describe('Les catégories du vote', () => {
  let hote = null;
  const joueurs = [];

  test.afterEach(async () => {
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    for (const j of joueurs.splice(0)) await j.ctx.close();
    await retirerJeux(JEU, 'Vote sans catégorie');
  });

  async function ouvrir(browser, nom, { demarrer = true } = {}) {
    hote = await openHost(browser);
    joueurs.push(await joinAsPlayer(browser, hote.code, 'Votant'));
    await expect(hote.page.getByTestId('player-count')).toHaveText('1');
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await lancerJeu(hote.page, nom, { demarrer });
  }

  test('la file se range en deux onglets, et l\'ancienne question tombe dans « Vie »', async ({ browser }) => {
    await creerJeu({ name: JEU, type: 'vote', questions: QUESTIONS });
    // ON NE DONNE PAS LE TOP : ce contrôle regarde LA FILE, et le top en retire la
    // tête — tirée au sort. Une fois sur cinq, la tête était « ANCIENNE », qui
    // passait « en cours » et quittait la liste : le contrôle criait à la
    // disparition d'une question que le produit avait bel et bien rangée. Voir la
    // note de `lancerJeu`. Le panneau de la file est visible dès la préparation,
    // ce qui suffit à ce qu'on vérifie ici.
    await ouvrir(browser, JEU, { demarrer: false });

    const onglets = hote.page.getByTestId('file-onglets');
    await expect(onglets).toBeVisible({ timeout: 15_000 });
    // L'ORDRE VIENT DU SERVEUR : « Vie » puis « Dilemme », comme la table le dit.
    await expect(onglets.getByRole('tab')).toHaveText([/Vie/, /Dilemme/]);
    await expect(hote.page.getByTestId('file-onglet-vie')).toHaveAttribute('aria-selected', 'true');

    const lignes = () => hote.page.locator('[data-testid="file-row"] .file__text')
      .evaluateAll((els) => els.map((e) => e.textContent.trim()));

    // ONGLET « VIE » : ses deux questions, PLUS l'ancienne sans catégorie. Une
    // question écrite avant cette séance ne doit disparaître d'aucun onglet.
    const vie = await lignes();
    expect(vie.some((t) => t.startsWith('ANCIENNE')),
      'une question sans catégorie déclarée a disparu de la file').toBe(true);
    expect(vie.filter((t) => t.startsWith('DILEMME')),
      'un dilemme s\'est glissé dans l\'onglet « Vie »').toEqual([]);

    await hote.page.getByTestId('file-onglet-dilemme').click();
    const dilemmes = await lignes();
    expect(dilemmes.every((t) => t.startsWith('DILEMME')),
      `l'onglet « Dilemme » montre autre chose : ${dilemmes.join(' | ')}`).toBe(true);
    expect(dilemmes.length).toBeGreaterThan(0);
  });

  test('« QUESTION SUIVANTE » POSE LA PREMIÈRE QUESTION DE L\'ONGLET OUVERT', async ({ browser }) => {
    await creerJeu({ name: JEU, type: 'vote', questions: QUESTIONS });
    await ouvrir(browser, JEU);
    const j = joueurs[0].page;
    await expect(j.getByTestId('question-text')).toBeVisible({ timeout: 15_000 });

    // ON OUVRE « DILEMME » et on relève sa première ligne — c'est elle qui doit
    // partir, quelle que soit la question en cours.
    await hote.page.getByTestId('file-onglet-dilemme').click();
    const premiere = (await hote.page.locator('[data-testid="file-row"] .file__text').first().textContent()).trim();
    expect(premiere).toMatch(/^DILEMME/);

    await hote.page.getByRole('button', { name: /Révéler/ }).first().click();
    await hote.page.getByRole('button', { name: 'Question suivante' }).click();
    await expect(j.getByTestId('question-text')).toHaveText(premiere, { timeout: 20_000 });

    // ET DANS L'AUTRE SENS : on rouvre « Vie », et c'est une question de vie qui
    // part. Sans ce second passage, un écran qui enverrait TOUJOURS la première
    // ligne de « Dilemme » passerait pour correct.
    await hote.page.getByTestId('file-onglet-vie').click();
    const suivante = (await hote.page.locator('[data-testid="file-row"] .file__text').first().textContent()).trim();
    expect(suivante).not.toMatch(/^DILEMME/);
    await hote.page.getByRole('button', { name: /Révéler/ }).first().click();
    await hote.page.getByRole('button', { name: 'Question suivante' }).click();
    await expect(j.getByTestId('question-text')).toHaveText(suivante, { timeout: 20_000 });
  });

  test('un jeu SANS catégories n\'a pas d\'onglet, et « Question suivante » ne change pas', async ({ browser }) => {
    // LE BOUTON LE PLUS UTILISÉ DE L'ÉCRAN ANIMATEUR. Lui faire désigner une
    // question pour le vote ne doit RIEN changer aux cinq autres jeux : ici, un
    // quiz enchaîne ses questions comme avant.
    await creerJeu({
      name: 'Vote sans catégorie',
      type: 'quiz',
      questions: [
        { text: 'QUIZ A — Première', options: ['a', 'b'], correctIndex: 0 },
        { text: 'QUIZ B — Seconde', options: ['a', 'b'], correctIndex: 1 },
      ],
    });
    await ouvrir(browser, 'Vote sans catégorie');
    const j = joueurs[0].page;
    await expect(j.getByTestId('question-text')).toBeVisible({ timeout: 15_000 });
    await expect(hote.page.getByTestId('file-onglets'),
      'un jeu sans catégories ne doit pas porter d\'onglets').toHaveCount(0);

    const premiere = await j.getByTestId('question-text').textContent();
    await hote.page.getByRole('button', { name: /Révéler/ }).first().click();
    await hote.page.getByRole('button', { name: 'Question suivante' }).click();
    await expect(j.getByTestId('question-text')).not.toHaveText(premiere, { timeout: 20_000 });
    expect((await j.getByTestId('question-text').textContent()).trim()).toMatch(/^QUIZ/);
  });
});
