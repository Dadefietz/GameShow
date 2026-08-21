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

// RETIRER LES JEUX FABRIQUÉS PAR UN CONTRÔLE.
//
// POURQUOI C'EST NÉCESSAIRE. La bibliothèque de jeux vit côté serveur et se
// PARTAGE entre tous les contrôles d'une exécution. Or dix fichiers lancent « le
// premier module de la liste » (`getByRole('menuitem').first()`) : un contrôle qui
// fabrique un jeu et le laisse derrière lui change donc ce que lancent les
// suivants.
//
// Le symptôme observé : le contrôle géométrique de la file — qui a besoin d'un jeu
// de PLUS DE QUATRE questions — tombait sur un jeu fabriqué qui n'en avait qu'une,
// attendait quinze secondes une cinquième ligne qui n'arriverait jamais, puis
// échouait. Vert seul, rouge dans la suite complète, selon l'ordre d'exécution.
//
// Un contrôle qui lègue son état au suivant finit par mentir — c'est la même règle
// que la clôture de salon (voir `cloture.js`).
export async function retirerJeux(...noms) {
  try {
    const res = await fetch(`${BASE}/api/modules`);
    if (!res.ok) return;
    const { modules } = await res.json();
    const restants = modules.filter((m) => !noms.some((n) => (m.name || '').startsWith(n)));
    if (restants.length === modules.length) return;
    await fetch(`${BASE}/api/modules`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ modules: restants }),
    });
  } catch {
    // Un nettoyage ne doit JAMAIS faire échouer le contrôle qui vient de finir.
  }
}
