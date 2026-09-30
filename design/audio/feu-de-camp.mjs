// « FEU DE CAMP » — LA MUSIQUE D'AMBIANCE DU JEU, COMPOSÉE ET RENDUE ICI (30/09).
//
// CE QUI A ÉTÉ DEMANDÉ : « un petit fond sonore en mode petite musique de camp […]
// une boucle de 2 min ».
//
// ============================================================================
// L'AMBIANCE, AVANT LES NOTES
// ============================================================================
//
// Une veillée : le soir, le feu, des amis en cercle — c'est le nom du jeu. La
// musique n'est pas le spectacle : elle passe SOUS la voix de l'animateur, pendant
// deux heures, sans jamais fatiguer. D'où quatre choix :
//   — PAS DE PERCUSSION, rien qui claque : le seul rythme est celui des cordes ;
//   — une MESURE BERCEUSE, 6/8 à 60 à la noire pointée, la marche lente des
//     chansons de veillée. Une mesure dure exactement deux secondes : soixante
//     mesures font deux minutes, à l'échantillon près ;
//   — SOL MAJEUR, la tonalité des airs de veillée et du tin whistle ;
//   — une MÉLODIE RARE, à la flûte, qui entre et sort : elle occupe la bande de
//     la voix humaine, elle doit donc se taire souvent.
//
// ET LE FEU LUI-MÊME : un souffle grave, des crépitements tirés au hasard, et au
// loin, très bas, des grillons — la nuit autour du cercle.
//
// ============================================================================
// UNE BOUCLE SANS COUTURE
// ============================================================================
//
// Tout est rendu dans un tampon CIRCULAIRE de 120 secondes : une note qui sonne
// encore à 119,5 s déborde au début, la réverbération aussi. La fin et le début
// sont donc le même instant, et la boucle ne s'entend pas.
//
// LE FICHIER PORTE UNE SECONDE DE PART ET D'AUTRE — la fin de la boucle avant, le
// début après. Un encodeur MP3 ajoute du silence en tête et en queue ; avec ces
// marges, le signal est PÉRIODIQUE sur toute sa longueur, et n'importe quelle
// fenêtre de 120 secondes s'y boucle sans raccord — même si le décodeur décale
// tout de quelques millisecondes. Le lecteur du stream boucle de 1 s à 121 s.
//
// Rendu :  node design/audio/feu-de-camp.mjs
// Sortie : src/public/audio/feu-de-camp.mp3 (+ un aperçu de 120 s, sans marges)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { note, banquesPresentes } from './echantillonneur.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const SORTIE = path.resolve(ICI, '../../src/public/audio/feu-de-camp.mp3');
const APERCU = process.env.APERCU || null;

export const SR = 44100;
export const MESURE = 2;                 // secondes — 6/8, noire pointée à 60
export const CROCHE = MESURE / 6;
export const MESURES = 60;
export const DUREE = MESURE * MESURES;   // 120 s
export const MARGE = 1;                  // s de part et d'autre, voir plus haut
const N = DUREE * SR;

// UN HASARD REPRODUCTIBLE : rendre deux fois donne deux fois le même fichier.
let graine = 20260930;
const alea = () => { graine = (graine * 1664525 + 1013904223) % 4294967296; return graine / 4294967296; };
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

// CHAQUE PISTE A SES DEUX CANAUX, circulaires. Elles ne se mélangent qu'à la fin,
// une fois MESURÉES — voir « LE MIXAGE ».
let piste = null;
const nouvellePiste = () => ({ G: new Float32Array(N), D: new Float32Array(N) });
const poser = (i, g, d) => { const k = ((i % N) + N) % N; piste.G[k] += g; piste.D[k] += d; };

