// Surface JOUEUR (manette mobile) — un seul écran affiché selon l'état du jeu.
// Flux : rejoindre -> attente -> question (-> réponse envoyée) -> résultat -> fin.
//
// Design : extraction Claude Design — J1 rejoindre (code en 5 cases, erreur
// rattachée à son champ), J2 attente, J3 question (4 modules × 3 états),
// J4 résultat de manche, J5 fin de partie, J6 chargement.
//
// RÈGLE ABSOLUE tenue ici : le rang du joueur n'apparaît JAMAIS en cours de
// partie. Le seul repère de position est le déplacement (places gagnées ou
// perdues). Le rang final n'est révélé qu'à l'écran de fin.
import React, { useEffect, useRef, useState } from 'react';
import { useGame, store } from '../shared/useGame.js';
import { joinRoom } from '../shared/net.js';
import { BrandLoader } from '../shared/BrandLoader.jsx';
import { usePhraseQuiTourne, usePhraseDeManche } from '../shared/voix-hooks.js';
import { NOM_DU_JEU } from '../shared/marque.js';
import { Chainons } from '../shared/Chainons.jsx';
import { ChronoBuzzer } from '../shared/ChronoBuzzer.jsx';
import { RetourFlamme } from '../shared/RetourFlamme.jsx';
import { EmblemeJeu } from '../shared/EmblemeJeu.jsx';
import { BucheHache } from '../shared/BucheHache.jsx';
import { positionDuCurseur, pourcent, useBalayage } from '../shared/proportion.js';
import { Symbole } from '../shared/Symbole.jsx';
import { useBlancEntreImages } from '../shared/defile.js';
import { chronoAffiche, secondes, useCompteARebours } from '../shared/temps.js';
import { Icon } from '../shared/icons.jsx';
import { bipCompteRebours, sonFinDuTemps } from '../shared/sons.js';
import { Visage, MasquesVisages, prechargerVisages } from '../shared/Visage.jsx';
import { Flamme } from '../shared/Flamme.jsx';
import './play.css';

const fmtNum = (n) => Number(n || 0).toLocaleString('fr-FR');
const KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

