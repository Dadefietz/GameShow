// TOUT APPEL DU STUDIO À L'API PORTE L'EN-TÊTE D'ANIMATEUR.
//
// LE DÉFAUT QUE CE CONTRÔLE GARDE, ET QUI S'EST PRODUIT TROIS FOIS.
//
// Les routes `/api/...` du Studio sont derrière `requireHost`. En développement,
// l'autorisation est OUVERTE — pas de HOST_EMAIL, pas de Supabase — et un appel
// sans en-tête passe. En production, où HOST_EMAIL est configuré, le même appel
// répond 403. Le symptôme est donc invisible partout où l'on travaille, et total
// là où l'on diffuse.
//
// Il a coûté trois fois :
//   1. `/api/modules` — les questions du Studio n'arrivaient jamais en partie, et
//      le Studio basculait en « local » sans que rien ne l'explique ;
//   2. `/api/cache/catalogue` — l'écran de modération de « Cache-cache » restait
//      VIDE sur le site déployé : zéro question, zéro image, aucun message. Un
//      panneau vide ne se distingue pas d'une banque effacée ;
//   3. `/api/cache/image` — aucun dépôt d'image ne pouvait aboutir.
//
// POURQUOI CE CONTRÔLE LIT LE CODE SOURCE. Un contrôle de bout en bout ne le
// verrait pas : la campagne tourne précisément dans le mode où l'autorisation est
// ouverte. Il faudrait une campagne entière avec HOST_EMAIL et une vraie session
// Supabase — ce qui n'existe pas hors de l'hébergeur. L'invariant, lui, se lit :
// un `fetch` vers `/api` dans le Studio passe par `entetesHote()`.
//
// C'est le même genre de garde que les autres verrous du dépôt — « tout module
// déclare ses moments de voix », « tout jeton de couleur existe ». Ils lisent la
// forme du code parce que c'est la forme qui se casse.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const RACINE = path.resolve(process.cwd(), 'src/client');

function fichiersDu(dossier) {
  const out = [];
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) out.push(...fichiersDu(p));
    else if (/\.(js|jsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

// Un appel = le `fetch(` et ce qui suit jusqu'à la parenthèse fermante de son
// deuxième argument. On se contente d'une fenêtre : le but n'est pas d'analyser
// le JavaScript, c'est de rendre l'oubli VISIBLE.
function appelsApi(source) {
  const out = [];
  const re = /fetch\(\s*(['"`])(\/api\/[^'"`]*)\1/g;
  let m;
  while ((m = re.exec(source))) {
    // La fenêtre couvre les options de l'appel ; 400 caractères suffisent
    // largement, le plus long du fichier en fait 180.
    out.push({ route: m[2], fenetre: source.slice(m.index, m.index + 400) });
  }
  return out;
}

describe("les appels du Studio à l'API", () => {
  const fichiers = fichiersDu(RACINE).filter((f) => f.includes(`${path.sep}studio${path.sep}`));

  it('le Studio existe bien là où on le cherche', () => {
    expect(fichiers.length, 'aucun fichier de Studio trouvé : le contrôle ne garde rien').toBeGreaterThan(0);
  });

  it('portent TOUS un en-tête d\'animateur', () => {
    const nus = [];
    for (const f of fichiers) {
      for (const { route, fenetre } of appelsApi(fs.readFileSync(f, 'utf8'))) {
        if (!/entetesHote\s*\(/.test(fenetre)) nus.push(`${path.basename(f)} → ${route}`);
      }
    }
    expect(nus,
      "ces appels passeront en développement et répondront 403 en production :\n  " + nus.join('\n  ')).toEqual([]);
  });

  it('et il y en a bien plusieurs — le contrôle ne garde pas le vide', () => {
    // UN CONTRÔLE QUI NE TROUVE RIEN À VÉRIFIER EST VERT POUR RIEN. Si un jour le
    // Studio cesse d'appeler l'API directement, ce contrôle doit tomber plutôt
    // que de rassurer.
    const total = fichiers.reduce((n, f) => n + appelsApi(fs.readFileSync(f, 'utf8')).length, 0);
    expect(total, "le Studio n'appelle plus l'API : ce contrôle ne garde plus rien").toBeGreaterThanOrEqual(4);
  });

  it('couvre nommément les trois routes qui ont déjà failli', () => {
    const tout = fichiers.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
    for (const route of ['/api/modules', '/api/cache/catalogue', '/api/cache/image']) {
      expect(tout, `${route} n'est plus appelée : le contrôle ne la garde plus`).toContain(route);
    }
  });
});
