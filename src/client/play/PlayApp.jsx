// Surface JOUEUR (manette mobile) — un seul écran affiché selon l'état du jeu.
// Flux : rejoindre -> attente -> question (-> réponse envoyée) -> résultat -> fin.
//
// Design : extraction Claude Design — J1 rejoindre (code en 5 cases, erreur
// rattachée à son champ), J2 attente, J3 question (4 modules × 3 états),
// J4 résultat de manche, J5 fin de partie, J6 chargement.
//
// RÈGLE ABSOLUE tenue ici : le rang du joueur n'apparaît JAMAIS en cours de
// partie. Le seul repère de position est le déplacement (places gagnées ou
// perdues). Le rang final n'est révélé qu'à l'écran de fin.
import React, { useEffect, useRef, useState } from 'react';
import { useGame, store } from '../shared/useGame.js';
import { joinRoom } from '../shared/net.js';
import { BrandLoader } from '../shared/BrandLoader.jsx';
import { dire } from '../shared/voix.js';
import { NOM_DU_JEU } from '../shared/marque.js';
import './play.css';

const fmtNum = (n) => Number(n || 0).toLocaleString('fr-FR');
const KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

// Compte à rebours animé des points gagnés (respecte prefers-reduced-motion).
function useCountUp(target, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const goal = typeof target === 'number' && Number.isFinite(target) ? target : 0;
    if (goal === 0) { setVal(0); return undefined; }
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setVal(goal); return undefined; }
    let raf;
    const start = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(goal * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

// Phrase qui tourne pendant les longues attentes. Le TITRE, lui, ne bouge pas :
// c'est lui qui donne son nom accessible à la page, et le faire changer en boucle
// rendrait l'écran instable pour un lecteur d'écran. La ligne rotative est donc
// explicitement retirée des annonces vocales — sinon un lecteur réciterait une
// nouvelle phrase toutes les six secondes par-dessus le reste.
function usePhraseQuiTourne(momentId, intervalle = 6000) {
  const [phrase, setPhrase] = useState(() => dire(momentId));
  useEffect(() => {
    setPhrase(dire(momentId));
    const t = setInterval(() => setPhrase(dire(momentId)), intervalle);
    return () => clearInterval(t);
  }, [momentId, intervalle]);
  return phrase;
}

// ---- Icônes du système (SVG au trait, jamais d'emoji) -----------------------
const Ico = {
  flame: ({ s = 22, ember = false }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
        <g className="brand-flame">
          <path d="M12 2.9c3 3.7 4.5 6.1 4.5 8a4.5 4.5 0 01-9 0c0-1.7.9-3.4 2.6-5.2" />
        </g>
        <path d="M3.4 18.7l17.2-3.5" />
        <path d="M3.4 15.2l17.2 3.5" />
      </g>
      <circle className="brand-spark" cx="12" cy="12.6" r="1.5" fill="currentColor" />
      {ember ? <circle className="brand-ember" cx="15.6" cy="6.4" r="0.9" fill="currentColor" /> : null}
    </svg>
  ),
  check: ({ s = 18, w = 1.6, dashed = false }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" {...(dashed ? { strokeDasharray: 26 } : {})} />
    </svg>
  ),
  checkCircle: ({ s = 20 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><path d="M8.5 12.4l2.4 2.4 4.6-5" />
    </svg>
  ),
  cross: ({ s = 20, w = 1.8 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 7l10 10" /><path d="M17 7L7 17" />
    </svg>
  ),
  clock: ({ s = 20 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="13" r="8" /><path d="M12 13V9" /><path d="M12 13l3 2" /><path d="M9.5 3h5" />
    </svg>
  ),
  up: ({ s = 17 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 19V6" /><path d="M6.5 11.5L12 6l5.5 5.5" />
    </svg>
  ),
  down: ({ s = 17 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v13" /><path d="M6.5 12.5L12 18l5.5-5.5" />
    </svg>
  ),
  arrow: ({ s = 18 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" /><path d="M13 6l6 6-6 6" />
    </svg>
  ),
  chevron: ({ s = 18, open = false }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      style={{ transform: open ? 'rotate(90deg)' : 'none' }}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  ),
  people: ({ s = 22 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19.5c0-3 2.5-4.8 5.5-4.8s5.5 1.8 5.5 4.8" />
      <path d="M16 6.2a3 3 0 010 5.4" /><path d="M17.5 15c2 .5 3.2 2 3.2 4.5" />
    </svg>
  ),
};

// Libellé de la bonne réponse selon le module.
function correctAnswerLabel(reveal, current) {
  if (!reveal) return null;
  const rv = reveal;
  if (rv.type === 'true_false' || typeof rv.correct === 'boolean') return rv.correct ? 'Vrai' : 'Faux';
  if (rv.target != null) return fmtNum(rv.target);
  if (rv.correctIndex != null) {
    const opts = rv.options || current?.options;
    const opt = Array.isArray(opts) ? opts[rv.correctIndex] : null;
    return opt != null ? String(opt) : `Réponse ${KEYS[rv.correctIndex] || rv.correctIndex + 1}`;
  }
  if (rv.type === 'vote' && Array.isArray(rv.tally) && Array.isArray(rv.options) && rv.tally.length) {
    let best = 0;
    for (let i = 1; i < rv.tally.length; i += 1) if (rv.tally[i] > rv.tally[best]) best = i;
    return rv.options[best];
  }
  return null;
}

const ERROR_MESSAGES = {
  'room-not-found': "Ce salon n'existe pas. Vérifie le code.",
  'invalid-pseudo': 'Ce pseudo ne convient pas. Essaie-en un autre.',
  'pseudo-taken': 'Ce pseudo est déjà pris, choisis-en un autre.',
  'room-full': 'Ce salon est complet.',
  'join-failed': 'Connexion impossible. Réessaie.',
};
// Chaque erreur reste rattachée AU CHAMP qui l'a provoquée ; seul l'échec
// réseau parle en haut de l'écran.
const ERROR_FIELD = {
  'room-not-found': 'code',
  'invalid-pseudo': 'pseudo',
  'pseudo-taken': 'pseudo',
  'room-full': 'code',
  'join-failed': 'general',
};

// ============================================================
// J1 — Rejoindre
// ============================================================
function JoinScreen({ initialCode, onJoin, notice }) {
  const CODE_LEN = 5;
  const [chars, setChars] = useState(() => {
    const src = (initialCode || '').toUpperCase().slice(0, CODE_LEN).split('');
    return Array.from({ length: CODE_LEN }, (_, i) => src[i] || '');
  });
  const [pseudo, setPseudo] = useState('');
  const [errCode, setErrCode] = useState(null);
  const [busy, setBusy] = useState(false);
  const boxes = useRef([]);

  const code = chars.join('');
  const field = errCode ? ERROR_FIELD[errCode] : null;
  const message = errCode ? ERROR_MESSAGES[errCode] || ERROR_MESSAGES['join-failed'] : null;

  function setChar(i, raw) {
    const v = (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-1);
    setChars((prev) => { const next = prev.slice(); next[i] = v; return next; });
    setErrCode(null);
    if (v && i < CODE_LEN - 1) boxes.current[i + 1]?.focus();
  }
  function onKeyDown(i, e) {
    if (e.key === 'Backspace' && !chars[i] && i > 0) boxes.current[i - 1]?.focus();
  }
  function onPaste(e) {
    const txt = (e.clipboardData?.getData('text') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!txt) return;
    e.preventDefault();
    setChars(Array.from({ length: CODE_LEN }, (_, i) => txt[i] || ''));
    boxes.current[Math.min(txt.length, CODE_LEN - 1)]?.focus();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setErrCode(null);
    setBusy(true);
    try {
      await onJoin(code.trim(), pseudo.trim());
    } catch (err) {
      setErrCode(err?.message in ERROR_MESSAGES ? err.message : 'join-failed');
      setBusy(false);
    }
  }

  return (
    <main className="screen screen--hearth" data-state={busy ? 'submitting' : 'idle'} aria-labelledby="join-title">
      <div className="screen__main">
        <div className="p-brand">
          <span className="p-brand__mark" aria-hidden="true"><Ico.flame s={22} ember /></span>
          <p className="p-label">{NOM_DU_JEU}</p>
        </div>

        <h1 className="p-title" id="join-title" style={{ marginTop: 'var(--sp-7)' }}>Rejoins<br />la partie</h1>
        <p className="p-lead">Ton téléphone est ta manette.</p>

        {notice ? (
          <div className="join__notice" data-bind="join.notice" role="status">
            <span style={{ flex: 'none', color: 'var(--c-ember-bright)' }} aria-hidden="true"><Ico.clock s={20} /></span>
            <p>{notice}</p>
          </div>
        ) : null}

        {field === 'general' && message ? (
          <div className="join__notice" data-testid="join-error" role="alert" style={{ background: 'var(--c-bad-wash)' }}>
            <span style={{ flex: 'none', color: 'var(--c-bad)' }} aria-hidden="true"><Ico.cross s={20} /></span>
            <p>{message}</p>
          </div>
        ) : null}

        <form className="join" data-testid="join-form" onSubmit={handleSubmit} noValidate data-action="POST /api/rooms/:code/join">
          <div className="join__field">
            <label className="p-label" htmlFor="code-1">Code du salon</label>
            <div className={`code-boxes${field === 'code' ? ' code-boxes--error' : ''}`} data-bind="url.code" data-testid="join-code">
              {chars.map((c, i) => (
                <input
                  key={i}
                  id={`code-${i + 1}`}
                  ref={(el) => { boxes.current[i] = el; }}
                  className="code-boxes__input"
                  value={c}
                  onChange={(e) => setChar(i, e.target.value)}
                  onKeyDown={(e) => onKeyDown(i, e)}
                  onPaste={onPaste}
                  onFocus={(e) => e.target.select()}
                  maxLength={1}
                  inputMode="latin"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={busy}
                  aria-label={`Code, caractère ${i + 1}`}
                  aria-invalid={field === 'code' || undefined}
                  aria-describedby={field === 'code' ? 'err-code' : undefined}
                />
              ))}
            </div>
            {field === 'code' && message ? (
              <p className="field-error" id="err-code" data-testid="join-error" role="alert">
                <Ico.cross s={16} /> {message}
              </p>
            ) : (
              <p className="join__hint">5 caractères, affiché sur l'écran de la partie. Ni O ni I.</p>
            )}
          </div>

          <div className="join__field">
            <label className="p-label" htmlFor="pseudo">Ton pseudo</label>
            <div className={`field-shell${field === 'pseudo' ? ' field-shell--error' : ''}`}>
              <input
                className="field-shell__input"
                data-testid="join-pseudo"
                id="pseudo"
                name="pseudo"
                value={pseudo}
                onChange={(e) => { setPseudo(e.target.value); setErrCode(null); }}
                maxLength={20}
                autoComplete="nickname"
                disabled={busy}
                placeholder="Comment on t'appelle ?"
                aria-invalid={field === 'pseudo' || undefined}
                aria-describedby={field === 'pseudo' ? 'err-pseudo' : undefined}
              />
              <span className="field-shell__count">{pseudo.length}/20</span>
            </div>
            {field === 'pseudo' && message ? (
              <p className="field-error" id="err-pseudo" data-testid="join-error" role="alert">
                <Ico.cross s={16} /> {message}
              </p>
            ) : null}
          </div>
        </form>

        <div className="screen__push" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <div className="join__reassure">
            <span className="join__reassure-badge" aria-hidden="true"><Ico.checkCircle s={18} /></span>
            <p>Aucun compte, aucune installation.</p>
          </div>
          <button className="p-btn p-btn--primary" type="submit" disabled={busy} data-testid="join-submit"
            onClick={handleSubmit} data-action="POST /api/rooms/:code/join" aria-busy={busy || undefined}>
            {busy ? 'On te fait une place…' : 'Entrer dans le salon'}
            {busy ? null : <Ico.arrow s={18} />}
          </button>
        </div>
      </div>
    </main>
  );
}

// ============================================================
// J2 — Salle d'attente
// ============================================================
function WaitScreen({ pseudo, code, playerCount }) {
  const empty = !playerCount || playerCount <= 1;
  const phrase = usePhraseQuiTourne(empty ? 'attente.seul' : 'attente.accompagne');
  const overflow = pseudo && pseudo.length > 15; // Pseudo long déborde visuellement
  return (
    <main className="screen screen--hearth" data-state={`waiting${empty ? ' empty' : ''}${overflow ? ' overflow' : ''}`} aria-labelledby="wait-title">
      <div className="screen__main screen__main--center">
        {code ? (
          <span className="p-cap" data-bind="room.code" data-testid="room-code">
            <span className="p-cap__label">Salon</span>
            <span className="p-cap__value">{code}</span>
          </span>
        ) : null}

        <div className="wait__id">
          <p className="p-label">Tu joues sous le nom</p>
          <p className="wait__pseudo" data-bind="player.pseudo">{pseudo || 'Toi'}</p>
        </div>

        <span className="p-dots" aria-hidden="true">
          <span className="p-dots__dot" /><span className="p-dots__dot" /><span className="p-dots__dot" />
        </span>
        <h1 className="p-title p-title--sm" id="wait-title">
          {empty ? 'Tu allumes le feu' : "On attend l'animateur"}
        </h1>
        {/* aria-hidden : la phrase change toutes les six secondes. Annoncée, elle
            couvrirait tout le reste pour un joueur qui écoute son écran. */}
        {phrase ? (
          <p className="p-lead voix" aria-hidden="true" data-testid="voix-attente" key={phrase}>{phrase}</p>
        ) : null}

        <div className={`wait__count${empty ? ' wait__count--empty' : ''}`} role="status" aria-live="polite">
          <span aria-hidden="true" style={{ color: 'var(--c-ink-3)' }}><Ico.people s={22} /></span>
          <span className="wait__count-value" data-bind="room.playerCount" data-testid="player-count"
            key={playerCount}>{fmtNum(playerCount || 0)}</span>
          <span className="wait__count-label">{(playerCount || 0) > 1 ? 'joueurs prêts' : 'joueur prêt'}</span>
        </div>

        {/* LE BARÈME, ENFIN ÉNONCÉ (action 8). Il existait, ses règles étaient
            parfaitement définies — mais elles n'étaient écrites nulle part. Le
            joueur voyait « bonus vitesse : +150 » sans avoir jamais su qu'un tel
            bonus existait, d'où l'impression d'arbitraire relevée en test.
            Replié par défaut : l'écran reste épuré, et l'information est là au
            moment précis où le joueur n'a rien d'autre à faire. */}
        <details className="rules" data-testid="scoring-rules">
          <summary className="rules__summary">Comment on marque des points</summary>
          <ul className="rules__list">
            <li>Une bonne réponse vaut <strong>700 points</strong>.</li>
            <li>Plus tu réponds vite, plus tu ajoutes : <strong>jusqu'à 300 points</strong> de complément.</li>
            <li>La réponse juste la plus rapide de la manche prend <strong>150 points</strong> de plus.</li>
            {/* L'énoncé doit couvrir les QUATRE jeux, pas seulement le quiz :
                l'estimation et le vote ont leurs propres règles, et un barème
                incomplet est aussi trompeur qu'un barème absent. */}
            <li>
              En <strong>estimation</strong>, seule la justesse compte — la vitesse n'y joue
              aucun rôle. Plus tu es près, plus tu marques : <strong>1000</strong> dans le mille,
              puis 750, 500 et 250 à mesure que tu t'éloignes.
            </li>
            <li>Au <strong>vote</strong>, tu marques si tu es dans la majorité. En cas d'égalité, les deux camps gagnent.</li>
            <li>Une mauvaise réponse ne rapporte rien — et ne coûte rien. Aucun jeu ne retire de points.</li>
            <li>
              Tes bonnes réponses d'affilée sont comptées, pour l'honneur : elles ne donnent
              pas de points. La série se rompt sur une mauvaise réponse, une manche sans
              réponse, ou un vote minoritaire.
            </li>
          </ul>
        </details>
      </div>
    </main>
  );
}

// ============================================================
// J3 — Question : 4 modules × 3 états
// ============================================================
function QuestionScreen({ current, tick, score, answered, myAnswer, onAnswer }) {
  const type = current.type || 'quiz';
  const options = Array.isArray(current.options) ? current.options : [];
  const index = current.index != null ? current.index : current.number;
  const total = current.total;
  const timeLeft = tick?.timeLeft;
  const totalSec = Math.max(1, Math.round((current.durationMs || 0) / 1000));
  const frac = timeLeft != null ? Math.max(0, Math.min(1, timeLeft / totalSec)) : 1;
  const urgent = timeLeft != null && timeLeft > 0 && timeLeft <= 5;
  // Verrouillage à 0 : plus aucune réponse possible (le serveur refuse de toute
  // façon — ceci est le retour visuel immédiat).
  const timeUp = timeLeft != null && timeLeft <= 0;
  const disabled = answered || timeUp;
  const [estimate, setEstimate] = useState('');
  const isVote = type === 'vote';

  const state = answered ? 'answered' : timeUp ? 'time-up' : urgent ? 'open urgent' : 'open';

  // Bandeau de statut : accusé de réception, ou clôture.
  const status = answered
    ? { closed: false, text: isVote ? 'Ta voix est enregistrée' : 'Réponse envoyée' }
    : timeUp
      ? { closed: true, text: isVote ? 'Vote clos' : "Temps écoulé — tu n'as pas répondu" }
      : null;

  function optClass(chosen) {
    if (chosen) return `opt ${isVote ? 'opt--voted' : 'opt--selected'}`;
    return `opt${disabled ? ' opt--frozen' : ''}`;
  }

  return (
    <main className="screen" data-state={state} aria-labelledby="q-text">
      <div className="screen__main">
        <div className="q-hud">
          <span className={`p-cap${disabled ? ' p-cap--sunk' : ' p-cap--accent'}`} data-bind="module.meta.name">
            {disabled ? null : <span className="p-cap__dot" aria-hidden="true" />}
            <span className="p-cap__label">{current.meta?.name || 'Épreuve'}</span>
          </span>
          <span className="p-cap">
            <span className="p-cap__label">Score</span>
            <span className="p-cap__value" data-bind="you.score">{fmtNum(score)}</span>
          </span>
        </div>

        <div className="q-meta">
          <div className="q-round">
            <p className="p-label p-label--tiny">Manche</p>
            <p className="q-round__value">
              <span data-bind="module.index">{index != null ? index : '—'}</span>
              {total != null && total > (index || 0) ? (
                <><span className="p-dim">/</span><span className="p-dim" data-bind="module.total">{total}</span></>
              ) : null}
            </p>
          </div>
          <div
            className={`q-chrono${urgent ? ' q-chrono--urgent' : ''}${timeUp ? ' q-chrono--over' : ''}`}
            style={{ '--q-frac': `${Math.round(frac * 100)}%` }}
            role="timer"
            aria-label={`Temps restant ${timeLeft ?? 0} secondes`}
          >
            <div className="q-chrono__inner">
              <span className="q-chrono__value" data-bind="tick.timeLeft">
                {timeLeft != null ? timeLeft : '—'}
              </span>
            </div>
          </div>
        </div>

        <p className={`q-text${disabled ? ' q-text--frozen' : ''}`} id="q-text"
          data-bind="module.text" data-testid="question-text">{current.text}</p>

        <div className={`q-zone${type === 'true_false' ? ' q-zone--tiles' : ''}`} data-bind="module.options" data-testid="answer-zone">
          {type === 'true_false' ? (
            [['Vrai', true], ['Faux', false]].map(([label, val]) => {
              const chosen = myAnswer === val;
              return (
                <button
                  key={label}
                  type="button"
                  className={`tile${chosen ? ' tile--selected' : disabled ? ' tile--frozen' : ''}`}
                  data-testid="answer-option"
                  data-action="play:answer"
                  data-state={chosen ? 'selected' : disabled ? 'frozen' : 'idle'}
                  disabled={disabled}
                  onClick={() => onAnswer(val)}
                >
                  <span aria-hidden="true">{val ? <Ico.check s={30} w={1.8} /> : <Ico.cross s={30} />}</span>
                  <span className="tile__label">{label}</span>
                </button>
              );
            })
          ) : type === 'estimation' ? (
            <form className="est" onSubmit={(e) => { e.preventDefault(); if (disabled) return; onAnswer(Number(estimate)); }}>
              <label className="p-label" htmlFor="est">Ta réponse</label>
              <div className="est__shell">
                <input
                  className="est__input"
                  id="est"
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={estimate}
                  disabled={disabled}
                  onChange={(e) => setEstimate(e.target.value)}
                />
              </div>
              <p className="join__hint">Un nombre, positif ou négatif. Le plus proche gagne.</p>
              <button className="p-btn p-btn--primary" type="submit" data-testid="answer-submit" data-action="play:answer"
                disabled={disabled || estimate === ''} style={{ marginTop: 'var(--sp-3)' }}>
                Envoyer mon estimation
              </button>
            </form>
          ) : (
            options.map((opt, i) => {
              const chosen = myAnswer === i;
              return (
                <button
                  key={i}
                  type="button"
                  className={optClass(chosen)}
                  data-testid="answer-option"
                  data-action="play:answer"
                  data-state={chosen ? 'selected' : disabled ? 'frozen' : 'idle'}
                  disabled={disabled}
                  onClick={() => onAnswer(i)}
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <span className="opt__key" aria-hidden="true">{KEYS[i] || i + 1}</span>
                  <span className="opt__label">{opt}</span>
                  {chosen ? (
                    <span className="opt__mark" aria-hidden="true">
                      <svg className="opt__check" width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke={isVote ? 'var(--c-moss)' : 'var(--c-flame)'} strokeWidth="3"
                        strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                    </span>
                  ) : disabled ? (
                    <span className="opt__mark" aria-hidden="true"><span className="opt__mark-bar" /></span>
                  ) : (
                    <span className="opt__mark" aria-hidden="true" />
                  )}
                </button>
              );
            })
          )}

          {status ? (
            <div className={`q-status${status.closed ? ' q-status--closed' : ''}`} role="status" data-bind="play.accepted">
              <span aria-hidden="true" style={{ flex: 'none', color: status.closed ? 'var(--c-bad)' : 'var(--c-pine)' }}>
                {status.closed ? <Ico.clock s={20} /> : <Ico.checkCircle s={20} />}
              </span>
              <p>{status.text}</p>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}

// ============================================================
// J4 — Résultat de manche (aucun rang, jamais)
// ============================================================
function ScoreScreen({ you, reveal, myAnswer, current, index, total, answered }) {
  const rv = reveal || {};
  const isVote = (rv.type || current?.type) === 'vote';
  // Un vote est désormais un JEU par défaut : la majorité marque (action 18).
  // Il peut rester un SONDAGE, question par question — auquel cas personne ne
  // gagne et l'écran ne doit surtout pas annoncer de points.
  const isSondage = isVote && rv.poll === true;
  const isEstimation = (rv.type || current?.type) === 'estimation';

  // TROIS situations, pas deux (R12). L'absence de résultat ne signifie pas
  // « tu n'étais pas là » : elle peut aussi vouloir dire « pas encore révélé »,
  // ou « tu viens de te reconnecter ». Seul `answered`, calculé par le serveur,
  // dit si le joueur a participé. Et le résultat n'est le sien que s'il porte
  // l'identité de la manche affichée — sinon c'est un souvenir d'une manche
  // précédente, qui affichait jusqu'ici des bonus et malus fantômes.
  const monResultat = you && current?.roundId != null && you.roundId === current.roundId ? you : null;
  const hasData = !!monResultat;
  const absent = answered === false;

  // Bon / mauvais quand la révélation le permet.
  let correct = null;
  if (!isVote) {
    if (typeof rv.correct === 'boolean' && typeof myAnswer === 'boolean') correct = myAnswer === rv.correct;
    else if (typeof rv.correctIndex === 'number' && typeof myAnswer === 'number') correct = myAnswer === rv.correctIndex;
    else if (rv.target != null && myAnswer != null) correct = (monResultat?.base || 0) > 0;
  } else if (!isSondage && Array.isArray(rv.winners) && typeof myAnswer === 'number') {
    correct = rv.winners.includes(myAnswer);
  }

  // Quel moment de voix ce résultat mérite-t-il ? Chaque branche est adossée à un
  // fait vérifié : le palier renvoyé par le serveur, le supplément de rapidité
  // réellement versé, la série réellement atteinte. Une phrase ne peut donc pas
  // célébrer un réflexe qui n'a pas eu lieu.
  const momentVoix = (() => {
    // Les deux cas limites ont eux aussi leur phrase : « jamais d'écran muet »
    // vaut aussi — et surtout — pour le joueur qui arrive en cours de partie.
    if (absent) return 'manche.sans-toi';
    if (!hasData) return 'resultat.attente';
    if (isSondage) return 'vote.sondage';
    if (isVote) return correct ? 'vote.majorite' : 'vote.minorite';
    if (isEstimation && monResultat.palier) return `estimation.${monResultat.palier}`;
    if (correct === true) {
      if (monResultat.speed >= 150) return 'juste.plus-rapide';
      if (monResultat.streak >= 2) return 'juste.serie';
      return 'juste.simple';
    }
    if (correct === false) return 'faux';
    return null;
  })();
  const phraseVoix = momentVoix
    ? dire(momentVoix, { serie: monResultat?.streak, places: Math.abs(monResultat?.placesDelta || 0) })
    : null;

  const gained = typeof monResultat?.delta === 'number' ? monResultat.delta : 0;
  const animatedGain = useCountUp(gained);
  const places = monResultat?.placesDelta ?? 0;
  const answerLabel = correctAnswerLabel(rv, current);
  const tone = correct === true ? 'correct' : correct === false ? 'wrong' : isVote ? 'vote' : 'empty';

  const gainClass = gained > 0 ? ' gain__value--good' : gained < 0 ? ' gain__value--bad' : '';
  const gainText = gained > 0 ? `+${fmtNum(animatedGain)}` : gained < 0 ? fmtNum(gained) : '0';

  return (
    <main className={`screen${correct === true ? ' screen--win' : ''}`} data-state={hasData ? tone : 'empty'}
      aria-labelledby="verdict">
      <div className="screen__main">
        <div className="q-hud">
          <p className="p-label">
            Manche <span data-bind="module.index">{index != null ? index : '—'}</span>
            {total != null ? <><span className="p-dim">/</span><span data-bind="module.total">{total}</span></> : null}
          </p>
          <span className="p-cap">
            <span className="p-cap__label">Score</span>
            {/* Score CUMULÉ : il reste vrai même quand le résultat de la manche
                n'est pas (encore) là — c'est son décalage qui déroutait le joueur. */}
            <span className="p-cap__value" data-bind="you.score">{you ? fmtNum(you.score) : '—'}</span>
          </span>
        </div>

        {/* Situation 3 : le joueur n'a pas participé à cette manche.
            Le test est `absent` SEUL, pas « absent et sans résultat » : le serveur
            envoie un relevé à zéro à tous les joueurs connectés, y compris à ceux
            qui n'ont pas répondu. Se fier à la présence du relevé faisait donc
            afficher « 0 point » à un retardataire, là où la décision 5 de
            l'action 12 exige qu'on lui DISE qu'il n'était pas là. */}
        {absent ? (
          <div className="screen__main--center" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span className="verdict__badge verdict__badge--neutral" aria-hidden="true"
              style={{ color: 'var(--c-ink-3)' }}><Ico.clock s={30} /></span>
            <h1 className="p-title p-title--sm" id="verdict">Manche jouée<br />sans toi</h1>
            <p className="p-lead" role="status">
              Tu es arrivé après le lancement : aucun point pour cette manche.
            </p>
            {phraseVoix ? <p className="p-lead voix" data-testid="voix-resultat">{phraseVoix}</p> : null}
          </div>
        ) : !hasData ? (
          /* Situation 2 : le joueur a bien répondu, son résultat n'est pas encore
             arrivé — reconnexion en cours, ou manche pas encore révélée. On ne lui
             dit SURTOUT pas qu'il n'était pas là. */
          <div className="screen__main--center" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span className="verdict__badge verdict__badge--neutral" aria-hidden="true"
              style={{ color: 'var(--c-fern)' }}><Ico.checkCircle s={30} /></span>
            <h1 className="p-title p-title--sm" id="verdict">Ta réponse<br />est bien partie</h1>
            <p className="p-lead" role="status">Ton score est à jour.</p>
            {phraseVoix ? <p className="p-lead voix" data-testid="voix-resultat">{phraseVoix}</p> : null}
          </div>
        ) : (
          <>
            <div className="verdict">
              <span className={`verdict__badge verdict__badge--${correct === true ? 'good' : correct === false ? 'bad' : 'neutral'}`}
                aria-hidden="true"
                style={{ color: correct === true ? 'var(--c-ink-on-leaf)' : correct === false ? 'var(--c-bad)' : 'var(--c-fern)' }}>
                {correct === true ? <Ico.check s={38} w={2.6} dashed />
                  : correct === false ? <Ico.cross s={34} w={2.2} />
                  : <Ico.checkCircle s={34} />}
              </span>
              <h1 className={`verdict__title${correct === true ? ' verdict__title--good' : ''}`} id="verdict">
                {/* Sur un vote, être minoritaire n'est pas un échec : c'est un
                    pari perdu. Le mot « Raté » serait faux et inutilement dur. */}
                {isVote
                  ? (isSondage ? 'Voix comptée' : correct === true ? 'Avec la majorité' : correct === false ? 'À contre-courant' : 'Voix comptée')
                  : correct === true ? 'Bien joué' : correct === false ? 'Raté' : 'Manche close'}
              </h1>
              {/* La voix du jeu remplace les commentaires figés : « Ça se
                  rattrape » disait la même chose à tout le monde, à chaque fois. */}
              {phraseVoix ? <p className="p-lead voix" role="status" data-testid="voix-resultat">{phraseVoix}</p> : null}


            </div>

            {!isSondage ? (
              <div className="gain">
                <p className="p-label">Points gagnés</p>
                <p className={`gain__value${gainClass}`} data-bind="you.delta" data-testid="points-gained">{gainText}</p>
                <span className={`places${places > 0 ? ' places--up' : places < 0 ? ' places--down' : ''}`}
                  data-bind="you.placesDelta" data-testid="places-delta">
                  {places > 0 ? <Ico.up /> : places < 0 ? <Ico.down /> : <span className="places__bar" aria-hidden="true" />}
                  <span className="places__text">
                    {places > 0 ? `+${places} place${places > 1 ? 's' : ''}`
                      : places < 0 ? `${places} place${places < -1 ? 's' : ''}`
                      : 'Position inchangée'}
                  </span>
                </span>
              </div>
            ) : (
              <span className="places" data-bind="you.placesDelta" data-testid="places-delta"
                style={{ marginTop: 'var(--sp-5)', justifyContent: 'center' }}>
                <span className="places__bar" aria-hidden="true" />
                <span className="places__text">Position inchangée</span>
              </span>
            )}

            {/* Estimation : ton chiffre face à la cible. */}
            {isEstimation && myAnswer != null ? (
              <div className="est-compare">
                <div className="est-compare__cell">
                  <span className="p-label p-label--tiny">Ton estimation</span>
                  <span className="est-compare__value">{fmtNum(myAnswer)}</span>
                </div>
                <div className="est-compare__cell est-compare__cell--target" data-bind="reveal.target" data-testid="reveal-value">
                  <span className="p-label p-label--tiny" style={{ color: 'var(--c-pine)' }}>Bonne réponse</span>
                  <span className="est-compare__value">{fmtNum(rv.target)}</span>
                </div>
              </div>
            ) : null}

            {/* Le détail des points se lit en DEUX lignes, et elles disent la
                vérité. Avant, une case « Bonus vitesse » contenait aussi le bonus
                de série : un joueur en série de trois y lisait « +100 » sans avoir
                été rapide, pendant que la case « Série » affichait « ×3 » sans le
                moindre point en face. Plus de case « Malus » non plus : aucune
                pénalité n'existe dans aucun jeu.
                Chaque ligne ne s'affiche que si elle vaut quelque chose — un écran
                de résultat n'a pas à aligner des zéros. */}
            {!isVote && (monResultat.base || monResultat.speed) ? (
              <div className="breakdown">
                {monResultat.base ? (
                  <div className="breakdown__cell">
                    <span className="p-label p-label--tiny">Base</span>
                    <span className="breakdown__value" data-bind="you.base" data-testid="points-base">
                      {fmtNum(monResultat.base)}
                    </span>
                  </div>
                ) : null}
                {monResultat.speed ? (
                  <div className="breakdown__cell">
                    <span className="p-label p-label--tiny">Complément de vitesse</span>
                    <span className="breakdown__value breakdown__value--accent"
                      data-bind="you.speed" data-testid="points-speed">+{fmtNum(monResultat.speed)}</span>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* La série est une INFORMATION, plus une source de points : elle se
                lit comme un compte de bonnes réponses d'affilée, sans la notation
                « ×N » qui laissait croire à une multiplication. */}
            {!isVote && monResultat.streak >= 2 ? (
              <p className="p-lead" data-bind="you.streak" data-testid="streak-count">
                {monResultat.streak} bonnes réponses d'affilée.
              </p>
            ) : null}
          </>
        )}

        {/* Ton choix, quand il diffère de la bonne réponse. */}
        {hasData && correct === false && typeof myAnswer === 'number' && current?.options?.[myAnswer] != null ? (
          <div className="answer-reveal answer-reveal--mine">
            <span className="answer-reveal__badge" aria-hidden="true">{KEYS[myAnswer] || myAnswer + 1}</span>
            <div className="answer-reveal__body">
              <p className="answer-reveal__label">Ton choix</p>
              <p className="answer-reveal__value">{current.options[myAnswer]}</p>
            </div>
          </div>
        ) : null}

        {/* Bonne réponse — affichée même quand le joueur a juste. */}
        {answerLabel != null && !isEstimation ? (
          <div className={`answer-reveal${isVote ? ' answer-reveal--leading' : ''}`}
            data-bind={isVote ? 'reveal.leading' : 'reveal.correct'} data-testid="reveal-value">
            <span className="answer-reveal__badge" aria-hidden="true"
              style={isVote ? { background: 'var(--c-ember-wash)', color: 'var(--c-ember-bright)' } : { color: 'var(--c-ink-on-leaf)' }}>
              {isVote ? <Ico.up /> : <Ico.check s={17} w={3} />}
            </span>
            <div className="answer-reveal__body">
              <p className="answer-reveal__label">{isVote ? 'En tête' : 'Bonne réponse'}</p>
              <p className="answer-reveal__value">{answerLabel}</p>
            </div>
          </div>
        ) : null}

        <div className="screen__push">
          <p className="p-note" role="status" aria-live="polite">Prochaine épreuve…</p>
        </div>
      </div>
    </main>
  );
}

// ============================================================
// J5 — Fin de partie (SEUL écran où le rang apparaît)
// ============================================================
// Le canvas 2D ne comprend pas var(--…) : on résout les tokens sur le document,
// pour que l'image partagée suive la charte au lieu d'en figer une copie.
function token(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function drawScoreCard({ pseudo, rank, score }) {
  const W = 1080, H = 1920;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const canvasBg = token('--c-canvas', '#2b2118');
  const ink = token('--c-ink', '#f6ece0');
  const ink3 = token('--c-ink-3', '#b9ac9b');
  const ember = token('--c-ember-bright', '#f5a44f');
  const pine = token('--c-pine', '#9fdcb0');
  const fDisplay = token('--f-display', '"Avenir Next Condensed", Futura, sans-serif');
  const fUi = token('--f-ui', 'system-ui, sans-serif');

  // Fond + halo : le foyer de --g-hearth, transposé en dégradé radial.
  ctx.fillStyle = canvasBg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, H * 0.62, 60, W / 2, H * 0.62, 760);
  glow.addColorStop(0, `color-mix(in oklab, ${ember} 34%, transparent)`);
  glow.addColorStop(1, `color-mix(in oklab, ${ember} 0%, transparent)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = ink;
  ctx.font = `bold 64px ${fDisplay}`;
  ctx.fillText('PROJECT GAME SHOW', W / 2, 220);
  ctx.fillStyle = pine;
  ctx.font = `600 44px ${fUi}`;
  ctx.fillText('RÉSULTAT DE LA PARTIE', W / 2, 300);
  ctx.fillStyle = ember;
  ctx.font = `bold 88px ${fDisplay}`;
  ctx.fillText(String(pseudo || 'Joueur').slice(0, 20), W / 2, 560);
  if (rank != null) {
    ctx.fillStyle = ember;
    ctx.font = `900 420px ${fDisplay}`;
    ctx.fillText(`${rank}${rank === 1 ? 'ᵉʳ' : 'ᵉ'}`, W / 2, H * 0.55 + 140);
  }
  ctx.fillStyle = ink;
  ctx.font = `bold 96px ${fUi}`;
  ctx.fillText(`${Number(score || 0).toLocaleString('fr-FR')} pts`, W / 2, H * 0.72);
  ctx.fillStyle = ink3;
  ctx.font = `48px ${fUi}`;
  ctx.fillText(window.location.host, W / 2, H - 160);
  return new Promise((resolve) => c.toBlob(resolve, 'image/png'));
}

// Libellé de la bonne réponse d'une manche du récapitulatif.
function historyAnswer(h) {
  const rv = h.reveal || {};
  if (h.type === 'true_false') return rv.correct ? 'Vrai' : 'Faux';
  if (h.type === 'estimation') return rv.target != null ? fmtNum(rv.target) : null;
  if (h.type === 'quiz') {
    if (Array.isArray(h.options) && rv.correctIndex != null && h.options[rv.correctIndex] != null) return h.options[rv.correctIndex];
    return rv.correctIndex != null ? `Réponse ${KEYS[rv.correctIndex] || rv.correctIndex + 1}` : null;
  }
  if (h.type === 'vote' && Array.isArray(rv.tally) && Array.isArray(h.options) && rv.tally.length) {
    let best = 0;
    for (let i = 1; i < rv.tally.length; i += 1) if (rv.tally[i] > rv.tally[best]) best = i;
    return `${h.options[best]} (vote du public)`;
  }
  return null;
}

function EndScreen({ you, podium, playerId, pseudo, history, roomCode }) {
  const rank = you?.rank;
  const scored = (podium || []).filter((p) => (p.score || 0) > 0);
  const ranked = rank != null && scored.length > 0;
  const [shared, setShared] = useState(false);
  const [showRecap, setShowRecap] = useState(false);

  const share = async () => {
    const rankTxt = rank != null ? `${rank}${rank === 1 ? 're' : 'e'} place` : 'la partie';
    const text = `J'ai terminé ${rankTxt} avec ${fmtNum(you?.score)} pts sur ${NOM_DU_JEU} !`;
    const url = typeof window !== 'undefined' ? window.location.origin : '';
    try {
      if (navigator.share) {
        let filesPayload = null;
        try {
          const blob = await drawScoreCard({ pseudo, rank, score: you?.score });
          if (blob) {
            const file = new File([blob], 'mon-score.png', { type: 'image/png' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) filesPayload = [file];
          }
        } catch { /* canvas indisponible : repli texte */ }
        await navigator.share(filesPayload
          ? { title: NOM_DU_JEU, text, files: filesPayload }
          : { title: NOM_DU_JEU, text, url });
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setShared(true);
        setTimeout(() => setShared(false), 1800);
      }
    } catch { /* partage annulé */ }
  };

  const recap = Array.isArray(history) ? history.filter((h) => h && h.text) : [];

  return (
    <main className="screen screen--hearth" data-testid="end-screen"
      data-state={`ranked${ranked ? '' : ' empty'}`} aria-labelledby="end-title">
      <div className="screen__main screen__main--center">
        <div className="p-brand">
          <span className="p-brand__mark" aria-hidden="true"><Ico.flame s={22} ember /></span>
          <p className="p-label">Partie terminée</p>
        </div>

        <h1 className="p-title" id="end-title">
          {rank === 1 ? 'Victoire' : ranked && rank <= 3 ? 'Sur le podium' : 'C’est fini'}
        </h1>

        {ranked ? (
          <div className="final" data-testid="final-rank">
            <p className="p-label">Ton rang final</p>
            <p className="final__rank" data-bind="you.rank">
              {rank}<sup>{rank === 1 ? 'er' : 'e'}</sup>
            </p>
            <span className="p-cap">
              <span className="p-cap__label">Points</span>
              <span className="final__score" data-bind="you.score">{fmtNum(you?.score)}</span>
            </span>
          </div>
        ) : (
          <p className="p-lead">Personne n'a marqué cette fois — pas de classement.</p>
        )}

        {scored.length ? (
          <div className="board" data-bind="podium">
            {scored.slice(0, 5).map((entry, i) => {
              const r = entry.rank != null ? entry.rank : i + 1;
              const me = playerId != null && entry.id === playerId;
              return (
                <div className={`board__row${me ? ' board__row--me' : ''}`} key={entry.id || i}>
                  <span className="board__rank">{r}</span>
                  <span className="board__name">{me ? 'Toi' : (entry.pseudo || '—')}</span>
                  <span className="board__score">{fmtNum(entry.score)}</span>
                </div>
              );
            })}
          </div>
        ) : null}

        {recap.length > 0 ? (
          <div className="recap" data-bind="history">
            <button className="recap__toggle" type="button" aria-expanded={showRecap}
              onClick={() => setShowRecap((v) => !v)}>
              <Ico.chevron s={18} open={showRecap} />
              Revoir les questions ({recap.length})
            </button>
            {showRecap ? (
              <ol className="recap__list">
                {recap.map((h, i) => {
                  const ans = historyAnswer(h);
                  return (
                    <li className="recap__item" key={i}>
                      <span className="recap__q">{h.text}</span>
                      {ans != null ? <span className="recap__a">{ans}</span> : null}
                    </li>
                  );
                })}
              </ol>
            ) : null}
          </div>
        ) : null}

        <div className="screen__push" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {roomCode ? (
            <p className="p-note" role="status">
              Reste connecté — si l'animateur relance une partie dans le salon <strong>{roomCode}</strong>,
              tu y seras automatiquement.
            </p>
          ) : null}
          {ranked ? (
            <button className="p-btn p-btn--primary" type="button" data-action="share" onClick={share}>
              {shared ? 'Copié !' : 'Partager mon score'}
            </button>
          ) : null}
        </div>
        {/* Plus de bouton « Rejouer » : il effaçait la session locale sans prévenir
            le serveur, si bien que le joueur perdait son identité et se voyait
            refuser son propre pseudo s'il tentait de revenir. Le bouton qui
            promettait de rejouer était celui qui l'en empêchait.
            Rien à cliquer : quand l'animateur relance, le serveur ramène tout le
            monde au salon d'attente. */}
        <p className="p-lead" role="status" data-bind="end.replayHint">
          Reste là : si l'animateur relance une partie, tu y seras ramené sans rien faire.
        </p>
      </div>
    </main>
  );
}

// ============================================================
export function PlayApp() {
  const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
  const urlCode = (params.get('code') || '').trim();
  const stored = urlCode ? store.load('play:' + urlCode) : null;

  const [code, setCode] = useState(urlCode);
  const [pseudo, setPseudo] = useState(stored?.pseudo || '');
  const [playerId, setPlayerId] = useState(stored?.playerId || null);
  const [playerToken, setPlayerToken] = useState(stored?.playerToken || null);
  const [myAnswer, setMyAnswer] = useState(null);
  const [notice, setNotice] = useState(null);

  const g = useGame(playerToken);

  // Salon fermé par l'animateur : retour à « rejoindre », en DISANT pourquoi.
  useEffect(() => {
    if (!g.roomClosed) return;
    if (code) store.clear('play:' + code);
    setPlayerToken(null);
    setPlayerId(null);
    setMyAnswer(null);
    setNotice("L'animateur a fermé le salon. Tu peux rejoindre une autre partie.");
  }, [g.roomClosed, code]);

  // Salon disparu (serveur redéployé, partie expirée) : purge de la session périmée.
  useEffect(() => {
    if (!g.fatal || !playerToken) return;
    if (code) store.clear('play:' + code);
    setPlayerToken(null);
    setPlayerId(null);
    setMyAnswer(null);
    setNotice("Ce salon n'existe plus — il a peut-être expiré. Demande un nouveau code à l'animateur.");
  }, [g.fatal, playerToken, code]);

  // Réinitialise la sélection locale à chaque nouvelle manche.
  const roundKey = g.current ? (g.current.index ?? g.current.id ?? g.current.text) : null;
  const prevRound = useRef(roundKey);
  useEffect(() => {
    if (prevRound.current !== roundKey) {
      prevRound.current = roundKey;
      setMyAnswer(null);
    }
  }, [roundKey]);

  async function handleJoin(joinCode, joinPseudo) {
    const r = await joinRoom(joinCode, joinPseudo);
    store.save('play:' + joinCode, r);
    setCode(joinCode);
    setPseudo(r.pseudo || joinPseudo);
    setPlayerId(r.playerId || null);
    setPlayerToken(r.playerToken);
    setNotice(null);
  }

  function handleAnswer(value) {
    setMyAnswer(value);
    g.emit('play:answer', { value });
  }

  if (!playerToken) {
    return <JoinScreen initialCode={urlCode} onJoin={handleJoin} notice={notice} />;
  }

  // Session présente mais état du salon pas encore reçu : loader de marque.
  if (!g.room) return <BrandLoader />;

  const room = g.room;
  const roomCode = room?.code || code;
  const displayPseudo = g.you?.pseudo || pseudo;

  // PLUS DE BOUTON « QUITTER ». Il n'effaçait que la session LOCALE sans prévenir
  // le serveur : le joueur restait inscrit dans le salon avec son pseudo et son
  // score, mais perdait le jeton qui lui permettait d'y revenir. Rejoindre avec le
  // même pseudo lui était alors refusé — par lui-même.
  // Et il n'avait aucun usage légitime : la session est rattachée à UN salon, donc
  // rejoindre une autre partie ne demande pas de quitter la première ; fermer
  // l'onglet suffit ; une session périmée est purgée toute seule.

  // Repli si play:you n'a pas (encore) été reçu — typiquement après un rechargement.
  const deriveYou = (rows) => {
    if (!playerId || !Array.isArray(rows)) return null;
    const idx = rows.findIndex((r) => (r.id || r.playerId) === playerId);
    if (idx < 0) return null;
    const r = rows[idx];
    return { rank: r.rank != null ? r.rank : idx + 1, score: r.score };
  };
  const podiumRows = g.podium || g.leaderboard;
  const effectiveYou = g.you || deriveYou(g.leaderboard) || deriveYou(g.podium);

  // Fin de partie.
  if (g.podium || room?.state === 'ended') {
    return (
      <>
        <EndScreen you={effectiveYou} podium={podiumRows} playerId={playerId}
          pseudo={displayPseudo} history={g.history} roomCode={roomCode} />
      </>
    );
  }

  // Résultat d'une manche révélée.
  if (g.reveal) {
    return (
      <>
        <ScoreScreen you={g.you} reveal={g.reveal} myAnswer={myAnswer} current={g.current}
          index={room?.progression?.index} total={room?.progression?.total}
          answered={g.answered} />
      </>
    );
  }

  // Question en cours (pas de bouton Quitter : l'écran reste focalisé sur la réponse).
  if (g.current && room?.state !== 'waiting') {
    return (
      <QuestionScreen
        current={g.current}
        tick={g.tick}
        score={g.you?.score || 0}
        answered={g.answered === true}
        myAnswer={myAnswer}
        onAnswer={handleAnswer}
      />
    );
  }

  // Attente du lancement.
  return (
    <>
      <WaitScreen pseudo={displayPseudo} code={roomCode} playerCount={room?.playerCount} />
    </>
  );
}
