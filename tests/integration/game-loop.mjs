// Intégration — boucle de jeu complète contre le VRAI serveur (Socket.IO + REST).
// Auto-porté : démarre le serveur sur un port dédié, exécute 28 vérifications
// (issues des retours produit R1..R9), puis arrête tout. `npm run test:integration`.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import { io } from 'socket.io-client';
import { GRILLES_DESSINS } from '../../src/server/dessins-grilles.js';
import { VILLES_CAMPEMENT } from '../../src/server/villes-campement.js';
import { copisteDe } from '../outils/copiste.js';

// UN PORT LIBRE, DEMANDÉ AU SYSTÈME — et non un port fixe (11/10). Le 8793 était
// écrit ici en dur ; le jour où un autre programme l'a occupé (un petit serveur de
// fichiers lancé à côté), le serveur du test n'a pas pu démarrer, et le contrôle
// a interrogé l'intrus à sa place avant de conclure « serveur injoignable » —
// sans rien dire de la cause. Le système attribue un port libre ; on le relâche
// aussitôt pour que le serveur du jeu le prenne.
const PORT = await new Promise((resolve, reject) => {
  const sonde = net.createServer();
  sonde.once('error', reject);
  sonde.listen(0, '127.0.0.1', () => { const { port } = sonde.address(); sonde.close(() => resolve(port)); });
});
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
        {
          // L'ORDRE TOUJOURS ALÉATOIRE (26/09). Douze questions rangées dans un
          // ordre connu : une file qui le reproduirait trahirait un ordre fixe.
          // Une chance sur douze factorielle — quatre cent soixante-dix-neuf
          // millions — qu'un vrai tirage le reproduise par hasard.
          id: 'mod-ordre',
          type: 'quiz',
          name: 'Ordre témoin',
          duration: 3,
          color: 'fire',
          questions: Array.from({ length: 12 }, (_, i) => ({
            id: `ordre-${String(i + 1).padStart(2, '0')}`, text: `Question ${i + 1} ?`, options: ['a', 'b'], correctIndex: 0, durationSec: 3,
          })),
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
  // L'écoute AVANT la connexion : le réglage de la musique part dès l'arrivée.
  const musiqueArrivee = waitFor(ov, 'stream:musique');
  const st1Promise = waitFor(s1, 'room:state');
  // LA VERSION SERVIE (26/10), annoncée à chaque écran dès sa connexion.
  const versions = [host, s1, ov].map((s) => waitFor(s, 'serveur:version'));
  // LES NOMS RÉSERVÉS À L'ANIMATEUR (26/10) : aucun téléphone ne doit les recevoir,
  // de toute la partie. Le relevé se lit à la fin.
  let fuitesNoms = 0;
  const fuiteNom = () => { fuitesNoms += 1; };
  for (const sj of [s1, s2, s3, ov]) for (const ev of ['host:bonnesReponses', 'host:visagesVotes', 'host:classement']) sj.on(ev, fuiteNom);
  const bonnesReponsesHote = [];
  host.on('host:bonnesReponses', (b) => bonnesReponsesHote.push(b));
  await Promise.all([host, s1, s2, s3, ov].map((s) => waitFor(s, 'connect')));
  const vus = await Promise.all(versions);
  check('VERSION chaque écran reçoit la version du client servi',
    vus.every((v) => v && 'client' in v) && new Set(vus.map((v) => v.client)).size === 1, JSON.stringify(vus[0]));

  const st1 = await st1Promise;
  check('R7 room:state joueur sans leaderboard', !('leaderboard' in st1));

  // ---- LA MUSIQUE D'AMBIANCE (30/09) ----
  // Le stream reçoit le réglage à sa connexion : allumée, à mi-volume.
  const m0 = await musiqueArrivee;
  check('MUSIQUE le stream reçoit le réglage à sa connexion, allumée à mi-volume',
    m0 && m0.active === true && m0.volume === 50, JSON.stringify(m0));
  // Un JOUEUR ne la règle pas : sa commande est ignorée, rien ne part.
  let intrusion = null;
  const surIntrusion = (m) => { intrusion = m; };
  ov.on('stream:musique', surIntrusion);
  s1.emit('host:musique', { active: false });
  await sleep(200);
  ov.off('stream:musique', surIntrusion);
  check('MUSIQUE un joueur ne peut pas couper la musique', intrusion === null, JSON.stringify(intrusion));
  // L'animateur la règle — et le serveur BLANCHIT ce qu'il reçoit.
  const m1 = waitFor(ov, 'stream:musique');
  host.emit('host:musique', { active: false, volume: 999 });
  const r1 = await m1;
  check('MUSIQUE l’animateur la coupe, et un volume hors bornes est ramené à 100',
    r1.active === false && r1.volume === 100, JSON.stringify(r1));
  const m2 = waitFor(ov, 'stream:musique');
  host.emit('host:musique', { active: 'oui', volume: 'fort' });
  const r2 = await m2;
  check('MUSIQUE un réglage mal formé ne change rien', r2.active === false && r2.volume === 100, JSON.stringify(r2));
  const m3 = waitFor(ov, 'stream:musique');
  host.emit('host:musique', { active: true, volume: 42.6 });
  const r3 = await m3;
  check('MUSIQUE rallumée, volume arrondi', r3.active === true && r3.volume === 43, JSON.stringify(r3));

  // ---- R5 : sélection manuelle -> seule la question Studio est jouable ----
  // La bibliothèque de l'animateur, telle qu'elle alimente son menu de lancement.
  const jeux = await new Promise((res) => host.emit('host:modules', {}, res));
  check('R4 le jeu nommé figure dans la bibliothèque',
    jeux.some((j) => j.id === JEU_ID && j.name === 'Culture générale'), JSON.stringify(jeux.map((j) => j.name)));

  // LA FILE D'UN JEU NE PORTE QUE SES QUESTIONS. Contrôle repris de l'ancien
  // `host:getBank`, parti avec la colonne « Séance » (26/09) : c'est désormais
  // la file que l'animateur voit, et elle seule.
  const fileJeu = await new Promise((res) => host.emit('host:getQueue', { moduleId: JEU_ID }, res));
  check('R5 la file ne contient que les questions du jeu', fileJeu.queue.length === 1, `${fileJeu.queue.length} questions`);
  check('R4 question studio présente dans la file', fileJeu.queue.some((q) => q.id === 'studio-q1'));

  // L'ORDRE EST TOUJOURS TIRÉ AU SORT — y compris quand un écran resté ouvert
  // réclame encore l'ordre fixe par l'ancienne commande, qui doit être IGNORÉE.
  host.emit('host:sessionConfig', { shuffle: false, selected: {} });
  await sleep(100);
  const fileOrdre = await new Promise((res) => host.emit('host:getQueue', { moduleId: 'mod-ordre' }, res));
  const rangee = Array.from({ length: 12 }, (_, i) => `ordre-${String(i + 1).padStart(2, '0')}`).join(',');
  check("l'ordre des questions est tiré au sort, sans réglage possible",
    fileOrdre.queue.length === 12 && fileOrdre.queue.map((q) => q.id).join(',') !== rangee,
    fileOrdre.queue.map((q) => q.id).join(','));

  // UN IDENTIFIANT DE QUESTION INVENTÉ NE DOIT NI PASSER, NI BLOQUER.
  //
  // Depuis le 15/09, l'animateur peut DÉSIGNER la question à poser — c'est ainsi
  // que « Question suivante » pioche dans l'onglet ouvert de la file. Il n'envoie
  // qu'un identifiant : le serveur reste seul maître des énoncés et des bonnes
  // réponses. Un identifiant qu'il ne connaît pas doit être IGNORÉ, et le tirage
  // reprendre son cours — ni porte d'entrée pour une question étrangère, ni refus
  // de départ en plein direct.
  const started1 = waitFor(s1, 'module:started');
  const startedOv = waitFor(ov, 'module:started');
  // L'IDENTIFIANT INVENTÉ VOYAGE AVEC CE DÉPART-CI, et non dans une manche à lui :
  // ce jeu n'a qu'une question, et une manche de plus l'aurait consommée — les
  // huit contrôles suivants attendaient alors une question qui ne viendrait
  // jamais. Un contrôle qui vide la réserve de ceux qui le suivent ne mesure pas
  // ce qu'il croit.
  host.emit('host:startModule', { moduleId: JEU_ID, questionId: 'question-inventee-de-nulle-part' });
  const q1 = await started1;
  check('un identifiant de question inconnu est ignoré, la manche part quand même',
    q1.questionId === 'studio-q1', q1.questionId);
  await startedOv;
  check('R4/R5 question Studio jouée en partie', q1.questionId === 'studio-q1', q1.questionId);
  check('R4 le NOM du jeu voyage jusqu\'aux écrans', q1.meta?.name === 'Culture générale', q1.meta?.name);
  check('R7 la question publique ne contient pas la bonne réponse', !('correctIndex' in q1));

  // ---- Réponses : Alice vite (bonne), Bob plus tard (bonne), Chloé mauvaise ----
  s1.emit('play:answer', { value: 1 });
  const acc1 = await waitFor(s1, 'play:accepted');
  check('réponse Alice acceptée', acc1.ok);
  // BOB RÉPOND BIEN PLUS TARD, et il le faut. Il attendait 900 ms : depuis le
  // 10/09 la courbe de rapidité commence par un PLATEAU de deux secondes, où
  // toute réponse vaut le maximum. Deux réponses séparées de 900 ms y valaient
  // donc la même chose, et le contrôle « le rapide bat le lent » ne mesurait plus
  // rien — il constatait le plateau.
  await sleep(4_500);
  s2.emit('play:answer', { value: 1 });
  s3.emit('play:answer', { value: 0 });
  await sleep(200);
  const dup = new Promise((res) => s1.once('play:accepted', res));
  s1.emit('play:answer', { value: 2 });
  check('R7 doublon refusé', !(await dup).ok);

  // ---- R7 : à 0, révélation AUTOMATIQUE (bonne réponse + stats) ----
  //
  // L'ATTENTE COUVRE LES QUINZE SECONDES DE LA FENÊTRE. Elle en couvrait six,
  // parce que les questions de ce banc portaient `durationSec: 3`. Depuis la
  // séance du 10/09, la fenêtre du quiz et du vrai/faux est une RÈGLE et non un
  // réglage — « fixer le temps pour répondre à 15 secondes » — et le champ de la
  // banque n'est plus lu. Ce contrôle attend donc la vraie fin du chrono ; c'est
  // ce qu'il prétend mesurer.
  const FIN_DU_CHRONO = 20_000;
  const [revealP, revealOv, youA, youB, youC] = await Promise.all([
    waitFor(s1, 'module:reveal', FIN_DU_CHRONO),
    waitFor(ov, 'module:reveal', FIN_DU_CHRONO),
    waitFor(s1, 'play:you', FIN_DU_CHRONO),
    waitFor(s2, 'play:you', FIN_DU_CHRONO),
    waitFor(s3, 'play:you', FIN_DU_CHRONO),
  ]);
  check('R7 révélation auto à la fin du chrono', revealP.correctIndex === 1);
  check('R8 stats de répartition diffusées', revealOv.stats && revealOv.stats.kind === 'options' && revealOv.stats.total === 3, JSON.stringify(revealOv.stats?.tally));
  check('R7 play:you sans rang en cours de partie', !('rank' in youA), JSON.stringify(youA));
  check('R7 play:you contient placesDelta', 'placesDelta' in youA);

  // ---- BARÈME (actions 8 et 17, revu le 10/09) : base + rapidité, RIEN D'AUTRE ----
  // La base ne dépend pas de la rapidité : elle vaut 250 pour toute bonne réponse
  // de quiz. C'est le bonus de rapidité qui départage le rapide du lent.
  check('base identique quelle que soit la rapidité', youA.base === 250 && youB.base === 250, `${youA.base} vs ${youB.base}`);
  check('rapide > lent, sur le BONUS DE RAPIDITÉ', youA.speed > youB.speed, `${youA.speed} vs ${youB.speed}`);
  check('le plateau haut donne son maximum à la réponse immédiate', youA.speed === 200, String(youA.speed));
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
  const started2 = waitFor(s1, 'module:started');
  // LA QUESTION EST DÉSIGNÉE : l'ordre est tiré au sort, et ce contrôle a besoin
  // de savoir que la bonne réponse est « vrai ».
  host.emit('host:startModule', { moduleType: 'true_false', questionId: 'tf-a' }); // forme héritée : premier jeu de ce type
  const q2 = await started2;
  check('R5 vrai/faux lançable (bug truefalse corrigé)', q2.type === 'true_false', q2.questionId);
  s1.emit('play:answer', { value: true }); // tf-a : correct = true
  // La révélation de cette manche est AUTOMATIQUE : elle tombe à la fin des
  // quinze secondes. Quinze secondes d'attente, c'était la limite exacte.
  const youA2 = await waitFor(s1, 'play:you', FIN_DU_CHRONO);
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

  // ---- « CUEILLETTE » : LA MANCHE ENTIÈRE, DE LA CIBLE AU PARTAGE ----
  //
  // POURQUOI ICI ET PAS EN TEST UNITAIRE. Tout ce qui suit est une affaire de
  // CHEMINS : ce que le serveur met dans une charge utile, sur quel canal, et ce
  // qu'il n'y met pas. Un test unitaire du module ne verrait rien de cela — il
  // vérifie que `score()` calcule bien, ce qu'un autre fichier fait déjà.
  //
  // DEUX DÉFAUTS RÉELS SONT NÉS DE CES CHEMINS, et ces contrôles sont écrits
  // contre eux :
  //   1. `pourcent` sortait du module et n'était PAS recopié dans le relevé
  //      personnel. L'animateur voyait « 18 % », le joueur lisait « ton dessin
  //      n'est pas arrivé à temps » au-dessus d'une cible sans son tracé ;
  //   2. la cible doit DISPARAÎTRE au second tour — y compris son adresse, sans
  //      quoi le dessin reste à un clic dans l'inspecteur du navigateur, et le
  //      jeu consiste exactement à ne plus l'avoir sous les yeux.
  const JEU_CUEIL = 'mod-cueillette';
  const putCueil = await fetch(`${BASE}/api/modules`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      // UNE BANQUE MODÉRÉE AU STUDIO (26/09) : un dessin renommé et rangé sous
      // le nom lisible de sa famille, et une ligne SANS grille, qui ne pourrait
      // pas être notée et doit être écartée plutôt que de casser la manche.
      modules: [{
        id: JEU_CUEIL, type: 'cueillette', name: 'Cueillette', duration: 40, color: 'forest',
        questions: [{
          kind: 'contenu-cueillette',
          dessins: [
            { id: 'perso-chene', nom: 'Mon chêne', famille: 'Arbres', src: '/dessins/d001.webp', grille: GRILLES_DESSINS.d001 },
            { id: 'perso-sans-grille', nom: 'Sans grille', famille: 'Arbres', src: '/dessins/d002.webp' },
          ],
        }],
      }],
    }),
  });
  check('CUEILLETTE bibliothèque acceptée', putCueil.ok);

  const menuCueil = (await new Promise((res) => host.emit('host:modules', {}, res))).find((j) => j.id === JEU_CUEIL);
  check('CUEILLETTE la console reçoit la banque DU MODULE, sans la ligne injouable',
    menuCueil?.dessins?.length === 1 && menuCueil.dessins[0].nom === 'Mon chêne',
    JSON.stringify(menuCueil?.dessins?.map((x) => x.nom)));
  check('CUEILLETTE « Arbres » rejoint la famille du dépôt, au lieu d\'en ouvrir une seconde',
    menuCueil?.dessins?.[0]?.famille === 'arbres' && menuCueil.familles.length === 1 && menuCueil.familles[0].nom === 'Arbres',
    JSON.stringify(menuCueil?.familles));
  check('CUEILLETTE LES GRILLES NE QUITTENT PAS LE SERVEUR',
    !JSON.stringify(menuCueil).includes(GRILLES_DESSINS.d001.slice(0, 40)));

  const dessins = new Promise((r) => host.once('host:dessins', r));
  const partage = new Promise((r) => ov.once('cueillette:partage', r));
  const cible = waitFor(s1, 'module:started', 12000);
  // UNE BANQUE GLISSÉE DANS LE TOP DE DÉPART EST IGNORÉE : c'est le serveur qui
  // attache celle du module. Sinon la console deviendrait une source d'images
  // pour l'antenne.
  host.emit('host:startModule', {
    moduleId: JEU_CUEIL,
    question: { id: 'cu-int', dessinId: 'perso-chene', banque: [{ id: 'perso-chene', nom: 'INTRUS', src: 'https://exemple.invalid/x.webp', grille: GRILLES_DESSINS.d050 }] },
  });
  const tour1 = await cible;
  check('CUEILLETTE tour 1 montre la cible', tour1.phase === 'cible' && !!tour1.cible?.src, JSON.stringify(tour1.cible));
  check('CUEILLETTE la cible dure dix secondes', tour1.durationMs === 10000, String(tour1.durationMs));

  const tour2 = await waitFor(s1, 'module:started', 15000);
  check('CUEILLETTE tour 2 ouvre le dessin', tour2.phase === 'dessin' && tour2.saisie === true);
  check("CUEILLETTE LA CIBLE A DISPARU, ADRESSE COMPRISE", tour2.cible === undefined, JSON.stringify(tour2.cible));

  // Deux dessins : un carré franc, et trois traits jetés dans un coin.
  const carre = [[[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8], [0.2, 0.2]]];
  const coin = [[[0.05, 0.05], [0.12, 0.09]], [[0.06, 0.1], [0.11, 0.06]]];
  // ET ALICE COPIE LE CHÊNE (07/10). Le carré et les traits ne valent rien contre
  // un chêne : le coup de cœur, plus bas, se vérifiait alors à vide — la « note du
  // meilleur » valait zéro, et rien ne pouvait bouger.
  const chene = copisteDe(GRILLES_DESSINS.d001);
  // LE RELEVÉ PERSONNEL S'ÉCOUTE AVANT D'ÊTRE PROVOQUÉ. Le serveur émet
  // `module:reveal` puis `play:you` dans le même souffle : attendre le premier
  // pour n'écouter le second qu'ensuite, c'est arriver après son passage. Ce
  // contrôle a échoué une fois pour cette seule raison, en accusant le serveur.
  const youCueil = waitForMatching(s1, 'play:you', (y) => y.roundId === tour2.roundId, 60000)
    .catch(() => null);
  s1.emit('play:answer', { value: chene });
  s2.emit('play:answer', { value: coin });
  // CHLOÉ DESSINE ET N'ENVOIE PAS (26/09) : son téléphone ne pousse que des
  // brouillons, à chaque doigt levé. À la fin du chrono, le dernier doit compter.
  s3.emit('play:brouillon', { value: coin });
  s3.emit('play:brouillon', { value: carre });
  const revCueil = await waitForMatching(s1, 'module:reveal', (r) => r.type === 'cueillette', 60000);
  const relevé = await youCueil;

  check('CUEILLETTE la révélation nomme la cible de la banque modérée', revCueil.text === 'Mon chêne', String(revCueil.text));
  check('CUEILLETTE la cible vient du serveur, pas du top de départ',
    revCueil.cible?.src === '/dessins/d001.webp' && !JSON.stringify(revCueil).includes('INTRUS'), JSON.stringify(revCueil.cible));
  check('CUEILLETTE la grille ne part pas avec la révélation', revCueil.cible && !('grille' in revCueil.cible) && !JSON.stringify(revCueil).includes(GRILLES_DESSINS.d001.slice(0, 40)));
  check('CUEILLETTE vingt tranches de cinq pour cent',
    Array.isArray(revCueil.stats?.tranches) && revCueil.stats.tranches.length === 20
    && revCueil.stats.tranches[19].haut === 100,
    String(revCueil.stats?.tranches?.length));
  check('CUEILLETTE les tranches comptent les TROIS dessins — le brouillon compris',
    revCueil.stats.tranches.reduce((a, t) => a + t.count, 0) === 3,
    String(revCueil.stats.tranches.reduce((a, t) => a + t.count, 0)));
  check('CUEILLETTE LE RELEVÉ PERSONNEL PORTE LA RESSEMBLANCE',
    relevé && typeof relevé.pourcent === 'number', JSON.stringify(relevé && { p: relevé.pourcent, b: relevé.base }));

  const d = await dessins;
  check('CUEILLETTE les dessins partent à l’animateur, avec les noms',
    Array.isArray(d.dessins) && d.dessins.length === 3 && d.dessins.every((x) => typeof x.pseudo === 'string'),
    JSON.stringify(d.dessins?.map((x) => `${x.pseudo} ${x.pourcent}%`)));
  const chloe = d.dessins.find((x) => x.pseudo === 'Chloe');
  const alice = d.dessins.find((x) => x.pseudo === 'Alice');
  // Le DERNIER brouillon se reconnaît à son tracé : le carré, pas le coin.
  check('CUEILLETTE LE BROUILLON NON ENVOYÉ EST NOTÉ — et c\'est le DERNIER qui compte',
    chloe && alice && JSON.stringify(chloe.traits) === JSON.stringify(carre),
    JSON.stringify(chloe && { p: chloe.pourcent, traits: chloe.traits.length }));
  check('CUEILLETTE le meilleur dessin est présenté en premier',
    d.dessins[0].pourcent >= d.dessins[1].pourcent,
    `${d.dessins[0].pourcent} puis ${d.dessins[1].pourcent}`);

  host.emit('host:partagerDessin', { idx: 0 });
  const p = await partage;
  check('CUEILLETTE le partage atteint le stream', !!p.dessin && Array.isArray(p.dessin.traits));
  // LE NOM PART, LA NOTE NE PART PLUS (26/09) : « faut pas qu'il y ait le
  // pourcentage de ressemblance, il faut qu'il y ait le nom d'utilisateur à la
  // place ». Le pseudonyme est celui du dessin partagé — et de lui seul.
  check('CUEILLETTE LE PARTAGE PORTE LE NOM DE SON AUTEUR, ET LUI SEUL',
    p.dessin.pseudo === d.dessins[0].pseudo
      && ['Alice', 'Bob', 'Chloe'].filter((n) => JSON.stringify(p).includes(n)).length === 1,
    JSON.stringify(p).slice(0, 160));
  check('CUEILLETTE LE PARTAGE NE PORTE PLUS LA NOTE',
    !('pourcent' in p.dessin) && !('points' in p.dessin), JSON.stringify(Object.keys(p.dessin)));

  // UN SECOND PARTAGE REMPLACE LE PREMIER : il arrive avec son propre index.
  const second = new Promise((r2) => ov.once('cueillette:partage', r2));
  host.emit('host:partagerDessin', { idx: 1 });
  const partage2 = await second;
  check('CUEILLETTE un second partage désigne le second dessin',
    partage2.idx === 1 && partage2.dessin.pseudo === d.dessins[1].pseudo,
    JSON.stringify({ idx: partage2.idx, pseudo: partage2.dessin?.pseudo }));

  const repris = new Promise((r) => ov.once('cueillette:partage', r));
  host.emit('host:partagerDessin', { idx: null });
  check('CUEILLETTE le partage se reprend', (await repris).dessin === null);

  // LE COUP DE CŒUR (07/10) — « il remplacerait sa note par la note du meilleur
  // joueur ». Bob, dont les trois traits dans un coin sont le moins bon dessin,
  // tente d'abord de se l'accorder LUI-MÊME : la commande est celle de l'animateur.
  const bob = d.dessins.find((x) => x.pseudo === 'Bob');
  const idxBob = d.dessins.indexOf(bob);
  const meilleurPts = Math.max(...d.dessins.map((x) => x.points));
  check('COUP DE CŒUR le scénario n’est pas à vide : le meilleur dessin vaut plus que celui de Bob',
    meilleurPts > bob.points && alice.points === meilleurPts, JSON.stringify(d.dessins.map((x) => `${x.pseudo} ${x.points}`)));
  const usurpe = new Promise((r) => {
    const t = setTimeout(() => r(null), 1500);
    host.once('host:coupDeCoeur', (c) => { clearTimeout(t); r(c); });
  });
  s2.emit('host:coupDeCoeur', { idx: idxBob });
  check('COUP DE CŒUR un joueur ne peut pas se l’accorder', (await usurpe) === null);

  const confirme = new Promise((r) => host.once('host:coupDeCoeur', r));
  // À L'ANTENNE (11/10) : le stream reçoit le dessin, avec la mention, et le nom.
  // Les téléphones, eux, n'en reçoivent RIEN — ils écoutent pendant toute la
  // séquence, rechargement du stream compris.
  let fuites = 0;
  const fuite = () => { fuites += 1; };
  for (const sj of [s1, s2, s3]) { sj.on('cueillette:partage', fuite); sj.on('cueillette:coupDeCoeur', fuite); }
  const antenneCoeur = new Promise((r) => ov.once('cueillette:partage', r));
  const nomCoeur = new Promise((r) => ov.once('cueillette:coupDeCoeur', r));
  const relevéBob = waitForMatching(s2, 'play:you', (y) => y.coupDeCoeur === true, 10000).catch(() => null);
  const classementCoeur = new Promise((r) => ov.once('leaderboard:update', r));
  host.emit('host:coupDeCoeur', { idx: idxBob });
  const c = await confirme;
  check('COUP DE CŒUR la console reçoit la note versée — celle du meilleur dessin',
    c.idx === idxBob && c.points === meilleurPts && c.gain === meilleurPts - bob.points && c.roundId === tour2.roundId, JSON.stringify(c));
  const yBob = await relevéBob;
  check('COUP DE CŒUR le téléphone du joueur l’apprend, calcul compris',
    yBob && yBob.roundId === tour2.roundId && yBob.base + yBob.bonusCoeur === meilleurPts && yBob.pourcent === bob.pourcent,
    JSON.stringify(yBob && { base: yBob.base, coeur: yBob.bonusCoeur, p: yBob.pourcent }));
  const surStream = await antenneCoeur;
  check('COUP DE CŒUR IL PASSE À L’ANTENNE, avec la mention et son auteur — sans sa note',
    surStream.idx === idxBob && surStream.coupDeCoeur === true && surStream.dessin?.pseudo === 'Bob'
      && !('points' in surStream.dessin) && !('pourcent' in surStream.dessin),
    JSON.stringify({ idx: surStream.idx, coeur: surStream.coupDeCoeur, pseudo: surStream.dessin?.pseudo }));
  const nom = await nomCoeur;
  check('COUP DE CŒUR le stream le nomme — un nom, pas de points',
    nom.pseudo === 'Bob' && nom.roundId === tour2.roundId && !/points|gain/.test(JSON.stringify(nom)), JSON.stringify(nom));

  // UN STREAM RECHARGÉ DANS OBS LE RETROUVE.
  const ov2 = connect(overlayToken);
  const [rejeuPartage, rejeuNom] = await Promise.all([
    waitFor(ov2, 'cueillette:partage', 5000).catch(() => null),
    waitFor(ov2, 'cueillette:coupDeCoeur', 5000).catch(() => null),
  ]);
  check('COUP DE CŒUR un stream rechargé le retrouve à l’antenne, et nommé',
    rejeuPartage?.coupDeCoeur === true && rejeuPartage.dessin?.pseudo === 'Bob' && rejeuNom?.pseudo === 'Bob',
    JSON.stringify({ coeur: rejeuPartage?.coupDeCoeur, nom: rejeuNom?.pseudo }));
  ov2.close();
  check('COUP DE CŒUR aucun téléphone ne reçoit l’antenne ni le nom', fuites === 0, String(fuites));
  for (const sj of [s1, s2, s3]) { sj.off('cueillette:partage', fuite); sj.off('cueillette:coupDeCoeur', fuite); }

  const lb = await classementCoeur;
  check('COUP DE CŒUR le classement du stream suit : Bob y porte la note du meilleur',
    lb.leaderboard?.find((x) => x.pseudo === 'Bob')?.score === yBob?.score && yBob.score >= meilleurPts,
    JSON.stringify(lb.leaderboard?.slice?.(0, 3)));

  // LE HAUT LE CŒUR (22/10) — « un malus de moins 500 au niveau de ce jeu-là ».
  // Bob porte encore le coup de cœur : le haut le cœur doit d'abord le lui retirer
  // (un même dessin ne porte pas les deux), PUIS lui ôter 500 points.
  const scoreBobAvant = yBob.score;
  const usurpeHaut = waitFor(host, 'host:hautLeCoeur', 1500).catch(() => null);
  s2.emit('host:hautLeCoeur', { idx: idxBob });
  check('HAUT LE CŒUR un joueur ne peut pas l’infliger', (await usurpeHaut) === null);

  let fuitesHaut = 0;
  const fuiteHaut = () => { fuitesHaut += 1; };
  for (const sj of [s1, s2, s3]) sj.on('cueillette:hautLeCoeur', fuiteHaut);
  const confirmeHaut = waitFor(host, 'host:hautLeCoeur', 8000).catch(() => null);
  const coeurTombe = waitForMatching(host, 'host:coupDeCoeur', (x) => x.idx === null, 8000).catch(() => null);
  const antenneHaut = waitForMatching(ov, 'cueillette:partage', (x) => x.hautLeCoeur === true, 8000).catch(() => null);
  const nomHaut = waitFor(ov, 'cueillette:hautLeCoeur', 8000).catch(() => null);
  const relevéHaut = waitForMatching(s2, 'play:you', (y) => y.hautLeCoeur === true, 8000).catch(() => null);
  host.emit('host:hautLeCoeur', { idx: idxBob });
  const h = await confirmeHaut;
  check('HAUT LE CŒUR la console reçoit le retrait — 500',
    h && h.idx === idxBob && h.retrait === 500 && h.points === bob.points - 500, JSON.stringify(h));
  check('HAUT LE CŒUR il retire d’abord le coup de cœur du même dessin', (await coeurTombe) !== null);
  const yHaut = await relevéHaut;
  check('HAUT LE CŒUR le téléphone l’apprend : le gain du coup de cœur rendu, puis 500 de moins',
    yHaut && yHaut.malusHaut === 500 && yHaut.coupDeCoeur === false && yHaut.bonusCoeur === 0
      && yHaut.score === scoreBobAvant - (meilleurPts - bob.points) - 500 && yHaut.pourcent === bob.pourcent,
    JSON.stringify(yHaut && { score: yHaut.score, avant: scoreBobAvant, malus: yHaut.malusHaut, coeur: yHaut.coupDeCoeur }));
  const aHaut = await antenneHaut;
  check('HAUT LE CŒUR IL PASSE À L’ANTENNE, avec la mention et son auteur — sans sa note',
    aHaut && aHaut.dessin?.pseudo === 'Bob' && aHaut.coupDeCoeur === false && !('points' in aHaut.dessin),
    JSON.stringify(aHaut && { coeur: aHaut.coupDeCoeur, haut: aHaut.hautLeCoeur, pseudo: aHaut.dessin?.pseudo }));
  const nh = await nomHaut;
  check('HAUT LE CŒUR le stream le nomme — un nom, pas de points',
    nh && nh.pseudo === 'Bob' && !/points|retrait|malus/.test(JSON.stringify(nh)), JSON.stringify(nh));
  const ov3 = connect(overlayToken);
  const rejeuHaut = await waitFor(ov3, 'cueillette:hautLeCoeur', 5000).catch(() => null);
  check('HAUT LE CŒUR un stream rechargé le retrouve', rejeuHaut?.pseudo === 'Bob', JSON.stringify(rejeuHaut));
  ov3.close();
  check('HAUT LE CŒUR aucun téléphone ne reçoit le nom', fuitesHaut === 0, String(fuitesHaut));
  for (const sj of [s1, s2, s3]) sj.off('cueillette:hautLeCoeur', fuiteHaut);

  // ======================================================================
  // « FRONTIÈRES » — LES CHEMINS, ET CE QUI NE DOIT PAS LES EMPRUNTER
  // ======================================================================
  //
  // POURQUOI ICI ET PAS EN TEST UNITAIRE. `tests/unit/frontieres.test.js` vérifie
  // déjà que le module calcule juste, et qu'il ne met pas la réponse dans ce
  // qu'il RETOURNE. Ce qui ne se voit que d'ici, c'est ce que le serveur met dans
  // une charge utile, SUR QUEL CANAL, et quand :
  //   1. les quatre indices ne doivent voyager qu'un par un, à leur seconde. S'ils
  //      partaient avec la manche, « Commence par un A » serait lisible dans
  //      l'onglet réseau quarante secondes avant l'heure — et le jeu n'aurait
  //      plus d'objet ;
  //   2. la base de pays part à la console et JAMAIS à un téléphone : elle
  //      contient les réponses ;
  //   3. `indicesVus` doit traverser DEUX recopies écrites à la main
  //      (`results` → `perPlayer` → `you`) pour atteindre le téléphone. C'est
  //      exactement le trajet où `pourcent` s'était perdu deux fois, en silence.
  const JEU_FR = 'mod-frontieres';
  const putFr = await fetch(`${BASE}/api/modules`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      modules: [{
        id: JEU_FR, type: 'frontieres', name: 'Frontières', duration: 45, color: 'info',
        questions: [{
          kind: 'contenu-frontieres',
          // DEUX PAYS, ET UNE LIGNE SANS NOM qui doit être écartée plutôt que de
          // casser la manche — même règle que la ligne sans grille de
          // « Cueillette » juste au-dessus.
          pays: [
            {
              id: 'f001', nom: 'Sylvanie', difficulte: 2, continent: 'Europe',
              longueur: '400 km', largeur: '300 km', frontaliers: 'Ruritanie, Latvérie',
              initiale: 'Commence par un S',
            },
            {
              id: 'f002', nom: 'Ruritanie', difficulte: 2, continent: 'Europe',
              longueur: '200 km', largeur: '150 km', frontaliers: 'Sylvanie',
              initiale: 'Commence par un R',
            },
            { id: 'f003', nom: '', difficulte: 1 },
          ],
          poses: { f001: 4, f002: 1 },
        }],
      }],
    }),
  });
  check('FRONTIÈRES bibliothèque acceptée', putFr.ok);

  const menuFr = (await new Promise((res) => host.emit('host:modules', {}, res))).find((j) => j.id === JEU_FR);
  check('FRONTIÈRES la console reçoit la base DU MODULE, sans la ligne injouable',
    menuFr?.pays?.length === 2 && menuFr.pays.map((p) => p.nom).join(',') === 'Sylvanie,Ruritanie',
    JSON.stringify(menuFr?.pays?.map((p) => p.nom)));
  check('FRONTIÈRES la console reçoit les compteurs, pour préférer les moins joués',
    menuFr?.pays?.[0]?.poses === 4 && menuFr.pays[1].poses === 1,
    JSON.stringify(menuFr?.pays?.map((p) => p.poses)));
  // « Il n'a pas besoin de voir la carte. » Ni les indices : l'animateur choisit
  // sur un nom et un compteur, et tout le reste serait du poids pour rien.
  check('FRONTIÈRES LA CONSOLE NE REÇOIT NI CARTES NI INDICES',
    !/Commence par|cartes\/|continent|frontaliers/.test(JSON.stringify(menuFr)),
    JSON.stringify(menuFr).slice(0, 200));

  // AUCUN TÉLÉPHONE N'A DE BASE DE PAYS. Elle ne circule que sur le canal de
  // l'animateur : un joueur qui la recevrait aurait les cent soixante-quinze
  // réponses et leurs indices.
  const basePourJoueur = await new Promise((res) => {
    const t = setTimeout(() => res('muet'), 1200);
    s1.emit('host:modules', {}, (r) => { clearTimeout(t); res(r); });
  });
  check('FRONTIÈRES un téléphone ne peut pas demander la base', basePourJoueur === 'muet',
    JSON.stringify(basePourJoueur).slice(0, 120));

  const frDemarre = waitFor(s1, 'module:started', 12000);
  const frIndiceOv = waitFor(ov, 'frontieres:indice', 15000).catch(() => null);
  const frIndice = waitFor(s1, 'frontieres:indice', 15000).catch(() => null);
  const frHote = waitFor(host, 'host:frontieres', 60000).catch(() => null);
  // UNE BASE GLISSÉE DANS LE TOP DE DÉPART EST IGNORÉE : c'est le serveur qui
  // attache celle du module. Sinon la console deviendrait une source de contenu
  // pour l'antenne.
  host.emit('host:startModule', {
    moduleId: JEU_FR,
    question: {
      id: 'fr-int', paysId: 'f001', difficulte: 2,
      banque: [{ id: 'f001', nom: 'INTRUS', continent: 'INTRUS', initiale: 'INTRUS' }],
    },
  });
  const manche = await frDemarre;
  check('FRONTIÈRES la manche porte la carte, et dure quarante-cinq secondes',
    typeof manche.carte === 'string' && manche.carte.includes('/cartes/') && manche.durationMs === 45000,
    JSON.stringify({ carte: manche.carte, d: manche.durationMs }));
  check('FRONTIÈRES les quatre emplacements sont déclarés par le serveur',
    Array.isArray(manche.emplacements) && manche.emplacements.length === 4
      && manche.emplacements.map((e) => e.cle).join(',') === 'continent,taille,frontaliers,initiale',
    JSON.stringify(manche.emplacements?.map((e) => e.cle)));
  check('FRONTIÈRES les noms partent pour l’aide à la saisie',
    Array.isArray(manche.noms) && manche.noms.includes('Sylvanie') && manche.noms.includes('Ruritanie'),
    JSON.stringify(manche.noms));
  // LE CŒUR DU CONTRÔLE. Le nom du pays et ses quatre indices NE SONT PAS dans
  // la charge utile de départ : ni en clair, ni dans un recoin. La base glissée
  // par la console n'y est pas non plus.
  check('FRONTIÈRES LA RÉPONSE ET LES INDICES NE PARTENT PAS AVEC LA MANCHE',
    // `noms` est MIS DE CÔTÉ avant de chercher : il porte légitimement les deux
    // noms, c'est l'aide à la saisie, et le joueur sait déjà que la réponse est
    // un pays. Tout « Sylvanie » qui subsiste ailleurs est une fuite.
    !/Sylvanie/.test(JSON.stringify({ ...manche, noms: [] }))
      && !/Commence par|Latvérie|400 km|INTRUS/.test(JSON.stringify(manche)),
    JSON.stringify({ ...manche, noms: '…' }).slice(0, 240));

  // BOB RÉPOND TOUT DE SUITE — avant le premier indice : le haut du barème.
  const youBob = waitForMatching(s2, 'play:you', (y) => y.roundId === manche.roundId, 60000).catch(() => null);
  s2.emit('play:answer', { value: 'sylvanie' });
  // LE PREMIER INDICE TOMBE À DIX SECONDES, poussé par le serveur. C'est la seule
  // façon de le prouver : l'attendre.
  const i1 = await frIndice;
  check('FRONTIÈRES le premier indice arrive au joueur, et c’est le continent',
    i1 && i1.cle === 'continent' && i1.valeur === 'Europe' && i1.roundId === manche.roundId,
    JSON.stringify(i1));
  check('FRONTIÈRES le même indice atteint l’antenne', (await frIndiceOv)?.cle === 'continent');

  // CHLOÉ CHOISIT SANS ENVOYER. « S'il ne l'envoie pas avant la fin du compteur,
  // la réponse est gardée et si elle est bonne, elle vaudra le minimum de
  // point. » Son téléphone ne pousse que des BROUILLONS, comme celui d'un
  // dessinateur de « Cueillette » : des lettres au fil de la frappe, dont seules
  // celles qui forment un pays de la banque sont retenues.
  //
  // CE CONTRÔLE NE PEUT PAS VIVRE AILLEURS : c'est la fermeture de la fenêtre qui
  // transforme le brouillon en réponse, et elle n'arrive qu'au bout de la manche.
  const youChloe = waitForMatching(s3, 'play:you', (y) => y.roundId === manche.roundId, 60000).catch(() => null);
  s3.emit('play:brouillon', { value: 'Ruri' });        // incomplet : rien à garder
  s3.emit('play:brouillon', { value: 'Ruritanie' });   // un pays : gardé

  // ALICE RÉPOND APRÈS LE PREMIER INDICE : un palier de moins.
  //
  // LES QUATRE CENTS MILLISECONDES SONT DÉLIBÉRÉES, et elles évitent un contrôle
  // instable. Le premier indice tombe à 10 000 ms du départ ; le palier, lui, se
  // lit sur le temps RESTANT, et bascule à 35 000 ms exactement — soit la même
  // seconde. Répondre dans la foulée de l'indice, c'est répondre sur la
  // frontière : selon les quelques millisecondes qui séparent `startedAt` de
  // `deadline` et selon le réseau, la réponse tomberait tantôt à 1 200 tantôt à
  // 1 000, et le contrôle accuserait le serveur une fois sur deux. On se place
  // franchement dans la bande qu'on veut mesurer.
  await sleep(400);
  const youAlice = waitForMatching(s1, 'play:you', (y) => y.roundId === manche.roundId, 60000).catch(() => null);
  s1.emit('play:answer', { value: 'Sylvanie' });

  const revFr = waitForMatching(ov, 'module:reveal', (r) => r.type === 'frontieres', 60000);
  host.emit('host:reveal');
  const rFr = await revFr;
  check('FRONTIÈRES la révélation nomme le pays, et montre sa carte',
    rFr.pays === 'Sylvanie' && typeof rFr.carte === 'string', JSON.stringify({ p: rFr.pays, c: rFr.carte }));
  check('FRONTIÈRES la révélation porte le dépouillement, trié du plus donné au moins donné',
    Array.isArray(rFr.repartition) && rFr.repartition[0].nom === 'Sylvanie' && rFr.repartition[0].n === 2
      && rFr.repartition[1].nom === 'Ruritanie' && rFr.repartition[1].n === 1,
    JSON.stringify(rFr.repartition));
  check('FRONTIÈRES LE STREAM NE REÇOIT AUCUN NOM DE JOUEUR',
    !['Alice', 'Bob', 'Chloe'].some((n) => JSON.stringify(rFr).includes(n)),
    JSON.stringify(rFr).slice(0, 200));

  const hFr = await frHote;
  check('FRONTIÈRES l’animateur reçoit les mêmes réponses, AVEC les noms',
    hFr && hFr.pays === 'Sylvanie' && hFr.reponses?.[0]?.nom === 'Sylvanie'
      && hFr.reponses[0].joueurs.length === 2 && hFr.reponses[0].juste === true
      && hFr.reponses[1].joueurs.includes('Chloe'),
    JSON.stringify(hFr?.reponses));

  const yBobFr = await youBob;
  const yAliceFr = await youAlice;
  const yChloeFr = await youChloe;
  // LE BROUILLON DE CHLOÉ EST DEVENU SA RÉPONSE, AU DERNIER PALIER.
  //
  // C'est aussi lui qui met « Ruritanie » dans le dépouillement ci-dessus : sans
  // la conversion, cette ligne n'existerait pas du tout — personne n'a envoyé ce
  // nom. Et son brouillon INCOMPLET (« Ruri ») n'a rien laissé : seul un pays de
  // la banque est retenu, ce que `validateAnswer` garantit.
  //
  // ELLE RÉPOND FAUX, DONC ELLE NE GAGNE RIEN : c'est `palierPoints` — ce que le
  // palier VALAIT — qui prouve ici « le minimum de point », et `indicesVus` à
  // quatre qui prouve qu'elle a été comptée à l'échéance et non à la frappe. Que
  // ce minimum soit bien crédité sur une BONNE réponse est tenu par le contrôle
  // unitaire « LA RÉPONSE CHOISIE SANS ÊTRE ENVOYÉE EST GARDÉE ».
  check('FRONTIÈRES LA RÉPONSE CHOISIE SANS ÊTRE ENVOYÉE EST GARDÉE, et comptée au dernier palier',
    yChloeFr && yChloeFr.reponse === 'Ruritanie' && yChloeFr.palierPoints === 300
      && yChloeFr.indicesVus === 4 && yChloeFr.base === 0,
    JSON.stringify(yChloeFr && {
      r: yChloeFr.reponse, palier: yChloeFr.palierPoints, vus: yChloeFr.indicesVus, base: yChloeFr.base,
    }));
  // CE QUI SE PERDAIT EN SILENCE SUR CE TRAJET-LÀ, pour `pourcent`, deux fois.
  check('FRONTIÈRES LE RELEVÉ PERSONNEL PORTE LE NOMBRE D’INDICES VUS',
    yBobFr && yBobFr.indicesVus === 0 && yAliceFr && yAliceFr.indicesVus === 1,
    JSON.stringify({ bob: yBobFr?.indicesVus, alice: yAliceFr?.indicesVus }));
  check('FRONTIÈRES RÉPONDRE TÔT RAPPORTE PLUS : 1200 avant le premier indice, 1000 après',
    yBobFr?.base === 1200 && yAliceFr?.base === 1000,
    JSON.stringify({ bob: yBobFr?.base, alice: yAliceFr?.base }));

  // LE COMPTEUR DU PAYS JOUÉ MONTE, ET IL EST PERMANENT : il était à 4 dans la
  // bibliothèque, il doit être à 5 — et c'est lui qui fait la préférence aux
  // moins joués au tirage suivant.
  const menuFr2 = (await new Promise((res) => host.emit('host:modules', {}, res))).find((j) => j.id === JEU_FR);
  check('FRONTIÈRES le compteur du pays joué monte de un, et reste dans la bibliothèque',
    menuFr2?.pays?.find((p) => p.nom === 'Sylvanie')?.poses === 5,
    JSON.stringify(menuFr2?.pays?.map((p) => `${p.nom} ${p.poses}`)));

  // ======================================================================
  // « CAMPEMENT » — LES CHEMINS, ET CE QUI NE DOIT PAS LES EMPRUNTER
  // ======================================================================
  //
  // Ce qui ne se voit que d'ici :
  //   1. la POSITION DE LA VILLE et l'adresse de la CARTE RÉPONSE ne partent pas
  //      avec la manche — un joueur pourrait les lire dans l'onglet réseau ;
  //   2. la base de villes ne part qu'à la console, sans cartes ni positions ;
  //   3. `exact` — le point rouge touché — traverse les deux recopies du moteur
  //      jusqu'au téléphone. Il n'y arrivait PAS, pour personne, depuis
  //      l'origine : l'estimation pile juste ne recevait jamais sa phrase ;
  //   4. le point posé sans être envoyé est compté à la fin du chrono ;
  //   5. le stream reçoit tous les points SANS les noms, la console les noms.
  //
  // LES CARTES ET LES POSITIONS SONT CELLES DU DÉPÔT (celle de `c054`), les noms
  // sont inventés : un contrôle qui attendrait « Paris » écrirait une réponse de
  // la vraie banque dans le dépôt.
  const JEU_CP = 'mod-campement';
  const vraie = VILLES_CAMPEMENT.find((v) => v.id === 'c054');
  const autre = VILLES_CAMPEMENT.find((v) => v.id === 'c002');
  const putCp = await fetch(`${BASE}/api/modules`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      modules: [{
        id: JEU_CP, type: 'campement', name: 'Campement', duration: 20, color: 'forest',
        questions: [{
          kind: 'contenu-campement',
          villes: [
            { ...vraie, ville: 'Lutèce', pays: 'Gaule', difficulte: 2 },
            { ...autre, ville: 'Cap-Rouge', pays: 'Australe', difficulte: 2 },
            // UNE LIGNE SANS CARTE RÉPONSE, donc sans position : injouable, elle
            // doit être écartée plutôt que de casser la manche.
            { id: 'ville-incomplete', ville: 'Nulle-Part', pays: 'Néant', difficulte: 2, carte: '/cartes/f003.webp' },
          ],
          poses: { c054: 2 },
        }],
      }],
    }),
  });
  check('CAMPEMENT bibliothèque acceptée (la base de villes a son schéma)', putCp.ok, String(putCp.status));

  const menuCp = (await new Promise((res) => host.emit('host:modules', {}, res))).find((j) => j.id === JEU_CP);
  check('CAMPEMENT la console reçoit la base DU MODULE, sans la ligne injouable',
    menuCp?.villes?.length === 2 && menuCp.villes.map((v) => `${v.ville}/${v.pays}`).join(',') === 'Lutèce/Gaule,Cap-Rouge/Australe',
    JSON.stringify(menuCp?.villes));
  check('CAMPEMENT la console reçoit les compteurs', menuCp?.villes?.[0]?.poses === 2 && menuCp.villes[1].poses === 0,
    JSON.stringify(menuCp?.villes?.map((v) => v.poses)));
  check('CAMPEMENT LA CONSOLE NE REÇOIT NI CARTES NI POSITIONS',
    !/cartes\/|"x"|"y"|reponse/.test(JSON.stringify(menuCp)), JSON.stringify(menuCp).slice(0, 200));

  const cpDemarre = waitFor(s1, 'module:started', 12000);
  const cpClassement = waitForMatching(host, 'host:classement', (d) => d.type === 'campement', 60000).catch(() => null);
  host.emit('host:startModule', {
    moduleId: JEU_CP,
    question: {
      id: 'cp-int', villeId: 'c054', difficulte: 2,
      // Une base glissée dans le top de départ est ignorée.
      banque: [{ id: 'c054', ville: 'INTRUS', pays: 'INTRUS', carte: '/x', reponse: '/x', x: 0.1, y: 0.1 }],
    },
  });
  const mCp = await cpDemarre;
  check('CAMPEMENT la manche porte la carte SANS ville, le pays et la ville, et dure vingt secondes',
    mCp.carte === vraie.carte && mCp.pays === 'Gaule' && mCp.ville === 'Lutèce' && mCp.durationMs === 20000
      && mCp.text === 'Retrouve le campement : Gaule – Lutèce',
    JSON.stringify({ c: mCp.carte, p: mCp.pays, v: mCp.ville, d: mCp.durationMs, t: mCp.text }));
  check('CAMPEMENT LA POSITION ET LA CARTE RÉPONSE NE PARTENT PAS AVEC LA MANCHE',
    !JSON.stringify(mCp).includes(vraie.reponse) && !JSON.stringify(mCp).includes(String(vraie.x))
      && !JSON.stringify(mCp).includes(String(vraie.y)) && !/INTRUS/.test(JSON.stringify(mCp)),
    JSON.stringify(mCp).slice(0, 240));

  // BOB POSE SON POINT PILE SUR LA VILLE ; ALICE À CINQ POUR CENT DE CARTE.
  const youBobCp = waitForMatching(s2, 'play:you', (y) => y.roundId === mCp.roundId, 60000).catch(() => null);
  const youAliceCp = waitForMatching(s1, 'play:you', (y) => y.roundId === mCp.roundId, 60000).catch(() => null);
  const youChloeCp = waitForMatching(s3, 'play:you', (y) => y.roundId === mCp.roundId, 60000).catch(() => null);
  s2.emit('play:answer', { value: { x: vraie.x, y: vraie.y } });
  s1.emit('play:answer', { value: { x: vraie.x + 0.05, y: vraie.y } });
  // CHLOÉ POSE UN POINT, LOIN, ET NE L'ENVOIE PAS. Une chaîne et une position
  // hors de la carte ne sont pas des positions : elles n'effacent rien.
  s3.emit('play:brouillon', { value: { x: 0.02, y: 0.98 } });
  s3.emit('play:brouillon', { value: '0.5,0.5' });
  s3.emit('play:brouillon', { value: { x: 1.4, y: 0.5 } });
  await sleep(300);

  const revCp = waitForMatching(ov, 'module:reveal', (r) => r.type === 'campement', 60000);
  host.emit('host:reveal');
  const rCp = await revCp;
  check('CAMPEMENT la révélation montre la carte RÉPONSE et la ville',
    rCp.carte === vraie.reponse && rCp.ville === 'Lutèce' && rCp.pays === 'Gaule'
      && rCp.cible?.x === vraie.x && rCp.cible?.y === vraie.y && rCp.rayonPoint > 0,
    JSON.stringify({ c: rCp.carte, v: rCp.ville, cible: rCp.cible, r: rCp.rayonPoint }));
  check('CAMPEMENT la révélation porte TOUS les points — le brouillon de Chloé compris',
    Array.isArray(rCp.points) && rCp.points.length === 3
      && rCp.points.some((p) => p.x === 0.02 && p.y === 0.98),
    JSON.stringify(rCp.points));
  check('CAMPEMENT la répartition : un pile, un tout près, un dehors',
    rCp.stats?.kind === 'campement' && rCp.stats.total === 3 && rCp.stats.pile === 1 && rCp.stats.dansLeCercle === 2
      && rCp.stats.tranches.map((t) => `${t.cle}:${t.n}`).join(',') === 'pile:1,proche:1,cercle:0,hors:1',
    JSON.stringify(rCp.stats));
  check('CAMPEMENT LE STREAM NE REÇOIT AUCUN NOM DE JOUEUR',
    !['Alice', 'Bob', 'Chloe'].some((n) => JSON.stringify(rCp).includes(n)), JSON.stringify(rCp).slice(0, 200));
  check('CAMPEMENT LE CERCLE DU BARÈME N’EST ENVOYÉ À PERSONNE',
    !/rayonCercle|0\.262/.test(JSON.stringify(rCp)), JSON.stringify(rCp).slice(0, 200));

  // « Il voit la liste des 10 joueurs les plus proches et les 10 plus éloignés
  // (moins de 20 joueurs : tous). » Trois joueurs : les trois, du plus proche au
  // plus loin, avec leur nom.
  const clCp = await cpClassement;
  check('CAMPEMENT la console reçoit le classement, du plus proche au plus loin, AVEC les noms',
    clCp && clCp.lignes.map((l) => l.pseudo).join(',') === 'Bob,Alice,Chloe'
      && clCp.lignes[0].points === 1200 && clCp.lignes[0].ecart === 0 && clCp.lignes[1].ecart === 5
      && clCp.masques === 0,
    JSON.stringify(clCp?.lignes));

  const yBobCp = await youBobCp;
  const yAliceCp = await youAliceCp;
  const yChloeCp = await youChloeCp;
  check('CAMPEMENT TOUCHER LE POINT ROUGE : 1100 de base, 100 d’exactitude, et le drapeau arrive au téléphone',
    yBobCp && yBobCp.base === 1100 && yBobCp.bonusExact === 100 && yBobCp.delta === 1200 && yBobCp.exact === true,
    JSON.stringify(yBobCp && { b: yBobCp.base, e: yBobCp.bonusExact, d: yBobCp.delta, x: yBobCp.exact }));
  check('CAMPEMENT plus près, plus de points : 960 à cinq pour cent de carte, sans exactitude',
    yAliceCp && yAliceCp.base === 960 && yAliceCp.bonusExact === 0 && yAliceCp.exact === false && yAliceCp.correct === true,
    JSON.stringify(yAliceCp && { b: yAliceCp.base, x: yAliceCp.exact, c: yAliceCp.correct }));
  check('CAMPEMENT LE RELEVÉ PERSONNEL PORTE LE POINT QUE L’ARBITRE A COMPTÉ',
    yAliceCp?.reponse?.x === Math.round((vraie.x + 0.05) * 1e5) / 1e5 && yAliceCp?.reponse?.y === vraie.y,
    JSON.stringify(yAliceCp?.reponse));
  check('CAMPEMENT LE POINT POSÉ SANS ÊTRE ENVOYÉ EST COMPTÉ — hors du cercle, donc zéro, mais compté',
    yChloeCp && yChloeCp.participe === true && yChloeCp.reponse?.x === 0.02 && yChloeCp.reponse?.y === 0.98
      && yChloeCp.base === 0 && yChloeCp.correct === false,
    JSON.stringify(yChloeCp && { p: yChloeCp.participe, r: yChloeCp.reponse, b: yChloeCp.base }));

  const menuCp2 = (await new Promise((res) => host.emit('host:modules', {}, res))).find((j) => j.id === JEU_CP);
  check('CAMPEMENT le compteur de la ville jouée monte de un, et reste dans la bibliothèque',
    menuCp2?.villes?.find((v) => v.id === 'c054')?.poses === 3,
    JSON.stringify(menuCp2?.villes?.map((v) => `${v.ville} ${v.poses}`)));

  // ======================================================================
  // « CHASSE AUX ÉTOILES » — LES TOUCHES, ET LE DIRECT QUI NE VA QU'À L'ANTENNE
  // ======================================================================
  //
  // Ce qui ne se voit que d'ici :
  //   1. les réglages du Studio voyagent jusqu'à la manche (et non ceux de l'écran) ;
  //   2. chaque touche revient au téléphone avec son verdict et le score tenu par
  //      l'arbitre ; un rebond ne compte pas deux fois ;
  //   3. le tableau des dix meilleurs part en direct à l'animateur et au stream,
  //      AVEC les noms — et à aucun téléphone : un joueur ne voit jamais son rang
  //      en cours de partie ;
  //   4. le relevé personnel porte les bons, les ratés et le solde, négatif compris.
  const JEU_ET = 'mod-etoiles';
  const putEt = await fetch(`${BASE}/api/modules`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      modules: [{
        id: JEU_ET, type: 'etoiles', name: 'Chasse aux étoiles', duration: 20, color: 'flame',
        questions: [{ kind: 'contenu-etoiles', reglages: { chasse: { facile: { nombre: 8, debut: 0.4, fin: 19 } } } }],
      }],
    }),
  });
  check('ÉTOILES bibliothèque acceptée (les réglages ont leur schéma)', putEt.ok, String(putEt.status));
  const menuEt = (await new Promise((res) => host.emit('host:modules', {}, res))).find((j) => j.id === JEU_ET);
  check('ÉTOILES la console reçoit les modes, les niveaux, et ce que donnera chaque combinaison — réglages du Studio compris',
    menuEt?.modesEtoiles?.length === 2 && menuEt?.niveauxEtoiles?.length === 2
      && menuEt.apercuEtoiles?.chasse?.facile?.nombre === 8 && menuEt.apercuEtoiles?.ciel?.difficile?.nombre === 60,
    JSON.stringify(menuEt?.apercuEtoiles));

  // LES TÉLÉPHONES NE DOIVENT JAMAIS RECEVOIR LE DIRECT.
  let directJoueurs = 0;
  const fuiteDirect = () => { directJoueurs += 1; };
  for (const sj of [s1, s2, s3]) sj.on('etoiles:direct', fuiteDirect);
  const directsOv = [];
  const surDirectOv = (d) => directsOv.push(d);
  ov.on('etoiles:direct', surDirectOv);
  const directHote = waitForMatching(host, 'etoiles:direct', (d) => d.lignes?.length > 0, 30000).catch(() => null);

  const etDemarre = waitFor(s1, 'module:started', 12000);
  host.emit('host:startModule', {
    moduleId: JEU_ET,
    // Une durée ou un nombre glissés dans le top de départ sont ignorés : seuls
    // le mode et le niveau viennent de l'écran.
    question: { id: 'et-int', mode: 'chasse', niveau: 'facile', reglages: { chasse: { facile: { nombre: 99, points: 9999 } } } },
  });
  const mEt = await etDemarre;
  const recuEt = Date.now();
  check('ÉTOILES la manche : vingt points, la séquence des réglages du Studio, trois secondes de compte à rebours',
    mEt.type === 'etoiles' && mEt.ciel?.length === 20 && mEt.allumages?.length === 8 && mEt.points === 60
      && mEt.compteAReboursMs === 3000 && mEt.dureeJeuMs === 20000 && mEt.durationMs > 23000,
    JSON.stringify({ c: mEt.ciel?.length, a: mEt.allumages?.length, p: mEt.points, d: mEt.durationMs }));

  // ON ATTEND QUE LA PREMIÈRE ÉTOILE SOIT ALLUMÉE — trois secondes de compte à
  // rebours, puis son début — et on la touche.
  const etA0 = mEt.allumages[0];
  await sleep(Math.max(0, 3000 + etA0.debut + 120 - (Date.now() - recuEt)));
  const etTA = etA0.debut + 100;
  const ackBob = waitFor(s2, 'play:accepted', 5000);
  s2.emit('play:answer', { value: { etoile: etA0.etoile, t: etTA } });
  const etR1 = await ackBob;
  check('ÉTOILES UNE ÉTOILE ALLUMÉE TOUCHÉE : « bon », et le score de l’arbitre revient au téléphone',
    etR1?.etoiles?.verdict === 'bon' && etR1.etoiles.score === 60 && etR1.etoiles.bons === 1 && etR1.etoiles.k === 0,
    JSON.stringify(etR1));
  const ackBob2 = waitFor(s2, 'play:accepted', 5000);
  s2.emit('play:answer', { value: { etoile: etA0.etoile, t: etTA + 40 } });
  const etR2 = await ackBob2;
  check('ÉTOILES LE REBOND NE COMPTE PAS DEUX FOIS', etR2?.etoiles?.verdict === 'deja' && etR2.etoiles.score === 60,
    JSON.stringify(etR2));
  const ackAlice = waitFor(s1, 'play:accepted', 5000);
  s1.emit('play:answer', { value: { etoile: (etA0.etoile + 1) % 20, t: etTA } });
  const etR3 = await ackAlice;
  check('ÉTOILES UN POINT ÉTEINT TOUCHÉ COÛTE', etR3?.etoiles?.verdict === 'rate' && etR3.etoiles.score === -60,
    JSON.stringify(etR3));

  const etDH = await directHote;
  check('ÉTOILES LE DIRECT ARRIVE À LA CONSOLE, avec les noms, du meilleur au pire',
    etDH && etDH.lignes[0]?.pseudo === 'Bob' && etDH.lignes[0].score === 60 && etDH.lignes.some((l) => l.pseudo === 'Alice' && l.score === -60),
    JSON.stringify(etDH?.lignes));
  await sleep(400);
  check('ÉTOILES LE DIRECT ARRIVE AU STREAM', directsOv.some((d) => d.lignes?.[0]?.pseudo === 'Bob'), JSON.stringify(directsOv.at(-1)));

  const youBobEt = waitForMatching(s2, 'play:you', (y) => y.roundId === mEt.roundId, 60000).catch(() => null);
  const youAliceEt = waitForMatching(s1, 'play:you', (y) => y.roundId === mEt.roundId, 60000).catch(() => null);
  const youChloeEt = waitForMatching(s3, 'play:you', (y) => y.roundId === mEt.roundId, 60000).catch(() => null);
  const clEt = waitForMatching(host, 'host:classement', (d) => d.type === 'etoiles', 60000).catch(() => null);
  const revEt = waitForMatching(ov, 'module:reveal', (r) => r.type === 'etoiles', 60000);
  host.emit('host:reveal');
  const etRev = await revEt;
  check('ÉTOILES la révélation porte les statistiques du cercle, sans aucun nom',
    etRev.stats?.kind === 'etoiles' && etRev.stats.total === 2 && etRev.stats.totalBons === 1 && etRev.stats.totalRates === 1
      && etRev.stats.allumages === 8 && etRev.stats.maximum === 480 && !/Alice|Bob|Chloe/.test(JSON.stringify(etRev)),
    JSON.stringify(etRev.stats));
  // UNE TOUCHE APRÈS LA FIN NE CHANGE RIEN : « les entrées reçues après la fin de
  // la manche ne doivent pas modifier le score ».
  const ackTard = waitFor(s2, 'play:accepted', 5000).catch(() => null);
  s2.emit('play:answer', { value: { etoile: etA0.etoile, t: etTA } });
  const etTard = await ackTard;
  check('ÉTOILES une touche après la fin est refusée', etTard && etTard.ok === false, JSON.stringify(etTard));

  const etYB = await youBobEt;
  const etYA = await youAliceEt;
  const etYC = await youChloeEt;
  check('ÉTOILES LE RELEVÉ PERSONNEL : bons, ratés, solde',
    etYB?.base === 60 && etYB.bons === 1 && etYB.rates === 0 && etYB.brut === 60 && etYB.correct === true
      && etYA?.bons === 0 && etYA.rates === 1 && etYA.brut === -60 && etYA.delta === -60,
    JSON.stringify({ bob: etYB && [etYB.base, etYB.bons, etYB.rates, etYB.brut], alice: etYA && [etYA.bons, etYA.rates, etYA.brut, etYA.delta] }));
  check('ÉTOILES qui n’a rien touché n’a pas participé', etYC && etYC.participe === false, JSON.stringify(etYC?.participe));
  const etCl = await clEt;
  check('ÉTOILES la console reçoit le classement de la manche, du meilleur au pire, avec bons et ratés',
    etCl && etCl.lignes.map((l) => l.pseudo).join(',') === 'Bob,Alice' && etCl.lignes[0].score === 60 && etCl.lignes[1].rates === 1,
    JSON.stringify(etCl?.lignes));
  await sleep(300);
  check('ÉTOILES le tableau final part à l’antenne', directsOv.some((d) => d.final === true && d.lignes?.[0]?.pseudo === 'Bob'),
    JSON.stringify(directsOv.at(-1)));
  check('ÉTOILES AUCUN TÉLÉPHONE NE REÇOIT LE DIRECT', directJoueurs === 0, String(directJoueurs));
  for (const sj of [s1, s2, s3]) sj.off('etoiles:direct', fuiteDirect);
  ov.off('etoiles:direct', surDirectOv);

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

  // LES BONNES RÉPONSES (26/10) : l'animateur a reçu, à chaque quiz et vrai/faux
  // révélé, les noms des bons répondants — et aucun téléphone, ni le stream.
  check('BONNES RÉPONSES l’animateur reçoit les noms, avec leur total',
    bonnesReponsesHote.length > 0 && bonnesReponsesHote.every((b) => Array.isArray(b.joueurs) && b.total === b.joueurs.length)
      && bonnesReponsesHote.some((b) => b.joueurs.length > 0),
    JSON.stringify(bonnesReponsesHote.map((b) => b.joueurs)));
  check('NOMS RÉSERVÉS aucun téléphone ni le stream ne les reçoit', fuitesNoms === 0, String(fuitesNoms));

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
