// Surface OVERLAY OBS — source navigateur, fond transparent, display-only.
// Trois types déterminés par le chemin : /overlay/question | /overlay/leaderboard | /overlay/podium.
// Le token vient de la query (?token=...). Aucun bouton, aucune interaction.
import React, { useEffect } from 'react';
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

// Données de DÉMONSTRATION — utilisées uniquement en mode Aperçu (?preview=1),
// pour que l'animateur voie à quoi ressemble l'overlay AVANT même qu'une partie
// n'ait démarré. En production OBS (sans preview), l'overlay reste piloté par les
// données réelles et invisible tant qu'il n'y a rien à afficher.
const DEMO_LEADERBOARD = [
  { id: 'demo1', pseudo: 'PixelNight', score: 1240, rank: 1 },
  { id: 'demo2', pseudo: 'Luna', score: 1110, rank: 2 },
  { id: 'demo3', pseudo: 'Marco', score: 980, rank: 3 },
  { id: 'demo4', pseudo: 'Zoé', score: 870, rank: 4 },
  { id: 'demo5', pseudo: 'Sam', score: 640, rank: 5 },
];
const DEMO_QUESTION = {
  text: 'En quelle année la télévision couleur est-elle arrivée en France ?',
  meta: { name: 'Quiz', icon: 'help-circle' },
  options: ['1967', '1972', '1959', '1980'],
};

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

function QuestionOverlay({ g, preview }) {
  const current = g.current || (preview ? DEMO_QUESTION : null);
  const answers = g.tick?.answers ?? (preview ? 128 : 0);
  const timeLeft = g.tick?.timeLeft ?? (preview ? 18 : undefined);
  const meta = current?.meta;
  const prog = g.room?.progression || (preview ? { index: 3, total: 10 } : null);
  const answer = revealText(g.reveal, g.current);

  return (
    <div className="overlay">
      <div className="plate">
        <div className="plate__body">
          <span className="tag">
            <Icon name={meta?.icon || 'flame'} className="tag__icon" />
            {meta?.name || 'Épreuve'}
            {prog?.index ? ` · Épreuve ${prog.index}${prog.total > prog.index ? `/${prog.total}` : ''}` : ''}
          </span>
          <h1 className="question">{current?.text || ''}</h1>
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

function LeaderboardOverlay({ g, preview }) {
  const live = g.leaderboard || [];
  const rows = (live.length ? live : (preview ? DEMO_LEADERBOARD : [])).slice(0, 5);
  // OBS : rien à afficher tant qu'aucun joueur n'a de score → overlay invisible (voulu).
  if (!rows.length) return <div className="overlay" />;

  return (
    <div className="overlay">
      {preview && !live.length ? <span className="preview-badge">Aperçu</span> : null}
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

function PodiumOverlay({ g, preview }) {
  const live = (g.podium && g.podium.length ? g.podium : g.leaderboard || []);
  const top3 = (live.length ? live : (preview ? DEMO_LEADERBOARD : [])).slice(0, 3);
  if (!top3.length) return <div className="overlay" />;

  // Ordre visuel : 2e (gauche), 1er (centre, le plus haut), 3e (droite).
  const slots = [
    { entry: top3[1], place: 'second', rank: 2 },
    { entry: top3[0], place: 'first', rank: 1 },
    { entry: top3[2], place: 'third', rank: 3 },
  ].filter((s) => s.entry);

  return (
    <div className="overlay">
      {preview && !live.length ? <span className="preview-badge">Aperçu</span> : null}
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
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const preview = params.get('preview') === '1';
  const g = useGame(token);

  // Fond TRANSPARENT pour OBS — appliqué UNIQUEMENT sur la page overlay (inline = priorité max),
  // pour ne jamais fuiter sur les autres surfaces (login/lobby/joueur) via le bundle CSS partagé.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.backgroundColor;
    const prevBody = body.style.backgroundColor;
    const prevOverflow = html.style.overflow;
    body.classList.add('overlay-page');
    html.style.backgroundColor = 'transparent';
    body.style.backgroundColor = 'transparent';
    html.style.overflow = 'hidden'; // canvas fixe 1920×1080 : pas de scroll en aperçu
    // Échelle « fit » du canvas 1920×1080 (letterbox) — 1 dans OBS réglé à 1920×1080.
    const applyScale = () => {
      const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080, 1);
      html.style.setProperty('--overlay-scale', String(s));
    };
    applyScale();
    window.addEventListener('resize', applyScale);
    return () => {
      window.removeEventListener('resize', applyScale);
      body.classList.remove('overlay-page');
      html.style.backgroundColor = prevHtml;
      body.style.backgroundColor = prevBody;
      html.style.overflow = prevOverflow;
      html.style.removeProperty('--overlay-scale');
    };
  }, []);

  // Pas de token : rien. Déconnecté : rendu vide (transparent) SAUF en mode Aperçu,
  // où l'on montre une démo même sans partie en cours (pour vérifier le rendu).
  if (!token) return null;
  if (!g.connected && !preview) return null;

  const type = overlayType();
  if (type === 'leaderboard') return <LeaderboardOverlay g={g} preview={preview} />;
  if (type === 'podium') return <PodiumOverlay g={g} preview={preview} />;
  return <QuestionOverlay g={g} preview={preview} />;
}
