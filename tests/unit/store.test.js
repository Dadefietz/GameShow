// Tests unitaires — bibliothèque de JEUX NOMMÉS persistée sur disque (actions 2 et 10).
//
// Ce que ces tests protègent, et qui a réellement dysfonctionné :
//   - le NOM d'un jeu, que l'ancien format détruisait en aplatissant tout par type ;
//   - la SÉPARATION des bibliothèques : deux animateurs, deux fichiers, aucun
//     écrasement mutuel quand ils enregistrent en même temps ;
//   - la SEMENCE UNIQUE : les questions d'exemple sont écrites une fois, puis
//     supprimables — sans repère, une question effacée repoussait au redémarrage.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { MODULE_TYPES, modules } from '../../src/server/modules.js';

const DATA_DIR = 'tests/.data-unit';
let store;

beforeAll(async () => {
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  process.env.DATA_DIR = DATA_DIR;
  store = await import('../../src/server/store.js');
});

afterAll(() => {
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  delete process.env.DATA_DIR;
});

beforeEach(() => {
  fs.rmSync(path.join(DATA_DIR, 'owners'), { recursive: true, force: true });
  store._reinitialiserCache();
});

describe('bibliothèque de jeux', () => {
  it('sème des jeux jouables au premier accès d\'un compte', () => {
    const jeux = store.getModules('anim-a');
    expect(jeux.length).toBeGreaterThan(0);
    // Chaque jeu semé porte un nom, et des questions — SAUF les jeux « en
    // direct », dont la question est saisie à l'antenne par l'animateur. Les
    // écarter du semis les rendrait introuvables dans son menu ; leur réclamer
    // des questions n'aurait aucun sens. Une bibliothèque vide, elle, rendrait le
    // produit injouable tant que le Studio n'a pas servi.
    const direct = new Set(MODULE_TYPES.filter((t) => modules[t].meta.direct === true));
    for (const j of jeux) {
      expect(j.name).toBeTruthy();
      if (!direct.has(j.type)) expect(j.questions.length).toBeGreaterThan(0);
    }
    expect(jeux.some((j) => direct.has(j.type)),
      'le jeu en direct n\'a pas été semé : il serait introuvable').toBe(true);
  });

  it('conserve le NOM d\'un jeu — ce que l\'ancien format détruisait', () => {
    store.setModules('anim-a', [
      { id: 'm1', type: 'quiz', name: 'Culture générale', duration: 20, color: 'fire', questions: [] },
    ]);
    store._reinitialiserCache(); // force une relecture depuis le disque
    expect(store.getModules('anim-a')[0].name).toBe('Culture générale');
  });

  it('garde DEUX jeux du même type distincts — ils fusionnaient avant', () => {
    store.setModules('anim-a', [
      { id: 'm1', type: 'quiz', name: 'Culture générale', duration: 20, color: 'fire', questions: [{ id: 'q1', text: 'A ?' }] },
      { id: 'm2', type: 'quiz', name: 'Spécial cinéma', duration: 20, color: 'fire', questions: [{ id: 'q2', text: 'B ?' }] },
    ]);
    store._reinitialiserCache();
    const jeux = store.getModules('anim-a');
    expect(jeux).toHaveLength(2);
    expect(jeux.map((j) => j.name)).toEqual(['Culture générale', 'Spécial cinéma']);
    expect(store.getModule('anim-a', 'm2').questions).toHaveLength(1);
  });

  it('cloisonne les comptes : un fichier chacun, aucun écrasement', () => {
    store.setModules('anim-a', [
      { id: 'a1', type: 'quiz', name: 'Chez A', duration: 20, color: 'fire', questions: [] },
    ]);
    store.setModules('anim-b', [
      { id: 'b1', type: 'quiz', name: 'Chez B', duration: 20, color: 'fire', questions: [] },
    ]);
    // Le fichier est réécrit EN ENTIER à chaque enregistrement : un fichier
    // partagé aurait fait que le dernier à sauvegarder efface l'autre.
    expect(store.getModules('anim-a')[0].name).toBe('Chez A');
    expect(store.getModules('anim-b')[0].name).toBe('Chez B');
    expect(store.getModule('anim-a', 'b1')).toBeNull();
    const fichiers = fs.readdirSync(path.join(DATA_DIR, 'owners'));
    expect(fichiers).toHaveLength(2);
  });

  it('une question supprimée ne repousse pas au redémarrage', () => {
    store.getModules('anim-a');                 // semence
    store.setModules('anim-a', []);             // l'animateur vide tout
    store._reinitialiserCache();                // redémarrage du serveur
    // Le repère de semence est sur disque : on ne resème pas par-dessus.
    expect(store.getModules('anim-a')).toEqual([]);
  });

  it('restaurer les jeux de base n\'écrase pas ce que l\'animateur a créé', () => {
    store.setModules('anim-a', [
      { id: 'mien', type: 'quiz', name: 'Le mien', duration: 20, color: 'fire', questions: [] },
    ]);
    const apres = store.restaurerModulesDeDepart('anim-a');
    expect(apres.find((m) => m.id === 'mien')).toBeTruthy();
    expect(apres.length).toBeGreaterThan(1);
  });

  it('reprend l\'ANCIEN format sans perdre une question', () => {
    // L'ancien fichier rangeait les questions en quatre seaux par type. On ne
    // peut pas inventer les noms qu'il ne contenait pas, mais rien ne doit
    // disparaître — c'est le travail de l'animateur.
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(path.join(DATA_DIR, 'banks.json'), JSON.stringify({
      quiz: [{ id: 'vieux-1', text: 'Ancienne question ?', options: ['A', 'B'], correctIndex: 0 }],
      true_false: [], estimation: [], vote: [],
    }), 'utf8');
    store._reinitialiserCache();

    const jeux = store.getModules('anim-repris');
    const quiz = jeux.find((j) => j.type === 'quiz');
    expect(quiz.questions.some((q) => q.id === 'vieux-1')).toBe(true);
    // L'ancien fichier n'est ni modifié ni supprimé : il reste comme filet.
    expect(fs.existsSync(path.join(DATA_DIR, 'banks.json'))).toBe(true);

    fs.rmSync(path.join(DATA_DIR, 'banks.json'), { force: true });
  });

  it('rejette un type inconnu plutôt que de l\'écrire tel quel', () => {
    store.setModules('anim-a', [
      { id: 'x', type: 'hacked_type', name: 'Injecté', questions: [] },
    ]);
    expect(store.getModules('anim-a')[0].type).toBe('quiz');
  });

  it('ne laisse pas un identifiant de compte désigner un fichier hors du dossier', () => {
    store.setModules('../../evade', [
      { id: 'x', type: 'quiz', name: 'Ailleurs', questions: [] },
    ]);
    const fichiers = fs.readdirSync(path.join(DATA_DIR, 'owners'));
    expect(fichiers.every((f) => !f.includes('/') && !f.includes('..'))).toBe(true);
  });
});

