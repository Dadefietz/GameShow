// E2E — « FRONTIÈRES », de bout en bout.
//
// CE QUI SE GARDE ICI, ET QU'AUCUN AUTRE CONTRÔLE NE VERRAIT.
//
// Le module est déjà tenu ailleurs : `tests/unit/frontieres.test.js` règle le
// barème palier par palier et vérifie que la banque ne laisse rien fuir, et la
// boucle d'intégration suit les charges utiles d'un bout à l'autre du réseau —
// la base qui ne part qu'à la console, les indices poussés un par un, le relevé
// personnel qui porte `indicesVus`. Ce fichier ne refait rien de cela. Il
// regarde quatre choses qui n'existent QUE dans un navigateur :
//
//   1. LA CARTE A UNE TAILLE, sur le téléphone ET à l'antenne. C'est la leçon la
//      plus chère du dépôt : la cible de « Cueillette » a mesuré 0 × 0 à
//      l'écran — présente dans le document, son image chargée, et invisible —
//      parce qu'une hauteur en pourcentage pendait dans une chaîne d'éléments
//      dont la hauteur dépendait du contenu. Corrigée une fois, la même boucle
//      est revenue un étage plus haut. La carte de ce jeu est posée dans un
//      `flex: 1` au creux de la même sorte de chaîne : rien, côté serveur, ne
//      pourrait s'apercevoir qu'elle ne se voit pas.
//
//   2. LES QUATRE CASES EXISTENT DÈS LA PREMIÈRE SECONDE, avec leur « ? », et la
//      mise en page NE SAUTE PAS quand un indice arrive. C'est demandé mot pour
//      mot — « tant qu'un indice n'est pas dévoilé, un "?" prend sa place » — et
//      c'est aussi une question de confort : l'indice tombe pendant que le
//      joueur tape, les yeux sur son clavier.
//
//   3. L'INDICE ARRIVE DANS SA CASE. Il voyage par un événement de connexion
//      (`frontieres:indice`), traverse l'état partagé et atterrit dans une case
//      désignée par sa clé. Un défaut de ce câblage ne se voit qu'en attendant
//      la dixième seconde devant l'écran.
//
//   4. L'AIDE À LA SAISIE PROPOSE, ET UN APPUI RÉPOND. Deux gestes pour une
//      réponse déjà choisie coûteraient un palier — deux cents points.
//
// LA CIBLE EST IMPOSÉE par l'animateur, et la base est À NOUS : sans cela le
// tirage changerait de pays à chaque exécution, et le contrôle mesurerait un
// jour l'Islande, le lendemain le Tchad.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer, lancerJeu, creerJeu, retirerJeux, BASE } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.setTimeout(180_000);

const JEU = 'Frontières du contrôle';

// DEUX PAYS INVENTÉS, ET LEURS QUATRE INDICES.
//
// INVENTÉS, ET C'EST VOULU : un contrôle qui attendrait « France » dans une case
// écrirait une réponse de la vraie banque dans le dépôt, et le jour où elle
// changerait de difficulté ou d'indice, c'est ce fichier qui deviendrait faux.
// Les identifiants, eux, sont ceux du dépôt — c'est d'eux que se déduit
// l'adresse de la carte, et il faut un fichier qui existe pour mesurer une image.
const BASE_PAYS = {
  kind: 'contenu-frontieres',
  pays: [
    {
      id: 'f001', nom: 'Sylvanie', difficulte: 2, continent: 'Europe',
      longueur: '400 km', largeur: '300 km', frontaliers: 'Ruritanie, Latvérie',
      initiale: 'Commence par un S',
    },
    {
      id: 'f002', nom: 'Ruritanie', difficulte: 2, continent: 'Europe',
      longueur: '200 km', largeur: '150 km', frontaliers: 'Sylvanie',
      initiale: 'Commence par un R',
    },
  ],
  poses: { f001: 7, f002: 2 },
};

