// Moteur de jeu — cycle de vie d'un module dans un salon. Le serveur est AUTORITAIRE.
// Règles d'affichage (retours produit 2026-08-18) :
//  - À la fin du chrono, la fenêtre de réponse est fermée ET la révélation est
//    automatique (bonne réponse + stats de répartition diffusées à tous).
//  - Le rang d'un joueur ne lui est JAMAIS envoyé en cours de partie : il reçoit
//    uniquement ses points gagnés et les places gagnées/perdues. Le classement
//    complet ne circule que sur le canal "staff" (animateur + stream). Le podium
//    final est public à la fin de la partie.
import { modules, histogrammeBareme, plagesEstimation, REGLES_VISAGES, valeurDuBuzz, coupeDuJoueur, auCentieme, creneauDe as creneauSerie } from './modules.js';
import { srcDeVisage } from './visages.js';
import { srcDObjet } from './objets.js';
import { momentsDuDevoilement, normaliserReponse } from './cache-cache.js';

// L'ouverture minimale de l'échelle : la demi-largeur de la plage la plus large
// du barème. Un seul endroit la calcule ici comme à la révélation, pour que les
// deux histogrammes — celui du direct et celui de la révélation — partagent
// exactement la même échelle.
function plagesDe(rt) {
  return plagesEstimation(rt.target, natureDe(rt));
}
// La nature de la réponse, blanchie. Trois valeurs, et rien d'autre : un champ
// venu d'une question mal formée ne doit pas choisir un barème au hasard.
function natureDe(rt) {
  return ['annee', 'temps', 'proportion'].includes(rt.nature) ? rt.nature : 'nombre';
}
// L'ADRESSE D'UNE IMAGE DE DÉFILÉ, quand elle en a une. « Les visages » sert des
// fichiers ; « Retour de flamme » dessine ses signes et n'a rien à servir. Le
// défilé ne connaît donc pas les deux jeux : il demande une adresse, et se
// contente de `null`.
// L'IMAGE QU'UN BUZZ DÉSIGNE. Une seule définition dans tout le projet, celle des
// visages : l'heure d'arrivée, moins la grâce du réseau, divisée par la cadence.
// La recopier ici aurait donné deux façons de compter les buzz — et la grâce, qui
// rend au visage précédent les buzz arrivés dans les premières fractions de
// seconde du suivant, est précisément ce qu'on n'a pas envie de réinventer.
function creneauDe(maintenant, startedAt, defile) {
  return creneauSerie(startedAt, maintenant, defile.cadenceMs, defile.total);
}

function adresseDe(rt, id) {
  return rt.type === 'visages' ? srcDeVisage(id) : null;
}
function margeBareme(rt) {
  return Math.max(0, ...plagesDe(rt).map((p) => p.haut - rt.target));
}
import { RoomState, roomManager } from './rooms.js';

// BARÈME (PLAN-CHANTIER, actions 8 et 17) — deux lignes, pas quatre :
//   points = BASE + COMPLÉMENT DE VITESSE
//
//  - Base : les points de la bonne réponse, indépendants de la rapidité.
//  - Complément de vitesse : croît avec la rapidité, plus 150 pour la réponse
//    correcte la plus rapide de la manche.
//
// Ce qui a disparu, et pourquoi :
//  - Le BONUS DE SÉRIE ne rapporte plus rien. Il était fusionné avec le bonus de
//    vitesse et affiché sous ce nom : un joueur en série de trois lisait « bonus
//    vitesse +100 » sans avoir été rapide, pendant que la case « série » montrait
//    « ×3 » sans le moindre point en face. La série reste SUIVIE et affichée,
//    comme une information — la reconnaissance remplace les points.
//  - Le MALUS n'existe plus, dans aucun jeu. Une mauvaise réponse ne rapporte
//    rien ; elle ne coûte rien. Contrepartie assumée : répondre au hasard est
//    gratuit, ce qui est la norme du genre et sert la participation.
// CHANTIER v4, décision 4.2 : le supplément du plus rapide est SUPPRIMÉ du calcul.
// Décision 4.5 : le plus rapide reste DÉSIGNÉ, comme information et non comme
// points — exactement le traitement que T1 du chantier v1 a réservé à la série.
// La constante disparaît ; le drapeau `fastest` la remplace dans ce que le serveur
// transmet au joueur.

// Le classement circule ENTIER vers l'animateur et le stream (action 3). Il était
// tronqué à dix en cours de partie et à cinquante à la fin : le onzième joueur
// n'arrivait jamais jusqu'à l'écran, quoi qu'on affiche. La borne qui subsiste
// n'est qu'un garde-fou contre un cas aberrant — très au-dessus de tout effectif
// réel de soirée — et jamais une règle d'affichage.
// Exporté depuis le chantier v4 : la reconnexion après la fin de partie doit
// rejouer le MÊME classement que celui envoyé à la fin (décision 3.3). Deux
// plafonds différents finiraient par diverger.
export const CLASSEMENT_MAX = 500;

// Diffusion : room Socket.IO = code du salon (tout le monde) ;
// canal staff = code + ':staff' (animateur + stream uniquement — classement).
function toRoom(io, room) {
  return io.to(room.code);
}
function toStaff(io, room) {
  return io.to(room.code + ':staff');
}

// Sous-room réservée à l'animateur (distribution des réponses en direct — jamais aux joueurs).
function toHost(io, room) {
  return io.to(room.code + ':host');
}

