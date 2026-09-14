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
import { plagesVisibles, bornes, barres, repereCible } from '../shared/echelle-estimation.js';
import { formatteurDe, secondes as secondesFr } from '../shared/temps.js';
import { pourcent } from '../shared/proportion.js';
import { SerieGraphique } from '../shared/SerieGraphique.jsx';
import { GrilleCache } from '../shared/GrilleCache.jsx';
import { Symbole } from '../shared/Symbole.jsx';
import QRCode from 'qrcode';
import { useGame, store } from '../shared/useGame.js';
import { createRoom } from '../shared/net.js';
import { getSupabase } from '../shared/supabaseClient.js';
import { shouldPurgeHostSession } from '../shared/hostSession.js';
import { passwordErrorMessage, resetErrorMessage, masquerEmail } from '../shared/authErrors.js';
import { BrandLoader } from '../shared/BrandLoader.jsx';
import { usePhraseDeManche } from '../shared/voix-hooks.js';
import { Visage } from '../shared/Visage.jsx';
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

// LE VOLET DE NAVIGATION (chantier v4, action 9).
//
// CE QUI MANQUAIT. L'adresse du stream n'était offerte que dans le salon
// d'attente : l'écran de direct ne recevait même pas le jeton. Une fois la partie
// lancée, l'animateur n'avait plus aucun moyen de la retrouver — ni d'atteindre
// le Studio.
//
// CE QUI RENDAIT LA CORRECTION SÛRE. Le salon SURVIT au départ de l'animateur :
// le gestionnaire de déconnexion du serveur ne touche que les joueurs, et la
// session de l'animateur vit sous une clé fixe qui se restaure au retour. La
// navigation était donc déjà possible ; il n'en manquait que le moyen.
//
// DÉCISION 9.5 — aucune confirmation en pleine manche. C'est son métier ; une
// confirmation de plus en direct coûte plus qu'elle ne protège.
function VoletNavigation({ overlayToken }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const streamUrl = overlayToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/overlay?token=${overlayToken}`
    : null;

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [open]);

  return (
    <div className="exit-menu" ref={ref} data-testid="volet-navigation">
      <button className="button button--quiet" type="button" aria-haspopup="menu" aria-expanded={open}
        data-action="nav:open" onClick={() => setOpen((v) => !v)}>
        <I.arrow s={20} />
        Naviguer
      </button>
      {open ? (
        <div className="exit-menu__pop" role="menu">
          {/* DÉCISION 9.8 — le dire explicitement : sans cette phrase, l'animateur
              croit fermer son salon en le quittant et en rouvre un second, avec un
              autre code, pendant que ses joueurs restent dans le premier. */}
          <p className="exit-menu__note" data-testid="nav-salon-ouvert">Le salon reste ouvert. Tu peux revenir quand tu veux.</p>
          <a className="exit-menu__item" role="menuitem" href="/host" data-action="nav:animation">
            Animation
          </a>
          <a className="exit-menu__item" role="menuitem" href="/studio" data-action="nav:studio">
            Studio — mes jeux
          </a>
          {/* DÉCISION 9.3 — le stream dans un ONGLET SÉPARÉ : il ne doit jamais
              remplacer la console en plein direct.
              DÉCISION 9.1 — l'adresse est DÉVOILÉE, non masquée. Arbitrage de
              l'auteur ; le jeton reste celui que l'audit du v1 a classé ouvert et
              accepté (F-009). */}
          {streamUrl ? (
            <a className="exit-menu__item" role="menuitem" href={streamUrl}
              target="_blank" rel="noreferrer" data-action="nav:stream" data-testid="nav-stream">
              Écran de stream — nouvel onglet
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// LA SAISIE DES DEUX MOTS — « Le lien ».
//
// C'est le seul jeu dont la question s'écrit à l'antenne. Le bouton reste inerte
// tant que les deux mots ne sont pas remplis : diffuser un lien à moitié posé
// n'aurait aucun sens, et l'animateur le découvrirait devant son public.
function SaisieLien({ jeu, onDiffuser, onAnnuler }) {
  const [mot1, setMot1] = useState('');
  const [mot2, setMot2] = useState('');
  const pret = mot1.trim().length > 0 && mot2.trim().length > 0;
  return (
    <section className="private lien-saisie" aria-label="Préparer Le lien" data-testid="saisie-lien">
      <p className="private__title"><I.eye s={16} /> {jeu.name} — toi seul</p>
      <p className="lien-saisie__aide">
        Deux mots. Le cercle cherchera celui qui les relie, et marque en pensant
        comme les autres.
      </p>
      <form
        className="lien-saisie__form"
        onSubmit={(e) => { e.preventDefault(); if (pret) onDiffuser(jeu, mot1.trim(), mot2.trim()); }}
      >
        <label className="flabel" htmlFor="lien-mot1">Mot n° 1</label>
        <input className="input" id="lien-mot1" type="text" autoComplete="off" maxLength={40}
          value={mot1} onChange={(e) => setMot1(e.target.value)} data-testid="lien-mot1" />
        <label className="flabel" htmlFor="lien-mot2">Mot n° 2</label>
        <input className="input" id="lien-mot2" type="text" autoComplete="off" maxLength={40}
          value={mot2} onChange={(e) => setMot2(e.target.value)} data-testid="lien-mot2" />
        <div className="lien-saisie__actions">
          <button className="button button--primary" type="submit" disabled={!pret}
            data-action="host:diffuserLien" data-testid="lien-diffuser">
            Diffusion aux joueurs
          </button>
          {onAnnuler ? (
            <button className="button button--quiet" type="button" onClick={onAnnuler}>Annuler</button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

// LA SAISIE DES DEUX TEMPS — « Le juste temps ».
//
// Deux champs, et un seul est obligatoire. C'est la demande, à la lettre : « un
// bouton "Diffusion aux joueurs" [...] ne s'active que si le champ "Temps cible"
// n'est pas vide ».
//
// POURQUOI LE TEMPS DE CACHE PEUT RESTER VIDE, ET CE QUE ÇA FAIT. Un cache vide
// vaut zéro : le chrono ne disparaît jamais, et la manche devient un exercice de
// réflexe à vue plutôt que d'estimation à l'aveugle. C'est un usage légitime —
// une première manche pour montrer le jeu — et l'écran le DIT, plutôt que de
// laisser l'animateur le découvrir à l'antenne.
//
// LES BORNES SONT CELLES DU CADRAN. Un temps hors de zéro-quinze n'a pas de sens
// ici : le serveur les rabat de toute façon (`borneDeChrono`), mais un champ qui
// laisse taper 42 pour le corriger en silence est un piège — l'animateur croirait
// avoir posé une cible que personne ne peut atteindre.
function SaisieJusteTemps({ jeu, duree, onDiffuser, onAnnuler }) {
  const [cache, setCache] = useState('');
  const [cible, setCible] = useState('');
  const dansLeCadran = (v) => v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= duree);
  const cibleValide = cible.trim() !== '' && dansLeCadran(cible);
  const cacheValide = dansLeCadran(cache);
  const pret = cibleValide && cacheValide;
  return (
    <section className="private lien-saisie" aria-label="Préparer Le juste temps" data-testid="saisie-juste-temps">
      <p className="private__title"><I.eye s={16} /> {jeu.name} — toi seul</p>
      <p className="lien-saisie__aide">
        Un compte à rebours de {duree} secondes part sur les téléphones. Il s'efface
        au temps de cache et continue de courir : le cercle appuie sur STOP quand il
        croit l'entendre passer sur le temps cible.
      </p>
      {/* LES CHAMPS SONT COURTS, ET EN RANGÉE. Le premier jet leur donnait toute
          la largeur du panneau pour cinq caractères, et empilait leurs aides sans
          respiration : deux champs de chrono se comparent d'un coup d'œil, ils
          doivent être côte à côte et de la taille de ce qu'on y tape. Ce sont les
          primitives de formulaire du projet (`fields`, `frow`, `fgroup--short`),
          celles-là mêmes que la console partage avec le studio. */}
      <form
        className="lien-saisie__form fields"
        onSubmit={(e) => { e.preventDefault(); if (pret) onDiffuser(jeu, cache, cible); }}
      >
        <div className="frow">
          <div className="fgroup fgroup--short">
            <label className="flabel" htmlFor="jt-cache">Temps de cache</label>
            <div className="input-suffix">
              <input className={`input${cacheValide ? '' : ' input--invalid'}`} id="jt-cache" type="number"
                inputMode="decimal" step="0.01" min="0" max={duree} placeholder="0,00"
                value={cache} onChange={(e) => setCache(e.target.value)} data-testid="jt-cache" />
              <span className="input-suffix__unit">s</span>
            </div>
          </div>
          <div className="fgroup fgroup--short">
            <label className="flabel" htmlFor="jt-cible">Temps cible</label>
            <div className="input-suffix">
              <input className={`input${cibleValide || cible.trim() === '' ? '' : ' input--invalid'}`} id="jt-cible"
                type="number" inputMode="decimal" step="0.01" min="0" max={duree} placeholder="0,00"
                value={cible} onChange={(e) => setCible(e.target.value)} data-testid="jt-cible" />
              <span className="input-suffix__unit">s</span>
            </div>
          </div>
        </div>
        <p className="fhint">
          Le chrono disparaît en arrivant sur le <strong>temps de cache</strong> — laissé
          vide, il reste visible jusqu'au bout. Le <strong>temps cible</strong> est celui
          qu'il faut viser : personne ne le voit avant la révélation.
        </p>
        <div className="lien-saisie__actions">
          <button className="button button--primary" type="submit" disabled={!pret}
            data-action="host:diffuserJusteTemps" data-testid="jt-diffuser">
            Diffusion aux joueurs
          </button>
          {onAnnuler ? (
            <button className="button button--quiet" type="button" onClick={onAnnuler}>Annuler</button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

// LA SAISIE DE LA PROPORTION — « Coupe ta bûche ».
//
// Un seul champ, et le bouton reste inerte tant qu'il est vide : « ne s'active
// que si le champ "Proportion cible" n'est pas vide ». Diffuser sans proportion
// lancerait une manche que personne ne peut gagner, et l'animateur le
// découvrirait devant son public.
function SaisieBuche({ jeu, onDiffuser, onAnnuler }) {
  const [cible, setCible] = useState('');
  // L'ALLURE DU CURSEUR, choisie avant de diffuser. Elle survit d'une manche à
  // l'autre : un animateur qui enchaîne trois bûches en rapide ne veut pas la
  // rechoisir à chaque fois — même règle que le mode de « Retour de flamme ».
  const [allure, setAllure] = useState('normal');
  const dansLaBuche = cible !== '' && Number.isFinite(Number(cible))
    && Number(cible) >= 0 && Number(cible) <= 100;
  return (
    <section className="private lien-saisie" aria-label="Préparer Coupe ta bûche" data-testid="saisie-buche">
      <p className="private__title"><I.eye s={16} /> {jeu.name} — toi seul</p>
      <p className="lien-saisie__aide">
        Un curseur balaie la bûche{allure === 'rapide' ? ', deux allers-retours par seconde' : ', un aller-retour par seconde'}.
        Le cercle frappe quand il le croit sur la proportion demandée. Dix secondes de jeu.
      </p>
      <form className="lien-saisie__form fields"
        onSubmit={(e) => { e.preventDefault(); if (dansLaBuche) onDiffuser(jeu, Number(cible), allure); }}>
        <div className="frow">
          <div className="fgroup fgroup--short">
            <label className="flabel" htmlFor="cb-cible">Proportion cible</label>
            <div className="input-suffix">
              <input className={`input${cible === '' || dansLaBuche ? '' : ' input--invalid'}`}
                id="cb-cible" type="number" inputMode="numeric" step="1" min="0" max="100"
                placeholder="0" value={cible} onChange={(e) => setCible(e.target.value)}
                data-testid="cb-cible" />
              <span className="input-suffix__unit">%</span>
            </div>
          </div>
        </div>
        <p className="fhint">
          La part de bûche <strong>à gauche</strong> du trait. Le cercle la voit
          écrite pendant toute la manche : c'est la consigne, pas la réponse.
        </p>
        {/* L'ALLURE — « l'animateur aurait donc la possibilité de choisir le mode
            Normal ou le mode Rapide avant de lancer le jeu ». Deux boutons plutôt
            qu'une liste : en direct, un bouton ne rate jamais sa cible. */}
        <div className="fgroup">
          <span className="flabel" id="cb-allure">Allure du curseur</span>
          <div className="seg" role="radiogroup" aria-labelledby="cb-allure">
            {[['normal', 'Normal', '1 s par trajet'], ['rapide', 'Rapide', '0,5 s par trajet']].map(([cle, label, aide]) => (
              <button key={cle} type="button" role="radio" aria-checked={allure === cle}
                className={`button ${allure === cle ? 'button--primary' : 'button--quiet'}`}
                data-testid={`cb-allure-${cle}`} onClick={() => setAllure(cle)}>
                {label} <span className="fhint" style={{ marginLeft: 'var(--sp-2)' }}>{aide}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="lien-saisie__actions">
          <button className="button button--primary" type="submit" disabled={!dansLaBuche}
            data-action="host:diffuserBuche" data-testid="cb-diffuser">
            Diffusion aux joueurs
          </button>
          {onAnnuler ? (
            <button className="button button--quiet" type="button" onClick={onAnnuler}>Annuler</button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

// LE DÉPART D'UN JEU ORDINAIRE — rien à préparer, juste le moment.
//
// POURQUOI IL EXISTE MAINTENANT. Les quatre jeux « en direct » s'annonçaient déjà
// avant de démarrer, parce qu'ils demandent une saisie. Les quatre autres
// partaient d'un clic : la question tombait sur les téléphones sans qu'on ait dit
// à quoi on jouait. La consigne est désormais générale — « chaque module doit
// comporter un écran d'attente lorsque l'animateur le lance » — et ce panneau est
// ce qui la rend possible : le cercle voit le jingle pendant que l'animateur
// présente, puis l'animateur donne le départ quand il a fini sa phrase.
function DepartSimple({ jeu, onDemarrer, onAnnuler }) {
  return (
    <section className="private lien-saisie" aria-label={`Démarrer ${jeu.name}`} data-testid="depart-simple">
      <p className="private__title"><I.eye s={16} /> {jeu.name} — toi seul</p>
      <p className="lien-saisie__aide">
        Le cercle voit l'écran d'attente. Présente le jeu, puis donne le départ :
        la première question part à ce moment-là, et le chrono avec.
      </p>
      <div className="lien-saisie__actions">
        <button className="button button--primary" type="button"
          data-action="host:demarrerSimple" data-testid="simple-demarrer"
          onClick={() => onDemarrer(jeu)}>
          Démarrer le jeu
        </button>
        {onAnnuler ? (
          <button className="button button--quiet" type="button" onClick={onAnnuler}>Annuler</button>
        ) : null}
      </div>
    </section>
  );
}

// LE DÉPART DE « RETOUR DE FLAMME » — le mode, puis le top.
//
// L'énoncé ne demande qu'« un bouton Démarrer le jeu ». Il faut pourtant que le
// MODE se choisisse quelque part : le jeu se joue en −2 ou en −3, et rien d'autre
// dans l'application ne peut le dire. Deux boutons au-dessus du départ, et c'est
// tout — l'animateur voit en un coup d'œil ce qu'il va lancer.
//
// LE CHOIX PART TOUT DE SUITE VERS L'ANNONCE, avant même le départ : l'écran
// d'attente du cercle montre la règle en image — trois tuiles ou quatre. Un mode
// annoncé qui ne serait pas celui joué serait pire que pas d'image du tout.
function DepartRetour({ jeu, ecart, famille, onMode, onFamille, onDemarrer, onAnnuler }) {
  return (
    <section className="private lien-saisie" aria-label="Démarrer Retour de flamme" data-testid="depart-retour">
      <p className="private__title"><I.eye s={16} /> {jeu.name} — toi seul</p>
      <p className="lien-saisie__aide">
        Trente images, une toutes les deux secondes. Le cercle buzze quand une image
        revient {ecart === 3 ? 'trois' : 'deux'} images plus tard — il y en a six, ni
        plus ni moins. Une minute de jeu.
        {famille === 'figures' ? ' Cinq figures : le jeu est plus serré.' : ' Dix chiffres.'}
      </p>
      <div className="fields">
        <div className="fgroup">
          <span className="flabel">Mode</span>
          <div className="frow" role="group" aria-label="Mode de jeu">
            {[2, 3].map((e) => (
              <button key={e} type="button"
                className={`button ${ecart === e ? 'button--primary' : 'button--quiet'}`}
                aria-pressed={ecart === e}
                data-testid={`retour-mode-${e}`}
                onClick={() => onMode(e)}>
                Retour −{e}
              </button>
            ))}
          </div>
        </div>
        {/* LE STYLE D'IMAGE. Une série n'emploie qu'une famille : dix chiffres ou
            cinq figures, jamais les deux mélangés. Le choix est ici parce qu'il
            change la difficulté autant que le mode — cinq signes se retiennent
            plus facilement que dix, et un chiffre au milieu de figures donnerait à
            l'œil un repère gratuit qui remplacerait la mémoire du signe. */}
        <div className="fgroup">
          <span className="flabel">Style d'image</span>
          <div className="frow" role="group" aria-label="Style d'image">
            {[['chiffres', 'Chiffres'], ['figures', 'Figures']].map(([f, label]) => (
              <button key={f} type="button"
                className={`button ${famille === f ? 'button--primary' : 'button--quiet'}`}
                aria-pressed={famille === f}
                data-testid={`retour-famille-${f}`}
                onClick={() => onFamille(f)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="lien-saisie__actions">
        <button className="button button--primary" type="button"
          data-action="host:demarrerRetour" data-testid="retour-demarrer"
          onClick={() => onDemarrer(jeu, ecart, famille)}>
          Démarrer le jeu
        </button>
        {onAnnuler ? (
          <button className="button button--quiet" type="button" onClick={onAnnuler}>Annuler</button>
        ) : null}
      </div>
    </section>
  );
}

// LE DÉPART DE « LES VISAGES » — l'animateur choisit son moment.
//
// Il n'a RIEN à saisir : la série est tirée par le serveur, qui seul la connaît.
// Ce panneau existe pour une seule raison — le temps qui sépare l'annonce du
// premier visage appartient à l'animateur, qui présente le jeu à l'antenne. Sans
// lui, les visages commenceraient à défiler pendant qu'il finit sa phrase.
// LE MODE SE CHOISIT ICI, À L'ANTENNE — pas au Studio.
//
// CE QUI A ÉTÉ DEMANDÉ (12/09) : un mode « Classique », plus facile, à côté du
// mode « Couleur » qui devient le mode difficile. Deux modules séparés au Studio
// auraient dédoublé la modération — la même banque, les mêmes énoncés, deux
// endroits où les tenir à jour. C'est une DIFFICULTÉ, et une difficulté se décide
// devant le public, comme l'allure du curseur de « Coupe ta bûche ».
//
// LES MODES VIENNENT DU SERVEUR (`meta.modes`). L'écran ne les invente pas : un
// mode ajouté au jeu sans être ajouté ici resterait injouable, et un mode écrit
// ici que le serveur ignore promettrait une partie qui ne partirait jamais.
function DepartCache({ jeu, modes, defaut, onDemarrer, onAnnuler }) {
  const choix = modes?.length ? modes : [{ cle: 'couleur', nom: 'Couleur', sous: 'Neuf objets, cinq couleurs' }];
  const [mode, setMode] = useState(defaut || choix[0].cle);
  const courant = choix.find((m) => m.cle === mode) || choix[0];
  return (
    <section className="private lien-saisie" aria-label="Démarrer Cache-cache" data-testid="depart-cache">
      <p className="private__title"><I.eye s={16} /> {jeu.name} — toi seul</p>
      <p className="lien-saisie__aide">
        Neuf objets se montrent un par un, trois secondes chacun — trente-huit
        secondes en tout. Cinq questions suivent, seize secondes chacune, et c'est
        toi qui les enchaînes. Donne le départ quand tu es prêt.
      </p>
      <div className="fgroup">
        <span className="flabel" id="cc-mode">Mode de jeu</span>
        <div className="seg" role="radiogroup" aria-labelledby="cc-mode">
          {choix.map((m) => (
            <button key={m.cle} type="button" role="radio" aria-checked={mode === m.cle}
              className={`button ${mode === m.cle ? 'button--primary' : 'button--quiet'}`}
              data-testid={`cc-mode-${m.cle}`} onClick={() => setMode(m.cle)}>
              {m.nom}
            </button>
          ))}
        </div>
        <p className="fhint" data-testid="cc-mode-aide">
          {courant.sous}{courant.difficile ? ' — le mode difficile.' : '.'}
        </p>
      </div>
      <div className="lien-saisie__actions">
        <button className="button button--primary" type="button"
          data-action="host:demarrerCache" data-testid="cache-demarrer"
          onClick={() => onDemarrer(jeu, mode)}>
          Démarrer le jeu
        </button>
        {onAnnuler ? (
          <button className="button button--quiet" type="button" onClick={onAnnuler}>Annuler</button>
        ) : null}
      </div>
    </section>
  );
}

function DepartVisages({ jeu, onDemarrer, onAnnuler }) {
  return (
    <section className="private lien-saisie" aria-label="Démarrer Les visages" data-testid="depart-visages">
      <p className="private__title"><I.eye s={16} /> {jeu.name} — toi seul</p>
      <p className="lien-saisie__aide">
        Vingt visages, un toutes les deux secondes. Un seul repasse : ils buzzent
        quand ils le revoient. Quarante secondes de jeu — donne le départ quand tu
        es prêt.
      </p>
      <div className="lien-saisie__actions">
        <button className="button button--primary" type="button"
          data-action="host:demarrerVisages" data-testid="visages-demarrer"
          onClick={() => onDemarrer(jeu)}>
          Démarrer le jeu
        </button>
        {onAnnuler ? (
          <button className="button button--quiet" type="button" onClick={onAnnuler}>Annuler</button>
        ) : null}
      </div>
    </section>
  );
}

// LES DEUX GRAPHIQUES DE SÉRIE DE LA CONSOLE — visages et retours de flamme.
//
// Le dessin est partagé (`shared/SerieGraphique.jsx`) : c'est le même graphique,
// aux images près. Chacun n'apporte ici que ce qui lui appartient — comment
// dessiner une image, et ce qu'une place vaut dans son jeu.

// « LES VISAGES ». Deux rôles, et c'est le cœur du jeu : buzzer sur la PREMIÈRE
// apparition est une erreur, sur la seconde une réussite. Les afficher
// pareillement rendrait le graphique illisible au moment exact où l'animateur en
// a besoin.
function GraphiqueVisages({ stats, taille = 46 }) {
  if (!stats || !Array.isArray(stats.ordre)) return null;
  const adresse = new Map(stats.adresses || []);
  return (
    <SerieGraphique
      ordre={stats.ordre} parPlace={stats.parPlace} bloc="vsgraf" testid="visages-graphique"
      roleDe={(place) => (
        place === stats.pos2 ? { nom: 'seconde', grand: true, bonne: true }
          : place === stats.pos1 ? { nom: 'premiere', grand: true, bonne: false }
            : null
      )}
      rendu={(id, { grand, place, role }) => (
        <Visage id={id} src={adresse.get(id)} taille={grand ? Math.round(taille * 1.5) : taille}
          titre={role?.nom === 'seconde' ? `Visage ${place}, seconde apparition`
            : role?.nom === 'premiere' ? `Visage ${place}, première apparition` : `Visage ${place}`} />
      )}
    />
  );
}

// « RETOUR DE FLAMME ». Un seul rôle, six fois : les places où l'image répétait
// celle d'il y a deux (ou trois) passages. Ce sont les six moments où il fallait
// buzzer, et le graphique n'a rien d'autre à dire.
function GraphiqueRetour({ stats, taille = 40 }) {
  if (!stats || !Array.isArray(stats.ordre)) return null;
  const retours = new Set(stats.retours || []);
  return (
    <SerieGraphique
      ordre={stats.ordre} parPlace={stats.parPlace} bloc="vsgraf" testid="retour-graphique"
      roleDe={(place) => (retours.has(place) ? { nom: 'retour', grand: true, bonne: true } : null)}
      rendu={(id, { grand, place, role }) => (
        <Symbole id={id} taille={grand ? Math.round(taille * 1.5) : taille}
          titre={role ? `Image ${place}, retour de flamme` : `Image ${place}`} />
      )}
    />
  );
}

// LE CLASSEMENT DE MANCHE — POUR L'ANIMATEUR SEUL.
//
// POURQUOI IL EXISTE. Le graphique de répartition dit COMMENT le cercle s'est
// réparti ; il ne dit pas QUI a fait quoi. L'animateur commente à l'antenne :
// sans les noms, il ne peut féliciter personne, et c'est son métier. Les noms ne
// partent jamais vers le stream — même frontière que le plus proche de
// l'estimation et que les groupes du lien.
//
// UN SEUL COMPOSANT POUR LES DEUX JEUX QUI EN ONT UN. « Le juste temps » y montre
// l'écart et le temps d'arrêt, « Retour de flamme » le score et les buzz : ce
// sont les COLONNES qui changent, pas le tableau. Le serveur compose les lignes,
// l'écran les nomme.
const COLONNES_CLASSEMENT = {
  juste_temps: [
    ['Écart', (l) => secondesFr(l.ecart)],
    ['Arrêté à', (l) => secondesFr(l.valeur)],
  ],
  coupe_buche: [
    ['Écart', (l) => `${l.ecart} pt`],
    ['Coupé à', (l) => pourcent(l.valeur)],
  ],
  retour_flamme: [
    ['Score', (l) => fmt(l.score)],
    ['Réussis', (l) => fmt(l.bons)],
    ['Ratés', (l) => fmt(l.rates)],
  ],
};

// « CACHE-CACHE » — CE QUE L'ANIMATEUR VOIT PENDANT LES RÉPONSES.
//
// Trois choses, et l'énoncé les demande ensemble : « la matrice qui révèle la
// bonne case doit être affichée avec à côté la question et la réponse [...] Il
// faut également un tableau en-dessous du classement des 50 premières personnes
// avec leur nombre de points à chaque dévoilement. »
//
// LE CLASSEMENT SE CONSTRUIT COLONNE PAR COLONNE. À la première réponse dévoilée
// il ne juge que la première question ; à la cinquième il a sept colonnes — le
// nom, les cinq questions, le total. C'est le SERVEUR qui les envoie, sur le
// canal de l'animateur seul : les noms ne partent jamais vers le stream.
function CacheReponses({ g, roundId }) {
  const [classement, setClassement] = useState(null);
  useEffect(() => {
    const onClsm = (d) => setClassement(d && d.roundId === roundId ? d : null);
    g.on('cache:classement', onClsm);
    return () => g.off('cache:classement', onClsm);
  }, [g, roundId]);

  const devoilements = g.devoilements;
  if (!devoilements.length) return null;
  const dernier = devoilements[devoilements.length - 1];

  return (
    <section className="private" aria-label="Réponses de Cache-cache" data-testid="cache-reponses">
      <p className="private__title">
        <I.eye s={16} /> Réponse {dernier.n}/{dernier.total} — toi seul
      </p>
      <div className="ccrep">
        <GrilleCache bloc="ccrep__grille" taille={168} testid="cache-matrice"
          etiquette={`Case ${dernier.place} dévoilée`}
          vive={dernier.place}
          montre={(place) => {
            const d = devoilements.find((x) => x.place === place);
            return d ? <img src={d.objet.src} alt="" /> : <span className="ccrep__num">{place}</span>;
          }} />
        <div className="ccrep__texte">
          <p className="ccrep__question">{dernier.texte}</p>
          <p className="ccrep__reponse">
            <span className="p-label p-label--tiny">La réponse</span>
            <strong data-testid="cache-reponse">{dernier.reponse}</strong>
          </p>
        </div>
      </div>

      {classement && classement.lignes.length ? (
        <div className="clsm" style={{ '--clsm-cols': dernier.n + 1 }} data-testid="cache-classement">
          <div className="clsm__ligne clsm__ligne--tete">
            <span className="clsm__rang" />
            <span className="clsm__nom">Joueur</span>
            {Array.from({ length: dernier.n }, (_, i) => (
              <span className="clsm__col" key={i}>Q{i + 1}</span>
            ))}
            <span className="clsm__col">Total</span>
          </div>
          {classement.lignes.map((l, i) => (
            <div className="clsm__ligne" key={`${l.pseudo}-${i}`}>
              <span className="clsm__rang">{i + 1}</span>
              <span className="clsm__nom" title={l.pseudo}>{l.pseudo}</span>
              {l.points.map((p, j) => <span className="clsm__col" key={j}>{fmt(p)}</span>)}
              <span className="clsm__col"><strong>{fmt(l.total)}</strong></span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ClassementManche({ g, roundId, revealed }) {
  const [donnee, setDonnee] = useState(null);
  useEffect(() => {
    const onClassement = (d) => setDonnee(d && Array.isArray(d.lignes) ? d : null);
    g.on('host:classement', onClassement);
    return () => g.off('host:classement', onClassement);
  }, [g]);
  // À LA RÉVÉLATION SEULEMENT, et pour la manche affichée : un souvenir d'une
  // manche antérieure ferait commenter des noms qui ne sont plus à l'antenne.
  if (!revealed || !donnee || donnee.roundId !== roundId) return null;
  const colonnes = COLONNES_CLASSEMENT[donnee.type];
  if (!colonnes || !donnee.lignes.length) return null;
  return (
    <section className="private" aria-label="Classement de la manche" data-testid="classement-manche">
      <p className="private__title">
        <I.eye s={16} /> Classement de la manche — toi seul
        <span className="private__count">{fmt(donnee.lignes.length)}</span>
      </p>
      <div className="clsm" style={{ '--clsm-cols': colonnes.length }}>
        <div className="clsm__ligne clsm__ligne--tete">
          <span className="clsm__rang" />
          <span className="clsm__nom">Joueur</span>
          {colonnes.map(([titre]) => <span className="clsm__col" key={titre}>{titre}</span>)}
        </div>
        {donnee.lignes.map((l, i) => (
          <div className="clsm__ligne" key={`${l.pseudo}-${i}`}>
            <span className="clsm__rang">{i + 1}</span>
            <span className="clsm__nom" title={l.pseudo}>{l.pseudo}</span>
            {colonnes.map(([titre, lire]) => <span className="clsm__col" key={titre}>{lire(l)}</span>)}
          </div>
        ))}
      </div>
    </section>
  );
}

// LES GROUPES DE MOTS, À LA RÉVÉLATION — pour l'animateur seul.
//
// Il commente à l'antenne : il lui faut les NOMS, groupés par mot et classés du
// plus donné au moins donné. Le stream, lui, ne reçoit que les mots et leurs
// effectifs — même frontière que le nom du plus proche à l'estimation.
function GroupesLien({ g, roundId, revealed }) {
  const [donnee, setDonnee] = useState(null);
  useEffect(() => {
    const onGroupes = (d) => setDonnee(d && Array.isArray(d.groupes) ? d : null);
    g.on('host:groupes', onGroupes);
    return () => g.off('host:groupes', onGroupes);
  }, [g]);
  // À LA RÉVÉLATION SEULEMENT, et pour la manche affichée : un souvenir d'une
  // manche antérieure ferait commenter des mots qui ne sont plus à l'antenne.
  if (!revealed || !donnee || donnee.roundId !== roundId) return null;
  const groupes = donnee.groupes;
  if (!groupes?.length) return null;
  return (
    <section className="private" aria-label="Les mots donnés" data-testid="groupes-lien">
      <p className="private__title">
        <I.eye s={16} /> Les mots donnés — toi seul
        <span className="private__count">{fmt(groupes.length)}</span>
      </p>
      <div className="groupes">
        {groupes.map((gr) => (
          <div className="groupes__bloc" key={gr.mot} data-rang={gr.rang} data-count={gr.count}>
            <p className="groupes__tete">
              <span className="groupes__rang">{gr.rang}</span>
              <span className="groupes__mot">{gr.mot}</span>
              <span className="groupes__n">{fmt(gr.count)}</span>
            </p>
            <p className="groupes__joueurs">{gr.joueurs.join(' · ')}</p>
          </div>
        ))}
      </div>
    </section>
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
                  direct, sur un refus du serveur, serait le pire moment. Un jeu
                  en direct n'a pas de banque, et n'en manque donc pas. */}
              {m.questions === 0 && !m.direct ? ' — aucune question' : ''}
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
// LE PLUS PROCHE — CHEZ L'ANIMATEUR SEUL (chantier v4, action 6).
//
// Le serveur trouvait déjà la réponse la plus proche, mais n'en gardait que LE
// NOMBRE, pas qui l'avait donnée. Et ce nombre voyage dans `stats`, diffusé à
// tout le salon, stream compris — y ajouter un nom l'aurait mis à l'antenne.
//
// Le nom arrive donc par le canal `:host`, jamais par le canal partagé avec le
// stream. C'est la seconde donnée du produit dans ce cas, après la file d'attente
// (décision 8 de l'action 6 du chantier v1) : ce qui ne doit pas être capturé par
// OBS ne transite pas par une source qu'OBS capture.
function PlusProches({ g, roundId, revealed }) {
  const [donnee, setDonnee] = useState(null);
  const [tout, setTout] = useState(false);
  const VISIBLES = 3;

  useEffect(() => {
    const onClosest = (d) => setDonnee(d && Array.isArray(d.joueurs) ? d : null);
    g.on('host:closest', onClosest);
    return () => g.off('host:closest', onClosest);
  }, [g]);

  // DÉCISION 6.6 — à la révélation SEULEMENT. Avant, l'animateur saurait qui mène
  // pendant que les réponses arrivent : une information qu'il pourrait laisser
  // échapper à l'antenne.
  useEffect(() => { setTout(false); }, [roundId]);

  // LE MOMENT, décidé avant tout retour anticipé — un crochet ne peut pas vivre
  // après un `return`. Les deux cas sont exclusifs : soit quelqu'un est tombé
  // pile et il est SEUL à l'avoir fait, soit on nomme la meilleure approche.
  // À plusieurs exacts, l'exploit n'en est plus un et la console se tait, comme
  // le plateau (même arbitrage que `stream.estim-exact-unique`).
  const pret = revealed && donnee && donnee.roundId === roundId && donnee.joueurs.length > 0;
  const exacts = pret ? donnee.joueurs.filter((j) => j.exact) : [];
  const momentHote = !pret ? null
    : exacts.length === 1 ? 'host.exact-unique'
      : exacts.length === 0 && donnee.joueurs.length === 1 ? 'host.meilleure-estimation'
        : null;
  const phraseMiseEnAvant = usePhraseDeManche(momentHote, roundId, {
    nom: momentHote === 'host.exact-unique' ? exacts[0]?.pseudo : donnee?.joueurs?.[0]?.pseudo,
  });

  if (!pret) return null;

  const liste = tout ? donnee.joueurs : donnee.joueurs.slice(0, VISIBLES);
  const reste = donnee.joueurs.length - liste.length;

  return (
    <section className="private" aria-label="Réponse la plus proche" data-testid="plus-proches">
      <p className="private__title">
        <I.eye s={16} /> Le plus proche — toi seul
        <span className="private__count">{donnee.joueurs.length}</span>
      </p>
      {/* LA PHRASE DE MISE EN AVANT (A21). L'animateur avait la liste des noms et
          des valeurs, pas de quoi la DIRE. Il lui fallait une formule prête à
          l'antenne — « une seule personne a trouvé la réponse exacte », « un tel a
          la meilleure estimation ».
          Elle vit sur SA surface et nulle part ailleurs : elle cite un pseudo, et
          le stream l'afficherait devant toute l'audience. Il lit, ou il ne lit
          pas ; c'est lui qui décide de nommer quelqu'un. */}
      {phraseMiseEnAvant ? (
        <p className="private__voix" data-testid="host-mise-en-avant">{phraseMiseEnAvant}</p>
      ) : null}
      <ul className="proches">
        {liste.map((j, i) => (
          <li className="proches__row" key={`${j.pseudo}-${i}`}>
            <span className="proches__name">{j.pseudo}</span>
            {/* DÉCISION 6.5 — avec la valeur : c'est elle qui permet à l'animateur de
                dire quelque chose d'intéressant à l'antenne. */}
            <span className="proches__value">{j.valeur != null ? fmt(j.valeur) : '—'}</span>
          </li>
        ))}
      </ul>
      {/* DÉCISION 6.4 — une poignée de noms, puis un « + » qui déplie. Sur une
          question en années, dix joueurs peuvent tomber juste ; l'animateur a
          besoin de savoir QUI, pas de lire une liste en direct. */}
      {reste > 0 ? (
        <button className="proches__plus" type="button" onClick={() => setTout(true)}>
          + {reste} autre{reste > 1 ? 's' : ''}
        </button>
      ) : null}
    </section>
  );
}

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
          <VoletNavigation overlayToken={overlayToken} />
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
                    disabled={m.questions === 0 && !m.direct}>
                    Lancer {m.name}
                    {/* Un jeu vide se signale AVANT le lancement, pas par un refus
                        du serveur découvert en plein direct. Un jeu EN DIRECT, lui,
                        n'a pas de banque par définition : il n'en manque pas. */}
                    {m.questions === 0 && !m.direct ? ' — aucune question' : ''}
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

// UNE LIGNE DE RÉPARTITION — une option, sa barre, son décompte.
//
// ELLE EST À PART depuis que « Vote » se joue en deux tours : la console en
// affiche alors DEUX jeux, le tour en cours et la réponse du cercle. Deux copies
// du même balisage auraient divergé au premier ajustement — la barre a déjà été
// corrigée une fois (voir la note sur `--om-to`).
function DistLigne({ lettre, label, count, total, showKey, correct }) {
  // Part du TOTAL, jamais de l'option en tête : la barre et l'étiquette chiffrée
  // posée juste à côté doivent raconter la même chose. Cadrer sur le maximum
  // mettait l'option de tête à 100 % quoi qu'il arrive, à côté d'une étiquette
  // qui affichait « 75 % ».
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className={`dist__row${correct ? ' dist__row--correct' : ''}`}>
      {showKey ? <span className="dist__key" aria-hidden="true">{lettre}</span> : <span />}
      <span className="dist__track">
        {/* --om-to est le CONTRAT du système de design (tokens.css:324) :
            l'animation pousse la barre de 0 jusqu'à cette valeur et y reste, et la
            règle CSS lit la même valeur pour la largeur. Sans elle, l'animation
            retombait sur sa valeur par défaut (100 %) et écrasait la largeur —
            toutes les barres finissaient pleines. */}
        <span className="dist__fill" style={{ '--om-to': `${pct}%` }} aria-hidden="true" />
        <span className="dist__opt" title={String(label)}>{label}</span>
      </span>
      <span className="dist__count">{count} · {pct}%</span>
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
  // LE JUSTE TEMPS PARTAGE CE GRAPHIQUE, à la demande de l'auteur : « il faut
  // reprendre exactement le graphique du module Estimation ». Il le partage
  // VRAIMENT — même composant, même géométrie, même serveur qui la calcule — et
  // n'en diffère que par l'écriture des nombres, que `formatteurDe` choisit sur
  // l'unité annoncée par le serveur.
  if (type === 'estimation' || type === 'juste_temps' || type === 'coupe_buche') {
    const has = stats?.kind === 'numeric' || dist.kind === 'numeric';
    if (!has || !total) return <p className="dist__empty">Les estimations s'afficheront ici, en direct.</p>;
    const cells = stats?.kind === 'numeric'
      ? [['Le plus proche', stats.closest], ['Moyenne', stats.avg], ['Médiane', stats.median]]
      : [['Min', dist.min], ['Moyenne', dist.avg], ['Max', dist.max]];
    // L'ÉCRITURE DES NOMBRES — la seule chose qui distingue les deux jeux sur ce
    // graphique. Le serveur dit l'unité ; l'écran ne la devine pas d'un type.
    const ecrire = formatteurDe(stats ?? dist, fmt);
    const ecrireAxe = formatteurDe(stats ?? dist, (v) => fmt(Math.round(v)));
    const estTemps = ecrire !== fmt;
    // L'histogramme de dispersion, spécifié par la maquette A5 et jamais
    // construit : trois chiffres disent où est le groupe, mais pas s'il est
    // groupé ou éparpillé — et c'est cette forme-là que l'animateur lit d'un
    // coup d'œil pour décider quand révéler.
    const histo = stats?.histogramme || dist.histogramme || null;
    // Les repères viennent de la révélation SI elle a eu lieu, sinon du direct —
    // qui les porte désormais, sur le seul canal de l'animateur.
    const plages = plagesVisibles(stats?.plages ?? dist.plages, histo);
    const reperes = bornes(histo);
    const barresHisto = barres(histo);
    const cible = repereCible(stats?.target ?? dist.target ?? reveal?.target, histo);
    // DÉCISION DE L'AUTEUR : la réponse exacte n'est pas une tranche — elle est de
    // largeur nulle. Elle se dessine en TRAIT, qui passe au VERT dès que quelqu'un
    // l'a trouvée. C'est le seul endroit du graphique où une couleur dit un fait
    // plutôt qu'une catégorie.
    const trouvee = (histo?.exact || 0) > 0;
    return (
      <div className="dist__numeric">
        {histo ? (
          <div className="histo" data-testid="histogramme">
            {/* « Dispersion des 1 estimation » : le pluriel était appliqué au nom
                sans l'être à l'article. Une seule réponse se dit autrement. */}
            <p className="histo__legend">
              {total > 1 ? (
                <>Dispersion des <span className="histo__legend-num">{fmt(total)}</span> {estTemps ? 'réponses' : 'estimations'}</>
              ) : (
                <>{estTemps ? 'Une seule réponse' : 'Une seule estimation'}</>
              )}
            </p>
            {/* L'AXE ET SES PLAGES (voir `shared/echelle-estimation.js`).
                Sans eux, ces huit barres ne disaient rien : ni ce que chaque
                tranche recouvre, ni où tombe la bonne réponse, ni jusqu'où il
                fallait viser pour marquer. */}
            <div className="histo__cadre">
              {/* Les plages du barème, au FOND : la plus large d'abord, celle du
                  mille par-dessus. Elles viennent du serveur, jamais d'un
                  pourcentage recopié ici. */}
              {plages.filter((p) => p.zone).map((p) => (
                <span key={p.nom} className={`histo__plage histo__plage--${p.nom}`}
                  style={{ left: `${p.gauche}%`, width: `${p.largeur}%` }}
                  data-plage={p.nom} data-libelle={p.libelle}
                  title={`${p.libelle} — ${fmt(p.points)} points${p.rognee ? ' (plage tronquée par l\'échelle)' : ''}`} />
              ))}
              {/* LES BORNES DES PLAGES, sans étiquette. Elles étaient posées ICI,
                  toutes à la même hauteur : la pastille de la cible en couvrait
                  une, et les trois autres se touchaient. Les traits restent — ils
                  situent — mais les mots descendent dans la règle, sous l'axe, où
                  chaque plage a sa propre ligne et ne peut plus rien cacher. */}
              {plages.flatMap((p) => p.bornes.map((b) => (
                <span key={`${p.nom}-${b.cote}`} className={`histo__seuil histo__seuil--${p.nom}`}
                  style={{ left: `${b.pct}%` }} data-seuil={p.nom}
                  title={`${p.libelle} — ${fmt(p.points)} points`} />
              )))}
              {/* LES BARRES ÉPOUSENT LES PALIERS. Elles étaient huit parts égales
                  de l'étendue, dont les bornes ne tombaient nulle part : une même
                  barre pouvait réunir des joueurs à 1 000 points et d'autres à
                  750. Chaque barre couvre désormais exactement un demi-palier, et
                  sa largeur à l'écran EST celle de la plage qu'elle représente.
                  Elles sont donc inégales — c'est le but. */}
              <div className="histo__plot">
                {barresHisto.map((b) => (
                  <span
                    key={b.i}
                    className={`histo__bar histo__bar--${b.palier}${b.count === 0 ? ' histo__bar--vide' : ''}`}
                    style={{ left: `${b.gauche}%`, width: `${b.largeur}%`, height: `${b.hauteur}%` }}
                    title={`${b.count} ${estTemps ? 'réponse' : 'estimation'}${b.count > 1 ? 's' : ''} — de ${ecrireAxe(b.bas)} à ${ecrireAxe(b.haut)}`}
                    data-count={b.count} data-palier={b.palier} data-cote={b.cote}
                  >
                    {/* LE COMPTE, ÉCRIT. Les tranches n'ayant plus la même largeur,
                        la hauteur seule trompe : une zone hors barème large des deux
                        tiers du cadre, avec UNE réponse, se lisait comme une
                        majorité. La largeur dit le palier, le chiffre dit combien. */}
                    {b.count > 0 ? <span className="histo__bar-n">{fmt(b.count)}</span> : null}
                  </span>
                ))}
              </div>
              {/* LA BONNE RÉPONSE, à sa place exacte sur l'axe — et non plus
                  « repérée en couleur » quelque part dans une tranche large. */}
              {cible ? (
                <span className={`histo__cible${trouvee ? ' histo__cible--trouvee' : ''}`}
                  style={{ left: `${cible.pct}%` }} data-testid="histo-cible" data-trouvee={trouvee || undefined}
                  title={trouvee ? `${histo.exact} joueur${histo.exact > 1 ? 's ont' : ' a'} trouvé la réponse exacte` : undefined}>
                  <span className={`histo__cible-val histo__cible-val--${cible.ancrage}`}>
                    {ecrire(stats?.target ?? dist.target ?? reveal?.target)}
                  </span>
                </span>
              ) : null}
            </div>
            {/* Les valeurs de l'axe : une borne sur deux, extrémités comprises. */}
            <div className="histo__axe" data-testid="histo-axe">
              {reperes.map((b) => (
                <span key={b.i} className="histo__tick" style={{ left: `${b.pct}%` }}>
                  {ecrireAxe(b.valeur)}
                </span>
              ))}
            </div>
            {/* LA RÈGLE DES PLAGES — une ligne par palier, à sa place sur l'axe.
                Les pastilles d'avant disaient « ± 2 % · 1 000 » sans montrer OÙ ;
                et posées côte à côte, elles ne disaient pas non plus que les
                plages s'emboîtent. Ici chaque palier occupe sa propre ligne : rien
                ne peut en cacher un autre, et l'emboîtement se voit. */}
            {plages.length ? (
              <div className="histo__regle" data-testid="histo-plages">
                {plages.map((p) => (
                  <div className={`histo__regle-ligne histo__regle-ligne--${p.nom}`} key={p.nom} data-plage={p.nom}>
                    <span className="histo__regle-barre" style={{ left: `${p.gauche}%`, width: `${p.largeur}%` }} />
                    <span
                      className={`histo__regle-lbl histo__regle-lbl--${p.lblVersGauche ? 'gauche' : 'droite'}`}
                      style={{ left: `${p.ancreLbl}%` }}>
                      {p.libelle}<span className="histo__regle-pts">{fmt(p.points)} pts</span>
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="dist__facts">
          {cells.map(([label, v]) => (
            <div className="dist__fact" key={label}>
              <span className="h-label">{label}</span>
              <span className="dist__fact-value">{v != null ? ecrire(v) : '—'}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // « CACHE-CACHE », QUESTION À SAISIE : les mots les plus donnés.
  //
  // Un histogramme n'a aucun sens sur du texte libre ; savoir que douze personnes
  // ont écrit « marteau » et trois « tournevis », si. C'est la même lecture que
  // les groupes du « Lien », et c'est ce qui se commente à l'antenne.
  if (dist.kind === 'mots') {
    if (!dist.groupes?.length) {
      return <p className="dist__empty">Les réponses s'afficheront ici, en direct.</p>;
    }
    // LA MÊME LIGNE QUE PARTOUT AILLEURS (`DistLigne`) : une barre lue depuis
    // `--om-to`, jamais une largeur posée à côté — voir la note de `.dist__fill`.
    return (
      <div className="dist" data-testid="dist-mots">
        {dist.groupes.map((g) => (
          <DistLigne key={g.mot} lettre="" label={g.mot} count={g.count}
            total={dist.total || 1} showKey={false} correct={false} />
        ))}
      </div>
    );
  }

  // LE RAPPEL DU TOUR PRÉCÉDENT — « Vote », second tour, animateur seul.
  //
  // Ce panneau montre le tour EN COURS. Au second tour d'un vote, c'est le tour
  // des paris : la bonne réponse, elle, est sortie du premier. Sans ce rappel,
  // l'animateur commenterait à l'antenne un jeu dont il ignore la réponse.
  const precedent = !revealed && dist.precedent && dist.precedent.total > 0 ? dist.precedent : null;

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
  // LES DEUX BLOCS DU SECOND TOUR, quand il y a un tour précédent à rappeler.
  // Le tour en cours d'abord — c'est celui que l'animateur regarde vivre — et la
  // réponse du cercle en dessous, plus discrète, comme une antisèche.
  if (precedent) {
    const teteP = Math.max(0, ...precedent.counts);
    const gagnantesP = precedent.counts.map((n, i) => (n === teteP && n > 0 ? i : -1)).filter((i) => i >= 0);
    return (
      <>
        <div className="dist">
          {options.map((opt, i) => (
            <DistLigne key={i} lettre={KEYS[i] || i + 1} label={opt} count={counts[i] || 0}
              total={Math.max(1, counts.reduce((a, b) => a + b, 0))} showKey={showKey} />
          ))}
        </div>
        <div className="dist dist--precedent" data-testid="host-tour-precedent">
          <p className="private__hint">La réponse du cercle — tour 1, toi seul la connais</p>
          {options.map((opt, i) => (
            <DistLigne key={i} lettre={KEYS[i] || i + 1} label={opt} count={precedent.counts[i] || 0}
              total={Math.max(1, precedent.total)} showKey={showKey}
              correct={gagnantesP.includes(i)} />
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="dist">
      {options.map((opt, i) => {
        return (
          <DistLigne key={i} lettre={KEYS[i] || i + 1} label={opt} count={counts[i] || 0}
            total={total} showKey={showKey} correct={i === correctIndex} />
        );
      })}
    </div>
  );
}

// ============================================================
// LES JEUX QUI APPORTENT LEUR PANNEAU DE PRÉPARATION.
//
// Ceux-là ont quelque chose à saisir ou à choisir avant de partir : les deux mots
// du lien, les deux temps du juste temps, la proportion de la bûche, le mode de
// « Retour de flamme », le top des visages. Les autres n'ont qu'un bouton.
//
// LA LISTE SERT À DEUX ENDROITS et doit rester la même : le choix du panneau à
// l'écran, et « Question suivante », qui rouvre la saisie plutôt que de repartir
// sur l'ancienne. Écrite deux fois, elle finirait par diverger — et l'animateur
// verrait la manche repartir avec les mots de la précédente.
const JEUX_A_PREPARER = ['lien', 'juste_temps', 'visages', 'retour_flamme', 'coupe_buche', 'cache_cache'];

// A5 — Pilotage en direct
// ============================================================
function LiveScreen({ g, code, overlayToken, prepare, onDemarrerSimple, onDiffuserBuche, ecartRetour, familleRetour, onModeRetour, onFamilleRetour, onDemarrerRetour, onDiffuserLien, onDiffuserJusteTemps, onDemarrerVisages, onDemarrerCache, onAnnulerLien, onShowResults, onLogout, onCloseRoom, onEndGame, onNextQuestion, onChangeModule, connLost, hostError, onDismissError }) {
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

  // « CACHE-CACHE » — où en est la manche.
  //
  // Elle a un temps que les autres n'ont pas : après la dernière question et
  // AVANT la révélation, cinq réponses se dévoilent une par une, au rythme de
  // l'animateur. `devoilements` compte celles qui sont déjà tombées.
  const estCache = current?.type === 'cache_cache';
  const devoilees = g.devoilements.length;
  // On est « aux réponses » dès que la dernière question est close.
  const cacheAuxReponses = estCache && !revealed
    && (devoilees > 0 || (current.tour >= current.tours && g.tourClos));

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
        {/* DÉCISION 9.2 — atteignable à TOUTE phase, direct compris. */}
        <VoletNavigation overlayToken={overlayToken} />
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

          {/* LE PANNEAU DE PRÉPARATION, TOUT EN HAUT DE L'ÉCRAN.
              « Le bloc qui permet de relancer une partie d'un jeu lorsque l'on
              clique sur "Question suivante" devrait s'afficher tout en haut. »
              Il était sous l'énoncé et sous la répartition — c'est-à-dire sous
              deux blocs qui ne parlent plus que du passé à cet instant précis.
              L'animateur devait faire défiler sa console pour trouver le seul
              bouton qui l'intéresse, en direct. */}
          {/* LA SAISIE DU LIEN prend la place de la scène tant que les deux mots
              ne sont pas diffusés : c'est LE geste de l'animateur à cet instant. */}
          {prepare && prepare.type === 'lien' ? (
            <SaisieLien jeu={prepare} onDiffuser={onDiffuserLien} onAnnuler={onAnnulerLien} />
          ) : null}
          {prepare && prepare.type === 'juste_temps' ? (
            <SaisieJusteTemps jeu={prepare} duree={(prepare.dureeCompteMs ?? 15000) / 1000}
              onDiffuser={onDiffuserJusteTemps} onAnnuler={onAnnulerLien} />
          ) : null}
          {/* TOUT JEU S'ANNONCE AVANT DE PARTIR. Ceux qui n'ont rien à préparer
              n'ont besoin que d'un bouton ; les autres apportent leur panneau. */}
          {prepare && prepare.type === 'coupe_buche' ? (
            <SaisieBuche jeu={prepare} onDiffuser={onDiffuserBuche} onAnnuler={onAnnulerLien} />
          ) : null}
          {prepare && !JEUX_A_PREPARER.includes(prepare.type) ? (
            <>
              <DepartSimple jeu={prepare} onDemarrer={onDemarrerSimple} onAnnuler={onAnnulerLien} />
              {/* LA FILE, AVANT LE DÉPART — « lors du lancement des jeux à
                  questions, l'animateur doit avoir la possibilité de choisir la
                  1ère question ».
                  Elle n'apparaissait qu'une fois la manche lancée : l'animateur
                  découvrait la question EN MÊME TEMPS que le cercle, et ne
                  pouvait réordonner que pour la suivante. Le jingle lui laisse
                  désormais le temps de mettre en tête celle qu'il veut ouvrir. */}
              <FileAttente g={g} moduleId={prepare.id} nomJeu={prepare.name} />
            </>
          ) : null}
          {prepare && prepare.type === 'cache_cache' ? (
            <DepartCache jeu={prepare} onDemarrer={onDemarrerCache} onAnnuler={onAnnulerLien}
              modes={prepare.modes} defaut={prepare.modeParDefaut} />
          ) : null}
          {prepare && prepare.type === 'retour_flamme' ? (
            <DepartRetour jeu={prepare} ecart={ecartRetour} famille={familleRetour}
              onMode={onModeRetour} onFamille={onFamilleRetour}
              onDemarrer={onDemarrerRetour} onAnnuler={onAnnulerLien} />
          ) : null}
          {prepare && prepare.type === 'visages' ? (
            <DepartVisages jeu={prepare} onDemarrer={onDemarrerVisages} onAnnuler={onAnnulerLien} />
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

          {/* PAS DE RÉPARTITION PENDANT LE DÉVOILEMENT DES RÉPONSES.
              « Le bloc "Répartition en direct" n'est pas important lors du
              dévoilement des réponses. Il faut l'enlever. » À cet instant il
              montre le décompte de la DERNIÈRE question posée, pendant que
              l'animateur commente la PREMIÈRE réponse : deux questions
              différentes sur le même écran. */}
          {cacheAuxReponses ? null : (
          <section className={`private${revealed ? ' private--public' : ''}`} data-testid="stats-panel"
            data-bind="module.distribution" aria-label="Répartition des réponses">
            <p className="private__title">
              <I.eye s={16} />
              {revealed ? 'Répartition — affichée sur le stream' : 'Répartition en direct — visible par toi seul'}
              {/* LE TOUR EN COURS. L'animateur commente à l'antenne : il doit
                  savoir si le cercle est en train de dire ce qu'il pense ou de
                  parier sur lui-même. Rien d'autre à l'écran ne le lui dit. */}
              {!revealed && current?.tours > 1 ? (
                <span className="private__count" data-testid="host-tour">Tour {current.tour}/{current.tours}</span>
              ) : null}
            </p>
            <AnswerDistribution current={current} distribution={g.distribution}
              answersCount={answersCount} revealed={revealed} reveal={reveal} />
            {!revealed ? <p className="private__hint">Publique à la révélation</p> : null}
          </section>
          )}

          <PlusProches g={g} roundId={current && current.roundId} revealed={revealed} />
          <GroupesLien g={g} roundId={current && current.roundId} revealed={revealed} />
          {estCache ? <CacheReponses g={g} roundId={current && current.roundId} /> : null}
          <ClassementManche g={g} roundId={current && current.roundId} revealed={revealed} />

          {/* LA SÉRIE DE VISAGES, À LA RÉVÉLATION. Elle vient de `reveal.stats` et
              non d'un canal réservé : une fois la manche révélée, la série n'a
              plus rien de secret — le stream l'affiche aussi. Avant la
              révélation, en revanche, elle n'existe nulle part côté client. */}
          {revealed && reveal?.stats?.kind === 'visages' ? (
            <section className="private private--public" aria-label="La série de visages">
              <p className="private__title"><I.eye s={16} /> La série — public</p>
              <GraphiqueVisages stats={reveal.stats} />
            </section>
          ) : null}

          {/* LA SÉRIE DE « RETOUR DE FLAMME », même règle : publique une fois
              révélée, inexistante côté client avant. Les six retours y sont
              grossis — c'est ce que l'animateur commente. */}
          {revealed && reveal?.stats?.kind === 'retour' ? (
            <section className="private private--public" aria-label="La série d'images">
              <p className="private__title">
                <I.eye s={16} /> La série — public
                <span className="private__count">retour −{reveal.stats.ecart}</span>
              </p>
              <GraphiqueRetour stats={reveal.stats} />
            </section>
          ) : null}

          {/* LA FILE, DANS LA COLONNE CENTRALE (chantier v2, décision 3.1).
              Elle vivait dans la colonne latérale de 336 px, où trois commandes
              au plancher tactile de 44 px ne laissaient à l'énoncé que quelques
              dizaines de pixels : chaque ligne affichait « Q. ».
              Ici, sous le jeu en cours, elle dispose de la largeur du centre —
              l'énoncé, le numéro, la poignée et les commandes tiennent sur une
              seule ligne, sans rien comprimer. Et l'ordre de lecture dit ce que
              l'animateur fait : ce qui est à l'antenne, puis ce qui vient. */}
          {/* PAS DE FILE POUR LES JEUX SANS BANQUE (« hors Quiz, Vrai / Faux, Vote,
              Estimation, supprimer le bloc "à venir" »). Le lien, les visages, le
              juste temps, retour de flamme et la bûche se préparent à l'antenne :
              leur file est vide par construction, et le bloc n'affichait qu'une
              phrase invitant à « ajouter des questions au Studio » — pour un jeu
              qui n'en aura jamais. */}
          {current?.meta?.direct ? null : (
            <FileAttente g={g} moduleId={current && current.moduleId} nomJeu={current && current.meta?.name}
              enCours={current && current.text} />
          )}
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
            {/* « POUR LES MODULES SANS QUESTIONS, IL NE DEVRAIT PAS Y AVOIR
                ÉCRIT "QUESTION SUIVANTE" MAIS "NOUVELLE PARTIE". »
                Un jeu en direct n'a pas de banque : il n'y a pas de question
                suivante à aller chercher, il y a une partie à relancer. Le
                libellé disait le contraire de ce que le bouton fait. */}
            <button className="button button--primary button--lg" type="button"
              data-action="host:startModule" data-testid="host-suivant" onClick={onNextQuestion}>
              {current?.meta?.direct ? 'Nouvelle partie' : 'Question suivante'}
            </button>
            <ModuleMenu jeux={jeux} currentId={current && current.moduleId} onPick={onChangeModule} />
          </>
        ) : (
          <>
            <button className="button button--primary button--lg" type="button"
              /* UN SEUL MESSAGE, QUEL QUE SOIT LE MOMENT. C'est le serveur qui
                 décide de ce que « révéler » veut dire à cet instant : passer au
                 tour suivant, dévoiler une réponse de plus, ou révéler la manche.
                 La console ne fait que NOMMER ce qui va se passer. */
              data-action="host:reveal"
              onClick={() => g.emit('host:reveal')}
              data-testid="host-reveler">
              {/* LE BOUTON NE RÉVÈLE PAS TOUJOURS. Sur une manche à deux tours —
                  « Vote » — il OUVRE LE SECOND tant qu'il en reste un : révéler la
                  bonne réponse au milieu du premier tour viderait le jeu. Le
                  serveur tranche seul (`finDeFenetre`) ; l'écran dit seulement ce
                  qui va se passer, pour que l'animateur ne l'apprenne pas en
                  cliquant. */}
              {/* « CACHE-CACHE » compte à part : cinq réponses dévoilées une par
                  une, puis la grille — qui est aussi la révélation de la manche.
                  L'animateur doit lire sur le bouton ce qu'il va montrer, pas le
                  découvrir en appuyant. */}
              {estCache && cacheAuxReponses
                ? (devoilees >= (current.nbQuestions || 5)
                  ? 'Dévoiler la grille'
                  : `Dévoiler la réponse ${devoilees + 1}`)
                : current && current.tours > 1 && current.tour < current.tours
                  ? (estCache ? `Question ${current.tour}` : `Passer au tour ${current.tour + 1}`)
                  : 'Révéler maintenant'}
            </button>
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
function ResultsScreen({ g, overlayToken, onNextModule, continueLabel, onEndGame, onBack, canBack, onLogout, onCloseRoom, onBackToLobby }) {
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
          <VoletNavigation overlayToken={overlayToken} />
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
  // Le jeu « en direct » dont l'animateur est en train de saisir la question.
  const [prepare, setPrepare] = useState(null);
  // Le mode de « Retour de flamme », choisi avant le départ. Il survit d'une
  // manche à l'autre : un animateur qui enchaîne trois séries en −3 ne veut pas
  // le rechoisir à chaque fois.
  const [ecartRetour, setEcartRetour] = useState(2);
  // La famille d'images, choisie avec le mode. Elle survit d'une manche à l'autre
  // pour la même raison : on enchaîne rarement chiffres puis figures.
  const [familleRetour, setFamilleRetour] = useState('chiffres');
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
    // AUCUN JEU NE SE LANCE PLUS D'UN CLIC.
    //
    // Les jeux « en direct » — le lien, les visages, le juste temps, retour de
    // flamme — s'annonçaient déjà : le cercle voit le jingle pendant que
    // l'animateur saisit ses mots ou choisit son mode, et le temps de saisie n'est
    // pas décompté du temps de jeu.
    //
    // Les quatre autres partaient sans rien dire : la question tombait sur les
    // téléphones avant qu'on ait annoncé le jeu. Ils passent désormais par le même
    // chemin — annonce d'abord, départ ensuite — avec un panneau qui n'a qu'un
    // bouton, puisqu'ils n'ont rien à préparer.
    setPrepare(jeu);
    g.emit('host:announceModule', { moduleId: jeu.id, ecart: ecartRetour });
    return;
  }, [g, ecartRetour]);

  // LA DIFFUSION DE LA PROPORTION : c'est ELLE qui démarre la manche et lance le
  // balayage du curseur.
  const diffuserBuche = useCallback((jeu, cible, allure) => {
    if (!g.connected) { setToast('Connexion au salon en cours — réessaie dans une seconde.'); return; }
    setHostError(null);
    setPrepare(null);
    g.emit('host:startModule', { moduleId: jeu.id, question: { id: `cb-${Date.now()}`, cible, allure } });
  }, [g]);

  // LE DÉPART D'UN JEU ORDINAIRE : le serveur tire la question dans la réserve du
  // jeu, comme avant. Seul le MOMENT change de main.
  const demarrerSimple = useCallback((jeu) => {
    if (!g.connected) { setToast('Connexion au salon en cours — réessaie dans une seconde.'); return; }
    setHostError(null);
    setPrepare(null);
    g.emit('host:startModule', { moduleId: jeu?.id, moduleType: jeu?.type });
  }, [g]);

  // La diffusion des deux mots : c'est ELLE qui démarre réellement la manche.
  const diffuserLien = useCallback((jeu, mot1, mot2) => {
    if (!g.connected) { setToast('Connexion au salon en cours — réessaie dans une seconde.'); return; }
    setHostError(null);
    setPrepare(null);
    g.emit('host:startModule', {
      moduleId: jeu.id,
      question: { id: `lien-${Date.now()}`, text: `${mot1} · ${mot2}`, mot1, mot2 },
    });
  }, [g]);

  // LA DIFFUSION DES DEUX TEMPS : c'est ELLE qui démarre la manche et lance le
  // compte à rebours. Le temps de cache vide vaut zéro — le chrono ne disparaît
  // alors jamais, ce que l'écran de saisie annonce.
  const diffuserJusteTemps = useCallback((jeu, cache, cible) => {
    if (!g.connected) { setToast('Connexion au salon en cours — réessaie dans une seconde.'); return; }
    setHostError(null);
    setPrepare(null);
    g.emit('host:startModule', {
      moduleId: jeu.id,
      question: {
        id: `jt-${Date.now()}`,
        cache: cache === '' ? 0 : Number(cache),
        cible: Number(cible),
      },
    });
  }, [g]);

  // LE MODE DE « RETOUR DE FLAMME », et son départ.
  //
  // Le mode vit sur la console tant que la manche n'a pas démarré, et se
  // RÉANNONCE à chaque changement : l'écran d'attente du cercle suit l'animateur
  // qui hésite, plutôt que de montrer une règle qui ne sera pas jouée.
  const changerModeRetour = useCallback((e) => {
    setEcartRetour(e);
    if (prepare?.type === 'retour_flamme') g.emit('host:announceModule', { moduleId: prepare.id, ecart: e });
  }, [g, prepare]);

  const demarrerRetour = useCallback((jeu, ecart, famille) => {
    if (!g.connected) { setToast('Connexion au salon en cours — réessaie dans une seconde.'); return; }
    setHostError(null);
    setPrepare(null);
    g.emit('host:startModule', {
      moduleId: jeu.id,
      question: { id: `rf-${Date.now()}`, ecart, famille },
    });
  }, [g]);

  // LE DÉPART DE LA SÉRIE DE VISAGES. Rien à transmettre : la série est TIRÉE
  // par le serveur, qui seul la connaît. L'animateur n'envoie qu'un top.
  // LE DÉPART DE « CACHE-CACHE ». Rien à transmettre : la grille, l'ordre de
  // dévoilement et les cinq questions sont TIRÉS PAR LE SERVEUR, qui seul les
  // connaît. L'animateur n'envoie qu'un top.
  const demarrerCache = useCallback((jeu, mode) => {
    if (!g.connected) { setToast('Connexion au salon en cours — réessaie dans une seconde.'); return; }
    setHostError(null);
    setPrepare(null);
    g.emit('host:startModule', {
      moduleId: jeu.id,
      question: { id: `cc-${Date.now()}`, mode },
    });
  }, [g]);

  const demarrerVisages = useCallback((jeu) => {
    if (!g.connected) { setToast('Connexion au salon en cours — réessaie dans une seconde.'); return; }
    setHostError(null);
    setPrepare(null);
    g.emit('host:startModule', {
      moduleId: jeu.id,
      question: { id: `visages-${Date.now()}`, text: 'Quel visage est passé deux fois ?' },
    });
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
          overlayToken={session.overlayToken}
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
          overlayToken={session.overlayToken}
          prepare={prepare}
          onDemarrerSimple={demarrerSimple}
          onDiffuserBuche={diffuserBuche}
          onDiffuserLien={diffuserLien}
          onDiffuserJusteTemps={diffuserJusteTemps}
          ecartRetour={ecartRetour}
          familleRetour={familleRetour}
          onModeRetour={changerModeRetour}
          onFamilleRetour={setFamilleRetour}
          onDemarrerRetour={demarrerRetour}
          onDemarrerVisages={demarrerVisages}
          onDemarrerCache={demarrerCache}
          onAnnulerLien={() => setPrepare(null)}
          onShowResults={() => setShowResults(true)}
          onLogout={logout}
          onCloseRoom={closeRoom}
          onEndGame={endGame}
          onNextQuestion={() => {
            // « QUESTION SUIVANTE » CONTINUE LE JEU EN COURS — elle ne le lance
            // pas. Le jingle marque le LANCEMENT d'un jeu ; le remettre entre
            // deux questions arrêterait l'émission toutes les vingt secondes pour
            // annoncer ce qu'on est déjà en train de jouer.
            //
            // CE QUE CE DÉTOUR A COÛTÉ : passées par l'annonce, les manches
            // suivantes n'arrivaient plus jamais aux téléphones — l'écran restait
            // sur le jingle et le contrôle attendait quinze secondes une question
            // qui ne tomberait pas. Six contrôles rouges, aucun ne désignant la
            // faute.
            //
            // Les jeux qui SAISISSENT rouvrent leur panneau : la manche suivante
            // a besoin de nouveaux mots, de nouveaux temps, d'une autre proportion.
            if (JEUX_A_PREPARER.includes(jeuEnCours?.type)) { setPrepare(jeuEnCours); return; }
            demarrerSimple(jeuEnCours);
          }}
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
