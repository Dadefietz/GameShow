// E2E — DISPOSITION DU STREAM (actions 3, 4 et 5 du PLAN-CHANTIER-v1).
//
// Ce qui a changé, et pourquoi.
//
// AVANT : un panneau latéral de 460 px sur toute la hauteur, PERMANENT quelle que
// soit la phase. Il portait un QR de 260 px, un code, une adresse et un bloc de
// marque — soit un quart de la largeur en permanence pour une information qui
// tient dans une pastille. C'est la réserve exprimée en test : le QR nuisait au
// dynamisme de la partie.
//
// APRÈS : une pastille en bas à gauche pendant l'accueil et la partie, la scène
// sur toute la largeur, et au podium la place libérée accueille le classement
// COMPLET — un joueur classé quinzième n'existait nulle part jusqu'ici.
//
// Le QR reste à 180 px et pas moins : c'est une taille FONCTIONNELLE, un téléphone
// lisant un QR jusqu'à environ dix fois son côté. Plus petit, il devient
// décoratif — et personne ne signale qu'il n'arrive pas à scanner, les gens
// abandonnent en silence.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer, lancerJeu } from './helpers.js';
import { terminerPartie } from './cloture.js';
import { segmentsAdresse } from '../../src/client/shared/adresse.js';

test.describe('Disposition du stream', () => {
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

  test('la pastille est en bas à gauche et ne recouvre pas la scène', async ({ browser }) => {
    await ouvrirStream(browser, ['Un']);

    const pastille = await stream.locator('.rejoindre').boundingBox();
    const scene = await stream.locator('.stream').boundingBox();

    // Ancrée en BAS À GAUCHE : le seul coin calme dans les deux phases, le geste
    // lumineux passant du haut (question) au bas-centre (attente).
    expect(pastille.x - scene.x).toBeLessThan(scene.width * 0.25);
    expect((scene.y + scene.height) - (pastille.y + pastille.height)).toBeLessThan(scene.height * 0.2);

    // Emprise DIVISÉE : l'ancien panneau faisait 460 px de large SUR TOUTE LA
    // HAUTEUR — un quart de la scène en permanence. C'est l'emprise, pas la
    // largeur seule, qui était le grief.
    //
    // Le plafond est passé de 300 à 400 px au chantier v2. Ce n'est pas un
    // relâchement : mesuré dans le vrai navigateur avec la vraie adresse
    // d'hébergement (35 caractères, 716 px sur une ligne à 34 px de mono), tenir
    // l'adresse en deux lignes exige 390 px de plaque. L'alternative était de
    // descendre d'un cran de typo — l'adresse tombait alors à 9,4 px sur un
    // téléphone en paysage, sous le plancher de 10 px garanti plus bas dans ce
    // fichier. On a préféré une plaque plus large à une adresse illisible.
    //
    // La HAUTEUR reste le vrai garde-fou : 380 px au lieu de 1080.
    const echelle = scene.width / 1920;
    expect(pastille.width / echelle).toBeLessThanOrEqual(400);
    expect(pastille.height / echelle).toBeLessThan(scene.height / echelle * 0.55);

    // La scène ne dessine JAMAIS sous la pastille : contrainte de mise en page,
    // pas espoir de non-recouvrement.
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await lancerJeu(hote.page);
    await expect(stream.getByTestId('stream-question')).toBeVisible();

    // On mesure ce qui est DESSINÉ, pas le conteneur : la scène est un bloc en
    // hauteur pleine, son cadre descend forcément jusqu'en bas. C'est l'énoncé et
    // les options qui ne doivent pas passer sous la pastille.
    const dessine = await stream.locator('.stream__stage :is(.st-question, .st-opts, .st-band)').all();
    expect(dessine.length).toBeGreaterThan(0);
    for (const el of dessine) {
      const b = await el.boundingBox();
      if (!b) continue;
      expect(b.y + b.height).toBeLessThanOrEqual(pastille.y + 1);
    }
  });

  for (const jeu of ['Le lien', 'Les visages']) {
    test(`l'écran d'annonce de « ${jeu} » laisse la pastille tranquille`, async ({ browser }) => {
      // CE QUI A ÉTÉ RAPPORTÉ : « déplacer la phrase d'explication du jeu sur
      // l'écran de stream vers la droite pour qu'elle ne soit pas superposée au
      // QR code. »
      //
      // CE QUE C'ÉTAIT. Le bloc d'annonce est aligné à gauche, la pastille est
      // ancrée en bas à gauche : sur « Les visages », la phrase de règle passait
      // DERRIÈRE la plaque et se lisait coupée en deux. Sur « Le lien », elle
      // s'arrêtait cinq pixels au-dessus — pas une marge, un hasard : un emblème
      // un peu plus haut ou une phrase un peu plus longue l'y faisait entrer.
      //
      // POURQUOI CE CONTRÔLE MESURE UN RECOUVREMENT DE BOÎTES et non une marge
      // gauche : c'est le défaut réel. Une règle de CSS peut changer, la
      // pastille peut grossir ; ce qui ne doit jamais arriver, c'est que deux
      // choses se superposent devant le public.
      await ouvrirStream(browser, ['Annonce']);
      await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
      await lancerJeu(hote.page, jeu);
      await expect(stream.getByTestId('stream-annonce')).toBeVisible({ timeout: 15_000 });

      const m = await stream.evaluate(() => {
        const boite = (s) => {
          const e = document.querySelector(s);
          if (!e) return null;
          const r = e.getBoundingClientRect();
          return { g: Math.round(r.left), d: Math.round(r.right), h: Math.round(r.top), b: Math.round(r.bottom) };
        };
        const past = boite('.rejoindre');
        const morceaux = {};
        for (const [nom, sel] of [['phrase', '.st-lead'], ['titre', '.st-title'], ['kicker', '.st-kicker'], ['emblème', '.st-annonce__emblem']]) {
          const r = boite(sel);
          if (!r) continue;
          morceaux[nom] = {
            recouvre: !!(past && r.g < past.d && r.d > past.g && r.h < past.b && r.b > past.h),
            marge: past ? r.g - past.d : null,
          };
        }
        return { pastille: past, morceaux };
      });

      expect(m.pastille, 'la pastille a disparu de l\'annonce').not.toBeNull();
      for (const [nom, r] of Object.entries(m.morceaux)) {
        console.log(`  ${jeu} · ${nom} → ${r.recouvre ? 'RECOUVRE' : 'dégagé'} (${r.marge} px de la pastille)`);
        expect(r.recouvre, `« ${nom} » passe derrière la pastille sur l'annonce de ${jeu}`).toBe(false);
      }
    });
  }

  test('le QR garde une taille scannable', async ({ browser }) => {
    await ouvrirStream(browser, []);
    const scene = await stream.locator('.stream').boundingBox();
    const qr = await stream.getByTestId('stream-qr').boundingBox();
    const echelle = scene.width / 1920;

    // Plancher assumé : en dessous d'environ 160 px sur le canevas, le QR n'est
    // plus lisible à distance d'écran et ne sert plus à rien.
    expect(qr.width / echelle).toBeGreaterThanOrEqual(160);
    // Et il reste carré : un QR déformé ne se scanne pas.
    expect(Math.abs(qr.width - qr.height)).toBeLessThan(2);
  });

  test('au podium : plus de QR, le classement complet défile', async ({ browser }) => {
    await ouvrirStream(browser, ['Un', 'Deux', 'Trois']);

    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await lancerJeu(hote.page);
    for (const j of joueurs) await j.page.getByTestId('answer-option').first().click();
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();
    await hote.page.getByRole('button', { name: 'Voir le classement' }).click();
    await hote.page.getByRole('button', { name: 'Menu' }).click();
    await hote.page.getByRole('menuitem', { name: 'Terminer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: 'Confirmer — terminer la partie' }).click();

    await expect(stream.getByTestId('stream-podium')).toBeVisible();
    // Le QR laisse la place ; le code reste, pour une relance dans les cinq
    // minutes où le salon demeure ouvert.
    await expect(stream.getByTestId('stream-qr')).toHaveCount(0);
    await expect(stream.getByTestId('stream-room-code')).toHaveText(hote.code);

    // LE CLASSEMENT COMPLET : c'est là qu'un joueur hors podium existe enfin.
    const classement = stream.getByTestId('stream-leaderboard');
    await expect(classement).toBeVisible();
    const lignes = classement.locator('.st-rank__row');
    await expect(lignes.first()).toBeVisible();
    // Il part du PREMIER, pas du quatrième : c'est un classement complet.
    await expect(lignes.first().locator('.st-rank__pos')).toHaveText('1');
  });

  test('la pastille revient au retour au salon, pour une seconde partie', async ({ browser }) => {
    await ouvrirStream(browser, ['Un']);

    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await lancerJeu(hote.page);
    await joueurs[0].page.getByTestId('answer-option').first().click();
    await hote.page.getByRole('button', { name: 'Révéler maintenant' }).click();
    await hote.page.getByRole('button', { name: 'Voir le classement' }).click();
    await hote.page.getByRole('button', { name: 'Menu' }).click();
    await hote.page.getByRole('menuitem', { name: 'Terminer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: 'Confirmer — terminer la partie' }).click();
    await expect(stream.getByTestId('stream-qr')).toHaveCount(0);

    // C'EST ICI QUE L'OUBLI SE VERRAIT : une seconde partie sans aucun moyen de
    // la rejoindre. Le défaut est invisible en test rapide — il faut jouer un
    // cycle complet pour l'atteindre.
    await hote.page.getByTestId('back-to-lobby').click();
    await expect(stream.getByTestId('stream-qr')).toBeVisible({ timeout: 10_000 });
    await expect(stream.getByTestId('stream-leaderboard')).toHaveCount(0);
  });
});

// Lisibilité du CODE et de l'ADRESSE aux tailles où le stream est réellement
// regardé. C'est le point qui commande : un spectateur qui suit le stream SUR SON
// TÉLÉPHONE ne peut pas scanner le QR avec ce même téléphone — le code et
// l'adresse sont son seul chemin.
test.describe('Lisibilité de la pastille', () => {
  const tailles = [
    { nom: 'canevas complet', largeur: 1920, hauteur: 1080 },
    { nom: 'ordinateur portable', largeur: 1440, hauteur: 810 },
    { nom: 'téléphone en paysage', largeur: 844, hauteur: 390 },
    { nom: 'téléphone en portrait', largeur: 390, hauteur: 220 },
  ];

  for (const t of tailles) {
    test(`code et adresse mesurés — ${t.nom}`, async ({ browser }) => {
      const hote = await openHost(browser);
      const stream = await hote.ctx.newPage();
      await stream.setViewportSize({ width: t.largeur, height: t.hauteur });
      const token = await hote.page.evaluate(() => JSON.parse(localStorage.getItem('host')).overlayToken);
      await stream.goto(`/overlay?token=${token}`);
      await expect(stream.getByTestId('stream-room-code')).toHaveText(hote.code);

      const px = async (sel) => stream.locator(sel).evaluate(
        (el) => parseFloat(getComputedStyle(el).fontSize) * (parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue('--stream-scale')) || 1),
      );
      const code = await px('.rejoindre__code');
      const lien = await px('.rejoindre__lien');
      // Consigné pour que le chiffre soit lisible dans le rapport, pas seulement
      // le verdict : c'est lui qui dira s'il faut remonter les tailles un jour.
      console.log(`  ${t.nom} (${t.largeur}px) — code ${code.toFixed(1)}px, adresse ${lien.toFixed(1)}px`);

      // LE CODE est le chemin de secours et doit rester lisible PARTOUT : dix
      // pixels est le plancher en dessous duquel un texte court cesse d'être lu.
      expect(code).toBeGreaterThanOrEqual(10);

      // L'ADRESSE tient jusqu'au téléphone en paysage. En portrait, elle tombe
      // sous le seuil — et AUCUNE taille raisonnable ne l'y sauverait : à cette
      // échelle, le stream entier occupe 390 px de large, et l'énoncé de la
      // question lui-même n'y fait que 17 px. Rendre l'adresse lisible là
      // demanderait de lui donner la taille d'un titre, ce qui ramènerait
      // l'encombrement du panneau qu'on vient de retirer.
      // C'est une limite ASSUMÉE, pas un oubli : le code reste lisible, et
      // l'animateur peut toujours annoncer l'adresse à l'oral.
      if (t.largeur >= 844) expect(lien).toBeGreaterThanOrEqual(10);

      // L'ADRESSE N'EST JAMAIS COUPÉE AU MILIEU D'UN MOT.
      //
      // CE QUI A ÉTÉ VU : « localhost:8788/pl » puis « ay » sur la ligne
      // suivante, sur toutes les captures de stream. Ce n'est pas un défaut de
      // la seule adresse locale : l'arithmétique du jeton --pastille-st compte
      // « show.onrender.com » (348 px) comme le plus long segment insécable de
      // l'adresse d'hébergement — ce qui suppose une coupure possible APRÈS la
      // barre oblique. CSS n'en offre aucune : le segment réel est
      // « show.onrender.com/play », 450 px, plus large que la plaque. La plaque
      // a donc été dimensionnée sur une hypothèse que le navigateur ne tient pas,
      // et `overflow-wrap: break-word` tranche là où il peut, en plein mot.
      //
      // POURQUOI MESURER LA COUPURE ET NON LE NOMBRE DE LIGNES : trois lignes
      // sont VOULUES (décision 2.3, chiffrée dans tokens.css). Ce qui n'est pas
      // voulu, c'est où la coupure tombe.
      // LA MESURE, POSÉE DANS LA PAGE et appelée deux fois : sur l'adresse
      // réelle de cette exécution, puis sur celle de l'hébergement.
      await stream.evaluate(() => {
        window.__coupures = (el) => {
          // TOUS les nœuds de texte, dans l'ordre du document : l'adresse est
          // découpée en segments séparés par des <wbr>, elle n'est plus un seul
          // nœud. Lire `el.firstChild` seul ne verrait que le premier segment — le
          // contrôle passerait au vert en n'ayant rien regardé.
          const parcours = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          const lettres = [];
          for (let n = parcours.nextNode(); n; n = parcours.nextNode()) {
            for (let i = 0; i < n.textContent.length; i += 1) lettres.push([n, i]);
          }
          // Le haut de chaque caractère : un changement de haut = un retour à la
          // ligne. On relève alors le couple de caractères qu'il sépare.
          const plage = document.createRange();
          const faute = [];
          let hautPrecedent = null;
          for (let k = 0; k < lettres.length; k += 1) {
            const [noeud, i] = lettres[k];
            plage.setStart(noeud, i);
            plage.setEnd(noeud, i + 1);
            const haut = plage.getBoundingClientRect().top;
            if (hautPrecedent !== null && Math.abs(haut - hautPrecedent) > 1) {
              const [nPrec, iPrec] = lettres[k - 1];
              faute.push(`${nPrec.textContent[iPrec]}|${noeud.textContent[i]}`);
            }
            hautPrecedent = haut;
          }
          return faute;
        };
      });
      const coupures = await stream.locator('.rejoindre__lien').evaluate((el) => window.__coupures(el));

      // Une coupure LÉGITIME sépare deux segments d'adresse : elle suit un
      // séparateur. Une coupure entre deux caractères ordinaires est la faute.
      const illegitimes = coupures.filter((c) => !/[-.:/]/.test(c[0]));
      expect(illegitimes, `l'adresse est coupée en plein mot : ${illegitimes.join(', ')}`)
        .toEqual([]);

      // ET SURTOUT L'ADRESSE D'HÉBERGEMENT — celle que voit le public. L'adresse
      // locale est plus courte : elle ne prouve pas le cas qui compte. On pose
      // donc la vraie dans la vraie plaque, découpée par la MÊME règle que
      // l'application (importée, pas recopiée), et on remesure.
      const coupuresProd = await stream.locator('.rejoindre__lien').evaluate((el, segments) => {
        el.replaceChildren();
        segments.forEach((seg, i) => {
          el.append(document.createTextNode(seg));
          if (i < segments.length - 1) el.append(document.createElement('wbr'));
        });
        return window.__coupures(el);
      }, segmentsAdresse('project-game-show.onrender.com/play'));

      const illegitimesProd = coupuresProd.filter((c) => !/[-.:/]/.test(c[0]));
      expect(illegitimesProd,
        `l'adresse d'hébergement est coupée en plein mot : ${illegitimesProd.join(', ')}`)
        .toEqual([]);

      await terminerPartie(hote.page);
      await stream.close();
      await hote.ctx.close();
    });
  }
});
