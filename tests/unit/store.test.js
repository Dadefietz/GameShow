// Tests unitaires — banques de questions persistées sur disque (Studio -> jeu).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';

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

describe('banques de questions', () => {
  it('démarre avec des banques vides pour chaque module', () => {
    expect(store.getBank('quiz')).toEqual([]);
    expect(store.getBank('true_false')).toEqual([]);
  });

  it('setBanks persiste sur disque et getBank relit', () => {
    const q = { id: 's1', text: 'Question studio ?', options: ['A', 'B'], correctIndex: 0, durationSec: 10 };
    store.setBanks({ quiz: [q] });
    expect(store.getBank('quiz')).toEqual([q]);
    const onDisk = JSON.parse(fs.readFileSync(DATA_DIR + '/banks.json', 'utf8'));
    expect(onDisk.quiz).toEqual([q]);
    expect(onDisk.vote).toEqual([]);
  });

  it('ignore les types de module inconnus (pas d\'injection de clés)', () => {
    store.setBanks({ quiz: [], hacked_type: [{ id: 'x', text: 'x' }] });
    expect(store.getBanks()).not.toHaveProperty('hacked_type');
  });

  it('un setBanks partiel remet les autres banques à vide (remplacement total)', () => {
    store.setBanks({ true_false: [{ id: 't1', text: 'V ?', correct: true }] });
    expect(store.getBank('quiz')).toEqual([]);
    expect(store.getBank('true_false')).toHaveLength(1);
  });
});
