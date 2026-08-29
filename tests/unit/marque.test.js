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

  it('AUCUN ANCIEN NOM ne traîne dans le code client', () => {
    // CE QUE CE CONTRÔLE AJOUTE, ET POURQUOI IL A FALLU L'AJOUTER.
    //
    // Le contrôle ci-dessus interdit d'ÉCRIRE EN DUR LE NOM ACTUEL. Il est aveugle
    // au cas symétrique : un ANCIEN nom resté en place. Or c'est exactement ce qui
    // est arrivé au changement de nom — la carte que le joueur partage, dessinée
    // sur un canevas à l'écart de tout le HTML, portait encore « PROJECT GAME
    // SHOW » en capitales, seule de toute l'application. Le contrôle de l'action
    // 19 passait au vert, puisqu'il cherchait le nom NOUVEAU.
    //
    // C'est le pire endroit possible pour cet oubli : la carte partagée est la
    // seule chose que des gens EXTÉRIEURS à la partie voient jamais, et celle
    // qu'on relit le moins, puisqu'elle n'apparaît nulle part dans l'interface.
    //
    // Toute rebaptisation future ajoute son ancien nom à cette liste.
    const ANCIENS_NOMS = ['Project Game Show'];
    for (const f of SOURCES_CLIENT) {
      const src = fs.readFileSync(f, 'utf8');
      // Les commentaires peuvent citer un ancien nom pour l'expliquer — comme
      // celui-ci. Seul le code compte.
      const code = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
      for (const ancien of ANCIENS_NOMS) {
        for (const forme of [ancien, ancien.toUpperCase(), ancien.toLowerCase()]) {
          expect(code.includes(forme), `« ${forme} » traîne encore dans ${f}`).toBe(false);
        }
      }
    }
  });

  it('le nom ne peut pas être vide ni laissé à un gabarit', () => {
    expect(NOM_DU_JEU.trim().length).toBeGreaterThan(0);
    expect(NOM_DU_JEU).not.toMatch(/\{|\}|TODO|À DÉFINIR/i);
  });
});
