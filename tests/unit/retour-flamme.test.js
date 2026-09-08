// CONTRÔLE DE « RETOUR DE FLAMME ».
//
// CE QUE CE JEU A DE PARTICULIER, ET QU'AUCUN AUTRE N'AVAIT :
//   - sa série doit contenir SIX retours, « pas plus, pas moins ». Un de trop et
//     le jeu est plus facile qu'annoncé, un de moins et un joueur parfait ne peut
//     pas atteindre le maximum. Rien à l'écran ne le dirait ;
//   - on y buzze PLUSIEURS FOIS, et l'on peut finir en négatif sans rien perdre.
// Les deux se vérifient ici, et le premier contrôle est l'exemple de l'énoncé
// lui-même, recopié au chiffre près.
import { describe, it, expect } from 'vitest';
import {
  modules, construireSerieRetour, retoursDeLaSerie,
  TOTAL_RETOUR, RETOURS_PAR_SERIE, POINTS_RETOUR, ECARTS_RETOUR, CADENCE_RETOUR,
} from '../../src/server/modules.js';
import { BASSIN_RETOUR } from '../../src/server/symboles.js';
import { symboleDe, libelleDe } from '../../src/client/shared/symboles.js';
import { geometrieDe, jourDuCrochet, TRAIT } from '../../src/client/shared/marque-retour.js';

const rf = modules.retour_flamme;

// La série de l'énoncé, mode −2, telle qu'elle y est écrite.
const EXEMPLE_2 = [7, 8, 9, 8, 4, 2, 5, 7, 5, 3, 2, 6, 8, 9, 4, 7, 4, 6, 5, 6, 0, 9, 8, 7, 9, 7, 7, 7, 0, 1];

// La seconde série de l'énoncé, mode −3, relevée sur le tableau fourni.
const EXEMPLE_3 = [7, 8, 9, 8, 8, 2, 5, 7, 5, 6, 2, 5, 8, 9, 5, 7, 4, 0, 5, 6, 0, 9, 6, 7, 9, 7, 7, 7, 0, 1];

// Fabrique une manche et ses buzz. `buzz` est une carte pseudo → places désignées.
function manche(ecart, buzz, serie) {
  const rt = rf.buildRound({ id: 'q', ecart });
  if (serie) { rt.ordre = serie.ordre; rt.retours = serie.retours; }
  rt.startedAt = 1_000_000;
  rt.answers = new Map(Object.entries(buzz).map(([pid, places]) => [pid, { value: places, at: 0 }]));
  return rt;
}

describe('la règle du retour', () => {
  it('reproduit EXACTEMENT l\'exemple de l\'énoncé', () => {
    // C'est le contrôle le plus direct qu'on puisse écrire sur ce jeu : la
    // demande elle-même, en nombres. « Les joueurs doivent buzzer aux images 4, 9,
    // 17, 20, 26, 28. »
    expect(retoursDeLaSerie(EXEMPLE_2, 2)).toEqual([4, 9, 17, 20, 26, 28]);
  });

  it('applique la règle au second exemple de l\'énoncé — QUI EN COMPTE SEPT', () => {
    // L'ÉNONCÉ SE CONTREDIT ICI, ET C'EST LA RÈGLE QUI A ÉTÉ SUIVIE.
    //
    // « Les joueurs doivent buzzer aux images 5, 12, 15, 21, 25, 27 » — six
    // retours, comme l'exige la règle qui suit (« Il doit y avoir 6 Retour
    // d'image dans une série, pas plus, pas moins »). Mais la série fournie en
    // contient SEPT : l'image 23 vaut 6, comme l'image 20 trois places plus tôt.
    // Relevé deux fois sur le tableau, à huit fois la taille.
    //
    // La liste de l'énoncé oublie donc un retour que sa propre définition
    // désigne. Ce contrôle fige la LECTURE RETENUE : la règle prime sur
    // l'exemple. Le tirage, lui, n'a jamais ce problème — il construit des
    // séries à exactement six retours, et le contrôle suivant le vérifie.
    expect(retoursDeLaSerie(EXEMPLE_3, 3)).toEqual([5, 12, 15, 21, 23, 25, 27]);
    // Les six que l'énoncé cite en font tous partie : rien n'a été perdu, un
    // septième s'y ajoute.
    for (const place of [5, 12, 15, 21, 25, 27]) {
      expect(retoursDeLaSerie(EXEMPLE_3, 3)).toContain(place);
    }
  });

  it('lit bien « la même image qu\'il y a N », et pas « la même qu\'avant »', () => {
    // Le piège de lecture : deux images identiques CÔTE À CÔTE ne sont pas un
    // retour en mode −2, et une image identique deux places plus tôt en est un
    // même si l'image intercalée lui ressemble.
    expect(retoursDeLaSerie(['a', 'a', 'b'], 2)).toEqual([]);
    expect(retoursDeLaSerie(['a', 'b', 'a'], 2)).toEqual([3]);
    expect(retoursDeLaSerie(['a', 'b', 'a'], 3)).toEqual([]);
    expect(retoursDeLaSerie(['a', 'b', 'c', 'a'], 3)).toEqual([4]);
  });
});

