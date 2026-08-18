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

// Parcours joueur : rejoint un salon depuis la page d'accueil (code en 5 cases).
// Sélecteurs stables uniquement — le texte de l'interface peut changer.
export async function joinAsPlayer(browser, code, pseudo) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('/');
  const boxes = page.getByTestId('join-code').getByRole('textbox');
  for (const [i, ch] of [...code].entries()) await boxes.nth(i).fill(ch);
  await page.getByTestId('join-pseudo').fill(pseudo);
  await page.getByTestId('join-submit').click();
  return { ctx, page };
}