// ============================================================================
// LE MIXAGE — DES NIVEAUX MESURÉS, PAS DES COEFFICIENTS AU JUGÉ
// ============================================================================
//
// LA PREMIÈRE VERSION DOSAIT CHAQUE INSTRUMENT PAR UN COEFFICIENT ÉCRIT À LA MAIN,
// et la mesure l'a démentie : le souffle du feu sortait à −14,6 dB quand la
// guitare était à −33,3 dB — DIX-NEUF DÉCIBELS AU-DESSUS de la musique, et
// presque tout sous 35 Hz, un grondement que le spectrogramme montrait en jaune
// d'un bout à l'autre. La normalisation, calée sur sa crête, écrasait le reste.
//
// Chaque piste est donc rendue SEULE, son niveau moyen mesuré, puis ramenée à un
// écart fixé par rapport au niveau brut de l'instrument de référence (le
// violoncelle depuis le 30/09, la guitare avant lui). Changer un timbre ne
// dérègle plus le mélange : le niveau est une décision, pas une conséquence.
// Les écarts en vigueur sont dans `MIXAGE`, juste en dessous, avec leur histoire.
//
// La réverbération a ses propres envois : les instruments dans la salle,
// le feu presque sec — il est à côté de nous, pas au fond de la clairière.
//
// LA COULEUR « HOBBIT » (30/09, « un petit coup de style à la hobbit dedans ») —
// la Comté, en composition ORIGINALE : on emprunte un STYLE, pas une musique. Trois
// ingrédients s'ajoutent au feu de camp :
//   — la FLÛTE joue comme un TIN WHISTLE, la flûte irlandaise : aiguë, claire,
//     et ornée comme on la joue — « cuts » (une note d'appui éclair au-dessus) et
//     « rolls » (la note tournée autour d'elle-même) ;
//   — un BOURDON sol–ré, une nappe de cordes qui s'enfle et se retire comme une
//     cornemuse au loin : le pastoral tient à cette note qui ne bouge pas ;
//   — une HARPE celtique qui égrène quelques notes aiguës au-dessus du reste,
//     quand la flûte chante.
// Toujours sans percussion : la musique reste SOUS la voix de l'animateur.
//
// PLUS DE GUITARE : UN VIOLONCELLE (30/09). « Il faut vraiment pas de guitare,
// peut-être du violoncelle. » Reculée de cinq décibels, la guitare « ressortait
// énormément » encore : c'est son ATTAQUE qui ressort, pas son niveau — chaque
// note pincée est un petit choc, dix-huit par mesure. Un violoncelle à l'archet
// tient la même place dans l'harmonie sans rien frapper. Il devient la référence
// de mesure ; la harpe reprend, doucement, le pas que la guitare marquait.
export const MIXAGE = {
  violoncelle: { ecart: 0, salle: 1.1 },
  flute: { ecart: -3, salle: 1.2 },
  harpe: { ecart: -8, salle: 1.3 },
  bourdon: { ecart: -14, salle: 1.1 },
  feu: { ecart: -10, salle: 0.25 },
  // −21 dB au premier réglage, puis −32,7 : l'écart dose le niveau MOYEN, et un
  // grillon qui chante quatre fois par tour au lieu de cent vingt voit sa moyenne
  // tomber de 11,7 dB — la normalisation aurait remonté chaque chant d'autant.
  // −32,7 garde chaque chant exactement à la force écoutée. Voir « LES GRILLONS ».
  grillons: { ecart: -32.7, salle: 1.6 },
};
export function niveau(p) {
  let e = 0;
  for (let n = 0; n < N; n += 1) { const x = (p.G[n] + p.D[n]) / 2; e += x * x; }
  return 10 * Math.log10(e / N + 1e-20);
}

// ============================================================================
// LA PARTITION
// ============================================================================
//
// Six croches par mesure. Chaque accord est écrit comme une guitare de veillée
// l'égrènerait — basse, quinte, octave, tierce, octave, quinte : la harpe y puise
// ses notes, une octave plus haut.
const ACCORDS = {
  G: [43, 50, 55, 59, 55, 50],
  Em: [40, 47, 52, 55, 52, 47],
  C: [48, 55, 62, 64, 62, 55],       // do avec la neuvième : plus doux que le do nu
  D: [50, 57, 62, 66, 62, 57],
  Am: [45, 52, 57, 60, 57, 52],
  'Am/D': [45, 52, 57, 50, 57, 62],  // la mesure qui change d'accord à mi-course
};
const THEME = ['G', 'Em', 'C', 'D', 'G', 'Em', 'Am/D', 'G'];
const PONT = ['C', 'G', 'Am', 'D', 'C', 'G', 'Am', 'D'];

// LA MÉLODIE — [croche de départ, note, durée en croches, ornement], mesure par
// mesure. Un rythme de GIGUE : longue-brève, longue-brève, le balancement des airs
// de la Comté. L'ornement : 'c' pour un cut, 'r' pour un roll.
//
// UNE MÉLODIE ORIGINALE, écrite ici : elle monte et descend par degrés dans le
// pentatonique de sol, touche le sommet (ré, mi aigus) une fois par phrase et
// revient se poser sur le sol. Aucune phrase d'un thème existant.
const M1 = [
  [[0, 74, 2], [2, 76, 1], [3, 79, 2, 'c'], [5, 81, 1]],
  [[0, 83, 3, 'c'], [3, 81, 1], [4, 79, 2]],
  [[0, 76, 2], [2, 79, 1], [3, 81, 2], [5, 79, 1]],
  [[0, 78, 2, 'c'], [2, 76, 1], [3, 74, 3]],
  [[0, 74, 2], [2, 76, 1], [3, 79, 2], [5, 83, 1]],
  [[0, 86, 3, 'c'], [3, 83, 1], [4, 81, 2]],
  [[0, 84, 2], [2, 83, 1], [3, 81, 2], [5, 78, 1]],
  [[0, 79, 6, 'r']],
];
// Le même thème, plus orné au second passage — c'est ainsi qu'un air se rejoue.
const M1b = M1.map((m, i) => (
  i === 1 ? [[0, 83, 2, 'r'], [2, 81, 1], [3, 79, 1], [4, 81, 2]]
    : i === 3 ? [[0, 78, 1], [1, 79, 1], [2, 76, 1], [3, 74, 3, 'c']]
      : i === 7 ? [[0, 79, 2, 'r'], [2, 76, 1], [3, 79, 3, 'c']] : m));
