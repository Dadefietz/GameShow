// « CACHE-CACHE » — LE TIRAGE, LES QUESTIONS, LE BARÈME.
//
// TOUT CE QUI SE VÉRIFIE ICI EST INVISIBLE À L'ŒIL. Une matrice qui violerait ses
// règles ne casse rien : elle produit une manche injouable — deux fois le même
// objet, une couleur absente, une question sans réponse — et personne ne s'en
// aperçoit avant l'antenne. C'est exactement le genre de faute qu'un contrôle
// attrape en quelques millisecondes et qu'une relecture ne voit pas.
import { describe, it, expect } from 'vitest';
import {
  construireMatrice, construireQuestions, tirerLaManche, couleurUnique,
  repartitionsPossibles, normaliserReponse, memeNom, momentsDuDevoilement,
  DUREE_GRILLE_MS, DUREE_QUESTION_MS, QUESTIONS_PAR_PARTIE, CASES, PAIRES, FORMES,
} from '../../src/server/cache-cache.js';
import { BASSIN_OBJETS, COULEURS, NOMS_OBJETS, srcDObjet } from '../../src/server/objets.js';
import {
  NUMEROS, contenuDeLaBanque, GABARITS_PAR_DEFAUT, VARIABLES_PAR_FORME,
  LIBELLES_PAR_FORME, MARQUE_CONTENU,
} from '../../src/server/cache-cache.js';
import { modules, bonusRapidite } from '../../src/server/modules.js';

describe('la banque des deux cents objets', () => {
  it('est le produit complet de quarante noms par cinq couleurs', () => {
    expect(BASSIN_OBJETS.length).toBe(200);
    expect(NOMS_OBJETS.length).toBe(40);
    expect(COULEURS.length).toBe(5);
    // CHAQUE COUPLE EXISTE, ET UNE SEULE FOIS. C'est ce qui rend le tirage
    // possible : neuf noms distincts, chacun dans la couleur qu'on lui demande.
    const couples = new Set(BASSIN_OBJETS.map((o) => `${o.nom}|${o.couleur}`));
    expect(couples.size).toBe(200);
    for (const nom of NOMS_OBJETS) {
      for (const c of COULEURS) expect(couples.has(`${nom}|${c}`), `${nom} en ${c} manque`).toBe(true);
    }
  });

  it('sert une adresse pour chaque objet, et rien pour un inconnu', () => {
    // Le client ne déduit JAMAIS une adresse d'un identifiant : il la reçoit.
    for (const o of BASSIN_OBJETS) expect(srcDObjet(o.id)).toBe(`/objets/${o.id}.webp`);
    expect(srcDObjet('objet-qui-n-existe-pas')).toBeNull();
  });
});

describe('la matrice de neuf objets', () => {
  it('TIENT SES DEUX RÈGLES sur cinq mille tirages', () => {
    for (let i = 0; i < 5000; i += 1) {
      const m = construireMatrice();
      expect(m.length).toBe(CASES);
      // « Chacune des 9 images doit avoir un Nom différent des autres. »
      expect(new Set(m.map((o) => o.nom)).size, 'deux fois le même objet').toBe(CASES);
      // « Chaque couleur doit apparaître minimum une fois et maximum deux fois. »
      const compte = new Map();
      for (const o of m) compte.set(o.couleur, (compte.get(o.couleur) || 0) + 1);
      expect(compte.size, 'une couleur manque').toBe(5);
      for (const [c, n] of compte) {
        expect(n, `${c} apparaît ${n} fois`).toBeGreaterThanOrEqual(1);
        expect(n, `${c} apparaît ${n} fois`).toBeLessThanOrEqual(2);
      }
    }
  });

  it('a TOUJOURS exactement une couleur unique, et ce n\'est pas un hasard', () => {
    // Cinq couleurs, neuf cases, chacune une ou deux fois : la seule répartition
    // possible est quatre doubles et un seul. L'énoncé écrit « normalement il doit
    // y avoir 4*2 couleurs + 1 couleur » ; c'est mécanique, et c'est ce qui rend
    // la question « quelle couleur n'est présente qu'une seule fois ? » toujours
    // posable et toujours sans ambiguïté.
    for (let i = 0; i < 2000; i += 1) {
      const m = construireMatrice();
      const compte = new Map();
      for (const o of m) compte.set(o.couleur, (compte.get(o.couleur) || 0) + 1);
      expect([...compte.values()].filter((n) => n === 1).length).toBe(1);
      expect(couleurUnique(m)).toBeTruthy();
    }
  });
});

