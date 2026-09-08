// CONTRÔLE DE « LE JUSTE TEMPS ».
//
// CE QUE CE JEU A DE PARTICULIER, ET QU'AUCUN AUTRE N'AVAIT. Sa réponse n'est pas
// une valeur envoyée par le joueur : c'est un INSTANT, converti en secondes par
// le serveur. Trois choses peuvent donc être fausses sans que rien ne se voie à
// l'écran — l'arbitrage de l'instant, le barème au centième, et les bornes du
// graphique. Les trois sont mesurées ici.
import { describe, it, expect } from 'vitest';
import {
  modules, plagesEstimation, valeurDuBuzz, auCentieme,
  DUREE_JUSTE_TEMPS, TOLERANCE_RESEAU, SANS_ANNONCE, borneDeChrono,
} from '../../src/server/modules.js';
import { chronoAffiche, secondes, formatteurDe } from '../../src/client/shared/temps.js';
import { jourEntreLesDeux, margeDeGrille, TRAIT, GRILLE, CADRAN } from '../../src/client/shared/marque-chrono.js';

const jt = modules.juste_temps;

// Fabrique une manche et ses buzz. `at` est un décalage en millisecondes depuis
// le départ ; `annonce` est ce que le client prétend avoir vu.
function manche(cible, buzz, cache = 9.5) {
  const rt = jt.buildRound({ id: 'q', cache, cible });
  rt.startedAt = 1_000_000;
  rt.answers = new Map(buzz.map((b, i) => [
    `p${i}`,
    { value: b.annonce === undefined ? SANS_ANNONCE : b.annonce, at: rt.startedAt + b.at },
  ]));
  return rt;
}
// Le buzz d'un joueur PARFAIT : il annonce exactement ce que l'arbitre voit.
const aSec = (v) => ({ at: (DUREE_JUSTE_TEMPS - v) * 1000, annonce: v });

describe('le barème du juste temps', () => {
  it('paie les quatre paliers de l\'énoncé, aux bornes exactes', () => {
    // L'énoncé donne les quatre plages. Les bornes sont INCLUSES dans le palier le
    // plus généreux : c'est la règle déjà tenue par l'estimation, et le joueur qui
    // tombe pile sur une borne doit toucher le palier qu'il vise, pas celui du
    // dessous.
    const cas = [
      [0.00, 1000], [0.10, 1000],
      [0.11, 750], [0.30, 750],
      [0.31, 500], [0.50, 500],
      [0.51, 250], [1.00, 250],
      [1.01, 0], [4.00, 0],
    ];
    for (const [ecart, attendu] of cas) {
      const { results } = jt.score(manche(7.00, [aSec(auCentieme(7.00 + ecart))]));
      expect(results.get('p0').base, `écart de ${ecart} s`).toBe(attendu);
    }
  });

  it('LE CENTIÈME EST L\'UNITÉ, et le flottant ne le sait pas', () => {
    // LE DÉFAUT GARDÉ, ET IL EST INVISIBLE. `Math.abs(5.02 - 4.72)` vaut
    // 0.30000000000000027 : comparé nu à la borne de 0,3, ce joueur tombe au
    // palier du dessous — 500 au lieu de 750 — pour une erreur de 2,7 × 10⁻¹⁶
    // seconde. Rien à l'écran ne le dirait ; l'animateur conclurait que le joueur
    // s'était trompé.
    //
    // C'est le cas EXACT de l'exemple de l'énoncé (cible 4,72).
    const { results } = jt.score(manche(4.72, [aSec(5.02)]));
    expect(results.get('p0').base).toBe(750);
    expect(results.get('p0').palier).toBe('proche');
  });

  it('le maximum d\'une manche est 1 200, et il exige le centième pile', () => {
    // 1 000 de palier + 200 d'exactitude. L'énoncé annonce ce maximum : c'est la
    // seule addition qui y mène, et il n'y a PAS de filet du plus proche ici.
    const { results } = jt.score(manche(4.72, [aSec(4.72), aSec(4.73)]));
    const pile = results.get('p0');
    expect(pile.base + pile.bonusExact).toBe(1200);
    expect(pile.exact).toBe(true);

    // Un centième à côté : le même palier, mais plus d'exactitude.
    const presque = results.get('p1');
    expect(presque.base).toBe(1000);
    expect(presque.bonusExact).toBe(0);
    expect(presque.exact).toBe(false);

    // Et AUCUN bonus du plus proche, même quand tout le monde est hors barème :
    // l'énoncé ne le prévoit pas, et son maximum ne le laisse pas entrer.
    const { results: loin } = jt.score(manche(4.72, [aSec(12.00), aSec(1.00)]));
    for (const r of loin.values()) {
      expect(r.base).toBe(0);
      expect(r.bonusProche ?? 0).toBe(0);
    }
  });

  it('la réussite — celle qui nourrit la série — est les deux meilleurs paliers', () => {
    const { results } = jt.score(manche(7.00, [aSec(7.10), aSec(7.30), aSec(7.31)]));
    expect(results.get('p0').correct).toBe(true);  // mille
    expect(results.get('p1').correct).toBe(true);  // proche
    expect(results.get('p2').correct).toBe(false); // correct
  });
});

