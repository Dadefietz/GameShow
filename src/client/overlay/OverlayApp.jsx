// Surface STREAM (`/overlay`) — scène diffusée en source navigateur OBS.
// Seule source à ajouter dans OBS : les trois overlays transparents historiques
// (/overlay/question, /leaderboard, /podium) sont abandonnés depuis le 2026-08-18.
//
// Design : extraction Claude Design — S1 panneau de connexion permanent,
// S2 attente, S3 question + révélation, S4 podium.
// Deux règles de contrat tenues ici :
//   1. QR + lien + code du salon restent affichés EN PERMANENCE, quelle que soit
//      la phase de jeu (panneau de droite) ;
//   2. à la révélation, le stream montre la RÉPARTITION des réponses — jamais
//      les points ni les places d'un joueur.
// Le token vient de la query (?token=...). Aucun bouton, aucune interaction.
import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useGame } from '../shared/useGame.js';
import { dire, momentDePlateau } from '../shared/voix.js';
import './overlay.css';

const nf = new Intl.NumberFormat('fr-FR');
const fmt = (n) => (typeof n === 'number' && Number.isFinite(n) ? nf.format(n) : '—');
const KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

// Marque animée du système : flamme qui respire, braise qui scintille.
function BrandMark({ size = 37, ember = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
  );
}

function PeopleIcon({ size = 52, stroke = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke}
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19.5c0-3 2.5-4.8 5.5-4.8s5.5 1.8 5.5 4.8" />
      <path d="M16 6.2a3 3 0 010 5.4" />
      <path d="M17.5 15c2 .5 3.2 2 3.2 4.5" />
    </svg>
  );
}

function CheckIcon({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--c-ink-on-leaf)"
      strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.6 4.5L19 7.5" />
    </svg>
  );
}

// ============================================================
// S1 — Panneau de connexion, PERMANENT sur toutes les phases
// ============================================================


// La PASTILLE pour rejoindre — QR, code, adresse — remplace le panneau latéral
// de 460 px qui occupait un quart de l'écran en permanence.
//
// TAILLE DU QR : 180 px, et pas moins. Un QR n'a pas une taille esthétique mais
// FONCTIONNELLE — un téléphone le lit jusqu'à environ dix fois son côté physique.
// À 180 px sur un canevas de 1920, il fait ~5 cm sur un écran d'ordinateur, donc
// lisible à distance de bureau. Le réduire de moitié le rendrait décoratif : les
// gens n'arriveraient pas à le scanner et n'en diraient rien, ils abandonneraient.
// Le gain de discrétion ne vient donc pas du QR mais de la disparition du panneau.
//
// L'ADRESSE ET LE CODE comptent autant que le QR : un spectateur qui regarde le
// stream SUR SON TÉLÉPHONE ne peut pas le scanner avec ce même téléphone.
function PastilleRejoindre({ code, podium }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const joinUrl = `${origin}/play?code=${code || ''}`;
  const lienAffiche = `${origin.replace(/^https?:\/\//, '')}/play`;
  const [qr, setQr] = useState('');

  useEffect(() => {
    let alive = true;
    if (!code || podium) { setQr(''); return undefined; }
    QRCode.toDataURL(joinUrl, { margin: 1, width: 520 })
      .then((url) => { if (alive) setQr(url); })
      .catch(() => { if (alive) setQr(''); });
    return () => { alive = false; };
  }, [code, joinUrl, podium]);

  // AU PODIUM : une seule ligne, discrète. Le QR partirait sinon avec le moyen de
  // revenir, alors que le salon reste ouvert cinq minutes pour une relance.
  if (podium) {
    return (
      <aside className="rejoindre rejoindre--mince" data-state="podium" aria-label="Rejoindre la partie">
        <p className="rejoindre__ligne">
          <span className="rejoindre__lien">{lienAffiche}</span>
          <span className="rejoindre__sep" aria-hidden="true">·</span>
          <span className="rejoindre__code" data-bind="room.code" data-testid="stream-room-code">{code || '—'}</span>
        </p>
      </aside>
    );
  }

  return (
    <aside className="rejoindre" data-state="always" aria-label="Rejoindre la partie">
      {qr ? (
        <img className="rejoindre__qr" data-bind="room.qr" data-testid="stream-qr" src={qr}
          alt={`QR code pour rejoindre le salon ${code || ''}`} />
      ) : (
        <span className="rejoindre__qr rejoindre__qr--vide" aria-hidden="true" />
      )}
      <p className="rejoindre__code" data-bind="room.code" data-testid="stream-room-code">{code || '—'}</p>
      <p className="rejoindre__lien" data-bind="room.joinUrl">{lienAffiche}</p>
    </aside>
  );
}