describe('le dévoilement de la grille', () => {
  it('dure trente-huit secondes, comme l\'énoncé le calcule', () => {
    // « 3s début +3+1+3+1+3+1+3+1+3+1+3+1+3+1+3+1+3 » — l'énoncé fait le compte
    // lui-même. Il tombe juste.
    expect(DUREE_GRILLE_MS).toBe(38_000);
    // Le dernier objet s'éteint exactement à la fin.
    expect(momentsDuDevoilement(CASES - 1).fin).toBe(DUREE_GRILLE_MS);
    // Et il y a bien une seconde de noir entre deux objets.
    expect(momentsDuDevoilement(1).debut - momentsDuDevoilement(0).fin).toBe(1000);
  });
});

describe('le tirage des cinq questions', () => {
  it('respecte les quotas de chaque question', () => {
    // LES QUOTAS APPARTIENNENT AU GABARIT, PLUS À LA FORME. Depuis la modération
    // du Studio, deux gabarits peuvent partager une même forme avec des quotas
    // différents — « derrière quel numéro » posée une fois en début de manche et
    // une autre fois autrement. La répartition est donc indexée par identifiant
    // de gabarit, et c'est le gabarit qui dit son minimum et son maximum.
    const parId = new Map(GABARITS_PAR_DEFAUT.map((g) => [g.id, g]));
    for (const r of repartitionsPossibles()) {
      const total = Object.values(r).reduce((a, b) => a + b, 0);
      expect(total).toBe(QUESTIONS_PAR_PARTIE);
      for (const [cle, n] of Object.entries(r)) {
        const g = parId.get(cle);
        expect(g, `répartition indexée sur « ${cle} », qui n'est pas un gabarit`).toBeTruthy();
        expect(n).toBeGreaterThanOrEqual(g.min);
        expect(n).toBeLessThanOrEqual(g.max);
        // Et le gabarit reste dans les bornes que la FORME autorise.
        expect(n).toBeLessThanOrEqual(FORMES[g.forme].max);
      }
    }
    expect(repartitionsPossibles().length).toBeGreaterThan(0);
  });

  it('NE POSE JAMAIS DEUX QUESTIONS SUR LA MÊME IMAGE, sur deux mille manches', () => {
    // L'énoncé l'écrit forme par forme (« jamais sur la même image ») ; on
    // l'applique à l'ensemble, parce que deux formes différentes peuvent viser la
    // même case — « derrière 5 » et « entre 4 et 6 » ont la même réponse.
    for (let i = 0; i < 2000; i += 1) {
      const t = tirerLaManche();
      expect(t, 'un tirage a échoué').toBeTruthy();
      expect(t.questions.length).toBe(QUESTIONS_PAR_PARTIE);
      const places = t.questions.map((q) => q.place);
      expect(new Set(places).size, `deux questions sur la case ${places}`).toBe(QUESTIONS_PAR_PARTIE);
    }
  });

  it('n\'emploie que des paires ALIGNÉES pour les questions « entre »', () => {
    // Une paire quelconque n'a pas de milieu, et la question n'aurait pas de
    // réponse. Les huit paires admises viennent de l'énoncé.
    const admises = new Set(PAIRES.map((p) => p.paire.join('-')));
    for (let i = 0; i < 1000; i += 1) {
      for (const q of tirerLaManche().questions) {
        if (!q.bornes) continue;
        const cle = [...q.bornes].sort((a, b) => a - b).join('-');
        expect(admises.has(cle), `paire non alignée : ${cle}`).toBe(true);
        const p = PAIRES.find((x) => x.paire.join('-') === cle);
        expect(q.place, `la réponse n'est pas le milieu de ${cle}`).toBe(p.milieu);
      }
    }
  });

  it('dit la vérité : la réponse est bien celle de la matrice', () => {
    for (let i = 0; i < 1000; i += 1) {
      const { matrice, questions } = tirerLaManche();
      const parPlace = new Map(matrice.map((o) => [o.place, o]));
      for (const q of questions) {
        const o = parPlace.get(q.place);
        if (FORMES[q.forme].choix === 'couleurs') expect(COULEURS).toContain(q.reponse);
        if (FORMES[q.forme].choix === 'cases') expect(NUMEROS).toContain(q.reponse);
        if (q.forme === 'couleur_de' || q.forme === 'couleur_unique') expect(q.reponse).toBe(o.couleur);
        // « Derrière quel numéro se cache … ? » : la réponse EST la case.
        else if (q.forme === 'numero_de') expect(q.reponse).toBe(String(o.place));
        else expect(q.reponse).toBe(o.nom);
      }
    }
  });
});

