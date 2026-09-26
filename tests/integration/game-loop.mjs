// Intégration — boucle de jeu complète contre le VRAI serveur (Socket.IO + REST).
// Auto-porté : démarre le serveur sur un port dédié, exécute 28 vérifications
// (issues des retours produit R1..R9), puis arrête tout. `npm run test:integration`.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { io } from 'socket.io-client';
import { GRILLES_DESSINS } from '../../src/server/dessins-grilles.js';

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
  const st1Promise = waitFor(s1, 'room:state');
  await Promise.all([host, s1, s2, s3, ov].map((s) => waitFor(s, 'connect')));

  const st1 = await st1Promise;
  check('R7 room:state joueur sans leaderboard', !('leaderboard' in st1));

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
  // LE RELEVÉ PERSONNEL S'ÉCOUTE AVANT D'ÊTRE PROVOQUÉ. Le serveur émet
  // `module:reveal` puis `play:you` dans le même souffle : attendre le premier
  // pour n'écouter le second qu'ensuite, c'est arriver après son passage. Ce
  // contrôle a échoué une fois pour cette seule raison, en accusant le serveur.
  const youCueil = waitForMatching(s1, 'play:you', (y) => y.roundId === tour2.roundId, 60000)
    .catch(() => null);
  s1.emit('play:answer', { value: carre });
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
  check('CUEILLETTE LE BROUILLON NON ENVOYÉ EST NOTÉ — et c\'est le DERNIER qui compte',
    chloe && alice && chloe.pourcent === alice.pourcent && JSON.stringify(chloe.traits) === JSON.stringify(carre),
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