// Répartition agrégée des réponses en cours, alignée sur les options (jamais le détail joueur).
// Renvoyée UNIQUEMENT à l'animateur pour piloter la partie (relancer/révéler au bon moment).
export function answerDistribution(rt) {
  if (!rt) return null;
  if (rt.type === 'quiz' || rt.type === 'vote') {
    const compter = (reponses) => {
      const counts = new Array((rt.options || []).length).fill(0);
      for (const a of reponses.values()) {
        if (Number.isInteger(a.value) && a.value >= 0 && a.value < counts.length) counts[a.value] += 1;
      }
      return counts;
    };
    return {
      kind: 'options',
      counts: compter(rt.answers),
      total: rt.answers.size,
      tour: rt.tour ?? 1,
      tours: rt.tours ?? 1,
      // LE TOUR PRÉCÉDENT, POUR L'ANIMATEUR SEUL — et il lui est indispensable.
      //
      // Pendant le second tour d'un vote, ce panneau montre les PARIS. La bonne
      // réponse, elle, est sortie du premier tour : sans ce rappel, l'animateur
      // commenterait à l'antenne un jeu dont il ignore la réponse. Ce panneau ne
      // part que sur son canal (`toHost`), jamais vers les joueurs ni le stream —
      // c'est la même frontière que le nom du plus proche à l'estimation.
      precedent: rt.answersTour1
        ? { counts: compter(rt.answersTour1), total: rt.answersTour1.size }
        : null,
    };
  }
  // « CACHE-CACHE » — CE QUE L'ANIMATEUR VOIT PENDANT UNE QUESTION.
  //
  // CE QUI A ÉTÉ RAPPORTÉ : « le bloc "Répartition en direct" ne fonctionne pas.
  // Les données des joueurs ne remontent pas. » Et pour cause : ce jeu n'était
  // traité nulle part ici. Les autres types tombaient chacun dans leur branche,
  // celui-là traversait la fonction et repartait sans rien.
  //
  // DEUX FORMES DE QUESTION, DONC DEUX RÉPARTITIONS :
  //   - à choix (couleurs, numéros) : le décompte par option, comme un quiz ;
  //   - à saisie : les MOTS les plus donnés, comme « Le lien ». Un histogramme
  //     n'aurait aucun sens sur du texte libre, mais savoir que douze personnes
  //     ont écrit « marteau » et trois « tournevis », c'est exactement ce qui se
  //     commente à l'antenne.
  if (rt.type === 'cache_cache') {
    if (rt.tour <= 1) return { kind: 'options', counts: [], total: 0 };
    const pub = modules.cache_cache.publicQuestion(rt);
    if (Array.isArray(pub.options) && pub.options.length) {
      const counts = new Array(pub.options.length).fill(0);
      for (const a of rt.answers.values()) {
        if (Number.isInteger(a.value) && a.value >= 0 && a.value < counts.length) counts[a.value] += 1;
      }
      return { kind: 'options', counts, total: rt.answers.size, options: pub.options };
    }
    const groupes = new Map();
    for (const a of rt.answers.values()) {
      const mot = String(a.value ?? '').trim();
      if (!mot) continue;
      const cle = normaliserReponse(mot);
      const g = groupes.get(cle) || { mot, count: 0 };
      g.count += 1;
      groupes.set(cle, g);
    }
    return {
      kind: 'mots',
      total: rt.answers.size,
      groupes: [...groupes.values()].sort((a, b) => b.count - a.count).slice(0, 6),
    };
  }
  if (rt.type === 'true_false') {
    let t = 0, f = 0;
    for (const a of rt.answers.values()) (a.value ? t++ : f++);
    return { kind: 'boolean', counts: [f, t], total: rt.answers.size };
  }
  if (rt.type === 'estimation' || rt.type === 'juste_temps') {
    // Min / moyenne / max POUR SITUER, et l'histogramme en 8 tranches POUR VOIR :
    // la maquette animateur (A5) le spécifiait depuis le début, il n'avait jamais
    // été construit — et le serveur ne calculait même pas les tranches.
    //
    // LE JUSTE TEMPS PASSE PAR ICI TEL QUEL. Sa seule différence : la valeur d'une
    // réponse n'est pas ce que le joueur a envoyé mais ce que l'arbitre en a
    // retenu (`valeurDuBuzz`). C'est la MÊME fonction qu'à la révélation — le
    // graphique sur lequel l'animateur décide est donc bien celui qu'il commente
    // une seconde plus tard, ce qui est la raison d'être de ce panneau.
    // La valeur d'une réponse n'est pas toujours ce que le joueur a envoyé : deux
    // jeux la font arbitrer par l'horloge du serveur. C'est la MÊME fonction qu'à
    // la révélation — le graphique sur lequel l'animateur décide est donc bien
    // celui qu'il commente une seconde plus tard.
    const vals = rt.type === 'juste_temps'
      ? [...rt.answers.values()].map((a) => valeurDuBuzz(rt, a))
      : rt.type === 'coupe_buche'
        ? [...rt.answers.values()].map((a) => coupeDuJoueur(rt, a))
        : [...rt.answers.values()].map((a) => a.value);
    if (!vals.length) return { kind: 'numeric', total: 0 };
    const sum = vals.reduce((s, v) => s + v, 0);
    return {
      kind: 'numeric',
      total: vals.length,
      min: Math.min(...vals),
      max: Math.max(...vals),
      // L'ARRONDI SUIT LA NATURE. `Math.round` sur des secondes ramène une
      // moyenne de 4,68 s à « 5 » : le seul chiffre que l'animateur regarde pour
      // décider deviendrait faux d'un tiers de seconde, sur un jeu dont le
      // meilleur palier fait un dixième.
      avg: natureDe(rt) === 'temps'
        ? auCentieme(sum / vals.length)
        : Math.round(sum / vals.length),
      // L'UNITÉ, pour que l'écran sache écrire « 4,72 s » plutôt que « 5 ».
      unite: natureDe(rt) === 'temps' ? 'secondes'
        : natureDe(rt) === 'proportion' ? 'pourcent' : undefined,
      // LA MÊME ÉCHELLE, ET LES MÊMES REPÈRES, DÈS LE DIRECT.
      //
      // Ce panneau ne part QUE sur le canal de l'animateur (`toHost`, plus haut) :
      // y porter la cible et les plages ne dévoile rien de plus — il voit déjà la
      // tranche de la vérité en couleur, et la révélation rend le tout public une
      // seconde plus tard.
      //
      // Ce que ça corrige, en revanche : l'échelle et les repères CHANGEAIENT à la
      // révélation, si bien que le graphique sur lequel l'animateur décidait
      // n'était pas celui qu'il commentait ensuite.
      histogramme: histogrammeBareme(vals, rt.target, plagesDe(rt), margeBareme(rt)),
      target: rt.target,
      plages: plagesDe(rt),
      nature: natureDe(rt),
    };
  }
  return null;
}

function emitDistribution(io, room) {
  const rt = room.currentModule;
  if (!rt) return;
  toHost(io, room).emit('module:distribution', answerDistribution(rt));
}

// État public d'un salon — SANS classement (les joueurs ne doivent pas voir leur rang).
export function publicRoomState(room) {
  return {
    code: room.code,
    state: room.state,
    playerCount: room.players.size,
    progression: room.progression,
  };
}

export function emitRoomState(io, room) {
  toRoom(io, room).emit('room:state', publicRoomState(room));
  toStaff(io, room).emit('leaderboard:update', { leaderboard: roomManager.leaderboard(room, CLASSEMENT_MAX) });
}

