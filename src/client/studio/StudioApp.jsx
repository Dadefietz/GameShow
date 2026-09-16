// Surface STUDIO — éditeur de questionnaires, hors antenne.
// Design : extraction Claude Design — E1 navigation, E2 grille de modules,
// E3 panneau d'édition, E4 questions et leurs quatre formulaires.
//
// Densité de saisie assumée, aucun effet : la seule animation du studio est le
// chatoiement des squelettes de chargement. Les banques restent la source de
// vérité du jeu — ce qu'on enregistre ici est ce que le moteur jouera.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from '../shared/supabaseClient.js';
import { preparerImage, identifiantDObjet } from './imageObjet.js';
import './studio.css';

// --- Référentiel des types de module (icône + variante couleur du mockup) ---
//
// TOUT TYPE DU SERVEUR DOIT FIGURER ICI. Ce qui n'y figure pas était jusqu'ici
// converti EN SILENCE en « quiz » (voir `normalizeModule`) : « Le lien », dont
// le type était inconnu du Studio, se transformait donc en quiz vide dès que
// l'animateur enregistrait quoi que ce soit dans son Studio. Le jeu disparaissait
// de son menu, sans le moindre message.
const MODULE_TYPES = {
  // LES DURÉES NE SONT PLUS ÉCRITES ICI. Elles viennent du serveur, qui les
  // déclare module par module (`/api/modules` → `types`) : le Studio affichait la
  // durée de la BANQUE, un nombre réglable que la plupart des jeux ne lisent pas,
  // et « Coupe ta bûche » y annonçait vingt secondes pour un jeu qui en dure dix.
  quiz:       { label: 'Quiz',       subtitle: 'Choix multiple',   icon: 'help-circle',  color: 'fire' },
  true_false: { label: 'Vrai/Faux',  subtitle: 'Binaire',          icon: 'check-square', color: 'forest' },
  estimation: { label: 'Estimation', subtitle: 'Réponse chiffrée', icon: 'target',       color: 'flame' },
  // EN DIRECT : sa question — deux mots — se tape à l'antenne. Il n'y a donc rien
  // à préparer ici, et le Studio ne doit pas prétendre le contraire.
  lien:       { label: 'Le lien',    subtitle: 'Deux mots, en direct', icon: 'link', color: 'info', direct: true },
  visages:    { label: 'Les visages', subtitle: 'Le visage passé deux fois', icon: 'users', color: 'forest', direct: true },
  // EN DIRECT lui aussi : sa série est tirée par le serveur au lancement, et son
  // MODE — retour −2 ou −3 — se choisit à l'antenne, juste avant de démarrer.
  retour_flamme: { label: 'Retour de flamme', subtitle: 'L\'image déjà vue', icon: 'shuffle', color: 'fire', direct: true },
  // EN DIRECT lui aussi : sa proportion cible se saisit à l'antenne.
  coupe_buche: { label: 'Coupe ta bûche', subtitle: 'Couper à la bonne proportion', icon: 'zap', color: 'fire', direct: true },
  // EN DIRECT lui aussi : ses deux temps — le cache et la cible — se saisissent
  // à l'antenne, sur la console. Rien à préparer ici.
  juste_temps: { label: 'Le juste temps', subtitle: 'Arrêter un chrono qu\'on ne voit plus', icon: 'clock', color: 'flame', direct: true },
  vote:       { label: 'Vote',       subtitle: 'Sondage groupe',   icon: 'bar-chart-2',  color: 'info' },
  // EN DIRECT lui aussi : sa grille de neuf objets et ses cinq questions sont
  // tirées par le serveur au lancement. Rien à préparer ici.
  cache_cache: { label: 'Cache-cache', subtitle: 'Neuf objets, vus une fois', icon: 'grid', color: 'info', direct: true },
};
const TYPE_KEYS = Object.keys(MODULE_TYPES);
const COLOR_KEYS = ['fire', 'forest', 'flame', 'info'];
const COLOR_LABEL = { fire: 'Orange', forest: 'Vert', flame: 'Ambre', info: 'Bleu' };

let SEQ = 0;
const uid = (p = 'id') => `${p}-${Date.now().toString(36)}-${(SEQ++).toString(36)}`;

// Fabrique une question vierge cohérente avec le type du module.
function makeQuestion(type) {
  const base = { id: uid('q'), type, prompt: '' };
  if (type === 'quiz') return { ...base, options: ['', '', '', ''], correct: 0 };
  if (type === 'true_false') return { ...base, answer: true };
  if (type === 'estimation') return { ...base, target: 0 };
  return { ...base, options: ['', ''] }; // vote
}

// --- Seed initial réaliste, cohérent avec les 4 types ---
function seedModules() {
  return [
    {
      id: uid('m'), type: 'quiz', name: 'Culture générale', duration: 20, color: 'fire',
      questions: [
        { id: uid('q'), type: 'quiz', prompt: 'Quelle planète est la plus proche du Soleil ?', options: ['Mercure', 'Vénus', 'Mars', 'Terre'], correct: 0 },
        { id: uid('q'), type: 'quiz', prompt: 'Combien de cordes possède une guitare classique ?', options: ['4', '5', '6', '7'], correct: 2 },
      ],
    },
    {
      id: uid('m'), type: 'true_false', name: 'Vrai ou Faux', duration: 10, color: 'forest',
      questions: [
        { id: uid('q'), type: 'true_false', prompt: 'La Tour Eiffel mesure plus de 300 mètres.', answer: true },
        { id: uid('q'), type: 'true_false', prompt: 'Un octogone possède six côtés.', answer: false },
      ],
    },
    {
      id: uid('m'), type: 'estimation', name: 'À vue de nez', duration: 30, color: 'flame',
      questions: [
        { id: uid('q'), type: 'estimation', prompt: "Combien de pays composent l'Union européenne ?", target: 27 },
        { id: uid('q'), type: 'estimation', prompt: 'En quelle année a eu lieu le premier pas sur la Lune ?', target: 1969 },
      ],
    },
    {
      id: uid('m'), type: 'vote', name: 'Le grand vote', duration: 15, color: 'info',
      questions: [
        { id: uid('q'), type: 'vote', prompt: 'Quelle destination pour le prochain week-end ?', options: ['Montagne', 'Plage', 'Ville', 'Forêt'] },
        { id: uid('q'), type: 'vote', prompt: 'Quel film ce soir ?', options: ['Comédie', 'Horreur', 'Action'] },
      ],
    },
  ];
}

// Normalise une ligne Supabase (schéma inconnu → défensif) vers notre forme.
function normalizeModule(row) {
  if (!row || typeof row !== 'object') return null;
  const type = TYPE_KEYS.includes(row.type) ? row.type : 'quiz';
  let questions = row.questions;
  if (typeof questions === 'string') { try { questions = JSON.parse(questions); } catch { questions = []; } }
  if (!Array.isArray(questions)) questions = [];
  return {
    id: row.id != null ? String(row.id) : uid('m'),
    type,
    name: typeof row.name === 'string' && row.name ? row.name : MODULE_TYPES[type].label,
    duration: Number.isFinite(Number(row.duration)) ? Number(row.duration) : 20,
    color: COLOR_KEYS.includes(row.color) ? row.color : MODULE_TYPES[type].color,
    questions: questions.map((q) => ({ id: q.id != null ? String(q.id) : uid('q'), type, ...q })),
  };
}

// --- Repli SANS Supabase : banques disque du serveur (/api/banks, R4) -------
// Serveur : { id, text, options?, correctIndex?, correct?, target?, durationSec? }
// Studio  : { id, prompt, options?, correct?(index), answer?(bool), target? }
function serverToStudioQuestion(type, q) {
  const base = { id: String(q.id ?? uid('q')), type, prompt: q.text || '' };
  if (type === 'quiz') return { ...base, options: q.options || ['', '', '', ''], correct: q.correctIndex ?? 0 };
  if (type === 'true_false') return { ...base, answer: !!q.correct };
  if (type === 'estimation') return { ...base, target: Number(q.target) || 0, nature: q.nature === 'annee' ? 'annee' : 'nombre' };
  return { ...base, options: q.options || ['', ''], poll: !!q.poll, categorie: q.categorie || 'vie' }; // vote
}

function studioToServerQuestion(type, q, durationSec) {
  const base = { id: String(q.id), text: q.prompt || '', durationSec: durationSec || undefined };
  if (type === 'quiz') return { ...base, options: q.options || [], correctIndex: Number(q.correct) || 0 };
  if (type === 'true_false') return { ...base, correct: !!q.answer };
  if (type === 'estimation') return { ...base, target: Number(q.target) || 0, nature: q.nature === 'annee' ? 'annee' : 'nombre' };
  return { ...base, options: q.options || [], poll: !!q.poll, categorie: q.categorie || 'vie' }; // vote
}

