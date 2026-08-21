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
import { plagesEstimation, modules, histogrammeNumerique, histogrammeBareme } from '../../src/server/modules.js';
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

describe('l\'échelle contient le barème', () => {
  // ARBITRAGE DE L'AUTEUR (2026-08-21) : « étendre ». L'échelle était tirée des
  // seules RÉPONSES, quand les plages sont une propriété de la QUESTION — d'où
  // des « ± » dont un seul côté était dessiné, et une plage annoncée en légende
  // sans exister sur le graphique.
  const marge = (cible, nature) => Math.max(
    0, ...plagesEstimation(cible, nature).map((p) => p.haut - cible),
  );

  it('ouvre l\'échelle même quand toutes les réponses tombent d\'un seul côté', () => {
    const cible = 1235;
    const m = marge(cible, 'nombre');
    for (const [ou, valeurs] of [['au-dessus', [3000, 2600, 2900]], ['en dessous', [400, 600, 500]]]) {
      const h = histogrammeNumerique(valeurs, cible, 8, m);
      expect(h.min, `${ou} : la borne basse de ± 30 % est hors du cadre`).toBeLessThanOrEqual(cible - m);
      expect(h.max, `${ou} : la borne haute de ± 30 % est hors du cadre`).toBeGreaterThanOrEqual(cible + m);
      // Et donc les QUATRE plages ont leurs DEUX bornes dessinées.
      for (const p of plagesVisibles(plagesEstimation(cible, 'nombre'), h)) {
        expect(p.bornes.map((b) => b.cote), `${ou} : ${p.libelle} n'a pas ses deux bornes`)
          .toEqual(['bas', 'haut']);
      }
    }
  });

  it('n\'écrase pas pour autant les réponses qui sortent des plages', () => {
    // Le revers : ouvrir l'échelle ne doit pas la RÉDUIRE. Une réponse à 3 000
    // reste dans le cadre.
    const h = histogrammeNumerique([3000, 2600, 2900], 1235, 8, marge(1235, 'nombre'));
    expect(h.max).toBeGreaterThanOrEqual(3000);
    expect(h.counts.reduce((s, c) => s + c, 0), 'une estimation a disparu').toBe(3);
  });
});

describe('la mise à l\'échelle du dessin', () => {
  // Le montage vient du PRODUIT, jamais écrit à la main : les zones épousent le
  // barème, et les recopier reviendrait à recopier la règle qu'on veut vérifier.
  const cibleFixture = 100;
  const plagesFixture = plagesEstimation(cibleFixture, 'nombre');
  const margeFixture = Math.max(...plagesFixture.map((p) => p.haut - cibleFixture));
  const histo = histogrammeBareme([88, 96, 100, 101], cibleFixture, plagesFixture, margeFixture);

  it('place la cible à sa position exacte sur l\'axe', () => {
    const r = repereCible(cibleFixture, histo);
    expect(r.pct).toBeCloseTo(position(cibleFixture, histo.min, histo.max), 6);
    // La cible est une BORNE de zone depuis que les tranches épousent le barème :
    // c'est là que les deux moitiés du premier palier se rejoignent.
    const bornesZones = [histo.zones[0].bas, ...histo.zones.map((z) => z.haut)];
    expect(bornesZones.some((v) => Math.abs(v - cibleFixture) < 1e-6),
      'la cible devrait être une borne de zone').toBe(true);
  });

  it('ne peint qu\'un fond, celui du point de mire', () => {
    // Les quatre plages s'emboîtent par construction : peintes toutes les quatre,
    // leurs opacités s'additionnent en un aplat où l'on ne distingue plus ni les
    // plages entre elles, ni les barres au travers. Mesuré sur deux rendus
    // successifs. Les bornes et la règle sous l'axe portent le reste.
    const v = plagesVisibles(plagesEstimation(100, 'nombre'), histo);
    expect(v.map((p) => p.libelle), 'l\'ordre du barème n\'est pas respecté')
      .toEqual(['± 2 %', '± 10 %', '± 20 %', '± 30 %']);
    expect(v.filter((p) => p.zone).map((p) => p.nom),
      'un seul fond doit être peint, celui du premier palier').toEqual(['mille']);
  });

  it('ancre chaque étiquette à la borne haute, et la fait basculer au bord', () => {
    // ARBITRAGE DE L'AUTEUR : « les étiquettes 20 % et 30 %, mets-les à droite de
    // la bande. En l'état ça ne signifie rien. » Centrée, l'étiquette de ± 30 %
    // se retrouvait à 442 px de son seuil — mesuré. Un libellé NOMME UN SEUIL : il
    // se tient contre ce seuil.
    //
    // (Cette règle en remplace une autre, qui sortait l'étiquette de la bande
    // seulement quand la bande était trop courte pour elle. Elle traitait un cas
    // particulier ; celle-ci traite le principe.)
    // L'échelle est CALCULÉE par le produit, non recopiée à la main : un chiffre
    // arrondi dans le contrôle (1 606 au lieu de 1 605,5) faisait échouer
    // l'assertion sur le bord droit pour une raison sans rapport avec son objet.
    const cible = 1235;
    const marge = Math.max(0, ...plagesEstimation(cible, 'nombre').map((p) => p.haut - cible));
    const large = histogrammeNumerique([1100, 1300, 1400], cible, 8, marge);
    const v = plagesVisibles(plagesEstimation(cible, 'nombre'), large);
    for (const p of v) {
      expect(p.ancreLbl, `${p.libelle} : l'étiquette n'est pas ancrée à la borne haute`).toBeCloseTo(p.droite, 5);
    }
    // La plage la plus large définit l'échelle : sa borne haute TOUCHE le bord, et
    // l'étiquette doit basculer à gauche pour ne pas sortir du cadre.
    const loin = v.find((p) => p.nom === 'loin');
    expect(loin.droite, 'la plage la plus large devrait toucher le bord').toBeCloseTo(100, 1);
    expect(loin.lblVersGauche, 'au bord droit, l\'étiquette doit basculer').toBe(true);
    // Les plages étroites, elles, se posent à droite de leur borne : il y a la place.
    expect(v.find((p) => p.nom === 'mille').lblVersGauche).toBe(false);
    expect(v.find((p) => p.nom === 'proche').lblVersGauche).toBe(false);
  });

  it('donne des bornes d\'axe prises SUR LES PALIERS, extrémités comprises', () => {
    // Les bornes ne sont plus régulières : ce sont celles du barème. On garde les
    // deux extrémités — l'étendue — et une borne sur deux entre les deux, sans
    // quoi dix nombres se toucheraient au centre.
    const b = bornes(histo);
    expect(b.length, 'trop peu de repères pour situer une barre').toBeGreaterThanOrEqual(4);
    expect(b[0].valeur, 'la première graduation n\'est pas le bord gauche').toBeCloseTo(histo.min, 6);
    expect(b[b.length - 1].valeur, 'la dernière n\'est pas le bord droit').toBeCloseTo(histo.max, 6);
    expect(b[0].pct).toBeCloseTo(0, 6);
    expect(b[b.length - 1].pct).toBeCloseTo(100, 6);
    // Chaque graduation tombe sur une borne de zone, jamais entre deux.
    const bornesZones = [histo.zones[0].bas, ...histo.zones.map((z) => z.haut)];
    for (const g of b) {
      expect(bornesZones.some((v) => Math.abs(v - g.valeur) < 1e-6),
        `la graduation ${g.valeur} ne tombe sur aucune borne de palier`).toBe(true);
    }
  });
});
