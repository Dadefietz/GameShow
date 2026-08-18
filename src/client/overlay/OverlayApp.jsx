// Surface OVERLAY — deux modes, déterminés par le chemin :
//  - /overlay (sans segment) : PAGE STREAM (R8) — scène opaque qui suit l'état du
//    salon, avec QR + lien + code permanents et répartition des réponses à chaque
//    fin de chrono. C'est la vue à diffuser telle quelle.
//  - /overlay/question | /overlay/leaderboard | /overlay/podium : overlays OBS
//    TRANSPARENTS (sources navigateur posées sur le live), avec mode aperçu (?preview=1).
// Le token vient de la query (?token=...). Aucun bouton, aucune interaction.
import React, { useLayoutEffect, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useGame } from '../shared/useGame.js';
import { Icon } from '../shared/icons.jsx';
import './overlay.css';

const nf = new Intl.NumberFormat('fr-FR');
const fmt = (n) => (typeof n === 'number' && Number.isFinite(n) ? nf.format(n) : '—');

// Type d'overlay depuis le dernier segment du chemin.
function overlayType() {
  const seg = window.location.pathname.split('/').filter(Boolean).pop();
  if (seg === 'overlay') return 'stream'; // /overlay sans segment = page stream (R8)
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
  const type = overlayType();

  // Fond TRANSPARENT pour OBS — appliqué UNIQUEMENT sur la page overlay (inline = priorité max),
  // pour ne jamais fuiter sur les autres surfaces (login/lobby/joueur) via le bundle CSS partagé.
  // useLayoutEffect : fond transparent + échelle appliqués AVANT le premier rendu
  // (aucun flash de canvas non mis à l'échelle en aperçu).
  useLayoutEffect(() => {
    if (type === 'stream') return undefined; // la page stream est une scène opaque normale
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
  if (type === 'stream') {
    if (!g.connected) return null;
    return <StreamPage g={g} />;
  }
  if (!g.connected && !preview) return null;

  if (type === 'leaderboard') return <LeaderboardOverlay g={g} preview={preview} />;
  if (type === 'podium') return <PodiumOverlay g={g} preview={preview} />;
  return <QuestionOverlay g={g} preview={preview} />;
}

// ============================================================
// PAGE STREAM (R8) — identique dans l'esprit à la page joueur, avec :
//  1. QR code + lien + code du salon affichés EN PERMANENCE ;
//  2. à chaque fin de chrono, la répartition des réponses (stats de l'animateur)
//     à la place du feedback points/places du joueur.
// ============================================================

// Répartition des réponses (payload reveal.stats du serveur).
function StreamStats({ stats }) {
  if (!stats) return null;
  if (stats.kind === 'options') {
    const total = Math.max(stats.total, 1);
    return (
      <div className="stats-panel" role="status" data-testid="stats-panel" aria-label="Répartition des réponses">
        {(stats.options || []).map((opt, i) => {
          const count = stats.tally?.[i] || 0;
          const pct = Math.round((count / total) * 100);
          return (
            <div className="stats-panel__row" key={i}>
              <span className="stats-panel__label">{opt}</span>
              <span className="stats-panel__bar">
                <span className="stats-panel__fill" style={{ width: `${pct}%` }} />
              </span>
              <span className="stats-panel__count">{count} · {pct}%</span>
            </div>
          );
        })}
      </div>
    );
  }
  if (stats.kind === 'numeric') {
    return (
      <div className="stats-panel" role="status" data-testid="stats-panel" aria-label="Répartition des réponses">
        <div className="stats-panel__facts">
          <span className="stats-panel__fact"><strong>{stats.total}</strong> réponses</span>
          <span className="stats-panel__fact">Moyenne <strong>{stats.avg != null ? fmt(stats.avg) : '—'}</strong></span>
          <span className="stats-panel__fact">Médiane <strong>{stats.median != null ? fmt(stats.median) : '—'}</strong></span>
          <span className="stats-panel__fact">Plus proche <strong>{stats.closest != null ? fmt(stats.closest) : '—'}</strong></span>
        </div>
      </div>
    );
  }
  return null;
}

// Panneau permanent : QR + lien + code du salon.
function JoinPanel({ code }) {
  const origin = window.location.origin;
  const joinUrl = `${origin}/play?code=${code || ''}`;
  const [qr, setQr] = useState('');

  useEffect(() => {
    let alive = true;
    if (!code) { setQr(''); return undefined; }
    QRCode.toDataURL(joinUrl, { margin: 1, width: 220 })
      .then((url) => { if (alive) setQr(url); })
      .catch(() => { if (alive) setQr(''); });
    return () => { alive = false; };
  }, [code, joinUrl]);

  return (
    <aside className="join-panel" aria-label="Rejoindre la partie">
      {qr ? (
        <img className="join-panel__qr" src={qr} alt={`QR code du salon ${code || ''}`} />
      ) : (
        <span className="join-panel__qr join-panel__qr--empty" aria-hidden="true">
          <Icon name="qr-code" />
        </span>
      )}
      <div className="join-panel__meta">
        <span className="join-panel__url">{origin.replace(/^https?:\/\//, '')}/play</span>
        <span className="join-panel__label">Code du salon</span>
        <span className="join-panel__code" data-testid="stream-room-code">{code || '—'}</span>
      </div>
    </aside>
  );
}

function StreamWaiting({ g }) {
  return (
    <div className="stage stage--waiting">
      <span className="stage__flame" aria-hidden="true"><Icon name="flame" /></span>
      <h1 className="stage__title">La partie va commencer</h1>
      <p className="stage__count">
        <Icon name="users" />
        {fmt(g.room?.playerCount || 0)} joueurs connectés
      </p>
    </div>
  );
}

function StreamQuestion({ g }) {
  const current = g.current || {};
  const timeLeft = g.tick?.timeLeft;
  const answers = g.tick?.answers ?? 0;
  const meta = current.meta;
  const prog = g.room?.progression;
  const answer = revealText(g.reveal, current);
  const revealed = !!g.reveal;
  const options = Array.isArray(current.options) ? current.options : [];
  const keys = ['A', 'B', 'C', 'D', 'E', 'F'];

  return (
    <div className="stage stage--question">
      <span className="stage__tag">
        <Icon name={meta?.icon || 'flame'} />
        {meta?.name || 'Épreuve'}
        {prog?.index ? ` · Épreuve ${prog.index}${prog.total > prog.index ? `/${prog.total}` : ''}` : ''}
      </span>
      <h1 className="stage__question" data-testid="stream-question">{current.text || ''}</h1>

      {!revealed && options.length > 0 ? (
        <ul className="stage__options">
          {options.map((opt, i) => (
            <li className="stage__option" key={i}>
              <span className="stage__option-key">{keys[i] || i + 1}</span>
              {opt}
            </li>
          ))}
        </ul>
      ) : null}

      {revealed ? (
        <>
          {answer != null && (
            <p className="stage__answer">
              <Icon name="check" />
              <span>{answer}</span>
            </p>
          )}
          <StreamStats stats={g.reveal.stats} />
        </>
      ) : (
        <div className="stage__meters">
          <span className="stage__meter">
            <span className="stage__meter-value">{fmt(answers)}</span> réponses
          </span>
          <span className="stage__meter stage__meter--timer">
            <Icon name="clock" />
            {typeof timeLeft === 'number' ? `${timeLeft} s` : '—'}
          </span>
        </div>
      )}
    </div>
  );
}

function StreamPodium({ g }) {
  const top3 = (g.podium && g.podium.length ? g.podium : g.leaderboard || []).slice(0, 3);
  const slots = [
    { entry: top3[1], place: 'second', rank: 2 },
    { entry: top3[0], place: 'first', rank: 1 },
    { entry: top3[2], place: 'third', rank: 3 },
  ].filter((sl) => sl.entry);

  return (
    <div className="stage stage--podium">
      <h1 className="stage__title">
        <Icon name="flame" />
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

function StreamPage({ g }) {
  const state = g.room?.state;
  const ended = state === 'ended' || (g.podium && g.podium.length);
  const inRound = g.current && (state === 'playing' || state === 'results');

  return (
    <div className="stream">
      <main className="stream__stage">
        {ended ? <StreamPodium g={g} /> : inRound ? <StreamQuestion g={g} /> : <StreamWaiting g={g} />}
      </main>
      {/* QR + lien + code : permanents, quel que soit l'état du salon (R8). */}
      <JoinPanel code={g.room?.code} />
    </div>
  );
}
