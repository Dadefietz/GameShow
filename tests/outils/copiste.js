// UN COPISTE : il regarde une grille de cible et en retrace les traits.
//
// POURQUOI CE FICHIER EXISTE, ET POURQUOI IL N'EST PAS DANS LE CONTRÔLE.
//
// Deux outils ont besoin du même copiste, et pour la même raison : éprouver le
// barème de « Cueillette » sur des dessins DONT ON CONNAÎT L'ÉCART à la cible.
//   - le contrôle unitaire, qui vérifie un ORDRE (le fidèle bat le tremblé, qui
//     bat la moitié) ;
//   - la planche visuelle, qui donne ce même ordre À REGARDER, parce qu'un barème
//     peut être parfaitement calculé et parfaitement ridicule.
// Écrit deux fois, il aurait divergé — et les deux auraient continué de passer,
// chacun sur son propre copiste. C'est l'histoire de `SerieGraphique` dans ce
// dépôt, et celle des trois tables de lettres.
//
// ============================================================================
// IL TRACE DES TRAITS, ET NON DES POINTS
// ============================================================================
//
// Une première version semait un point isolé par case d'encre. Elle ne gardait
// RIEN : deux nuages de points se rastérisent de la même façon des deux côtés, si
// bien que le biais entre une cible en image et un dessin en traits n'apparaissait
// pas. Vérifié en sabotant l'épaississement de la cible : le contrôle est resté
// vert. C'est en TRAÇANT que le joueur produit plus d'encre qu'un pointillé, et
// c'est donc en traçant qu'il faut l'éprouver.
//
// Les traits suivent les SUITES CONTIGUËS d'encre sur une rangée — de courts
// segments le long du dessin, jamais une barre d'un bord à l'autre de la figure.
// Ce défaut-là a existé : mon premier harnais reliait tous les pixels sombres
// d'une rangée, et fabriquait des barres qui traversaient la figure de part en
// part. Il notait des dessins que personne n'aurait tracés.
import { grilleDepuisBits, COTE } from '../../src/server/cueillette.js';

// `bruit` : la main qui tremble, en fraction de la boîte.
// `garde` : la part des traits tracés, PRIS AU HASARD PARTOUT — une main qui
//            pointille, pas une main qui s'arrête.
// `haut`   : la part de la HAUTEUR réellement dessinée, depuis le haut. C'est ce
//            que fait un joueur rattrapé par le chrono : il a commencé par le haut
//            et n'a jamais atteint le bas. `garde` ne sait pas faire cela — il
//            enlève des traits partout et rend un dessin complet en pointillé, ce
//            que la planche montrait sous l'étiquette « à moitié fait » alors que
//            la figure entière y était encore lisible.
// `decalage` : le dessin entier posé à côté.
// `echelle` : le dessin tracé plus petit ou plus grand, autour de son centre.
// `graine` : le tirage est REPRODUCTIBLE, sans quoi ni le contrôle ni la planche
//            ne diraient deux fois la même chose.
export function copisteDe(bits, {
  bruit = 0, garde = 1, haut = 1, decalage = 0, echelle = 1, graine = 7,
} = {}) {
  const g = grilleDepuisBits(bits);
  let n = graine;
  const alea = () => { n = (n * 1664525 + 1013904223) % 4294967296; return n / 4294967296; };
  const pt = (x, y) => {
    const u = x / (COTE - 1);
    const v = y / (COTE - 1);
    return [
      0.5 + (u - 0.5) * echelle + decalage + (alea() - 0.5) * 2 * bruit,
      0.5 + (v - 0.5) * echelle + decalage + (alea() - 0.5) * 2 * bruit,
    ];
  };
  // La hauteur réellement occupée par la figure, pour que `haut` coupe le DESSIN
  // et non la grille : un dessin qui ne touche pas le bas serait sinon épargné.
  let yMin = COTE; let yMax = -1;
  for (let y = 0; y < COTE; y += 1) {
    for (let x = 0; x < COTE; x += 1) {
      if (g[y * COTE + x] < 0.9) continue;
      if (y < yMin) yMin = y;
      if (y > yMax) yMax = y;
    }
  }
  const arret = yMin + (yMax - yMin) * haut;

  const traits = [];
  for (let y = 0; y < COTE; y += 1) {
    if (y > arret) break;
    let debut = null;
    for (let x = 0; x <= COTE; x += 1) {
      const encre = x < COTE && g[y * COTE + x] >= 0.9;
      if (encre && debut === null) debut = x;
      if (!encre && debut !== null) {
        if (alea() <= garde) {
          const trait = [];
          for (let k = debut; k < x; k += 1) trait.push(pt(k, y));
          traits.push(trait);
        }
        debut = null;
      }
    }
  }
  return traits;
}

// UN GRIBOUILLIS : la main qui ne sait pas, et qui remplit. Il sert de PLANCHER —
// tout dessin qui vaut moins qu'un gribouillis est un barème cassé.
export function gribouillis({ traits = 9, points = 24, graine = 11 } = {}) {
  let n = graine;
  const alea = () => { n = (n * 1664525 + 1013904223) % 4294967296; return n / 4294967296; };
  const out = [];
  for (let t = 0; t < traits; t += 1) {
    let x = 0.15 + alea() * 0.7;
    let y = 0.15 + alea() * 0.7;
    const trait = [[x, y]];
    for (let k = 0; k < points; k += 1) {
      x = Math.min(0.95, Math.max(0.05, x + (alea() - 0.5) * 0.22));
      y = Math.min(0.95, Math.max(0.05, y + (alea() - 0.5) * 0.22));
      trait.push([x, y]);
    }
    out.push(trait);
  }
  return out;
}
