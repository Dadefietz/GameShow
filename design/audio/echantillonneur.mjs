// L'ÉCHANTILLONNEUR DE « FEU DE CAMP » — DE VRAIS INSTRUMENTS (30/09).
//
// « Je pense que tu n'as pas les instruments pour. Télécharge-les. » La synthèse
// avait atteint sa limite : un violoncelle additif reste un orgue qui vibre, une
// flûte à trois harmoniques reste un sifflet électronique. Les instruments sont
// désormais ENREGISTRÉS — note par note, par des musiciens — et ce module les joue.
//
// ============================================================================
// LES BANQUES, ET POURQUOI CELLES-LÀ
// ============================================================================
//
// Toutes dans le DOMAINE PUBLIC (CC0 1.0) : le dépôt est public et la musique part
// en direct ; une licence « non commerciale » ou « avec attribution » serait une
// dette cachée. Versilian Studios (Sam Gossner) publie les deux seules banques
// orchestrales sérieuses sous CC0 :
//   — le VIOLONCELLE : VSCO 2 Community Edition, pupitre de violoncelles, archet
//     tenu avec vibrato, nuance douce (`susvib_*_v1_1`) ;
//   — la HARPE : VCSL, harpe CELTIQUE (« Folk Harp »), nuance douce (`v2`) — la
//     harpe des airs de la Comté, pas la harpe de concert ;
//   — la FLÛTE : VCSL, flûte à bec soprano baroque, notes tenues. Aucun tin
//     whistle n'existe sous licence libre ; la flûte à bec est de la MÊME famille
//     (un conduit, un biseau, six trous), dans la même tessiture.
//
// La liste exacte — dépôt, chemin, taille — est dans `echantillons.json`. Les
// fichiers (95 Mo) NE SONT PAS VERSIONNÉS : ils ne servent qu'au rendu, jamais au
// jeu, qui ne reçoit que le MP3. `node design/audio/echantillonneur.mjs` les
// télécharge et vérifie chaque taille.
//
// ============================================================================
// LE NOM D'UN FICHIER NE DIT PAS SA NOTE — ON LA MESURE
// ============================================================================
//
// La mesure l'a montré sur les 55 fichiers : les trois banques nomment leurs
// octaves avec UNE OCTAVE DE DÉCALAGE (« C4 » sonne un do 5), et trois fichiers
// graves de la harpe sont mal étiquetés (D1 et D2 sonnent un ré 4, F#1 entre deux
// notes). Chaque échantillon est donc MESURÉ au chargement ; celui dont la mesure
// contredit son nom (décalage d'octave compris) de plus d'un tiers de demi-ton est
// écarté, et chaque note jouée est raccordée à sa hauteur MESURÉE — au centième de
// ton, pas au nom près.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
export const DOSSIER = path.join(ICI, 'echantillons');
export const MANIFESTE = JSON.parse(fs.readFileSync(path.join(ICI, 'echantillons.json'), 'utf8'));
const SR = 44100;
const NOMS = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };

const fichierLocal = (banque, e) => path.join(DOSSIER, banque, path.basename(e.chemin));

// LES BANQUES SONT-ELLES LÀ, ENTIÈRES ? Taille comprise : un téléchargement
// interrompu laisse un fichier tronqué, qui se décoderait en une note coupée.
export function banquesPresentes() {
  return Object.entries(MANIFESTE).every(([b, liste]) => liste.every((e) => {
    try { return fs.statSync(fichierLocal(b, e)).size === e.octets; } catch { return false; }
  }));
}

export async function telecharger() {
  for (const [banque, liste] of Object.entries(MANIFESTE)) {
    fs.mkdirSync(path.join(DOSSIER, banque), { recursive: true });
    for (const e of liste) {
      const f = fichierLocal(banque, e);
      if (fs.existsSync(f) && fs.statSync(f).size === e.octets) continue;
      const url = `https://raw.githubusercontent.com/${e.depot}/master/${e.chemin.split('/').map(encodeURIComponent).join('/')}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${url} → ${r.status}`);
      const octets = Buffer.from(await r.arrayBuffer());
      if (octets.length !== e.octets) throw new Error(`${e.chemin} : ${octets.length} octets reçus, ${e.octets} attendus`);
      fs.writeFileSync(f, octets);
      console.log('reçu', banque, path.basename(f));
    }
  }
}