describe('l\'arbitrage du buzz', () => {
  const rt = { startedAt: 1_000_000 };
  // L'arbitre voit ce temps-ci ; le joueur, lui, a vu davantage — le réseau.
  const arrivee = (secondesEcoulees) => rt.startedAt + secondesEcoulees * 1000;

  it('retient l\'annonce du joueur quand elle tient dans la fenêtre du réseau', () => {
    // Le joueur a vu 4,80 ; son buzz arrive alors que l'arbitre lit 4,72. L'écart
    // — 80 ms — est un aller-retour ordinaire. C'est le joueur qui a raison : il
    // a appuyé sur ce qu'il voyait.
    expect(valeurDuBuzz(rt, { value: 4.80, at: arrivee(10.28) })).toBe(4.80);
  });

  it('ne descend JAMAIS sous l\'horloge de l\'arbitre', () => {
    // Annoncer moins que l'écoulé réel, c'est prétendre avoir buzzé après avoir
    // buzzé. Le plancher est l'arbitre, toujours.
    expect(valeurDuBuzz(rt, { value: 2.00, at: arrivee(10.00) })).toBe(5.00);
  });

  it('ne monte jamais au-delà de la tolérance réseau', () => {
    // LE DÉFAUT GARDÉ : sans plafond, l'annonce du client serait le score. Un
    // joueur qui annonce trois secondes de plus que ce que l'arbitre a vu est
    // ramené à la limite — pas refusé, car un réseau lent n'est pas une faute.
    const arbitre = DUREE_JUSTE_TEMPS - 10;
    expect(valeurDuBuzz(rt, { value: arbitre + 3, at: arrivee(10) }))
      .toBe(auCentieme(arbitre + TOLERANCE_RESEAU));
  });

  it('se passe d\'annonce quand le client n\'en fait pas', () => {
    // Un buzz reste un buzz : l'heure suffit. C'est le repli, et il ne doit
    // jamais coûter la manche à qui l'atteint.
    expect(valeurDuBuzz(rt, { value: SANS_ANNONCE, at: arrivee(3) })).toBe(12);
    expect(valeurDuBuzz(rt, { value: null, at: arrivee(3) })).toBe(12);
  });

  it('reste dans le cadran, des deux côtés', () => {
    // La fenêtre de réponse DÉPASSE le compte à rebours pour que buzzer à zéro
    // reste possible : un buzz arrivé après quinze secondes vaut zéro, jamais un
    // temps négatif.
    expect(valeurDuBuzz(rt, { value: SANS_ANNONCE, at: arrivee(15.9) })).toBe(0);
    expect(valeurDuBuzz(rt, { value: 99, at: arrivee(0) })).toBe(DUREE_JUSTE_TEMPS);
  });

  it('les deux temps saisis par l\'animateur sont ramenés dans le cadran', () => {
    expect(borneDeChrono(4.723)).toBe(4.72);
    expect(borneDeChrono(-3)).toBe(0);
    expect(borneDeChrono(42)).toBe(DUREE_JUSTE_TEMPS);
    expect(borneDeChrono('')).toBe(0);
    expect(borneDeChrono(undefined)).toBe(0);
  });
});

