// E2E — LA MODÉRATION DE « CACHE-CACHE » AU STUDIO (M7 et M8).
//
// CE QUI A ÉTÉ DEMANDÉ, deux lignes du compte rendu du 11/09 :
//   « À l'image des modules de questions [...] il faudrait que j'aie accès aux
//     questions possibles dans le module "Cache-cache". Je dois pouvoir voir,
//     modifier et créer : la question avec ses variables [...] le nombre
//     d'apparitions minimum et maximum de la question par manche. »
//   « Il faudrait que j'aie accès dans le studio à la base de données des images.
//     La base de données comporterait l'image (et son ID peut-être), son Nom et
//     sa Couleur. Il faut que je puisse modifier les informations et ajouter de
//     nouvelle ligne. »
//
// CE QUE CE CONTRÔLE GARDE, ET CE QU'IL NE GARDE PAS. Il ne vérifie PAS que le
// tirage obéit aux réglages : c'est l'affaire des contrôles unitaires de
// `cache-cache.test.js`, qui l'établissent manche par manche. Il vérifie le seul
// maillon qu'aucun test unitaire ne peut voir — celui entre le formulaire et le
// serveur.
//
// POURQUOI CE MAILLON-LÀ EST LE FRAGILE. Le contenu modéré ne voyage pas comme
// une question : il est rangé dans le même `questions` que les autres jeux, sous
// une marque à lui, et il traverse deux convertisseurs (`serveurVersStudio` et
// `studioVersServeur`) écrits pour des questions. Un contenu qui passerait par le
// convertisseur de questions en ressortirait vidé de ses gabarits — l'écran
// afficherait encore le catalogue par défaut, et rien ne dirait que le réglage a
// été perdu. D'où le RECHARGEMENT : il relit depuis le serveur, pas depuis l'état
// du navigateur.
import { test, expect } from '@playwright/test';
import { creerJeu, retirerJeux } from './helpers.js';

test.setTimeout(90_000);

const JEU = 'Cache modéré';
const ENONCE = 'DE QUELLE TEINTE EST « {objet} » ?';