const M2 = [
  [[0, 88, 3, 'c'], [3, 86, 1], [4, 84, 2]],
  [[0, 83, 2], [2, 81, 1], [3, 79, 3, 'c']],
  [[0, 81, 2], [2, 83, 1], [3, 84, 2], [5, 88, 1]],
  [[0, 86, 4, 'r'], [4, 81, 2]],
  [[0, 79, 2], [2, 81, 1], [3, 84, 2], [5, 83, 1]],
  [[0, 83, 3, 'c'], [3, 79, 1], [4, 74, 2]],
  [[0, 76, 2], [2, 79, 1], [3, 81, 2], [5, 84, 1]],
  [[0, 81, 3], [3, 78, 3, 'c']],
];

// LA FORME — soixante mesures. Chaque section : ses accords, sa façon de jouer
// le violoncelle et la harpe, sa mélodie éventuelle et son volume.
// `violoncelle` : 'long' (une note par mesure), 'deux' (deux notes), 'marche'
// (une note de passage entre les deux). `harpe` : 'touches' (deux notes aux temps
// faibles), 'contretemps' (trois), 'arpege' (la mesure entière, égrenée).
const FORME = [
  { nom: 'intro', accords: ['G', 'C', 'G', 'D'], violoncelle: 'long', harpe: 'touches', force: 0.75, bourdon: 0.6 },
  { nom: 'theme', accords: THEME, violoncelle: 'deux', harpe: 'contretemps', force: 0.85, bourdon: 0.5 },
  { nom: 'theme + flûte', accords: THEME, violoncelle: 'deux', harpe: 'touches', force: 0.9, melodie: M1, voix: 1, bourdon: 0.7 },
  { nom: 'pont', accords: PONT, violoncelle: 'marche', harpe: 'touches', force: 0.95, melodie: M2, voix: 0.95, bourdon: 0.9 },
  { nom: 'theme orné', accords: THEME, violoncelle: 'marche', harpe: 'contretemps', force: 0.9, melodie: M1b, voix: 1, bourdon: 0.8 },
  { nom: 'respiration', accords: PONT, violoncelle: 'long', harpe: 'arpege', force: 0.75, bourdon: 1 },
  { nom: 'theme, doux', accords: THEME, violoncelle: 'deux', harpe: 'touches', force: 0.8, melodie: M1, voix: 0.7, bourdon: 0.6 },
  { nom: 'retour', accords: ['G', 'Em', 'C', 'D', 'G', 'C', 'Am', 'D'], violoncelle: 'long', harpe: 'contretemps', force: 0.75, bourdon: 0.5 },
];

// LA LIGNE DU VIOLONCELLE, accord par accord : la fondamentale, la note de
// passage, la seconde note — dans le registre grave de l'instrument (mi 1 à mi 2).
const LIGNE = {
  G: [43, 45, 50],
  Em: [40, 42, 47],
  C: [48, 47, 43],
  D: [50, 48, 45],
  Am: [45, 47, 52],
  'Am/D': [45, 47, 50],
};
const total = FORME.reduce((n, s) => n + s.accords.length, 0);
if (total !== MESURES) throw new Error(`La forme fait ${total} mesures, pas ${MESURES}.`);

// ============================================================================
// LES INSTRUMENTS
// ============================================================================
//
// DE VRAIS INSTRUMENTS, ENREGISTRÉS (30/09). « Je pense que tu n'as pas les
// instruments pour. Télécharge-les. » Le violoncelle, la harpe et la flûte ne sont
// plus synthétisés : ce sont des notes jouées par des musiciens, prises dans des
// banques du domaine public, que `echantillonneur.mjs` charge, MESURE et
// transpose à la hauteur exacte. La synthèse ne garde que ce qu'elle fait bien :
// le bourdon (des partiels purs, bouclables au cycle près), le feu et les grillons.
//
// Un son stéréo posé dans le tampon circulaire, au volume et à la place voulus.
// L'échantillon a sa propre image stéréo (la salle où il a été pris) : on ne fait
// que la pencher d'un côté, sans la replier en mono.
function placer(t0, son, volume, pan) {
  const i0 = Math.round(t0 * SR);
  const gG = volume * Math.min(1, 1 - pan);
  const gD = volume * Math.min(1, 1 + pan);
  for (let n = 0; n < son.G.length; n += 1) poser(i0 + n, son.G[n] * gG, son.D[n] * gD);
}

