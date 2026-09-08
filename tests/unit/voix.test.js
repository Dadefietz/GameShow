// CONTRÔLE BLOQUANT DE LA VOIX DU JEU (action 7 du PLAN-CHANTIER-v1).
//
// Ce fichier n'est pas qu'une batterie de tests : c'est le GARDE-FOU de la
// convention. Toute nouvelle surface et tout nouveau type de jeu doit déclarer
// ses moments de voix — sans quoi la suite échoue.
//
// Il exige une DÉCLARATION, pas une œuvre : une phrase de repli suffit à passer.
// Sa limite, assumée : il garantit qu'une déclaration existe, jamais qu'elle est
// bonne. Qu'une phrase soit plate reste affaire de relecture humaine.
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import { MOMENTS, SURFACES, LONGUEUR_MAX, PRIORITE_PLATEAU, dire, reperesDe, reinitialiserVoix, momentDePlateau } from '../../src/client/shared/voix.js';
import { MODULE_TYPES } from '../../src/server/modules.js';

beforeEach(() => reinitialiserVoix());

// LES MOMENTS VOLONTAIREMENT MUETS. Vide : chaque moment déclaré doit être atteint
// par au moins un chemin de code. Cette liste existe pour qu'un moment laissé de
// côté soit une DÉCISION consignée ici, jamais un oubli — c'est ainsi que huit
// d'entre eux ont dormi des mois.
const MUETS_ASSUMES = [
  // VIDE, et c'est le but. La seule entrée qu'elle ait jamais portée était
  // `reponse.envoyee` — six phrases qui commentaient un écran (« Ta réponse est
  // bien partie ») que l'auteur avait fait retirer. Une exception assumée est une
  // dette : on la solde, on ne la garde pas. Le moment et ses phrases ont été
  // supprimés avec l'écran (A11).
];

