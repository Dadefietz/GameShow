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
import { passwordErrorMessage, resetErrorMessage, masquerEmail } from '../shared/authErrors.js';
import { BrandLoader } from '../shared/BrandLoader.jsx';
import { NOM_DU_JEU } from '../shared/marque.js';
import './host.css';

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR');
const KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

// Repli quand la bibliothèque n'est pas encore arrivée : les quatre types, sous
// leur nom générique. L'animateur lance normalement ses JEUX NOMMÉS — c'est la
// bibliothèque du serveur qui les fournit (action 2).
const TYPES_DE_REPLI = [
  { type: 'quiz', name: 'Quiz' },
  { type: 'true_false', name: 'Vrai / Faux' },
  { type: 'estimation', name: 'Estimation' },
  { type: 'vote', name: 'Vote' },
];

// Bibliothèque de l'animateur, demandée au serveur dès que le salon est ouvert.
function useBibliotheque(g) {
  const [jeux, setJeux] = useState(null);
  useEffect(() => {
    if (!g.connected) return undefined;
    let vivant = true;
    g.emit('host:modules', {}, (liste) => { if (vivant && Array.isArray(liste)) setJeux(liste); });
    return () => { vivant = false; };
  }, [g.connected, g.emit]);
  return jeux && jeux.length ? jeux : TYPES_DE_REPLI;
}

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
function ModuleMenu({ jeux, currentId, onPick, label = 'Changer de module' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  return (
    // --up : ce menu vit dans la barre d'actions, tout en bas de l'écran. Ouvert
    // vers le bas, il sortait du champ visible et obligeait l'animateur à faire
    // défiler sa page en plein direct.
    <div className="exit-menu exit-menu--up" ref={ref}>
      <button className="button" type="button" aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen((v) => !v)}>
        {label}
        <I.chevron s={16} />
      </button>
      {open ? (
        <div className="exit-menu__pop" role="menu">
          {(jeux || TYPES_DE_REPLI).map((m) => (
            <button key={m.id || m.type} className="exit-menu__item" role="menuitem" type="button"
              onClick={() => { setOpen(false); onPick(m); }}>
              {m.name}{(m.id && m.id === currentId) ? ' — en cours' : ''}
              {/* Un jeu vide se signale AVANT le lancement : le découvrir en
                  direct, sur un refus du serveur, serait le pire moment. */}
              {m.questions === 0 ? ' — aucune question' : ''}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ============================================================
// FILE D'ATTENTE DU JEU EN COURS (action 6)
//
// L'animateur ne savait pas ce qui venait : il cliquait « question suivante » et
// découvrait la question en même temps que les joueurs. Impossible d'enchaîner
// une difficile sur une facile, de garder la meilleure pour la fin, ou d'écarter
// une question qui tombe mal.
//
// GLISSER-DÉPOSER MAISON, sans nouvelle dépendance : le projet tient sur douze
// bibliothèques, toutes essentielles, et un réordonnancement de liste est une
// interaction bien délimitée. Il fonctionne à la souris comme au doigt.
//
// BOUTONS MONTER/DESCENDRE À CÔTÉ, et pas seulement pour l'accessibilité : en
// direct, sous pression, un bouton ne rate jamais sa cible là où un glisser peut
// déraper.
function FileAttente({ g, moduleId, nomJeu, enCours }) {
  const [file, setFile] = useState([]);
  const [pris, setPris] = useState(null);       // index d'origine de la ligne tenue
  const [cible, setCible] = useState(null);     // index où elle atterrira
  const [decalage, setDecalage] = useState(0);  // px dont elle suit le doigt
  const depart = useRef(null);                  // { y, pas, ordre } à la prise
  const liste = useRef(null);                   // la fenêtre défilante de la file

  const rafraichir = useCallback(() => {
    if (!moduleId) return;
    g.emit('host:getQueue', { moduleId }, (r) => setFile((r && r.queue) || []));
  }, [g, moduleId]);

  useEffect(() => { rafraichir(); }, [rafraichir]);
  useEffect(() => {
    const onQueue = (d) => { if (d && d.moduleId === moduleId) setFile(d.queue || []); };
    g.on('host:queue', onQueue);
    return () => g.off('host:queue', onQueue);
  }, [g, moduleId]);

  // L'ORDRE AFFICHÉ EST CELUI QUE LE SERVEUR CONFIRME (décision 4.8). L'ancienne
  // version posait l'ordre localement PUIS émettait : un message perdu laissait
  // à l'écran un ordre que le serveur ignorait, sans que rien ne le dise. Ici,
  // c'est la réponse du serveur qui met à jour la liste — si elle n'arrive pas,
  // la ligne revient à sa place, ce qui se voit.
  const envoyerOrdre = (suivante) => {
    g.emit('host:reorderQueue', { moduleId, order: suivante.map((q) => q.id) },
      (r) => { if (r && r.moduleId === moduleId) setFile(r.queue || []); });
  };

  const deplacer = (de, vers) => {
    if (vers < 0 || vers >= file.length) return;
    const suivante = file.slice();
    const [x] = suivante.splice(de, 1);
    suivante.splice(vers, 0, x);
    envoyerOrdre(suivante);
  };

  const retirer = (id) => {
    g.emit('host:removeFromQueue', { moduleId, questionId: id },
      (r) => { if (r && r.moduleId === moduleId) setFile(r.queue || []); });
  };

  // ---- LE GLISSER ---------------------------------------------------------
  // AVANT : rien ne bougeait. La ligne prise changeait de teinte et restait sur
  // place ; la liste se réordonnait par téléportation ; le seuil valait 28 px
  // pour une ligne de 60, si bien qu'elle sautait d'un rang avant que le doigt
  // n'ait parcouru un rang ; et CHAQUE pas partait sur le réseau — cinq messages
  // pour un glisser de cinq places.
  //
  // MAINTENANT : la ligne tenue suit le doigt, les autres s'écartent en laissant
  // le trou où elle va tomber, le pas vient de la hauteur MESURÉE, et le serveur
  // n'apprend le nouvel ordre qu'au lâcher.
  //
  // La poignée reste le seul point de prise : en plein direct, l'animateur vise
  // « question suivante », pas un déplacement involontaire.
  const prendre = (i) => (e) => {
    const ligne = e.currentTarget.closest('.file__row');
    const cs = liste.current ? getComputedStyle(liste.current) : null;
    // DÉCISION 4.3 — le pas est la hauteur réelle d'une ligne plus l'écart entre
    // deux lignes. Une constante approchée redevient fausse au premier changement
    // de typo ou d'espacement ; celle d'avant l'était déjà.
    const pas = ligne ? ligne.offsetHeight + (cs ? parseFloat(cs.rowGap) || 0 : 0) : 0;
    depart.current = { y: e.clientY, pas, ordre: file };
    setPris(i);
    setCible(i);
    setDecalage(0);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  // DÉCISION 4.5 — sans défilement automatique, avec quatre lignes visibles sur
  // vingt et une, le glisser ne déplace une question que d'un rang : le pointeur
  // atteint le bord et plus rien ne se passe. La vitesse croît avec la proximité
  // du bord, et elle est plafonnée — un défilement qui s'emballe est pire que pas
  // de défilement, on ne vise plus rien.
  const autoDefiler = (y) => {
    const el = liste.current;
    if (!el || el.scrollHeight <= el.clientHeight) return;
    const r = el.getBoundingClientRect();
    const ZONE = 48;
    const PLAFOND = 16;
    const versHaut = y - r.top;
    const versBas = r.bottom - y;
    let part = 0;
    if (versHaut < ZONE) part = -(ZONE - versHaut) / ZONE;
    else if (versBas < ZONE) part = (ZONE - versBas) / ZONE;
    if (part) el.scrollTop += part * PLAFOND;
  };

  const glisser = (e) => {
    if (pris == null || !depart.current) return;
    const { y, pas } = depart.current;
    const dy = e.clientY - y;
    setDecalage(dy);                       // la ligne suit le doigt (décision 4.1)
    if (pas > 0) {
      const saut = Math.round(dy / pas);
      const vers = Math.max(0, Math.min(file.length - 1, pris + saut));
      if (vers !== cible) setCible(vers);
    }
    autoDefiler(e.clientY);
  };

  const reinitialiser = () => {
    setPris(null);
    setCible(null);
    setDecalage(0);
    depart.current = null;
  };

  const lacher = () => {
    // DÉCISION 4.4 — UN SEUL message, au lâcher. Le glisser est local jusque-là :
    // quatre messages sur cinq disparaissent, et avec eux toute course entre le
    // réordonnancement et la prise de tête de file par le serveur.
    if (pris != null && cible != null && cible !== pris) {
      const suivante = file.slice();
      const [x] = suivante.splice(pris, 1);
      suivante.splice(cible, 0, x);
      envoyerOrdre(suivante);
    }
    reinitialiser();
  };

  // DÉCISION 4.6 — l'échappement et la perte du pointeur ramènent la ligne à sa
  // place, sans rien envoyer. Un geste commencé par erreur doit pouvoir être
  // abandonné : c'est ce qui rend le glisser sûr en direct.
  useEffect(() => {
    if (pris == null) return undefined;
    const surTouche = (e) => { if (e.key === 'Escape') reinitialiser(); };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [pris]);

  // DÉCISION 4.2 — les autres lignes s'écartent et laissent le trou où la ligne
  // tenue va tomber. L'ordre du DOM ne change PAS pendant le geste : ce sont des
  // déplacements graphiques, que le CSS anime. Réordonner le DOM en direct ferait
  // clignoter la liste — c'est exactement ce qu'on corrige.
  const deplacementDe = (i) => {
    if (pris == null || cible == null || !depart.current) return undefined;
    const { pas } = depart.current;
    if (i === pris) return `translateY(${decalage}px)`;
    if (pris < cible && i > pris && i <= cible) return `translateY(${-pas}px)`;
    if (cible < pris && i >= cible && i < pris) return `translateY(${pas}px)`;
    return undefined;
  };

  if (!moduleId) return null;

  return (
    <section className="private" aria-label="File des questions" data-testid="file-attente">
      <p className="private__title">
        <I.eye s={16} /> À venir dans {nomJeu || 'ce jeu'}
        <span className="private__count">{file.length}</span>
      </p>
      {/* LA QUESTION EN COURS, HORS DE LA FILE (décision 3.4 — décision 13 de
          l'action 6 du chantier v1, jamais réalisée). Sans elle, rien ne
          distinguait ce qui venait d'être posé de ce qui vient : c'est la moitié
          « savoir ce qu'il fait » de la remarque de test. Elle n'est pas une
          ligne de file — on ne peut ni la déplacer ni la retirer. */}
      {enCours ? (
        <p className="file__encours" data-testid="file-en-cours">
          <span className="file__encours-label">En cours</span>
          <span className="file__encours-texte" title={enCours}>{enCours}</span>
        </p>
      ) : null}
      {/* La LONGUEUR de la file est l'indicateur de questions fraîches restantes :
          il n'y a rien de plus à construire. Et comme une question posée ne
          revient jamais dans un salon, voir la file fondre est le seul moyen de
          ne pas se retrouver à sec en plein direct. */}
      {file.length === 0 ? (
        <p className="lb__empty" data-testid="file-vide">
          Plus aucune question fraîche dans ce jeu. Lance-en un autre, ou ajoute des
          questions au Studio.
        </p>
      ) : (
        /* `onPointerCancel` ANNULE au lieu de valider : un geste interrompu par
           le système n'est pas un geste terminé. */
        <ol className="file" ref={liste} onPointerMove={glisser} onPointerUp={lacher}
          onPointerCancel={reinitialiser}>
          {file.map((q, i) => (
            <li className={`file__row${pris === i ? ' file__row--pris' : ''}`} key={q.id} data-testid="file-row"
              style={deplacementDe(i) ? { transform: deplacementDe(i) } : undefined}>
              <button className="file__grip" type="button" aria-label={`Déplacer ${q.text}`}
                onPointerDown={prendre(i)}><I.dots s={16} /></button>
              <span className="file__pos">{i + 1}</span>
              <span className="file__text" title={q.text}>{q.text}</span>
              <span className="file__actions">
                <button className="file__btn" type="button" disabled={i === 0}
                  aria-label={`Monter ${q.text}`} onClick={() => deplacer(i, i - 1)}>↑</button>
                <button className="file__btn" type="button" disabled={i === file.length - 1}
                  aria-label={`Descendre ${q.text}`} onClick={() => deplacer(i, i + 1)}>↓</button>
                <button className="file__btn file__btn--danger" type="button"
                  aria-label={`Retirer ${q.text}`} onClick={() => retirer(q.id)}>×</button>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// ============================================================
// Adresse de l'animateur — MASQUÉE par défaut, dévoilée à la demande.
//
// Ce que ça protège n'est pas la curiosité d'un voisin : c'est le passage à
// l'antenne. L'animateur partage son écran, bascule une fenêtre, et son adresse
// personnelle se retrouve devant l'audience — une fuite qu'on ne rattrape pas.
// Elle reste dévoilable, parce qu'il doit pouvoir vérifier sous quel compte il
// est connecté, et le dévoilement se referme tout seul.
// ============================================================
function EmailMasque({ email }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!visible) return undefined;
    const t = setTimeout(() => setVisible(false), 6000);
    return () => clearTimeout(t);
  }, [visible]);
  return (
    <span className="home-bar__account">
      <span className="home-bar__email" data-bind="auth.email" data-testid="host-email"
        data-state={visible ? 'visible' : 'masque'}>
        {visible ? email : masquerEmail(email)}
      </span>
      <button className="button button--quiet" type="button" data-action="auth:revealEmail"
        aria-pressed={visible} aria-label={visible ? "Masquer l'adresse" : "Afficher l'adresse"}
        onClick={() => setVisible((v) => !v)}>
        <I.eye s={16} />
      </button>
    </span>
  );
}

// ============================================================
// A1 — Connexion animateur : la carte SEULE.
// ============================================================
function LoginScreen({ onEstablishRoom }) {
  const supabase = useMemo(() => getSupabase(), []);
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [sent, setSent] = useState(false);       // mail de réinitialisation envoyé
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const seConnecter = useCallback(async (e) => {
    e.preventDefault();
    setError('');
    if (!supabase) { // repli dev (Supabase non configuré) : entrée directe
      setBusy(true);
      try { await onEstablishRoom(undefined); }
      catch { setError('Impossible de créer le salon. Réessayez.'); setBusy(false); }
      return;
    }
    if (!email) { setError('Entrez votre adresse email.'); return; }
    if (!motDePasse) { setError('Entrez votre mot de passe.'); return; }
    setBusy(true);
    try {
      // Aucune INSCRIPTION ici, jamais : les comptes animateur sont créés à la
      // main dans Supabase, et l'inscription publique y est fermée.
      const { error: err } = await supabase.auth.signInWithPassword({ email, password: motDePasse });
      if (err) throw err;
      // La session est posée : la reprise habituelle prend le relais.
    } catch (err) {
      setError(passwordErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [supabase, email, motDePasse, onEstablishRoom]);

  // Seul chemin qui passe encore par un envoi de mail, et il ne sert qu'en cas
  // d'oubli — plus à chaque connexion, comme l'ancien lien.
  const reinitialiser = useCallback(async () => {
    setError('');
    if (!supabase) return;
    if (!email) { setError("Entrez votre adresse email, puis demandez la réinitialisation."); return; }
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/host`,
      });
      if (err) throw err;
      setSent(true);
    } catch (err) {
      setError(resetErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [supabase, email]);

  return (
    <main className="page card-screen" role="main" aria-labelledby="auth-title">
      <div className="auth-card">
        {/* Marque en haut à gauche — la carte n'est pas centrée (maquette A1). */}
        <div className="auth-brand">
          <span className="auth-brand__mark" aria-hidden="true"><I.flame s={22} ember /></span>
          <p className="auth-brand__name">{NOM_DU_JEU}</p>
        </div>

        {sent ? (
          <>
            <div className="auth-card__head auth-card__head--badged">
              <span className="auth-badge auth-badge--ok" aria-hidden="true"><I.mail s={26} /></span>
              <h1 className="auth-card__title" id="auth-title">Message envoyé</h1>
              <p className="auth-card__sub">
                Ouvre le message reçu à <strong data-bind="auth.email">{masquerEmail(email)}</strong> pour
                choisir un nouveau mot de passe.
              </p>
            </div>
            <button className="button" type="button" data-action="auth:back"
              onClick={() => setSent(false)}>Revenir à la connexion</button>
          </>
        ) : (
          <>
            <div className="auth-card__head">
              <h1 className="auth-card__title" id="auth-title">Poste de pilotage</h1>
              <p className="auth-card__sub">Accès réservé aux comptes animateur.</p>
            </div>
            <form className="auth-form" onSubmit={seConnecter} noValidate data-action="auth:signIn">
              <div className="auth-field">
                <label className="auth-label" htmlFor="host-email">Adresse email</label>
                <div className="auth-shell">
                  <input className="auth-shell__input" id="host-email" type="email" name="email"
                    placeholder="toi@exemple.fr" autoComplete="email" value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }} disabled={busy} />
                </div>
              </div>

              {supabase ? (
                <div className={`auth-field${error ? ' auth-field--error' : ''}`}>
                  <label className="auth-label" htmlFor="host-password">Mot de passe</label>
                  <div className="auth-shell">
                    <input className="auth-shell__input" id="host-password" type="password" name="password"
                      autoComplete="current-password" value={motDePasse}
                      onChange={(e) => { setMotDePasse(e.target.value); setError(''); }} disabled={busy}
                      aria-invalid={error ? true : undefined}
                      aria-describedby={error ? 'host-auth-error' : undefined} />
                  </div>
                  {error ? (
                    <p className="auth-card__error" id="host-auth-error" data-bind="auth.error" role="alert">
                      <I.alert s={17} />{error}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <button className="button button--primary button--block button--tall" type="submit"
                data-action="auth:signIn" disabled={busy}>
                {busy ? 'Connexion…' : (supabase ? 'Entrer' : 'Entrer (mode animateur)')}
                {busy ? null : <I.arrow s={18} />}
              </button>

              {supabase ? (
                <button className="button button--quiet button--block" type="button"
                  data-action="auth:reset" onClick={reinitialiser} disabled={busy}>
                  Mot de passe oublié
                </button>
              ) : null}
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
            on rappelle l'adresse concernée et on propose les deux issues.

            TEXTE REVU (action 10) : depuis que l'inscription publique est fermée
            et que la connexion se fait par mot de passe, cet écran ne peut plus
            signaler un intrus — aucun compte non autorisé ne peut exister. Il ne
            reste qu'un seul cas : un compte bel et bien créé, mais absent de la
            liste que connaît le serveur. Autrement dit un oubli de configuration,
            pas une intrusion. L'écran doit donc nommer la cause probable et dire
            quoi faire, au lieu de se contenter de refuser. */}
        <span className="auth-badge auth-badge--warn" aria-hidden="true"><I.lock s={26} /></span>
        <div className="auth-card__head auth-card__head--badged">
          <h1 className="auth-card__title" id="denied-title">Compte non autorisé</h1>
          <p className="auth-card__sub">
            Ce compte existe, mais il ne figure pas dans la liste des animateurs
            autorisée par le serveur. C'est presque toujours un compte créé sans
            avoir été ajouté à la configuration.
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
          <p className="auth-brand__name">{NOM_DU_JEU} · pilotage</p>
        </div>
        <div className="home-bar__end">
          {email ? <EmailMasque email={email} /> : null}
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
  const jeux = useBibliotheque(g);
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

  const toggleBank = (jeu) => {
    const cle = jeu.id || jeu.type;
    if (openBank === cle) { setOpenBank(null); return; }
    setOpenBank(cle);
    if (!banks[cle]) {
      g.emit('host:getBank', { moduleId: jeu.id, moduleType: jeu.type }, (list) => {
        setBanks((prev) => ({ ...prev, [cle]: list || [] }));
        setChecked((prev) => ({ ...prev, [cle]: new Set((list || []).map((q) => q.id)) }));
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
                {jeux.map((m) => (
                  <button key={m.id || m.type} className="button button--block" type="button" role="menuitem"
                    data-action="host:startModule" onClick={() => onStartModule(m)}
                    disabled={m.questions === 0}>
                    Lancer {m.name}
                    {/* Un jeu vide se signale AVANT le lancement, pas par un refus
                        du serveur découvert en plein direct. */}
                    {m.questions === 0 ? ' — aucune question' : ''}
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

          {jeux.map((m) => {
            const cle = m.id || m.type;
            const list = banks[cle] || [];
            const set = checked[cle];
            const partial = set && list.length && set.size < list.length;
            return (
              <div className="bank" key={cle}>
                <button className="bank__head" type="button" aria-expanded={openBank === cle}
                  onClick={() => toggleBank(m)}>
                  <I.chevron s={16} open={openBank === cle} />
                  {m.name}
                  <span className={`bank__count${partial ? ' bank__count--partial' : ''}`}
                    data-bind={`session.selected.${cle}`}>
                    {set ? `${set.size}/${list.length}` : 'toutes'}
                  </span>
                </button>
                {openBank === cle ? (
                  <ul className="bank__list" data-action="host:getBank">
                    {list.length === 0 ? (
                      <li className="private__hint">Chargement…</li>
                    ) : list.map((q) => (
                      <li key={q.id}>
                        <label className="bank__q">
                          <input type="checkbox" checked={set ? set.has(q.id) : true}
                            onChange={() => toggleQuestion(cle, q.id)} />
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
    // L'histogramme de dispersion, spécifié par la maquette A5 et jamais
    // construit : trois chiffres disent où est le groupe, mais pas s'il est
    // groupé ou éparpillé — et c'est cette forme-là que l'animateur lit d'un
    // coup d'œil pour décider quand révéler.
    const histo = stats?.histogramme || dist.histogramme || null;
    const hautMax = histo ? Math.max(1, ...histo.counts) : 1;
    return (
      <div className="dist__numeric">
        {histo ? (
          <div className="histo" data-testid="histogramme">
            <p className="histo__legend">
              Dispersion des <span className="histo__legend-num">{fmt(total)}</span> estimation{total > 1 ? 's' : ''}
            </p>
            <div className="histo__plot">
              {histo.counts.map((c, i) => (
                <span
                  key={i}
                  className={`histo__bar${i === histo.cibleIndex ? ' histo__bar--cible' : ''}`}
                  style={{ height: `${Math.round((c / hautMax) * 100)}%` }}
                  title={`${c} estimation${c > 1 ? 's' : ''}`}
                  data-count={c}
                />
              ))}
            </div>
            {/* La cible est repérée dans le graphique : on voit où tombe la
                vérité par rapport au groupe, pas seulement où est le groupe. */}
            <p className="histo__target">Bonne réponse repérée en couleur</p>
          </div>
        ) : null}
        <div className="dist__facts">
          {cells.map(([label, v]) => (
            <div className="dist__fact" key={label}>
              <span className="h-label">{label}</span>
              <span className="dist__fact-value">{v != null ? fmt(v) : '—'}</span>
            </div>
          ))}
        </div>
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
  return (
    <div className="dist">
      {options.map((opt, i) => {
        const c = counts[i] || 0;
        // Part du TOTAL, jamais de l'option en tête : la barre et l'étiquette
        // chiffrée posée juste à côté doivent raconter la même chose. Cadrer sur
        // le maximum mettait l'option de tête à 100 % quoi qu'il arrive, à côté
        // d'une étiquette qui affichait « 75 % ».
        const pct = total ? Math.round((c / total) * 100) : 0;
        return (
          <div className={`dist__row${i === correctIndex ? ' dist__row--correct' : ''}`} key={i}>
            {showKey ? <span className="dist__key" aria-hidden="true">{KEYS[i] || i + 1}</span> : <span />}
            <span className="dist__track">
              {/* --om-to est le CONTRAT du système de design (tokens.css:324) :
                  l'animation pousse la barre de 0 jusqu'à cette valeur et y reste,
                  et la règle CSS lit la même valeur pour la largeur. Sans elle,
                  l'animation retombait sur sa valeur par défaut (100 %) et écrasait
                  la largeur — toutes les barres finissaient pleines. */}
              <span className="dist__fill" style={{ '--om-to': `${pct}%` }} aria-hidden="true" />
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
  const jeux = useBibliotheque(g);
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
  // Classement COMPLET, plus une vue tronquée (action 3). La liste étant triée,
  // le premier reste en tête : le coup d'œil en direct ne coûte rien, et le reste
  // est à portée de défilement. Le onzième joueur n'existait pas jusqu'ici, ni
  // ici ni sur le stream.
  const classement = g.leaderboard || [];
  const hasScores = classement.some((p) => (p.score || 0) > 0);
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

          {/* LA FILE, DANS LA COLONNE CENTRALE (chantier v2, décision 3.1).
              Elle vivait dans la colonne latérale de 336 px, où trois commandes
              au plancher tactile de 44 px ne laissaient à l'énoncé que quelques
              dizaines de pixels : chaque ligne affichait « Q. ».
              Ici, sous le jeu en cours, elle dispose de la largeur du centre —
              l'énoncé, le numéro, la poignée et les commandes tiennent sur une
              seule ligne, sans rien comprimer. Et l'ordre de lecture dit ce que
              l'animateur fait : ce qui est à l'antenne, puis ce qui vient. */}
          <FileAttente g={g} moduleId={current && current.moduleId} nomJeu={current && current.meta?.name}
            enCours={current && current.text} />
        </div>

        <aside className="rail">
          <section className="private" aria-label="Classement en direct">
            <p className="private__title">
              <I.eye s={16} /> Classement — toi seul
              {classement.length ? <span className="private__count">{fmt(classement.length)}</span> : null}
            </p>
            {classement.length === 0 ? (
              <p className="lb__empty">Aucun score pour l'instant.</p>
            ) : (
              <div className="lb lb--scroll" data-bind="leaderboard" data-testid="host-leaderboard">
                {classement.map((p, i) => (
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

          {/* Le panneau « Bonus / Malus » a été SUPPRIMÉ (action 8). Il proposait
              d'ajouter ou retirer 100 points à n'importe quel joueur, sans règle,
              sans trace et sans retour arrière. C'était le seul objet du projet à
              porter ce nom en titre — et le seul à n'avoir effectivement aucune
              règle, d'où le malaise en réunion de test. Les vrais bonus, eux,
              étaient automatiques et parfaitement définis : ils sont conservés et
              désormais énoncés au joueur. */}
        </aside>
      </main>

      <nav className="actions" aria-label="Contrôles animateur">
        {revealed ? (
          <>
            <button className="button button--primary button--lg" type="button"
              data-action="host:startModule" onClick={onNextQuestion}>Question suivante</button>
            <ModuleMenu jeux={jeux} currentId={current && current.moduleId} onPick={onChangeModule} />
          </>
        ) : (
          <>
            <button className="button button--primary button--lg" type="button"
              data-action="host:reveal" onClick={() => g.emit('host:reveal')}>Révéler maintenant</button>
            <ModuleMenu jeux={jeux} currentId={current && current.moduleId} onPick={onChangeModule} />
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
  // Le reste du classement, ENTIER : il s'arrêtait au huitième, ce qui laissait
  // les joueurs suivants hors de portée de l'animateur au moment même où il
  // commente les résultats.
  const rest = scored.slice(3);

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

  // Reçoit un JEU de la bibliothèque ({ id, type, name }) — ou, en repli, un objet
  // ne portant qu'un type quand la bibliothèque n'est pas encore arrivée.
  const startModule = useCallback((jeu) => {
    if (!g.connected) { setToast('Connexion au salon en cours — réessaie dans une seconde.'); return; }
    setHostError(null);
    g.emit('host:startModule', { moduleId: jeu?.id, moduleType: jeu?.type });
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
  // Le jeu en cours, pour que « question suivante » reste dans CE jeu.
  const jeuEnCours = g.current
    ? { id: g.current.moduleId, type: g.current.type, name: g.current.meta?.name }
    : { type: 'quiz' };

  // --- Partie terminée OU classement demandé ---
  if (state === 'ended' || showResults) {
    return (
      <>
        <ResultsScreen
          g={g}
          onNextModule={() => { setShowResults(false); startModule(jeuEnCours); }}
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
          onNextQuestion={() => startModule(jeuEnCours)}
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