// LE VIOLONCELLE — un pupitre, à l'archet, avec son vibrato. L'archet met un
// instant à faire parler la corde : la note part quatre centièmes AVANT le temps,
// pour que le son soit posé quand le temps tombe. Sa relâche chevauche l'attaque
// suivante : l'archet change de sens sans que le son s'interrompe.
function violoncelle(t0, midi, duree, volume, pan) {
  placer(t0 - 0.04, note('violoncelle', midi, duree + 0.04, { relache: 0.35 }), volume, pan);
}

// LA HARPE CELTIQUE — une corde pincée qui résonne à sa guise, puis qu'on étouffe
// doucement de la paume.
function harpe(t0, midi, volume, pan, tenue = 2.8) {
  placer(t0, note('harpe', midi, tenue, { relache: 0.8 }), volume, pan);
}

// LA FLÛTE — la voix de la Comté.
//
// LES ORNEMENTS DU JEU IRLANDAIS, et ce sont eux qui font le style :
//   — le CUT : une note d'appui éclair, un degré AU-DESSUS, avant la note ;
//   — le ROLL : la note, le degré au-dessus, la note, le degré en dessous, la note
//     — un tour rapide sur elle-même au début d'une note longue.
// Un ornement se joue LIÉ, d'un seul souffle : seule sa première note a une
// attaque. Les suivantes sont lues au cœur de leur échantillon, là où la note
// sonne déjà, et se fondent l'une dans l'autre en huit millièmes — le temps d'un
// doigt qui se lève.
// Les degrés sont ceux de SOL MAJEUR : un cut chromatique sonnerait faux.
const GAMME = new Set([7, 9, 11, 0, 2, 4, 6]);
const degre = (midi, sens) => { let m = midi + sens; while (!GAMME.has(((m % 12) + 12) % 12)) m += sens; return m; };
const LIE = 0.008;
export const parcoursDeFlute = (midi, ornement) => (ornement === 'c' ? [[0, degre(midi, 1)], [0.035, midi]]
  : ornement === 'r' ? [[0, midi], [0.07, degre(midi, 1)], [0.1, midi], [0.16, degre(midi, -1)], [0.19, midi]]
    : [[0, midi]]);

function flute(t0, midi, duree, volume, pan, ornement = null) {
  const parcours = parcoursDeFlute(midi, ornement);
  parcours.forEach(([ti, m], k) => {
    const suivante = parcours[k + 1];
    const fin = suivante ? suivante[0] : duree;
    placer(t0 + ti, note('flute', m, fin - ti, {
      relache: suivante ? LIE : 0.12,
      depuis: k ? 0.25 + ti : 0,
      entree: k ? LIE : 0,
    }), volume, pan);
  });
}

// TOUTES LES HAUTEURS QUE LA PARTITION DEMANDE À CHAQUE INSTRUMENT — ornements
// compris. Les contrôles vérifient que chacune tombe juste, et qu'aucune n'oblige
// à transposer un échantillon au point de le dénaturer.
// Les mesures où la flûte a des notes à jouer — tirées de la MÉLODIE elle-même,
// mesure par mesure, pour que le contrôle du grillon ne recopie pas son calcul.
export function mesuresDeMelodie() {
  const r = [];
  let mesure = 0;
  for (const section of FORME) {
    section.accords.forEach((_, k) => { if (section.melodie?.[k]?.length) r.push(mesure + k); });
    mesure += section.accords.length;
  }
  return r;
}

export function notesDeLaPartition() {
  const r = { violoncelle: new Set(), harpe: new Set(), flute: new Set() };
  for (const section of FORME) {
    section.accords.forEach((nom, k) => {
      const notes = ACCORDS[nom];
      const [racine, passage, seconde] = LIGNE[nom];
      r.violoncelle.add(racine);
      if (section.violoncelle !== 'long') r.violoncelle.add(seconde);
      if (section.violoncelle === 'marche') r.violoncelle.add(passage);
      const arpege = [0, 1, 2, 3].map((i) => notes[i] + 12);
      const haut = [notes[1] + 12, notes[3] + 12, notes[2] + 12];
      (section.harpe === 'arpege' ? arpege : haut).forEach((m) => r.harpe.add(m));
      for (const [, midi, , orn] of section.melodie?.[k] || []) {
        for (const [, m] of parcoursDeFlute(midi, orn || null)) r.flute.add(m);
      }
    });
  }
  return r;
}

