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

// LA MARGE DE LA NORMALISATION, partagée par les deux chemins — les traits du
// joueur et la grille de la cible. Deux valeurs auraient remis les deux figures
// dans deux unités différentes, ce qui est le défaut que la dérivation de la forme
// vient précisément de supprimer.
export const MARGE_NORMALISATION = 0.04;
// L'ÉTALEMENT D'UNE FIGURE RAMENÉE À SA FORME, en cases. Treize : un bouleau —
// le dessin le plus élancé de la banque — tient encore dans la grille, et une
// pomme ronde n'y est pas minuscule.
export const RAYON_FORME = 13;

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
// ============================================================================
// DEUX MESURES PAIENT, DEUX MESURES RETIENNENT — ET CE PARTAGE VIENT D'UNE PLANCHE
// ============================================================================
//
// LA PREMIÈRE RÉDACTION ADDITIONNAIT LES QUATRE, chacune avec son poids. Elle
// passait tous les contrôles : le classement des figures de synthèse était le bon,
// à chaque fois. Elle était pourtant injuste, et il a fallu la REGARDER sur de
// vrais dessins pour le voir (`tests/outils/planche-cueillette.mjs`) :
//
//   — un GRIBOUILLIS au hasard rapportait 140 points sur un chêne, 380 sur un
//     tournesol ;
//   — une ROSE bien tracée obtenait 73 % contre un TOURNESOL, soit 760 points —
//     plus qu'un tournesol à moitié dessiné ;
//   — un dessin JUSTE mais tracé petit tombait à 35 % sur la pomme, c'est-à-dire
//     ZÉRO point, derrière le gribouillis.
//
// LA CAUSE, MESURÉE. Les proportions et la densité donnaient 0,89 et 0,66 au
// gribouillis, 0,95 et 0,81 à la rose. Additionnées, elles offraient QUARANTE POUR
// CENT DE LA NOTE à quiconque pose à peu près la bonne quantité d'encre dans à peu
// près la bonne boîte — ce qu'un gribouillis fait par construction. Pendant ce
// temps, le dessin juste mais petit était puni TROIS FOIS pour le même écart :
// par le recouvrement, par la densité (moins d'encre) et par les proportions
// (boîte plus petite).
//
// CE QUE L'ÉNONCÉ DEMANDE, RELU. « Le score tient compte de : la position des
// traits, la forme générale, les proportions, les éléments manquants ou ajoutés,
// la densité. » TENIR COMPTE N'EST PAS PAYER. Les deux mesures qui regardent la
// FIGURE paient ; les deux qui regardent son enveloppe retiennent — elles ne
// peuvent que réduire une note déjà gagnée par ressemblance. Un gribouillis n'a
// rien gagné, il n'a donc rien à retenir : il tombe.
// ============================================================================
// LA FORME PASSE DEVANT LA POSITION — DEMANDÉ, PUIS MESURÉ
// ============================================================================
//
// CE QUI A ÉTÉ DEMANDÉ (21/09) : « rendre beaucoup plus indulgent le calcul de la
// proportion […] en se basant bien plus sur la forme générale et les
// proportions ». Deux griefs, confirmés : le score général, et le cas du dessin
// JUSTE mais mal placé ou trop petit, qui tombait à zéro.
//
// CE QUE LA MESURE A MONTRÉ, sur les cinquante dessins. Un dessin juste tracé à
// 62 % de la taille et un gribouillis au hasard ont EXACTEMENT le même
// recouvrement — 0,48 tous les deux. La position des traits ne les distingue pas.
// Ce qui les sépare, c'est la forme (0,98 contre 0,46) et les proportions (0,96
// contre 0,70). Peser sur la position revenait donc à confondre le joueur
// appliqué qui dessine petit avec celui qui noircit la page.
//
// La forme prend donc largement le pas. Le recouvrement garde un cinquième — poids
// demandé par l'auteur le 24/09 : « mets le poids de la forme à 0,8 ». On ne
// descend pas plus bas : sans lui, « la position des traits », que l'énoncé cite en
// premier, ne serait plus mesurée du tout, et un dessin juste posé dans un coin
// vaudrait un dessin juste posé au bon endroit.
//
// CE QUE LE JEU REND AUJOURD'HUI, MESURÉ SUR LES CINQUANTE DESSINS — note médiane,
// puis la pire des cinquante. Ces chiffres valent pour l'ENSEMBLE du réglage en
// vigueur — poids, gardes ET courbe : les isoler les uns des autres n'aurait aucun
// sens, c'est leur composition que le joueur voit.
//
//   copie fidèle          100 %   (pire  98)
//   main légère            96 %   (pire  95)
//   main humaine           94 %   (pire  91)
//   main lourde            85 %   (pire  78)
//   juste mais petit       93 %   (pire  89)
//   juste mais de travers  84 %   (pire  74)
//
// LES DEUX DERNIÈRES LIGNES sont celles qui ont motivé le déplacement des poids :
// au départ, avec la position dominante (0,55 / 0,45), elles tombaient à 49 % et
// 43 % de médiane, et jusqu'à ZÉRO sur les pires cibles. Un dessin complet et
// juste ne s'effondre plus parce qu'il a été tracé petit ou posé de côté.
export const POIDS = {
  // « la position des traits » — le tracé du joueur, là où il l'a posé.
  recouvrement: 0.20,
  // « la forme générale » — les deux dessins ramenés à la même boîte.
  forme: 0.80,
};