// Lance un module avec une question. answers vidées, deadline serveur posée.
// `jeu` est le module NOMMÉ de la bibliothèque de l'animateur : { id, type, name }.
// C'est lui qui donne son nom à la manche — les écrans affichaient jusqu'ici le
// nom générique du type (« Quiz »), et celui que l'animateur avait choisi dans le
// Studio ne voyageait nulle part.
// L'ANNONCE D'UN JEU, SANS LE LANCER.
//
// « Le lien » se joue en DEUX TEMPS : l'animateur choisit le jeu — le cercle voit
// alors un écran d'annonce, comme un jingle de plateau — puis il tape ses deux
// mots et les diffuse, ce qui démarre vraiment la manche et son chrono.
//
// Aucun autre jeu n'en avait besoin : leur question sort de la bibliothèque et
// part avec le lancement. Celui-ci se prépare à l'antenne, et le temps de saisie
// de l'animateur ne doit pas être décompté du temps de jeu.
export function annoncerModule(io, room, jeu, options = {}) {
  // LE MODE VOYAGE AVEC L'ANNONCE. « Retour de flamme » se joue en −2 ou en −3, et
  // son écran d'attente MONTRE la règle : trois tuiles ou quatre. Annoncer un mode
  // et en jouer un autre serait pire que de ne rien montrer — l'animateur peut
  // changer d'avis pendant qu'il présente, et l'annonce se remet à jour.
  room.annonce = { moduleId: jeu.id, type: jeu.type, name: jeu.name, ecart: options.ecart ?? null };
  // La manche précédente n'a plus lieu d'être affichée : on annonce la suivante.
  room.currentModule = null;
  room.state = RoomState.PLAYING;
  toRoom(io, room).emit('module:annonce', room.annonce);
  emitRoomState(io, room);
  roomManager.touch(room);
}

export function startModule(io, room, jeu, question) {
  const mod = modules[jeu.type];
  if (!mod) throw new Error('module inconnu: ' + jeu.type);
  const rt = mod.buildRound(question);
  rt.moduleId = jeu.id;
  rt.moduleName = jeu.name;
  rt.answers = new Map(); // playerId -> { value, at }
  rt.startedAt = Date.now();
  rt.deadline = rt.startedAt + rt.durationMs;
  rt.revealed = false;
  rt.closed = false;
  room.currentModule = rt;
  room.state = RoomState.PLAYING;
  room.progression = {
    index: room.progression.index + 1,
    total: Math.max(room.progression.total, room.progression.index + 1),
  };
  // Identité de cette manche : voyage avec la question ET avec le résultat perso,
  // pour qu'un client sache toujours si son résultat est celui de la manche affichée.
  room.roundSeq = (room.roundSeq || 0) + 1;
  rt.roundId = room.roundSeq;
  roomManager.touch(room);

  // Question publique (sans la bonne réponse) aux joueurs + stream.
  const payload = {
    ...mod.publicQuestion(rt),
    roundId: rt.roundId,
    // Identifiant du JEU en cours : permet à l'animateur d'enchaîner « question
    // suivante » DANS CE JEU, et non dans le premier venu de ce type.
    moduleId: rt.moduleId,
    durationMs: rt.durationMs,
    deadline: rt.deadline,
    // LE TEMPS QUI RESTE, MESURÉ PAR LE SERVEUR — et pourquoi `deadline` ne
    // suffit pas.
    //
    // `deadline` est un instant de l'horloge du SERVEUR. Le client le compare à
    // la sienne, qui peut être décalée de plusieurs minutes : l'écart passe
    // inaperçu sur un chrono affiché à la seconde et arrondi vers le haut, mais
    // « Le juste temps » se joue au centième. Une horloge de téléphone en retard
    // de trois secondes y donnerait trois secondes de jeu en plus.
    //
    // `resteMs` est une DURÉE, pas un instant : le client la décompte depuis sa
    // propre réception, sans jamais comparer deux horloges. À un premier envoi
    // elle vaut la durée entière ; à un rejeu de reconnexion, ce qu'il reste.
    resteMs: Math.max(0, rt.deadline - Date.now()),
    // Le nom du JEU remplace le nom générique du type : « Culture générale »
    // plutôt que « Quiz », sur les trois écrans à la fois.
    meta: { ...mod.meta, name: jeu.name },
    index: room.progression.index,
    total: room.progression.total,
  };
  toRoom(io, room).emit('module:started', payload);
  emitRoomState(io, room);
  emitDistribution(io, room); // remet la répartition à zéro côté animateur

  // Chrono serveur : à l'échéance, fermeture + révélation AUTOMATIQUES (retour R7).
  // « Vote » y ajoute une nuance — voir `finDeFenetre` : à la fin du PREMIER tour,
  // l'échéance ouvre le second au lieu de révéler.
  armerLaFenetre(io, room, rt);
  // ---- « LES VISAGES » : LA SÉRIE PART UN VISAGE À LA FOIS ----
  //
  // Elle n'est JAMAIS envoyée d'un bloc. Trente identifiants dont un apparaît
  // deux fois, c'est la réponse en clair dans l'onglet réseau du navigateur —
  // et ce jeu ne consiste qu'à retrouver cette répétition. Le serveur reste donc
  // seul à connaître l'ordre, et pousse chaque visage à sa seconde.
  //
  // Le premier part TOUT DE SUITE : attendre deux secondes laisserait un écran
  // vide au démarrage, sur les trois surfaces à la fois.
  //
  // UN SEUL DÉFILÉ POUR LES DEUX JEUX QUI EN ONT UN. « Les visages » et « Retour
  // de flamme » font exactement la même chose : une série que le serveur seul
  // connaît, poussée image par image à cadence fixe. Le second a été écrit après
  // le premier ; en recopier la boucle aurait donné deux minuteries à corriger le
  // jour où l'une se révélera fautive — et la première l'a déjà été une fois (elle
  // s'éteignait aussitôt née, voir la note du tick ci-dessous).
  //
  // C'est la META du module qui déclare son défilé, et rien ici ne connaît les
  // deux jeux par leur nom.
  if (room._defile) clearInterval(room._defile);
  const defile = mod.meta.defile;
  if (defile && Array.isArray(rt.ordre)) {
    const pousser = (place) => {
      if (room.currentModule !== rt || rt.revealed) return;
      const id = rt.ordre[place - 1];
      toRoom(io, room).emit('serie:element', { roundId: rt.roundId, place, id, src: adresseDe(rt, id) });
    };
    pousser(1);
    let place = 1;
    room._defile = setInterval(() => {
      place += 1;
      if (place > rt.ordre.length || room.currentModule !== rt) { clearInterval(room._defile); room._defile = null; return; }
      pousser(place);
    }, defile.cadenceMs);
  }

  // LE DÉVOILEMENT DE LA GRILLE DE « CACHE-CACHE ».
  //
  // Neuf objets qui s'allument un par un, trois secondes chacun, séparés d'une
  // seconde de noir. C'est le jeu tout entier : ce qu'on a vu, et rien d'autre.
  //
  // POURQUOI LE SERVEUR LES POUSSE UN PAR UN au lieu d'envoyer la grille et de
  // laisser les écrans l'animer. Une grille envoyée d'un bloc serait LISIBLE
  // AVANT D'ÊTRE VUE : il suffirait d'ouvrir l'inspecteur pour connaître les neuf
  // objets et leurs places, et le jeu de mémoire deviendrait un jeu de copier-
  // coller. Même règle que la série des visages, pour la même raison.
  //
  // ON POUSSE AUSSI L'EXTINCTION. Laisser le client masquer après trois secondes
  // marcherait — mais une image restée allumée sur un téléphone qui a ramé
  // donnerait à son propriétaire un temps de mémorisation que les autres n'ont
  // pas. L'arbitre décide de ce qui est visible, et quand.
  if (room._grille) { for (const t of room._grille) clearTimeout(t); room._grille = null; }
  if (mod.meta.devoilementGrille && Array.isArray(rt.ordre)) {
    const parPlace = new Map((rt.matrice || []).map((o) => [o.place, o]));
    room._grille = [];
    rt.ordre.forEach((place, i) => {
      const { debut, fin } = momentsDuDevoilement(i);
      const objet = parPlace.get(place);
      room._grille.push(setTimeout(() => {
        if (room.currentModule !== rt || rt.revealed) return;
        toRoom(io, room).emit('cache:objet', {
          roundId: rt.roundId, place, id: objet.id, src: objet.src || srcDObjet(objet.id), rang: i + 1,
        });
      }, debut));
      room._grille.push(setTimeout(() => {
        if (room.currentModule !== rt || rt.revealed) return;
        toRoom(io, room).emit('cache:objet', { roundId: rt.roundId, place: null, rang: i + 1 });
      }, fin));
    });
  }

  // Tick de compte à rebours (1s) pour toutes les surfaces.
  //
  // NE PAS TOUCHER AU DÉFILÉ ICI. Partout ailleurs, arrêter le tick
  // veut dire « la manche est finie » et doit arrêter le défilé avec lui. Ici
  // NON : le défilé vient d'être armé quinze lignes plus haut, pour CETTE
  // manche. Un nettoyage posé mécaniquement à côté de chaque arrêt de tick l'a
  // éteint aussitôt né — la série restait figée sur sa première image, et le
  // jeu n'avait plus de réponse. Attrapé par le contrôle de bout en bout.
  return rt;
}