describe('convention de la voix — contrôle bloquant', () => {
  it('chaque moment déclaré a au moins une phrase', () => {
    for (const [id, m] of Object.entries(MOMENTS)) {
      expect(m.phrases, `moment « ${id} » sans phrase`).toBeDefined();
      expect(m.phrases.length, `moment « ${id} » sans phrase`).toBeGreaterThan(0);
    }
  });

  it('chaque moment déclare la CONDITION qui le déclenche', () => {
    // C'est ce qui empêche une phrase de mentir : elle est rattachée à un fait
    // vérifié sur les données, jamais à une ambiance générale.
    for (const [id, m] of Object.entries(MOMENTS)) {
      expect(m.quand, `moment « ${id} » sans condition documentée`).toBeTruthy();
      expect(m.surface, `moment « ${id} » sans surface`).toBeTruthy();
      expect(SURFACES, `surface inconnue pour « ${id} »`).toContain(m.surface);
    }
  });

  it('aucune phrase ne contient d\'emoji — convention du projet', () => {
    const emoji = /\p{Extended_Pictographic}/u;
    for (const [id, m] of Object.entries(MOMENTS)) {
      for (const p of m.phrases) {
        expect(emoji.test(p), `emoji dans « ${id} » : ${p}`).toBe(false);
      }
    }
  });

  it('aucune phrase ne dépasse la longueur lisible sur un écran de résultat', () => {
    for (const [id, m] of Object.entries(MOMENTS)) {
      for (const p of m.phrases) {
        expect(p.length, `phrase trop longue dans « ${id} » : ${p}`).toBeLessThanOrEqual(LONGUEUR_MAX);
      }
    }
  });

  it('les repères dynamiques sont DÉCLARÉS avant d\'être employés', () => {
    // Une phrase qui emploie {serie} sans que le moment le déclare afficherait le
    // repère brut à l'écran, en direct.
    for (const [id, m] of Object.entries(MOMENTS)) {
      const declares = new Set(m.requiert || []);
      for (const p of m.phrases) {
        for (const [, cle] of p.matchAll(/\{(\w+)\}/g)) {
          expect(declares.has(cle), `« ${cle} » employé sans être déclaré dans « ${id} »`).toBe(true);
        }
      }
    }
  });

  it('CHAQUE TYPE DE JEU a ses moments de résultat', () => {
    // LE CŒUR DU CONTRÔLE : un nouveau type de jeu livré sans sa voix échoue ici.
    const parType = {
      quiz: ['juste.simple', 'faux'],
      true_false: ['juste.simple', 'faux'],
      estimation: ['estimation.mille', 'estimation.proche', 'estimation.correct', 'estimation.loin', 'estimation.hors'],
      vote: ['vote.devine', 'vote.manque', 'vote.sondage'],
      lien: ['lien.seul', 'lien.majorite', 'lien.groupe'],
      visages: ['visages.trouve', 'visages.trop-tot', 'visages.rate'],
      // « LE JUSTE TEMPS » PARTAGE LA FAMILLE DES PALIERS avec l'estimation, sur
      // demande de l'auteur : « reprendre celles utilisées dans Estimation ». Les
      // deux jeux se gagnent de la même façon — s'approcher d'une cible, par
      // paliers — et le serveur nomme ces paliers pareillement. Ce que ce contrôle
      // exige, c'est qu'un type de jeu ait des moments ; il n'exige pas qu'ils
      // soient à lui seul.
      //
      // `estimation.plus-proche` n'y figure pas, et c'est exact : le juste temps
      // n'a pas de filet du plus proche. Son énoncé ne le prévoit pas, et son
      // maximum annoncé — 1 200 — est exactement 1 000 de palier plus 200
      // d'exactitude.
      // « RETOUR DE FLAMME » a sa propre famille, et il la mérite : c'est le seul
      // jeu du projet où l'on peut finir la manche en NÉGATIF sans rien perdre au
      // score total. Aucune phrase existante ne dit cela, et le laisser retomber
      // sur « faux » ferait croire au joueur qu'il a été puni.
      retour_flamme: ['retour.parfait', 'retour.marque', 'retour.brule'],
      juste_temps: ['estimation.exact', 'estimation.mille', 'estimation.proche',
        'estimation.correct', 'estimation.loin', 'estimation.hors'],
    };
    for (const type of MODULE_TYPES) {
      expect(parType[type], `le type de jeu « ${type} » n'a aucun moment de voix déclaré`).toBeDefined();
      for (const id of parType[type]) {
        expect(MOMENTS[id], `moment « ${id} » manquant pour « ${type} »`).toBeDefined();
      }
    }
  });

  it('CHAQUE ROUTE de l\'application est couverte par la convention', () => {
    // Les routes sont énumérées à un seul endroit : une route ajoutée sans entrée
    // dans SURFACES fait échouer le contrôle.
    const main = fs.readFileSync('src/client/main.jsx', 'utf8');
    const routes = [...main.matchAll(/path\.startsWith\('\/(\w+)'\)/g)].map((m) => m[1]);
    expect(routes.length).toBeGreaterThan(0);
    for (const r of routes) {
      expect(SURFACES, `la route « /${r} » n'est pas déclarée dans SURFACES`).toContain(r);
    }
  });

  it('CHAQUE MOMENT DÉCLARÉ EST ATTEIGNABLE PAR LE CODE', () => {
    // LE GARDE-FOU QUI MANQUAIT, ET CE QU'IL A COÛTÉ DE NE PAS L'AVOIR.
    //
    // Le contrôle voisin vérifie qu'un moment CITÉ existe. Personne ne vérifiait
    // l'inverse : qu'un moment déclaré soit atteint. Huit d'entre eux ne l'étaient
    // pas — `reponse.envoyee`, `temps.ecoule`, les deux `places.*`, les trois
    // `fin.*` et `stream.podium` — soit trente-six phrases écrites, relues,
    // listées à l'auteur, et que personne n'a jamais vues à l'écran. L'écran de
    // fin de partie et le podium du stream, les deux moments les plus chargés de
    // la soirée, étaient muets.
    //
    // Ce contrôle lit les fichiers de surface — JAMAIS le registre lui-même, où
    // tous les identifiants figurent par construction. C'est l'erreur qui m'avait
    // fait conclure « tout est branché » alors que rien ne l'était.
    const surfaces = ['play/PlayApp.jsx', 'host/HostApp.jsx', 'overlay/OverlayApp.jsx', 'shared/voix-hooks.js']
      .map((f) => fs.readFileSync('src/client/' + f, 'utf8')).join('\n');
    const parPrefixe = surfaces.includes('`estimation.${');
    const muets = [];
    for (const id of Object.keys(MOMENTS)) {
      const direct = surfaces.includes(`'${id}'`);
      const prefixe = parPrefixe && id.startsWith('estimation.');
      const plateau = PRIORITE_PLATEAU.includes(id);
      if (!direct && !prefixe && !plateau) muets.push(id);
    }
    expect(muets, `moment(s) sans aucun chemin de code : ${muets.join(', ')}`).toEqual(MUETS_ASSUMES);
  });

  // ===== LE CONTRAT DES VARIABLES (A30) =====
  //
  // `requiert` existait depuis l'origine et n'était lu par personne : un champ
  // décoratif. `fin.podium` déclarait `requiert: ['rang']`, aucun appelant ne
  // fournissait cette valeur, et sept phrases affichaient « {rang} » en clair à
  // tout joueur classé, à chaque fin de partie. Ces deux contrôles font du champ
  // un contrat : ce qu'une phrase écrit doit être déclaré, ce qui est déclaré
  // doit être écrit.
  // Le sens « écrit ⇒ déclaré » est déjà tenu plus haut par « les repères
  // dynamiques sont DÉCLARÉS avant d'être employés ». Il était vert pendant tout
  // le temps où `{rang}` s'affichait en clair : garantir qu'une variable est
  // DÉCLARÉE ne dit rien de sa FOURNITURE. Ce sont les trois contrôles suivants
  // qui manquaient.
  it('tout `requiert` déclaré est employé par au moins une phrase', () => {
    // Le revers : une déclaration orpheline ferait attendre une valeur que
    // personne n'écrit — et le crochet, qui attend désormais les valeurs
    // déclarées avant de servir, rendrait le moment définitivement muet.
    for (const [id, m] of Object.entries(MOMENTS)) {
      const ecrits = new Set(m.phrases.flatMap(reperesDe));
      for (const cle of m.requiert || []) {
        expect(ecrits.has(cle),
          `« ${id} » déclare requiert:${cle} qu'aucune de ses phrases n'emploie`).toBe(true);
      }
    }
  });

  it('aucune accolade ne survit quand les valeurs sont fournies', () => {
    // Le contrôle de bout en bout vérifie le câblage réel ; celui-ci vérifie la
    // substitution elle-même, moment par moment, sans navigateur.
    for (const [id, m] of Object.entries(MOMENTS)) {
      const valeurs = Object.fromEntries((m.requiert || []).map((k) => [k, 'X']));
      for (let n = 0; n < m.phrases.length; n += 1) {
        const dite = dire(id, valeurs);
        expect(dite, `« ${id} » ne dit rien alors que ses valeurs sont fournies`).toBeTruthy();
        expect(/\{\w+\}/.test(dite), `accolade non substituée dans « ${id} » : ${dite}`).toBe(false);
      }
    }
  });

  it('une valeur manquante rend le moment muet, jamais bavard d\'une accolade', () => {
    // `fin.podium` : quatre phrases, trois citent {rang}. Sans la valeur, seule
    // celle qui n'en a pas besoin peut être servie — et jamais une accolade.
    for (let n = 0; n < 6; n += 1) {
      const dite = dire('fin.podium', {});
      if (dite != null) expect(/\{\w+\}/.test(dite), `accolade servie : ${dite}`).toBe(false);
    }
    // `fin.classe` : les quatre phrases citent {rang}. Aucune n'est servable :
    // le moment se tait au lieu d'écrire une accolade.
    expect(dire('fin.classe', {})).toBeNull();
  });

  it('l\'ordre de priorité du plateau ne cite que des moments existants', () => {
    for (const id of PRIORITE_PLATEAU) {
      expect(MOMENTS[id], `« ${id} » cité en priorité mais non déclaré`).toBeDefined();
    }
  });
});

