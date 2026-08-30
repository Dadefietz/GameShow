// E2E — LES POLICES SONT SERVIES PAR LE JEU, PAS PAR LA MACHINE (A27).
//
// CE QUI A ÉTÉ RAPPORTÉ : « la police est incorrecte sur tous les écrans de
// Théodore, pas que sur les écrans de streaming. Comme si dans le code github, la
// police n'était pas poussée et que donc en ligne si une personne n'a pas la
// police téléchargée sur son pc il ne la voit pas comme il faut. »
//
// L'INTUITION ÉTAIT BONNE, LE DIAGNOSTIC UN CRAN PLUS LOIN : les fichiers ÉTAIENT
// poussés — quinze woff2, servis, dont trois préchargés à chaque visite. Ils
// n'étaient simplement JAMAIS DÉCLARÉS : `design/fonts/fonts.css` n'était importé
// par personne, et les jetons ne nommaient que des familles installées sur la
// machine (Avenir Next, Optima, SF Mono — macOS ; Segoe UI — Windows). Chacun
// voyait donc une autre police, sur les quatre surfaces, y compris dans les
// chiffres des scores et le code de salon.
//
// POURQUOI CE CONTRÔLE NE SE CONTENTE PAS DE LIRE LE JETON. Sur un Mac, « Avenir
// Next » EXISTE : un contrôle qui vérifierait seulement que la police calculée
// vaut le jeton serait resté vert pendant toute la durée de la panne. Il faut
// donc les deux :
//   1. le jeton nomme bien la police auto-hébergée EN TÊTE de sa pile ;
//   2. `document.fonts.check` confirme que le fichier est CHARGÉ et utilisable —
//      c'est ce que la machine ne peut pas fournir toute seule.
// Le point 2 est le seul qui aurait rougi avant la correction.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.setTimeout(120_000);

// La police auto-hébergée attendue en tête de chaque pile. Écrite en clair, et
// c'est voulu : lire le jeton pour le comparer à lui-même ne prouverait rien.
const ATTENDUES = {
  '--f-display': 'Barlow Semi Condensed',
  '--f-ui': 'Mulish',
  '--f-mono': 'IBM Plex Mono',
};

async function verifierLesPolices(page, ou) {
  const releve = await page.evaluate(async (ATTENDUES) => {
    const cs = getComputedStyle(document.documentElement);
    const out = [];
    for (const [jeton, attendue] of Object.entries(ATTENDUES)) {
      const pile = cs.getPropertyValue(jeton).trim().replace(/\s+/g, ' ');
      const premiere = pile.split(',')[0].trim().replace(/["']/g, '');
      // On demande explicitement le chargement avant de vérifier : `check` seul
      // rend faux tant que le navigateur n'a pas eu besoin de la police.
      try { await document.fonts.load(`600 16px "${attendue}"`); } catch { /* ignoré */ }
      out.push({ jeton, premiere, attendue, chargee: document.fonts.check(`600 16px "${attendue}"`) });
    }
    return out;
  }, ATTENDUES);

  for (const r of releve) {
    console.log(`  ${ou} · ${r.jeton} → ${r.premiere}${r.chargee ? ' (chargée)' : ' (ABSENTE)'}`);
    expect(r.premiere, `${ou} : ${r.jeton} ne commence pas par la police auto-hébergée`)
      .toBe(r.attendue);
    expect(r.chargee, `${ou} : « ${r.attendue} » n'est pas chargée — la machine du lecteur décide encore du dessin`)
      .toBe(true);
  }
}

test.describe('Les polices du jeu', () => {
  let hote = null;
  const joueurs = [];

  test.afterEach(async () => {
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    for (const j of joueurs.splice(0)) await j.ctx.close();
  });

  test('les quatre surfaces dessinent avec les polices du jeu', async ({ browser }) => {
    hote = await openHost(browser);
    joueurs.push(await joinAsPlayer(browser, hote.code, 'Police'));
    const stream = await hote.ctx.newPage();
    const jeton = await hote.page.evaluate(() => JSON.parse(localStorage.getItem('host')).overlayToken);
    await stream.goto(`/overlay?token=${jeton}`);
    const studio = await hote.ctx.newPage();
    await studio.goto('/studio');
    await expect(studio.locator('.studio')).toBeVisible({ timeout: 15_000 });

    await verifierLesPolices(hote.page, 'la console');
    await verifierLesPolices(joueurs[0].page, 'le joueur');
    await verifierLesPolices(stream, 'le stream');
    await verifierLesPolices(studio, 'le studio');
  });

  test('aucun fichier de police servi n\'est orphelin, aucun déclaré ne manque', async ({ browser }) => {
    // LE REVERS DE LA PANNE. Trois fichiers étaient préchargés sans jamais être
    // déclarés ; quinze étaient servis sans jamais être nommés. Ce contrôle
    // interdit les deux sens : ce qui est déclaré doit répondre, ce qui est
    // préchargé doit être déclaré.
    hote = await openHost(browser);
    const page = hote.page;

    const { declares, precharges } = await page.evaluate(() => {
      const d = new Set();
      for (const feuille of document.styleSheets) {
        let regles;
        try { regles = feuille.cssRules; } catch { continue; }
        for (const r of regles || []) {
          if (r.constructor.name === 'CSSFontFaceRule' || r.type === 5) {
            const m = /url\(["']?([^"')]+)["']?\)/.exec(r.style.getPropertyValue('src'));
            if (m) d.add(new URL(m[1], location.href).pathname);
          }
        }
      }
      const p = [...document.querySelectorAll('link[rel="preload"][as="font"]')]
        .map((l) => new URL(l.getAttribute('href'), location.href).pathname);
      return { declares: [...d], precharges: p };
    });

    expect(declares.length, 'aucune déclaration @font-face : le jeu ne charge aucune police')
      .toBeGreaterThan(0);
    console.log(`  ${declares.length} fichiers déclarés, ${precharges.length} préchargés`);

    for (const chemin of declares) {
      const rep = await page.request.get(chemin);
      expect(rep.status(), `police déclarée mais absente du serveur : ${chemin}`).toBe(200);
    }
    for (const chemin of precharges) {
      expect(declares, `préchargé sans être déclaré — téléchargé pour rien : ${chemin}`)
        .toContain(chemin);
    }
  });
});
