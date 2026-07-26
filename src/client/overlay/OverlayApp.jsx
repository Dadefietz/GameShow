// Surface OVERLAY OBS — source navigateur, fond transparent, display-only.
// Trois types déterminés par le chemin : /overlay/question | /overlay/leaderboard | /overlay/podium.
// Le token vient de la query (?token=...). Aucun bouton, aucune interaction.
import React from 'react';
import { useGame } from '../shared/useGame.js';
import { Icon } from '../shared/icons.jsx';
import './overlay.css';

const nf = new Intl.NumberFormat('fr-FR');
const fmt = (n) => (typeof n === 'number' && Number.isFinite(n) ? nf.format(n) : '—');

// Type d'overlay depuis le dernier segment du chemin.
function overlayType() {
  const seg = window.location.pathname.split('/').filter(Boolean).pop();
  return seg === 'leaderboard' || seg === 'podium' ? seg : 'question';
}

// Libellé de la bonne réponse selon le type de module révélé.
function revealText(reveal, current) {
  if (!reveal) return null;
  switch (reveal.type) {
    case 'quiz': {
      const opts = current?.options;
      if (Array.isArray(opts) && reveal.correctIndex in opts) return opts[reveal.correctIndex];
      return null;
    }
    case 'true_false':
      return reveal.correct ? 'Vrai' : 'Faux';
    case 'estimation':
      return fmt(reveal.target);
    case 'vote': {
      // Sondage d'opinion : pas de « bonne » réponse, on met en avant l'option en tête.
      const { tally, options } = reveal;
      if (Array.isArray(tally) && Array.isArray(options) && tally.length) {
        let best = 0;
        for (let i = 1; i < tally.length; i += 1) if (tally[i] > tally[best]) best = i;
        return options[best];
      }
      return null;
    }
    default:
      return null;
  }
}

function QuestionOverlay({ g }) {
  const answers = g.tick?.answers ?? 0;
  const timeLeft = g.tick?.timeLeft;
  const meta = g.current?.meta;
  const prog = g.room?.progression;
  const answer = revealText(g.reveal, g.current);

  return (
    <div className="overlay">
      <div className="plate">
        <div className="plate__body">
          <span className="tag">
            <Icon name={meta?.icon || 'flame'} className="tag__icon" />
            {meta?.name || 'Épreuve'}
            {prog?.index ? ` · Épreuve ${prog.index}${prog.total ? `/${prog.total}` : ''}` : ''}
          </span>
          <h1 className="question">{g.current?.text || ''}</h1>
          {answer != null && (
            <p className="answer">
              <Icon name="check" className="answer__icon" />
              <span className="answer__text">{answer}</span>
            </p>
          )}
        </div>

        <div className="stats">
          <div className="count">
            <span className="count__value">{fmt(answers)}</span>
            <span className="count__label">réponses</span>
          </div>
          <span className="timer">
            <Icon name="clock" className="timer__icon" />
            {typeof timeLeft === 'number' ? `${timeLeft} s` : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}

function LeaderboardOverlay({ g }) {
  const rows = (g.leaderboard || []).slice(0, 5);
  if (!rows.length) return <div className="overlay" />;

  return (
    <div className="overlay">
      <div className="board">
        <h1 className="board__title">
          <Icon name="trophy" className="board__title-icon" />
          Top 5
        </h1>
        <div className="rows">
          {rows.map((r, i) => {
            const rank = r.rank ?? i + 1;
            return (
              <div className={`row${rank === 1 ? ' row--leader' : ''}`} key={r.id ?? rank}>
                <span className="row__rank">{rank}</span>
                <span className="row__name">{r.pseudo}</span>
                <span className="row__score">{fmt(r.score)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PodiumOverlay({ g }) {
  const top3 = (g.podium && g.podium.length ? g.podium : g.leaderboard || []).slice(0, 3);
  if (!top3.length) return <div className="overlay" />;

  // Ordre visuel : 2e (gauche), 1er (centre, le plus haut), 3e (droite).
  const slots = [
    { entry: top3[1], place: 'second', rank: 2 },
    { entry: top3[0], place: 'first', rank: 1 },
    { entry: top3[2], place: 'third', rank: 3 },
  ].filter((s) => s.entry);

  return (
    <div className="overlay">
      <h1 className="title">
        <Icon name="flame" className="title__icon" />
        Podium
      </h1>
      <div className="podium">
        {slots.map(({ entry, place, rank }) => (
          <div className={`step step--${place}`} key={entry.id ?? rank}>
            <div className="step__card">
              {place === 'first' && <Icon name="trophy" className="step__crown" />}
              <span className="step__name">{entry.pseudo}</span>
              <span className="step__score">{fmt(entry.score)} pts</span>
            </div>
            <div className="step__block">
              <span className="step__rank">{entry.rank ?? rank}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OverlayApp() {
  const token = new URLSearchParams(window.location.search).get('token');
  const g = useGame(token);

  // Pas de token ou déconnecté : rendu vide (transparent) — c'est une source OBS par-dessus le jeu.
  if (!token || !g.connected) return null;

  const type = overlayType();
  if (type === 'leaderboard') return <LeaderboardOverlay g={g} />;
  if (type === 'podium') return <PodiumOverlay g={g} />;
  return <QuestionOverlay g={g} />;
}
