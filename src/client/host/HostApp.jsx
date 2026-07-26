// Surface ANIMATEUR — machine à états (login -> lobby -> live -> results).
// Un seul export nommé `HostApp`. Structure DOM et classes BEM reprises des mockups host-*.html.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Icon } from '../shared/icons.jsx';
import { useGame, store } from '../shared/useGame.js';
import { createRoom } from '../shared/net.js';
import { getSupabase } from '../shared/supabaseClient.js';
import './host.css';

const EMBLEM_SRC = '/assets/avatar-emblem-tipi.png';

const MODULE_TYPES = [
  { type: 'quiz', name: 'Quiz', icon: 'help-circle' },
  { type: 'truefalse', name: 'Vrai / Faux', icon: 'check-square' },
  { type: 'estimation', name: 'Estimation', icon: 'target' },
  { type: 'vote', name: 'Vote', icon: 'bar-chart-2' },
];

function formatScore(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('fr-FR');
}

function playerName(p, fallback = 'Joueur') {
  return (p && (p.name || p.pseudo || p.pseudonyme)) || fallback;
}

function playerId(p) {
  return p && (p.id || p.playerId || p.uid);
}

// Emblème avec repli sur l'icône flamme si l'asset ne charge pas.
function Emblem({ imgClass, iconName = 'flame' }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <Icon name={iconName} />;
  return <img className={imgClass} src={EMBLEM_SRC} alt="" onError={() => setFailed(true)} />;
}

// ============================================================
// ÉCRAN — Connexion animateur (host-login)
// ============================================================
function LoginScreen({ onEstablishRoom }) {
  const supabase = useMemo(() => getSupabase(), []);
  const [email, setEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const requestCode = useCallback(async (e) => {
    e.preventDefault();
    setError('');
    // Mode dev (Supabase non configuré) : entrée directe sans OTP.
    if (!supabase) {
      setBusy(true);
      try {
        await onEstablishRoom(undefined);
      } catch (err) {
        setError("Impossible de créer le salon. Réessayez.");
        setBusy(false);
      }
      return;
    }
    if (!email) { setError('Entrez votre adresse email.'); return; }
    setBusy(true);
    try {
      const { error: otpErr } = await supabase.auth.signInWithOtp({ email });
      if (otpErr) throw otpErr;
      setOtpSent(true);
    } catch (err) {
      setError("Envoi du code impossible. Vérifiez l'adresse.");
    } finally {
      setBusy(false);
    }
  }, [supabase, email, onEstablishRoom]);

  const verifyCode = useCallback(async (e) => {
    e.preventDefault();
    setError('');
    if (!otp) { setError('Entrez le code reçu par email.'); return; }
    setBusy(true);
    try {
      const { data, error: vErr } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' });
      if (vErr) throw vErr;
      const accessToken = data?.session?.access_token;
      await onEstablishRoom(accessToken);
    } catch (err) {
      setError('Code invalide ou expiré.');
      setBusy(false);
    }
  }, [supabase, email, otp, onEstablishRoom]);

  const primaryLabel = supabase ? 'Recevoir le code' : 'Entrer (mode animateur)';

  return (
    <main className="page page--login auth-card" role="main" aria-labelledby="auth-title">
      <span className="auth-card__emblem" aria-hidden="true">
        <Emblem imgClass="auth-card__emblem-img" />
      </span>
      <h1 className="auth-card__title" id="auth-title">Project Game Show</h1>
      <p className="auth-card__subtitle">Le plateau de jeu autour du feu. Connectez-vous pour animer votre partie.</p>

      {!otpSent ? (
        <form onSubmit={requestCode} noValidate>
          <div className="field">
            <label className="field__label" htmlFor="host-email">Adresse email de l'animateur</label>
            <div className="field__control">
              <span className="field__icon" aria-hidden="true">
                <Icon name="log-in" />
              </span>
              <input
                className="field__input"
                id="host-email"
                type="email"
                name="email"
                placeholder="vous@exemple.fr"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
              />
            </div>
          </div>
          <button className="button button--primary button--block" type="submit" disabled={busy}>
            {primaryLabel}
            <Icon name="arrow-right" />
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode} noValidate>
          <div className="field">
            <label className="field__label" htmlFor="host-otp">Code reçu par email</label>
            <div className="field__control">
              <span className="field__icon" aria-hidden="true">
                <Icon name="check-square" />
              </span>
              <input
                className="field__input"
                id="host-otp"
                type="text"
                name="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                disabled={busy}
                autoFocus
              />
            </div>
          </div>
          <button className="button button--primary button--block" type="submit" disabled={busy}>
            Valider le code
            <Icon name="arrow-right" />
          </button>
        </form>
      )}

      {error ? <p className="auth-card__error" role="alert">{error}</p> : null}
      <p className="auth-card__note">Un seul animateur — accès par code email (OTP).</p>
    </main>
  );
}

