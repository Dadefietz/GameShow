// Surface JOUEUR (manette mobile) — un seul écran affiché selon l'état du jeu.
// Flux : join -> wait -> question (-> réponse envoyée) -> score -> fin.
import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '../shared/icons.jsx';
import { useGame, store } from '../shared/useGame.js';
import { joinRoom } from '../shared/net.js';
import './play.css';

// ---- helpers ----------------------------------------------------------------
const fmtNum = (n) => Number(n || 0).toLocaleString('fr-FR');

function RankValue({ rank }) {
  if (rank == null) return <span className="rank__value">—</span>;
  const suffix = rank === 1 ? 're' : 'e';
  return (
    <span className="rank__value">
      {fmtNum(rank)}
      <sup>{suffix}</sup>
    </span>
  );
}

const ERROR_MESSAGES = {
  'room-not-found': "Ce salon n'existe pas. Vérifie le code.",
  'invalid-pseudo': 'Ce pseudo ne convient pas. Essaie-en un autre.',
  'room-full': 'Ce salon est complet.',
  'join-failed': 'Connexion impossible. Réessaie.',
};

// ---- Écran : rejoindre ------------------------------------------------------
function JoinScreen({ initialCode, onJoin }) {
  const [code, setCode] = useState(initialCode || '');
  const [pseudo, setPseudo] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await onJoin(code.trim(), pseudo.trim());
    } catch (err) {
      setError(ERROR_MESSAGES[err?.message] || ERROR_MESSAGES['join-failed']);
      setBusy(false);
    }
  }

  return (
    <main className="screen screen--join" aria-labelledby="join-title">
      <div className="screen__main screen__main--join">
        <header className="emblem">
          <span className="emblem__glow" aria-hidden="true">
            <Icon name="flame" className="icon" />
          </span>
          <h1 className="emblem__brand" id="join-title">Project Game&nbsp;Show</h1>
          <p className="emblem__tagline">Approche-toi du feu. La partie va commencer.</p>
        </header>

        <form className="join" onSubmit={handleSubmit} noValidate>
          <div className="join__field">
            <label className="join__label" htmlFor="code">Code de la partie</label>
            <input
              className="join__input join__input--code"
              id="code"
              name="code"
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              maxLength={5}
              placeholder="SM9HF"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </div>

          <div className="join__field">
            <label className="join__label" htmlFor="pseudo">Ton pseudo</label>
            <input
              className="join__input"
              id="pseudo"
              name="pseudo"
              type="text"
              autoComplete="off"
              maxLength={18}
              placeholder="PixelNight"
              value={pseudo}
              onChange={(e) => setPseudo(e.target.value)}
            />
          </div>

          {error ? (
            <p className="join__error" role="alert">
              <Icon name="x" className="icon" />
              {error}
            </p>
          ) : null}

          <button className="btn btn--primary" type="submit" disabled={busy}>
            <Icon name="log-in" className="icon" />
            {busy ? 'Connexion…' : 'Rejoindre'}
          </button>

          <p className="join__note">
            <Icon name="sparkles" className="icon" />
            Aucun compte, aucune installation.
          </p>
        </form>
      </div>
    </main>
  );
}

// ---- Écran : salle d'attente ------------------------------------------------
function WaitScreen({ pseudo, code, playerCount }) {
  return (
    <main className="screen screen--wait" aria-labelledby="wait-name">
      <div className="screen__main screen__main--center">
        <div className="player">
          <span className="player__badge">
            <Icon name="check" className="icon" />
            Tu es connecté
          </span>
          <p className="player__name" id="wait-name">{pseudo || 'Toi'}</p>
        </div>

        <div className="fire" aria-hidden="true">
          <Icon name="flame" className="icon" />
        </div>

        <div className="status" role="status" aria-live="polite">
          <p className="status__text">En attente du lancement</p>
          <span className="status__dots" aria-hidden="true">
            <span className="status__dot" />
            <span className="status__dot status__dot--2" />
            <span className="status__dot status__dot--3" />
          </span>
        </div>

        <div className="counter">
          <Icon name="users" className="icon" />
          <span className="counter__value">{fmtNum(playerCount || 0)}</span>
          <span className="counter__label">joueurs prêts</span>
        </div>

        {code ? (
          <p className="roomcode">
            <Icon name="tent" className="icon" />
            Salon <span className="roomcode__value">{code}</span>
          </p>
        ) : null}
      </div>
    </main>
  );
}

