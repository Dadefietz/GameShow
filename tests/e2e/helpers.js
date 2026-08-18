// Aides E2E — ouverture d'une session animateur SANS passer par le magic link :
// le salon est créé via l'API (mode dev du serveur de test, sans HOST_EMAIL) et la
// session est injectée en localStorage — le mécanisme de reprise de session de l'app.
export const BASE = 'http://localhost:8788';

export async function openHost(browser) {
  const res = await fetch(`${BASE}/api/rooms`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) throw new Error('create-room-failed: ' + res.status);
  const s = await res.json();
  const ctx = await browser.newContext();
  await ctx.addInitScript((session) => {
    localStorage.setItem('host', JSON.stringify(session));
  }, { code: s.code, hostToken: s.hostToken, overlayToken: s.overlayToken });
  const page = await ctx.newPage();
  await page.goto('/host');
  return { ctx, page, code: s.code };
}