test.describe('Frontières', () => {
  let hote = null;
  const joueurs = [];
  let stream = null;

  test.beforeEach(async () => {
    await retirerJeux(JEU);
    await creerJeu({ name: JEU, type: 'frontieres', duration: 45, questions: [BASE_PAYS] });
  });

  test.afterEach(async () => {
    if (stream) { await stream.close().catch(() => {}); stream = null; }
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    for (const j of joueurs.splice(0)) await j.ctx.close();
    await retirerJeux(JEU);
  });

  async function annoncer(browser, { avecStream = false, pseudos = ['Carto'] } = {}) {
    hote = await openHost(browser);
    for (const p of pseudos) joueurs.push(await joinAsPlayer(browser, hote.code, p));
    if (avecStream) {
      stream = await hote.ctx.newPage();
      await stream.setViewportSize({ width: 1920, height: 1080 });
      const token = await hote.page.evaluate(() => JSON.parse(localStorage.getItem('host')).overlayToken);
      await stream.goto(`/overlay?token=${token}`);
      await expect(stream.getByTestId('stream-room-code')).toHaveText(hote.code);
    }
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await lancerJeu(hote.page, JEU, { demarrer: false });
    await expect(hote.page.getByTestId('depart-frontieres')).toBeVisible();
  }

  test('LA CONSOLE CHOISIT SUR DES NOMS ET DES COMPTEURS — jamais sur une carte', async ({ browser }) => {
    await annoncer(browser);
    const h = hote.page;

    // « Il n'a pas besoin de voir la carte, il doit voir les noms des pays et le
    // nombre de fois où le pays a été joué. »
    await h.getByTestId('fr-difficulte-2').click();
    const pays = h.getByTestId('fr-pays');
    await expect(pays).toHaveCount(2);
    await expect(pays.first()).toContainText('Sylvanie');
    // LE COMPTEUR EST LÀ, et c'est ce qu'on vient y chercher : sans lui,
    // impossible de poser d'abord ce qui a le moins servi.
    await expect(h.getByTestId('fr-poses').first()).toHaveText('7');
    await expect(h.getByTestId('fr-poses').nth(1)).toHaveText('2');
    // AUCUNE IMAGE DANS LE PANNEAU DE DÉPART. La banque qui arrive sur cette
    // console ne porte pas les cartes ; ce contrôle vérifie que l'écran n'en
    // fabrique pas pour autant.
    await expect(h.locator('[data-testid="depart-frontieres"] img')).toHaveCount(0);

    // TRIER PAR PASSAGES remonte le moins joué. L'ordre de la base met la
    // Sylvanie (7) devant la Ruritanie (2) : le tri doit les échanger.
    await h.getByTestId('fr-trier').click();
    await expect(h.getByTestId('fr-pays').first()).toContainText('Ruritanie');
    await expect(h.getByTestId('fr-poses').first()).toHaveText('2');

    // SANS CHOIX, LA DIFFICULTÉ PART QUAND MÊME — c'est tout le sens de « la
    // catégorie pré-sélectionnée ». L'écran le dit en clair plutôt que de
    // laisser croire que rien n'a été décidé.
    await expect(h.getByTestId('fr-cible')).toContainText('difficulté 2');
    await h.getByTestId('fr-pays').nth(1).click();
    await expect(h.getByTestId('fr-cible')).toContainText('Cible : Sylvanie');
  });

  test('LA CARTE PREND LA PLACE QU’ON LUI PROMET, sur les deux écrans', async ({ browser }) => {
    await annoncer(browser, { avecStream: true });
    const h = hote.page;
    await h.getByTestId('fr-difficulte-2').click();
    await h.getByTestId('fr-pays').first().click();
    await expect(h.getByTestId('fr-cible')).toContainText('Cible : Sylvanie');
    await h.getByTestId('frontieres-demarrer').click();

    // SUR LE TÉLÉPHONE. Le seuil n'est pas une valeur au pixel : il distingue
    // « affichée » de « rognée », et surtout de zéro — le défaut qui s'est
    // produit deux fois sur la cible de « Cueillette ».
    const j = joueurs[0].page;
    const carte = j.getByTestId('fr-carte');
    await expect(carte).toBeVisible({ timeout: 20_000 });
    const surJoueur = await carte.boundingBox();
    expect(surJoueur.width, 'la carte est invisible sur le téléphone').toBeGreaterThan(150);
    expect(surJoueur.height, 'la carte n’a pas de hauteur sur le téléphone').toBeGreaterThan(100);
    // L'IMAGE ELLE-MÊME, et pas seulement son cadre : un cadre à la bonne taille
    // autour d'une image à zéro est exactement ce qu'on a déjà vu.
    const image = await j.locator('[data-testid="fr-carte"] img').boundingBox();
    expect(image.width, 'l’image de la carte ne se voit pas').toBeGreaterThan(80);
    expect(image.height).toBeGreaterThan(60);

    // À L'ANTENNE : la carte occupe la colonne large d'une scène de 1920 × 1080.
    const surStream = stream.getByTestId('stream-frontieres');
    await expect(surStream).toBeVisible({ timeout: 10_000 });
    const grande = await stream.locator('.st-fr__carte img').boundingBox();
    expect(grande.width, 'la carte est invisible à l’antenne').toBeGreaterThan(400);
    expect(grande.height, 'la carte n’a pas de hauteur à l’antenne').toBeGreaterThan(300);

    // ET LE NOM DU PAYS N'EST NULLE PART, sur aucun des deux écrans : c'est la
    // réponse, et le stream est regardé en direct par des gens qui jouent.
    await expect(j.locator('body')).not.toContainText('Sylvanie');
    await expect(stream.locator('body')).not.toContainText('Sylvanie');
  });

  test('LES QUATRE CASES ATTENDENT AVEC UN « ? », ET NE SAUTENT PAS QUAND L’INDICE TOMBE', async ({ browser }) => {
    await annoncer(browser, { avecStream: true });
    await hote.page.getByTestId('fr-difficulte-2').click();
    await hote.page.getByTestId('fr-pays').first().click();
    await hote.page.getByTestId('frontieres-demarrer').click();

    const j = joueurs[0].page;
    await expect(j.getByTestId('fr-indices')).toBeVisible({ timeout: 20_000 });
    // LES QUATRE, DÈS LA PREMIÈRE SECONDE, DANS L'ORDRE DU DÉVOILEMENT.
    for (const [cle, nom] of [['continent', 'Continent'], ['taille', 'Taille'],
      ['frontaliers', 'Pays frontaliers'], ['initiale', 'Initiale']]) {
      const case_ = j.getByTestId(`fr-indice-${cle}`);
      await expect(case_).toContainText(nom);
      await expect(case_).toHaveAttribute('data-dit', 'non');
      await expect(case_).toContainText('?');
    }

    // LA GÉOMÉTRIE EST RELEVÉE AVANT, puis comparée après. C'est la seule façon
    // de prouver que la page ne saute pas : le nombre de cases ne change pas, et
    // c'est précisément pour cela qu'elles sont déclarées vides dès le départ.
    const avant = await j.getByTestId('fr-indices').boundingBox();
    const carteAvant = await j.getByTestId('fr-carte').boundingBox();

    // LE PREMIER INDICE TOMBE À DIX SECONDES. On l'attend : c'est le serveur qui
    // le pousse, et rien d'autre ne peut le provoquer.
    const premier = j.getByTestId('fr-indice-continent');
    await expect(premier).toHaveAttribute('data-dit', 'oui', { timeout: 20_000 });
    await expect(premier).toContainText('Europe');
    // LES TROIS AUTRES ATTENDENT ENCORE. Un câblage qui remplirait les quatre
    // d'un coup donnerait l'initiale trente secondes trop tôt.
    await expect(j.getByTestId('fr-indice-taille')).toHaveAttribute('data-dit', 'non');
    await expect(j.getByTestId('fr-indice-initiale')).toHaveAttribute('data-dit', 'non');

    const apres = await j.getByTestId('fr-indices').boundingBox();
    const carteApres = await j.getByTestId('fr-carte').boundingBox();
    expect(Math.abs(apres.height - avant.height), 'les cases d’indices ont changé de hauteur')
      .toBeLessThanOrEqual(2);
    expect(Math.abs(carteApres.y - carteAvant.y), 'la carte a bougé sous les doigts du joueur')
      .toBeLessThanOrEqual(2);

    // ET L'INDICE EST AUSSI À L'ANTENNE : le public joue avec le cercle.
    await expect(stream.getByTestId('stream-fr-indice-continent'))
      .toHaveAttribute('data-dit', 'oui', { timeout: 10_000 });
    await expect(stream.getByTestId('stream-fr-indice-initiale')).toContainText('?');
  });

  test('L’AIDE À LA SAISIE PROPOSE, ET UN SEUL APPUI RÉPOND', async ({ browser }) => {
    await annoncer(browser, { avecStream: true, pseudos: ['Carto', 'Atlas'] });
    await hote.page.getByTestId('fr-difficulte-2').click();
    await hote.page.getByTestId('fr-pays').first().click();
    await hote.page.getByTestId('frontieres-demarrer').click();

    const j = joueurs[0].page;
    const champ = j.getByTestId('fr-saisie');
    await expect(champ).toBeVisible({ timeout: 20_000 });
    // RIEN NE SE PROPOSE TANT QU'ON N'A RIEN TAPÉ : une liste de deux cents noms
    // offerte d'emblée serait la banque entière à l'écran.
    await expect(j.getByTestId('fr-suggestion')).toHaveCount(0);
    await expect(j.getByTestId('answer-submit')).toBeDisabled();

    // L'AIDE IGNORE ACCENTS ET CASSE, comme le serveur. « sylv » doit trouver.
    await champ.fill('sylv');
    const proposition = j.getByTestId('fr-suggestion');
    await expect(proposition).toHaveCount(1);
    await expect(proposition.first()).toHaveText('Sylvanie');

    // CE QUI COMMENCE PAR LA SAISIE D'ABORD : « ani » est dans les deux noms,
    // mais seule la Ruritanie n'en commence pas moins par… rien de tel. On
    // vérifie donc simplement que les deux sont proposés, l'ordre de la base
    // servant de départage.
    await champ.fill('ani');
    await expect(j.getByTestId('fr-suggestion')).toHaveCount(2);

    // UN SEUL APPUI RÉPOND. Deux gestes coûteraient un palier.
    await champ.fill('sylv');
    await j.getByTestId('fr-suggestion').first().click();
    await expect(j.getByTestId('answer-submit')).toContainText('Réponse envoyée', { timeout: 10_000 });
    // ET L'AIDE DISPARAÎT : on ne répond pas deux fois.
    await expect(j.getByTestId('fr-suggestion')).toHaveCount(0);

    // LE SECOND JOUEUR TAPE SON NOM EN ENTIER, SANS L'AIDE, et la touche de
    // validation du clavier l'envoie — comme partout ailleurs dans le projet.
    const a = joueurs[1].page;
    await a.getByTestId('fr-saisie').fill('ruritanie');
    await a.getByTestId('fr-saisie').press('Enter');
    await expect(a.getByTestId('answer-submit')).toContainText('Réponse envoyée', { timeout: 10_000 });

    // LA CONSOLE DÉPOUILLE AVEC LES NOMS, à la révélation. C'est la demande :
    // « les réponses données triées de la plus donnée à la moins donnée et les
    // noms des joueurs ayant donnés la réponse juste à côté. »
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();
    const depouille = hote.page.getByTestId('reponses-frontieres');
    await expect(depouille).toBeVisible({ timeout: 20_000 });
    const lignes = hote.page.getByTestId('fr-reponse');
    await expect(lignes).toHaveCount(2);
    // ON DÉSIGNE LES BLOCS PAR LEUR CONTENU, ET NON PAR LEUR RANG. Les deux
    // réponses sont ici à UNE VOIX CHACUNE : à égalité, le tri du serveur
    // bascule sur l'ordre alphabétique, et « Ruritanie » passe devant
    // « Sylvanie ». Écrit sur le rang, ce contrôle affirmait un ordre que les
    // données ne donnent pas — il a échoué en annonçant une réponse perdue qui
    // était bien là. Le TRI lui-même se mesure sur des effectifs différents,
    // et c'est la boucle d'intégration qui le fait (2 voix contre 1).
    const juste = lignes.filter({ hasText: 'Sylvanie' });
    const faux = lignes.filter({ hasText: 'Ruritanie' });
    await expect(juste).toContainText('Carto');
    await expect(juste).toHaveAttribute('data-juste', 'oui');
    await expect(faux).toContainText('Atlas');
    // LA MAUVAISE RÉPONSE N'EST PAS MARQUÉE JUSTE : avec cinq pays voisins dans
    // la liste, c'est cette marque qui évite à l'animateur de chercher lequel
    // était le bon en se remémorant la carte, en direct.
    await expect(faux).not.toHaveAttribute('data-juste', 'oui');
    // ET LE PAYS EST EN TÊTE, sans qu'il ait à le chercher dans la liste.
    await expect(hote.page.getByTestId('fr-pays-hote')).toContainText('Sylvanie');

    // L'ÉCRAN DE RÉSULTAT DU JOUEUR. « La Carte cible, la réponse donnée et le
    // pays réponse, les indices, et les points obtenus. » Cinq choses, et c'est
    // ici qu'on voit si elles y sont vraiment.
    const bilan = j.getByTestId('fr-bilan');
    await expect(bilan).toBeVisible({ timeout: 20_000 });
    await expect(j.getByTestId('fr-pays-reponse')).toHaveText('Sylvanie');
    await expect(j.getByTestId('fr-ta-reponse')).toContainText('Sylvanie');
    // LA CARTE A ENCORE UNE TAILLE SUR CET ÉCRAN-LÀ : elle est dans une autre
    // chaîne d'éléments que pendant la manche, et c'est exactement là que la
    // cible de « Cueillette » a mesuré zéro une seconde fois.
    const carteBilan = await j.locator('[data-testid="fr-bilan"] img').boundingBox();
    expect(carteBilan.width, 'la carte du bilan ne se voit pas').toBeGreaterThan(80);
    expect(carteBilan.height).toBeGreaterThan(60);
    // LES QUATRE INDICES SONT TOUS LISIBLES, dévoilés : c'est la leçon de la
    // manche. Deux suffisent à le prouver, dont la taille, qui est le seul à
    // être composé de deux nombres.
    await expect(j.getByTestId('fr-bilan-indice-continent')).toContainText('Europe');
    await expect(j.getByTestId('fr-bilan-indice-taille')).toContainText('400 km × 300 km');
    await expect(j.getByTestId('fr-bilan-indice-initiale')).toContainText('Commence par un S');
    // ET LES POINTS : la bonne réponse donnée avant le premier indice vaut le
    // haut du barème.
    // L'EXPRESSION, ET NON LA CHAÎNE : `toLocaleString('fr-FR')` sépare les
    // milliers par une espace fine insécable (U+202F), que personne ne tape à la
    // main. Et le nombre est ANIMÉ — il monte jusqu'à sa valeur — d'où l'attente.
    await expect(j.getByTestId('points-gained')).toContainText(/\+1\s?200/, { timeout: 15_000 });

    // L'ÉCRAN DE STREAM À LA RÉVÉLATION. « Quasiment le même écran que lors de la
    // diffusion, à un détail : il faut afficher la réponse — le nom du pays en
    // français. » Donc la MÊME carte, les MÊMES cases, plus le nom.
    const revStream = stream.getByTestId('stream-frontieres-reveal');
    await expect(revStream).toBeVisible({ timeout: 10_000 });
    await expect(stream.getByTestId('stream-fr-pays')).toHaveText('Sylvanie');
    const carteRev = await stream.locator('.st-fr__carte img').boundingBox();
    expect(carteRev.width, 'la carte a disparu de l’antenne à la révélation').toBeGreaterThan(400);
    await expect(stream.getByTestId('stream-fr-reveal-frontaliers')).toContainText('Ruritanie, Latvérie');
    await expect(stream.getByTestId('stream-fr-reveal-taille')).toContainText('400 km × 300 km');
    // AUCUN NOM DE JOUEUR À L'ANTENNE, à la révélation pas plus qu'avant.
    await expect(stream.locator('body')).not.toContainText('Carto');
    await expect(stream.locator('body')).not.toContainText('Atlas');
  });

  test('LA RÉPONSE CHOISIE SANS ÊTRE ENVOYÉE EST GARDÉE', async ({ browser }) => {
    // « S'il ne l'envoie pas avant la fin du compteur, la réponse est gardée et
    // si elle est bonne, elle vaudra le minimum de point. »
    //
    // CE QUE SEUL LE NAVIGATEUR MONTRE ICI : que la frappe elle-même pousse le
    // brouillon. Le mécanisme côté serveur est tenu par la boucle d'intégration
    // et par le contrôle unitaire ; ce qui ne se voit qu'ici, c'est le câblage du
    // champ de saisie — un `onChange` qui n'appellerait pas `onBrouillon`
    // laisserait le joueur perdre sa réponse sans que rien ne le dise.
    await annoncer(browser);
    await hote.page.getByTestId('fr-difficulte-2').click();
    await hote.page.getByTestId('fr-pays').first().click();
    await hote.page.getByTestId('frontieres-demarrer').click();

    const j = joueurs[0].page;
    await expect(j.getByTestId('fr-saisie')).toBeVisible({ timeout: 20_000 });
    // ON TAPE LE NOM EN ENTIER ET ON N'ENVOIE PAS. La frappe caractère par
    // caractère est délibérée : c'est elle qui déclenche les brouillons.
    await j.getByTestId('fr-saisie').pressSequentially('Sylvanie', { delay: 40 });
    // Le brouillon est freiné à un toutes les 250 ms : on laisse partir le dernier.
    await j.waitForTimeout(500);
    // RIEN N'A ÉTÉ ENVOYÉ — le bouton attend toujours.
    await expect(j.getByTestId('answer-submit')).toContainText('Envoyer');

    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();
    // ET POURTANT LA RÉPONSE COMPTE, au dernier palier : trois cents points.
    await expect(j.getByTestId('fr-ta-reponse')).toContainText('Sylvanie', { timeout: 20_000 });
    await expect(j.getByTestId('points-gained')).toContainText(/\+300/, { timeout: 15_000 });
  });

  // LES RETOURS DU 19/11 — « privilégier que le contenu soit visible plutôt que la
  // taille des éléments ». Chaque phrase de la demande est ici une mesure.
  test('UN PETIT TÉLÉPHONE VOIT TOUT SANS DÉFILER, ET LE STREAM MONTRE LA CARTE ENTIÈRE, SANS CARRÉ', async ({ browser }) => {
    hote = await openHost(browser);
    // Un iPhone SE : 375 × 667, le plus petit écran courant.
    joueurs.push(await joinAsPlayer(browser, hote.code, 'Carto',
      { viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true }));
    stream = await hote.ctx.newPage();
    await stream.setViewportSize({ width: 1920, height: 1080 });
    const token = await hote.page.evaluate(() => JSON.parse(localStorage.getItem('host')).overlayToken);
    await stream.goto(`/overlay?token=${token}`);
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await lancerJeu(hote.page, JEU, { demarrer: false });
    await hote.page.getByTestId('fr-difficulte-2').click();
    await hote.page.getByTestId('fr-pays').first().click();
    await hote.page.getByTestId('frontieres-demarrer').click();

    const j = joueurs[0].page;
    await expect(j.getByTestId('fr-saisie')).toBeVisible({ timeout: 20_000 });
    // « Assurez-vous que la zone d'écriture apparaisse sans que le joueur ait
    // besoin de défiler. »
    const mesure = await j.evaluate(() => {
      const b = (sel) => document.querySelector(sel).getBoundingClientRect();
      return {
        hauteur: innerHeight,
        page: document.scrollingElement.scrollHeight,
        saisie: b('[data-testid="fr-saisie"]').bottom,
        indices: b('[data-testid="fr-indices"]').bottom,
        carte: b('[data-testid="fr-carte"]').height,
      };
    });
    expect(mesure.page, 'la page défile').toBeLessThanOrEqual(mesure.hauteur + 1);
    expect(mesure.saisie, 'le champ de saisie est sous le bord').toBeLessThanOrEqual(mesure.hauteur);
    expect(mesure.indices).toBeLessThanOrEqual(mesure.hauteur);
    expect(mesure.carte, 'la carte a disparu').toBeGreaterThan(100);

    // LE STREAM : la carte entière dans la scène, et aucun carré derrière.
    const verifierCarte = async () => {
      const img = await stream.locator('.st-fr__carte img').boundingBox();
      expect(img.y, 'la carte sort par le haut').toBeGreaterThanOrEqual(0);
      expect(img.y + img.height, 'la carte sort par le bas de la scène').toBeLessThanOrEqual(1080);
      expect(img.height, 'la carte est trop petite').toBeGreaterThan(450);
      const style = await stream.locator('.st-fr__carte').evaluate((el) => {
        const c = getComputedStyle(el); const i = getComputedStyle(el.querySelector('img'));
        return { fond: c.backgroundColor, ombre: c.boxShadow, filtre: i.filter, fusion: i.mixBlendMode };
      });
      expect(style.fond, 'une plaque est revenue derrière la carte').toBe('rgba(0, 0, 0, 0)');
      expect(style.ombre).toBe('none');
      // Le fond blanc de l'image elle-même s'efface : inversée, fondue.
      expect(style.filtre).toContain('invert');
      expect(style.fusion).toBe('screen');
    };
    await expect(stream.getByTestId('stream-frontieres')).toBeVisible({ timeout: 10_000 });
    await verifierCarte();
    // Le titre a perdu sa taille de 116 pixels.
    const titre = await stream.getByTestId('question-text').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(titre).toBeLessThan(80);

    await j.getByTestId('fr-saisie').fill('sylv');
    await j.getByTestId('fr-suggestion').first().click();
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();
    await expect(stream.getByTestId('stream-frontieres-reveal')).toBeVisible({ timeout: 20_000 });
    await verifierCarte();
    // LE NOM TIENT DANS SON BANDEAU (vu à l'écran : « Sylvanie » en sortait).
    const nom = await stream.getByTestId('stream-fr-pays').evaluate((el) => {
      const b = el.getBoundingClientRect(); const c = el.closest('.st-answer').getBoundingClientRect();
      return { droite: b.right, cadre: c.right };
    });
    expect(nom.droite).toBeLessThanOrEqual(nom.cadre + 1);
    // Les quatre indices et le nom, dans la scène.
    const bilan = await stream.locator('.st-fr__bilan').boundingBox();
    expect(bilan.y + bilan.height).toBeLessThanOrEqual(1080);

    // LE COMPTEUR SE MET À JOUR PENDANT LA PARTIE (19/11) — et non à la sortie du
    // jeu. La Sylvanie était à 7 ; on vient de la jouer : la relance doit dire 8.
    await hote.page.getByTestId('host-suivant').click();
    await expect(hote.page.getByTestId('depart-frontieres')).toBeVisible({ timeout: 10_000 });
    await hote.page.getByTestId('fr-difficulte-2').click();
    await expect(hote.page.getByTestId('fr-pays').filter({ hasText: 'Sylvanie' }).getByTestId('fr-poses')).toHaveText('8', { timeout: 10_000 });
  });

  test('LA BASE DE PAYS SE RÈGLE AU STUDIO', async ({ browser }) => {
    // « Cette base de données doit être accessible quelque part dans le Studio
    // afin d'être ajustée à tout moment. » Un jeu dont la base ne serait
    // modifiable que par le dépôt serait figé pour l'animateur.
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await page.goto(`${BASE}/studio`);
      await page.getByRole('article').filter({ hasText: JEU }).getByRole('button').first().click();
      const editeur = page.getByTestId('studio-editeur');
      await expect(editeur).toBeVisible();
      await expect(editeur.getByTestId('frontieres-base')).toBeVisible();
      // LES DEUX PAYS DE LA BASE DU MODULE, avec leurs compteurs et leurs indices.
      await expect(editeur.getByTestId('frontieres-ligne')).toHaveCount(2);
      await expect(editeur.getByTestId('frontieres-poses-f001')).toHaveValue('7');
      await expect(editeur.getByLabel('Continent de Sylvanie')).toHaveValue('Europe');
      await expect(editeur.getByLabel('Initiale de Sylvanie')).toHaveValue('Commence par un S');
      // LES ONGLETS DE DIFFICULTÉ — les mêmes qu'à l'antenne : l'animateur qui
      // prépare sa base la voit rangée comme il la retrouvera en direct.
      await expect(editeur.getByTestId('frontieres-onglet-2')).toContainText('2');

      // ON MODIFIE, ON ENREGISTRE, ET LE SERVEUR LE GARDE.
      await editeur.getByLabel('Continent de Sylvanie').fill('Océanie');
      await editeur.getByRole('button', { name: /^Enregistrer/ }).click();
      await expect(editeur.getByRole('button', { name: /^Enregistrer/ })).toBeEnabled({ timeout: 20_000 });
      const apres = await fetch(`${BASE}/api/modules`).then((r) => r.json());
      const jeu = (apres.modules || []).find((m) => m.name === JEU);
      const banque = (jeu?.questions || []).find((q) => q.kind === 'contenu-frontieres');
      expect(banque?.pays?.find((p) => p.nom === 'Sylvanie')?.continent).toBe('Océanie');
      // ET LE COMPTEUR A SURVÉCU À LA MODIFICATION : c'est le défaut qu'on a
      // corrigé sur la banque de « Cueillette », où renommer un dessin effaçait
      // en silence le nombre de fois où il avait été posé.
      expect(banque?.poses?.f001).toBe(7);
    } finally {
      await ctx.close();
    }
  });
});