// L'ARMEMENT D'UNE FENÊTRE DE RÉPONSE — l'échéance et le tick de compte à rebours.
//
// IL EST À PART parce qu'il sert DEUX FOIS dans la même manche depuis que « Vote »
// se joue en deux tours. Le recopier aurait donné deux minuteries à corriger le
// jour où l'une se révélera fautive — et celle du défilé l'a déjà été une fois.
//
// LE DÉFILÉ N'EST PAS ARMÉ ICI, et c'est voulu : il appartient au LANCEMENT d'une
// manche, pas à l'ouverture d'une fenêtre. Un second tour ne rejoue pas la série.
function armerLaFenetre(io, room, rt) {
  if (room._timer) clearTimeout(room._timer);
  // CERTAINS JEUX N'ENCHAÎNENT PAS TOUT SEULS. « Quand les joueurs ont répondu ou
  // que le temps est écoulé pour une question, c'est à l'animateur de lancer la
  // question suivante. » La fenêtre se ferme donc — plus personne ne répond — mais
  // la manche attend. Sans quoi les cinq questions de « Cache-cache » défileraient
  // en cinquante secondes sans que personne ne les commente.
  // Le module décide TOUR PAR TOUR. « Cache-cache » n'attend personne à la fin du
  // dévoilement — la grille a une longueur fixe, il n'y a rien à commenter — mais
  // il attend entre chaque question.
  const mod = modules[rt.type];
  const attendre = typeof mod?.attendLAnimateur === 'function'
    ? mod.attendLAnimateur(rt)
    : mod?.meta?.attendreLAnimateur === true;
  room._timer = setTimeout(() => {
    if (attendre) { fermerLaFenetre(io, room); return; }
    finDeFenetre(io, room);
  }, rt.durationMs + 50);
  if (room._tick) clearInterval(room._tick);
  room._tick = setInterval(() => {
    const rem = Math.max(0, Math.ceil((room.currentModule?.deadline - Date.now()) / 1000));
    toRoom(io, room).emit('module:tick', { timeLeft: rem, answers: room.currentModule?.answers.size || 0 });
    if (rem <= 0) clearInterval(room._tick);
  }, 1000);
}

// LA FERMETURE DOUCE D'UNE FENÊTRE — le temps est écoulé, la manche continue.
//
// Elle ne fait qu'une chose : cesser d'accepter les réponses et le dire aux trois
// surfaces. C'est ce qui permet à l'écran du joueur d'afficher « Trop tard pour
// celle-là… » sans que rien n'enchaîne derrière.
function fermerLaFenetre(io, room) {
  const rt = room.currentModule;
  if (!rt || rt.revealed || rt.tourClos) return;
  rt.tourClos = true;
  if (room._tick) clearInterval(room._tick);
  toRoom(io, room).emit('module:tourClos', { roundId: rt.roundId, tour: rt.tour });
}

// LA FIN D'UNE FENÊTRE DE RÉPONSE : soit on passe au tour suivant, soit on révèle.
//
// C'EST LE SEUL ENDROIT QUI TRANCHE, et il tranche sur ce que la MANCHE déclare —
// jamais sur le nom d'un jeu. Trois chemins y mènent : l'échéance du chrono, la
// révélation anticipée de l'animateur, et rien d'autre. S'ils ne passaient pas
// tous par ici, l'animateur pourrait révéler la bonne réponse au milieu du
// premier tour et le second n'aurait plus rien à deviner.
export function finDeFenetre(io, room) {
  const rt = room.currentModule;
  if (!rt || rt.revealed) return;
  if ((rt.tours || 1) > (rt.tour || 1)) return tourSuivant(io, room);
  // « CACHE-CACHE » : LA DERNIÈRE QUESTION NE FINIT PAS LA MANCHE. Il reste cinq
  // réponses à rendre une par une, et c'est l'animateur qui les rythme. Révéler
  // ici afficherait le total de la manche avant la première réponse — la fin de
  // l'histoire avant l'histoire.
  //
  // C'EST BIEN ICI QUE ÇA SE TRANCHE, et pas dans la console : « le seul endroit
  // qui tranche, et il tranche sur ce que la MANCHE déclare ». L'écran de
  // l'animateur ne fait que nommer le bouton.
  if (modules[rt.type]?.meta?.devoilementGrille
    && (rt.devoilees || 0) < (rt.questions?.length || 0)) {
    return devoilerReponse(io, room);
  }
  return reveal(io, room);
}

