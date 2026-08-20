// E2E — LA PASTILLE DU STREAM (chantier v2, actions 1 et 2).
//
// POURQUOI CE FICHIER EXISTE ALORS QU'UN CONTRÔLE DE DISPOSITION EXISTAIT DÉJÀ.
// `stream-disposition.spec.js` affirmait vérifier que « la scène ne dessine
// jamais sous la pastille ». Il est passé au vert pendant tout le chantier v1, et
// le défaut était là : la pastille amputait trois options de réponse, recouvrait
// le compteur de joueurs, et s'effondrait en colonne verticale au podium.
//
// Deux raisons à cet aveuglement, et ce fichier corrige les deux.
//
// 1. IL NE REGARDAIT QU'UN ÉCRAN, ET QU'UNE POIGNÉE D'ÉLÉMENTS. Un `for` sur
//    trois sélecteurs de l'écran de question. Ni la salle d'attente, ni le salon
//    ouvert, ni le podium. Ici : les quatre écrans, et TOUT ce qui est dessiné.
//
// 2. IL TOURNAIT SUR UNE ADRESSE DE 19 CARACTÈRES. En test, l'origine est
//    `localhost:8788` ; en production, `project-game-show.onrender.com` — 35
//    caractères, presque le double. L'adresse courte se repliait sur deux lignes
//    et tenait dans la zone réservée ; la vraie s'en repliait quatre et la
//    crevait. C'est le domaine court des maquettes qui avait déjà masqué le même
//    défaut au chantier v1 (commit c92e7d7). Décision 2.7 : les contrôles de
//    l'adresse s'exécutent avec l'ADRESSE RÉELLE, jamais avec celle du bac à
//    sable.
//
// Et l'on mesure un RÉSULTAT — des boîtes, des lignes rendues — jamais la
// présence d'une propriété CSS (décision 2.6). Une propriété disparaît avec la
// classe qui la porte : c'est précisément ainsi que la correction du commit
// 2712880 s'est évaporée quand `.join-panel__url` a été supprimée.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer } from './helpers.js';
import { terminerPartie } from './cloture.js';

// L'adresse de production, en dur et assumée : c'est elle qui doit tenir, pas
// celle du serveur de test.
const ADRESSE_REELLE = 'project-game-show.onrender.com/play';

// Tout ce que la scène dessine. Les blocs, pas leurs éléments internes : si un
// bloc ne recouvre pas la pastille, son contenu non plus.
const BLOCS_DESSINES = [
  '.st-title', '.st-count', '.st-options', '.st-opt', '.st-band', '.st-caps',
  '.st-facts', '.st-histo', '.st-lead', '.st-podium', '.st-progress',
  '.st-rank', '.st-stats', '.st-answer', '.st-voix',
].join(', ');