// CLÔTURE DE L'ACTION 11 — la garantie centrale de l'action 2, vérifiée au plus
// près du code plutôt que seulement de bout en bout.
//
// Le défaut trouvé à la clôture : le serveur fusionnait dans la réserve d'un jeu
// toutes les questions Supabase du même TYPE. C'était l'aplatissement par type
// que l'action 2 venait de supprimer, réintroduit par une autre porte — et il
// aurait fait mentir le filet sans le faire échouer, celui-ci ne jouant que sur
// le stockage disque.
describe('la réserve d\'un jeu est CELLE DE CE JEU', () => {
  it('deux jeux du même type ne partagent pas leurs questions', () => {
    store.setModules('anim-cloison', [
      { id: 'j1', type: 'quiz', name: 'Culture générale', questions: [{ id: 'q-a', text: 'A ?' }] },
      { id: 'j2', type: 'quiz', name: 'Spécial cinéma', questions: [{ id: 'q-b', text: 'B ?' }] },
    ]);
    const j1 = store.getModule('anim-cloison', 'j1');
    const j2 = store.getModule('anim-cloison', 'j2');

    expect(j1.questions.map((q) => q.id)).toEqual(['q-a']);
    expect(j2.questions.map((q) => q.id)).toEqual(['q-b']);
    // Aucune question de l'un ne doit apparaître chez l'autre : c'est tout
    // l'intérêt de nommer ses jeux.
    expect(j1.questions.some((q) => q.id === 'q-b')).toBe(false);
    expect(j2.questions.some((q) => q.id === 'q-a')).toBe(false);
  });
});