// LE TOUR SUIVANT, DANS LA MÊME MANCHE.
//
// Ce n'est PAS une nouvelle manche : même `roundId`, même progression, même
// question. Ce qui change, c'est ce qu'on demande — « que penses-tu ? » puis
// « que pense le cercle ? » — et la fenêtre qui se rouvre.
//
// LES RÉPONSES DU TOUR QUI S'ACHÈVE SONT MISES DE CÔTÉ, jamais effacées : ce sont
// elles qui portent la bonne réponse, et le module les relira à la révélation.
//
// ON NE FERME PAS LA FENÊTRE (`closeWindow`) : « manche close » annoncerait aux
// trois surfaces que tout est fini, alors qu'il reste la moitié du jeu.
function tourSuivant(io, room) {
  const rt = room.currentModule;
  const mod = modules[rt.type];
  rt[`answersTour${rt.tour}`] = rt.answers;
  rt.tour += 1;
  rt.answers = new Map();
  rt.startedAt = Date.now();
  // LA DURÉE PEUT CHANGER D'UN TOUR À L'AUTRE, et un seul jeu le demande :
  // « Cache-cache » ouvre par trente-huit secondes de grille puis enchaîne cinq
  // questions de dix. Le module la déclare ; le moteur ne connaît pas les tours
  // par leur numéro.
  if (typeof mod.dureeDuTour === 'function') rt.durationMs = mod.dureeDuTour(rt);
  rt.deadline = rt.startedAt + rt.durationMs;
  rt.closed = false;
  rt.tourClos = false;
  // L'HEURE DE DÉPART DE CHAQUE TOUR, gardée. Le barème d'un jeu à plusieurs tours
  // note la rapidité de CHAQUE réponse : sans ce repère, les quatre premières
  // questions se compteraient depuis le départ du dernier tour, et vaudraient
  // toutes zéro.
  rt.debutsDeTour = { ...(rt.debutsDeTour || {}), [rt.tour]: rt.startedAt };
  roomManager.touch(room);

  // On rejoue le lancement à l'identique — c'est ce qui remet les écrans à zéro
  // (choix oublié, chrono neuf, bandeau de statut effacé) sans qu'aucune surface
  // ait besoin de connaître la notion de tour autrement que par ce champ.
  toRoom(io, room).emit('module:started', {
    ...mod.publicQuestion(rt),
    roundId: rt.roundId,
    moduleId: rt.moduleId,
    durationMs: rt.durationMs,
    deadline: rt.deadline,
    resteMs: rt.durationMs,
    meta: { ...mod.meta, name: rt.moduleName || mod.meta.name },
    index: room.progression.index,
    total: room.progression.total,
    // PERSONNE N'A ENCORE RÉPONDU À CE TOUR-CI. Sans ces deux champs, l'écran du
    // joueur resterait verrouillé sur la réponse qu'il vient de donner au tour
    // précédent — il regarderait passer le second tour sans pouvoir y jouer.
    answered: false,
    monChoix: null,
  });
  emitRoomState(io, room);
  emitDistribution(io, room);
  armerLaFenetre(io, room, rt);
}

// LE DÉVOILEMENT DES RÉPONSES, UNE PAR UNE — « CACHE-CACHE ».
//
// « Une fois que les joueurs ont répondu aux 5 questions, les réponses s'affichent
// une par une, et encore une fois, c'est l'animateur qui passe de la réponse d'une
// question à la réponse suivante. »
//
// POURQUOI LA MANCHE N'EST PAS ENCORE RÉVÉLÉE. Révéler, dans ce projet, veut dire
// une chose précise : créditer les points, nourrir les séries, recalculer les
// places, faire parler le plateau. Le faire à la première réponse dévoilée
// afficherait le total de la manche sur le téléphone du joueur avant qu'il ait vu
// les quatre autres réponses — c'est-à-dire la fin de l'histoire avant l'histoire.
// La révélation, la vraie, arrive au dernier geste : « Dévoiler la grille ».
//
// CHACUN REÇOIT SA PART, ET RIEN DE PLUS :
//   - tout le monde voit la question, sa bonne réponse et la case qu'elle désigne ;
//   - chaque joueur reçoit SON résultat sur cette question et son total courant ;
//   - l'animateur seul reçoit le classement nominatif, colonne par colonne.
export function devoilerReponse(io, room) {
  const rt = room.currentModule;
  if (!rt || rt.revealed) return;
  const mod = modules[rt.type];
  if (!mod?.meta?.devoilementGrille) return;
  // Les cinq réponses d'abord ; le sixième geste révèle la manche.
  if ((rt.devoilees || 0) >= rt.questions.length) return reveal(io, room);

  rt.devoilees = (rt.devoilees || 0) + 1;
  const n = rt.devoilees;
  const q = rt.questions[n - 1];
  const objet = rt.matrice.find((o) => o.place === q.place);
  const { detail } = mod.score(rt);

  toRoom(io, room).emit('cache:devoilement', {
    roundId: rt.roundId,
    n,
    total: rt.questions.length,
    texte: q.texte,
    reponse: q.reponse,
    place: q.place,
    objet: { id: objet.id, src: objet.src || srcDObjet(objet.id), nom: objet.nom, couleur: objet.couleur },
  });

  // À CHAQUE JOUEUR SON COMPTE. Diffuser les points de tout le monde ferait de la
  // charge utile un classement lisible par n'importe qui — et les noms n'ont
  // jamais quitté le canal de l'animateur dans ce projet.
  for (const [pid, p] of room.players) {
    if (!p.socketId) continue;
    const points = detail.get(pid) || [];
    const jusquIci = points.slice(0, n);
    io.to(p.socketId).emit('cache:tonpoint', {
      roundId: rt.roundId,
      n,
      correct: points[n - 1]?.correct === true,
      repondu: points[n - 1]?.repondu === true,
      base: points[n - 1]?.base || 0,
      speed: points[n - 1]?.speed || 0,
      total: jusquIci.reduce((s2, x) => s2 + x.base + x.speed, 0),
    });
  }

  // LE CLASSEMENT DE L'ANIMATEUR, colonne par colonne — « à chaque dévoilement,
  // une colonne de plus, et les points totaux dans la dernière ».
  const lignes = [...detail.entries()]
    .map(([pid, points]) => {
      const p = room.players.get(pid);
      if (!p) return null;
      const jusquIci = points.slice(0, n).map((x) => x.base + x.speed);
      return { pseudo: p.pseudo, points: jusquIci, total: jusquIci.reduce((a, b) => a + b, 0) };
    })
    .filter(Boolean)
    .sort((a, b) => b.total - a.total)
    .slice(0, 50);
  io.to(room.code + ':host').emit('cache:classement', { roundId: rt.roundId, n, lignes });
  roomManager.touch(room);
}

