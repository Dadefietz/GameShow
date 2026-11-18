// « FRONTIÈRES » — LE SECRET, LE BARÈME, LE TIRAGE.
//
// CE QUE CE FICHIER GARDE, ET QU'AUCUN ŒIL NE VERRAIT. Ce jeu repose tout
// entier sur UN secret : la silhouette d'un pays, que quatre indices éclairent
// un par un. Si le nom, un indice ou simplement l'ADRESSE DE L'IMAGE partent
// avec la manche, le jeu n'est plus un jeu — et rien, à l'écran, ne le montre.
// La partie se déroule normalement, les points tombent, et seul un joueur qui
// ouvre l'onglet réseau de son navigateur s'en aperçoit. Pour une émission
// diffusée, c'est le pire des défauts : invisible à la relecture, invisible à
// l'antenne, et décisif pour qui le trouve.
//
// Un de ces défauts a existé : la première version nommait les cartes d'après le
// pays (`france.webp`). Le contrôle de fuite ci-dessous l'aurait arrêté.
import { describe, it, expect } from 'vitest';
import { modules, banqueDeFrontieres, tirerUnPays, MARQUE_FRONTIERES } from '../../src/server/modules.js';
import { CARTES_FRONTIERES, DIFFICULTES_FRONTIERES, srcDeCarte } from '../../src/server/pays-frontieres.js';
import { memeNom } from '../../src/server/cache-cache.js';

const jeu = modules.frontieres;
const DUREE = jeu.meta.dureeS * 1000;

// Une manche prête à être notée, avec une échéance fixe : le barème se lit sur
// le temps RESTANT, c'est donc lui qu'on pilote.
function manche(paysId = 'f066') {
  const rt = jeu.buildRound({ id: 'q-test', paysId });
  rt.deadline = 1_000_000;
  rt.answers = new Map();
  return rt;
}
const aRestantDe = (rt, ms) => rt.deadline - ms;

describe('la banque de pays', () => {
  it('porte les cent soixante-quinze pays, complets', () => {
    expect(CARTES_FRONTIERES.length).toBe(175);
    for (const p of CARTES_FRONTIERES) {
      for (const champ of ['id', 'nom', 'continent', 'longueur', 'largeur', 'frontaliers', 'initiale']) {
        expect(String(p[champ] || '').trim(), `« ${p.nom} » n'a pas de ${champ}`).not.toBe('');
      }
      expect(DIFFICULTES_FRONTIERES, `« ${p.nom} » a une difficulté hors de 1..4`).toContain(p.difficulte);
    }
  });

  it('AUCUN IDENTIFIANT NE DIT SON PAYS — l\'adresse de l\'image est muette', () => {
    // LE DÉFAUT EXACT QU'ON A COMMIS : `france.webp` donnait la réponse dans
    // l'onglet réseau. Un identifiant doit être une étiquette, pas un nom.
    for (const p of CARTES_FRONTIERES) {
      expect(p.id, `« ${p.nom} » porte un identifiant parlant : ${p.id}`).toMatch(/^f\d{3}$/);
      expect(srcDeCarte(p.id)).toBe(`/cartes/${p.id}.webp`);
    }
  });

  it('aucun identifiant en double, aucun nom qui en confonde deux', () => {
    const ids = CARTES_FRONTIERES.map((p) => p.id);
    expect(ids.length - new Set(ids).size, 'identifiants en double').toBe(0);
    // La comparaison des réponses ignore accents, casse et article de tête : il
    // faut qu'elle ne rapproche JAMAIS deux pays distincts, sans quoi une bonne
    // réponse en validerait une autre.
    const noms = CARTES_FRONTIERES.map((p) => p.nom);
    const confondus = [];
    for (let i = 0; i < noms.length; i += 1) {
      for (let j = i + 1; j < noms.length; j += 1) {
        if (memeNom(noms[i], noms[j])) confondus.push(`${noms[i]} == ${noms[j]}`);
      }
    }
    expect(confondus, 'deux pays que la comparaison confond').toEqual([]);
  });

  it('se rabat sur le dépôt tant que l\'animateur ne l\'a pas modérée', () => {
    expect(banqueDeFrontieres(null).length).toBe(175);
    expect(banqueDeFrontieres([{ kind: MARQUE_FRONTIERES, pays: [] }]).length).toBe(175);
    const modifiee = banqueDeFrontieres([{
      kind: MARQUE_FRONTIERES,
      pays: [{ id: 'f001', nom: 'Afghanistan', difficulte: 2, continent: 'Asie',
        longueur: '1 km', largeur: '1 km', frontaliers: 'Iran', initiale: 'A' }],
    }]);
    expect(modifiee.length).toBe(1);
    expect(modifiee[0].difficulte).toBe(2);
  });
});

