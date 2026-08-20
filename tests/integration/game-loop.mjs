// Intégration — boucle de jeu complète contre le VRAI serveur (Socket.IO + REST).
// Auto-porté : démarre le serveur sur un port dédié, exécute 28 vérifications
// (issues des retours produit R1..R9), puis arrête tout. `npm run test:integration`.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { io } from 'socket.io-client';

const PORT = 8793;
const BASE = `http://localhost:${PORT}`;
const DATA_DIR = 'tests/.data-integration';

fs.rmSync(DATA_DIR, { recursive: true, force: true });
const server = spawn(process.execPath, ['src/server/index.js'], {
  env: { ...process.env, PORT: String(PORT), DATA_DIR, HOST_EMAIL: '', NODE_ENV: '' },
  stdio: 'ignore',
});

async function waitForHealth(tries = 40) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return;
    } catch { /* pas encore prêt */ }
    await sleep(250);
  }
  throw new Error('serveur injoignable');
}

let failures = 0;
function check(label, cond, extra = '') {
  const ok = !!cond;
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  [' + extra + ']' : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function connect(token) {
  return io(BASE, { auth: { token }, transports: ['websocket'] });
}
function waitFor(socket, event, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout ' + event)), timeout);
    socket.once(event, (d) => { clearTimeout(t); resolve(d); });
  });
}

// Attend l'événement qui satisfait une CONDITION, pas simplement le prochain.
// Nécessaire pour `play:you`, que le serveur émet à chaque révélation ET à la fin
// de partie : attendre « le prochain » revient à parier sur l'ordre d'arrivée de
// deux messages voisins, ce qui a rendu ce fichier fragile.
function waitForMatching(socket, event, predicate, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error('timeout ' + event));
    }, timeout);
    function onEvent(d) {
      if (!predicate(d)) return;
      clearTimeout(t);
      socket.off(event, onEvent);
      resolve(d);
    }
    socket.on(event, onEvent);
  });
}

