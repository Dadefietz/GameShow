// LE SAPIN DE L'AUTEUR — LE PREMIER DESSIN HUMAIN DE CE DÉPÔT.
//
// Capture d'écran du 26/09, sur un téléphone, en production : un sapin
// fidèlement contourné au doigt, superposé à la cible (d002), et affiché
// « 0 % de ressemblance — raté ». Le tracé vert a été relevé point par point sur
// la capture — la case de dessin y occupe les pixels 164 à 760 en largeur et 797
// à 1392 en hauteur —, puis rééchantillonné au pas de la toile (0,4 % de la
// boîte), comme un doigt l'aurait produit.
//
// C'EST UN POINT DE MESURE HUMAIN, pas une figure de synthèse : il contourne,
// il ne remplit pas, son tronc est plus court que celui de la cible, et il
// déborde à gauche. Exactement ce que le copiste ne sait pas fabriquer.
const px = (x, y) => [(x - 164) / 596, (y - 797) / 595];

const CONTOUR = [[455, 840], [470, 840], [590, 965], [460, 990], [510, 1060], [590, 1085], [505, 1095],
  [560, 1150], [640, 1175], [600, 1190], [480, 1200], [420, 1200], [390, 1190], [270, 1220], [265, 1210],
  [330, 1140], [385, 1090], [320, 1100], [340, 1075], [430, 970], [390, 965], [410, 930], [455, 840]];
const TRONC = [[440, 1205], [435, 1305], [455, 1300], [485, 1260], [480, 1190]];

function densifier(pts, pas = 0.004) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i += 1) {
    const a = out[out.length - 1];
    const b = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / pas));
    for (let k = 1; k <= n; k += 1) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}

// Deux gestes : le contour d'un seul trait — plus de sept cents points —, puis
// le tronc.
export const SAPIN_AUTEUR = [
  densifier(CONTOUR.map(([x, y]) => px(x, y))),
  densifier(TRONC.map(([x, y]) => px(x, y))),
];
export const CIBLE_SAPIN = 'd002';
