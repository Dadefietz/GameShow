// Surface STREAM (`/overlay`) — scène diffusée en source navigateur OBS.
// Seule source à ajouter dans OBS : les trois overlays transparents historiques
// (/overlay/question, /leaderboard, /podium) sont abandonnés depuis le 2026-08-18.
//
// Design : extraction Claude Design — S1 panneau de connexion permanent,
// S2 attente, S3 question + révélation, S4 podium.
// Deux règles de contrat tenues ici :
//   1. QR + lien + code du salon restent affichés EN PERMANENCE, quelle que soit
//      la phase de jeu (panneau de droite) ;
//   2. à la révélation, le stream montre la RÉPARTITION des réponses — jamais
//      les points ni les places d'un joueur.
// Le token vient de la query (?token=...). Aucun bouton, aucune interaction.
import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useGame } from '../shared/useGame.js';
import './overlay.css';

const nf = new Intl.NumberFormat('fr-FR');
const fmt = (n) => (typeof n === 'number' && Number.isFinite(n) ? nf.format(n) : '—');
const KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

// Marque animée du système : flamme qui respire, braise qui scintille.
function BrandMark({ size = 37, ember = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
  );
}

function PeopleIcon({ size = 52, stroke = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke}
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19.5c0-3 2.5-4.8 5.5-4.8s5.5 1.8 5.5 4.8" />
      <path d="M16 6.2a3 3 0 010 5.4" />
      <path d="M17.5 15c2 .5 3.2 2 3.2 4.5" />
    </svg>
  );
}

function CheckIcon({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--c-ink-on-leaf)"
      strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.6 4.5L19 7.5" />
    </svg>
  );
}