describe('le graphique du juste temps', () => {
  it('porte EXACTEMENT les bornes de l\'exemple de l\'énoncé', () => {
    // L'énoncé donne le cas complet, chiffré : « pour une cible de 4.72, les
    // valeurs 3.72 | 4.22 | 4.42 | 4.62 | 4.72 | 4.82 | 5.02 | 5.22 | 5.72 sont
    // affichées sur le graphique ». C'est le contrôle le plus direct qu'on puisse
    // écrire sur ce jeu : la demande elle-même, en nombres.
    const plages = plagesEstimation(4.72, 'temps');
    const bornes = [...new Set(plages.flatMap((p) => [p.bas, p.haut])), 4.72]
      .sort((a, b) => a - b);
    expect(bornes).toEqual([3.72, 4.22, 4.42, 4.62, 4.72, 4.82, 5.02, 5.22, 5.72]);
  });

  it('écrit ses plages en secondes, jamais en pourcentages', () => {
    // « ± 10 % » n'a aucun sens sur un chrono : la même adresse vaudrait dix fois
    // moins parce que l'animateur a choisi un petit nombre.
    const libelles = plagesEstimation(4.72, 'temps').map((p) => p.libelle);
    expect(libelles).toEqual(['± 0,1 s', '± 0,3 s', '± 0,5 s', '± 1 s']);
  });

  it('publie une répartition que les écrans du barème savent déjà lire', () => {
    // `kind: 'numeric'` n'est pas un raccourci : c'est ce que lisent l'histogramme
    // calé sur le barème, son axe, sa règle de plages et les phrases de plateau.
    // `unite` est la SEULE chose qui change — comment écrire les nombres.
    const { reveal } = jt.score(manche(4.72, [aSec(4.72), aSec(5.10), aSec(3.00)]));
    expect(reveal.stats.kind).toBe('numeric');
    expect(reveal.stats.unite).toBe('secondes');
    expect(reveal.stats.nature).toBe('temps');
    expect(reveal.stats.target).toBe(4.72);
    expect(reveal.stats.cache).toBe(9.5);
    expect(reveal.stats.histogramme.exact).toBe(1);
    expect(reveal.stats.closest).toBe(4.72);
    // La moyenne reste au centième : arrondie à l'entier — ce que faisait le
    // panneau de l'animateur — le seul chiffre qu'il regarde pour décider serait
    // faux d'un tiers de seconde, sur un jeu dont le meilleur palier fait un
    // dixième.
    //
    // ON NE VÉRIFIE PAS `avg * 100` : cette multiplication est exactement le
    // piège que le code évite. `4.27 * 100` vaut 426,99999999999994, et
    // l'assertion rougirait sur une valeur juste. On compare la moyenne à
    // elle-même passée par l'arrondi du projet — elle ne doit pas bouger.
    expect(reveal.stats.avg).toBe(auCentieme(reveal.stats.avg));
    expect(reveal.stats.avg).not.toBe(Math.round(reveal.stats.avg));
  });

  it('LA CIBLE NE PART JAMAIS dans la question publique', () => {
    // C'est tout le jeu. Le temps de CACHE, lui, est public : le client doit
    // savoir quand effacer, et le connaître n'apprend rien sur la cible.
    const rt = jt.buildRound({ id: 'q', cache: 9.5, cible: 4.72 });
    const publique = jt.publicQuestion(rt);
    expect(JSON.stringify(publique)).not.toContain('4.72');
    expect(publique.cache).toBe(9.5);
    expect(publique.dureeCompteMs).toBe(DUREE_JUSTE_TEMPS * 1000);
    // Et l'énoncé lui-même ne la porte pas : il s'affiche sur le stream.
    expect(rt.text).not.toContain('4');
  });

  it('la fenêtre de réponse dépasse le cadran, sinon buzzer à zéro serait impossible', () => {
    // `submitAnswer` refuse à l'échéance EXACTE. Un joueur qui vise 0,00 arrive à
    // quinze secondes pile : sans marge, la cible la plus tentante du jeu — celle
    // où l'on ne voit plus rien depuis longtemps — serait structurellement hors
    // d'atteinte.
    const rt = jt.buildRound({ id: 'q', cache: 9.5, cible: 0 });
    expect(rt.durationMs).toBeGreaterThan(DUREE_JUSTE_TEMPS * 1000);
  });
});

