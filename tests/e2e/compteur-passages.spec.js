// E2E — LE COMPTEUR DE PASSAGES D'UNE QUESTION.
//
// CE QUI A ÉTÉ DEMANDÉ (02/11) : « Il faudrait mettre en place un compteur pour
// chaque question. Ce serait pour savoir combien de fois une question a déjà été
// posée en global, pas juste sur le salon ou au cours de la partie mais dans
// toutes parties confondues. […] si son compteur est à 2, le compteur ne doit
// pas être remis à 0 à la suite d'une déconnexion de l'animateur ou alors d'un
// nouveau salon, c'est PERMANENT. »
//
// Et : « Dans cet écran, il faut ABSOLUMENT pouvoir faire un tri basé sur le
// numéro de compteur des questions afin que les questions ayant le compteur le
// plus bas remonte en haut de la liste. »
//
// CE QUE CE CONTRÔLE TIENT, ET DANS CET ORDRE :
//   1. le compteur est VISIBLE sur chaque ligne de la file ;
//   2. il MONTE d'un cran quand la question est posée ;
//   3. il SURVIT à un nouveau salon — c'est le mot « PERMANENT » du rapport, et
//      la seule partie qu'un contrôle de salon unique ne verrait pas ;
//   4. le TRI remonte les moins posées, sans toucher à l'ordre des autres.
//
// POURQUOI LE POINT 3 EST LE CŒUR. Un compteur rangé dans le salon aurait passé
// les trois autres contrôles et échoué en séance : les salons vivent en mémoire
// et meurent avec eux. C'est le seul point qui prouve qu'il vit dans la
// bibliothèque, laquelle est écrite sur disque ET en base.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer, lancerJeu, creerJeu, retirerJeux, BASE } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.setTimeout(150_000);

const JEU = 'Quiz compteur';

const QUESTIONS = [
  { text: 'Q1 — Déjà posée trois fois', options: ['A', 'B'], correctIndex: 0, poses: 3 },
  { text: 'Q2 — Jamais posée', options: ['A', 'B'], correctIndex: 0, poses: 0 },
  { text: 'Q3 — Posée une fois', options: ['A', 'B'], correctIndex: 0, poses: 1 },
];

// Le compteur tel que la bibliothèque le porte — la source de vérité, pas
// l'affichage. C'est lui qui doit survivre au salon.
async function posesEnBibliotheque(texte) {
  const { modules } = await fetch(`${BASE}/api/modules`).then((r) => r.json());
  const jeu = (modules || []).find((m) => m.name === JEU);
  return (jeu?.questions || []).find((q) => q.text === texte)?.poses ?? null;
}

test.describe('Le compteur de passages', () => {
  let hote = null;
  const joueurs = [];

  test.afterEach(async () => {
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    for (const j of joueurs.splice(0)) await j.ctx.close();
    await retirerJeux(JEU);
  });

  // Les couples (énoncé, compteur) lus sur la file, dans l'ordre affiché.
  const lignes = () => hote.page.locator('[data-testid="file-row"]').evaluateAll(
    (els) => els.map((e) => [
      e.querySelector('.file__text')?.textContent.trim(),
      Number(e.querySelector('[data-testid="file-poses"]')?.textContent.trim()),
    ]),
  );

  async function ouvrir(browser, { demarrer = false } = {}) {
    hote = await openHost(browser);
    joueurs.push(await joinAsPlayer(browser, hote.code, 'Joueuse'));
    await expect(hote.page.getByTestId('player-count')).toHaveText('1');
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await lancerJeu(hote.page, JEU, { demarrer });
    await expect(hote.page.getByTestId('file-attente')).toBeVisible({ timeout: 15_000 });
  }

  test('il s\'affiche sur chaque ligne, avec la valeur de la bibliothèque', async ({ browser }) => {
    await creerJeu({ name: JEU, type: 'quiz', questions: QUESTIONS });
    await ouvrir(browser);

    const vues = await lignes();
    expect(vues.length).toBe(3);
    // Chaque ligne porte SON compteur, et pas celui d'une autre.
    const parTexte = Object.fromEntries(vues);
    expect(parTexte['Q1 — Déjà posée trois fois']).toBe(3);
    expect(parTexte['Q2 — Jamais posée']).toBe(0);
    expect(parTexte['Q3 — Posée une fois']).toBe(1);
  });

  test('il monte d\'un cran quand la question est posée, ET SURVIT À UN NOUVEAU SALON', async ({ browser }) => {
    await creerJeu({ name: JEU, type: 'quiz', questions: QUESTIONS });
    await ouvrir(browser);

    // On pose la tête de file, quelle qu'elle soit : l'ordre est tiré au sort.
    const avant = await lignes();
    const [texte, compteur] = avant[0];
    await hote.page.getByTestId('simple-demarrer').click();
    await expect(joueurs[0].page.getByTestId('question-text')).toBeVisible({ timeout: 15_000 });

    // DANS LA BIBLIOTHÈQUE, pas seulement à l'écran.
    await expect.poll(() => posesEnBibliotheque(texte), {
      message: `le compteur de « ${texte} » n'a pas été écrit dans la bibliothèque`,
      timeout: 15_000,
    }).toBe(compteur + 1);

    // LE NOUVEAU SALON. On ferme la partie, on en rouvre une : le compteur doit
    // être celui d'avant, incrémenté — et surtout pas remis à zéro.
    await terminerPartie(hote.page);
    await hote.ctx.close();
    for (const j of joueurs.splice(0)) await j.ctx.close();
    hote = null;

    await ouvrir(browser);
    const apres = Object.fromEntries(await lignes());
    expect(apres[texte],
      'le compteur est reparti de zéro dans un nouveau salon — il doit être PERMANENT')
      .toBe(compteur + 1);
  });

  test('le tri remonte les questions les moins posées', async ({ browser }) => {
    await creerJeu({ name: JEU, type: 'quiz', questions: QUESTIONS });
    await ouvrir(browser);

    await hote.page.getByTestId('file-trier').click();

    await expect.poll(async () => (await lignes()).map(([, n]) => n), {
      message: 'la file n\'est pas triée par compteur croissant',
      timeout: 10_000,
    }).toEqual([0, 1, 3]);
  });
});
