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
import crypto from 'node:crypto';
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
    //
    // LES ATTENDUS SE DÉDUISENT DES RÈGLES, ils ne les recopient pas. Ils étaient
    // écrits en chiffres — 1, 10, 20, 30 — et le passage de trente à vingt places
    // les a tous démentis d'un coup. Un contrôle qui répète la règle qu'il garde
    // ne garde rien : il oblige seulement à l'écrire deux fois.
    const [pMin, pMax] = REGLES_VISAGES.premiere;
    const [sMin, sMax] = REGLES_VISAGES.seconde;
    // La 1re est bornée par ce que la 2e exige : il faut lui laisser l'écart.
    const premiereMax = Math.min(pMax, sMax - REGLES_VISAGES.ecartMin);

    const auPlusBas = construireSerie(idsDuBassin(), () => 0);
    expect(auPlusBas.pos1, 'le tirage le plus bas ne donne pas la première place').toBe(pMin);
    expect(auPlusBas.pos2, 'la 2e la plus précoce possible')
      .toBe(Math.max(sMin, pMin + REGLES_VISAGES.ecartMin));

    // `0.999…` pousse chaque tirage à son maximum.
    const auPlusHaut = construireSerie(idsDuBassin(), () => 0.9999999);
    expect(auPlusHaut.pos1, 'la 1re la plus tardive possible').toBe(premiereMax);
    expect(auPlusHaut.pos2, 'la 2e la plus tardive possible').toBe(sMax);
    expect(auPlusHaut.pos2 - auPlusHaut.pos1, 'les deux extrêmes se touchent trop')
      .toBeGreaterThanOrEqual(REGLES_VISAGES.ecartMin);
  });

  it('LES BORNES SONT COMPATIBLES ENTRE ELLES', () => {
    // LE CONTRÔLE QUI MANQUAIT, ET QUE LE CHANGEMENT DE GRILLE A RENDU NÉCESSAIRE.
    //
    // Sur trente places — 1re jusqu'au 20e, 2e jusqu'au 30e — n'importe quelle
    // première apparition laissait de la place à la seconde. Sur vingt places, la
    // marge tombe à deux : 12 + 6 = 18, pour un dernier visage au 20e. Une borne
    // déplacée d'une unité de trop rendrait une série impossible à composer, et
    // le tirage produirait alors une série silencieusement fausse plutôt qu'une
    // erreur. Ce contrôle interdit ce réglage.
    const [pMin, pMax] = REGLES_VISAGES.premiere;
    const [sMin, sMax] = REGLES_VISAGES.seconde;
    expect(pMax + REGLES_VISAGES.ecartMin,
      `1re jusqu'au ${pMax}e + écart de ${REGLES_VISAGES.ecartMin} dépasse la dernière place (${sMax})`)
      .toBeLessThanOrEqual(sMax);
    expect(sMax, 'la 2e apparition peut tomber après la fin de la série')
      .toBeLessThanOrEqual(REGLES_VISAGES.total);
    expect(sMin, 'la 2e apparition pourrait précéder la 1re').toBeGreaterThan(pMin);
    expect(pMin, 'la 1re apparition commence hors de la série').toBeGreaterThanOrEqual(1);
  });

  it('LA BANQUE D\'IMAGES est complète, homogène et servie', () => {
    // 200 portraits fournis par l'auteur, en remplacement du Face Research Lab
    // London Set (102) qui servait jusqu'ici.
    //
    // CE QUE CE CONTRÔLE GARDE :
    //   - chaque adresse déclarée correspond à un fichier réellement servi. Une
    //     image manquante ne casse rien : elle affiche un cadre vide pendant deux
    //     secondes et fausse la manche SANS QUE PERSONNE NE LE SACHE. C'est le
    //     défaut le plus vicieux que ce jeu puisse avoir ;
    //   - toutes les images partagent le même format. Un mélange trahirait un
    //     assemblage à la main, donc des cadrages et des fonds qui divergent ;
    //   - le bassin reste assez large pour DEUX manches sans qu'un visage revienne
    //     d'une manche à l'autre. En dessous, un joueur croirait reconnaître
    //     quelqu'un vu à la manche précédente.
    //
    // CE QU'AUCUN CONTRÔLE NE POURRA DIRE : que les fonds sont vraiment
    // identiques et les cadrages comparables. C'est une relecture humaine, elle a
    // été faite sur planche contact avant intégration, et elle compte — sur un jeu
    // de reconnaissance, un fond qui change est un indice, et un indice est une
    // réponse donnée.
    expect(BASSIN_VISAGES.length, 'la banque est vide').toBeGreaterThan(0);
    const sansAdresse = BASSIN_VISAGES.filter((v) => !v.src).map((v) => v.id);
    expect(sansAdresse, `visages sans image : ${sansAdresse.slice(0, 5).join(', ')}`).toEqual([]);

    const extensions = new Set(BASSIN_VISAGES.map((v) => v.src.split('.').pop().toLowerCase()));
    expect([...extensions], `la banque mélange des formats : ${[...extensions].join(', ')}`).toHaveLength(1);

    const manquantes = BASSIN_VISAGES
      .map((v) => v.src)
      .filter((src) => !fs.existsSync(path.join('src/public', src.replace(/^\//, ''))));
    expect(manquantes, `images déclarées mais absentes du serveur : ${manquantes.slice(0, 5).join(', ')}`)
      .toEqual([]);

    // AUCUN FICHIER ORPHELIN dans le dossier servi : une image qui traîne sans
    // être déclarée, c'est le reliquat d'une banque précédente. Celle d'avant en
    // comptait 102, celle-ci 200 — sans ce contrôle, les deux auraient pu
    // cohabiter, et des visages de deux séances différentes se seraient croisés
    // dans la même série.
    const surDisque = fs.readdirSync('src/public/visages').filter((f) => f.endsWith('.webp'));
    const declarees = new Set(BASSIN_VISAGES.map((v) => v.src.split('/').pop()));
    const orphelines = surDisque.filter((f) => !declarees.has(f));
    expect(orphelines, `fichiers servis mais non déclarés : ${orphelines.slice(0, 5).join(', ')}`)
      .toEqual([]);

    // DEUX FOIS LE MÊME VISAGE SOUS DEUX IDENTIFIANTS : la faute qui viderait le
    // jeu de son sens.
    //
    // Ce jeu demande de repérer le visage qui repasse. Si deux entrées servaient
    // la même image, une série pourrait montrer « deux personnes différentes »
    // parfaitement identiques : le joueur qui buzze a raison de ce qu'il voit, et
    // l'arbitre le compte faux. Rien ne casse, rien ne s'affiche de travers — la
    // manche est simplement injuste, et personne ne peut le savoir.
    //
    // LE RISQUE EST RÉEL, PAS THÉORIQUE : la banque est arrivée en QUATRE
    // archives, à un jour d'intervalle pour la dernière, converties séparément.
    // Un fichier recopié d'une archive à l'autre passerait tous les autres
    // contrôles — il est déclaré, il est servi, il a le bon format.
    const empreintes = new Map();
    for (const v of BASSIN_VISAGES) {
      const octets = fs.readFileSync(path.join('src/public', v.src.replace(/^\//, '')));
      const somme = crypto.createHash('md5').update(octets).digest('hex');
      empreintes.set(somme, [...(empreintes.get(somme) || []), v.id]);
    }
    const jumeaux = [...empreintes.values()].filter((ids) => ids.length > 1);
    expect(jumeaux, `le même portrait sert sous plusieurs identifiants : ${jumeaux.map((g) => g.join('=')).join(', ')}`)
      .toEqual([]);

    // TOUTES CARRÉES ET DE MÊME CÔTÉ. Une image plus petite que les autres serait
    // agrandie par le navigateur, donc plus floue — et le flou est un repère de
    // mémoire aussi sûr qu'un fond différent. Le côté se lit dans l'en-tête WebP
    // sans décoder l'image.
    const cotes = new Set();
    for (const v of BASSIN_VISAGES) {
      const t = fs.readFileSync(path.join('src/public', v.src.replace(/^\//, '')));
      // WebP simple (VP8) : la largeur et la hauteur tiennent sur 14 bits chacune,
      // à l'octet 26 du fichier.
      expect(t.subarray(0, 4).toString('ascii'), `${v.id} n'est pas un fichier WebP`).toBe('RIFF');
      const l = t.readUInt16LE(26) & 0x3fff;
      const h = t.readUInt16LE(28) & 0x3fff;
      expect([l, h], `${v.id} n'est pas carré : ${l} × ${h}`).toEqual([l, l]);
      cotes.add(l);
    }
    expect([...cotes], `la banque mélange des tailles : ${[...cotes].join(', ')}`).toHaveLength(1);

    // DEUX MANCHES SANS RECOUPEMENT : (places - 1) visages par série, donc le
    // double. C'est le plancher qui a un sens pour le jeu, et non un chiffre rond.
    const deuxManches = (REGLES_VISAGES.total - 1) * 2;
    expect(BASSIN_VISAGES.length,
      `la banque ne permet pas deux manches sans répétition (${deuxManches} visages requis)`)
      .toBeGreaterThanOrEqual(deuxManches);
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
    // LA DERNIÈRE PLACE, déduite du nombre de places et non recopiée : ce
    // contrôle affirmait « 30 » et le passage à vingt places l'a démenti.
    const derniere = REGLES_VISAGES.total;
    expect(creneauDe(t0, t0 + pas * (derniere - 1) + pas - 100)).toBe(derniere);
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
