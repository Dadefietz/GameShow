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
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { plagesVisibles, bornes, barres, repereCible } from '../shared/echelle-estimation.js';
import { lettreDeChoix } from '../shared/lettres.js';
import QRCode from 'qrcode';
import { Flamme } from '../shared/Flamme.jsx';
import { useGame } from '../shared/useGame.js';
import { useVoixDePlateau, usePhraseDeManche } from '../shared/voix-hooks.js';
import { bipCompteRebours, sonFinDuTemps, sonRevelation } from '../shared/sons.js';
import { Visage, MasquesVisages } from '../shared/Visage.jsx';
import { Chainons } from '../shared/Chainons.jsx';
import { segmentsAdresse } from '../shared/adresse.js';
import { ChronoBuzzer } from '../shared/ChronoBuzzer.jsx';
import { RetourFlamme } from '../shared/RetourFlamme.jsx';
import { EmblemeJeu } from '../shared/EmblemeJeu.jsx';
import { EmblemeCache } from '../shared/EmblemeCache.jsx';
import { GrilleCache, useObjetPret } from '../shared/GrilleCache.jsx';
import { BucheHache } from '../shared/BucheHache.jsx';
import { positionDuCurseur, pourcent, useBalayage } from '../shared/proportion.js';
import { SerieGraphique } from '../shared/SerieGraphique.jsx';
import { Symbole } from '../shared/Symbole.jsx';
import { useBlancEntreImages } from '../shared/defile.js';
import { chronoAffiche, secondes, formatteurDe, useCompteARebours } from '../shared/temps.js';
import './overlay.css';

const nf = new Intl.NumberFormat('fr-FR');
const fmt = (n) => (typeof n === 'number' && Number.isFinite(n) ? nf.format(n) : '—');

// Marque animée du système : flamme qui respire, braise qui scintille. Le dessin
// vient de la géométrie unique (chantier v2, décision 5.1) — il était recopié ici
// à l'identique de BrandLoader, et rien n'empêchait les deux de diverger.
function BrandMark({ size = 37, ember = false }) {
  return <Flamme taille={size} escarbille={ember} />;
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


// L'ADRESSE DE LA PASTILLE. Le découpage en segments sécables — et la raison
// pour laquelle il existe — sont dans `shared/adresse.js` : le contrôle a besoin
// de la même règle pour mesurer la vraie adresse d'hébergement dans la plaque.
function Adresse({ texte }) {
  const segments = segmentsAdresse(texte);
  return segments.map((seg, i) => (
    <React.Fragment key={i}>{seg}{i < segments.length - 1 ? <wbr /> : null}</React.Fragment>
  ));
}

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
          <span className="rejoindre__lien"><Adresse texte={lienAffiche} /></span>
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
      <p className="rejoindre__lien" data-bind="room.joinUrl"><Adresse texte={lienAffiche} /></p>
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
    case 'juste_temps': return secondes(reveal.target);
    case 'coupe_buche': return pourcent(reveal.target);
    default: return null; // vote : pas de bonne réponse, la répartition parle
  }
}

// Dispersion des estimations, en 8 tranches — la tranche qui contient la bonne
// réponse est mise en couleur. Les hauteurs sont relatives à la tranche la plus
// fournie : un histogramme montre une FORME, pas des parts d'un total.
// L'ÉCRITURE DES NOMBRES EST UN PARAMÈTRE, et c'est la seule chose que « Le juste
// temps » change à ce graphique. Le reste — géométrie, plages, barres, cible — est
// calculé par le serveur et par `echelle-estimation.js`, et lui est identique :
// « il faut reprendre exactement le graphique du module Estimation ».
//
// Deux formats et non un : sur l'AXE, une estimation s'arrondit à l'entier (les
// bornes tombent sur des décimales sans intérêt), un temps ne s'arrondit surtout
// pas — c'est le centième qui fait le jeu.
function StreamHistogram({ histo, total, plages, cible, ecrire = fmt,
  ecrireAxe = (v) => fmt(Math.round(v)), legende = 'estimation' }) {
  if (!histo || !total) return null;
  // MÊME GÉOMÉTRIE QUE LA CONSOLE, calculée au même endroit — le stream n'apporte
  // que ses classes.
  const zones = plagesVisibles(plages, histo);
  const reperes = bornes(histo);
  const barresHisto = barres(histo);
  const marque = repereCible(cible, histo);
  const trouvee = (histo.exact || 0) > 0;
  return (
    <div className="st-histo" data-bind="reveal.stats.histogramme" data-testid="stream-histogramme">
      <div className="st-histo__cadre">
        {/* Les plages qui rapportent des points, au fond. Le public voyait des
            barres sans savoir ce qu'il fallait viser pour marquer. */}
        {zones.filter((z) => z.zone).map((z) => (
          <span key={z.nom} className={`st-histo__plage st-histo__plage--${z.nom}`}
            style={{ left: `${z.gauche}%`, width: `${z.largeur}%` }} data-plage={z.nom} />
        ))}
        {/* Les seuils du barème, chacun à sa place — SANS étiquette : les mots
            descendent dans la règle, sous l'axe, où chaque palier a sa ligne et ne
            peut plus en cacher un autre. */}
        {zones.flatMap((z) => z.bornes.map((b) => (
          <span key={`${z.nom}-${b.cote}`} className={`st-histo__seuil st-histo__seuil--${z.nom}`}
            style={{ left: `${b.pct}%` }} data-seuil={z.nom} />
        )))}
        {/* Les barres épousent les paliers — voir la console, même règle. */}
        <div className="st-histo__plot">
          {barresHisto.map((b) => (
            <span key={b.i}
              className={`st-histo__bar st-histo__bar--${b.palier}${b.count === 0 ? ' st-histo__bar--vide' : ''}`}
              style={{ left: `${b.gauche}%`, width: `${b.largeur}%`, height: `${b.hauteur}%`,
                animationDelay: `${b.i * 40}ms` }}
              data-count={b.count} data-palier={b.palier} data-cote={b.cote}>
              {b.count > 0 ? <span className="st-histo__bar-n">{fmt(b.count)}</span> : null}
            </span>
          ))}
        </div>
        {/* LA BONNE RÉPONSE, à sa place exacte : elle n'était repérée que par la
            couleur d'une tranche large de plusieurs dizaines d'unités. */}
        {marque ? (
          <span className={`st-histo__cible${trouvee ? ' st-histo__cible--trouvee' : ''}`}
            style={{ left: `${marque.pct}%` }} data-testid="stream-histo-cible" data-trouvee={trouvee || undefined}>
            <span className={`st-histo__cible-val st-histo__cible-val--${marque.ancrage}`}>{ecrire(cible)}</span>
          </span>
        ) : null}
      </div>
      <div className="st-histo__axe" data-testid="stream-histo-axe">
        {reperes.map((b) => (
          <span key={b.i} className="st-histo__tick" style={{ left: `${b.pct}%` }}>{ecrireAxe(b.valeur)}</span>
        ))}
      </div>
      {/* LA RÈGLE DES PLAGES — une ligne par palier, à sa place sur l'axe. Même
          structure que la console : seules les tailles diffèrent. */}
      {zones.length ? (
        <div className="st-histo__regle" data-testid="stream-histo-plages">
          {zones.map((z) => (
            <div className={`st-histo__regle-ligne st-histo__regle-ligne--${z.nom}`} key={z.nom} data-plage={z.nom}>
              <span className="st-histo__regle-barre" style={{ left: `${z.gauche}%`, width: `${z.largeur}%` }} />
              <span className={`st-histo__regle-lbl st-histo__regle-lbl--${z.lblVersGauche ? 'gauche' : 'droite'}`}
                style={{ left: `${z.ancreLbl}%` }}>
                {z.libelle}<span className="st-histo__regle-pts">{fmt(z.points)} pts</span>
              </span>
            </div>
          ))}
        </div>
      ) : null}
      <p className="st-histo__legend">
        {total > 1 ? `Dispersion des ${fmt(total)} ${legende}s` : `Une seule ${legende}`}
      </p>
    </div>
  );
}