describe('la comparaison des réponses écrites', () => {
  it('ignore la casse, les accents et la ponctuation', () => {
    // « sans prendre en compte les majuscules et les accents ». On va un peu plus
    // loin : un trait d'union ou un article de tête ne changent pas l'objet
    // désigné, et dix secondes sur un téléphone ne sont pas un test de dactylo.
    expect(memeNom('MARTEAU', 'Marteau')).toBe(true);
    expect(memeNom('cafe', 'Café')).toBe(true);
    expect(memeNom('  Café  ', 'Café')).toBe(true);
    expect(memeNom('t-shirt', 'T-shirt')).toBe(true);
    expect(memeNom('tshirt', 'T-shirt')).toBe(true);
    expect(memeNom('le t shirt', 'T-shirt')).toBe(true);
    expect(memeNom('cle a molette', 'Clé à molette')).toBe(true);
  });

  it('refuse ce qui n\'est pas le nom, y compris le vide', () => {
    expect(memeNom('', 'Marteau')).toBe(false);
    expect(memeNom(null, 'Marteau')).toBe(false);
    expect(memeNom('marto', 'Marteau')).toBe(false);
    expect(memeNom('marteaux', 'Marteau')).toBe(false);
    expect(normaliserReponse('  ')).toBe('');
  });
});

