// CONTRÔLE DE LA MARQUE — un seul dessin, deux états (chantier v2, action 5).
//
// CE QUI S'ÉTAIT PASSÉ. Trois exemplaires de la même flamme vivaient dans le
// projet, recopiés à la main. Deux étaient identiques ; le troisième — l'icône
// d'onglet — avait DIVERGÉ : grille 32 au lieu de 24, trait 2,6 au lieu de 2,1,
// et une plaque de fond. Personne ne l'avait vu, parce que rien ne regardait.
//
// La planche de design dit pourtant : « Version animée — flamme qui respire,
// braise qui scintille, escarbille qui monte. La version statique n'existe qu'en
// favicon. » UNE marque, DEUX états.
//
// CE QUE CE FICHIER VÉRIFIE. Que l'icône d'onglet et l'écran d'amorçage — les
// deux seuls endroits qui ne peuvent PAS importer le module partagé, parce
// qu'ils sont servis avant que le code ne s'exécute — portent exactement la
// géométrie de référence. Une divergence ne peut plus être silencieuse.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { FLAMME, hrefIcone } from '../../src/client/shared/marque-flamme.js';

const INDEX = fs.readFileSync('index.html', 'utf8');

// Les `d` de tous les tracés d'un fragment de balisage, dans l'ordre.
function traces(balisage) {
  return [...balisage.matchAll(/<path[^>]*\sd=['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

describe('la marque n\'a qu\'une géométrie', () => {
  it('l\'icône d\'onglet est EXACTEMENT celle que produit la référence', () => {
    // La forme la plus forte du contrôle : on ne compare pas des morceaux, on
    // compare la chaîne entière. Si quelqu'un retouche l'icône à la main —
    // c'est ainsi que la divergence est née — le contrôle rougit aussitôt.
    const m = INDEX.match(/<link rel="icon" href="([^"]+)"/);
    expect(m, 'aucune icône d\'onglet déclarée dans index.html').not.toBeNull();
    expect(m[1]).toBe(hrefIcone());
  });

  it('l\'écran d\'amorçage porte la MÊME flamme', () => {
    // Il est servi avant que React ne monte : il ne peut pas importer le module.
    // C'est précisément le genre d'endroit où une copie dérive.
    const bloc = INDEX.match(/<svg class="boot__emblem"[\s\S]*?<\/svg>/);
    expect(bloc, 'aucune flamme sur l\'écran d\'amorçage').not.toBeNull();
    expect(traces(bloc[0])).toEqual([FLAMME.flamme, ...FLAMME.buches]);
  });

  it('la braise est au même endroit dans les deux états', () => {
    const bloc = INDEX.match(/<svg class="boot__emblem"[\s\S]*?<\/svg>/)[0];
    const c = bloc.match(/<circle[^>]*cx="([\d.]+)"[^>]*cy="([\d.]+)"[^>]*r="([\d.]+)"/);
    expect(c, 'la braise manque sur l\'écran d\'amorçage').not.toBeNull();
    expect([Number(c[1]), Number(c[2]), Number(c[3])])
      .toEqual([FLAMME.braise.cx, FLAMME.braise.cy, FLAMME.braise.r]);
  });

  it('aucune trace du PNG du tipi ne subsiste', () => {
    // DÉCISION 5.4. C'était une TROISIÈME marque, montrée en premier à chaque
    // chargement : l'identité changeait en cours de route, puis changeait encore
    // quand React prenait la main.
    expect(INDEX).not.toContain('avatar-emblem-tipi');
    expect(fs.existsSync('src/public/assets/avatar-emblem-tipi.png')).toBe(false);
    expect(fs.existsSync('design/assets/avatar-emblem-tipi-v1.png')).toBe(false);

    // Et il ne reste pas non plus dans les registres — un actif supprimé qui
    // resterait déclaré ferait échouer le contrôle de cohérence du dépôt.
    for (const registre of ['.artifact.yaml', 'docs/PIPELINE-INDEX.yaml',
      'design/assets/assets-manifest.yaml']) {
      expect(fs.readFileSync(registre, 'utf8'), `${registre} déclare encore le tipi`)
        .not.toContain('avatar-emblem-tipi');
    }
  });

  it('l\'icône d\'onglet ne s\'anime pas', () => {
    // DÉCISION 5.3. Les navigateurs n'animent pas un SVG d'onglet : il faudrait
    // redessiner un canevas en boucle, sur chaque page ouverte, pour un effet
    // que les joueurs — en plein écran sur téléphone — ne verraient jamais.
    const m = INDEX.match(/<link rel="icon" href="([^"]+)"/)[1];
    for (const interdit of ['%3Canimate', 'animate', 'begin=', 'dur=']) {
      expect(decodeURIComponent(m)).not.toContain(interdit);
    }
  });
});