// LA MONTÉE DE SEMENCE — un jeu ajouté au projet doit atteindre les bibliothèques
// DÉJÀ SEMÉES.
//
// LE DÉFAUT QUE CE CONTRÔLE GARDE, ET IL EST TOTAL. Les jeux livrés d'office ne
// sont posés qu'à la PREMIÈRE ouverture d'un compte. « Le juste temps » aurait
// donc été écrit, testé, poussé en production — et introuvable dans le menu de la
// seule personne qui s'en sert, dont le fichier date d'avant lui. Rien n'aurait
// planté ; le jeu n'aurait simplement jamais existé pour elle.
//
// ET LE DÉFAUT SYMÉTRIQUE, tout aussi réel : recompléter la bibliothèque à chaque
// chargement ferait REPOUSSER un jeu que l'animateur a supprimé exprès. Les deux
// sont vérifiés ici.
describe('la semence monte sans rien ressusciter', () => {
  const cle = 'anim-semence';
  const fichier = () => path.join(DATA_DIR, 'owners', `${cle}.json`);

  // Une bibliothèque telle qu'elle était écrite AVANT l'existence des semences :
  // pas de numéro, et pas de « juste temps ».
  // TOUS LES APPORTS DEPUIS LA PREMIÈRE SEMENCE, écartés d'un coup : c'est la
  // situation réelle d'un animateur installé avant eux. La liste n'est pas
  // recopiée à la main — elle vient de la table des apports, sans quoi un
  // quatrième jeu ajouté un jour passerait à travers ce contrôle.
  // LU PARESSEUSEMENT : le module du stockage n'est importé qu'au `beforeAll`
  // (il lit une variable d'environnement posée là), et le lire à l'évaluation du
  // fichier donnerait `undefined`.
  const apportsDepuis = () => store.APPORTS_DEPUIS_LA_PREMIERE;
  // La bibliothèque telle qu'elle était à la première semence : les types qui
  // existaient ALORS, et rien d'autre. C'est la situation réelle d'un animateur
  // installé avant les jeux qui ont suivi.
  const typesDAlors = () => store.TYPES_A_LA_PREMIERE_SEMENCE;

  function bibliothequeAncienne(garde = typesDAlors()) {
    fs.mkdirSync(path.join(DATA_DIR, 'owners'), { recursive: true });
    const modulesAnciens = garde.map((t) => ({
      id: `m-${t}`, type: t, name: modules[t].meta.name, duration: 20,
      color: modules[t].meta.color, questions: [],
    }));
    fs.writeFileSync(fichier(), JSON.stringify({ seeded: true, modules: modulesAnciens }), 'utf8');
    store._reinitialiserCache();
  }

  it('AUCUN TYPE DU SERVEUR n\'est hors de portée d\'un animateur installé', () => {
    // LE VRAI DÉFAUT, ET CELUI QU'UN CONTRÔLE PLUS FAIBLE LAISSAIT PASSER.
    //
    // Ma première version fabriquait la bibliothèque « d'avant » en ÔTANT les
    // apports déclarés. Elle vérifiait donc que ce qui est inscrit dans la table
    // arrive bien — mais restait verte si l'on OUBLIAIT d'y inscrire un jeu, ce
    // qui est exactement l'erreur qu'on redoute : le jeu est livré, testé, poussé,
    // et introuvable dans le menu de la seule personne qui s'en sert.
    //
    // On part donc des types qui existaient VRAIMENT à la première semence — un
    // fait historique, figé — et l'on exige que la montée conduise à la
    // bibliothèque complète.
    bibliothequeAncienne();
    const jeux = store.getModules(cle);
    for (const type of MODULE_TYPES) {
      expect(jeux.some((j) => j.type === type),
        `le jeu « ${type} » reste introuvable dans une bibliothèque installée avant lui`).toBe(true);
    }
    expect(jeux.length, 'la montée a posé un jeu en double').toBe(MODULE_TYPES.length);
    // Et le contrôle a bien quelque chose à voir : sans montée, il manquerait des jeux.
    expect(typesDAlors().length).toBeLessThan(MODULE_TYPES.length);
    // Rien d'autre n'a bougé : un seul jeu par type, comme avant.
    for (const t of MODULE_TYPES) {
      expect(jeux.filter((j) => j.type === t).length, `${t} a été posé deux fois`).toBe(1);
    }
    // Et le fichier porte désormais son numéro de semence : la montée ne se
    // rejouera pas au prochain démarrage.
    expect(JSON.parse(fs.readFileSync(fichier(), 'utf8')).semence).toBeGreaterThan(1);
  });

  it('NE RESSUSCITE PAS un jeu que l\'animateur a supprimé', () => {
    // Il a effacé « Le lien », qui existait déjà à la semence précédente. La
    // montée ne doit toucher qu'à ce qui n'existait pas alors.
    bibliothequeAncienne(typesDAlors().filter((t) => t !== 'lien'));
    const jeux = store.getModules(cle);
    for (const type of apportsDepuis()) expect(jeux.some((j) => j.type === type)).toBe(true);
    expect(jeux.some((j) => j.type === 'lien'),
      'un jeu supprimé par l\'animateur est revenu tout seul').toBe(false);
  });

  it('ne rejoue pas la montée sur une bibliothèque déjà à jour', () => {
    store.getModules(cle) && bibliothequeAncienne();
    const premier = store.getModules(cle).length;
    store._reinitialiserCache();
    expect(store.getModules(cle).length, 'la montée a rejoué et doublé des jeux').toBe(premier);
  });
});
