// « CUEILLETTE » — LA RESSEMBLANCE ENTRE DEUX DESSINS.
//
// CE QUI A ÉTÉ DEMANDÉ (16/09) : « ce score ne représentera pas une vérité
// absolue, mais ça doit être une estimation algorithmique cohérente basée sur la
// position des traits, la forme générale, les proportions, les éléments manquants
// ou ajoutés, la densité du dessin. L'objectif est surtout de classer les joueurs
// de manière amusante et perçue comme JUSTE, pas de produire une évaluation
// artistique parfaite. »
//
// ================================================================================
// CE QUI REND CE FICHIER DIFFÉRENT DE TOUS LES AUTRES BARÈMES DU PROJET
// ================================================================================
//
// Partout ailleurs, il y a une bonne réponse : un index, un nombre, une année, un
// mot. Le contrôle compare ce que le joueur a donné à ce que le barème verse, et
// l'affaire est close. ICI, IL N'Y A PAS DE BONNE RÉPONSE — il y a un dessin, et
// un autre dessin.
//
// Un score peut donc être parfaitement implémenté et parfaitement ridicule. Un
// contrôle vert ne prouve rien s'il se contente de vérifier que la fonction rend
// un nombre entre zéro et cent. Ce qui se vérifie, c'est l'ORDRE : le même dessin
// doit battre le même dessin décalé, qui doit battre la moitié du dessin, qui doit
// battre un gribouillis. C'est ce que fait `tests/unit/cueillette.test.js`, sur
// des figures dont on SAIT ce qu'on attend.
//
// ================================================================================
// UN DESSIN EST UNE SUITE DE TRAITS, PAS UNE IMAGE
// ================================================================================
//
// Un trait est une liste de points, chaque point en coordonnées NORMALISÉES — de 0
// à 1 sur la boîte du dessin. Trois raisons, et la troisième est décisive :
//
//   1. LE POIDS. Mille joueurs envoyant chacun une image de 400 × 400 en trente
//      secondes, c'est des dizaines de mégaoctets sur le réseau d'un salon. Les
//      mêmes dessins en traits pèsent quelques kilo-octets.
//   2. L'ÉCHELLE. Le dessin s'affiche sur un téléphone, dans la console de
//      l'animateur, et EN GRAND sur une toile de 1920 × 1080 au moment du partage.
//      Une image tirée d'un téléphone y serait floue ; des traits se redessinent à
//      n'importe quelle taille.
//   3. LA SUPERPOSITION. L'écran de résultat montre le dessin du joueur PAR-DESSUS
//      la cible, en vert clair, « ne reprendre que les traits réalisés par le
//      joueur, pas de fond ». Avec une image il faudrait détourer ce fond — le
//      piège du blanc enclos, déjà rencontré deux fois dans ce projet. Avec des
//      traits, la couleur est un attribut de tracé : il n'y a rien à détourer.
//
// NORMALISÉES, parce que la boîte n'a pas la même taille d'un écran à l'autre, et
// que le jeu exige par ailleurs que la zone de dessin ait EXACTEMENT celle de la
// cible affichée. Le serveur ne veut pas le savoir : il reçoit des fractions.

// LA GRILLE DE COMPARAISON. 64 × 64 suffit : au-delà, on mesure le tremblement de
// la main plutôt que la ressemblance, et le calcul se paie sur mille joueurs.
export const COTE = 64;

// L'ÉPAISSEUR DU TRAIT RASTÉRISÉ, en cases de la grille. Un trait d'un seul pixel
// de large ne rencontrerait presque jamais celui d'en face.
export const EPAISSEUR = 1.2;

// LE PAS D'ÉCHANTILLONNAGE LE LONG D'UN TRAIT, en cases. Constant, quelle que soit
// la longueur du segment et la cadence de l'appareil qui l'a produit.
export const PAS_RASTER = 0.5;

// LE RAYON DU FLOU, en cases.
//
// CE N'EST PAS UN DÉTAIL, C'EST LE CŒUR DU CALCUL. Sans lui, deux traits parallèles
// distants de deux cases ne se recouvrent PAS DU TOUT : un dessin très ressemblant
// obtiendrait un score proche de zéro, et le jeu serait perçu comme injuste — ce
// que l'énoncé interdit explicitement. Le flou transforme « au même endroit » en
// « à peu près au même endroit », qui est la question qu'un spectateur se pose.
export const FLOU = 3;

