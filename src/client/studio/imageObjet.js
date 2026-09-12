// PRÉPARER UNE IMAGE D'OBJET, DANS LE NAVIGATEUR.
//
// CE QUI A ÉTÉ DEMANDÉ : pouvoir déposer une image depuis le Studio et la
// codifier (nom, couleur), sans passer par le dépôt de code.
//
// POURQUOI LA CONVERSION SE FAIT ICI, ET NON SUR LE SERVEUR. Les deux cents
// icônes livrées ont subi un traitement précis — détourage du fond blanc PAR LES
// BORDS, puis WebP qualité 82. Refaire cela côté serveur demanderait `sharp` :
// trente mégaoctets de binaire natif à installer sur l'hébergeur, pour une
// opération que le navigateur sait faire en dix lignes de canevas. Le serveur ne
// reçoit donc que des octets WebP déjà prêts, qu'il se contente de VÉRIFIER —
// c'est plus sûr, puisqu'il ne décode jamais une image venue du dehors.
//
// LE DÉTOURAGE PART DES BORDS, IL NE REND PAS « TOUT LE BLANC » TRANSPARENT.
// La distinction n'est pas un détail, et elle est déjà écrite dans docs/CREDITS :
// le verre d'une ampoule, la vitre d'une voiture et les hublots d'un avion sont
// blancs eux aussi. Un détourage naïf les percerait, et l'objet apparaîtrait
// troué sur la plaque claire de sa case. On part donc des pixels du BORD et on
// se propage de proche en proche : ce qui est blanc mais enclos reste opaque.

// Le format des deux cents icônes du dépôt. Une image plus grande est réduite,
// une plus petite n'est pas agrandie — on ne fabrique pas de la définition.
export const COTE = 512;
export const QUALITE = 0.82;
export const POIDS_MAX = 2 * 1024 * 1024;

// Tolérance du « blanc ». Un fond exporté par un outil de dessin n'est jamais
// exactement 255,255,255 : compression, profil colorimétrique, anticrénelage.
const SEUIL = 244;

function estClair(data, i) {
  return data[i] >= SEUIL && data[i + 1] >= SEUIL && data[i + 2] >= SEUIL;
}

// LA PROPAGATION DEPUIS LES BORDS. Une file, pas une récursion : sur 512 × 512,
// une récursion sur les pixels dépasse la pile d'appels du navigateur — et elle
// le fait sur les grandes images uniformes, c'est-à-dire précisément le cas
// normal. La file est un tableau d'indices, parcouru en tête.
function detourerParLesBords(img) {
  const { data, width: w, height: h } = img;
  const vus = new Uint8Array(w * h);
  const file = [];
  const poser = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (vus[p]) return;
    if (!estClair(data, p * 4)) return;
    vus[p] = 1;
    file.push(p);
  };
  for (let x = 0; x < w; x += 1) { poser(x, 0); poser(x, h - 1); }
  for (let y = 0; y < h; y += 1) { poser(0, y); poser(w - 1, y); }
  for (let t = 0; t < file.length; t += 1) {
    const p = file[t];
    const x = p % w;
    const y = (p - x) / w;
    poser(x - 1, y); poser(x + 1, y); poser(x, y - 1); poser(x, y + 1);
  }
  for (let p = 0; p < w * h; p += 1) if (vus[p]) data[p * 4 + 3] = 0;
  return img;
}

// Combien de pixels ont été rendus transparents — sert au contrôle, qui ne peut
// pas juger « c'est bien détouré » mais peut juger « quelque chose a été retiré ».
export function mesurerDetourage(img) {
  let transparents = 0;
  for (let p = 0; p < img.width * img.height; p += 1) if (img.data[p * 4 + 3] === 0) transparents += 1;
  return { transparents, total: img.width * img.height };
}

export function detourer(img) {
  return detourerParLesBords(img);
}

// LE FICHIER DÉPOSÉ DEVIENT UN WEBP DÉTOURÉ. Rend `{ dataUrl, octets, largeur,
// hauteur }` ; lève avec un message en clair si le fichier n'est pas une image
// ou si le navigateur refuse d'encoder en WebP.
export async function preparerImage(fichier) {
  if (!fichier || !String(fichier.type || '').startsWith('image/')) {
    throw new Error("Ce fichier n'est pas une image.");
  }
  const bitmap = await creerBitmap(fichier);
  const echelle = Math.min(1, COTE / Math.max(bitmap.width, bitmap.height));
  const largeur = Math.max(1, Math.round(bitmap.width * echelle));
  const hauteur = Math.max(1, Math.round(bitmap.height * echelle));

  const toile = document.createElement('canvas');
  toile.width = largeur;
  toile.height = hauteur;
  const ctx = toile.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, largeur, hauteur);
  const img = ctx.getImageData(0, 0, largeur, hauteur);
  ctx.putImageData(detourer(img), 0, 0);

  const dataUrl = toile.toDataURL('image/webp', QUALITE);
  // UN NAVIGATEUR QUI NE SAIT PAS ENCODER EN WEBP rend silencieusement un PNG.
  // Le laisser passer ferait grossir la banque d'un facteur dix sans que rien ne
  // le dise, et le serveur refuserait l'envoi sans qu'on sache pourquoi.
  if (!dataUrl.startsWith('data:image/webp')) {
    throw new Error("Ce navigateur ne sait pas produire de WebP. Essaie avec un autre.");
  }
  const octets = Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 3 / 4);
  if (octets > POIDS_MAX) throw new Error(`Image trop lourde une fois convertie (${Math.round(octets / 1024)} ko).`);
  return { dataUrl, octets, largeur, hauteur };
}

function creerBitmap(fichier) {
  if (typeof createImageBitmap === 'function') return createImageBitmap(fichier);
  // Repli pour les navigateurs sans `createImageBitmap` : l'élément <img>.
  return new Promise((ok, ko) => {
    const url = URL.createObjectURL(fichier);
    const el = new Image();
    el.onload = () => { URL.revokeObjectURL(url); ok(el); };
    el.onerror = () => { URL.revokeObjectURL(url); ko(new Error("Image illisible.")); };
    el.src = url;
  });
}

// L'IDENTIFIANT D'UN OBJET SE DÉDUIT DE SON NOM ET DE SA COULEUR, comme les deux
// cents du dépôt (`guitare-bleu`). Il sert de nom de fichier : déposer deux fois
// la même paire remplace l'image au lieu d'en accumuler des copies orphelines.
export function identifiantDObjet(nom, couleur) {
  const propre = (t) => String(t || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const a = propre(nom);
  const b = propre(couleur);
  return a && b ? `${a}-${b}` : '';
}
