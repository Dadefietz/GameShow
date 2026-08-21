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
// Elles ne sont plus régulières : depuis que les tranches épousent les paliers,
// leurs bornes SONT celles du barème. Les écrire toutes serait illisible — dix
// nombres dont quatre se touchent au centre. On garde les DEUX EXTRÉMITÉS, qui
// donnent l'étendue, et une borne sur deux entre les deux.
export function bornes(histo, { pas: unSurDeux = 2 } = {}) {
  if (!histo || !histo.zones?.length) return [];
  const toutes = [histo.zones[0].bas, ...histo.zones.map((z) => z.haut)];
  const garde = toutes.filter((v, i) => i === 0 || i === toutes.length - 1 || i % unSurDeux === 0);
  return garde.map((valeur, i) => ({ i, valeur, pct: position(valeur, histo.min, histo.max) }));
}

// LES BARRES, à leur largeur réelle. Une tranche large de trente pour cent de la
// cible occupe trente pour cent de la cible sur l'axe — c'est tout l'objet du
// calage sur le barème.
export function barres(histo) {
  if (!histo || !histo.zones?.length) return [];
  const haut = Math.max(1, ...histo.zones.map((z) => z.count), histo.exact || 0);
  return histo.zones.map((z, i) => ({
    i,
    palier: z.palier,
    cote: z.cote,
    count: z.count,
    bas: z.bas,
    haut: z.haut,
    gauche: position(z.bas, histo.min, histo.max),
    largeur: Math.max(0.2, position(z.haut, histo.min, histo.max) - position(z.bas, histo.min, histo.max)),
    hauteur: Math.round((z.count / haut) * 100),
  }));
}

// LES PLAGES DU BARÈME, RAMENÉES À L'ÉCHELLE DESSINÉE.
//
// Chaque plage est un couple de bornes autour de la cible. Une plage entièrement
// hors de l'échelle est ÉCARTÉE : dessinée quand même, elle s'écraserait en un
// trait collé au bord et se lirait comme une plage minuscule au mauvais endroit.
//
// UN SEUL FOND, CELUI DU MILLE.
//
// Les quatre plages s'emboîtent par construction. Peintes toutes les quatre,
// leurs opacités s'additionnent et produisent un aplat continu où l'on ne
// distingue plus ni les plages entre elles, ni les barres au travers — mesuré sur
// deux rendus successifs, avant et après l'ouverture de l'échelle.
//
// Ce que le fond apportait, deux autres choses le disent mieux : les BORNES, qui
// marquent chaque seuil à sa place, et la RÈGLE sous l'axe, où chaque palier a sa
// ligne. Il ne reste donc qu'un fond, celui du premier palier — le point de mire.
// Le graphique redevient ce qu'il doit être : des barres qu'on lit.
const ZONE_PEINTE = 'mille';

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
        // Le fond n'est peint que pour le point de mire (voir ci-dessus).
        zone: p.nom === ZONE_PEINTE,
        // LES BORNES, elles, se dessinent toujours — ce sont elles que l'auteur
        // a demandées : « les +/- 2, 10, 20 et 30 % ». Une borne hors de
        // l'échelle n'est pas dessinée : elle mentirait en se collant au bord.
        bornes: [
          dedans(p.bas) ? { cote: 'bas', pct: gauche } : null,
          dedans(p.haut) ? { cote: 'haut', pct: droite } : null,
        ].filter(Boolean),
        // L'ÉTIQUETTE SE POSE À LA BORNE, JAMAIS AU MILIEU DE LA BANDE.
        //
        // Elle était centrée sur la plage. Sur les paliers larges — ± 20 et ± 30 % —
        // cela donnait un libellé flottant au milieu d'un long trait, rattaché à
        // rien : « en l'état ça ne signifie rien », et c'est juste. Un libellé
        // NOMME UN SEUIL ; il doit donc se tenir contre ce seuil.
        //
        // On l'ancre à la borne HAUTE, à sa droite. Quand cette borne touche le
        // bord droit du cadre — le cas de la plage la plus large, qui définit
        // l'échelle — l'étiquette bascule à sa GAUCHE : elle reste collée au même
        // seuil, sans sortir du cadre.
        ancreLbl: droite,
        lblVersGauche: droite > 78,
        droite,
        // Depuis que l'échelle s'engage à contenir la plage la plus large
        // (`histogrammeNumerique`, paramètre `marge`), ceci ne devrait plus jamais
        // être vrai. On le garde comme TÉMOIN : si une plage se retrouvait rognée,
        // c'est que l'engagement aurait été rompu quelque part.
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
