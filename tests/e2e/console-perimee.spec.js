// E2E — UN ÉCRAN AU CODE PÉRIMÉ LE SAIT (retour du 26/10).
//
// « Quand nous étions 11 joueurs, je n'avais pas accès au bouton [Haut le cœur],
// je n'avais accès qu'à "Coup de cœur". » C'était la console d'AVANT le haut le
// cœur : une page ouverte avant une mise en ligne garde son ancien code, même
// quand le salon meurt avec le redémarrage et qu'on en rouvre un autre.
//
// CE QUE CE FICHIER SIMULE. Une mise en ligne survenue pendant que l'écran est
// ouvert : la page garde son code, et le serveur annonce une version plus
// récente. On réécrit l'annonce au passage, sur le vrai WebSocket.
//
// PAS EN RENOMMANT LE SCRIPT DE LA PAGE — essayé d'abord : les morceaux du build
// importent le script principal sous son vrai nom, React se chargeait deux fois,
// et la page plantait avant d'avoir rien pu dire.
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8788';

async function salon() {
  const res = await fetch(`${BASE}/api/rooms`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  return res.json();
}

// Tant que `etat.enLigne` est vrai, le serveur « annonce » une version neuve.
async function miseEnLigne(page) {
  const etat = { enLigne: true };
  await page.routeWebSocket(/socket\.io/, (ws) => {
    const serveur = ws.connectToServer();
    serveur.onMessage((m) => {
      ws.send(etat.enLigne && typeof m === 'string' && m.startsWith('42["serveur:version"')
        ? m.replace(/index-[A-Za-z0-9_-]+\.js/, 'index-NOUVELLE.js')
        : m);
    });
    ws.onMessage((m) => serveur.send(m));
  });
  return etat;
}

test.describe('Un écran au code périmé', () => {
  test('LA CONSOLE le dit, et « Recharger » la remet à jour', async ({ browser }) => {
    const s = await salon();
    const ctx = await browser.newContext();
    await ctx.addInitScript((session) => localStorage.setItem('host', JSON.stringify(session)),
      { code: s.code, hostToken: s.hostToken, overlayToken: s.overlayToken });
    const page = await ctx.newPage();
    try {
      // À JOUR : aucun bandeau, une fois la console connectée.
      await page.goto('/host');
      await expect(page.getByRole('button', { name: 'Lancer la partie' })).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId('console-perimee')).toHaveCount(0);

      // PÉRIMÉE : le bandeau, en tête, avec son bouton.
      const etat = await miseEnLigne(page);
      await page.reload();
      await expect(page.getByTestId('console-perimee')).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId('console-perimee')).toContainText('Nouvelle version');
      // Il ne masque pas le travail : la console reste pilotable dessous.
      await expect(page.getByRole('button', { name: 'Lancer la partie' })).toBeVisible();

      // « RECHARGER » : la page revient avec le code servi, et le bandeau s'en va.
      etat.enLigne = false;
      await page.getByTestId('console-recharger').click();
      await expect(page.getByRole('button', { name: 'Lancer la partie' })).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId('console-perimee')).toHaveCount(0);
    } finally {
      await ctx.close();
    }
  });

  test('LE STREAM se recharge seul — une fois, sans boucler', async ({ browser }) => {
    const s = await salon();
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 1920, height: 1080 });
    try {
      await miseEnLigne(page);
      let chargements = 0;
      page.on('load', () => { chargements += 1; });
      await page.goto(`/overlay?token=${s.overlayToken}`);
      // Le premier chargement apprend la mise en ligne et recharge ; le second
      // l'apprend encore (l'annonce reste réécrite) et ne recharge plus.
      await expect.poll(() => chargements, { timeout: 20_000 }).toBe(2);
      await page.waitForTimeout(3000);
      expect(chargements, 'le stream recharge en boucle').toBe(2);
      await expect(page.getByTestId('stream-room-code')).toHaveText(s.code);
    } finally {
      await ctx.close();
    }
  });
});
