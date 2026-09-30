// « FEU DE CAMP » — LA MUSIQUE D'AMBIANCE, SES MESURES ET SON FICHIER (30/09).
//
// Le module des sons l'avait écrit d'avance : « le jour où le jeu voudra un vrai
// habillage — un jingle, une nappe de feu —, ce sera un autre chantier, avec des
// fichiers ET LEUR CONTRÔLE D'EXISTENCE ». Le voici : un fichier absent ne se voit
// sur aucune capture d'écran, il se tait.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { MESURE, MESURES, MARGE, notesDeLaPartition, GRILLON, instantsDuGrillon, mesuresDeMelodie } from '../../design/audio/feu-de-camp.mjs';
import { banquesPresentes, chargerBanque, plusProche, note, yin, versMidi, MANIFESTE } from '../../design/audio/echantillonneur.mjs';
import { FICHIER_MUSIQUE, MARGE_S, BOUCLE_S, gainDuVolume, lecteurDeMusique } from '../../src/client/shared/musique.js';

// ============================================================================
// LES VRAIS INSTRUMENTS (30/09)
// ============================================================================
//
// Violoncelle, harpe et flûte sont des ENREGISTREMENTS du domaine public
// (`design/audio/echantillons.json`). Les fichiers — 95 Mo — ne sont pas
// versionnés : ils ne servent qu'à RENDRE le MP3, que le jeu reçoit seul. Sur un
// poste qui ne les a pas téléchargés (`node design/audio/echantillonneur.mjs`),
// ces contrôles-ci sont sautés EN LE DISANT ; ceux du fichier MP3 et du lecteur,
// plus bas, tournent partout.
const presentes = banquesPresentes();
if (!presentes) console.warn('⚠ banques d’instruments absentes : justesse non contrôlée (node design/audio/echantillonneur.mjs)');

// La hauteur d'une note RENDUE, en médiane de cinq fenêtres, en demi-tons MIDI.
const hauteurRendue = (son) => {
  const mono = new Float32Array(son.G.length);
  for (let n = 0; n < mono.length; n += 1) mono[n] = (son.G[n] + son.D[n]) / 2;
  const v = [0.12, 0.2, 0.28, 0.36, 0.44].map((s) => yin(mono, Math.round(s * 44100))).filter(Number.isFinite).sort((a, b) => a - b);
  return versMidi(v[v.length >> 1]);
};
const PARTITION = notesDeLaPartition();

