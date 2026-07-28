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
  { type: 'true_false', name: 'Vrai / Faux', icon: 'check-square' },
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
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const requestLink = useCallback(async (e) => {
    e.preventDefault();
    setError('');
    // Repli dev (Supabase non configuré) : entrée directe.
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
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/host` },
      });
      if (otpErr) throw otpErr;
      setSent(true);
    } catch (err) {
      setError("Envoi du lien impossible. Vérifiez l'adresse.");
    } finally {
      setBusy(false);
    }
  }, [supabase, email, onEstablishRoom]);

  return (
    <main className="page page--login" role="main" aria-labelledby="auth-title">
      <div className="login-split">
      <section className="login-hero" aria-labelledby="hero-value-title">
        <span className="login-hero__eyebrow">
          <Icon name="sparkles" />
          Plateau de jeu en livestream
        </span>
        <h2 className="login-hero__title" id="hero-value-title">
          Anime ton propre jeu télévisé, en direct avec ta communauté.
        </h2>
        <p className="login-hero__lead">
          Tu présentes, tes spectateurs jouent depuis leur téléphone — et tu pilotes toute la partie depuis un seul écran.
        </p>
        <ul className="login-hero__features">
          <li className="login-hero__feature">
            <span className="login-hero__feature-icon"><Icon name="users" /></span>
            <span>Des dizaines de joueurs à la fois, <strong>sans compte ni installation</strong> : un code, un pseudo, c'est parti.</span>
          </li>
          <li className="login-hero__feature">
            <span className="login-hero__feature-icon"><Icon name="eye" /></span>
            <span>Des <strong>overlays transparents prêts pour OBS</strong> — question, classement et podium se posent sur ton live.</span>
          </li>
          <li className="login-hero__feature">
            <span className="login-hero__feature-icon"><Icon name="check-square" /></span>
            <span><strong>Quiz, Vrai/Faux, Estimation, Vote</strong> : compose tes propres questionnaires dans le Studio.</span>
          </li>
        </ul>
      </section>

      <div className="auth-card">
      <span className="auth-card__emblem" aria-hidden="true">
        <Emblem imgClass="auth-card__emblem-img" />
      </span>
      <h1 className="auth-card__title" id="auth-title">Project Game Show</h1>
      {sent ? (
        <>
          <p className="auth-card__subtitle">Un lien de connexion vient d'être envoyé à <strong>{email}</strong>.</p>
          <div className="auth-card__sent" role="status">
            <span className="auth-card__sent-icon" aria-hidden="true"><Icon name="check" /></span>
            <p>Ouvre ta boîte mail et clique sur le lien pour accéder à ton plateau. Tu peux fermer cette page.</p>
          </div>
          <button className="button button--ghost button--block" type="button" onClick={() => setSent(false)}>
            Utiliser une autre adresse
          </button>
        </>
      ) : (
        <>
          <p className="auth-card__subtitle">Le plateau de jeu de votre communauté. Connectez-vous pour animer votre partie.</p>
          <form onSubmit={requestLink} noValidate>
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
              {busy ? 'Envoi…' : (supabase ? 'Recevoir le lien de connexion' : 'Entrer (mode animateur)')}
              <Icon name="arrow-right" />
            </button>
          </form>
        </>
      )}

      {error ? <p className="auth-card__error" role="alert">{error}</p> : null}
      <p className="auth-card__note">Un seul animateur — accès par lien email.</p>

      <div className="auth-card__alt">
        <span className="auth-card__alt-text">Tu viens pour jouer, pas pour animer ?</span>
        <a className="auth-card__alt-link" href="/play">
          <Icon name="log-in" />
          Rejoindre une partie
          <Icon name="arrow-right" />
        </a>
      </div>
      </div>
      </div>
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
      <p className="overlay-links__help">
        Dans OBS : ajoute chaque lien comme <strong>Source navigateur</strong>, largeur <strong>1920</strong>, hauteur <strong>1080</strong>. Le fond est transparent (il se pose sur ton live). Le <strong>Classement</strong> et le <strong>Podium</strong> restent invisibles tant qu'il n'y a pas encore de scores — c'est normal. Clique <strong>Aperçu</strong> pour voir le rendu avec des données de démo.
      </p>
      <ul className="overlay-links__list">
        {links.map((l) => (
          <li className="overlay-links__row" key={l.key}>
            <span className="overlay-links__label">{l.label}</span>
            <span className="overlay-links__url" title={l.url}>{l.url}</span>
            <a className="overlay-links__open" href={`${l.url}&preview=1`} target="_blank" rel="noopener" title="Aperçu (données de démonstration)">
              <Icon name="eye" />
              <span className="overlay-links__open-label">Aperçu</span>
            </a>
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
// Menu de sortie unifié — une seule action visible, actions destructives
// regroupées derrière un menu avec confirmation en deux temps.
// ============================================================
function ExitMenu({ onCloseRoom, onLogout, onEndGame }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(null); // 'end' | 'close' | 'logout'
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setConfirm(null); }
    };
    const onEsc = (e) => { if (e.key === 'Escape') { setOpen(false); setConfirm(null); } };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [open]);

  // Deux temps : premier clic arme la confirmation, second clic exécute.
  const arm = (which, fn) => {
    if (confirm === which) { fn(); setOpen(false); setConfirm(null); }
    else setConfirm(which);
  };

  return (
    <div className="exit-menu" ref={ref}>
      <button
        className="button button--ghost button--sm"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => { setOpen((v) => !v); setConfirm(null); }}
      >
        <Icon name="menu" />
        Menu
        <Icon name="chevron-down" />
      </button>
      {open ? (
        <div className="exit-menu__pop" role="menu">
          {onEndGame ? (
            <button
              className={`exit-menu__item exit-menu__item--danger${confirm === 'end' ? ' is-armed' : ''}`}
              role="menuitem"
              type="button"
              onClick={() => arm('end', onEndGame)}
            >
              <Icon name={confirm === 'end' ? 'alert-triangle' : 'trophy'} />
              {confirm === 'end' ? 'Confirmer — terminer la partie' : 'Terminer la partie'}
            </button>
          ) : null}
          <button
            className={`exit-menu__item exit-menu__item--danger${confirm === 'close' ? ' is-armed' : ''}`}
            role="menuitem"
            type="button"
            onClick={() => arm('close', onCloseRoom)}
          >
            <Icon name={confirm === 'close' ? 'alert-triangle' : 'x'} />
            {confirm === 'close' ? 'Confirmer — fermer le salon' : 'Fermer le salon'}
          </button>
          <button
            className={`exit-menu__item${confirm === 'logout' ? ' is-armed' : ''}`}
            role="menuitem"
            type="button"
            onClick={() => arm('logout', onLogout)}
          >
            <Icon name="log-out" />
            {confirm === 'logout' ? 'Confirmer — déconnexion' : 'Déconnexion'}
          </button>
          {confirm ? (
            <p className="exit-menu__hint">Clique à nouveau pour confirmer, ou ailleurs pour annuler.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ============================================================
// Répartition des réponses EN DIRECT — visible par l'animateur seul.
// Alimente l'espace libre de la carte question pour piloter la partie.
// ============================================================
function AnswerDistribution({ current, distribution, answersCount }) {
  if (!current) return null;
  const type = current.type;
  const dist = distribution || {};
  const total = dist.total || answersCount || 0;

  if (type === 'estimation') {
    if (dist.kind !== 'numeric' || !dist.total) {
      return <p className="dist__empty">Les estimations s'afficheront ici, en direct.</p>;
    }
    return (
      <div className="dist dist--numeric" aria-label="Estimations reçues">
        <div className="dist__stat"><span className="dist__stat-val">{formatScore(dist.min)}</span><span className="dist__stat-lbl">min</span></div>
        <div className="dist__stat dist__stat--hero"><span className="dist__stat-val">{formatScore(dist.avg)}</span><span className="dist__stat-lbl">moyenne</span></div>
        <div className="dist__stat"><span className="dist__stat-val">{formatScore(dist.max)}</span><span className="dist__stat-lbl">max</span></div>
      </div>
    );
  }

  let options, showKey;
  if (type === 'true_false') { options = ['Faux', 'Vrai']; showKey = false; }
  else { options = current.options || []; showKey = true; }
  if (!options.length) return null;
  const counts = dist.counts || options.map(() => 0);
  const maxCount = Math.max(1, ...counts);

  return (
    <div className="dist" aria-label="Répartition des réponses">
      {options.map((opt, i) => {
        const c = counts[i] || 0;
        const pct = total ? Math.round((c / total) * 100) : 0;
        return (
          <div className="dist__row" key={i}>
            {showKey ? <span className="dist__key">{String.fromCharCode(65 + i)}</span> : null}
            <span className="dist__opt" title={String(opt)}>{opt}</span>
            <span className="dist__track">
              <span className="dist__fill" style={{ width: `${(c / maxCount) * 100}%` }} />
            </span>
            <span className="dist__count">{c}<span className="dist__pct">{pct}%</span></span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// ÉCRAN — Salon d'attente (host-lobby)
// ============================================================
function LobbyScreen({ code, playerCount, players, overlayToken, onStartModule, onLogout, onCloseRoom }) {
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
        <div className="topbar__end">
          <span className="status-pill">
            <span className="status-pill__dot" aria-hidden="true"></span>
            En attente
          </span>
          <ExitMenu onCloseRoom={onCloseRoom} onLogout={onLogout} />
        </div>
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
              <div className="count-card__value" key={playerCount}>{playerCount}</div>
              <div className="count-card__label">{playerCount > 1 ? 'joueurs connectés' : 'joueur connecté'}</div>
            </div>
          </div>

          {playerCount === 0 ? (
            <ol className="lobby-guide" aria-label="Comment lancer une partie">
              <li className="lobby-guide__step">
                <span className="lobby-guide__num">1</span>
                <span>Partage le <strong>code {code}</strong> ou le QR — tes joueurs rejoignent depuis leur téléphone.</span>
              </li>
              <li className="lobby-guide__step">
                <span className="lobby-guide__num">2</span>
                <span><strong>(Option)</strong> Prépare tes questions dans « Gérer mes questionnaires ».</span>
              </li>
              <li className="lobby-guide__step">
                <span className="lobby-guide__num">3</span>
                <span>Clique <strong>« Lancer la partie »</strong> et choisis un module.</span>
              </li>
            </ol>
          ) : (
            <section className="flock" aria-label="Joueurs qui rejoignent">
              <h2 className="flock__title">Ils rejoignent la partie</h2>
              <ul className="flock__list">
                {players.map((p, i) => (
                  <li className="flock__chip" key={playerId(p) || i}>{playerName(p)}</li>
                ))}
              </ul>
            </section>
          )}

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

          <a className="button button--forest button--block" href="/studio" target="_blank" rel="noopener">
            <Icon name="check-square" />
            Gérer mes questionnaires
          </a>

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
function LiveScreen({ g, code, onShowResults, onLogout, onCloseRoom, onEndGame }) {
  const [adjustOpen, setAdjustOpen] = useState(false);
  const room = g.room || {};
  const current = g.current;
  const tick = g.tick;
  const answersCount = tick && tick.answers != null ? tick.answers : 0;
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
            {room.playerCount || 0} {(room.playerCount || 0) > 1 ? 'joueurs' : 'joueur'}
          </span>
          <span className="stat-chip stat-chip--progress">
            <Icon name="bar-chart-2" />
            Épreuve {progIndex} / {progTotal}
          </span>
          <ExitMenu onCloseRoom={onCloseRoom} onLogout={onLogout} onEndGame={onEndGame} />
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

          {current ? (
            <div className="hero__dist" aria-label="Répartition des réponses (animateur)">
              <p className="hero__dist-title">
                <Icon name="bar-chart-2" />
                Répartition des réponses <span className="hero__dist-note">— visible par toi seul</span>
              </p>
              <AnswerDistribution current={current} distribution={g.distribution} answersCount={answersCount} />
            </div>
          ) : null}

          <div className="hero__meters">
            <div className="hero__signature">
              <span className="hero__count">{answersCount}</span>
              <span className="hero__count-label">{answersCount > 1 ? 'réponses reçues' : 'réponse reçue'}</span>
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
                  <span className="leaderboard__name" title={playerName(p)}>{playerName(p)}</span>
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
                  <span className="adjust-row__name" title={playerName(p)}>{playerName(p)}</span>
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
function ResultsScreen({ g, onNextModule, onEndGame, onBack, canBack, onLogout, onCloseRoom }) {
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
          <span className="action-row__spacer" />
          <ExitMenu onCloseRoom={onCloseRoom} onLogout={onLogout} onEndGame={onEndGame} />
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

  // Session Supabase persistante / magic link : si l'animateur est déjà authentifié
  // (rechargement de page, retour depuis l'email), on rouvre automatiquement SON salon
  // (le serveur redonne le salon existant du même compte — reconnexion #2).
  const supa = useMemo(() => getSupabase(), []);
  const establishing = useRef(false);
  useEffect(() => {
    if (!supa || session) return;
    let alive = true;
    const open = (token) => {
      if (!alive || !token || establishing.current) return;
      establishing.current = true;
      establishRoom(token).catch(() => {}).finally(() => { establishing.current = false; });
    };
    supa.auth.getSession().then(({ data }) => open(data?.session?.access_token));
    const { data: authSub } = supa.auth.onAuthStateChange((_e, s) => open(s?.access_token));
    return () => { alive = false; authSub?.subscription?.unsubscribe?.(); };
  }, [supa, session, establishRoom]);

  const startModule = useCallback((moduleType) => {
    g.emit('host:startModule', { moduleType });
  }, [g]);

  const endGame = useCallback(() => {
    g.emit('host:endGame');
  }, [g]);

  // Déconnexion animateur : efface la session locale + Supabase, revient au login.
  const logout = useCallback(() => {
    store.clear('host');
    setShowResults(false);
    setSession(null);
    if (supa) supa.auth.signOut().catch(() => {});
  }, [supa]);

  // Fermer le salon SANS se déconnecter : ferme le salon courant côté serveur, puis
  // efface la session de salon locale — l'effet de détection rouvre aussitôt un salon neuf.
  const closeRoom = useCallback(() => {
    g.emit('host:closeRoom');
    setTimeout(() => {
      store.clear('host');
      setShowResults(false);
      setSession(null);
    }, 250);
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
          onLogout={logout}
          onCloseRoom={closeRoom}
        />
        {connFlag}
      </>
    );
  }

  // --- En jeu / pause / résultats de module ---
  if (state === 'playing' || state === 'paused' || state === 'results') {
    return (
      <>
        <LiveScreen g={g} code={code} onShowResults={() => setShowResults(true)} onLogout={logout} onCloseRoom={closeRoom} onEndGame={endGame} />
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
        onLogout={logout}
        onCloseRoom={closeRoom}
      />
      {connFlag}
    </>
  );
}
