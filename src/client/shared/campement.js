// « CAMPEMENT » — CE QUE LES ÉCRANS PARTAGENT.
//
// Le téléphone, la console et le stream dessinent la MÊME carte réponse avec les
// mêmes points ; le Studio retrouve le point rouge d'une carte déposée. Rien de
// cela ne doit exister en deux exemplaires.

// LE DIAMÈTRE D'UN POINT, EN POUR CENT DE LA LARGEUR DE LA CARTE AFFICHÉE.
//
// `rayon` est celui que le serveur envoie avec la révélation : une fraction du
// PLUS GRAND CÔTÉ de la carte, la même unité que toutes ses distances. Sur une
// carte plus haute que large, le plus grand côté est la hauteur — un pour cent
// de hauteur vaut alors `rapport` pour cent de largeur.
export function diametreDuPoint(rayon, rapport = 1) {
  const r = Number(rayon) > 0 ? Number(rayon) : 14 / 2048;
  const k = Number(rapport) > 1 ? Number(rapport) : 1;
  return 2 * r * k * 100;
}

// LE POINT ROUGE D'UNE CARTE « AVEC VILLE », RETROUVÉ DANS SES PIXELS.
//
// POURQUOI LE STUDIO LE CHERCHE LUI-MÊME. « Dans le Studio il doit être possible
// de créer de nouvelles lignes dans lesquelles on peut insérer une image d'une
// carte sans capitale et une image d'une carte avec capitale. » Le document ne
// demande pas de saisir une position, et il a raison : la position EST sur la
// carte avec capitale, dessinée en rouge. La demander en plus créerait deux
// vérités qui pourraient diverger — la carte réponse montrerait un point, le
// barème en noterait un autre.
//
// C'EST LA MÊME MESURE QUE CELLE DES CENT SOIXANTE-QUINZE CARTES DU DÉPÔT : le
// centre des pixels franchement rouges (rouge fort, vert et bleu faibles). Rend
// `{ x, y, pixels }` en fraction de la largeur et de la hauteur, ou `null` si la
// carte n'a aucun point rouge — ce que le Studio dit alors en clair.
//
// UNE SEULE TACHE ATTENDUE. Si les pixels rouges s'étalent sur plus d'un
// dixième de la carte, ce n'est pas un point mais plusieurs (ou une carte
// coloriée) : on refuse plutôt que de noter un centre qui ne serait nulle part.
export function trouverPointRouge({ data, width, height }) {
  let n = 0;
  let sx = 0;
  let sy = 0;
  let x0 = width;
  let x1 = 0;
  let y0 = height;
  let y1 = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (data[i + 3] > 128 && data[i] > 180 && data[i + 1] < 90 && data[i + 2] < 90) {
        n += 1; sx += x; sy += y;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (!n) return null;
  if ((x1 - x0) > width / 10 || (y1 - y0) > height / 10) return { etale: true };
  const arrondi = (v) => Math.round(v * 1e5) / 1e5;
  return { x: arrondi(sx / n / width), y: arrondi(sy / n / height), pixels: n };
}

// LES COORDONNÉES D'UN DOIGT SUR LA CARTE, en fraction de l'image.
//
// `rect` est la boîte de l'IMAGE à l'écran, zoom compris : le navigateur la
// calcule après toutes les transformations, si bien qu'aucun facteur de zoom ni
// aucun décalage n'a à être refait ici — c'est ce qui rend la pose juste à tous
// les niveaux de zoom. Hors de l'image, `null`.
export function positionSurLaCarte(clientX, clientY, rect) {
  if (!rect || !rect.width || !rect.height) return null;
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x: Math.round(x * 1e5) / 1e5, y: Math.round(y * 1e5) / 1e5 };
}

// LE ZOOM AUTOUR D'UN POINT FIXE — le cœur du pincer-zoomer.
//
// Ce qui est sous les doigts au début du geste doit RESTER sous les doigts : sans
// cela, la carte « glisse » pendant qu'on zoome, et le joueur perd la région
// qu'il cherchait à agrandir. Pour un point d'écran `p` (relatif au cadre) et une
// vue `{ s, tx, ty }` (échelle puis translation), le point de carte sous `p` est
// `(p - t) / s` ; on choisit la nouvelle translation pour qu'il y reste.
//
// La vue est ensuite BORNÉE : la carte couvre toujours le cadre — on ne peut ni
// la perdre hors de l'écran, ni dézoomer sous sa taille d'origine.
export const ZOOM_MAX = 5;
export function zoomerAutour(vue, echelle, px, py, largeur, hauteur) {
  const s = Math.min(ZOOM_MAX, Math.max(1, echelle));
  const tx = px - ((px - vue.tx) / vue.s) * s;
  const ty = py - ((py - vue.ty) / vue.s) * s;
  return bornerLaVue({ s, tx, ty }, largeur, hauteur);
}
export function bornerLaVue({ s, tx, ty }, largeur, hauteur) {
  const minX = largeur - largeur * s;
  const minY = hauteur - hauteur * s;
  return {
    s,
    tx: Math.min(0, Math.max(minX, tx)),
    ty: Math.min(0, Math.max(minY, ty)),
  };
}
