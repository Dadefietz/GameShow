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
import { getServiceClient } from './supabase.js';

const DATA_DIR = process.env.DATA_DIR || 'data';
const LEGACY_FILE = path.join(DATA_DIR, 'banks.json');
const OWNERS_DIR = path.join(DATA_DIR, 'owners');

// Cache mémoire par compte : le disque répond vite, mais il n'est PAS durable —
// voir la note ci-dessous. Le moteur lit à chaque lancement d'épreuve et n'a pas
// à toucher le disque pour ça.
const cache = new Map();

// ============================================================
// LA PERSISTANCE DURABLE — ET POURQUOI LE DISQUE NE SUFFIT PAS
// ============================================================
//
// CE QUI A ÉTÉ RAPPORTÉ : « L'ajout et la modification de questions dans des
// modules ne se sauvegarde pas quand on redémarre le serveur. Il faut que ces
// modifications survivent à tout et que je les retrouve peu importe ce qui se
// passe. »
//
// LA CAUSE N'EST PAS DANS CE FICHIER, ELLE EST SOUS LUI. Le service tourne sur
// un hébergement dont le SYSTÈME DE FICHIERS EST ÉPHÉMÈRE : chaque déploiement,
// chaque redémarrage, chaque mise en veille repart d'une machine neuve. Le
// fichier était bien écrit, il était bien relu — et il disparaissait entre les
// deux. Rien dans le code ne pouvait le signaler : à son réveil, le serveur
// trouvait un compte vierge et le semait de bonne foi.
//
// LA BASE EST DÉSORMAIS LA SOURCE DE VÉRITÉ, le disque n'est plus qu'un cache.
// La table `modules` existait déjà, avec exactement la forme de ce fichier
// (id, owner_id, type, name, duration, color, questions) — elle n'avait jamais
// servi. Elle sert maintenant.
//
// TROIS RÈGLES :
//   1. TOUT ENREGISTREMENT VA EN BASE. Le Studio n'est pas prévenu du résultat
//      autrement que par l'échec de sa requête : une écriture qui échoue doit
//      échouer visiblement, pas se perdre.
//   2. AU DÉMARRAGE, ON RELIT LA BASE, pour tous les comptes qu'elle contient.
//      C'est ce qui fait survivre le travail « peu importe ce qui se passe ».
//   3. LE DÉVELOPPEMENT N'EN DÉPEND PAS. Sans configuration Supabase — et avec
//      un compte de développement dont l'identifiant n'est pas un UUID — tout
//      continue de fonctionner sur le seul disque.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function compteDurable(ownerId) {
  // La colonne `owner_id` référence `auth.users` : un identifiant qui n'est pas
  // un UUID ne peut pas y entrer, et c'est le cas du compte de développement.
  return UUID.test(String(ownerId || '')) ? String(ownerId) : null;
}

// ÉCRITURE EN BASE — remplace la bibliothèque du compte, en entier.
//
// Un remplacement complet plutôt qu'un patch : c'est déjà ce que fait le disque,
// et c'est la seule façon de faire DISPARAÎTRE un module supprimé. Un `upsert`
// seul laisserait les suppressions derrière lui, et l'animateur retrouverait au
// redémarrage les jeux qu'il avait retirés.
export async function sauverEnBase(ownerId, modulesDuCompte) {
  const id = compteDurable(ownerId);
  const sb = getServiceClient();
  if (!id || !sb) return { durable: false };
  const lignes = modulesDuCompte.map((m) => ({
    id: m.id, owner_id: id, type: m.type, name: m.name,
    duration: Number(m.duration) || 20, color: m.color || 'fire',
    questions: Array.isArray(m.questions) ? m.questions : [],
    updated_at: new Date().toISOString(),
  }));
  const gardes = lignes.map((l) => l.id);
  const { error: erreurEcriture } = lignes.length
    ? await sb.from('modules').upsert(lignes, { onConflict: 'id' })
    : { error: null };
  if (erreurEcriture) throw new Error(`base indisponible : ${erreurEcriture.message}`);
  // Puis on retire ce qui n'est plus là. `not in ()` refuse une liste vide : on
  // distingue donc le cas « plus aucun module » du cas ordinaire.
  const suppression = sb.from('modules').delete().eq('owner_id', id);
  const { error: erreurSuppression } = gardes.length
    ? await suppression.not('id', 'in', `(${gardes.map((x) => `"${x}"`).join(',')})`)
    : await suppression;
  if (erreurSuppression) throw new Error(`base indisponible : ${erreurSuppression.message}`);
  return { durable: true };
}

