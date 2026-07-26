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

  const sb = useMemo(() => getSupabase(), []);

  // Chargement Supabase best-effort au montage — jamais bloquant.
  useEffect(() => {
    if (!sb) return;
    let alive = true;
    (async () => {
      try {
        const { data, error } = await sb.from('modules').select();
        if (!alive || error || !Array.isArray(data) || data.length === 0) return;
        const mapped = data.map(normalizeModule).filter(Boolean);
        if (mapped.length) { setModules(mapped); setMode('supabase'); }
      } catch {
        /* silencieux : on garde l'état local */
      }
    })();
    return () => { alive = false; };
  }, [sb]);

  const selected = modules.find((m) => m.id === selectedId) || null;

  // --- Mutations modules (réactives) ---
  const patchModule = (id, patch) =>
    setModules((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));

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

  // Enregistrer : upsert vers Supabase (owner_id auto = auth.uid() via défaut DB).
  // Best-effort — si non authentifié, l'état local reste la source de vérité.
  const saveModule = async (m) => {
    if (!sb || !m) return;
    try {
      const { error } = await sb.from('modules').upsert({
        id: m.id, type: m.type, name: m.name, duration: m.duration, color: m.color, questions: m.questions,
      });
      if (!error) setMode('supabase');
    } catch {
      /* tolère l'échec : l'état local reste la source de vérité */
    }
  };

  // --- Mutations questions (réactives) ---
  const patchQuestion = (moduleId, qid, patch) =>
    setModules((prev) => prev.map((m) =>
      m.id !== moduleId ? m : { ...m, questions: m.questions.map((q) => (q.id === qid ? { ...q, ...patch } : q)) }
    ));

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

          <section className="module-grid" aria-label="Liste des modules">
            {modules.map((m) => (
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
          />
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
function Sidebar({ modules, selectedId, mode, onSelect, onAdd }) {
  return (
    <nav className="sidebar" aria-label="Navigation du studio">
      <div className="sidebar__brand">
        <span className="sidebar__brand-mark" aria-hidden="true">
          <Icon name="flame" className="icon icon--sm" />
        </span>
        <span>
          <span className="sidebar__brand-name">Game Show</span><br />
          <span className="sidebar__brand-sub">Studio</span>
        </span>
      </div>

      <div className="nav" role="list">
        <span className="nav__label">Modules</span>
        {modules.map((m) => {
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
        <span className="meta__value">{mode === 'supabase' ? 'Supabase' : 'Mode local'}</span>
        <span className="meta__label">Contenu {mode === 'supabase' ? 'synchronisé' : 'hors ligne'}</span>
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
function EditorPanel({
  module, editingQuestionId, onPatchModule, onAddQuestion, onEditQuestion,
  onPatchQuestion, onRemoveQuestion, onDeleteModule, onSave, onClose,
}) {
  const t = MODULE_TYPES[module.type];
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
                  <option key={k} value={k}>{MODULE_TYPES[k].subtitle}</option>
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
                onToggle={() => onEditQuestion(q.id)}
                onPatch={(patch) => onPatchQuestion(q.id, patch)}
                onRemove={() => onRemoveQuestion(q.id)}
              />
            ))}
            {module.questions.length === 0 && (
              <p className="editor__empty">Aucune question. Ajoutez-en une pour démarrer la banque.</p>
            )}
          </div>
          <button className="question-add" type="button" onClick={onAddQuestion}>
            <Icon name="plus" className="icon icon--sm" />
            Ajouter une question
          </button>
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
        </div>
      </form>
    </aside>
  );
}

// ---------------------------------------------------------------------------
function QuestionRow({ index, module, question, editing, onToggle, onPatch, onRemove }) {
  return (
    <div className={`question${editing ? ' question--editing' : ''}`}>
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
    return (
      <>
        {prompt}
        <div className="field">
          <span className="field__label">Options</span>
          <div className="field__options">
            {options.map((opt, i) => (
              <span className="field__option" key={i}>
                <input
                  className="input" type="text" value={opt}
                  aria-label={`Option ${i + 1}`} placeholder={`Option ${i + 1}`}
                  onChange={(e) => {
                    const next = options.slice();
                    next[i] = e.target.value;
                    onPatch({ options: next });
                  }}
                />
              </span>
            ))}
          </div>
        </div>
        <div className="field">
          <label className="field__label">Bonne réponse</label>
          <span className="select-field">
            <select
              className="select" value={String(question.correct ?? 0)}
              onChange={(e) => onPatch({ correct: Number(e.target.value) })}
            >
              {options.map((opt, i) => (
                <option key={i} value={String(i)}>{opt || `Option ${i + 1}`}</option>
              ))}
            </select>
            <span className="select-field__caret" aria-hidden="true">
              <Icon name="chevron-right" className="icon icon--sm" />
            </span>
          </span>
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