// ============================================================================
// DEUX PLANCHERS, ET NON UN SEUL — PARCE QUE LES DEUX GARDES NE SE VALENT PAS
// ============================================================================
//
// Une garde qui pourrait tomber à zéro annulerait une ressemblance réelle sur un
// seul écart d'enveloppe : un dessin juste, tracé d'un trait plus fin, ne doit pas
// être ramené à rien. Elles retiennent, elles ne condamnent pas.
//
// MAIS ELLES NE DISCRIMINENT PAS PAREIL, et un plancher commun le cachait.
// Moyennes mesurées sur les cinquante dessins :
//
//                     proportions   densité
//   copie fidèle          1,00       1,00
//   main humaine          0,97       0,93
//   MAIN LOURDE           0,94       0,74
//   dessin juste, petit   0,96       0,70
//   GRIBOUILLIS           0,70       0,80
//
// LA DENSITÉ EST PERVERSE : elle punit la main qui tremble — un trait hésitant est
// plus long, donc plus encré à étendue égale — et le dessin tracé petit, dont les
// traits sont relativement plus épais sur une grille de 64 cases. Et elle ÉPARGNE
// le gribouillis, mieux noté qu'eux deux. Elle mesure une régularité de geste, pas
// une ressemblance.
//
// LES PROPORTIONS, elles, séparent nettement : 0,70 pour le gribouillis contre
// 0,94 à 1,00 pour tout dessin honnête. C'est le terme qui mérite de mordre — et
// c'est précisément celui que l'énoncé demande de peser davantage.
//
// D'où deux planchers : la densité ne peut coûter que quinze pour cent, les
// proportions jusqu'à la moitié. On n'a PAS retiré la densité du calcul —
// l'énoncé la cite, et elle reste seule à voir le dessin surchargé.
//
// LE PLANCHER DES PROPORTIONS EST PASSÉ DE 0,20 À 0,50 LE 24/09, à la demande de
// l'auteur. Ce qu'il change, mesuré : les médianes ne bougent que d'un point ou
// deux, mais les PIRES CAS honnêtes remontent nettement — la main lourde de 72 à
// 78 %, le dessin juste mais petit de 85 à 89 %, le dessin de travers de 68 à
// 74 %. C'est là que l'ancien plancher mordait : sur les cibles au rapport
// inhabituel, un bouleau tout en hauteur ou une tranche de pastèque, où un dessin
// honnête se trompe facilement de proportion sans cesser d'être reconnaissable.
//
// PRIX MESURÉ : la part des gribouillages qui rapportent passe de 3,40 % à 4,95 %.
// Le gribouillis a un accord de proportions de 0,70 — le plancher relevé lui rend
// donc aussi une part de ce qu'il perdait.
export const GARDE_MIN = { proportions: 0.50, densite: 0.85 };
const tempere = (accord, plancher) => plancher + (1 - plancher) * Math.min(1, Math.max(0, accord));

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
// UN TRAIT PEUT ÊTRE LONG, ET C'EST UN GESTE NORMAL (26/09). Cette borne valait
// cinq cents points : un sapin contourné d'un seul geste en compte plus de sept
// cents — la toile garde un point tous les 0,4 % de la boîte —, et le serveur
// coupait tout ce qui dépassait. Le côté gauche du dessin disparaissait sans
// bruit : un contour fidèle notait comme un demi-contour. Le trait se borne
// maintenant à cinq mille points, soit vingt fois le tour de la boîte ; c'est le
// TOTAL, plus bas, qui tient la charge du serveur.
export const POINTS_PAR_TRAIT_MAX = 5000;
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
  const traits = (dessin || []).filter((t) => t.length);
  if (!traits.length) return [];
  // LES MOMENTS SE PRENNENT SUR L'ENCRE RASTÉRISÉE, et non sur les points : un
  // téléphone qui rapporte cent points par seconde donnerait sinon plus de poids
  // aux gestes lents qu'aux gestes rapides. L'encre, elle, pèse ce que le trait
  // mesure — comme les cases du squelette de la cible.
  const m = momentsDe(rasteriser(traits));
  if (!m) return [];
  const k = m.r > 0 ? RAYON_FORME / m.r : 1;
  const c = (COTE - 1) / 2;
  return traits.map((t) => t.map(([x, y]) => [
    (c + (x * (COTE - 1) - m.cx) * k) / (COTE - 1),
    (c + (y * (COTE - 1) - m.cy) * k) / (COTE - 1),
  ]));
}