export function closeWindow(io, room) {
  const rt = room.currentModule;
  if (!rt || rt.closed) return;
  rt.closed = true;
  if (room._tick) clearInterval(room._tick);
  if (room._defile) { clearInterval(room._defile); room._defile = null; }
  if (room._grille) { for (const t of room._grille) clearTimeout(t); room._grille = null; }
  toRoom(io, room).emit('module:closed', { answers: rt.answers.size });
}

// Enregistre une réponse joueur (validée serveur, fenêtre ouverte, pas de doublon).
// À l'échéance exacte (>= deadline), la réponse est REFUSÉE.
export function submitAnswer(io, room, playerId, rawValue) {
  const rt = room.currentModule;
  if (!rt || rt.closed || rt.revealed || Date.now() >= rt.deadline) return { ok: false, reason: 'closed' };
  const player = room.players.get(playerId);
  if (!player) return { ok: false, reason: 'unknown-player' };
  const mod = modules[rt.type];

  // ---- LES JEUX OÙ L'ON BUZZE PLUSIEURS FOIS ----
  //
  // Tous les modules du projet acceptent UNE réponse et refusent la seconde. « Retour
  // de flamme » en attend six et punit les autres : lui appliquer la règle du
  // doublon le rendrait injouable — le joueur signalerait le premier retour, puis
  // regarderait passer les cinq suivants sans pouvoir rien faire.
  //
  // CE QU'UN BUZZ DÉSIGNE ICI, C'EST UNE IMAGE, et c'est le serveur qui la
  // détermine, sur l'heure d'arrivée — même doctrine que « Les visages » : « un jeu
  // de buzz se joue sur l'horloge de l'arbitre ». Le client ne pourrait rien
  // annoncer d'utile de toute façon : il reçoit les images une par une et ignore
  // lesquelles répètent.
  //
  // UNE IMAGE NE COMPTE QU'UNE FOIS. Deux buzz sur la même image sont la même
  // désignation — et sur une fenêtre de deux secondes, au doigt, sur un téléphone,
  // le second est presque toujours un rebond du premier. Les compter séparément
  // ferait perdre 200 points pour un tremblement de la main.
  if (mod.meta.multi) {
    const place = creneauDe(Date.now(), rt.startedAt, mod.meta.defile);
    const deja = rt.answers.get(playerId);
    const places = deja ? deja.value : [];
    if (places.includes(place)) return { ok: true, reason: 'deja-cette-image', place };
    places.push(place);
    rt.answers.set(playerId, { value: places, at: Date.now() });
    roomManager.touch(room);
    toRoom(io, room).emit('module:answersCount', { count: rt.answers.size });
    return { ok: true, place, buzz: places.length };
  }

  if (rt.answers.has(playerId)) return { ok: false, reason: 'already' };
  const value = mod.validateAnswer(rt, rawValue);
  if (value === null) return { ok: false, reason: 'invalid' };
  rt.answers.set(playerId, { value, at: Date.now() });
  roomManager.touch(room);
  // Compteur agrégé (jamais le détail) vers l'animateur + stream.
  toRoom(io, room).emit('module:answersCount', { count: rt.answers.size });
  // Répartition détaillée par option — animateur seulement.
  emitDistribution(io, room);

  // LE TRAIT DE COUPE, EN DIRECT — vers l'animateur et le stream, jamais vers les
  // joueurs. « Idéalement, l'écran du stream voit en temps réel les coupes
  // réalisées par les joueurs. »
  //
  // POURQUOI PAS AUX JOUEURS. Voir où les autres ont coupé pendant qu'on joue
  // encore, c'est la réponse d'à côté : les derniers à frapper viseraient le trait
  // le plus fourni plutôt que la proportion. Le canal `staff` porte déjà cette
  // frontière — c'est celui du classement.
  //
  // ET SANS AUCUN NOM : le stream est une source capturée par OBS.
  if (rt.type === 'coupe_buche') {
    toStaff(io, room).emit('coupe:trait', {
      roundId: rt.roundId,
      position: coupeDuJoueur(rt, rt.answers.get(playerId)),
    });
  }
  return { ok: true };
}

