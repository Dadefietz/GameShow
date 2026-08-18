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

  // ---- R4 : une question ajoutée via /api/banks est jouable en partie ----
  const putBanks = await fetch(`${BASE}/api/banks`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ quiz: [{ id: 'studio-q1', text: 'Question du Studio ?', options: ['A', 'B', 'C'], correctIndex: 1, durationSec: 3 }] }),
  });
  check('R4 PUT /api/banks accepté', putBanks.ok);

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
  host.emit('host:sessionConfig', { shuffle: false, selected: { quiz: ['studio-q1'] } });
  await sleep(150);
  const bank = await new Promise((res) => host.emit('host:getBank', { moduleType: 'quiz' }, res));
  check('R5 getBank fusionne studio + seed', bank.length >= 23, `${bank.length} questions`);
  check('R4 question studio présente dans la banque', bank.some((q) => q.id === 'studio-q1'));

  const started1 = waitFor(s1, 'module:started');
  const startedOv = waitFor(ov, 'module:started');
  host.emit('host:startModule', { moduleType: 'quiz' });
  const q1 = await started1;
  await startedOv;
  check('R4/R5 question Studio jouée en partie', q1.questionId === 'studio-q1', q1.questionId);
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

  // ---- R3 : vitesse récompensée modérément ; R9 : bonus/malus ----
  check('R3 rapide > lent (Alice > Bob en base)', youA.base > youB.base, `${youA.base} vs ${youB.base}`);
  check('R3 dégressivité modérée (lent >= 70% base)', youB.base >= 700, String(youB.base));
  check('R9 bonus Éclair pour la plus rapide', youA.bonus >= 150, String(youA.bonus));
  check('R9 malus mauvaise réponse (-100, plancher 0)', youC.malus === -100 && youC.score === 0, JSON.stringify(youC));

  const late = new Promise((res) => s2.once('play:accepted', res));
  s2.emit('play:answer', { value: 1 });
  check('R7 réponse après chrono refusée', !(await late).ok);

  // ---- R9 : bonus/malus manuel animateur ----
  host.emit('host:adjustScore', { playerId: p3.playerId, delta: 100 });
  const lbAfterAdjust = await waitFor(host, 'leaderboard:update');
  const chloe = lbAfterAdjust.leaderboard.find((r) => r.pseudo === 'Chloe');
  check('R9 ajustement manuel appliqué', chloe && chloe.score === 100);

  // ---- R9 série : 2e bonne réponse consécutive d'Alice => bonus de série ----
  host.emit('host:nextModule');
  await sleep(150);
  host.emit('host:sessionConfig', { shuffle: false, selected: {} });
  const started2 = waitFor(s1, 'module:started');
  host.emit('host:startModule', { moduleType: 'true_false' });
  const q2 = await started2;
  check('R5 vrai/faux lançable (bug truefalse corrigé)', q2.type === 'true_false', q2.questionId);
  s1.emit('play:answer', { value: true }); // tf-soleil : correct = true
  const youA2 = await waitFor(s1, 'play:you', 15000);
  check('R9 bonus de série à la 2e bonne réponse', youA2.streak === 2 && youA2.bonus >= 50, JSON.stringify(youA2));

  // ---- R5 pas de répétition ----
  host.emit('host:nextModule');
  await sleep(100);
  const started3 = waitFor(s1, 'module:started');
  host.emit('host:startModule', { moduleType: 'true_false' });
  const q3 = await started3;
  check('R5 pas de répétition de question', q3.questionId !== q2.questionId, `${q2.questionId} -> ${q3.questionId}`);
  host.emit('host:reveal');
  const revealEarly = await waitFor(s1, 'module:reveal');
  check('révélation anticipée animateur OK', typeof revealEarly.correct === 'boolean');

  // ---- Fin de partie : podium public + rang final ----
  const ended = waitFor(s1, 'game:ended');
  const youFinal = waitFor(s1, 'play:you');
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