// LE BOURDON — sol et ré, une nappe de cordes qui s'enfle et se retire section par
// section, comme une cornemuse au loin. Chaque note porte six harmoniques qui
// s'effacent vers l'aigu : de la corde frottée, sans archet qui accroche.
//
// SES FRÉQUENCES SONT ARRONDIES AU CENT-VINGTIÈME DE HERTZ, et c'est ce qui le
// rend bouclable : chaque partiel fait alors un NOMBRE ENTIER de cycles en deux
// minutes, la fin rejoint exactement le début. L'écart de justesse est de deux
// centièmes de centième de ton — inaudible, et le raccord devient parfait.
function bourdon() {
  const intensite = [];
  for (const section of FORME) for (const _ of section.accords) intensite.push(section.bourdon ?? 0);
  const partiels = [];
  for (const [midi, poids] of [[43, 1], [50, 0.8], [55, 0.45]]) {
    for (let k = 1; k <= 6; k += 1) {
      const f = Math.round(hz(midi) * k * DUREE) / DUREE;
      partiels.push({ w: 2 * Math.PI * f / SR, a: poids / k ** 1.4, ph: alea() * 2 * Math.PI, pan: k % 2 ? -0.3 : 0.3 });
    }
  }
  for (let n = 0; n < N; n += 1) {
    // L'intensité glisse d'une mesure à l'autre, jamais par paliers.
    const x = n / (MESURE * SR);
    const m = Math.floor(x); const fr = x - m;
    const lisse = fr * fr * (3 - 2 * fr);
    const niveau = intensite[m % MESURES] * (1 - lisse) + intensite[(m + 1) % MESURES] * lisse;
    let g = 0; let d = 0;
    for (const p of partiels) {
      const v = Math.sin(p.w * n + p.ph) * p.a;
      g += v * (1 - p.pan) / 2; d += v * (1 + p.pan) / 2;
    }
    poser(n, g * niveau, d * niveau);
  }
}

// LE FEU — un souffle grave continu, et des crépitements : des éclats de bruit de
// quelques millisecondes, aigus, tirés au hasard, parfois un « pop » plus gros.
function feu() {
  // LE SOUFFLE EST COUPÉ SOUS 100 HZ. Sans cela, le bruit « brun » accumule
  // l'essentiel de son énergie dans l'infra-grave — un grondement de camion, pas
  // une flamme. Un feu de bois froisse l'air ; il ne fait pas vibrer le sol.
  //
  // ET COUPÉ TROIS FOIS : un bruit brun gagne six décibels par octave en
  // descendant, un seul filtre en retire six — les deux s'annulaient, et
  // l'infra-grave restait entier. Trois étages en retirent dix-huit.
  //
  // LE SOUFFLE EST FONDU SUR SA PROPRE JOINTURE. Un bruit filtré n'est pas
  // périodique : sa fin et son début sont deux instants sans rapport, et la boucle
  // les recollait bord à bord — une petite marche, mesurée à deux fois le pas
  // moyen du signal. On rend donc une demi-seconde de plus, et cette queue se fond
  // dans le début, à puissance constante.
  const FONDU = Math.round(0.5 * SR);
  let brun = 0; let bas = 0;
  const etages = [0, 0, 0].map(() => ({ y: 0, x: 0 }));
  for (let n = 0; n < N + FONDU; n += 1) {
    brun = 0.996 * brun + 0.04 * (alea() * 2 - 1);
    bas = 0.9 * bas + 0.1 * brun;
    let hp = bas;
    for (const e of etages) { e.y = 0.985 * (e.y + hp - e.x); e.x = hp; hp = e.y; }
    // La flamme respire : le souffle ondule lentement, jamais en rythme.
    const respire = 0.8 + 0.2 * Math.sin(2 * Math.PI * n / (SR * 7.3)) * Math.sin(2 * Math.PI * n / (SR * 11.9));
    // Les FONDU premiers échantillons montent, les FONDU derniers (qui retombent
    // sur le début) descendent : leur somme garde la même puissance.
    const monte = n < FONDU ? Math.sin((n / FONDU) * Math.PI / 2) : 1;
    const descend = n >= N ? Math.cos(((n - N) / FONDU) * Math.PI / 2) : 1;
    const v = hp * 0.9 * respire * monte * descend;
    poser(n, v, v);
  }
  let t = 0;
  while (t < DUREE) {
    t += -Math.log(1 - alea()) / 3.2;       // environ trois crépitements par seconde
    const gros = alea() < 0.08;
    const long = Math.round((gros ? 0.012 : 0.003 + alea() * 0.005) * SR);
    const force = (gros ? 0.22 : 0.05 + alea() * 0.09);
    const pan = alea() * 1.2 - 0.6;
    const gG = force * Math.cos((pan + 1) * Math.PI / 4);
    const gD = force * Math.sin((pan + 1) * Math.PI / 4);
    let prec = 0;
    for (let n = 0; n < long; n += 1) {
      const b = alea() * 2 - 1;
      const aigu = gros ? b : b - prec;       // un pop garde ses graves, un crépitement non
      prec = b;
      const env = Math.exp(-n / (long / 4));
      poser(Math.round(t * SR) + n, aigu * env * gG, aigu * env * gD);
    }
  }
}