// ============================================================
// S2 — Attente : avant le premier joueur, avec joueurs, entre deux manches
// ============================================================
function WaitingStage({ g }) {
  const count = g.room?.playerCount || 0;
  const prog = g.room?.progression;
  const between = (prog?.index || 0) > 0; // au moins une épreuve déjà jouée
  const empty = count === 0;

  return (
    <div className="stream__stage stream__stage--centered"
      data-state={`waiting${empty ? ' empty' : ''}${between ? ' between' : ''}`}>
      <div className="st-caps">
        <span className="st-cap st-cap--live">
          <span className="st-cap__dot" aria-hidden="true" />
          <span className="st-cap__label st-cap__label--live">
            {between ? 'Manche terminée' : empty ? 'Salon ouvert' : "Salle d'attente"}
          </span>
        </span>
        {between && prog?.index ? (
          <span className="st-cap">
            <span className="st-cap__label">Épreuve</span>
            <span className="st-cap__value">
              <span data-bind="module.index">{prog.index}</span>
              {prog.total > prog.index ? (
                <><span className="st-cap__value-dim">/</span>
                <span className="st-cap__value-dim" data-bind="module.total">{prog.total}</span></>
              ) : null}
            </span>
          </span>
        ) : null}
      </div>

      <h2 className="st-title" data-bind="stream.tagline">
        {between ? 'La suite arrive' : empty ? 'Sois le premier autour du feu' : 'Prends ton téléphone et rejoins le feu'}
      </h2>

      {between ? (
        <p className="st-lead">Tu peux encore rejoindre : tu joues à partir de la prochaine question.</p>
      ) : null}

      <div className="st-count">
        {empty ? (
          <span className="st-count__dots" aria-hidden="true">
            <span className="st-count__dot" /><span className="st-count__dot" /><span className="st-count__dot" />
          </span>
        ) : (
          <span className="st-count__badge" aria-hidden="true"><PeopleIcon /></span>
        )}
        <span className="st-count__figures">
          <span className={`st-count__value${empty ? ' st-count__value--empty' : ''}`}
            data-bind="room.playerCount" data-testid="player-count" key={count}>
            {fmt(count)}
          </span>
          <span className="st-count__label">
            {empty ? "joueur pour l'instant" : count > 1 ? 'joueurs connectés' : 'joueur connecté'}
          </span>
        </span>
      </div>
    </div>
  );
}

// ============================================================
// S3 — Question en cours, puis révélation avec répartition
// ============================================================

// Libellé de la bonne réponse selon le module.
function revealText(reveal, current) {
  if (!reveal) return null;
  switch (reveal.type) {
    case 'quiz': {
      const opts = reveal.options || current?.options;
      if (Array.isArray(opts) && reveal.correctIndex in opts) return opts[reveal.correctIndex];
      return null;
    }
    case 'true_false': return reveal.correct ? 'Vrai' : 'Faux';
    case 'estimation': return fmt(reveal.target);
    default: return null; // vote : pas de bonne réponse, la répartition parle
  }
}

