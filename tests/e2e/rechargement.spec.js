// E2E — LE RECHARGEMENT (chantier v4, actions 1, 2, 3 et 10).
//
// POURQUOI CE FICHIER EXISTE ALORS QUE L'ACTION 12 DU CHANTIER v1 TRAITAIT DÉJÀ
// « LA RESTITUTION DES RÉSULTATS AU JOUEUR ».
//
// Elle avait ses deux contrôles, son audit, et un écart trouvé puis corrigé. Et
// pourtant l'utilisateur vivait toujours le défaut en partie réelle. La raison
// tient en une phrase : ses contrôles simulaient une COUPURE SOCKET.IO — la page
// reste en mémoire, l'état React survit, seule la connexion tombe. L'utilisateur,
// lui, appuie sur F5, ce qui détruit TOUT l'état.
//
// Deux pannes différentes. Une seule était couverte.
//
// Le défaut se reproduisait dès la SALLE D'ATTENTE, avant même la première
// question — et il dépendait du chemin d'entrée : par le QR du stream l'URL
// portait `?code=`, en tapant le code au formulaire elle restait `/`. Le second
// chemin est celui de quiconque lit le code à l'antenne.
//
// Ce fichier appuie sur F5, aux six étapes, sur les trois surfaces.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer, retirerJeux } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.describe('Le rechargement de page', () => {
  let hote = null;
  const joueurs = [];

  test.afterEach(async () => {
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    for (const j of joueurs.splice(0)) await j.ctx.close();
  });

  // Ce qu'on relève après un F5 : pas « un écran s'affiche », mais QUI on est.
  async function identite(page) {
    return page.evaluate(() => ({
      surFormulaire: !!document.querySelector('[data-testid="join-form"]'),
      url: location.pathname + location.search,
      sessions: Object.keys(localStorage).filter((k) => k.startsWith('play:')),
    }));
  }

  test('le joueur reste dans la partie à chaque étape', async ({ browser }) => {
    hote = await openHost(browser);
    // On rejoint PAR LE FORMULAIRE — le chemin qui éjectait. Le helper tape le
    // code, exactement comme un joueur qui le lit sur le stream.
    const j = await joinAsPlayer(browser, hote.code, 'Recharge');
    joueurs.push(j);
    await expect(hote.page.getByTestId('player-count')).toContainText('1');

    const etapes = [];
    const verifier = async (ou) => {
      await j.page.reload();
      await j.page.waitForTimeout(1200);
      const e = await identite(j.page);
      etapes.push(`${ou} → formulaire=${e.surFormulaire} url=${e.url}`);
      expect(e.surFormulaire, `éjecté au rechargement en « ${ou} »`).toBe(false);
      // DÉCISION 1.1 — le code doit être dans l'URL, quel que soit le chemin d'entrée.
      expect(e.url, `pas de code de salon dans l'URL en « ${ou} »`).toContain('code=');
    };

    await verifier('salle d\'attente');

    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem').first().click();
    await expect(j.page.getByTestId('answer-option').first()).toBeVisible({ timeout: 10_000 });
    await verifier('question posée');

    await j.page.getByTestId('answer-option').first().click();
    await verifier('question répondue');

    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();
    // On s'ancre sur l'écran de résultat lui-même, pas sur la phrase de voix : après
    // un rechargement en cours de manche, la phrase dépend d'un résultat qui peut
    // arriver une image plus tard. Un contrôle qui attend le mauvais élément échoue
    // pour de mauvaises raisons.
    await expect(j.page.locator('#verdict')).toBeVisible({ timeout: 10_000 });
    await verifier('résultat révélé');

    await hote.page.getByRole('button', { name: 'Question suivante' }).click();
    await hote.page.getByRole('menuitem').first().click({ timeout: 1500 }).catch(() => {});
    await j.page.waitForTimeout(600);
    await verifier('entre deux manches');

    for (const e of etapes) console.log(`  ${e}`);
  });

  test('le podium revient après un rechargement', async ({ browser }) => {
    // L'ÉTAPE QUI N'ÉTAIT REJOUÉE NULLE PART (décision 3.3). Le bloc de
    // reconnexion du serveur vivait tout entier dans un `if (cur)` : une partie
    // terminée n'ayant plus de manche en cours, un joueur qui rechargeait ne
    // recevait ni podium, ni classement, ni rang.
    hote = await openHost(browser);
    const j = await joinAsPlayer(browser, hote.code, 'Podium');
    joueurs.push(j);
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem').first().click();
    await j.page.getByTestId('answer-option').first().click();
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();
    await hote.page.getByRole('button', { name: 'Menu' }).click();
    await hote.page.getByRole('menuitem', { name: 'Terminer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: 'Confirmer — terminer la partie' }).click();
    await expect(j.page.getByTestId('end-screen')).toBeVisible({ timeout: 10_000 });

    await j.page.reload();
    await expect(j.page.getByTestId('end-screen'),
      'aucun écran final après rechargement sur le podium').toBeVisible({ timeout: 10_000 });

    // ON NE SE CONTENTE PAS DE L'ÉCRAN. Il s'affiche sur le seul état du salon
    // (`room.state === 'ended'`), même vide — c'est exactement le piège nommé par
    // la décision 1.6 : « le contrôle vérifie l'identité, le score et la place,
    // jamais la seule présence d'un écran ». Éprouvé : en retirant le rejeu de
    // l'état de fin côté serveur, l'écran apparaissait toujours et ce contrôle
    // passait au vert. C'est le CONTENU qui prouve le rejeu.
    const classement = j.page.getByTestId('classement-final');
    await expect(classement,
      'écran de fin VIDE après rechargement : le serveur n\'a rien rejoué').toBeVisible({ timeout: 10_000 });
    await expect(classement.locator('.board__row--me'),
      'le joueur ne se retrouve pas dans le classement après rechargement').toHaveCount(1);
    // DÉCISION 3.4 — le quatrième cas, le seul qui manquait : RECONNECTÉ APRÈS LA
    // FIN. C'est précisément celui de la réunion — « un bouton présent chez
    // certains et absent chez d'autres » : il disparaissait chez qui avait
    // rechargé, et chez lui seul.
    await expect(j.page.locator('[data-action="share"]'),
      'pas de bouton de partage après un rechargement sur le podium').toHaveCount(1);
    const e = await identite(j.page);
    console.log(`  après F5 sur le podium → formulaire=${e.surFormulaire} url=${e.url}`);
    expect(e.surFormulaire).toBe(false);
  });

  test('après un rechargement, le joueur reçoit bien son résultat de manche', async ({ browser }) => {
    // RAPPORTÉ EN JEU : « lorsque le joueur actualise sa page, puis qu'il répond à
    // une question et que la réponse est révélée par l'animateur, il a une page qui
    // dit "Ta réponse est bien partie" au lieu d'avoir la page de résultat avec ses
    // points. »
    //
    // CET ÉCRAN A UNE RAISON D'ÊTRE — il couvre l'instant où la réponse est partie
    // mais où la manche n'est pas révélée. Ce qui n'a pas lieu d'être, c'est qu'il
    // reste affiché APRÈS la révélation : cela veut dire que le résultat personnel
    // n'est jamais arrivé.
    //
    // POURQUOI LES CONTRÔLES DE RECHARGEMENT NE LE VOYAIENT PAS. Ils rechargeaient
    // à chaque étape et vérifiaient qu'on n'était pas éjecté. Aucun ne RÉPONDAIT
    // après le rechargement pour se faire ensuite révéler la manche : la séquence
    // exacte du défaut n'était jouée nulle part.
    hote = await openHost(browser);
    const j = await joinAsPlayer(browser, hote.code, 'Actualise');
    joueurs.push(j);
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem').first().click();
    await expect(j.page.getByTestId('answer-option').first()).toBeVisible({ timeout: 10_000 });

    // LE RECHARGEMENT, puis la réponse — dans cet ordre, c'est tout l'objet.
    await j.page.reload();
    await expect(j.page.getByTestId('answer-option').first()).toBeVisible({ timeout: 10_000 });
    await j.page.getByTestId('answer-option').first().click();
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();

    // L'animateur, lui, voit bien la réponse arriver : le joueur a participé.
    await expect(hote.page.getByTestId('answers-count'),
      'la réponse du joueur rechargé n\'est pas parvenue au serveur').toHaveText('1');

    // CE QUE LE JOUEUR DOIT VOIR : son relevé de points, pas un accusé de réception.
    const verdict = j.page.locator('#verdict');
    await expect(verdict).toBeVisible({ timeout: 10_000 });
    const dit = (await verdict.textContent())?.trim().replace(/\s+/g, ' ') || '';
    const gain = await j.page.locator('.gain__value').count();
    console.log(`  après rechargement + révélation, le joueur lit « ${dit} » · relevé de points : ${gain}`);
    expect(dit, 'le joueur reste sur l\'accusé de réception après la révélation')
      .not.toMatch(/bien partie/i);
    expect(gain, 'aucun relevé de points sur l\'écran de résultat').toBe(1);
  });

  test('le verdict de la manche survit à un rechargement APRÈS avoir répondu', async ({ browser }) => {
    // MESURÉ, PAS SUPPOSÉ. Le joueur répond, lit « Raté » ou « Bien joué », puis
    // recharge : son verdict devenait « Manche close » — le mot neutre réservé aux
    // manches dont on ne sait rien.
    //
    // LA CAUSE, ET UNE DÉCISION QUI SE RETOURNE. L'écran déduit le verdict en
    // comparant LE CHOIX DU JOUEUR à la bonne réponse. Ce choix ne vivait qu'en
    // mémoire de page. La décision 1.4 du chantier v4 avait tranché « le choix non
    // révélé n'est pas restauré — pas grave » : l'arbitrage supposait qu'il n'y
    // allait que d'une case non recochée. Il en allait aussi du verdict.
    hote = await openHost(browser);
    const j = await joinAsPlayer(browser, hote.code, 'Verdict');
    joueurs.push(j);
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem').first().click();
    await expect(j.page.getByTestId('answer-option').first()).toBeVisible({ timeout: 10_000 });
    await j.page.getByTestId('answer-option').first().click();
    await j.page.waitForTimeout(600);
    const avant = (await j.page.locator('#verdict').textContent())?.trim().replace(/\s+/g, ' ') || '';

    await j.page.reload();
    await j.page.waitForTimeout(1800);
    const apres = (await j.page.locator('#verdict').textContent())?.trim().replace(/\s+/g, ' ') || '';
    console.log(`  verdict avant : « ${avant} » · après rechargement : « ${apres} »`);

    // La prémisse d'abord : sans un verdict tranché avant, il n'y a rien à perdre.
    expect(['Bien joué', 'Raté'],
      `verdict initial inattendu (« ${avant} ») : le contrôle ne mesurerait rien`).toContain(avant);
    expect(apres, 'le verdict a été perdu au rechargement').toBe(avant);
  });

  test('l\'adieu d\'une liaison morte n\'emporte pas la liaison neuve', async ({ browser }) => {
    // LA COURSE, JOUÉE EXPRÈS. Sur un rechargement réel — un téléphone qui change
    // de réseau, un onglet qui revient de veille — le navigateur ouvre souvent la
    // nouvelle liaison AVANT que l'ancienne n'ait fini de mourir. L'adieu de
    // l'ancienne arrivait alors après le rattachement de la neuve et effaçait la
    // liaison du joueur. Son résultat de manche, envoyé à cette liaison, n'était
    // plus envoyé nulle part : il restait sur « ta réponse est bien partie », même
    // après la révélation.
    //
    // Playwright recharge trop proprement pour produire ce chevauchement. On le
    // FABRIQUE : deux pages sur la même session — donc deux liaisons pour le même
    // joueur — puis on ferme la première, dans cet ordre.
    hote = await openHost(browser);
    const j = await joinAsPlayer(browser, hote.code, 'Chevauche');
    joueurs.push(j);
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem').first().click();
    await expect(j.page.getByTestId('answer-option').first()).toBeVisible({ timeout: 10_000 });

    // La seconde liaison s'ouvre pendant que la première vit encore.
    const seconde = await j.ctx.newPage();
    await seconde.goto(`/play?code=${hote.code}`);
    await expect(seconde.getByTestId('answer-option').first()).toBeVisible({ timeout: 10_000 });
    // PUIS la première meurt — l'ordre est tout l'objet du contrôle.
    await j.page.close();
    await seconde.waitForTimeout(800);

    await seconde.getByTestId('answer-option').first().click();
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();

    const verdict = seconde.locator('#verdict');
    await expect(verdict).toBeVisible({ timeout: 10_000 });
    const dit = (await verdict.textContent())?.trim().replace(/\s+/g, ' ') || '';
    const gains = await seconde.locator('.gain__value').count();
    console.log(`  après l'adieu de l'ancienne liaison, le joueur lit « ${dit} » · relevé : ${gains}`);
    expect(dit, 'le joueur reste sur l\'accusé de réception : son résultat n\'est allé nulle part')
      .not.toMatch(/bien partie/i);
    expect(gains, 'aucun relevé de points').toBe(1);
    await seconde.close();
  });

  test('l\'animateur et le stream survivent aussi au rechargement', async ({ browser }) => {
    // DÉCISION 1.7 — le joueur était la seule surface fautive, mais on ne le
    // conclut pas d'une lecture : on l'éprouve.
    hote = await openHost(browser);
    const j = await joinAsPlayer(browser, hote.code, 'Temoin');
    joueurs.push(j);
    const stream = await hote.ctx.newPage();
    const token = await hote.page.evaluate(() => JSON.parse(localStorage.getItem('host')).overlayToken);
    await stream.goto(`/overlay?token=${token}`);
    await expect(stream.getByTestId('stream-room-code')).toHaveText(hote.code);

    await hote.page.reload();
    await expect(hote.page.getByTestId('player-count'), 'l\'animateur a perdu son salon').toContainText('1', { timeout: 10_000 });

    await stream.reload();
    await expect(stream.getByTestId('stream-room-code'), 'le stream a perdu son salon').toHaveText(hote.code, { timeout: 10_000 });
    await stream.close();
  });
});

