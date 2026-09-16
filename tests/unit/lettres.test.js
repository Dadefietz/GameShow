// LES CHOIX SONT LETTRÉS — TOUS, ET PARTOUT.
//
// CE QUI A ÉTÉ RAPPORTÉ (15/09) : « les choix sont numérotés par des lettres.
// Au-delà de 6 choix, on passe à une numérotation par chiffre. Il faut que ce soit
// uniquement des lettres. Dans l'exemple, les choix 7, 8 et 9 devraient être G, H
// et I. »
//
// DEUX CONTRÔLES POUR DEUX CHOSES DIFFÉRENTES.
//
// Le premier vérifie la RÈGLE : la septième lettre est G. Il tiendrait aussi bien
// si la table était recopiée dans trois fichiers.
//
// Le second vérifie qu'elle ne l'est PAS — et c'est celui qui garde vraiment la
// demande. La table `['A' … 'F']` était écrite trois fois, une par surface, chacune
// avec son propre repli vers les chiffres. Corriger une table en aurait laissé
// deux ; corriger les trois aurait laissé la quatrième surface à venir. C'est le
// même piège que la flamme, recopiée trois fois avant d'être rassemblée.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { lettreDeChoix, NOMBRE_DE_LETTRES } from '../../src/client/shared/lettres.js';

describe('la lettre d\'un choix', () => {
  it('est une LETTRE au-delà du sixième — le cas rapporté', () => {
    expect([0, 1, 2, 3, 4, 5].map(lettreDeChoix)).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    // Les trois de la capture : « les choix 7, 8 et 9 devraient être G, H et I ».
    expect([6, 7, 8].map(lettreDeChoix)).toEqual(['G', 'H', 'I']);
  });

  it('ne rend JAMAIS un chiffre, quel que soit le rang', () => {
    for (let i = 0; i < NOMBRE_DE_LETTRES; i += 1) {
      expect(lettreDeChoix(i), `rang ${i}`).toMatch(/^[A-Z]$/);
    }
    expect(NOMBRE_DE_LETTRES).toBe(26);
  });

  it('rend le vide plutôt qu\'une absurdité hors de la table', () => {
    // MIEUX VAUT UNE PASTILLE VIDE QU'UN « 27 » : la pastille est décorative — elle
    // est `aria-hidden` sur les trois surfaces — et le libellé du choix, lui, reste
    // lisible. Une question à vingt-sept choix a de toute façon un autre problème,
    // et le contrôle de `choix-visibles.spec.js` s'en charge.
    for (const cas of [-1, 26, 99, null, undefined, 1.5, 'A']) {
      expect(lettreDeChoix(cas), `« ${cas} »`).toBe('');
    }
  });
});

describe('la table des lettres n\'est écrite qu\'une fois', () => {
  const SURFACES = ['host/HostApp.jsx', 'play/PlayApp.jsx', 'overlay/OverlayApp.jsx']
    .map((f) => path.resolve(process.cwd(), 'src/client', f));

  it('les trois surfaces la demandent au lieu de la recopier', () => {
    for (const f of SURFACES) {
      const src = fs.readFileSync(f, 'utf8');
      expect(src, `${path.basename(f)} ne demande pas la lettre au module partagé`)
        .toContain("from '../shared/lettres.js'");
      // AUCUNE TABLE LOCALE, sous quelque nom que ce soit : ce qu'on cherche c'est
      // une suite de lettres entre crochets ou entre guillemets.
      expect(src, `${path.basename(f)} porte de nouveau sa propre table de lettres`)
        .not.toMatch(/\[\s*'A'\s*,\s*'B'/);
      expect(src, `${path.basename(f)} porte une chaîne de lettres qui y ressemble`)
        .not.toMatch(/'ABCDEF/);
    }
  });

  it('et aucune ne retombe sur un chiffre', () => {
    // LE REPLI ÉTAIT LE SYMPTÔME : `KEYS[i] || i + 1` donnait « 7 » au septième
    // choix. Il ne doit revenir sous aucune forme.
    for (const f of SURFACES) {
      const src = fs.readFileSync(f, 'utf8');
      expect(src, `${path.basename(f)} retombe sur un chiffre`)
        .not.toMatch(/lettreDeChoix\([^)]*\)\s*\|\|/);
    }
  });
});