describe('la manche ne laisse rien fuir', () => {
  it('LA CHARGE PUBLIQUE NE DIT NI LE PAYS NI SES INDICES', () => {
    const rt = manche('f066');
    const pub = jeu.publicQuestion(rt);
    // `noms` est la liste des cent soixante-quinze pays, pour l'aide à la
    // saisie : elle contient forcément la réponse, et ne révèle rien — le joueur
    // sait déjà que c'en est un. On la met de côté pour examiner le reste.
    const reste = JSON.stringify({ ...pub, noms: null });
    expect(reste, 'le nom du pays part avec la manche').not.toContain(rt.cible.nom);
    for (const [cle, valeur] of Object.entries(rt.indices)) {
      const texte = typeof valeur === 'string' ? valeur : JSON.stringify(valeur);
      expect(reste, `l'indice « ${cle} » part avec la manche`).not.toContain(texte);
    }
  });

  it('déclare les quatre emplacements, vides, avec leur seconde', () => {
    const pub = jeu.publicQuestion(manche());
    expect(pub.emplacements.map((e) => e.cle)).toEqual(['continent', 'taille', 'frontaliers', 'initiale']);
    expect(pub.emplacements.map((e) => e.apresMs)).toEqual([10_000, 20_000, 30_000, 40_000]);
    // Aucune valeur : l'écran dessine un « ? » et attend que le serveur pousse.
    for (const e of pub.emplacements) expect(e.valeur).toBeUndefined();
  });

  it('livre les noms pour l\'aide à la saisie', () => {
    const pub = jeu.publicQuestion(manche());
    expect(pub.noms.length).toBe(175);
    expect(pub.noms).toContain('France');
  });
});

describe('ce que le serveur accepte comme réponse', () => {
  it('ne retient qu\'un pays de la banque, quelle que soit la casse ou l\'accent', () => {
    const rt = manche();
    expect(jeu.validateAnswer(rt, 'france')).toBe('France');
    expect(jeu.validateAnswer(rt, 'FRANCE')).toBe('France');
    // LE NOM VIENT DE LA BANQUE, JAMAIS RECOPIÉ ICI. « Côte d’Ivoire » s'y écrit
    // avec une apostrophe typographique ; la recopier à la main dans un contrôle
    // le fait échouer sur un caractère, pas sur un défaut — c'est arrivé à la
    // première écriture de ce fichier. Et c'est justement ce qu'on vérifie : le
    // joueur tape ce qu'il peut, le serveur rend la forme canonique.
    const ivoire = CARTES_FRONTIERES.find((p) => p.nom.startsWith('Côte')).nom;
    expect(jeu.validateAnswer(rt, `  ${ivoire} `)).toBe(ivoire);
    expect(jeu.validateAnswer(rt, 'Cote d Ivoire')).toBe(ivoire);
    expect(jeu.validateAnswer(rt, "cote d'ivoire")).toBe(ivoire);
  });

  it('REFUSE TOUT CE QUI N\'EST PAS UN PAYS — la console n\'est pas une source de texte', () => {
    const rt = manche();
    for (const brut of ['', '   ', 'Fr', 'Atlantide', '<script>alert(1)</script>', 'x'.repeat(200), null, 42]) {
      expect(jeu.validateAnswer(rt, brut), `« ${String(brut).slice(0, 20)} » a été accepté`).toBeNull();
    }
  });
});