try {
  await waitForHealth();

  // ---- R1 : création de salon (mode dev ouvert) ----
  const roomRes = await fetch(`${BASE}/api/rooms`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  const { code, hostToken, overlayToken } = await roomRes.json();
  check("R1 salon créé par l'animateur", roomRes.ok && code && hostToken);

  // ---- R2 : join refusé sur salon inexistant ; accepté avec code + pseudo ----
  const bad = await fetch(`${BASE}/api/rooms/ZZZZZ/join`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pseudo: 'Test' }) });
  check('R2 salon inexistant refusé (404)', bad.status === 404);
  async function join(pseudo) {
    const r = await fetch(`${BASE}/api/rooms/${code}/join`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pseudo }) });
    return r.json();
  }
  const p1 = await join('Alice');
  const p2 = await join('Bob');
  const p3 = await join('Chloe');
  check('R2 join code+surnom OK', p1.playerToken && p2.playerToken && p3.playerToken);

  // ---- R4 : un JEU NOMMÉ créé au Studio est jouable en partie (action 2) ----
  // La bibliothèque est désormais une liste de jeux nommés, plus quatre seaux par
  // type — c'est l'aplatissement par type qui détruisait le nom du jeu.
  const JEU_ID = 'mod-studio-1';
  const putModules = await fetch(`${BASE}/api/modules`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      modules: [
        {
          id: JEU_ID,
          type: 'quiz',
          name: 'Culture générale',
          duration: 3,
          color: 'fire',
          questions: [{ id: 'studio-q1', text: 'Question du Studio ?', options: ['A', 'B', 'C'], correctIndex: 1, durationSec: 3 }],
        },
        {
          // Un second jeu, d'un autre type : la bibliothèque REMPLACE désormais
          // tout à l'enregistrement, donc un type absent n'est plus lançable.
          // Deux questions, pour éprouver la non-répétition.
          id: 'mod-studio-2',
          type: 'true_false',
          name: 'Vrai ou Faux',
          duration: 3,
          color: 'forest',
          questions: [
            { id: 'tf-a', text: 'Le Soleil est une étoile.', correct: true, durationSec: 3 },
            { id: 'tf-b', text: 'La Lune est une planète.', correct: false, durationSec: 3 },
          ],
        },
      ],
    }),
  });
  check('R4 PUT /api/modules accepté', putModules.ok);

  // ---- Connexions socket ----
  const host = connect(hostToken);
  const s1 = connect(p1.playerToken);
  const s2 = connect(p2.playerToken);
  const s3 = connect(p3.playerToken);
  const ov = connect(overlayToken);
  const st1Promise = waitFor(s1, 'room:state');
  await Promise.all([host, s1, s2, s3, ov].map((s) => waitFor(s, 'connect')));

  const st1 = await st1Promise;
  check('R7 room:state joueur sans leaderboard', !('leaderboard' in st1));

  // ---- R5 : sélection manuelle -> seule la question Studio est jouable ----
  host.emit('host:sessionConfig', { shuffle: false, selected: { [JEU_ID]: ['studio-q1'] } });
  await sleep(150);
  // La bibliothèque de l'animateur, telle qu'elle alimente son menu de lancement.
  const jeux = await new Promise((res) => host.emit('host:modules', {}, res));
  check('R4 le jeu nommé figure dans la bibliothèque',
    jeux.some((j) => j.id === JEU_ID && j.name === 'Culture générale'), JSON.stringify(jeux.map((j) => j.name)));

  const bank = await new Promise((res) => host.emit('host:getBank', { moduleId: JEU_ID }, res));
  // La banque est celle DU JEU, plus la fusion de toutes les questions de son type.
  check('R5 getBank ne contient que les questions du jeu', bank.length === 1, `${bank.length} questions`);
  check('R4 question studio présente dans la banque', bank.some((q) => q.id === 'studio-q1'));

  const started1 = waitFor(s1, 'module:started');
  const startedOv = waitFor(ov, 'module:started');
  host.emit('host:startModule', { moduleId: JEU_ID });
  const q1 = await started1;
  await startedOv;
  check('R4/R5 question Studio jouée en partie', q1.questionId === 'studio-q1', q1.questionId);
  check('R4 le NOM du jeu voyage jusqu\'aux écrans', q1.meta?.name === 'Culture générale', q1.meta?.name);
  check('R7 la question publique ne contient pas la bonne réponse', !('correctIndex' in q1));

  // ---- Réponses : Alice vite (bonne), Bob plus tard (bonne), Chloé mauvaise ----
  s1.emit('play:answer', { value: 1 });
  const acc1 = await waitFor(s1, 'play:accepted');
  check('réponse Alice acceptée', acc1.ok);
  await sleep(900);
  s2.emit('play:answer', { value: 1 });
  s3.emit('play:answer', { value: 0 });
  await sleep(200);
  const dup = new Promise((res) => s1.once('play:accepted', res));
  s1.emit('play:answer', { value: 2 });
  check('R7 doublon refusé', !(await dup).ok);

  // ---- R7 : à 0, révélation AUTOMATIQUE (bonne réponse + stats) ----
  const [revealP, revealOv, youA, youB, youC] = await Promise.all([
    waitFor(s1, 'module:reveal', 6000),
    waitFor(ov, 'module:reveal', 6000),
    waitFor(s1, 'play:you', 6000),
    waitFor(s2, 'play:you', 6000),
    waitFor(s3, 'play:you', 6000),
  ]);
  check('R7 révélation auto à la fin du chrono', revealP.correctIndex === 1);
  check('R8 stats de répartition diffusées', revealOv.stats && revealOv.stats.kind === 'options' && revealOv.stats.total === 3, JSON.stringify(revealOv.stats?.tally));
  check('R7 play:you sans rang en cours de partie', !('rank' in youA), JSON.stringify(youA));
  check('R7 play:you contient placesDelta', 'placesDelta' in youA);

  // ---- BARÈME (actions 8 et 17) : base + complément de vitesse, RIEN D'AUTRE ----
  // La base ne dépend plus de la rapidité : elle vaut 700 pour toute bonne
  // réponse. C'est le complément qui départage le rapide du lent.
  check('base identique quelle que soit la rapidité', youA.base === 700 && youB.base === 700, `${youA.base} vs ${youB.base}`);
  check('rapide > lent, sur le COMPLÉMENT de vitesse', youA.speed > youB.speed, `${youA.speed} vs ${youB.speed}`);
  check('supplément du plus rapide inclus dans la vitesse', youA.speed >= 150, String(youA.speed));
  // Aucune pénalité nulle part (T1) : une mauvaise réponse ne rapporte rien et
  // ne coûte rien. Et le champ « malus » n'existe plus du tout.
  check('mauvaise réponse : zéro point, aucune pénalité',
    youC.delta === 0 && youC.score === 0 && !('malus' in youC), JSON.stringify(youC));
  check('les points se lisent en deux lignes seulement',
    youA.delta === youA.base + youA.speed && !('bonus' in youA), JSON.stringify(youA));

  const late = new Promise((res) => s2.once('play:accepted', res));
  s2.emit('play:answer', { value: 1 });
  check('R7 réponse après chrono refusée', !(await late).ok);

  // La correction manuelle de score (host:adjustScore) a été SUPPRIMÉE avec le
  // panneau « Bonus / Malus » de l'écran animateur (action 8) : plus de commande,
  // donc plus rien à vérifier ici.

  // ---- SÉRIE : comptée, jamais monnayée (action 17) ----
  host.emit('host:nextModule');
  await sleep(150);
  host.emit('host:sessionConfig', { shuffle: false, selected: {} });
  const started2 = waitFor(s1, 'module:started');
  host.emit('host:startModule', { moduleType: 'true_false' }); // forme héritée : premier jeu de ce type
  const q2 = await started2;
  check('R5 vrai/faux lançable (bug truefalse corrigé)', q2.type === 'true_false', q2.questionId);
  s1.emit('play:answer', { value: true }); // tf-soleil : correct = true
  const youA2 = await waitFor(s1, 'play:you', 15000);
  // La série est SUIVIE — elle vaut deux bonnes réponses d'affilée — mais elle
  // n'ajoute plus un seul point : le total reste base + complément de vitesse.
  check('série comptée à la 2e bonne réponse', youA2.streak === 2, JSON.stringify(youA2));
  check('la série ne rapporte aucun point',
    youA2.delta === youA2.base + youA2.speed, JSON.stringify(youA2));

  // ---- R5 pas de répétition ----
  host.emit('host:nextModule');
  await sleep(100);
  const started3 = waitFor(s1, 'module:started');
  host.emit('host:startModule', { moduleType: 'true_false' }); // forme héritée : premier jeu de ce type
  const q3 = await started3;
  check('R5 pas de répétition de question', q3.questionId !== q2.questionId, `${q2.questionId} -> ${q3.questionId}`);
  host.emit('host:reveal');
  const revealEarly = await waitFor(s1, 'module:reveal');
  check('révélation anticipée animateur OK', typeof revealEarly.correct === 'boolean');

  // ---- Fin de partie : podium public + rang final ----
  const ended = waitFor(s1, 'game:ended');
  // On attend LE relevé final, reconnaissable à son drapeau — pas le prochain
  // `play:you` venu, qui peut être celui de la révélation qui précède.
  const youFinal = waitForMatching(s1, 'play:you', (y) => y.final === true);
  host.emit('host:endGame');
  const endData = await ended;
  const yf = await youFinal;
  check('podium final public', Array.isArray(endData.podium) && endData.podium.length > 0);
  check('rang final envoyé au joueur (fin de partie uniquement)', yf.final === true && yf.rank >= 1, JSON.stringify(yf));

  console.log(failures === 0 ? '\nINTEGRATION: ALL CHECKS PASSED' : `\nINTEGRATION: ${failures} CHECK(S) FAILED`);
  [host, s1, s2, s3, ov].forEach((s) => s.close());
} catch (err) {
  console.error('INTEGRATION: ERREUR —', err.message);
  failures += 1;
} finally {
  server.kill();
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
}
process.exit(failures === 0 ? 0 : 1);