// Révélation — automatique à la fin du chrono (ou anticipée par l'animateur).
// Calcule base + complément de vitesse, met à jour scores et séries, diffuse la
// bonne réponse et les stats à tous, et envoie à chaque joueur SON delta (sans rang).
export function reveal(io, room) {
  const rt = room.currentModule;
  if (!rt || rt.revealed) return;
  if (!rt.closed) closeWindow(io, room);
  const mod = modules[rt.type];
  const ranksBefore = roomManager.rankMap(room);
  const { results, reveal: revealPayload, prives } = mod.score(rt);

  // Le caractère « noté » se lit sur la MANCHE, plus sur le type de module : un
  // vote peut être un jeu ou un sondage selon la question (action 18). Le repli
  // sur meta.scored couvre les trois autres modules, où il ne varie pas.
  const noté = rt.scored !== undefined ? rt.scored : mod.meta.scored;

  // LE PLUS RAPIDE — désigné, jamais payé (chantier v4, décisions 4.2 et 4.5).
  // Réservé aux modules où la rapidité prouve quelque chose : ni l'estimation
  // (la précision y est le seul sujet) ni le vote (on ne devine pas plus vite ce
  // que pense la salle).
  // Il ne rapporte plus de points, mais il continue d'être NOMMÉ : c'est ce
  // drapeau, et non un seuil de points, qui déclenche la phrase « le plus rapide
  // du cercle » côté joueur. Sans lui, cette phrase se dirait à quiconque répond
  // vite sans être premier — ce qu'interdit la décision 8 de l'action 7 du v1.
  let fastestPid = null;
  if (noté && mod.meta.vitesse) {
    let fastestAt = Infinity;
    for (const [pid, r] of results) {
      const a = rt.answers.get(pid);
      if (r.correct === true && a && a.at < fastestAt) {
        fastestAt = a.at;
        fastestPid = pid;
      }
    }
  }

  const perPlayer = new Map();
  for (const [pid, p] of room.players) {
    const r = results.get(pid);
    const base = r ? r.base : 0;
    // Les bonus de l'estimation voyagent à part pour que l'écran du joueur puisse
    // MONTRER le calcul. La somme se fait ici, et nulle part ailleurs.
    const bonusExact = r ? r.bonusExact || 0 : 0;
    const bonusProche = r ? r.bonusProche || 0 : 0;
    // « Le lien » : le bonus du groupe. Comme les deux autres, il voyage à part
    // pour que l'écran du joueur MONTRE son calcul — et comme les deux autres, il
    // entre dans le total ici, à l'endroit unique où la somme se fait.
    const bonusGroupe = r ? r.bonusGroupe || 0 : 0;
    let speed = r ? r.speed || 0 : 0;
    if (noté) {
      if (r && r.correct === true) {
        p.streak += 1;
      } else {
        // La série se rompt sur une mauvaise réponse ET sur une absence de
        // réponse : une manche non jouée n'est pas une bonne réponse. Elle ne
        // coûte aucun point pour autant.
        p.streak = 0;
      }
    }
    const delta = base + bonusExact + bonusProche + bonusGroupe + speed;
    p.score = Math.max(0, p.score + delta);
    perPlayer.set(pid, {
      base, bonusExact, bonusProche, bonusGroupe, speed, delta, streak: p.streak, palier: r ? r.palier : null,
      // LE VERDICT DU SERVEUR, ENVOYÉ AU JOUEUR — il ne l'était pas.
      //
      // Ce drapeau existait, il ne servait qu'à la série. L'écran du joueur, lui,
      // RECONSTITUAIT le verdict en comparant sa réponse à la révélation. Cela
      // marche tant que la réponse est comparable à quelque chose de public : une
      // option, un booléen, une cible.
      //
      // Deux jeux échappent à cette règle. « Le lien » se gagne en ayant partagé
      // son mot ; « Les visages », en ayant buzzé au bon INSTANT — deux faits que
      // la révélation ne permet pas de recalculer. Leur verdict restait donc
      // indéterminé, et l'écran affichait une COCHE VERTE au-dessus de « Manche
      // close » à un joueur qui venait de perdre.
      correct: r ? r.correct === true : null,
      // « Les visages » : avoir buzzé sur la PREMIÈRE apparition. Ce n'est ni une
      // réussite ni une erreur ordinaire, et l'écran comme la voix le disent
      // autrement.
      troppTot: r ? r.troppTot === true : false,
      // Le rang du groupe et sa taille : l'écran les nomme, la voix les cite.
      rang: r ? r.rang ?? null : null, taille: r ? r.taille ?? null : null,
      // « LE JUSTE TEMPS » : le temps que l'arbitre a retenu. Le téléphone du
      // joueur ne peut pas le recalculer — la valeur qui compte est celle que le
      // serveur a arrêtée, bornée par sa propre horloge, pas celle que l'écran
      // affichait au moment du doigt.
      valeur: r ? r.valeur ?? null : null,
      // « RETOUR DE FLAMME » : le détail du solde. Il voyage parce que l'écran du
      // joueur doit MONTRER le calcul — six bons, cinq ratés, +200 — et parce que
      // la base seule ne dit rien d'un solde ramené à zéro. Le joueur qui lit un
      // « 0 » sans savoir pourquoi ne peut pas vérifier le barème qu'on vient de
      // lui expliquer.
      bons: r ? r.bons ?? null : null,
      rates: r ? r.rates ?? null : null,
      brut: r ? r.brut ?? null : null,
      // DÉCISION 4.5 — information, pas points. C'est ce drapeau qui autorise la
      // phrase « le plus rapide du cercle », désormais qu'aucun supplément ne la
      // trahit plus par un seuil.
      fastest: pid === fastestPid,
    });
  }

  rt.revealed = true;
  room.state = RoomState.RESULTS;
  const ranksAfter = roomManager.rankMap(room);
  room.history.push({ moduleType: rt.type, text: rt.text, reveal: revealPayload, options: rt.options || null, at: Date.now() });
  rt.revealPayload = { ...revealPayload, type: rt.type }; // mémorisé pour la restauration à la reconnexion

  // Bonne réponse + stats de répartition : diffusées à TOUTES les surfaces.
  toRoom(io, room).emit('module:reveal', rt.revealPayload);
  // Classement : canal staff uniquement (animateur + stream).
  toStaff(io, room).emit('leaderboard:update', { leaderboard: roomManager.leaderboard(room, CLASSEMENT_MAX) });

  // LE NOM DU PLUS PROCHE — CANAL ANIMATEUR SEUL (chantier v4, décision 6.2).
  // Le stream est une source capturée par OBS : y faire apparaître un nom
  // romprait l'anonymat que la réunion a explicitement demandé de préserver.
  // Les `stats` publiques, elles, gardent la VALEUR sans le nom (décision 6.3).
  // LES GROUPES DU LIEN, AVEC LES NOMS — canal animateur seul.
  //
  // C'est lui qui commente à l'antenne : il lui faut savoir QUI a donné quoi. Le
  // stream reçoit les mots et leurs effectifs, jamais les noms — même frontière
  // que le plus proche de l'estimation (décision 6.2 du chantier v4).
  if (prives && Array.isArray(prives.groupes) && prives.groupes.length) {
    io.to(room.code + ':host').emit('host:groupes', {
      roundId: rt.roundId,
      groupes: prives.groupes.map((g) => ({
        mot: g.mot,
        count: g.count,
        rang: g.rang,
        joueurs: g.joueurs.map((pid) => room.players.get(pid)?.pseudo).filter(Boolean),
      })),
    });
  }

  // LE CLASSEMENT DE MANCHE, AVEC LES NOMS — CANAL ANIMATEUR SEUL.
  //
  // Le graphique dit comment le cercle s'est réparti ; il ne dit pas QUI. Sans
  // les noms, l'animateur ne peut féliciter personne — et c'est son métier. Le
  // stream, lui, ne les reçoit jamais : même frontière que le plus proche de
  // l'estimation et que les groupes du lien.
  //
  // Le module compose ses propres colonnes (un écart et un temps ici, un score et
  // des buzz ailleurs) ; le moteur n'y ajoute que le pseudo, qu'il est seul à
  // pouvoir résoudre.
  if (prives && Array.isArray(prives.classement) && prives.classement.length) {
    io.to(room.code + ':host').emit('host:classement', {
      roundId: rt.roundId,
      type: rt.type,
      lignes: prives.classement
        .map(({ pid, ...reste }) => {
          const p = room.players.get(pid);
          return p ? { pseudo: p.pseudo, ...reste } : null;
        })
        .filter(Boolean),
    });
  }

  if (prives && Array.isArray(prives.plusProches) && prives.plusProches.length) {
    io.to(room.code + ':host').emit('host:closest', {
      roundId: rt.roundId,
      // `exact` VOYAGE AVEC LE NOM (A21). L'animateur a une phrase distincte selon
      // qu'une personne est tombée PILE ou qu'elle s'est seulement le plus
      // approchée : ce n'est pas le même événement, et il ne le commente pas de la
      // même façon. Le déduire côté console en comparant la valeur à la cible
      // aurait fabriqué une seconde définition de l'exactitude, à côté de celle du
      // barème — c'est exactement ce que la décision 5.4 avait déjà refusé pour le
      // « plus proche ».
      joueurs: prives.plusProches
        .map((pid) => {
          const p = room.players.get(pid);
          const a = rt.answers.get(pid);
          return p ? { pseudo: p.pseudo, valeur: a ? a.value : null, exact: results.get(pid)?.exact === true } : null;
        })
        .filter(Boolean),
    });
  }
  emitRoomState(io, room);

  // Feedback perso à chaque joueur : points gagnés + places gagnées/perdues. JAMAIS le rang.
  // Le résultat est MÉMORISÉ avant d'être émis : sans ça, un joueur qui se
  // reconnecte (verrouillage d'écran sur mobile) ne le recevrait jamais et son
  // écran conclurait qu'il n'a pas participé (R12).
  for (const [pid, p] of room.players) {
    const d = perPlayer.get(pid) || { base: 0, bonusExact: 0, bonusProche: 0, bonusGroupe: 0, speed: 0, delta: 0, streak: p.streak, palier: null, fastest: false, exact: false, rang: null, taille: null, valeur: null, bons: null, rates: null, brut: null, correct: null, troppTot: false };
    const placesDelta = (ranksBefore.get(pid) || 0) - (ranksAfter.get(pid) || 0);
    const you = {
      roundId: rt.roundId,
      score: p.score,
      delta: d.delta,
      base: d.base,
      bonusExact: d.bonusExact,
      bonusProche: d.bonusProche,
      bonusGroupe: d.bonusGroupe,
      rang: d.rang,
      taille: d.taille,
      valeur: d.valeur ?? null,
      bons: d.bons ?? null,
      rates: d.rates ?? null,
      brut: d.brut ?? null,
      speed: d.speed,
      streak: d.streak,
      fastest: d.fastest,
      // Palier de précision atteint (estimation seulement) : porte l'affichage
      // et le message adapté à la justesse (action 7).
      palier: d.palier,
      // LA RÉPONSE EXACTE, distinguée du palier des 2 %. Elle vaut 200 points de
      // plus (décision 5.5) et n'a rien de commun avec « à deux pour cent près » :
      // l'écran lui doit ses propres mots.
      exact: d.exact === true,
      // Le verdict, tel que le SERVEUR l'a établi — voir la note de `perPlayer`.
      correct: d.correct ?? null,
      troppTot: d.troppTot === true,
      placesDelta,
    };
    // Mémorisé pour les seuls participants : un absent n'a pas de résultat à
    // revoir, il doit lire « tu n'étais pas là », pas un relevé à zéro.
    if (rt.answers.has(pid)) p.lastResult = you;
    if (p.socketId) io.to(p.socketId).emit('play:you', you);
  }
  roomManager.touch(room);
}