describe.skipIf(!presentes)('les instruments enregistrés', () => {
  it('le manifeste est entier : trois banques, sous licence CC0, aucune vide', () => {
    expect(Object.keys(MANIFESTE).sort()).toEqual(['flute', 'harpe', 'violoncelle']);
    for (const liste of Object.values(MANIFESTE)) {
      expect(liste.length).toBeGreaterThan(10);
      for (const e of liste) expect(['sgossner/VCSL', 'sgossner/VSCO-2-CE'], 'une source hors des deux banques CC0').toContain(e.depot);
    }
  });

  it('chaque note de la partition a un échantillon à moins de deux demi-tons', () => {
    // UN ÉCHANTILLON TROP TRANSPOSÉ CHANGE DE TIMBRE : un violoncelle monté de cinq
    // demi-tons devient un alto étriqué, une flûte descendue d'une quarte, un
    // tuyau d'orgue. Deux demi-tons au plus, pour toute note que la partition
    // demande — ornements de la flûte compris. PLUS L'ACCORD PROPRE DE LA PRISE :
    // le pupitre de violoncelles est enregistré de tierce mineure en tierce
    // mineure, un la tombe à mi-chemin de deux prises, qui sonnent elles-mêmes à
    // trois centièmes de leur note — d'où 2,03.
    for (const [banque, notes] of Object.entries(PARTITION)) {
      const b = chargerBanque(banque);
      for (const midi of notes) {
        const e = plusProche(b, midi);
        expect(Math.abs(e.midi - midi), `${banque} ${midi} : l'échantillon le plus proche est à ${e.midi.toFixed(2)}`).toBeLessThanOrEqual(2.1);
      }
    }
  });

  it('chaque note de la partition tombe à moins de trois centièmes de ton — sur le son RENDU', () => {
    // LE DÉFAUT QUE CE CONTRÔLE GARDE : les banques nomment leurs octaves avec un
    // décalage, et trois fichiers de la harpe sont mal étiquetés. Accordée sur les
    // noms, la moitié de la musique serait à l'octave fausse — ou à un demi-ton
    // de travers. Chaque note est donc rendue, puis MESURÉE.
    for (const [banque, notes] of Object.entries(PARTITION)) {
      for (const midi of notes) {
        const cents = 100 * (hauteurRendue(note(banque, midi, 0.8)) - midi);
        expect(Math.abs(cents), `${banque} ${midi} sonne à ${cents.toFixed(1)} centièmes`).toBeLessThan(3);
      }
    }
  });

  it('une note commence et finit sur un silence : ni clic d’attaque, ni coupure de prise', () => {
    // Chaque attaque du violoncelle claquait : une prise commence au milieu d'une
    // onde. Et une harpe aiguë tenue plus longtemps que sa prise s'arrêtait net.
    // Tenue six secondes : les harpes aiguës épuisent leur prise, et doivent alors
    // finir sur un ZÉRO EXACT — pas sur « presque rien » : une prise qui
    // s'éteint d'elle-même masquerait l'absence du fondu.
    let epuisees = 0;
    for (const [banque, notes] of Object.entries(PARTITION)) {
      for (const midi of notes) {
        const son = note(banque, midi, 6, { relache: 0.5 });
        for (const x of [son.G, son.D]) {
          expect(Math.abs(x[0]), `${banque} ${midi} : une attaque ouverte sur un son`).toBe(0);
          if (son.epuisee) expect(Math.abs(x[x.length - 1]), `${banque} ${midi} : une prise coupée net`).toBe(0);
          else expect(Math.abs(x[x.length - 1]), `${banque} ${midi} : une relâche qui n'arrive pas au silence`).toBeLessThan(1e-4);
        }
        if (son.epuisee) epuisees += 1;
      }
    }
    expect(epuisees, 'aucune note n\'a épuisé sa prise : le fondu de fin n\'est pas contrôlé').toBeGreaterThan(0);
  });

  it('aucun échantillon joué ne contredit son nom — un fichier mal étiqueté est écarté', () => {
    // La mesure et le nom (décalage d'octave compris) se contrôlent l'un l'autre :
    // un nom faux, ou une mesure tombée sur une harmonique, et l'échantillon sort.
    // Aujourd'hui : « D2 » de la harpe, qui sonne un ré 4.
    for (const banque of Object.keys(MANIFESTE)) {
      const b = chargerBanque(banque);
      for (const e of b.notes) expect(Math.abs(e.midi - e.nomme), `${banque} ${e.fichier} : mesuré ${e.midi.toFixed(2)}, nommé ${e.nomme}`).toBeLessThanOrEqual(1 / 3);
    }
    expect(chargerBanque('harpe').ecartes.map((x) => x.fichier)).toContain('EWHarp_Normal_D2_v2_RR1.wav');
  });
});

describe('le grillon', () => {
  // « Attention au bruit des oiseaux, pas harmonieux et [qui] sortent vraiment en
  // désordre. » La première version chantait à 4 300 et 4 650 Hz — entre deux
  // notes — sur des périodes sans rapport avec la pulsation. Puis : « on fait
  // avec un grillon chaque 15 secondes. Et plus pendant la flûte. »
  it('chante juste : sur une note de l’accord de sol, sans fraction de demi-ton', () => {
    expect(Number.isInteger(GRILLON.midi), `le grillon entre deux notes : ${GRILLON.midi}`).toBe(true);
    expect([7, 11, 2], `le grillon hors de l’accord de sol : ${GRILLON.midi}`).toContain(GRILLON.midi % 12);
  });

  it('chante toutes les quinze secondes, sur la grille des croches, et la boucle en contient un nombre entier', () => {
    expect(GRILLON.periode * (MESURE / 6), 'le grillon ne chante pas toutes les 15 s').toBe(15);
    expect(Number.isInteger(GRILLON.depart), 'le grillon hors de la grille des croches').toBe(true);
    expect((MESURES * 6) % GRILLON.periode, 'la période ne divise pas la boucle : le raccord boiterait').toBe(0);
    const t = instantsDuGrillon();
    expect(t.length, 'le grillon ne chante plus du tout').toBeGreaterThan(0);
    for (let i = 1; i < t.length; i += 1) expect(Math.round((t[i] - t[i - 1]) * 1000) % 15000).toBe(0);
  });

  it('se tait pendant la flûte : aucun chant sur une mesure de mélodie', () => {
    const melodie = new Set(mesuresDeMelodie());
    expect(melodie.size, 'aucune mesure de mélodie : le contrôle ne garderait rien').toBeGreaterThan(0);
    for (const t of instantsDuGrillon()) {
      expect(melodie.has(Math.floor(t / MESURE)), `le grillon chante à ${t.toFixed(2)} s, pendant la flûte`).toBe(false);
    }
  });
});