// LES GRILLONS — loin, très bas : trois stridulations rapides, puis le silence.
//
// RÉGLÉS À L'OREILLE DE L'AUTEUR (30/09) : « attention au bruit des oiseaux, pas
// harmonieux et [qui] sortent vraiment en désordre. J'aime bien, il faut juste
// bien les régler. » La première version cumulait trois fautes :
//   — FAUX : 4 300 et 4 650 Hz, deux hauteurs tombées au hasard, à un quart de ton
//     de la gamme et à un ton et quart l'une de l'autre — elles frottaient entre
//     elles et contre la flûte ;
//   — EN DÉSORDRE : des périodes de 1,1 et 1,37 s, secouées de ±15 %, sans aucun
//     rapport avec la pulsation — et trois « bips » lisses, plus oiseau que grillon ;
//   — TROP PRÉSENTS : vers 4,5 kHz l'oreille est au plus sensible ; au même écart
//     que le reste, ils passaient devant.
// Désormais, il est ACCORDÉ sur l'accord de sol (si 7, quatre octaves au-dessus de
// la flûte) et chante SUR LA GRILLE DES CROCHES. Son chant est fait comme celui de
// l'insecte : quatre syllabes serrées, chacune d'une aile frottée qui s'ouvre et
// se referme. Son seul hasard est une nuance de force, jamais le temps.
//
// PUIS, À L'ÉCOUTE (30/09) : « on fait avec un grillon chaque 15 secondes. Et plus
// pendant la flûte. » UN seul grillon — il y en avait deux qui se répondaient,
// toutes les deux secondes —, un chant toutes les quinze secondes (quarante-cinq
// croches : la boucle en contient huit, le raccord reste exact), et PLUS DU TOUT
// pendant que la flûte chante : un chant qui tombe sur une mesure de mélodie se tait.
// Il en reste quatre par tour, dans l'introduction, le thème nu, la respiration et
// le retour — les moments où la clairière s'entend.
export const GRILLON = { midi: 107, pan: -0.5, depart: 1, periode: 45 };   // si 7

// Les instants où il chante, en secondes — exportés pour les contrôles.
export function instantsDuGrillon() {
  const melodie = [];
  for (const section of FORME) for (const _ of section.accords) melodie.push(Boolean(section.melodie));
  const r = [];
  for (let croche = GRILLON.depart; croche < MESURES * 6; croche += GRILLON.periode) {
    const t = croche * CROCHE;
    if (!melodie[Math.floor(t / MESURE)]) r.push(t);
  }
  return r;
}

function grillons() {
  const f = hz(GRILLON.midi);
  const { pan } = GRILLON;
  for (const t of instantsDuGrillon()) {
    const force = 0.8 + 0.2 * alea();
    for (let k = 0; k < 4; k += 1) {
      const i0 = Math.round((t + k * 0.032) * SR);
      const long = Math.round(0.018 * SR);
      for (let n = 0; n < long; n += 1) {
        // Une syllabe : l'aile s'ouvre et se referme (sinus carré), la hauteur
        // fléchit d'un soupçon en fin de frottement.
        const x = n / long;
        const env = Math.sin(Math.PI * x) ** 2 * (k === 3 ? 0.7 : 1);
        const s = Math.sin(2 * Math.PI * f * (1 - 0.004 * x) * n / SR) * env * 0.012 * force;
        poser(i0 + n, s * (1 - pan) / 2, s * (1 + pan) / 2);
      }
    }
  }
}

