// Surface STUDIO — éditeur de questionnaires, hors antenne.
// Design : extraction Claude Design — E1 navigation, E2 grille de modules,
// E3 panneau d'édition, E4 questions et leurs quatre formulaires.
//
// Densité de saisie assumée, aucun effet : la seule animation du studio est le
// chatoiement des squelettes de chargement. Les banques restent la source de
// vérité du jeu — ce qu'on enregistre ici est ce que le moteur jouera.
import React, { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '../shared/supabaseClient.js';
import './studio.css';

// --- Référentiel des 4 types de module (icône + variante couleur du mockup) ---
const MODULE_TYPES = {
  quiz:       { label: 'Quiz',       subtitle: 'Choix multiple',   icon: 'help-circle',  color: 'fire' },
  true_false: { label: 'Vrai/Faux',  subtitle: 'Binaire',          icon: 'check-square', color: 'forest' },
  estimation: { label: 'Estimation', subtitle: 'Réponse chiffrée', icon: 'target',       color: 'flame' },
  vote:       { label: 'Vote',       subtitle: 'Sondage groupe',   icon: 'bar-chart-2',  color: 'info' },
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
  if (type === 'estimation') return { ...base, target: Number(q.target) || 0 };
  return { ...base, options: q.options || ['', ''] }; // vote
}

function studioToServerQuestion(type, q, durationSec) {
  const base = { id: String(q.id), text: q.prompt || '', durationSec: durationSec || undefined };
  if (type === 'quiz') return { ...base, options: q.options || [], correctIndex: Number(q.correct) || 0 };
  if (type === 'true_false') return { ...base, correct: !!q.answer };
  if (type === 'estimation') return { ...base, target: Number(q.target) || 0 };
  return { ...base, options: q.options || [] }; // vote
}

function banksToModules(banks) {
  const out = [];
  for (const type of TYPE_KEYS) {
    const bank = Array.isArray(banks[type]) ? banks[type] : [];
    if (!bank.length) continue;
    const durations = bank.map((q) => Number(q.durationSec)).filter((n) => Number.isFinite(n) && n > 0);
    out.push({
      id: uid('m'),
      type,
      name: MODULE_TYPES[type].label,
      duration: durations.length ? durations[0] : (type === 'true_false' ? 12 : 20),
      color: MODULE_TYPES[type].color,
      questions: bank.map((q) => serverToStudioQuestion(type, q)),
    });
  }
  return out;
}

function modulesToBanks(modules) {
  const banks = Object.fromEntries(TYPE_KEYS.map((t) => [t, []]));
  for (const m of modules) {
    if (!TYPE_KEYS.includes(m.type)) continue;
    for (const q of m.questions) {
      if (!(q.prompt || '').trim()) continue; // pas d'énoncé = pas envoyée
      banks[m.type].push(studioToServerQuestion(m.type, q, m.duration));
    }
  }
  return banks;
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
  const [authed, setAuthed] = useState(null);
  const [saveState, setSaveState] = useState('idle'); // idle|saving|saved|local|error|invalid
  const [validationErrors, setValidationErrors] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null);
  // Tant que le chargement distant n'est pas tranché : squelettes, jamais des
  // modules de démo qui « sautent » vers les vrais.
  const [remoteLoading, setRemoteLoading] = useState(() => !!getSupabase());

  const sb = useMemo(() => getSupabase(), []);

  useEffect(() => {
    if (!sb) {
      setAuthed(false);
      // Repli serveur local : les banques disque sont la source de vérité du jeu.
      let alive = true;
      (async () => {
        try {
          const res = await fetch('/api/banks');
          if (!alive || !res.ok) return;
          const mapped = banksToModules(await res.json());
          if (mapped.length) { setModules(mapped); setMode('server'); }
        } catch { /* dev Vite pur sans serveur : on garde le seed local */ }
        finally { if (alive) setRemoteLoading(false); }
      })();
      return () => { alive = false; };
    }
    let alive = true;
    // Plafond de 4 s : Supabase lent ou injoignable ne bloque pas l'éditeur.
    const cap = setTimeout(() => { if (alive) setRemoteLoading(false); }, 4000);
    (async () => {
      try {
        const { data: sess } = await sb.auth.getSession();
        if (alive) setAuthed(!!sess?.session);
        const { data, error } = await sb.from('modules').select();
        if (alive && !error && Array.isArray(data) && data.length > 0) {
          const mapped = data.map(normalizeModule).filter(Boolean);
          if (mapped.length) { setModules(mapped); setMode('supabase'); }
        }
      } catch { /* silencieux : on garde l'état local */ }
      finally { clearTimeout(cap); if (alive) setRemoteLoading(false); }
    })();
    const { data: authSub } = sb.auth.onAuthStateChange((_e, s) => { if (alive) setAuthed(!!s); });
    return () => { alive = false; authSub?.subscription?.unsubscribe?.(); };
  }, [sb]);

  const selected = modules.find((m) => m.id === selectedId) || null;

  const patchModule = (id, patch) => {
    setSaveState('idle');
    setValidationErrors([]);
    setModules((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const addModule = () => {
    const m = { id: uid('m'), type: 'quiz', name: 'Nouveau module', duration: 20, color: 'fire', questions: [] };
    setModules((prev) => [...prev, m]);
    setSelectedId(m.id);
    setEditingQuestionId(null);
  };

  const removeModule = (id) => {
    setModules((prev) => prev.filter((m) => m.id !== id));
    if (selectedId === id) { setSelectedId(null); setEditingQuestionId(null); }
    if (sb) { sb.from('modules').delete().eq('id', id).then(() => {}, () => {}); }
    setConfirmDelete(null);
  };

  const selectModule = (id) => { setSelectedId(id); setEditingQuestionId(null); setConfirmDelete(null); };

  // Validation avant enregistrement : un module invalide serait silencieusement
  // filtré en jeu — on préfère le dire AVANT la sauvegarde, question par question.
  const validateModule = (m) => {
    const problems = [];
    if (!String(m.name || '').trim()) problems.push({ qid: null, tag: null, msg: 'Donne un nom au module.' });
    if (!Number.isFinite(m.duration) || m.duration < 3) problems.push({ qid: null, tag: null, msg: 'Durée minimale : 3 secondes.' });
    if (!m.questions.length) problems.push({ qid: null, tag: null, msg: 'Ajoute au moins une question.' });
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
    return problems;
  };

  const saveModule = async () => {
    const m = selected;
    if (!m) return;
    const problems = validateModule(m);
    setValidationErrors(problems);
    if (problems.length) { setSaveState('invalid'); return; }
    if (!sb || authed === false) {
      setSaveState('saving');
      try {
        const res = await fetch('/api/banks', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(modulesToBanks(modules)),
        });
        if (!res.ok) throw new Error('save-failed');
        setMode('server');
        setSaveState('saved');
        setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 2000);
      } catch { setSaveState('local'); }
      return;
    }
    setSaveState('saving');
    try {
      const { error } = await sb.from('modules').upsert({
        id: m.id, type: m.type, name: m.name, duration: m.duration, color: m.color, questions: m.questions,
      });
      if (error) { setSaveState('error'); return; }
      setMode('supabase');
      setSaveState('saved');
      setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 2000);
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
        onSelect={selectModule} onAdd={addModule} />

      <main className="work" data-state={modules.length === 0 ? 'empty' : 'ready'} aria-label="Gestion des modules">
        <div className="work__head">
          <div>
            <h1 className="work__title">Questionnaires</h1>
            <p className="work__sub">Assemble les modules qui rythment tes soirées.</p>
          </div>
          <button className="button button--primary" type="button" data-action="studio:createModule"
            onClick={addModule}><I.plus s={16} /> Nouveau module</button>
        </div>

        {remoteLoading ? (
          <div className="grid" aria-hidden="true">
            {[0, 1, 2].map((i) => <div className="skeleton" key={i} style={{ height: '180px' }} />)}
          </div>
        ) : modules.length === 0 ? (
          <div className="empty-state">
            <span style={{ color: 'var(--c-ink-3)' }} aria-hidden="true"><I.flame s={30} /></span>
            <h2 className="work__title">Aucun module</h2>
            <p className="work__sub">Crée ton premier questionnaire pour démarrer une partie.</p>
            <button className="button button--primary" type="button" onClick={addModule}>
              <I.plus s={16} /> Nouveau module
            </button>
          </div>
        ) : (
          <section className="grid" aria-label="Liste des modules">
            {modules.map((m) => (
              <ModuleCard key={m.id} module={m} selected={m.id === selectedId}
                onSelect={() => selectModule(m.id)} onEdit={() => selectModule(m.id)} />
            ))}
          </section>
        )}
      </main>

      {selected ? (
        <EditorPanel
          module={selected}
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

      <button className="button button--primary button--block" type="button" style={{ marginTop: 'auto' }}
        data-action="studio:createModule" onClick={onAdd}><I.plus s={16} /> Nouveau module</button>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// E2 — Carte de module
// ---------------------------------------------------------------------------
function ModuleCard({ module, selected, onEdit }) {
  const t = MODULE_TYPES[module.type] || MODULE_TYPES.quiz;
  const noQuestion = module.questions.length === 0;
  return (
    <article className={`mcard mcard--${module.color}${selected ? ' mcard--selected' : ''}`}
      data-state={noQuestion ? 'no-question' : 'ready'}>
      <h2 className="mcard__name" data-bind="module.name">{module.name}</h2>
      <div className="mcard__caps">
        <span className="mcard__cap" data-bind="module.type">{t.label}</span>
        <span className="mcard__cap" data-bind="module.duration">{module.duration} s</span>
        <span className={`mcard__cap${noQuestion ? ' mcard__cap--warn' : ''}`} data-bind="module.questionCount">
          {noQuestion ? 'Aucune question' : `${module.questions.length} question${module.questions.length > 1 ? 's' : ''}`}
        </span>
      </div>
      {noQuestion ? (
        <p className="mcard__note">Ce module ne sera pas jouable tant qu'il n'a pas de question.</p>
      ) : null}
      <div className="mcard__actions">
        <button className="button button--block" type="button" data-action="studio:editModule" onClick={onEdit}>
          {noQuestion ? 'Ajouter des questions' : 'Éditer'}
        </button>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// E3 — Panneau d'édition
// ---------------------------------------------------------------------------
function EditorPanel({
  module, editingQuestionId, invalidQids, saveState, validationErrors, confirmDelete,
  onArmDelete, onConfirmDelete, onPatchModule, onAddQuestion, onEditQuestion,
  onPatchQuestion, onRemoveQuestion, onSave, onClose,
}) {
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
                  value={module.duration} data-bind="module.duration"
                  onChange={(e) => onPatchModule({ duration: Number(e.target.value) || 0 })} />
                <span className="input-suffix__unit">s</span>
              </span>
              <p className="fhint">3 s minimum.</p>
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

        <div className="fgroup">
          <span className="flabel">Questions ({module.questions.length})</span>
          <div className="qlist">
            {module.questions.map((q, i) => (
              <QuestionRow key={q.id} index={i + 1} module={module} question={q}
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
          <button className="qadd" type="button" data-action="studio:addQuestion" onClick={onAddQuestion}
            style={{ marginTop: 'var(--sp-2)' }}><I.plus s={16} /> Ajouter une question</button>
        </div>

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
        {saveState === 'error' || saveState === 'local' ? (
          <p className="save-state save-state--failed" role="alert">
            <I.alert s={18} />
            {saveState === 'local'
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
function QuestionRow({ index, module, question, editing, invalid, errors, onToggle, onPatch, onRemove }) {
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
          <QuestionFields type={module.type} question={question} onPatch={onPatch} errors={errors} />
        </div>
      ) : null}
    </div>
  );
}

// Quatre formulaires, un par type de module.
function QuestionFields({ type, question, onPatch, errors }) {
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
      </>
    );
  }

  // vote
  const options = question.options || ['', ''];
  return (
    <>
      <p className="qnote">Pas de bonne réponse : un vote choisit la suite de la soirée.</p>
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
