// Surface ANIMATEUR — machine à états (login -> lobby -> live -> results).
// Un seul export nommé `HostApp`. Structure DOM et classes BEM reprises des mockups host-*.html.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Icon } from '../shared/icons.jsx';
import { useGame, store } from '../shared/useGame.js';
import { createRoom } from '../shared/net.js';
import { getSupabase } from '../shared/supabaseClient.js';
import { shouldPurgeHostSession } from '../shared/hostSession.js';
import { otpErrorMessage } from '../shared/authErrors.js';
import { BrandLoader } from '../shared/BrandLoader.jsx';
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
        options: {
          emailRedirectTo: `${window.location.origin}/host`,
          // Cet écran CONNECTE, il n'inscrit pas. Sans ce drapeau, Supabase traite la
          // demande comme une inscription et la refuse dès que les inscriptions
          // publiques sont fermées — y compris pour le compte de l'animateur.
          shouldCreateUser: false,
        },
      });
      if (otpErr) throw otpErr;
      setSent(true);
    } catch (err) {
      setError(otpErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [supabase, email, onEstablishRoom]);

  // Page de connexion animateur : la carte d'authentification SEULE. L'argumentaire
  // produit vit sur la page d'accueil joueur ('/') — ici, l'animateur vient se connecter.
  return (
    <main className="page page--login" role="main" aria-labelledby="auth-title">
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
      </div>
    </main>
  );
}

