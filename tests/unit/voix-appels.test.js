// GARDE-FOU — la voix n'est joignable que par des crochets (chantier v3, décision 2).
//
// CE QUI S'EST PASSÉ. Un seul appel, écrit dans le corps du rendu d'un composant :
//
//     const phraseVoix = momentVoix ? dire(momentVoix, { … }) : null;
//
// Il s'exécutait à chaque re-rendu. Sur l'écran de résultat, l'animation du score
// en provoque une cinquantaine en 900 ms : le joueur voyait défiler la liste
// entière au lieu d'en lire une. Et comme `dire()` mémorise ce qu'elle a servi,
// le vivier de non-répétition était épuisé puis remis à zéro dix fois par écran.
//
// LA PREMIÈRE VERSION DE CE GARDE-FOU BALAYAIT LES SOURCES à la recherche
// d'appels hors état/effet/mémo. Elle a été abandonnée, et il faut dire pourquoi :
// éprouvée sur le code fautif d'origine, elle l'a LAISSÉ PASSER. Sa neutralisation
// des chaînes prenait toute apostrophe pour un début de littéral — y compris
// celles du texte JSX, « n'a », « d'écran » — et blanchissait des pans entiers du
// fichier, dont l'appel qu'elle devait attraper. Un garde-fou qui ne garde rien
// est pire que pas de garde-fou : il rassure.
//
// CE QUE FAIT CELUI-CI. Il ne cherche plus à comprendre le code : il vérifie QUI
// A LE DROIT d'importer la voix. Un composant qui ne peut pas l'importer ne peut
// pas l'appeler au mauvais endroit. La faute devient impossible par construction
// plutôt qu'improbable, et le contrôle tient en une lecture d'imports — rien à
// analyser, rien à tromper.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const RACINE = 'src/client';
const REGISTRE = 'src/client/shared/voix.js';
// Le SEUL module autorisé à joindre la voix. Petit, sans JSX, relu, et tenu par
// les deux contrôles de bout en bout : une phrase par manche, et une phrase
// nouvelle à chaque manche.
const PORTIER = 'src/client/shared/voix-hooks.js';

function sources(dossier) {
  const out = [];
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) out.push(...sources(p));
    else if (/\.(jsx?|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

// Les noms importés depuis voix.js par ce fichier, quelle que soit la forme du
// chemin relatif.
function importeDepuisVoix(src) {
  const noms = [];
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"][^'"]*voix\.js['"]/g)) {
    noms.push(...m[1].split(',').map((n) => n.trim().split(/\s+as\s+/)[0]).filter(Boolean));
  }
  // Un import par défaut ou en étoile contournerait la règle : on les compte aussi.
  if (/import\s+(?:\*\s+as\s+)?\w+\s*(?:,\s*\{[^}]*\}\s*)?from\s*['"][^'"]*voix\.js['"]/.test(src)) {
    noms.push('*');
  }
  return noms;
}

describe('la voix n\'est joignable que par des crochets', () => {
  it('aucun fichier hors du portier n\'importe la voix', () => {
    const fautes = [];
    for (const f of sources(RACINE)) {
      if (path.normalize(f) === path.normalize(REGISTRE)) continue;
      if (path.normalize(f) === path.normalize(PORTIER)) continue;
      const noms = importeDepuisVoix(fs.readFileSync(f, 'utf8'));
      if (noms.length) fautes.push(`${f} importe { ${noms.join(', ')} } depuis voix.js`);
    }
    expect(fautes, `${fautes.join('\n')}\n\n`
      + 'La voix ne s\'appelle pas depuis un composant : appelée pendant un rendu,\n'
      + 'elle tire une phrase neuve à chaque re-rendu. Emploie un crochet de\n'
      + 'src/client/shared/voix-hooks.js, ou ajoutes-y le tien.').toEqual([]);
  });

  it('le portier existe et expose bien les crochets attendus', () => {
    const src = fs.readFileSync(PORTIER, 'utf8');
    for (const crochet of ['usePhraseQuiTourne', 'usePhraseDeManche', 'useVoixDePlateau']) {
      expect(src, `${PORTIER} n'exporte plus ${crochet}`).toContain(`export function ${crochet}`);
    }
  });

  it('le contrôle sait reconnaître un import fautif', () => {
    // Un garde-fou qui n'a jamais rien attrapé ne prouve rien — et le précédent
    // avait justement échoué à cet examen-là, qu'on ne lui avait pas fait passer.
    expect(importeDepuisVoix("import { dire } from '../shared/voix.js';")).toEqual(['dire']);
    expect(importeDepuisVoix("import { dire, momentDePlateau } from './voix.js';"))
      .toEqual(['dire', 'momentDePlateau']);
    expect(importeDepuisVoix("import * as voix from '../shared/voix.js';")).toContain('*');
    // Et qu'il ne crie pas au loup sur un import voisin.
    expect(importeDepuisVoix("import { usePhraseDeManche } from '../shared/voix-hooks.js';")).toEqual([]);
    expect(importeDepuisVoix("// import { dire } from './voix.js'; — retiré")).toEqual(['dire']);
  });
});
