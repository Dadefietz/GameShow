// PRÉPARER UN DESSIN DE « CUEILLETTE », DANS LE NAVIGATEUR.
//
// CE QUI A ÉTÉ DEMANDÉ (26/09) : « le même mode de gestion d'images que dans
// Cache-cache […] pouvoir gérer la banque d'images pour le jeu ».
//
// UN DESSIN N'EST PAS UNE ICÔNE, ET SA PRÉPARATION LE DIT. Les cinquante dessins
// du dépôt ont subi un traitement précis (voir src/server/dessins.js) : recadrage
// sur l'ENCRE, centrage sur un CARRÉ avec six pour cent de marge, 512 px,
// détourage du fond par les bords, WebP qualité 82. Un dessin déposé qui y
// échapperait paraîtrait minuscule dans sa case, ou tout en longueur — et le
// joueur, qui dessine dans une zone carrée de la même taille, serait puni sur les
// proportions pour une raison qui ne le regarde pas.
//
// ET IL APPORTE SA GRILLE. Le jeu compare le tracé du joueur à la cible par une
// grille de 64 × 64 ; le serveur n'a pas de décodeur d'images. La grille est donc
// calculée ICI, avec la règle exacte du script qui a produit les cinquante
// d'origine : l'image posée sur du blanc, passée en niveaux de gris, réduite à
// 64 × 64 par un filtre de Lanczos, et chaque case plus sombre que 200 compte
// pour de l'encre.
import { detourer, QUALITE, POIDS_MAX } from './imageObjet.js';

export const COTE = 512;
export const COTE_GRILLE = 64;
// La marge du carré, celle de la banque d'origine.
const MARGE = 0.06;
// Ce qui compte pour de l'encre quand on cherche la boîte du dessin : le même
// seuil de blanc que le détourage.
const SEUIL_BLANC = 244;
// Le seuil de la grille, celui du script d'origine.
const SEUIL_GRILLE = 200;

// La luminance telle que la calcule la bibliothèque du script d'origine (mode
// « L » de Pillow) — et non une moyenne des trois canaux, qui compterait un trait
// bleu foncé comme bien plus clair qu'il ne l'est.
const luminance = (r, g, b) => (r * 299 + g * 587 + b * 114) / 1000;

function toile(l, h) {
  const c = document.createElement('canvas');
  c.width = l; c.height = h;
  return c;
}

// LA BOÎTE DE L'ENCRE. Un pixel est de l'encre s'il est visible et pas blanc.
function boiteDeLEncre(img) {
  const { data, width: w, height: h } = img;
  let x0 = w; let y0 = h; let x1 = -1; let y1 = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 16) continue;
      if (data[i] >= SEUIL_BLANC && data[i + 1] >= SEUIL_BLANC && data[i + 2] >= SEUIL_BLANC) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, l: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// LE RÉÉCHANTILLONNAGE DE LANCZOS, ÉCRIT ICI ET NON DEMANDÉ AU NAVIGATEUR.
//
// LE DÉFAUT QUE CE CODE SUPPRIME, MESURÉ. La première version réduisait l'image
// avec le canevas du navigateur (`imageSmoothingQuality: 'high'`). Comparée aux
// cinquante grilles d'origine, elle plaçait bien l'encre — chaque case à une case
// au plus de la bonne — mais en produisait 22 % DE MOINS : le navigateur réduit
// net, là où le filtre de Lanczos du script d'origine étale un trait sur deux
// cases. Aucun seuil ne rattrapait l'écart (de 200 à 240, l'encre ne remontait
// qu'à 83 %). Un dessin déposé au Studio aurait été une cible plus maigre que
// les cinquante autres, et le contrôle de densité aurait sous-noté ceux qui le
// redessinent.
//
// C'est donc le filtre de la bibliothèque d'origine (Pillow, `Image.LANCZOS`),
// transcrit : noyau sinc fenêtré à trois lobes, étiré du facteur de réduction,
// poids normalisés, passe horizontale puis verticale, arrondi et écrêtage à
// chaque passe. Vérifié sur les cinquante dessins du dépôt : 0 case différente
// sur 204 800.
const sinc = (x) => (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));
const lanczos = (x) => (x > -3 && x < 3 ? sinc(x) * sinc(x / 3) : 0);

function coefficients(entree, sortie) {
  const echelle = entree / sortie;
  const etirement = Math.max(1, echelle);
  const support = 3 * etirement;
  const lignes = [];
  for (let xx = 0; xx < sortie; xx += 1) {
    const centre = (xx + 0.5) * echelle;
    const debut = Math.max(Math.trunc(centre - support + 0.5), 0);
    const n = Math.min(Math.trunc(centre + support + 0.5), entree) - debut;
    const poids = [];
    let total = 0;
    for (let x = 0; x < n; x += 1) {
      const v = lanczos((x + debut - centre + 0.5) / etirement);
      poids.push(v);
      total += v;
    }
    lignes.push({ debut, poids: poids.map((v) => (total ? v / total : 0)) });
  }
  return lignes;
}

const octet = (v) => Math.min(255, Math.max(0, Math.round(v)));