describe('l\'écriture des temps', () => {
  it('le cadran garde une largeur constante, centièmes compris', () => {
    // LE DÉFAUT GARDÉ : un affichage qui perd ou gagne un caractère fait sauter
    // les chiffres cent fois par seconde, sur un écran où l'on ne regarde qu'eux.
    for (const v of [15, 9.5, 4.72, 0.07, 0]) {
      expect(chronoAffiche(v)).toMatch(/^\d\d,\d\d$/);
    }
    expect(chronoAffiche(4.72)).toBe('04,72');
    expect(chronoAffiche(15)).toBe('15,00');
    expect(chronoAffiche(0)).toBe('00,00');
    // Le cadran TRONQUE, il n'arrondit pas : afficher « 05,00 » alors qu'il reste
    // 4,996 s ferait croire au joueur qu'il a encore une seconde entière.
    expect(chronoAffiche(4.999)).toBe('04,99');
  });

  it('une valeur de temps s\'écrit en secondes, à la française', () => {
    expect(secondes(4.72)).toBe('4,72 s');
    expect(secondes(15)).toBe('15,00 s');
    expect(secondes(null)).toBe('—');
  });

  it('le formatteur suit l\'UNITÉ annoncée par le serveur, jamais un type deviné', () => {
    const parDefaut = (n) => `n=${n}`;
    expect(formatteurDe({ unite: 'secondes' }, parDefaut)(4.72)).toBe('4,72 s');
    expect(formatteurDe({ kind: 'numeric' }, parDefaut)(4.72)).toBe('n=4.72');
    expect(formatteurDe(null, parDefaut)(4.72)).toBe('n=4.72');
  });
});

describe('l\'emblème du juste temps', () => {
  it('le chronomètre et le buzzer ne se touchent pas', () => {
    // LE DÉFAUT GARDÉ : deux objets empilés qui se rejoignent forment une tache,
    // et l'emblème cesse de nommer ses deux idées. Un dessin écarté posait une
    // embase six unités sous le socle, pour un trait de 6,4 — les deux barres se
    // rejoignaient. Le seuil est le trait : sous cette valeur, l'œil relie.
    expect(jourEntreLesDeux()).toBeGreaterThanOrEqual(TRAIT / 2);
  });

  it('l\'emblème entier tient dans sa grille', () => {
    // Un débordement ne fait rougir aucun navigateur : il RECADRE, et l'emblème
    // arrive rogné sur la toile du stream sans que rien ne le signale.
    expect(margeDeGrille()).toBeGreaterThan(0);
    // La grille est plus HAUTE que large — c'est ce qui permet aux deux objets de
    // ne pas se rapetisser l'un l'autre. Une grille carrée serait le signe qu'on
    // a écrasé le dessin.
    expect(GRILLE.hauteur).toBeGreaterThan(GRILLE.largeur);
    // Le cadran reste le sujet principal : il occupe au moins la moitié de la
    // largeur, sans quoi l'emblème se lit « buzzer » plutôt que « chronomètre ».
    expect(CADRAN.r * 2).toBeGreaterThanOrEqual(GRILLE.largeur / 2);
  });
});
