// L'EMBLÈME DE « LE JUSTE TEMPS » — un chronomètre, un buzzer dessous.
//
// POURQUOI CE FICHIER. Même raison que `marque-lien.js` et `marque-visages.js` :
// le dessin sert sur DEUX surfaces — l'écran d'annonce du joueur et celui du
// stream —, et le projet a déjà payé le prix d'un tracé recopié qui diverge (la
// flamme, chantier v2). Une géométrie, deux tailles.
//
// LE DESSIN. La consigne : « le symbole d'un chronomètre avec un buzzer juste en
// dessous ». Les deux objets disent le jeu à eux seuls — un temps qui court, une
// main qui l'arrête.
//
// LA GRILLE EST HAUTE, pas carrée : deux objets empilés ne tiennent pas dans un
// carré sans que chacun rapetisse. La hauteur est donc assumée, et les surfaces
// demandent une largeur — la hauteur en découle (`RAPPORT`).
//
// LES MESURES SONT ÉCRITES, ET LES TRACÉS EN DÉCOULENT, comme pour les chaînons :
// un tracé SVG à la main est illisible pour une machine, et deux dessins fautifs
// y sont passés inaperçus avant d'être vus à l'écran. Ici le contrôle vérifie que
// l'emblème tient dans sa grille et que ses deux objets ne se chevauchent pas.
export const GRILLE = { largeur: 100, hauteur: 112 };
export const TRAIT = 6.4;
export const RAPPORT = GRILLE.hauteur / GRILLE.largeur;

// LE CHRONOMÈTRE — un cadran, sa couronne, ses deux oreilles, une aiguille.
export const CADRAN = { cx: 50, cy: 45, r: 26 };
// La couronne : le bouton qu'on presse, au sommet. C'est lui qui fait lire
// « chronomètre » plutôt que « horloge ».
export const COURONNE = { x: 42, y: 6, largeur: 16, hauteur: 9, rayon: 3 };
// Le col qui relie la couronne au cadran.
export const COL = 'M50 15v4';
// L'AIGUILLE, à onze heures. Elle part du centre, comme sur un vrai cadran, et
// ne touche pas le bord : une aiguille qui touche le cercle se lit comme un rayon.
export const AIGUILLE = 'M50 45V30 M50 45l10 6.5';
// Les deux oreilles, en biais : les poussoirs latéraux du boîtier.
export const OREILLES = ['M69.5 25.5l5-5', 'M30.5 25.5l-5-5'];

// LE BUZZER — un dôme posé sur son socle, juste sous le chronomètre.
// C'est l'autre moitié du jeu : le chrono court, le doigt l'arrête.
// LE DÔME ET SON SOCLE — un buzzer de comptoir, et rien de plus.
//
// DEUX DESSINS ONT ÉTÉ ÉCARTÉS AVANT CELUI-CI, tous deux vus à l'écran :
//   - un PIED vertical sous le socle : l'objet se lisait comme un abat-jour sur
//     sa tige, et l'emblème annonçait tout autre chose que le jeu ;
//   - une EMBASE horizontale sous le socle, posée six unités plus bas pour un
//     trait de 6,4 : les deux barres se touchaient et formaient une seule masse
//     épaisse. C'est l'erreur que le contrôle du jour entre les tracés garde.
// Une calotte sur une barre suffit, et se lit à toutes les tailles.
export const DOME = 'M28 104a22 22 0 0144 0';
export const SOCLE = 'M21 104h58';

// Ce qui sépare le bas du cadran du haut du dôme — la seule mesure que le
// contrôle regarde vraiment : deux objets empilés qui se touchent forment une
// tache, et l'emblème cesse de nommer ses deux idées.
// La hauteur du socle et le rayon du dôme, relus depuis les tracés plutôt que
// recopiés : deux nombres écrits deux fois finissent par différer, et c'est
// exactement ce que le contrôle est là pour empêcher.
const Y_SOCLE = Number(SOCLE.match(/^M[\d.]+ ([\d.]+)/)[1]);
const R_DOME = Number(DOME.match(/a([\d.]+) /)[1]);

export function jourEntreLesDeux() {
  const basDuCadran = CADRAN.cy + CADRAN.r + TRAIT / 2;
  const hautDuDome = Y_SOCLE - R_DOME - TRAIT / 2;
  return hautDuDome - basDuCadran;
}

// Ce qui reste de la grille autour du dessin, du côté le plus serré.
export function margeDeGrille() {
  // Le point le plus à gauche n'est pas le cadran mais le socle du buzzer, plus
  // large que lui. On prend le plus débordant des deux.
  const gauche = Math.min(CADRAN.cx - CADRAN.r, Number(SOCLE.match(/^M([\d.]+)/)[1])) - TRAIT / 2;
  const droite = GRILLE.largeur
    - (Math.max(CADRAN.cx + CADRAN.r, Number(SOCLE.match(/^M([\d.]+) [\d.]+h([\d.]+)/)[1])
      + Number(SOCLE.match(/h([\d.]+)/)[1])) + TRAIT / 2);
  const haut = COURONNE.y - TRAIT / 2;
  const bas = GRILLE.hauteur - (Y_SOCLE + TRAIT / 2);
  return Math.min(gauche, droite, haut, bas);
}

export const CHRONO_BUZZER = {
  viewBox: `0 0 ${GRILLE.largeur} ${GRILLE.hauteur}`,
  trait: TRAIT,
  rapport: RAPPORT,
  cadran: CADRAN,
  couronne: COURONNE,
  col: COL,
  aiguille: AIGUILLE,
  oreilles: OREILLES,
  dome: DOME,
  socle: SOCLE,
};
