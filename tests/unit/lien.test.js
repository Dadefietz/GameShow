// LE LIEN — le barème, les groupes, et ce qui compte pour « le même mot ».
//
// CE QUI REND CE JEU DIFFÉRENT DE TOUS LES AUTRES. Il n'y a pas de bonne réponse.
// On ne gagne pas en ayant raison, mais en ayant pensé COMME LES AUTRES : un mot
// que personne d'autre n'a donné ne rapporte rien, si juste soit-il. Tout le
// barème découle de là, et c'est ce que ce fichier protège.
import { describe, it, expect } from 'vitest';
import { modules, normaliserMot, grouperLesMots, bonusDeRang } from '../../src/server/modules.js';

function manche(reponses) {
  const rt = modules.lien.buildRound({ id: 'l', mot1: 'Pigeon', mot2: 'Avion' });
  rt.startedAt = 1000;
  rt.deadline = rt.startedAt + rt.durationMs;
  rt.answers = new Map();
  let n = 0;
  for (const [mot, combien] of reponses) {
    for (let i = 0; i < combien; i += 1) rt.answers.set(`p${n++}`, { value: mot, at: rt.startedAt });
  }
  return rt;
}

const total = (r) => (r.base || 0) + (r.bonusGroupe || 0);

describe('le barème du lien', () => {
  it('rejoue L\'EXEMPLE DE L\'AUTEUR au chiffre près', () => {
    // Pigeon / Avion, tel qu'il l'a écrit — y compris le CAS SPÉCIAL des deux
    // groupes de huit, qui partagent le rang 3 et laissent le rang 4 vacant.
    const rt = manche([
      ['Aile', 15], ['Vol', 14], ['Voyageur', 8], ['Plume', 8], ['Pilote', 6],
      ['Goudron', 5], ['Piste', 4], ['Bec', 3], ['Queue', 2], ['Hublot', 1], ['Serre', 1],
    ]);
    const { results, reveal } = modules.lien.score(rt);
    const parMot = new Map(reveal.stats.groupes.map((g) => [g.mot, g]));
    const attendu = {
      Aile: [15, 1, 1000], Vol: [14, 2, 900], Voyageur: [8, 3, 800], Plume: [8, 3, 800],
      Pilote: [6, 5, 600], Goudron: [5, 6, 500], Piste: [4, 7, 400], Bec: [3, 8, 300],
      Queue: [2, 9, 300], Hublot: [1, 10, 0], Serre: [1, 10, 0],
    };
    for (const [mot, [count, rang, points]] of Object.entries(attendu)) {
      const g = parMot.get(mot);
      expect(g, `le groupe « ${mot} » manque`).toBeTruthy();
      expect(g.count, `effectif de « ${mot} »`).toBe(count);
      expect(g.rang, `rang de « ${mot} »`).toBe(rang);
      expect(g.points, `points de « ${mot} »`).toBe(points);
    }
    // Et ce que chaque JOUEUR touche vaut bien ce que son groupe annonce.
    for (const [, r] of results) {
      const g = reveal.stats.groupes.find((x) => x.count === r.taille && x.rang === r.rang);
      if (r.rang) expect(total(r), 'le joueur ne touche pas ce que son groupe annonce').toBe(g.points);
    }
  });

  it('ne donne RIEN à celui qui est seul avec son mot', () => {
    // C'est la règle du jeu, pas une punition : on n'y gagne qu'en pensant comme
    // quelqu'un d'autre. Un mot juste et solitaire ne vaut donc rien.
    const rt = manche([['Aile', 2], ['Kérosène', 1]]);
    const { results } = modules.lien.score(rt);
    const seul = [...results.values()].find((r) => r.taille === 1);
    expect(seul.base).toBe(0);
    expect(seul.bonusGroupe).toBe(0);
    expect(seul.correct, 'être seul n\'est pas une réussite dans ce jeu').toBe(false);
  });

  it('plafonne à 1 000, et le premier groupe l\'atteint exactement', () => {
    const rt = manche([['Aile', 3], ['Vol', 2]]);
    const { results } = modules.lien.score(rt);
    const meilleur = Math.max(...[...results.values()].map(total));
    expect(meilleur, 'le maximum du lien a bougé').toBe(1000);
  });

  it('décroît de cent en cent, puis se pose sur un plancher de 50', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(bonusDeRang)).toEqual([750, 650, 550, 450, 350, 250, 150, 50]);
    // Au-delà du huitième, tous les groupes touchent le même plancher : sans lui
    // le bonus deviendrait négatif et retirerait des points, ce qu'aucun jeu du
    // projet ne fait.
    expect([9, 10, 25].map(bonusDeRang)).toEqual([50, 50, 50]);
    expect(bonusDeRang(0), 'un joueur sans groupe n\'a pas de bonus').toBe(0);
  });
});