// LA TAILLE DES CHOIX SUIT LEUR NOMBRE.
//
// CE QUI A ÉTÉ DEMANDÉ : « il faut adapter le design et la taille de la police au
// nombre de choix pour que tout soit visible à l'écran stream. Si j'ai 9 choix à
// la question, alors je dois voir les 9 choix à l'écran. »
//
// POURQUOI C'EST CALCULÉ ICI ET NON EN CSS. Une boîte flexible sait répartir une
// hauteur entre N enfants ; elle ne sait pas en déduire une TAILLE DE POLICE. Et
// le canevas du stream est fixe — 1920 × 1080, toujours — donc le calcul est
// déterministe : il n'y a pas de cas où la mesure dépendrait de l'écran qui
// regarde.
//
// LES BORNES PROTÈGENT LES DEUX EXTRÊMES : deux choix ne doivent pas devenir des
// pancartes, neuf ne doivent pas devenir illisibles. Entre les deux, la rangée
// prend ce qui reste.
const HAUTEUR_DES_CHOIX = 640;   // repli, avant la première mesure

// LA PLACE RÉELLEMENT LAISSÉE AUX CHOIX — MESURÉE, PLUS DEVINÉE.
//
// LE DÉFAUT QUE CECI RÉPARE, ET IL A ÉTÉ LIVRÉ DEUX FOIS. La hauteur disponible
// était une CONSTANTE de 640 px, choisie d'après un quiz à quatre réponses. Le
// vote place au-dessus de ses choix un énoncé plus long, parfois une consigne de
// tour, et il ne restait pas 640 px mais 563. Mesuré : à neuf propositions,
// « Hotel » finissait à 1131 px et « India » à 1209 dans une scène qui s'arrête à
// 1080. Deux choix invisibles, et rien à l'écran pour le dire.
//
// LE CALCUL ÉTAIT JUSTE, IL PORTAIT SUR UN NOMBRE FAUX. C'est pourquoi il avait
// été déclaré satisfait sans être regardé : on avait vérifié l'arithmétique, pas
// la scène.
//
// ON MESURE LA BOÎTE DES RANGÉES, ET RIEN D'AUTRE. Une première version calculait
// la place en soustrayant à la scène le haut du bloc et son écart bas. Deux
// pièges s'y cachaient : le dévoilement pose un TITRE au-dessus de chaque colonne,
// dont la soustraction ne tenait pas compte ; et le bloc est aligné en bas, si
// bien que le haut de sa première rangée dépend de la taille des rangées — la
// mesure se serait mordu la queue. En demandant sa hauteur à la boîte qui contient
// EXACTEMENT les rangées, il n'y a plus rien à soustraire ni à supposer.
//
// `clientHeight`, ET NON `getBoundingClientRect`. La toile du stream est un
// canevas fixe de 1920 × 1080 ramené à l'échelle de la fenêtre par une
// transformation CSS. Une boîte relevée par `getBoundingClientRect` est en pixels
// d'ÉCRAN ; les propriétés de disposition ignorent la transformation et rendent
// des pixels de TOILE — l'unité dans laquelle on va réécrire les tailles.
//
// LA MESURE NE BOUCLE PAS : la boîte tient sa hauteur de sa PART de la scène
// (`flex: 1; min-height: 0`), que la taille des rangées ne change pas.
function usePlaceDesChoix(deps) {
  const ref = useRef(null);
  const [place, setPlace] = useState(HAUTEUR_DES_CHOIX);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const mesurer = () => {
      const dispo = el.clientHeight;
      if (dispo > 0) setPlace((p) => (Math.abs(p - dispo) > 1 ? dispo : p));
    };
    mesurer();
    const ro = new ResizeObserver(mesurer);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return [ref, place];
}


