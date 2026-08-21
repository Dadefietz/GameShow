// BALAYAGE DES REDITES — chantier v4, action 10, décisions 10.2, 10.3 et 10.4.
//
// POURQUOI CE FICHIER N'EST PAS UN TEST.
//
// L'auteur a tranché : « Vérifie-les tous et c'est tout. » Le contrôle de
// non-redite n'est PAS généralisé en garde-fou permanent — on balaie les quatre
// surfaces une fois, on consigne le constat avec sa date, et l'on assume qu'une
// redite pourra revenir sans être signalée (décision 10.3).
//
// Le mettre dans `tests/e2e/` en aurait fait exactement ce que la décision refuse :
// une vérification rejouée à chaque exécution de la suite. Il vit donc à part, se
// lance à la main, et écrit son constat daté dans `docs/`.
//
//     node tests/outils/balayage-redites.mjs
//
// CE QU'IL COMPARE, ET POURQUOI. Ce qui se répète est le SENS, pas la chaîne : les
// deux phrases du podium ne partageaient pas trois mots de suite. On compare donc
// les textes RENDUS, normalisés (sans accents, sans ponctuation, sans chiffres —
// un code de salon change à chaque partie), par recouvrement de vocabulaire. Deux
// phrases qui partagent les deux tiers de leurs mots utiles disent la même chose.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';

const PORT = Number(process.env.PORT || 8799);
const BASE = `http://localhost:${PORT}`;
const SEUIL = 0.6;      // recouvrement de vocabulaire au-delà duquel on signale
const LONGUEUR_MIN = 24; // en deçà, ce sont des étiquettes, pas des phrases

// CE QUI EST ÉCARTÉ DU BALAYAGE, ET POURQUOI. Les énoncés de questions sont du
// CONTENU, écrit par l'animateur dans le Studio — pas du texte d'interface. Deux
// questions qui se ressemblent (« Quel est le plus grand océan ? » et « Quel est
// le plus grand désert chaud du monde ? ») ne sont pas une redite du produit ;
// et l'énoncé apparaît légitimement deux fois sur la console, à la scène et dans
// la ligne « En cours » de la file, parce que ce sont deux repères différents.
// Les inclure noyait le constat sous six signalements dont aucun n'appelait de
// correction. C'est une exclusion assumée : ce balayage porte sur ce que le
// PRODUIT dit, pas sur ce que l'animateur écrit.
const CONTENU = ['.stage__question', '.file__row', '.file__encours-texte', '.file__text',
  '[data-bind="module.text"]', '[data-testid="question-text"]', '[data-testid="answer-option"]',
  '.reveal__value', '.st-answer', '.p-option'];

// Les mots vides ne portent pas de sens : les garder ferait ressembler entre elles
// deux phrases qui n'ont que leur grammaire en commun.
const VIDES = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'a', 'au', 'aux',
  'et', 'ou', 'en', 'ne', 'pas', 'que', 'qui', 'si', 'tu', 'te', 'toi', 'il', 'elle', 'on',
  'ce', 'cet', 'cette', 'se', 'sa', 'son', 'ses', 'ta', 'ton', 'tes', 'y', 'dans', 'sur',
  'pour', 'par', 'plus', 'avec', 'sans', 'est', 'sont', 'ete', 'etre', 'as', 'ai']);

// CAVIARDAGE. Le salon d'attente affiche l'adresse du stream, jeton compris. Ce
// jeton n'a qu'une portée de quelques heures et vaut pour un salon de test
// détruit aussitôt — mais un constat versionné dans un dépôt PUBLIC n'a aucune
// raison de porter un jeton, fût-il périmé. On garde l'adresse, on remplace la
// valeur.
let CODE_SALON = '';
const caviarder = (t) => t
  .replace(/token=[\w.-]+/g, 'token=…')
  .replace(/code=[A-Z0-9]+/g, 'code=…')
  .replace(/https?:\/\/localhost:\d+/g, 'http://…')
  .replace(CODE_SALON ? new RegExp(CODE_SALON, 'g') : /$^/, '…');