// LE CENTRE ET L'ÉTALEMENT D'UNE FIGURE — son centre de gravité, et l'écart
// quadratique moyen de son encre autour de lui.
//
// POURQUOI PLUS LA BOÎTE ENGLOBANTE (26/09). La forme se mesurait sur la figure
// ramenée à SA BOÎTE : ses points les plus extrêmes décidaient de toute
// l'échelle. Un sapin fidèlement contourné, mais au tronc un peu court, voyait
// sa boîte rétrécie en hauteur — toute la figure était alors agrandie et décalée
// par rapport à la cible, et la forme tombait à 0,60 pour un dessin juste. Une
// extrémité, c'est un seul trait ; le centre de gravité et l'étalement, c'est
// tout le dessin, et un détail n'y déplace presque rien.
export function momentsDe(grille) {
  let m = 0; let sx = 0; let sy = 0;
  for (let i = 0; i < grille.length; i += 1) {
    const v = grille[i];
    if (!v) continue;
    m += v; sx += v * (i % COTE); sy += v * Math.floor(i / COTE);
  }
  if (m <= 0) return null;
  const cx = sx / m; const cy = sy / m;
  let q = 0;
  for (let i = 0; i < grille.length; i += 1) {
    const v = grille[i];
    if (!v) continue;
    const dx = (i % COTE) - cx; const dy = Math.floor(i / COTE) - cy;
    q += v * (dx * dx + dy * dy);
  }
  return { cx, cy, r: Math.sqrt(q / m) };
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

// « LES PROPORTIONS » — LE RAPPORT DE LA FIGURE, ET NON SA TAILLE.
//
// LA PREMIÈRE VERSION COMPARAIT LES BOÎTES ENTIÈRES : largeur, hauteur, et l'écart
// des centres. Elle punissait donc une troisième fois ce que le recouvrement
// punissait déjà — un dessin juste mais tracé petit, ou posé de côté, y perdait
// encore. Vu sur la planche : la pomme juste et petite tombait à 35 %, c'est-à-dire
// zéro point, derrière un gribouillis.
//
// LA TAILLE ET LA PLACE SONT L'AFFAIRE DU RECOUVREMENT — « la position des
// traits ». Ce qui reste, et que l'énoncé cite à part, c'est la FORME DE
// L'ENVELOPPE : un bouleau est trois fois plus haut que large, une tranche de
// pastèque plus large que haute. Dessiner un bouleau dans un carré est une faute
// de proportion ; le dessiner petit n'en est pas une.
function accordDeProportions(bc, bj) {
  if (!bc || !bj || bc.h <= 0 || bj.h <= 0) return 0;
  const fc = bc.l / bc.h;
  const fj = bj.l / bj.h;
  if (fc <= 0 || fj <= 0) return 0;
  return Math.min(fc, fj) / Math.max(fc, fj);
}

// « LA DENSITÉ DU DESSIN » — L'ENCRE RAPPORTÉE À L'ÉTENDUE DE LA FIGURE.
//
// TROIS RÉDACTIONS, DEUX MESURÉES FAUSSES SUR LA PLANCHE. Elles valent d'être
// écrites, parce que l'erreur est la même à chaque fois : confondre « combien
// d'encre » avec « à quel point c'est dense ».
//
//  1. L'ENCRE BRUTE. Un dessin juste tracé à soixante pour cent de la taille n'en
//     porte plus que quarante-cinq : il était puni une seconde fois pour sa
//     taille, que le recouvrement punit déjà. La pomme juste et petite valait
//     ZÉRO point.
//  2. L'ENCRE DES DESSINS RAMENÉS À LA MÊME BOÎTE. La normalisation étire chaque
//     figure jusqu'aux bords de sa propre boîte : la copie fidèle n'y retrouvait
//     plus la densité de la cible (0,79), tandis qu'une main HÉSITANTE tombait par
//     hasard à 0,99 — et passait DEVANT la copie fidèle. Un artefact de mesure
//     pris pour une ressemblance.
//  3. Celle-ci. UN DESSIN EST FAIT DE LIGNES : son encre croît comme une LONGUEUR,
//     pas comme une surface. Rapportée à l'étendue de la figure — sa largeur plus
//     sa hauteur, qui croît de la même façon — elle ne dépend plus de la taille à
//     laquelle on a dessiné, et ne dit plus que ce que l'énoncé nomme : un dessin
//     CHARGÉ contre un dessin CLAIRSEMÉ.
//     La rapporter à la SURFACE aurait réintroduit la taille par l'autre bout :
//     l'aire croît comme le carré, l'encre comme le côté, et le même dessin tracé
//     petit serait ressorti une fois et demie plus dense que l'original.
//
// Un rapport, jamais une différence : deux fois trop d'encre et deux fois trop peu
// doivent être punis pareil.
function accordDeDensite(gc, gj) {
  const etendue = (b) => (b ? b.l + b.h : 0);
  const dc = etendue(boiteDe(gc)) > 0 ? encre(gc) / etendue(boiteDe(gc)) : 0;
  const dj = etendue(boiteDe(gj)) > 0 ? encre(gj) / etendue(boiteDe(gj)) : 0;
  if (dc <= 0 && dj <= 0) return 1;
  if (dc <= 0 || dj <= 0) return 0;
  return Math.min(dc, dj) / Math.max(dc, dj);
}

// ---------------------------------------------------------------------------
// LA COURBE DE PRÉSENTATION
// ---------------------------------------------------------------------------
//
// POURQUOI LE SCORE BRUT NE PEUT PAS ÊTRE MONTRÉ TEL QUEL. Il est TASSÉ : un
// gribouillis vaut déjà 0,40, un dessin honnête 0,65 à 0,99. Montré tel quel,
// tout le monde se retrouverait entre quarante et cent, et les vingt tranches de
// cinq pour cent du graphique seraient vides aux deux tiers. La courbe étire la
// plage utile sur zéro-cent. ELLE NE CHANGE PAS LE CLASSEMENT : strictement
// croissante, l'ordre des joueurs est exactement celui du score brut.
//
// ============================================================================
// HISTOIRE COURTE D'UN BARÈME, POUR NE PAS LA REFAIRE
// ============================================================================
//
// 21/09 : une droite. 23/09 : `1 − (1 − t)^k`, qui saturait — le dessin exact
// et le dessin tremblé à égalité. 24/09 : un logarithme posé sur un plancher de
// 0,54, ancré sur UN chiffre humain, les 62 % de l'auteur.
//
// 26/09, LE LOGARITHME A MONTRÉ SON VICE : UNE FALAISE. Sa pente au plancher est
// quasi verticale : 0,54 de brut affichait 0 %, 0,55 en affichait QUARANTE. Un
// centième de brut valait quarante points de pourcentage. Un sapin fidèlement
// contourné — capture de l'auteur à l'appui — tombait du mauvais côté et
// affichait « 0 % de ressemblance, raté ». Un barème qui dit zéro à un dessin
// juste n'est pas « dur », il est incohérent ; c'est le mot employé.
//
// (Ce même jour, la mesure elle-même a été reprise — trait médian de la cible,
// forme par les moments, traits longs plus coupés ; voir `squeletteDepuisBits`
// et `momentsDe`. Les nombres ci-dessous sont ceux de la NOUVELLE mesure.)
//
// ============================================================================
// DES PALIERS RELIÉS PAR DES DROITES
// ============================================================================
//
// Plus de formule : une TABLE, lue telle quelle. Chaque ligne se lit « tel
// brut s'affiche tel pourcentage », et entre deux lignes on trace une droite.
// La pente est bornée partout — nulle part un centième de brut ne vaut plus de
// cinq points de pourcentage —, donc plus de falaise, et un réglage se fait en
// changeant UN nombre dont on voit l'effet.
//
// LES ANCRES, MESURÉES LE 26/09 SUR LES CINQUANTE DESSINS (brut) :
//
//                        p05     médiane   p95
//   gribouillis         0,237     0,400    0,562   (max 0,683)
//   main lourde         0,696     0,749    0,795
//   juste, de travers   0,757     0,819    0,846
//   main humaine        0,816     0,851    0,874
//   copie fidèle        0,989     0,992    0,996
//   LE SAPIN DE L'AUTEUR          0,651             ← le point humain
//
// ET CE QU'ELLES DONNENT : le gribouillis médian à 0 %, le sapin de l'auteur à
// 78 %, la main lourde médiane à 91 %, la copie fidèle à 100 %. Le seuil des
// points (40 %) tombe à 0,565 de brut : juste AU-DESSUS du p95 des
// gribouillages (0,562) — posé à 0,55, huit pour cent d'entre eux payaient.
export const PALIERS = [
  [0.40, 0],
  [0.48, 15],
  [0.565, 40],
  [0.61, 62],
  [0.65, 78],
  [0.75, 91],
  [0.85, 97],
  [1.00, 100],
];

export function presenter(brut) {
  if (!Number.isFinite(brut) || brut <= PALIERS[0][0]) return 0;
  for (let k = 1; k < PALIERS.length; k += 1) {
    const [b1, p1] = PALIERS[k];
    if (brut <= b1) {
      const [b0, p0] = PALIERS[k - 1];
      return Math.round(p0 + ((brut - b0) / (b1 - b0)) * (p1 - p0));
    }
  }
  return 100;
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
  const g = new Float32Array(COTE * COTE);
  for (const [x, y] of squeletteDepuisBits(b64)) poser(g, x, y, 1);
  return g;
}

// LA CIBLE RAMENÉE À SON TRAIT MÉDIAN — CE QU'UN JOUEUR DESSINE VRAIMENT.
//
// LE DÉFAUT QUE CE CALCUL SUPPRIME (26/09), ET IL FAUSSAIT TOUT LE BARÈME. Un
// sapin fidèlement contourné, trait pour trait, affichait 0 %. La cible est une
// image : son contour noir, une fois réduit à 64 × 64, fait une BANDE de trois
// cases de large — puis l'épaississement ci-dessus l'élargissait encore. Le
// joueur, lui, trace UNE ligne. Même parfaitement posée, sa ligne ne couvrait
// qu'une fraction de la bande : sur ce sapin, un accord de densité de 0,59 et un
// recouvrement de 0,62, pour un dessin juste.
//
// C'EST AUSSI POURQUOI MES CONTRÔLES NE LE VOYAIENT PAS : le copiste qui les
// alimente retrace chaque case d'encre de la cible, donc REMPLIT la bande. Il
// dessinait mieux qu'un humain parce qu'il coloriait là où l'humain trace.
//
// On compare donc au TRAIT MÉDIAN de la cible — son squelette, amincissement de
// Zhang et Suen : on retire couche après couche les cases de bord qui ne
// coupent rien, jusqu'à ce qu'il ne reste qu'une ligne d'une case. C'est la
// ligne que la main suit quand elle recopie un contour. Elle est ensuite
// épaissie EXACTEMENT comme le trait du joueur : les deux figures sont enfin
// mesurées dans la même unité.
//
// DÉRIVÉ, ET NON STOCKÉ, pour la même raison que la forme ci-dessous : une
// donnée figée ne suit pas le code qui la lit.
export function squeletteDepuisBits(b64) {
  const octets = Buffer.from(b64, 'base64');
  const c = new Uint8Array(COTE * COTE);
  for (let i = 0; i < COTE * COTE; i += 1) if (octets[i >> 3] & (1 << (i & 7))) c[i] = 1;
  const v = (x, y) => (x < 0 || y < 0 || x >= COTE || y >= COTE ? 0 : c[y * COTE + x]);
  let change = true;
  while (change) {
    change = false;
    for (let passe = 0; passe < 2; passe += 1) {
      const retirer = [];
      for (let y = 0; y < COTE; y += 1) {
        for (let x = 0; x < COTE; x += 1) {
          if (!c[y * COTE + x]) continue;
          // Les huit voisins, dans l'ordre de Zhang et Suen : N, NE, E, SE, S, SO, O, NO.
          const p = [v(x, y - 1), v(x + 1, y - 1), v(x + 1, y), v(x + 1, y + 1),
            v(x, y + 1), v(x - 1, y + 1), v(x - 1, y), v(x - 1, y - 1)];
          const b = p.reduce((n, q) => n + q, 0);
          if (b < 2 || b > 6) continue;
          let a = 0;
          for (let k = 0; k < 8; k += 1) if (!p[k] && p[(k + 1) % 8]) a += 1;
          if (a !== 1) continue;
          if (passe === 0 ? (p[0] * p[2] * p[4] || p[2] * p[4] * p[6]) : (p[0] * p[2] * p[6] || p[0] * p[4] * p[6])) continue;
          retirer.push(y * COTE + x);
        }
      }
      for (const i of retirer) c[i] = 0;
      if (retirer.length) change = true;
    }
  }
  const points = [];
  for (let i = 0; i < COTE * COTE; i += 1) if (c[i]) points.push([i % COTE, Math.floor(i / COTE)]);
  return points;
}

// LA CIBLE RAMENÉE À SA PROPRE BOÎTE — DÉRIVÉE, ET NON STOCKÉE.
//
// LE DÉFAUT QUE CE CALCUL SUPPRIME, ET IL ÉTAIT DE LA PIRE ESPÈCE. Chaque dessin
// portait DEUX grilles engendrées à la conversion : celle de sa position, et celle
// de sa forme. La seconde était une photographie de ce que `normaliser` faisait CE
// JOUR-LÀ. Le jour où `normaliser` a changé — une marge ajoutée pour cesser de
// rogner les traits au bord —, le dessin du joueur est passé par la nouvelle règle
// et la cible est restée sur l'ancienne. Les deux figures n'étaient plus mesurées
// dans la même unité, toute la banque aurait noté de travers, et RIEN ne l'aurait
// signalé : les deux grilles sont des données, pas du code, et aucun contrôle ne
// compare une donnée à une fonction.
//
// C'est exactement le défaut que l'épaississement de la cible avait déjà corrigé
// une fois, revenu par la porte d'à côté. On ne stocke donc plus la forme : on la
// DÉRIVE de la position, ici, avec les mêmes formules que `normaliser` applique aux
// traits du joueur. Une seule définition de « ramené à sa boîte », et elle vit dans
// le code.
export function formeDepuisBits(b64) {
  // LE MÊME TRAIT MÉDIAN que la position — voir `squeletteDepuisBits` — et LA
  // MÊME RÈGLE que `normaliser` applique au joueur : le centre de gravité au
  // milieu, l'étalement ramené à `RAYON_FORME`.
  const points = squeletteDepuisBits(b64);
  const g = new Float32Array(COTE * COTE);
  if (!points.length) return g;
  const m = momentsDe(grilleDepuisBits(b64));
  const k = m && m.r > 0 ? RAYON_FORME / m.r : 1;
  const c = (COTE - 1) / 2;
  for (const [x, y] of points) poser(g, c + (x - m.cx) * k, c + (y - m.cy) * k, 1);
  return g;
}

// LA RESSEMBLANCE D'UN DESSIN AVEC UNE CIBLE DONNÉE PAR SA GRILLE.
//
// C'est le chemin qu'emprunte le jeu : la cible ne peut pas être fournie en traits,
// personne ne l'a dessinée à la main. `ressemblance` ci-dessous, qui compare deux
// jeux de traits, sert aux contrôles — où l'on veut décrire les deux figures.
export function ressemblanceContreGrilles(bitsPosition, joueur) {
  const dj = nettoyerDessin(joueur);
  if (!compterPoints(dj)) {
    return { pourcent: 0, brut: 0, detail: { recouvrement: 0, forme: 0, proportions: 0, densite: 0 } };
  }
  const gc = flouter(grilleDepuisBits(bitsPosition));
  const nc = flouter(formeDepuisBits(bitsPosition));
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
    proportions: accordDeProportions(boiteDe(gc), boiteDe(gj)),
    densite: accordDeDensite(gc, gj),
  };
  // CE QUI SE GAGNE : la ressemblance, et elle seule.
  const merite = detail.recouvrement * POIDS.recouvrement + detail.forme * POIDS.forme;
  // CE QUI SE RETIENT : l'enveloppe. Multiplicatif, jamais additif — voir la note
  // de POIDS. Un gribouillis n'a rien gagné, il n'a donc rien à retenir.
  const garde = tempere(detail.proportions, GARDE_MIN.proportions)
    * tempere(detail.densite, GARDE_MIN.densite);
  const brut = merite * garde;
  return { pourcent: presenter(brut), brut, detail, merite, garde };
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