// LES MESURES D'UNE SCÈNE DE QUESTION — l'énoncé ET les choix.
//
// « Cache-cache » n'a que la MOITIÉ de la largeur : son énoncé y tient sur deux
// ou trois lignes là où un quiz en tient une. Il part donc d'un cran plus bas, et
// les deux — énoncé et choix — se resserrent ensemble quand les réponses se
// multiplient. Vu à l'écran : à neuf choix, cinq étaient visibles.
function mesuresDeScene(current, n) {
  const demiScene = current?.type === 'cache_cache';
  const nombre = Math.max(1, n || 1);
  const enonce = demiScene
    ? (nombre >= 8 ? 52 : nombre >= 6 ? 62 : 72)
    : (nombre >= 8 ? 72 : nombre >= 6 ? 86 : 100);
  // L'ÉNONCÉ SEUL. Les tailles de choix ne se déduisent plus d'ici : elles
  // dépendent de la place que cet énoncé laisse, qui se mesure après coup.
  return { '--st-q-fs': `${enonce}px` };
}
function mesuresDesChoix(n, place = HAUTEUR_DES_CHOIX) {
  const nombre = Math.max(1, n || 1);
  const ecart = nombre <= 5 ? 20 : 10;
  const brut = (place - (nombre - 1) * ecart) / nombre;
  const hauteur = Math.max(46, Math.min(116, brut));
  const police = Math.max(20, Math.min(46, Math.round(hauteur * 0.40)));
  return {
    '--st-opt-h': `${Math.round(hauteur)}px`,
    '--st-opt-fs': `${police}px`,
    '--st-opt-gap': `${ecart}px`,
    '--st-opt-pad': `${Math.round(hauteur * 0.16)}px`,
    '--st-opt-dot': `${Math.round(hauteur * 0.56)}px`,
    '--st-opt-key-fs': `${Math.max(14, Math.min(46, Math.round(hauteur * 0.30)))}px`,
    // LA PASTILLE DE DROITE SUIT LA RANGÉE, ELLE AUSSI. Elle gardait sa taille
    // fixe : à neuf choix, un rond de 48 px dans une rangée de 48 px moins ses
    // marges — il débordait de sa propre ligne de seize pixels. Rien ne se voyait
    // sortir de l'ÉCRAN, et c'est ce qui rendait le défaut discret : le rond
    // mordait sur ses voisines.
    '--st-opt-mark': `${Math.max(16, Math.min(48, Math.round(hauteur * 0.46)))}px`,
    // COMBIEN DE LIGNES LA RANGÉE PEUT TENIR — calculé, pas espéré.
    //
    // Une proposition de vote est une PHRASE, pas un mot. Sur deux colonnes — le
    // dévoilement d'un vote montre les deux tours côte à côte — elle se replie sur
    // deux lignes, et deux lignes ne tiennent pas dans une rangée de cinquante
    // pixels : la seconde passait sous le bord, coupée net et sans rien pour le
    // dire. On dit donc à la rangée combien de lignes elle peut porter ; au-delà,
    // le texte s'arrête sur des points de suspension, ce qui SE VOIT. L'énoncé
    // complet, lui, a été à l'écran pendant toute la question.
    '--st-opt-count-fs': `${Math.max(14, Math.min(40, Math.round(hauteur * 0.34)))}px`,
    '--st-opt-lignes': String(Math.max(1, Math.floor(
      (hauteur - 2 * Math.round(hauteur * 0.16)) / (police * 1.2),
    ))),
  };
}