// L'INSTRUMENT SE VÉRIFIE LUI-MÊME. Les deux phrases que l'auteur a signalées ne
// partagent pas trois mots de suite : si la mesure de recouvrement ne les
// rapprochait pas, un constat « aucune redite » ne voudrait rien dire. On garde
// donc les deux rédactions d'origine, telles qu'elles cohabitaient au podium, et
// l'on vérifie que le balayage les aurait bien signalées.
const TEMOIN = [
  'Reste connecté — si l\'animateur relance une partie dans le salon XXXXX, tu y seras automatiquement.',
  'Reste là : si l\'animateur relance une partie, tu y seras ramené sans rien faire.',
];

const mots = (t) => t
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z\s]/g, ' ')
  .split(/\s+/)
  .filter((m) => m.length > 2 && !VIDES.has(m));

function recouvrement(a, b) {
  const A = new Set(mots(a));
  const B = new Set(mots(b));
  if (!A.size || !B.size) return 0;
  let communs = 0;
  for (const m of A) if (B.has(m)) communs += 1;
  return communs / Math.min(A.size, B.size);
}

// LES PHRASES, ET NON LES MORCEAUX DE PHRASE.
//
// Première version : « un élément qui porte du texte et dont aucun descendant
// n'en porte ». Elle avait un angle mort qui touchait précisément ce qu'on
// cherche. La phrase du podium s'écrit :
//
//     Reste là — si l'animateur relance une partie dans le salon <strong>XXXXX</strong>…
//
// Ce `<strong>` est un descendant qui porte du texte : la phrase entière était
// donc écartée, et la redite rapportée par l'auteur serait passée sous le nez du
// balayage censé la trouver.
//
// La bonne règle regarde le DESSIN, pas l'arbre : un élément dont tous les
// enfants sont EN LIGNE forme une phrase lue d'un trait. On ne garde que le plus
// extérieur de ces éléments, pour ne pas compter deux fois la même phrase.
async function phrases(page) {
  return page.evaluate(({ min, contenu }) => {
    const exclus = new Set();
    for (const sel of contenu) {
      for (const el of document.querySelectorAll(sel)) {
        exclus.add(el);
        for (const d of el.querySelectorAll('*')) exclus.add(d);
      }
    }
    const enLigne = (el) => {
      const d = getComputedStyle(el).display;
      return d.startsWith('inline') || el.tagName === 'BR';
    };
    const candidat = (el) => {
      if (exclus.has(el) || !el.checkVisibility?.()) return false;
      if (!(el.textContent || '').trim()) return false;
      return [...el.children].every(enLigne);
    };
    const vus = [];
    for (const el of document.querySelectorAll('body *')) {
      if (!candidat(el)) continue;
      // Le plus EXTÉRIEUR seulement : un `<strong>` dans une phrase est lui aussi
      // un candidat, et rendrait la phrase deux fois.
      let parent = el.parentElement;
      let couvert = false;
      while (parent && parent !== document.body) {
        if (candidat(parent)) { couvert = true; break; }
        parent = parent.parentElement;
      }
      if (couvert) continue;
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (t.length >= min) vus.push(t);
    }
    return vus;
  }, { min: LONGUEUR_MIN, contenu: CONTENU });
}

