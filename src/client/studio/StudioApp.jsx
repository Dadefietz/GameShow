// Studio — surface admin de gestion de contenu (modules & questions).
// Structure et classes BEM portées 1:1 depuis design/mockups/studio-modules.html.
// CRUD 100% fonctionnel en état local ; Supabase best-effort (jamais bloquant).
import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../shared/icons.jsx';
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

export function StudioApp() {
  const [modules, setModules] = useState(seedModules);
  const [selectedId, setSelectedId] = useState(null);
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [mode, setMode] = useState('local'); // 'local' | 'supabase'
  const [authed, setAuthed] = useState(null); // null=inconnu, true/false
  const [saveState, setSaveState] = useState('idle'); // idle|saving|saved|local|error
  // Tant que le chargement distant n'est pas tranché, on n'affiche RIEN de rémanent :
  // squelettes de chargement, jamais les modules de démo qui « sautent » vers les vrais.
  const [remoteLoading, setRemoteLoading] = useState(() => !!getSupabase());

  const sb = useMemo(() => getSupabase(), []);

  // Détection de session + chargement Supabase best-effort au montage.
  useEffect(() => {
    if (!sb) { setAuthed(false); setRemoteLoading(false); return; }
    let alive = true;
    // Plafond de 4 s : si Supabase est lent ou injoignable, on bascule sur le
    // contenu local plutôt que de laisser des squelettes indéfiniment.
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
      } catch {
        /* silencieux : on garde l'état local */
      } finally {
        clearTimeout(cap);
        if (alive) setRemoteLoading(false);
      }
    })();
    const { data: authSub } = sb.auth.onAuthStateChange((_e, s) => { if (alive) setAuthed(!!s); });
    return () => { alive = false; authSub?.subscription?.unsubscribe?.(); };
  }, [sb]);

  const selected = modules.find((m) => m.id === selectedId) || null;

  // --- Mutations modules (réactives) ---
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
    // Suppression en base (best-effort, RLS restreint à l'animateur connecté).
    if (sb) { sb.from('modules').delete().eq('id', id).then(() => {}, () => {}); }
  };

  const selectModule = (id) => { setSelectedId(id); setEditingQuestionId(null); };

  // E2 — Validation avant enregistrement (pattern Podia : « at least one right answer »).
  // Renvoie la liste des problèmes ; un module invalide serait silencieusement
  // filtré en jeu (isUsable serveur) — on préfère le dire AVANT la sauvegarde.
  const validateModule = (m) => {
    const problems = [];
    if (!String(m.name || '').trim()) problems.push({ qid: null, msg: 'Donne un nom au module.' });
    if (!Number.isFinite(m.duration) || m.duration < 3) problems.push({ qid: null, msg: 'Durée minimale : 3 secondes.' });
    if (!m.questions.length) problems.push({ qid: null, msg: 'Ajoute au moins une question.' });
    m.questions.forEach((q, i) => {
      const label = `Question ${i + 1}`;
      if (!String(q.prompt || '').trim()) problems.push({ qid: q.id, msg: `${label} : l'énoncé est vide.` });
      if (m.type === 'quiz' || m.type === 'vote') {
        const opts = (q.options || []).map((o) => String(o || '').trim());
        const filled = opts.filter(Boolean).length;
        if (filled < 2) problems.push({ qid: q.id, msg: `${label} : il faut au moins 2 options remplies.` });
        if (m.type === 'quiz') {
          const c = q.correct;
          if (!Number.isInteger(c) || !opts[c]) problems.push({ qid: q.id, msg: `${label} : coche une bonne réponse (option non vide).` });
        }
      }
      if (m.type === 'estimation' && !Number.isFinite(Number(q.target))) {
        problems.push({ qid: q.id, msg: `${label} : la cible doit être un nombre.` });
      }
    });
    return problems;
  };

  const [validationErrors, setValidationErrors] = useState([]);

  // Enregistrer : upsert vers Supabase (owner_id auto = auth.uid() via défaut DB).
  // Retour de statut clair (saved / local / error) — plus d'échec silencieux.
  const saveModule = async (m) => {
    if (!m) return;
    const problems = validateModule(m);
    setValidationErrors(problems);
    if (problems.length) { setSaveState('invalid'); return; }
    if (!sb || authed === false) { setSaveState('local'); return; }
    setSaveState('saving');
    try {
      const { error } = await sb.from('modules').upsert({
        id: m.id, type: m.type, name: m.name, duration: m.duration, color: m.color, questions: m.questions,
      });
      if (error) { setSaveState('error'); return; }
      setMode('supabase');
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  };

  // --- Mutations questions (réactives) ---
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

  return (
    <div className="studio">
      <Sidebar
        modules={modules}
        selectedId={selectedId}
        mode={mode}
        loading={remoteLoading}
        onSelect={selectModule}
        onAdd={addModule}
      />

      <main className={`main${selected ? '' : ' main--single'}`} aria-label="Gestion des modules">
        <div className="workspace">
          <div className="page-head">
            <div>
              <h1 className="page-head__title">Modules</h1>
              <p className="page-head__sub">Assemblez les mini-jeux qui rythment vos soirées.</p>
            </div>
            <button className="button button--primary" type="button" onClick={addModule}>
              <Icon name="plus" className="icon icon--sm" />
              Nouveau module
            </button>
          </div>

          {!remoteLoading && authed === false && (
            <div className="studio-banner" role="status">
              <Icon name="log-in" className="icon icon--sm" />
              <span className="studio-banner__text">Non connecté : tes modifications restent <strong>locales</strong>. Connecte-toi pour enregistrer tes questionnaires en ligne (ça s'ouvre dans un nouvel onglet — ton travail ici est conservé).</span>
              <a className="studio-banner__cta" href="/host" target="_blank" rel="noopener">
                <Icon name="log-in" className="icon icon--sm" />
                Se connecter
              </a>
            </div>
          )}

          <section className="module-grid" aria-label="Liste des modules">
            {remoteLoading ? (
              <>
                <div className="skeleton-card" aria-hidden="true" />
                <div className="skeleton-card" aria-hidden="true" />
                <div className="skeleton-card" aria-hidden="true" />
                <div className="skeleton-card" aria-hidden="true" />
              </>
            ) : modules.map((m) => (
              <ModuleCard
                key={m.id}
                module={m}
                selected={m.id === selectedId}
                onSelect={() => selectModule(m.id)}
                onDelete={() => removeModule(m.id)}
              />
            ))}
          </section>
        </div>

        {selected && (
          <EditorPanel
            module={selected}
            editingQuestionId={editingQuestionId}
            onPatchModule={(patch) => patchModule(selected.id, patch)}
            onAddQuestion={() => addQuestion(selected)}
            onEditQuestion={(qid) => setEditingQuestionId(qid === editingQuestionId ? null : qid)}
            onPatchQuestion={(qid, patch) => patchQuestion(selected.id, qid, patch)}
            onRemoveQuestion={(qid) => removeQuestion(selected.id, qid)}
            onDeleteModule={() => removeModule(selected.id)}
            onSave={() => saveModule(selected)}
            onClose={() => selectModule(null)}
            saveState={saveState}
            validationErrors={validationErrors}
          />
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
function Sidebar({ modules, selectedId, mode, loading, onSelect, onAdd }) {
  return (
    <nav className="sidebar" aria-label="Navigation du studio">
      <div className="sidebar__brand">
        <span className="sidebar__brand-mark" aria-hidden="true">
          <Icon name="flame" className="icon icon--sm" />
        </span>
        <span>
          <span className="sidebar__brand-name">Project Game Show</span><br />
          <span className="sidebar__brand-sub">Studio</span>
        </span>
      </div>

      {/* Principe de navigation : le Studio n'est jamais un cul-de-sac. */}
      <a className="sidebar__back" href="/host">
        <Icon name="arrow-right" className="icon icon--sm sidebar__back-arrow" />
        Retour au plateau
      </a>

      <div className="nav" role="list">
        <span className="nav__label">Modules</span>
        {loading ? (
          <>
            <span className="skeleton-row" aria-hidden="true" />
            <span className="skeleton-row" aria-hidden="true" />
            <span className="skeleton-row" aria-hidden="true" />
          </>
        ) : null}
        {!loading && modules.map((m) => {
          const t = MODULE_TYPES[m.type];
          const active = m.id === selectedId;
          return (
            <button
              key={m.id}
              type="button"
              className={`nav__item${active ? ' nav__item--active' : ''}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => onSelect(m.id)}
            >
              <span className="nav__item-icon" aria-hidden="true">
                <Icon name={t.icon} className="icon icon--sm" />
              </span>
              {m.name}
            </button>
          );
        })}
        <button type="button" className="nav__item" onClick={onAdd}>
          <span className="nav__item-icon" aria-hidden="true">
            <Icon name="plus" className="icon icon--sm" />
          </span>
          Nouveau module
        </button>
      </div>

      <span className="nav__spacer" />
      <span className="meta">
        <span className="meta__value">{loading ? 'Connexion…' : (mode === 'supabase' ? 'Supabase' : 'Mode local')}</span>
        <span className="meta__label">{loading ? 'Synchronisation' : `Contenu ${mode === 'supabase' ? 'synchronisé' : 'hors ligne'}`}</span>
      </span>
    </nav>
  );
}

// ---------------------------------------------------------------------------
function ModuleCard({ module, selected, onSelect, onDelete }) {
  const t = MODULE_TYPES[module.type];
  return (
    <article
      className={`module-card module-card--${module.color}${selected ? ' module-card--selected' : ''}`}
      onClick={onSelect}
    >
      <div className="module-card__head">
        <span className="module-card__icon" aria-hidden="true">
          <Icon name={t.icon} className="icon icon--sm" />
        </span>
        <span className="module-card__titles">
          <span className="module-card__name">{module.name}</span>
          <span className="module-card__type">{t.subtitle}</span>
        </span>
      </div>
      <div className="module-card__meta">
        <span className="meta"><span className="meta__value">{module.duration} s</span><span className="meta__label">Durée</span></span>
        <span className="meta"><span className="meta__value">{module.questions.length}</span><span className="meta__label">Questions</span></span>
      </div>
      <div className="module-card__actions">
        <button className="icon-button" type="button" onClick={(e) => { e.stopPropagation(); onSelect(); }}>
          <Icon name="pencil" className="icon icon--sm" />
          Éditer
        </button>
        <button className="icon-button icon-button--danger" type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
          <Icon name="x" className="icon icon--sm" />
          Supprimer
        </button>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
const SAVE_STATUS = {
  saving: { text: 'Enregistrement…', cls: '' },
  saved: { text: 'Enregistré en ligne ✓', cls: 'save-status--ok' },
  local: { text: 'Enregistré localement — connecte-toi côté animateur pour synchroniser', cls: 'save-status--warn' },
  error: { text: "Échec de l'enregistrement, réessaie", cls: 'save-status--err' },
  invalid: { text: 'Corrige les points ci-dessous avant d’enregistrer :', cls: 'save-status--err' },
};

function EditorPanel({
  module, editingQuestionId, onPatchModule, onAddQuestion, onEditQuestion,
  onPatchQuestion, onRemoveQuestion, onDeleteModule, onSave, onClose, saveState,
  validationErrors = [],
}) {
  const t = MODULE_TYPES[module.type];
  const status = saveState && saveState !== 'idle' ? SAVE_STATUS[saveState] : null;
  const invalidIds = new Set(validationErrors.map((p) => p.qid).filter(Boolean));
  return (
    <aside className="editor" aria-label="Édition du module">
      <div className="editor__head">
        <h2 className="editor__title">Éditer « {module.name} »</h2>
        <span className="editor__badge">
          <Icon name={t.icon} className="icon icon--sm" />
          {t.label}
        </span>
      </div>

      <form className="form" aria-label={`Paramètres du module ${module.name}`} onSubmit={(e) => { e.preventDefault(); onSave(); }}>
        <div className="field">
          <label className="field__label" htmlFor={`name-${module.id}`}>Nom</label>
          <input
            className="input" id={`name-${module.id}`} type="text" autoComplete="off"
            value={module.name} onChange={(e) => onPatchModule({ name: e.target.value })}
          />
        </div>

        <div className="field__row">
          <div className="field">
            <label className="field__label" htmlFor={`type-${module.id}`}>Type</label>
            <span className="select-field">
              <select
                className="select" id={`type-${module.id}`}
                value={module.type} onChange={(e) => onPatchModule({ type: e.target.value })}
              >
                {TYPE_KEYS.map((k) => (
                  <option key={k} value={k}>{MODULE_TYPES[k].label}</option>
                ))}
              </select>
              <span className="select-field__caret" aria-hidden="true">
                <Icon name="chevron-right" className="icon icon--sm" />
              </span>
            </span>
          </div>
          <div className="field">
            <label className="field__label" htmlFor={`dur-${module.id}`}>Durée (s)</label>
            <input
              className="input" id={`dur-${module.id}`} type="number" inputMode="numeric" min="1"
              value={module.duration}
              onChange={(e) => onPatchModule({ duration: Number(e.target.value) || 0 })}
            />
          </div>
        </div>

        <div className="field">
          <span className="field__label" id={`color-${module.id}`}>Couleur d'accent</span>
          <div className="swatches" role="radiogroup" aria-labelledby={`color-${module.id}`}>
            {COLOR_KEYS.map((c) => {
              const sel = module.color === c;
              return (
                <button
                  key={c} type="button" role="radio" aria-checked={sel} aria-label={COLOR_LABEL[c]}
                  className={`swatch swatch--${c}${sel ? ' swatch--selected' : ''}`}
                  onClick={() => onPatchModule({ color: c })}
                >
                  <Icon name="check" className="swatch__check icon icon--sm" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="field">
          <span className="field__label">Questions ({module.questions.length})</span>
          <div className="questions">
            {module.questions.map((q, i) => (
              <QuestionRow
                key={q.id}
                index={i + 1}
                module={module}
                question={q}
                editing={editingQuestionId === q.id}
                invalid={invalidIds.has(q.id)}
                onToggle={() => onEditQuestion(q.id)}
                onPatch={(patch) => onPatchQuestion(q.id, patch)}
                onRemove={() => onRemoveQuestion(q.id)}
              />
            ))}
            {module.questions.length === 0 && (
              /* E3 — empty state ACTIF : le message porte l'action. */
              <div className="editor-empty">
                <p className="editor-empty__text">Aucune question pour l'instant — c'est ici que ta banque démarre.</p>
                <button className="button button--primary" type="button" onClick={onAddQuestion}>
                  <Icon name="plus" className="icon icon--sm" />
                  Ajouter une question
                </button>
              </div>
            )}
          </div>
          {module.questions.length > 0 && (
            <button className="question-add" type="button" onClick={onAddQuestion}>
              <Icon name="plus" className="icon icon--sm" />
              Ajouter une question
            </button>
          )}
        </div>

        <div className="editor__footer">
          <button className="button button--primary" type="submit">
            <Icon name="save" className="icon icon--sm" />
            Enregistrer
          </button>
          <button className="button button--danger" type="button" onClick={onDeleteModule}>
            <Icon name="x" className="icon icon--sm" />
            Supprimer
          </button>
          <button className="button button--ghost" type="button" onClick={onClose}>Fermer</button>
          {status ? <p className={`save-status ${status.cls}`} role="status">{status.text}</p> : null}
          {saveState === 'invalid' && validationErrors.length > 0 ? (
            <ul className="validation-list" role="alert">
              {validationErrors.map((p, i) => <li className="validation-list__item" key={i}>{p.msg}</li>)}
            </ul>
          ) : null}
        </div>
      </form>
    </aside>
  );
}

// ---------------------------------------------------------------------------
function QuestionRow({ index, module, question, editing, invalid, onToggle, onPatch, onRemove }) {
  return (
    <div className={`question${editing ? ' question--editing' : ''}${invalid ? ' question--invalid' : ''}`}>
      <span className="question__index">{index}</span>
      <span className="question__text">{question.prompt || 'Nouvelle question'}</span>
      <span className="question__actions">
        <button
          className="icon-button" type="button" onClick={onToggle}
          aria-label={editing ? 'Terminer la question' : 'Éditer la question'}
        >
          <Icon name={editing ? 'check' : 'pencil'} className="icon icon--sm" />
        </button>
        <button
          className="icon-button icon-button--danger" type="button" onClick={onRemove}
          aria-label="Supprimer la question"
        >
          <Icon name="x" className="icon icon--sm" />
        </button>
      </span>
      {editing && (
        <div className="question__fields">
          <QuestionFields type={module.type} question={question} onPatch={onPatch} />
        </div>
      )}
    </div>
  );
}

// Champs d'édition d'une question, selon le type du module.
function QuestionFields({ type, question, onPatch }) {
  const prompt = (
    <div className="field">
      <label className="field__label">Énoncé</label>
      <input
        className="input" type="text" value={question.prompt || ''}
        onChange={(e) => onPatch({ prompt: e.target.value })} placeholder="Rédigez la question…"
      />
    </div>
  );

  if (type === 'quiz') {
    const options = question.options || ['', '', '', ''];
    // E1 — la bonne réponse se coche SUR l'option (pattern Podia/Circle),
    // plus de menu séparé à corréler mentalement.
    return (
      <>
        {prompt}
        <div className="field">
          <span className="field__label">Options — coche la bonne réponse</span>
          <div className="field__options" role="radiogroup" aria-label="Bonne réponse">
            {options.map((opt, i) => {
              const isCorrect = (question.correct ?? 0) === i;
              return (
                <span className={`field__option field__option--radio${isCorrect ? ' field__option--correct' : ''}`} key={i}>
                  <input
                    className="option-radio"
                    type="radio"
                    name={`correct-${question.id}`}
                    checked={isCorrect}
                    aria-label={`Marquer l'option ${i + 1} comme bonne réponse`}
                    onChange={() => onPatch({ correct: i })}
                  />
                  <input
                    className="input" type="text" value={opt}
                    aria-label={`Option ${i + 1}`} placeholder={`Option ${i + 1}`}
                    onChange={(e) => {
                      const next = options.slice();
                      next[i] = e.target.value;
                      onPatch({ options: next });
                    }}
                  />
                  {isCorrect ? <span className="field__option-badge"><Icon name="check" className="icon icon--sm" /></span> : null}
                </span>
              );
            })}
          </div>
        </div>
      </>
    );
  }

  if (type === 'true_false') {
    return (
      <>
        {prompt}
        <div className="field">
          <label className="field__label">Réponse</label>
          <span className="select-field">
            <select
              className="select" value={question.answer ? 'true' : 'false'}
              onChange={(e) => onPatch({ answer: e.target.value === 'true' })}
            >
              <option value="true">Vrai</option>
              <option value="false">Faux</option>
            </select>
            <span className="select-field__caret" aria-hidden="true">
              <Icon name="chevron-right" className="icon icon--sm" />
            </span>
          </span>
        </div>
      </>
    );
  }

  if (type === 'estimation') {
    return (
      <>
        {prompt}
        <div className="field">
          <label className="field__label">Cible</label>
          <input
            className="input" type="number" inputMode="numeric" value={question.target ?? 0}
            onChange={(e) => onPatch({ target: Number(e.target.value) || 0 })}
          />
        </div>
      </>
    );
  }

  // vote
  const options = question.options || ['', ''];
  return (
    <>
      {prompt}
      <div className="field">
        <span className="field__label">Choix du vote</span>
        <div className="field__options">
          {options.map((opt, i) => (
            <span className="field__option" key={i}>
              <input
                className="input" type="text" value={opt}
                aria-label={`Choix ${i + 1}`} placeholder={`Choix ${i + 1}`}
                onChange={(e) => {
                  const next = options.slice();
                  next[i] = e.target.value;
                  onPatch({ options: next });
                }}
              />
              <button
                className="icon-button icon-button--danger" type="button"
                aria-label={`Retirer le choix ${i + 1}`}
                onClick={() => onPatch({ options: options.filter((_, j) => j !== i) })}
              >
                <Icon name="x" className="icon icon--sm" />
              </button>
            </span>
          ))}
        </div>
        <button
          className="question-add" type="button"
          onClick={() => onPatch({ options: [...options, ''] })}
        >
          <Icon name="plus" className="icon icon--sm" />
          Ajouter un choix
        </button>
      </div>
    </>
  );
}