// La correction manuelle de score a été SUPPRIMÉE (action 8). Elle s'affichait
// sous le titre « Bonus / Malus » et permettait d'ajouter ou retirer 100 points à
// n'importe quel joueur, sans règle, sans trace et sans retour arrière — le seul
// objet du projet à porter ce nom sans avoir de règle. Conséquence assumée : plus
// aucun moyen de rattraper un score en direct si un téléphone plante.

// pause/resume supprimés (retour produit R9 du 2026-08-18).
// Retour au salon d'attente après une partie terminée. Le salon reste ouvert
// (même code, mêmes joueurs connectés) mais la séance repart à zéro : sans ça,
// l'animateur n'avait aucun moyen de relancer une soirée sans fermer le salon.
export function backToLobby(io, room) {
  if (room._timer) clearTimeout(room._timer);
  if (room._tick) clearInterval(room._tick);
  if (room._defile) { clearInterval(room._defile); room._defile = null; }
  if (room._grille) { for (const t of room._grille) clearTimeout(t); room._grille = null; }
  room.state = RoomState.WAITING;
  room.currentModule = null;
  room.history = [];
  room.progression = { index: 0, total: 0 };
  // La liste des questions déjà posées N'EST PAS remise à zéro : « jamais deux
  // fois la même question dans un même salon » vaut pour la soirée entière, pas
  // pour une partie. Elle ne se vide qu'à la fermeture du salon.
  // Les files, elles, repartent : une nouvelle partie mérite un nouvel ordre.
  room.session.queues = {};
  for (const p of room.players.values()) { p.score = 0; p.streak = 0; }
  toRoom(io, room).emit('game:lobby');
  emitRoomState(io, room);
  roomManager.touch(room);
}

export function endGame(io, room) {
  room.state = RoomState.ENDED;
  if (room._timer) clearTimeout(room._timer);
  if (room._tick) clearInterval(room._tick);
  if (room._defile) { clearInterval(room._defile); room._defile = null; }
  if (room._grille) { for (const t of room._grille) clearTimeout(t); room._grille = null; }
  const podium = roomManager.leaderboard(room, 3);
  // Fin de partie : le classement final devient public + récap des manches (B3,
  // question + révélation — jamais le détail par joueur).
  const history = room.history.map((h) => ({ type: h.moduleType, text: h.text, reveal: h.reveal, options: h.options }));
  toRoom(io, room).emit('game:ended', { podium, leaderboard: roomManager.leaderboard(room, CLASSEMENT_MAX), history });
  // Chaque joueur reçoit son rang FINAL (seul moment où le rang est envoyé).
  for (const [pid, p] of room.players) {
    if (p.socketId) {
      const rank = roomManager.rankOf(room, pid);
      io.to(p.socketId).emit('play:you', { rank: rank?.rank, score: p.score, delta: 0, final: true });
    }
  }
  emitRoomState(io, room);
  roomManager.touch(room); // fenêtre de grâce : relance possible après le podium
}