describe('la boucle', () => {
  it('fait exactement deux minutes, et le lecteur la boucle aux mêmes instants', () => {
    expect(MESURE * MESURES).toBe(120);
    expect(BOUCLE_S, 'le lecteur du stream ne boucle pas sur la durée composée').toBe(MESURE * MESURES);
    expect(MARGE_S, 'le lecteur ne saute pas la même marge que le fichier en porte').toBe(MARGE);
  });

  it('LE FICHIER EXISTE, et il dure la boucle plus ses deux marges', () => {
    const fichier = path.resolve('src/public', FICHIER_MUSIQUE.replace(/^\//, ''));
    expect(fs.existsSync(fichier), `${fichier} manque : le stream serait muet, sans le dire`).toBe(true);
    const octets = fs.readFileSync(fichier);
    expect(octets.length, 'un fichier de fond de plus de 3 Mo pèserait sur chaque stream').toBeLessThan(3 * 1024 * 1024);
    // LA DURÉE, lue dans l'en-tête que l'encodeur écrit (« Info » ou « Xing ») :
    // le nombre de trames, de 1 152 échantillons chacune. Sans outil externe.
    const tete = octets.subarray(0, 8192);
    const ou = Math.max(tete.indexOf('Info'), tete.indexOf('Xing'));
    expect(ou, 'l’en-tête de durée manque').toBeGreaterThan(0);
    expect(tete.readUInt32BE(ou + 4) & 1, 'l’en-tête ne donne pas le nombre de trames').toBe(1);
    const trames = tete.readUInt32BE(ou + 8);
    const duree = (trames * 1152) / 44100;
    expect(duree, `le fichier dure ${duree.toFixed(2)} s`).toBeGreaterThan(BOUCLE_S + 2 * MARGE_S - 0.1);
    expect(duree).toBeLessThan(BOUCLE_S + 2 * MARGE_S + 0.1);
  });
});

describe('un moteur audio incomplet ne coûte que la musique', () => {
  // LE DÉFAUT QUE CE CONTRÔLE GARDE : le lecteur tourne dans un effet React, et
  // une exception y démonte TOUT le stream. Un contexte sans `cancelScheduledValues`
  // — celui, minimal, que les contrôles du confort de jeu substituent au Web Audio
  // — éteignait l'écran de révélation entier.
  const fenetreBridee = (contexte) => ({
    AudioContext: contexte,
    document: { addEventListener() {}, removeEventListener() {} },
    fetch: () => Promise.reject(new Error('hors ligne')),
  });
  const gainNu = () => ({ gain: { setValueAtTime() {} }, connect: (n) => n });

  it('un gain sans rampe : le réglage ne jette pas', () => {
    class Bride { constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; } createGain() { return gainNu(); } close() { return Promise.resolve(); } }
    const l = lecteurDeMusique(fenetreBridee(Bride));
    expect(() => l.regler({ active: true, volume: 50 })).not.toThrow();
    expect(() => l.regler({ active: false, volume: 10 })).not.toThrow();
    expect(() => l.arreter()).not.toThrow();
  });

  it('un contexte qui refuse de créer un gain, ou de se fermer : pas davantage', () => {
    class Refus { constructor() { this.state = 'suspended'; } createGain() { throw new Error('non'); } close() { throw new Error('non'); } }
    const l = lecteurDeMusique(fenetreBridee(Refus));
    expect(() => l.regler({ active: true, volume: 50 })).not.toThrow();
    expect(() => l.arreter()).not.toThrow();
  });
});

describe('le volume du curseur', () => {
  it('suit l’oreille : le milieu du curseur donne un quart du gain', () => {
    expect(gainDuVolume(0)).toBe(0);
    expect(gainDuVolume(50)).toBeCloseTo(0.25);
    expect(gainDuVolume(100)).toBe(1);
    expect(gainDuVolume(150), 'un volume venu du dehors reste borné').toBe(1);
    expect(gainDuVolume(-5)).toBe(0);
    for (let v = 0; v < 100; v += 5) expect(gainDuVolume(v + 5)).toBeGreaterThan(gainDuVolume(v));
  });
});