// ============================================================================
// L'EXÉCUTION DE LA PARTITION
// ============================================================================
function jouerPiste(nom) {
  const avec = (x) => x === nom;
  let mesure = 0;
  for (const section of FORME) {
    section.accords.forEach((nom, k) => {
      const t0 = (mesure + k) * MESURE;
      const notes = ACCORDS[nom];
      if (avec('violoncelle')) {
        const [racine, passage, seconde] = LIGNE[nom];
        const archet = 0.3 * section.force;
        // Les notes se tiennent jusqu'au bout et se chevauchent un peu : l'archet
        // change de sens sans que le son s'interrompe.
        if (section.violoncelle === 'long') {
          violoncelle(t0, racine, MESURE * 0.98, archet, -0.1);
        } else if (section.violoncelle === 'marche') {
          violoncelle(t0, racine, 2 * CROCHE, archet, -0.1);
          violoncelle(t0 + 2 * CROCHE, passage, CROCHE, archet * 0.85, -0.1);
          violoncelle(t0 + 3 * CROCHE, seconde, 3 * CROCHE * 0.98, archet * 0.95, -0.1);
        } else {
          violoncelle(t0, racine, 3 * CROCHE, archet, -0.1);
          violoncelle(t0 + 3 * CROCHE, seconde, 3 * CROCHE * 0.98, archet * 0.9, -0.1);
        }
      }
      if (section.melodie && avec('flute')) {
        for (const [croche, midi, dur, orn] of section.melodie[k]) {
          // Un ornement se joue AVANT le temps : la note principale tombe juste.
          const avance = orn === 'c' ? 0.035 : 0;
          flute(t0 + croche * CROCHE - avance + (alea() - 0.5) * 0.01, midi, dur * CROCHE * 0.92,
            0.075 * section.voix, 0.3, orn || null);
        }
      }
      if (section.harpe && avec('harpe')) {
        // LA HARPE — elle reprend, doucement, le pas que marquait la guitare :
        // les notes de l'accord une octave au-dessus, sur les temps FAIBLES. Le
        // temps fort appartient au violoncelle.
        const haut = [notes[1] + 12, notes[3] + 12, notes[2] + 12];
        const pincer = (croche, midi, v) => harpe(t0 + croche * CROCHE + (alea() - 0.5) * 0.01,
          midi, v * section.force, 0.45);
        if (section.harpe === 'arpege') {
          // LA RESPIRATION : la harpe seule égrène toute la mesure, montante puis
          // descendante — le moment où la flûte se tait et où le feu parle.
          [notes[0] + 12, notes[1] + 12, notes[2] + 12, notes[3] + 12, notes[2] + 12, notes[1] + 12]
            .forEach((midi, c) => pincer(c, midi, c === 0 ? 0.2 : 0.15));
        } else if (section.harpe === 'contretemps') {
          pincer(1, haut[0], 0.13); pincer(3, haut[1], 0.17); pincer(5, haut[2], 0.13);
        } else {
          pincer(3, haut[1], 0.17); pincer(5, haut[2], 0.13);
        }
      }
    });
    mesure += section.accords.length;
  }
  if (avec('bourdon')) bourdon();
  if (avec('feu')) feu();
  if (avec('grillons')) grillons();
}

// Toutes les pistes demandées, chacune dans ses canaux. LE HASARD EST RÉAMORCÉ par
// piste : retirer les grillons ne change pas un seul crépitement du feu.
function jouer(pistes = Object.keys(MIXAGE)) {
  const rendues = {};
  for (const [k, nom] of Object.keys(MIXAGE).entries()) {
    if (!pistes.includes(nom)) continue;
    graine = 20260930 + k * 7919;
    piste = nouvellePiste();
    jouerPiste(nom);
    rendues[nom] = piste;
  }
  return rendues;
}

// Un filtre passe-haut du second ordre (biquad de Butterworth), appliqué en
// place, deux passages pour que son état traverse la jointure de la boucle.
function coupeBas(x, fc) {
  const w = 2 * Math.PI * fc / SR;
  const al = Math.sin(w) / Math.SQRT2;
  const cw = Math.cos(w);
  const a0 = 1 + al;
  const b0 = (1 + cw) / 2 / a0; const b1 = -(1 + cw) / a0; const b2 = b0;
  const a1 = -2 * cw / a0; const a2 = (1 - al) / a0;
  let x1 = 0; let x2 = 0; let y1 = 0; let y2 = 0;
  const y = new Float32Array(N);
  for (let passe = 0; passe < 2; passe += 1) {
    for (let n = 0; n < N; n += 1) {
      const v = b0 * x[n] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x[n]; y2 = y1; y1 = v;
      if (passe === 1) y[n] = v;
    }
  }
  x.set(y);
}

// ============================================================================
// LA SALLE — une réverbération de Schroeder, rendue en cercle elle aussi
// ============================================================================
//
// La queue de la salle ne doit pas s'arrêter à la fin du tampon : elle déborde
// sur le début, comme les notes. On fait donc passer le tampon DEUX FOIS dans la
// réverbération, sans en vider l'état, et l'on garde le second passage.
function salle(entree, decalage) {
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((l) => ({ b: new Float32Array(l + decalage), i: 0, f: 0 }));
  const alls = [556, 441, 341, 225].map((l) => ({ b: new Float32Array(l + decalage), i: 0 }));
  const retour = 0.8; const amorti = 0.35;
  const sortie = new Float32Array(N);
  for (let passe = 0; passe < 2; passe += 1) {
    for (let n = 0; n < N; n += 1) {
      const x = entree[n] * 0.015;
      let s = 0;
      for (const c of combs) {
        const y = c.b[c.i];
        c.f = y * (1 - amorti) + c.f * amorti;
        c.b[c.i] = x + c.f * retour;
        c.i = (c.i + 1) % c.b.length;
        s += y;
      }
      for (const a of alls) {
        const y = a.b[a.i];
        a.b[a.i] = s + y * 0.5;
        a.i = (a.i + 1) % a.b.length;
        s = y - s * 0.5;
      }
      if (passe === 1) sortie[n] = s;
    }
  }
  return sortie;
}