describe('la série tirée', () => {
  it('porte SIX retours, ni plus ni moins — sur mille tirages, dans les deux modes', () => {
    // LE DÉFAUT GARDÉ, ET IL EST INVISIBLE. Une série à sept retours se joue
    // normalement : les images défilent, les buzz comptent, personne ne remarque
    // rien. Elle est simplement plus facile que ce que le jeu annonce, et le
    // maximum de 1 200 devient atteignable autrement.
    //
    // ON RELIT LA SÉRIE, on ne fait pas confiance à la liste que le générateur
    // rend : une génération qui se contenterait de rendre sa propre liste ne
    // prouverait rien du tout.
    for (const ecart of ECARTS_RETOUR) {
      for (let n = 0; n < 500; n += 1) {
        const { ordre, retours } = construireSerieRetour(ecart, BASSIN_RETOUR);
        expect(ordre.length, 'la série n\'a pas la bonne longueur').toBe(TOTAL_RETOUR);
        const relus = retoursDeLaSerie(ordre, ecart);
        expect(relus.length, `mode −${ecart} : ${relus.length} retours au lieu de ${RETOURS_PAR_SERIE}`)
          .toBe(RETOURS_PAR_SERIE);
        // Et ce sont bien CEUX QU'ON A POSÉS : aucun retour n'est apparu par
        // accident à la place d'un autre.
        expect(relus).toEqual(retours);
      }
    }
  });

  it('ne place aucun retour là où il ne peut pas y en avoir', () => {
    // Une place ne peut porter un retour que s'il existe une image `ecart` plus
    // tôt : en mode −3, les trois premières places sont hors d'atteinte.
    for (const ecart of ECARTS_RETOUR) {
      for (let n = 0; n < 200; n += 1) {
        const { retours } = construireSerieRetour(ecart, BASSIN_RETOUR);
        expect(Math.min(...retours)).toBeGreaterThan(ecart);
        expect(Math.max(...retours)).toBeLessThanOrEqual(TOTAL_RETOUR);
        expect(new Set(retours).size, 'deux fois la même place').toBe(RETOURS_PAR_SERIE);
      }
    }
  });

  it('n\'emploie que des signes que le client sait dessiner', () => {
    for (let n = 0; n < 100; n += 1) {
      for (const id of construireSerieRetour(2, BASSIN_RETOUR).ordre) {
        expect(symboleDe(id), `signe indessinable dans la série : ${id}`).not.toBeNull();
      }
    }
  });

  it('LA SÉRIE NE PART JAMAIS dans la question publique', () => {
    // C'est tout le jeu. Trente identifiants dont six répètent celui d'il y a deux
    // places, c'est la réponse en clair pour qui ouvre l'onglet réseau.
    const rt = rf.buildRound({ id: 'q', ecart: 2 });
    const publique = JSON.stringify(rf.publicQuestion(rt));
    for (const id of new Set(rt.ordre)) {
      expect(publique, `le signe ${id} fuit dans la question publique`).not.toContain(id);
    }
    // L'ÉCART, LUI, EST PUBLIC — c'est la règle, pas la réponse. Un joueur qui
    // ignorerait s'il joue en −2 ou en −3 ne pourrait pas jouer du tout.
    expect(rf.publicQuestion(rt).ecart).toBe(2);
    expect(rf.publicQuestion(rt).total).toBe(TOTAL_RETOUR);
  });

  it('dure une minute : trente images à deux secondes', () => {
    const rt = rf.buildRound({ id: 'q', ecart: 2 });
    expect(rt.durationMs).toBe(TOTAL_RETOUR * CADENCE_RETOUR);
    expect(rt.durationMs).toBe(60_000);
  });

  it('retombe sur le mode −2 quand l\'écart demandé n\'existe pas', () => {
    // Une valeur venue du réseau ne doit pas choisir une règle au hasard.
    for (const mauvais of [0, 1, 4, -2, 'deux', null, undefined]) {
      expect(rf.buildRound({ id: 'q', ecart: mauvais }).ecart).toBe(2);
    }
  });
});