// ============================================================
// S1 — Panneau de connexion, PERMANENT sur toutes les phases
// ============================================================
function JoinPanel({ code }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const joinUrl = `${origin}/play?code=${code || ''}`;
  const [qr, setQr] = useState('');

  useEffect(() => {
    let alive = true;
    if (!code) { setQr(''); return undefined; }
    QRCode.toDataURL(joinUrl, { margin: 1, width: 520 })
      .then((url) => { if (alive) setQr(url); })
      .catch(() => { if (alive) setQr(''); });
    return () => { alive = false; };
  }, [code, joinUrl]);

  return (
    <aside className="join-panel" data-state="always" aria-label="Rejoindre la partie">
      <div className="join-panel__brand">
        <span className="join-panel__mark" aria-hidden="true"><BrandMark /></span>
        <p className="join-panel__name">Project<br />Game Show</p>
      </div>

      {qr ? (
        <img className="join-panel__qr" data-bind="room.qr" data-testid="stream-qr" src={qr}
          alt={`QR code pour rejoindre le salon ${code || ''}`} />
      ) : (
        <span className="join-panel__qr join-panel__qr--empty" aria-hidden="true" />
      )}

      <div className="join-panel__group">
        <p className="join-panel__label">Code du salon</p>
        <div className="join-panel__code-field">
          <p className="join-panel__code" data-bind="room.code" data-testid="stream-room-code">
            {code || '—'}
          </p>
        </div>
      </div>

      <div className="join-panel__group">
        <p className="join-panel__label">Sur ton téléphone</p>
        <div className="join-panel__url-capsule">
          <span className="join-panel__url" data-bind="room.joinUrl">
            {origin.replace(/^https?:\/\//, '')}/play
          </span>
        </div>
      </div>
    </aside>
  );
}

// ============================================================
// S2 — Attente : avant le premier joueur, avec joueurs, entre deux manches
// ============================================================
function WaitingStage({ g }) {
  const count = g.room?.playerCount || 0;
  const prog = g.room?.progression;
  const between = (prog?.index || 0) > 0; // au moins une épreuve déjà jouée
  const empty = count === 0;

  return (
    <div className="stream__stage stream__stage--centered"
      data-state={`waiting${empty ? ' empty' : ''}${between ? ' between' : ''}`}>
      <div className="st-caps">
        <span className="st-cap st-cap--live">
          <span className="st-cap__dot" aria-hidden="true" />
          <span className="st-cap__label st-cap__label--live">
            {between ? 'Manche terminée' : empty ? 'Salon ouvert' : "Salle d'attente"}
          </span>
        </span>
        {between && prog?.index ? (
          <span className="st-cap">
            <span className="st-cap__label">Épreuve</span>
            <span className="st-cap__value">
              <span data-bind="module.index">{prog.index}</span>
              {prog.total > prog.index ? (
                <><span className="st-cap__value-dim">/</span>
                <span className="st-cap__value-dim" data-bind="module.total">{prog.total}</span></>
              ) : null}
            </span>
          </span>
        ) : null}
      </div>

      <h2 className="st-title" data-bind="stream.tagline">
        {between ? 'La suite arrive' : empty ? 'Sois le premier autour du feu' : 'Prends ton téléphone et rejoins le feu'}
      </h2>

      {between ? (
        <p className="st-lead">Tu peux encore rejoindre : tu joues à partir de la prochaine question.</p>
      ) : null}

      <div className="st-count">
        {empty ? (
          <span className="st-count__dots" aria-hidden="true">
            <span className="st-count__dot" /><span className="st-count__dot" /><span className="st-count__dot" />
          </span>
        ) : (
          <span className="st-count__badge" aria-hidden="true"><PeopleIcon /></span>
        )}
        <span className="st-count__figures">
          <span className={`st-count__value${empty ? ' st-count__value--empty' : ''}`}
            data-bind="room.playerCount" data-testid="player-count" key={count}>
            {fmt(count)}
          </span>
          <span className="st-count__label">
            {empty ? "joueur pour l'instant" : count > 1 ? 'joueurs connectés' : 'joueur connecté'}
          </span>
        </span>
      </div>
    </div>
  );
}

// ============================================================
// S3 — Question en cours, puis révélation avec répartition
// ============================================================

// Libellé de la bonne réponse selon le module.
function revealText(reveal, current) {
  if (!reveal) return null;
  switch (reveal.type) {
    case 'quiz': {
      const opts = reveal.options || current?.options;
      if (Array.isArray(opts) && reveal.correctIndex in opts) return opts[reveal.correctIndex];
      return null;
    }
    case 'true_false': return reveal.correct ? 'Vrai' : 'Faux';
    case 'estimation': return fmt(reveal.target);
    default: return null; // vote : pas de bonne réponse, la répartition parle
  }
}

// Répartition par options (quiz, vrai/faux, vote) : une rangée par choix,
// barre de remplissage proportionnelle, décompte à droite.
function OptionBreakdown({ stats, correctIndex, leadingIndex }) {
  const total = Math.max(stats.total || 0, 1);
  return (
    <>
      {(stats.options || []).map((opt, i) => {
        const count = stats.tally?.[i] || 0;
        const pct = Math.round((count / total) * 100);
        const isCorrect = correctIndex === i;
        const isLeading = leadingIndex === i;
        return (
          <div key={i}
            className={`st-opt${isCorrect ? ' st-opt--correct' : ''}${isLeading ? ' st-opt--leading' : ''}`}
            data-state={isCorrect ? 'correct' : isLeading ? 'leading' : 'idle'}
            {...(isCorrect ? { 'data-bind': 'reveal.correct', 'data-testid': 'reveal-value' } : {})}
            style={{ '--om-to': `${pct}%`, animationDelay: `${i * 40}ms` }}>
            <span className="st-opt__fill" style={{ width: `${pct}%` }} aria-hidden="true" />
            <span className="st-opt__key" aria-hidden="true">
              {isCorrect ? <CheckIcon /> : KEYS[i] || i + 1}
            </span>
            <span className="st-opt__label">{opt}</span>
            <span className="st-opt__count">{count} · {pct}%</span>
          </div>
        );
      })}
    </>
  );
}

function QuestionStage({ g }) {
  const current = g.current || {};
  const reveal = g.reveal;
  const revealed = !!reveal;
  const timeLeft = g.tick?.timeLeft;
  const answers = revealed ? (reveal.stats?.total ?? 0) : (g.tick?.answers ?? 0);
  const prog = g.room?.progression;
  const meta = current.meta;
  const urgent = !revealed && typeof timeLeft === 'number' && timeLeft > 0 && timeLeft <= 5;
  const over = !revealed && timeLeft === 0;
  const options = Array.isArray(current.options) ? current.options : [];
  const stats = reveal?.stats;
  const answer = revealText(reveal, current);

  // Option en tête d'un vote (aucune bonne réponse) : mise en avant en mousse.
  let leadingIndex = -1;
  if (revealed && reveal.type === 'vote' && Array.isArray(stats?.tally)) {
    leadingIndex = stats.tally.reduce((best, v, i, arr) => (v > arr[best] ? i : best), 0);
  }

  return (
    <div className="stream__stage" data-state={revealed ? 'revealed' : urgent ? 'live urgent' : 'live'}>
      <div className="st-caps">
        <span className="st-cap st-cap--live">
          <span className="st-cap__dot st-cap__dot--still" aria-hidden="true" />
          <span className="st-cap__label st-cap__label--live">{meta?.name || 'Épreuve'}</span>
        </span>
        {prog?.index ? (
          <span className="st-cap">
            <span className="st-cap__label">Épreuve</span>
            <span className="st-cap__value">
              <span data-bind="module.index">{prog.index}</span>
              {prog.total > prog.index ? (
                <><span className="st-cap__value-dim">/</span>
                <span className="st-cap__value-dim" data-bind="module.total">{prog.total}</span></>
              ) : null}
            </span>
          </span>
        ) : null}
        <span className="st-cap">
          <span className="st-cap__icon" aria-hidden="true"><PeopleIcon size={28} stroke="var(--c-ink-3)" /></span>
          <span className="st-cap__value" data-bind="reveal.stats.total" data-testid="answers-count">
            {fmt(answers)}
          </span>
        </span>
        {revealed ? (
          <span className="st-cap st-cap--closed">
            <span className="st-cap__label st-cap__label--muted">Manche close</span>
          </span>
        ) : null}
      </div>

      {/* Repère stable : le contrat réserve `question-text` à la surface joueur et
          `stream-question` au stream — le mockup utilisait le premier des deux. */}
      <p className={`st-question${revealed ? ' st-question--revealed' : ''}`}
        data-bind="module.text" data-testid="stream-question">
        {current.text || ''}
      </p>

      {/* Question en cours : options nues + anneau de chrono. */}
      {!revealed ? (
        <>
          <div className={`st-chrono${urgent ? ' st-chrono--urgent' : ''}${over ? ' st-chrono--over' : ''}`}
            role="timer" aria-label={`Temps restant ${timeLeft ?? 0} secondes`}>
            <span className="st-chrono__value" data-bind="tick.timeLeft">
              {typeof timeLeft === 'number' ? timeLeft : '—'}
            </span>
          </div>
          {options.length > 0 ? (
            <div className="st-options" data-bind="module.options">
              {options.map((opt, i) => (
                <div className="st-opt" key={i} data-state="idle" style={{ animationDelay: `${i * 40}ms` }}>
                  <span className="st-opt__key" aria-hidden="true">{KEYS[i] || i + 1}</span>
                  <span className="st-opt__label">{opt}</span>
                  <span className="st-opt__mark" aria-hidden="true" />
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        /* Révélation : la répartition prend toute la place. */
        <div className="st-stats" data-bind="reveal.stats" data-testid="stats-panel">
          {stats?.kind === 'numeric' ? (
            <>
              <div className="st-answer" data-bind="reveal.target" data-testid="reveal-value">
                <span className="st-answer__label">Bonne réponse</span>
                <span className="st-answer__value">{fmt(reveal.target)}</span>
              </div>
              <div className="st-facts">
                <div className="st-fact">
                  <span className="st-fact__label">Le plus proche</span>
                  <span className="st-fact__value st-fact__value--good" data-bind="reveal.stats.closest">
                    {fmt(stats.closest)}
                  </span>
                </div>
                <div className="st-fact">
                  <span className="st-fact__label">Moyenne</span>
                  <span className="st-fact__value" data-bind="reveal.stats.avg">{fmt(stats.avg)}</span>
                </div>
                <div className="st-fact">
                  <span className="st-fact__label">Médiane</span>
                  <span className="st-fact__value" data-bind="reveal.stats.median">{fmt(stats.median)}</span>
                </div>
              </div>
            </>
          ) : stats?.kind === 'options' ? (
            <OptionBreakdown
              stats={stats}
              correctIndex={reveal.type === 'quiz' ? reveal.correctIndex
                : reveal.type === 'true_false' ? (reveal.correct ? 0 : 1) : -1}
              leadingIndex={leadingIndex}
            />
          ) : answer != null ? (
            <div className="st-answer" data-testid="reveal-value">
              <span className="st-answer__label">Bonne réponse</span>
              <span className="st-answer__value">{answer}</span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ============================================================
// S4 — Podium
// ============================================================
function PodiumStage({ g }) {
  const rows = (g.podium && g.podium.length ? g.podium : g.leaderboard || []).slice(0, 3);
  const scored = rows.filter((r) => (r.score || 0) > 0);
  const prog = g.room?.progression;

  // Cas limite : partie close sans aucun score — pas de podium, message franc.
  if (!scored.length) {
    return (
      <div className="stream__stage stream__stage--centered" data-testid="stream-podium" data-state="podium empty">
        <div className="st-caps">
          <span className="st-cap st-cap--closed">
            <span className="st-cap__label st-cap__label--muted">Partie terminée</span>
          </span>
        </div>
        <h2 className="st-title">Aucun point marqué cette fois</h2>
        <p className="st-lead">
          Pas de podium : personne n'a répondu. Le salon reste ouvert — la prochaine partie
          peut commencer tout de suite.
        </p>
      </div>
    );
  }

  const slots = [
    { entry: rows[1], place: 'second', rank: 2 },
    { entry: rows[0], place: 'first', rank: 1 },
    { entry: rows[2], place: 'third', rank: 3 },
  ].filter((s) => s.entry);

  return (
    <div className="stream__stage" data-testid="stream-podium" data-state="podium">
      <div className="st-caps">
        <span className="st-cap st-cap--live">
          <span className="st-cap__dot" aria-hidden="true" />
          <span className="st-cap__label st-cap__label--live">Partie terminée</span>
        </span>
        {prog?.total ? (
          <span className="st-cap">
            <span className="st-cap__label">Épreuves</span>
            <span className="st-cap__value" data-bind="module.total">{prog.total}</span>
          </span>
        ) : null}
      </div>

      <h2 className="st-title">Le podium</h2>

      <div className="st-podium" data-bind="podium">
        {slots.map(({ entry, place, rank }) => (
          <div className={`st-step st-step--${place}`} key={entry.id ?? rank}>
            {place === 'first' ? (
              <span className="st-step__crown" aria-hidden="true"><BrandMark size={48} ember /></span>
            ) : null}
            <p className="st-step__name" data-bind={`podium.${rank - 1}.pseudo`}>{entry.pseudo}</p>
            <p className="st-step__score" data-bind={`podium.${rank - 1}.score`}>{fmt(entry.score)}</p>
            <div className="st-step__block">
              <span className="st-step__rank">{entry.rank ?? rank}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
export function OverlayApp() {
  const token = new URLSearchParams(window.location.search).get('token');
  const g = useGame(token);

  if (!token || !g.connected) return null;

  const state = g.room?.state;
  const ended = state === 'ended' || (g.podium && g.podium.length);
  const inRound = g.current && (state === 'playing' || state === 'results');

  return (
    <div className={`stream${inRound && !ended ? ' stream--question' : ''}`}>
      {ended ? <PodiumStage g={g} /> : inRound ? <QuestionStage g={g} /> : <WaitingStage g={g} />}
      {/* QR + lien + code : permanents, quelle que soit la phase (contrat R8). */}
      <JoinPanel code={g.room?.code} />
    </div>
  );
}
