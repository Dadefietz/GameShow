// CONTRÔLE DE COHÉRENCE DU NOM (action 19 du PLAN-CHANTIER-v1).
//
// Le nom du jeu était écrit en dur à dix endroits. Le changer demandait une
// fouille, avec la garantie d'en oublier un — et un nom à moitié changé est pire
// qu'un nom provisoire assumé : il donne l'impression d'un produit inachevé.
//
// Ce contrôle garantit qu'il n'existe plus qu'UNE source, et que les trois
// endroits qui ne peuvent pas la lire — la page d'accueil, servie avant que le
// code ne s'exécute — restent d'accord avec elle.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { NOM_DU_JEU } from '../../src/client/shared/marque.js';

const SOURCES_CLIENT = [
  'src/client/host/HostApp.jsx',
  'src/client/play/PlayApp.jsx',
  'src/client/overlay/OverlayApp.jsx',
  'src/client/studio/StudioApp.jsx',
  'src/client/shared/BrandLoader.jsx',
];

describe('nom du jeu', () => {
  it('n\'est écrit en dur nulle part dans le code client', () => {
    // Le jour du choix définitif, une seule ligne doit changer.
    for (const f of SOURCES_CLIENT) {
      const src = fs.readFileSync(f, 'utf8');
      expect(src.includes(NOM_DU_JEU), `« ${NOM_DU_JEU} » écrit en dur dans ${f}`).toBe(false);
    }
  });

  it('la page d\'accueil dit la même chose que la source', () => {
    // index.html est servi AVANT que le code ne s'exécute : il ne peut pas lire
    // la valeur, il doit donc être vérifié. Titre d'onglet, carte de partage et
    // écran de démarrage sont les trois premières choses que voit un joueur.
    const html = fs.readFileSync('index.html', 'utf8');
    const titre = html.match(/<title>([^<]+)<\/title>/)?.[1];
    expect(titre, "l'onglet ne porte pas le nom du jeu").toContain(NOM_DU_JEU);

    const og = html.match(/property="og:title"\s+content="([^"]+)"/)?.[1];
    expect(og, 'la carte de partage ne porte pas le nom du jeu').toContain(NOM_DU_JEU);

    const boot = html.match(/class="boot__name">([^<]+)</)?.[1];
    expect(boot, "l'écran de démarrage ne porte pas le nom du jeu").toBe(NOM_DU_JEU);
  });

  it('le nom ne peut pas être vide ni laissé à un gabarit', () => {
    expect(NOM_DU_JEU.trim().length).toBeGreaterThan(0);
    expect(NOM_DU_JEU).not.toMatch(/\{|\}|TODO|À DÉFINIR/i);
  });
});
