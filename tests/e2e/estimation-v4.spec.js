// E2E — L'ESTIMATION DU CHANTIER v4 (actions 5, 6 et 7).
//
// Trois griefs de la réunion, un seul module :
//   - « on ne sait pas qui était le plus proche » → le nom, pour l'animateur
//     seul (action 6) ;
//   - l'histogramme de la console montrait HUIT BARRES DE 2 PIXELS quand celui du
//     stream, alimenté par les mêmes chiffres, en dessinait de 93 (action 7) ;
//   - une année à trente-six ans de la cible tombait « dans le mille » (action 5,
//     contrôlée au barème dans tests/unit/bareme-v4.test.js).
//
// CE QUE CE FICHIER AJOUTE À CES CONTRÔLES-LÀ. Deux choses qu'aucun test unitaire
// ne peut voir :
//   1. LA FRONTIÈRE DE CONFIDENTIALITÉ. Que le serveur calcule un nom pour
//      l'animateur ne dit rien de ce qui part ailleurs. On écoute donc les
//      TRAMES RÉELLEMENT REÇUES par la page de stream et par une page de joueur.
//      Lire le code du serveur ne prouve rien sur ce qui circule.
//
//      CE QUE LA FRONTIÈRE N'EST PAS. Le stream appartient au canal `:staff` : il
//      reçoit le classement complet, pseudos compris, et c'est sa raison d'être —
//      il l'affiche. Une première version de ce contrôle cherchait le pseudo dans
//      TOUT le flux du stream et accusait donc le classement, qui n'y est pour
//      rien. Ce qui doit rester privé, c'est la DÉSIGNATION du plus proche :
//      l'événement `host:closest`, réservé au canal `:host`, et l'absence de tout
//      pseudo dans la révélation publique — celle que les joueurs reçoivent aussi.
//   2. LA HAUTEUR DESSINÉE. `height: 96px` contre `min-height: 96px` se lisent
//      pareil et ne dessinent pas pareil : dans une grille dont la piste vaut
//      « auto », la seconde s'écrase à la hauteur du contenu — zéro — et le
//      plancher de 2 px devient la hauteur de TOUTES les barres. On mesure donc
//      les pixels rendus, sur les deux écrans, et l'on vérifie qu'ils sont
//      proportionnels à des effectifs CONNUS D'AVANCE.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer } from './helpers.js';
import { terminerPartie } from './cloture.js';
import { MOMENTS } from '../../src/client/shared/voix.js';

test.setTimeout(90_000);

