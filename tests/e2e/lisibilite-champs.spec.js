// E2E — LA LISIBILITÉ DES CHAMPS DE SAISIE, SUR LES QUATRE SURFACES (A31).
//
// CE QUI A ÉTÉ RAPPORTÉ : « dans le nouveau jeu, les zones de saisie du texte
// pour l'animateur sont très mal pensées (texte blanc sur zone de saisie
// blanche) ».
//
// CE QUE C'ÉTAIT. `SaisieLien` écrivait `className="input"` — une classe définie
// dans la SEULE feuille du studio, que la console animateur ne charge jamais
// (chaque surface est chargée paresseusement avec sa propre CSS). Les deux champs
// n'avaient donc aucune règle et retombaient sur le rendu natif du navigateur,
// lequel, faute de `color-scheme`, suppose un fond clair : une boîte blanche
// posée sur une console brun nuit.
//
// Le dépôt savait déjà : le réinitialiseur partagé neutralise `<button>` avec ce
// commentaire — « c'est ce qui faisait apparaître des boutons blancs quand une
// classe n'était pas stylée ». La leçon n'avait pas été étendue aux champs.
//
// POURQUOI CE CONTRÔLE MESURE UN CONTRASTE ET NON UNE CLASSE. Vérifier que
// l'élément porte `.input` ne prouve rien : la classe peut exister et ne rien
// désigner — c'est exactement ce qui s'est produit. Seul le rapport de contraste
// entre l'encre RÉELLEMENT calculée et le fond RÉELLEMENT peint dit si un être
// humain peut lire ce qu'il tape. On mesure le rendu, pas l'intention.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.setTimeout(120_000);

// Le plancher WCAG AA pour du texte courant. Un champ que l'animateur remplit en
// direct, à l'antenne, n'a pas le droit d'être en dessous.
const PLANCHER = 4.5;

