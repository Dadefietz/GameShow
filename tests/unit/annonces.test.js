// L'ÉCRAN D'ATTENTE DE CHAQUE JEU — sur les téléphones ET à l'antenne.
//
// LA CONSIGNE EST GÉNÉRALE : « chaque module doit comporter un écran d'attente
// lorsque l'animateur le lance ». Deux registres la servent — `ANNONCES` dans
// `PlayApp.jsx`, `ANNONCES_STREAM` dans `OverlayApp.jsx` — et ils sont écrits à
// la main, jeu par jeu.
//
// CE QUE CE CONTRÔLE A COÛTÉ DE NE PAS EXISTER. « Coupe ta bûche » avait son
// jingle sur les téléphones et AUCUN à l'antenne : le public voyait le titre du
// jeu sur un fond vide, sans emblème ni règle, pendant que le cercle regardait
// une bûche et une hache. Rien ne cassait, rien ne remontait — il a fallu
// regarder les deux écrans côte à côte pour le voir. Un jeu ajouté à un seul des
// deux registres échoue désormais ici.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { MODULE_TYPES } from '../../src/server/modules.js';

// Le bloc d'un registre, isolé de son fichier : on ne lit pas le reste de
// l'écran, où le nom d'un type peut apparaître pour dix autres raisons.
function registre(fichier, ouverture, fermeture) {
  const src = fs.readFileSync(fichier, 'utf8');
  const debut = src.indexOf(ouverture);
  expect(debut, `${ouverture} introuvable dans ${fichier}`).toBeGreaterThan(-1);
  const fin = src.indexOf(fermeture, debut);
  expect(fin, `fin du registre introuvable dans ${fichier}`).toBeGreaterThan(debut);
  return src.slice(debut, fin);
}

const SURFACES = [
  { nom: 'les téléphones', bloc: registre('src/client/play/PlayApp.jsx', 'const ANNONCES = {', '\nfunction AnnonceScreen') },
  { nom: "l'antenne", bloc: registre('src/client/overlay/OverlayApp.jsx', 'const ANNONCES_STREAM = {', '\nfunction AnnonceStage') },
];

describe("l'écran d'attente", () => {
  for (const surface of SURFACES) {
    it(`existe sur ${surface.nom} pour tous les jeux du serveur`, () => {
      for (const type of MODULE_TYPES) {
        expect(
          new RegExp(`^\\s*${type}:`, 'm').test(surface.bloc),
          `« ${type} » n'a pas d'écran d'attente sur ${surface.nom}`,
        ).toBe(true);
      }
    });
  }

  for (const surface of SURFACES) {
    it(`porte un logo ET une explication sur ${surface.nom}, pour chaque jeu`, () => {
      // « L'écran d'attente doit au moins comporter : le titre du jeu,
      // l'explication du jeu, le logo. » Le titre vient du nom du module ; les
      // deux autres sont déclarés ici, jeu par jeu. Une entrée qui n'aurait que
      // son emblème passerait le contrôle précédent sans rien expliquer au
      // cercle — et l'écran dirait « Prochaine épreuve » sans dire à quoi on joue.
      for (const type of MODULE_TYPES) {
        const debut = surface.bloc.search(new RegExp(`^\\s*${type}:`, 'm'));
        const suite = surface.bloc.slice(debut + 1);
        const fin = suite.search(/^\s{2}\w+:/m);
        const entree = fin > -1 ? suite.slice(0, fin) : suite;
        expect(entree.includes('emblem'), `« ${type} » n'a pas de logo sur ${surface.nom}`).toBe(true);
        expect(entree.includes('regle'), `« ${type} » n'explique pas le jeu sur ${surface.nom}`).toBe(true);
      }
    });
  }

  it('annonce le même jeu des deux côtés, et pas un de plus', () => {
    // Un registre qui annoncerait un type que le serveur ne sert plus laisserait
    // un emblème mort : personne ne le verrait jamais, et il survivrait aux
    // relectures. Les deux listes doivent être exactement celles du serveur.
    const declares = (bloc) => MODULE_TYPES.filter((t) => new RegExp(`^\\s*${t}:`, 'm').test(bloc));
    const [joueur, stream] = SURFACES.map((s) => declares(s.bloc));
    expect(joueur.sort()).toEqual(stream.sort());
  });
});