test.describe('L\'estimation du chantier v4', () => {
  let hote = null;
  const joueurs = [];

  test.afterEach(async () => {
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    for (const j of joueurs.splice(0)) await j.ctx.close();
  });

  async function lancerEstimation(browser, pseudos) {
    hote = await openHost(browser);
    for (const p of pseudos) joueurs.push(await joinAsPlayer(browser, hote.code, p));
    await expect(hote.page.getByTestId('player-count')).toHaveText(String(pseudos.length));
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: 'Lancer Estimation' }).click();
    await expect(joueurs[0].page.getByTestId('question-text')).toBeVisible({ timeout: 15_000 });
  }

  async function repondre(joueur, valeur) {
    await joueur.page.getByLabel('Ta réponse').fill(String(valeur));
    await joueur.page.getByTestId('answer-submit').click();
  }

  test('le nom du plus proche va à l\'animateur, et à personne d\'autre', async ({ browser }) => {
    // Des pseudos SANS RAPPORT avec le vocabulaire du jeu : « Proche » se
    // retrouverait dans « plusProches » et ferait crier le contrôle sur le nom
    // d'un champ.
    const [PROCHE, MOYEN, LOIN] = ['Zephyrin', 'Balthazar', 'Corentin'];
    await lancerEstimation(browser, [PROCHE, MOYEN, LOIN]);

    // On écoute DEUX destinataires : le stream, et un joueur. Le premier est du
    // staff, le second ne l'est pas — la frontière ne se lit qu'en comparant les
    // deux flux.
    const trames = [];
    const tramesJoueur = [];
    const stream = await hote.ctx.newPage();
    stream.on('websocket', (ws) => {
      ws.on('framereceived', (f) => { if (typeof f.payload === 'string') trames.push(f.payload); });
    });
    joueurs[1].page.on('websocket', (ws) => {
      ws.on('framereceived', (f) => { if (typeof f.payload === 'string') tramesJoueur.push(f.payload); });
    });
    const token = await hote.page.evaluate(() => JSON.parse(localStorage.getItem('host')).overlayToken);
    await stream.goto(`/overlay?token=${token}`);
    // La liaison du joueur était DÉJÀ ouverte quand on s'est mis à l'écoute : on
    // n'aurait rien capté. Un rechargement en ouvre une neuve, et l'on voit tout
    // depuis la première trame. (Que le joueur survive à ce rechargement est
    // l'objet de l'action 1 — ici c'est un moyen, pas ce qu'on mesure.)
    await joueurs[1].page.reload();
    await expect(joueurs[1].page.getByTestId('question-text')).toBeVisible({ timeout: 15_000 });

    // Les valeurs sont ÉCARTÉES les unes des autres, mais on ne présume pas
    // laquelle est la plus proche : la question tirée du module change d'une
    // exécution à l'autre, et sa cible avec elle. Une première version de ce
    // contrôle attendait « 98 » en dur et accusait le produit sur une question
    // dont la cible valait plusieurs centaines.
    const VALEURS = [98, 300, 900];
    const PSEUDOS = [PROCHE, MOYEN, LOIN];
    for (const [i, j] of joueurs.entries()) await repondre(j, VALEURS[i]);
    await expect(hote.page.getByTestId('answers-count')).toHaveText('3');

    // DÉCISION 6.2 — À LA RÉVÉLATION, pas avant : l'animateur ne doit pas savoir
    // qui gagne pendant que les autres répondent encore.
    await expect(hote.page.getByTestId('plus-proches')).toHaveCount(0);
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();

    const panneau = hote.page.getByTestId('plus-proches');
    await expect(panneau, 'l\'animateur ne voit toujours pas qui était le plus proche')
      .toBeVisible({ timeout: 15_000 });

    // ---- LA FRONTIÈRE. On laisse au réseau le temps de tout livrer, puis on
    // fouille ce que le stream et le joueur ont reçu.
    await stream.waitForTimeout(1500);
    const recu = trames.join('\n');
    const recuJoueur = tramesJoueur.join('\n');
    expect(trames.length, 'aucune trame reçue : le contrôle ne mesurerait rien').toBeGreaterThan(0);
    expect(tramesJoueur.length, 'aucune trame joueur : le contrôle ne mesurerait rien').toBeGreaterThan(0);

    // 1. LA DÉSIGNATION reste sur le canal `:host`. Ni le stream ni le joueur ne
    //    la reçoivent, sous aucune forme.
    for (const [qui, flux] of [['le stream', recu], ['le joueur', recuJoueur]]) {
      expect(flux, `l'événement privé a été diffusé à ${qui}`).not.toContain('host:closest');
      expect(flux, `la liste des plus proches a été diffusée à ${qui}`).not.toContain('plusProches');
    }

    // 2. LA RÉVÉLATION PUBLIQUE ne porte AUCUN pseudo. C'est la trame que les
    //    joueurs reçoivent aussi : elle donne la valeur la plus proche
    //    (`closest`), jamais qui l'a écrite.
    const revelations = trames.filter((t) => t.includes('module:reveal'));
    expect(revelations.length, 'aucune révélation reçue par le stream').toBeGreaterThan(0);
    const revelation = revelations.join('\n');
    for (const pseudo of PSEUDOS) {
      expect(revelation, `« ${pseudo} » figure dans la révélation publique`).not.toContain(pseudo);
    }

    // 3. LE MÊME PLUS PROCHE DES DEUX CÔTÉS (décision 6.1). La valeur publique et
    //    le nom privé sortent d'un calcul unique : on relève la valeur dans la
    //    révélation, on en déduit qui l'a écrite, et l'on vérifie que le panneau
    //    de l'animateur nomme CELUI-LÀ. Deux définitions du « plus proche »
    //    finiraient par diverger — c'est cette divergence qu'on interdit.
    const closest = Number(/"closest":(-?[\d.]+)/.exec(revelation)?.[1]);
    const rang = VALEURS.indexOf(closest);
    expect(rang, `valeur la plus proche « ${closest} » étrangère aux réponses envoyées`)
      .toBeGreaterThanOrEqual(0);
    await expect(panneau, 'le panneau ne nomme pas le joueur le plus proche')
      .toContainText(PSEUDOS[rang]);
    // DÉCISION 6.5 — le nom vient AVEC sa valeur : un pseudo seul ne dit pas de
    // combien il s'en approchait.
    await expect(panneau).toContainText(String(closest));

    // 4. LE CONTRE-CONTRÔLE. Le classement, lui, PORTE les pseudos et part bien
    //    au stream : sans cette vérification, un serveur qui n'émettrait plus
    //    rien du tout passerait tout ce qui précède.
    expect(recu, 'le stream ne reçoit plus le classement — le contrôle mesurerait le vide')
      .toContain(`"pseudo":"${PROCHE}"`);
    // Et le joueur, lui, ne le reçoit jamais : le classement est réservé au staff.
    expect(recuJoueur, 'le classement a fuité vers les joueurs').not.toContain('leaderboard:update');
    console.log(`  plus proche : ${PSEUDOS[rang]} avec ${closest} · stream ${trames.length} trames · joueur ${tramesJoueur.length}`);
  });

  test('les barres de l\'histogramme sont proportionnelles, sur les deux écrans', async ({ browser, page }) => {
    // UNE QUESTION À CIBLE CONNUE, créée pour ce contrôle.
    //
    // POURQUOI ON NE PREND PAS LA QUESTION LIVRÉE D'OFFICE. Les tranches de
    // l'histogramme sont calculées sur l'étendue des réponses ET DE LA CIBLE. Les
    // questions d'estimation du module de base ont des cibles très diverses — 27,
    // 6, plusieurs milliers. Sur une cible d'un million, les quatre réponses
    // 100/101/102/900 tombent toutes dans la PREMIÈRE tranche et il n'y a plus
    // qu'une barre à mesurer.
    //
    // Le contrôle passait donc ou échouait selon la question tirée, c'est-à-dire
    // selon les tests exécutés avant lui — vert seul, rouge dans la suite
    // complète. Un contrôle intermittent ne dit plus rien de ce qu'il mesure.
    const JEU = 'Épreuve d\'histogramme';
    const CIBLE = 100;
    await page.goto('/studio');
    await page.getByLabel('Gestion des modules')
      .getByRole('button', { name: 'Nouveau module' }).click();
    const editeur = page.getByRole('complementary');
    await expect(editeur).toBeVisible();
    await editeur.getByLabel('Nom').fill(JEU);
    await editeur.getByRole('radiogroup', { name: 'Type' }).getByRole('radio', { name: 'Estimation' }).click();
    await editeur.getByRole('button', { name: 'Ajouter une question' }).click();
    await editeur.getByPlaceholder('Rédige la question').fill('Combien de braises dans le foyer ?');
    await editeur.getByLabel('Cible').fill(String(CIBLE));
    await editeur.getByRole('button', { name: /^Enregistrer$/ }).click();
    await expect(editeur.locator('[data-bind="module.validation"]')).toHaveCount(0);

    // QUATRE joueurs, et des valeurs choisies pour que TROIS tombent dans la même
    // tranche et le quatrième dans une autre. Des effectifs égaux dessineraient
    // des barres égales — et un histogramme entièrement écrasé passerait.
    hote = await openHost(browser);
    for (const p of ['A', 'B', 'C', 'D']) joueurs.push(await joinAsPlayer(browser, hote.code, p));
    await expect(hote.page.getByTestId('player-count')).toHaveText('4');
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    // `.first()` : sur une seconde tentative, le module créé au premier passage
    // existe encore et le menu en propose deux du même nom. Ce n'est pas ce que
    // ce contrôle mesure.
    await hote.page.getByRole('menuitem', { name: `Lancer ${JEU}` }).first().click();
    await expect(joueurs[0].page.getByTestId('question-text')).toBeVisible({ timeout: 15_000 });

    const stream = await hote.ctx.newPage();
    const token = await hote.page.evaluate(() => JSON.parse(localStorage.getItem('host')).overlayToken);
    await stream.goto(`/overlay?token=${token}`);

    // TROIS RÉPONSES IDENTIQUES, une très à l'écart. Trois valeurs simplement
    // VOISINES ne suffisaient pas : les bornes de l'histogramme écartent les
    // valeurs extrêmes par l'écart interquartile, si bien que 100, 101 et 102 se
    // retrouvaient dans trois tranches distinctes d'une échelle resserrée sur
    // deux unités. Des valeurs égales tombent forcément ensemble, quelle que soit
    // l'échelle — et le rapport d'effectifs vaut alors exactement 3 contre 1.
    await repondre(joueurs[0], CIBLE);
    await repondre(joueurs[1], CIBLE);
    await repondre(joueurs[2], CIBLE);
    await repondre(joueurs[3], CIBLE * 9);
    await expect(hote.page.getByTestId('answers-count')).toHaveText('4');

    // Ce qu'on relève : la hauteur DESSINÉE de chaque barre, et l'effectif que le
    // serveur lui attribue. C'est leur rapport qui est en cause, pas l'un ou
    // l'autre pris seul.
    async function barres(page, testid, classe) {
      return page.getByTestId(testid).locator(classe).evaluateAll(
        (els) => els.map((e) => ({ n: Number(e.dataset.count || 0), h: e.getBoundingClientRect().height })),
      );
    }

    const console_ = await barres(hote.page, 'histogramme', '.histo__bar');
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();
    await expect(stream.getByTestId('stream-histogramme')).toBeVisible({ timeout: 15_000 });
    await stream.waitForTimeout(700); // l'animation de montée des barres
    const direct = await barres(stream, 'stream-histogramme', '.st-histo__bar');

    for (const [nom, barres_] of [['console', console_], ['stream', direct]]) {
      const pleines = barres_.filter((b) => b.n > 0).sort((a, b) => b.n - a.n);
      console.log(`  ${nom} → ${barres_.map((b) => `${b.n}:${Math.round(b.h)}px`).join(' ')}`);
      expect(pleines.length, `${nom} : effectifs inattendus`).toBe(2);
      const [haute, basse] = pleines;
      expect(haute.n, `${nom} : la tranche groupée devrait compter 3`).toBe(3);
      // LE CONTRÔLE QUI ÉCHOUAIT SUR LE DÉFAUT. Toutes les barres de la console
      // mesuraient 2 px : la plus haute n'était pas plus haute que la plus basse.
      expect(haute.h, `${nom} : la barre de 3 estimations mesure ${haute.h} px — l'histogramme est écrasé`)
        .toBeGreaterThan(20);
      // Proportionnalité : trois fois plus d'estimations, environ trois fois plus
      // haut. On tolère largement — les bordures arrondies et le plancher de
      // 2-3 px déplacent la mesure de quelques pixels.
      const rapport = haute.h / basse.h;
      expect(rapport, `${nom} : rapport de hauteurs ${rapport.toFixed(2)} pour un rapport d'effectifs de 3`)
        .toBeGreaterThan(2);
      expect(rapport, `${nom} : rapport de hauteurs ${rapport.toFixed(2)} pour un rapport d'effectifs de 3`)
        .toBeLessThan(4);
    }
  });

  test('rien sur l\'écran ne dément le gain affiché', async ({ browser, page }) => {
    // TROUVÉ PAR LE BALAYAGE DE CLÔTURE (décision 2.8), pas par la réunion.
    //
    // Un joueur HORS de toute plage mais le plus proche touche 400 points
    // (décision 5.3). Son écran disait alors, sous un « +400 » :
    // « Complètement à côté — ET ÇA NE COÛTE RIEN. » Le moment de voix
    // `estimation.hors` déclare en toutes lettres « zéro point » : le bonus du
    // plus proche avait rendu FAUSSE la condition d'un moment existant.
    //
    // Le titre, lui, était déjà juste — il s'adosse aux points marqués et non au
    // drapeau du serveur. Ce contrôle vérifie les deux, parce que le balayage de
    // la décision 2.8 porte sur l'écran entier et non sur le seul titre.
    const JEU = 'Épreuve de verdict';
    const CIBLE = 100;
    await page.goto('/studio');
    await page.getByLabel('Gestion des modules')
      .getByRole('button', { name: 'Nouveau module' }).click();
    const editeur = page.getByRole('complementary');
    await expect(editeur).toBeVisible();
    await editeur.getByLabel('Nom').fill(JEU);
    await editeur.getByRole('radiogroup', { name: 'Type' }).getByRole('radio', { name: 'Estimation' }).click();
    await editeur.getByRole('button', { name: 'Ajouter une question' }).click();
    await editeur.getByPlaceholder('Rédige la question').fill('Combien de bûches dans le tas ?');
    await editeur.getByLabel('Cible').fill(String(CIBLE));
    await editeur.getByRole('button', { name: /^Enregistrer$/ }).click();
    await expect(editeur.locator('[data-bind="module.validation"]')).toHaveCount(0);

    hote = await openHost(browser);
    for (const p of ['Proche', 'Loin']) joueurs.push(await joinAsPlayer(browser, hote.code, p));
    await expect(hote.page.getByTestId('player-count')).toHaveText('2');
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: `Lancer ${JEU}` }).first().click();
    await expect(joueurs[0].page.getByTestId('question-text')).toBeVisible({ timeout: 15_000 });

    // Les deux sont HORS de toute plage — 400 % et 800 % d'écart. Seul le premier
    // est le plus proche.
    await repondre(joueurs[0], CIBLE * 5);
    await repondre(joueurs[1], CIBLE * 9);
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();

    const titre = (j) => j.page.locator('#verdict');
    const gain = (j) => j.page.locator('.gain__value');
    const voix = (j) => j.page.getByTestId('voix-resultat');
    await expect(titre(joueurs[0])).toBeVisible({ timeout: 15_000 });
    await joueurs[0].page.waitForTimeout(1200); // l'animation du score

    const marque = (await gain(joueurs[0]).textContent())?.trim() || '';
    const dit = (await titre(joueurs[0]).textContent())?.trim() || '';
    console.log(`  le plus proche lit « ${dit} » au-dessus de « ${marque} »`);
    expect(marque, 'le plus proche devrait toucher le bonus — sans quoi il n\'y a rien à contredire')
      .toMatch(/^\+/);
    expect(dit, `« ${dit} » coiffe un gain de ${marque}`).not.toContain('Raté');

    // LA VOIX, sur le même écran, au-dessus du même chiffre.
    const phrase = (await voix(joueurs[0]).textContent())?.trim() || '';
    console.log(`  et la voix dit « ${phrase} »`);
    // ON COMPARE AU REGISTRE, PAS À UNE TOURNURE. Une première version cherchait
    // « ne coûte rien » et « à côté » : trois des cinq phrases du moment « hors »
    // ne contiennent ni l'un ni l'autre, et le contrôle passait au vert avec la
    // correction DÉSACTIVÉE. Il mesurait le hasard du tirage.
    expect(MOMENTS['estimation.hors'].phrases,
      `« ${phrase} » appartient au moment « hors », qui annonce zéro point`).not.toContain(phrase);
    expect(MOMENTS['estimation.plus-proche'].phrases,
      `« ${phrase} » n'est pas une phrase du plus proche`).toContain(phrase);

    // LE REVERS. Celui qui n'a rien marqué doit, lui, lire « Raté » : un titre
    // adouci pour tout le monde passerait le contrôle précédent et ne dirait plus
    // rien à personne.
    await expect(titre(joueurs[1])).toBeVisible({ timeout: 15_000 });
    const ditLoin = (await titre(joueurs[1]).textContent())?.trim() || '';
    const marqueLoin = (await gain(joueurs[1]).textContent())?.trim() || '';
    console.log(`  le plus loin lit « ${ditLoin} » au-dessus de « ${marqueLoin} »`);
    expect(marqueLoin).toBe('0');
    expect(ditLoin, 'le joueur à zéro doit lire un verdict franc').toBe('Raté');
    // LE REVERS DE LA VOIX. Celui qui n'a rien marqué garde les phrases du hors —
    // sans quoi on aurait déplacé la contradiction au lieu de la corriger.
    const phraseLoin = (await voix(joueurs[1]).textContent())?.trim() || '';
    console.log(`  et la voix lui dit « ${phraseLoin} »`);
    expect(MOMENTS['estimation.hors'].phrases,
      `« ${phraseLoin} » n'appartient pas au moment « hors »`).toContain(phraseLoin);
  });

  test('la poignée de noms se déplie sur un « + »', async ({ browser, page }) => {
    // DÉCISION 6.4. Aucun contrôle ne l'exerçait : elle avait été portée « tenue »
    // sur la seule lecture du code, ce qui ne vaut rien pour une commande qu'on
    // clique. Sur une question en années, dix joueurs peuvent tomber juste — c'est
    // le cas que l'auteur avait en tête : « une poignée de nom plus un petit + ».
    const JEU = 'Épreuve de poignée';
    const CIBLE = 100;
    await page.goto('/studio');
    await page.getByLabel('Gestion des modules')
      .getByRole('button', { name: 'Nouveau module' }).click();
    const editeur = page.getByRole('complementary');
    await expect(editeur).toBeVisible();
    await editeur.getByLabel('Nom').fill(JEU);
    await editeur.getByRole('radiogroup', { name: 'Type' }).getByRole('radio', { name: 'Estimation' }).click();
    await editeur.getByRole('button', { name: 'Ajouter une question' }).click();
    await editeur.getByPlaceholder('Rédige la question').fill('Combien de braises exactement ?');
    await editeur.getByLabel('Cible').fill(String(CIBLE));
    await editeur.getByRole('button', { name: /^Enregistrer$/ }).click();
    await expect(editeur.locator('[data-bind="module.validation"]')).toHaveCount(0);

    // QUATRE joueurs à la MÊME valeur : tous ex æquo au plus proche (décision 5.4),
    // donc quatre noms pour trois places.
    const PSEUDOS = ['Une', 'Deux', 'Trois', 'Quatre'];
    hote = await openHost(browser);
    for (const p of PSEUDOS) joueurs.push(await joinAsPlayer(browser, hote.code, p));
    await expect(hote.page.getByTestId('player-count')).toHaveText('4');
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: `Lancer ${JEU}` }).first().click();
    await expect(joueurs[0].page.getByTestId('question-text')).toBeVisible({ timeout: 15_000 });
    for (const j of joueurs) await repondre(j, CIBLE * 4);
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();

    const panneau = hote.page.getByTestId('plus-proches');
    await expect(panneau).toBeVisible({ timeout: 15_000 });
    // Replié : trois noms, et le quatrième annoncé sans être montré.
    await expect(panneau.locator('.proches__row'),
      'la liste devrait être repliée à trois noms').toHaveCount(3);
    const plus = panneau.getByRole('button', { name: /\+ 1 autre/ });
    await expect(plus, 'aucun « + » pour déplier le quatrième nom').toBeVisible();

    await plus.click();
    await expect(panneau.locator('.proches__row'),
      'le « + » n\'a pas déplié la liste').toHaveCount(4);
    const noms = await panneau.locator('.proches__name').allInnerTexts();
    console.log(`  déplié : ${noms.join(' · ')}`);
    expect(noms.sort()).toEqual([...PSEUDOS].sort());
  });
});