// Dispersion des estimations, en 8 tranches — la tranche qui contient la bonne
// réponse est mise en couleur. Les hauteurs sont relatives à la tranche la plus
// fournie : un histogramme montre une FORME, pas des parts d'un total.
function StreamHistogram({ histo, total }) {
  if (!histo || !total) return null;
  const haut = Math.max(1, ...histo.counts);
  return (
    <div className="st-histo" data-bind="reveal.stats.histogramme" data-testid="stream-histogramme">
      <div className="st-histo__plot">
        {histo.counts.map((c, i) => (
          <span key={i}
            className={`st-histo__bar${i === histo.cibleIndex ? ' st-histo__bar--cible' : ''}`}
            style={{ height: `${Math.round((c / haut) * 100)}%`, animationDelay: `${i * 40}ms` }}
            data-count={c} />
        ))}
      </div>
      <p className="st-histo__legend">Dispersion des {fmt(total)} estimation{total > 1 ? 's' : ''}</p>
    </div>
  );
}

// Répartition par options (quiz, vrai/faux, vote) : une rangée par choix,
// barre de remplissage proportionnelle, décompte à droite.
function OptionBreakdown({ stats, correctIndex, leadingIndexes = [] }) {
  const total = Math.max(stats.total || 0, 1);
  return (
    <>
      {(stats.options || []).map((opt, i) => {
        const count = stats.tally?.[i] || 0;
        const pct = Math.round((count / total) * 100);
        const isCorrect = correctIndex === i;
        const isLeading = leadingIndexes.includes(i);
        return (
          <div key={i}
            className={`st-opt${isCorrect ? ' st-opt--correct' : ''}${isLeading ? ' st-opt--leading' : ''}`}
            data-state={isCorrect ? 'correct' : isLeading ? 'leading' : 'idle'}
            {...(isCorrect ? { 'data-bind': 'reveal.correct', 'data-testid': 'reveal-value' } : {})}
            style={{ '--om-to': `${pct}%`, animationDelay: `${i * 40}ms` }}>
            <span className="st-opt__fill" style={{ width: `${pct}%` }} aria-hidden="true" />
            <span className="st-opt__key" aria-hidden="true">
              {isCorrect ? <CheckIcon /> : KEYS[i] || i + 1}
            </span>
            <span className="st-opt__label">{opt}</span>
            <span className="st-opt__count">{count} · {pct}%</span>
          </div>
        );
      })}
    </>
  );
}

