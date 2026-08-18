// Surface ANIMATEUR — poste de pilotage (login -> lobby -> live -> results).
// Design : extraction Claude Design — A1 connexion, A2 accès refusé, A3 accueil
// stable, A4 salon d'attente, A5 pilotage en direct, A6 classement et podium.
//
// Deux règles de contrat tenues ici :
//   1. la répartition en direct et le classement complet sont RÉSERVÉS à
//      l'animateur — marqués par le contrepoint prune ET sa hachure (second
//      signal, non coloré) ; à la révélation le panneau devient public ;
//   2. les actions destructives (terminer, fermer) passent toujours par une
//      confirmation en deux temps, jamais par un clic direct.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useGame, store } from '../shared/useGame.js';
import { createRoom } from '../shared/net.js';
import { getSupabase } from '../shared/supabaseClient.js';
import { shouldPurgeHostSession } from '../shared/hostSession.js';
import { otpErrorMessage } from '../shared/authErrors.js';
import { BrandLoader } from '../shared/BrandLoader.jsx';
import './host.css';

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR');
const KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

// Types = noms SERVEUR.
const MODULE_TYPES = [
  { type: 'quiz', name: 'Quiz' },
  { type: 'true_false', name: 'Vrai / Faux' },
  { type: 'estimation', name: 'Estimation' },
  { type: 'vote', name: 'Vote' },
];

const playerName = (p, fb = 'Joueur') => (p && (p.name || p.pseudo)) || fb;
const playerId = (p) => p && (p.id || p.playerId);