describe('le barème', () => {
  // Les cinq cas de l'énoncé, repris un par un. `[bons, ratés]` → points gagnés.
  // Une série FACTICE mais complète : trente images, six retours choisis. Les
  // signes n'ont pas d'importance pour le barème — seules les places comptent.
  const serie = {
    ordre: Array.from({ length: TOTAL_RETOUR }, (_, i) => `x-${i}`),
    retours: [3, 6, 9, 12, 15, 18],
  };
  // Des places qui ne sont PAS des retours, pour fabriquer les erreurs.
  const fautes = [4, 5, 7, 8, 10, 11, 13, 14];
  const buzzDe = (bons, rates) => [...serie.retours.slice(0, bons), ...fautes.slice(0, rates)];

  it('paie 200 par retour et retire 200 par buzz à côté', () => {
    const cas = [
      // [bons, ratés, solde annoncé par l'énoncé, points encaissés]
      [6, 0, 1200, 1200],
      [3, 3, 0, 0],
      [6, 5, 200, 200],
      [2, 5, -600, 0],
      [0, 6, -1200, 0],
    ];
    for (const [bons, rates, solde, encaisse] of cas) {
      const rt = manche(2, { p: buzzDe(bons, rates) }, serie);
      const r = rf.score(rt).results.get('p');
      expect(r.bons, `${bons} bons / ${rates} ratés`).toBe(bons);
      expect(r.rates, `${bons} bons / ${rates} ratés`).toBe(rates);
      expect(r.brut, `solde de ${bons} bons / ${rates} ratés`).toBe(solde);
      // LE SCORE TOTAL NE BAISSE JAMAIS : « soit le joueur gagne des points, soit
      // il n'en gagne pas ». C'est la base, et elle seule, qui l'alimente.
      expect(r.base, `points encaissés pour ${bons} bons / ${rates} ratés`).toBe(encaisse);
      expect(r.base).toBeGreaterThanOrEqual(0);
    }
  });

  it('le maximum d\'une manche est 1 200, et il exige le sans-faute', () => {
    expect(RETOURS_PAR_SERIE * POINTS_RETOUR).toBe(1200);
    const parfait = rf.score(manche(2, { p: serie.retours }, serie)).results.get('p');
    expect(parfait.base).toBe(1200);
    expect(parfait.correct).toBe(true);
    // Un seul buzz de trop et le maximum tombe : c'est le sel du jeu.
    const presque = rf.score(manche(2, { p: [...serie.retours, 4] }, serie)).results.get('p');
    expect(presque.base).toBe(1000);
  });

  it('la réussite — celle qui nourrit la série — est un solde POSITIF', () => {
    const nul = rf.score(manche(2, { p: buzzDe(3, 3) }, serie)).results.get('p');
    expect(nul.correct, 'un solde nul n\'est pas une réussite').toBe(false);
    const gagnant = rf.score(manche(2, { p: buzzDe(3, 2) }, serie)).results.get('p');
    expect(gagnant.correct).toBe(true);
  });

  it('publie de quoi dessiner le graphique et faire parler le plateau', () => {
    const { reveal } = rf.score(manche(2, { a: [3, 6, 4], b: [3, 9] }, serie));
    const s = reveal.stats;
    expect(s.kind).toBe('retour');
    expect(s.ordre.length).toBe(TOTAL_RETOUR);
    expect(s.retours).toEqual(serie.retours);
    // Le nombre de buzz par image : c'est la donnée du graphique.
    expect(s.parPlace[2]).toBe(2); // place 3, buzzée par les deux
    expect(s.parPlace[3]).toBe(1); // place 4, buzzée par un seul
    expect(s.parPlace[0]).toBe(0);
    // Et ce que le plateau commente : combien ont marqué, combien de retours ont
    // été démasqués.
    expect(s.marquants).toBe(2);
    // Trois retours démasqués : les places 3, 6 et 9 ont chacune reçu un buzz.
    expect(s.retoursTrouves).toBe(3);
  });
});