// ---------------------------------------------------------------------------
// Ces contrôles jouent une partie de deux manches à deux joueurs, après avoir
// fabriqué leur question : le plafond commun de 45 s est trop court.
test.describe('L\'écran de fin', () => {
  test.setTimeout(90_000);

  let hote = null;
  const joueurs = [];

  test.afterEach(async () => {
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    for (const j of joueurs.splice(0)) await j.ctx.close();
  });

  // UNE PARTIE DONT ON CONNAÎT LE RÉSULTAT D'AVANCE.
  //
  // La version précédente lançait la première épreuve venue et cliquait la
  // PREMIÈRE option. Une fois sur quatre, elle tombait juste : la partie n'était
  // alors plus « sans point marqué », et le contrôle de la décision 2.6 sautait sa
  // seule assertion — `if (!aMarque)` — pour finir vert sans rien avoir vérifié.
  // Un contrôle qui ne s'exécute qu'une fois sur quatre ne protège rien.
  //
  // On fabrique donc la question, on connaît sa bonne réponse, et les deux joueurs
  // choisissent délibérément une MAUVAISE : la partie finit à zéro partout, à
  // coup sûr.
  const JEU_ZERO = 'Épreuve à zéro';
  const BONNE = 'Braise-Juste';
  const FAUSSE = 'Cendre-Fausse';
  // Le jeu fabriqué est retiré à la FIN du fichier, et non après chaque contrôle :
  // il est créé une seule fois et sert aux quatre. La bibliothèque est partagée,
  // et dix contrôles lancent « le premier module de la liste » — le lui laisser
  // reviendrait à changer ce qu'ils lancent.
  test.afterAll(async () => { await retirerJeux(JEU_ZERO); });
  // Le module est fabriqué UNE fois pour les quatre contrôles : il vit côté
  // serveur, et le recréer à chaque test ajoutait une minute de Studio pour rien.
  let jeuPret = false;

  async function questionSansBonneReponse(browser) {
    if (jeuPret) return;
    jeuPret = true;
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/studio');
    await page.getByLabel('Gestion des modules')
      .getByRole('button', { name: 'Nouveau module' }).click();
    const editeur = page.getByRole('complementary');
    await expect(editeur).toBeVisible();
    await editeur.getByLabel('Nom').fill(JEU_ZERO);
    // DEUX QUESTIONS, pas une. L'arrivant tardif rejoint APRÈS la première manche
    // et doit pouvoir jouer la seconde : un module d'une seule question laisse
    // l'écran vide et le contrôle échoue sur le décor, pas sur son objet.
    for (const [i, enonce] of ['Quelle braise personne ne choisira ?',
      'Et quelle braise personne ne choisira non plus ?'].entries()) {
      await editeur.getByRole('button', { name: 'Ajouter une question' }).click();
      // LE FORMULAIRE, PAS LA LIGNE. Les libellés des champs se répètent d'une
      // question à l'autre : il faut s'y cantonner. Et `.qrow--open` ne convient
      // pas — c'est l'en-tête pliable ; les champs vivent dans `.qform`, son
      // FRÈRE. Cantonné à la ligne, `fill` attendait un champ qui n'y était pas,
      // jusqu'à l'expiration du test.
      const carte = editeur.locator('.qform');
      await expect(carte, `question ${i + 1} non dépliée`).toHaveCount(1);
      await carte.getByPlaceholder('Rédige la question').fill(enonce);
      await carte.getByLabel('Option 1', { exact: true }).fill(BONNE);
      await carte.getByLabel('Option 2', { exact: true }).fill(FAUSSE);
      await carte.getByLabel('Option 3', { exact: true }).fill('Fumée-3333');
      await carte.getByLabel('Option 4', { exact: true }).fill('Suie-4444');
      await carte.getByRole('radio', { name: 'Option 1 est la bonne réponse' }).click();
    }
    await editeur.getByRole('button', { name: /^Enregistrer$/ }).click();
    await expect(editeur.locator('[data-bind="module.validation"]')).toHaveCount(0);
    await ctx.close();
  }

  async function partieAvecArrivantTardif(browser) {
    await questionSansBonneReponse(browser);
    hote = await openHost(browser);
    const tot = await joinAsPlayer(browser, hote.code, 'Premier');
    joueurs.push(tot);
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: `Lancer ${JEU_ZERO}` }).first().click();
    await tot.page.getByRole('button', { name: FAUSSE }).click();
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();
    await hote.page.waitForTimeout(400);

    // L'ARRIVANT TARDIF — celui qui a demandé à se voir au classement.
    const tard = await joinAsPlayer(browser, hote.code, 'Tardif');
    joueurs.push(tard);
    await hote.page.getByRole('button', { name: 'Question suivante' }).click();
    await hote.page.getByRole('menuitem').first().click({ timeout: 1500 }).catch(() => {});
    await expect(tard.page.getByTestId('answer-option').first()).toBeVisible({ timeout: 10_000 });
    // Les deux questions partagent leurs libellés d'options : la mauvaise réponse
    // porte le même nom à la seconde manche.
    await tot.page.getByRole('button', { name: FAUSSE }).click();
    await tard.page.getByRole('button', { name: FAUSSE }).click();
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();
    await hote.page.waitForTimeout(400);

    await hote.page.getByRole('button', { name: 'Menu' }).click();
    await hote.page.getByRole('menuitem', { name: 'Terminer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: 'Confirmer — terminer la partie' }).click();
    await expect(tard.page.getByTestId('end-screen')).toBeVisible({ timeout: 10_000 });
    return { tot, tard };
  }

  test('l\'arrivant tardif se voit au classement, même sans point', async ({ browser }) => {
    // DÉCISIONS 2.1, 2.3 et 2.5. Avant, l'écran n'affichait qu'un chiffre — « Ton
    // rang final : 2ᵉ » — et la liste, alimentée par le PODIUM (trois premiers),
    // disparaissait entièrement dès que ces trois-là étaient à zéro.
    const { tard } = await partieAvecArrivantTardif(browser);

    const classement = tard.page.getByTestId('classement-final');
    await expect(classement, 'aucun classement sur l\'écran de fin').toBeVisible();

    const lignes = classement.locator('.board__row');
    const n = await lignes.count();
    const moi = classement.locator('.board__row--me');
    console.log(`  ${n} ligne(s) au classement, ligne du joueur distinguée : ${await moi.count()}`);
    expect(n, 'le classement ne montre pas les deux joueurs').toBeGreaterThanOrEqual(2);
    await expect(moi, 'le joueur ne se voit pas dans le classement').toHaveCount(1);
  });

  test('une partie sans point marqué garde son classement et ne crie pas victoire', async ({ browser }) => {
    // DÉCISIONS 2.3 et 2.4. Sans malus depuis T1, une partie où chacun se trompe
    // finit à zéro partout : le classement disparaissait, et le titre annonçait
    // « VICTOIRE » trois lignes au-dessus de « personne n'a marqué ».
    const { tard } = await partieAvecArrivantTardif(browser);
    const texte = (await tard.page.getByTestId('end-screen').innerText()).replace(/\s+/g, ' ');
    console.log(`  écran de fin : "${texte.slice(0, 150)}"`);

    await expect(tard.page.getByTestId('classement-final')).toBeVisible();
    // LA PRÉMISSE, VÉRIFIÉE AVANT L'ASSERTION. Sans elle, une partie où quelqu'un
    // aurait marqué rendrait le reste du contrôle sans objet — et c'est ce qui
    // arrivait, une fois sur quatre, en silence.
    const scores = await tard.page.getByTestId('classement-final')
      .locator('.board__score').allInnerTexts();
    console.log(`  scores au classement : ${scores.join(' · ')}`);
    expect(scores.every((v) => /^0\s*(pts?)?$/i.test(v.trim())),
      `la partie n'est pas à zéro partout (${scores.join(', ')}) : le contrôle ne mesurerait rien`).toBe(true);
    // Le titre ne peut pas annoncer une victoire si personne n'a marqué.
    expect(texte, 'victoire annoncée sans point marqué').not.toMatch(/Victoire/i);
  });

  test('le bouton de partage est là pour chacun, même à zéro point', async ({ browser }) => {
    // DÉCISION 3.1 et 3.4. Le bouton était adossé au classement : il disparaissait
    // chez certains joueurs et pas chez d'autres — « un bouton présent chez
    // certains et absent chez d'autres », rapporté en réunion.
    const { tot, tard } = await partieAvecArrivantTardif(browser);
    for (const [nom, j] of [['Premier', tot], ['Tardif', tard]]) {
      await expect(j.page.locator('[data-action="share"]'),
        `pas de bouton de partage pour ${nom}`).toHaveCount(1);
    }
  });

  test('aucune phrase ne se répète sur l\'écran de fin', async ({ browser }) => {
    // DÉCISION 10.1. Deux rédactions du même message se suivaient : « Reste
    // connecté — si l'animateur relance… » et « Reste là : si l'animateur
    // relance… ». Ce qui se répétait était le SENS, pas la chaîne : comparer des
    // littéraux n'aurait rien vu.
    const { tard } = await partieAvecArrivantTardif(browser);
    const phrases = await tard.page.getByTestId('end-screen').evaluate((n) => {
      const vus = [];
      for (const p of n.querySelectorAll('p')) {
        const t = (p.textContent || '').replace(/\s+/g, ' ').trim();
        if (t.length > 25) vus.push(t);
      }
      return vus;
    });
    // Deux phrases qui partagent quatre mots significatifs de suite disent la
    // même chose, quelles que soient leurs tournures.
    const cle = (p) => p.toLowerCase().replace(/[^a-zàâçéèêëîïôûùüÿñæœ ]/g, '')
      .split(' ').filter((m) => m.length > 3).slice(0, 4).join(' ');
    const doublons = [];
    for (let i = 0; i < phrases.length; i += 1) {
      for (let k = i + 1; k < phrases.length; k += 1) {
        if (cle(phrases[i]) && cle(phrases[i]) === cle(phrases[k])) {
          doublons.push(`« ${phrases[i]} » ≈ « ${phrases[k]} »`);
        }
      }
    }
    console.log(`  ${phrases.length} phrase(s) sur l'écran de fin, ${doublons.length} redite(s)`);
    expect(doublons, `redite(s) :\n${doublons.join('\n')}`).toEqual([]);
  });
});
