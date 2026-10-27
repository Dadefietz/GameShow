// Tests unitaires — CE QUE L'ANIMATEUR VOIT À LA RÉVÉLATION (retours du 26/10).
//
// Trois demandes, un même principe : des NOMS, sur le canal de l'animateur seul.
// Le stream est une source capturée par OBS ; aucun pseudo n'y part jamais.
//
//   1. ESTIMATION — « voir jusqu'à 20 personnes avec en colonne : Nom, Écart,
//      Réponse donnée. Si on est moins de 20 joueurs, on affiche tout le monde.
//      Si on est plus de 20 joueurs, on affiche les 10 meilleurs et les 10 pires. »
//   2. LES VISAGES — « les 10 premiers visages à gauche, les 10 derniers à droite,
//      à côté de chaque visage les noms des joueurs qui ont voté pour lui (limité
//      à 10 noms) ; le cadre du visage qui est la bonne réponse est en vert. »
//   3. VOTE, QUIZ, VRAI/FAUX — « les noms des joueurs ayant bien répondu, dans la
//      limite de 20 noms ».
import { describe, it, expect, beforeEach } from 'vitest';
import { modules } from '../../src/server/modules.js';
import { roomManager, RoomState } from '../../src/server/rooms.js';
import * as engine from '../../src/server/engine.js';

function mockIo() {
  const emitted = [];
  return { emitted, to(target) { return { emit: (ev, payload) => emitted.push({ target, ev, payload }) }; } };
}

function setRound(room, moduleType, q, answers) {
  const rt = modules[moduleType].buildRound(q);
  rt.answers = new Map(answers);
  rt.startedAt = Date.now() - 5000;
  rt.deadline = Date.now() + 15000;
  rt.revealed = false;
  rt.closed = false;
  rt.roundId = 7;
  room.currentModule = rt;
  room.state = RoomState.PLAYING;
  return rt;
}

// Aucun pseudo ne sort du canal de l'animateur : ni vers le salon (téléphones et
// stream), ni vers le canal staff (que le stream écoute aussi).
function aucunNomHorsAnimateur(io, room, pseudos) {
  for (const e of io.emitted) {
    if (e.target === room.code + ':host') continue;
    if (e.ev === 'play:you') continue; // relevé personnel, envoyé à un seul joueur
    if (e.ev === 'leaderboard:update') continue; // classement général, déjà nominatif par contrat
    const texte = JSON.stringify(e.payload);
    for (const p of pseudos) expect(texte.includes(`"${p}"`), `« ${p} » est parti sur ${e.target} (${e.ev})`).toBe(false);
  }
}

function surAnimateur(io, room, ev) {
  const e = io.emitted.filter((x) => x.ev === ev);
  for (const x of e) expect(x.target, `${ev} hors du canal de l'animateur`).toBe(room.code + ':host');
  return e.at(-1)?.payload;
}

let io, room;
const joueurs = (n) => Array.from({ length: n }, (_, i) => {
  const p = roomManager.addPlayer(room, `J${String(i + 1).padStart(2, '0')}`);
  p.connected = true; p.socketId = `s${i}`;
  return p;
});

beforeEach(() => {
  io = mockIo();
  room = roomManager.createRoom('owner');
});