// LES TROIS MESURES ET LEUR POIDS. L'énoncé en cite cinq ; elles se ramènent à
// trois, et le tableau dit laquelle couvre quoi.
// LES QUATRE MESURES ET LEUR POIDS — une par ligne de l'énoncé.
//
// POURQUOI « FORME » EST SÉPARÉE DE « POSITION », alors qu'une seule mesure avait
// d'abord semblé suffire. Mesuré sur l'échelle de figures : un dessin JUSTE mais
// deux fois trop petit obtenait trois pour cent, tandis qu'un gribouillis au
// hasard en obtenait neuf. Le gribouillis gagnait parce qu'il recouvre la cible
// PAR ACCIDENT — il noircit tout — pendant que le petit dessin, correct mais
// ailleurs, ne rencontrait aucun trait. Un spectateur aurait objecté, et l'énoncé
// demande explicitement un classement « perçu comme juste ».
//
// La forme se mesure donc sur les deux dessins RAMENÉS À LA MÊME BOÎTE : la taille
// et la place n'y jouent plus, et il ne reste que le dessin. Les proportions, qui
// sont précisément ce qu'on vient de retirer, ont leur propre mesure — c'est ce
// que l'énoncé demande en les citant à part.
export const POIDS = {
  // « la position des traits »
  recouvrement: 0.35,
  // « la forme générale »
  forme: 0.25,
  // « les proportions »
  proportions: 0.15,
  // « les éléments manquants ou ajoutés », « la densité du dessin »
  densite: 0.25,
};

// ---------------------------------------------------------------------------
// LA FORME D'UN DESSIN, ET SA VALIDATION
// ---------------------------------------------------------------------------
//
// LE SERVEUR NE FAIT CONFIANCE À RIEN DE CE QU'IL REÇOIT. Un dessin arrive d'un
// téléphone : il peut porter mille traits d'un million de points, des coordonnées
// hors de la boîte, des valeurs qui ne sont pas des nombres. On borne, on élague,
// on jette ce qui ne se lit pas — sans jamais refuser le dessin entier pour un
// point aberrant, ce qui punirait un joueur pour un défaut de son navigateur.
export const TRAITS_MAX = 400;
export const POINTS_PAR_TRAIT_MAX = 500;
export const POINTS_MAX = 20_000;

export function nettoyerDessin(brut) {
  if (!Array.isArray(brut)) return [];
  const sortie = [];
  let total = 0;
  for (const trait of brut.slice(0, TRAITS_MAX)) {
    if (!Array.isArray(trait)) continue;
    const propre = [];
    for (const p of trait.slice(0, POINTS_PAR_TRAIT_MAX)) {
      if (total >= POINTS_MAX) break;
      // `Number(null)` VAUT ZÉRO, et c'est la deuxième fois cette semaine que ce
      // piège se referme : un point `[null, null]` serait devenu le coin
      // supérieur gauche de la boîte, un trait fantôme dans le dessin du joueur.
      // On exige un NOMBRE avant de convertir quoi que ce soit.
      const bx = Array.isArray(p) ? p[0] : p?.x;
      const by = Array.isArray(p) ? p[1] : p?.y;
      if (typeof bx !== 'number' || typeof by !== 'number') continue;
      const x = bx; const y = by;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      propre.push([Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))]);
      total += 1;
    }
    // UN TRAIT D'UN SEUL POINT EST UN POINT, et c'est un geste volontaire — le
    // point sur un i, un œil. On le garde : il sera rastérisé comme une tache.
    if (propre.length) sortie.push(propre);
  }
  return sortie;
}

export function compterPoints(dessin) {
  return (dessin || []).reduce((n, t) => n + t.length, 0);
}

// ---------------------------------------------------------------------------
// LA RASTÉRISATION
// ---------------------------------------------------------------------------

// Une case de la grille reçoit de l'encre selon sa distance au segment tracé : au
// centre du trait elle est pleine, au-delà de l'épaisseur elle reste vide. C'est
// l'anticrénelage du pauvre, et il suffit — on compare des quantités, pas des
// contours.
function poser(grille, x, y, quantite) {
  const cx = Math.round(x);
  const cy = Math.round(y);
  const r = Math.ceil(EPAISSEUR);
  for (let j = cy - r; j <= cy + r; j += 1) {
    if (j < 0 || j >= COTE) continue;
    for (let i = cx - r; i <= cx + r; i += 1) {
      if (i < 0 || i >= COTE) continue;
      const d = Math.hypot(i - x, j - y);
      if (d > EPAISSEUR) continue;
      const v = quantite * (1 - d / EPAISSEUR);
      const k = j * COTE + i;
      if (v > grille[k]) grille[k] = v;
    }
  }
}