// LECTURE EN BASE, au démarrage et à chaque ouverture du Studio.
async function lireEnBase(ownerId) {
  const id = compteDurable(ownerId);
  const sb = getServiceClient();
  if (!id || !sb) return null;
  const { data, error } = await sb
    .from('modules')
    .select('id, type, name, duration, color, questions, created_at')
    .eq('owner_id', id)
    .order('created_at', { ascending: true });
  if (error || !Array.isArray(data)) return null;
  return data.map(normaliser).filter(Boolean);
}

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

// LA SEMENCE ET SA VERSION.
//
// LE DÉFAUT QU'ELLE CORRIGE. Les jeux livrés d'office ne sont posés qu'à la
// PREMIÈRE ouverture d'un compte. Un jeu ajouté au projet ensuite n'apparaissait
// donc jamais chez les animateurs déjà installés : « Le juste temps » aurait été
// livré, testé, poussé — et introuvable dans le menu de la seule personne qui
// s'en sert. Le défaut est silencieux, et il l'aurait été aussi pour « Le lien »
// et « Les visages » si le compte de démonstration n'avait pas été neuf.
//
// CE QU'ON N'A PAS FAIT : recompléter la bibliothèque à chaque chargement. Cela
// ferait repousser un jeu que l'animateur a supprimé exprès — le contraire d'un
// outil qui se laisse ranger.
//
// LA RÈGLE : chaque fichier porte le NUMÉRO DE SEMENCE avec lequel il a été
// écrit. Une montée n'ajoute que les types QUI N'EXISTAIENT PAS à ce numéro-là :
// des jeux que l'animateur n'a pas pu supprimer, puisqu'il ne les a jamais eus.
const SEMENCE = 5;
// LES TYPES QUI EXISTAIENT À LA PREMIÈRE SEMENCE. C'est un fait historique, pas
// une configuration : un fichier écrit avant l'existence des numéros de semence
// contient ceux-là, et rien d'autre. Cette liste NE SE MODIFIE PLUS — un jeu
// ajouté au projet passe par `APPORTS`, jamais par ici.
const TYPES_SEMENCE_1 = ['quiz', 'true_false', 'estimation', 'lien', 'visages', 'vote'];
// Ce que chaque montée apporte. Un type absent de cette table est un type qui
// existait déjà en semence 1 : on n'y touche pas.
const APPORTS = {
  2: ['juste_temps'],
  3: ['retour_flamme'],
  4: ['coupe_buche'],
  5: ['cache_cache'],
};

// Les jeux livrés d'office, construits depuis les questions d'exemple.
// Ce sont des modules ORDINAIRES : rien ne les distingue de ceux que l'animateur
// crée, et il peut les vider, les renommer ou les supprimer.
function modulesDeDepart(types = MODULE_TYPES) {
  return types.map((type) => ({
    id: uid('m'),
    type,
    name: moduleDefs[type].meta.name,
    duration: type === 'true_false' ? 12 : 20,
    color: moduleDefs[type].meta.color,
    questions: (demoQuestions[type] || []).map((q) => ({ ...q })),
  }))
    // LES JEUX « EN DIRECT » N'ONT PAS DE BANQUE, et c'est voulu : leur question
    // est saisie à l'antenne par l'animateur. Les écarter faute de questions les
    // rendrait tout simplement introuvables dans son menu.
    .filter((m) => m.questions.length > 0 || moduleDefs[m.type].meta.direct === true);
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
    return {
      seeded: !!brut.seeded,
      // Un fichier écrit avant l'existence des semences vaut la première.
      semence: Number.isFinite(Number(brut.semence)) ? Number(brut.semence) : 1,
      modules: brut.modules.map(normaliser).filter(Boolean),
    };
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
  return { seeded: true, semence: SEMENCE, modules: modulesDeDepart() };
}

// LA MONTÉE DE SEMENCE — voir la note de `SEMENCE`. N'ajoute que les types
// apparus depuis l'écriture du fichier, et jamais un jeu que l'animateur porte
// déjà. Renvoie `true` s'il faut réécrire.
function monterLaSemence(etat) {
  const depuis = Number.isFinite(Number(etat.semence)) ? Number(etat.semence) : 1;
  if (depuis >= SEMENCE) return false;
  const dejaLa = new Set(etat.modules.map((m) => m.type));
  const aPoser = [];
  for (let v = depuis + 1; v <= SEMENCE; v += 1) {
    for (const type of APPORTS[v] || []) {
      if (!dejaLa.has(type) && MODULE_TYPES.includes(type)) aPoser.push(type);
    }
  }
  etat.semence = SEMENCE;
  if (aPoser.length) etat.modules = [...etat.modules, ...modulesDeDepart(aPoser)];
  return true;
}

