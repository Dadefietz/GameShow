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
    // Chaque jeu semé porte un nom et des questions : une bibliothèque vide
    // rendrait le produit injouable tant que le Studio n'a pas servi.
    for (const j of jeux) {
      expect(j.name).toBeTruthy();
      expect(j.questions.length).toBeGreaterThan(0);
    }
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