describe('ce qui compte pour « le même mot »', () => {
  it('ignore la casse et les accents', () => {
    // L'auteur : « étude = etude = Etude = ETUDE = Étude = ÉTUDE ».
    const formes = ['étude', 'etude', 'Etude', 'ETUDE', 'Étude', 'ÉTUDE'];
    expect(new Set(formes.map(normaliserMot)).size,
      'ces six écritures devraient former UN seul groupe').toBe(1);

    const rt = manche(formes.map((f) => [f, 1]));
    const { reveal } = modules.lien.score(rt);
    expect(reveal.stats.groupes).toHaveLength(1);
    expect(reveal.stats.groupes[0].count).toBe(6);
  });

  it('ne rapproche NI les pluriels NI les fautes de frappe', () => {
    // DÉCISION DE L'AUTEUR, et non une limite technique : le pluriel est un choix
    // qui ouvre un autre groupe — probablement avec d'autres joueurs qui ont pensé
    // pareil — et les fautes restent à la charge du joueur. Un rapprochement
    // automatique déciderait à leur place de ce qui « compte pour le même mot »,
    // alors que ce jeu consiste précisément à parier sur ce que les autres écrivent.
    const rt = manche([['aile', 2], ['ailes', 2], ['ailr', 1]]);
    const { reveal } = modules.lien.score(rt);
    expect(reveal.stats.groupes.map((g) => g.mot).sort()).toEqual(['aile', 'ailes', 'ailr']);
  });

  it('écarte les réponses vides et borne la longueur', () => {
    expect(modules.lien.validateAnswer(null, '   ')).toBeNull();
    expect(modules.lien.validateAnswer(null, '  Aile  ')).toBe('Aile');
    // Un joueur qui colle un paragraphe ne doit pas déformer l'écran de l'animateur.
    expect(modules.lien.validateAnswer(null, 'a'.repeat(200))).toHaveLength(40);
  });

  it('range les ex æquo dans un ordre STABLE', () => {
    // Sans cela, deux groupes de même taille s'échangeraient de place d'un
    // affichage à l'autre, et l'animateur perdrait sa liste en la commentant.
    const rt = manche([['Zebre', 3], ['Abeille', 3]]);
    const { groupes } = grouperLesMots(rt.answers);
    expect(groupes.map((g) => g.mot)).toEqual(['Abeille', 'Zebre']);
    expect(groupes.map((g) => g.rang)).toEqual([1, 1]);
  });
});

describe('ce que le stream reçoit', () => {
  it('porte les mots et leurs effectifs, JAMAIS les noms', () => {
    // Même frontière que le nom du plus proche à l'estimation : le stream est une
    // source capturée par OBS. Les noms partent sur le canal de l'animateur seul.
    const rt = manche([['Aile', 2]]);
    const { reveal, prives } = modules.lien.score(rt);
    expect(JSON.stringify(reveal), 'un identifiant de joueur a fuité dans la révélation')
      .not.toContain('p0');
    expect(prives.groupes[0].joueurs).toContain('p0');
  });
});
