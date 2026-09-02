// « LES VISAGES » — la série et son barème.
//
// CE QUE CES CONTRÔLES GARDENT, ET POURQUOI ILS COMPTENT PLUS QUE D'HABITUDE.
//
// Ce jeu repose entièrement sur un TIRAGE. Une contrainte de placement mal tenue
// ne casse rien, ne lève aucune erreur, et ne se voit pas : elle produit
// simplement des manches injouables — un visage qui revient trois photos plus
// tard, ou dont la seconde apparition tombe avant qu'on ait pu l'oublier. Le
// défaut serait invisible en relecture et découvert à l'antenne, une fois.
//
// D'où un tirage éprouvé sur MILLE séries plutôt que sur un exemple : c'est le
// seul moyen d'attraper une borne fausse d'une unité.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { construireSerie, creneauDe, REGLES_VISAGES, modules } from '../../src/server/modules.js';
import { idsDuBassin, BASSIN_VISAGES } from '../../src/server/visages.js';

const TIRAGES = 1000;

describe('la série de visages', () => {
  it('le bassin livré suffit à composer une série', () => {
    // 29 visages distincts pour 30 places : le doublé en occupe deux. Ce contrôle
    // rougira le jour où la vraie base de visages arrivera avec moins que ça —
    // c'est-à-dire au moment exact où il faut le savoir.
    expect(new Set(idsDuBassin()).size,
      `le bassin ne permet pas de composer une série de ${REGLES_VISAGES.total} places`)
      .toBeGreaterThanOrEqual(REGLES_VISAGES.total - 1);
    // Aucun doublon dans le bassin : deux entrées de même identifiant
    // fabriqueraient un second « visage doublé » que personne n'a voulu.
    expect(BASSIN_VISAGES.length, 'le bassin contient des identifiants en double')
      .toBe(new Set(idsDuBassin()).size);
  });

  it('respecte ses QUATRE contraintes sur mille tirages', () => {
    const [pMin, pMax] = REGLES_VISAGES.premiere;
    const [sMin, sMax] = REGLES_VISAGES.seconde;
    const vus = { pos1: new Set(), pos2: new Set() };

    for (let n = 0; n < TIRAGES; n += 1) {
      const { ordre, doubleId, pos1, pos2 } = construireSerie(idsDuBassin());
      vus.pos1.add(pos1); vus.pos2.add(pos2);

      expect(ordre.length, 'la série n\'a pas trente places').toBe(REGLES_VISAGES.total);
      // 1. la première apparition, entre le 1er et le 20e
      expect(pos1, `1re apparition hors bornes : ${pos1}`).toBeGreaterThanOrEqual(pMin);
      expect(pos1, `1re apparition hors bornes : ${pos1}`).toBeLessThanOrEqual(pMax);
      // 2. la seconde, entre le 10e et le 30e
      expect(pos2, `2e apparition hors bornes : ${pos2}`).toBeGreaterThanOrEqual(sMin);
      expect(pos2, `2e apparition hors bornes : ${pos2}`).toBeLessThanOrEqual(sMax);
      // 3. jamais avant la première
      expect(pos2, 'la 2e apparition précède la 1re').toBeGreaterThan(pos1);
      // 4. au moins cinq visages entre les deux
      expect(pos2 - pos1 - 1, `seulement ${pos2 - pos1 - 1} visage(s) entre les deux apparitions`)
        .toBeGreaterThanOrEqual(REGLES_VISAGES.ecartMin - 1);

      // Le visage doublé est bien AUX DEUX PLACES, et à celles-là seulement.
      expect(ordre[pos1 - 1]).toBe(doubleId);
      expect(ordre[pos2 - 1]).toBe(doubleId);
      expect(ordre.filter((id) => id === doubleId).length,
        'le visage doublé apparaît un nombre de fois différent de deux').toBe(2);

      // UN SEUL visage se répète. C'est toute la règle du jeu : s'il y en avait
      // deux, la manche n'aurait pas de réponse unique.
      const compte = new Map();
      for (const id of ordre) compte.set(id, (compte.get(id) || 0) + 1);
      const repetes = [...compte.entries()].filter(([, c]) => c > 1).map(([id]) => id);
      expect(repetes, `plusieurs visages se répètent : ${repetes.join(', ')}`).toEqual([doubleId]);
      expect(compte.size, 'la série ne compte pas 29 visages distincts').toBe(REGLES_VISAGES.total - 1);
    }

    // LE TIRAGE COUVRE-T-IL VRAIMENT SES BORNES ? Un générateur qui rendrait
    // toujours la même position passerait tous les contrôles ci-dessus. On exige
    // donc de la variété — sans quoi le jeu serait le même tous les soirs.
    expect(vus.pos1.size, 'la 1re apparition ne varie presque pas').toBeGreaterThan(10);
    expect(vus.pos2.size, 'la 2e apparition ne varie presque pas').toBeGreaterThan(10);
  });

  it('tient ses bornes dans les cas EXTRÊMES du tirage', () => {
    // Les mille tirages ci-dessus explorent le milieu ; ici on force les bouts,
    // là où une borne fausse d'une unité se cache.
    const auPlusBas = construireSerie(idsDuBassin(), () => 0);
    expect(auPlusBas.pos1, 'le tirage le plus bas ne donne pas la 1re place').toBe(1);
    expect(auPlusBas.pos2, 'avec pos1 = 1, la 2e ne peut pas être avant le 10e').toBe(10);

    // `0.999…` pousse chaque tirage à son maximum.
    const auPlusHaut = construireSerie(idsDuBassin(), () => 0.9999999);
    expect(auPlusHaut.pos1).toBe(20);
    expect(auPlusHaut.pos2).toBe(30);
    expect(auPlusHaut.pos2 - auPlusHaut.pos1).toBeGreaterThanOrEqual(REGLES_VISAGES.ecartMin);
  });

  it('LA BANQUE D\'IMAGES, LE JOUR OÙ ELLE ARRIVERA', () => {
    // CE CONTRÔLE NE VÉRIFIE PRESQUE RIEN AUJOURD'HUI, ET C'EST VOULU.
    //
    // Le bassin de substitution n'a pas d'images : les portraits sont dessinés par
    // le client. Le jour où la vraie banque sera posée — environ quatre cents
    // portraits, tous sur le même fond —, chaque entrée portera un `src`, et ce
    // contrôle se mettra à mordre :
    //   - chaque adresse déclarée doit correspondre à un fichier réellement servi.
    //     Une image manquante ne casse rien : elle affiche un cadre vide pendant
    //     deux secondes, et fausse la manche sans que personne ne le sache ;
    //   - toutes les images partagent la même extension. Un mélange de formats
    //     trahit un assemblage à la main, donc probablement des tailles et des
    //     fonds qui ne se ressemblent pas.
    //
    // CE QU'AUCUN CONTRÔLE NE POURRA DIRE : que les fonds sont VRAIMENT identiques,
    // ni que les cadrages se ressemblent. C'est une relecture humaine, et elle
    // compte : sur un jeu de reconnaissance, un fond qui change est un indice, et
    // un indice est une réponse donnée.
    const avecImage = BASSIN_VISAGES.filter((v) => v.src);
    if (!avecImage.length) {
      expect(BASSIN_VISAGES.length,
        'le bassin de substitution doit rester assez grand pour jouer').toBeGreaterThanOrEqual(29);
      return;
    }
    const extensions = new Set(avecImage.map((v) => v.src.split('.').pop().toLowerCase()));
    expect([...extensions], `la banque mélange des formats : ${[...extensions].join(', ')}`).toHaveLength(1);
    const manquantes = avecImage
      .map((v) => v.src)
      .filter((src) => !fs.existsSync(path.join('src/public', src.replace(/^\//, ''))));
    expect(manquantes, `images déclarées mais absentes du serveur : ${manquantes.slice(0, 5).join(', ')}`)
      .toEqual([]);
    // Une banque de quatre cents portraits, c'est treize séries sans répétition.
    // En dessous de deux cents, deux soirées de suite se ressembleraient.
    expect(avecImage.length, 'la banque est trop maigre pour varier les séries').toBeGreaterThanOrEqual(200);
  });

  it('refuse de composer une série sur un bassin trop maigre', () => {
    // Le jour où la vraie base arrivera incomplète, il vaut mieux une erreur
    // franche au lancement qu'une série silencieusement fausse à l'antenne.
    expect(() => construireSerie(['a', 'b', 'c'])).toThrow(/bassin trop petit/);
  });
});

describe('à quelle place un buzz correspond', () => {
  const t0 = 1_000_000;
  const pas = REGLES_VISAGES.cadenceMs;

  it('rend la place réellement affichée à cet instant', () => {
    expect(creneauDe(t0, t0), 'au top départ, on est sur le premier visage').toBe(1);
    // AU MILIEU de la deuxième place — et non à sa frontière exacte, où la grâce
    // rend encore le buzz au visage précédent (c'est le contrôle suivant qui
    // fixe cette limite-là, et c'est le comportement voulu).
    expect(creneauDe(t0, t0 + pas + pas / 2)).toBe(2);
    expect(creneauDe(t0, t0 + pas * 9 + 1200)).toBe(10);
    expect(creneauDe(t0, t0 + pas * 29 + 1900)).toBe(30);
  });

  it('ne dépasse jamais la dernière place, même après la fin', () => {
    // Un buzz arrivé après le dernier visage — réseau lent, chrono tout juste
    // écoulé — ne doit pas désigner une place qui n'existe pas.
    expect(creneauDe(t0, t0 + pas * 40)).toBe(REGLES_VISAGES.total);
  });

  it('rend au visage précédent les buzz retardés par le réseau', () => {
    // LA GRÂCE, ÉPROUVÉE DES DEUX CÔTÉS DE SA FRONTIÈRE. Sans elle, un joueur qui
    // réagit à la toute fin d'un visage se verrait crédité du suivant et perdrait
    // une manche qu'il a gagnée.
    expect(creneauDe(t0, t0 + pas + 200), 'un buzz arrivé 200 ms après le changement revient au visage précédent').toBe(1);
    expect(creneauDe(t0, t0 + pas + 400), 'passé la grâce, le buzz appartient au visage affiché').toBe(2);
  });
});

describe('le barème des visages', () => {
  const t0 = 1_000_000;
  function manche({ pos1 = 4, pos2 = 12 } = {}) {
    const ordre = Array.from({ length: REGLES_VISAGES.total }, (_, i) => `f${i}`);
    ordre[pos1 - 1] = 'DOUBLE';
    ordre[pos2 - 1] = 'DOUBLE';
    return { type: 'visages', ordre, doubleId: 'DOUBLE', pos1, pos2, startedAt: t0, answers: new Map() };
  }
  // Le milieu d'une place : à l'abri de la grâce comme du changement de visage.
  const auMilieuDe = (place) => t0 + (place - 1) * REGLES_VISAGES.cadenceMs + REGLES_VISAGES.cadenceMs / 2;

  it('700 points, et eux seuls, pour un buzz sur la SECONDE apparition', () => {
    const rt = manche();
    rt.answers.set('juste', { value: true, at: auMilieuDe(rt.pos2) });
    const { results } = modules.visages.score(rt);
    const r = results.get('juste');
    expect(r.base).toBe(REGLES_VISAGES.points);
    expect(r.base).toBe(700);
    expect(r.speed, 'la vitesse ne joue aucun rôle dans ce jeu').toBe(0);
    expect(r.correct, 'le buzz gagnant doit nourrir la série').toBe(true);
  });

  it('ZÉRO pour un buzz sur la PREMIÈRE apparition — mais le cas est distingué', () => {
    // C'est la faute que le jeu tend à provoquer : le joueur a bien reconnu le
    // visage, il n'avait simplement aucun moyen de savoir qu'il reviendrait. Le
    // serveur le signale pour que l'écran ne lui serve pas la phrase de celui qui
    // a buzzé au hasard.
    const rt = manche();
    rt.answers.set('trop-tot', { value: true, at: auMilieuDe(rt.pos1) });
    const { results } = modules.visages.score(rt);
    const r = results.get('trop-tot');
    expect(r.base).toBe(0);
    expect(r.correct).toBe(false);
    expect(r.troppTot, 'la première apparition doit être reconnaissable').toBe(true);
  });

  it('ZÉRO pour un buzz sur n\'importe quel autre visage', () => {
    const rt = manche();
    rt.answers.set('ailleurs', { value: true, at: auMilieuDe(7) });
    const { results } = modules.visages.score(rt);
    expect(results.get('ailleurs').base).toBe(0);
    expect(results.get('ailleurs').troppTot, 'ce n\'était pas le visage doublé').toBe(false);
  });

  it('compte les buzz place par place, pour le graphique', () => {
    const rt = manche();
    rt.answers.set('a', { value: true, at: auMilieuDe(rt.pos2) });
    rt.answers.set('b', { value: true, at: auMilieuDe(rt.pos2) });
    rt.answers.set('c', { value: true, at: auMilieuDe(rt.pos1) });
    rt.answers.set('d', { value: true, at: auMilieuDe(20) });
    const { reveal } = modules.visages.score(rt);
    const s = reveal.stats;
    expect(s.parPlace[rt.pos2 - 1]).toBe(2);
    expect(s.parPlace[rt.pos1 - 1]).toBe(1);
    expect(s.parPlace[19]).toBe(1);
    expect(s.parPlace.reduce((a, b) => a + b, 0), 'un buzz s\'est perdu en route').toBe(4);
    expect(s.trouve).toBe(2);
    expect(s.troppTot).toBe(1);
  });

  it('LA SÉRIE NE PART JAMAIS AVEC LA QUESTION', () => {
    // LE CONTRÔLE LE PLUS IMPORTANT DU FICHIER.
    //
    // Trente identifiants dont un figure deux fois, c'est la réponse en clair pour
    // qui ouvre l'onglet réseau de son navigateur — et ce jeu ne consiste qu'à
    // retrouver cette répétition. La question publique ne doit donc porter ni
    // l'ordre, ni l'identifiant du visage doublé, ni ses positions.
    const rt = manche();
    const publique = modules.visages.publicQuestion(rt);
    const texte = JSON.stringify(publique);
    expect(publique.ordre, 'l\'ordre de la série part au client').toBeUndefined();
    expect(publique.doubleId, 'l\'identifiant du visage doublé part au client').toBeUndefined();
    expect(publique.pos1, 'la position de la 1re apparition part au client').toBeUndefined();
    expect(publique.pos2, 'la position de la 2e apparition part au client').toBeUndefined();

    // AUCUN IDENTIFIANT NE FIGURE DEUX FOIS DANS LA LISTE DE PRÉCHARGEMENT.
    //
    // C'est la fuite que ce contrôle a réellement attrapée. La liste sert à
    // charger les images d'avance ; mélanger l'ordre tel quel y laissait le visage
    // doublé DEUX FOIS, et il suffisait d'en compter les doublons pour connaître
    // la réponse avant le premier visage. Que l'identifiant du doublé FIGURE dans
    // la liste n'apprend rien — les vingt-neuf y sont ; qu'il y figure deux fois
    // donne tout.
    const compte = new Map();
    for (const id of publique.bassin) compte.set(id, (compte.get(id) || 0) + 1);
    const doublons = [...compte.entries()].filter(([, c]) => c > 1).map(([id]) => id);
    expect(doublons, `la liste de préchargement trahit le visage doublé : ${doublons.join(', ')}`).toEqual([]);
    expect(texte, 'la charge utile porte encore les positions').not.toMatch(/pos[12]/);

    // Ce qu'elle DOIT porter : les visages qui vont passer, pour les charger
    // d'avance — vingt-neuf, et non les quatre cents du bassin, qu'un téléphone
    // en soirée n'a aucune raison de télécharger.
    expect(publique.bassin.length, 'la liste de préchargement n\'a pas 29 visages')
      .toBe(REGLES_VISAGES.total - 1);
    expect(publique.bassin.length,
      'le bassin entier est envoyé : quatre cents images à charger pour en afficher trente')
      .toBeLessThan(idsDuBassin().length);
    expect(publique.cadenceMs).toBe(REGLES_VISAGES.cadenceMs);
    expect(publique.total).toBe(REGLES_VISAGES.total);
  });
});