// Compte à rebours animé des points gagnés (respecte prefers-reduced-motion).
function useCountUp(target, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const goal = typeof target === 'number' && Number.isFinite(target) ? target : 0;
    if (goal === 0) { setVal(0); return undefined; }
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setVal(goal); return undefined; }
    let raf;
    const start = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(goal * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

// ---- Icônes du système (SVG au trait, jamais d'emoji) -----------------------
const Ico = {
  flame: ({ s = 22, ember = false }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
  ),
  check: ({ s = 18, w = 1.6, dashed = false }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" {...(dashed ? { strokeDasharray: 26 } : {})} />
    </svg>
  ),
  checkCircle: ({ s = 20 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><path d="M8.5 12.4l2.4 2.4 4.6-5" />
    </svg>
  ),
  cross: ({ s = 20, w = 1.8 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 7l10 10" /><path d="M17 7L7 17" />
    </svg>
  ),
  clock: ({ s = 20 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="13" r="8" /><path d="M12 13V9" /><path d="M12 13l3 2" /><path d="M9.5 3h5" />
    </svg>
  ),
  up: ({ s = 17 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 19V6" /><path d="M6.5 11.5L12 6l5.5 5.5" />
    </svg>
  ),
  down: ({ s = 17 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v13" /><path d="M6.5 12.5L12 18l5.5-5.5" />
    </svg>
  ),
  arrow: ({ s = 18 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" /><path d="M13 6l6 6-6 6" />
    </svg>
  ),
  chevron: ({ s = 18, open = false }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      style={{ transform: open ? 'rotate(90deg)' : 'none' }}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  ),
  people: ({ s = 22 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19.5c0-3 2.5-4.8 5.5-4.8s5.5 1.8 5.5 4.8" />
      <path d="M16 6.2a3 3 0 010 5.4" /><path d="M17.5 15c2 .5 3.2 2 3.2 4.5" />
    </svg>
  ),
};

// Libellé de la bonne réponse selon le module.
function correctAnswerLabel(reveal, current) {
  if (!reveal) return null;
  const rv = reveal;
  if (rv.type === 'true_false' || typeof rv.correct === 'boolean') return rv.correct ? 'Vrai' : 'Faux';
  // Chaque nature écrit sa cible dans son unité — « 4,72 s », « 80 % », « 330 ».
  if (rv.target != null) {
    if (rv.type === 'juste_temps') return secondes(rv.target);
    if (rv.type === 'coupe_buche') return pourcent(rv.target);
    return fmtNum(rv.target);
  }
  if (rv.correctIndex != null) {
    const opts = rv.options || current?.options;
    const opt = Array.isArray(opts) ? opts[rv.correctIndex] : null;
    return opt != null ? String(opt) : `Réponse ${KEYS[rv.correctIndex] || rv.correctIndex + 1}`;
  }
  if (rv.type === 'vote' && Array.isArray(rv.tally) && Array.isArray(rv.options) && rv.tally.length) {
    let best = 0;
    for (let i = 1; i < rv.tally.length; i += 1) if (rv.tally[i] > rv.tally[best]) best = i;
    return rv.options[best];
  }
  return null;
}

const ERROR_MESSAGES = {
  'room-not-found': "Ce salon n'existe pas. Vérifie le code.",
  'invalid-pseudo': 'Ce pseudo ne convient pas. Essaie-en un autre.',
  // DÉCISION 1.3 du chantier v4. Le refus est maintenu — autoriser à reprendre la
  // place d'un joueur déconnecté ouvrirait l'usurpation d'un pseudo lu sur le
  // stream. Mais le message doit dire la CAUSE LA PLUS PROBABLE : neuf fois sur
  // dix, le pseudo est pris par le joueur lui-même, revenu après avoir perdu sa
  // session. Sans cette phrase, il invente un autre pseudo et repart à zéro.
  'pseudo-taken': 'Ce pseudo est déjà pris — c\'est peut-être toi, sur un autre onglet. '
    + 'Ferme-le et reviens, ou choisis-en un autre.',
  'room-full': 'Ce salon est complet.',
  'join-failed': 'Connexion impossible. Réessaie.',
};
// Chaque erreur reste rattachée AU CHAMP qui l'a provoquée ; seul l'échec
// réseau parle en haut de l'écran.
const ERROR_FIELD = {
  'room-not-found': 'code',
  'invalid-pseudo': 'pseudo',
  'pseudo-taken': 'pseudo',
  'room-full': 'code',
  'join-failed': 'general',
};

// ============================================================
// J1 — Rejoindre
// ============================================================
function JoinScreen({ initialCode, onJoin, notice }) {
  const CODE_LEN = 5;
  const [chars, setChars] = useState(() => {
    const src = (initialCode || '').toUpperCase().slice(0, CODE_LEN).split('');
    return Array.from({ length: CODE_LEN }, (_, i) => src[i] || '');
  });
  const [pseudo, setPseudo] = useState('');
  const [errCode, setErrCode] = useState(null);
  const [busy, setBusy] = useState(false);
  const boxes = useRef([]);

  const code = chars.join('');
  const field = errCode ? ERROR_FIELD[errCode] : null;
  const message = errCode ? ERROR_MESSAGES[errCode] || ERROR_MESSAGES['join-failed'] : null;

  function setChar(i, raw) {
    const v = (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-1);
    setChars((prev) => { const next = prev.slice(); next[i] = v; return next; });
    setErrCode(null);
    if (v && i < CODE_LEN - 1) boxes.current[i + 1]?.focus();
  }
  function onKeyDown(i, e) {
    if (e.key === 'Backspace' && !chars[i] && i > 0) boxes.current[i - 1]?.focus();
  }
  function onPaste(e) {
    const txt = (e.clipboardData?.getData('text') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!txt) return;
    e.preventDefault();
    setChars(Array.from({ length: CODE_LEN }, (_, i) => txt[i] || ''));
    boxes.current[Math.min(txt.length, CODE_LEN - 1)]?.focus();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setErrCode(null);
    setBusy(true);
    try {
      await onJoin(code.trim(), pseudo.trim());
    } catch (err) {
      setErrCode(err?.message in ERROR_MESSAGES ? err.message : 'join-failed');
      setBusy(false);
    }
  }

  return (
    <main className="screen screen--hearth" data-state={busy ? 'submitting' : 'idle'} aria-labelledby="join-title">
      <div className="screen__main">
        <div className="p-brand">
          <span className="p-brand__mark" aria-hidden="true"><Ico.flame s={22} ember /></span>
          <p className="p-label">{NOM_DU_JEU}</p>
        </div>

        <h1 className="p-title" id="join-title" style={{ marginTop: 'var(--sp-7)' }}>Rejoins<br />la partie</h1>
        <p className="p-lead">Ton téléphone est ta manette.</p>

        {notice ? (
          <div className="join__notice" data-bind="join.notice" role="status">
            <span style={{ flex: 'none', color: 'var(--c-ember-bright)' }} aria-hidden="true"><Ico.clock s={20} /></span>
            <p>{notice}</p>
          </div>
        ) : null}

        {field === 'general' && message ? (
          <div className="join__notice" data-testid="join-error" role="alert" style={{ background: 'var(--c-bad-wash)' }}>
            <span style={{ flex: 'none', color: 'var(--c-bad)' }} aria-hidden="true"><Ico.cross s={20} /></span>
            <p>{message}</p>
          </div>
        ) : null}

        <form className="join" data-testid="join-form" onSubmit={handleSubmit} noValidate data-action="POST /api/rooms/:code/join">
          <div className="join__field">
            <label className="p-label" htmlFor="code-1">Code du salon</label>
            <div className={`code-boxes${field === 'code' ? ' code-boxes--error' : ''}`} data-bind="url.code" data-testid="join-code">
              {chars.map((c, i) => (
                <input
                  key={i}
                  id={`code-${i + 1}`}
                  ref={(el) => { boxes.current[i] = el; }}
                  className="code-boxes__input"
                  value={c}
                  onChange={(e) => setChar(i, e.target.value)}
                  onKeyDown={(e) => onKeyDown(i, e)}
                  onPaste={onPaste}
                  onFocus={(e) => e.target.select()}
                  maxLength={1}
                  inputMode="latin"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={busy}
                  aria-label={`Code, caractère ${i + 1}`}
                  aria-invalid={field === 'code' || undefined}
                  aria-describedby={field === 'code' ? 'err-code' : undefined}
                />
              ))}
            </div>
            {field === 'code' && message ? (
              <p className="field-error" id="err-code" data-testid="join-error" role="alert">
                <Ico.cross s={16} /> {message}
              </p>
            ) : (
              <p className="join__hint">5 caractères, affiché sur l'écran de la partie. Ni O ni I.</p>
            )}
          </div>

          <div className="join__field">
            <label className="p-label" htmlFor="pseudo">Ton pseudo</label>
            <div className={`field-shell${field === 'pseudo' ? ' field-shell--error' : ''}`}>
              <input
                className="field-shell__input"
                data-testid="join-pseudo"
                id="pseudo"
                name="pseudo"
                value={pseudo}
                onChange={(e) => { setPseudo(e.target.value); setErrCode(null); }}
                maxLength={20}
                autoComplete="nickname"
                disabled={busy}
                placeholder="Comment on t'appelle ?"
                aria-invalid={field === 'pseudo' || undefined}
                aria-describedby={field === 'pseudo' ? 'err-pseudo' : undefined}
              />
              <span className="field-shell__count">{pseudo.length}/20</span>
            </div>
            {field === 'pseudo' && message ? (
              <p className="field-error" id="err-pseudo" data-testid="join-error" role="alert">
                <Ico.cross s={16} /> {message}
              </p>
            ) : null}
          </div>
        </form>

        <div className="screen__push" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <div className="join__reassure">
            <span className="join__reassure-badge" aria-hidden="true"><Ico.checkCircle s={18} /></span>
            <p>Aucun compte, aucune installation.</p>
          </div>
          <button className="p-btn p-btn--primary" type="submit" disabled={busy} data-testid="join-submit"
            onClick={handleSubmit} data-action="POST /api/rooms/:code/join" aria-busy={busy || undefined}>
            {busy ? 'On te fait une place…' : 'Entrer dans le salon'}
            {busy ? null : <Ico.arrow s={18} />}
          </button>
        </div>
      </div>
    </main>
  );
}

// ============================================================
// J2 — Salle d'attente
// ============================================================
// L'ANNONCE DU JEU — le jingle. L'animateur a choisi « Le lien » et saisit ses
// deux mots ; le cercle patiente devant le nom du jeu. C'est un temps mort qui
// n'en est pas un : il prépare l'attention, comme un générique.
// L'ÉCRAN D'ANNONCE — le jingle d'un jeu qui se prépare à l'antenne.
//
// IL ÉTAIT ÉCRIT POUR « LE LIEN » SEUL : son emblème et sa règle étaient posés en
// dur, si bien que « Les visages » aurait annoncé des chaînons et demandé de
// trouver un mot. Chaque jeu en direct apporte donc désormais son emblème et sa
// phrase — et un jeu inconnu retombe sur l'emblème de la marque plutôt que sur
// celui du voisin.
const ANNONCES = {
  // LES QUATRE JEUX CLASSIQUES ONT DÉSORMAIS LEUR JINGLE, eux aussi. Ils
  // démarraient d'un clic : la question tombait sur les téléphones avant qu'on ait
  // dit à quoi on jouait. « Chaque module doit comporter un écran d'attente. »
  quiz: {
    emblem: <EmblemeJeu type="quiz" taille={120} />,
    regle: 'Quatre réponses, une seule bonne. Le plus rapide marque le plus.',
  },
  true_false: {
    emblem: <EmblemeJeu type="true_false" taille={112} />,
    regle: 'Vrai ou faux. Rien entre les deux, et il faut trancher vite.',
  },
  estimation: {
    emblem: <EmblemeJeu type="estimation" taille={140} />,
    regle: 'Un nombre à deviner. Seule la justesse compte, pas la vitesse.',
  },
  vote: {
    emblem: <EmblemeJeu type="vote" taille={112} />,
    regle: 'Deux tours : ce que tu penses, puis ce que pense le cercle.',
  },
  lien: {
    emblem: <Chainons taille={92} />,
    regle: "Trouve le mot qui relie les deux mots de l'animateur.",
  },
  visages: {
    emblem: <MasquesVisages taille={132} />,
    regle: 'Un visage va passer deux fois. Buzze quand tu le revois.',
  },
  coupe_buche: {
    emblem: <BucheHache taille={170} />,
    regle: 'Un curseur balaie la bûche. Coupe-la à la bonne proportion.',
  },
  retour_flamme: {
    // L'EMBLÈME DÉPEND DU MODE : trois tuiles en −2, quatre en −3. C'est la règle
    // du jeu montrée en image, et elle change avec le choix de l'animateur — d'où
    // une fonction là où les autres jeux ont un dessin figé.
    emblem: (a) => <RetourFlamme ecart={a?.ecart === 3 ? 3 : 2} taille={190} />,
    regle: (a) => (a?.ecart === 3
      ? 'Une image revient trois images plus tard. Buzze quand tu la reconnais.'
      : 'Une image revient deux images plus tard. Buzze quand tu la reconnais.'),
  },
  juste_temps: {
    emblem: <ChronoBuzzer taille={86} />,
    regle: "Un chrono va s'effacer sans s'arrêter. Stoppe-le au bon moment.",
  },
};

function AnnonceScreen({ nom, type, annonce }) {
  const a = ANNONCES[type];
  // Un jeu dont l'emblème ou la règle DÉPEND de ce que l'animateur vient de
  // choisir les déclare en fonction ; les autres gardent leur dessin figé.
  const rendre = (v) => (typeof v === 'function' ? v(annonce) : v);
  return (
    <main className="screen screen--hearth" data-state="annonce" aria-labelledby="annonce-titre">
      <div className="screen__main screen__main--center">
        <span className="annonce__emblem" aria-hidden="true">{a ? rendre(a.emblem) : <Flamme taille={92} />}</span>
        <p className="p-label">Prochaine épreuve</p>
        <h1 className="p-title" id="annonce-titre">{nom}</h1>
        {a ? <p className="p-lead" role="status">{rendre(a.regle)}</p> : null}
        <span className="p-dots" aria-hidden="true">
          <span className="p-dots__dot" /><span className="p-dots__dot" /><span className="p-dots__dot" />
        </span>
      </div>
    </main>
  );
}

function WaitScreen({ pseudo, code, playerCount }) {
  const empty = !playerCount || playerCount <= 1;
  const phrase = usePhraseQuiTourne(empty ? 'attente.seul' : 'attente.accompagne');
  const overflow = pseudo && pseudo.length > 15; // Pseudo long déborde visuellement
  return (
    <main className="screen screen--hearth" data-state={`waiting${empty ? ' empty' : ''}${overflow ? ' overflow' : ''}`} aria-labelledby="wait-title">
      <div className="screen__main screen__main--center">
        {code ? (
          <span className="p-cap" data-bind="room.code" data-testid="room-code">
            <span className="p-cap__label">Salon</span>
            <span className="p-cap__value">{code}</span>
          </span>
        ) : null}

        <div className="wait__id">
          <p className="p-label">Tu joues sous le nom</p>
          <p className="wait__pseudo" data-bind="player.pseudo">{pseudo || 'Toi'}</p>
        </div>

        <span className="p-dots" aria-hidden="true">
          <span className="p-dots__dot" /><span className="p-dots__dot" /><span className="p-dots__dot" />
        </span>
        <h1 className="p-title p-title--sm" id="wait-title">
          {empty ? 'Tu allumes le feu' : "On attend l'animateur"}
        </h1>
        {/* aria-hidden : la phrase change toutes les six secondes. Annoncée, elle
            couvrirait tout le reste pour un joueur qui écoute son écran. */}
        {phrase ? (
          <p className="p-lead voix" aria-hidden="true" data-testid="voix-attente" key={phrase}>{phrase}</p>
        ) : null}

        <div className={`wait__count${empty ? ' wait__count--empty' : ''}`} role="status" aria-live="polite">
          <span aria-hidden="true" style={{ color: 'var(--c-ink-3)' }}><Ico.people s={22} /></span>
          <span className="wait__count-value" data-bind="room.playerCount" data-testid="player-count"
            key={playerCount}>{fmtNum(playerCount || 0)}</span>
          <span className="wait__count-label">{(playerCount || 0) > 1 ? 'joueurs prêts' : 'joueur prêt'}</span>
        </div>

        {/* LE BARÈME, ENFIN ÉNONCÉ (action 8). Il existait, ses règles étaient
            parfaitement définies — mais elles n'étaient écrites nulle part. Le
            joueur voyait « bonus vitesse : +150 » sans avoir jamais su qu'un tel
            bonus existait, d'où l'impression d'arbitraire relevée en test.
            Replié par défaut : l'écran reste épuré, et l'information est là au
            moment précis où le joueur n'a rien d'autre à faire. */}
        <details className="rules" data-testid="scoring-rules">
          <summary className="rules__summary">Comment on marque des points</summary>
          <ul className="rules__list">
            {/* DÉCISION 4.7 du chantier v4 — l'énoncé doit refléter le barème RÉEL.
                Le complément est passé de 300 à 250, et le supplément du plus rapide
                a disparu du calcul : le maximum d'une manche est 950, plus 1150.
                Le plus rapide reste NOMMÉ, comme la série — pour l'honneur. */}
            <li>Une bonne réponse vaut <strong>700 points</strong>.</li>
            <li>Plus tu réponds vite, plus tu ajoutes : <strong>jusqu'à 250 points</strong> de complément.</li>
            <li>
              La réponse juste la plus rapide de la manche est <strong>nommée</strong>, pour
              l'honneur : elle ne rapporte pas de points de plus.
            </li>
            {/* L'énoncé doit couvrir les QUATRE jeux, pas seulement le quiz :
                l'estimation et le vote ont leurs propres règles, et un barème
                incomplet est aussi trompeur qu'un barème absent. */}
            {/* DÉCISION 5.11 du chantier v4 — l'énoncé décrit LES DEUX jeux de plages.
                Un barème incomplet est aussi trompeur qu'un barème absent. */}
            <li>
              En <strong>estimation</strong>, seule la justesse compte — la vitesse n'y joue
              aucun rôle. Plus tu es près, plus tu marques : <strong>1000</strong> dans le mille,
              puis 750, 500 et 250 à mesure que tu t'éloignes.
            </li>
            <li>
              Quand la réponse est une <strong>année</strong>, les plages se comptent en années :
              exact, puis ±2, ±5 et ±10 ans. Un pourcentage n'aurait aucun sens — 2 % de 1789
              feraient trente-cinq ans.
            </li>
            <li>
              Toujours en estimation, la réponse <strong>la plus proche</strong> gagne 400 points,
              même si personne n'est dans une plage. Et tomber <strong>exactement</strong> juste
              en ajoute 200.
            </li>
            <li>Au <strong>vote</strong>, tu marques si tu es dans la majorité. En cas d'égalité, les deux camps gagnent.</li>
            <li>Une mauvaise réponse ne rapporte rien — et ne coûte rien. Aucun jeu ne retire de points.</li>
            <li>
              Tes bonnes réponses d'affilée sont comptées, pour l'honneur : elles ne donnent
              pas de points. La série se rompt sur une mauvaise réponse, une manche sans
              réponse, ou un vote minoritaire.
            </li>
          </ul>
        </details>
      </div>
    </main>
  );
}

// ============================================================
// J3 — Question : 4 modules × 3 états
// ============================================================
function QuestionScreen({ current, tick, score, answered, myAnswer, onAnswer, element, buzz }) {
  // Le visage de CETTE manche, et d'aucune autre. Sans le garde sur l'identifiant
  // de manche, un visage attardé de la manche précédente s'afficherait une
  // fraction de seconde sur la nouvelle — et dans ce jeu, un visage vu est un
  // visage qui compte.
  // LES IMAGES SONT CHARGÉES D'AVANCE, dès l'arrivée de la question. Un visage
  // reste deux secondes : une image qui arrive en retard est un visage qu'on n'a
  // pas vu, donc une manche faussée que rien ne signale.
  useEffect(() => {
    if (current.type !== 'visages' || !Array.isArray(current.bassin)) return;
    prechargerVisages(current.bassin.map((v) => v.id), (id) => current.bassin.find((v) => v.id === id)?.src);
  }, [current.type, current.roundId]);

  // L'IMAGE DE CETTE MANCHE, ET D'AUCUNE AUTRE — le garde sur l'identifiant de
  // manche vaut pour les deux jeux de défilé.
  const elementOk = element && element.roundId === current.roundId;
  const visageId = elementOk ? element.id : null;
  const visageSrc = elementOk ? element.src : null;
  const visagePlace = elementOk ? element.place : null;
  const type = current.type || 'quiz';
  const options = Array.isArray(current.options) ? current.options : [];
  const index = current.index != null ? current.index : current.number;
  const total = current.total;
  // LE CHRONO AFFICHÉ EST CELUI DU JEU, pas celui de la fenêtre de réponse.
  //
  // Les deux diffèrent sur « Coupe ta bûche » : le serveur laisse une marge après
  // les dix secondes pour qu'une coupe partie à 9,9 s ne soit pas refusée par le
  // réseau. L'anneau affichait donc 12 là où l'énoncé demande « un chronomètre de
  // 10 secondes » — et le joueur croyait avoir deux secondes de plus qu'il n'en a.
  const timeLeftBrut = tick?.timeLeft;

  // ---- « COUPE TA BÛCHE » : LE CURSEUR ----
  //
  // Il ne se déduit d'aucune donnée : il est CALCULÉ, à partir d'une durée envoyée
  // par le serveur et de l'horloge monotone du navigateur. La formule est la même
  // que celle de l'arbitre, et un contrôle les confronte — sans quoi le joueur
  // couperait à un endroit et le serveur en compterait un autre.
  //
  // IL EST DÉCLARÉ ICI, AVANT LE CHRONO, et pas plus bas avec le reste du jeu :
  // c'est de lui que le compte à rebours affiché se déduit, et une constante ne
  // peut pas se lire avant sa déclaration.
  const estBuche = type === 'coupe_buche';
  const ecouleBuche = useBalayage(current, estBuche);
  const positionBuche = estBuche && current.periodeMs
    ? positionDuCurseur(ecouleBuche, current.periodeMs)
    : 0;
  // Le chrono du JEU pour la bûche — dix secondes, décomptées du même balayage
  // que le curseur, donc parfaitement d'accord avec lui.
  const timeLeft = estBuche && current.dureeCoupeMs != null
    ? Math.max(0, Math.ceil((current.dureeCoupeMs - ecouleBuche) / 1000))
    : timeLeftBrut;
  // La durée de référence de la jauge suit le même principe : celle du JEU.
  const totalSec = Math.max(1, Math.round(
    ((estBuche ? current.dureeCoupeMs : current.durationMs) || 0) / 1000));
  const frac = timeLeft != null ? Math.max(0, Math.min(1, timeLeft / totalSec)) : 1;
  const urgent = timeLeft != null && timeLeft > 0 && timeLeft <= 5;
  // Verrouillage à 0 : plus aucune réponse possible (le serveur refuse de toute
  // façon — ceci est le retour visuel immédiat).
  const timeUp = timeLeft != null && timeLeft <= 0;
  // LE VERROUILLAGE APPARTIENT À L'ÉCRAN DE JEU, et il dépend du jeu.
  //
  // Partout ailleurs, avoir répondu ferme la manche : c'est ce qui empêche un
  // second envoi. « Retour de flamme » en attend six ; s'y fier le figeait au
  // premier buzz, et le joueur regardait passer les cinq retours suivants sans
  // rien pouvoir faire. Ici, seul le CHRONO ferme.
  const buzzMultiple = type === 'retour_flamme';
  // LE BLANC ENTRE DEUX IMAGES — sans lui, deux images identiques qui se suivent
  // ne se distinguent pas, et c'est exactement le moment où il faut buzzer.
  const blanc = useBlancEntreImages(buzzMultiple ? visagePlace : null);
  const disabled = (answered && !buzzMultiple) || timeUp;
  const [estimate, setEstimate] = useState('');
  // « Le lien » : le mot saisi au clavier, remis à zéro à chaque manche.
  const [mot, setMot] = useState('');
  const isVote = type === 'vote';
  // LES DEUX TOURS DU VOTE. Le premier demande ce que le joueur pense, le second
  // ce qu'il croit que le cercle a répondu. Un sondage n'a qu'un tour et se tait.
  const consigneDuTour = isVote && current.tours > 1
    ? (current.tour === 2 ? 'Que pense le cercle ?' : 'Que penses-tu ?')
    : null;

  // ---- « LE JUSTE TEMPS » : LE COMPTE À REBOURS FIN ----
  //
  // Il n'a rien à voir avec le chrono de la manche affiché en haut de l'écran :
  // celui-là compte les SECONDES de la fenêtre de réponse, arrondies vers le
  // haut, et la fenêtre dépasse volontairement le cadran pour qu'on puisse buzzer
  // à zéro. Celui-ci est le cadran lui-même, au centième.
  //
  // LE CROCHET TOURNE MÊME QUAND LE JOUEUR A BUZZÉ, et ce n'est pas un oubli :
  // le chrono continue de courir à l'antenne et sur les autres téléphones. Le
  // figer ici donnerait au joueur qui a buzzé une information que les autres
  // n'ont pas — l'instant exact où il a appuyé.
  const restantMs = useCompteARebours(current, type === 'juste_temps');
  const chronoSec = restantMs != null ? restantMs / 1000 : null;
  // LE CACHE. Le chrono s'efface en ARRIVANT sur ce temps ; il continue de courir.
  // Un cache à zéro ne cache rien — c'est le choix de l'animateur, pas un défaut.
  const cacheSec = Number(current.cache) || 0;
  const chronoCache = chronoSec != null && cacheSec > 0 && chronoSec <= cacheSec;

  const state = answered ? 'answered' : timeUp ? 'time-up' : urgent ? 'open urgent' : 'open';

  // LE SON DU CHRONO (A25) — « l'absence de signal sonore rendait difficile la
  // perception de la fin des 20 secondes de réponse ».
  //
  // Un bip par seconde sur les cinq dernières, puis la chute à zéro. Le repère
  // est la SECONDE, pas le rendu : sans lui, chaque re-rendu rejouerait le son —
  // et l'écran de question en compte plusieurs par seconde (l'anneau de chrono
  // s'anime).
  //
  // Le joueur qui a déjà répondu n'entend rien : le temps ne le concerne plus, et
  // un décompte pressant sur un écran où il n'a plus rien à faire est une
  // nuisance, pas une information.
  //
  // ET IL SE TAIT SUR « LE JUSTE TEMPS ». Les bips tombent sur les cinq dernières
  // secondes de la FENÊTRE de réponse : un joueur qui les entend saurait à quel
  // moment le chrono caché se trouve, à la seconde près. Ce jeu consiste
  // exactement à ne pas le savoir. Le son y serait une fuite, pas un confort.
  const derniereSeconde = useRef(null);
  useEffect(() => {
    if (timeLeft == null || answered || type === 'juste_temps') { derniereSeconde.current = null; return; }
    if (derniereSeconde.current === timeLeft) return;
    const precedente = derniereSeconde.current;
    derniereSeconde.current = timeLeft;
    if (precedente == null) return; // on n'annonce rien à l'arrivée sur l'écran
    if (timeLeft > 0 && timeLeft <= 5) bipCompteRebours();
    else if (timeLeft === 0) sonFinDuTemps();
  }, [timeLeft, answered]);

  // Bandeau de statut : accusé de réception, ou clôture.
  // Le bandeau ne s'affiche pas dans un jeu à buzz multiple : « Réponse envoyée »
  // y annoncerait une manche finie alors qu'il en reste cinquante secondes. C'est
  // le compteur de buzz, sous le bouton, qui accuse réception.
  const status = answered && !buzzMultiple
    ? {
      closed: false,
      // Sur le premier tour d'un vote, « ta voix est enregistrée » laisserait
      // croire la manche finie. Il en reste la moitié, et c'est celle qui compte.
      text: isVote
        ? (consigneDuTour && current.tour === 1 ? 'Voix enregistrée — le cercle va être sondé' : 'Ta voix est enregistrée')
        : 'Réponse envoyée',
    }
    : timeUp
      ? { closed: true, text: isVote ? 'Vote clos' : "Temps écoulé — tu n'as pas répondu" }
      : null;

  function optClass(chosen) {
    if (chosen) return `opt ${isVote ? 'opt--voted' : 'opt--selected'}`;
    return `opt${disabled ? ' opt--frozen' : ''}`;
  }

  return (
    <main className="screen" data-state={state}
      aria-labelledby={type === 'lien' ? 'lien-mots' : 'q-text'}>
      <div className="screen__main">
        <div className="q-hud">
          <span className={`p-cap${disabled ? ' p-cap--sunk' : ' p-cap--accent'}`} data-bind="module.meta.name">
            {disabled ? null : <span className="p-cap__dot" aria-hidden="true" />}
            <span className="p-cap__label">{current.meta?.name || 'Épreuve'}</span>
          </span>
          <span className="p-cap">
            <span className="p-cap__label">Score</span>
            <span className="p-cap__value" data-bind="you.score">{fmtNum(score)}</span>
          </span>
        </div>

        <div className="q-meta">
          <div className="q-round">
            <p className="p-label p-label--tiny">Manche</p>
            <p className="q-round__value">
              <span data-bind="module.index">{index != null ? index : '—'}</span>
              {total != null && total > (index || 0) ? (
                <><span className="p-dim">/</span><span className="p-dim" data-bind="module.total">{total}</span></>
              ) : null}
            </p>
          </div>
          {/* LE CHRONO DE MANCHE DISPARAÎT SUR « LE JUSTE TEMPS », et c'est la
              correction la plus importante de ce jeu.
              Il compte les secondes de la FENÊTRE de réponse. Vu à l'écran : le
              cadran s'efface à 12,00 comme prévu, et l'anneau du haut continue
              d'égrener 12, 11, 10 — en clair, sur le même écran. Le joueur n'a
              plus qu'à lire. Tout le jeu consiste à ne pas savoir où en est le
              chrono ; en laisser un second à l'écran le rendait sans objet.
              Ici le cadran EST le chrono, et il n'y en a pas d'autre. */}
          {type === 'juste_temps' ? null : (
          <div
            className={`q-chrono${urgent ? ' q-chrono--urgent' : ''}${timeUp ? ' q-chrono--over' : ''}`}
            style={{ '--q-frac': `${Math.round(frac * 100)}%` }}
            role="timer"
            aria-label={`Temps restant ${timeLeft ?? 0} secondes`}
          >
            <div className="q-chrono__inner">
              <span className="q-chrono__value" data-bind="tick.timeLeft">
                {timeLeft != null ? timeLeft : '—'}
              </span>
            </div>
          </div>
          )}
        </div>

        {/* L'ÉNONCÉ — SAUF QUAND L'ÉCRAN LE DIT DÉJÀ AILLEURS.
            « Le lien » affichait ses deux mots DEUX FOIS sur le même écran : ici,
            collés par un point médian, et au milieu de l'écran en grand, séparés
            par l'emblème. C'est ce second affichage qui est le jeu — on lit les
            deux mots ET ce qui pourrait les relier. Le premier n'ajoutait rien et
            volait le haut de l'écran à la question. */}
        {/* « COUPE TA BÛCHE » N'A PAS D'ÉNONCÉ GÉNÉRIQUE : sa consigne EST la
            proportion demandée, et elle prend la place de l'énoncé — « en haut de
            l'écran, la proportion demandée par l'animateur est précisé avec la
            phrase "Coupe cette bûche à Proportion cible" ».

            ELLE ÉTAIT ÉCRITE COLLÉE À LA BÛCHE, tout en bas : le haut de l'écran
            restait vide sur les deux tiers de la hauteur, et la consigne — la
            seule chose à lire avant de frapper — se trouvait là où l'œil ne va
            qu'après. Vu à l'écran, corrigé ici. */}
        {type === 'coupe_buche' ? (
          <p className="q-text cbj__consigne" id="q-text" data-testid="cb-consigne">
            Coupe cette bûche à <strong>{pourcent(current.cible)}</strong>
          </p>
        ) : type === 'lien' ? null : (
          <p className={`q-text${disabled ? ' q-text--frozen' : ''}`} id="q-text"
            data-bind="module.text" data-testid="question-text">{current.text}</p>
        )}

        {/* LA CONSIGNE DU TOUR — « Vote » se joue en deux temps, et la question ne
            change pas entre les deux : c'est CE QU'ON DEMANDE qui change. Sans
            cette ligne, le joueur voit deux fois le même écran et répond deux fois
            la même chose — le second tour n'aurait plus d'objet.

            Elle ne s'affiche que sur un vote à deux tours : un sondage n'en a
            qu'un, et n'a rien à préciser. */}
        {consigneDuTour ? (
          <p className="q-consigne" data-testid="vote-consigne" data-tour={current.tour}>
            <span className="q-consigne__tour">Tour {current.tour}/{current.tours}</span>
            {consigneDuTour}
          </p>
        ) : null}

        <div className={`q-zone${type === 'true_false' ? ' q-zone--tiles' : ''}${type === 'coupe_buche' ? ' q-zone--buche' : ''}`} data-bind="module.options" data-testid="answer-zone">
          {type === 'true_false' ? (
            [['Vrai', true], ['Faux', false]].map(([label, val]) => {
              const chosen = myAnswer === val;
              return (
                <button
                  key={label}
                  type="button"
                  className={`tile${chosen ? ' tile--selected' : disabled ? ' tile--frozen' : ''}`}
                  data-testid="answer-option"
                  data-action="play:answer"
                  data-state={chosen ? 'selected' : disabled ? 'frozen' : 'idle'}
                  disabled={disabled}
                  onClick={() => onAnswer(val)}
                >
                  <span aria-hidden="true">{val ? <Ico.check s={30} w={1.8} /> : <Ico.cross s={30} />}</span>
                  <span className="tile__label">{label}</span>
                </button>
              );
            })
          ) : type === 'visages' ? (
            /* LES VISAGES. Le visage occupe l'écran, le buzz est dessous — et il
               n'y a rien d'autre : c'est un jeu de reconnaissance, tout ce qui
               entoure le visage détourne l'œil au moment où il faut regarder.

               UN SEUL BUZZ, ET IL EST DÉFINITIF. Le bouton se fige dès qu'il est
               employé (`disabled` porte déjà `answered`), et son libellé le dit —
               un joueur qui ne verrait pas que son buzz est parti buzzerait deux
               fois dans le vide en croyant jouer. */
            <div className="vsg">
              <div className="vsg__cadre" data-testid="visage-courant" data-place={visagePlace || ''}>
                {visageId
                  ? <Visage id={visageId} src={visageSrc} taille={260} titre={`Visage ${visagePlace}`} />
                  : <span className="vsg__attente" aria-hidden="true" />}
              </div>
              <button
                className="p-btn p-btn--primary p-btn--buzz"
                type="button"
                data-testid="answer-submit"
                data-action="play:answer"
                disabled={disabled}
                onClick={() => onAnswer(true)}
              >
                {answered ? 'Buzz envoyé' : 'Déjà vu ce visage !'}
              </button>
            </div>
          ) : type === 'retour_flamme' ? (
            /* RETOUR DE FLAMME. L'image occupe l'écran, le buzz est dessous — et
               il n'y a rien d'autre : c'est un jeu d'attention, tout ce qui
               entoure l'image détourne l'œil au moment où il faut regarder.

               LE BOUTON NE SE FIGE PAS, et c'est le seul du projet dans ce cas.
               On buzze ici SIX FOIS si l'on est bon ; le verrouiller au premier
               appui laisserait le joueur regarder passer les cinq autres sans
               rien pouvoir faire. C'est la raison d'être de `meta.multi`.

               LE COMPTEUR DE BUZZ EST UN RETOUR, PAS UN SCORE. Sur un jeu où l'on
               tape plusieurs fois en deux secondes, sans lui, personne ne sait si
               son doigt a été entendu — et il n'apprend rien : le joueur sait déjà
               combien de fois il a appuyé. Il ne dit PAS s'ils étaient justes. */
            <div className="vsg">
              <div className="vsg__cadre" data-testid="retour-image" data-place={visagePlace || ''}
                data-blanc={blanc || undefined}>
                {visageId && !blanc
                  ? <Symbole id={visageId} taille={240} />
                  : <span className="vsg__attente" aria-hidden="true" />}
              </div>
              <button
                className="p-btn p-btn--primary p-btn--buzz"
                type="button"
                data-testid="answer-submit"
                data-action="play:answer"
                disabled={disabled}
                onClick={() => onAnswer(true)}
              >
                Retour de flamme !
              </button>
              <p className="vsg__compte" data-testid="retour-compte" aria-live="polite">
                {buzz > 0 ? `${buzz} buzz envoyé${buzz > 1 ? 's' : ''}` : 'Aucun buzz pour l’instant'}
              </p>
            </div>
          ) : type === 'coupe_buche' ? (
            /* COUPE TA BÛCHE. La consigne en haut, la bûche au milieu, le bouton
               dessous — et rien d'autre : c'est un jeu de timing, tout ce qui
               entoure la bûche détourne l'œil au moment où il faut frapper.

               CE QUE LE BOUTON ENVOIE : l'INSTANT local de la frappe, pas la
               position. Le serveur la recalcule par la même formule après avoir
               borné cet instant par sa propre horloge (voir `coupeDuJoueur`). Le
               curseur parcourt cent points de bûche par seconde : arbitrer sur la
               seule heure d'arrivée mesurerait la latence de la liaison, pas
               l'adresse du joueur. */
            <div className="cbj">
              <div className="cbj__buche" data-testid="cb-buche"
                role="img" aria-label={`Bûche, curseur à ${Math.round(positionBuche)} %`}>
                {/* LE TRAIT DU CURSEUR — la seule chose qui bouge. Sa position est
                    une PROPORTION : la part de bûche à sa gauche. */}
                <span className="cbj__curseur" style={{ left: `${positionBuche}%` }} aria-hidden="true" />
              </div>
              <button
                className="p-btn p-btn--primary p-btn--buzz"
                type="button"
                data-testid="answer-submit"
                data-action="play:answer"
                disabled={disabled}
                onClick={() => onAnswer(Math.round(ecouleBuche))}
              >
                {answered ? 'Coupe envoyée' : 'COUPE !'}
              </button>
            </div>
          ) : type === 'juste_temps' ? (
            /* LE JUSTE TEMPS. Le chrono occupe l'écran, le STOP est dessous, et
               il n'y a rien d'autre : tout ce qui entoure les chiffres détourne
               l'œil au moment où il faut compter dans sa tête.

               UN SEUL APPUI, ET IL EST DÉFINITIF — même règle que le buzz des
               visages, et pour la même raison : un joueur qui ne verrait pas que
               son temps est parti appuierait deux fois dans le vide en croyant
               jouer.

               CE QUE LE BOUTON ENVOIE : le temps que CET écran affichait au
               moment du doigt. Le serveur ne le croit pas sur parole — il le
               borne par sa propre horloge (voir `valeurDuBuzz`) — mais sans cette
               annonce, l'aller-retour réseau serait décompté du temps du joueur,
               et il le serait toujours aux mêmes. */
            <div className="jtj">
              {/* LA CIBLE, EN CLAIR ET AU-DESSUS DU CADRAN.
                  Elle avait été retenue au serveur, prise pour la réponse. C'était
                  un contresens : c'est la CONSIGNE. Un joueur qui l'ignore ne peut
                  pas jouer — on lui demandait d'arrêter un chrono sur un temps
                  qu'on ne lui avait pas dit. Ce qui reste caché, et qui est le
                  jeu, c'est le chrono lui-même une fois passé le temps de cache. */}
              <p className="jtj__cible" data-testid="jt-cible-joueur">
                <span className="jtj__cible-label">Arrête-le à</span>
                <span className="jtj__cible-val">{secondes(current.cible)}</span>
              </p>
              <div className={`jtj__cadran${chronoCache ? ' jtj__cadran--cache' : ''}`}
                data-testid="jt-chrono" data-cache={chronoCache || undefined}
                role="timer" aria-label={chronoCache ? 'Chrono masqué' : `Chrono ${chronoAffiche(chronoSec)}`}>
                <span className={`jtj__valeur${chronoCache ? ' consume' : ''}`} data-bind="jt.chrono">
                  {chronoAffiche(chronoSec)}
                </span>
              </div>
              {/* La consigne reste sous le cadran une fois celui-ci consumé :
                  sinon l'écran devient noir et muet à l'instant précis où le
                  joueur a le plus besoin qu'on lui dise quoi faire. */}
              <p className="jtj__consigne">
                {chronoCache ? 'Il court toujours. À toi de le suivre.' : 'Retiens le rythme.'}
              </p>
              <button
                className="p-btn p-btn--primary p-btn--buzz"
                type="button"
                data-testid="answer-submit"
                data-action="play:answer"
                disabled={disabled}
                onClick={() => onAnswer(chronoSec != null ? Number(chronoSec.toFixed(2)) : 0)}
              >
                {answered ? 'Temps envoyé' : 'STOP'}
              </button>
            </div>
          ) : type === 'lien' ? (
            /* LE LIEN. Les deux mots sont l'énoncé : ils passent AVANT le champ,
               en évidence, parce que c'est sur eux que le joueur réfléchit. Le
               chrono et le compteur restent ceux de tous les jeux. */
            <form className="lien" onSubmit={(e) => { e.preventDefault(); if (disabled) return; onAnswer(mot); }}>
              {/* LES DEUX MOTS, en grand, séparés par l'emblème. Ils portent
                  désormais l'étiquette de l'écran : c'est le seul énoncé qui reste,
                  et un écran sans nom n'est pas annonçable. */}
              <div className="lien__mots" id="lien-mots" data-testid="question-text">
                <span className="lien__mot">{current.mots?.[0]}</span>
                <span className="lien__chainons" aria-hidden="true"><Chainons taille={56} /></span>
                <span className="lien__mot">{current.mots?.[1]}</span>
              </div>
              <label className="p-label" htmlFor="lien">Le mot qui les relie</label>
              <div className="est__shell">
                <input
                  className="est__input est__input--mot"
                  id="lien"
                  type="text"
                  inputMode="text"
                  // A26 — LA TOUCHE DE VALIDATION DU CLAVIER ENVOIE LA RÉPONSE.
                  // « après la saisie d'une estimation, le bouton de validation du
                  // clavier du téléphone devrait envoyer directement la réponse ».
                  // Le champ est bien dans un <form> à `onSubmit`, donc la touche
                  // d'action valide déjà — mais elle s'annonçait « Entrée » ou
                  // « OK », sans dire ce qu'elle allait faire. `enterKeyHint`
                  // demande au clavier de l'appeler « Envoyer ».
                  enterKeyHint="send"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck="false"
                  maxLength={40}
                  placeholder="un seul mot"
                  value={mot}
                  disabled={disabled}
                  onChange={(e) => setMot(e.target.value)}
                />
              </div>
              <button className="p-btn p-btn--primary" type="submit" data-testid="answer-submit"
                disabled={disabled || !mot.trim()}>
                {answered ? 'Réponse envoyée' : 'Envoyer'}
              </button>
            </form>
          ) : type === 'estimation' ? (
            <form className="est" onSubmit={(e) => { e.preventDefault(); if (disabled) return; onAnswer(Number(estimate)); }}>
              <label className="p-label" htmlFor="est">Ta réponse</label>
              <div className="est__shell">
                <input
                  className="est__input"
                  id="est"
                  type="number"
                  inputMode="numeric"
                  // A26 — voir la note du champ « Le lien ». RÉSERVE HONNÊTE : sur
                  // iOS, le pavé NUMÉRIQUE n'a aucune touche d'action — il n'y a
                  // donc rien à renommer ni à presser, et le bouton « Envoyer » de
                  // l'écran reste le seul chemin. Sur Android et sur les claviers
                  // qui en ont une, la touche porte « Envoyer » et valide.
                  enterKeyHint="send"
                  placeholder="0"
                  value={estimate}
                  disabled={disabled}
                  onChange={(e) => setEstimate(e.target.value)}
                />
              </div>
              <p className="join__hint">Un nombre, positif ou négatif. Le plus proche gagne.</p>
              <button className="p-btn p-btn--primary" type="submit" data-testid="answer-submit" data-action="play:answer"
                disabled={disabled || estimate === ''} style={{ marginTop: 'var(--sp-3)' }}>
                Envoyer mon estimation
              </button>
            </form>
          ) : (
            options.map((opt, i) => {
              const chosen = myAnswer === i;
              return (
                <button
                  key={i}
                  type="button"
                  className={optClass(chosen)}
                  data-testid="answer-option"
                  data-action="play:answer"
                  data-state={chosen ? 'selected' : disabled ? 'frozen' : 'idle'}
                  disabled={disabled}
                  onClick={() => onAnswer(i)}
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <span className="opt__key" aria-hidden="true">{KEYS[i] || i + 1}</span>
                  <span className="opt__label">{opt}</span>
                  {chosen ? (
                    <span className="opt__mark" aria-hidden="true">
                      <svg className="opt__check" width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke={isVote ? 'var(--c-moss)' : 'var(--c-flame)'} strokeWidth="3"
                        strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                    </span>
                  ) : disabled ? (
                    <span className="opt__mark" aria-hidden="true"><span className="opt__mark-bar" /></span>
                  ) : (
                    <span className="opt__mark" aria-hidden="true" />
                  )}
                </button>
              );
            })
          )}

          {status ? (
            <div className={`q-status${status.closed ? ' q-status--closed' : ''}`} role="status" data-bind="play.accepted">
              <span aria-hidden="true" style={{ flex: 'none', color: status.closed ? 'var(--c-bad)' : 'var(--c-pine)' }}>
                {status.closed ? <Ico.clock s={20} /> : <Ico.checkCircle s={20} />}
              </span>
              <p>{status.text}</p>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}

// ============================================================
// J4 — Résultat de manche (aucun rang, jamais)
// ============================================================
function ScoreScreen({ you, reveal, myAnswer, current, index, total, answered, presentAuLancement }) {
  const rv = reveal || {};
  const isVote = (rv.type || current?.type) === 'vote';
  // Un vote est désormais un JEU par défaut : la majorité marque (action 18).
  // Il peut rester un SONDAGE, question par question — auquel cas personne ne
  // gagne et l'écran ne doit surtout pas annoncer de points.
  const isSondage = isVote && rv.poll === true;
  // Un vote NOTÉ se joue en deux tours ; un sondage n'en a qu'un. Les deux ne
  // disent pas la même chose du même bloc à l'écran.
  const deuxTours = isVote && rv.stats?.deuxTours === true;
  const isEstimation = (rv.type || current?.type) === 'estimation';
  const isLien = (rv.type || current?.type) === 'lien';
  const isVisages = (rv.type || current?.type) === 'visages';
  const isJusteTemps = (rv.type || current?.type) === 'juste_temps';
  const isBuche = (rv.type || current?.type) === 'coupe_buche';
  const isRetour = (rv.type || current?.type) === 'retour_flamme';
  const pointsRetour = current?.meta?.points ?? null;
  // LES DEUX JEUX QUI SE GAGNENT PAR PALIERS DE PROXIMITÉ. Tout ce qui suit —
  // la voix, le verdict, la comparaison chiffrée, la ligne d'exactitude — leur
  // est commun : c'est la même expérience à l'unité près, et l'auteur a demandé
  // pour le second de reprendre les phrases du premier.
  const parPaliers = isEstimation || isJusteTemps || isBuche;

  // TROIS situations, pas deux (R12). L'absence de résultat ne signifie pas
  // « tu n'étais pas là » : elle peut aussi vouloir dire « pas encore révélé »,
  // ou « tu viens de te reconnecter ». Seul `answered`, calculé par le serveur,
  // dit si le joueur a participé. Et le résultat n'est le sien que s'il porte
  // l'identité de la manche affichée — sinon c'est un souvenir d'une manche
  // précédente, qui affichait jusqu'ici des bonus et malus fantômes.
  const monResultat = you && current?.roundId != null && you.roundId === current.roundId ? you : null;
  // Le total d'une manche, recomposé : `base` ne porte plus que le palier depuis
  // que les bonus voyagent à part pour être MONTRÉS au joueur.
  const pointsDeLaManche = (r) => (r?.base || 0) + (r?.bonusExact || 0) + (r?.bonusProche || 0)
    + (r?.bonusGroupe || 0) + (r?.speed || 0);
  const hasData = !!monResultat;
  const absent = answered === false;
  // DEUX ABSENCES, ET NON UNE.
  //
  // `answered === false` ne dit qu'une chose : aucune réponse enregistrée. Deux
  // situations très différentes s'y confondaient, et l'écran affirmait la première
  // dans les deux cas :
  //   - le joueur a REJOINT APRÈS le lancement — il n'a jamais vu la question ;
  //   - le joueur ÉTAIT LÀ et n'a pas répondu à temps — il l'a vue en entier.
  // Dire « tu es arrivé après le lancement » à quelqu'un qui joue depuis vingt
  // minutes est faux, et il le sait.
  //
  // Le serveur tranche en comparant sa date d'arrivée au déclenchement de la
  // question. Le téléphone mis en veille pendant la manche tombe volontairement
  // dans le second cas : il était dans le salon, et le serveur ne sait pas
  // reconstituer les coupures — seulement l'instant présent.
  const arriveApres = absent && presentAuLancement === false;
  const devanceParLeTemps = absent && !arriveApres;

  // Bon / mauvais quand la révélation le permet.
  let correct = null;
  if (!isVote) {
    if (typeof rv.correct === 'boolean' && typeof myAnswer === 'boolean') correct = myAnswer === rv.correct;
    else if (typeof rv.correctIndex === 'number' && typeof myAnswer === 'number') correct = myAnswer === rv.correctIndex;
    // ESTIMATION : « a-t-il marqué ? », et donc le TOTAL, jamais `base` seul.
    // Depuis que les composantes voyagent séparément pour que l'écran montre le
    // calcul, `base` ne porte plus que les points du palier : un joueur hors de
    // toute plage mais le plus proche a `base` à zéro et 400 points au compteur.
    // Lu sur `base`, son verdict repassait à « Raté » au-dessus de « +400 » —
    // exactement la contradiction qu'un contrôle existant interdit.
    // ESTIMATION ET JUSTE TEMPS : « a-t-il marqué ? », et donc le TOTAL. Le juste
    // temps entre ici par son `valeur` — le temps que l'ARBITRE a retenu — et non
    // par `myAnswer`, qui n'est que ce que son écran affichait.
    else if (rv.target != null && (myAnswer != null || monResultat?.valeur != null)) {
      correct = pointsDeLaManche(monResultat) > 0;
    }
    // LE DRAPEAU DU SERVEUR, EN DERNIER RECOURS — et c'est lui qui manquait.
    //
    // Les branches ci-dessus reconstituent le verdict côté client, à partir de la
    // révélation et de ce que le joueur a répondu. Elles supposent toutes que la
    // réponse est COMPARABLE à quelque chose de public : une option, un booléen,
    // une cible.
    //
    // Deux jeux ne rentrent pas dans ce moule. « Le lien » se gagne en ayant
    // partagé son mot — cela ne se lit pas dans la révélation. « Les visages » se
    // gagne en ayant buzzé au bon INSTANT, ce que seule l'horloge du serveur
    // sait. Faute de branche, leur verdict restait `null` : l'écran affichait une
    // COCHE VERTE et « Manche close » à un joueur qui venait de perdre.
    //
    // Le serveur publie déjà ce drapeau dans le résultat personnel — il sert à la
    // série depuis toujours. On le lit plutôt que de refabriquer une seconde
    // définition de la réussite, qui finirait par diverger de la première.
    else if (typeof monResultat?.correct === 'boolean') correct = monResultat.correct;
  } else if (!isSondage && Array.isArray(rv.winners) && typeof myAnswer === 'number') {
    correct = rv.winners.includes(myAnswer);
  }

  // Quel moment de voix ce résultat mérite-t-il ? Chaque branche est adossée à un
  // fait vérifié : le palier renvoyé par le serveur, le supplément de rapidité
  // réellement versé, la série réellement atteinte. Une phrase ne peut donc pas
  // célébrer un réflexe qui n'a pas eu lieu.
  const momentVoix = (() => {
    // Les deux cas limites ont eux aussi leur phrase : « jamais d'écran muet »
    // vaut aussi — et surtout — pour le joueur qui arrive en cours de partie.
    if (arriveApres) return 'manche.sans-toi';
    // `temps.ecoule` — « le chrono est tombé sans réponse du joueur ». Ce moment
    // DORMAIT dans le registre depuis l'origine, avec ses phrases, sans qu'aucun
    // code ne l'atteigne. J'en avais recréé un second sans le voir ; le doublon a
    // été supprimé et c'est l'original qui parle.
    if (devanceParLeTemps) return 'temps.ecoule';
    // LE LIEN. Trois issues, et une seule règle : on ne gagne qu'en ayant pensé
    // comme quelqu'un d'autre. Le rang du groupe est calculé par le serveur.
    if (isLien) {
      if (!monResultat.rang) return 'lien.seul';
      return monResultat.rang === 1 ? 'lien.majorite' : 'lien.groupe';
    }
    // LES VISAGES. Trois issues, et la deuxième est celle qu'il fallait nommer :
    // avoir buzzé sur la PREMIÈRE apparition, c'est avoir reconnu le bon visage
    // avant qu'il ne revienne. Ce n'est pas la même chose que d'avoir buzzé au
    // hasard, et le registre ne sert pas la même phrase.
    if (isVisages) {
      if (correct === true) return 'visages.trouve';
      return monResultat.troppTot ? 'visages.trop-tot' : 'visages.rate';
    }
    // RETOUR DE FLAMME. Trois issues, et la troisième est celle qu'il fallait
    // nommer : le joueur dont le solde est négatif n'a RIEN perdu au score total,
    // et une phrase de simple échec le laisserait croire le contraire.
    if (isRetour) {
      if (monResultat.bons === 6 && monResultat.rates === 0) return 'retour.parfait';
      return (monResultat.brut || 0) > 0 ? 'retour.marque' : 'retour.brule';
    }
    if (isSondage) return 'vote.sondage';
    // LE VOTE SE GAGNE EN DEVINANT LE CERCLE, plus en faisant partie de sa
    // majorité : les deux moments ont changé de nom avec la règle.
    if (isVote) return correct ? 'vote.devine' : 'vote.manque';
    // LA RÉPONSE EXACTE D'ABORD. Elle tombait dans `estimation.mille`, le palier
    // des 2 %, alors qu'elle vaut 200 points de plus et n'a rien de commun avec
    // « à deux pour cent près ».
    if (parPaliers && monResultat.exact === true) return 'estimation.exact';
    if (parPaliers && monResultat.palier) {
      // TROUVÉ PAR LE BALAYAGE DE CLÔTURE (décision 2.8). Le moment
      // `estimation.hors` déclare « au-delà de 30 % : ZÉRO POINT », et ses phrases
      // le disent : « Complètement à côté — et ça ne coûte rien. » Depuis le bonus
      // du plus proche (décision 5.3), un joueur hors de toute plage peut toucher
      // 400 points : la phrase démentait alors le « +400 » affiché juste au-dessus,
      // et la condition déclarée du moment était devenue fausse.
      // C'est un défaut CRÉÉ par ce chantier, pas hérité.
      // LE TOTAL, et non `base`. Ce joueur est hors de toute plage : ses points du
      // palier valent zéro, et ses 400 points viennent du seul bonus. Lue sur
      // `base`, la condition ne se déclenchait plus et la voix lui servait les
      // phrases du « hors » — « ça ne coûte rien » au-dessus d'un +400.
      if (monResultat.palier === 'hors' && pointsDeLaManche(monResultat) > 0) return 'estimation.plus-proche';
      return `estimation.${monResultat.palier}`;
    }
    if (correct === true) {
      // DÉCISION 4.6 — le seuil `speed >= 150` n'avait de sens que parce que le
      // plus rapide touchait exactement 150. Le supplément supprimé (4.2), il
      // ferait dire « le plus rapide du cercle » à quiconque répond vite sans être
      // premier. On s'adosse au drapeau que le serveur désigne.
      if (monResultat.fastest) return 'juste.plus-rapide';
      if (monResultat.streak >= 2) return 'juste.serie';
      return 'juste.simple';
    }
    if (correct === false) return 'faux';
    return null;
  })();
  // Une phrase par manche, figée sur l'identifiant de manche (décision 1) : elle
  // change à chaque nouvelle question, jamais pendant. La figer sur le MOMENT
  // ferait dire la même chose à deux manches consécutives de même résultat.
  const phraseVoix = usePhraseDeManche(momentVoix, current?.roundId ?? null, {
    serie: monResultat?.streak,
    places: Math.abs(monResultat?.placesDelta || 0),
    // « Le lien » : la taille du groupe, que ses phrases citent.
    taille: monResultat?.taille,
  });

  const gained = typeof monResultat?.delta === 'number' ? monResultat.delta : 0;
  const animatedGain = useCountUp(gained);
  const places = monResultat?.placesDelta ?? 0;
  const answerLabel = correctAnswerLabel(rv, current);
  const tone = correct === true ? 'correct' : correct === false ? 'wrong' : isVote ? 'vote' : 'empty';

  const gainClass = gained > 0 ? ' gain__value--good' : gained < 0 ? ' gain__value--bad' : '';
  const gainText = gained > 0 ? `+${fmtNum(animatedGain)}` : gained < 0 ? fmtNum(gained) : '0';

  return (
    <main className={`screen${correct === true ? ' screen--win' : ''}`} data-state={hasData ? tone : 'empty'}
      aria-labelledby="verdict">
      <div className="screen__main">
        <div className="q-hud">
          <p className="p-label">
            Manche <span data-bind="module.index">{index != null ? index : '—'}</span>
            {total != null ? <><span className="p-dim">/</span><span data-bind="module.total">{total}</span></> : null}
          </p>
          <span className="p-cap">
            <span className="p-cap__label">Score</span>
            {/* Score CUMULÉ : il reste vrai même quand le résultat de la manche
                n'est pas (encore) là — c'est son décalage qui déroutait le joueur. */}
            <span className="p-cap__value" data-bind="you.score">{you ? fmtNum(you.score) : '—'}</span>
          </span>
        </div>

        {/* Situation 3 : le joueur n'a pas participé à cette manche.
            Le test est `absent` SEUL, pas « absent et sans résultat » : le serveur
            envoie un relevé à zéro à tous les joueurs connectés, y compris à ceux
            qui n'ont pas répondu. Se fier à la présence du relevé faisait donc
            afficher « 0 point » à un retardataire, là où la décision 5 de
            l'action 12 exige qu'on lui DISE qu'il n'était pas là. */}
        {arriveApres ? (
          <div className="screen__main--center" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span className="verdict__badge verdict__badge--neutral" aria-hidden="true"
              style={{ color: 'var(--c-ink-3)' }}><Ico.clock s={30} /></span>
            <h1 className="p-title p-title--sm" id="verdict">Manche jouée<br />sans toi</h1>
            {/* A2/A3 — la ligne explicative est retirée. Elle disait en gris ce
                que le titre dit en grand, juste au-dessus, et la voix parlait
                encore une troisième fois en dessous : trois phrases pour un
                seul fait. Le titre porte, la voix commente. */}
            {phraseVoix ? <p className="p-lead voix" role="status" data-testid="voix-resultat">{phraseVoix}</p> : null}
          </div>
        ) : devanceParLeTemps ? (
          /* IL ÉTAIT LÀ. On ne lui dit donc pas qu'il est arrivé après : on lui dit
             ce qui s'est réellement passé. Le chrono est désigné comme l'adversaire,
             jamais le joueur — c'est la règle du registre, où une mauvaise réponse
             « ne coûte rien ». */
          <div className="screen__main--center" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span className="verdict__badge verdict__badge--neutral" aria-hidden="true"
              style={{ color: 'var(--c-ink-3)' }}><Ico.clock s={30} /></span>
            <h1 className="p-title p-title--sm" id="verdict">Le temps<br />t'a devancé</h1>
            {/* Ligne explicative retirée — voir la note du cas précédent.
                `role="status"` migre sur la phrase de voix : c'est elle qui
                reste à annoncer, et l'annonce ne doit pas disparaître avec le
                texte qu'on supprime. */}
            {phraseVoix ? <p className="p-lead voix" role="status" data-testid="voix-resultat">{phraseVoix}</p> : null}
          </div>
        ) : (
          <>
            <div className="verdict">
              <span className={`verdict__badge verdict__badge--${correct === true ? 'good' : correct === false ? 'bad' : 'neutral'}`}
                aria-hidden="true"
                style={{ color: correct === true ? 'var(--c-ink-on-leaf)' : correct === false ? 'var(--c-bad)' : 'var(--c-fern)' }}>
                {correct === true ? <Ico.check s={38} w={2.6} dashed />
                  : correct === false ? <Ico.cross s={34} w={2.2} />
                  : <Ico.checkCircle s={34} />}
              </span>
              <h1 className={`verdict__title${correct === true ? ' verdict__title--good' : ''}`} id="verdict">
                {/* Sur un vote, être minoritaire n'est pas un échec : c'est un
                    pari perdu. Le mot « Raté » serait faux et inutilement dur. */}
                {/* BALAYAGE DE CLÔTURE, décision 2.8 — VÉRIFIÉ, RIEN À CORRIGER ICI.
                    Le titre ne peut pas démentir les chiffres qu'il surmonte : sur une
                    estimation, `correct` est établi plus haut comme « a marqué des
                    points » (ligne 597), et non comme le drapeau du serveur, qui, lui,
                    exige moins de 10 % d'écart. « Raté » ne coiffe donc jamais un gain.
                    La contradiction trouvée par ce balayage était ailleurs — dans la
                    VOIX, qui disait « ça ne coûte rien » au-dessus d'un +400. Elle est
                    corrigée au moment `estimation.plus-proche`. */}
                {/* LES VISAGES : trois issues, pas deux. Avoir buzzé sur la
                    PREMIÈRE apparition n'est pas « Raté » — le joueur a reconnu
                    le bon visage, il n'avait simplement aucun moyen de savoir
                    qu'il reviendrait. C'est la faute que le jeu provoque, et le
                    titre doit la nommer. */}
                {isVote
                  // « Avec la majorité » décrivait l'ancienne règle. On ne gagne
                  // plus en y étant, mais en l'ayant devinée — et l'on peut la
                  // deviner en pensant tout autrement.
                  ? (isSondage ? 'Voix comptée' : correct === true ? 'Tu as lu le cercle' : correct === false ? 'Le cercle t’a surpris' : 'Voix comptée')
                  : isVisages
                    ? (correct === true ? 'Bien vu' : monResultat?.troppTot ? 'Trop tôt' : 'Raté')
                  : isRetour
                    // TROIS ISSUES ICI AUSSI, et « Raté » n'en décrit aucune. Un
                    // joueur qui a trouvé deux retours et s'est trompé trois fois
                    // n'a pas raté : il a été trop pressé, et ça ne lui coûte rien.
                    ? (monResultat?.bons === 6 && monResultat?.rates === 0 ? 'Sans faute'
                      : correct === true ? 'Bien vu' : 'Trop pressé')
                    : correct === true ? 'Bien joué' : correct === false ? 'Raté' : 'Manche close'}
              </h1>
              {/* La voix du jeu remplace les commentaires figés : « Ça se
                  rattrape » disait la même chose à tout le monde, à chaque fois. */}
              {phraseVoix ? <p className="p-lead voix" role="status" data-testid="voix-resultat">{phraseVoix}</p> : null}


            </div>

            {!isSondage ? (
              <div className="gain">
                <p className="p-label">Points gagnés</p>
                <p className={`gain__value${gainClass}`} data-bind="you.delta" data-testid="points-gained">{gainText}</p>
                <span className={`places${places > 0 ? ' places--up' : places < 0 ? ' places--down' : ''}`}
                  data-bind="you.placesDelta" data-testid="places-delta">
                  {places > 0 ? <Ico.up /> : places < 0 ? <Ico.down /> : <span className="places__bar" aria-hidden="true" />}
                  <span className="places__text">
                    {places > 0 ? `+${places} place${places > 1 ? 's' : ''}`
                      : places < 0 ? `${places} place${places < -1 ? 's' : ''}`
                      : 'Position inchangée'}
                  </span>
                </span>
              </div>
            ) : (
              <span className="places" data-bind="you.placesDelta" data-testid="places-delta"
                style={{ marginTop: 'var(--sp-5)', justifyContent: 'center' }}>
                <span className="places__bar" aria-hidden="true" />
                <span className="places__text">Position inchangée</span>
              </span>
            )}

            {/* Estimation : ton chiffre face à la cible. */}
            {isEstimation && myAnswer != null ? (
              <div className="est-compare">
                <div className="est-compare__cell">
                  <span className="p-label p-label--tiny">Ton estimation</span>
                  <span className="est-compare__value">{fmtNum(myAnswer)}</span>
                </div>
                <div className="est-compare__cell est-compare__cell--target" data-bind="reveal.target" data-testid="reveal-value">
                  <span className="p-label p-label--tiny" style={{ color: 'var(--c-pine)' }}>Bonne réponse</span>
                  <span className="est-compare__value">{fmtNum(rv.target)}</span>
                </div>
              </div>
            ) : null}

            {/* RETOUR DE FLAMME : le calcul, en clair.
                LE SOLDE EST MONTRÉ MÊME QUAND IL EST NÉGATIF. C'est tout l'objet
                de ce bloc : la ligne « Points gagnés » affiche 0 pour un joueur à
                −600, parce que son score total ne baisse pas. Sans le détail, ce
                zéro serait incompréhensible, et le barème qu'on vient de lui
                expliquer invérifiable. */}
            {isRetour && monResultat?.bons != null ? (
              <div className="rfbil" data-testid="retour-bilan">
                <div className="rfbil__cell">
                  <span className="p-label p-label--tiny">Retours trouvés</span>
                  <span className="rfbil__value rfbil__value--bon">{monResultat.bons}<span className="rfbil__sur">/6</span></span>
                </div>
                <div className="rfbil__cell">
                  <span className="p-label p-label--tiny">Buzz à côté</span>
                  <span className={`rfbil__value${monResultat.rates ? ' rfbil__value--rate' : ''}`}>{monResultat.rates}</span>
                </div>
                {/* CE QUE CHAQUE BUZZ VAUT, sous le compte qu'il concerne. Les deux
                    lignes rendent le calcul lisible sans l'expliquer : six trouvés
                    à +200, quatre à côté à −200, et le total juste en dessous.
                    LA VALEUR VIENT DU SERVEUR (`meta.points`) : la recopier ici
                    donnerait deux barèmes, et c'est l'écran qui aurait tort. */}
                {pointsRetour ? (
                  <>
                    <div className="rfbil__cell rfbil__cell--unite">
                      <span className="p-label p-label--tiny">Base réussite</span>
                      <span className="rfbil__value rfbil__value--bon">+{fmtNum(pointsRetour)}</span>
                    </div>
                    <div className="rfbil__cell rfbil__cell--unite">
                      <span className="p-label p-label--tiny">Base échec</span>
                      <span className="rfbil__value rfbil__value--rate">−{fmtNum(pointsRetour)}</span>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
            {/* Un solde négatif ne coûte rien, et il faut le DIRE là où le joueur
                regarde ses chiffres — pas seulement dans la phrase du haut. */}
            {isRetour && monResultat?.brut < 0 ? (
              <p className="join__hint" style={{ textAlign: 'center' }} data-testid="retour-filet">
                Ton score total ne baisse pas : au pire, une manche ne rapporte rien.
              </p>
            ) : null}

            {/* COUPE TA BÛCHE : ta coupe face à la proportion demandée. Comme au
                juste temps, la valeur affichée est celle que l'ARBITRE a retenue —
                pas celle que l'écran montrait au moment du doigt. */}
            {isBuche && monResultat?.valeur != null ? (
              <div className="est-compare">
                <div className="est-compare__cell">
                  <span className="p-label p-label--tiny">Ta coupe</span>
                  <span className="est-compare__value">{pourcent(monResultat.valeur)}</span>
                </div>
                <div className="est-compare__cell est-compare__cell--target" data-bind="reveal.target" data-testid="reveal-value">
                  <span className="p-label p-label--tiny" style={{ color: 'var(--c-pine)' }}>Proportion cible</span>
                  <span className="est-compare__value">{pourcent(rv.target)}</span>
                </div>
              </div>
            ) : null}

            {/* LE JUSTE TEMPS : ton chrono face au temps cible.
                LE TEMPS AFFICHÉ EST CELUI DU SERVEUR (`valeur`), jamais celui que
                l'écran montrait au moment du doigt. Les deux diffèrent d'un
                aller-retour réseau, et c'est le premier qui a compté les points :
                afficher le second ferait mentir le calcul juste au-dessus. */}
            {isJusteTemps && monResultat?.valeur != null ? (
              <div className="est-compare">
                <div className="est-compare__cell">
                  <span className="p-label p-label--tiny">Ton chrono</span>
                  <span className="est-compare__value">{secondes(monResultat.valeur)}</span>
                </div>
                <div className="est-compare__cell est-compare__cell--target" data-bind="reveal.target" data-testid="reveal-value">
                  <span className="p-label p-label--tiny" style={{ color: 'var(--c-pine)' }}>Temps cible</span>
                  <span className="est-compare__value">{secondes(rv.target)}</span>
                </div>
              </div>
            ) : null}

            {/* Le détail des points se lit en DEUX lignes, et elles disent la
                vérité. Avant, une case « Bonus vitesse » contenait aussi le bonus
                de série : un joueur en série de trois y lisait « +100 » sans avoir
                été rapide, pendant que la case « Série » affichait « ×3 » sans le
                moindre point en face. Plus de case « Malus » non plus : aucune
                pénalité n'existe dans aucun jeu.
                Chaque ligne ne s'affiche que si elle vaut quelque chose — un écran
                de résultat n'a pas à aligner des zéros. */}
            {/* LE TOTAL DE « RETOUR DE FLAMME » — à la place qu'occupait « Base ».
                Il vaut le SOLDE, négatif compris : c'est ce que le joueur a fait.
                La ligne « Points gagnés », plus haut, dit ce que son score
                encaisse — zéro quand le solde est négatif. Les deux nombres
                diffèrent, et c'est exactement ce qu'il faut montrer : sans le
                total, le zéro du haut serait incompréhensible. */}
            {isRetour && monResultat?.brut != null ? (
              <div className="breakdown">
                <div className="breakdown__cell">
                  <span className="p-label p-label--tiny">Total</span>
                  <span className={`breakdown__value${monResultat.brut < 0 ? ' breakdown__value--rate' : ''}`}
                    data-testid="retour-total">
                    {monResultat.brut > 0 ? `+${fmtNum(monResultat.brut)}` : fmtNum(monResultat.brut)}
                  </span>
                </div>
              </div>
            ) : null}

            {!isVote && !isRetour && (monResultat.base || monResultat.speed
              || monResultat.bonusExact || monResultat.bonusProche || monResultat.bonusGroupe) ? (
              <div className="breakdown">
                {monResultat.base ? (
                  <div className="breakdown__cell">
                    <span className="p-label p-label--tiny">
                      {parPaliers ? 'Palier' : isLien ? 'Mot partagé' : 'Base'}
                    </span>
                    <span className="breakdown__value" data-bind="you.base" data-testid="points-base">
                      {fmtNum(monResultat.base)}
                    </span>
                  </div>
                ) : null}
                {/* LES BONUS DE L'ESTIMATION, CHACUN SUR SA LIGNE.
                    Ils étaient additionnés dans « Base » : le joueur lisait
                    « 1 600 » sans savoir d'où venaient les six cents points de
                    plus, et le barème que le jeu venait de lui expliquer devenait
                    invérifiable. Le total n'a pas bougé — seule sa décomposition
                    apparaît. */}
                {monResultat.bonusExact ? (
                  <div className="breakdown__cell">
                    <span className="p-label p-label--tiny">Exactitude</span>
                    <span className="breakdown__value breakdown__value--accent"
                      data-bind="you.bonusExact" data-testid="points-bonus-exact">
                      +{fmtNum(monResultat.bonusExact)}
                    </span>
                  </div>
                ) : null}
                {monResultat.bonusGroupe ? (
                  <div className="breakdown__cell">
                    <span className="p-label p-label--tiny">
                      {monResultat.rang === 1 ? 'Groupe le plus nombreux' : `${monResultat.rang}e groupe`}
                    </span>
                    <span className="breakdown__value breakdown__value--accent"
                      data-bind="you.bonusGroupe" data-testid="points-bonus-groupe">
                      +{fmtNum(monResultat.bonusGroupe)}
                    </span>
                  </div>
                ) : null}
                {monResultat.bonusProche ? (
                  <div className="breakdown__cell">
                    <span className="p-label p-label--tiny">Le plus proche</span>
                    <span className="breakdown__value breakdown__value--accent"
                      data-bind="you.bonusProche" data-testid="points-bonus-proche">
                      +{fmtNum(monResultat.bonusProche)}
                    </span>
                  </div>
                ) : null}
                {monResultat.speed ? (
                  <div className="breakdown__cell">
                    <span className="p-label p-label--tiny">Complément de vitesse</span>
                    <span className="breakdown__value breakdown__value--accent"
                      data-bind="you.speed" data-testid="points-speed">+{fmtNum(monResultat.speed)}</span>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* LA SÉRIE EST UN MARQUEUR, PLUS UNE PHRASE (A1).
                « Remplacer la phrase des séries par #🔥 ». Sous le relevé de
                points, la ligne « 3 bonnes réponses d'affilée. » redisait en
                toutes lettres ce que le chiffre suffit à dire — et le redisait
                une deuxième fois, la voix citant déjà la série juste au-dessus.
                Le nombre et une flamme : le joueur lit son état d'un coup d'œil.

                PAS DE « # » DEVANT LE NOMBRE : « #3 » se lirait comme un RANG,
                dans un jeu qui en affiche partout.
                PAS D'EMOJI NON PLUS : la flamme est l'icône au trait du
                registre, `no_emoji: true` étant une règle dure du dépôt. Le
                sens de « 🔥 » est tenu, sa forme suit la convention. */}
            {!isVote && monResultat.streak >= 2 ? (
              <p className="streak" data-bind="you.streak" data-testid="streak-count">
                <span className="streak__n">{monResultat.streak}</span>
                <Icon name="flame" className="icon streak__flamme" />
                <span className="visually-hidden">
                  série de {monResultat.streak} bonnes réponses d'affilée
                </span>
              </p>
            ) : null}
          </>
        )}

        {/* Ton choix, quand il diffère de la bonne réponse. */}
        {hasData && correct === false && typeof myAnswer === 'number' && current?.options?.[myAnswer] != null ? (
          <div className="answer-reveal answer-reveal--mine">
            <span className="answer-reveal__badge" aria-hidden="true">{KEYS[myAnswer] || myAnswer + 1}</span>
            <div className="answer-reveal__body">
              <p className="answer-reveal__label">{deuxTours ? 'Ton pari' : 'Ton choix'}</p>
              <p className="answer-reveal__value">{current.options[myAnswer]}</p>
            </div>
          </div>
        ) : null}

        {/* Bonne réponse — affichée même quand le joueur a juste.
            PAS POUR LES JEUX À PALIERS : l'estimation et le juste temps ont déjà
            leur bloc de comparaison, qui met la réponse du joueur EN FACE de la
            cible. Ce bloc-ci la répéterait dix pixels plus bas — et sous
            l'étiquette « Bonne réponse », qui ne veut rien dire d'un temps. */}
        {answerLabel != null && !parPaliers ? (
          <div className={`answer-reveal${isVote ? ' answer-reveal--leading' : ''}`}
            data-bind={isVote ? 'reveal.leading' : 'reveal.correct'} data-testid="reveal-value">
            <span className="answer-reveal__badge" aria-hidden="true"
              style={isVote ? { background: 'var(--c-ember-wash)', color: 'var(--c-ember-bright)' } : { color: 'var(--c-ink-on-leaf)' }}>
              {isVote ? <Ico.up /> : <Ico.check s={17} w={3} />}
            </span>
            <div className="answer-reveal__body">
              {/* « EN TÊTE » DÉCRIVAIT L'ANCIENNE RÈGLE — un sondage dont on
                  regardait le vainqueur. Sur un vote à deux tours, ce bloc porte
                  la BONNE RÉPONSE : celle qu'on venait de demander au joueur de
                  deviner. L'appeler « en tête » la ferait passer pour une
                  information de contexte. Un sondage, lui, n'a pas de bonne
                  réponse et garde le mot juste. */}
              <p className="answer-reveal__label">
                {deuxTours ? 'La réponse du cercle' : isVote ? 'En tête' : 'Bonne réponse'}
              </p>
              <p className="answer-reveal__value">{answerLabel}</p>
            </div>
          </div>
        ) : null}

        <div className="screen__push">
          <p className="p-note" role="status" aria-live="polite">Prochaine épreuve…</p>
        </div>
      </div>
    </main>
  );
}

// ============================================================
// J5 — Fin de partie (SEUL écran où le rang apparaît)
// ============================================================
// Le canvas 2D ne comprend pas var(--…) : on résout les tokens sur le document,
// pour que l'image partagée suive la charte au lieu d'en figer une copie.
function token(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function drawScoreCard({ pseudo, rank, score }) {
  const W = 1080, H = 1920;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const canvasBg = token('--c-canvas', '#2b2118');
  const ink = token('--c-ink', '#f6ece0');
  const ink3 = token('--c-ink-3', '#b9ac9b');
  const ember = token('--c-ember-bright', '#f5a44f');
  const pine = token('--c-pine', '#9fdcb0');
  const fDisplay = token('--f-display', '"Avenir Next Condensed", Futura, sans-serif');
  const fUi = token('--f-ui', 'system-ui, sans-serif');

  // Fond + halo : le foyer de --g-hearth, transposé en dégradé radial.
  ctx.fillStyle = canvasBg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, H * 0.62, 60, W / 2, H * 0.62, 760);
  glow.addColorStop(0, `color-mix(in oklab, ${ember} 34%, transparent)`);
  glow.addColorStop(1, `color-mix(in oklab, ${ember} 0%, transparent)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = ink;
  ctx.font = `bold 64px ${fDisplay}`;
  // LE NOM VIENT DE LA MARQUE, il n'est pas recopié ici. Il l'était : la carte
  // que le joueur PARTAGE portait encore « PROJECT GAME SHOW » après le
  // changement de nom, alors que tout le reste de l'application était à jour.
  // C'est l'endroit qui sort du produit — celui qu'on relit le moins, et le seul
  // que des inconnus voient.
  ctx.fillText(NOM_DU_JEU.toLocaleUpperCase('fr-FR'), W / 2, 220);
  ctx.fillStyle = pine;
  ctx.font = `600 44px ${fUi}`;
  ctx.fillText('RÉSULTAT DE LA PARTIE', W / 2, 300);
  ctx.fillStyle = ember;
  ctx.font = `bold 88px ${fDisplay}`;
  ctx.fillText(String(pseudo || 'Joueur').slice(0, 20), W / 2, 560);
  if (rank != null) {
    ctx.fillStyle = ember;
    ctx.font = `900 420px ${fDisplay}`;
    ctx.fillText(`${rank}${rank === 1 ? 'ᵉʳ' : 'ᵉ'}`, W / 2, H * 0.55 + 140);
  }
  ctx.fillStyle = ink;
  ctx.font = `bold 96px ${fUi}`;
  ctx.fillText(`${Number(score || 0).toLocaleString('fr-FR')} pts`, W / 2, H * 0.72);
  ctx.fillStyle = ink3;
  ctx.font = `48px ${fUi}`;
  ctx.fillText(window.location.host, W / 2, H - 160);
  return new Promise((resolve) => c.toBlob(resolve, 'image/png'));
}

// Libellé de la bonne réponse d'une manche du récapitulatif.
function historyAnswer(h) {
  const rv = h.reveal || {};
  if (h.type === 'true_false') return rv.correct ? 'Vrai' : 'Faux';
  if (h.type === 'estimation') return rv.target != null ? fmtNum(rv.target) : null;
  if (h.type === 'juste_temps') return rv.target != null ? secondes(rv.target) : null;
  if (h.type === 'coupe_buche') return rv.target != null ? pourcent(rv.target) : null;
  if (h.type === 'retour_flamme') {
    return Array.isArray(rv.retours) ? `retours aux images ${rv.retours.join(', ')}` : null;
  }
  if (h.type === 'quiz') {
    if (Array.isArray(h.options) && rv.correctIndex != null && h.options[rv.correctIndex] != null) return h.options[rv.correctIndex];
    return rv.correctIndex != null ? `Réponse ${KEYS[rv.correctIndex] || rv.correctIndex + 1}` : null;
  }
  if (h.type === 'vote' && Array.isArray(rv.tally) && Array.isArray(h.options) && rv.tally.length) {
    let best = 0;
    for (let i = 1; i < rv.tally.length; i += 1) if (rv.tally[i] > rv.tally[best]) best = i;
    return `${h.options[best]} (vote du public)`;
  }
  return null;
}

function EndScreen({ you, podium, classement, playerId, pseudo, history, roomCode }) {
  const rank = you?.rank;

  // LE CLASSEMENT COMPLET, ET NON LE PODIUM (chantier v4, décisions 2.1 et 2.2).
  //
  // CE QUI ÉTAIT FAUX. La condition d'affichage examinait `podium`, qui ne
  // contient que les TROIS PREMIERS. Si ces trois-là étaient à zéro — ce qui
  // arrive dès que chacun se trompe, une mauvaise réponse ne coûtant plus rien
  // depuis T1 — le classement disparaissait POUR TOUT LE MONDE, et le bouton de
  // partage avec lui, puisqu'il y était adossé.
  //
  // La donnée était pourtant déjà là : le serveur diffuse le classement complet à
  // tout le salon en fin de partie. Il ne manquait que de le regarder.
  const rangs = (classement && classement.length ? classement : podium) || [];
  // DÉCISION 2.3 — une partie où personne n'a marqué a quand même un classement :
  // tout le monde à égalité, à zéro. C'est précisément ce que demandait le joueur
  // arrivé en cours de route : se voir dans la liste, même sans point.
  const ranked = rank != null;
  const aMarque = rangs.some((p) => (p.score || 0) > 0);
  const [shared, setShared] = useState(false);
  const [showRecap, setShowRecap] = useState(false);

  // LA VOIX DE LA FIN DE PARTIE.
  //
  // Trois moments — `fin.podium`, `fin.classe`, `fin.dernier` — vivaient dans le
  // registre depuis l'origine, avec leurs douze phrases, et AUCUN code ne les
  // atteignait : l'écran de fin était le seul du parcours à se taire. Le relevé
  // du registre l'a montré, la question de l'auteur l'a provoqué.
  //
  // Les trois cas sont exclusifs et se lisent dans cet ordre : le podium d'abord,
  // puis le dernier ou le joueur sans point, puis tous les autres. « Dernier » et
  // « sans point » partagent le même moment parce qu'ils partagent la même
  // situation — on n'a rien à célébrer, et le registre ne punit jamais.
  const dernier = ranked && rangs.length > 1 && rank === rangs.length;
  const momentFin = !ranked ? null
    : (rank <= 3 && aMarque) ? 'fin.podium'
      : (dernier || !((you?.score || 0) > 0)) ? 'fin.dernier'
        : 'fin.classe';
  // `{rang}` — la valeur était là depuis toujours, sous le nom `rank`, et n'a
  // jamais été passée : `fin.podium` et `fin.classe` la déclarent pourtant en
  // `requiert`. Sept phrases sur huit affichaient l'accolade en clair à tout
  // joueur classé, à chaque fin de partie (A6).
  //
  // FORME RETENUE : « 1er », « 2e », « 3e ». Elle n'est pas choisie dans
  // l'abstrait : c'est CELLE QUE L'ÉCRAN AFFICHE DÉJÀ dix lignes plus bas, sous
  // « Ton rang final ». Une seconde notation — « N° 2 » — se serait retrouvée
  // à côté d'un « 2e » disant la même chose, dans le même bloc.
  const phraseFin = usePhraseDeManche(momentFin, momentFin, {
    rang: rank != null ? `${rank}${rank === 1 ? 'er' : 'e'}` : undefined,
  });

  const share = async () => {
    // DÉCISION 3.2 — sans classement, on ne partage pas un rang absent : on dit ce
    // qui reste vrai, le salon et le nombre d'épreuves. « J'ai terminé la partie
    // avec 0 pts » n'a aucun intérêt ; « j'ai joué huit épreuves » en a un.
    const epreuves = Array.isArray(history) ? history.filter((h) => h && h.text).length : 0;
    const text = (aMarque && rank != null)
      ? `J'ai terminé ${rank}${rank === 1 ? 're' : 'e'} place avec ${fmtNum(you?.score)} pts sur ${NOM_DU_JEU} !`
      : `J'ai joué ${epreuves} épreuve${epreuves > 1 ? 's' : ''} autour du feu sur ${NOM_DU_JEU} !`;
    const url = typeof window !== 'undefined' ? window.location.origin : '';
    try {
      if (navigator.share) {
        let filesPayload = null;
        try {
          const blob = await drawScoreCard({ pseudo, rank, score: you?.score });
          if (blob) {
            const file = new File([blob], 'mon-score.png', { type: 'image/png' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) filesPayload = [file];
          }
        } catch { /* canvas indisponible : repli texte */ }
        await navigator.share(filesPayload
          ? { title: NOM_DU_JEU, text, files: filesPayload }
          : { title: NOM_DU_JEU, text, url });
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setShared(true);
        setTimeout(() => setShared(false), 1800);
      }
    } catch { /* partage annulé */ }
  };

  const recap = Array.isArray(history) ? history.filter((h) => h && h.text) : [];

  return (
    <main className="screen screen--hearth" data-testid="end-screen"
      data-state={`ranked${ranked ? '' : ' empty'}`} aria-labelledby="end-title">
      <div className="screen__main screen__main--center">
        <div className="p-brand">
          <span className="p-brand__mark" aria-hidden="true"><Ico.flame s={22} ember /></span>
          <p className="p-label">Partie terminée</p>
        </div>

        <h1 className="p-title" id="end-title">
          {/* DÉCISION 2.4 — le titre annonçait « Victoire » à un joueur à zéro point,
              trois lignes au-dessus de « personne n'a marqué ». Une contradiction sur
              le même écran, que la décision 8 de l'action 7 du chantier v1 interdit. */}
          {rank === 1 && aMarque ? 'Victoire'
            : ranked && rank <= 3 && aMarque ? 'Sur le podium'
            : 'C’est fini'}
        </h1>

        {ranked ? (
          <div className="final" data-testid="final-rank">
            <p className="p-label">Ton rang final</p>
            <p className="final__rank" data-bind="you.rank">
              {rank}<sup>{rank === 1 ? 'er' : 'e'}</sup>
            </p>
            <span className="p-cap">
              <span className="p-cap__label">Points</span>
              <span className="final__score" data-bind="you.score">{fmtNum(you?.score)}</span>
            </span>
          </div>
        ) : null}
        {ranked && !aMarque ? (
          <p className="p-lead">Personne n'a marqué cette fois. Le classement reste, à égalité.</p>
        ) : null}
        {/* La voix de la fin de partie. L'écran était le seul du parcours à se
            taire — ses trois moments existaient sans être appelés. */}
        {phraseFin ? (
          <p className="p-lead voix" data-testid="voix-fin">{phraseFin}</p>
        ) : null}

        {/* DÉCISION 2.1 — le classement, sa propre ligne distinguée. Avant, l'écran
            n'affichait qu'un chiffre : « Ton rang final : 4ᵉ ». Personne ne pouvait
            « se voir sur le classement » depuis son téléphone, ni le retardataire ni
            les autres.
            DÉCISION 2.5 — la liste est ENTIÈRE, pas tronquée à cinq : un joueur arrivé
            en cours de route est souvent loin, et c'est lui qui a demandé à s'y voir.
            DÉCISION 2.7 — elle défile dans son bloc, jamais la page. */}
        {rangs.length ? (
          <div className="board board--defile" data-bind="leaderboard" data-testid="classement-final">
            {rangs.map((entry, i) => {
              const r = entry.rank != null ? entry.rank : i + 1;
              const me = playerId != null && entry.id === playerId;
              return (
                <div className={`board__row${me ? ' board__row--me' : ''}`} key={entry.id || i}>
                  <span className="board__rank">{r}</span>
                  <span className="board__name">{me ? 'Toi' : (entry.pseudo || '—')}</span>
                  <span className="board__score">{fmtNum(entry.score)}</span>
                </div>
              );
            })}
          </div>
        ) : null}

        {recap.length > 0 ? (
          <div className="recap" data-bind="history">
            <button className="recap__toggle" type="button" aria-expanded={showRecap}
              onClick={() => setShowRecap((v) => !v)}>
              <Ico.chevron s={18} open={showRecap} />
              Revoir les questions ({recap.length})
            </button>
            {showRecap ? (
              <ol className="recap__list">
                {recap.map((h, i) => {
                  const ans = historyAnswer(h);
                  return (
                    <li className="recap__item" key={i}>
                      <span className="recap__q">{h.text}</span>
                      {ans != null ? <span className="recap__a">{ans}</span> : null}
                    </li>
                  );
                })}
              </ol>
            ) : null}
          </div>
        ) : null}

        <div className="screen__push" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {/* DÉCISION 10.1 du chantier v4 — UNE SEULE PHRASE. Deux rédactions
              concurrentes du même message se suivaient à dix-sept lignes d'intervalle
              sur cet écran, nées de deux ajouts successifs qui ne se sont pas vus.
              Celle-ci garde les deux apports : le CODE DU SALON, qui dit où l'on est,
              et « sans rien faire », qui évite de chercher un bouton. */}
          <p className="p-note" role="status" data-bind="end.replayHint">
            Reste là — si l'animateur relance une partie{roomCode ? <> dans le salon <strong>{roomCode}</strong></> : null},
            tu y seras ramené sans rien faire.
          </p>
          {/* DÉCISION 3.1 — le bouton était conditionné au classement. Quand celui-ci
              disparaissait — trois premiers à zéro, ou rang non reçu après une
              reconnexion — le partage disparaissait avec lui, chez certains joueurs
              et pas chez d'autres. Il n'a rien à voir avec le fait d'avoir gagné :
              « les joueurs sont libres de faire ce qu'ils veulent ». */}
          <button className="p-btn p-btn--primary" type="button" data-action="share" onClick={share}>
            {shared ? 'Copié !' : 'Partager ma partie'}
          </button>
        </div>
        {/* Plus de bouton « Rejouer » : il effaçait la session locale sans prévenir
            le serveur, si bien que le joueur perdait son identité et se voyait
            refuser son propre pseudo s'il tentait de revenir. Le bouton qui
            promettait de rejouer était celui qui l'en empêchait.
            Rien à cliquer : quand l'animateur relance, le serveur ramène tout le
            monde au salon d'attente. */}
      </div>
    </main>
  );
}

// ============================================================
// RETROUVER LA SESSION AU CHARGEMENT (chantier v4, décisions 1.1 et 1.2).
//
// CE QUI ÉTAIT FAUX. La session est enregistrée sous `play:<CODE>`, et la
// restauration lisait ce code DANS L'URL. Or l'inscription ne l'y écrivait
// jamais — elle le posait dans l'état React. Le défaut dépendait donc du chemin
// d'entrée : par le QR du stream, l'URL portait `?code=`, et le rechargement
// restaurait ; en tapant le code au formulaire — ce que fait quiconque lit le
// code à l'antenne — l'URL restait `/`, et le rechargement ÉJECTAIT.
//
// La suite s'enchaînait toute seule : le joueur retapait son pseudo, le serveur
// le refusait parce que sa propre inscription était encore dans le salon, il en
// inventait un autre, devenait un nouveau joueur à zéro point, et perdait du même
// coup ses écrans de résultats et sa place au podium. Quatre symptômes rapportés
// en réunion, un seul défaut.
function sessionInitiale(urlCode) {
  if (urlCode) return { code: urlCode, session: store.load('play:' + urlCode) };

  // REPLI (décision 1.2) — l'URL ne dit rien, mais le stockage peut savoir. On ne
  // reprend QUE s'il n'y a aucune ambiguïté : deux salons rejoints depuis le même
  // navigateur, et l'on ne devine pas lequel reprendre.
  const cles = store.cles('play:');
  if (cles.length !== 1) return { code: '', session: null };
  return { code: cles[0].slice('play:'.length), session: store.load(cles[0]) };
}

// Le code vit désormais DANS L'URL, comme celle que produit le QR du stream.
// `replaceState` et non `pushState` : rejoindre n'est pas une navigation, et une
// entrée d'historique de plus ferait sortir du jeu au premier geste « retour ».
function poserCodeDansUrl(code) {
  if (typeof history === 'undefined' || !code) return;
  try {
    const u = new URL(location.href);
    if (u.searchParams.get('code') === code) return;
    u.searchParams.set('code', code);
    history.replaceState(null, '', u);
  } catch { /* navigateur sans History : la session tient par le repli ci-dessus */ }
}

export function PlayApp() {
  const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
  const urlCode = (params.get('code') || '').trim();
  const reprise = sessionInitiale(urlCode);
  const stored = reprise.session;

  const [code, setCode] = useState(reprise.code);
  const [pseudo, setPseudo] = useState(stored?.pseudo || '');
  const [playerId, setPlayerId] = useState(stored?.playerId || null);
  const [playerToken, setPlayerToken] = useState(stored?.playerToken || null);
  const [myAnswer, setMyAnswer] = useState(null);
  const [notice, setNotice] = useState(null);

  const g = useGame(playerToken);

  // Salon fermé par l'animateur : retour à « rejoindre », en DISANT pourquoi.
  useEffect(() => {
    if (!g.roomClosed) return;
    if (code) store.clear('play:' + code);
    setPlayerToken(null);
    setPlayerId(null);
    setMyAnswer(null);
    setNotice("L'animateur a fermé le salon. Tu peux rejoindre une autre partie.");
  }, [g.roomClosed, code]);

  // Salon disparu (serveur redéployé, partie expirée) : purge de la session périmée.
  useEffect(() => {
    if (!g.fatal || !playerToken) return;
    if (code) store.clear('play:' + code);
    setPlayerToken(null);
    setPlayerId(null);
    setMyAnswer(null);
    setNotice("Ce salon n'existe plus — il a peut-être expiré. Demande un nouveau code à l'animateur.");
  }, [g.fatal, playerToken, code]);

  // RÉINITIALISE LA SÉLECTION LOCALE À CHAQUE FENÊTRE DE RÉPONSE — et non à
  // chaque manche.
  //
  // LA NUANCE N'EN ÉTAIT PAS UNE JUSQU'ICI : une manche, une fenêtre. « Vote »
  // en compte deux, et le repère employé — l'index de progression, qui ne bouge
  // pas entre les tours — laissait la réponse du premier tour COCHÉE au second.
  // Vu à l'écran : le joueur arrivait sur « Que pense le cercle ? » avec « Thé »
  // déjà sélectionné en vert, et pouvait croire qu'il avait déjà répondu.
  //
  // Le repère est donc l'identité de la fenêtre : la manche ET son tour.
  const roundKey = g.current ? `${g.current.roundId}#${g.current.tour ?? 1}` : null;
  const prevRound = useRef(roundKey);
  useEffect(() => {
    if (prevRound.current !== roundKey) {
      prevRound.current = roundKey;
      setMyAnswer(null);
    }
  }, [roundKey]);

  async function handleJoin(joinCode, joinPseudo) {
    const r = await joinRoom(joinCode, joinPseudo);
    store.save('play:' + joinCode, r);
    // DÉCISION 1.1 — sans cette ligne, un rechargement éjecte le joueur.
    poserCodeDansUrl(joinCode);
    setCode(joinCode);
    setPseudo(r.pseudo || joinPseudo);
    setPlayerId(r.playerId || null);
    setPlayerToken(r.playerToken);
    setNotice(null);
  }

  function handleAnswer(value) {
    setMyAnswer(value);
    g.emit('play:answer', { value });
  }

  // LE CHOIX DU JOUEUR SURVIT AU RECHARGEMENT.
  //
  // `myAnswer` ne vit qu'en mémoire : un rechargement l'efface, et l'écran de
  // résultat — qui déduit le verdict en comparant ce choix à la bonne réponse —
  // n'avait plus de quoi conclure. Le serveur le rejoue désormais à la
  // reconnexion ; on le reprend ici, sans jamais écraser un choix fait dans cette
  // page (la valeur locale est la plus fraîche des deux).
  const choixRejoue = g.monChoix;
  useEffect(() => {
    if (choixRejoue == null) return;
    setMyAnswer((actuel) => (actuel == null ? choixRejoue : actuel));
  }, [choixRejoue]);

  if (!playerToken) {
    return <JoinScreen initialCode={urlCode} onJoin={handleJoin} notice={notice} />;
  }

  // Session présente mais état du salon pas encore reçu : loader de marque.
  if (!g.room) return <BrandLoader />;

  const room = g.room;
  const roomCode = room?.code || code;
  const displayPseudo = g.you?.pseudo || pseudo;

  // PLUS DE BOUTON « QUITTER ». Il n'effaçait que la session LOCALE sans prévenir
  // le serveur : le joueur restait inscrit dans le salon avec son pseudo et son
  // score, mais perdait le jeton qui lui permettait d'y revenir. Rejoindre avec le
  // même pseudo lui était alors refusé — par lui-même.
  // Et il n'avait aucun usage légitime : la session est rattachée à UN salon, donc
  // rejoindre une autre partie ne demande pas de quitter la première ; fermer
  // l'onglet suffit ; une session périmée est purgée toute seule.

  // Repli si play:you n'a pas (encore) été reçu — typiquement après un rechargement.
  const deriveYou = (rows) => {
    if (!playerId || !Array.isArray(rows)) return null;
    const idx = rows.findIndex((r) => (r.id || r.playerId) === playerId);
    if (idx < 0) return null;
    const r = rows[idx];
    return { rank: r.rank != null ? r.rank : idx + 1, score: r.score };
  };
  const podiumRows = g.podium || g.leaderboard;
  const effectiveYou = g.you || deriveYou(g.leaderboard) || deriveYou(g.podium);

  // Fin de partie.
  if (g.podium || room?.state === 'ended') {
    return (
      <>
        <EndScreen you={effectiveYou} podium={podiumRows} classement={g.leaderboard}
          playerId={playerId} pseudo={displayPseudo} history={g.history} roomCode={roomCode} />
      </>
    );
  }

  // Résultat d'une manche révélée.
  //
  // ON N'Y VA QUE S'IL Y A QUELQUE CHOSE À MONTRER : soit le résultat personnel
  // du joueur, soit le fait qu'il n'a pas répondu. Sinon — révélation reçue mais
  // résultat personnel encore en route — il RESTE SUR SA QUESTION, avec sa
  // réponse cochée. C'est vrai, et jamais trompeur.
  //
  // La page « Ta réponse est bien partie » qui occupait cet intervalle a été
  // retirée sur arbitrage de l'auteur : elle n'apprenait rien, et elle a servi de
  // symptôme à deux défauts distincts avant d'être elle-même mise en cause.
  const monResultatPret = g.you && g.current?.roundId != null && g.you.roundId === g.current.roundId;
  if (g.reveal && (monResultatPret || g.answered === false)) {
    return (
      <>
        <ScoreScreen you={g.you} reveal={g.reveal} myAnswer={myAnswer} current={g.current}
          index={room?.progression?.index} total={room?.progression?.total}
          answered={g.answered} presentAuLancement={g.presentAuLancement} />
      </>
    );
  }

  // L'ANNONCE d'un jeu qui n'a pas encore démarré — le jingle du « Lien ».
  if (g.annonce && !g.current) {
    return <AnnonceScreen nom={g.annonce.name} type={g.annonce.type} annonce={g.annonce} />;
  }

  // Question en cours (pas de bouton Quitter : l'écran reste focalisé sur la réponse).
  if (g.current && room?.state !== 'waiting') {
    return (
      <QuestionScreen
        current={g.current}
        tick={g.tick}
        score={g.you?.score || 0}
        answered={g.answered === true}
        myAnswer={myAnswer}
        onAnswer={handleAnswer}
        element={g.element}
        buzz={g.buzz}
      />
    );
  }

  // Attente du lancement.
  return (
    <>
      <WaitScreen pseudo={displayPseudo} code={roomCode} playerCount={room?.playerCount} />
    </>
  );
}
