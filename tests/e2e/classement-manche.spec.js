// E2E — LE CLASSEMENT DE MANCHE DE LA CONSOLE, ET SA GÉOMÉTRIE.
//
// CE QUI A ÉTÉ RAPPORTÉ : « il y a parfois un tableau des joueurs avec des
// informations et le score sur la manche. Les informations sont toutes à droite
// du tableau un peu écrasées. Il faut se permettre de prendre plus de place. »
//
// CE QU'IL Y AVAIT, MESURÉ : un panneau de 924 px dont le nom du joueur prenait
// 672, et trois colonnes de 47 px rejetées contre le bord droit. Pire que
// serré : les TITRES SE CHEVAUCHAIENT — « RÉUSSIS » sur « RATÉS ».
//
// LA CAUSE, ET C'EST ELLE QUE CE CONTRÔLE GARDE. Les colonnes étaient déclarées
// en `ch`, une unité qui se mesure sur la police de l'élément. Chaque ligne du
// tableau étant sa PROPRE grille, l'en-tête — écrit plus petit — calculait des
// colonnes plus étroites que les lignes de données. Les titres ne tombaient donc
// pas sur leurs chiffres. Rien ne casse, rien ne dépasse : les nombres sont
// simplement sous les mauvais titres, et l'animateur commente à l'antenne un
// classement qu'il lit de travers.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer, lancerJeu } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.setTimeout(180_000);

// Des pseudos LONGS : c'est le cas qui écrase les colonnes. Aucun ne contient
// « con », que le filtre de pseudos du projet refuse.
const PSEUDOS = ['Alexandrine', 'Bartholomew', 'Cassiopee'];

test.describe('Le classement de manche', () => {
  let hote = null;
  const joueurs = [];

  test.afterEach(async () => {
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    for (const j of joueurs.splice(0)) await j.ctx.close();
  });

  test('ses titres tombent sur leurs chiffres, et aucun n\'en recouvre un autre', async ({ browser }) => {
    hote = await openHost(browser);
    for (const p of PSEUDOS) joueurs.push(await joinAsPlayer(browser, hote.code, p));
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await lancerJeu(hote.page, 'Retour de flamme');
    await hote.page.getByTestId('retour-demarrer').click();
    for (const j of joueurs) {
      await expect(j.page.getByTestId('answer-submit')).toBeVisible({ timeout: 15_000 });
      await j.page.getByTestId('answer-submit').click();
    }
    await hote.page.getByRole('button', { name: /Révéler/ }).first().click();

    const clsm = hote.page.getByTestId('classement-manche');
    await expect(clsm).toBeVisible({ timeout: 15_000 });

    const m = await hote.page.evaluate(() => {
      const s = document.querySelector('[data-testid="classement-manche"]');
      const g = (e) => { const r = e.getBoundingClientRect(); return { g: Math.round(r.left), d: Math.round(r.right) }; };
      const tete = s.querySelector('.clsm__ligne--tete');
      const ligne = s.querySelector('.clsm__ligne:not(.clsm__ligne--tete)');
      return {
        panneau: Math.round(s.getBoundingClientRect().width),
        titres: [...tete.querySelectorAll('.clsm__col')].map(g),
        chiffres: [...ligne.querySelectorAll('.clsm__col')].map(g),
        nom: Math.round(ligne.querySelector('.clsm__nom').getBoundingClientRect().width),
      };
    });
    console.log(`  panneau ${m.panneau} px · nom ${m.nom} px · colonnes ${m.chiffres.map((c) => c.d - c.g).join('/')}`);

    // AUCUN TITRE N'EN RECOUVRE UN AUTRE.
    for (let i = 1; i < m.titres.length; i += 1) {
      expect(m.titres[i].g, `le titre ${i + 1} passe sous le précédent`)
        .toBeGreaterThanOrEqual(m.titres[i - 1].d);
    }
    // ET CHAQUE TITRE TOMBE SUR SA COLONNE — la même grille, à un pixel près.
    expect(m.titres.length).toBe(m.chiffres.length);
    for (let i = 0; i < m.titres.length; i += 1) {
      expect(Math.abs(m.titres[i].d - m.chiffres[i].d),
        `le titre ${i + 1} n'est pas au-dessus de sa colonne`).toBeLessThanOrEqual(1);
    }
    // LES CHIFFRES NE SONT PLUS ÉCRASÉS CONTRE LE BORD : le nom ne prend plus les
    // trois quarts du panneau.
    expect(m.nom, 'le nom mange encore toute la largeur').toBeLessThan(m.panneau * 0.4);
  });
});