// ============================================================
// Liens overlays OBS (partagé lobby/live)
// ============================================================
function OverlayLinks({ overlayToken }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const [copied, setCopied] = useState('');
  const links = [
    { key: 'question', label: 'Question', url: `${origin}/overlay/question?token=${overlayToken}` },
    { key: 'leaderboard', label: 'Classement', url: `${origin}/overlay/leaderboard?token=${overlayToken}` },
    { key: 'podium', label: 'Podium', url: `${origin}/overlay/podium?token=${overlayToken}` },
  ];
  const copy = async (key, url) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(key);
      setTimeout(() => setCopied(''), 1600);
    } catch { /* clipboard indisponible */ }
  };
  return (
    <section className="overlay-links" aria-label="Liens overlays OBS">
      <h2 className="overlay-links__title">
        <Icon name="eye" /> Overlays OBS
      </h2>
      <ul className="overlay-links__list">
        {links.map((l) => (
          <li className="overlay-links__row" key={l.key}>
            <span className="overlay-links__label">{l.label}</span>
            <span className="overlay-links__url" title={l.url}>{l.url}</span>
            <button className="overlay-links__copy" type="button" onClick={() => copy(l.key, l.url)}>
              <Icon name={copied === l.key ? 'check' : 'save'} />
              {copied === l.key ? 'Copié' : 'Copier'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ============================================================
// ÉCRAN — Salon d'attente (host-lobby)
// ============================================================
function LobbyScreen({ code, playerCount, players, overlayToken, onStartModule }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const joinUrl = `${origin}/play?code=${code || ''}`;
  const [qr, setQr] = useState('');
  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!code) { setQr(''); return; }
    QRCode.toDataURL(joinUrl, { margin: 1, width: 260 })
      .then((url) => { if (alive) setQr(url); })
      .catch(() => { if (alive) setQr(''); });
    return () => { alive = false; };
  }, [code, joinUrl]);

  const launch = () => {
    if (!picking) { setPicking(true); return; }
    const type = selected || MODULE_TYPES[0].type;
    onStartModule(type);
  };

  return (
    <div className="page">
      <header className="topbar">
        <nav className="topbar__brand" aria-label="Marque">
          <span className="topbar__emblem" aria-hidden="true">
            <Emblem imgClass="topbar__emblem-img" />
          </span>
          <span className="topbar__name">Project Game Show</span>
        </nav>
        <span className="status-pill">
          <span className="status-pill__dot" aria-hidden="true"></span>
          En attente
        </span>
      </header>

      <main className="lobby" role="main">
        <section className="join-card" aria-labelledby="join-label">
          <p className="join-card__label" id="join-label">Code de la salle</p>
          <p className="join-card__code">{code || '—'}</p>
          <div className="qr-plate" role="img" aria-label={`QR code de la salle ${code || ''}`}>
            {qr ? (
              <img className="qr-plate__img" src={qr} alt="" />
            ) : (
              <span className="qr-plate__icon" aria-hidden="true">
                <Icon name="qr-code" />
              </span>
            )}
          </div>
          <p className="join-card__hint">
            Scannez ou entrez le code sur <span className="join-card__url">{origin.replace(/^https?:\/\//, '')}/play</span>
          </p>
        </section>

        <div className="lobby__side">
          <div className="count-card">
            <span className="count-card__icon" aria-hidden="true">
              <Icon name="users" />
            </span>
            <div>
              <div className="count-card__value">{playerCount}</div>
              <div className="count-card__label">joueurs connectés</div>
            </div>
          </div>

          <section className="flock" aria-label="Joueurs qui rejoignent">
            <h2 className="flock__title">Ils arrivent au feu</h2>
            {players.length === 0 ? (
              <p className="flock__empty">En attente des premiers joueurs…</p>
            ) : (
              <ul className="flock__list">
                {players.map((p, i) => (
                  <li className="flock__chip" key={playerId(p) || i}>{playerName(p)}</li>
                ))}
              </ul>
            )}
          </section>

          {picking ? (
            <section className="module-picker" aria-label="Choix du module">
              <h2 className="module-picker__title">Quel module lancer ?</h2>
              <div className="module-picker__grid">
                {MODULE_TYPES.map((m) => (
                  <button
                    key={m.type}
                    className="module-picker__option"
                    type="button"
                    aria-pressed={selected === m.type}
                    onClick={() => setSelected(m.type)}
                  >
                    <Icon name={m.icon} />
                    {m.name}
                  </button>
                ))}
              </div>
              <button className="button button--primary button--block button--lg" type="button" onClick={launch}>
                <Icon name="play" />
                Lancer {selected ? MODULE_TYPES.find((m) => m.type === selected).name : 'le module'}
              </button>
            </section>
          ) : (
            <button className="button button--primary button--block button--lg" type="button" onClick={launch}>
              <Icon name="play" />
              Lancer la partie
            </button>
          )}

          {overlayToken ? <OverlayLinks overlayToken={overlayToken} /> : null}
        </div>
      </main>
    </div>
  );
}

// ============================================================
// Révélation de la bonne réponse (dérivée selon le type)
// ============================================================
function revealText(reveal, current) {
  if (!reveal) return null;
  if (reveal.correct != null && typeof reveal.correct !== 'boolean') return String(reveal.correct);
  if (typeof reveal.correct === 'boolean') return reveal.correct ? 'Vrai' : 'Faux';
  if (reveal.target != null) return String(reveal.target);
  if (reveal.correctIndex != null) {
    const opt = current && current.options && current.options[reveal.correctIndex];
    return opt != null ? String(opt) : `Réponse ${reveal.correctIndex + 1}`;
  }
  if (Array.isArray(reveal.tally) && reveal.tally.length) {
    const best = reveal.tally.reduce((a, b) => ((b.count || 0) > (a.count || 0) ? b : a));
    return best.label != null ? String(best.label) : String(best.value ?? '');
  }
  return null;
}

// ============================================================
// ÉCRAN — Pilotage en direct (host-live)
// ============================================================
function LiveScreen({ g, code, onShowResults }) {
  const [adjustOpen, setAdjustOpen] = useState(false);
  const room = g.room || {};
  const current = g.current;
  const tick = g.tick;
  const paused = room.state === 'paused';
  const progression = room.progression || {};
  const progIndex = progression.index != null ? progression.index : 1;
  const progTotal = progression.total || 12;
  const top5 = (g.leaderboard || []).slice(0, 5);
  const rt = revealText(g.reveal, current);
  const moduleName = (current && current.meta && current.meta.name) || 'Épreuve';

  return (
    <div className="page page--live">
      <header className="live-header">
        <nav className="live-header__brand" aria-label="Salon">
          <span className="live-header__emblem" aria-hidden="true">
            <Emblem imgClass="live-header__emblem-img" />
          </span>
          <span className="live-header__room">Salon {code}</span>
        </nav>
        <div className="live-header__stats">
          {paused ? (
            <span className="stat-chip stat-chip--paused">
              <span className="stat-chip__dot" aria-hidden="true"></span>
              En pause
            </span>
          ) : (
            <span className="stat-chip stat-chip--live">
              <span className="stat-chip__dot" aria-hidden="true"></span>
              En direct
            </span>
          )}
          <span className="stat-chip">
            <Icon name="users" />
            {room.playerCount || 0} joueurs
          </span>
          <span className="stat-chip stat-chip--progress">
            <Icon name="bar-chart-2" />
            Épreuve {progIndex} / {progTotal}
          </span>
        </div>
      </header>

      <main className="live-body" role="main">
        <section className="hero" aria-labelledby="hero-question">
          <span className="hero__tag">
            <Icon name="sparkles" />
            {moduleName}
          </span>
          <h1 className="hero__question" id="hero-question">
            {current && current.text ? current.text : 'En attente de la question…'}
          </h1>

          {rt ? (
            <div className="reveal" role="status">
              <span className="reveal__label">
                <Icon name="check" /> Bonne réponse
              </span>
              <span className="reveal__value">{rt}</span>
            </div>
          ) : null}

          <div className="hero__meters">
            <div className="hero__signature">
              <span className="hero__count">{tick && tick.answers != null ? tick.answers : 0}</span>
              <span className="hero__count-label">réponses reçues</span>
            </div>
            <div className="timer" role="timer" aria-label={`Temps restant ${tick && tick.timeLeft != null ? tick.timeLeft : 0} secondes`}>
              <span className="timer__value">
                {tick && tick.timeLeft != null ? tick.timeLeft : 0}
                <span className="timer__unit">s</span>
              </span>
              <span className="timer__label">
                <Icon name="clock" />
                temps restant
              </span>
            </div>
          </div>
        </section>

        <aside className="leaderboard" aria-label="Classement en direct">
          <h2 className="leaderboard__title">
            <Icon name="trophy" />
            Top 5 en direct
          </h2>
          {top5.length === 0 ? (
            <p className="leaderboard__empty">Aucun score pour l'instant.</p>
          ) : (
            <ol className="leaderboard__list">
              {top5.map((p, i) => (
                <li
                  className={`leaderboard__row${i === 0 ? ' leaderboard__row--lead' : ''}`}
                  key={playerId(p) || i}
                >
                  <span className="leaderboard__rank">{i + 1}</span>
                  <span className="leaderboard__name">{playerName(p)}</span>
                  <span className="leaderboard__score">{formatScore(p.score)}</span>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </main>

      {adjustOpen ? (
        <div className="adjust-panel" role="dialog" aria-label="Bonus / Malus">
          <div className="adjust-panel__head">
            <h2 className="adjust-panel__title">
              <Icon name="gift" /> Bonus / Malus
            </h2>
            <button className="adjust-panel__close" type="button" aria-label="Fermer" onClick={() => setAdjustOpen(false)}>
              <Icon name="x" />
            </button>
          </div>
          {(g.leaderboard || []).length === 0 ? (
            <p className="adjust-panel__empty">Aucun joueur à ajuster.</p>
          ) : (
            <ul className="adjust-panel__list">
              {(g.leaderboard || []).map((p, i) => (
                <li className="adjust-row" key={playerId(p) || i}>
                  <span className="adjust-row__name">{playerName(p)}</span>
                  <button
                    className="adjust-row__btn adjust-row__btn--minus"
                    type="button"
                    aria-label={`Retirer 100 points à ${playerName(p)}`}
                    onClick={() => g.emit('host:adjustScore', { playerId: playerId(p), delta: -100 })}
                  >
                    <Icon name="x" />
                  </button>
                  <button
                    className="adjust-row__btn adjust-row__btn--plus"
                    type="button"
                    aria-label={`Ajouter 100 points à ${playerName(p)}`}
                    onClick={() => g.emit('host:adjustScore', { playerId: playerId(p), delta: 100 })}
                  >
                    <Icon name="plus" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <nav className="control-bar" aria-label="Contrôles animateur">
        <button className="button button--primary" type="button" onClick={() => g.emit('host:reveal')}>
          <Icon name="eye" />
          Afficher les résultats
        </button>
        <button className="button button--forest" type="button" onClick={() => g.emit('host:nextModule')}>
          <Icon name="skip-forward" />
          Passer à la suivante
        </button>
        <button className="button button--ghost" type="button" onClick={() => g.emit('host:triggerEvent')}>
          <Icon name="zap" />
          Événements
        </button>
        <button
          className="button button--ghost"
          type="button"
          aria-pressed={adjustOpen}
          onClick={() => setAdjustOpen((v) => !v)}
        >
          <Icon name="gift" />
          Bonus / Malus
        </button>
        <span className="control-bar__spacer"></span>
        <button className="button button--outline" type="button" onClick={onShowResults}>
          <Icon name="trophy" />
          Voir le classement
        </button>
        {paused ? (
          <button className="button button--outline" type="button" onClick={() => g.emit('host:resume')}>
            <Icon name="play" />
            Reprendre
          </button>
        ) : (
          <button className="button button--outline" type="button" onClick={() => g.emit('host:pause')}>
            <Icon name="pause" />
            Pause
          </button>
        )}
      </nav>
    </div>
  );
}

// ============================================================
// ÉCRAN — Classement / podium (host-results)
// ============================================================
function ResultsScreen({ g, onNextModule, onEndGame, onBack, canBack }) {
  const rows = (g.podium && g.podium.length ? g.podium : g.leaderboard) || [];
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3, 8);
  const first = top3[0];
  const second = top3[1];
  const third = top3[2];

  const Slot = ({ p, rank, modifier, crown }) => {
    if (!p) return <div className={`podium__slot ${modifier}`} aria-hidden="true"><div className="podium__step"><span className="podium__rank">{rank}</span></div></div>;
    return (
      <div className={`podium__slot ${modifier}`}>
        {crown ? (
          <span className="podium__crown" aria-hidden="true"><Icon name="trophy" /></span>
        ) : null}
        <div className="podium__name">{playerName(p)}</div>
        <div className="podium__score">{formatScore(p.score)} pts</div>
        <div className="podium__step"><span className="podium__rank">{rank}</span></div>
      </div>
    );
  };

  return (
    <div className="page page--results">
      <main className="results" role="main" aria-labelledby="results-title">
        <h1 className="results__title" id="results-title">Classement</h1>

        <section className="podium" aria-label="Podium Top 3">
          <Slot p={second} rank={2} modifier="podium__slot--second" />
          <Slot p={first} rank={1} modifier="podium__slot--first" crown />
          <Slot p={third} rank={3} modifier="podium__slot--third" />
        </section>

        {rest.length > 0 ? (
          <ol className="rank-list" aria-label="Rangs 4 à 8">
            {rest.map((p, i) => (
              <li className="rank-list__row" key={playerId(p) || i}>
                <span className="rank-list__rank">{i + 4}</span>
                <span className="rank-list__name">{playerName(p)}</span>
                <span className="rank-list__score">{formatScore(p.score)}</span>
              </li>
            ))}
          </ol>
        ) : null}

        <div className="action-row">
          {canBack ? (
            <button className="button button--outline" type="button" onClick={onBack}>
              <Icon name="chevron-right" />
              Retour au direct
            </button>
          ) : null}
          <button className="button button--primary" type="button" onClick={onNextModule}>
            Module suivant
            <Icon name="arrow-right" />
          </button>
          <button className="button button--outline-danger" type="button" onClick={onEndGame}>
            <Icon name="x" />
            Terminer la partie
          </button>
        </div>
      </main>
    </div>
  );
}

// ============================================================
// HOSTAPP — orchestrateur / machine à états
// ============================================================
export function HostApp() {
  const [session, setSession] = useState(() => store.load('host') || null);
  const hostToken = session ? session.hostToken : null;
  const [showResults, setShowResults] = useState(false);

  const g = useGame(hostToken);

  // Reprise d'un salon existant : rien à faire de plus, session est chargée au montage.
  // Création d'un salon après authentification (ou en mode dev).
  const establishRoom = useCallback(async (accessToken) => {
    const res = await createRoom(accessToken);
    const next = { code: res.code, hostToken: res.hostToken, overlayToken: res.overlayToken };
    store.save('host', next);
    setSession(next);
  }, []);

  const startModule = useCallback((moduleType) => {
    g.emit('host:startModule', { moduleType });
  }, [g]);

  const endGame = useCallback(() => {
    g.emit('host:endGame');
  }, [g]);

  // --- Non authentifié : écran de connexion ---
  if (!hostToken) {
    return <LoginScreen onEstablishRoom={establishRoom} />;
  }

  const room = g.room;
  const state = room ? room.state : 'waiting';
  const code = (room && room.code) || session.code;
  const playerCount = room && room.playerCount != null ? room.playerCount : 0;
  const players = (room && room.players) || g.leaderboard || [];

  const connFlag = !g.connected ? (
    <span className="conn-flag" role="status">
      <span className="conn-flag__dot" aria-hidden="true"></span>
      Reconnexion…
    </span>
  ) : null;

  // --- Partie terminée OU classement demandé ---
  if (state === 'ended' || showResults) {
    return (
      <>
        <ResultsScreen
          g={g}
          onNextModule={() => { setShowResults(false); g.emit('host:nextModule'); }}
          onEndGame={endGame}
          onBack={() => setShowResults(false)}
          canBack={state !== 'ended'}
        />
        {connFlag}
      </>
    );
  }

  // --- En jeu / pause / résultats de module ---
  if (state === 'playing' || state === 'paused' || state === 'results') {
    return (
      <>
        <LiveScreen g={g} code={code} onShowResults={() => setShowResults(true)} />
        {connFlag}
      </>
    );
  }

  // --- Salon d'attente (waiting / room pas encore reçue) ---
  return (
    <>
      <LobbyScreen
        code={code}
        playerCount={playerCount}
        players={players}
        overlayToken={session.overlayToken}
        onStartModule={startModule}
      />
      {connFlag}
    </>
  );
}
