// L'ÉCHELLE DE L'HISTOGRAMME D'ESTIMATION — géométrie commune aux deux écrans.
//
// CE QUI MANQUAIT. Les deux histogrammes — celui de l'animateur et celui du
// stream — dessinaient huit barres sans rien pour les lire : aucune valeur d'axe,
// donc aucun moyen de savoir ce qu'une tranche recouvre ; aucun repère sur la
// bonne réponse ; et aucune trace des plages qui rapportent des points. On voyait
// une forme, on ne savait pas de quoi.
//
// POURQUOI CE FICHIER EXISTE. Les deux écrans dessinent la MÊME échelle à deux
// tailles. Recopier le calcul, c'est le laisser diverger — c'est déjà arrivé à la
// flamme, recopiée trois fois (voir `marque-flamme.js`), et c'est le raisonnement
// de la décision 6.1 sur le « plus proche ». La géométrie se calcule ici, une
// fois ; chaque surface n'apporte que ses classes et ses tailles.
//
// LES VALEURS, ELLES, VIENNENT DU SERVEUR — `stats.plages`, calculé à côté des
// constantes du barème. Aucun pourcentage n'est écrit ici : un écran qui
// connaîtrait les paliers par cœur finirait par annoncer une plage que le barème
// ne récompense plus.

// Position d'une valeur sur l'axe, en pourcentage de largeur. Bornée : une plage
// peut déborder l'échelle des réponses, et doit alors s'arrêter au bord plutôt
// que de déformer le dessin.
export function position(valeur, min, max) {
  if (!(max > min)) return 50;
  return Math.max(0, Math.min(100, ((valeur - min) / (max - min)) * 100));
}

// Les BORNES DE TRANCHES, telles qu'on les écrit sous l'axe.
//
// Neuf bornes pour huit tranches : les afficher toutes rendrait l'axe illisible
// sur la console comme à l'antenne. On en garde une sur deux — cinq repères, dont
// les deux extrémités, ce qui suffit à situer n'importe quelle barre.
export function bornes(histo, { pas: unSurDeux = 2 } = {}) {
  if (!histo) return [];
  const total = histo.counts.length;
  const out = [];
  for (let i = 0; i <= total; i += unSurDeux) {
    const valeur = histo.min + i * histo.pas;
    out.push({ i, valeur, pct: (i / total) * 100 });
  }
  return out;
}

// LES PLAGES DU BARÈME, RAMENÉES À L'ÉCHELLE DESSINÉE.
//
// Chaque plage est un couple de bornes autour de la cible. Une plage entièrement
// hors de l'échelle est ÉCARTÉE : dessinée quand même, elle s'écraserait en un
// trait collé au bord et se lirait comme une plage minuscule au mauvais endroit.
//
// LE REMPLISSAGE NE VAUT QUE TANT QU'IL DÉLIMITE QUELQUE CHOSE. Mesuré sur un
// rendu réel : sur une cible de 100 et des réponses tenant entre 88 et 101, les
// plages à ±10, ±20 et ±30 % couvrent CHACUNE toute la largeur. Empilées, elles
// noyaient les barres sous un aplat continu et ne délimitaient plus rien. Au-delà
// de ce seuil, la plage n'est plus dessinée en zone — seules ses bornes le sont.
const LARGEUR_MAX_ZONE = 70;

export function plagesVisibles(plages, histo) {
  if (!plages || !histo) return [];
  const { min, max } = histo;
  const dedans = (v) => v >= min && v <= max;
  return plages
    .filter((p) => p.haut >= min && p.bas <= max)
    .map((p) => {
      const gauche = position(p.bas, min, max);
      const droite = position(p.haut, min, max);
      const largeur = Math.max(0.5, droite - gauche);
      return {
        nom: p.nom,
        libelle: p.libelle,
        points: p.points,
        gauche,
        largeur,
        // La zone n'est peinte que si elle délimite encore quelque chose.
        zone: largeur <= LARGEUR_MAX_ZONE,
        // LES BORNES, elles, se dessinent toujours — ce sont elles que l'auteur
        // a demandées : « les +/- 2, 10, 20 et 30 % ». Une borne hors de
        // l'échelle n'est pas dessinée : elle mentirait en se collant au bord.
        bornes: [
          dedans(p.bas) ? { cote: 'bas', pct: gauche } : null,
          dedans(p.haut) ? { cote: 'haut', pct: droite } : null,
        ].filter(Boolean),
        // Une plage rognée par le bord ne doit pas prétendre montrer ses deux
        // extrémités : l'écran peut le dire au lieu de laisser croire.
        rognee: p.bas < min || p.haut > max,
      };
    })
    // ORDRE DU BARÈME, et non ordre de largeur. Les largeurs sont BORNÉES à
    // l'échelle : deux plages débordant du même côté finissent à égalité, et le
    // tri rendait alors « ± 2, ± 10, ± 30, ± 20 ». Le nombre de points, lui, ne
    // dépend pas de l'échelle.
    .sort((a, b) => b.points - a.points);
}

// Ce qu'il faut savoir de la cible pour la marquer : sa position, et de quel côté
// écrire son étiquette pour qu'elle ne sorte pas du cadre.
export function repereCible(cible, histo) {
  if (histo == null || cible == null) return null;
  const pct = position(cible, histo.min, histo.max);
  return { pct, ancrage: pct > 82 ? 'fin' : pct < 18 ? 'debut' : 'centre' };
}