function QuestionStage({ g }) {
  const current = g.current || {};
  const reveal = g.reveal;
  const revealed = !!reveal;
  const timeLeft = g.tick?.timeLeft;
  const answers = revealed ? (reveal.stats?.total ?? 0) : (g.tick?.answers ?? 0);
  const prog = g.room?.progression;
  const meta = current.meta;
  const urgent = !revealed && typeof timeLeft === 'number' && timeLeft > 0 && timeLeft <= 5;
  const over = !revealed && timeLeft === 0;
  const options = Array.isArray(current.options) ? current.options : [];
  const stats = reveal?.stats;
  const voix = useVoixDePlateau(revealed ? reveal : null, stats, g.current?.roundId);
  const answer = revealText(reveal, current);

  // Option(s) gagnante(s) d'un vote. Le serveur les DÉSIGNE désormais (action 18) :
  // faire partie de la majorité rapporte des points, et une égalité parfaite fait
  // deux camps gagnants — que le client ne saurait pas deviner en prenant « la
  // plus haute », qui n'en retiendrait qu'une. Le repli sur le calcul local sert
  // les sondages non notés, où personne ne gagne mais où l'on montre qui mène.
  let leadingIndexes = [];
  if (revealed && reveal.type === 'vote' && Array.isArray(stats?.tally)) {
    if (Array.isArray(reveal.winners) && reveal.winners.length) {
      leadingIndexes = reveal.winners; // égalité comprise : deux camps gagnants
    } else {
      const meilleur = Math.max(0, ...stats.tally);
      leadingIndexes = meilleur > 0
        ? stats.tally.map((v, i) => (v === meilleur ? i : -1)).filter((i) => i >= 0)
        : [];
    }
  }

  // Progression de séance : où en est-on dans la liste des épreuves.
  const progPct = prog?.index && prog?.total
    ? Math.min(100, Math.round((prog.index / prog.total) * 100))
    : null;

  // Jauge du chrono : le temps restant se lit à la forme de l'anneau, pas
  // seulement au chiffre — un état doit rester lisible sans la couleur.
  const dureeSec = current.durationMs ? current.durationMs / 1000 : null;
  const ringPct = dureeSec && typeof timeLeft === 'number'
    ? Math.max(0, Math.min(100, Math.round((timeLeft / dureeSec) * 100)))
    : null;

  // État du stage avec variantes selon le type de révélation
  const revealedState = revealed ? (() => {
    const typeMap = { true_false: 'boolean', estimation: 'numeric', vote: 'vote' };
    const typeSuffix = typeMap[reveal.type] || '';
    return typeSuffix ? `revealed ${typeSuffix}` : 'revealed';
  })() : (urgent ? 'live urgent' : 'live');

  return (
    <div className="stream__stage" data-testid="stream-question" data-state={revealedState}>
      {/* Bandeau de manche : capsules et progression de séance à gauche, jauge
          de chrono à droite. La manche close ne garde que les capsules — plus
          rien ne court, donc ni jauge ni barre. */}
      <div className="st-band">
        <div className="st-band__col">
          <div className="st-caps">
            <span className="st-cap st-cap--live">
              <span className="st-cap__dot st-cap__dot--still" aria-hidden="true" />
              <span className="st-cap__label st-cap__label--live">{meta?.name || 'Épreuve'}</span>
            </span>
            {prog?.index ? (
              <span className="st-cap">
                <span className="st-cap__label">Épreuve</span>
                <span className="st-cap__value">
                  <span data-bind="module.index">{prog.index}</span>
                  {prog.total > prog.index ? (
                    <><span className="st-cap__value-dim">/</span>
                    <span className="st-cap__value-dim" data-bind="module.total">{prog.total}</span></>
                  ) : null}
                </span>
              </span>
            ) : null}
            <span className="st-cap">
              <span className="st-cap__icon" aria-hidden="true"><PeopleIcon size={28} stroke="var(--c-ink-3)" /></span>
              <span className="st-cap__value" data-bind="reveal.stats.total" data-testid="answers-count">
                {fmt(answers)}
              </span>
            </span>
            {revealed ? (
              <span className="st-cap st-cap--closed">
                <span className="st-cap__label st-cap__label--muted">Manche close</span>
              </span>
            ) : null}
          </div>

          {!revealed && progPct != null ? (
            <div className="st-progress">
              <span className="st-progress__fill" data-bind="room.progression"
                style={{ '--om-to': `${progPct}%`, width: `${progPct}%` }} />
            </div>
          ) : null}
        </div>

        {!revealed ? (
          <div className={`st-chrono${urgent ? ' st-chrono--urgent' : ''}${over ? ' st-chrono--over' : ''}`}
            role="timer" aria-label={`Temps restant ${timeLeft ?? 0} secondes`}
            style={ringPct != null ? { '--om-ring': `${ringPct}%` } : undefined}>
            <span className="st-chrono__disc">
              <span className="st-chrono__value" data-bind="tick.timeLeft">
                {typeof timeLeft === 'number' ? timeLeft : '—'}
              </span>
            </span>
          </div>
        ) : null}
      </div>

      {/* Repère stable : le contrat réserve `question-text` à la surface joueur et
          `stream-question` au stream — le mockup utilisait le premier des deux. */}
      <p className={`st-question${revealed ? ' st-question--revealed' : ''}`}
        data-bind="module.text" data-testid="question-text">
        {current.text || ''}
      </p>

      {/* Question en cours : les options, nues. */}
      {!revealed ? (
        options.length > 0 ? (
          <div className="st-options" data-bind="module.options">
            {options.map((opt, i) => (
              <div className="st-opt" key={i} data-state="idle" style={{ animationDelay: `${i * 40}ms` }}>
                <span className="st-opt__key" aria-hidden="true">{KEYS[i] || i + 1}</span>
                <span className="st-opt__label">{opt}</span>
                <span className="st-opt__mark" aria-hidden="true" />
              </div>
            ))}
          </div>
        ) : null
      ) : (
        /* Révélation : la répartition prend toute la place. */
        <div className="st-stats" data-bind="reveal.stats" data-testid="stats-panel">
          {/* Une phrase, seulement quand la répartition le mérite. */}
          {voix ? <p className="st-voix" data-testid="voix-plateau">{voix}</p> : null}
          {stats?.kind === 'numeric' ? (
            <>
              <div className="st-answer" data-bind="reveal.target" data-testid="reveal-value">
                <span className="st-answer__label">Bonne réponse</span>
                <span className="st-answer__value">{fmt(reveal.target)}</span>
              </div>
              {/* La dispersion du groupe, en image : le stream montrait des barres
                  pour les modules à options, mais trois chiffres seulement pour
                  l'estimation — impossible d'y voir si la salle était groupée ou
                  éparpillée autour de la vérité. */}
              <StreamHistogram histo={stats.histogramme} total={stats.total} />
              <div className="st-facts">
                <div className="st-fact">
                  <span className="st-fact__label">Le plus proche</span>
                  <span className="st-fact__value st-fact__value--good" data-bind="reveal.stats.closest">
                    {fmt(stats.closest)}
                  </span>
                </div>
                <div className="st-fact">
                  <span className="st-fact__label">Moyenne</span>
                  <span className="st-fact__value" data-bind="reveal.stats.avg">{fmt(stats.avg)}</span>
                </div>
                <div className="st-fact">
                  <span className="st-fact__label">Médiane</span>
                  <span className="st-fact__value" data-bind="reveal.stats.median">{fmt(stats.median)}</span>
                </div>
              </div>
            </>
          ) : stats?.kind === 'options' ? (
            <OptionBreakdown
              stats={stats}
              correctIndex={reveal.type === 'quiz' ? reveal.correctIndex
                : reveal.type === 'true_false' ? (reveal.correct ? 0 : 1) : -1}
              leadingIndexes={leadingIndexes}
            />
          ) : answer != null ? (
            <div className="st-answer" data-testid="reveal-value">
              <span className="st-answer__label">Bonne réponse</span>
              <span className="st-answer__value">{answer}</span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ============================================================
// S4 — Podium
// ============================================================
function PodiumStage({ g }) {
  const rows = (g.podium && g.podium.length ? g.podium : g.leaderboard || []).slice(0, 3);
  const scored = rows.filter((r) => (r.score || 0) > 0);
  const prog = g.room?.progression;

  // Cas limite : partie close sans aucun score — pas de podium, message franc.
  if (!scored.length) {
    return (
      <div className="stream__stage stream__stage--centered" data-testid="stream-podium" data-state="podium empty">
        <div className="st-caps">
          <span className="st-cap st-cap--closed">
            <span className="st-cap__label st-cap__label--muted">Partie terminée</span>
          </span>
        </div>
        <h2 className="st-title">Aucun point marqué cette fois</h2>
        <p className="st-lead">
          Pas de podium : personne n'a répondu. Le salon reste ouvert — la prochaine partie
          peut commencer tout de suite.
        </p>
      </div>
    );
  }

  const slots = [
    { entry: rows[1], place: 'second', rank: 2 },
    { entry: rows[0], place: 'first', rank: 1 },
    { entry: rows[2], place: 'third', rank: 3 },
  ].filter((s) => s.entry);

  return (
    <div className="stream__stage" data-testid="stream-podium" data-state="podium">
      <div className="st-caps">
        <span className="st-cap st-cap--live">
          <span className="st-cap__dot" aria-hidden="true" />
          <span className="st-cap__label st-cap__label--live">Partie terminée</span>
        </span>
        {prog?.total ? (
          <span className="st-cap">
            <span className="st-cap__label">Épreuves</span>
            <span className="st-cap__value" data-bind="module.total">{prog.total}</span>
          </span>
        ) : null}
      </div>

      <h2 className="st-title">Le podium</h2>

      <div className="st-podium" data-bind="podium">
        {slots.map(({ entry, place, rank }) => (
          <div className={`st-step st-step--${place}`} key={entry.id ?? rank}>
            {place === 'first' ? (
              <span className="st-step__crown" aria-hidden="true"><BrandMark size={48} ember /></span>
            ) : null}
            <p className="st-step__name" data-bind={`podium.${rank - 1}.pseudo`}>{entry.pseudo}</p>
            <p className="st-step__score" data-bind={`podium.${rank - 1}.score`}>{fmt(entry.score)}</p>
            <div className="st-step__block">
              <span className="st-step__rank">{entry.rank ?? rank}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// VOIX DE PLATEAU — le stream ne parle QUE sur le remarquable.
//
// Commenter la répartition est le métier de l'animateur. Si l'écran le dit avant
// lui, il se retrouve à répéter ce que tout le monde a déjà lu. Le silence est
// donc une fonctionnalité : l'écran ne s'exprime que sur l'unanimité, l'échec
// collectif, le piège, l'égalité parfaite — et jamais deux manches d'affilée.
//
// Il parle du GROUPE, jamais d'un joueur nommé : le stream affiche les pseudos
// devant toute l'audience, et personne ne doit s'y faire chambrer par une machine.
function useVoixDePlateau(reveal, stats, roundId) {
  const [dit, setDit] = useState(null);
  const dernierCommente = useRef(null);

  useEffect(() => {
    if (!reveal || !stats || roundId == null) { setDit(null); return; }
    // Jamais deux manches commentées de suite : ça garantit la respiration sans
    // étouffer un moment vraiment rare.
    if (dernierCommente.current != null && roundId === dernierCommente.current + 1) { setDit(null); return; }
    const moment = momentDePlateau(reveal.type, stats, reveal);
    if (!moment) { setDit(null); return; }
    dernierCommente.current = roundId;
    setDit(dire(moment));
  }, [reveal, stats, roundId]);

  return dit;
}

// ============================================================
// S5 — Classement complet, au podium UNIQUEMENT (action 3)
//
// Le classement circulait déjà jusqu'ici — le stream est destinataire du canal
// réservé à l'animateur — mais l'écran n'en dessinait que les trois premiers. Un
// joueur classé quinzième avait joué toute la partie sans que son nom paraisse
// jamais.
//
// DÉFILEMENT AUTOMATIQUE, jamais manuel : personne ne fait défiler une source
// navigateur dans OBS, et l'animateur est en train d'animer. Il ne se déclenche
// que si la liste déborde, et il boucle — l'écran ne se vide jamais pendant les
// cinq minutes où le salon reste ouvert après le podium.
//
// UNE SEULE COLONNE, dimensionnée à la hauteur de ligne : deux colonnes auraient
// divisé la hauteur de texte, donc la lisibilité, pour un gain de place que le
// défilement apporte déjà.
function ClassementDefilant({ rows }) {
  const piste = React.useRef(null);
  const [defile, setDefile] = useState(0);

  useEffect(() => {
    const el = piste.current;
    if (!el) return undefined;
    // On ne fait défiler que ce qui dépasse : une liste courte reste immobile,
    // ce qui est plus lisible et plus calme à l'antenne.
    const trop = el.scrollHeight - el.clientHeight;
    setDefile(trop > 4 ? trop : 0);
  }, [rows]);

  if (!rows || !rows.length) return null;

  // Vitesse calée sur le temps de lecture d'une ligne, pas sur une durée fixe :
  // une liste deux fois plus longue défile deux fois plus longtemps, à la même
  // allure de lecture.
  const duree = Math.max(12, Math.round(rows.length * 2.4));

  return (
    <aside className="st-rank" data-testid="stream-leaderboard" aria-label="Classement complet">
      <p className="st-rank__title">Classement</p>
      <div className="st-rank__view" ref={piste}>
        <div className="st-rank__list"
          style={defile ? { '--defile': `-${defile}px`, animationDuration: `${duree}s` } : undefined}
          data-state={defile ? 'defile' : 'fixe'}>
          {rows.map((p, i) => (
            <div className="st-rank__row" key={p.id ?? i}>
              <span className="st-rank__pos">{p.rank ?? i + 1}</span>
              <span className="st-rank__name">{p.pseudo}</span>
              <span className="st-rank__score">{fmt(p.score)}</span>
            </div>
          ))}
          {/* Le début répété en queue : la boucle se referme sans coupure nette. */}
          {defile ? rows.map((p, i) => (
            <div className="st-rank__row" key={`bis-${p.id ?? i}`} aria-hidden="true">
              <span className="st-rank__pos">{p.rank ?? i + 1}</span>
              <span className="st-rank__name">{p.pseudo}</span>
              <span className="st-rank__score">{fmt(p.score)}</span>
            </div>
          )) : null}
        </div>
      </div>
    </aside>
  );
}

// ============================================================
// La source navigateur d'OBS n'est pas toujours réglée sur le canevas nominal.
// La scène garde donc ses dimensions de planche et c'est le facteur d'échelle
// qui absorbe l'écart — une homothétie, jamais un étirement.
function useStreamScale() {
  useEffect(() => {
    const racine = document.documentElement;
    const ajuster = () => {
      const cs = getComputedStyle(racine);
      const l = parseFloat(cs.getPropertyValue('--stream-w'));
      const h = parseFloat(cs.getPropertyValue('--stream-h'));
      if (!l || !h) return;
      racine.style.setProperty('--stream-scale', String(Math.min(window.innerWidth / l, window.innerHeight / h)));
    };
    ajuster();
    window.addEventListener('resize', ajuster);
    return () => {
      window.removeEventListener('resize', ajuster);
      racine.style.removeProperty('--stream-scale');
    };
  }, []);
}

export function OverlayApp() {
  const token = new URLSearchParams(window.location.search).get('token');
  const g = useGame(token);
  useStreamScale();

  if (!token || !g.connected) return null;

  const state = g.room?.state;
  const ended = state === 'ended' || (g.podium && g.podium.length);
  const inRound = g.current && (state === 'playing' || state === 'results');

  // Classement COMPLET : on n'écarte pas les joueurs à zéro. Le but de cette
  // colonne est précisément que tout le monde existe à l'écran — écarter les
  // zéros reproduirait, en plus discret, le défaut qu'on corrige.
  const classement = g.leaderboard || [];

  return (
    <div className="stream-fit">
      <div className={`stream${inRound && !ended ? ' stream--question' : ''}`} data-state={ended ? 'ended' : 'live'}>
        {ended ? <PodiumStage g={g} /> : inRound ? <QuestionStage g={g} /> : <WaitingStage g={g} />}

        {/* CONTRAT S1, RÉÉCRIT (actions 3, 4 et 5).
            Avant : un panneau latéral de 460 px, sur toute la hauteur, PERMANENT
            quelle que soit la phase. Il portait un QR, un code, une adresse et un
            bloc de marque — un quart de la largeur en permanence, ce qui nuisait
            au dynamisme de la partie sans rien apporter de plus qu'une pastille.

            Maintenant :
              - pendant l'accueil et la partie, une PASTILLE discrète en bas à
                gauche, pour que les retardataires puissent toujours rejoindre ;
              - au podium, plus de QR — mais le code RESTE, en tout petit, avec
                l'adresse sur la même ligne : un code seul ne dirait pas où le
                taper, et le salon reste ouvert cinq minutes pour une relance ;
              - la colonne libérée accueille alors le classement complet, qui
                défile tout seul.
            La pastille revient dès le retour au salon d'attente : sans ça, une
            seconde partie n'aurait plus aucun moyen d'être rejointe. */}
        {ended
          ? <ClassementDefilant rows={classement} />
          : null}
        <PastilleRejoindre code={g.room?.code} podium={!!ended} />
      </div>
    </div>
  );
}
