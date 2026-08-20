// Bibliothèque de jeux d'un animateur — persistance disque, UN FICHIER PAR COMPTE.
//
// Ce que ce fichier a changé (actions 2 et 10) :
//
// 1. L'UNITÉ EST LE JEU NOMMÉ, plus le type. L'ancien format rangeait les
//    questions dans quatre seaux (quiz, vrai/faux, estimation, vote) et jetait au
//    passage le NOM du jeu : « Culture générale » redevenait « Quiz » au
//    rechargement du Studio, et deux quiz distincts fusionnaient en un seul. La
//    forme retenue est celle de la table Supabase — même structure des deux côtés,
//    donc un seul modèle de module dans tout le projet.
//
// 2. UN FICHIER PAR COMPTE. Le fichier est réécrit en entier à chaque
//    enregistrement ; un fichier unique partagé aurait fait que deux animateurs
//    sauvegardant en même temps s'effacent mutuellement. Et chacun a désormais sa
//    propre bibliothèque, décision de produit autant que de sûreté.
//
// 3. SEMENCE UNIQUE. Les questions d'exemple sont écrites une seule fois, puis
//    deviennent de la donnée ordinaire — éditables et SUPPRIMABLES. Un repère
//    marque que la semence a eu lieu, sans quoi une question supprimée repousserait
//    au redémarrage suivant.
import fs from 'node:fs';
import path from 'node:path';
import { MODULE_TYPES, modules as moduleDefs, demoQuestions } from './modules.js';

const DATA_DIR = process.env.DATA_DIR || 'data';
const LEGACY_FILE = path.join(DATA_DIR, 'banks.json');
const OWNERS_DIR = path.join(DATA_DIR, 'owners');

// Cache mémoire par compte : le disque est la source de vérité, mais le moteur
// lit à chaque lancement d'épreuve et n'a pas à toucher le disque pour ça.
const cache = new Map();

// Un identifiant de compte devient un nom de fichier : on n'accepte que des
// caractères sûrs, pour qu'un identifiant inattendu ne puisse jamais désigner un
// fichier hors du répertoire prévu.
function fichierDe(ownerId) {
  const sur = String(ownerId || 'dev-host').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  return path.join(OWNERS_DIR, `${sur}.json`);
}

function uid(prefixe) {
  return `${prefixe}-${Math.random().toString(36).slice(2, 10)}`;
}

// Les quatre jeux livrés d'office, construits depuis les questions d'exemple.
// Ce sont des modules ORDINAIRES : rien ne les distingue de ceux que l'animateur
// crée, et il peut les vider, les renommer ou les supprimer.
function modulesDeDepart() {
  return MODULE_TYPES.map((type) => ({
    id: uid('m'),
    type,
    name: moduleDefs[type].meta.name,
    duration: type === 'true_false' ? 12 : 20,
    color: moduleDefs[type].meta.color,
    questions: (demoQuestions[type] || []).map((q) => ({ ...q })),
  })).filter((m) => m.questions.length > 0);
}

// Reprise de l'ANCIEN format (quatre seaux par type) : un jeu par type non vide,
// avec le nom générique du type. Le nom n'existait pas dans ce format — on ne peut
// pas l'inventer, mais on ne perd aucune question.
function reprendreAncienFormat(brut) {
  const out = [];
  for (const type of MODULE_TYPES) {
    const bank = Array.isArray(brut[type]) ? brut[type] : [];
    if (!bank.length) continue;
    out.push({
      id: uid('m'),
      type,
      name: moduleDefs[type].meta.name,
      duration: type === 'true_false' ? 12 : 20,
      color: moduleDefs[type].meta.color,
      questions: bank.map((q) => ({ ...q })),
    });
  }
  return out;
}

function normaliser(m) {
  if (!m || typeof m !== 'object') return null;
  const type = MODULE_TYPES.includes(m.type) ? m.type : 'quiz';
  return {
    id: m.id != null ? String(m.id) : uid('m'),
    type,
    name: typeof m.name === 'string' && m.name.trim() ? m.name : moduleDefs[type].meta.name,
    duration: Number.isFinite(Number(m.duration)) ? Number(m.duration) : 20,
    color: typeof m.color === 'string' ? m.color : moduleDefs[type].meta.color,
    questions: Array.isArray(m.questions) ? m.questions : [],
  };
}

function lireFichier(fichier) {
  try {
    const brut = JSON.parse(fs.readFileSync(fichier, 'utf8'));
    if (!brut || !Array.isArray(brut.modules)) return null;
    return { seeded: !!brut.seeded, modules: brut.modules.map(normaliser).filter(Boolean) };
  } catch {
    return null;
  }
}

// Contenu initial d'un compte qui n'a pas encore de fichier :
//   - la banque de l'ancien format si elle existe (rien n'est perdu),
//   - sinon les questions d'exemple.
// L'ancien fichier n'est JAMAIS modifié ni supprimé : il reste tel quel comme
// filet, au cas où la reprise se serait mal passée.
function contenuInitial() {
  try {
    const ancien = JSON.parse(fs.readFileSync(LEGACY_FILE, 'utf8'));
    const repris = reprendreAncienFormat(ancien);
    if (repris.length) return { seeded: true, modules: repris };
  } catch { /* pas d'ancien fichier : cas normal d'une installation neuve */ }
  return { seeded: true, modules: modulesDeDepart() };
}

function charger(ownerId) {
  const cle = String(ownerId || 'dev-host');
  if (cache.has(cle)) return cache.get(cle);
  const etat = lireFichier(fichierDe(cle)) || contenuInitial();
  cache.set(cle, etat);
  // La semence est écrite tout de suite : sans ça, le repère « déjà semé » ne
  // survivrait pas au redémarrage et des questions supprimées repousseraient.
  if (!lireFichier(fichierDe(cle))) ecrire(cle, etat);
  return etat;
}

function ecrire(ownerId, etat) {
  fs.mkdirSync(OWNERS_DIR, { recursive: true });
  fs.writeFileSync(fichierDe(ownerId), JSON.stringify(etat, null, 2), 'utf8');
}

// --- API publique -----------------------------------------------------------

export function getModules(ownerId) {
  return charger(ownerId).modules;
}

export function getModule(ownerId, moduleId) {
  return charger(ownerId).modules.find((m) => m.id === moduleId) || null;
}

// Premier module d'un type donné — compatibilité avec l'ancien lancement « par
// type », que le serveur accepte encore le temps qu'un écran animateur non
// rechargé finisse sa partie.
export function getModuleParType(ownerId, type) {
  return charger(ownerId).modules.find((m) => m.type === type) || null;
}

export function setModules(ownerId, next) {
  const etat = { seeded: true, modules: (Array.isArray(next) ? next : []).map(normaliser).filter(Boolean) };
  cache.set(String(ownerId || 'dev-host'), etat);
  ecrire(ownerId, etat);
  return etat.modules;
}

// Remet les jeux livrés d'office, sans toucher à ceux que l'animateur a créés :
// une suppression massive reste rattrapable, mais restaurer n'écrase rien.
export function restaurerModulesDeDepart(ownerId) {
  const etat = charger(ownerId);
  const existants = new Set(etat.modules.map((m) => `${m.type}:${m.name}`));
  const ajouts = modulesDeDepart().filter((m) => !existants.has(`${m.type}:${m.name}`));
  if (ajouts.length) {
    etat.modules = [...etat.modules, ...ajouts];
    ecrire(ownerId, etat);
  }
  return etat.modules;
}

// Vide le cache — les tests créent plusieurs comptes dans un même processus.
export function _reinitialiserCache() {
  cache.clear();
}