function reechantillonner(L, largeur, hauteur, l2, h2) {
  const ch = coefficients(largeur, l2);
  const tmp = new Float32Array(l2 * hauteur);
  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < l2; x += 1) {
      const { debut, poids } = ch[x];
      let s = 0;
      for (let k = 0; k < poids.length; k += 1) s += L[y * largeur + debut + k] * poids[k];
      tmp[y * l2 + x] = octet(s);
    }
  }
  const cv = coefficients(hauteur, h2);
  const out = new Float32Array(l2 * h2);
  for (let y = 0; y < h2; y += 1) {
    const { debut, poids } = cv[y];
    for (let x = 0; x < l2; x += 1) {
      let s = 0;
      for (let k = 0; k < poids.length; k += 1) s += tmp[(debut + k) * l2 + x] * poids[k];
      out[y * l2 + x] = octet(s);
    }
  }
  return out;
}

// LA GRILLE DE COMPARAISON, depuis une toile de 512 × 512 POSÉE SUR DU BLANC.
// Rend du base 64 : 4 096 bits, un par case, dans l'ordre du script d'origine
// (case i au bit i % 8 de l'octet i / 8).
export function grilleDepuisToile(source) {
  const ctx = source.getContext('2d', { willReadFrequently: true });
  const { data } = ctx.getImageData(0, 0, COTE, COTE);
  // Les niveaux de gris de Pillow (mode « L »), arrondis à l'octet comme lui.
  const L = new Float32Array(COTE * COTE);
  for (let i = 0; i < L.length; i += 1) L[i] = Math.round(luminance(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]));
  const petit = reechantillonner(L, COTE, COTE, COTE_GRILLE, COTE_GRILLE);
  const octets = new Uint8Array((COTE_GRILLE * COTE_GRILLE) / 8);
  let encre = 0;
  for (let i = 0; i < COTE_GRILLE * COTE_GRILLE; i += 1) {
    if (petit[i] < SEUIL_GRILLE) {
      octets[i >> 3] |= 1 << (i & 7);
      encre += 1;
    }
  }
  let bin = '';
  for (const o of octets) bin += String.fromCharCode(o);
  return { grille: btoa(bin), encre };
}

// LE FICHIER DÉPOSÉ DEVIENT UN DESSIN PRÊT À JOUER. Rend `{ dataUrl, octets,
// grille }` ; lève avec un message en clair sinon.
export async function preparerDessin(fichier) {
  if (!fichier || !String(fichier.type || '').startsWith('image/')) {
    throw new Error("Ce fichier n'est pas une image.");
  }
  const bitmap = await creerBitmap(fichier);
  // Une photo de dix mégapixels n'a pas besoin d'être lue en entier pour trouver
  // un trait : on travaille sur 2 048 px au plus.
  const reduction = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
  const l = Math.max(1, Math.round(bitmap.width * reduction));
  const h = Math.max(1, Math.round(bitmap.height * reduction));
  const lecture = toile(l, h);
  const lctx = lecture.getContext('2d', { willReadFrequently: true });
  lctx.drawImage(bitmap, 0, 0, l, h);
  const boite = boiteDeLEncre(lctx.getImageData(0, 0, l, h));
  if (!boite) throw new Error('Aucun trait dans cette image : elle est vide ou entièrement blanche.');

  // LE CARRÉ, BLANC, avec le dessin au centre et six pour cent de marge.
  const cote = Math.ceil(Math.max(boite.l, boite.h) / (1 - 2 * MARGE));
  const carre = toile(cote, cote);
  const cctx = carre.getContext('2d');
  cctx.fillStyle = '#fff';
  cctx.fillRect(0, 0, cote, cote);
  cctx.drawImage(lecture, boite.x, boite.y, boite.l, boite.h,
    Math.round((cote - boite.l) / 2), Math.round((cote - boite.h) / 2), boite.l, boite.h);

  // LA TAILLE DE LA BANQUE : 512 × 512.
  const finale = toile(COTE, COTE);
  const fctx = finale.getContext('2d', { willReadFrequently: true });
  fctx.fillStyle = '#fff';
  fctx.fillRect(0, 0, COTE, COTE);
  fctx.imageSmoothingEnabled = true;
  fctx.imageSmoothingQuality = 'high';
  fctx.drawImage(carre, 0, 0, COTE, COTE);

  // LA GRILLE SE PREND AVANT LE DÉTOURAGE, sur le dessin posé sur le blanc —
  // c'est ce que faisait le script d'origine, qui recomposait l'image sur du
  // blanc avant de la lire. Le résultat est le même ; l'ordre évite de dépendre
  // de la façon dont le navigateur mélange les pixels transparents.
  const { grille, encre } = grilleDepuisToile(finale);
  if (encre < 20) throw new Error('Le trait est trop fin ou trop pâle pour être comparé. Choisis un dessin plus marqué.');

  const img = fctx.getImageData(0, 0, COTE, COTE);
  fctx.putImageData(detourer(img), 0, 0);
  const dataUrl = finale.toDataURL('image/webp', QUALITE);
  if (!dataUrl.startsWith('data:image/webp')) {
    throw new Error('Ce navigateur ne sait pas produire de WebP. Essaie avec un autre.');
  }
  const octets = Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 3 / 4);
  if (octets > POIDS_MAX) throw new Error(`Image trop lourde une fois convertie (${Math.round(octets / 1024)} ko).`);
  return { dataUrl, octets, grille };
}

function creerBitmap(fichier) {
  if (typeof createImageBitmap === 'function') return createImageBitmap(fichier);
  return new Promise((ok, ko) => {
    const url = URL.createObjectURL(fichier);
    const el = new Image();
    el.onload = () => { URL.revokeObjectURL(url); ok(el); };
    el.onerror = () => { URL.revokeObjectURL(url); ko(new Error('Image illisible.')); };
    el.src = url;
  });
}