// ============================================================
// ÉCRAN — Accès refusé (403 not-host). Le serveur réserve la création de salon à
// l'animateur : un autre compte, même authentifié, doit le savoir explicitement.
// ============================================================
function DeniedScreen({ email, onLogout }) {
  return (
    <main className="page page--login" role="main" aria-labelledby="denied-title">
      <div className="auth-card" data-testid="denied-card">
        <span className="home-icon home-icon--warn" aria-hidden="true">
          <Icon name="alert-triangle" />
        </span>
        <h1 className="auth-card__title" id="denied-title">Accès réservé à l'animateur</h1>
        <p className="auth-card__subtitle">
          {email ? <>Le compte <strong>{email}</strong> n'est pas celui de l'animateur.</> : "Ce compte n'est pas celui de l'animateur."}
          {' '}La création de salon lui est réservée.
        </p>
        <a className="button button--primary button--block button--lg" href="/">
          <Icon name="log-in" />
          Rejoindre une partie en joueur
        </a>
        <button className="button button--ghost button--block" type="button" onClick={onLogout}>
          <Icon name="log-out" />
          Se déconnecter
        </button>
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
    // Page stream (R8) : scène complète qui suit l'état du salon — QR + lien + code
    // permanents, répartition des réponses à chaque fin de chrono.
    { key: 'stream', label: 'Page stream', url: `${origin}/overlay?token=${overlayToken}` },
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
            <span className="overlay-links__url" data-testid={l.key === 'stream' ? 'overlay-link' : undefined} title={l.url}>{l.url}</span>
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
// Menu « Changer de module » — bifurquer vers un autre type d'épreuve
// SANS repasser par le salon d'attente.
// ============================================================
function ModuleMenu({ currentType, onPick }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [open]);
  return (
    <div className="exit-menu" ref={ref}>
      <button className="button button--ghost" type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Icon name="bar-chart-2" />
        Changer de module
        <Icon name="chevron-down" />
      </button>
      {open ? (
        <div className="exit-menu__pop exit-menu__pop--up" role="menu">
          {MODULE_TYPES.map((m) => (
            <button
              key={m.type}
              className={`exit-menu__item${m.type === currentType ? ' exit-menu__item--current' : ''}`}
              role="menuitem"
              type="button"
              onClick={() => { setOpen(false); onPick(m.type); }}
            >
              <Icon name={m.icon} />
              {m.name}{m.type === currentType ? ' — en cours' : ''}
            </button>
          ))}
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
function LobbyScreen({ g, code, playerCount, players, overlayToken, onStartModule, onLogout, onCloseRoom }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const joinUrl = `${origin}/play?code=${code || ''}`;
  const [qr, setQr] = useState('');
  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState(null);
  // Configuration de séance (R5) : ordre aléatoire + sélection manuelle des questions.
  const [shuffle, setShuffle] = useState(true);
  const [banks, setBanks] = useState({});          // moduleType -> [{id,text}]
  const [checked, setChecked] = useState({});      // moduleType -> Set(ids)
  const [openBank, setOpenBank] = useState(null);  // moduleType déplié

  const pushSessionConfig = useCallback((nextShuffle, nextChecked) => {
    const selectedIds = {};
    for (const [t, set] of Object.entries(nextChecked)) {
      const bank = banks[t] || [];
      // Tout coché = pas de restriction (la sélection n'est envoyée que si partielle).
      if (set && bank.length && set.size < bank.length) selectedIds[t] = [...set];
    }
    g.emit('host:sessionConfig', { shuffle: nextShuffle, selected: selectedIds });
  }, [g, banks]);

  const toggleShuffle = () => {
    const next = !shuffle;
    setShuffle(next);
    pushSessionConfig(next, checked);
  };

  const toggleBank = (type) => {
    if (openBank === type) { setOpenBank(null); return; }
    setOpenBank(type);
    if (!banks[type]) {
      g.emit('host:getBank', { moduleType: type }, (list) => {
        setBanks((prev) => ({ ...prev, [type]: list || [] }));
        setChecked((prev) => ({ ...prev, [type]: new Set((list || []).map((q) => q.id)) }));
      });
    }
  };

  const toggleQuestion = (type, id) => {
    setChecked((prev) => {
      const set = new Set(prev[type] || []);
      if (set.has(id)) set.delete(id); else set.add(id);
      const next = { ...prev, [type]: set };
      pushSessionConfig(shuffle, next);
      return next;
    });
  };

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
          <p className="join-card__code" data-testid="room-code">{code || '—'}</p>
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
              <div className="count-card__value" data-testid="player-count" key={playerCount}>{playerCount}</div>
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

          <section className="session-config" aria-label="Configuration de la séance">
            <h2 className="session-config__title">
              <Icon name="shuffle" /> Séance
            </h2>
            <label className="session-config__toggle">
              <input type="checkbox" checked={shuffle} onChange={toggleShuffle} />
              Ordre des questions aléatoire
            </label>
            <div className="session-config__banks">
              {MODULE_TYPES.map((m) => {
                const list = banks[m.type] || [];
                const set = checked[m.type];
                return (
                  <div className="session-config__bank" key={m.type}>
                    <button
                      className="session-config__bank-head"
                      type="button"
                      aria-expanded={openBank === m.type}
                      onClick={() => toggleBank(m.type)}
                    >
                      <Icon name={m.icon} />
                      {m.name}
                      <span className="session-config__bank-count">
                        {set ? `${set.size}/${list.length}` : 'toutes'}
                      </span>
                      <Icon name="chevron-right" />
                    </button>
                    {openBank === m.type ? (
                      <ul className="session-config__questions">
                        {list.length === 0 ? (
                          <li className="session-config__empty">Chargement…</li>
                        ) : list.map((q) => (
                          <li key={q.id}>
                            <label className="session-config__question">
                              <input
                                type="checkbox"
                                checked={set ? set.has(q.id) : true}
                                onChange={() => toggleQuestion(m.type, q.id)}
                              />
                              {q.text}
                            </label>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          {picking ? (
            <section className="module-picker" aria-label="Choix du module">
              <h2 className="module-picker__title">Quel module lancer ?</h2>
              {playerCount === 0 ? (
                <p className="module-picker__warn" role="status">
                  <Icon name="users" />
                  Aucun joueur connecté — l'épreuve démarrera sans joueurs. Partage le code <strong>{code}</strong> d'abord si tu veux du monde.
                </p>
              ) : null}
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
function LiveScreen({ g, code, onShowResults, onLogout, onCloseRoom, onEndGame, onNextQuestion, onChangeModule }) {
  const [adjustOpen, setAdjustOpen] = useState(false);
  const room = g.room || {};
  const current = g.current;
  const tick = g.tick;
  const answersCount = tick && tick.answers != null ? tick.answers : 0;
  const progression = room.progression || {};
  const progIndex = progression.index != null ? progression.index : 1;
  const progTotal = progression.total || 0;
  const top5 = (g.leaderboard || []).slice(0, 5);
  // F3 — pas de « leader » surligné tant que personne n'a marqué.
  const hasScores = top5.some((p) => (p.score || 0) > 0);
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
          {room.state === 'results' ? (
            <span className="stat-chip stat-chip--results">
              <span className="stat-chip__dot" aria-hidden="true"></span>
              Résultats
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
            {/* B4 — total affiché seulement s'il dépasse l'index (pas de « 1/1 » trompeur). */}
            Épreuve {progIndex}{progTotal > progIndex ? ` / ${progTotal}` : ''}
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
              <span className="reveal__value" data-testid="reveal-value">{rt}</span>
            </div>
          ) : null}

          {current ? (
            <div className="hero__dist" data-testid="stats-panel" aria-label="Répartition des réponses (animateur)">
              <p className="hero__dist-title">
                <Icon name="bar-chart-2" />
                Répartition des réponses <span className="hero__dist-note">— visible par toi seul</span>
              </p>
              <AnswerDistribution current={current} distribution={g.distribution} answersCount={answersCount} />
            </div>
          ) : null}

          <div className="hero__meters">
            <div className="hero__signature">
              <span className="hero__count" data-testid="answers-count">{answersCount}</span>
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
                  className={`leaderboard__row${i === 0 && hasScores ? ' leaderboard__row--lead' : ''}`}
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
          Révéler maintenant
        </button>
        <button className="button button--forest" type="button" onClick={onNextQuestion}>
          <Icon name="skip-forward" />
          Question suivante
        </button>
        <ModuleMenu currentType={current && current.type} onPick={onChangeModule} />
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
      </nav>
    </div>
  );
}

// ============================================================
// ÉCRAN — Classement / podium (host-results)
// ============================================================
function ResultsScreen({ g, onNextModule, continueLabel, onEndGame, onBack, canBack, onLogout, onCloseRoom }) {
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
            {continueLabel || 'Question suivante'}
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
// ÉCRAN — Accueil animateur (écran STABLE après fermeture/expiration de salon)
// Rien ne s'ouvre tout seul ici : c'est l'animateur qui décide.
// ============================================================
function HomeScreen({ variant, onOpenRoom, opening, onLogout }) {
  const closed = variant === 'closed';
  return (
    <main className="page page--login" role="main" aria-labelledby="home-title">
      <div className="auth-card">
        <span className={`home-icon${closed ? '' : ' home-icon--warn'}`} aria-hidden="true">
          <Icon name={closed ? 'check' : 'clock'} />
        </span>
        <h1 className="auth-card__title" id="home-title">{closed ? 'Salon fermé' : 'Ton salon a expiré'}</h1>
        <p className="auth-card__subtitle">
          {closed
            ? 'Les joueurs ont été déconnectés. Tu restes connecté en tant qu’animateur.'
            : 'Le serveur a redémarré ou le salon est resté inactif. Tes questionnaires sont intacts — tu peux ouvrir un nouveau salon.'}
        </p>
        <button className="button button--primary button--block button--lg" type="button" onClick={onOpenRoom} disabled={opening}>
          <Icon name="play" />
          {opening ? 'Ouverture…' : 'Ouvrir un nouveau salon'}
        </button>
        <a className="button button--forest button--block" href="/studio">
          <Icon name="check-square" />
          Gérer mes questionnaires
        </a>
        <button className="button button--ghost button--block" type="button" onClick={onLogout}>
          <Icon name="log-out" />
          Déconnexion
        </button>
      </div>
    </main>
  );
}

// ============================================================
// HOSTAPP — orchestrateur / machine à états
// ============================================================
const HOST_ERROR_MESSAGES = {
  'no-question': 'Aucune question disponible pour ce module — vérifie tes questionnaires.',
  'start-failed': "Impossible de lancer l'épreuve. Réessaie.",
};

export function HostApp() {
  const [session, setSession] = useState(() => store.load('host') || null);
  const hostToken = session ? session.hostToken : null;
  const [showResults, setShowResults] = useState(false);
  // Écran stable post-fermeture : 'closed' (choix de l'animateur) | 'expired' (salon mort).
  const [home, setHome] = useState(null);
  const [opening, setOpening] = useState(false);
  const [toast, setToast] = useState(null);
  // Refus d'autorisation du serveur (403 not-host) : email du compte refusé, ou true.
  const [denied, setDenied] = useState(null);

  const g = useGame(hostToken);

  // Reprise d'un salon existant : rien à faire de plus, session est chargée au montage.
  // Création d'un salon après authentification (ou en mode dev). La session mémorisée
  // porte l'id du compte Supabase propriétaire : elle n'est JAMAIS réutilisable par un
  // autre compte sur le même navigateur (voir l'effet de cloisonnement ci-dessous).
  const establishRoom = useCallback(async (accessToken, ownerId) => {
    const res = await createRoom(accessToken);
    const next = {
      code: res.code,
      hostToken: res.hostToken,
      overlayToken: res.overlayToken,
      ownerId: ownerId || null,
    };
    store.save('host', next);
    setSession(next);
    setDenied(null);
  }, []);

  // Session Supabase persistante / magic link : si l'animateur est déjà authentifié
  // (rechargement de page, retour depuis l'email), on rouvre automatiquement SON salon
  // (le serveur redonne le salon existant du même compte). JAMAIS depuis l'écran
  // « Salon fermé » : là, seule une action explicite rouvre un salon.
  const supa = useMemo(() => getSupabase(), []);
  const establishing = useRef(false);
  // Évite le flash de l'écran de connexion pour un animateur déjà authentifié.
  const [authChecked, setAuthChecked] = useState(() => !getSupabase());
  useEffect(() => {
    if (!supa || session || home || denied) return;
    let alive = true;
    const open = (sess) => {
      const token = sess?.access_token;
      if (!alive || !token || establishing.current) return;
      establishing.current = true;
      establishRoom(token, sess?.user?.id)
        .catch((err) => {
          // Refus d'autorisation : on le DIT (403 not-host). Jamais d'écran muet.
          if (alive && err && err.message === 'not-host') setDenied(sess?.user?.email || true);
        })
        .finally(() => { establishing.current = false; });
    };
    supa.auth.getSession().then(({ data }) => {
      if (alive) setAuthChecked(true);
      open(data?.session);
    });
    const { data: authSub } = supa.auth.onAuthStateChange((_e, s) => open(s));
    return () => { alive = false; authSub?.subscription?.unsubscribe?.(); };
  }, [supa, session, home, denied, establishRoom]);

  // CLOISONNEMENT PAR COMPTE — la session animateur mémorisée dans CE navigateur
  // n'appartient qu'au compte Supabase qui l'a ouverte. Si le compte connecté change
  // (ou disparaît), la session locale est purgée immédiatement : un second compte ne
  // peut JAMAIS hériter du salon — ni du jeton d'animateur — laissé par le précédent.
  useEffect(() => {
    if (!supa) return undefined; // mode dev sans Supabase : rien à cloisonner
    let alive = true;
    const reconcile = (user) => {
      if (!alive) return;
      if (shouldPurgeHostSession(store.load('host'), user)) {
        store.clear('host');
        setSession(null);
        setShowResults(false);
      }
    };
    supa.auth.getSession().then(({ data }) => reconcile(data?.session?.user || null));
    const { data: sub } = supa.auth.onAuthStateChange((_e, s) => reconcile(s?.user || null));
    return () => { alive = false; sub?.subscription?.unsubscribe?.(); };
  }, [supa]);

  // Salon mort (redéploiement serveur, expiration) : on purge la session périmée et on
  // atterrit sur l'écran stable « salon expiré » — plus jamais d'interface figée.
  useEffect(() => {
    if (!g.fatal || !session) return;
    store.clear('host');
    setShowResults(false);
    setSession(null);
    setHome('expired');
  }, [g.fatal, session]);

  // Erreurs signalées par le serveur (ex : lancement impossible) → toast visible.
  useEffect(() => {
    if (!g.serverError) return;
    setToast(HOST_ERROR_MESSAGES[g.serverError.code] || HOST_ERROR_MESSAGES['start-failed']);
  }, [g.serverError]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const startModule = useCallback((moduleType) => {
    // Jamais d'action silencieuse : socket pas prêt → on le DIT.
    if (!g.connected) {
      setToast('Connexion au salon en cours — réessaie dans une seconde.');
      return;
    }
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
    setHome(null);
    setDenied(null);
    if (supa) supa.auth.signOut().catch(() => {});
  }, [supa]);

  // Fermer le salon SANS se déconnecter : notifie le serveur, puis ATTERRIT sur
  // l'écran stable « Salon fermé ». Aucun salon ne se rouvre tout seul.
  const closeRoom = useCallback(() => {
    g.emit('host:closeRoom');
    setHome('closed');
    setShowResults(false);
    setTimeout(() => {
      store.clear('host');
      setSession(null);
    }, 250);
  }, [g]);

  // Ouverture d'un nouveau salon — action EXPLICITE depuis l'écran stable.
  const openNewRoom = useCallback(async () => {
    setOpening(true);
    try {
      let token;
      let ownerId;
      let email;
      if (supa) {
        const { data } = await supa.auth.getSession();
        token = data?.session?.access_token;
        ownerId = data?.session?.user?.id;
        email = data?.session?.user?.email;
        if (!token) { setHome(null); setSession(null); setOpening(false); return; } // session expirée → login
      }
      await establishRoom(token, ownerId);
      setHome(null);
    } catch (err) {
      if (err && err.message === 'not-host') { setDenied(email || true); setHome(null); }
      else setToast("Impossible d'ouvrir un salon. Réessaie.");
    } finally {
      setOpening(false);
    }
  }, [supa, establishRoom]);

  // Bandeau de reconnexion MAÎTRISÉ : seulement après avoir été connecté au moins une
  // fois, et après 1,2 s de coupure continue — plus de « Reconnexion… » fantôme au
  // chargement ou sur micro-coupure.
  const everConnected = useRef(false);
  const [connLost, setConnLost] = useState(false);
  useEffect(() => {
    if (g.connected) { everConnected.current = true; setConnLost(false); return; }
    if (!everConnected.current || !hostToken) return;
    const t = setTimeout(() => setConnLost(true), 1200);
    return () => clearTimeout(t);
  }, [g.connected, hostToken]);

  const toastEl = toast ? (
    <div className="toast" role="alert">
      <Icon name="alert-triangle" />
      {toast}
    </div>
  ) : null;

  // --- Accès refusé par le serveur (compte non-animateur) : jamais d'écran muet ---
  if (denied) {
    return (
      <>
        <DeniedScreen email={typeof denied === 'string' ? denied : null} onLogout={logout} />
        {toastEl}
      </>
    );
  }

  // --- Écran stable : salon fermé / expiré ---
  if (home) {
    return (
      <>
        <HomeScreen variant={home} onOpenRoom={openNewRoom} opening={opening} onLogout={logout} />
        {toastEl}
      </>
    );
  }

  // --- Non authentifié : écran de connexion (après résolution de la session) ---
  if (!hostToken) {
    if (!authChecked || establishing.current) return <BrandLoader />;
    return <LoginScreen onEstablishRoom={establishRoom} />;
  }

  // --- Session présente mais état du salon pas encore reçu : loader de marque,
  // jamais un écran deviné qui « saute » vers le vrai contenu une demi-seconde après.
  if (!g.room) {
    return (
      <>
        <BrandLoader />
        {toastEl}
      </>
    );
  }

  const room = g.room;
  const state = room ? room.state : 'waiting';
  const code = (room && room.code) || session.code;
  const playerCount = room && room.playerCount != null ? room.playerCount : 0;
  const players = (room && room.players) || g.leaderboard || [];

  const connFlag = connLost ? (
    <span className="conn-flag" role="status">
      <span className="conn-flag__dot" aria-hidden="true"></span>
      Connexion au serveur perdue — reconnexion en cours…
    </span>
  ) : null;

  // Type du module en cours (ou dernier joué) : « Question suivante » enchaîne
  // DIRECTEMENT la question suivante de ce module — on ne repasse jamais par le salon.
  const lastType = (g.current && g.current.type) || 'quiz';

  // --- Partie terminée OU classement demandé ---
  if (state === 'ended' || showResults) {
    return (
      <>
        <ResultsScreen
          g={g}
          onNextModule={() => { setShowResults(false); startModule(lastType); }}
          continueLabel={state === 'ended' ? 'Relancer une partie' : 'Question suivante'}
          onEndGame={endGame}
          onBack={() => setShowResults(false)}
          canBack={state !== 'ended'}
          onLogout={logout}
          onCloseRoom={closeRoom}
        />
        {connFlag}
        {toastEl}
      </>
    );
  }

  // --- En jeu / résultats de module ---
  if (state === 'playing' || state === 'results') {
    return (
      <>
        <LiveScreen
          g={g}
          code={code}
          onShowResults={() => setShowResults(true)}
          onLogout={logout}
          onCloseRoom={closeRoom}
          onEndGame={endGame}
          onNextQuestion={() => startModule(lastType)}
          onChangeModule={(t) => startModule(t)}
        />
        {connFlag}
        {toastEl}
      </>
    );
  }

  // --- Salon d'attente (waiting / room pas encore reçue) ---
  return (
    <>
      <LobbyScreen
        g={g}
        code={code}
        playerCount={playerCount}
        players={players}
        overlayToken={session.overlayToken}
        onStartModule={startModule}
        onLogout={logout}
        onCloseRoom={closeRoom}
      />
      {connFlag}
      {toastEl}
    </>
  );
}
