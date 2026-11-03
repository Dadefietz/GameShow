// E2E — LE COMPTEUR DE « CUEILLETTE » PORTE SUR UNE IMAGE.
//
// CE QUI A ÉTÉ DEMANDÉ (02/11) : le compteur de passages s'applique aussi à
// Cueillette, « pour Cueillette ce n'est pas un compteur pour une question mais
// pour une image ».
//
// POURQUOI CE JEU A SON PROPRE CONTRÔLE. Les quatre autres comptent une
// question ; Cueillette n'en a qu'UNE dans sa banque — celle qui porte la liste
// des dessins modérés — et tire sa cible dedans à chaque manche. Compter sur
// cette entrée unique aurait donné le nombre de manches jouées, le même chiffre
// pour les cinquante dessins. Le contrôle vérifie donc que c'est bien L'IMAGE
// POSÉE qui monte, et elle seule.
//
// ET QUE LA BANQUE N'EST PAS FIGÉE AU PASSAGE. Les compteurs sont rangés dans
// une table à côté, `poses`, parce que les écrire dans `dessins[]` aurait figé
// la banque de l'animateur sur l'état du jour : tant qu'il n'a pas modéré, cette
// liste est vide et le jeu se rabat sur les cinquante dessins du dépôt. On
// vérifie donc qu'après une manche, le dépôt répond toujours.
import { test, expect } from '@playwright/test';
import { openHost, joinAsPlayer, lancerJeu, BASE } from './helpers.js';
import { terminerPartie } from './cloture.js';

test.setTimeout(150_000);

// L'entrée de banque de Cueillette, telle que la bibliothèque la porte.
async function contenuCueillette() {
  const { modules } = await fetch(`${BASE}/api/modules`).then((r) => r.json());
  const jeu = (modules || []).find((m) => m.type === 'cueillette');
  return (jeu?.questions || []).find((q) => q?.kind === 'contenu-cueillette') || null;
}

test.describe('Le compteur de Cueillette', () => {
  let hote = null;
  const joueurs = [];

  test.afterEach(async () => {
    if (hote) { await terminerPartie(hote.page); await hote.ctx.close(); hote = null; }
    for (const j of joueurs.splice(0)) await j.ctx.close();
  });

  test("c'est l'image posée qui monte, et elle seule — sans figer la banque", async ({ browser }) => {
    const avant = await contenuCueillette();
    const posesAvant = avant?.poses || {};

    hote = await openHost(browser);
    joueurs.push(await joinAsPlayer(browser, hote.code, 'Dessinatrice'));
    await expect(hote.page.getByTestId('player-count')).toHaveText('1');
    await hote.page.getByRole('button', { name: 'Lancer la partie' }).click();
    await lancerJeu(hote.page, 'Cueillette');
    await hote.page.getByTestId('cueillette-demarrer').click();

    // La cible est annoncée au joueur : c'est elle qu'on attend au compteur.
    await expect(joueurs[0].page.getByTestId('cueillette-cible'))
      .toBeVisible({ timeout: 25_000 });

    await expect.poll(async () => {
      const c = await contenuCueillette();
      return Object.keys(c?.poses || {}).length;
    }, {
      message: "aucun compteur d'image n'a été écrit après une manche",
      timeout: 20_000,
    }).toBeGreaterThan(Object.keys(posesAvant).length - 1);

    const apres = await contenuCueillette();
    const poses = apres?.poses || {};

    // UNE SEULE IMAGE A BOUGÉ, et d'un seul cran.
    const montees = Object.keys(poses).filter((id) => (poses[id] || 0) > (posesAvant[id] || 0));
    expect(montees.length,
      `${montees.length} images ont vu leur compteur monter pour une seule manche`).toBe(1);
    expect(poses[montees[0]] - (posesAvant[montees[0]] || 0),
      "le compteur de l'image posée n'a pas monté d'exactement un cran").toBe(1);

    // LA BANQUE N'EST PAS FIGÉE : `dessins` reste vide tant que l'animateur n'a
    // pas modéré, donc le jeu continue de puiser dans les cinquante du dépôt.
    expect(Array.isArray(apres.dessins) ? apres.dessins.length : 0,
      'la banque a été figée par un simple passage — un dessin ajouté au dépôt '
      + "ne parviendrait plus à cet animateur").toBe(0);
  });
});
