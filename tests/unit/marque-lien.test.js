// CONTRÔLE DE L'EMBLÈME DU LIEN — les deux chaînons.
//
// CE QUI S'EST PASSÉ, ET QUE RIEN NE VOYAIT. Le dessin a été refait sur une image
// de référence fournie par l'auteur. Les DEUX premiers essais étaient fautifs, et
// d'aucune façon détectable :
//   - le premier écartait les maillons de 11,31 pour des pointes à 6,45 : ils se
//     fondaient l'un dans l'autre, la chaîne ne se lisait plus comme rompue ;
//   - le second resserrait le maillon à 3,1 de rayon, ce qui ne laissait plus que
//     4,1 de jour intérieur pour une amorce de 2,1 d'épaisseur : le maillon
//     devenait une tache pleine fendue d'une rainure.
// Dans les deux cas il a fallu RENDRE le dessin à l'écran et le regarder.
//
// Un tracé SVG écrit à la main est illisible pour une machine — c'est pour cela
// que rien ne regardait. `marque-lien.js` déclare donc ses mesures en clair et
// produit ses tracés ; ce fichier vérifie les mesures. Chacun des contrôles
// ci-dessous a été vu ROUGE sur le défaut qu'il garde avant d'être retenu.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import {
  GRILLE, TRAIT, MAILLON, AMORCE, ECART, CHAINONS,
  jourDuMaillon, pointeDuMaillon, sailliePosee, jourEntreMaillons,
  jeuDeLAmorce, margeDeGrille,
} from '../../src/client/shared/marque-lien.js';
import { TAILLE_MIN_AMORCE } from '../../src/client/shared/Chainons.jsx';

const SURFACES = ['src/client/play/PlayApp.jsx', 'src/client/overlay/OverlayApp.jsx'];

describe('l\'emblème du lien tient sa géométrie', () => {
  it('le maillon garde un jour LARGE devant son amorce', () => {
    // LE DÉFAUT GARDÉ : le second essai, à 3,1 de rayon, laissait 4,1 de jour
    // pour une amorce de 2,1 — soit deux filets de 1 de part et d'autre. À
    // l'écran, le maillon se refermait.
    //
    // Le seuil est le double du trait : il faut au moins autant de vide autour de
    // l'amorce que l'amorce n'est épaisse, sans quoi le dessin devient une tache.
    expect(jourDuMaillon()).toBeGreaterThanOrEqual(2 * TRAIT);
  });

  it('les deux maillons ne se touchent pas', () => {
    // LE DÉFAUT GARDÉ : le premier essai les faisait fusionner. Une chaîne rompue
    // dont les maillons se rejoignent ne dit plus rien.
    expect(jourEntreMaillons()).toBeGreaterThanOrEqual(0.5);
  });

  it('l\'amorce reste à l\'intérieur de son maillon', () => {
    // Son bout est arrondi : il va `DEBORD` plus loin que le tracé. Une amorce
    // qui traverse sa paroi transformerait le maillon rompu en maillon barré —
    // c'est-à-dire en l'ANCIEN dessin, celui que l'auteur a demandé de remplacer.
    expect(jeuDeLAmorce()).toBeGreaterThanOrEqual(0);
  });

  it('l\'emblème entier tient dans la grille', () => {
    // Un débordement ne fait pas rougir un navigateur : il RECADRE, et le dessin
    // arrive rogné sur la toile du stream sans que rien ne le signale.
    expect(margeDeGrille()).toBeGreaterThan(0);

    // Et la saillie se calcule comme celle d'un oblong, pas d'un rectangle : la
    // première tentative surestimait de moitié et a fait rejeter à tort une
    // géométrie qui tenait. Repère fixe, à la main, pour que la formule ne parte
    // pas à la dérive.
    expect(sailliePosee()).toBeCloseTo(5.923, 3);
    expect(pointeDuMaillon()).toBeCloseTo(MAILLON.demiLongueur + TRAIT / 2, 6);
  });

  it('les tracés SORTENT des mesures, ils ne sont pas écrits à côté', () => {
    // C'est ce qui rend tous les contrôles ci-dessus opérants : vérifier les
    // mesures ne prouve rien si le dessin est recopié à la main ailleurs.
    expect(CHAINONS.viewBox).toBe(`0 0 ${GRILLE} ${GRILLE}`);
    expect(CHAINONS.trait).toBe(TRAIT);
    expect(CHAINONS.maillon).toContain(`A${MAILLON.rayon} ${MAILLON.rayon}`);
    expect(CHAINONS.amorce).toBe(`M${AMORCE.debut} 0H${AMORCE.fin}`);

    // Les deux copies sont symétriques par rapport au centre de la grille, et
    // séparées de l'écart déclaré.
    const [a, b] = CHAINONS.copies;
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(ECART, 2);
    expect((a.x + b.x) / 2).toBeCloseTo(GRILLE / 2, 6);
    expect((a.y + b.y) / 2).toBeCloseTo(GRILLE / 2, 6);
    expect([a.amorce, b.amorce]).toEqual([1, -1]);
  });
});

describe('l\'emblème du lien n\'a qu\'un rendu', () => {
  it('AUCUNE surface ne redessine les chaînons', () => {
    // CE QUI S'ÉTAIT PASSÉ. `Chainons` dans PlayApp.jsx et `ChainonsStream` dans
    // OverlayApp.jsx étaient deux fonctions strictement identiques, recopiées.
    // La géométrie était partagée ; le rendu ne l'était pas. Changer la forme du
    // tracé — ce qui vient d'arriver — aurait laissé l'une des deux en arrière,
    // c'est-à-dire un emblème juste sur les téléphones et faux à l'antenne.
    for (const f of SURFACES) {
      const src = fs.readFileSync(f, 'utf8');
      expect(src, `${f} importe la géométrie brute au lieu du composant`)
        .not.toContain('marque-lien.js');
      expect(src, `${f} redessine les chaînons`).not.toContain('CHAINONS');
    }
  });

  it('le seuil de l\'amorce laisse de quoi la voir, et couvre les tailles appelées', () => {
    // Le vide de chaque côté de l'amorce, ramené aux pixels de l'écran. À 34 px
    // il ne fait plus que 2,1 px et le maillon se referme — c'est mesuré, sur la
    // planche d'aperçu du chantier. Le composant retire donc l'amorce sous le
    // seuil, et le seuil doit garantir au moins 3 px.
    const jourEnPixels = (t) => ((jourDuMaillon() - TRAIT) / 2 / GRILLE) * t;
    expect(jourEnPixels(TAILLE_MIN_AMORCE)).toBeGreaterThanOrEqual(3);

    // Et les tailles réellement demandées tombent du bon côté du seuil.
    //
    // LA MARQUE EN LIGNE DU JOUEUR EST PASSÉE DE 34 À 56 : les deux mots du
    // « Lien » ne s'affichent plus qu'une fois sur son écran, au milieu, séparés
    // par l'emblème. Celui-ci n'est plus un rappel discret sous un énoncé répété —
    // il EST l'énoncé. À 56 il retrouve donc son amorce, tout juste : c'est le
    // plancher, mesuré, en dessous duquel le maillon se referme.
    const appelees = SURFACES.flatMap((f) =>
      [...fs.readFileSync(f, 'utf8').matchAll(/<Chainons taille=\{(\d+)\}/g)]
        .map((m) => Number(m[1])));
    expect(appelees.sort((x, y) => x - y)).toEqual([56, 64, 92, 180]);
    expect(appelees.every((t) => t >= TAILLE_MIN_AMORCE),
      'une taille appelée est passée sous le plancher de l\'amorce').toBe(true);
  });
});
