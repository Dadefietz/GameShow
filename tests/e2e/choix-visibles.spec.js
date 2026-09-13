// E2E — TOUS LES CHOIX TIENNENT DANS L'ÉCRAN DU STREAM.
//
// CE QUI A ÉTÉ DEMANDÉ, deux fois. Le 11/09 : « Si j'ai 9 choix à la question,
// alors je dois voir les 9 choix à l'écran. » Puis le 12/09, sur le vote : « à
// plus de 5 choix, on ne voit pas les autres propositions sur l'écran de stream.
// Il faut que tous les choix soient visibles, comme dans le dévoilement des
// réponses (réduire la police). »
//
// POURQUOI CE CONTRÔLE N'EXISTAIT PAS, ET C'EST LA FAUTE À RECONNAÎTRE. Au
// chantier v6, un calcul a été écrit pour faire suivre la taille des rangées au
// nombre de choix — et la demande a été déclarée satisfaite SUR LE CALCUL. Un
// calcul juste n'est pas un écran juste : entre les deux il y a une feuille de
// style, une hauteur de scène, un énoncé qui prend deux lignes au lieu d'une, et
// une consigne de tour qui n'était pas comptée. L'auteur a rouvert la demande
// parce que le pixel, lui, n'avait pas été regardé.
//
// CE QUE CE CONTRÔLE MESURE, DONC : la boîte de CHAQUE rangée, comparée à la
// boîte de la scène. Pas le nombre d'éléments dans le DOM — neuf `div` peuvent
// exister et trois dépasser du cadre, c'est exactement le défaut rapporté.
//
// ATTENTION EN LISANT LES CHIFFRES : la scène du stream est un canevas fixe de
// 1920 × 1080 RAMENÉ À L'ÉCHELLE de la fenêtre. Les boîtes relevées ici sont donc
// en pixels d'écran. On ne compare que des boîtes entre elles, jamais un nombre
// à une constante — le facteur d'échelle se simplifie.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer, lancerJeu, creerJeu, retirerJeux } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.setTimeout(120_000);

// DES PROPOSITIONS DE LA LONGUEUR DE CELLES QU'ON POSE VRAIMENT. Neuf mots de
// code tiennent partout et ne prouvent rien : c'est une phrase qui révèle si la
// police a été réduite comme il faut, parce qu'elle se replie sur deux lignes dès
// que la rangée est trop basse pour elle.
const NEUF = [
  'Partir en randonnée dans les Pyrénées',
  'Passer le week-end à la maison',
  'Retrouver toute la bande au restaurant',
  'Aller voir le dernier film au cinéma',
  'Cuisiner quelque chose de compliqué',
  'Dormir jusqu\'à quatorze heures',
  'Descendre la rivière en canoë',
  'Monter un meuble en kit sans la notice',
  'Regarder la pluie tomber par la fenêtre',
];