// UN DESSIN RAMENÉ À SA PROPRE BOÎTE. Ce qui en sort n'a plus ni taille ni
// position : il ne reste que la forme, qui est ce que la mesure suivante compare.
//
// UNE BOÎTE PLATE — un trait parfaitement horizontal — ne se divise pas : on la
// laisse telle quelle plutôt que de rendre l'infini.
export function normaliser(dessin) {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const t of dessin || []) {
    for (const [x, y] of t) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (!Number.isFinite(x0)) return [];
  const l = x1 - x0;
  const h = y1 - y0;
  // On garde le RAPPORT de la figure : l'étirer pour remplir le carré ferait d'un
  // trait vertical et d'un trait horizontal la même forme.
  const echelle = Math.max(l, h) > 0 ? 1 / Math.max(l, h) : 1;
  const dx = (1 - l * echelle) / 2;
  const dy = (1 - h * echelle) / 2;
  return dessin.map((t) => t.map(([x, y]) => [
    (x - x0) * echelle + dx,
    (y - y0) * echelle + dy,
  ]));
}

export function rasteriser(dessin) {
  const grille = new Float32Array(COTE * COTE);
  for (const trait of dessin || []) {
    if (trait.length === 1) {
      poser(grille, trait[0][0] * (COTE - 1), trait[0][1] * (COTE - 1), 1);
      continue;
    }
    for (let i = 1; i < trait.length; i += 1) {
      const [x0, y0] = trait[i - 1];
      const [x1, y1] = trait[i];
      const ax = x0 * (COTE - 1); const ay = y0 * (COTE - 1);
      const bx = x1 * (COTE - 1); const by = y1 * (COTE - 1);
      // ON MARCHE LE LONG DU SEGMENT, À PAS CONSTANT.
      //
      // Deux points consécutifs d'un geste rapide peuvent être distants de vingt
      // cases : les relier par leurs seules extrémités laisserait un trait en
      // pointillé, et un dessin rapide serait noté comme un dessin troué.
      //
      // MAIS LE PAS DOIT ÊTRE LE MÊME PARTOUT, et c'est un défaut qu'il a fallu
      // mesurer pour voir. Un pas déduit de la longueur du segment échantillonne
      // plus SERRÉ sur les segments courts : un téléphone qui rapporte cent points
      // par seconde produisait alors un quart d'encre de plus qu'un appareil qui
      // en rapporte vingt, POUR LE MÊME GESTE — 164 unités contre 132, mesuré. Le
      // score aurait dépendu de la cadence du matériel, ce qui est la définition
      // même d'un classement injuste.
      const pas = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / PAS_RASTER));
      for (let k = 0; k <= pas; k += 1) {
        poser(grille, ax + ((bx - ax) * k) / pas, ay + ((by - ay) * k) / pas, 1);
      }
    }
  }
  return grille;
}

// Un flou séparable — deux passes d'une moyenne glissante, horizontale puis
// verticale. C'est vingt fois moins de calcul qu'un noyau carré, pour un résultat
// que personne ne saurait distinguer à cette échelle.
export function flouter(grille, rayon = FLOU) {
  if (rayon <= 0) return grille;
  const large = new Float32Array(COTE * COTE);
  const sortie = new Float32Array(COTE * COTE);
  const n = rayon * 2 + 1;
  for (let y = 0; y < COTE; y += 1) {
    for (let x = 0; x < COTE; x += 1) {
      let s = 0;
      for (let d = -rayon; d <= rayon; d += 1) {
        const i = Math.min(COTE - 1, Math.max(0, x + d));
        s += grille[y * COTE + i];
      }
      large[y * COTE + x] = s / n;
    }
  }
  for (let y = 0; y < COTE; y += 1) {
    for (let x = 0; x < COTE; x += 1) {
      let s = 0;
      for (let d = -rayon; d <= rayon; d += 1) {
        const j = Math.min(COTE - 1, Math.max(0, y + d));
        s += large[j * COTE + x];
      }
      sortie[y * COTE + x] = s / n;
    }
  }
  return sortie;
}