// LE RENDU NE PART QUE SI L'ON LANCE CE FICHIER : l'importer pour en mesurer la
// corde ne doit pas recalculer deux minutes de musique.
export function rendre({ sortie = SORTIE, apercu = APERCU, pistes } = {}) {
  if (!banquesPresentes()) {
    throw new Error('Les banques d’instruments manquent : node design/audio/echantillonneur.mjs les télécharge.');
  }
  const rendues = jouer(pistes);
  // LE MIXAGE : chaque piste ramenée à son écart mesuré sous le violoncelle, puis
  // envoyée dans la salle selon son dosage.
  const reference = rendues.violoncelle ? niveau(rendues.violoncelle) : null;
  const G = new Float32Array(N); const D = new Float32Array(N);
  const envoiG = new Float32Array(N); const envoiD = new Float32Array(N);
  const niveaux = {};
  for (const [nom, p] of Object.entries(rendues)) {
    niveaux[nom] = niveau(p);
    const g = reference == null ? 1 : 10 ** ((reference + MIXAGE[nom].ecart - niveaux[nom]) / 20);
    for (let n = 0; n < N; n += 1) {
      G[n] += p.G[n] * g; D[n] += p.D[n] * g;
      envoiG[n] += p.G[n] * g * MIXAGE[nom].salle; envoiD[n] += p.D[n] * g * MIXAGE[nom].salle;
    }
  }
  const rG = salle(envoiG, 0);
  const rD = salle(envoiD, 23);
  const HUMIDE = 0.55;
  for (let n = 0; n < N; n += 1) { G[n] += rG[n] * HUMIDE; D[n] += rD[n] * HUMIDE; }
  // UN COUPE-BAS À 60 HZ SUR LE TOUT. La note la plus grave du violoncelle est à
  // 82 Hz : rien d'utile ne vit en dessous, et ce qui y traîne — un « pop » du
  // feu, la queue de la salle — fait vibrer les enceintes sans rien faire
  // entendre. Filtre du second ordre, rendu en cercle comme le reste.
  coupeBas(G, 60); coupeBas(D, 60);

  // LE NIVEAU DE SORTIE SE RÈGLE SUR L'ÉNERGIE, PLUS SUR LA CRÊTE. Calé sur la
  // crête, le fichier se réglait sur le plus fort crépitement — une milliseconde
  // sur deux minutes — et la musique en payait le prix. Visée : −21 dB en moyenne,
  // avec une crête qui ne dépasse jamais −1 dB. Le volume d'écoute, lui, se règle
  // dans le jeu : c'est une musique de fond.
  let e = 0; let crete = 0;
  for (let n = 0; n < N; n += 1) { const x = (G[n] + D[n]) / 2; e += x * x; crete = Math.max(crete, Math.abs(G[n]), Math.abs(D[n])); }
  const rms = Math.sqrt(e / N);
  const gain = Math.min(10 ** (-21 / 20) / rms, 0.891 / crete);

  const wav = (fichier, debut, longueur) => {
    const buf = Buffer.alloc(44 + longueur * 4);
    buf.write('RIFF', 0); buf.writeUInt32LE(36 + longueur * 4, 4); buf.write('WAVE', 8);
    buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
    buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
    buf.write('data', 36); buf.writeUInt32LE(longueur * 4, 40);
    for (let k = 0; k < longueur; k += 1) {
      const n = (((debut + k) % N) + N) % N;
      buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(G[n] * gain * 32767))), 44 + k * 4);
      buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(D[n] * gain * 32767))), 46 + k * 4);
    }
    fs.writeFileSync(fichier, buf);
  };

  // LE FICHIER DU JEU : une seconde de fin, les 120 secondes, une seconde de début.
  const dossier = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'feu-'));
  const tmp = path.join(dossier, 'boucle.wav');
  wav(tmp, -MARGE * SR, N + 2 * MARGE * SR);
  fs.mkdirSync(path.dirname(sortie), { recursive: true });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-codec:a', 'libmp3lame', '-b:a', '112k', sortie]);
  console.log('écrit', path.relative(process.cwd(), sortie), `${Math.round(fs.statSync(sortie).size / 1024)} ko`);

  // L'APERÇU : deux tours de boucle d'affilée, pour ENTENDRE le raccord.
  if (apercu) {
    const tmp2 = path.join(dossier, 'apercu.wav');
    wav(tmp2, 0, 2 * N);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp2, '-codec:a', 'libmp3lame', '-b:a', '160k', apercu]);
    console.log('aperçu', apercu);
  }
  // Pour les contrôles : le raccord, mesuré sur le signal avant encodage.
  return { G, D, gain, niveaux };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) rendre();