function charger(ownerId) {
  const cle = String(ownerId || 'dev-host');
  if (cache.has(cle)) return cache.get(cle);
  const surDisque = lireFichier(fichierDe(cle));
  const etat = surDisque || contenuInitial();
  cache.set(cle, etat);
  // La semence est écrite tout de suite : sans ça, le repère « déjà semé » ne
  // survivrait pas au redémarrage et des questions supprimées repousseraient.
  if (!surDisque) { ecrire(cle, etat); return etat; }
  // Fichier existant : on le monte à la semence courante s'il est en retard.
  if (monterLaSemence(etat)) ecrire(cle, etat);
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
  const etat = { seeded: true, semence: SEMENCE, modules: (Array.isArray(next) ? next : []).map(normaliser).filter(Boolean) };
  cache.set(String(ownerId || 'dev-host'), etat);
  ecrire(ownerId, etat);
  return etat.modules;
}

// L'ENREGISTREMENT COMPLET : le cache, le disque, ET LA BASE.
//
// Il est asynchrone et il LAISSE REMONTER SON ÉCHEC. C'est délibéré : le Studio
// affiche « Enregistré » sur la foi de la réponse du serveur, et une écriture
// perdue en silence est exactement le défaut qu'on vient de corriger.
export async function enregistrerModules(ownerId, next) {
  const liste = setModules(ownerId, next);
  await sauverEnBase(ownerId, liste);
  return liste;
}

// LA RELECTURE DEPUIS LA BASE — ce qui fait survivre le travail à un redémarrage.
//
// La base gagne sur le disque quand elle a quelque chose à dire. Elle ne dit rien
// dans deux cas : elle n'est pas configurée, ou ce compte n'y a rien encore —
// alors on garde ce que le disque connaît, et le premier enregistrement l'y
// portera.
export async function rafraichirDepuisLaBase(ownerId) {
  const enBase = await lireEnBase(ownerId);
  if (!enBase || !enBase.length) return getModules(ownerId);
  const cle = String(ownerId || 'dev-host');
  const etat = { seeded: true, semence: SEMENCE, modules: enBase };
  // LA SEMENCE S'APPLIQUE AUSSI À CE QUI VIENT DE LA BASE : un jeu ajouté au
  // projet depuis le dernier enregistrement doit apparaître, sinon « Cache-cache »
  // resterait invisible pour un compte dont la bibliothèque est en base.
  const monte = monterLaSemence(etat);
  cache.set(cle, etat);
  ecrire(cle, etat);
  if (monte) await sauverEnBase(ownerId, etat.modules).catch(() => {});
  return etat.modules;
}

// AU DÉMARRAGE : on rapatrie TOUS les comptes que la base connaît.
//
// Sans ce rappel, un animateur dont la console se reconnecte par la seule voie
// du socket — sans jamais demander la bibliothèque par HTTP — jouerait sur le
// disque vierge d'une machine neuve. Le volume est minuscule : une poignée de
// lignes, une fois, avant d'ouvrir le port.
export async function restaurerTousLesComptes() {
  const sb = getServiceClient();
  if (!sb) return { comptes: 0 };
  const { data, error } = await sb.from('modules').select('owner_id');
  if (error || !Array.isArray(data)) return { comptes: 0 };
  const comptes = [...new Set(data.map((l) => l.owner_id).filter(Boolean))];
  for (const c of comptes) await rafraichirDepuisLaBase(c).catch(() => {});
  return { comptes: comptes.length };
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

// TOUS LES TYPES APPORTÉS DEPUIS LA PREMIÈRE SEMENCE. Le contrôle de la montée
// s'en sert pour fabriquer une bibliothèque « d'avant » sans recopier la liste :
// un jeu ajouté un jour à la table des apports entre alors dans le contrôle tout
// seul, au lieu de passer à travers.
export const APPORTS_DEPUIS_LA_PREMIERE = Object.values(APPORTS).flat();
export const TYPES_A_LA_PREMIERE_SEMENCE = TYPES_SEMENCE_1;

// Vide le cache — les tests créent plusieurs comptes dans un même processus.
export function _reinitialiserCache() {
  cache.clear();
}