// Répartition par options (quiz, vrai/faux, vote) : une rangée par choix,
// barre de remplissage proportionnelle, décompte à droite.
function OptionBreakdown({ stats, correctIndex, leadingIndexes = [], liste }) {
  const total = Math.max(stats.total || 0, 1);
  return (
    <div className="st-opts-liste" ref={liste}>
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
              {isCorrect ? <CheckIcon /> : lettreDeChoix(i)}
            </span>
            <span className="st-opt__label">{opt}</span>
            <span className="st-opt__count">{count} · {pct}%</span>
          </div>
        );
      })}
    </div>
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
  // LES DEUX TOURS DU VOTE — voir la surface joueur, même règle et mêmes mots :
  // l'antenne et le cercle ne peuvent pas demander deux choses différentes.
  // ---- « COUPE TA BÛCHE » : LE CURSEUR, ET LES TRAITS DÉJÀ POSÉS ----
  //
  // LE MÊME CROCHET QUE LES TÉLÉPHONES : le public et le cercle doivent voir le
  // curseur au même endroit au même instant. Deux calculs distincts dériveraient,
  // et l'antenne montrerait une bûche coupée ailleurs que celle du cercle.
  const estBuche = current.type === 'coupe_buche';
  const ecouleBuche = useBalayage(current, estBuche && !revealed);
  const positionBuche = estBuche && current.periodeMs
    ? positionDuCurseur(ecouleBuche, current.periodeMs)
    : 0;
  // Les coupes déjà faites, poussées une par une par le serveur sur le canal du
  // staff. Aucun nom ne les accompagne — le stream est capturé par OBS.
  const [traits, setTraits] = useState([]);
  useEffect(() => {
    const onTrait = (t) => setTraits((prev) => (
      t && t.roundId === g.current?.roundId ? [...prev, t.position] : prev
    ));
    g.on('coupe:trait', onTrait);
    return () => g.off('coupe:trait', onTrait);
  }, [g, g.current?.roundId]);
  useEffect(() => { setTraits([]); }, [g.current?.roundId]);
  const consigneDuTour = current.type === 'vote' && current.tours > 1
    ? (current.tour === 2 ? 'Que pense le cercle ?' : 'Que penses-tu ?')
    : null;
  const stats = reveal?.stats;
  // Le visage courant, poussé un par un par le serveur — jamais porté par la
  // question, dont la charge utile trahirait la répétition. Le garde sur
  // l'identifiant de manche empêche un visage attardé de s'afficher sur la
  // manche suivante.
  const elementOk = g.element && g.element.roundId === g.current?.roundId;
  const visageId = elementOk ? g.element.id : null;
  const visageSrc = elementOk ? g.element.src : null;
  const visagePlace = elementOk ? g.element.place : null;

  // « CACHE-CACHE » — l'objet actuellement allumé. Même garde que le visage : un
  // objet attardé de la manche précédente ne doit pas s'afficher sur la nouvelle.
  const objetCache = g.objetCache && g.objetCache.roundId === g.current?.roundId ? g.objetCache : null;
  const devoilements = g.devoilements;
  // Même règle qu'au téléphone : la plaque et le dessin arrivent ensemble.
  const objetVisible = useObjetPret(objetCache);

  // LE BLANC ENTRE DEUX IMAGES — à l'antenne aussi, et pour la même raison : deux
  // images identiques qui se suivent ne se distinguent pas sans lui, et le public
  // ne verrait pas ce que le cercle doit repérer.
  //
  // IL SE DÉCLARE ICI, APRÈS LA PLACE, et pas plus haut : il la LIT. Écrit avant
  // elle, il jetait une « ReferenceError: Cannot access before initialization » —
  // et comme la place n'est lue que sur « Retour de flamme », l'antenne ne
  // s'éteignait que sur ce jeu-là. Écran noir devant le public, rien sur la
  // console de l'animateur, qui ne pouvait ni le voir ni le comprendre.
  const blancDefile = useBlancEntreImages(current.type === 'retour_flamme' ? visagePlace : null);

  const voix = useVoixDePlateau(revealed ? reveal : null, stats, g.current?.roundId);
  const answer = revealText(reveal, current);

  // LE SON DE L'ANTENNE (A25). C'est la source captée par OBS : ce qu'elle joue,
  // toute la salle et tout le stream l'entendent. Le compte à rebours et la chute
  // y ont donc plus de portée que partout ailleurs — c'est ici que « la fin des
  // vingt secondes » se perçoit collectivement.
  //
  // La console de l'animateur, elle, reste MUETTE : il parle par-dessus, et un
  // bip dans son casque pendant qu'il présente est une gêne, pas un signal. Il
  // entend le stream comme tout le monde.
  //
  // Un navigateur ne joue aucun son sans geste préalable. Une source OBS n'en
  // reçoit aucun : selon sa configuration, le son sortira ou ne sortira pas.
  // C'est une limite du support, pas un défaut du code — et le contrôle visuel du
  // chrono, lui, ne dépend de rien.
  //
  // ET IL SE TAIT SUR « LE JUSTE TEMPS », comme l'anneau qu'on vient d'en retirer.
  // Les bips tombent sur les cinq dernières secondes de la FENÊTRE de réponse :
  // ils diraient à toute la salle où en est le chrono qu'on vient de lui cacher.
  // Une fuite par le son est plus difficile à voir qu'une fuite à l'écran, et
  // elle porte plus loin — sur la source captée par OBS, tout le monde l'entend.
  const derniereSeconde = useRef(null);
  useEffect(() => {
    if (revealed || typeof timeLeft !== 'number' || current.type === 'juste_temps') {
      derniereSeconde.current = null; return;
    }
    if (derniereSeconde.current === timeLeft) return;
    const precedente = derniereSeconde.current;
    derniereSeconde.current = timeLeft;
    if (precedente == null) return;
    if (timeLeft > 0 && timeLeft <= 5) bipCompteRebours();
    else if (timeLeft === 0) sonFinDuTemps();
  }, [timeLeft, revealed, current.type]);

  // LA RÉVÉLATION — une seule fois par manche, à l'instant où le public découvre
  // la réponse. Le repère est l'identifiant de manche : sans lui, le son
  // repartirait à chaque re-rendu de l'écran de révélation.
  const mancheSonnee = useRef(null);
  useEffect(() => {
    const id = g.current?.roundId;
    if (!revealed || id == null) return;
    if (mancheSonnee.current === id) return;
    mancheSonnee.current = id;
    sonRevelation();
  }, [revealed, g.current?.roundId]);

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

  // ---- « LE JUSTE TEMPS » : LE CADRAN DE LA SCÈNE ----
  //
  // LE MÊME CROCHET QUE LES TÉLÉPHONES, et c'est tout l'enjeu : le public et le
  // cercle doivent voir le même chiffre au même instant. Deux calculs distincts
  // dériveraient, et le stream mentirait sur ce que les joueurs ont vu — sur un
  // jeu qui se juge au centième.
  const restantMs = useCompteARebours(current, current.type === 'juste_temps' && !revealed);
  const chronoSec = restantMs != null ? restantMs / 1000 : null;
  const cacheSec = Number(current.cache) || 0;
  const chronoCache = chronoSec != null && cacheSec > 0 && chronoSec <= cacheSec;

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
    const typeMap = { true_false: 'boolean', estimation: 'numeric', juste_temps: 'numeric', coupe_buche: 'numeric', vote: 'vote' };
    const typeSuffix = typeMap[reveal.type] || '';
    return typeSuffix ? `revealed ${typeSuffix}` : 'revealed';
  })() : (urgent ? 'live urgent' : 'live');

  // LES MESURES DE LA SCÈNE SUIVENT LE NOMBRE DE CHOIX, et l'énoncé avec elles :
  // à neuf réponses, un titre de 116 px mange la moitié de la hauteur avant que
  // la première option ne soit dessinée. Elles sont posées sur la SCÈNE, pas sur
  // la liste, parce que l'énoncé et les choix sont deux frères — chacun doit
  // savoir ce que l'autre prend.
  const mesures = mesuresDeScene(current, options.length);
  // LE NOMBRE DE RANGÉES DE LA RÉVÉLATION vient des statistiques, pas de la
  // question : celle-ci a disparu quand on dévoile.
  const nbRangees = (stats?.options?.length) || options.length || 1;
  const [refChoix, placeChoix] = usePlaceDesChoix([current?.questionId, current?.tour, options.length]);
  const [refStats, placeStats] = usePlaceDesChoix([revealed, stats?.kind, nbRangees]);
  // LE TEMPS DES RÉPONSES : la manche n'est pas révélée, mais les questions sont
  // finies. C'est le seul moment du projet où l'écran de jeu ne montre plus la
  // question en cours — il n'y en a plus.
  const enDevoilement = current.type === 'cache_cache' && !revealed && devoilements.length > 0;
  // LA GRILLE FINALE : la manche est révélée et la scène montre les neuf objets.
  const grilleFinale = revealed && stats?.kind === 'cache';

  return (
    <div className="stream__stage" data-testid="stream-question" data-state={revealedState}
      style={mesures}>
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

        {/* MÊME RETRAIT QU'AILLEURS SUR « LE JUSTE TEMPS » — et ici la fuite est
            pire encore : elle est PUBLIQUE. L'anneau compte les secondes de la
            fenêtre de réponse ; il continuait de les égrener après que le cadran
            se soit consumé, sur la toile que tout le monde regarde. Le cercle
            n'avait plus qu'à lire l'écran de stream pour savoir où en était le
            chrono qu'on venait de lui cacher. */}
        {/* NI CHRONO PENDANT LE DÉVOILEMENT DES RÉPONSES. Plus personne ne
            répond : un anneau qui continue de tourner annonce une fenêtre qui
            n'existe plus. */}
        {!revealed && current.type !== 'juste_temps' && !enDevoilement ? (
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
      {current.type === 'lien' && Array.isArray(current.mots) ? (
        /* LE LIEN : ce ne sont pas une phrase mais DEUX MOTS, et c'est entre eux
           que tout se joue. Ils portent l'emblème au milieu, comme sur les
           téléphones — la scène et le cercle montrent la même chose. */
        <div className={`st-lienmots${revealed ? ' st-lienmots--revealed' : ''}`}
          data-bind="module.text" data-testid="question-text">
          <span className="st-lienmots__mot">{current.mots[0]}</span>
          <span className="st-lienmots__chainons" aria-hidden="true"><Chainons taille={64} /></span>
          <span className="st-lienmots__mot">{current.mots[1]}</span>
        </div>
      ) : grilleFinale ? (
        /* LA GRILLE FINALE CLÔT LE JEU, elle ne pose plus de question.
           « Lors du dévoilement de la grille à la fin du jeu, la question 5 est
           toujours écrite. » Le masquage posé au chantier v6 ne valait que pour le
           dévoilement des réponses — la manche RÉVÉLÉE est un autre état, et
           l'énoncé y revenait intact au-dessus d'une grille qui ne l'illustre
           plus. Le public lisait une question à laquelle on venait de répondre. */
        <p className="st-question st-question--revealed" data-testid="question-text">
          Le cache-cache est terminé ! Voici la grille
        </p>
      ) : enDevoilement ? (
        /* PENDANT LE DÉVOILEMENT, L'ÉNONCÉ DE LA DERNIÈRE QUESTION DISPARAÎT.
           « Il faut que sur l'écran il n'y ait que la question dont on est en
           train de révéler la réponse, la réponse et la matrice qui se dévoile. »
           Il restait affiché au-dessus, en grand : deux questions à l'écran, dont
           une périmée, et le public lisait la mauvaise. */
        null
      ) : (
        <p className={`st-question${revealed ? ' st-question--revealed' : ''}`}
          data-bind="module.text" data-testid="question-text">
          {current.text || ''}
        </p>
      )}

      {/* LA CONSIGNE DU TOUR, À L'ANTENNE. Le public suit un jeu qui pose DEUX FOIS
          la même question : sans cette ligne, la seconde passerait pour un bug de
          l'écran. Elle disparaît à la révélation, où il n'y a plus de tour en cours. */}
      {!revealed && consigneDuTour ? (
        <p className="st-consigne" data-testid="stream-vote-consigne" data-tour={current.tour}>
          <span className="st-consigne__tour">Tour {current.tour}/{current.tours}</span>
          {consigneDuTour}
        </p>
      ) : null}

      {/* Question en cours : les options, nues. */}
      {!revealed ? (
        current.type === 'juste_temps' ? (
          /* LE CHRONO, À L'ANTENNE. Les chiffres seuls, en très grand : c'est le
             jeu tout entier, et le public compte avec le cercle.

             LE TEMPS CIBLE N'EST NULLE PART ICI. Le stream est une source
             capturée par OBS, et souvent regardée en direct par des gens qui
             jouent : l'afficher donnerait la réponse à tout le monde. Il
             n'apparaît qu'à la révélation, avec le graphique. */
          <div className={`st-jt${chronoCache ? ' st-jt--cache' : ''}`} data-testid="stream-jt-chrono"
            data-cache={chronoCache || undefined}>
            {/* LA CIBLE, À L'ANTENNE AUSSI. Le public suit le jeu : sans le temps
                à viser, il regarde des chiffres défiler sans savoir ce qui se
                joue. Voir la note de la surface joueur — c'est la consigne, pas la
                réponse. */}
            <p className="st-jt__cible" data-testid="stream-jt-cible">
              <span className="st-jt__cible-label">Arrêter à</span>
              <span className="st-jt__cible-val">{secondes(current.cible)}</span>
            </p>
            <span className={`st-jt__valeur${chronoCache ? ' consume' : ''}`}>{chronoAffiche(chronoSec)}</span>
            <span className="st-jt__legende">
              {chronoCache ? 'Il court toujours' : 'Retenez le rythme'}
            </span>
          </div>
        ) : current.type === 'coupe_buche' ? (
          /* LA BÛCHE, À L'ANTENNE. La consigne, le rondin, le curseur — et les
             traits des coupes déjà faites, qui apparaissent au fil de la manche.
             C'est le seul jeu du projet où le public voit les réponses arriver en
             direct ; elles n'atteignent pas les joueurs, qui viseraient le trait le
             plus fourni plutôt que la proportion. */
          <div className="st-buche" data-testid="stream-buche">
            <p className="st-buche__consigne">
              Coupe cette bûche à <strong>{pourcent(current.cible)}</strong>
            </p>
            <div className="st-buche__corps">
              {traits.map((p, i) => (
                <span key={i} className="st-buche__trait" style={{ left: `${p}%` }} aria-hidden="true" />
              ))}
              <span className="st-buche__curseur" style={{ left: `${positionBuche}%` }} aria-hidden="true" />
            </div>
          </div>
        ) : current.type === 'retour_flamme' ? (
          /* LE DÉFILÉ, À L'ANTENNE. L'image seule, en grand, et rien d'autre :
             le public suit la série avec le cercle. Le NUMÉRO DE PASSAGE n'est
             pas affiché — même raison que pour les visages : il donnerait au
             public un repère de mémoire que les joueurs n'ont pas, et sur un
             stream regardé à deux écrans il transformerait le jeu en exercice
             d'écriture. */
          <div className="st-visage" data-testid="stream-retour-image" data-place={visagePlace || ''}
            data-blanc={blancDefile || undefined}>
            {visageId && !blancDefile ? <Symbole id={visageId} taille={380} /> : null}
          </div>
        ) : current.type === 'visages' ? (
          /* LES VISAGES, À L'ANTENNE. Le visage seul, en grand, et rien d'autre :
             c'est le jeu tout entier. Le compteur de réponses et le chrono vivent
             déjà dans l'en-tête commune à tous les jeux.

             Le numéro de passage N'EST PAS AFFICHÉ pendant la série — il donnerait
             au public un repère de mémoire que les joueurs n'ont pas, et sur un
             stream regardé à deux écrans, il transformerait le jeu en exercice
             d'écriture. Il n'apparaît qu'à la révélation. */
          <div className="st-visage" data-testid="stream-visage" data-place={visagePlace || ''}>
            {visageId ? <Visage id={visageId} src={visageSrc} taille={420} /> : null}
          </div>
        ) : current.type === 'cache_cache' && devoilements.length > 0 ? (
          /* LES RÉPONSES, À L'ANTENNE — « à gauche la question et les réponses
             avec la bonne réponse en couleur, et à droite la matrice qui révèle
             la case associée à la réponse ».
             La grille garde TOUT ce qui a déjà été dévoilé : c'est ce qui permet
             au public de reconstruire la partie au fur et à mesure, au lieu de
             voir neuf cases s'allumer et s'éteindre sans mémoire. */
          <div className="st-cache st-cache--question" data-testid="stream-cc-devoilement">
            <div className="st-cache__gauche">
              <p className="st-kicker">Réponse {devoilements[devoilements.length - 1].n}/{devoilements[devoilements.length - 1].total}</p>
              {/* « BAISSER LA POLICE D'ÉCRITURE POUR QUE TOUT SOIT AFFICHÉ À
                  L'ÉCRAN. » Le titre de scène fait 116 px : une question de
                  cinquante caractères y prenait cinq lignes et poussait la
                  réponse hors du cadre. Ici on reprend l'allure de l'écran de
                  l'animateur — l'énoncé se lit, il ne s'affiche pas. */}
              <p className="st-cache__question">{devoilements[devoilements.length - 1].texte}</p>
              <p className="st-answer" data-testid="stream-cc-reponse">
                <span className="st-answer__label">La réponse</span>
                <span className="st-answer__value">{devoilements[devoilements.length - 1].reponse}</span>
              </p>
            </div>
            <div className="st-cache__droite">
              <GrilleCache bloc="st-ccg" testid="stream-cc-matrice"
                vive={devoilements[devoilements.length - 1].place}
                etiquette="Grille, cases dévoilées"
                montre={(place) => {
                  const d = devoilements.find((x) => x.place === place);
                  return d ? <img className="st-ccg__objet" src={d.objet.src} alt="" />
                    : <span className="st-ccg__num">{place}</span>;
                }} />
            </div>
          </div>
        ) : current.type === 'cache_cache' ? (
          /* « CACHE-CACHE », À L'ANTENNE. Deux dispositions, selon la phase.

             LE DÉVOILEMENT : la grille prend la scène, comme la série des
             visages. Le public suit avec le cercle, à la même seconde — c'est le
             serveur qui allume et qui éteint.

             LES QUESTIONS : « on reprend cette même zone mais on la découpe en
             deux (50/50) : à gauche la question et les choix, à droite la matrice
             numérotée ». La grille numérotée n'est pas un ornement : les questions
             désignent les cases par leur numéro, et le public ne peut pas suivre
             sans l'avoir sous les yeux. */
          current.phase === 'grille' ? (
            <div className="st-cache st-cache--grille">
              <GrilleCache bloc="st-ccg" modificateur="st-ccg--grande" testid="stream-cc-grille"
                vive={objetVisible?.place || null}
                etiquette={objetVisible ? `Objet visible en case ${objetVisible.place}` : 'Grille, tout est caché'}
                montre={(place) => (objetVisible && objetVisible.place === place
                  ? <img className="st-ccg__objet" src={objetVisible.src} alt="" />
                  : null)} />
            </div>
          ) : (
            <div className="st-cache st-cache--question" data-testid="stream-cc-question">
              <div className="st-cache__gauche">
                {options.length > 0 ? (
                  <div className="st-options" data-bind="module.options"
                    style={mesuresDesChoix(options.length, HAUTEUR_DES_CHOIX - 60)}>
                    {options.map((opt, i) => (
                      <div className="st-opt" key={i} data-state="idle" style={{ animationDelay: `${i * 40}ms` }}>
                        <span className="st-opt__key" aria-hidden="true">{lettreDeChoix(i)}</span>
                        <span className="st-opt__label">{opt}</span>
                        <span className="st-opt__mark" aria-hidden="true" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="st-lead">La réponse se tape sur le téléphone.</p>
                )}
              </div>
              <div className="st-cache__droite">
                <GrilleCache bloc="st-ccg" testid="stream-cc-numeros" etiquette="Grille numérotée"
                  montre={(place) => <span className="st-ccg__num">{place}</span>} />
              </div>
            </div>
          )
        ) : options.length > 0 ? (
          <div className="st-options" data-bind="module.options"
            ref={refChoix} style={mesuresDesChoix(options.length, placeChoix)}>
            {options.map((opt, i) => (
              <div className="st-opt" key={i} data-state="idle" style={{ animationDelay: `${i * 40}ms` }}>
                <span className="st-opt__key" aria-hidden="true">{lettreDeChoix(i)}</span>
                <span className="st-opt__label">{opt}</span>
                <span className="st-opt__mark" aria-hidden="true" />
              </div>
            ))}
          </div>
        ) : null
      ) : (
        /* Révélation : la répartition prend toute la place. */
        /* LA RÉVÉLATION PORTE LES MÊMES RANGÉES, et elle les oubliait. Les
           tailles n'étaient posées que sur le bloc de question : au dévoilement,
           `.st-opt` retombait sur ses valeurs par défaut, faites pour quatre
           rangées. Neuf débordaient — et c'est précisément l'écran que l'auteur
           citait comme le bon exemple. */
        <div style={mesuresDesChoix(nbRangees, placeStats)}
          className={`st-stats${stats?.kind === 'visages' || stats?.kind === 'retour' ? ' st-stats--serie' : ''}`}
          data-bind="reveal.stats" data-testid="stats-panel">
          {stats?.kind === 'cache' ? (
            /* « LE DERNIER ÉCRAN VISIBLE DU JEU C'EST LA MATRICE DÉVOILÉE
               COMPLÈTEMENT. » Neuf objets, tous montrés — c'est le moment où le
               public revoit d'un coup ce qu'il n'a vu qu'un par un. */
            <div className="st-cache st-cache--grille" data-testid="stream-cc-finale">
              <GrilleCache bloc="st-ccg" modificateur="st-ccg--grande" testid="stream-cc-matrice-finale"
                etiquette="Grille entièrement dévoilée"
                montre={(place) => {
                  const o = (stats.matrice || []).find((x) => x.place === place);
                  return o ? <img className="st-ccg__objet" src={o.src} alt="" /> : null;
                }} />
            </div>
          ) : stats?.kind === 'visages' ? (
            <SerieStream stats={stats} />
          ) : stats?.kind === 'retour' ? (
            <SerieRetourStream stats={stats} />
          ) : stats?.kind === 'lien' ? (
            <LienResultats stats={stats} />
          ) : stats?.kind === 'numeric' ? (
            <>
              <div className="st-answer" data-bind="reveal.target" data-testid="reveal-value">
                <span className="st-answer__label">
                  {stats.unite === 'secondes' ? 'Temps cible'
                    : stats.unite === 'pourcent' ? 'Proportion cible' : 'Bonne réponse'}
                </span>
                <span className="st-answer__value">{formatteurDe(stats, fmt)(reveal.target)}</span>
              </div>
              {/* La dispersion du groupe, en image : le stream montrait des barres
                  pour les modules à options, mais trois chiffres seulement pour
                  l'estimation — impossible d'y voir si la salle était groupée ou
                  éparpillée autour de la vérité. */}
              <StreamHistogram histo={stats.histogramme} total={stats.total}
                plages={stats.plages} cible={stats.target}
                ecrire={formatteurDe(stats, fmt)}
                ecrireAxe={formatteurDe(stats, (v) => fmt(Math.round(v)))}
                legende={stats.unite ? 'réponse' : 'estimation'} />
              <div className="st-facts">
                <div className="st-fact">
                  <span className="st-fact__label">Le plus proche</span>
                  <span className="st-fact__value st-fact__value--good" data-bind="reveal.stats.closest">
                    {formatteurDe(stats, fmt)(stats.closest)}
                  </span>
                </div>
                <div className="st-fact">
                  <span className="st-fact__label">Moyenne</span>
                  <span className="st-fact__value" data-bind="reveal.stats.avg">{formatteurDe(stats, fmt)(stats.avg)}</span>
                </div>
                <div className="st-fact">
                  <span className="st-fact__label">Médiane</span>
                  <span className="st-fact__value" data-bind="reveal.stats.median">{formatteurDe(stats, fmt)(stats.median)}</span>
                </div>
              </div>
            </>
          ) : stats?.kind === 'options' ? (
            stats.deuxTours ? (
              // LE VOTE À DEUX TOURS MONTRE LES DEUX, et c'est l'histoire de la
              // manche : ce que le cercle pense, puis ce qu'il croyait penser. Un
              // seul des deux ne répondrait pas à la question qu'on vient de lui
              // poser — a-t-il su se reconnaître ?
              <div className="st-deuxtours" data-testid="stream-vote-deux-tours">
                <div className="st-deuxtours__bloc">
                  <p className="st-deuxtours__titre">Ce que le cercle pense</p>
                  <OptionBreakdown stats={stats} correctIndex={-1} leadingIndexes={leadingIndexes}
                    liste={refStats} />
                </div>
                <div className="st-deuxtours__bloc">
                  <p className="st-deuxtours__titre">Ce qu'il croyait penser</p>
                  <OptionBreakdown
                    stats={{ options: stats.options, tally: stats.pari.tally, total: stats.pari.total }}
                    correctIndex={-1} leadingIndexes={leadingIndexes} />
                </div>
              </div>
            ) : (
              <OptionBreakdown
                liste={refStats}
                stats={stats}
                correctIndex={reveal.type === 'quiz' ? reveal.correctIndex
                  : reveal.type === 'true_false' ? (reveal.correct ? 0 : 1) : -1}
                leadingIndexes={leadingIndexes}
              />
            )
          ) : answer != null ? (
            <div className="st-answer" data-testid="reveal-value">
              <span className="st-answer__label">Bonne réponse</span>
              <span className="st-answer__value">{answer}</span>
            </div>
          ) : null}

          {/* LA PHRASE DU PLATEAU, SOUS LA RÉPONSE ET DANS UNE PLACE RÉSERVÉE (A22).
              Elle s'affichait AU-DESSUS de la répartition, et seulement quand elle
              avait quelque chose à dire : son apparition poussait donc tout le
              bloc vers le bas, d'une manche à l'autre, sur une toile de
              1920 × 1080 calée au pixel. Deux corrections en une :
                — elle passe SOUS la réponse, comme demandé, pour ne plus
                  s'interposer entre le public et ce qu'il attend ;
                — sa place est TENUE même quand elle se tait. La fente garde sa
                  hauteur ; c'est le texte qui apparaît, jamais la mise en page qui
                  bouge.
              Le plateau se tait la plupart du temps (c'est une fonctionnalité) :
              cette fente est donc vide bien plus souvent que pleine. */}
          <div className="st-voix-fente" data-testid="voix-plateau-fente">
            {voix ? <p className="st-voix" data-testid="voix-plateau">{voix}</p> : null}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// S4 — Podium
// ============================================================
// L'ANNONCE DU JEU — le même temps que sur les téléphones, à l'échelle de la
// scène. Le cercle et le public voient la même chose au même instant : c'est ce
// qui fait qu'un plateau tient.
// LE JINGLE, À L'ANTENNE. Il était écrit pour « Le lien » seul — emblème et règle
// en dur —, si bien que « Les visages » aurait annoncé des chaînons devant tout
// le public. Chaque jeu en direct apporte le sien.
const ANNONCES_STREAM = {
  // Les quatre jeux classiques ont leur jingle à l'antenne aussi — mêmes mots que
  // sur les téléphones, à l'échelle de la scène.
  quiz: { emblem: <EmblemeJeu type="quiz" taille={260} />, regle: 'Quatre réponses, une seule bonne. Le plus rapide marque le plus.' },
  true_false: { emblem: <EmblemeJeu type="true_false" taille={240} />, regle: 'Vrai ou faux. Rien entre les deux, et il faut trancher vite.' },
  estimation: { emblem: <EmblemeJeu type="estimation" taille={300} />, regle: 'Un nombre à deviner. Seule la justesse compte, pas la vitesse.' },
  vote: { emblem: <EmblemeJeu type="vote" taille={240} />, regle: 'Deux tours : ce que le cercle pense, puis ce qu\'il croit penser.' },
  lien: { emblem: <Chainons taille={180} />, regle: "Un mot pour relier les deux mots de l'animateur." },
  visages: { emblem: <MasquesVisages taille={280} />, regle: 'Un visage va passer deux fois. Saurez-vous le reconnaître ?' },
  coupe_buche: { emblem: <BucheHache taille={280} />, regle: 'Un curseur balaie la bûche. Le cercle doit la couper à la bonne proportion.' },
  // L'EMBLÈME DÉPEND DU MODE : trois tuiles en −2, quatre en −3. C'est la règle
  // montrée en image, et elle change avec le choix de l'animateur.
  retour_flamme: {
    emblem: (a) => <RetourFlamme ecart={a?.ecart === 3 ? 3 : 2} taille={a?.ecart === 3 ? 360 : 300} />,
    regle: (a) => (a?.ecart === 3
      ? 'Une image revient trois images plus tard. Le cercle doit la reconnaître.'
      : 'Une image revient deux images plus tard. Le cercle doit la reconnaître.'),
  },
  juste_temps: { emblem: <ChronoBuzzer taille={170} />, regle: "Un chrono s'efface sans s'arrêter. Le cercle doit le stopper au bon moment." },
  cache_cache: { emblem: <EmblemeCache taille={190} />, regle: 'Neuf objets, montrés une fois chacun. Cinq questions ensuite.' },
};

function AnnonceStage({ nom, type, annonce }) {
  const a = ANNONCES_STREAM[type];
  // Un jeu dont l'emblème ou la règle DÉPEND de ce que l'animateur vient de
  // choisir les déclare en fonction ; les autres gardent leur dessin figé. C'est
  // la même règle que sur les téléphones, et il le faut : l'antenne et le cercle
  // ne peuvent pas annoncer deux règles différentes.
  const rendre = (v) => (typeof v === 'function' ? v(annonce) : v);
  return (
    <div className="stream__stage stream__stage--centered" data-testid="stream-annonce" data-state="annonce">
      {a ? <span className="st-annonce__emblem" aria-hidden="true">{rendre(a.emblem)}</span> : null}
      <p className="st-kicker">Prochaine épreuve</p>
      <h2 className="st-title st-title--xl">{nom}</h2>
      {a ? <p className="st-lead">{rendre(a.regle)}</p> : null}
    </div>
  );
}

// LES DEUX GRAPHIQUES DE SÉRIE DE L'ANTENNE — visages et retours de flamme.
//
// MÊME DESSIN QUE LA CONSOLE, calculé au même endroit (`shared/SerieGraphique.jsx`).
// Le stream n'apporte que ses classes et ses tailles : ce qui se passe à l'antenne
// et ce que l'animateur commente ne peuvent pas diverger.
function SerieStream({ stats }) {
  const adresse = new Map(stats?.adresses || []);
  return (
    <SerieGraphique
      ordre={stats?.ordre} parPlace={stats?.parPlace} bloc="st-serie" testid="stream-visages-serie"
      roleDe={(place) => (
        place === stats.pos2 ? { nom: 'seconde', grand: true, bonne: true }
          : place === stats.pos1 ? { nom: 'premiere', grand: true, bonne: false }
            : null
      )}
      rendu={(id, { grand }) => <Visage id={id} src={adresse.get(id)} taille={grand ? 132 : 88} />}
    />
  );
}

function SerieRetourStream({ stats }) {
  const retours = new Set(stats?.retours || []);
  return (
    <SerieGraphique
      ordre={stats?.ordre} parPlace={stats?.parPlace} bloc="st-serie" testid="stream-retour-serie"
      // TRENTE IMAGES, DONC TROIS RANGÉES DE DIX — et non deux de quinze.
      //
      // MESURÉ, pas estimé : à quinze colonnes, la série s'étendait de 401 à 1949
      // sur une toile de 1920. Elle sortait du cadre à droite ET passait sous la
      // pastille « rejoindre » à gauche, devant le public. Le conteneur, lui,
      // tenait dans ses bornes — c'est son CONTENU qui débordait, ce qu'aucune
      // mesure de la boîte n'aurait vu. La série des visages, vingt images en deux
      // rangées, tient sans rien changer : mesurée aussi.
      colonnes={10}
      roleDe={(place) => (retours.has(place) ? { nom: 'retour', grand: true, bonne: true } : null)}
      rendu={(id, { grand, place, role }) => (
        <Symbole id={id} taille={grand ? 104 : 70}
          titre={role ? `Image ${place}, retour de flamme` : `Image ${place}`} />
      )}
    />
  );
}

// LES MOTS LES PLUS DONNÉS, à la révélation. Jamais de noms : le stream est une
// source capturée par OBS, et cette frontière ne se franchit qu'au podium.
function LienResultats({ stats }) {
  const groupes = (stats?.groupes || []).filter((gr) => gr.count >= 2).slice(0, 6);
  if (!groupes.length) {
    return <p className="st-lead" data-testid="stream-lien-vide">Aucun mot en commun. Chacun a suivi sa piste.</p>;
  }
  const haut = Math.max(...groupes.map((gr) => gr.count));
  return (
    <div className="st-lien" data-testid="stream-lien-groupes">
      {groupes.map((gr) => (
        <div className="st-lien__ligne" key={gr.mot} data-count={gr.count} data-rang={gr.rang}>
          <span className="st-lien__mot">{gr.mot}</span>
          <span className="st-lien__barre" style={{ width: `${Math.round((gr.count / haut) * 100)}%` }} />
          <span className="st-lien__n">{fmt(gr.count)}</span>
        </div>
      ))}
    </div>
  );
}

function PodiumStage({ g }) {
  const rows = (g.podium && g.podium.length ? g.podium : g.leaderboard || []).slice(0, 3);
  // LA VOIX DU PODIUM. `stream.podium` — « le SEUL moment où le stream nomme
  // quelqu'un, pour célébrer » — vivait dans le registre avec ses quatre phrases
  // sans qu'aucun code ne l'atteigne. Le moment le plus chargé de la soirée était
  // muet.
  const phrasePodium = usePhraseDeManche('stream.podium', 'podium');
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
      {phrasePodium ? (
        <p className="st-voix" data-testid="stream-voix-podium">{phrasePodium}</p>
      ) : null}

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

// GÉOMÉTRIE RÉELLE DE LA PASTILLE (chantier v2, décision 1.3).
// La zone réservée était un nombre écrit à la main, calé sur une hypothèse de
// mise en page — « l'adresse se replie sur deux lignes ». L'hypothèse a cessé
// d'être vraie et personne ne l'a su : la pastille débordait de sa propre zone.
// Un nombre deviné redevient faux dès que la police, l'adresse ou le contenu
// changent. Celui-ci vient du DOM, et se recalcule quand la pastille bouge.
// `phase` vaut null tant que la scène n'est pas montée. Sans cela, l'effet
// s'exécuterait une seule fois — pendant que la connexion s'établit, quand la
// pastille n'existe pas encore — et ne reviendrait jamais : la phase, elle, n'a
// pas changé. La mesure resterait au plancher et la scène passerait dessous.
function usePastilleGeometrie(phase) {
  useEffect(() => {
    const racine = document.documentElement;
    const el = phase && document.querySelector('.rejoindre');
    if (!el) return undefined;
    const publier = () => {
      // offsetWidth/Height et NON getBoundingClientRect : la scène est mise à
      // l'échelle par une transformation. Le rectangle client rendrait des pixels
      // d'écran là où la mise en page raisonne en pixels de canevas.
      racine.style.setProperty('--rejoindre-w', `${el.offsetWidth}px`);
      racine.style.setProperty('--rejoindre-h', `${el.offsetHeight}px`);
    };
    publier();
    // Le repli de l'adresse change la hauteur sans qu'aucun événement de fenêtre
    // ne se produise : c'est l'élément qu'il faut observer, pas la fenêtre.
    const ro = new ResizeObserver(publier);
    ro.observe(el);
    return () => ro.disconnect();
  }, [phase]);

  // Le nettoyage des variables est séparé : le fait au démontage seulement, pour
  // qu'un changement de phase ne les retire pas une image durant — ce qui ferait
  // sauter la scène à l'antenne.
  useEffect(() => () => {
    document.documentElement.style.removeProperty('--rejoindre-w');
    document.documentElement.style.removeProperty('--rejoindre-h');
  }, []);
}

export function OverlayApp() {
  const token = new URLSearchParams(window.location.search).get('token');
  const g = useGame(token);
  useStreamScale();

  // La phase est calculée AVANT la sortie anticipée : les crochets ne peuvent pas
  // vivre après un `return`, et la mesure de la pastille doit se refaire à chaque
  // changement de phase — la plaque du podium n'a ni la forme ni la taille de la
  // pastille à QR.
  const state = g.room?.state;
  const ended = state === 'ended' || (g.podium && g.podium.length);
  const inRound = g.current && (state === 'playing' || state === 'results');
  const montee = Boolean(token && g.connected);
  usePastilleGeometrie(!montee ? null : ended ? 'podium' : inRound ? 'question' : 'attente');

  if (!montee) return null;

  // Classement COMPLET : on n'écarte pas les joueurs à zéro. Le but de cette
  // colonne est précisément que tout le monde existe à l'écran — écarter les
  // zéros reproduirait, en plus discret, le défaut qu'on corrige.
  const classement = g.leaderboard || [];

  return (
    <div className="stream-fit">
      <div className={`stream${inRound && !ended ? ' stream--question' : ''}`} data-state={ended ? 'ended' : 'live'}>
        {/* L'ANNONCE passe AVANT l'attente : le cercle et le public doivent voir
            le jingle au même instant, pas l'un le jeu et l'autre le salon. */}
        {ended ? <PodiumStage g={g} />
          : inRound ? <QuestionStage g={g} />
            : g.annonce ? <AnnonceStage nom={g.annonce.name} type={g.annonce.type} annonce={g.annonce} />
              : <WaitingStage g={g} />}

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