test.describe('Les choix tiennent dans la scène', () => {
  let hote = null;
  let stream = null;
  const joueurs = [];

  test.afterEach(async () => {
    if (stream) { await stream.close().catch(() => {}); stream = null; }
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    for (const j of joueurs.splice(0)) await j.ctx.close();
    await retirerJeux('Neuf choix');
  });

  async function ouvrir(browser, nom) {
    hote = await openHost(browser);
    joueurs.push(await joinAsPlayer(browser, hote.code, 'Spectateur'));
    stream = await hote.ctx.newPage();
    // LE GABARIT DU STREAM EST FIXE — 1920 × 1080, la toile d'OBS. Une fenêtre
    // plus petite ramènerait la scène à l'échelle et la mesure porterait sur une
    // réduction, pas sur ce que le public verra.
    await stream.setViewportSize({ width: 1920, height: 1080 });
    const token = await hote.page.evaluate(() => JSON.parse(localStorage.getItem('host')).overlayToken);
    await stream.goto(`/overlay?token=${token}`);
    await expect(stream.getByTestId('stream-room-code')).toHaveText(hote.code);
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await lancerJeu(hote.page, nom);
  }

  // La mesure, une fois pour les deux jeux : chaque rangée est-elle ENTIÈREMENT
  // dans la scène, et les rangées se chevauchent-elles ?
  async function mesurer(page) {
    return page.evaluate(() => {
      const scene = document.querySelector('.stream__stage');
      const rangees = [...document.querySelectorAll('.st-opt')];
      const s = scene.getBoundingClientRect();
      // LE BLOC DES CHOIX NE DOIT PAS DÉBORDER DE SA PART. C'est la mesure qui a
      // désigné la cause : place disponible 509 px, bloc occupant 656 — un enfant
      // de boîte flexible qui grandit au lieu de se comprimer.
      const bloc = document.querySelector('.st-options, .st-stats');
      const pad = parseFloat(getComputedStyle(scene).paddingBottom) || 0;
      return {
        bloc: { part: scene.clientHeight - bloc.offsetTop - pad, occupe: bloc.offsetHeight },
        scene: { haut: s.top, bas: s.bottom, hauteur: s.height },
        rangees: rangees.map((el) => {
          const r = el.getBoundingClientRect();
          return {
            texte: el.querySelector('.st-opt__label')?.textContent || '',
            haut: r.top, bas: r.bottom, hauteur: r.height, gauche: Math.round(r.left),
            police: parseFloat(getComputedStyle(el.querySelector('.st-opt__label')).fontSize),
            // LE TEXTE TIENT-IL DANS SA RANGÉE ? Une rangée comprimée par la
            // disposition garde la police qu'on lui a calculée : si ce calcul
            // partait d'une hauteur imaginaire, la phrase se replie et se fait
            // COUPER par le `overflow: hidden` de la rangée. Neuf rangées
            // seraient alors « visibles » et trois phrases amputées.
            rogne: el.scrollHeight - el.clientHeight,
            // QUI DÉBORDE. Sans ce nom, le contrôle accuse « la proposition est
            // coupée » alors que c'est le rond décoratif qui mord sur sa ligne —
            // et on cherche le défaut du mauvais côté. C'est arrivé.
            coupable: (() => {
              const dedans = el.clientHeight - parseFloat(getComputedStyle(el).paddingTop) * 2;
              const trop = [...el.children].filter((c) => c.getBoundingClientRect().height > dedans + 1);
              return trop.map((c) => `${c.className.split(' ')[0]}(${Math.round(c.getBoundingClientRect().height)}px)`).join(' ');
            })(),
          };
        }),
      };
    });
  }

  function verifier(m, attendu) {
    expect(m.rangees.length, `${attendu} rangées attendues, ${m.rangees.length} rendues`).toBe(attendu);

    // LA CAUSE, ET PAS SEULEMENT LE SYMPTÔME. Le bloc doit tenir dans la part que
    // la scène lui laisse. Sans cette ligne, un correctif qui rétrécirait les
    // rangées sans corriger le bloc passerait — jusqu'au premier énoncé sur trois
    // lignes, à l'antenne.
    expect(m.bloc.occupe,
      `le bloc occupe ${m.bloc.occupe}px pour ${m.bloc.part}px de place`).toBeLessThanOrEqual(m.bloc.part + 1);
    const dehors = m.rangees.filter((r) => r.bas > m.scene.bas + 1 || r.haut < m.scene.haut - 1);
    expect(dehors.map((r) => r.texte),
      `ces choix débordent de la scène (scène ${Math.round(m.scene.haut)}→${Math.round(m.scene.bas)}) : `
      + dehors.map((r) => `${r.texte} ${Math.round(r.haut)}→${Math.round(r.bas)}`).join(', ')).toEqual([]);

    // AUCUNE RANGÉE N'EN RECOUVRE UNE AUTRE. Une liste qui déborde se replie
    // parfois en superposant ses éléments plutôt qu'en sortant du cadre : neuf
    // rangées seraient alors « dans la scène » et illisibles quand même.
    //
    // PAR COLONNE, et non sur l'ensemble. Le dévoilement d'un vote pose DEUX
    // colonnes côte à côte ; deux rangées à la même hauteur y sont des VOISINES,
    // pas une superposition. Comparer l'ensemble ferait crier le contrôle sur une
    // disposition parfaitement saine — un faux rouge qui use la confiance aussi
    // sûrement qu'un faux vert.
    const colonnes = new Map();
    for (const r of m.rangees) {
      if (!colonnes.has(r.gauche)) colonnes.set(r.gauche, []);
      colonnes.get(r.gauche).push(r);
    }
    for (const [x, rangees] of colonnes) {
      const triees = [...rangees].sort((a, b) => a.haut - b.haut);
      for (let i = 1; i < triees.length; i += 1) {
        expect(triees[i].haut,
          `colonne x=${x} : « ${triees[i].texte} » recouvre « ${triees[i - 1].texte} »`)
          .toBeGreaterThanOrEqual(triees[i - 1].bas - 1);
      }
    }

    const coupees = m.rangees.filter((r) => r.rogne > 1);
    expect(coupees.map((r) => r.texte),
      'du contenu déborde de sa rangée : '
      + coupees.map((r) => `« ${r.texte} » de ${r.rogne}px${r.coupable ? ` — ${r.coupable}` : ''}`).join(', ')).toEqual([]);

    // ET ELLES RESTENT LISIBLES. Tout faire tenir en réduisant sans limite serait
    // une autre façon de perdre la demande.
    for (const r of m.rangees) {
      expect(r.police, `« ${r.texte} » est écrit en ${r.police} px`).toBeGreaterThanOrEqual(18);
    }
  }

  test('VOTE — neuf propositions, neuf rangées visibles', async ({ browser }) => {
    await creerJeu({
      name: 'Neuf choix vote',
      type: 'vote',
      questions: [{ text: 'Quelle équipe mérite de gagner cette saison ?', options: NEUF }],
    });
    await ouvrir(browser, 'Neuf choix vote');
    await expect(stream.locator('.st-opt').first()).toBeVisible({ timeout: 15_000 });
    const m = await mesurer(stream);
    console.log(`  vote → scène ${Math.round(m.scene.hauteur)}px, rangées de `
      + `${Math.round(Math.min(...m.rangees.map((r) => r.hauteur)))}px, police ${m.rangees[0].police}px`);
    verifier(m, 9);
  });

  test('QUIZ — neuf réponses, neuf rangées visibles', async ({ browser }) => {
    await creerJeu({
      name: 'Neuf choix quiz',
      type: 'quiz',
      questions: [{ text: 'Laquelle de ces neuf propositions est la bonne ?', options: NEUF, correctIndex: 4 }],
    });
    await ouvrir(browser, 'Neuf choix quiz');
    await expect(stream.locator('.st-opt').first()).toBeVisible({ timeout: 15_000 });
    const m = await mesurer(stream);
    console.log(`  quiz → scène ${Math.round(m.scene.hauteur)}px, rangées de `
      + `${Math.round(Math.min(...m.rangees.map((r) => r.hauteur)))}px, police ${m.rangees[0].police}px`);
    verifier(m, 9);
  });

  // AU DÉVOILEMENT AUSSI. L'auteur cite le dévoilement comme le bon exemple ;
  // c'est pourtant le moment où le calcul reçoit un nombre de choix DIFFÉRENT —
  // la question publique n'est plus là — et pourrait retomber sur ses tailles
  // par défaut, faites pour quatre rangées.
  test('VOTE — au dévoilement, les neuf rangées tiennent encore', async ({ browser }) => {
    await creerJeu({
      name: 'Neuf choix révélé',
      type: 'vote',
      questions: [{ text: 'Quelle équipe mérite de gagner cette saison ?', options: NEUF }],
    });
    await ouvrir(browser, 'Neuf choix révélé');
    await joueurs[0].page.getByRole('button', { name: NEUF[3] }).click();
    await hote.page.getByRole('button', { name: /Révéler/ }).first().click();
    await expect(stream.getByTestId('stats-panel')).toBeVisible({ timeout: 15_000 });
    const m = await mesurer(stream);
    console.log(`  révélé → scène ${Math.round(m.scene.hauteur)}px, rangées de `
      + `${Math.round(Math.min(...m.rangees.map((r) => r.hauteur)))}px, police ${m.rangees[0].police}px`);
    // DIX-HUIT RANGÉES, ET C'EST NORMAL : un vote se joue en DEUX TOURS — ce que
    // le cercle pense, puis ce qu'il croyait penser — et le dévoilement montre les
    // deux côte à côte. C'est donc le cas le plus serré de tout le stream, et
    // celui où la mesure devait être vérifiée en premier.
    verifier(m, 18);
  });
});