test.describe('La modération de Cache-cache', () => {
  test.beforeEach(async () => { await creerJeu({ name: JEU, type: 'cache_cache', questions: [] }); });
  test.afterEach(async () => { await retirerJeux(JEU); });

  test('un énoncé et un quota réécrits survivent au rechargement', async ({ page }) => {
    await page.goto('/studio');
    await expect(page.locator('.studio')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: JEU }).first().click();

    const editeur = page.getByRole('complementary');
    const gabarits = editeur.getByTestId('cache-gabarits');
    await expect(gabarits).toBeVisible();

    // LE CATALOGUE DU SERVEUR FAIT FOI. Le Studio n'invente pas les formes : il
    // les reçoit de `/api/cache/catalogue`. Les six du dépôt doivent être là.
    const lignes = gabarits.locator('.cmod__ligne');
    await expect(lignes).toHaveCount(6);

    // « La question avec ses variables » : la balise est VISIBLE dans le champ,
    // pas remplacée par un exemple. C'est la demande, mot pour mot — « il n'y
    // aura pas écrit "Quel objet se cache derrière 1 ?" car 1 est une variable ».
    const premier = lignes.first();
    await expect(premier.locator('.cmod__vars')).toContainText('{objet}');
    await expect(premier.getByRole('textbox')).toHaveValue(/\{objet\}/);

    await premier.getByRole('textbox').fill(ENONCE);
    await premier.getByLabel('Min').fill('2');
    await premier.getByLabel('Max').fill('4');

    await editeur.getByRole('button', { name: /^Enregistrer/ }).click();
    await expect(editeur.locator('.save-state--saved')).toBeVisible({ timeout: 15_000 });

    // LE SEUL CONTRÔLE QUI COMPTE : on relit depuis le serveur.
    await page.reload();
    await expect(page.locator('.studio')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: JEU }).first().click();

    const relu = page.getByRole('complementary').getByTestId('cache-gabarits').locator('.cmod__ligne').first();
    await expect(relu.getByRole('textbox'),
      "l'énoncé réécrit a été perdu entre le Studio et le serveur").toHaveValue(ENONCE);
    await expect(relu.getByLabel('Min')).toHaveValue('2');
    await expect(relu.getByLabel('Max')).toHaveValue('4');
  });

  test('la base d\'images se modifie ligne à ligne, et la modification tient', async ({ page }) => {
    await page.goto('/studio');
    await expect(page.locator('.studio')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: JEU }).first().click();

    const base = page.getByRole('complementary').getByTestId('cache-objets');
    await expect(base).toBeVisible();

    // REPLIÉE PAR DÉFAUT : deux cents vignettes déroulées sous un formulaire qu'on
    // ouvre pour renommer un module, c'est deux cents requêtes pour rien.
    await expect(base.locator('.cmod__objet')).toHaveCount(0);
    await base.getByTestId('cache-voir-images').click();

    const rangs = base.locator('.cmod__objet');
    await expect(rangs.first()).toBeVisible();
    expect(await rangs.count(), 'la banque des deux cents objets n\'est pas arrivée').toBe(200);

    // « L'image, son ID, son Nom et sa Couleur » — les quatre colonnes demandées.
    const premier = rangs.first();
    await expect(premier.locator('.cmod__vignette')).toHaveAttribute('src', /\/objets\/.+\.webp$/);
    await expect(premier.locator('.cmod__id')).not.toBeEmpty();
    const idObjet = (await premier.locator('.cmod__id').textContent()).trim();

    await premier.getByLabel(`Nom de ${idObjet}`).fill('Trombone à coulisse');
    await premier.getByLabel(`Couleur de ${idObjet}`).selectOption('Vert');

    // « Ajouter de nouvelle ligne » : la 201e. Elle arrive VIDE, et le Studio la
    // refuse tant qu'elle l'est — une image sans fichier ne se verrait qu'à
    // l'antenne, sur une case restée blanche.
    await base.getByTestId('cache-ajouter-objet').click();
    await expect(rangs).toHaveCount(201);
    const editeur = page.getByRole('complementary');
    await editeur.getByRole('button', { name: /^Enregistrer/ }).click();
    await expect(editeur.locator('.save-state--invalid')).toBeVisible();
    await expect(editeur.locator('.save-state--invalid')).toContainText("n'a pas de nom");

    const neuf = rangs.last();
    const idNeuf = (await neuf.locator('.cmod__id').textContent()).trim();
    await neuf.getByLabel(`Nom de ${idNeuf}`).fill('Sifflet');
    await neuf.getByLabel(`Image de ${idNeuf}`).fill('/objets/ampoule-bleu.webp');

    await editeur.getByRole('button', { name: /^Enregistrer/ }).click();
    await expect(editeur.locator('.save-state--saved')).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.locator('.studio')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: JEU }).first().click();
    const relue = page.getByRole('complementary').getByTestId('cache-objets');
    await relue.getByTestId('cache-voir-images').click();
    const relu = relue.locator('.cmod__objet');
    await expect(relu).toHaveCount(201);
    await expect(relu.first().getByLabel(`Nom de ${idObjet}`),
      'le nom corrigé a été perdu au rechargement').toHaveValue('Trombone à coulisse');
    await expect(relu.first().getByLabel(`Couleur de ${idObjet}`)).toHaveValue('Vert');
    await expect(relu.last().getByLabel(/^Nom de /)).toHaveValue('Sifflet');
  });

  // LE FILTRE, ET LE PIÈGE DE L'INDICE.
  //
  // Deux cents rangées dans une fenêtre de quatre cent vingt pixels, c'est plus de
  // cent écrans de défilement pour atteindre une image : sans filtre, la capacité
  // demandée existe sans être utilisable. Mais un filtre qui réindexe la liste
  // écrit dans la MAUVAISE ligne — on corrige « guitare rose » et c'est « ampoule
  // bleu » qui change, deux cents lignes plus haut, là où personne ne regarde.
  test('le filtre montre moins de lignes et écrit quand même dans la bonne', async ({ page }) => {
    await page.goto('/studio');
    await expect(page.locator('.studio')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: JEU }).first().click();

    const base = page.getByRole('complementary').getByTestId('cache-objets');
    await base.getByTestId('cache-voir-images').click();
    const rangs = base.locator('.cmod__objet');
    await expect(rangs.first()).toBeVisible();
    expect(await rangs.count()).toBe(200);

    await base.getByLabel("Filtrer la base d'images").fill('guitare');
    await expect(rangs).toHaveCount(5);
    await rangs.nth(2).getByLabel('Nom de guitare-rose').fill('Mandoline');

    await base.getByLabel("Filtrer la base d'images").fill('');
    await expect(rangs).toHaveCount(200);
    // Une seule ligne a bougé, et c'est celle qu'on a touchée.
    const modifiees = base.locator('.cmod__objet input[aria-label^="Nom de"]');
    const valeurs = await modifiees.evaluateAll((els) => els.map((e) => e.value));
    expect(valeurs.filter((v) => v === 'Mandoline')).toHaveLength(1);
    await expect(rangs.nth(valeurs.indexOf('Mandoline')).locator('.cmod__id')).toHaveText('guitare-rose');
  });

  // LE RÉGLAGE QUI TUE LA MANCHE, ET QUI NE SE VOIT PAS.
  //
  // Cinq questions sont tirées par manche. Si les minimums en réclament plus de
  // cinq, ou si les maximums n'en permettent pas cinq, AUCUNE répartition
  // n'existe : le serveur lève une erreur et l'animateur clique « Lancer » sans
  // que rien ne parte — à l'antenne, sans rien pour le dire. Le formulaire, lui,
  // n'a l'air de rien : six lignes chacune plausible.
  test('un jeu de quotas dont aucune manche ne peut sortir est refusé, et dit pourquoi', async ({ page }) => {
    await page.goto('/studio');
    await expect(page.locator('.studio')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: JEU }).first().click();

    const editeur = page.getByRole('complementary');
    const lignes = editeur.getByTestId('cache-gabarits').locator('.cmod__ligne');
    await expect(lignes.first()).toBeVisible();

    // Six questions à deux exemplaires minimum : douze pour cinq places.
    const n = await lignes.count();
    for (let i = 0; i < n; i += 1) await lignes.nth(i).getByLabel('Min').fill('2');

    await editeur.getByRole('button', { name: /^Enregistrer/ }).click();
    await expect(editeur.locator('.save-state--invalid')).toBeVisible();
    await expect(editeur.locator('.save-state--invalid')).toContainText(/minimums totalisent 12/);

    // Et l'inverse : tout à zéro, aucune manche ne peut être remplie.
    for (let i = 0; i < n; i += 1) {
      await lignes.nth(i).getByLabel('Min').fill('0');
      await lignes.nth(i).getByLabel('Max').fill('0');
    }
    await editeur.getByRole('button', { name: /^Enregistrer/ }).click();
    await expect(editeur.locator('.save-state--invalid')).toContainText(/maximums totalisent 0/);
  });
});