// ---- Icônes ----------------------------------------------------------------
const I = {
  // Tracés repris tels quels des maquettes Claude Design (trait, jamais d'emoji).
  mail: ({ s = 26 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 7.5h17v11h-17z" />
      <path d="M3.5 8l8.5 6 8.5-6" />
    </svg>
  ),
  arrow: ({ s = 18 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h13" />
      <path d="M12.5 6.5L19 12l-6.5 5.5" />
    </svg>
  ),
  flame: ({ s = 22, ember = false }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
        <g className="brand-flame">
          <path d="M12 2.9c3 3.7 4.5 6.1 4.5 8a4.5 4.5 0 01-9 0c0-1.7.9-3.4 2.6-5.2" />
        </g>
        <path d="M3.4 18.7l17.2-3.5" /><path d="M3.4 15.2l17.2 3.5" />
      </g>
      <circle className="brand-spark" cx="12" cy="12.6" r="1.5" fill="currentColor" />
      {ember ? <circle className="brand-ember" cx="15.6" cy="6.4" r="0.9" fill="currentColor" /> : null}
    </svg>
  ),
  check: ({ s = 18, w = 2.6, dashed = false }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" {...(dashed ? { strokeDasharray: 26 } : {})} />
    </svg>
  ),
  clock: ({ s = 20 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="13" r="8" /><path d="M12 13V9" /><path d="M12 13l3 2" /><path d="M9.5 3h5" />
    </svg>
  ),
  eye: ({ s = 18 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 12s3.6-6.5 9.5-6.5S21.5 12 21.5 12 17.9 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  ),
  alert: ({ s = 20 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><path d="M12 8v5" /><path d="M12 16.2v.4" />
    </svg>
  ),
  dots: ({ s = 20 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
    </svg>
  ),
  chevron: ({ s = 16, open = false }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      style={{ transform: open ? 'rotate(90deg)' : 'none' }}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  ),
  people: ({ s = 22 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19.5c0-3 2.5-4.8 5.5-4.8s5.5 1.8 5.5 4.8" />
      <path d="M16 6.2a3 3 0 010 5.4" /><path d="M17.5 15c2 .5 3.2 2 3.2 4.5" />
    </svg>
  ),
  lock: ({ s = 16 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" />
    </svg>
  ),
};

// ============================================================
// Menu de sortie — seul endroit où vivent les actions destructives.
// Confirmation en DEUX temps, avec la conséquence énoncée.
// ============================================================
function ExitMenu({ onCloseRoom, onLogout, onEndGame, playerCount }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const ref = useRef(null);
  const timer = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setConfirm(null); } };
    const onEsc = (e) => { if (e.key === 'Escape') { setOpen(false); setConfirm(null); } };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [open]);

  // Réarmement automatique : une action armée ne reste jamais sous le curseur.
  useEffect(() => {
    clearTimeout(timer.current);
    if (confirm) timer.current = setTimeout(() => setConfirm(null), 4000);
    return () => clearTimeout(timer.current);
  }, [confirm]);

  const arm = (which, fn) => {
    if (confirm === which) { fn(); setOpen(false); setConfirm(null); }
    else setConfirm(which);
  };

  const consequence = confirm === 'end'
    ? "Terminer la partie révélera son rang à chaque joueur. Irréversible."
    : confirm === 'close'
      ? `Fermer le salon déconnectera ${playerCount || 0} joueur${(playerCount || 0) > 1 ? 's' : ''}.`
      : null;

  return (
    <div className="exit-menu" ref={ref}>
      <button className="button button--quiet" type="button" aria-haspopup="menu" aria-expanded={open}
        onClick={() => { setOpen((v) => !v); setConfirm(null); }}>
        <I.dots s={20} />
        Menu
      </button>
      {open ? (
        <div className="exit-menu__pop" role="menu">
          {consequence ? <p className="exit-menu__consequence">{consequence} L'action se réarme après 4 s.</p> : null}
          {onEndGame ? (
            <button className={`exit-menu__item exit-menu__item--danger${confirm === 'end' ? ' is-armed' : ''}`}
              role="menuitem" type="button" onClick={() => arm('end', onEndGame)}>
              {confirm === 'end' ? 'Confirmer — terminer la partie' : 'Terminer la partie'}
            </button>
          ) : null}
          <button className={`exit-menu__item exit-menu__item--danger${confirm === 'close' ? ' is-armed' : ''}`}
            role="menuitem" type="button" onClick={() => arm('close', onCloseRoom)}>
            {confirm === 'close' ? 'Confirmer — fermer le salon' : 'Fermer le salon'}
          </button>
          <button className={`exit-menu__item${confirm === 'logout' ? ' is-armed' : ''}`}
            role="menuitem" type="button" onClick={() => arm('logout', onLogout)}>
            {confirm === 'logout' ? 'Confirmer — déconnexion' : 'Déconnexion'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

// Menu de changement de module — un seul aller-retour, jamais de sous-menu.
function ModuleMenu({ currentType, onPick, label = 'Changer de module' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  return (
    <div className="exit-menu" ref={ref}>
      <button className="button" type="button" aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen((v) => !v)}>
        {label}
        <I.chevron s={16} />
      </button>
      {open ? (
        <div className="exit-menu__pop" role="menu">
          {MODULE_TYPES.map((m) => (
            <button key={m.type} className="exit-menu__item" role="menuitem" type="button"
              onClick={() => { setOpen(false); onPick(m.type); }}>
              {m.name}{m.type === currentType ? ' — en cours' : ''}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ============================================================
// A1 — Connexion animateur : la carte SEULE.
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
    if (!supabase) { // repli dev (Supabase non configuré) : entrée directe
      setBusy(true);
      try { await onEstablishRoom(undefined); }
      catch { setError('Impossible de créer le salon. Réessayez.'); setBusy(false); }
      return;
    }
    if (!email) { setError('Entrez votre adresse email.'); return; }
    setBusy(true);
    try {
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/host`,
          // Cet écran CONNECTE, il n'inscrit pas.
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

  return (
    <main className="page card-screen" role="main" aria-labelledby="auth-title">
      <div className="auth-card">
        {/* Marque en haut à gauche — la carte n'est pas centrée (maquette A1). */}
        <div className="auth-brand">
          <span className="auth-brand__mark" aria-hidden="true"><I.flame s={22} ember /></span>
          <p className="auth-brand__name">Project Game Show</p>
        </div>

        {sent ? (
          <>
            <div className="auth-card__head auth-card__head--badged">
              <span className="auth-badge auth-badge--ok" aria-hidden="true"><I.mail s={26} /></span>
              <h1 className="auth-card__title" id="auth-title">Lien envoyé</h1>
              <p className="auth-card__sub">
                Ouvre le message envoyé à <strong data-bind="auth.email">{email}</strong> pour
                rejoindre ton poste de pilotage. Le lien est valable 15 minutes.
              </p>
            </div>
            <button className="button" type="button" data-action="auth:changeEmail"
              onClick={() => setSent(false)}>Utiliser une autre adresse</button>
          </>
        ) : (
          <>
            <div className="auth-card__head">
              <h1 className="auth-card__title" id="auth-title">Poste de pilotage</h1>
              <p className="auth-card__sub">Un seul animateur — accès par lien email.</p>
            </div>
            <form className="auth-form" onSubmit={requestLink} noValidate data-action="POST /api/auth/link">
              <div className={`auth-field${error ? ' auth-field--error' : ''}`}>
                <label className="auth-label" htmlFor="host-email">Adresse email</label>
                <div className="auth-shell">
                  <input className="auth-shell__input" id="host-email" type="email" name="email"
                    placeholder="toi@exemple.fr" autoComplete="email" value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }} disabled={busy}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? 'host-email-error' : undefined} />
                </div>
                {error ? (
                  <p className="auth-card__error" id="host-email-error" data-bind="auth.error" role="alert">
                    <I.alert s={17} />{error}
                  </p>
                ) : null}
              </div>
              <button className="button button--primary button--block button--tall" type="submit"
                data-action="POST /api/auth/link" disabled={busy}>
                {busy ? 'Envoi…' : (supabase ? 'Recevoir mon lien' : 'Entrer (mode animateur)')}
                {busy || !supabase ? null : <I.arrow s={18} />}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

// ============================================================
// A2 — Accès refusé (403 not-host)
// ============================================================
function DeniedScreen({ email, onLogout }) {
  return (
    <main className="page page--dusk card-screen" role="main" aria-labelledby="denied-title">
      <div className="auth-card" data-testid="denied-card">
        {/* Refus net mais sans dramatisation (maquette A2) : le feu reste allumé,
            on rappelle l'adresse concernée et on propose les deux issues. */}
        <span className="auth-badge auth-badge--warn" aria-hidden="true"><I.lock s={26} /></span>
        <div className="auth-card__head auth-card__head--badged">
          <h1 className="auth-card__title" id="denied-title">Accès réservé</h1>
          <p className="auth-card__sub">
            Le poste de pilotage n'est ouvert qu'à un seul compte animateur.
            Le tien n'en fait pas partie.
          </p>
        </div>
        {email ? (
          <div className="auth-account">
            <p className="auth-account__label">Compte connecté</p>
            <p className="auth-account__value" data-bind="auth.email">{email}</p>
          </div>
        ) : null}
        <div className="auth-card__exits">
          <a className="button button--primary button--block button--tall" href="/" data-action="goto:player">
            Rejoindre en joueur
            <I.arrow s={18} />
          </a>
          <button className="button" type="button" onClick={onLogout} data-action="auth:signOut">
            Se déconnecter
          </button>
        </div>
      </div>
    </main>
  );
}

// ============================================================
// A3 — Accueil stable : salon fermé / expiré / ouverture / erreur
// ============================================================
function HomeScreen({ variant, onOpenRoom, opening, onLogout, openError, email }) {
  const closed = variant === 'closed';
  // Deux causes d'arrivée ici, distinguées par le libellé : fermeture choisie
  // (le feu reste allumé) ou expiration subie (le ciel s'éteint). Maquette A3.
  const dusk = !closed || !!openError;
  return (
    <main className={`page${dusk ? ' page--dusk' : ''}`} role="main" aria-labelledby="home-title">
      <header className="home-bar">
        <div className="auth-brand">
          <span className="auth-brand__mark" aria-hidden="true"><I.flame s={21} /></span>
          <p className="auth-brand__name">Project Game Show · pilotage</p>
        </div>
        <div className="home-bar__end">
          {email ? <span className="home-bar__email" data-bind="auth.email">{email}</span> : null}
          <button className="button" type="button" onClick={onLogout}
            data-action="auth:signOut">Déconnexion</button>
        </div>
      </header>

      <div className="home-body">
        <div className="home-stack">
          <span className={`home-mark${opening ? ' home-mark--busy' : ''}`} aria-hidden="true">
            {opening ? <span className="home-spin" /> : closed ? <I.flame s={30} /> : <I.clock s={30} />}
          </span>

          <div className="home-stack__head">
            <h1 className="home-title" id="home-title" data-bind="room.closedReason">
              {opening ? 'On allume le feu' : closed ? 'Salon fermé' : 'Salon expiré'}
            </h1>
            <p className="home-text" role={opening ? 'status' : undefined}>
              {opening ? 'Création du salon et du code à cinq caractères…'
                : closed ? "Tu as fermé le salon. Les joueurs ont été renvoyés vers l'écran d'entrée. Ouvre-en un nouveau quand tu veux relancer une soirée."
                : "Le salon n'existe plus côté serveur — redémarrage ou trop longue inactivité. Rien n'est perdu : tes questionnaires sont intacts."}
            </p>
          </div>

          {openError ? (
            <div className="alert-banner" role="alert" data-bind="room.openError">
              <span style={{ color: 'var(--c-bad)', flex: 'none' }} aria-hidden="true"><I.alert s={22} /></span>
              <div className="alert-banner__body">
                <p className="alert-banner__title">Ouverture refusée</p>
                <p className="alert-banner__text">{openError}</p>
              </div>
            </div>
          ) : null}

          <div className="home-actions">
            <button className="button button--primary button--block button--tall" type="button"
              onClick={onOpenRoom} disabled={opening} aria-busy={opening || undefined}
              data-action="POST /api/rooms">
              {opening ? 'Ouverture en cours…' : 'Ouvrir un nouveau salon'}
              {opening ? null : <I.arrow s={18} />}
            </button>
            <a className="button button--block" href="/studio" data-action="goto:studio">
              Gérer les questionnaires
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

// ============================================================
// A4 — Salon d'attente : invitation · joueurs et lancement · Séance
// ============================================================
function LobbyScreen({ g, code, playerCount, players, overlayToken, onStartModule, onLogout, onCloseRoom }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const joinUrl = `${origin}/play?code=${code || ''}`;
  const streamUrl = `${origin}/overlay?token=${overlayToken}`;
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState('');
  const [picking, setPicking] = useState(false);

  // Configuration de séance : ordre aléatoire + sélection manuelle.
  const [shuffle, setShuffle] = useState(true);
  const [banks, setBanks] = useState({});
  const [checked, setChecked] = useState({});
  const [openBank, setOpenBank] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!code) { setQr(''); return undefined; }
    QRCode.toDataURL(joinUrl, { margin: 1, width: 300 })
      .then((u) => { if (alive) setQr(u); })
      .catch(() => { if (alive) setQr(''); });
    return () => { alive = false; };
  }, [code, joinUrl]);

  const copy = async (key, url) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(key);
      setTimeout(() => setCopied(''), 1600);
    } catch { /* presse-papier indisponible */ }
  };

  const pushSessionConfig = useCallback((nextShuffle, nextChecked) => {
    const selectedIds = {};
    for (const [t, set] of Object.entries(nextChecked)) {
      const bank = banks[t] || [];
      if (set && bank.length && set.size < bank.length) selectedIds[t] = [...set];
    }
    g.emit('host:sessionConfig', { shuffle: nextShuffle, selected: selectedIds });
  }, [g, banks]);

  const toggleShuffle = () => { const n = !shuffle; setShuffle(n); pushSessionConfig(n, checked); };

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

  const empty = !playerCount;

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar__brand">
          <span className="topbar__mark" aria-hidden="true"><I.flame s={20} ember /></span>
          <span className="h-label">Pilotage</span>
          <span className="h-cap" data-bind="room.state">
            <span className="h-cap__dot h-cap__dot--pulse" aria-hidden="true" />Salle d'attente
          </span>
        </div>
        <div className="topbar__end">
          <a className="button" href="/studio" data-action="goto:studio">Questionnaires</a>
          <ExitMenu onCloseRoom={onCloseRoom} onLogout={onLogout} playerCount={playerCount} />
        </div>
      </header>

      <main className="lobby" role="main">
        {/* --- Colonne 1 : invitation --- */}
        <section className="pane" aria-label="Inviter les joueurs">
          <p className="h-label">Code du salon</p>
          <p className="room-code" data-bind="room.code" data-testid="room-code">{code || '—'}</p>
          <div className="link-row">
            <span className="link-row__url" data-bind="room.joinUrl" title={joinUrl}>{joinUrl}</span>
            <button className="link-row__copy" type="button" data-action="copy:joinUrl"
              onClick={() => copy('join', joinUrl)}>{copied === 'join' ? 'Copié' : 'Copier'}</button>
          </div>
          <p className="h-label">QR du salon</p>
          {qr ? (
            <img className="qr-plate" src={qr} data-bind="room.qr"
              alt={`QR code du salon ${code || ''}`} />
          ) : (
            <span className="qr-plate qr-plate--empty" aria-hidden="true" />
          )}
          {/* Page stream : seule source à ajouter dans OBS. */}
          <div className="private" style={{ marginTop: 'var(--sp-2)' }}>
            <p className="private__title"><I.eye s={16} /> Page stream — pour OBS</p>
            <div className="link-row">
              <span className="link-row__url" data-bind="room.overlayUrl" data-testid="overlay-link"
                title={streamUrl}>{streamUrl}</span>
              <button className="link-row__copy" type="button" data-action="copy:overlayUrl"
                onClick={() => copy('stream', streamUrl)}>{copied === 'stream' ? 'Copié' : 'Copier'}</button>
            </div>
            <p className="private__hint">
              Dans OBS : + Source → Navigateur, 1920 × 1080. C'est la seule source à ajouter.
            </p>
          </div>
        </section>

        {/* --- Colonne 2 : joueurs et lancement --- */}
        <section className="pane" aria-label="Joueurs et lancement">
          <div className="count-card">
            <span style={{ color: 'var(--c-ink-3)' }} aria-hidden="true"><I.people s={26} /></span>
            <span className={`count-card__value${empty ? ' count-card__value--empty' : ''}`}
              data-bind="room.playerCount" data-testid="player-count" key={playerCount}>{playerCount}</span>
            <span className="h-label">{playerCount > 1 ? 'joueurs connectés' : 'joueur connecté'}</span>
          </div>

          {empty ? (
            <>
            <h2 className="lobby__empty-title">Personne autour du feu</h2>
            <ol className="guide" aria-label="Comment lancer une partie">
              <li className="guide__step"><span className="guide__num">1</span>
                <span>Partage le <strong>code {code}</strong> ou le QR — tes joueurs rejoignent depuis leur téléphone.</span></li>
              <li className="guide__step"><span className="guide__num">2</span>
                <span>(Option) Prépare tes questions dans « Gérer les questionnaires ».</span></li>
              <li className="guide__step"><span className="guide__num">3</span>
                <span>Clique <strong>« Lancer la partie »</strong> et choisis un module.</span></li>
            </ol>
            </>
          ) : (
            <div className="chips" data-bind="room.players" aria-label="Joueurs présents">
              {players.slice(0, 25).map((p, i) => (
                <span className="chip" key={playerId(p) || i}>{playerName(p)}</span>
              ))}
              {players.length > 25 ? <span className="chip">+ {players.length - 25} autres</span> : null}
            </div>
          )}

          {empty ? (
            <p className="warn-line" role="status">
              <span style={{ color: 'var(--c-bad)', flex: 'none' }} aria-hidden="true"><I.alert s={18} /></span>
              Lancer maintenant enverra une épreuve dans le vide.
            </p>
          ) : null}

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {picking ? (
              <div role="menu" aria-label="Choix du module"
                style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                {MODULE_TYPES.map((m) => (
                  <button key={m.type} className="button button--block" type="button" role="menuitem"
                    data-action="host:startModule" onClick={() => onStartModule(m.type)}>
                    Lancer {m.name}
                  </button>
                ))}
              </div>
            ) : null}
            <button className={`button button--block button--lg${empty ? '' : ' button--primary'}`}
              type="button" onClick={() => setPicking((v) => !v)} aria-expanded={picking}>
              Lancer la partie
            </button>
          </div>
        </section>

        {/* --- Colonne 3 : Séance --- */}
        <section className="pane" aria-label="Configuration de la séance">
          <h2 className="pane__title">Séance</h2>
          <button className="switch" type="button" role="switch" aria-checked={shuffle}
            data-action="host:sessionConfig" onClick={toggleShuffle}>
            <span className="switch__track" aria-hidden="true"><span className="switch__knob" /></span>
            <span className="switch__label">Ordre des questions aléatoire</span>
          </button>

          {MODULE_TYPES.map((m) => {
            const list = banks[m.type] || [];
            const set = checked[m.type];
            const partial = set && list.length && set.size < list.length;
            return (
              <div className="bank" key={m.type}>
                <button className="bank__head" type="button" aria-expanded={openBank === m.type}
                  onClick={() => toggleBank(m.type)}>
                  <I.chevron s={16} open={openBank === m.type} />
                  {m.name}
                  <span className={`bank__count${partial ? ' bank__count--partial' : ''}`}
                    data-bind={`session.selected.${m.type}`}>
                    {set ? `${set.size}/${list.length}` : 'toutes'}
                  </span>
                </button>
                {openBank === m.type ? (
                  <ul className="bank__list" data-action="host:getBank">
                    {list.length === 0 ? (
                      <li className="private__hint">Chargement…</li>
                    ) : list.map((q) => (
                      <li key={q.id}>
                        <label className="bank__q">
                          <input type="checkbox" checked={set ? set.has(q.id) : true}
                            onChange={() => toggleQuestion(m.type, q.id)} />
                          {q.text}
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}

// ============================================================
// Répartition des réponses — RÉSERVÉE à l'animateur (prune + hachure),
// devient publique à la révélation.
// ============================================================
function AnswerDistribution({ current, distribution, answersCount, revealed, reveal }) {
  if (!current) return null;
  const type = current.type;
  const dist = distribution || {};
  const stats = revealed ? reveal?.stats : null;
  const total = stats?.total ?? dist.total ?? answersCount ?? 0;

  // Numérique : min / moyenne / max (direct) ou les faits de la révélation.
  if (type === 'estimation') {
    const has = stats?.kind === 'numeric' || dist.kind === 'numeric';
    if (!has || !total) return <p className="dist__empty">Les estimations s'afficheront ici, en direct.</p>;
    const cells = stats?.kind === 'numeric'
      ? [['Le plus proche', stats.closest], ['Moyenne', stats.avg], ['Médiane', stats.median]]
      : [['Min', dist.min], ['Moyenne', dist.avg], ['Max', dist.max]];
    return (
      <div className="dist__facts">
        {cells.map(([label, v]) => (
          <div className="dist__fact" key={label}>
            <span className="h-label">{label}</span>
            <span className="dist__fact-value">{v != null ? fmt(v) : '—'}</span>
          </div>
        ))}
      </div>
    );
  }

  let options; let showKey = true;
  if (type === 'true_false') { options = ['Faux', 'Vrai']; showKey = false; }
  else options = current.options || [];
  if (!options.length) return null;

  // Le direct arrive par module:distribution, la révélation par reveal.stats.
  let counts;
  if (stats?.kind === 'options') {
    counts = type === 'true_false' ? [stats.tally?.[1] || 0, stats.tally?.[0] || 0] : (stats.tally || []);
  } else counts = dist.counts || options.map(() => 0);

  const correctIndex = revealed
    ? (reveal?.type === 'quiz' ? reveal.correctIndex
      : reveal?.type === 'true_false' ? (reveal.correct ? 1 : 0) : -1)
    : -1;
  const max = Math.max(1, ...counts);

  return (
    <div className="dist">
      {options.map((opt, i) => {
        const c = counts[i] || 0;
        const pct = total ? Math.round((c / total) * 100) : 0;
        return (
          <div className={`dist__row${i === correctIndex ? ' dist__row--correct' : ''}`} key={i}>
            {showKey ? <span className="dist__key" aria-hidden="true">{KEYS[i] || i + 1}</span> : <span />}
            <span className="dist__track">
              <span className="dist__fill" style={{ width: `${(c / max) * 100}%` }} aria-hidden="true" />
              <span className="dist__opt" title={String(opt)}>{opt}</span>
            </span>
            <span className="dist__count">{c} · {pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// A5 — Pilotage en direct
// ============================================================
function LiveScreen({ g, code, onShowResults, onLogout, onCloseRoom, onEndGame, onNextQuestion, onChangeModule, connLost, hostError, onDismissError }) {
  const room = g.room || {};
  const current = g.current;
  const tick = g.tick;
  const reveal = g.reveal;
  const revealed = !!reveal;
  const answersCount = tick && tick.answers != null ? tick.answers : 0;
  const timeLeft = tick?.timeLeft;
  const urgent = !revealed && typeof timeLeft === 'number' && timeLeft > 0 && timeLeft <= 5;
  const prog = room.progression || {};
  const progIndex = prog.index != null ? prog.index : 1;
  const progTotal = prog.total || 0;
  const top5 = (g.leaderboard || []).slice(0, 5);
  const hasScores = top5.some((p) => (p.score || 0) > 0);
  const moduleName = (current && current.meta && current.meta.name) || 'Épreuve';

  const revealLabel = revealed ? (() => {
    if (reveal.type === 'true_false') return reveal.correct ? 'Vrai' : 'Faux';
    if (reveal.type === 'estimation') return fmt(reveal.target);
    if (reveal.type === 'quiz') {
      const opts = reveal.options || current?.options;
      return Array.isArray(opts) ? opts[reveal.correctIndex] : null;
    }
    return null;
  })() : null;

  return (
    <div className="page page--dusk live">
      {connLost ? (
        <div className="conn-flag" role="alert">
          <span className="conn-flag__spinner" aria-hidden="true" />
          Connexion au serveur perdue — les réponses déjà reçues sont conservées.
        </div>
      ) : null}

      <header className="antenne">
        <span className="h-cap h-cap--live">
          <span className="h-cap__dot h-cap__dot--pulse" aria-hidden="true" />
          En direct
        </span>
        <span className="h-cap h-cap--accent" data-bind="module.meta.name">{moduleName}</span>
        <span className="h-cap">
          Épreuve <span className="h-cap__value">{progIndex}{progTotal > progIndex ? ` / ${progTotal}` : ''}</span>
        </span>
        <span className="antenne__progress" aria-hidden="true">
          <span className="antenne__progress-fill"
            style={{ width: progTotal ? `${Math.min(100, (progIndex / progTotal) * 100)}%` : '0%' }} />
        </span>
        <span className="h-cap">
          <span style={{ color: 'var(--c-ink-3)' }} aria-hidden="true"><I.people s={18} /></span>
          <span className="h-cap__value" data-bind="tick.answers" data-testid="answers-count">{answersCount}</span>
          <span className="h-label">/ {room.playerCount || 0} réponses</span>
        </span>
        <span className="h-cap" role="timer" aria-label={`Temps restant ${timeLeft ?? 0} secondes`}>
          <span className={`antenne__chrono${urgent ? ' antenne__chrono--urgent' : ''}`} data-bind="tick.timeLeft">
            {typeof timeLeft === 'number' ? timeLeft : '—'}
          </span>
          <span className="h-label">Chrono</span>
        </span>
        <ExitMenu onCloseRoom={onCloseRoom} onLogout={onLogout} onEndGame={onEndGame}
          playerCount={room.playerCount} />
      </header>

      <main className="live__body" role="main">
        <div className="stage">
          {hostError ? (
            <div className="alert-banner" role="alert">
              <span style={{ color: 'var(--c-bad)', flex: 'none' }} aria-hidden="true"><I.alert s={20} /></span>
              <div className="alert-banner__body">
                <p className="alert-banner__title">{hostError}</p>
                <p className="alert-banner__text">
                  Trois issues : choisir un autre module, ajouter des questions dans le Studio,
                  ou relâcher la sélection de séance.
                </p>
              </div>
              <button className="button button--quiet" type="button" onClick={onDismissError}>Masquer</button>
            </div>
          ) : null}

          <section className="stage__card" aria-label="Question en cours">
            <p className="h-label">Énoncé à l'antenne</p>
            <p className={`stage__question${revealed ? ' stage__question--revealed' : ''}`}
              data-bind="module.text" data-testid="question-text">
              {current && current.text ? current.text : 'En attente de la question…'}
            </p>
            {revealLabel != null ? (
              <div className="reveal" data-bind="reveal.correct" data-testid="reveal-value">
                <span className="reveal__badge" aria-hidden="true"><I.check s={18} dashed /></span>
                <div>
                  <p className="h-label" style={{ color: 'var(--c-pine)' }}>Bonne réponse</p>
                  <p className="reveal__value">{revealLabel}</p>
                </div>
              </div>
            ) : null}
          </section>

          <section className={`private${revealed ? ' private--public' : ''}`} data-testid="stats-panel"
            data-bind="module.distribution" aria-label="Répartition des réponses">
            <p className="private__title">
              <I.eye s={16} />
              {revealed ? 'Répartition — affichée sur le stream' : 'Répartition en direct — visible par toi seul'}
            </p>
            <AnswerDistribution current={current} distribution={g.distribution}
              answersCount={answersCount} revealed={revealed} reveal={reveal} />
            {!revealed ? <p className="private__hint">Publique à la révélation</p> : null}
          </section>
        </div>

        <aside className="rail">
          <section className="private" aria-label="Classement en direct">
            <p className="private__title"><I.eye s={16} /> Top 5 — toi seul</p>
            {top5.length === 0 ? (
              <p className="lb__empty">Aucun score pour l'instant.</p>
            ) : (
              <div className="lb" data-bind="leaderboard">
                {top5.map((p, i) => (
                  <div className={`lb__row${i === 0 && hasScores ? ' lb__row--lead' : ''}`}
                    key={playerId(p) || i} style={{ animationDelay: `${i * 40}ms` }}>
                    <span className="lb__rank">{i + 1}</span>
                    <span className="lb__name" title={playerName(p)}>{playerName(p)}</span>
                    <span className="lb__score">{fmt(p.score)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="pane" aria-label="Bonus et malus">
            <p className="h-label">Bonus / Malus</p>
            {(g.leaderboard || []).length === 0 ? (
              <p className="lb__empty">Aucun joueur à ajuster.</p>
            ) : (
              <div className="adjust">
                {(g.leaderboard || []).map((p, i) => (
                  <div className="adjust__row" key={playerId(p) || i}>
                    <span className="adjust__name" title={playerName(p)}>{playerName(p)}</span>
                    <button className="adjust__btn adjust__btn--minus" type="button" disabled={connLost}
                      data-action="host:adjustScore:-100"
                      aria-label={`Retirer 100 points à ${playerName(p)}`}
                      onClick={() => g.emit('host:adjustScore', { playerId: playerId(p), delta: -100 })}>−</button>
                    <button className="adjust__btn adjust__btn--plus" type="button" disabled={connLost}
                      data-action="host:adjustScore:+100"
                      aria-label={`Ajouter 100 points à ${playerName(p)}`}
                      onClick={() => g.emit('host:adjustScore', { playerId: playerId(p), delta: 100 })}>+</button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </main>

      <nav className="actions" aria-label="Contrôles animateur">
        {revealed ? (
          <>
            <button className="button button--primary button--lg" type="button"
              data-action="host:startModule" onClick={onNextQuestion}>Question suivante</button>
            <ModuleMenu currentType={current && current.type} onPick={onChangeModule} />
          </>
        ) : (
          <>
            <button className="button button--primary button--lg" type="button"
              data-action="host:reveal" onClick={() => g.emit('host:reveal')}>Révéler maintenant</button>
            <ModuleMenu currentType={current && current.type} onPick={onChangeModule} />
          </>
        )}
        <span className="actions__spacer" />
        <button className="button" type="button" onClick={onShowResults}>Voir le classement</button>
      </nav>
    </div>
  );
}

// ============================================================
// A6 — Classement et podium
// ============================================================
function ResultsScreen({ g, onNextModule, continueLabel, onEndGame, onBack, canBack, onLogout, onCloseRoom, onBackToLobby }) {
  const rows = (g.podium && g.podium.length ? g.podium : g.leaderboard) || [];
  const ended = !!onBackToLobby;
  const progIndex = g.room?.progression?.index || 0;
  const progTotal = g.room?.progression?.total || 0;
  const scored = rows.filter((p) => (p.score || 0) > 0);
  const top3 = scored.slice(0, 3);
  const rest = scored.slice(3, 8);

  const Slot = ({ p, rank, mod, crown }) => (
    <div className={`podium__slot podium__slot--${mod}`}>
      {crown ? <span className="podium__crown" aria-hidden="true"><I.flame s={26} ember /></span> : null}
      <p className="podium__name" data-bind={`podium.${rank - 1}.pseudo`}>{playerName(p)}</p>
      <p className="podium__score" data-bind={`podium.${rank - 1}.score`}>{fmt(p.score)} pts</p>
      <div className="podium__step"><span className="podium__rank">{rank}</span></div>
    </div>
  );

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar__brand">
          {/* Planche A6 : capsule d'antenne, titre, puis le repère d'épreuve. */}
          {ended ? (
            <span className="h-cap"><span className="h-cap__value">Partie terminée</span></span>
          ) : (
            <span className="h-cap h-cap--live">
              <span className="h-cap__dot h-cap__dot--pulse" aria-hidden="true" />En direct
            </span>
          )}
          <h1 className="pane__title">{ended ? 'Podium final' : 'Classement'}</h1>
          <p className="results__step">
            {ended ? (
              <>
                <span data-bind="leaderboard.length">{rows.length}</span> joueur{rows.length > 1 ? 's' : ''}
              </>
            ) : (
              <>
                après l'épreuve <span className="h-cap__value" data-bind="module.index">{progIndex}</span>
                {progTotal > progIndex ? <> / <span className="h-cap__value" data-bind="module.total">{progTotal}</span></> : null}
              </>
            )}
          </p>
        </div>
        <div className="topbar__end">
          <span className="h-cap"><I.eye s={16} /> Toi et le stream uniquement</span>
          <ExitMenu onCloseRoom={onCloseRoom} onLogout={onLogout} onEndGame={onEndGame}
            playerCount={g.room?.playerCount} />
        </div>
      </header>

      <main className="results" role="main">
        <section aria-label="Podium">
          {top3.length === 0 ? (
            <div className="results__empty">
              <span style={{ color: 'var(--c-ink-3)' }} aria-hidden="true"><I.clock s={30} /></span>
              <h2 className="pane__title">Pas encore de podium</h2>
              <p className="auth-card__sub">Personne n'a marqué — aucun joueur n'est mis en avant.</p>
            </div>
          ) : (
            <div className="podium" data-bind="podium">
              {top3[1] ? <Slot p={top3[1]} rank={2} mod="second" /> : <div className="podium__slot" />}
              <Slot p={top3[0]} rank={1} mod="first" crown />
              {top3[2] ? <Slot p={top3[2]} rank={3} mod="third" /> : <div className="podium__slot" />}
            </div>
          )}
        </section>

        <aside className="private" aria-label="Rangs 4 à 8">
          <p className="private__title"><I.eye s={16} /> Rangs 4 à 8</p>
          {rest.length === 0 ? (
            <p className="lb__empty">Aucun autre joueur classé.</p>
          ) : (
            <div className="lb" data-bind="leaderboard">
              {rest.map((p, i) => (
                <div className="lb__row" key={playerId(p) || i}>
                  <span className="lb__rank">{i + 4}</span>
                  <span className="lb__name">{playerName(p)}</span>
                  <span className="lb__score">{fmt(p.score)}</span>
                </div>
              ))}
            </div>
          )}
          <p className="private__hint">{rows.length} joueur{rows.length > 1 ? 's' : ''} au total.</p>
        </aside>
      </main>

      <nav className="actions" aria-label="Contrôles animateur">
        <button className="button button--primary button--lg" type="button"
          data-action="host:startModule" onClick={onNextModule}>{continueLabel || 'Question suivante'}</button>
        {canBack ? (
          <button className="button" type="button" data-action="goto:live" onClick={onBack}>Retour au direct</button>
        ) : null}
        {/* Partie terminée : la seule autre sortie utile est le salon d'attente.
            Sans ce bouton, il fallait fermer le salon pour repartir d'une soirée neuve. */}
        {onBackToLobby ? (
          <button className="button" type="button" data-action="host:backToLobby"
            data-testid="back-to-lobby" onClick={onBackToLobby}>Retour au salon</button>
        ) : null}
        <span className="actions__spacer" />
      </nav>
    </div>
  );
}

// ============================================================
// HOSTAPP — orchestrateur / machine à états
// ============================================================
const HOST_ERROR_MESSAGES = {
  'no-question': 'Aucune question disponible pour ce module',
  'start-failed': "Impossible de lancer l'épreuve",
};

export function HostApp() {
  const [session, setSession] = useState(() => store.load('host') || null);
  const hostToken = session ? session.hostToken : null;
  const [showResults, setShowResults] = useState(false);
  const [home, setHome] = useState(null);           // 'closed' | 'expired'
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState(null);
  const [toast, setToast] = useState(null);
  const [hostError, setHostError] = useState(null);
  const [denied, setDenied] = useState(null);       // email refusé, ou true

  const g = useGame(hostToken);

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
    setOpenError(null);
  }, []);

  const supa = useMemo(() => getSupabase(), []);
  const establishing = useRef(false);
  const [authChecked, setAuthChecked] = useState(() => !getSupabase());

  // Ouverture automatique du salon pour un animateur déjà authentifié.
  useEffect(() => {
    if (!supa || session || home || denied) return undefined;
    let alive = true;
    const open = (sess) => {
      const token = sess?.access_token;
      if (!alive || !token || establishing.current) return;
      establishing.current = true;
      establishRoom(token, sess?.user?.id)
        .catch((err) => {
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

  // CLOISONNEMENT PAR COMPTE : un second compte n'hérite jamais du salon
  // (ni du jeton d'animateur) laissé par le précédent sur ce navigateur.
  useEffect(() => {
    if (!supa) return undefined;
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

  // Salon mort (redéploiement, expiration) : écran stable « salon expiré ».
  useEffect(() => {
    if (!g.fatal || !session) return;
    store.clear('host');
    setShowResults(false);
    setSession(null);
    setHome('expired');
  }, [g.fatal, session]);

  // Erreurs serveur (lancement impossible) : bandeau en tête de scène.
  useEffect(() => {
    if (!g.serverError) return;
    setHostError(HOST_ERROR_MESSAGES[g.serverError.code] || HOST_ERROR_MESSAGES['start-failed']);
  }, [g.serverError]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const startModule = useCallback((moduleType) => {
    if (!g.connected) { setToast('Connexion au salon en cours — réessaie dans une seconde.'); return; }
    setHostError(null);
    g.emit('host:startModule', { moduleType });
  }, [g]);

  const endGame = useCallback(() => { g.emit('host:endGame'); }, [g]);
  // Retour au salon d'attente après le podium : le salon reste ouvert (même code,
  // mêmes joueurs), la séance repart à zéro. Une fois la partie terminée, c'est la
  // seule sortie non destructrice — sinon il fallait fermer le salon.
  const backToLobby = useCallback(() => { setShowResults(false); g.emit('host:backToLobby'); }, [g]);

  const logout = useCallback(() => {
    store.clear('host');
    setShowResults(false);
    setSession(null);
    setHome(null);
    setDenied(null);
    if (supa) supa.auth.signOut().catch(() => {});
  }, [supa]);

  const closeRoom = useCallback(() => {
    g.emit('host:closeRoom');
    setHome('closed');
    setShowResults(false);
    setTimeout(() => { store.clear('host'); setSession(null); }, 250);
  }, [g]);

  const openNewRoom = useCallback(async () => {
    setOpening(true);
    setOpenError(null);
    try {
      let token; let ownerId; let email;
      if (supa) {
        const { data } = await supa.auth.getSession();
        token = data?.session?.access_token;
        ownerId = data?.session?.user?.id;
        email = data?.session?.user?.email;
        if (!token) { setHome(null); setSession(null); setOpening(false); return; }
      }
      await establishRoom(token, ownerId);
      setHome(null);
    } catch (err) {
      if (err && err.message === 'not-host') { setDenied(email || true); setHome(null); }
      else setOpenError("Impossible d'ouvrir un salon. Réessaie dans un instant.");
    } finally {
      setOpening(false);
    }
  }, [supa, establishRoom]);

  // Bandeau de reconnexion MAÎTRISÉ : seulement après 1,2 s de coupure continue.
  const everConnected = useRef(false);
  const [connLost, setConnLost] = useState(false);
  useEffect(() => {
    if (g.connected) { everConnected.current = true; setConnLost(false); return undefined; }
    if (!everConnected.current || !hostToken) return undefined;
    const t = setTimeout(() => setConnLost(true), 1200);
    return () => clearTimeout(t);
  }, [g.connected, hostToken]);

  const toastEl = toast ? <div className="toast" role="alert">{toast}</div> : null;

  // --- Accès refusé (compte non-animateur) ---
  if (denied) {
    return (<><DeniedScreen email={typeof denied === 'string' ? denied : null} onLogout={logout} />{toastEl}</>);
  }

  // --- Écran stable : salon fermé / expiré ---
  if (home) {
    return (
      <>
        <HomeScreen variant={home} onOpenRoom={openNewRoom} opening={opening}
          onLogout={logout} openError={openError} />
        {toastEl}
      </>
    );
  }

  // --- Non authentifié ---
  if (!hostToken) {
    if (!authChecked || establishing.current) return <BrandLoader />;
    return <LoginScreen onEstablishRoom={establishRoom} />;
  }

  // --- Session présente, état du salon pas encore reçu ---
  if (!g.room) return (<><BrandLoader />{toastEl}</>);

  const room = g.room;
  const state = room ? room.state : 'waiting';
  const code = (room && room.code) || session.code;
  const playerCount = room && room.playerCount != null ? room.playerCount : 0;
  const players = (room && room.players) || g.leaderboard || [];
  const lastType = (g.current && g.current.type) || 'quiz';

  // --- Partie terminée OU classement demandé ---
  if (state === 'ended' || showResults) {
    return (
      <>
        <ResultsScreen
          g={g}
          onNextModule={() => { setShowResults(false); startModule(lastType); }}
          continueLabel={state === 'ended' ? 'Relancer une partie' : 'Question suivante'}
          onEndGame={state === 'ended' ? undefined : endGame}
          onBackToLobby={state === 'ended' ? backToLobby : undefined}
          onBack={() => setShowResults(false)}
          canBack={state !== 'ended'}
          onLogout={logout}
          onCloseRoom={closeRoom}
        />
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
          connLost={connLost}
          hostError={hostError}
          onDismissError={() => setHostError(null)}
        />
        {toastEl}
      </>
    );
  }

  // --- Salon d'attente ---
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
      {connLost ? <div className="toast" role="alert">Connexion au serveur perdue — reconnexion…</div> : null}
      {toastEl}
    </>
  );
}