// ---- Écran : question -------------------------------------------------------
function QuestionScreen({ current, tick, score, answered, myAnswer, onAnswer }) {
  const type = current.type || 'quiz';
  const options = Array.isArray(current.options) ? current.options : [];
  const index = current.index != null ? current.index + 1 : current.number;
  const total = current.total;
  const timeLeft = tick?.timeLeft;
  const [estimate, setEstimate] = useState('');

  const keys = ['A', 'B', 'C', 'D', 'E', 'F'];
  const disabled = answered;

  return (
    <main className="screen screen--question" aria-labelledby="q-text">
      <div className="screen__main screen__main--question">
        <div className="hud">
          <div className="hud__row">
            <span className="hud__pill">
              <Icon name="check-square" className="icon" />
              Question{' '}
              <span className="hud__pill-value">
                {index != null ? index : '—'}{total != null ? ` / ${total}` : ''}
              </span>
            </span>
            <span className="hud__pill hud__pill--timer" aria-label={`Temps restant ${timeLeft ?? 0} secondes`}>
              <Icon name="clock" className="icon" />
              <span className="hud__pill-value">{timeLeft != null ? `${timeLeft} s` : '—'}</span>
            </span>
          </div>
          <div className="hud__row">
            <span className="hud__pill hud__pill--score">
              <Icon name="zap" className="icon" />
              Score <span className="hud__pill-value">{fmtNum(score)}</span>
            </span>
          </div>
          <div className="timerbar" role="progressbar" aria-label="Chrono" aria-valuenow={timeLeft ?? 0} aria-valuemin={0}>
            <div className="timerbar__fill" />
          </div>
        </div>

        <div className="question">
          {index != null && total != null ? (
            <p className="question__index">Question {index} sur {total}</p>
          ) : null}
          <h1 className="question__text" id="q-text">{current.text}</h1>
        </div>

        {answered ? (
          <div className="sent">
            <span className="sent__check" aria-hidden="true">
              <Icon name="check" className="icon" />
            </span>
            <p className="sent__text">Réponse envoyée&nbsp;!</p>
          </div>
        ) : null}

        {type === 'true_false' ? (
          <div className="answers" role="group" aria-label="Choisis ta réponse">
            {[['Vrai', true], ['Faux', false]].map(([label, val]) => (
              <button
                key={label}
                className={`answer${myAnswer === val ? ' answer--selected' : ''}`}
                type="button"
                disabled={disabled}
                onClick={() => onAnswer(val)}
              >
                <span className="answer__key" aria-hidden="true">{label === 'Vrai' ? 'V' : 'F'}</span>
                <span className="answer__label">{label}</span>
              </button>
            ))}
          </div>
        ) : type === 'estimation' ? (
          <form
            className="estimate"
            onSubmit={(e) => { e.preventDefault(); if (disabled) return; onAnswer(Number(estimate)); }}
          >
            <input
              className="join__input estimate__input"
              type="number"
              inputMode="numeric"
              placeholder="Ton estimation"
              value={estimate}
              disabled={disabled}
              onChange={(e) => setEstimate(e.target.value)}
              aria-label="Ton estimation"
            />
            <button className="btn btn--primary" type="submit" disabled={disabled || estimate === ''}>
              <Icon name="arrow-right" className="icon" />
              Envoyer
            </button>
          </form>
        ) : (
          <div className="answers" role="group" aria-label="Choisis ta réponse">
            {options.map((opt, i) => (
              <button
                key={i}
                className={`answer${myAnswer === i ? ' answer--selected' : ''}`}
                type="button"
                disabled={disabled}
                onClick={() => onAnswer(i)}
              >
                <span className="answer__key" aria-hidden="true">{keys[i] || i + 1}</span>
                <span className="answer__label">{opt}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

// ---- Mini classement (réutilisé score + fin) --------------------------------
function Board({ title, rows, playerId }) {
  if (!rows || rows.length === 0) return null;
  return (
    <section className="board" aria-label="Classement">
      <h2 className="board__title">{title}</h2>
      {rows.map((entry, i) => {
        const rank = entry.rank != null ? entry.rank : i + 1;
        const me = playerId != null && entry.id === playerId;
        const cls = `board__row${rank === 1 ? ' board__row--gold' : ''}${me ? ' board__row--me' : ''}`;
        return (
          <div className={cls} key={entry.id || i}>
            <span className="board__rank">
              {rank === 1
                ? <Icon name="trophy" className="icon" title="1re place" />
                : `${rank}.`}
            </span>
            <span className="board__name">{me ? 'Toi' : (entry.pseudo || entry.name || '—')}</span>
            <span className="board__pts">{fmtNum(entry.score)} pts</span>
          </div>
        );
      })}
    </section>
  );
}

// ---- Écran : résultat de manche --------------------------------------------
function ScoreScreen({ you, reveal, leaderboard, playerId, myAnswer }) {
  // Déterminer bon/mauvais quand la révélation le permet.
  let correct = null;
  const rv = reveal || {};
  const correctIndex = rv.correctIndex != null ? rv.correctIndex : rv.answerIndex;
  const correctValue = rv.correctValue != null ? rv.correctValue
    : (rv.answer != null ? rv.answer : rv.value);
  if (typeof rv.correct === 'boolean') {
    correct = rv.correct;
  } else if (typeof correctIndex === 'number' && typeof myAnswer === 'number') {
    correct = myAnswer === correctIndex;
  } else if (correctValue !== undefined && myAnswer != null) {
    correct = String(myAnswer) === String(correctValue);
  }

  const delta = you?.delta;
  const hasDelta = typeof delta === 'number' && delta !== 0;
  const sentText = correct === true ? 'Bonne réponse !'
    : correct === false ? 'Raté…'
    : 'Réponse envoyée !';

  return (
    <main className="screen screen--score" aria-labelledby="sent-text">
      <div className="screen__main screen__main--center">
        <div className="sent">
          <span className={`sent__check${correct === false ? ' sent__check--wrong' : ''}`} aria-hidden="true">
            <Icon name={correct === false ? 'x' : 'check'} className="icon" />
          </span>
          <h1 className="sent__text" id="sent-text">{sentText}</h1>
        </div>

        <div className="rank">
          <span className="rank__label">Ton rang</span>
          <RankValue rank={you?.rank} />
          {hasDelta ? (
            <span className="rank__delta">
              <Icon name="arrow-right" className="icon rank__delta-arrow" />
              {delta > 0 ? `+${delta}` : delta} places
            </span>
          ) : null}
        </div>

        <p className="points">
          <span className="points__value">{fmtNum(you?.score)}</span>
          <span className="points__unit">pts</span>
        </p>

        <Board title="Autour du feu" rows={(leaderboard || []).slice(0, 5)} playerId={playerId} />

        <p className="next" role="status" aria-live="polite">
          <Icon name="clock" className="icon" />
          Prochaine épreuve…
        </p>
      </div>
    </main>
  );
}

// ---- Écran : fin de partie --------------------------------------------------
function EndScreen({ you, podium, playerId }) {
  return (
    <main className="screen screen--end" aria-labelledby="end-text">
      <div className="screen__main screen__main--center">
        <div className="sent">
          <span className="sent__check" aria-hidden="true">
            <Icon name="trophy" className="icon" />
          </span>
          <h1 className="sent__text" id="end-text">Partie terminée&nbsp;!</h1>
        </div>

        <div className="rank">
          <span className="rank__label">Ton rang final</span>
          <RankValue rank={you?.rank} />
        </div>

        <p className="points">
          <span className="points__value">{fmtNum(you?.score)}</span>
          <span className="points__unit">pts</span>
        </p>

        <Board title="Podium" rows={(podium || []).slice(0, 5)} playerId={playerId} />
      </div>
    </main>
  );
}

// ---- App --------------------------------------------------------------------
export function PlayApp() {
  const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
  const urlCode = (params.get('code') || '').trim();
  const stored = urlCode ? store.load('play:' + urlCode) : null;

  const [code, setCode] = useState(urlCode);
  const [pseudo, setPseudo] = useState(stored?.pseudo || '');
  const [playerId, setPlayerId] = useState(stored?.playerId || null);
  const [playerToken, setPlayerToken] = useState(stored?.playerToken || null);
  const [myAnswer, setMyAnswer] = useState(null);

  const g = useGame(playerToken);

  // Réinitialise la sélection locale à chaque nouvelle manche.
  const roundKey = g.current ? (g.current.index ?? g.current.id ?? g.current.text) : null;
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
    setCode(joinCode);
    setPseudo(r.pseudo || joinPseudo);
    setPlayerId(r.playerId || null);
    setPlayerToken(r.playerToken);
  }

  function handleAnswer(value) {
    setMyAnswer(value);
    g.emit('play:answer', { value });
  }

  if (!playerToken) {
    return <JoinScreen initialCode={urlCode} onJoin={handleJoin} />;
  }

  const room = g.room;
  const roomCode = room?.code || code;
  const displayPseudo = g.you?.pseudo || pseudo;

  // Fin de partie.
  if (g.podium || room?.state === 'ended') {
    return <EndScreen you={g.you} podium={g.podium || g.leaderboard} playerId={playerId} />;
  }

  // Résultat d'une manche révélée.
  if (g.reveal) {
    return (
      <ScoreScreen
        you={g.you}
        reveal={g.reveal}
        leaderboard={g.leaderboard}
        playerId={playerId}
        myAnswer={myAnswer}
      />
    );
  }

  // Question en cours.
  if (g.current && room?.state !== 'waiting') {
    return (
      <QuestionScreen
        current={g.current}
        tick={g.tick}
        score={g.you?.score || 0}
        answered={g.answered === true}
        myAnswer={myAnswer}
        onAnswer={handleAnswer}
      />
    );
  }

  // Attente du lancement.
  return <WaitScreen pseudo={displayPseudo} code={roomCode} playerCount={room?.playerCount} />;
}
