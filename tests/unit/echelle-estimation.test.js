// L'ÉCHELLE DE L'HISTOGRAMME — les plages du barème, et leur mise à l'échelle.
//
// CE QUI A ÉTÉ RAPPORTÉ : « aussi bien sur l'histogramme de l'animateur que sur
// l'histogramme du public il manque deux choses. Les valeurs des axes afin qu'on
// sache ce que chaque portion représente. Et aussi la valeur juste bien
// identifiée sur l'axe. Ainsi que les +/- 2, 10, 20 et 30 %. »
//
// CE QUE CE FICHIER PROTÈGE. Les bornes affichées sont celles du BARÈME. Les
// recopier dans les écrans, c'est garantir qu'ils finiront par annoncer une plage
// que le barème ne récompense plus — exactement le piège de la double définition
// du « plus proche » (décision 6.1). Elles sont donc calculées à côté des
// constantes de score, et ces contrôles vérifient qu'elles suivent la règle
// RÉELLEMENT appliquée, années comprises.
import { describe, it, expect } from 'vitest';
import { plagesEstimation, modules } from '../../src/server/modules.js';
import { plagesVisibles, bornes, repereCible, position } from '../../src/client/shared/echelle-estimation.js';

describe('les plages annoncées par l\'axe', () => {
  it('suivent le barème relatif, tolérance absolue comprise', () => {
    const p = plagesEstimation(100, 'nombre');
    expect(p.map((x) => x.libelle)).toEqual(['± 2 %', '± 10 %', '± 20 %', '± 30 %']);
    expect(p[0]).toMatchObject({ bas: 98, haut: 102, points: 1000 });
    expect(p[3]).toMatchObject({ bas: 70, haut: 130, points: 250 });

    // SUR UNE PETITE CIBLE, la tolérance d'une unité élargit le premier palier —
    // et l'axe doit dire ce que le barème fait, pas ce que le pourcentage suggère.
    // 2 % de 6 valent 0,12 : sans cela, l'axe annoncerait une plage de 5,88 à 6,12
    // alors que répondre 7 rapporte les 1000 points.
    const petite = plagesEstimation(6, 'nombre');
    expect(petite[0]).toMatchObject({ bas: 5, haut: 7 });
  });

  it('passent en ANNÉES quand la question l\'est, sans jamais afficher un pourcentage', () => {
    const p = plagesEstimation(1789, 'annee');
    expect(p.map((x) => x.libelle)).toEqual(['exact', '± 2 ans', '± 5 ans', '± 10 ans']);
    expect(p[1]).toMatchObject({ bas: 1787, haut: 1791 });
    // LE CHIFFRE DE LA RÉUNION : 2 % de 1789 valent trente-six ans. Un axe qui
    // afficherait « ± 2 % » sur une année annoncerait une plage vingt fois trop
    // large — et l'auteur lirait à l'antenne une règle qui n'est pas appliquée.
    expect(JSON.stringify(p), 'un pourcentage s\'est glissé sur une question en années').not.toContain('%');
  });

  it('sortent du même calcul que les points effectivement versés', () => {
    // Le lien est vérifié, pas supposé : on prend la borne annoncée et l'on
    // demande au barème ce qu'il verse à cette valeur exacte.
    const cible = 250;
    const [mille] = plagesEstimation(cible, 'nombre');
    const rt = modules.estimation.buildRound({ id: 'e', text: '?', target: cible, durationSec: 20 });
    rt.startedAt = 1000; rt.deadline = 21_000; rt.answers = new Map();
    rt.answers.set('borne', { value: mille.haut, at: rt.startedAt });
    rt.answers.set('juste-au-dela', { value: mille.haut + 1, at: rt.startedAt });
    const { results } = modules.estimation.score(rt);
    expect(results.get('borne').palier,
      'la borne annoncée par l\'axe ne rapporte pas le palier annoncé').toBe('mille');
    expect(results.get('juste-au-dela').palier).not.toBe('mille');
  });
});

describe('la mise à l\'échelle du dessin', () => {
  const histo = { min: 88, max: 101, pas: 13 / 8, counts: [1, 0, 0, 0, 0, 0, 1, 2], cibleIndex: 7 };

  it('place la cible à sa position exacte, jamais au centre d\'une tranche', () => {
    const r = repereCible(100, histo);
    expect(r.pct).toBeCloseTo(((100 - 88) / 13) * 100, 5);
    // Le repère était jusqu'ici « la tranche en couleur », large de 1,6 unité.
    expect(r.pct).not.toBeCloseTo(position(histo.min + 7.5 * histo.pas, 88, 101), 1);
  });

  it('écarte le remplissage d\'une plage qui couvre tout, mais garde ses bornes', () => {
    // MESURÉ SUR UN RENDU RÉEL : à ±10, ±20 et ±30 % d'une cible de 100, sur une
    // échelle de 88 à 101, les trois plages couvrent CHACUNE toute la largeur.
    // Empilées, elles noyaient les barres sous un aplat continu.
    const v = plagesVisibles(plagesEstimation(100, 'nombre'), histo);
    expect(v.map((p) => p.libelle), 'l\'ordre du barème n\'est pas respecté')
      .toEqual(['± 2 %', '± 10 %', '± 20 %', '± 30 %']);
    expect(v[0].zone, 'la plage du mille doit rester dessinée : elle délimite').toBe(true);
    expect(v.filter((p) => p.zone).length, 'des plages trop larges sont encore peintes').toBe(1);
    // La borne basse de ±10 % (90) est dans l'échelle, sa borne haute (110) non.
    expect(v[1].bornes.map((b) => b.cote)).toEqual(['bas']);
    // Celles de ±30 % sont toutes deux hors échelle : rien à dessiner, et l'écran
    // le signale au lieu de coller un trait au bord.
    expect(v[3].bornes).toHaveLength(0);
  });

  it('donne une borne d\'axe sur deux, extrémités comprises', () => {
    const b = bornes(histo);
    expect(b).toHaveLength(5);
    expect(b[0].valeur).toBe(88);
    expect(b[b.length - 1].valeur).toBeCloseTo(101, 5);
    expect(b.map((x) => x.pct)).toEqual([0, 25, 50, 75, 100]);
  });
});