// Le module du serveur a la MÊME forme que celui du Studio, au format des
// questions près. Le nom et l'identifiant traversent donc intacts — c'est
// précisément ce que l'ancien aplatissement par type détruisait.
function serveurVersStudio(m) {
  if (!m || typeof m !== 'object') return null;
  const type = TYPE_KEYS.includes(m.type) ? m.type : 'quiz';
  return {
    id: String(m.id),
    type,
    name: typeof m.name === 'string' && m.name ? m.name : MODULE_TYPES[type].label,
    duration: Number.isFinite(Number(m.duration)) ? Number(m.duration) : 20,
    color: COLOR_KEYS.includes(m.color) ? m.color : MODULE_TYPES[type].color,
    // LE CONTENU DE « CACHE-CACHE » VOYAGE À PART, et ne passe pas par la
    // moulinette des questions : ce n'en sont pas. Il emprunte le même champ en
    // base — c'est ce qui le rend durable sans table nouvelle — mais il porte des
    // gabarits et une banque d'images, pas des énoncés.
    contenuCache: (Array.isArray(m.questions) ? m.questions : []).find((q) => q?.kind === 'contenu-cache') || null,
    questions: (Array.isArray(m.questions) ? m.questions : [])
      .filter((q) => q?.kind !== 'contenu-cache')
      .map((q) => serverToStudioQuestion(type, q)),
  };
}

function studioVersServeur(m) {
  return {
    id: String(m.id),
    type: m.type,
    name: m.name,
    duration: Number(m.duration) || 20,
    color: m.color,
    questions: [
      ...(m.contenuCache ? [m.contenuCache] : []),
      ...(m.questions || [])
        .filter((q) => (q.prompt || '').trim())
        .map((q) => studioToServerQuestion(m.type, q, m.duration)),
    ],
  };
}