// Relève, pour chaque champ de saisie rendu, son encre et le fond RÉELLEMENT
// peint derrière lui — en remontant les ancêtres tant que le fond est
// transparent, puisqu'un champ sans règle n'en peint aucun.
//
// Le contraste se calcule sur la luminance relative (WCAG 2.x). Les couleurs
// calculées reviennent en rgb()/rgba() quels que soient les jetons d'origine :
// c'est la sortie du navigateur, pas la source.
async function releverLesChamps(page) {
  return page.evaluate((PLANCHER) => {
    // NORMALISATION DES COULEURS — ne pas lire la chaîne, la PEINDRE.
    //
    // Première version de ce contrôle : une expression régulière qui extrayait
    // les nombres de la valeur calculée. Elle donnait 1,06:1 sur des champs
    // parfaitement lisibles. La raison : le navigateur ne rend plus les couleurs
    // en `rgb()` mais dans leur espace d'origine — ici `oklch(0.96 0.018 84)`,
    // dont les trois nombres étaient lus comme du rouge-vert-bleu.
    //
    // On peint donc la couleur sur un pixel et on relit ce pixel : quelle que
    // soit la syntaxe — rgb, oklch, color-mix, un mot-clé système —, c'est le
    // navigateur qui fait la conversion, et c'est la couleur réellement à
    // l'écran qu'on mesure.
    const toile = document.createElement('canvas');
    toile.width = toile.height = 1;
    const pinceau = toile.getContext('2d', { willReadFrequently: true });
    const rgb = (v) => {
      if (!v) return null;
      pinceau.clearRect(0, 0, 1, 1);
      // Sentinelle : une valeur invalide laisse `fillStyle` inchangé. Sans elle,
      // une couleur non reconnue emprunterait silencieusement la précédente.
      pinceau.fillStyle = '#010203';
      pinceau.fillStyle = v;
      if (pinceau.fillStyle === '#010203' && String(v).trim() !== '#010203') return null;
      pinceau.fillRect(0, 0, 1, 1);
      const d = pinceau.getImageData(0, 0, 1, 1).data;
      return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
    };
    const canal = (c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const lum = ({ r, g, b }) => 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
    const contraste = (x, y) => {
      const a = lum(x); const b = lum(y);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    };
    // Le fond effectif : le premier ancêtre — l'élément compris — qui peint
    // vraiment quelque chose. Un champ natif non stylé n'en peint aucun, et
    // c'est précisément ce cas qu'il faut savoir traverser.
    const fondEffectif = (el) => {
      for (let n = el; n; n = n.parentElement) {
        const c = rgb(getComputedStyle(n).backgroundColor);
        if (c && c.a > 0.05) return c;
      }
      return rgb(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
    };

    const releves = [];
    for (const el of document.querySelectorAll('input, textarea, select')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      if (el.type === 'hidden' || el.type === 'checkbox' || el.type === 'radio') continue;
      if (!el.getClientRects().length) continue;
      const encre = rgb(cs.color);
      const fond = fondEffectif(el);
      if (!encre || !fond) continue;
      // LE FOND PROPRE, distinct du fond effectif. Un champ sans règle n'en
      // peint aucun et hérite de ce qui est derrière : c'est le cas que le
      // contraste seul ne voit pas, puisque le navigateur lui donne alors sa
      // boîte claire par défaut — lisible en soi, aberrante sur une console
      // brun nuit. On exige donc en plus que le champ soit PLUS SOMBRE que son
      // encre : le jeu est sombre sur ses quatre surfaces, sans exception.
      const propre = rgb(cs.backgroundColor);
      releves.push({
        quoi: el.getAttribute('data-testid') || el.id || el.name || el.type || 'champ',
        encre: cs.color,
        fond: cs.backgroundColor,
        ratio: Math.round(contraste(encre, fond) * 100) / 100,
        peint: !!(propre && propre.a > 0.05),
        sombre: !!(propre && propre.a > 0.05 && lum(propre) < lum(encre)),
        plancher: PLANCHER,
      });
    }
    return releves;
  }, PLANCHER);
}

function verifier(releves, ou) {
  expect(releves.length, `aucun champ de saisie trouvé sur ${ou} : le contrôle ne mesurerait rien`)
    .toBeGreaterThan(0);
  for (const c of releves) {
    console.log(`  ${ou} · ${c.quoi} → ${c.ratio}:1 (encre ${c.encre} sur ${c.fond || 'fond hérité'})`);
    expect(c.ratio, `« ${c.quoi} » sur ${ou} est illisible : ${c.ratio}:1, plancher ${PLANCHER}:1`)
      .toBeGreaterThanOrEqual(PLANCHER);
    // UN CHAMP QUI NE PEINT RIEN N'EST PAS FAUTIF : c'est le motif de l'habillage
    // — un `<input>` transparent posé dans un bloc peint, employé par le pseudo
    // de l'accueil comme par les champs de la console. Le contraste effectif
    // ci-dessus l'a déjà jugé, sur le fond que le joueur voit vraiment.
    //
    // Mais un champ qui peint SA PROPRE boîte doit la peindre sombre. C'est
    // là qu'est le défaut : sans règle de composant, le navigateur lui donne
    // une boîte blanche opaque — parfaitement contrastée, et aberrante au
    // milieu d'une surface de nuit. Le contraste seul ne l'aurait jamais vu.
    if (c.peint) {
      expect(c.sombre, `« ${c.quoi} » sur ${ou} peint une boîte plus CLAIRE que son encre : le rendu natif du navigateur, pas le jeu`)
        .toBe(true);
    }
  }
}

test.describe('La lisibilité des champs de saisie', () => {
  let hote = null;
  const joueurs = [];

  test.afterEach(async () => {
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    for (const j of joueurs.splice(0)) await j.ctx.close();
  });

  test('la console animateur — les deux mots du « Lien », tapés à l\'antenne', async ({ browser }) => {
    hote = await openHost(browser);
    joueurs.push(await joinAsPlayer(browser, hote.code, 'Lisible'));
    await expect(hote.page.getByTestId('player-count')).toHaveText('1');
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.page.getByRole('menuitem', { name: 'Lancer Le lien' }).first().click();
    await expect(hote.page.getByTestId('saisie-lien')).toBeVisible({ timeout: 15_000 });

    // On remplit : un champ vide peut masquer le défaut, l'encre ne se voyant
    // que sur du texte. C'est en tapant que l'animateur l'a découvert.
    await hote.page.getByTestId('lien-mot1').fill('Pigeon');
    await hote.page.getByTestId('lien-mot2').fill('Avion');

    verifier(await releverLesChamps(hote.page), 'la console');
  });

  test('la page d\'accueil joueur — le code et le pseudo', async ({ browser }) => {
    hote = await openHost(browser);
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/');
    const boxes = page.getByTestId('join-code').getByRole('textbox');
    for (const [i, ch] of [...hote.code].entries()) await boxes.nth(i).fill(ch);
    await page.getByTestId('join-pseudo').fill('Lisible');
    verifier(await releverLesChamps(page), 'l\'accueil joueur');
    await ctx.close();
  });

  test('le studio — les champs de la bibliothèque', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/studio');
    await expect(page.locator('.studio')).toBeVisible({ timeout: 15_000 });
    // Les champs du studio vivent dans le panneau d'édition, fermé à l'arrivée :
    // sans l'ouvrir, le contrôle ne mesurerait rien et passerait au vert pour
    // n'avoir rien regardé.
    await page.locator('[data-action="studio:editModule"]').first().click();
    await expect(page.locator('.input').first()).toBeVisible({ timeout: 15_000 });
    verifier(await releverLesChamps(page), 'le studio');
    await ctx.close();
  });
});