describe('ESTIMATION — le tableau Nom, Écart, Réponse donnée', () => {
  const Q = { id: 'e1', text: 'Combien ?', target: 1000, durationSec: 20 };

  it('à 20 joueurs ou moins : TOUT LE MONDE, du plus proche au plus loin', () => {
    const js = joueurs(20);
    // J01 répond 1001, J02 1002… J20 1020 ; J05 tombe pile.
    setRound(room, 'estimation', Q, js.map((p, i) => [p.id, { value: i === 4 ? 1000 : 1000 + i + 1, at: Date.now() }]));
    engine.reveal(io, room);
    const c = surAnimateur(io, room, 'host:classement');
    expect(c, 'aucun tableau envoyé à l’animateur').toBeTruthy();
    expect(c.type).toBe('estimation');
    expect(c.lignes).toHaveLength(20);
    expect(c.masques || 0).toBe(0);
    expect(c.lignes[0]).toMatchObject({ pseudo: 'J05', ecart: 0, valeur: 1000, rang: 1 });
    expect(c.lignes[1]).toMatchObject({ pseudo: 'J01', ecart: 1, valeur: 1001, rang: 2 });
    expect(c.lignes.at(-1)).toMatchObject({ pseudo: 'J20', ecart: 20, valeur: 1020, rang: 20 });
    aucunNomHorsAnimateur(io, room, js.map((p) => p.pseudo));
  });

  it('au-delà de 20 : LES 10 MEILLEURS ET LES 10 PIRES, à leur vrai rang, et le nombre de ceux du milieu', () => {
    const js = joueurs(27);
    setRound(room, 'estimation', Q, js.map((p, i) => [p.id, { value: 1000 - (i + 1) * 3, at: Date.now() }]));
    engine.reveal(io, room);
    const c = surAnimateur(io, room, 'host:classement');
    expect(c.lignes).toHaveLength(20);
    expect(c.masques).toBe(7);
    expect(c.lignes.slice(0, 10).map((l) => l.pseudo)).toEqual(js.slice(0, 10).map((p) => p.pseudo));
    expect(c.lignes.slice(10).map((l) => l.pseudo)).toEqual(js.slice(17).map((p) => p.pseudo));
    expect(c.lignes[10].rang, 'le premier des pires n’est pas à son vrai rang').toBe(18);
    expect(c.lignes.at(-1)).toMatchObject({ pseudo: 'J27', rang: 27, ecart: 81, valeur: 919 });
  });

  it('DES EX ÆQUO partagent leur rang, et un silencieux n’apparaît pas', () => {
    const js = joueurs(4);
    setRound(room, 'estimation', Q, [
      [js[0].id, { value: 990, at: Date.now() }],
      [js[1].id, { value: 1010, at: Date.now() }],
      [js[2].id, { value: 1500, at: Date.now() }],
    ]);
    engine.reveal(io, room);
    const c = surAnimateur(io, room, 'host:classement');
    expect(c.lignes.map((l) => [l.pseudo, l.rang])).toEqual([['J01', 1], ['J02', 1], ['J03', 3]]);
  });
});

describe('VOTE, QUIZ, VRAI/FAUX — les noms des bonnes réponses', () => {
  it('QUIZ : les bons répondants, du plus rapide au plus lent, et personne d’autre', () => {
    const js = joueurs(4);
    const t0 = Date.now() - 5000;
    setRound(room, 'quiz', { id: 'q', text: '?', options: ['A', 'B'], correctIndex: 1 }, [
      [js[0].id, { value: 1, at: t0 + 3000 }],
      [js[1].id, { value: 0, at: t0 + 100 }],
      [js[2].id, { value: 1, at: t0 + 500 }],
    ]);
    engine.reveal(io, room);
    const b = surAnimateur(io, room, 'host:bonnesReponses');
    expect(b).toMatchObject({ roundId: 7, total: 2, joueurs: ['J03', 'J01'] });
    aucunNomHorsAnimateur(io, room, js.map((p) => p.pseudo));
  });

  it('VRAI/FAUX : PERSONNE n’a trouvé — la liste est vide, mais elle est envoyée', () => {
    const js = joueurs(2);
    setRound(room, 'true_false', { id: 'v', text: '?', correct: true }, js.map((p) => [p.id, { value: false, at: Date.now() }]));
    engine.reveal(io, room);
    expect(surAnimateur(io, room, 'host:bonnesReponses')).toMatchObject({ total: 0, joueurs: [] });
  });

  it('AU-DELÀ DE 20, vingt noms et le total exact', () => {
    const js = joueurs(26);
    const t0 = Date.now() - 5000;
    setRound(room, 'quiz', { id: 'q', text: '?', options: ['A', 'B'], correctIndex: 0 }, js.map((p, i) => [p.id, { value: 0, at: t0 + i }]));
    engine.reveal(io, room);
    const b = surAnimateur(io, room, 'host:bonnesReponses');
    expect(b.total).toBe(26);
    expect(b.joueurs).toEqual(js.slice(0, 20).map((p) => p.pseudo));
  });

  it('VOTE : ceux qui ont lu le cercle au second tour', () => {
    const js = joueurs(3);
    const rt = setRound(room, 'vote', { id: 'vo', text: '?', options: ['X', 'Y'], durationSec: 10 }, [
      [js[0].id, { value: 0, at: Date.now() - 3000 }],
      [js[1].id, { value: 1, at: Date.now() - 2000 }],
      [js[2].id, { value: 0, at: Date.now() - 1000 }],
    ]);
    rt.tour = 2;
    rt.answersTour1 = new Map([[js[0].id, { value: 0, at: 0 }], [js[1].id, { value: 0, at: 0 }], [js[2].id, { value: 1, at: 0 }]]);
    engine.reveal(io, room);
    expect(surAnimateur(io, room, 'host:bonnesReponses')).toMatchObject({ total: 2, joueurs: ['J01', 'J03'] });
  });

  it('SONDAGE : pas de bonne réponse, donc pas de liste', () => {
    const js = joueurs(2);
    setRound(room, 'vote', { id: 'so', text: '?', options: ['X', 'Y'], categorie: 'sondage', durationSec: 10 }, js.map((p) => [p.id, { value: 0, at: Date.now() }]));
    expect(room.currentModule.poll, 'le scénario n’est pas un sondage').toBe(true);
    engine.reveal(io, room);
    expect(io.emitted.some((e) => e.ev === 'host:bonnesReponses')).toBe(false);
  });

  it('LES AUTRES JEUX n’en reçoivent pas (l’estimation a son tableau)', () => {
    const js = joueurs(2);
    setRound(room, 'estimation', { id: 'e', text: '?', target: 10 }, js.map((p) => [p.id, { value: 10, at: Date.now() }]));
    engine.reveal(io, room);
    expect(io.emitted.some((e) => e.ev === 'host:bonnesReponses')).toBe(false);
  });
});