describe('choix des phrases', () => {
  it('ne répète pas tant que le stock n\'est pas épuisé', () => {
    const n = MOMENTS['juste.simple'].phrases.length;
    const vues = new Set();
    for (let i = 0; i < n; i += 1) vues.add(dire('juste.simple'));
    // Dix bonnes réponses de suite ne doivent pas donner dix fois la même
    // félicitation : c'est l'usure qui tue ce genre de dispositif.
    expect(vues.size).toBe(n);
  });

  it('remplit les repères déclarés', () => {
    // Sur `fin.classe`, dont les quatre phrases citent {rang} : le contrôle porte
    // ainsi sur la substitution quelle que soit la phrase tirée.
    // (Il s'adossait à `juste.serie`, qui ne cite plus aucun repère depuis A7 : le
    // marqueur de série porte le nombre, la voix ne le redit plus.)
    const p = dire('fin.classe', { rang: '4e' });
    expect(p).toContain('4e');
    expect(p).not.toContain('{rang}');
  });

  it('rend null sur un moment inconnu plutôt que de casser l\'écran', () => {
    expect(dire('moment.qui.n.existe.pas')).toBeNull();
  });
});

describe('le plateau ne parle que sur le remarquable', () => {
  it('se tait en dessous du seuil de participation', () => {
    // Un pourcentage sur trois joueurs ne veut rien dire, et « 100 % ont trouvé »
    // avec deux participants est ridicule à l'antenne.
    const stats = { kind: 'options', tally: [3, 0], total: 3 };
    expect(momentDePlateau('quiz', stats, { correctIndex: 0 })).toBeNull();
  });

  it('se tait sur une répartition ordinaire', () => {
    // Cinq bonnes réponses sur dix, aucune option délaissée, pas d'égalité en
    // tête : rien de remarquable. Le stream se tait, et c'est voulu — commenter
    // la répartition est le métier de l'animateur.
    expect(momentDePlateau('quiz', { kind: 'options', tally: [5, 3, 2], total: 10 }, { correctIndex: 0 }))
      .toBeNull();
  });

  it('repère une option que personne n\'a choisie', () => {
    // Écart de 2 entre les deux premières : pas d'égalité, donc c'est bien
    // l'option morte qui parle.
    expect(momentDePlateau('quiz', { kind: 'options', tally: [5, 3, 0], total: 8 }, { correctIndex: 0 }))
      .toBe('stream.option-morte');
  });

  it('repère l\'unanimité, le zéro pointé et le piège', () => {
    expect(momentDePlateau('quiz', { kind: 'options', tally: [8, 0, 0], total: 8 }, { correctIndex: 0 }))
      .toBe('stream.unanimite-juste');
    expect(momentDePlateau('quiz', { kind: 'options', tally: [0, 5, 3], total: 8 }, { correctIndex: 0 }))
      .toBe('stream.personne');
    // Piège : une mauvaise option recueille plus de voix que la bonne.
    expect(momentDePlateau('quiz', { kind: 'options', tally: [2, 6, 0], total: 8 }, { correctIndex: 0 }))
      .toBe('stream.piege');
  });

  // ===== A13 / A14 — LES CAS QUE LE PLATEAU NE SAVAIT PAS DIRE =====
  it('distingue l\'égalité PARFAITE d\'une seule voix d\'écart', () => {
    // A14 — une même condition, « à une voix près », servait les deux cas : le
    // plateau annonçait « Wow ! Égalité parfaite » sur un écart d'une voix.
    expect(momentDePlateau('vote', { kind: 'options', tally: [3, 3], total: 6 }))
      .toBe('stream.vote-egalite');
    expect(momentDePlateau('vote', { kind: 'options', tally: [4, 3], total: 7 }))
      .toBe('stream.vote-division');
    // Et sur un quiz, l'égalité stricte seulement — plus « à une voix près ».
    expect(momentDePlateau('quiz', { kind: 'options', tally: [3, 3], total: 6 }, { correctIndex: 0 }))
      .toBe('stream.egalite');
  });

  it('dit que la majorité s\'est trompée, même sans option piège dominante', () => {
    // A13 — le piège ne se déclenchait que si UNE mauvaise option dépassait la
    // bonne. Ici l'erreur se répartit sur trois options, chacune SOUS la bonne
    // réponse : la majorité s'est pourtant trompée, et le plateau se taisait.
    // 4 justes sur 12 — aucune mauvaise option ne dépasse 3.
    expect(momentDePlateau('quiz', { kind: 'options', tally: [4, 3, 3, 2], total: 12 }, { correctIndex: 0 }))
      .toBe('stream.majorite-trompee');
    // La majorité a raison : rien à signaler de ce côté.
    expect(momentDePlateau('quiz', { kind: 'options', tally: [7, 2, 2, 1], total: 12 }, { correctIndex: 0 }))
      .not.toBe('stream.majorite-trompee');
    // Quand une option piège domine, c'est ELLE l'histoire : le piège prime.
    expect(momentDePlateau('quiz', { kind: 'options', tally: [2, 8, 1, 1], total: 12 }, { correctIndex: 0 }))
      .toBe('stream.piege');
  });

  it('compte les RÉPONSES DONNÉES, jamais les joueurs présents', () => {
    // A13 — lecture retenue en réunion pour toutes les règles de seuil. Le serveur
    // publie `total = rt.answers.size` : cinq réponses suffisent, même si le salon
    // en compte vingt. Ce contrôle fige la lecture côté voix.
    expect(momentDePlateau('quiz', { kind: 'options', tally: [4, 0], total: 4 }, { correctIndex: 0 }),
      'sous cinq RÉPONSES, le plateau se tait').toBeNull();
    expect(momentDePlateau('quiz', { kind: 'options', tally: [5, 0], total: 5 }, { correctIndex: 0 }))
      .toBe('stream.unanimite-juste');
  });

  it('une seule condition parle, selon la priorité', () => {
    // Unanimité ET option morte se déclenchent ensemble : l'unanimité prime.
    const m = momentDePlateau('quiz', { kind: 'options', tally: [8, 0], total: 8 }, { correctIndex: 0 });
    expect(m).toBe('stream.unanimite-juste');
  });

  it('lit la dispersion des estimations', () => {
    // LE PLATEAU NE S'ÉMEUT PLUS D'UNE APPROCHE, MAIS D'UNE RÉPONSE EXACTE.
    // Arbitrage de l'auteur : le seuil des 2 % a été remplacé par « une seule
    // personne a trouvé la valeur exacte ». À deux pour cent près sans être
    // exact, le plateau se tait désormais — c'est le premier cas ci-dessous, qui
    // retombe donc sur la justesse du GROUPE.
    expect(momentDePlateau('estimation', {
      kind: 'numeric', total: 6, target: 100, avg: 103, closest: 100,
    })).toBe('stream.estim-groupe-juste');
    // UNE seule réponse exacte : c'est l'exploit, et le plateau le dit.
    expect(momentDePlateau('estimation', {
      kind: 'numeric', total: 6, target: 100, avg: 140, closest: 100,
      histogramme: { exact: 1 },
    })).toBe('stream.estim-exact-unique');
    // À PLUSIEURS, l'exploit n'en est plus un : le plateau se tait sur ce point.
    expect(momentDePlateau('estimation', {
      kind: 'numeric', total: 6, target: 100, avg: 140, closest: 100,
      histogramme: { exact: 3 },
    })).not.toBe('stream.estim-exact-unique');
    expect(momentDePlateau('estimation', {
      kind: 'numeric', total: 6, target: 100, avg: 400, closest: 250,
    })).toBe('stream.estim-personne-proche');
  });
});