describe('le barème — chaque indice dévoilé coûte un palier', () => {
  // L'auteur l'a écrit en secondes restantes, avec des bornes qui se chevauchent
  // à 5 s. Le sens, lui, est dit deux fois dans le document : plus on a vu
  // d'indices, moins on marque. On vérifie donc les CHARNIÈRES, là où un
  // décalage d'une seconde se verrait.
  const cas = [
    [DUREE, 1200, 'au tout début'],
    [35_001, 1200, 'juste avant le premier indice'],
    [35_000, 1000, 'à la seconde du premier indice'],
    [25_001, 1000, 'juste avant le deuxième'],
    [25_000, 800, 'à la seconde du deuxième'],
    [15_001, 800, 'juste avant le troisième'],
    [15_000, 600, 'à la seconde du troisième'],
    [5_001, 600, 'juste avant le quatrième'],
    [5_000, 300, 'à la seconde du quatrième'],
    [0, 300, 'au buzzer'],
  ];
  for (const [reste, points, quand] of cas) {
    it(`${points} points ${quand} (${reste} ms restantes)`, () => {
      const rt = manche('f066');
      rt.answers.set('p1', { value: rt.cible.nom, at: aRestantDe(rt, reste) });
      const { results } = jeu.score(rt);
      expect(results.get('p1').base).toBe(points);
      expect(results.get('p1').correct).toBe(true);
    });
  }

  it('une mauvaise réponse ne rapporte rien, même donnée tout de suite', () => {
    const rt = manche('f066');
    const autre = CARTES_FRONTIERES.find((p) => p.id !== 'f066').nom;
    rt.answers.set('p1', { value: autre, at: aRestantDe(rt, DUREE) });
    const { results } = jeu.score(rt);
    expect(results.get('p1').base).toBe(0);
    expect(results.get('p1').correct).toBe(false);
    // Le palier qu'elle VALAIT voyage quand même : l'écran du joueur peut dire
    // ce qu'il a manqué, ce qui apprend le barème sans l'énoncer.
    expect(results.get('p1').palierPoints).toBe(1200);
  });
});

describe('le dépouillement', () => {
  it('trie les réponses de la plus donnée à la moins donnée, et garde les joueurs à part', () => {
    const rt = manche('f066');
    const bon = rt.cible.nom;
    const faux = CARTES_FRONTIERES.find((p) => p.id !== 'f066').nom;
    rt.answers.set('a', { value: faux, at: aRestantDe(rt, 40_000) });
    rt.answers.set('b', { value: bon, at: aRestantDe(rt, 30_000) });
    rt.answers.set('c', { value: faux, at: aRestantDe(rt, 20_000) });
    rt.answers.set('d', { value: faux, at: aRestantDe(rt, 10_000) });
    const { reveal, prives } = jeu.score(rt);

    expect(reveal.pays).toBe(bon);
    expect(reveal.repartition[0]).toEqual({ nom: faux, juste: false, n: 3 });
    expect(reveal.repartition[1]).toEqual({ nom: bon, juste: true, n: 1 });

    // LE STREAM N'A PAS LES JOUEURS, LA CONSOLE OUI. Aucun pseudonyme ne quitte
    // le canal de l'animateur dans ce projet, et ce jeu ne fait pas exception.
    expect(JSON.stringify(reveal), 'un identifiant de joueur part dans la révélation').not.toContain('"a"');
    expect(prives.reponses.find((r) => r.nom === faux).joueurs.sort()).toEqual(['a', 'c', 'd']);
  });
});