describe('le barème de cache-cache', () => {
  const cc = modules.cache_cache;

  it('vaut 200 par bonne réponse, plus 0 à 100 de rapidité', () => {
    expect(cc.meta.points).toBe(200);
    // LA FENÊTRE EST PASSÉE DE DIX À SEIZE SECONDES (séance du 11/09), et la
    // courbe a suivi : une seconde de plateau en tête, deux de plancher en queue.
    // L'exemple d'origine — « 5.5sec vaut 50pts » — était calibré sur dix
    // secondes ; sur seize, c'est la MOITIÉ DE LA PENTE qui vaut la moitié du
    // bonus, et elle tombe à 8,5 s restantes.
    expect(cc.meta.rapidite).toEqual({ plateau: 15, plancher: 2, max: 100 });
    expect(bonusRapidite(8.5 * 1000, cc.meta.rapidite)).toBe(50);
    expect(bonusRapidite(16 * 1000, cc.meta.rapidite)).toBe(100);
    expect(bonusRapidite(2 * 1000, cc.meta.rapidite)).toBe(0);
  });

  it('plafonne une manche à 1500 points, ce que l\'énoncé annonce', () => {
    // Cinq questions à 200 + 100 : « Maximum 1500pts ». Le compte tombe.
    expect(QUESTIONS_PAR_PARTIE * (cc.meta.points + cc.meta.rapidite.max)).toBe(1500);
    const rt = cc.buildRound({ id: 'cc' });
    rt.debutsDeTour = {};
    for (let tour = 2; tour <= rt.tours; tour += 1) {
      const q = rt.questions[tour - 2];
      rt.debutsDeTour[tour] = tour * 100_000;
      const liste = FORMES[q.forme].choix === 'couleurs' ? COULEURS
        : FORMES[q.forme].choix === 'cases' ? NUMEROS : null;
      const valeur = liste ? liste.indexOf(q.reponse) : q.reponse;
      const carte = new Map([['p', { value: valeur, at: rt.debutsDeTour[tour] }]]);
      if (tour === rt.tours) { rt.answers = carte; rt.tour = tour; } else rt[`answersTour${tour}`] = carte;
    }
    const r = cc.score(rt).results.get('p');
    expect(r.base + r.speed).toBe(1500);
    expect(r.bons).toBe(5);
    expect(r.rates).toBe(0);
  });

  it('ne donne rien à une mauvaise réponse, et ne retire rien', () => {
    const rt = cc.buildRound({ id: 'cc' });
    rt.debutsDeTour = {};
    for (let tour = 2; tour <= rt.tours; tour += 1) {
      rt.debutsDeTour[tour] = tour * 100_000;
      const carte = new Map([['p', { value: 'réponse fausse', at: rt.debutsDeTour[tour] }]]);
      if (tour === rt.tours) { rt.answers = carte; rt.tour = tour; } else rt[`answersTour${tour}`] = carte;
    }
    const r = cc.score(rt).results.get('p');
    expect(r.base).toBe(0);
    expect(r.speed).toBe(0);
    expect(r.correct).toBe(false);
  });

  it('LA GRILLE NE PART JAMAIS dans la question publique', () => {
    // C'est tout le jeu. Une charge utile qui porterait la matrice la rendrait
    // lisible dans l'inspecteur avant d'avoir été vue.
    const rt = cc.buildRound({ id: 'cc' });
    for (let tour = 1; tour <= rt.tours; tour += 1) {
      rt.tour = tour;
      const pub = JSON.stringify(cc.publicQuestion(rt));
      for (const o of rt.matrice) {
        expect(pub.includes(o.id), `l'objet ${o.id} fuit dans la question publique`).toBe(false);
      }
      // Et pas davantage la réponse de la question en cours, quand elle est un nom.
      if (tour > 1) {
        const q = rt.questions[tour - 2];
        if (!FORMES[q.forme].choix) {
          expect(pub.includes(q.reponse), 'la réponse fuit dans la question publique').toBe(false);
        }
      }
    }
  });

  it('la fenêtre d\'une question dure dix secondes, celle de la grille trente-huit', () => {
    const rt = cc.buildRound({ id: 'cc' });
    expect(rt.durationMs).toBe(DUREE_GRILLE_MS);
    expect(cc.dureeDuTour({ ...rt, tour: 1 })).toBe(DUREE_GRILLE_MS);
    expect(cc.dureeDuTour({ ...rt, tour: 2 })).toBe(DUREE_QUESTION_MS);
    // Et l'animateur ne reprend la main QU'ENTRE LES QUESTIONS : la grille
    // enchaîne toute seule, sinon la manche s'arrête sur une grille vide.
    expect(cc.attendLAnimateur({ tour: 1 })).toBe(false);
    expect(cc.attendLAnimateur({ tour: 2 })).toBe(true);
  });
});