describe('les quinze signes', () => {
  it('le serveur n\'en tire aucun que le client ne sache dessiner', () => {
    // LE DÉFAUT GARDÉ. Les deux fichiers ne peuvent pas s'importer l'un l'autre
    // sans faire entrer du code serveur dans le paquet du navigateur. Un signe
    // ajouté d'un seul côté ferait donc défiler une CASE VIDE sur le téléphone
    // d'un joueur — deux secondes de manche perdues, sans que rien ne le signale.
    expect(BASSIN_RETOUR.length).toBe(15);
    for (const id of BASSIN_RETOUR) {
      expect(symboleDe(id), `le client ne sait pas dessiner ${id}`).not.toBeNull();
      expect(libelleDe(id), `le signe ${id} n'a pas de nom lisible`).toBeTruthy();
    }
  });

  it('les quinze sont DISTINCTS, et c\'est tout ce que le jeu leur demande', () => {
    const dessins = BASSIN_RETOUR.map((id) => JSON.stringify(symboleDe(id)));
    expect(new Set(dessins).size, 'deux signes se dessinent pareil').toBe(15);
    const noms = BASSIN_RETOUR.map(libelleDe);
    expect(new Set(noms).size, 'deux signes portent le même nom').toBe(15);
  });

  it('refuse un identifiant inconnu plutôt que d\'inventer', () => {
    for (const faux of ['ch-a', 'ch-42', 'fg-carré', 'carre', '7', '', null, undefined]) {
      expect(symboleDe(faux), `${faux} ne devrait pas être dessinable`).toBeNull();
    }
  });
});

describe('l\'emblème de retour de flamme', () => {
  it('montre le MODE : trois tuiles en −2, quatre en −3', () => {
    // L'emblème EST la règle en image. Un dessin figé mentirait la moitié du
    // temps — et c'est la moitié du temps où l'animateur choisit l'autre mode.
    expect(geometrieDe(2).n).toBe(3);
    expect(geometrieDe(3).n).toBe(4);
    expect(geometrieDe(3).centres.length).toBe(4);
  });

  it('le crochet ne touche pas les tuiles', () => {
    // Deux traits qui se rejoignent forment une masse, et l'emblème cesse de
    // montrer un RETOUR par-dessus la rangée.
    for (const ecart of ECARTS_RETOUR) {
      expect(jourDuCrochet(ecart)).toBeGreaterThanOrEqual(TRAIT);
    }
  });

  it('tient dans sa grille, dans les deux modes', () => {
    for (const ecart of ECARTS_RETOUR) {
      const g = geometrieDe(ecart);
      const [, , l, h] = g.viewBox.split(' ').map(Number);
      // Les centres des tuiles restent dans la largeur, marges du trait comprises.
      expect(Math.min(...g.centres) - g.tuile / 2).toBeGreaterThanOrEqual(0);
      expect(Math.max(...g.centres) + g.tuile / 2).toBeLessThanOrEqual(l);
      expect(g.yTuiles + g.tuile).toBeLessThanOrEqual(h);
    }
  });
});