// ---------------------------------------------------------------------------
// LES TROIS MESURES
// ---------------------------------------------------------------------------

function encre(grille) {
  let s = 0;
  for (let i = 0; i < grille.length; i += 1) s += grille[i];
  return s;
}

// LA BOÎTE ENGLOBANTE DE L'ENCRE — largeur, hauteur, centre. C'est ce qui porte
// « les proportions » : un dessin juste mais deux fois trop petit, ou collé dans
// un coin, se voit ici et nulle part ailleurs.
export function boiteDe(grille, seuil = 0.08) {
  let x0 = COTE; let y0 = COTE; let x1 = -1; let y1 = -1;
  for (let y = 0; y < COTE; y += 1) {
    for (let x = 0; x < COTE; x += 1) {
      if (grille[y * COTE + x] < seuil) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  return {
    x: x0, y: y0, l: x1 - x0 + 1, h: y1 - y0 + 1,
    cx: (x0 + x1) / 2, cy: (y0 + y1) / 2,
  };
}

// LE RECOUVREMENT — ET POURQUOI CE N'EST PAS UNE SIMPLE INTERSECTION SUR UNION.
//
// La première version comparait ce que les deux tracés ont en commun à ce qu'ils
// couvrent ensemble. Mesuré, cela donnait des classements FAUX :
//   - la MOITIÉ d'un dessin obtenait 0,51 — presque autant qu'un dessin complet
//     légèrement décalé, alors qu'il manque la moitié de la figure ;
//   - le dessin JUSTE avec un gribouillage par-dessus tombait à 0,13, c'est-à-dire
//     au niveau du pur gribouillis — alors qu'il contient la bonne figure.
//
// On mesure donc DEUX choses distinctes, que l'énoncé distingue lui-même :
//   - CE QUI MANQUE : quelle part de la cible le joueur a-t-il couverte ?
//   - CE QUI EST EN TROP : quelle part de son trait est-elle sur la cible ?
//
// Leur moyenne harmonique punit le déséquilibre : couvrir toute la cible en
// noircissant la page ne suffit pas, et tracer trois traits parfaits non plus.
// C'est exactement « les éléments manquants OU ajoutés » de l'énoncé.
function recouvrement(cible, joueur) {
  let commun = 0;
  let totalCible = 0;
  let totalJoueur = 0;
  for (let i = 0; i < cible.length; i += 1) {
    commun += Math.min(cible[i], joueur[i]);
    totalCible += cible[i];
    totalJoueur += joueur[i];
  }
  if (totalCible <= 0 || totalJoueur <= 0) return 0;
  const couvert = commun / totalCible;     // ce qui manque
  const utile = commun / totalJoueur;      // ce qui est en trop
  return couvert + utile > 0 ? (2 * couvert * utile) / (couvert + utile) : 0;
}

function accordDeBoites(bc, bj) {
  if (!bc || !bj) return 0;
  const rapport = (u, v) => (Math.max(u, v) > 0 ? Math.min(u, v) / Math.max(u, v) : 1);
  const taille = (rapport(bc.l, bj.l) + rapport(bc.h, bj.h)) / 2;
  // L'écart des centres, rapporté à la diagonale de la grille : deux dessins de
  // même taille posés aux deux coins n'ont rien en commun.
  const ecart = Math.hypot(bc.cx - bj.cx, bc.cy - bj.cy) / (COTE * Math.SQRT2);
  return Math.max(0, taille * (1 - ecart * 2));
}

function accordDeDensite(ec, ej) {
  if (ec <= 0 && ej <= 0) return 1;
  if (ec <= 0 || ej <= 0) return 0;
  // Un rapport, jamais une différence : deux fois trop d'encre et deux fois trop
  // peu doivent être punis pareil. C'est ce qui porte « les éléments manquants ou
  // ajoutés » — une moitié de dessin, comme un gribouillage par-dessus.
  return Math.min(ec, ej) / Math.max(ec, ej);
}

// ---------------------------------------------------------------------------
// LA COURBE DE PRÉSENTATION
// ---------------------------------------------------------------------------
//
// POURQUOI LE SCORE BRUT NE PEUT PAS ÊTRE MONTRÉ TEL QUEL. Un recouvrement de
// tracés donne des valeurs basses et TASSÉES : sur des dessins faits à la main, il
// est rare de dépasser un tiers, et tout le monde se retrouve entre dix et trente
// pour cent. Les vingt tranches de cinq pour cent que l'énoncé demande seraient
// alors vides sur dix-huit d'entre elles, et deux dessins très différents
// paraîtraient équivalents.
//
// La courbe étire la plage utile sur zéro-cent. ELLE NE CHANGE PAS LE CLASSEMENT :
// elle est strictement croissante, donc l'ordre des joueurs est exactement celui
// du score brut. Seule sa lisibilité change — et c'est précisément ce que l'énoncé
// demande, « classer de manière amusante et perçue comme juste ».
// LES DEUX SEULS NOMBRES À TOURNER SI LE JEU PARAÎT TROP DUR OU TROP FACILE.
//
// Ils ont été calés sur une échelle de figures MESURÉE — le même carré, le même
// tremblé, le même décalé, la moitié, le quart, un cercle à la place du carré, un
// gribouillis. Le plancher est posé au-dessus du gribouillis : noircir la page au
// hasard ne doit rapporter aucun point, et c'est le cas — il tombe sous les
// quarante pour cent du barème.
//
// CE QUI RESTE INCERTAIN, ET IL FAUT LE DIRE : ces valeurs sont réglées sur des
// figures de synthèse, pas sur de vrais dessins faits au doigt en trente secondes
// contre une vraie banque d'images. Une seule partie réelle suffira à les ajuster,
// et il n'y a que ces deux nombres à toucher — c'est pour cela qu'ils sont ici,
// nommés, et non répartis dans le calcul.
export const BRUT_PLANCHER = 0.24;
export const BRUT_PLAFOND = 1.0;

export function presenter(brut) {
  const t = (brut - BRUT_PLANCHER) / (BRUT_PLAFOND - BRUT_PLANCHER);
  return Math.round(Math.min(1, Math.max(0, t)) * 100);
}

// ---------------------------------------------------------------------------
// LA RESSEMBLANCE
// ---------------------------------------------------------------------------

// UNE GRILLE PRÉCALCULÉE, DÉPLIÉE — ET ÉPAISSIE COMME UN TRAIT DE JOUEUR.
//
// LE DÉFAUT QUE CETTE ÉPAISSEUR RÉPARE, ET IL ÉTAIT GRAVE. Les cibles arrivent
// d'une image : leur grille est un pointillé de cases allumées, larges d'une à deux
// cases. Le dessin d'un joueur, lui, est rastérisé À PARTIR DE SES TRAITS, avec une
// épaisseur — il en ressort deux fois plus d'encre POUR LA MÊME FIGURE.
//
// Mesuré avant correction : une copie FIDÈLE d'une tulipe obtenait cinquante-six
// pour cent, quand une main tremblante en obtenait soixante-cinq et une moitié de
// dessin soixante-dix. Le classement était à l'envers, et la cause n'était pas dans
// le calcul de ressemblance : les deux dessins n'étaient pas mesurés dans la même
// unité. Toute la banque aurait sous-noté tous les joueurs, à l'antenne, sans que
// rien ne le signale.
//
// La cible passe donc par le MÊME épaississement que les traits du joueur.
export function grilleDepuisBits(b64) {
  const octets = Buffer.from(b64, 'base64');
  const g = new Float32Array(COTE * COTE);
  for (let i = 0; i < COTE * COTE; i += 1) {
    if (octets[i >> 3] & (1 << (i & 7))) poser(g, i % COTE, Math.floor(i / COTE), 1);
  }
  return g;
}

// LA RESSEMBLANCE D'UN DESSIN AVEC UNE CIBLE DONNÉE PAR SES GRILLES.
//
// C'est le chemin qu'emprunte le jeu : la cible ne peut pas être fournie en traits,
// personne ne l'a dessinée à la main. `ressemblance` ci-dessous, qui compare deux
// jeux de traits, sert aux contrôles — où l'on veut décrire les deux figures.
export function ressemblanceContreGrilles(bitsPosition, bitsForme, joueur) {
  const dj = nettoyerDessin(joueur);
  if (!compterPoints(dj)) {
    return { pourcent: 0, brut: 0, detail: { recouvrement: 0, forme: 0, proportions: 0, densite: 0 } };
  }
  const gc = flouter(grilleDepuisBits(bitsPosition));
  const nc = flouter(grilleDepuisBits(bitsForme));
  const gj = flouter(rasteriser(dj));
  const nj = flouter(rasteriser(normaliser(dj)));
  return composer(gc, nc, gj, nj);
}

// LE CŒUR DU CALCUL, ISOLÉ pour que les deux chemins — traits contre traits, et
// grilles contre traits — versent exactement la même note. Deux copies auraient
// fini par diverger, et le jeu n'aurait plus noté comme ses contrôles le vérifient.
function composer(gc, nc, gj, nj) {
  const detail = {
    recouvrement: recouvrement(gc, gj),
    forme: recouvrement(nc, nj),
    proportions: accordDeBoites(boiteDe(gc), boiteDe(gj)),
    densite: accordDeDensite(encre(gc), encre(gj)),
  };
  const brut = detail.recouvrement * POIDS.recouvrement
    + detail.forme * POIDS.forme
    + detail.proportions * POIDS.proportions
    + detail.densite * POIDS.densite;
  return { pourcent: presenter(brut), brut, detail };
}

export function ressemblance(cible, joueur) {
  const dj = nettoyerDessin(joueur);
  const dc = nettoyerDessin(cible);
  // UNE FEUILLE BLANCHE VAUT ZÉRO, DIT ICI PLUTÔT QUE CALCULÉ.
  //
  // CE QUE CETTE GARDE FAIT, EXACTEMENT — et il a fallu la saboter pour le savoir,
  // parce que les deux premières rédactions de ce commentaire se trompaient. Sans
  // elle, le score d'un joueur qui n'a rien dessiné vaudrait quand même zéro : les
  // quatre mesures rendent zéro dès qu'un seul des deux dessins est vide. La garde
  // ne répare donc RIEN ; elle court-circuite un calcul dont le résultat est connu,
  // et elle nomme le cas à l'endroit où on le cherchera.
  //
  // Le seul cas qu'elle change vraiment est celui d'une CIBLE vide — un état qui ne
  // devrait jamais exister. Il vaut zéro plutôt qu'un pour cent, ce qui évite
  // d'afficher une ressemblance née d'une comparaison entre deux riens.
  if (!compterPoints(dj) || !compterPoints(dc)) {
    return { pourcent: 0, brut: 0, detail: { recouvrement: 0, forme: 0, proportions: 0, densite: 0 } };
  }

  const gc = flouter(rasteriser(dc));
  const gj = flouter(rasteriser(dj));

  // LA FORME SE COMPARE SUR LES DEUX DESSINS RAMENÉS À LA MÊME BOÎTE — taille et
  // position retirées. C'est ce qui rattrape le dessin juste mais mal placé, et ce
  // qui n'aide en rien le gribouillis, dont la forme reste un gribouillis.
  return composer(
    gc,
    flouter(rasteriser(normaliser(dc))),
    gj,
    flouter(rasteriser(normaliser(dj))),
  );
}

// ---------------------------------------------------------------------------
// LE BARÈME
// ---------------------------------------------------------------------------
//
// « Si un joueur a au moins 40 % de correspondance, il gagne des points. S'il a
// entre 95 % et 100 %, il gagne 1200 pts. S'il a 40 %, il gagne 100 points. Entre
// 41 % et 94 %, une proportion entre 100 et 1200. Un joueur ne peut pas gagner
// entre 1 et 100 pts. Entre 0 % et 39 %, il ne gagne pas de point. »
//
// LE PALIER DE CENT POINTS À L'ENTRÉE est ce qui rend vraie la dernière phrase :
// la droite ne part pas de zéro, elle SAUTE à cent dès quarante pour cent.
export const SEUIL_POINTS = 40;
export const PLAFOND_POURCENT = 95;
export const POINTS_PLANCHER = 100;
export const POINTS_MAXIMUM = 1200;

export function pointsDe(pourcent) {
  const p = Math.round(Number(pourcent) || 0);
  if (p < SEUIL_POINTS) return 0;
  if (p >= PLAFOND_POURCENT) return POINTS_MAXIMUM;
  const t = (p - SEUIL_POINTS) / (PLAFOND_POURCENT - SEUIL_POINTS);
  return Math.round(POINTS_PLANCHER + t * (POINTS_MAXIMUM - POINTS_PLANCHER));
}
