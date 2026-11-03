// E2E — UN SONDAGE PEUT ÊTRE REPOSÉ, LES AUTRES CATÉGORIES NON.
//
// CE QUI A ÉTÉ DEMANDÉ (02/11) : « lorsque l'on lance un vote sur une question,
// la question n'apparaît plus et ne peut plus être posée. Ce fonctionnement est
// très bien pour les questions de catégorie "Vie" et "Dilemme", mais il doit
// être supprimé pour les questions de catégorie "Sondage", c'est-à-dire qu'une
// question Sondage peut être posée plusieurs fois au cours d'une partie. »
//
// POURQUOI L'EXCEPTION A UN SENS, et pourquoi elle s'arrête au sondage : un
// sondage ne se devine pas, il se redemande. La même question n'a pas la même
// réponse après un retournement de situation — c'est tout son intérêt à
// l'antenne. Une question de « Vie » ou de « Dilemme », elle, est épuisée dès
// qu'elle a servi : la reposer n'apprendrait rien.
//
// CE CONTRÔLE TIENT LES DEUX MOITIÉS. Une règle qui s'applique partout n'est
// pas une exception, c'est une régression : on vérifie donc aussi qu'un
// « Dilemme » posé, lui, a bien quitté la file.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer, lancerJeu, creerJeu, retirerJeux } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.setTimeout(120_000);

const JEU = 'Vote rejouable';

// Deux sondages et deux dilemmes : avec un seul de chaque, « la file n'est pas
// vide » ne prouverait rien — il resterait toujours l'autre catégorie.
const QUESTIONS = [
  { text: 'SONDAGE 1 — Qui mérite de gagner ce soir ?', options: ['Toi', 'Moi'], categorie: 'sondage', poll: true },
  { text: 'SONDAGE 2 — On rallonge la partie ?', options: ['Oui', 'Non'], categorie: 'sondage', poll: true },
  { text: 'DILEMME 1 — Sauver un ami ou dix inconnus ?', options: ["L'ami", 'Les dix'], categorie: 'dilemme' },
  { text: 'DILEMME 2 — Dire une vérité qui blesse ?', options: ['Dire', 'Se taire'], categorie: 'dilemme' },
];

test.describe('Le sondage se repose', () => {
  let hote = null;
  const joueurs = [];

  test.afterEach(async () => {
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    for (const j of joueurs.splice(0)) await j.ctx.close();
    await retirerJeux(JEU);
  });

  // Les énoncés visibles dans l'onglet ouvert, dans l'ordre de la file.
  const lignes = () => hote.page.locator('[data-testid="file-row"] .file__text')
    .evaluateAll((els) => els.map((e) => e.textContent.trim()));

  async function ouvrirSur(browser, onglet) {
    hote = await openHost(browser);
    joueurs.push(await joinAsPlayer(browser, hote.code, 'Votant'));
    await expect(hote.page.getByTestId('player-count')).toHaveText('1');
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await lancerJeu(hote.page, JEU, { demarrer: false });
    await expect(hote.page.getByTestId('file-onglets')).toBeVisible({ timeout: 15_000 });
    await hote.page.getByTestId(`file-onglet-${onglet}`).click();
  }

  // L'ONGLET SE REFERME AU DÉPART. L'écran de préparation cède la place à celui
  // du direct : le panneau de file est reconstruit, et son onglet ouvert repart
  // sur le premier de la liste. Il faut donc le rouvrir APRÈS le top, sans quoi
  // on lit une liste vide et on conclut à une disparition.
  async function rouvrir(onglet) {
    await expect(hote.page.getByTestId('file-onglets')).toBeVisible({ timeout: 15_000 });
    await hote.page.getByTestId(`file-onglet-${onglet}`).click();
  }

  test('un SONDAGE posé revient dans la file, en fin de liste', async ({ browser }) => {
    await creerJeu({ name: JEU, type: 'vote', questions: QUESTIONS });
    await ouvrirSur(browser, 'sondage');

    const avant = await lignes();
    expect(avant.length, 'les deux sondages devraient être en file').toBe(2);
    const pose = avant[0];

    // On pose la tête de l'onglet ouvert.
    await hote.page.getByTestId('simple-demarrer').click();
    await expect(joueurs[0].page.getByTestId('question-text')).toBeVisible({ timeout: 15_000 });
    await rouvrir('sondage');

    // ELLE EST TOUJOURS LÀ. C'est tout l'objet du retour : le sondage reste
    // disponible pour la suite de la soirée.
    await expect.poll(async () => (await lignes()).includes(pose), {
      message: `« ${pose} » a quitté la file alors qu'un sondage doit pouvoir être reposé`,
      timeout: 15_000,
    }).toBe(true);

    // ET EN FIN DE LISTE, pour ne pas ressortir coup sur coup.
    const apres = await lignes();
    expect(apres[apres.length - 1],
      'le sondage reposé devrait passer derrière les autres').toBe(pose);
  });

  test('un DILEMME posé quitte la file — la règle générale tient', async ({ browser }) => {
    await creerJeu({ name: JEU, type: 'vote', questions: QUESTIONS });
    await ouvrirSur(browser, 'dilemme');

    const avant = await lignes();
    expect(avant.length, 'les deux dilemmes devraient être en file').toBe(2);
    const pose = avant[0];

    await hote.page.getByTestId('simple-demarrer').click();
    await expect(joueurs[0].page.getByTestId('question-text')).toBeVisible({ timeout: 15_000 });
    await rouvrir('dilemme');

    await expect.poll(async () => (await lignes()).includes(pose), {
      message: `« ${pose} » est resté en file : une question notée ne doit jamais être reposée`,
      timeout: 15_000,
    }).toBe(false);
  });
});