// ---- Icônes du système (SVG au trait) --------------------------------------
const I = {
  flame: ({ s = 20 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
        <g className="brand-flame">
          <path d="M12 2.9c3 3.7 4.5 6.1 4.5 8a4.5 4.5 0 01-9 0c0-1.7.9-3.4 2.6-5.2" />
        </g>
        <path d="M3.4 18.7l17.2-3.5" /><path d="M3.4 15.2l17.2 3.5" />
      </g>
      <circle className="brand-spark" cx="12" cy="12.6" r="1.5" fill="currentColor" />
    </svg>
  ),
  check: ({ s = 16, w = 3, dashed = false }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" {...(dashed ? { strokeDasharray: 26 } : {})} />
    </svg>
  ),
  plus: ({ s = 16 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" aria-hidden="true"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
  ),
  trash: ({ s = 16 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16" /><path d="M9 7V5h6v2" /><path d="M6 7l1 13h10l1-13" />
    </svg>
  ),
  chevron: ({ s = 16, open = false }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      style={{ transform: open ? 'rotate(90deg)' : 'none' }}><path d="M9 6l6 6-6 6" /></svg>
  ),
  x: ({ s = 14 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" aria-hidden="true"><path d="M7 7l10 10" /><path d="M17 7L7 17" /></svg>
  ),
  alert: ({ s = 18 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><path d="M12 8v5" /><path d="M12 16.2v.4" />
    </svg>
  ),
};

export function StudioApp() {
  const [modules, setModules] = useState(seedModules);
  const [selectedId, setSelectedId] = useState(null);
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [mode, setMode] = useState('local');        // 'local' | 'server' | 'supabase'
  // LES DURÉES RÉELLES DES JEUX, telles que le serveur les déclare. Le Studio ne
  // les invente pas et ne les recopie pas : il les affiche.
  const [typesServeur, setTypesServeur] = useState({});
  // LE CATALOGUE DE « CACHE-CACHE » — les formes de questions que le serveur sait
  // calculer, les couleurs de la banque et les deux cents objets. Chargé SEULEMENT
  // quand un module de ce type est ouvert : c'est deux cents lignes d'images, et
  // les neuf dixièmes des visites au Studio n'y touchent jamais.
  const [catalogueCache, setCatalogueCache] = useState(null);
  const [authed, setAuthed] = useState(null);
  const [saveState, setSaveState] = useState('idle'); // idle|saving|saved|local|error|invalid
  const [validationErrors, setValidationErrors] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null);
  // Tant que le chargement distant n'est pas tranché : squelettes, jamais des
  // modules de démo qui « sautent » vers les vrais.
  const [remoteLoading, setRemoteLoading] = useState(() => !!getSupabase());

  const sb = useMemo(() => getSupabase(), []);

  // En-têtes d'autorisation pour /api/banks. LE DÉFAUT CORRIGÉ : le Studio
  // appelait cette route SANS aucun en-tête. En développement, `requireHost` est
  // ouvert et ça passait ; en production, où HOST_EMAIL est configuré, le serveur
  // répondait 403 et l'enregistrement échouait silencieusement — le Studio
  // basculait en « local » sans que rien n'explique pourquoi. C'est l'une des deux
  // causes des questions du Studio qui n'arrivaient jamais en partie.
  const entetesHote = useCallback(async () => {
    const base = { 'content-type': 'application/json' };
    if (!sb) return base;
    try {
      const { data } = await sb.auth.getSession();
      const jeton = data?.session?.access_token;
      return jeton ? { ...base, authorization: `Bearer ${jeton}` } : base;
    } catch {
      return base;
    }
  }, [sb]);

  // LE CATALOGUE DE « CACHE-CACHE », chargé quand un module de ce type est ouvert.
  //
  // AVEC L'EN-TÊTE D'ANIMATEUR, et c'est tout le sujet. Cette route est derrière
  // `requireHost`. Sans en-tête, elle passe en développement — où l'autorisation
  // est ouverte — et répond 403 en production, où HOST_EMAIL est configuré : le
  // catalogue n'arrivait jamais, et l'écran de modération restait VIDE sur le site
  // déployé, sans qu'aucun message ne l'explique. C'est exactement le défaut que
  // `/api/modules` avait connu ; un contrôle le garde désormais pour toutes les
  // routes à la fois (tests/unit/studio-entetes.test.js).
  const [catalogueRate, setCatalogueRate] = useState(null);
  const typeOuvert = modules.find((m) => m.id === selectedId)?.type;
  useEffect(() => {
    if (typeOuvert !== 'cache_cache' || catalogueCache) return undefined;
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/cache/catalogue', { headers: await entetesHote() });
        if (!alive) return;
        if (res.ok) { setCatalogueCache(await res.json()); setCatalogueRate(null); return; }
        // ON LE DIT. Un panneau vide sans explication est pire qu'une erreur.
        setCatalogueRate(res.status === 403
          ? "Ta session d'animateur ne permet pas de lire le catalogue. Reconnecte-toi."
          : `Le catalogue n'a pas pu être chargé (${res.status}).`);
      } catch {
        if (alive) setCatalogueRate("Le catalogue n'a pas pu être chargé.");
      }
    })();
    return () => { alive = false; };
  }, [typeOuvert, catalogueCache, entetesHote]);

  // CHARGEMENT : le Studio ne parle QU'AU SERVEUR (actions 2 et 10).
  //
  // Auparavant il avait deux chemins — Supabase depuis le navigateur si une
  // session existait, le serveur sinon — et deux défauts en découlaient :
  //   - le chemin serveur n'était emprunté que si le client Supabase était
  //     TOTALEMENT absent, ce qui n'arrive jamais (URL et clé sont intégrées au
  //     build). Le Studio gardait donc sa graine locale de démonstration et
  //     l'écrasait par-dessus la vraie bibliothèque au premier enregistrement ;
  //   - deux chemins d'écriture, donc deux vérités possibles pour un même compte.
  //
  // Désormais le serveur est seul propriétaire de la persistance : il écrit sur
  // disque, et c'est lui — et lui seul — qui consulte Supabase pour alimenter les
  // parties. Un seul chemin, donc une seule vérité.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/modules', { headers: await entetesHote() });
        if (!alive) return;
        if (res.ok) {
          const { modules: recus, types } = await res.json();
          if (types) setTypesServeur(types);
          const mapped = (recus || []).map(serveurVersStudio).filter(Boolean);
          if (mapped.length) { setModules(mapped); setMode('server'); }
        } else if (res.status === 403) {
          // Refus d'autorisation : l'animateur n'est pas connecté sur cette page.
          // On le DIT plutôt que de basculer en local sans rien expliquer — c'est
          // exactement ce silence qui masquait le défaut en production.
          setAuthed(false);
          setSaveState('unauthorized');
        }
      } catch { /* dev Vite pur sans serveur : on garde la graine locale */ }
      finally { if (alive) { setRemoteLoading(false); setAuthed((a) => (a === null ? true : a)); } }
    })();
    return () => { alive = false; };
  }, [entetesHote]);

  const selected = modules.find((m) => m.id === selectedId) || null;

  const patchModule = (id, patch) => {
    setSaveState('idle');
    setValidationErrors([]);
    setModules((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  // `addModule` a été retiré avec ses trois boutons (A15) : un module se déclare
  // dans le code, où vivent son type, son barème et ses écrans. La fonction ne
  // savait de toute façon fabriquer qu'un quiz de plus.

  // LA SUPPRESSION S'ENREGISTRE TOUT DE SUITE (A5).
  //
  // Elle ne s'enregistrait PAS. Le seul chemin vers le serveur est le bouton
  // « Enregistrer » du panneau d'édition — or supprimer un module ferme ce
  // panneau, et `saveModule` sort immédiatement quand plus rien n'est
  // sélectionné. L'animateur supprimait un jeu, le voyait disparaître, et le
  // retrouvait au rechargement suivant.
  //
  // On écrit donc directement, sans passer par la validation : ce qui reste n'a
  // pas changé, seul un élément est parti. Et la suppression demande déjà une
  // confirmation en deux temps — elle n'a pas besoin d'un troisième geste.
  const removeModule = async (id) => {
    const restants = modules.filter((m) => m.id !== id);
    setModules(restants);
    if (selectedId === id) { setSelectedId(null); setEditingQuestionId(null); }
    setConfirmDelete(null);
    setSaveState('saving');
    try {
      const res = await fetch('/api/modules', {
        method: 'PUT',
        headers: await entetesHote(),
        body: JSON.stringify({ modules: restants.map(studioVersServeur) }),
      });
      if (res.status === 403) { setSaveState('unauthorized'); return; }
      // 503 : LE SERVEUR A REÇU, MAIS LA BASE N'A PAS PRIS. C'est le cas qu'il
      // faut distinguer d'une panne réseau : la saisie n'est durable nulle part,
      // et un « Enregistré » affiché ici serait exactement le mensonge qu'on
      // vient de corriger (le disque de l'hébergement ne survit pas au
      // redémarrage).
      if (res.status === 503) { setSaveState('nondurable'); return; }
      if (!res.ok) throw new Error('save-failed-' + res.status);
      setMode('server');
      setSaveState('saved');
      setTimeout(() => setSaveState((st) => (st === 'saved' ? 'idle' : st)), 2000);
    } catch { setSaveState('error'); }
  };

  const selectModule = (id) => { setSelectedId(id); setEditingQuestionId(null); setConfirmDelete(null); };

  // Validation avant enregistrement : un module invalide serait silencieusement
  // filtré en jeu — on préfère le dire AVANT la sauvegarde, question par question.
  const validateModule = (m) => {
    const problems = [];
    if (!String(m.name || '').trim()) problems.push({ qid: null, tag: null, msg: 'Donne un nom au module.' });
    if (!Number.isFinite(m.duration) || m.duration < 3) problems.push({ qid: null, tag: null, msg: 'Durée minimale : 3 secondes.' });
    // UN JEU EN DIRECT N'A PAS DE BANQUE, ET C'EST VOULU (A5). Sa question est
    // tapée à l'antenne. Exiger une question de « Le lien » rendait ce jeu
    // IMPOSSIBLE À ENREGISTRER : renommer, changer sa durée ou sa couleur ne
    // survivait à aucun rechargement, l'enregistrement étant refusé pour une
    // question qu'il ne peut pas avoir. Le serveur connaissait déjà l'exception
    // (store.js écarte les jeux sans question « sauf direct ») ; le studio la
    // redéclarait à sa façon, et se trompait.
    if (!m.questions.length && !MODULE_TYPES[m.type]?.direct) {
      problems.push({ qid: null, tag: null, msg: 'Ajoute au moins une question.' });
    }
    m.questions.forEach((q, i) => {
      const tag = `Q${i + 1}`;
      if (!String(q.prompt || '').trim()) problems.push({ qid: q.id, tag, msg: "L'énoncé est vide." });
      if (m.type === 'quiz' || m.type === 'vote') {
        const opts = (q.options || []).map((o) => String(o || '').trim());
        if (opts.filter(Boolean).length < 2) problems.push({ qid: q.id, tag, msg: 'Il faut au moins 2 options remplies.' });
        if (m.type === 'quiz') {
          const c = q.correct;
          if (!Number.isInteger(c) || !opts[c]) problems.push({ qid: q.id, tag, msg: 'Aucune bonne réponse cochée.' });
        }
      }
      if (m.type === 'estimation' && !Number.isFinite(Number(q.target))) {
        problems.push({ qid: q.id, tag, msg: 'La cible doit être un nombre.' });
      }
    });

    // LA MODÉRATION DE « CACHE-CACHE » SE VALIDE ICI, ET C'EST NÉCESSAIRE.
    //
    // Le serveur n'a pas de rattrapage : un tirage impossible LÈVE une erreur, et
    // l'animateur clique « Lancer » sans que rien ne parte. Trois réglages
    // produisent cela, et aucun des trois ne se voit en lisant le formulaire :
    //   - la somme des minimums dépasse cinq — il n'y a pas assez de questions
    //     dans une manche pour les tenir toutes ;
    //   - la somme des maximums est sous cinq — on ne peut pas en fabriquer cinq ;
    //   - la banque n'offre plus neuf noms distincts, ou plus les cinq couleurs.
    // La première et la deuxième sont EXACTEMENT la condition d'existence d'une
    // répartition : entre ces deux sommes, tout total entier est atteignable.
    if (m.type === 'cache_cache' && m.contenuCache) {
      const gabarits = (m.contenuCache.gabarits || []).filter((g) => g.actif !== false);
      let sMin = 0; let sMax = 0;
      gabarits.forEach((g, i) => {
        const tag = `Q${i + 1}`;
        if (!String(g.gabarit || '').trim()) problems.push({ qid: null, tag, msg: "L'énoncé est vide." });
        const min = Math.max(0, Number(g.min) || 0);
        const max = Math.max(0, Number(g.max) || 0);
        if (max < min) problems.push({ qid: null, tag, msg: `« ${g.forme} » : le maximum est sous le minimum.` });
        sMin += min; sMax += Math.max(min, max);
      });
      if (!gabarits.length) {
        problems.push({ qid: null, tag: null, msg: 'Laisse au moins une question active.' });
      } else if (sMin > QUESTIONS_PAR_MANCHE) {
        problems.push({ qid: null, tag: null, msg: `Les minimums totalisent ${sMin} : une manche n'a que ${QUESTIONS_PAR_MANCHE} questions.` });
      } else if (sMax < QUESTIONS_PAR_MANCHE) {
        problems.push({ qid: null, tag: null, msg: `Les maximums totalisent ${sMax} : il en faut ${QUESTIONS_PAR_MANCHE} pour remplir une manche.` });
      }

      const objets = m.contenuCache.objets || [];
      if (objets.length) {
        // Une ligne incomplète est refusée PAR LE SERVEUR de toute façon — mais
        // il répond « enregistrement refusé » sans dire laquelle. On le dit.
        for (const o of objets) {
          if (!String(o.nom || '').trim()) problems.push({ qid: null, tag: null, msg: `L'image « ${o.id} » n'a pas de nom.` });
          if (!String(o.couleur || '').trim()) problems.push({ qid: null, tag: null, msg: `L'image « ${o.id} » n'a pas de couleur.` });
          if (!String(o.src || '').trim()) problems.push({ qid: null, tag: null, msg: `L'image « ${o.id} » n'a pas de fichier.` });
        }
        // LA COULEUR RÉSERVÉE EST MISE À PART DANS TOUTES LES VÉRIFICATIONS : elle
        // ne remplit pas une grille en couleur, et n'a pas à respecter la règle
        // des cinq à neuf. Le mode « Classique » a la sienne — neuf noms — qui se
        // vérifie séparément.
        const RESERVEE = 'Noir';
        const enCouleur = objets.filter((o) => String(o.couleur || '').trim() !== RESERVEE);
        const noires = objets.filter((o) => String(o.couleur || '').trim() === RESERVEE);
        const teintes = [...new Set(enCouleur.map((o) => String(o.couleur || '').trim()).filter(Boolean))];
        if (noires.length && noires.length < 9) {
          problems.push({ qid: null, tag: null,
            msg: `Le mode Classique demande 9 images « ${RESERVEE} » ; la banque en porte ${noires.length}.` });
        }
        const nomsNoirs = new Set(noires.map((o) => String(o.nom || '').trim()).filter(Boolean));
        if (noires.length >= 9 && nomsNoirs.size < 9) {
          problems.push({ qid: null, tag: null,
            msg: `Le mode Classique demande 9 noms différents en « ${RESERVEE} » ; la banque en offre ${nomsNoirs.size}.` });
        }

        // COMBIEN DE COULEURS LA GRILLE ADMET. Neuf cases, chaque couleur une ou
        // deux fois : quatre n'en couvrent que huit, dix n'en remplissent que dix.
        if (teintes.length < COULEURS_MIN || teintes.length > COULEURS_MAX) {
          problems.push({ qid: null, tag: null,
            msg: `La banque porte ${teintes.length} couleur${teintes.length > 1 ? 's' : ''} : il en faut de ${COULEURS_MIN} à ${COULEURS_MAX} pour remplir neuf cases.` });
        }

        // LA BANQUE DOIT ÊTRE COMPLÈTE, PAS SEULEMENT FOURNIE.
        //
        // Le tirage choisit neuf NOMS, puis leur affecte les couleurs. Un nom qui
        // n'existe pas dans la couleur tirée fait échouer la matrice entière, et
        // l'échec se répète. Il faut donc neuf noms disponibles dans TOUTES les
        // couleurs — un nom présent dans quatre teintes sur cinq ne compte pas.
        const parNom = new Map();
        for (const o of enCouleur) {
          const nom = String(o.nom || '').trim();
          const c = String(o.couleur || '').trim();
          if (!nom || !c) continue;
          if (!parNom.has(nom)) parNom.set(nom, new Set());
          parNom.get(nom).add(c);
        }
        const complets = [...parNom].filter(([, cs]) => cs.size === teintes.length);
        if (teintes.length >= COULEURS_MIN && complets.length < 9) {
          const manque = [...parNom].filter(([, cs]) => cs.size < teintes.length).slice(0, 3).map(([n]) => n);
          problems.push({ qid: null, tag: null,
            msg: `Seuls ${complets.length} noms existent dans les ${teintes.length} couleurs ; il en faut 9.`
              + (manque.length ? ` Incomplets : ${manque.join(', ')}…` : '') });
        }

        // « QUELLE COULEUR N'EST PRÉSENTE QU'UNE SEULE FOIS ? » N'EXISTE QU'À CINQ.
        // Quatre doublées et une seule : c'est la seule répartition possible, et
        // c'est ce qui rend la question sans ambiguïté. À six, il y en a trois.
        const unique = gabarits.find((g) => g.forme === 'couleur_unique' && (Number(g.min) || 0) > 0);
        if (unique && teintes.length !== 5) {
          problems.push({ qid: null, tag: null,
            msg: `« ${unique.gabarit} » exige exactement 5 couleurs ; la banque en porte ${teintes.length}. Mets son minimum à 0 ou reviens à 5 couleurs.` });
        }
      }
    }
    return problems;
  };

  // RESTAURER LES JEUX DE BASE (action 2, décision 6). Les questions d'exemple
  // sont désormais de la donnée ordinaire, donc supprimables — et une suppression
  // massive doit rester rattrapable. La restauration N'ÉCRASE RIEN : elle ne
  // rajoute que les jeux livrés d'office qui manquent.
  // `restaurerBase` a été retiré avec son bouton (A16). La route serveur
  // POST /api/modules/restore SUBSISTE : c'est le chemin de récupération si la
  // bibliothèque est vidée par accident, du même côté que la création — le code.

  const saveModule = async () => {
    const m = selected;
    if (!m) return;
    const problems = validateModule(m);
    setValidationErrors(problems);
    if (problems.length) { setSaveState('invalid'); return; }
    setSaveState('saving');
    try {
      const res = await fetch('/api/modules', {
        method: 'PUT',
        headers: await entetesHote(),
        body: JSON.stringify({ modules: modules.map(studioVersServeur) }),
      });
      // Un 403 n'est pas une panne réseau : c'est un refus d'autorisation, et il
      // doit se lire comme tel. Le basculement muet en « local » a laissé croire
      // pendant des mois que le Studio enregistrait.
      if (res.status === 403) { setSaveState('unauthorized'); return; }
      if (!res.ok) throw new Error('save-failed-' + res.status);
      setMode('server');
      setSaveState('saved');
      setTimeout(() => setSaveState((st) => (st === 'saved' ? 'idle' : st)), 2000);
    } catch { setSaveState('error'); }
  };


  const patchQuestion = (moduleId, qid, patch) => {
    setSaveState('idle');
    setValidationErrors([]);
    setModules((prev) => prev.map((m) =>
      m.id !== moduleId ? m : { ...m, questions: m.questions.map((q) => (q.id === qid ? { ...q, ...patch } : q)) }
    ));
  };

  const addQuestion = (module) => {
    const q = makeQuestion(module.type);
    setModules((prev) => prev.map((m) => (m.id === module.id ? { ...m, questions: [...m.questions, q] } : m)));
    setEditingQuestionId(q.id);
  };

  const removeQuestion = (moduleId, qid) => {
    setModules((prev) => prev.map((m) =>
      m.id !== moduleId ? m : { ...m, questions: m.questions.filter((q) => q.id !== qid) }
    ));
    if (editingQuestionId === qid) setEditingQuestionId(null);
  };

  const invalidQids = new Set(validationErrors.filter((e) => e.qid).map((e) => e.qid));

  return (
    <div className={`studio${selected ? ' studio--editing' : ''}`}>
      <Sidebar modules={modules} selectedId={selectedId} mode={mode} loading={remoteLoading}
        onSelect={selectModule} />

      <main className="work" data-state={modules.length === 0 ? 'empty' : 'ready'} aria-label="Gestion des modules">
        <div className="work__head">
          <div>
            <h1 className="work__title">Questionnaires</h1>
            <p className="work__sub">Assemble les modules qui rythment tes soirées.</p>
          </div>
          <div className="work__actions">
            {/* CHANTIER v4, décision 9.4 — LE CHEMIN DE RETOUR. Le volet de la
                console mène ici ; sans ce lien, le Studio est un cul-de-sac et
                l'animateur en repart par le bouton « précédent » du navigateur —
                le seul geste dont on ne maîtrise pas l'effet.
                La console restaure sa session au retour : le salon, ses joueurs et
                la manche en cours sont retrouvés (décision 9.6). */}
            <a className="button button--quiet" href="/host" data-action="studio:retour-animation"
              data-testid="studio-retour-animation">
              Retour à l'animation
            </a>
            {/* A15 — « la création d'un nouveau module devait passer par le code
                plutôt que par le chemin actuellement visible ». Un module n'est
                pas qu'un nom et une couleur : son TYPE commande des règles de jeu,
                un barème, un enchaînement d'écrans et des phrases de voix, tous
                écrits dans le code. Le bouton laissait croire qu'on pouvait en
                inventer un depuis le studio, alors qu'il ne savait produire qu'un
                quiz de plus.
                A16 — « Restaurer les questions de base », jugé inutile dans le
                parcours retenu, part avec lui. Le serveur garde sa route de
                restauration : c'est le chemin de récupération, côté code, comme
                pour la création. */}
          </div>
        </div>

        {remoteLoading ? (
          <div className="grid" aria-hidden="true">
            {[0, 1, 2].map((i) => <div className="skeleton" key={i} style={{ height: '180px' }} />)}
          </div>
        ) : modules.length === 0 ? (
          <div className="empty-state">
            <span style={{ color: 'var(--c-ink-3)' }} aria-hidden="true"><I.flame s={30} /></span>
            <h2 className="work__title">Aucun module</h2>
            {/* Sans bouton de création (A15), l'écran vide doit dire où aller —
                sinon il devient un cul-de-sac. */}
            <p className="work__sub">
              Les jeux sont déclarés dans le code. Si cette liste est vide, c'est
              que la bibliothèque n'a pas encore été semée : relance le serveur, ou
              demande une restauration des jeux livrés d'office.
            </p>
          </div>
        ) : (
          <section className="grid" aria-label="Liste des modules">
            {modules.map((m) => (
              <ModuleCard key={m.id} module={m} selected={m.id === selectedId}
                typeServeur={typesServeur[m.type]}
                onSelect={() => selectModule(m.id)} onEdit={() => selectModule(m.id)} />
            ))}
          </section>
        )}
      </main>

      {selected ? (
        <EditorPanel
          module={selected}
          typeServeur={typesServeur[selected.type]}
          catalogueCache={catalogueCache}
          catalogueRate={catalogueRate}
          entetesHote={entetesHote}
          editingQuestionId={editingQuestionId}
          invalidQids={invalidQids}
          saveState={saveState}
          validationErrors={validationErrors}
          confirmDelete={confirmDelete === selected.id}
          onArmDelete={() => setConfirmDelete(confirmDelete === selected.id ? null : selected.id)}
          onConfirmDelete={() => removeModule(selected.id)}
          onPatchModule={(patch) => patchModule(selected.id, patch)}
          onAddQuestion={() => addQuestion(selected)}
          onEditQuestion={(qid) => setEditingQuestionId(qid === editingQuestionId ? null : qid)}
          onPatchQuestion={(qid, patch) => patchQuestion(selected.id, qid, patch)}
          onRemoveQuestion={(qid) => removeQuestion(selected.id, qid)}
          onSave={saveModule}
          onClose={() => selectModule(null)}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// E1 — Navigation latérale
// ---------------------------------------------------------------------------
function Sidebar({ modules, selectedId, mode, loading, onSelect, onAdd }) {
  const source = loading
    ? { cls: '', text: 'Chargement des banques…' }
    : mode === 'local'
      ? { cls: ' source--off', text: 'Hors ligne' }
      : { cls: ' source--ok', text: 'Synchronisé' };

  // E1 état global selon contrat maquette
  const e1State = loading ? 'loading' : modules.length === 0 ? 'empty' : mode === 'local' ? 'offline' : 'ready';

  return (
    <nav className="nav" data-state={e1State} aria-label="Navigation du studio">
      <div className="nav__brand">
        <span className="nav__mark" aria-hidden="true"><I.flame s={20} /></span>
        <span className="nav__name">Game Show<span className="nav__sub">Studio</span></span>
      </div>

      <div className={`source${source.cls}`} data-bind="banks.source" role="status">
        <span className="source__dot" aria-hidden="true" />
        <div>
          {source.text}
          {mode === 'local' && !loading ? (
            <p className="source__hint">
              Ta copie locale reste modifiable ; elle sera envoyée à la reconnexion.
            </p>
          ) : null}
        </div>
      </div>

      <p className="flabel">Modules</p>
      <div className="nav__list" data-bind="banks.modules">
        {loading ? (
          [0, 1, 2, 3].map((i) => <div className="skeleton" key={i} />)
        ) : modules.length === 0 ? (
          <p className="fhint">Aucun module pour l'instant.</p>
        ) : modules.map((m) => (
          <button key={m.id} type="button" className="nav__item" data-action="studio:selectModule"
            aria-current={m.id === selectedId ? 'true' : undefined} onClick={() => onSelect(m.id)}>
            <span className={`nav__swatch swatch--${m.color}`} aria-hidden="true"
              style={{ background: `var(--c-${m.color === 'fire' ? 'ember' : m.color === 'forest' ? 'moss' : m.color === 'flame' ? 'flame' : 'fern'})` }} />
            <span className="nav__item-name">{m.name}</span>
            <span className="nav__item-count">{m.questions.length}</span>
          </button>
        ))}
      </div>

      {/* Le bouton « Nouveau module » vivait ici aussi (A15). Un seul retrait sur
          trois aurait laissé le chemin ouvert par la porte de service. */}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// E2 — Carte de module
// ---------------------------------------------------------------------------
// Le nombre d'énoncés que le serveur livre d'office pour « Cache-cache ». Il ne
// sert qu'à l'étiquette de la carte, avant que le catalogue ne soit chargé — la
// carte ne va pas chercher deux cents images pour écrire un nombre.
const GABARITS_CACHE_PAR_DEFAUT = 6;

function ModuleCard({ module, selected, onEdit, typeServeur }) {
  const t = MODULE_TYPES[module.type] || MODULE_TYPES.quiz;
  const noQuestion = module.questions.length === 0;
  // LA DURÉE AFFICHÉE EST CELLE DU JEU. Quand le serveur l'impose, elle prime sur
  // celle de la banque — sans quoi la carte et l'éditeur annoncent deux nombres
  // différents pour la même chose, ce qui a été rapporté.
  const duree = typeServeur?.dureeS ?? module.duration;
  // « CACHE-CACHE » COMPTE SES GABARITS, PAS SES QUESTIONS. Sa banque tient dans
  // une entrée marquée du même champ `questions` ; la compter comme une question
  // afficherait « 1 question » pour six énoncés et deux cents images.
  const estModere = module.type === 'cache_cache';
  const nbGabarits = estModere
    ? (module.contenuCache?.gabarits?.length ?? GABARITS_CACHE_PAR_DEFAUT)
    : 0;
  return (
    <article className={`mcard mcard--${module.color}${selected ? ' mcard--selected' : ''}`}
      data-state={noQuestion && !estModere ? 'no-question' : 'ready'}>
      <h2 className="mcard__name" data-bind="module.name">{module.name}</h2>
      <div className="mcard__caps">
        <span className="mcard__cap" data-bind="module.type">{t.label}</span>
        <span className="mcard__cap" data-bind="module.duration">{duree} s</span>
        <span className={`mcard__cap${noQuestion && !estModere ? ' mcard__cap--warn' : ''}`} data-bind="module.questionCount">
          {estModere
            ? `${nbGabarits} question${nbGabarits > 1 ? 's' : ''} modérée${nbGabarits > 1 ? 's' : ''}`
            : noQuestion ? 'Aucune question' : `${module.questions.length} question${module.questions.length > 1 ? 's' : ''}`}
        </span>
      </div>
      {estModere ? (
        /* « CACHE-CACHE » N'A PAS DE BANQUE ÉCRITE, ET POURTANT IL Y A À
           PRÉPARER. La carte disait « Aucune question — rien à préparer ici » :
           faux des deux côtés depuis la modération. Six énoncés et deux cents
           images se règlent dans cet éditeur ; la carte doit y conduire, pas en
           détourner. */
        <p className="mcard__note">Ses questions se tirent au sort. Énoncés, quotas et images se règlent ici.</p>
      ) : MODULE_TYPES[module.type]?.direct ? (
        /* UN JEU EN DIRECT N'EST PAS UN JEU VIDE. Sa question — deux mots — se
           tape à l'antenne, au moment de lancer. Lui reprocher son absence de
           questions serait un contresens. */
        <p className="mcard__note">Sa question se saisit en direct, au lancement. Rien à préparer ici.</p>
      ) : noQuestion ? (
        <p className="mcard__note">Ce module ne sera pas jouable tant qu'il n'a pas de question.</p>
      ) : null}
      <div className="mcard__actions">
        <button className="button button--block" type="button" data-action="studio:editModule" onClick={onEdit}>
          {/* UN SEUL MOT, TOUJOURS LE MÊME. « Éditer » ici, « Ajouter des
              questions » là : deux libellés pour le même bouton, selon un état
              que l'animateur ne contrôle pas. */}
          Modifier
        </button>
      </div>
    </article>
  );
}

// Cinq questions par manche — le nombre que le serveur tire, et le plafond des
// quotas que le Studio laisse régler.
const QUESTIONS_PAR_MANCHE = 5;

// NEUF CASES, CHAQUE COULEUR UNE OU DEUX FOIS. Quatre couleurs ne couvrent que
// huit cases ; dix n'en remplissent que dix. Ces bornes ne sont pas un réglage,
// c'est l'arithmétique de la grille — le serveur les tient aussi.
const COULEURS_MIN = 5;
const COULEURS_MAX = 9;

// UNE VIGNETTE POUR LES LIGNES SANS IMAGE. Pointer sur un fichier qui n'existe
// pas ferait une requête perdue par ligne et l'icône brisée du navigateur ; un
// pixel transparent laisse voir la plaque claire, et le champ du chemin dit le
// reste.
const VIGNETTE_VIDE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// ---------------------------------------------------------------------------
// E3 bis — LA MODÉRATION DE « CACHE-CACHE »
// ---------------------------------------------------------------------------
//
// CE QUI A ÉTÉ DEMANDÉ : « il faudrait que j'aie accès aux questions possibles
// [...] la question avec ses variables [...] le nombre d'apparitions minimum et
// maximum par manche » et « accès à la base de données des images [...] son Nom
// et sa Couleur [...] modifier les informations et ajouter de nouvelle ligne ».
//
// CE QU'ON PEUT MODÉRER, ET CE QU'ON NE PEUT PAS. On réécrit l'énoncé d'une
// question, on change ses quotas, on l'éteint, on en ajoute une variante ; on ne
// peut pas inventer une FORME. « Quelle est la couleur de… » et « derrière quel
// numéro… » ne diffèrent pas par leur texte mais par ce que le serveur calcule —
// la bonne réponse, la liste de choix, la case à dévoiler. Le Studio le dit.
//
// LES VARIABLES SONT DES BALISES, comme demandé : `{objet}`, `{case}`, `{objetA}`.
// Elles sont remplies au tirage. Chaque forme n'accepte que les siennes, et le
// serveur les annonce — l'écran ne les recopie pas.
function ModerationCache({ contenu, catalogue, onChange, moduleId, entetesHote, catalogueRate }) {
  const gabarits = contenu?.gabarits?.length ? contenu.gabarits : (catalogue?.gabarits || []);
  const objets = contenu?.objets?.length ? contenu.objets : (catalogue?.objets || []);
  const couleurs = catalogue?.couleurs || [];
  const variables = catalogue?.variables || {};
  // Le libellé vient du serveur, avec le nom de code en dernier recours : une
  // forme ajoutée sans libellé se voit, elle ne disparaît pas.
  const libelles = catalogue?.libelles || {};
  const nomDeForme = (f) => libelles[f] || f;
  const [voirImages, setVoirImages] = useState(false);
  // DEUX CENTS LIGNES SANS FILTRE NE SE MODÈRENT PAS. À deux cents rangées dans
  // une fenêtre de quatre cent vingt pixels, atteindre une image précise demande
  // plus de cent écrans de défilement : la capacité demandée existerait sans être
  // utilisable. Le filtre porte sur l'identifiant, le nom et la couleur.
  const [filtre, setFiltre] = useState('');
  // LA PALETTE NE COMPTE PAS LA COULEUR RÉSERVÉE. Les quarante images noires
  // servent le mode « Classique » et lui seul ; les compter comme une sixième
  // couleur ferait refuser la banque — neuf cases n'admettent que cinq à neuf
  // couleurs, et la question « laquelle n'est présente qu'une fois ? » exige
  // exactement cinq.
  const reservee = catalogue?.couleurReservee || 'Noir';
  const palette = [...new Set(objets.map((o) => o.couleur).filter((c) => c && c !== reservee))];
  const nbReservees = objets.filter((o) => o.couleur === reservee).length;
  // L'ÉTAT DU DERNIER DÉPÔT, et de lui seul : un envoi à la fois. Deux fichiers
  // convertis en parallèle sur un téléphone d'animateur, c'est deux canevas de
  // 512 × 512 et un écran figé — pour un gain nul, puisqu'on dépose une image
  // après l'autre de toute façon.
  const [depot, setDepot] = useState(null);   // { id, etat: 'envoi'|'ok'|'erreur', message, durable }

  const poser = (champ, valeur) => onChange({
    kind: 'contenu-cache',
    gabarits: champ === 'gabarits' ? valeur : gabarits,
    objets: champ === 'objets' ? valeur : objets,
  });

  const majGabarit = (i, patch) => poser('gabarits', gabarits.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  const majObjet = (i, patch) => poser('objets', objets.map((o, j) => (j === i ? { ...o, ...patch } : o)));

  // DÉPOSER UNE IMAGE SUR UNE LIGNE.
  //
  // L'IDENTIFIANT SE DÉDUIT DU NOM ET DE LA COULEUR, comme les deux cents icônes
  // du dépôt (`guitare-bleu`). C'est pour cela qu'on exige les deux AVANT le
  // fichier : sans eux l'image n'aurait pas de nom stable, et redéposer la même
  // paire accumulerait des copies orphelines au lieu de remplacer.
  const deposer = async (i, fichier) => {
    const o = objets[i];
    const id = identifiantDObjet(o.nom, o.couleur);
    if (!id) {
      setDepot({ id: o.id, etat: 'erreur', message: 'Renseigne le nom ET la couleur avant de déposer l\'image.' });
      return;
    }
    setDepot({ id: o.id, etat: 'envoi', message: 'Conversion…' });
    try {
      const { dataUrl, octets } = await preparerImage(fichier);
      const res = await fetch('/api/cache/image', {
        method: 'POST',
        // MÊME EN-TÊTE QUE LE RESTE DU STUDIO. Cette route est derrière
        // `requireHost` : sans lui, tout dépôt répond 403 en production.
        headers: await entetesHote(),
        body: JSON.stringify({ id, webp: dataUrl }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        // LES DEUX REFUS QUE L'ANIMATEUR PEUT CORRIGER LUI-MÊME, dits en clair.
        // Un code d'état seul l'enverrait chercher la cause du mauvais côté.
        if (res.status === 403) throw new Error("Ta session d'animateur a expiré. Reconnecte-toi, puis redépose.");
        if (res.status === 413) throw new Error('Image trop lourde pour le serveur. Choisis-en une plus petite.');
        throw new Error(detail.detail || detail.error || `refus du serveur (${res.status})`);
      }
      const recu = await res.json();
      majObjet(i, { id, src: recu.src });
      setDepot({
        id, etat: 'ok', durable: recu.durable,
        message: `Déposée — ${Math.round(octets / 1024)} ko. N'oublie pas « Enregistrer ».`,
      });
    } catch (err) {
      setDepot({ id: o.id, etat: 'erreur', message: err.message || 'Dépôt impossible.' });
    }
  };

  return (
    <>
      {/* UN PANNEAU VIDE NE DOIT JAMAIS PASSER POUR UN PANNEAU SANS CONTENU.
          Si le catalogue n'est pas arrivé, l'écran affiche zéro question et zéro
          image — exactement comme une banque qu'on aurait effacée. On le dit. */}
      {catalogueRate ? (
        <p className="save-state save-state--failed" role="alert" data-testid="cache-catalogue-rate">
          {catalogueRate}
        </p>
      ) : null}

      <div className="fgroup" data-testid="cache-gabarits">
        <span className="flabel">Questions possibles ({gabarits.length})</span>
        <p className="fhint">
          Les accolades sont des variables, remplies au tirage. Le minimum et le
          maximum comptent les apparitions dans une manche de cinq questions.
        </p>
        <div className="cmod">
          {gabarits.map((g, i) => (
            <div className="cmod__ligne" key={g.id}>
              <div className="cmod__tete">
                <span className="cmod__forme">{nomDeForme(g.forme)}</span>
                <span className="cmod__vars">{(variables[g.forme] || []).join(' ') || 'aucune variable'}</span>
                <label className="cmod__actif">
                  <input type="checkbox" checked={g.actif !== false}
                    onChange={(e) => majGabarit(i, { actif: e.target.checked })} />
                  <span>Active</span>
                </label>
              </div>
              <input className="input" type="text" value={g.gabarit}
                aria-label={`Énoncé de ${nomDeForme(g.forme)}`}
                onChange={(e) => majGabarit(i, { gabarit: e.target.value })} />
              <div className="cmod__quotas">
                <label className="cmod__quota">
                  <span className="flabel">Min</span>
                  <input className="input" type="number" min="0" max="5" value={g.min}
                    onChange={(e) => majGabarit(i, { min: Number(e.target.value) || 0 })} />
                </label>
                <label className="cmod__quota">
                  <span className="flabel">Max</span>
                  <input className="input" type="number" min="0" max="5" value={g.max}
                    onChange={(e) => majGabarit(i, { max: Number(e.target.value) || 0 })} />
                </label>
                <button className="qrow__btn qrow__btn--danger" type="button"
                  aria-label={`Supprimer la question ${i + 1}`}
                  onClick={() => poser('gabarits', gabarits.filter((_, j) => j !== i))}>
                  <I.trash s={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
        {/* AJOUTER UNE QUESTION, C'EST CHOISIR UNE FORME. Le reste — l'énoncé, les
            quotas — se règle ensuite, ligne par ligne. */}
        <div className="cmod__ajouts">
          {Object.keys(variables).map((forme) => (
            <button className="button button--quiet" key={forme} type="button"
              data-testid={`cache-ajouter-${forme}`}
              onClick={() => poser('gabarits', [...gabarits, {
                id: `g-${forme}-${Date.now().toString(36)}`,
                forme,
                gabarit: (catalogue?.gabarits || []).find((x) => x.forme === forme)?.gabarit || '',
                min: 0, max: 1, actif: true,
              }])}>
              <I.plus s={16} /> {nomDeForme(forme)}
            </button>
          ))}
        </div>
      </div>

      <div className="fgroup" data-testid="cache-objets">
        <span className="flabel">Base d'images ({objets.length})</span>
        <p className="fhint">
          Le nom et la couleur sont la matière des questions : les changer ici
          change ce que le jeu demande.
        </p>
        {/* LA PALETTE EST UN FAIT DE LA BANQUE, PAS UN RÉGLAGE. On l'affiche
            parce qu'elle commande deux règles du jeu — le nombre de couleurs
            admissibles, et la possibilité même de la question « quelle couleur
            n'est présente qu'une seule fois ? ». */}
        <p className="fhint" data-testid="cache-palette">
          Palette : {palette.length ? palette.join(' · ') : 'aucune'} ({palette.length}).
          {nbReservees ? ` Plus ${nbReservees} image${nbReservees > 1 ? 's' : ''} « ${reservee} », réservée${nbReservees > 1 ? 's' : ''} au mode Classique.` : ''}
          {palette.length === 5
            ? ' Cinq couleurs : la question « présente une seule fois » est posable.'
            : ` Neuf cases, chaque couleur une ou deux fois : il en faut de ${COULEURS_MIN} à ${COULEURS_MAX}.`}
        </p>
        <button className="button button--quiet" type="button" data-testid="cache-voir-images"
          onClick={() => setVoirImages((v) => !v)}>
          {voirImages ? 'Replier la base' : `Ouvrir la base (${objets.length} images)`}
        </button>
        {voirImages ? (
          <>
          <input className="input" type="text" value={filtre} aria-label="Filtrer la base d'images"
            placeholder="Filtrer par nom, couleur ou identifiant"
            onChange={(e) => setFiltre(e.target.value)} />
          <datalist id={`teintes-${moduleId}`}>
            {palette.map((c) => <option key={c} value={c} />)}
          </datalist>
          <div className="cmod cmod--images">
            {/* LE FILTRE CACHE DES LIGNES, IL N'EN SUPPRIME AUCUNE. L'indice `i`
                reste celui de la liste complète : une modification faite sur une
                ligne filtrée écrit au bon endroit. */}
            {objets.map((o, i) => [o, i]).filter(([o]) => {
              const q = filtre.trim().toLowerCase();
              if (!q) return true;
              return `${o.id} ${o.nom} ${o.couleur}`.toLowerCase().includes(q);
            }).map(([o, i]) => (
              <div className="cmod__objet" key={o.id}>
                <img className="cmod__vignette" src={o.src || VIGNETTE_VIDE} alt="" loading="lazy" />
                <div className="cmod__tete">
                  <span className="cmod__id" title={o.id}>{o.id}</span>
                  <button className="qrow__btn qrow__btn--danger" type="button"
                    aria-label={`Retirer ${o.id}`}
                    onClick={() => poser('objets', objets.filter((_, j) => j !== i))}>
                    <I.trash s={16} />
                  </button>
                </div>
                <input className="input" type="text" value={o.nom} aria-label={`Nom de ${o.id}`}
                  placeholder="Nom" onChange={(e) => majObjet(i, { nom: e.target.value })} />
                {/* CHAMP LIBRE, ET NON UNE LISTE FERMÉE. Une liste ne laisserait
                    que choisir parmi les couleurs existantes : impossible d'en
                    CODIFIER une nouvelle, ce qui est précisément ce qu'on demande
                    à une base modérable. La liste des couleurs déjà employées est
                    proposée en suggestion — on pioche ou on invente. */}
                <input className="input" type="text" value={o.couleur} list={`teintes-${moduleId}`}
                  aria-label={`Couleur de ${o.id}`} placeholder="Couleur"
                  onChange={(e) => majObjet(i, { couleur: e.target.value })} />
                {/* LE CHEMIN DE L'IMAGE EST VISIBLE ET MODIFIABLE, parce que le
                    Studio NE SAIT PAS envoyer un fichier : il n'y a pas de route
                    pour cela, et prétendre le contraire ferait ajouter des lignes
                    sans image que rien ne signalerait avant l'antenne. */}
                <input className="input input--mono" type="text" value={o.src || ''}
                  aria-label={`Image de ${o.id}`} placeholder="/objets/mon-image.webp"
                  onChange={(e) => majObjet(i, { src: e.target.value })} />
                {/* LE DÉPÔT DE FICHIER. Le champ natif est masqué et habillé : son
                    rendu par défaut change d'un navigateur à l'autre et n'accepte
                    ni la grille ni les jetons du système. */}
                <label className="cmod__depot">
                  <input type="file" accept="image/*" aria-label={`Déposer une image pour ${o.id}`}
                    onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) deposer(i, f); }} />
                  <I.plus s={14} />
                  <span>{o.src ? 'Remplacer l\'image' : 'Déposer une image'}</span>
                </label>
                {depot && depot.id === o.id ? (
                  <p className={`cmod__etat cmod__etat--${depot.etat}`} role="status">
                    {depot.message}
                    {depot.etat === 'ok' && depot.durable === false
                      // UN RANGEMENT QUI S'EFFACE NE DOIT PAS PASSER POUR UN RANGEMENT.
                      ? ' Attention : rangée sur le disque local, elle ne survivra pas à un redémarrage du serveur.'
                      : ''}
                  </p>
                ) : null}
              </div>
            ))}
            {objets.length && !objets.some((o) => `${o.id} ${o.nom} ${o.couleur}`.toLowerCase()
              .includes(filtre.trim().toLowerCase()))
              ? <p className="fhint">Aucune image ne correspond à ce filtre.</p> : null}
            <button className="qadd" type="button" data-testid="cache-ajouter-objet"
              onClick={() => poser('objets', [...objets, {
                id: `obj-${Date.now().toString(36)}`, nom: '', couleur: couleurs[0] || 'Bleu', src: '',
              }])}>
              <I.plus s={16} />
              <span>Ajouter une image</span>
            </button>
            <p className="fhint">
              Le fichier doit déjà être servi par le jeu. Le Studio règle le nom, la
              couleur et le chemin ; il n'envoie pas de fichier.
            </p>
          </div>
          </>
        ) : null}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// E3 — Panneau d'édition
// ---------------------------------------------------------------------------
function EditorPanel({
  module, editingQuestionId, invalidQids, saveState, validationErrors, confirmDelete,
  typeServeur, catalogueCache, catalogueRate, entetesHote,
  onArmDelete, onConfirmDelete, onPatchModule, onAddQuestion, onEditQuestion,
  onPatchQuestion, onRemoveQuestion, onSave, onClose,
}) {
  // La durée de jeu telle que le SERVEUR la déclare : fixe pour la plupart des
  // jeux (c'est une règle, pas un réglage), réglable pour les trois qui la lisent
  // vraiment — l'estimation, le vote et le lien.
  const dureeFixe = typeServeur?.dureeFixe ? typeServeur.dureeS : null;

  const saveLabel = saveState === 'saving' ? 'Enregistrement…'
    : saveState === 'invalid' ? `Enregistrer — ${validationErrors.length} point${validationErrors.length > 1 ? 's' : ''} à corriger`
    : 'Enregistrer';

  return (
    <aside className="editor" data-state={module.questions.length === 0 ? 'empty' : 'ready'} aria-label={`Édition du module ${module.name}`}>
      <div className="editor__head">
        <h2 className="editor__title">{module.name}</h2>
        <button className="qrow__btn" type="button" aria-label="Fermer l'éditeur" onClick={onClose}>
          <I.x s={16} />
        </button>
      </div>

      <div className="editor__body">
        <div className="fields">
          <div className="fgroup">
            <label className="flabel" htmlFor={`name-${module.id}`}>Nom</label>
            <input className="input" id={`name-${module.id}`} type="text" autoComplete="off"
              value={module.name} data-bind="module.name"
              onChange={(e) => onPatchModule({ name: e.target.value })} />
          </div>

          <div className="fgroup">
            <span className="flabel" id={`type-${module.id}`}>Type</span>
            <div className="seg" role="radiogroup" aria-labelledby={`type-${module.id}`} data-bind="module.type">
              {TYPE_KEYS.map((k) => (
                <button key={k} className="seg__btn" type="button" role="radio"
                  aria-checked={module.type === k} onClick={() => onPatchModule({ type: k })}>
                  {MODULE_TYPES[k].label}
                </button>
              ))}
            </div>
          </div>

          <div className="frow">
            <div className="fgroup fgroup--short">
              <label className="flabel" htmlFor={`dur-${module.id}`}>Durée</label>
              <span className="input-suffix">
                <input className="input" id={`dur-${module.id}`} type="number" inputMode="numeric" min="3"
                  value={dureeFixe || module.duration} data-bind="module.duration"
                  disabled={!!dureeFixe} data-testid={dureeFixe ? 'duree-fixe' : undefined}
                  onChange={(e) => onPatchModule({ duration: Number(e.target.value) || 0 })} />
                <span className="input-suffix__unit">s</span>
              </span>
              <p className="fhint">
                {dureeFixe
                  ? `Fixée à ${dureeFixe} s par les règles de ce jeu.`
                  : '3 s minimum.'}
              </p>
            </div>
            <div className="fgroup">
              <span className="flabel" id={`color-${module.id}`}>Couleur d'accent</span>
              <div className="swatches" role="radiogroup" aria-labelledby={`color-${module.id}`} data-bind="module.color">
                {COLOR_KEYS.map((c) => (
                  <button key={c} className={`swatch swatch--${c}`} type="button" role="radio"
                    aria-checked={module.color === c} aria-label={COLOR_LABEL[c]}
                    onClick={() => onPatchModule({ color: c })} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* « CACHE-CACHE » NE SE MODÈRE PAS COMME LES AUTRES. Sa banque n'est pas
            une liste de questions écrites d'avance : c'est un jeu de gabarits et
            une base d'images, dont le serveur tire cinq questions à chaque manche.
            L'écran suit cette réalité plutôt que de la travestir en liste. */}
        {module.type === 'cache_cache' ? (
          <ModerationCache contenu={module.contenuCache} catalogue={catalogueCache} moduleId={module.id}
            entetesHote={entetesHote} catalogueRate={catalogueRate}
            onChange={(contenuCache) => onPatchModule({ contenuCache })} />
        ) : (
        <div className="fgroup">
          <span className="flabel">Questions ({module.questions.length})</span>
          <div className="qlist">
            {module.questions.map((q, i) => (
              <QuestionRow key={q.id} index={i + 1} module={module} question={q} typeServeur={typeServeur}
                editing={editingQuestionId === q.id} invalid={invalidQids.has(q.id)}
                errors={validationErrors.filter((e) => e.qid === q.id)}
                onToggle={() => onEditQuestion(q.id)}
                onPatch={(patch) => onPatchQuestion(q.id, patch)}
                onRemove={() => onRemoveQuestion(q.id)} />
            ))}
            {module.questions.length === 0 ? (
              <p className="fhint">Aucune question. Ajoutes-en une pour démarrer la banque.</p>
            ) : null}
          </div>
          {!MODULE_TYPES[module.type]?.direct ? (
            <button className="qadd" type="button" data-action="studio:addQuestion" onClick={onAddQuestion}>
              <I.plus s={16} />
              <span>Ajouter une question</span>
            </button>
          ) : (
            <p className="fhint" data-testid="studio-jeu-direct">
              Ce jeu se prépare à l'antenne : l'animateur tape ses deux mots au moment
              de le lancer. Il n'y a pas de banque à remplir.
            </p>
          )}
        </div>
        )}

        {/* Suppression : confirmation en deux temps, comme sur la surface animateur. */}
        <div className="fgroup">
          {confirmDelete ? (
            <>
              <p className="save-state save-state--failed" role="alert">
                Supprimer « {module.name} » retirera ses {module.questions.length} question(s). Irréversible.
              </p>
              <div className="frow">
                <button className="button button--danger" type="button" onClick={onConfirmDelete}>
                  Oui, supprimer
                </button>
                <button className="button" type="button" onClick={onArmDelete}>Annuler</button>
              </div>
            </>
          ) : (
            <button className="button button--quiet" type="button" data-action="studio:deleteModule"
              onClick={onArmDelete}>
              <I.trash s={16} /> Supprimer ce module…
            </button>
          )}
        </div>
      </div>

      <div className="editor__foot">
        {saveState === 'saved' ? (
          <p className="save-state save-state--saved" role="status">
            <I.check s={16} dashed /> Enregistré — le jeu utilisera ces questions.
          </p>
        ) : null}
        {saveState === 'error' || saveState === 'local' || saveState === 'unauthorized' || saveState === 'nondurable' ? (
          <p className="save-state save-state--failed" role="alert" data-testid="save-failed">
            <I.alert s={18} />
            {/* Un refus d'AUTORISATION doit se distinguer d'une panne : c'est le
                cas qui bloquait tout en production, et le message générique
                envoyait chercher au mauvais endroit. */}
            {saveState === 'unauthorized'
              ? "Enregistrement refusé : connecte-toi d'abord au poste de pilotage (/host) avec ton compte animateur."
              : saveState === 'nondurable'
                ? "La base n'a pas accepté l'enregistrement : rien n'est conservé. Le serveur redémarré, tu ne retrouverais pas ces questions. Réessaie."
              : saveState === 'local'
                ? "Serveur injoignable — ta saisie est conservée localement. Réessaie."
                : "Enregistrement refusé — ta saisie est conservée localement. Réessaie."}
          </p>
        ) : null}
        {saveState === 'invalid' && validationErrors.length ? (
          <div className="save-state save-state--invalid" role="alert" data-bind="module.validation">
            <span><I.alert s={18} /> À corriger avant d'enregistrer :</span>
            <ul className="save-state__list">
              {validationErrors.map((e, i) => (
                <li className="save-state__item" key={i}>
                  {e.tag ? <strong>{e.tag} · </strong> : null}{e.msg}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <button className="button button--primary button--block button--lg" type="button"
          data-action="PUT /api/banks" onClick={onSave} disabled={saveState === 'saving'}
          aria-busy={saveState === 'saving' || undefined}>
          {saveLabel}
        </button>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// E4 — Ligne de question : repliée · nouvelle · invalide · dépliée
// ---------------------------------------------------------------------------
function QuestionRow({ index, module, question, editing, invalid, errors, typeServeur, onToggle, onPatch, onRemove }) {
  const isNew = !String(question.prompt || '').trim();
  const state = editing ? `expanded ${module.type}` : invalid ? 'invalid' : isNew ? 'new' : 'collapsed';
  return (
    <div>
      <div className={`qrow${editing ? ' qrow--open' : ''}${invalid ? ' qrow--invalid' : ''}`} data-state={state}>
        <span className="qrow__num">{index}</span>
        <span className={`qrow__text${isNew ? ' qrow__text--new' : ''}`}>
          {isNew ? 'Nouvelle question' : question.prompt}
        </span>
        <button className="qrow__btn" type="button" data-action="studio:toggleQuestion"
          aria-expanded={editing} aria-label={`${editing ? 'Replier' : 'Déplier'} la question ${index}`}
          onClick={onToggle}><I.chevron s={16} open={editing} /></button>
        <button className="qrow__btn qrow__btn--danger" type="button" data-action="studio:deleteQuestion"
          aria-label={`Supprimer la question ${index}`} onClick={onRemove}><I.trash s={16} /></button>
      </div>
      {invalid && !editing && errors.length ? (
        <p className="qerror" role="alert">{errors.map((e) => e.msg).join(' · ')}</p>
      ) : null}
      {editing ? (
        <div className="qform">
          <QuestionFields type={module.type} question={question} onPatch={onPatch} errors={errors}
            categories={typeServeur?.categories} defautCategorie={typeServeur?.categorieParDefaut} />
        </div>
      ) : null}
    </div>
  );
}

// Quatre formulaires, un par type de module.
function QuestionFields({ type, question, onPatch, errors, categories, defautCategorie }) {
  const err = (needle) => (errors || []).find((e) => e.msg.toLowerCase().includes(needle));
  const prompt = (
    <div className="fgroup">
      <label className="flabel">Énoncé</label>
      <input className={`input${err('énoncé') ? ' input--invalid' : ''}`} type="text"
        value={question.prompt || ''} placeholder="Rédige la question…"
        aria-invalid={err('énoncé') ? true : undefined}
        onChange={(e) => onPatch({ prompt: e.target.value })} />
    </div>
  );

  if (type === 'quiz') {
    const options = question.options || ['', '', '', ''];
    const badAnswer = err('bonne réponse');
    return (
      <>
        {prompt}
        <div className="fgroup">
          <span className="flabel">Options — coche la bonne réponse</span>
          <div className="qopts" role="radiogroup" aria-label="Bonne réponse">
            {options.map((opt, i) => (
              <span className="qopt" key={i}>
                <button className="qopt__radio" type="button" role="radio"
                  aria-checked={question.correct === i}
                  aria-label={`Option ${i + 1} est la bonne réponse`}
                  onClick={() => onPatch({ correct: i })}><I.check s={14} /></button>
                <input className="input" type="text" value={opt} placeholder={`Option ${i + 1}`}
                  aria-label={`Option ${i + 1}`}
                  onChange={(e) => { const next = options.slice(); next[i] = e.target.value; onPatch({ options: next }); }} />
              </span>
            ))}
          </div>
          {badAnswer ? <p className="qerror" role="alert">{badAnswer.msg}</p> : null}
        </div>
      </>
    );
  }

  if (type === 'true_false') {
    return (
      <>
        {prompt}
        <div className="fgroup">
          <span className="flabel">Réponse</span>
          <div className="qtiles" role="radiogroup" aria-label="Réponse">
            <button className="qtile" type="button" role="radio" aria-checked={question.answer === true}
              onClick={() => onPatch({ answer: true })}>Vrai</button>
            <button className="qtile" type="button" role="radio" aria-checked={question.answer === false}
              onClick={() => onPatch({ answer: false })}>Faux</button>
          </div>
        </div>
      </>
    );
  }

  if (type === 'estimation') {
    const bad = err('cible');
    return (
      <>
        {prompt}
        <div className="fgroup fgroup--short">
          <label className="flabel" htmlFor={`t-${question.id}`}>Cible</label>
          <input className={`input${bad ? ' input--invalid' : ''}`} id={`t-${question.id}`} type="number"
            inputMode="numeric" value={question.target ?? 0}
            aria-invalid={bad ? true : undefined} aria-describedby={bad ? `te-${question.id}` : undefined}
            onChange={(e) => onPatch({ target: Number(e.target.value) || 0 })} />
          {bad ? <p className="qerror" id={`te-${question.id}`} role="alert">{bad.msg}</p> : null}
          <p className="fhint">L'unité va dans l'énoncé.</p>
        </div>
        {/* LA NATURE DE LA RÉPONSE (chantier v4, décisions 5.7 à 5.9).
            Un pourcentage n'a aucun sens sur une année : 2 % de 1789 valent
            TRENTE-SIX ANS, si bien que répondre 1753 tombait « dans le mille ».
            Les années ont donc leurs propres plages, en écart absolu.
            Elle est DÉCLARÉE et jamais devinée de la valeur : 1789 peut être un
            nombre d'habitants. Sans déclaration, on reste en plages relatives —
            le comportement d'aujourd'hui, donc aucune migration. */}
        <div className="fgroup fgroup--short">
          <span className="flabel" id={`nat-${question.id}`}>Nature de la réponse</span>
          <div className="seg" role="radiogroup" aria-labelledby={`nat-${question.id}`}>
            <button type="button" role="radio" data-action="question:nature"
              className="seg__btn" aria-checked={question.nature !== 'annee'}
              onClick={() => onPatch({ nature: 'nombre' })}>Nombre</button>
            <button type="button" role="radio" data-action="question:nature"
              className="seg__btn" aria-checked={question.nature === 'annee'}
              onClick={() => onPatch({ nature: 'annee' })}>Année</button>
          </div>
          <p className="fhint">
            {question.nature === 'annee'
              ? 'Plages en années : exact, ±2, ±5, ±10.'
              : 'Plages en pourcentage de la cible : 2 %, 10 %, 20 %, 30 %.'}
          </p>
        </div>
      </>
    );
  }

  // vote
  const options = question.options || ['', ''];
  return (
    <>
      {/* JEU ou SONDAGE, question par question (action 18). Un vote noté n'est
          plus un sondage : le joueur ne répond plus ce qu'il pense mais ce qu'il
          croit que les autres vont répondre. L'interrupteur garde les deux
          usages — demander sincèrement à la salle, ou en faire un pari. */}
      {/* LA CATÉGORIE (15/09). Elle ne change RIEN aux règles — l'auteur le
          précise — elle range. L'écran de l'animateur en fait des onglets, et
          « Question suivante » pioche dans celui qu'il a ouvert.
          LES CATÉGORIES VIENNENT DU SERVEUR : les recopier ici ferait proposer un
          jour une catégorie que la file ne saurait pas ranger. */}
      {categories?.length ? (
        <div className="fgroup">
          <span className="flabel" id={`cat-${question.id}`}>Catégorie</span>
          <div className="qtiles" role="radiogroup" aria-labelledby={`cat-${question.id}`}>
            {categories.map((c) => (
              <button key={c.cle} className="qtile" type="button" role="radio"
                data-testid={`vote-cat-${c.cle}`}
                aria-checked={(question.categorie || defautCategorie) === c.cle}
                onClick={() => onPatch({ categorie: c.cle })}>{c.nom}</button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="fgroup">
        <span className="flabel">Ce vote</span>
        <div className="qtiles" role="radiogroup" aria-label="Nature du vote">
          <button className="qtile" type="button" role="radio" aria-checked={!question.poll}
            onClick={() => onPatch({ poll: false })}>Rapporte des points</button>
          <button className="qtile" type="button" role="radio" aria-checked={!!question.poll}
            onClick={() => onPatch({ poll: true })}>Sondage sans points</button>
        </div>
        <p className="fhint">
          {question.poll
            ? "Personne ne gagne : chacun répond ce qu'il pense vraiment."
            : 'La majorité gagne. En cas d\'égalité, les deux camps gagnent.'}
        </p>
      </div>
      {prompt}
      <div className="fgroup">
        <span className="flabel">Choix proposés</span>
        <div className="qopts">
          {options.map((opt, i) => (
            <span className="qopt" key={i}>
              <input className="input" type="text" value={opt} placeholder={`Choix ${i + 1}`}
                aria-label={`Choix ${i + 1}`}
                onChange={(e) => { const next = options.slice(); next[i] = e.target.value; onPatch({ options: next }); }} />
              <button className="qrow__btn qrow__btn--danger" type="button"
                aria-label={`Retirer le choix ${i + 1}`}
                onClick={() => onPatch({ options: options.filter((_, j) => j !== i) })}><I.x s={14} /></button>
            </span>
          ))}
        </div>
        <button className="qadd" type="button" style={{ marginTop: 'var(--sp-2)' }}
          onClick={() => onPatch({ options: [...options, ''] })}><I.plus s={16} /> Ajouter un choix</button>
      </div>
    </>
  );
}