describe('LES VISAGES — qui a buzzé sur quel visage', () => {
  // Un buzz est une HEURE : la place se déduit de l'instant, à la cadence du jeu.
  const cadence = modules.visages.meta.defile.cadenceMs;
  const auMilieuDe = (rt, place) => rt.startedAt + (place - 1) * cadence + cadence / 2;

  it('les vingt places, chacune avec son visage, ses votants et le cadre vert sur la bonne', () => {
    const js = joueurs(14);
    const rt = setRound(room, 'visages', { id: 'vi' }, []);
    rt.startedAt = Date.now() - 60_000;
    // Douze joueurs sur la bonne place (pos2), deux sur la première apparition.
    js.forEach((p, i) => rt.answers.set(p.id, { value: true, at: auMilieuDe(rt, i < 12 ? rt.pos2 : rt.pos1) + i }));
    engine.reveal(io, room);
    const v = surAnimateur(io, room, 'host:visagesVotes');
    expect(v, 'aucune liste de votants envoyée à l’animateur').toBeTruthy();
    expect(v.roundId).toBe(7);
    expect(v.places).toHaveLength(modules.visages.meta.defile.total);
    expect(v.places.map((x) => x.place)).toEqual(v.places.map((_, i) => i + 1));
    for (const x of v.places) expect(x.src, `place ${x.place} sans image`).toMatch(/\.(webp|jpg|png)$/);
    const bonne = v.places[rt.pos2 - 1];
    expect(v.places.filter((x) => x.bonne).map((x) => x.place)).toEqual([rt.pos2]);
    expect(bonne.total).toBe(12);
    expect(bonne.joueurs, 'plus de 10 noms à côté d’un visage').toHaveLength(10);
    expect(bonne.joueurs).toEqual(js.slice(0, 10).map((p) => p.pseudo));
    expect(v.places[rt.pos1 - 1]).toMatchObject({ total: 2, joueurs: ['J13', 'J14'], bonne: false });
    // La même image aux deux apparitions du visage doublé.
    expect(v.places[rt.pos1 - 1].src).toBe(bonne.src);
    expect(v.places.reduce((s, x) => s + x.total, 0)).toBe(14);
    aucunNomHorsAnimateur(io, room, js.map((p) => p.pseudo));
  });
});