test.describe('La pastille du stream', () => {
  let hote = null;
  const joueurs = [];
  let stream = null;

  test.afterEach(async () => {
    if (stream) { await stream.close().catch(() => {}); stream = null; }
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    for (const j of joueurs.splice(0)) await j.ctx.close();
  });

  async function ouvrirStream(browser, pseudos = []) {
    hote = await openHost(browser);
    for (const p of pseudos) joueurs.push(await joinAsPlayer(browser, hote.code, p));
    stream = await hote.ctx.newPage();
    const token = await hote.page.evaluate(() => JSON.parse(localStorage.getItem('host')).overlayToken);
    await stream.goto(`/overlay?token=${token}`);
    await expect(stream.getByTestId('stream-room-code')).toHaveText(hote.code);
  }

  // Aire d'intersection entre la pastille et chaque bloc dessiné. On rend les
  // fautes avec leur surface : « ça se recouvre » n'aide personne, « le bloc des
  // options empiète de 41 000 px² » se corrige.
  async function recouvrements(ecran) {
    const p = await stream.locator('.rejoindre').boundingBox();
    expect(p, `pastille absente sur l'écran « ${ecran} »`).not.toBeNull();
    const fautes = [];
    for (const el of await stream.locator(BLOCS_DESSINES).all()) {
      if (!(await el.isVisible().catch(() => false))) continue;
      const b = await el.boundingBox();
      if (!b) continue;
      const l = Math.max(0, Math.min(b.x + b.width, p.x + p.width) - Math.max(b.x, p.x));
      const h = Math.max(0, Math.min(b.y + b.height, p.y + p.height) - Math.max(b.y, p.y));
      // Un pixel de tolérance : les arrondis de sous-pixel ne sont pas des fautes.
      if (l * h > 1) {
        const nom = await el.evaluate((n) => n.className);
        fautes.push(`${ecran} → ${nom} empiète de ${Math.round(l * h)} px²`);
      }
    }
    return fautes;
  }

  test('aucun bloc de scène ne recouvre la pastille — les quatre écrans', async ({ browser }) => {
    // Trois joueurs : le podium se vérifie avec un CLASSEMENT PLEIN (décision
    // 1.7). Avec un seul nom, la colonne du classement est presque vide et ne
    // descend jamais assez bas pour rencontrer la pastille — la capture qui a
    // servi au diagnostic avait précisément ce défaut.
    await ouvrirStream(browser, []);
    const fautes = [];

    // 1. SALON OUVERT — aucun joueur encore.
    await expect(stream.getByTestId('stream-qr')).toBeVisible();
    fautes.push(...await recouvrements('salon ouvert'));

    // 2. SALLE D'ATTENTE — au moins un joueur, la carte du compteur apparaît.
    for (const p of ['Un', 'Deux', 'Trois']) joueurs.push(await joinAsPlayer(browser, hote.code, p));
    await expect(stream.locator('.st-count')).toBeVisible();
    fautes.push(...await recouvrements('salle d\'attente'));

    // 3. QUESTION — l'écran le plus haut : énoncé plus quatre options.
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem').first().click();
    await expect(stream.getByTestId('stream-question')).toBeVisible();
    fautes.push(...await recouvrements('question'));

    // 3 bis. RÉVÉLATION — les barres de répartition s'ajoutent sous les options.
    for (const j of joueurs) await j.page.getByTestId('answer-option').first().click();
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();
    await expect(stream.locator('.st-opt').first()).toBeVisible();
    fautes.push(...await recouvrements('révélation'));

    // 4. PODIUM — la plaque change de forme : plus de QR, une ligne large.
    await hote.page.getByRole('button', { name: 'Voir le classement' }).click();
    await hote.page.getByRole('button', { name: 'Menu' }).click();
    await hote.page.getByRole('menuitem', { name: 'Terminer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: 'Confirmer — terminer la partie' }).click();
    await expect(stream.getByTestId('stream-podium')).toBeVisible();
    fautes.push(...await recouvrements('podium'));

    expect(fautes, `recouvrement(s) :\n${fautes.join('\n')}`).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// L'ADRESSE, éprouvée sur la vraie chaîne de production (décision 2.7).
//
// On substitue le texte plutôt que de simuler un domaine : l'origine d'une page
// ne se falsifie pas. Le garde-fou est en fin de mesure — si React avait
// re-rendu entre-temps, l'assertion de texte échoue et le contrôle est invalidé
// au lieu de passer pour de mauvaises raisons.
test.describe('L\'adresse dans la pastille', () => {
  let hote = null;
  let stream = null;
  const joueurs = [];

  test.afterEach(async () => {
    if (stream) { await stream.close().catch(() => {}); stream = null; }
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    for (const j of joueurs.splice(0)) await j.ctx.close();
  });

  async function ouvrir(browser) {
    hote = await openHost(browser);
    stream = await hote.ctx.newPage();
    const token = await hote.page.evaluate(() => JSON.parse(localStorage.getItem('host')).overlayToken);
    await stream.goto(`/overlay?token=${token}`);
    await expect(stream.getByTestId('stream-room-code')).toHaveText(hote.code);
  }

  // Les lignes RÉELLEMENT rendues, reconstruites caractère par caractère depuis
  // leur position à l'écran. C'est la seule façon de savoir où le navigateur a
  // coupé — le texte source, lui, ne contient aucun retour à la ligne.
  async function lignesRendues(page, adresse) {
    await page.locator('.rejoindre__lien').evaluate((el, a) => { el.textContent = a; }, adresse);
    const lignes = await page.locator('.rejoindre__lien').evaluate((el) => {
      const t = el.firstChild;
      const r = document.createRange();
      const out = [];
      let haut = null;
      for (let i = 0; i < t.data.length; i++) {
        r.setStart(t, i); r.setEnd(t, i + 1);
        const rect = r.getClientRects()[0];
        if (!rect) continue;
        if (haut === null || Math.abs(rect.top - haut) > 1) { out.push(''); haut = rect.top; }
        out[out.length - 1] += t.data[i];
      }
      return out;
    });
    await expect(page.locator('.rejoindre__lien')).toHaveText(adresse);
    return lignes;
  }

  test('ne se coupe jamais au milieu d\'un mot', async ({ browser }) => {
    await ouvrir(browser);
    const lignes = await lignesRendues(stream, ADRESSE_REELLE);
    console.log(`  adresse réelle rendue en ${lignes.length} ligne(s) : ${lignes.join(' | ')}`);

    // Une coupure légitime tombe SUR un séparateur — et le navigateur coupe
    // aussi bien APRÈS un tiret qu'AVANT une barre oblique. Ne regarder que la
    // fin de ligne ferait échouer ce contrôle sur « show.onrender.com | /play »,
    // qui est pourtant une coupure parfaitement propre. Un contrôle qui échoue
    // sur du bon comportement ne vaut pas mieux que pas de contrôle.
    // « show.onre | nder.com » était le vrai symptôme : `overflow-wrap: anywhere`
    // autorise la coupure entre deux caractères quelconques.
    const fautes = [];
    for (let i = 0; i < lignes.length - 1; i++) {
      const fin = lignes[i].slice(-1);
      const debutSuivante = lignes[i + 1].slice(0, 1);
      const propre = '-./ '.includes(fin) || '/'.includes(debutSuivante);
      if (!propre) fautes.push(`« ${lignes[i]} » → « ${lignes[i + 1]} » : coupure entre « ${fin} » et « ${debutSuivante} »`);
    }
    expect(fautes, `coupure(s) au milieu d'un mot :\n${fautes.join('\n')}`).toEqual([]);
  });

  test('tient sur trois lignes au maximum', async ({ browser }) => {
    await ouvrir(browser);
    const lignes = await lignesRendues(stream, ADRESSE_REELLE);

    // ÉCART ASSUMÉ À LA DÉCISION 2.3, qui disait « deux lignes au maximum ».
    // Elle a été écrite sur une arithmétique fausse : diviser la largeur totale
    // de l'adresse par deux, comme si l'on pouvait couper n'importe où. Or les
    // points de coupure sont DISCRETS. Une fois `anywhere` remplacé par
    // `break-word` — ce qui est justement la correction demandée — le segment
    // « show.onrender.com/play » devient insécable : 450 px à lui seul. Deux
    // lignes exigeraient une plaque de 482 px, PLUS LARGE que les 460 px du
    // panneau permanent que le chantier v1 a retiré.
    //
    // Trois lignes tiennent dans 380 px. Quatre — l'état d'avant — faisaient
    // crever à la pastille sa zone réservée d'une centaine de pixels. C'est cette
    // borne-là qui compte, et c'est elle qu'on tient.
    expect(lignes.length, `rendu sur ${lignes.length} lignes : ${lignes.join(' | ')}`).toBeLessThanOrEqual(3);
  });

  test('au podium : une seule ligne, et le code n\'est pas perché en haut', async ({ browser }) => {
    await ouvrir(browser);
    // Il faut une manche jouée : sans elle le podium reste vide et l'écran ne
    // s'affiche jamais. Terminer une partie qui n'a pas commencé ne produit rien.
    const j = await joinAsPlayer(browser, hote.code, 'Un');
    joueurs.push(j);
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem').first().click();
    await j.page.getByTestId('answer-option').first().click();
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();
    await hote.page.getByRole('button', { name: 'Voir le classement' }).click();
    await hote.page.getByRole('button', { name: 'Menu' }).click();
    await hote.page.getByRole('menuitem', { name: 'Terminer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: 'Confirmer — terminer la partie' }).click();
    await expect(stream.getByTestId('stream-podium')).toBeVisible();

    const lignes = await lignesRendues(stream, ADRESSE_REELLE);
    expect(lignes.length, `la plaque du podium doit tenir sur une ligne, rendu : ${lignes.join(' | ')}`).toBe(1);

    // DÉCISION 2.4 — le code se posait à côté du PREMIER fragment d'une adresse
    // effondrée en colonne : « pr · 2Z78R ». Il doit être à la même hauteur que
    // l'adresse entière, pas perché sur son sommet.
    const lien = await stream.locator('.rejoindre--mince .rejoindre__lien').boundingBox();
    const code = await stream.locator('.rejoindre--mince .rejoindre__code').boundingBox();
    const centre = (b) => b.y + b.height / 2;
    expect(Math.abs(centre(code) - centre(lien))).toBeLessThan(6);
    // Et le code est bien À DROITE de l'adresse, pas au-dessus.
    expect(code.x).toBeGreaterThan(lien.x + lien.width - 2);
  });
});