describe('« Derrière quel numéro se cache … ? » — la sixième forme', () => {
  it('propose les neuf numéros, et sa réponse est la case', () => {
    // AJOUTÉE À LA SÉANCE DU 11/09, et c'est l'inverse exact de « quel objet se
    // cache derrière 2 ? » : la même paire objet/case, lue dans l'autre sens.
    expect(FORMES.numero_de).toEqual({ min: 1, max: 3, choix: 'cases' });
    expect(NUMEROS).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
  });

  it('apparaît dans toute manche — son quota commence à un', () => {
    for (let i = 0; i < 500; i += 1) {
      const { questions } = tirerLaManche();
      const n = questions.filter((q) => q.forme === 'numero_de').length;
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(3);
    }
  });

  it('se note sur le NUMÉRO choisi, pas sur un nom', () => {
    const cc = modules.cache_cache;
    const rt = cc.buildRound({ id: 'cc' });
    // On force la première question à cette forme pour la noter seule.
    const q = rt.questions.find((x) => x.forme === 'numero_de');
    const tour = rt.questions.indexOf(q) + 2;
    rt.debutsDeTour = { [tour]: 0 };
    // LA MANCHE EST POSÉE SUR CE TOUR-LÀ, et les réponses vont dans `rt.answers`.
    // Le contrôle écrivait dans `answersTour${tour}` en laissant `rt.tour` sur le
    // DERNIER tour : quand le tirage plaçait cette question en dernier — une fois
    // sur six — les deux coïncidaient, le moteur lisait `rt.answers` (vide), et
    // le contrôle tombait sans qu'aucun défaut n'existe. Un contrôle qui échoue
    // une fois sur six finit par être cru à tort, dans un sens ou dans l'autre.
    rt.tour = tour;
    rt.answers = new Map([
      ['juste', { value: Number(q.reponse) - 1, at: 0 }],
      ['faux', { value: (Number(q.reponse) % 9), at: 0 }],
    ]);
    const { results } = cc.score(rt);
    expect(results.get('juste').bons).toBe(1);
    expect(results.get('faux').bons).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// LA MODÉRATION — CE QUE L'ANIMATEUR RÈGLE AU STUDIO COMMANDE VRAIMENT LE TIRAGE
// ---------------------------------------------------------------------------
//
// CE QUI A ÉTÉ DEMANDÉ : « il faudrait que j'aie accès aux questions possibles
// [...] Je dois pouvoir voir, modifier et créer : la question avec ses variables
// [...] le nombre d'apparitions minimum et maximum de la question par manche »,
// et « accès dans le studio à la base de données des images [...] son Nom et sa
// Couleur [...] modifier les informations et ajouter de nouvelle ligne ».
//
// LE DÉFAUT CONTRE LEQUEL CES CONTRÔLES EXISTENT est celui d'un écran qui ne
// commande rien : des champs qu'on remplit, qu'on enregistre, et que le jeu
// ignore. Rien à l'écran du Studio ne le dirait. On ne vérifie donc pas que le
// formulaire s'affiche — on vérifie que ce qu'il écrit ARRIVE DANS LA MANCHE.
describe('la modération de « Cache-cache »', () => {
  // UN HASARD REPRODUCTIBLE, PAS UNE CONSTANTE. Un `() => 0.42` n'est pas un
  // tirage : le battage devient l'identité, la même répartition est choisie aux
  // quarante essais, et une manche impossible le reste — le contrôle échouerait
  // sur un jeu qui, lui, fonctionne. Une suite congruentielle donne des tirages
  // différents ET rejouables.
  const graine = (n) => () => {
    n = (n * 1664525 + 1013904223) % 4294967296;
    return n / 4294967296;
  };
  const alea = graine(7);

  it('un énoncé réécrit au Studio est celui que les joueurs lisent', () => {
    const contenu = {
      gabarits: [
        { id: 'g-seul', forme: 'couleur_de', gabarit: 'DE QUELLE TEINTE EST {objet} ?', min: 5, max: 5, actif: true },
      ],
    };
    const rt = tirerLaManche(alea, contenu);
    expect(rt).not.toBeNull();
    expect(rt.questions).toHaveLength(QUESTIONS_PAR_PARTIE);
    for (const q of rt.questions) {
      expect(q.forme).toBe('couleur_de');
      expect(q.texte).toMatch(/^DE QUELLE TEINTE EST /);
      // La balise est REMPLACÉE, pas recopiée : c'est toute la différence entre
      // une variable et un morceau de texte.
      expect(q.texte).not.toContain('{objet}');
    }
  });

  it('un gabarit éteint ne sort plus, et ses quotas ne bloquent pas le tirage', () => {
    const contenu = {
      gabarits: GABARITS_PAR_DEFAUT.map((g) => (
        g.forme === 'couleur_de' ? { ...g, actif: false } : { ...g, min: 0, max: 5 }
      )),
    };
    for (let i = 0; i < 30; i += 1) {
      const rt = tirerLaManche(graine(i + 1), contenu);
      expect(rt).not.toBeNull();
      expect(rt.questions.some((q) => q.forme === 'couleur_de')).toBe(false);
    }
  });

  it('les quotas réglés au Studio sont tenus, pas ceux du dépôt', () => {
    // Le dépôt plafonne « derrière quel numéro » à trois. L'animateur en demande
    // quatre : c'est SON réglage qui fait loi, sinon le champ ne sert à rien.
    const contenu = {
      gabarits: [
        { id: 'g-num', forme: 'numero_de', gabarit: 'Derrière quel numéro se cache « {objet} » ?', min: 4, max: 4, actif: true },
        { id: 'g-uni', forme: 'couleur_unique', gabarit: "Quelle couleur n'est là qu'une fois ?", min: 1, max: 1, actif: true },
      ],
    };
    const rt = tirerLaManche(alea, contenu);
    expect(rt).not.toBeNull();
    expect(rt.questions.filter((q) => q.forme === 'numero_de')).toHaveLength(4);
    expect(rt.questions.filter((q) => q.forme === 'couleur_unique')).toHaveLength(1);
  });

  it('un nom et une couleur corrigés au Studio deviennent la question ET la réponse', () => {
    // Les quarante noms du dépôt sont remplacés par neuf objets inventés. Si le
    // tirage lisait encore la banque du dépôt, aucun de ces noms n'apparaîtrait.
    // DIX NOMS DÉCLINÉS DANS LES CINQ COULEURS, comme la vraie banque en décline
    // quarante : la matrice exige neuf NOMS distincts et les cinq couleurs, il
    // faut donc au moins neuf noms et de quoi choisir dans chacune.
    const objets = COULEURS.flatMap((couleur, i) => (
      Array.from({ length: 10 }, (_, j) => (
        { id: `faux-${i}-${j}`, nom: `Bidule${j}`, couleur, src: '/objets/faux.webp' }
      ))
    ));
    const contenu = {
      objets,
      gabarits: [
        { id: 'g-c', forme: 'couleur_de', gabarit: 'Couleur de « {objet} » ?', min: 5, max: 5, actif: true },
      ],
    };
    const rt = tirerLaManche(alea, contenu);
    expect(rt).not.toBeNull();
    for (const o of rt.matrice) expect(o.nom).toMatch(/^Bidule/);
    for (const q of rt.questions) {
      expect(q.texte).toMatch(/Bidule/);
      expect(COULEURS).toContain(q.reponse);
    }
  });

  it('une banque vide ou absente retombe sur le dépôt plutôt que de casser l\'antenne', () => {
    // L'animateur peut tout effacer d'un module. Le jeu doit repartir, pas mourir.
    for (const contenu of [undefined, {}, { gabarits: [], objets: [] }]) {
      const rt = tirerLaManche(alea, contenu);
      expect(rt, `contenu ${JSON.stringify(contenu)}`).not.toBeNull();
      expect(rt.questions).toHaveLength(QUESTIONS_PAR_PARTIE);
    }
  });

  it('contenuDeLaBanque lit l\'entrée marquée et ignore le reste', () => {
    const gabarits = [{ id: 'g', forme: 'couleur_de', gabarit: 'X {objet} ?', min: 5, max: 5, actif: true }];
    const lu = contenuDeLaBanque([
      { id: 'q1', text: 'une question d\'un autre jeu' },
      { kind: MARQUE_CONTENU, gabarits, objets: [] },
    ]);
    expect(lu.gabarits).toEqual(gabarits);
    // Pas d'entrée marquée : le dépôt, jamais une banque vide.
    expect(contenuDeLaBanque([]).gabarits).toEqual(GABARITS_PAR_DEFAUT);
  });

  it('toute forme que le Studio propose est une forme que le serveur sait calculer', () => {
    // LE PIÈGE : ajouter une forme au catalogue du Studio sans la fabrique
    // correspondante. Le bouton existerait, la question serait ajoutée, et la
    // manche entière échouerait au tirage — à l'antenne, sans rien pour le dire.
    for (const forme of Object.keys(VARIABLES_PAR_FORME)) {
      expect(FORMES[forme], `la forme « ${forme} » est proposée mais inconnue du tirage`).toBeTruthy();
    }
    for (const forme of Object.keys(FORMES)) {
      expect(VARIABLES_PAR_FORME[forme], `la forme « ${forme} » n'a pas de variables déclarées`).toBeTruthy();
      // ET SON NOM DEVANT L'ANIMATEUR. Sans libellé, le Studio afficherait le nom
      // de code — « couleur_de » dans un formulaire de modération — ou, pire, le
      // vide. C'est le genre d'oubli qu'on ne voit qu'en ouvrant l'écran.
      expect(LIBELLES_PAR_FORME[forme], `la forme « ${forme} » n'a pas de libellé`).toBeTruthy();
    }
    // Et chaque balise déclarée est bien celle qu'emploie le gabarit du dépôt.
    for (const g of GABARITS_PAR_DEFAUT) {
      for (const tag of VARIABLES_PAR_FORME[g.forme]) {
        expect(g.gabarit, `le gabarit de « ${g.forme} » n'emploie pas ${tag}`).toContain(tag);
      }
    }
  });
});