async function main() {
  rmSync('tests/.data-balayage', { recursive: true, force: true });
  const serveur = spawn('node', ['src/server/index.js'], {
    env: { ...process.env, PORT: String(PORT), DATA_DIR: 'tests/.data-balayage' },
    stdio: 'ignore',
  });
  const attendre = async () => {
    for (let i = 0; i < 60; i += 1) {
      try { if ((await fetch(`${BASE}/api/health`)).ok) return; } catch { /* pas encore là */ }
      await new Promise((r) => { setTimeout(r, 250); });
    }
    throw new Error('serveur injoignable');
  };
  await attendre();

  const navigateur = await chromium.launch();
  const releves = []; // { surface, ecran, texte }
  const noter = async (page, surface, ecran) => {
    for (const t of await phrases(page)) releves.push({ surface, ecran, texte: caviarder(t) });
  };

  try {
    // ---- Le salon, par l'API : le magic link n'a pas sa place ici.
    const s = await (await fetch(`${BASE}/api/rooms`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    })).json();
    CODE_SALON = s.code;

    const ctxHote = await navigateur.newContext({ baseURL: BASE });
    await ctxHote.addInitScript((sess) => localStorage.setItem('host', JSON.stringify(sess)),
      { code: s.code, hostToken: s.hostToken, overlayToken: s.overlayToken });
    const hote = await ctxHote.newPage();
    const studio = await ctxHote.newPage();
    const stream = await ctxHote.newPage();

    await studio.goto('/studio');
    await studio.waitForTimeout(1500);
    await noter(studio, 'studio', 'liste des modules');
    await studio.getByRole('button', { name: 'Nouveau module' }).first().click().catch(() => {});
    await studio.waitForTimeout(800);
    await noter(studio, 'studio', 'éditeur ouvert');

    await stream.goto(`/overlay?token=${s.overlayToken}`);
    await hote.goto('/host');
    await hote.waitForTimeout(1200);
    await noter(hote, 'animateur', 'salon d\'attente');
    await noter(stream, 'stream', 'salon d\'attente');

    const ctxJoueur = await navigateur.newContext({ baseURL: BASE });
    const joueur = await ctxJoueur.newPage();
    await joueur.goto('/');
    await noter(joueur, 'joueur', 'formulaire d\'entrée');
    const cases = joueur.getByTestId('join-code').getByRole('textbox');
    for (const [i, ch] of [...s.code].entries()) await cases.nth(i).fill(ch);
    await joueur.getByTestId('join-pseudo').fill('Balayage');
    await joueur.getByTestId('join-submit').click();
    await joueur.waitForTimeout(1200);
    await noter(joueur, 'joueur', 'salon d\'attente');

    await hote.getByRole('button', { name: 'Lancer la partie' }).click();
    await hote.getByRole('menuitem', { name: 'Lancer Quiz' }).click();
    await joueur.waitForTimeout(1200);
    await noter(hote, 'animateur', 'question en cours');
    await noter(joueur, 'joueur', 'question en cours');
    await noter(stream, 'stream', 'question en cours');

    await joueur.getByTestId('answer-option').first().click();
    await joueur.waitForTimeout(600);
    await noter(joueur, 'joueur', 'réponse envoyée');
    await hote.getByRole('button', { name: 'Révéler maintenant' }).click();
    await joueur.waitForTimeout(1800);
    await noter(hote, 'animateur', 'révélation');
    await noter(joueur, 'joueur', 'résultat de manche');
    await noter(stream, 'stream', 'révélation');

    await hote.getByRole('button', { name: 'Voir le classement' }).click().catch(() => {});
    await hote.waitForTimeout(800);
    await noter(hote, 'animateur', 'classement');

    // ---- La fin de partie : l'écran où la redite a été rapportée.
    await hote.getByRole('button', { name: 'Menu' }).click();
    await hote.getByRole('menuitem', { name: 'Terminer la partie' }).click();
    await hote.getByRole('menuitem', { name: /Confirmer/ }).click();
    await joueur.waitForTimeout(2000);
    await noter(hote, 'animateur', 'podium final');
    await noter(joueur, 'joueur', 'écran de fin');
    await noter(stream, 'stream', 'podium final');
  } finally {
    await navigateur.close();
    serveur.kill();
    rmSync('tests/.data-balayage', { recursive: true, force: true });
  }

  // ---- LE CONSTAT. On compare toutes les paires d'un MÊME écran (une redite se
  // vit sur un écran, pas entre deux surfaces qu'on ne voit jamais ensemble),
  // puis toutes les paires d'une même surface.
  const paires = [];
  for (let i = 0; i < releves.length; i += 1) {
    for (let j = i + 1; j < releves.length; j += 1) {
      const a = releves[i]; const b = releves[j];
      if (a.surface !== b.surface) continue;
      if (a.texte === b.texte && a.ecran !== b.ecran) continue; // même phrase, deux instants : normal
      const r = recouvrement(a.texte, b.texte);
      if (r >= SEUIL) paires.push({ a, b, r });
    }
  }
  paires.sort((x, y) => y.r - x.r);

  const temoin = recouvrement(TEMOIN[0], TEMOIN[1]);
  if (temoin < SEUIL) {
    console.error(`ÉTALONNAGE RATÉ : les deux phrases témoins ne se recouvrent qu'à ${Math.round(temoin * 100)} % `
      + `pour un seuil de ${Math.round(SEUIL * 100)} %. Le balayage ne verrait pas la redite qu'il cherche.`);
    process.exit(1);
  }

  const date = new Date().toISOString().slice(0, 10);
  const lignes = [
    `# Balayage des redites — ${date}`,
    '',
    'Constat **daté et révisable** (chantier v4, décision 10.4). Le contrôle de',
    'non-redite n\'est pas un garde-fou permanent : les quatre surfaces ont été',
    'vérifiées une fois, à cette date (décision 10.3). Une redite introduite après',
    'coup ne sera pas signalée.',
    '',
    `Produit par \`tests/outils/balayage-redites.mjs\`. Seuil de recouvrement : ${SEUIL}.`,
    '',
    `**Étalonnage.** Les deux rédactions concurrentes rapportées par l'auteur se`,
    `recouvrent à **${Math.round(temoin * 100)} %** — au-dessus du seuil. L'instrument voit donc bien`,
    'la redite pour laquelle il a été écrit ; « aucune redite » ci-dessous veut dire',
    'quelque chose.',
    '',
    `Phrases relevées : **${releves.length}**, sur ${new Set(releves.map((r) => `${r.surface}/${r.ecran}`)).size} écrans.`,
    '',
    '## Écrans balayés',
    '',
    '| Surface | Écran | Phrases |',
    '| --- | --- | --- |',
  ];
  const parEcran = new Map();
  for (const r of releves) {
    const k = `${r.surface}|${r.ecran}`;
    parEcran.set(k, (parEcran.get(k) || 0) + 1);
  }
  for (const [k, n] of parEcran) lignes.push(`| ${k.split('|')[0]} | ${k.split('|')[1]} | ${n} |`);
  lignes.push('', '## Redites relevées', '');
  if (!paires.length) {
    lignes.push('**Aucune.** Aucune paire de phrases d\'un même écran ne partage plus de',
      `${Math.round(SEUIL * 100)} % de son vocabulaire utile.`);
  } else {
    for (const p of paires) {
      lignes.push(`- **${p.a.surface} — ${p.a.ecran}** · recouvrement ${Math.round(p.r * 100)} %`,
        `  - « ${p.a.texte} »`, `  - « ${p.b.texte} » *(${p.b.ecran})*`);
    }
  }
  // LES PHRASES BALAYÉES, ÉCRAN PAR ÉCRAN. Sans elles, le constat serait
  // invérifiable : « aucune redite » ne vaut que si l'on peut voir CE QUI a été
  // regardé — et c'est ce qui rend le constat révisable (décision 10.4).
  lignes.push('', '## Ce qui a été lu', '');
  let ecranCourant = '';
  for (const r of releves) {
    const k = `${r.surface} — ${r.ecran}`;
    if (k !== ecranCourant) { lignes.push('', `**${k}**`, ''); ecranCourant = k; }
    lignes.push(`- ${r.texte}`);
  }
  lignes.push('');
  writeFileSync(`docs/BALAYAGE-REDITES-${date}.md`, lignes.join('\n'), 'utf-8');

  console.log(`${releves.length} phrases relevées sur ${parEcran.size} écrans.`);
  for (const p of paires) {
    console.log(`  ${Math.round(p.r * 100)} % — ${p.a.surface}/${p.a.ecran}`);
    console.log(`     « ${p.a.texte} »`);
    console.log(`     « ${p.b.texte} »`);
  }
  console.log(`${paires.length} redite(s). Constat écrit dans docs/BALAYAGE-REDITES-${date}.md`);
}

main().catch((e) => { console.error(e); process.exit(1); });
