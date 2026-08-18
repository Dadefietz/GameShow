// Banques de questions de l'animateur — persistance disque (data/banks.json).
// Comble le fossé Studio -> jeu quand Supabase n'est pas configuré : le Studio
// enregistre via PUT /api/banks, le moteur lit via getBank(). Format serveur :
// { quiz: [{id,text,options,correctIndex,durationSec}], true_false: [...], estimation: [...], vote: [...] }
import fs from 'node:fs';
import path from 'node:path';
import { MODULE_TYPES } from './modules.js';

const DATA_DIR = process.env.DATA_DIR || 'data';
const FILE = path.join(DATA_DIR, 'banks.json');

let banks = load();

function emptyBanks() {
  return Object.fromEntries(MODULE_TYPES.map((t) => [t, []]));
}

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    const clean = emptyBanks();
    for (const t of MODULE_TYPES) if (Array.isArray(raw[t])) clean[t] = raw[t];
    return clean;
  } catch {
    return emptyBanks();
  }
}

export function getBank(moduleType) {
  return banks[moduleType] || [];
}

export function getBanks() {
  return banks;
}

export function setBanks(next) {
  const clean = emptyBanks();
  for (const t of MODULE_TYPES) if (Array.isArray(next[t])) clean[t] = next[t];
  banks = clean;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(banks, null, 2), 'utf8');
  return banks;
}