// Un fichier décodé en flottants stéréo, à 44,1 kHz — ffmpeg fait la conversion
// depuis le 24 bits des banques.
function decoder(f) {
  const b = execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-ac', '2', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  const x = new Float32Array(b.buffer, b.byteOffset, b.length / 4);
  const G = new Float32Array(x.length / 2); const D = new Float32Array(x.length / 2);
  for (let n = 0; n < G.length; n += 1) { G[n] = x[2 * n]; D[n] = x[2 * n + 1]; }
  return { G, D };
}

// LA HAUTEUR D'UN SON, par la méthode YIN (de Cheveigné et Kawahara, 2002) : la
// différence du signal avec lui-même décalé, normalisée, dont on prend le PREMIER
// creux net — et non le plus profond, qui tombe souvent sur l'octave du dessous.
// Affinée d'une parabole : la période est fractionnaire. Exportée pour les contrôles.
export function yin(x, debut, long = 4096) {
  const maxL = Math.floor(SR / 30); const minL = Math.floor(SR / 2500);
  if (debut + long + maxL + 1 > x.length) return NaN;
  const d = new Float64Array(maxL + 2);
  for (let l = minL; l <= maxL + 1; l += 1) {
    let s = 0;
    for (let n = debut; n < debut + long; n += 1) { const e = x[n] - x[n + l]; s += e * e; }
    d[l] = s;
  }
  const dn = new Float64Array(maxL + 2);
  let cumul = 0;
  for (let l = minL; l <= maxL + 1; l += 1) { cumul += d[l]; dn[l] = (d[l] * (l - minL + 1)) / (cumul || 1); }
  let lag = -1;
  for (let l = minL + 1; l <= maxL; l += 1) if (dn[l] < 0.15 && dn[l] < dn[l - 1] && dn[l] <= dn[l + 1]) { lag = l; break; }
  if (lag < 0) { let m = Infinity; for (let l = minL + 1; l <= maxL; l += 1) if (dn[l] < m) { m = dn[l]; lag = l; } }
  const a = dn[lag - 1]; const b = dn[lag]; const c = dn[lag + 1];
  const den = a - 2 * b + c;
  return SR / (lag + (den ? (0.5 * (a - c)) / den : 0));
}
export const versMidi = (hz) => 69 + 12 * Math.log2(hz / 440);
const mediane = (v) => { const s = v.filter(Number.isFinite).sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

// L'ATTAQUE : le premier instant où le son atteint un dixième de sa crête, moins
// quinze millièmes — on garde le début du geste (le coup d'archet, le souffle),
// on jette le silence de la prise.
function attaqueDe(mono) {
  let pic = 0;
  for (const v of mono) pic = Math.max(pic, Math.abs(v));
  let n = 0;
  while (n < mono.length && Math.abs(mono[n]) < 0.1 * pic) n += 1;
  return Math.max(0, n - Math.round(0.015 * SR));
}

const cache = new Map();
// Une banque chargée : ses échantillons, chacun avec sa hauteur MESURÉE, triés.
export function chargerBanque(banque) {
  if (cache.has(banque)) return cache.get(banque);
  if (!MANIFESTE[banque]) throw new Error(`banque inconnue : ${banque}`);
  const notes = [];
  const ecartes = [];
  for (const e of MANIFESTE[banque]) {
    const { G, D } = decoder(fichierLocal(banque, e));
    const mono = new Float32Array(G.length);
    for (let n = 0; n < G.length; n += 1) mono[n] = (G[n] + D[n]) / 2;
    const debut = attaqueDe(mono);
    // Cinq fenêtres dans la partie qui sonne franchement — une corde pincée
    // s'éteint vite dans l'aigu, un archet vibre : la médiane les départage.
    const fenetres = [0.12, 0.2, 0.28, 0.36, 0.44].map((s) => yin(mono, debut + Math.round(s * SR)));
    const midi = versMidi(mediane(fenetres));
    const m = path.basename(e.chemin).match(/_([A-G]#?)(-?\d)_/);
    const nomme = NOMS[m[1]] + 12 * (Number(m[2]) + 1) + 12;   // le décalage d'octave, mesuré
    if (!Number.isFinite(midi) || Math.abs(midi - nomme) > 1 / 3) { ecartes.push({ fichier: path.basename(e.chemin), midi, nomme }); continue; }
    notes.push({ midi, nomme, G: G.subarray(debut), D: D.subarray(debut), fichier: path.basename(e.chemin) });
  }
  notes.sort((a, b) => a.midi - b.midi);
  const r = { banque, notes, ecartes };
  cache.set(banque, r);
  return r;
}

// L'échantillon le plus proche de la note voulue : le moins transposé sonne le
// plus naturel (un violoncelle monté de cinq demi-tons devient un alto étriqué).
export function plusProche(b, midi) {
  let meilleur = b.notes[0];
  for (const e of b.notes) if (Math.abs(e.midi - midi) < Math.abs(meilleur.midi - midi)) meilleur = e;
  return meilleur;
}

// LIRE UN ÉCHANTILLON À UNE AUTRE HAUTEUR : on le parcourt plus ou moins vite
// (un rapport de 2^(écart/12)), avec une interpolation d'Hermite à quatre points
// — la linéaire ternit les aigus et fait crépiter les transpositions.
function lire(canal, pos) {
  const i = Math.floor(pos); const f = pos - i;
  const x0 = canal[i - 1] ?? 0; const x1 = canal[i] ?? 0; const x2 = canal[i + 1] ?? 0; const x3 = canal[i + 2] ?? 0;
  const c1 = 0.5 * (x2 - x0);
  const c2 = x0 - 2.5 * x1 + 2 * x2 - 0.5 * x3;
  const c3 = 0.5 * (x3 - x0) + 1.5 * (x1 - x2);
  return ((c3 * f + c2) * f + c1) * f + x1;
}

// UNE NOTE — rend `{ G, D }` : l'échantillon voisin, transposé à la hauteur
// exacte, tenu `duree` secondes puis relâché en `relache` secondes (un fondu en
// cosinus : jamais de clic). `depuis` (secondes) : où commencer la lecture dans
// l'échantillon — 0 garde l'attaque, une valeur positive enchaîne LIÉ, sans
// nouvelle attaque (les ornements de la flûte). `entree` : un fondu d'entrée.
//
// LES DEUX BORDS D'UNE NOTE SONT FONDUS, TOUJOURS — la mesure l'a exigé :
//   — L'ENTRÉE, sur quatre millièmes au moins. Une prise ne commence pas sur un
//     zéro : la salle, le crin, la corde voisine sonnent déjà. Lue d'un coup, elle
//     démarre au milieu d'une onde, et chaque attaque du violoncelle claquait —
//     cinquante-huit clics en deux minutes, un par coup d'archet. Quatre
//     millièmes, c'est moins que les quinze gardés avant l'attaque : le geste
//     reste entier ;
//   — LA FIN DE LA PRISE. Une note tenue plus longtemps que son enregistrement
//     (une harpe aiguë, prise sur 1,3 s, tenue 2,8 s) s'arrêterait net au dernier
//     échantillon : elle s'efface sur ses cinquante derniers millièmes.
const ENTREE_MINIMALE = 0.004;
const FIN_DE_PRISE = 0.05;
export function note(banque, midi, duree, { relache = 0.25, depuis = 0, entree = 0 } = {}) {
  const b = chargerBanque(banque);
  const e = plusProche(b, midi);
  const pas = 2 ** ((midi - e.midi) / 12);
  const i0 = depuis * SR;
  // Là où la prise s'épuise, lue à ce pas.
  const epuise = Math.max(0, Math.floor((e.G.length - 3 - i0) / pas));
  const long = Math.min(Math.round((duree + relache) * SR), epuise);
  const G = new Float32Array(long); const D = new Float32Array(long);
  const nDuree = duree * SR; const nRel = Math.max(1, relache * SR);
  const nEnt = Math.max(entree, ENTREE_MINIMALE) * SR; const nFin = FIN_DE_PRISE * SR;
  for (let n = 0; n < long; n += 1) {
    const pos = i0 + n * pas;
    let env = n > nDuree ? 0.5 * (1 + Math.cos(Math.PI * Math.min(1, (n - nDuree) / nRel))) : 1;
    if (n < nEnt) env *= 0.5 * (1 - Math.cos(Math.PI * n / nEnt));
    // Jusqu'au ZÉRO EXACT sur le dernier échantillon.
    if (long === epuise && n > long - 1 - nFin) env *= 0.5 * (1 - Math.cos(Math.PI * (long - 1 - n) / nFin));
    G[n] = lire(e.G, pos) * env; D[n] = lire(e.D, pos) * env;
  }
  return { G, D, source: e, epuisee: long === epuise };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await telecharger();
  console.log(banquesPresentes() ? 'banques complètes' : 'BANQUES INCOMPLÈTES');
  for (const banque of Object.keys(MANIFESTE)) {
    const b = chargerBanque(banque);
    console.log(`${banque} : ${b.notes.length} notes, de ${b.notes[0].midi.toFixed(2)} à ${b.notes.at(-1).midi.toFixed(2)}`
      + (b.ecartes.length ? ` — écartés : ${b.ecartes.map((x) => `${x.fichier} (${x.midi.toFixed(2)} pour ${x.nomme})`).join(', ')}` : ''));
  }
}
