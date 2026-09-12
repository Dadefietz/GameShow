// LE DÉTOURAGE D'UNE IMAGE DÉPOSÉE AU STUDIO.
//
// CE QUI A ÉTÉ DEMANDÉ : « déposer une image et codifier (nom, couleur) ».
//
// POURQUOI CE CONTRÔLE TOURNE SANS NAVIGATEUR. `detourer` prend une image sous
// la forme que rend un canevas — `{ data, width, height }` — et rien de plus.
// C'est pour cela qu'il est séparé de `preparerImage`, qui, lui, a besoin du
// canevas : la règle qui compte se vérifie ici, à la milliseconde, sur des
// figures choisies, plutôt que dans une campagne de bout en bout.
//
// LA RÈGLE QUI COMPTE, et elle est déjà écrite dans docs/CREDITS : LE DÉTOURAGE
// PART DES BORDS. Il ne rend pas « tout le blanc » transparent. Le verre d'une
// ampoule, la vitre d'une voiture et les hublots d'un avion sont blancs eux
// aussi ; un détourage naïf les percerait, et l'objet apparaîtrait troué sur la
// plaque claire de sa case. Les deux cents icônes du dépôt ont été traitées
// ainsi — une image déposée doit l'être de la même façon, sans quoi la banque
// aurait deux traitements et personne ne saurait lequel s'applique.
import { describe, it, expect } from 'vitest';
import { detourer, mesurerDetourage, identifiantDObjet, COTE, QUALITE } from '../../src/client/studio/imageObjet.js';

// Une image de synthèse, au format d'un canevas. `peindre(x, y)` rend la couleur
// du pixel : `null` pour du blanc.
function image(w, h, peindre) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const [r, v, b] = peindre(x, y) || [255, 255, 255];
      const i = (y * w + x) * 4;
      data[i] = r; data[i + 1] = v; data[i + 2] = b; data[i + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}

const alpha = (img, x, y) => img.data[(y * img.width + x) * 4 + 3];

describe('le détourage par les bords', () => {
  it('retire le fond ET GARDE LE BLANC ENCLOS — le verre de l\'ampoule', () => {
    // Un anneau rouge de rayon 80, percé d'un trou blanc de rayon 30, sur fond
    // blanc. C'est exactement la figure d'une ampoule : trois zones, dont deux
    // blanches, dont une seule doit disparaître.
    const R = 200;
    const dist = (x, y) => Math.hypot(x - R / 2, y - R / 2);
    const img = image(R, R, (x, y) => {
      const d = dist(x, y);
      return (d <= 80 && d >= 30) ? [192, 57, 43] : null;
    });
    detourer(img);

    expect(alpha(img, 1, 1), 'le coin devait devenir transparent').toBe(0);
    expect(alpha(img, R - 2, R - 2), 'le coin opposé aussi').toBe(0);
    expect(alpha(img, R / 2, R / 2),
      "LE TROU BLANC A ÉTÉ PERCÉ : c'est le défaut du détourage naïf").toBe(255);
    expect(alpha(img, R / 2, R / 2 - 55), "l'anneau rouge devait rester").toBe(255);

    // L'aire hors du disque de rayon 80 dans un carré de 200 : 1 − π·80²/200².
    const { transparents, total } = mesurerDetourage(img);
    const attendu = 1 - (Math.PI * 80 * 80) / (R * R);
    expect(transparents / total).toBeCloseTo(attendu, 2);
  });

  it('un blanc qui TOUCHE le bord disparaît, même enclos par ailleurs', () => {
    // Une barre rouge qui ne ferme pas le contour : le blanc du haut communique
    // avec le bord par la brèche, il part. C'est le comportement voulu — la
    // propagation suit les pixels, pas une idée de « l'intérieur ».
    const img = image(40, 40, (x, y) => (y === 20 && x < 35 ? [192, 57, 43] : null));
    detourer(img);
    expect(alpha(img, 5, 5), 'le haut touche le bord').toBe(0);
    expect(alpha(img, 5, 30), 'le bas communique par la brèche en x=35').toBe(0);
  });

  it('une image sans aucun blanc de bord reste intacte', () => {
    const img = image(20, 20, () => [10, 20, 30]);
    detourer(img);
    expect(mesurerDetourage(img).transparents).toBe(0);
  });

  it('tolère un fond presque blanc, pas un gris franc', () => {
    // Un fond exporté par un outil de dessin n'est jamais exactement 255,255,255 :
    // compression, profil colorimétrique, anticrénelage. Mais un gris de fond
    // VOULU ne doit pas partir — les portraits du jeu en ont un.
    const presque = image(20, 20, () => [250, 249, 251]);
    detourer(presque);
    expect(mesurerDetourage(presque).transparents).toBe(400);

    const gris = image(20, 20, () => [210, 210, 210]);
    detourer(gris);
    expect(mesurerDetourage(gris).transparents).toBe(0);
  });
});

describe("l'identifiant d'un objet déposé", () => {
  it('se déduit du nom et de la couleur, comme les deux cents du dépôt', () => {
    expect(identifiantDObjet('Guitare', 'Bleu')).toBe('guitare-bleu');
    expect(identifiantDObjet('Clé à molette', 'Rouge')).toBe('cle-a-molette-rouge');
    expect(identifiantDObjet('T-shirt', 'Vert')).toBe('t-shirt-vert');
    expect(identifiantDObjet('  Café  ', 'JAUNE')).toBe('cafe-jaune');
  });

  it('refuse de fabriquer un identifiant sans les deux', () => {
    // SANS IDENTIFIANT STABLE, redéposer la même paire accumulerait des copies
    // orphelines au lieu de remplacer l'image. C'est pour cela que l'écran exige
    // le nom ET la couleur AVANT le fichier.
    expect(identifiantDObjet('', 'Bleu')).toBe('');
    expect(identifiantDObjet('Guitare', '')).toBe('');
    expect(identifiantDObjet('!!!', 'Bleu')).toBe('');
  });

  it('ne peut pas produire de chemin, ni sortir du dossier', () => {
    // Le serveur le revérifie, mais un identifiant fabriqué ici ne doit jamais
    // avoir l'occasion d'être refusé : deux gardes valent mieux qu'une.
    expect(identifiantDObjet('../../etc/passwd', 'Bleu')).toBe('etc-passwd-bleu');
    expect(identifiantDObjet('a/b', 'c\\d')).toBe('a-b-c-d');
    for (const cas of [['Ampoule', 'Bleu'], ['Été', 'Rosé'], ['a b  c', 'd']]) {
      expect(identifiantDObjet(...cas)).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });
});

describe('les réglages de conversion', () => {
  it('reprennent ceux des deux cents icônes du dépôt', () => {
    // 512 px de côté et qualité 82 : docs/CREDITS l'écrit, et il a fallu le
    // RETROUVER une fois. On le fige ici pour ne pas avoir à le refaire.
    expect(COTE).toBe(512);
    expect(QUALITE).toBe(0.82);
  });
});