describe("l'écran de résultat a de quoi se remplir", () => {
  // « La Carte cible, la réponse donnée et le pays réponse (nom en français du
  // pays), les indices, et les points obtenus. » Cinq choses, et aucune ne peut
  // s'afficher si la révélation ne les porte pas.
  it('la révélation porte la carte, le pays, les quatre indices ET leurs titres', () => {
    const rt = manche('f066');
    const cible = CARTES_FRONTIERES.find((p) => p.id === 'f066');
    rt.answers.set('p1', { value: cible.nom, at: aRestantDe(rt, 20_000) });
    const { reveal } = jeu.score(rt);

    expect(reveal.pays).toBe(cible.nom);
    expect(reveal.carte).toBe(srcDeCarte('f066'));
    expect(reveal.indices.continent).toBe(cible.continent);
    expect(reveal.indices.taille).toEqual({ longueur: cible.longueur, largeur: cible.largeur });
    expect(reveal.indices.frontaliers).toBe(cible.frontaliers);
    expect(reveal.indices.initiale).toBe(cible.initiale);
    // LES TITRES ET L'ORDRE VOYAGENT AVEC. Sans eux, un écran remonté après la
    // révélation — un stream rouvert dans OBS — aurait les quatre valeurs sans
    // savoir laquelle est le continent ni dans quel ordre les poser.
    expect(reveal.emplacements.map((e) => e.cle))
      .toEqual(['continent', 'taille', 'frontaliers', 'initiale']);
    expect(reveal.emplacements.every((e) => typeof e.nom === 'string' && e.nom)).toBe(true);
  });

  it('LE RELEVÉ PORTE LA RÉPONSE QUE L’ARBITRE A COMPTÉE, et pas celle que l’écran croit', () => {
    // Le téléphone ne sait pas toujours ce que le serveur a retenu : une réponse
    // partie trop tard est refusée, et une réponse JAMAIS ENVOYÉE peut avoir été
    // gardée comme brouillon. C'est donc l'arbitre qui dit laquelle compte.
    const rt = manche('f066');
    const autre = CARTES_FRONTIERES.find((p) => p.id !== 'f066').nom;
    rt.answers.set('p1', { value: autre, at: aRestantDe(rt, 12_000) });
    const { results } = jeu.score(rt);
    expect(results.get('p1').reponse).toBe(autre);
    expect(results.get('p1').indicesVus).toBe(3);
  });

  it('LA RÉPONSE CHOISIE SANS ÊTRE ENVOYÉE EST GARDÉE — et vaut le minimum', () => {
    // « S'il ne l'envoie pas avant la fin du compteur, la réponse est gardée et
    // si elle est bonne, elle vaudra le minimum de point. »
    //
    // LE JEU DOIT LE DÉCLARER pour que le moteur garde les brouillons : c'est
    // `meta.brouillon` qui ouvre `submitBrouillon`, et rien d'autre.
    expect(jeu.meta.brouillon, 'sans ce drapeau, le moteur jette les brouillons').toBe(true);
    // ET LE BARÈME SUIT TOUT SEUL : un brouillon devenu réponse porte
    // l'horodatage de l'échéance, donc zéro temps restant, donc le dernier
    // palier. C'est le même chemin que `closeWindow` emprunte.
    const rt = manche('f066');
    rt.answers.set('p1', { value: rt.cible.nom, at: rt.deadline, auto: true });
    const { results } = jeu.score(rt);
    expect(results.get('p1').correct).toBe(true);
    expect(results.get('p1').base).toBe(300);
    expect(results.get('p1').indicesVus).toBe(4);
  });
});

describe('le tirage sans choix de l\'animateur', () => {
  it('reste dans la difficulté demandée', () => {
    const banque = banqueDeFrontieres(null);
    for (const d of DIFFICULTES_FRONTIERES) {
      for (let i = 0; i < 20; i += 1) {
        expect(tirerUnPays(banque, d, {}).difficulte).toBe(d);
      }
    }
  });

  it('PRÉFÈRE LES MOINS JOUÉS, sans devenir prévisible pour autant', () => {
    const banque = banqueDeFrontieres(null).filter((p) => p.difficulte === 1);
    // Tous joués une fois, sauf trois restés à zéro.
    const poses = Object.fromEntries(banque.map((p) => [p.id, 1]));
    const frais = banque.slice(0, 3).map((p) => p.id);
    for (const id of frais) delete poses[id];

    const tires = new Set();
    for (let i = 0; i < 60; i += 1) tires.add(tirerUnPays(banque, 1, poses).id);
    // Jamais un pays déjà joué tant qu'il en reste des neufs…
    expect([...tires].every((id) => frais.includes(id)),
      'un pays déjà joué est sorti alors qu\'il en restait des neufs').toBe(true);
    // …et pas toujours le même : une préférence n'est pas un ordre.
    expect(tires.size, 'le tirage sort toujours le même pays — il est prévisible').toBeGreaterThan(1);
  });

  it('ne se bloque pas sur une difficulté vide : il tire alors dans toute la banque', () => {
    const banque = banqueDeFrontieres(null).filter((p) => p.difficulte === 1);
    const tire = tirerUnPays(banque, 4, {});
    expect(tire).toBeTruthy();
    expect(banque).toContain(tire);
  });
});
