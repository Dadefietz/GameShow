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
export async function joinAsPlayer(browser, code, pseudo, options = {}) {
  // `options` sert aux contrôles de téléphone : une fenêtre courte et le TACTILE.
  // Sans `hasTouch`, le navigateur n'émet que des événements de souris — et c'est
  // ainsi qu'un plantage propre au doigt a traversé toute une campagne verte.
  const ctx = await browser.newContext(options);
  const page = await ctx.newPage();
  await page.goto('/');
  const boxes = page.getByTestId('join-code').getByRole('textbox');
  for (const [i, ch] of [...code].entries()) await boxes.nth(i).fill(ch);
  await page.getByTestId('join-pseudo').fill(pseudo);
  await page.getByTestId('join-submit').click();
  return { ctx, page };
}

// FABRIQUER UN JEU POUR UN CONTRÔLE, PAR L'API.
//
// Les contrôles passaient par le bouton « Nouveau module » du studio. Ce bouton a
// été retiré (A15) : un module n'est pas qu'un nom et une couleur, son TYPE
// commande un barème, des écrans et des phrases, tous écrits dans le code — le
// studio ne savait de toute façon fabriquer qu'un quiz de plus.
//
// Passer par l'API n'est pas un pis-aller, c'est un progrès : dix contrôles
// pilotaient une dizaine de champs d'interface pour poser un décor, et
// échouaient dès qu'un libellé bougeait. Ce qu'ils mesurent est ailleurs.
//
// Le jeu est AJOUTÉ à la bibliothèque existante, jamais substitué : elle est
// partagée par toute l'exécution (voir `retirerJeux` ci-dessous).
export async function creerJeu({ name, type, questions, duration }) {
  const actuels = await fetch(`${BASE}/api/modules`).then((r) => r.json()).then((d) => d.modules || []);
  const module_ = {
    id: `m-test-${Math.random().toString(36).slice(2, 10)}`,
    type,
    name,
    duration: duration ?? 20,
    color: 'fire',
    // Format SERVEUR : { id, text, options?, correctIndex?, correct?, target? }.
    // C'est celui qu'écrit le studio après conversion, et celui que lit le moteur.
    questions: questions.map((q, i) => ({
      id: `q-test-${i}-${Math.random().toString(36).slice(2, 8)}`,
      durationSec: duration ?? 20,
      ...q,
    })),
  };
  const res = await fetch(`${BASE}/api/modules`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ modules: [...actuels, module_] }),
  });
  if (!res.ok) throw new Error(`creerJeu a échoué : ${res.status}`);
  return module_;
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

// LANCER UN JEU DEPUIS LE MENU DE L'ANIMATEUR.
//
// POURQUOI CE DÉTOUR EXISTE. « Chaque module doit comporter un écran d'attente
// lorsque l'animateur le lance. » Les quatre jeux classiques — quiz, vrai/faux,
// estimation, vote — partaient jusqu'ici d'un seul clic : la question tombait sur
// les téléphones avant qu'on ait dit à quoi on jouait. Ils passent désormais par
// le même chemin que les autres : ANNONCE d'abord, DÉPART ensuite.
//
// Le clic du menu n'ouvre donc plus une manche, il ouvre un PANNEAU. Lequel
// dépend du jeu : les uns demandent une saisie (les deux mots du lien, les temps
// du juste temps, la proportion de la bûche), les autres n'ont qu'un bouton.
//
// CE QUE FAIT CETTE FONCTION : elle attend le panneau, quel qu'il soit, et ne
// clique que s'il s'agit du panneau à un bouton. Un contrôle qui prépare
// lui-même sa saisie retrouve son panneau intact.
//
// SANS ELLE, TRENTE CONTRÔLES ATTENDAIENT QUINZE SECONDES un écran de jeu resté
// sur son jingle — un rouge massif qui ne désignait pas la faute.
// `demarrer: false` S'ARRÊTE AU PANNEAU DE PRÉPARATION, et ce n'est pas un
// raffinement : DONNER LE TOP CONSOMME UNE QUESTION. La file est tirée au sort —
// `session.shuffle` — et « Question suivante » en retire la tête, qui devient « en
// cours » et quitte la liste. Un contrôle qui inspecte la file APRÈS le départ
// regarde donc une file amputée d'une question qu'il ne peut pas prédire : il
// passe quatre fois sur cinq, et échoue la cinquième sur un tirage. Vu : « une
// question sans catégorie déclarée a disparu de la file », rouge une fois sur une
// campagne entière, vert en isolation.
export async function lancerJeu(page, nom, { demarrer = true } = {}) {
  const entree = nom
    ? page.getByRole('menuitem', { name: `Lancer ${nom}` })
    : page.getByRole('menuitem');
  await entree.first().click();
  // N'IMPORTE LEQUEL DES PANNEAUX DE PRÉPARATION : on ne devine pas le type du
  // jeu depuis le contrôle, c'est l'écran qui le dit.
  await page.locator('[data-testid^="saisie-"], [data-testid^="depart-"]').first()
    .waitFor({ state: 'visible', timeout: 15_000 });
  if (!demarrer) return;
  const bouton = page.getByTestId('simple-demarrer');
  if (await bouton.isVisible()) await bouton.click();
}
