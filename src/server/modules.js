import { idsDuBassin, srcDeVisage } from './visages.js';
import { BASSIN_RETOUR, bassinDe, FAMILLES_RETOUR } from './symboles.js';
import { COULEURS, srcDObjet } from './objets.js';
import { banqueDeCueillette, famillesDe } from './dessins.js';
import { GRILLES_DESSINS } from './dessins-grilles.js';
import {
  ressemblanceContreGrilles, pointsDe as pointsDuDessin, nettoyerDessin,
  compterPoints, POINTS_MAXIMUM as POINTS_CUEILLETTE, SEUIL_POINTS as SEUIL_CUEILLETTE,
} from './cueillette.js';
import {
  CASES, DUREE_GRILLE_MS, DUREE_QUESTION_MS, QUESTIONS_PAR_PARTIE,
  tirerLaManche, memeNom, FORMES, NUMEROS, MODES, MODE_PAR_DEFAUT, modeDe,
} from './cache-cache.js';

// Les modules de lancement. Chaque module est INDÉPENDANT (modularité, USER-NEEDS M4/M5).
// Interface commune :
//   meta: { type, name, icon, color, scored, malus }
//     scored: le module alimente points/série (false = participation seule, ex. vote)
//     malus:  HÉRITÉ, PLUS UTILISÉ — plus aucune pénalité dans aucun jeu (T1).
//     vitesse: la rapidité est-elle récompensée sur ce module ?
//             VRAI pour le quiz et le vrai/faux, où répondre vite prouve qu'on
//             savait. FAUX pour l'estimation, dont la précision est le seul sujet
//             et où récompenser la vitesse rouvrirait le défaut corrigé en
//             action 13 ; FAUX pour le vote, où l'on ne devine pas plus vite ce
//             que pense la salle — et où la prime pousserait à cliquer avant
//             d'avoir lu.
//   buildRound(question) -> runtime
//   publicQuestion(runtime) -> payload envoyé aux joueurs / stream (jamais la bonne réponse)
//   validateAnswer(runtime, value) -> valeur normalisée ou null si invalide
//   score(runtime) -> { results: Map<playerId, { base, speed, correct }>, reveal: {...} }
//     base  : points de la bonne réponse, indépendants de la rapidité
//     speed : complément de vitesse, 0 si la réponse est fausse
//     reveal contient la bonne réponse ET stats (répartition des réponses, diffusée
//     à l'animateur + page stream à la fin du chrono).
// Le SERVEUR est autoritaire : il ne reçoit que des réponses, jamais des scores.

const BASE_POINTS = 1000;

// GRAMMAIRE DE SCORE, commune aux quatre modules (PLAN-CHANTIER T2) :
//   points = BASE + COMPLÉMENT DE VITESSE
// Rien d'autre. Aucune pénalité nulle part (T1), et la série ne rapporte plus
// rien : elle est suivie et affichée, mais comme une information (T3).
//
// Les totaux du quiz et du vrai/faux sont EXACTEMENT ceux d'avant : la formule
// valait déjà 700 + 300 × rapidité, mais présentait le tout comme une seule
// « base », si bien que l'écran du joueur annonçait un « bonus vitesse » alors
// que la vitesse agissait déjà, invisible, dans la ligne du dessus. On ne change
// pas le calcul, on cesse de le cacher.
// ============================================================
// LA RAPIDITÉ — UNE SEULE COURBE, TROIS RÉGLAGES
// ============================================================
//
// CE QUI A ÉTÉ DEMANDÉ (séance du 10/09) : « un bonus de rapidité allant de 0
// point à 200 points, le chrono partant de 15sec jusqu'à 0sec, de 15sec à 13sec
// = 200pts, et de 2sec à 0 = 0pt, je te laisse ajuster l'entre deux ».
//
// LA COURBE A DONC TROIS MORCEAUX, et non un seul comme la précédente :
//   - un PLATEAU HAUT : répondre dans les deux premières secondes vaut le maximum.
//     Sans lui, deux joueurs qui buzzent au dixième de seconde près se séparent
//     de plusieurs points pour un réflexe que rien ne distingue ;
//   - une PENTE, linéaire, entre les deux seuils ;
//   - un PLANCHER : les dernières secondes ne rapportent rien. C'est ce qui
//     distingue « répondre » de « répondre à temps ».
//
// ELLE EST ÉCRITE UNE FOIS ET PARAMÉTRÉE, parce que trois jeux l'emploient avec
// trois réglages : le quiz et le vrai/faux (200 points, 13 s / 2 s sur une
// fenêtre de 15), et « Cache-cache » (100 points, 9 s / 2 s sur une fenêtre de
// 10). Trois copies auraient fini par diverger — et une courbe de score qui
// diverge ne casse rien, elle fausse.
//
// LES DEUX EXEMPLES DE L'ÉNONCÉ SONT DES CONTRÔLES : « une réponse à 7.5sec
// vaudra surement 100pts » sur le quiz, « une réponse à 5.5sec vaudra surement
// 50pts » sur Cache-cache. Les deux tombent juste, à l'unité.
export function bonusRapidite(resteMs, { plateau, plancher, max }) {
  const reste = Math.max(0, Number(resteMs) || 0) / 1000;
  if (reste >= plateau) return max;
  if (reste <= plancher) return 0;
  return Math.round(max * ((reste - plancher) / (plateau - plancher)));
}

// Ce qu'il restait au chrono quand la réponse est arrivée.
function resteAuBuzz(runtime, answeredAt) {
  const total = runtime.durationMs;
  const ecoule = Math.min(Math.max(answeredAt - runtime.startedAt, 0), total);
  return total - ecoule;
}

// LES DEUX JEUX À QUESTIONS COURTES — quiz et vrai/faux.
//
// LA FENÊTRE EST UNE RÈGLE, PAS UN RÉGLAGE : « fixer le temps pour répondre à 15
// secondes ». Elle ne se lit plus dans la banque, et le Studio le dit. Les deux
// vont ensemble : les seuils de la courbe (13 s et 2 s) sont des SECONDES, pas
// des proportions — sur une fenêtre de trente secondes, « plateau jusqu'à 13 s
// restantes » voudrait dire dix-sept secondes de réflexion au tarif maximum.
export const DUREE_QUESTION_COURTE = 15;
const RAPIDITE_QUESTION_COURTE = { plateau: 13, plancher: 2, max: 200 };

// LES DEUX BASES, séparées : « une bonne réponse donne 250 points » au quiz,
// 200 au vrai/faux. Le vrai/faux vaut moins parce qu'on y tombe juste une fois
// sur deux en tirant à pile ou face — ce que le quiz ne permet pas.
const BASE_QUIZ = 250;
const BASE_VRAI_FAUX = 200;

// LE VOTE N'EST PAS TOUCHÉ par cette séance : deviner ce que pense le cercle vaut
// toujours 700, sans rapidité — on n'y gagne rien à être prompt, la manche ne se
// juge qu'au second tour. La constante reste donc la sienne, et porte désormais
// son nom : partagée, elle laissait croire que changer le quiz changeait le vote.
const BASE_VOTE = 700;

// Le complément de vitesse d'une bonne réponse à une question courte.
function complementVitesse(runtime, answeredAt) {
  return bonusRapidite(resteAuBuzz(runtime, answeredAt), RAPIDITE_QUESTION_COURTE);
}

// PALIERS DE PRÉCISION DE L'ESTIMATION (action 13).
//
// L'ancienne échelle était linéaire et plate : sur une cible de 100, répondre
// exactement rapportait à peine 11 % de plus que répondre 90. Pire, la vitesse
// pesait plus lourd que la justesse — une réponse exacte mais tardive valait 850
// quand une réponse à 10 % près mais immédiate en valait 900. Le plus juste
// perdait contre le plus rapide, l'inverse de ce que le module prétend mesurer.
// Et l'écart étant relatif à la cible, tout le monde se tassait au maximum sur
// les grands nombres : c'est la « base bloquée » constatée en test.
//
// Désormais : des valeurs FIXES par palier, et AUCUNE composante de rapidité.
// Se presser ne prouve rien sur une estimation ; seule la justesse décide.
// Les paliers étant discrets, aucune réponse d'un palier inférieur ne peut
// approcher un palier supérieur — propriété vérifiée par les tests.
const PALIERS_ESTIMATION = [
  { nom: 'mille',    ecartMax: 0.02, points: 1000 },
  { nom: 'proche',   ecartMax: 0.10, points: 750 },
  { nom: 'correct',  ecartMax: 0.20, points: 500 },
  { nom: 'loin',     ecartMax: 0.30, points: 250 },
];
// Tolérance ABSOLUE, en plus de la tolérance relative : sur une cible de 3, dix
// pour cent valent trois dixièmes, si bien que seul le nombre exact entrerait
// dans le premier palier et que répondre 4 tomberait déjà à 33 % d'écart. Être à
// une unité près compte donc comme le meilleur palier, sans rien changer aux
// grands nombres.
const TOLERANCE_ABSOLUE = 1;

// PALIERS DU JUSTE TEMPS.
//
// Écarts ABSOLUS, en secondes — comme les années, et pour la même raison : un
// pourcentage n'a aucun sens ici. Deux pour cent d'une cible à 1,20 s valent
// vingt-quatre millièmes ; deux pour cent d'une cible à 14 s en valent deux cent
// quatre-vingts. La même adresse serait payée dix fois moins parce que
// l'animateur a choisi un petit nombre. Le joueur, lui, joue sur un chrono qui
// défile à la même vitesse dans les deux cas.
//
// Les quatre valeurs viennent de l'énoncé du jeu, telles quelles.
const PALIERS_TEMPS = [
  { nom: 'mille',    ecartMax: 0.1, points: 1000 },
  { nom: 'proche',   ecartMax: 0.3, points: 750 },
  { nom: 'correct',  ecartMax: 0.5, points: 500 },
  { nom: 'loin',     ecartMax: 1.0, points: 250 },
];

// LE CENTIÈME EST L'UNITÉ DU JEU, et l'arithmétique flottante ne le sait pas.
// `Math.abs(5.02 - 4.72)` vaut 0.30000000000000027 : comparé à la borne de 0,3,
// ce joueur tomberait au palier du dessous pour une erreur de 2,7 × 10⁻¹⁶ seconde.
// Tout ce qui touche aux temps passe donc par ici avant d'être comparé.
export function auCentieme(x) {
  return Math.round(x * 100) / 100;
}

// PALIERS DE « COUPE TA BÛCHE ».
//
// Écarts ABSOLUS, en POINTS DE POURCENTAGE — et non en pourcentage du
// pourcentage. « À 3 % de la cible » veut dire trois points d'écart, que la cible
// soit 8 % ou 80 % : c'est la seule lecture qui garde le même geste à l'écran, où
// un point de proportion vaut toujours la même longueur de bûche.
//
// Les cinq valeurs viennent de l'énoncé, telles quelles.
const PALIERS_PROPORTION = [
  { nom: 'mille',    ecartMax: 1,  points: 1000 },
  { nom: 'proche',   ecartMax: 3,  points: 750 },
  { nom: 'correct',  ecartMax: 5,  points: 500 },
  { nom: 'loin',     ecartMax: 10, points: 250 },
];

// PALIERS DES ANNÉES (chantier v4, décision 5.8).
//
// POURQUOI UN SECOND JEU. Un pourcentage n'a aucun sens sur une année : 2 % de
// 1789 valent TRENTE-SIX ANS. Répondre 1753 tombait donc « dans le mille » et
// rapportait 1000 points — le premier palier était trois fois plus large que le
// siècle. La tolérance absolue d'une unité ne change rien à cette échelle.
// Ici les écarts sont ABSOLUS, en années, comme on les compte réellement.
//
// RÉVISÉS LE 15/09 : « Exact : 1000 pts doit devenir ± 1 an : 1000 pts ; ± 2 ans :
// 750 doit devenir ± 3 ans : 750 ; ± 5 ans : 500 doit devenir ± 6 ans : 500 ;
// ± 10 ans : 250 doit rester ± 10 ans : 250. »
//
// LE PREMIER PALIER N'EST PLUS LA RÉPONSE EXACTE. C'est le vrai changement, et il
// se voit ailleurs que dans cette table : l'étiquette « exact » disparaît des deux
// histogrammes, remplacée par « ± 1 an ». Deviner une année au millésime près est
// une chance ; la deviner à un an près est une connaissance.
const PALIERS_ANNEE = [
  { nom: 'mille',    ecartMax: 1,  points: 1000 },
  { nom: 'proche',   ecartMax: 3,  points: 750 },
  { nom: 'correct',  ecartMax: 6,  points: 500 },
  { nom: 'loin',     ecartMax: 10, points: 250 },
];

// DÉCISION 5.3, RESSERRÉE PAR A4 — le plus proche marque QUAND PERSONNE n'est
// dans une plage. Sans ce filet, une manche où tout le monde vise trop large ne
// rapporte rien à personne et le module devient muet ; distribué en toute
// circonstance, il devenait un supplément sans objet pour qui touchait déjà un
// palier. Il ne joue donc que dans le cas pour lequel il a été inventé.
const BONUS_PLUS_PROCHE = 400;
// DÉCISION 5.5 — l'exactitude, que les paliers ne distinguent pas : sur une cible
// de 1000, répondre 1000 ou 1015 rapporte le même palier.
const BONUS_EXACTITUDE = 200;

const HORS = { nom: 'hors', ecartMax: Infinity, points: 0 };

// LES DEUX MEILLEURS PALIERS — le seuil de la « réussite », qui nourrit la série
// et le verdict de l'écran.
//
// Il s'écrivait `palier.ecartMax <= 0.10` en relatif et `<= 2` en absolu : deux
// nombres qui ne disaient pas ce qu'ils voulaient dire, et qu'un troisième barème
// aurait obligé à recopier une troisième fois. Ce sont les deux premières lignes
// du barème, quel que soit le barème — la table est écrite du plus exigeant au
// plus large. Vérifié équivalent sur les trois : mille/proche des estimations
// (0,02 et 0,10), des années (0 et 2) et des temps (0,1 et 0,3).
const MEILLEURS_PALIERS = new Set(['mille', 'proche']);
export function estUneReussite(nomDePalier) {
  return MEILLEURS_PALIERS.has(nomDePalier);
}

// Le barème d'une nature de réponse. Trois natures, une seule table par nature,
// et rien qui ressemble à un palier ailleurs dans le projet.
function paliersDe(nature) {
  if (nature === 'annee') return PALIERS_ANNEE;
  if (nature === 'temps') return PALIERS_TEMPS;
  if (nature === 'proportion') return PALIERS_PROPORTION;
  return PALIERS_ESTIMATION;
}

// DÉCISION 5.9 — la nature est DÉCLARÉE à la création de la question, jamais
// devinée de la valeur : 1789 peut être un nombre d'habitants.
// DÉCISION 5.10 — sans nature déclarée, on reste en plages relatives : c'est le
// comportement d'aujourd'hui, donc aucune migration des questions existantes.
// LE PALIER QU'UNE RÉPONSE TOUCHE — EXPORTÉ, et c'est le point de la correction.
//
// Ce calcul était privé, et l'histogramme rangeait les réponses par ses propres
// moyens : deux façons de dire la même chose, donc deux façons de se tromper. Il
// est désormais la seule autorité, et les contrôles comparent le graphique à LUI
// plutôt qu'à des bornes recopiées à la main.
export function palierDe(valeur, cible, nature) {
  return palierEstimation(valeur, cible, nature);
}

function palierEstimation(valeur, cible, nature) {
  const ecartAbsolu = Math.abs(valeur - cible);
  if (nature === 'annee') {
    return PALIERS_ANNEE.find((p) => ecartAbsolu <= p.ecartMax) || HORS;
  }
  // LE JUSTE TEMPS : écarts absolus en secondes, arrondis au centième AVANT
  // comparaison — voir `auCentieme`.
  if (nature === 'temps') {
    const ecart = auCentieme(ecartAbsolu);
    return PALIERS_TEMPS.find((p) => ecart <= p.ecartMax) || HORS;
  }
  // COUPE TA BÛCHE : écarts absolus en points de pourcentage, entiers.
  if (nature === 'proportion') {
    return PALIERS_PROPORTION.find((p) => Math.round(ecartAbsolu) <= p.ecartMax) || HORS;
  }
  if (ecartAbsolu <= TOLERANCE_ABSOLUE) return PALIERS_ESTIMATION[0];
  const ecart = ecartAbsolu / Math.max(Math.abs(cible), 1);
  return PALIERS_ESTIMATION.find((p) => ecart <= p.ecartMax) || HORS;
}

// Histogramme de répartition numérique, en 8 tranches (maquette A5).
//
// Les bornes écartent les valeurs extrêmes dès que l'effectif le permet : sans
// ça, un joueur qui tape un nombre absurde étire l'échelle et écrase tout le
// monde dans une seule barre. Les aberrantes ne disparaissent pas pour autant —
// elles sont RAMENÉES dans la barre d'extrémité, donc toujours comptées.
// La cible est incluse dans les bornes, pour qu'on voie toujours où tombe la
// vérité par rapport au groupe.
const TRANCHES = 8;

// `marge` : demi-largeur MINIMALE que l'échelle doit contenir de part et d'autre
// de la cible. C'est par elle que les plages du barème entrent toujours dans le
// cadre — voir l'appel dans `estimation.score`.
// L'ÉTENDUE UTILE, aberrantes écartées.
//
// Bornes par ÉCART INTERQUARTILE plutôt que par centiles : avec six réponses,
// écarter « les 10 % du haut » n'écarte personne, et l'aberrante reste dans
// l'échelle. La règle des quartiles, elle, tient sur un petit effectif — ce qui
// est le cas courant d'une soirée autour du feu.
//
// Les aberrantes ne DISPARAISSENT pas pour autant : elles sont ramenées dans la
// tranche d'extrémité, donc toujours comptées. Sans cette règle, un plaisantin
// qui tape un milliard étire l'échelle jusqu'au milliard et écrase tout le monde
// dans un seul pixel.
function etendueUtile(values) {
  const tries = [...values].sort((a, b) => a - b);
  let bas = tries[0];
  let haut = tries[tries.length - 1];
  if (tries.length >= 4) {
    const quartile = (p) => tries[Math.min(tries.length - 1, Math.floor(p * (tries.length - 1)))];
    const q1 = quartile(0.25);
    const q3 = quartile(0.75);
    const interquartile = q3 - q1;
    const dedans = tries.filter((v) => v >= q1 - 1.5 * interquartile && v <= q3 + 1.5 * interquartile);
    if (dedans.length) { bas = dedans[0]; haut = dedans[dedans.length - 1]; }
  }
  return { bas, haut };
}

export function histogrammeNumerique(values, cible, tranches = TRANCHES, marge = 0) {
  if (!values.length) return null;
  const { bas, haut } = etendueUtile(values);

  // L'ÉCHELLE S'ENGAGE À CONTENIR LE BARÈME (arbitrage de l'auteur, 2026-08-21).
  //
  // CE QUI ÉTAIT FAUX. L'échelle était tirée des seules RÉPONSES, quand les plages
  // sont une propriété de la QUESTION : rien ne garantissait que les secondes
  // tiennent dans la première. Mesuré sur une cible de 1 235 : quand toutes les
  // réponses tombaient au-dessus, seules les bornes HAUTES entraient dans le
  // cadre — et l'écran écrivait « ± 10 % » à un endroit qui n'était que « +10 % ».
  // Le miroir se produisait quand tout le monde répondait en dessous. Et sur une
  // étendue serrée, la plage la plus large ne se dessinait PAS DU TOUT, tout en
  // restant annoncée dans la légende.
  //
  // Le barème est la grille de lecture, les réponses n'en sont que le contenu :
  // c'est donc à l'échelle de s'ouvrir. Le coût est assumé — un groupe très
  // resserré occupe moins de largeur qu'avant.
  let min = Math.min(bas, cible - marge);
  let max = Math.max(haut, cible + marge);
  if (min === max) { min -= 1; max += 1; } // tout le monde d'accord : une échelle quand même
  const pas = (max - min) / tranches;

  const indice = (v) => Math.min(tranches - 1, Math.max(0, Math.floor((v - min) / pas)));
  const counts = new Array(tranches).fill(0);
  for (const v of values) counts[indice(v)] += 1;

  return { min, max, pas, counts, cibleIndex: indice(cible) };
}

// L'HISTOGRAMME CALÉ SUR LE BARÈME.
//
// CE QUI N'ALLAIT PAS. Les huit tranches étaient des parts ÉGALES de l'étendue :
// leurs bornes ne tombaient nulle part en particulier. Une même barre pouvait
// donc réunir des joueurs qui avaient marqué 1 000 points et d'autres qui n'en
// avaient marqué que 750 — la forme montrait la dispersion, jamais le barème.
//
// LA RÈGLE, ARBITRÉE PAR L'AUTEUR : « la largeur de l'intervalle doit coïncider
// avec les ± 2 % ; idem pour les autres ». Les bornes de tranches SONT désormais
// celles des paliers. Chaque barre couvre donc exactement un demi-palier, et sa
// largeur à l'écran se lit comme la plage qu'elle représente.
//
// DIX ZONES : hors barème à gauche, −30, −20, −10, −2, puis le trait de la
// réponse exacte, puis +2, +10, +20, +30, hors barème à droite. Les tranches sont
// INÉGALES par construction — c'est le but.
//
// LA RÉPONSE EXACTE N'EST PAS UNE ZONE : elle est de largeur nulle. Elle est
// comptée à part et se dessine en TRAIT, vert dès que quelqu'un l'a trouvée.
export function histogrammeBareme(values, cible, plages, marge) {
  if (!values.length) return null;

  // L'échelle : l'étendue UTILE des réponses — aberrantes écartées, voir
  // `etendueUtile` — ouverte au moins jusqu'au dernier palier (arbitrage
  // « étendre »). Les zones hors barème occupent ce qui dépasse.
  const utile = etendueUtile(values);
  const min = Math.min(utile.bas, cible - marge);
  const max = Math.max(utile.haut, cible + marge);

  // Les bornes, du plus large au plus étroit, de part et d'autre de la cible.
  const demi = plages.map((p) => p.haut - cible).sort((a, b) => b - a);
  const zones = [];
  const pousser = (bas, haut, palier, cote) => {
    if (haut - bas > 0) zones.push({ bas, haut, palier, cote, count: 0 });
  };
  // Côté gauche, du bord vers la cible.
  pousser(min, cible - demi[0], 'hors', 'g');
  for (let i = 0; i < demi.length; i += 1) {
    const bas = cible - demi[i];
    const haut = i + 1 < demi.length ? cible - demi[i + 1] : cible;
    pousser(bas, haut, plages[plages.length - 1 - i].nom, 'g');
  }
  // Côté droit, de la cible vers le bord.
  for (let i = demi.length - 1; i >= 0; i -= 1) {
    const bas = i + 1 < demi.length ? cible + demi[i + 1] : cible;
    pousser(bas, cible + demi[i], plages[plages.length - 1 - i].nom, 'd');
  }
  pousser(cible + demi[0], max, 'hors', 'd');

  // Le comptage. La réponse EXACTE ne tombe dans aucune zone : elle est le trait.
  let exact = 0;
  for (const v of values) {
    if (v === cible) { exact += 1; continue; }
    // LES BANDES SE TOUCHENT : une valeur posée exactement sur une borne peut aller
    // dans deux d'entre elles. Elle va dans CELLE QUI EST DU CÔTÉ DE LA CIBLE —
    // c'est le palier que le barème lui verse, et c'était déjà la règle écrite ici.
    //
    // ELLE N'ÉTAIT TENUE QU'À DROITE. Les bandes de droite sont rangées de la
    // cible vers le bord : la première trouvée est la plus généreuse, et le compte
    // tombait juste. Celles de gauche sont rangées du bord vers la cible, et la
    // première trouvée était la plus SÉVÈRE. Rapporté par l'auteur : neuf pour
    // cent pour une cible de dix, mille points versés, et la barre dessinée dans
    // la plage « sept à neuf » — celle qui n'en vaut que sept cent cinquante.
    //
    // On parcourt donc toujours DE LA CIBLE VERS LE BORD, des deux côtés.
    //
    // RAMENÉE DANS LE CADRE, jamais perdue : une aberrante écartée de l'échelle
    // reste une estimation, et elle est comptée dans la zone d'extrémité.
    const w = Math.min(max, Math.max(min, v));
    const cote = v < cible ? 'g' : 'd';
    const candidates = zones.filter((x) => x.cote === cote);
    const versLaCible = cote === 'g' ? [...candidates].reverse() : candidates;
    const z = versLaCible.find((x) => w >= x.bas && w <= x.haut)
      || (cote === 'g' ? candidates[0] : candidates[candidates.length - 1]);
    if (z) z.count += 1;
  }
  return { min, max, zones, exact };
}

// LES PLAGES DU BARÈME, EN VALEURS ABSOLUES, POUR LES DEUX HISTOGRAMMES.
//
// CE QUI MANQUAIT À L'ÉCRAN. Les barres se lisaient sans échelle : ni les valeurs
// que chaque tranche recouvre, ni où tombe la bonne réponse, ni jusqu'où il
// fallait viser pour marquer. Un graphique sans axe ne dit rien de ce qu'il
// montre — l'animateur commentait des rectangles.
//
// POURQUOI C'EST LE SERVEUR QUI LES CALCULE. Les bornes sont celles du BARÈME :
// `PALIERS_ESTIMATION` en relatif, `PALIERS_ANNEE` en absolu, et la tolérance
// d'une unité qui élargit le premier palier sur les petites cibles. Les recopier
// dans deux écrans, c'est garantir qu'ils finiront par annoncer une plage que le
// barème ne récompense plus — le même piège que la double définition du « plus
// proche » (décision 6.1). Un seul calcul, ici, à côté des constantes.
export function plagesEstimation(cible, nature) {
  const absolu = nature === 'annee' || nature === 'temps' || nature === 'proportion';
  return paliersDe(nature).map((p) => {
    // Même règle que `palierEstimation` : en relatif, la tolérance absolue d'une
    // unité l'emporte quand elle est plus large que le pourcentage.
    const demi = absolu
      ? p.ecartMax
      : Math.max(p.ecartMax * Math.abs(cible), TOLERANCE_ABSOLUE);
    return {
      nom: p.nom,
      points: p.points,
      // L'étiquette telle qu'elle doit s'écrire à l'antenne : « ± 10 % » n'a pas
      // de sens sur une année, « ± 2 ans » n'en a pas sur un nombre d'habitants,
      // et « ± 0,1 s » est la seule qui veuille dire quelque chose sur un chrono.
      libelle: nature === 'annee'
        // LE SINGULIER. « ± 1 ans » se lit comme une faute de frappe à l'antenne,
        // et le premier palier vaut désormais UN an — ce cas n'existait pas tant
        // que le premier palier était la réponse exacte.
        ? (p.ecartMax === 0 ? 'exact' : `± ${p.ecartMax} an${p.ecartMax > 1 ? 's' : ''}`)
        : nature === 'temps'
          ? `± ${String(p.ecartMax).replace('.', ',')} s`
          // Un POINT de pourcentage, pas un pourcentage du pourcentage : sur une
          // bûche, un point vaut toujours la même longueur.
          : nature === 'proportion'
            ? `± ${p.ecartMax} pt`
            : `± ${Math.round(p.ecartMax * 100)} %`,
      // Bornes arrondies au centième POUR LES SEULS TEMPS : c'est là que le
      // flottant se voit — « 4,42 » écrit « 4,4200000000000004 » sur l'axe du
      // graphique, à l'antenne. Les deux autres natures gardent leurs bornes
      // telles quelles : elles sont mesurées par les contrôles existants, et un
      // arrondi silencieux n'y corrigerait rien qui se voie.
      bas: nature === 'temps' ? auCentieme(cible - demi) : cible - demi,
      haut: nature === 'temps' ? auCentieme(cible + demi) : cible + demi,
    };
  });
}

// ============================================================
// LE JUSTE TEMPS — LE CHRONO, ET QUI DÉCIDE DE L'HEURE
// ============================================================

// Le compte à rebours part de quinze secondes. C'est la seule durée du jeu : les
// deux temps que saisit l'animateur s'y logent, et l'écran de saisie borne ses
// champs sur cette valeur.
export const DUREE_JUSTE_TEMPS = 15;

// LE CLASSEMENT DE MANCHE, POUR L'ANIMATEUR SEUL — trente lignes.
//
// Trente parce que c'est ce qui a été demandé, et parce que c'est ce qu'un écran
// de console peut montrer sans devenir une liste qu'on fait défiler en direct.
// Au-delà, l'animateur ne lit plus : il cherche.
export const CLASSEMENT_MANCHE = 30;

// La fenêtre de réponse dépasse le compte à rebours — voir `buildRound`.
const MARGE_JUSTE_TEMPS = 1200;

// « Le client n'a rien annoncé de lisible » : l'horloge de l'arbitre tranchera
// seule. Ce n'est pas dans l'intervalle des temps possibles (0 à 15), donc rien
// ne peut le confondre avec un buzz.
export const SANS_ANNONCE = -1;

// CE QUE LE RÉSEAU A LE DROIT DE COÛTER, en secondes.
export const TOLERANCE_RESEAU = 0.75;

// Le temps saisi par l'animateur, ramené dans le cadran et au centième.
export function borneDeChrono(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return auCentieme(Math.min(DUREE_JUSTE_TEMPS, Math.max(0, n)));
}

// LE TEMPS QU'UN BUZZ A ARRÊTÉ.
//
// ---------------------------------------------------------------------------
// POURQUOI CE JEU S'ÉCARTE DE LA DOCTRINE DE « LES VISAGES »
// ---------------------------------------------------------------------------
// `creneauDe` la pose sans détour : « un jeu de buzz se joue sur l'horloge de
// l'arbitre », parce qu'un client pourrait annoncer le numéro précédent une fois
// la réponse comprise. Cette crainte est fondée LÀ-BAS : le client des visages
// reçoit tous les portraits, il peut donc calculer la réponse tout seul et
// mentir dans la bonne direction.
//
// CE RAISONNEMENT ÉTAIT VRAI, ET IL NE L'EST PLUS. Il disait : la cible ne quitte
// jamais le serveur, donc un tricheur qui décalerait son annonce ne sait pas de
// quel côté aller — il joue à pile ou face contre lui-même, et le mensonge ne
// rapporte rien.
//
// LA CIBLE EST DÉSORMAIS AFFICHÉE. Le document de la séance le demande
// explicitement : « il faut afficher le Temps cible sur l'écran du joueur et du
// stream lorsque le compte à rebours descend ». Sans elle le jeu était injouable —
// on demandait d'arrêter un chrono à un instant que personne n'avait dit — mais
// la conséquence est nette : UN CLIENT MODIFIÉ PEUT MENTIR UTILEMENT. Il lui
// suffit de buzzer un peu après la cible et d'annoncer la cible elle-même ; tant
// qu'elle tombe dans la fenêtre de tolérance, l'arbitre l'accepte, et le joueur
// touche le palier maximum à tous les coups.
//
// CE QUI EST ASSUMÉ, ET POURQUOI. Réduire la fenêtre ne supprime pas la triche,
// elle la déplace : ce qu'on retire au menteur, on le retire aussi au joueur en
// 4G, et celui-là est réel. La fenêtre reste donc calée sur le réseau, pas sur la
// fraude. Ce qui la contient : il faut un client modifié — pas un réglage, du
// code — et l'animateur voit le classement de manche, où un joueur à l'écart nul
// à chaque manche ne passe pas inaperçu. « Coupe ta bûche » est dans le même cas,
// et sa proportion cible a toujours été publique.
//
// EN REVANCHE, L'HORLOGE SEULE COÛTE CHER. Le compte à rebours part sur le
// téléphone à la RÉCEPTION du départ, et le buzz revient au serveur après un
// second trajet : l'arbitre lit donc toujours un temps INFÉRIEUR d'un aller-retour
// à ce que le joueur a vu. Sur un palier haut large de 0,10 s, un aller-retour de
// 150 ms en mange la moitié — et il ne les mange qu'aux joueurs en 4G. Ce n'est
// pas du bruit, c'est un biais, et il frappe toujours les mêmes.
//
// LA RÈGLE RETENUE : le client annonce ce qu'il a vu, l'arbitre le BORNE.
//   - jamais moins que sa propre horloge — annoncer un temps plus grand que
//     l'écoulé réel reviendrait à prétendre avoir buzzé avant d'avoir buzzé ;
//   - jamais plus que son horloge augmentée de la tolérance réseau.
// Un honnête joueur tombe toujours dans cette fenêtre, dont la largeur EST son
// aller-retour. Un menteur n'en sort pas — mais depuis que la cible est affichée,
// il n'a plus besoin d'en sortir : voir plus haut.
export function valeurDuBuzz(rt, reponse) {
  const ecoule = Math.max(0, reponse.at - rt.startedAt) / 1000;
  // Ce que l'arbitre a vu : le plancher de la fenêtre.
  const arbitre = DUREE_JUSTE_TEMPS - ecoule;
  const annonce = typeof reponse.value === 'number' && reponse.value !== SANS_ANNONCE
    ? reponse.value
    : arbitre;
  const borne = Math.min(Math.max(annonce, arbitre), arbitre + TOLERANCE_RESEAU);
  return auCentieme(Math.min(DUREE_JUSTE_TEMPS, Math.max(0, borne)));
}

// ============================================================
// « COUPE TA BÛCHE » — LE CURSEUR QUI VA ET VIENT
// ============================================================
//
// LA RÈGLE. Une bûche est posée à l'écran ; un curseur la balaie d'un bout à
// l'autre, une seconde par trajet. Les joueurs frappent quand ils croient le
// curseur sur la proportion demandée. Dix secondes, donc cinq allers-retours.
export const DUREE_COUPE = 10;          // secondes de jeu
export const PERIODE_COUPE = 2000;      // un aller-retour complet, allure normale

// LES DEUX ALLURES DU CURSEUR (séance du 10/09).
//
// « Pour le moment le jeu se lance avec le curseur qui parcourt la longueur de la
// bûche en 1 seconde [...] Il faudrait que ce soit le mode "Normal". On ajouterait
// donc un 2e mode "Rapide" où le curseur parcourrait la longueur de la bûche en
// 0.5 seconde [...] (la manche durerait toujours 10 secondes). »
//
// L'ALLURE EST UNE PROPRIÉTÉ DE LA MANCHE, pas du module : elle voyage avec la
// question publique, comme la cible. Les deux écrans dessinent le balayage à
// partir de ce nombre-là — s'il vivait en dur quelque part, le mode rapide
// n'aurait changé que ce que le serveur compte, et le cercle aurait vu l'ancien.
export const ALLURES_COUPE = {
  normal: { periodeMs: 2000, label: 'Normal' },
  rapide: { periodeMs: 1000, label: 'Rapide' },
};
export function periodeDeLAllure(allure) {
  return ALLURES_COUPE[allure]?.periodeMs || PERIODE_COUPE;
}
const MARGE_COUPE = 1200;               // voir `buildRound` du juste temps
export const TOLERANCE_COUPE_MS = 750;  // ce que le réseau a le droit de coûter

// LA POSITION DU CURSEUR À UN INSTANT DONNÉ — une onde triangulaire.
//
// Il part à gauche, atteint la droite en une seconde, revient en une seconde. La
// proportion lue est la part de bûche À GAUCHE du curseur, en pourcentage.
//
// CE CALCUL EXISTE DEUX FOIS : ici, qui arbitre, et dans
// `src/client/shared/proportion.js`, qui dessine. Les deux ne peuvent pas
// s'importer sans faire entrer du code serveur dans le paquet du navigateur —
// même situation que l'icône d'onglet et la marque, ou que les signes de
// « Retour de flamme ». Un contrôle automatique les confronte sur deux mille
// instants : s'ils divergeaient, le joueur couperait à un endroit et le serveur
// en compterait un autre, sans que rien ne le signale.
export function positionDuCurseur(ecouleMs, periodeMs = PERIODE_COUPE) {
  const demi = periodeMs / 2;
  const t = ((ecouleMs % periodeMs) + periodeMs) % periodeMs;
  return t <= demi ? (t / demi) * 100 : (2 - t / demi) * 100;
}

// La proportion saisie par l'animateur, ramenée dans la bûche et à l'entier.
export function borneDeProportion(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.min(100, Math.max(0, n)));
}

// LÀ OÙ LE JOUEUR A COUPÉ.
//
// MÊME DOCTRINE QUE « LE JUSTE TEMPS », et elle est ici encore plus nécessaire :
// le curseur parcourt CENT POINTS PAR SECONDE. Cent millisecondes de réseau, ce
// sont dix points de bûche — dix fois le palier le plus haut. Arbitrer sur la
// seule heure d'arrivée ne mesurerait plus l'adresse du joueur mais la latence de
// sa liaison.
//
// Le client annonce donc l'INSTANT auquel il a frappé, compté depuis sa propre
// réception du départ ; l'arbitre le borne entre sa propre horloge et cette
// horloge diminuée de la tolérance réseau. Un joueur honnête tombe toujours dans
// cette fenêtre, dont la largeur EST son aller-retour ; un menteur n'en sort pas.
//
// ON BORNE LE TEMPS, PAS LA POSITION — et c'est le point délicat. Le curseur
// oscille : deux instants éloignés peuvent donner la même position, et deux
// instants voisins des positions opposées. Une tolérance exprimée en points de
// bûche n'aurait aucun sens ; en millisecondes, elle en a un.
export function coupeDuJoueur(rt, reponse) {
  const plafond = DUREE_COUPE * 1000;
  const arrivee = Math.min(plafond, Math.max(0, reponse.at - rt.startedAt));
  const annonce = typeof reponse.value === 'number' && reponse.value !== SANS_ANNONCE
    ? reponse.value
    : arrivee;
  const t = Math.min(Math.max(annonce, arrivee - TOLERANCE_COUPE_MS), arrivee);
  // LA PÉRIODE EST CELLE DE LA MANCHE, pas la période par défaut : en allure
  // rapide, arbitrer sur deux secondes d'aller-retour placerait la coupe à
  // l'autre bout de la bûche.
  return Math.round(positionDuCurseur(Math.min(plafond, Math.max(0, t)), rt.periodeMs || PERIODE_COUPE));
}

// ============================================================
// LE BARÈME DU LIEN
// ============================================================
//
// Base de 250 dès qu'un autre joueur a donné le même mot, puis un bonus qui
// décroît de cent en cent selon le RANG DU GROUPE, jusqu'à un plancher de 50 :
// 750, 650, 550, 450, 350, 250, 150, 50, puis 50 pour tous les suivants.
// Le premier groupe atteint donc exactement 1 000 — le maximum du jeu.
const BASE_LIEN = 250;
const BONUS_LIEN_PREMIER = 750;
const BONUS_LIEN_PAS = 100;
const BONUS_LIEN_PLANCHER = 50;

export function bonusDeRang(rang) {
  if (!(rang >= 1)) return 0;
  return Math.max(BONUS_LIEN_PLANCHER, BONUS_LIEN_PREMIER - BONUS_LIEN_PAS * (rang - 1));
}

// ============================================================
// « LES VISAGES » — retrouver celui qui est passé deux fois
// ============================================================
//
// LA RÈGLE. Vingt visages défilent, un toutes les deux secondes : dix-huit
// inconnus et UN SEUL qui revient. Les joueurs ont un buzz, un seul, et ne
// gagnent que s'ils l'emploient PENDANT LA SECONDE APPARITION. Buzzer sur la
// première, c'est avoir vu juste trop tôt — et c'est perdu : on ne peut pas
// savoir qu'un visage reviendra avant qu'il ne revienne.
const CADENCE_VISAGES = 2000;   // un visage toutes les 2 s
// VINGT PLACES, ET NON PLUS TRENTE. La manche passe donc de soixante à quarante
// secondes. Une minute d'attention soutenue sur un défilé de visages était longue
// — pour les joueurs comme pour l'antenne, qui n'a rien à commenter pendant ce
// temps-là.
const TOTAL_VISAGES = 20;       // 18 uniques + 1 visage doublé, qui occupe 2 places
const BASE_VISAGES = 700;

// LES QUATRE CONTRAINTES DE PLACEMENT, telles qu'elles ont été spécifiées. Elles
// sont écrites ici en constantes plutôt qu'en chiffres au fil du code : c'est ce
// qui permet au contrôle de les éprouver sur mille tirages sans les recopier.
const VISAGES_PREMIERE_MIN = 1;    // la 1re apparition ne peut pas être avant le 1er
const VISAGES_PREMIERE_MAX = 12;   // ni après le 12e
const VISAGES_SECONDE_MIN = 9;     // la 2e ne peut pas être avant le 9e
const VISAGES_SECONDE_MAX = 20;    // ni après le 20e (dernier)
// « au moins 5 photos ENTRE les deux apparitions » : cinq visages doivent
// s'intercaler, donc les positions sont distantes d'au moins six. Lecture
// littérale de la consigne — et c'est la lecture stricte, celle qui laisse le
// plus de mémoire à effacer entre les deux passages.
const VISAGES_ECART_MIN = 6;

export const REGLES_VISAGES = {
  cadenceMs: CADENCE_VISAGES,
  total: TOTAL_VISAGES,
  premiere: [VISAGES_PREMIERE_MIN, VISAGES_PREMIERE_MAX],
  seconde: [VISAGES_SECONDE_MIN, VISAGES_SECONDE_MAX],
  ecartMin: VISAGES_ECART_MIN,
  points: BASE_VISAGES,
};

// LA SÉRIE — vingt places, un visage doublé, dix-huit figurants.
//
// `alea` est injectable : un tirage aléatoire qu'on ne peut pas fixer est un
// tirage qu'on ne peut pas éprouver. Le contrôle s'en sert pour forcer les cas
// limites ; la partie réelle emploie `Math.random`.
//
// Les positions sont rendues en 1..30 — celles que l'animateur lit sur son
// graphique et que le public compte à l'écran. Le tableau, lui, est indexé à
// partir de zéro comme tout tableau.
// Fisher-Yates sur une COPIE — on ne remue jamais la liste d'origine. Le tirage
// de la série et le mélange de la liste de préchargement s'en servent tous deux :
// deux mélanges écrits à part finiraient par diverger.
export function melanger(liste, alea = Math.random) {
  const out = [...liste];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(alea() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function construireSerie(bassin, alea = Math.random) {
  const uniques = [...new Set(bassin)];
  if (uniques.length < TOTAL_VISAGES - 1) {
    throw new Error(`bassin trop petit : ${uniques.length} visages pour ${TOTAL_VISAGES - 1} requis`);
  }
  const entier = (min, max) => min + Math.floor(alea() * (max - min + 1));

  // La 1re apparition d'abord, la 2e ensuite dans ce que la 1re laisse possible.
  // Aucune combinaison n'est impossible : le pire cas, 20, laisse encore 26..30.
  // LA 1re APPARITION NE PEUT PAS ÊTRE TIRÉE SEULE. Sur la grille d'origine —
  // 30 places, 1re jusqu'au 20e — n'importe quel tirage laissait de la place à la
  // seconde. Sur la nouvelle grille, 12 + 6 = 18 ≤ 20 : ça passe encore, mais la
  // marge est de deux places. On borne donc explicitement la 1re par ce que la 2e
  // exige, plutôt que de compter sur l'arithmétique — le jour où une borne bouge
  // d'une unité, le tirage refuserait de servir au lieu de produire une série
  // silencieusement fausse.
  const premiereMax = Math.min(VISAGES_PREMIERE_MAX, VISAGES_SECONDE_MAX - VISAGES_ECART_MIN);
  if (premiereMax < VISAGES_PREMIERE_MIN) {
    throw new Error('bornes incompatibles : la seconde apparition n\'a nulle part où tomber');
  }
  const pos1 = entier(VISAGES_PREMIERE_MIN, premiereMax);
  const pos2 = entier(Math.max(VISAGES_SECONDE_MIN, pos1 + VISAGES_ECART_MIN), VISAGES_SECONDE_MAX);

  const melange = melanger(uniques, alea);
  const doubleId = melange[0];
  const figurants = melange.slice(1, TOTAL_VISAGES - 1); // 28

  const ordre = new Array(TOTAL_VISAGES).fill(null);
  ordre[pos1 - 1] = doubleId;
  ordre[pos2 - 1] = doubleId;
  let k = 0;
  for (let i = 0; i < TOTAL_VISAGES; i += 1) if (ordre[i] === null) ordre[i] = figurants[k++];

  return { ordre, doubleId, pos1, pos2 };
}

// À QUELLE PLACE DE LA SÉRIE CE BUZZ CORRESPOND-IL ?
//
// LE SERVEUR SEUL EN DÉCIDE, et il le décide sur l'heure d'ARRIVÉE. Le client
// pourrait annoncer le numéro qu'il affichait — ce serait plus juste au
// millième — mais alors n'importe qui pourrait annoncer le numéro précédent une
// fois la réponse comprise, et gagner après coup. Un jeu de buzz se joue sur
// l'horloge de l'arbitre.
//
// LA GRÂCE. Un buzz met du temps à arriver : entre le doigt et le serveur, il y
// a un réseau. Sans rien, un joueur qui réagit à la fin d'un visage se verrait
// crédité du SUIVANT, et perdrait une manche qu'il a gagnée. On rend donc au
// visage précédent les buzz arrivés dans les premières fractions de seconde du
// suivant. Le risque symétrique — créditer au précédent quelqu'un qui visait
// vraiment le nouveau visage — existe, mais il faudrait avoir buzzé sur un
// visage ordinaire en moins de 350 ms : ce n'est pas un joueur qui gagne, c'est
// un joueur qui se trompait déjà.
const GRACE_VISAGES = 350;

// LA MÊME GRÂCE VAUT POUR LES DEUX JEUX DE DÉFILÉ. Elle était écrite pour « Les
// visages » ; « Retour de flamme » fait exactement la même chose — des images qui
// passent, un doigt qui désigne l'une d'elles — et n'a aucune raison de compter
// autrement. Les paramètres remplacent les constantes des visages, qui restent
// les valeurs par défaut : le comportement de ce jeu-là ne bouge pas d'un cran.
export function creneauDe(startedAt, at, cadenceMs = CADENCE_VISAGES, total = TOTAL_VISAGES, grace = GRACE_VISAGES) {
  const ecoule = at - startedAt - grace;
  if (ecoule < 0) return 1; // avant la fin de la grâce, on est encore sur le 1er
  const place = Math.floor(ecoule / cadenceMs) + 1;
  return Math.min(total, place);
}

// ============================================================
// « RETOUR DE FLAMME » — l'image déjà vue, deux (ou trois) images plus tôt
// ============================================================
//
// LA RÈGLE. Trente images défilent, une toutes les deux secondes. Il faut buzzer
// quand celle qu'on voit est la MÊME que celle d'il y a deux images — ou trois,
// selon le mode. Six de ces « retours » sont posés dans chaque série, pas un de
// plus, pas un de moins.
//
// CE QUE CE JEU A D'UNIQUE DANS LE PROJET : on y buzze PLUSIEURS FOIS. Tous les
// autres modules acceptent une réponse et une seule ; celui-ci en attend six, et
// punit les autres. C'est la seule chose qui a demandé au moteur autre chose que
// du branchement (voir `meta.multi` et `submitAnswer`).
export const CADENCE_RETOUR = 2000;
export const TOTAL_RETOUR = 30;
export const RETOURS_PAR_SERIE = 6;
// GAGNÉS SUR UN RETOUR, PERDUS SUR TOUT AUTRE BUZZ. Six retours trouvés sans une
// faute font 1 200 — le maximum annoncé.
export const POINTS_RETOUR = 200;
// Les deux modes. L'écart EST le mode : « Retour −2 » compare à l'avant-avant
// dernière image, « Retour −3 » à celle d'avant elle.
export const ECARTS_RETOUR = [2, 3];

// LA SÉRIE, ET SES SIX RETOURS EXACTEMENT.
//
// POURQUOI ON NE TIRE PAS AU HASARD EN COMPTANT ENSUITE. Trente images prises
// dans quinze signes produisent des retours par accident — environ deux par série
// en mode −2, jamais six. Tirer jusqu'à en obtenir six exactement demanderait des
// milliers d'essais et ne garantirait rien.
//
// ON POSE DONC LES SIX PLACES D'ABORD, puis on remplit : sur une place de retour,
// on RECOPIE l'image d'il y a `ecart` ; partout ailleurs, on tire n'importe quel
// signe SAUF celui-là. Le second point est celui qui compte — sans lui, un retour
// non voulu apparaîtrait par hasard et la série en compterait sept. Le nombre est
// donc exact par CONSTRUCTION, et non par vérification après coup.
//
// Les chaînes sont permises et voulues : deux retours consécutifs, ou espacés de
// `ecart`, se produisent — l'exemple de l'énoncé en contient (les places 26 et 28
// du mode −2). Rien ne les interdit, et les interdire appauvrirait le jeu.
export function construireSerieRetour(ecart, bassin, alea = Math.random) {
  if (!ECARTS_RETOUR.includes(ecart)) throw new Error(`écart inconnu : ${ecart}`);
  if (!Array.isArray(bassin) || bassin.length < 2) throw new Error('bassin trop pauvre');

  // Une place ne peut porter un retour que s'il existe une image `ecart` plus tôt.
  const possibles = [];
  for (let p = ecart + 1; p <= TOTAL_RETOUR; p += 1) possibles.push(p);
  if (possibles.length < RETOURS_PAR_SERIE) {
    throw new Error('série trop courte pour six retours : ' + possibles.length);
  }
  const retours = melanger(possibles, alea).slice(0, RETOURS_PAR_SERIE).sort((a, b) => a - b);
  const estRetour = new Set(retours);

  const ordre = [];
  for (let p = 1; p <= TOTAL_RETOUR; p += 1) {
    const precedent = p > ecart ? ordre[p - ecart - 1] : null;
    if (estRetour.has(p)) { ordre.push(precedent); continue; }
    const choix = precedent == null ? bassin : bassin.filter((s) => s !== precedent);
    ordre.push(choix[Math.floor(alea() * choix.length)]);
  }
  return { ordre, retours, ecart };
}

// Les places où l'image répète celle d'il y a `ecart` — RELUES sur la série, et
// non reprises de ce qu'on a posé. C'est ce que le contrôle emploie : une
// génération qui se contenterait de rendre sa propre liste ne prouverait rien.
export function retoursDeLaSerie(ordre, ecart) {
  const out = [];
  for (let i = ecart; i < ordre.length; i += 1) {
    if (ordre[i] === ordre[i - ecart]) out.push(i + 1);
  }
  return out;
}

// DEUX MOTS SONT LE MÊME MOT quand ils ne diffèrent que par la casse ou les
// accents : « étude », « Etude », « ETUDE » et « Étude » forment un seul groupe.
//
// CE QU'ON NE CORRIGE PAS, ET C'EST UNE DÉCISION. Les fautes de frappe et
// d'orthographe restent à la charge du joueur ; le pluriel est un CHOIX qui ouvre
// un autre groupe — probablement avec d'autres joueurs qui ont pensé pareil. Un
// rapprochement automatique déciderait à leur place de ce qui « compte pour le
// même mot », et ce jeu consiste précisément à parier sur ce que les autres vont
// écrire.
export function normaliserMot(mot) {
  return String(mot ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

// LES GROUPES, classés du plus fourni au moins fourni.
//
// LE RANG EST « À LA COMPÉTITION » : deux groupes de même taille partagent le
// même rang, et le suivant saute d'autant. Trois groupes de tailles 15, 8, 8, 6
// donnent les rangs 1, 3, 3, 5 — jamais 1, 3, 3, 4. C'est ce que l'auteur a
// spécifié, et ce qui rend l'égalité vraiment neutre : être ex æquo ne coûte rien
// à personne, mais n'avantage pas non plus ceux qui suivent.
export function grouperLesMots(answers) {
  const parCle = new Map();
  for (const [pid, a] of answers) {
    const mot = String(a.value ?? '').trim();
    if (!mot) continue;
    const cle = normaliserMot(mot);
    if (!cle) continue;
    if (!parCle.has(cle)) parCle.set(cle, { cle, mot, pids: [] });
    parCle.get(cle).pids.push(pid);
  }
  const groupes = [...parCle.values()]
    .map((g) => ({ ...g, count: g.pids.length }))
    // À effectif égal, l'ordre alphabétique : sans lui, deux groupes ex æquo
    // s'échangeraient de place d'un affichage à l'autre.
    .sort((a, b) => b.count - a.count || a.cle.localeCompare(b.cle, 'fr'));

  let rang = 0;
  let precedent = null;
  groupes.forEach((g, i) => {
    if (g.count !== precedent) { rang = i + 1; precedent = g.count; }
    g.rang = rang;
  });

  const parJoueur = new Map();
  for (const g of groupes) for (const pid of g.pids) parJoueur.set(pid, g);
  return { groupes, parJoueur };
}

// Répartition des réponses sur des options indexées (quiz, vote) ou binaires (vrai/faux).
function tallyOptions(runtime, size) {
  return compterOptions(runtime.answers, size);
}

// Le décompte d'un LOT de réponses, quel qu'il soit. « Vote » se joue en deux
// tours et doit compter les deux : le tour en cours vit dans `rt.answers`, le
// précédent a été mis de côté par le moteur.
function compterOptions(reponses, size) {
  const tally = new Array(size).fill(0);
  for (const [, a] of reponses) tally[Number(a.value)] += 1;
  return tally;
}

// Les options de tête d'un décompte. EN CAS D'ÉGALITÉ, ELLES GAGNENT TOUTES —
// sinon une égalité parfaite ne produirait aucune bonne réponse, et la manche ne
// rapporterait rien à personne quoi qu'on ait répondu. C'est la règle que ce
// module tenait déjà ; elle vaut désormais pour « la réponse que le cercle a
// donnée », et non plus pour « le camp gagnant ».
function optionsDeTete(tally) {
  const meilleur = Math.max(0, ...tally);
  return tally.map((n, i) => (n === meilleur && n > 0 ? i : -1)).filter((i) => i >= 0);
}


// ============================================================
// « CACHE-CACHE » — CE QUE LE BARÈME ET LES RÉPONSES DEMANDENT
// ============================================================

// « Si un joueur a la bonne réponse à une question, il gagne 200 points », plus
// « un bonus de rapidité allant de 0 point à 100 points, le chrono partant de
// 10sec jusqu'à 0, de 10sec à 9sec = 100pts, et de 2sec à 0 = 0pt ».
// Cinq questions : 5 × (200 + 100) = 1500, « Maximum 1500pts ». Le compte tombe.
// « CUEILLETTE » — dix secondes pour regarder, trente pour dessiner.
export const DUREE_CIBLE_MS = 10_000;
export const DUREE_DESSIN_MS = 30_000;

const POINTS_CACHE = 200;
// Le plateau suit la fenêtre : une seconde en tête comme avant (16 → 15), et le
// même plancher de deux secondes en queue. « De 10sec à 9sec = 100pts » devient
// « de 16 à 15 », et la pente s'étire sur les treize secondes du milieu.
const RAPIDITE_CACHE = { plateau: 15, plancher: 2, max: 100 };

// « Il faut également un tableau en-dessous du classement des 50 premières
// personnes avec leur nombre de points à chaque dévoilement. »
const CLASSEMENT_CACHE = 50;

// LES RÉPONSES D'UN TOUR PASSÉ. Le moteur met de côté celles du tour qui s'achève
// sous `answersTourN` — c'est ce qui permet à « Vote » de relire le premier tour
// au moment de noter le second. Ici il y en a cinq à relire, et la manche en cours
// est le dernier tour.
function reponseDuTour(rt, tour, pid) {
  const carte = tour === rt.tour ? rt.answers : rt[`answersTour${tour}`];
  return carte ? carte.get(pid) || null : null;
}

// Tous ceux qui ont répondu à AU MOINS une question. Un joueur qui n'a rien
// tenté n'apparaît pas au classement de la manche : il n'y a pas joué.
function joueursDeLaManche(rt) {
  const vus = new Set();
  for (let tour = 2; tour <= rt.tours; tour += 1) {
    const carte = tour === rt.tour ? rt.answers : rt[`answersTour${tour}`];
    if (carte) for (const pid of carte.keys()) vus.add(pid);
  }
  return [...vus];
}

// LA BONNE RÉPONSE D'UNE QUESTION, selon sa forme. Les deux formes de couleur se
// répondent par un choix — un indice dans la liste des couleurs ; les trois autres
// se tapent, et se comparent au nom sans casse, sans accents et sans ponctuation
// (voir `memeNom`).
// LA LISTE DE CHOIX D'UNE FORME, ou `null` si la réponse se tape.
//
// LA PALETTE EST CELLE DE LA MANCHE, PAS CELLE DU DÉPÔT. Une banque modérée peut
// porter d'autres couleurs ; proposer les cinq du dépôt donnerait au joueur des
// boutons dont aucun n'est la bonne réponse. Le repli sur `COULEURS` ne sert
// qu'aux manches d'avant ce changement, rechargées après un redémarrage.
function listeDeChoix(forme, rt) {
  const quoi = FORMES[forme]?.choix;
  if (quoi === 'couleurs') return (rt?.couleurs?.length ? rt.couleurs : COULEURS);
  if (quoi === 'cases') return NUMEROS;
  return null;
}

function questionReussie(q, valeur, rt) {
  const liste = listeDeChoix(q.forme, rt);
  if (liste) return liste[valeur] === q.reponse;
  return memeNom(valeur, q.reponse);
}

// LA DURÉE RÉELLE D'UNE MANCHE, DÉCLARÉE PAR LE MODULE.
//
// CE QUI A ÉTÉ RAPPORTÉ : « l'information de temps en seconde dans le bloc d'un
// module ne correspond pas à l'information de "durée" quand on veut modifier un
// module. De plus, les valeurs de durée que l'on y trouve ne correspondent pas à
// la réalité. (Exemple : pour "Coupe ta bûche", il est inscrit 20sec, or le jeu
// dure 10 secondes.) »
//
// DEUX ÉCARTS, ET LA MÊME CAUSE : le Studio affichait le champ `duration` de la
// BANQUE, un nombre que l'animateur pouvait régler — alors que la plupart des
// jeux ne le lisent pas. « Coupe ta bûche » dure dix secondes par règle, « Les
// visages » quarante, « Retour de flamme » soixante : leur banque disait vingt.
//
// Désormais chaque module DÉCLARE sa durée de jeu et si elle est fixe. Le Studio
// la reçoit par l'API et l'affiche telle quelle — carte et éditeur lisent le même
// nombre, et ce nombre est celui du jeu.
//   - `dureeS`    : la durée réelle, en secondes. `null` = c'est la banque qui la
//                   fixe (estimation, vote, le lien) ;
//   - `dureeFixe` : le jeu l'impose, le champ est verrouillé.
// ---------------------------------------------------------------------------
// LES CATÉGORIES DU VOTE
// ---------------------------------------------------------------------------
//
// CE QUI A ÉTÉ DEMANDÉ (15/09) : « il faut que les questions du jeu Vote puissent
// appartenir à une catégorie. Il doit y avoir la catégorie "Vie" et la catégorie
// "Dilemme". […] Cela ne change rien aux règles du jeu Vote, c'est le même
// fonctionnement pour les deux catégories. »
//
// UNE CATÉGORIE EST UN CHAMP DE LA QUESTION, PAS UN MODULE. Deux modules « Vote »
// auraient dédoublé la banque, les durées, la couleur d'accent et la modération —
// pour un jeu dont l'auteur précise lui-même que les règles ne changent pas. La
// catégorie sert à RANGER les questions, et l'écran de l'animateur à choisir dans
// laquelle il pioche.
//
// C'EST LE SERVEUR QUI LES NOMME. Un écran qui recopierait « Vie » et « Dilemme »
// finirait par proposer un onglet que la banque ne connaît pas, ou par manquer
// celui qu'on ajouterait — la même règle que les modes de « Cache-cache ».
//
// L'ORDRE DE CETTE TABLE EST CELUI DES ONGLETS.
//
// UNE TROISIÈME CATÉGORIE, ET ELLE, CHANGE LES RÈGLES (26/09) : « il faut qu'il y
// ait trois catégories : vie, dilemme et sondage, et vie et dilemme peuvent
// rapporter des points […] on ne doit pas sélectionner si ça rapporte des points
// ou pas, vraiment automatiquement. »
//
// `points` EST DONC UNE PROPRIÉTÉ DE LA CATÉGORIE, déclarée ici et nulle part
// ailleurs. Avant, c'était un interrupteur par question — « Rapporte des points /
// Sondage sans points » — indépendant de la catégorie : on pouvait écrire un
// « Dilemme » sans points ou un sondage rangé dans « Vie », et l'onglet ne disait
// plus ce que la question allait faire.
export const CATEGORIES_VOTE = [
  { cle: 'vie', nom: 'Vie', points: true },
  { cle: 'dilemme', nom: 'Dilemme', points: true },
  { cle: 'sondage', nom: 'Sondage', points: false },
];
export const CATEGORIE_VOTE_PAR_DEFAUT = 'vie';

// LA CATÉGORIE D'UNE QUESTION, TOUJOURS VALIDE.
//
// Les questions écrites avant le 15/09 n'en portent pas : elles vont en « Vie »,
// la catégorie générique — aucune question déjà écrite ne devient injouable, et
// aucune ne disparaît d'un onglet sans que personne ne le cherche.
//
// L'ANCIEN INTERRUPTEUR EST RESPECTÉ. Une question que l'auteur avait passée en
// « Sondage sans points » (`poll: true`) a été écrite pour ne PAS rapporter de
// points ; la ranger en « Vie » la rendrait notée sans que personne l'ait
// décidé. Elle devient donc un sondage — quelle que soit la catégorie qu'elle
// portait, puisque cette catégorie ne réglait rien à l'époque. Le Studio écrit
// désormais les deux champs d'accord, si bien que ce repli ne sert qu'aux
// questions d'avant.
export function categorieDe(q) {
  if (q?.poll === true) return 'sondage';
  const cle = String(q?.categorie || '').trim().toLowerCase();
  return CATEGORIES_VOTE.some((c) => c.cle === cle) ? cle : CATEGORIE_VOTE_PAR_DEFAUT;
}

// UN VOTE RAPPORTE-T-IL DES POINTS ? La catégorie le dit, et elle seule.
export function voteRapporte(q) {
  const cle = categorieDe(q);
  return CATEGORIES_VOTE.find((c) => c.cle === cle)?.points !== false;
}

export const modules = {
  quiz: {
    meta: {
      type: 'quiz', name: 'Quiz', icon: 'help-circle', color: 'primary',
      scored: true, malus: true, vitesse: true,
      dureeS: DUREE_QUESTION_COURTE, dureeFixe: true,
    },
    buildRound(q) {
      return {
        type: 'quiz',
        questionId: q.id,
        text: q.text,
        options: q.options,
        correctIndex: q.correctIndex,
        durationMs: DUREE_QUESTION_COURTE * 1000,
      };
    },
    publicQuestion(rt) {
      return { type: 'quiz', questionId: rt.questionId, text: rt.text, options: rt.options };
    },
    validateAnswer(rt, value) {
      const i = Number(value);
      return Number.isInteger(i) && i >= 0 && i < rt.options.length ? i : null;
    },
    score(rt) {
      const results = new Map();
      for (const [pid, a] of rt.answers) {
        const correct = a.value === rt.correctIndex;
        results.set(pid, {
          base: correct ? BASE_QUIZ : 0,
          speed: correct ? complementVitesse(rt, a.at) : 0,
          correct,
        });
      }
      const stats = { kind: 'options', options: rt.options, tally: tallyOptions(rt, rt.options.length), total: rt.answers.size };
      return { results, reveal: { correctIndex: rt.correctIndex, text: rt.text, options: rt.options, stats } };
    },
  },

  true_false: {
    meta: {
      type: 'true_false', name: 'Vrai / Faux', icon: 'check-square', color: 'forest',
      scored: true, malus: true, vitesse: true,
      dureeS: DUREE_QUESTION_COURTE, dureeFixe: true,
    },
    buildRound(q) {
      return {
        type: 'true_false',
        questionId: q.id,
        text: q.text,
        correct: !!q.correct,
        durationMs: DUREE_QUESTION_COURTE * 1000,
      };
    },
    publicQuestion(rt) {
      return { type: 'true_false', questionId: rt.questionId, text: rt.text };
    },
    validateAnswer(rt, value) {
      if (value === true || value === false) return value;
      if (value === 'true' || value === 'false') return value === 'true';
      return null;
    },
    score(rt) {
      const results = new Map();
      let vrai = 0;
      for (const [pid, a] of rt.answers) {
        if (a.value === true) vrai += 1;
        const correct = a.value === rt.correct;
        results.set(pid, {
          base: correct ? BASE_VRAI_FAUX : 0,
          speed: correct ? complementVitesse(rt, a.at) : 0,
          correct,
        });
      }
      const stats = { kind: 'options', options: ['Vrai', 'Faux'], tally: [vrai, rt.answers.size - vrai], total: rt.answers.size };
      return { results, reveal: { correct: rt.correct, text: rt.text, stats } };
    },
  },

  estimation: {
    meta: {
      type: 'estimation', name: 'Estimation', icon: 'target', color: 'flame',
      scored: true, malus: false, vitesse: false,
      // La durée vient de la banque : c'est l'un des trois jeux où le réglage agit.
      dureeS: null, dureeFixe: false,
    },
    buildRound(q) {
      return {
        type: 'estimation',
        questionId: q.id,
        text: q.text,
        target: Number(q.target),
        // DÉCISION 5.7 — la nature de la réponse, déclarée à la création dans le
        // Studio. Deux jeux de plages : relatives pour un nombre, ABSOLUES pour
        // une année. Sans déclaration, on reste en relatif (décision 5.10) : les
        // questions existantes gardent leur comportement, aucune migration.
        nature: q.nature === 'annee' ? 'annee' : 'nombre',
        durationMs: (q.durationSec || 20) * 1000,
      };
    },
    publicQuestion(rt) {
      return { type: 'estimation', questionId: rt.questionId, text: rt.text };
    },
    validateAnswer(rt, value) {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    },
    score(rt) {
      // Points par PALIER de précision, valeur fixe, aucune composante de vitesse.
      // « Correct » (pour la série) = les deux meilleurs paliers, soit à moins de
      // 10 % de la cible — le seuil d'avant, inchangé.
      const results = new Map();
      const values = [];
      let closest = null;
      // DÉCISIONS 5.3, 5.4 et 6.1 — on désigne LES JOUEURS les plus proches, pas
      // seulement la valeur. Un seul calcul sert au bonus et à l'affichage du nom
      // chez l'animateur : deux définitions du « plus proche » finiraient par
      // diverger.
      let ecartMini = Infinity;
      let plusProches = [];
      const nature = rt.nature === 'annee' ? 'annee' : 'nombre';

      for (const [pid, a] of rt.answers) {
        values.push(a.value);
        const palier = palierEstimation(a.value, rt.target, nature);
        const ecart = Math.abs(a.value - rt.target);
        // DÉCISION 5.5 — l'exactitude s'ajoute AUX points de la plage.
        const exact = ecart === 0;
        // BASE ET BONUS SÉPARÉS, et non plus additionnés ici.
        //
        // Tout tombait dans `base` : l'écran du joueur affichait donc « Base 1 600 »
        // sans que rien ne dise d'où venaient les six cents points de plus. Le
        // total était juste, le calcul invisible — et le barème que le jeu vient
        // d'expliquer au joueur devenait invérifiable.
        //
        // Les composantes voyagent séparément ; c'est le moteur qui fait la somme,
        // à un seul endroit.
        results.set(pid, {
          base: palier.points,
          bonusExact: exact ? BONUS_EXACTITUDE : 0,
          bonusProche: 0,
          speed: 0,
          // Les deux meilleurs paliers — voir `estUneReussite`. Cela s'écrivait
          // `palier.ecartMax <= 2` en années et `<= 0.10` en relatif : deux seuils
          // qui ne disaient pas ce qu'ils voulaient dire, et qu'un troisième
          // barème aurait fait recopier une troisième fois.
          correct: estUneReussite(palier.nom),
          palier: palier.nom, // sert à l'affichage et aux messages (action 7)
          exact,
        });
        if (closest === null || ecart < Math.abs(closest - rt.target)) closest = a.value;
        // DÉCISION 5.4 — égalité : TOUS les joueurs à distance identique. Même
        // principe que l'égalité au vote (décision 2 de l'action 18 du v1).
        if (ecart < ecartMini) { ecartMini = ecart; plusProches = [pid]; }
        else if (ecart === ecartMini) plusProches.push(pid);
      }

      // LE BONUS DU PLUS PROCHE NE JOUE QUE SI PERSONNE N'EST DANS UN PALIER (A4).
      //
      // « N'activer le bonus du plus proche dans Estimation uniquement si tous les
      // joueurs sont hors palier. »
      //
      // C'EST UN RETOUR À SA RAISON D'ÊTRE, telle qu'elle était écrite : « le plus
      // proche marque, même si personne n'est dans une plage. Sans lui, une manche
      // où tout le monde vise trop large ne rapporte rien à personne : le module
      // devient muet. » Le filet a été posé pour ce cas-là, puis distribué dans
      // tous les autres — y compris à qui touchait déjà 1000 de palier, à qui il
      // n'apportait qu'un supplément sans objet.
      //
      // Ce que ça change concrètement : quand quelqu'un est dans une plage, le
      // barème seul décide, et le plus juste est déjà le mieux payé par
      // construction. Quand personne n'y est, le filet se déclenche et la manche
      // rapporte à quelqu'un.
      //
      // « Tous les joueurs » = tous ceux qui ONT RÉPONDU. Un joueur silencieux n'a
      // pas de résultat, et ne saurait empêcher le filet de jouer.
      const personneDansUnPalier = [...results.values()].every((r) => r.palier === 'hors');
      if (personneDansUnPalier) {
        for (const pid of plusProches) {
          const r = results.get(pid);
          if (r) r.bonusProche = BONUS_PLUS_PROCHE;
        }
      }
      // Les plages sont calculées AVANT l'histogramme : c'est la plus large qui
      // fixe l'ouverture minimale de l'échelle.
      const plages = plagesEstimation(rt.target, nature);
      const margeBareme = Math.max(0, ...plages.map((p) => p.haut - rt.target));
      values.sort((a, b) => a - b);
      const avg = values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
      const median = values.length ? values[Math.floor(values.length / 2)] : null;
      const stats = {
        kind: 'numeric',
        total: values.length,
        avg: avg != null ? Math.round(avg * 100) / 100 : null,
        median,
        closest,
        target: rt.target,
        // L'histogramme est CALÉ SUR LE BARÈME : les bornes de tranches sont
        // celles des paliers, et la réponse exacte est comptée à part.
        histogramme: histogrammeBareme(values, rt.target, plages, margeBareme),
        // Les plages du barème, pour que les deux histogrammes portent un axe qui
        // dit quelque chose (voir `plagesEstimation`).
        plages,
        nature,
      };
      // `prives` : ce qui ne doit JAMAIS partir dans `reveal`, lequel est diffusé
      // à tout le salon, stream compris. Les noms des plus proches en font partie
      // (décision 6.2) — même famille que la file d'attente, décision 8 de
      // l'action 6 du chantier v1.
      return { results, reveal: { target: rt.target, text: rt.text, stats }, prives: { plusProches } };
    },
  },

  // ============================================================
  // LE LIEN — trouver le mot qui relie deux mots, et penser comme les autres
  // ============================================================
  //
  // CE QUI LE DISTINGUE DE TOUS LES AUTRES JEUX. Il n'y a pas de bonne réponse.
  // On ne gagne pas en ayant raison mais en ayant pensé COMME LES AUTRES : un mot
  // que personne d'autre n'a donné ne rapporte rien, si juste soit-il.
  //
  // ET SA QUESTION NE VIENT PAS DE LA BIBLIOTHÈQUE. L'animateur tape ses deux
  // mots en direct, à l'antenne, en fonction de ce qui vient de se dire. D'où
  // `direct: true` : ce jeu n'a pas de banque de questions, et rien ne doit lui en
  // réclamer une.
  lien: {
    meta: {
      type: 'lien', name: 'Le lien', icon: 'link', color: 'info',
      scored: true, malus: false, vitesse: false,
      dureeS: null, dureeFixe: false,
      // La question est SAISIE À L'ANTENNE, jamais tirée d'une réserve.
      direct: true,
    },
    buildRound(q) {
      const mots = [String(q.mot1 || '').trim(), String(q.mot2 || '').trim()];
      return {
        type: 'lien',
        questionId: q.id,
        mots,
        // `text` existe pour tout ce qui affiche « l'énoncé » sans connaître le
        // jeu — la file de l'animateur, l'historique, la carte de partage.
        text: mots.join(' · '),
        durationMs: (q.durationSec || 45) * 1000,
      };
    },
    publicQuestion(rt) {
      return { type: 'lien', questionId: rt.questionId, text: rt.text, mots: rt.mots };
    },
    validateAnswer(rt, value) {
      // UN MOT, pas une phrase. On borne la longueur — un joueur qui colle un
      // paragraphe ne doit pas pouvoir déformer l'écran de l'animateur — et l'on
      // refuse le vide, qui n'est pas une réponse.
      const mot = String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
      return mot.length ? mot : null;
    },
    score(rt) {
      const { groupes, parJoueur } = grouperLesMots(rt.answers);

      const results = new Map();
      for (const [pid, g] of parJoueur) {
        // SEUL AVEC SON MOT : aucun point. C'est la règle du jeu, pas une
        // punition — on n'y gagne qu'en pensant comme quelqu'un d'autre.
        const partage = g.count >= 2;
        results.set(pid, {
          base: partage ? BASE_LIEN : 0,
          bonusGroupe: partage ? bonusDeRang(g.rang) : 0,
          speed: 0,
          // `correct` nourrit la SÉRIE et le verdict de l'écran : avoir partagé
          // son mot est la réussite de ce jeu.
          correct: partage,
          rang: partage ? g.rang : null,
          taille: g.count,
        });
      }

      // CE QUI EST PUBLIC : les mots et leurs effectifs, jamais qui les a donnés.
      // Le stream est une source capturée par OBS — même frontière que le nom du
      // plus proche à l'estimation (décision 6.2 du chantier v4).
      const stats = {
        kind: 'lien',
        total: rt.answers.size,
        groupes: groupes.map((g) => ({ mot: g.mot, count: g.count, rang: g.rang, points: g.count >= 2 ? BASE_LIEN + bonusDeRang(g.rang) : 0 })),
        // Combien de joueurs sont restés seuls avec leur mot : c'est ce chiffre
        // qui dit si le groupe s'est trouvé ou dispersé.
        solitaires: groupes.filter((g) => g.count === 1).length,
      };

      return {
        results,
        reveal: { type: 'lien', mots: rt.mots, text: rt.text, stats },
        // Les NOMS, pour l'animateur seul : c'est lui qui commente à l'antenne.
        prives: {
          groupes: groupes.map((g) => ({ mot: g.mot, count: g.count, rang: g.rang, joueurs: g.pids })),
        },
      };
    },
  },

  // « LES VISAGES » — pas de banque de questions : la série est TIRÉE à chaque
  // lancement. Comme « Le lien », le jeu se déclenche en deux temps (annonce,
  // puis « Démarrer le jeu ») ; contrairement à lui, l'animateur n'a rien à
  // saisir — il donne le départ, c'est tout.
  visages: {
    meta: {
      type: 'visages', name: 'Les visages', icon: 'users', color: 'forest',
      scored: true, malus: false,
      dureeS: (REGLES_VISAGES.total * REGLES_VISAGES.cadenceMs) / 1000, dureeFixe: true,
      // La vitesse ne joue AUCUN rôle : on ne gagne pas en buzzant vite, on gagne
      // en buzzant sur le bon visage. Buzzer au plus tôt est même la faute du
      // jeu — c'est la première apparition.
      vitesse: false,
      direct: true,
      // LE DÉFILÉ, DÉCLARÉ. Le moteur pousse les images une par une pour les deux
      // jeux qui en ont un, et c'est CETTE déclaration qui l'arme — plus aucun
      // nom de jeu n'est écrit dans le moteur.
      //
      // L'AVOIR OUBLIÉE ICI A COÛTÉ UNE RÉGRESSION : en généralisant le défilé
      // pour « Retour de flamme », je l'ai déclarée sur le jeu neuf et pas sur
      // celui-ci. Les visages ne défilaient plus du tout — la série restait sur
      // son premier portrait, et le jeu n'avait plus de réponse. Attrapée par le
      // contrôle de bout en bout qui existait déjà, à la ligne près.
      defile: { cadenceMs: CADENCE_VISAGES, total: TOTAL_VISAGES },
    },
    buildRound(q) {
      const serie = construireSerie(q.bassin && q.bassin.length ? q.bassin : idsDuBassin());
      return {
        type: 'visages',
        questionId: q.id,
        // LA SÉRIE RESTE AU SERVEUR. Elle n'entre pas dans `publicQuestion` : un
        // identifiant qui apparaît deux fois dans une charge utile, c'est la
        // réponse lisible dans l'onglet réseau du navigateur. Les visages sont
        // émis UN PAR UN, à leur seconde (voir `engine.js`).
        ordre: serie.ordre,
        doubleId: serie.doubleId,
        pos1: serie.pos1,
        pos2: serie.pos2,
        text: 'Quel visage est passé deux fois ?',
        durationMs: REGLES_VISAGES.total * REGLES_VISAGES.cadenceMs,
      };
    },
    publicQuestion(rt) {
      return {
        type: 'visages',
        questionId: rt.questionId,
        text: rt.text,
        cadenceMs: REGLES_VISAGES.cadenceMs,
        total: REGLES_VISAGES.total,
        // LES VISAGES DE CETTE SÉRIE, MÉLANGÉS — pour que le client
        // charge ses images d'avance.
        //
        // POURQUOI CE N'EST PAS UNE FUITE. C'est l'ORDRE qui porte la réponse, pas
        // l'ensemble : savoir quels visages vont passer n'apprend rien sur celui
        // qui repassera. Le mélange ôte jusqu'à l'indice de l'ordre de tirage.
        //
        // POURQUOI PAS LE BASSIN ENTIER. Il compte deux cents portraits : les
        // envoyer tous ferait précharger deux cents images pour
        // en afficher vingt, sur le téléphone d'un joueur, en soirée, parfois en
        // 4G. Vingt-neuf suffisent, et ce sont exactement celles qui serviront.
        //
        // POURQUOI PRÉCHARGER TOUT COURT. Un visage reste deux secondes à
        // l'écran. Une image qui arrive en retard, c'est un visage qu'on n'a pas
        // vu — donc une manche faussée, sans que rien ne le signale.
        // LES IDENTIFIANTS **DISTINCTS**, et c'est tout le sujet : mélanger
        // l'ordre tel quel y laisserait le visage doublé DEUX FOIS. Il suffirait
        // alors de compter les doublons de la liste de préchargement pour
        // connaître la réponse avant le premier visage. Vingt-neuf entrées,
        // chacune une seule fois.
        bassin: melanger([...new Set(rt.ordre)]).map((id) => ({ id, src: srcDeVisage(id) })),
      };
    },
    // UN BUZZ N'A PAS DE VALEUR : il a une HEURE, et le serveur l'horodate à
    // l'arrivée. On accepte donc n'importe quoi et l'on n'en garde rien — ce que
    // le client enverrait ne servirait qu'à mentir.
    validateAnswer() {
      return true;
    },
    score(rt) {
      const results = new Map();
      // Combien de buzz sur chacune des places : c'est le graphique de
      // l'animateur et celui du stream.
      const parPlace = new Array(REGLES_VISAGES.total).fill(0);

      for (const [pid, a] of rt.answers) {
        const place = creneauDe(rt.startedAt, a.at);
        parPlace[place - 1] += 1;
        const gagne = place === rt.pos2;
        results.set(pid, {
          base: gagne ? BASE_VISAGES : 0,
          speed: 0,
          // `correct` nourrit la série et le verdict de l'écran.
          correct: gagne,
          // De quoi écrire le résultat sans refaire le calcul côté client :
          // la place buzzée, et si c'était la première apparition — le cas qu'il
          // faut nommer, parce que le joueur a bien reconnu le visage, trop tôt.
          place,
          troppTot: place === rt.pos1,
        });
      }

      const stats = {
        kind: 'visages',
        total: rt.answers.size,
        ordre: rt.ordre,
        // Les adresses des images, une fois la manche révélée : les graphiques de
        // l'animateur et du stream redessinent la série entière, et doivent
        // montrer LES MÊMES visages que ceux qui viennent de défiler. Un tableau
        // de couples plutôt qu'une carte : c'est ce qui traverse un socket sans
        // conversion.
        adresses: [...new Set(rt.ordre)].map((id) => [id, srcDeVisage(id)]),
        doubleId: rt.doubleId,
        pos1: rt.pos1,
        pos2: rt.pos2,
        parPlace,
        trouve: [...results.values()].filter((r) => r.correct).length,
        troppTot: [...results.values()].filter((r) => r.troppTot).length,
      };

      return {
        results,
        reveal: { type: 'visages', text: rt.text, doubleId: rt.doubleId, pos1: rt.pos1, pos2: rt.pos2, stats },
      };
    },
  },

  // ============================================================
  // « LE JUSTE TEMPS » — arrêter un chrono qu'on ne voit plus
  // ============================================================
  //
  // LE JEU. Un compte à rebours de quinze secondes part sur les téléphones et à
  // l'antenne. À l'instant que l'animateur a choisi — le TEMPS DE CACHE — il
  // disparaît, consumé par les flammes. Il continue pourtant de courir. Les
  // joueurs appuient sur STOP quand ils croient qu'il atteint le TEMPS CIBLE.
  //
  // COMME « LE LIEN », SA QUESTION SE TAPE À L'ANTENNE : deux temps, en direct,
  // d'où `direct: true`. Il n'a donc pas de banque de questions, et rien ne doit
  // lui en réclamer une.
  //
  // LE BARÈME EST CELUI DE L'ESTIMATION, transposé en secondes : quatre paliers
  // de proximité et un bonus d'exactitude, soit 1 200 points au plus. Il n'y a
  // PAS de filet du « plus proche » ici — l'énoncé du jeu ne le prévoit pas, et
  // son maximum annoncé (1 200) est exactement 1 000 + 200. L'ajouter serait
  // inventer une règle que personne n'a demandée.
  juste_temps: {
    meta: {
      type: 'juste_temps', name: 'Le juste temps', icon: 'clock', color: 'flame',
      scored: true, malus: false,
      dureeS: DUREE_JUSTE_TEMPS, dureeFixe: true,
      // LA DURÉE DU CADRAN, PUBLIÉE DANS LA META — et pourquoi elle y est.
      //
      // L'écran de saisie de l'animateur doit borner ses deux champs AVANT que la
      // manche n'existe : il n'a donc encore reçu aucune question d'où la tirer.
      // Recopier « 15 » dans la console serait le premier pas vers deux durées qui
      // divergent — un cadran de quinze secondes et des champs qui en acceptent
      // vingt. La bibliothèque de l'animateur transporte donc cette valeur avec le
      // reste (voir `host:modules`).
      dureeCompteMs: DUREE_JUSTE_TEMPS * 1000,
      // La rapidité ne joue AUCUN rôle : on ne gagne pas en buzzant vite, on
      // gagne en buzzant JUSTE. Buzzer tôt est même le contraire de la justesse
      // dès que la cible est basse.
      vitesse: false,
      direct: true,
    },
    buildRound(q) {
      return {
        type: 'juste_temps',
        questionId: q.id,
        // Le temps où le chrono s'efface. Il est PUBLIC : le client doit savoir
        // quand cacher, et le connaître n'apprend rien sur la cible.
        cache: borneDeChrono(q.cache),
        // La cible porte le nom `target`, et ce n'est pas un anglicisme resté là :
        // c'est le nom que lisent l'histogramme du barème, les plages et le
        // moteur. La renommer ici obligerait à un aiguillage dans chacun.
        target: borneDeChrono(q.cible),
        // La NATURE de la réponse — troisième du projet, après le nombre et
        // l'année. C'est elle qui choisit le barème et les étiquettes de l'axe.
        nature: 'temps',
        text: 'Arrête le chrono au bon moment.',
        // LA FENÊTRE DÉPASSE LE COMPTE À REBOURS, et il le faut : un joueur qui
        // buzze à 0,00 arrive à quinze secondes pile, et `submitAnswer` refuse à
        // l'échéance EXACTE. Sans cette marge, viser le zéro serait
        // structurellement impossible — ce qui est précisément la cible la plus
        // tentante quand on ne voit plus rien.
        durationMs: DUREE_JUSTE_TEMPS * 1000 + MARGE_JUSTE_TEMPS,
      };
    },
    publicQuestion(rt) {
      return {
        type: 'juste_temps',
        questionId: rt.questionId,
        text: rt.text,
        cache: rt.cache,
        dureeCompteMs: DUREE_JUSTE_TEMPS * 1000,
        // LA CIBLE EST PUBLIQUE, ET J'AVAIS EU TORT DE LA CACHER.
        //
        // Je l'avais retenue au serveur en la prenant pour la réponse — comme le
        // visage doublé ou la série de « Retour de flamme ». C'était un
        // contresens : ici la cible est la CONSIGNE, pas la solution. Un joueur
        // qui l'ignore ne peut pas jouer du tout — on lui demande d'arrêter un
        // chrono sur un temps qu'on ne lui a pas dit. Le jeu était injouable, et
        // rien ne le signalait : les manches se déroulaient, les points se
        // calculaient sur des buzz au hasard.
        //
        // CE QUI RESTE CACHÉ, ET QUI EST LE VRAI JEU : le chrono lui-même, une
        // fois passé le temps de cache. On sait ce qu'il faut viser ; on ne sait
        // plus où en est l'aiguille.
        cible: rt.target,
      };
    },
    // UN BUZZ A UNE HEURE. Ce que le client annonce n'est qu'un APPOINT, borné
    // par l'horloge de l'arbitre — voir `valeurDuBuzz`, qui explique pourquoi ce
    // jeu s'écarte ici de la doctrine de « Les visages ».
    validateAnswer(rt, value) {
      const n = Number(value);
      if (!Number.isFinite(n)) return SANS_ANNONCE;
      return Math.min(DUREE_JUSTE_TEMPS, Math.max(0, n));
    },
    score(rt) {
      const results = new Map();
      const valeurs = [];
      let closest = null;

      for (const [pid, a] of rt.answers) {
        const valeur = valeurDuBuzz(rt, a);
        valeurs.push(valeur);
        const palier = palierEstimation(valeur, rt.target, 'temps');
        // L'EXACTITUDE, AU CENTIÈME — l'unité du jeu, et celle que l'animateur
        // saisit. Comparer les flottants nus ferait manquer l'exactitude à qui
        // l'a trouvée.
        const exact = auCentieme(Math.abs(valeur - rt.target)) === 0;
        results.set(pid, {
          base: palier.points,
          bonusExact: exact ? BONUS_EXACTITUDE : 0,
          speed: 0,
          correct: estUneReussite(palier.nom),
          palier: palier.nom,
          exact,
          // LE TEMPS RETENU, envoyé au joueur avec son résultat. Son téléphone ne
          // peut pas le recalculer : la valeur qui compte est celle que l'arbitre
          // a arrêtée, pas celle que l'écran affichait.
          valeur,
        });
        if (closest === null || Math.abs(valeur - rt.target) < Math.abs(closest - rt.target)) closest = valeur;
      }

      const plages = plagesEstimation(rt.target, 'temps');
      const margeBareme = Math.max(0, ...plages.map((p) => p.haut - rt.target));
      valeurs.sort((a, b) => a - b);
      const avg = valeurs.length ? auCentieme(valeurs.reduce((s, v) => s + v, 0) / valeurs.length) : null;
      const median = valeurs.length ? valeurs[Math.floor(valeurs.length / 2)] : null;

      // `kind: 'numeric'` — ET CE N'EST PAS UN RACCOURCI. C'est la forme d'une
      // répartition autour d'une cible chiffrée : l'histogramme calé sur le
      // barème, l'axe, la règle des plages et les phrases de plateau la lisent
      // déjà. Inventer un `kind` jumeau obligerait à recopier quatre écrans et
      // deux jeux de phrases pour dessiner exactement la même chose.
      //
      // `unite` dit aux écrans COMMENT écrire ces nombres : « 4,72 s » et non
      // « 5 ». C'est la seule chose qui change entre une estimation et un chrono.
      const stats = {
        kind: 'numeric',
        unite: 'secondes',
        total: valeurs.length,
        avg,
        median,
        closest,
        target: rt.target,
        histogramme: histogrammeBareme(valeurs, rt.target, plages, margeBareme),
        plages,
        nature: 'temps',
        // Le temps de cache : le graphique peut ainsi montrer À PARTIR D'OÙ les
        // joueurs ne voyaient plus rien. C'est l'information que l'animateur
        // commente en premier.
        cache: rt.cache,
      };

      // LE CLASSEMENT DES TRENTE MEILLEURS — POUR L'ANIMATEUR SEUL.
      //
      // Il commente à l'antenne : le graphique lui dit COMMENT le cercle s'est
      // réparti, pas QUI a fait quoi. Sans les noms, il ne peut féliciter
      // personne. Les noms ne partent jamais vers le stream — même frontière que
      // le plus proche de l'estimation (décision 6.2 du chantier v4).
      const classement = [...results.entries()]
        .map(([pid, r]) => ({ pid, valeur: r.valeur, ecart: auCentieme(Math.abs(r.valeur - rt.target)) }))
        .sort((a, b) => a.ecart - b.ecart)
        .slice(0, CLASSEMENT_MANCHE);

      return {
        results,
        reveal: { type: 'juste_temps', target: rt.target, cache: rt.cache, text: rt.text, stats },
        prives: { classement },
      };
    },
  },

  // « RETOUR DE FLAMME » — voir la règle plus haut, à côté de sa série.
  retour_flamme: {
    meta: {
      type: 'retour_flamme', name: 'Retour de flamme', icon: 'shuffle', color: 'fire',
      scored: true, malus: false,
      dureeS: (TOTAL_RETOUR * CADENCE_RETOUR) / 1000, dureeFixe: true,
      // La rapidité ne joue aucun rôle : on buzze pendant l'image ou pas du tout.
      vitesse: false,
      // Pas de banque : la série est tirée à chaque lancement, comme « Les visages ».
      direct: true,
      // LE DÉFILÉ. Le moteur pousse les images une par une plutôt que de les
      // livrer d'un bloc — sans quoi la série entière, donc les six réponses,
      // serait lisible dans l'onglet réseau du navigateur.
      defile: { cadenceMs: CADENCE_RETOUR, total: TOTAL_RETOUR },
      // PLUSIEURS BUZZ PAR JOUEUR, et c'est le seul module du projet dans ce cas.
      multi: true,
      // Les deux modes ET les deux familles d'image, publiés pour que la console
      // les propose sans les recopier.
      ecarts: ECARTS_RETOUR,
      familles: FAMILLES_RETOUR,
      // CE QUE VAUT UN BUZZ, publié avec le reste de la meta. L'écran de résultat
      // l'affiche en toutes lettres — « +200 » / « −200 » — et le recopier côté
      // client donnerait deux barèmes qui finiraient par différer, celui de
      // l'écran ayant toujours tort.
      points: POINTS_RETOUR,
    },
    buildRound(q) {
      const ecart = ECARTS_RETOUR.includes(Number(q.ecart)) ? Number(q.ecart) : ECARTS_RETOUR[0];
      // UNE SÉRIE N'EMPLOIE QU'UNE FAMILLE : chiffres OU figures, jamais les deux.
      const famille = FAMILLES_RETOUR.includes(q.famille) ? q.famille : FAMILLES_RETOUR[0];
      const serie = construireSerieRetour(ecart, bassinDe(famille));
      return {
        type: 'retour_flamme',
        questionId: q.id,
        famille,
        // LA SÉRIE RESTE AU SERVEUR. Elle n'entre pas dans `publicQuestion` :
        // trente identifiants dont six répètent celui d'il y a deux places, c'est
        // la réponse en clair pour qui sait lire une charge utile.
        ordre: serie.ordre,
        retours: serie.retours,
        ecart,
        text: ecart === 2
          ? 'Buzze quand une image revient deux images plus tard.'
          : 'Buzze quand une image revient trois images plus tard.',
        durationMs: TOTAL_RETOUR * CADENCE_RETOUR,
      };
    },
    publicQuestion(rt) {
      return {
        type: 'retour_flamme',
        questionId: rt.questionId,
        text: rt.text,
        cadenceMs: CADENCE_RETOUR,
        total: TOTAL_RETOUR,
        // L'ÉCART EST PUBLIC, et il le doit : c'est la règle du jeu, pas la
        // réponse. Un joueur qui ignorerait s'il joue en −2 ou en −3 ne pourrait
        // pas jouer du tout.
        ecart: rt.ecart,
        // La famille est PUBLIQUE : c'est la règle du jeu, pas la réponse. Elle
        // dit au joueur ce qu'il va voir défiler.
        famille: rt.famille,
        retoursAttendus: RETOURS_PAR_SERIE,
      };
    },
    // UN BUZZ N'A PAS DE VALEUR : il a une HEURE. Le moteur l'horodate à
    // l'arrivée et en déduit l'image désignée — voir `submitAnswer`, qui accumule
    // ici au lieu de refuser le second buzz.
    validateAnswer() {
      return true;
    },
    score(rt) {
      const estRetour = new Set(rt.retours);
      const results = new Map();
      const parPlace = new Array(TOTAL_RETOUR).fill(0);

      for (const [pid, a] of rt.answers) {
        // `a.value` porte les PLACES désignées, posées par le moteur au fil des
        // buzz. Chaque image ne compte qu'une fois — voir `submitAnswer`.
        const places = Array.isArray(a.value) ? a.value : [];
        let bons = 0;
        let rates = 0;
        for (const place of places) {
          parPlace[place - 1] += 1;
          if (estRetour.has(place)) bons += 1; else rates += 1;
        }
        // LE SOLDE PEUT ÊTRE NÉGATIF — ET LE SCORE NE LE SUIT PAS.
        //
        // « si le résultat du jeu est négatif, alors le joueur ne perd pas de
        // points sur son score total. Soit le joueur gagne des points, soit il
        // n'en gagne pas. » Les deux nombres voyagent donc séparément : le SOLDE,
        // qui est ce que le joueur a réellement fait et que son écran lui montre,
        // et la BASE, qui est ce que son score encaisse.
        //
        // Ne transmettre que la base rendrait le calcul invérifiable : un joueur
        // à deux bons et cinq ratés lirait « 0 » sans savoir pourquoi, alors que
        // le jeu vient de lui expliquer qu'il gagne 200 par retour.
        const brut = POINTS_RETOUR * (bons - rates);
        results.set(pid, {
          base: Math.max(0, brut),
          speed: 0,
          // `correct` nourrit la série et le verdict de l'écran : avoir marqué.
          correct: brut > 0,
          bons,
          rates,
          brut,
        });
      }

      const parfaits = [...results.values()].filter((r) => r.bons === RETOURS_PAR_SERIE && r.rates === 0).length;
      const stats = {
        kind: 'retour',
        total: rt.answers.size,
        ordre: rt.ordre,
        retours: rt.retours,
        ecart: rt.ecart,
        famille: rt.famille,
        parPlace,
        // Combien de joueurs ont marqué, et combien ont fait le sans-faute : les
        // deux chiffres que le plateau commente.
        marquants: [...results.values()].filter((r) => r.correct).length,
        parfaits,
        // Combien de retours ont été démasqués au moins une fois : c'est ce qui
        // dit si la série est passée sous le nez du cercle.
        retoursTrouves: rt.retours.filter((p) => parPlace[p - 1] > 0).length,
      };

      // LE CLASSEMENT DES TRENTE MEILLEURS — POUR L'ANIMATEUR SEUL, comme au
      // juste temps. Le graphique dit où le cercle a buzzé ; il ne dit pas qui.
      const classement = [...results.entries()]
        .map(([pid, r]) => ({ pid, score: r.base, bons: r.bons, rates: r.rates }))
        .sort((a, b) => b.score - a.score || b.bons - a.bons || a.rates - b.rates)
        .slice(0, CLASSEMENT_MANCHE);

      return {
        results,
        reveal: { type: 'retour_flamme', text: rt.text, ecart: rt.ecart, retours: rt.retours, stats },
        prives: { classement },
      };
    },
  },

  // ============================================================
  // « VOTE » — ce que tu penses, puis ce que pense le cercle
  // ============================================================
  //
  // LA RÈGLE A CHANGÉ, ET AVEC ELLE LA NATURE DU JEU.
  //
  // AVANT : un tour unique, et l'on marquait en faisant partie de la réponse
  // majoritaire. Le joueur qui votait sincèrement gagnait par chance ; celui qui
  // votait stratégiquement ne pouvait pas dire ce qu'il pensait. Les deux gestes
  // se confondaient dans un seul clic.
  //
  // MAINTENANT : DEUX TOURS, et ils séparent ces deux gestes.
  //   1. « Que penses-tu ? » — chacun répond sincèrement. La réponse qui récolte
  //      le plus de voix devient LA bonne réponse. Elle n'est montrée à personne.
  //   2. « Que pense le cercle ? » — chacun tente de désigner cette réponse-là.
  //      Ceux qui la trouvent marquent ; les autres ne perdent rien.
  //
  // C'EST LE PREMIER MODULE DU PROJET À SE JOUER EN DEUX TOURS. Tout le moteur
  // était bâti sur « une question, une fenêtre, une révélation » — voir
  // `finDeFenetre` et `tourSuivant` dans engine.js, où cette exception est portée
  // par le module et non par son nom.
  //
  // ET LA BONNE RÉPONSE NE DOIT SURTOUT PAS FUIR ENTRE LES DEUX. Le décompte du
  // premier tour ne quitte pas le canal de l'animateur avant la révélation : s'il
  // atteignait un écran de joueur ou la toile du stream, le second tour n'aurait
  // plus rien à deviner.
  // « COUPE TA BÛCHE » — voir la règle plus haut, à côté de son curseur.
  coupe_buche: {
    meta: {
      type: 'coupe_buche', name: 'Coupe ta bûche', icon: 'zap', color: 'fire',
      scored: true, malus: false,
      dureeS: DUREE_COUPE, dureeFixe: true,
      // La rapidité ne joue aucun rôle : on frappe au bon endroit ou pas.
      vitesse: false,
      // La proportion se saisit à l'antenne : pas de banque de questions.
      direct: true,
      // La durée et la période du curseur, publiées pour que les écrans dessinent
      // le MÊME balayage que celui sur lequel le serveur arbitre.
      dureeCoupeMs: DUREE_COUPE * 1000,
      periodeMs: PERIODE_COUPE,
    },
    buildRound(q) {
      return {
        type: 'coupe_buche',
        questionId: q.id,
        // `target` porte la cible : c'est le nom que lisent l'histogramme, les
        // plages et le moteur.
        target: borneDeProportion(q.cible),
        nature: 'proportion',
        text: 'Coupe la bûche à la bonne proportion.',
        durationMs: DUREE_COUPE * 1000 + MARGE_COUPE,
        // L'ALLURE CHOISIE À L'ANTENNE. Elle est blanchie : une valeur venue du
        // réseau ne commande pas directement un balayage — un mode inconnu
        // retombe sur l'allure normale plutôt que de figer le curseur.
        periodeMs: periodeDeLAllure(q.allure),
      };
    },
    publicQuestion(rt) {
      return {
        type: 'coupe_buche',
        questionId: rt.questionId,
        text: rt.text,
        // LA CIBLE EST PUBLIQUE : c'est la consigne, pas la réponse. Le joueur
        // doit savoir où couper — l'écran l'écrit en toutes lettres, « Coupe
        // cette bûche à 80 % ».
        cible: rt.target,
        dureeCoupeMs: DUREE_COUPE * 1000,
        periodeMs: rt.periodeMs,
      };
    },
    // UN COUP A UNE HEURE. Ce que le client annonce — l'instant local de sa
    // frappe — n'est qu'un appoint, borné par l'horloge de l'arbitre.
    validateAnswer(rt, value) {
      const n = Number(value);
      if (!Number.isFinite(n)) return SANS_ANNONCE;
      return Math.min(DUREE_COUPE * 1000, Math.max(0, n));
    },
    score(rt) {
      const results = new Map();
      const valeurs = [];
      let closest = null;

      for (const [pid, a] of rt.answers) {
        const valeur = coupeDuJoueur(rt, a);
        valeurs.push(valeur);
        const palier = palierEstimation(valeur, rt.target, 'proportion');
        const exact = valeur === rt.target;
        results.set(pid, {
          base: palier.points,
          bonusExact: exact ? BONUS_EXACTITUDE : 0,
          speed: 0,
          correct: estUneReussite(palier.nom),
          palier: palier.nom,
          exact,
          // LA COUPE RETENUE, envoyée au joueur avec son résultat : son écran ne
          // peut pas la recalculer, c'est l'arbitre qui l'a arrêtée.
          valeur,
        });
        if (closest === null || Math.abs(valeur - rt.target) < Math.abs(closest - rt.target)) closest = valeur;
      }

      const plages = plagesEstimation(rt.target, 'proportion');
      const margeBareme = Math.max(0, ...plages.map((p) => p.haut - rt.target));
      valeurs.sort((a, b) => a - b);
      const avg = valeurs.length ? Math.round(valeurs.reduce((s2, v) => s2 + v, 0) / valeurs.length) : null;
      const median = valeurs.length ? valeurs[Math.floor(valeurs.length / 2)] : null;

      const stats = {
        kind: 'numeric',
        unite: 'pourcent',
        total: valeurs.length,
        avg,
        median,
        closest,
        target: rt.target,
        histogramme: histogrammeBareme(valeurs, rt.target, plages, margeBareme),
        plages,
        nature: 'proportion',
      };

      const classement = [...results.entries()]
        .map(([pid, r]) => ({ pid, valeur: r.valeur, ecart: Math.abs(r.valeur - rt.target) }))
        .sort((a, b) => a.ecart - b.ecart)
        .slice(0, CLASSEMENT_MANCHE);

      return {
        results,
        reveal: { type: 'coupe_buche', target: rt.target, text: rt.text, stats },
        prives: { classement },
      };
    },
  },

  vote: {
    // `scored` par défaut. Une question de la catégorie « Sondage » n'en
    // rapporte pas : on demande alors sincèrement à la salle, un seul tour,
    // personne ne marque — et c'est le runtime qui tranche, pas le type. La
    // catégorie décide, voir `voteRapporte`.
    meta: {
      type: 'vote', name: 'Vote', icon: 'bar-chart-2', color: 'info',
      scored: true, malus: false, vitesse: false,
      // Les onglets de la file de l'animateur, et les catégories que le Studio
      // propose. Déclarées ici pour que les deux surfaces lisent la même liste.
      categories: CATEGORIES_VOTE, categorieParDefaut: CATEGORIE_VOTE_PAR_DEFAUT,
      // La durée vient de la banque, et elle vaut POUR CHAQUE TOUR : un vote à
      // deux tours dure deux fois ce nombre.
      dureeS: null, dureeFixe: false,
    },
    buildRound(q) {
      const poll = !voteRapporte(q);
      return {
        type: 'vote',
        questionId: q.id,
        text: q.text,
        options: q.options,
        poll,
        scored: !poll,
        // DEUX TOURS POUR LE JEU, UN SEUL POUR LE SONDAGE. Un sondage n'a rien à
        // deviner : demander « que pense le cercle ? » après avoir demandé « que
        // penses-tu ? » sans jamais compter les points n'aurait aucun sens, et
        // doublerait la durée d'une question posée pour elle-même.
        tours: poll ? 1 : 2,
        tour: 1,
        durationMs: (q.durationSec || 15) * 1000,
      };
    },
    publicQuestion(rt) {
      return {
        type: 'vote',
        questionId: rt.questionId,
        text: rt.text,
        options: rt.options,
        // LE TOUR EN COURS, ET COMBIEN IL Y EN A. C'est ce qui fait écrire « Que
        // penses-tu ? » puis « Que pense le cercle ? » sur les trois surfaces. Le
        // joueur qui ignorerait à quel tour il répond jouerait à un autre jeu.
        tour: rt.tour,
        tours: rt.tours,
        // Le DÉCOMPTE du premier tour ne part pas : c'est la réponse.
      };
    },
    validateAnswer(rt, value) {
      const i = Number(value);
      return Number.isInteger(i) && i >= 0 && i < rt.options.length ? i : null;
    },
    score(rt) {
      const results = new Map();

      if (rt.poll) {
        // SONDAGE : pas de bonne réponse, pas de gagnant. Participation seule, et
        // la série n'est ni nourrie ni rompue (le runtime n'est pas noté).
        const tally = tallyOptions(rt, rt.options.length);
        const stats = { kind: 'options', options: rt.options, tally, total: rt.answers.size };
        for (const [pid] of rt.answers) results.set(pid, { base: 100, speed: 0, correct: null });
        return { results, reveal: { tally, options: rt.options, text: rt.text, poll: true, stats } };
      }

      // LES DEUX TOURS. Le premier a été mis de côté par le moteur au moment de
      // passer au second ; le second est celui qui vit encore dans `rt.answers`.
      // Le repli protège un cas qui ne devrait pas arriver — une manche révélée
      // avant son second tour : la sincérité tient alors lieu de pari, et
      // personne n'est lésé.
      const sincere = rt.answersTour1 || rt.answers;
      const pari = rt.answersTour1 ? rt.answers : new Map();

      const tallySincere = compterOptions(sincere, rt.options.length);
      const tallyPari = compterOptions(pari, rt.options.length);
      // LA BONNE RÉPONSE EST CELLE DU PREMIER TOUR : ce que le cercle pense
      // vraiment. Le second tour ne la fabrique pas, il la cherche.
      const gagnantes = optionsDeTete(tallySincere);

      for (const [pid, a] of pari) {
        const trouve = gagnantes.includes(a.value);
        results.set(pid, {
          // Base fixe, aucun complément de vitesse : on ne devine pas plus vite
          // ce que pense la salle, et récompenser la rapidité pousserait à
          // cliquer avant d'avoir lu. Aucune pénalité pour qui se trompe : mal
          // lire le cercle n'est pas une faute, c'est un pari perdu.
          base: trouve ? BASE_VOTE : 0,
          speed: 0,
          correct: trouve,
          // CE QUE LE JOUEUR AVAIT RÉPONDU SINCÈREMENT. Il ne sert pas au calcul :
          // il sert à l'écran et à la voix, qui distinguent « le cercle pense
          // comme toi » de « tu as su lire le cercle sans être d'accord ». Ce sont
          // deux moments très différents pour qui joue, et un seul mot les
          // séparerait mal.
          choixSincere: sincere.get(pid)?.value ?? null,
        });
      }

      const stats = {
        kind: 'options',
        options: rt.options,
        // `tally` reste LE décompte de référence — celui du premier tour, dont
        // sortent la bonne réponse et les phrases de plateau. Les écrans qui ne
        // connaissent pas les deux tours continuent donc d'afficher la vérité.
        tally: tallySincere,
        total: sincere.size,
        // ET LE SECOND TOUR À CÔTÉ, qui est l'histoire du jeu : le cercle
        // s'est-il reconnu ? Sans lui, la révélation ne dirait pas si la salle a
        // su se lire, c'est-à-dire ce qu'on vient de lui demander.
        pari: { tally: tallyPari, total: pari.size },
        deuxTours: true,
      };

      return {
        results,
        reveal: {
          tally: tallySincere, options: rt.options, text: rt.text,
          winners: gagnantes, stats,
        },
      };
    },
  },

  // ============================================================
  // « CACHE-CACHE » — neuf objets vus une fois, cinq questions
  // ============================================================
  // (les constantes et les aides de ce jeu sont déclarées avant `modules`, plus
  //  haut dans ce fichier)
  //
  // LE SEUL JEU DU PROJET QUI SE DÉROULE EN PLUSIEURS TEMPS. Une grille se
  // dévoile pendant trente-huit secondes, cinq questions suivent, puis cinq
  // réponses rendues une par une par l'animateur, et la grille entière pour finir.
  //
  // IL RÉUTILISE LE MÉCANISME DES TOURS DE « VOTE », qui existait déjà pour jouer
  // deux fenêtres dans une même manche. Le tour 1 est la GRILLE — une fenêtre de
  // trente-huit secondes où personne ne répond — et les tours 2 à 6 sont les cinq
  // questions. Rien de neuf dans le moteur pour ça ; il ne lui manquait que deux
  // choses, déclarées ici : une durée qui change d'un tour à l'autre, et le fait
  // que la fin d'une fenêtre N'ENCHAÎNE PAS toute seule.
  //
  // « Quand les joueurs ont répondu ou que le temps est écoulé pour une question,
  // c'est à l'animateur de lancer la question suivante. » Un jeu de mémoire dont
  // les questions s'enchaînent sans lui ne se commente pas.
  cache_cache: {
    meta: {
      type: 'cache_cache', name: 'Cache-cache', modes: Object.values(MODES).map((m) => (
        { cle: m.cle, nom: m.nom, sous: m.sous, difficile: !!m.difficile })), modeParDefaut: MODE_PAR_DEFAUT, icon: 'grid', color: 'info',
      scored: true, malus: false, vitesse: true,
      // Le dévoilement de la grille PLUS les cinq questions : c'est la manche entière.
      dureeS: (DUREE_GRILLE_MS + QUESTIONS_PAR_PARTIE * DUREE_QUESTION_MS) / 1000, dureeFixe: true,
      // La grille est tirée par le serveur au lancement : rien à préparer.
      direct: true,
      // LE MOTEUR LIT CES DEUX DRAPEAUX, et ne connaît pas ce jeu autrement.
      attendreLAnimateur: true,
      devoilementGrille: true,
      cases: CASES,
      questions: QUESTIONS_PAR_PARTIE,
      dureeGrilleMs: DUREE_GRILLE_MS,
      dureeQuestionMs: DUREE_QUESTION_MS,
      couleurs: COULEURS,
      // La courbe de rapidité de ce jeu — « un bonus de rapidité allant de 0 point
      // à 100 points, le chrono partant de 10sec jusqu'à 0, de 10sec à 9sec =
      // 100pts, et de 2sec à 0 = 0pt ».
      rapidite: RAPIDITE_CACHE,
      points: POINTS_CACHE,
    },
    buildRound(q) {
      // LE CONTENU MODÉRÉ VOYAGE AVEC LA QUESTION. Les gabarits et la banque
      // d'objets appartiennent au MODULE de l'animateur — ils sont rangés dans sa
      // banque, donc durables — et la console les joint au top de départ. Sans
      // eux, on retombe sur ceux du dépôt.
      // LE MODE VOYAGE AVEC LE TOP DE DÉPART, comme l'allure de « Coupe ta bûche ».
      // C'est une difficulté que l'animateur décide À L'ANTENNE, pas un réglage de
      // banque : même jeu, même modération, deux façons de le servir.
      const tirage = tirerLaManche(Math.random, q?.contenu || {}, 40, q?.mode);
      // Un tirage impossible ne se rattrape pas : mieux vaut un refus net que
      // neuf cases dont deux portent le même nom. Il arrive quand la banque a été
      // modérée au point de ne plus offrir neuf noms en cinq couleurs.
      // LE REFUS NOMME LE MODE. « Tirage impossible » sur une banque sans image
      // noire envoyait l'animateur chercher du côté des questions ; le mode est la
      // première chose à vérifier.
      if (!tirage) throw new Error(`cache-cache : tirage impossible en mode ${modeDe(q?.mode).nom}`);
      return {
        type: 'cache_cache',
        questionId: q.id,
        mode: tirage.mode,
        text: 'Retiens ce que tu vois.',
        matrice: tirage.matrice,
        ordre: tirage.ordre,
        questions: tirage.questions,
        // La palette de CETTE banque : elle commande les boutons du joueur et la
        // correction. Voir `listeDeChoix`.
        couleurs: tirage.couleurs,
        // Le tour 1 est la grille ; les cinq suivants sont les questions.
        tours: 1 + QUESTIONS_PAR_PARTIE,
        tour: 1,
        devoilees: 0,
        durationMs: DUREE_GRILLE_MS,
      };
    },
    // LA DURÉE CHANGE D'UN TOUR À L'AUTRE — c'est la seule chose que le moteur ne
    // pouvait pas deviner.
    dureeDuTour(rt) {
      return rt.tour <= 1 ? DUREE_GRILLE_MS : DUREE_QUESTION_MS;
    },
    // ET L'ATTENTE AUSSI. Le dévoilement de la grille dure ce qu'il dure : rien à
    // commenter, rien à décider, la première question suit toute seule. C'est
    // ENTRE LES QUESTIONS que l'animateur reprend la main — « quand les joueurs
    // ont répondu ou que le temps est écoulé pour une question, c'est à
    // l'animateur de lancer la question suivante ».
    //
    // LE DÉFAUT QUE ÇA A COÛTÉ : le drapeau valant pour tous les tours, la manche
    // s'arrêtait à la fin des trente-huit secondes et n'allait jamais à la
    // première question. Le cercle regardait une grille vide, indéfiniment.
    attendLAnimateur(rt) {
      return (rt.tour || 1) > 1;
    },
    // LA QUESTION PUBLIQUE NE PORTE JAMAIS LA MATRICE. C'est tout le jeu : les
    // objets arrivent un par un, poussés par le serveur pendant le dévoilement, et
    // repartent aussitôt. Une charge utile qui les contiendrait rendrait la partie
    // lisible dans l'inspecteur avant même qu'elle commence.
    publicQuestion(rt) {
      const base = {
        type: 'cache_cache',
        questionId: rt.questionId,
        cases: CASES,
        mode: rt.mode,
        tour: rt.tour,
        tours: rt.tours,
      };
      if (rt.tour <= 1) {
        return { ...base, phase: 'grille', text: 'Retiens ce que tu vois.', dureeGrilleMs: DUREE_GRILLE_MS };
      }
      const q = rt.questions[rt.tour - 2];
      return {
        ...base,
        phase: 'question',
        numero: rt.tour - 1,
        // `nbQuestions` ET PAS `total` : le moteur pose SON `total` — le nombre de
        // manches de la partie — juste après avoir étalé la question publique, et
        // il écrasait celui-ci. L'écran affichait « Question 1/1 ».
        nbQuestions: QUESTIONS_PAR_PARTIE,
        text: q.texte,
        // DEUX LISTES DE CHOIX, ET LE RESTE SE TAPE. Les couleurs pour deux
        // formes, les neuf numéros pour celle qui demande une case.
        options: listeDeChoix(q.forme, rt),
        saisie: !FORMES[q.forme].choix,
      };
    },
    // CE QUE LE JOUEUR A RÉPONDU, ÉCRIT COMME IL LE LIRA.
    //
    // CE QUI A ÉTÉ DEMANDÉ : « lors du dévoilement des réponses, il faut rajouter
    // la réponse qu'a donnée le joueur lorsqu'il n'a pas la bonne réponse ».
    //
    // Une réponse est stockée soit comme un INDICE dans la liste de choix, soit
    // comme le texte tapé. Le premier ne veut rien dire à l'écran — « 3 » — et
    // c'est le serveur qui sait dans quelle liste le lire, puisque c'est lui qui
    // l'a envoyée. Traduire côté joueur reviendrait à lui faire deviner la
    // palette de la banque modérée ; il s'est déjà trompé une fois là-dessus.
    reponseDonnee(rt, tour, pid) {
      const q = rt.questions?.[tour - 2];
      const a = q ? reponseDuTour(rt, tour, pid) : null;
      if (!a) return null;
      const liste = listeDeChoix(q.forme, rt);
      if (liste) return liste[a.value] ?? null;
      const texte = String(a.value ?? '').trim();
      return texte || null;
    },
    validateAnswer(rt, value) {
      if (rt.tour <= 1) return null; // on ne répond pas pendant la grille
      const q = rt.questions[rt.tour - 2];
      // MÊME PALETTE QU'À L'AFFICHAGE. Une banque à six couleurs proposerait six
      // boutons et n'en accepterait que cinq : le sixième serait refusé en
      // silence, et le joueur ne saurait pas pourquoi sa réponse n'est pas partie.
      const liste = listeDeChoix(q.forme, rt);
      if (liste) {
        const i = Number(value);
        return Number.isInteger(i) && i >= 0 && i < liste.length ? i : null;
      }
      const texte = String(value == null ? '' : value).slice(0, 40).trim();
      return texte.length ? texte : null;
    },
    score(rt) {
      const results = new Map();
      const detail = new Map();   // pid -> [points par question]
      const parQuestion = rt.questions.map(() => ({ bons: 0, total: 0 }));

      for (const pid of joueursDeLaManche(rt)) {
        const points = rt.questions.map((q, i) => {
          const a = reponseDuTour(rt, i + 2, pid);
          if (!a) return { repondu: false, correct: false, base: 0, speed: 0 };
          parQuestion[i].total += 1;
          const correct = questionReussie(q, a.value, rt);
          if (correct) parQuestion[i].bons += 1;
          const reste = DUREE_QUESTION_MS - Math.min(DUREE_QUESTION_MS, Math.max(0, a.at - (rt.debutsDeTour?.[i + 2] ?? rt.startedAt)));
          return {
            repondu: true,
            correct,
            base: correct ? POINTS_CACHE : 0,
            speed: correct ? bonusRapidite(reste, RAPIDITE_CACHE) : 0,
          };
        });
        detail.set(pid, points);
        const base = points.reduce((n, p) => n + p.base, 0);
        const speed = points.reduce((n, p) => n + p.speed, 0);
        results.set(pid, {
          base,
          speed,
          correct: points.some((p) => p.correct),
          bons: points.filter((p) => p.correct).length,
          rates: points.filter((p) => p.repondu && !p.correct).length,
        });
      }

      const classement = [...results.entries()]
        .map(([pid, r]) => ({ pid, points: (detail.get(pid) || []).map((p) => p.base + p.speed), total: r.base + r.speed }))
        .sort((a, b) => b.total - a.total)
        .slice(0, CLASSEMENT_CACHE);

      const stats = {
        kind: 'cache',
        total: [...results.keys()].length,
        // LA MATRICE PORTE SES ADRESSES. Le client ne déduit JAMAIS une adresse
        // d'un identifiant — même règle que les visages et les objets : le jour où
        // la banque change de nommage, il n'y a qu'un endroit à corriger.
        matrice: rt.matrice.map((o) => ({ ...o, src: o.src || srcDObjet(o.id) })),
        questions: rt.questions.map((q, i) => ({
          texte: q.texte, reponse: q.reponse, place: q.place,
          bons: parQuestion[i].bons, repondants: parQuestion[i].total,
        })),
      };
      return {
        results,
        detail,
        reveal: { type: 'cache_cache', text: rt.text, matrice: rt.matrice, stats },
        prives: { classement },
      };
    },
  },

  // =========================================================================
  // « CUEILLETTE » — LE JOUEUR NE RÉPOND PAS, IL PRODUIT
  // =========================================================================
  //
  // CE QUI A ÉTÉ DEMANDÉ (16/09) : « un dessin va apparaître 10 secondes à l'écran
  // puis disparaître, les joueurs auront alors 30 secondes pour dessiner le dessin
  // qu'ils viennent de voir le plus exactement possible. Les gagnants sont ceux qui
  // auront produit un dessin le plus ressemblant au dessin cible. »
  //
  // CE QUI REND CE JEU DIFFÉRENT DE TOUS LES AUTRES DU PROJET. Partout ailleurs, la
  // réponse d'un joueur est une valeur — un indice, un nombre, un mot — et le
  // barème la compare à une bonne réponse. Ici la réponse est un DESSIN, il n'y a
  // pas de bonne réponse, et la note est une estimation. Tout le calcul vit dans
  // `cueillette.js`, à côté de ses contrôles ; ce module ne fait que dérouler la
  // manche et verser les points.
  //
  // DEUX TEMPS DANS UNE SEULE MANCHE, comme la grille puis les questions de
  // « Cache-cache » : le tour 1 montre la cible dix secondes et n'accepte rien, le
  // tour 2 ouvre la fenêtre de dessin pour trente. Le moteur sait déjà enchaîner
  // des tours de durées différentes ; inventer ici un second mécanisme aurait fait
  // deux façons de compter le temps dans le même serveur.
  cueillette: {
    meta: {
      type: 'cueillette', name: 'Cueillette', icon: 'pencil', color: 'forest',
      scored: true, malus: false, vitesse: false,
      // Ce qui est dessiné à la fin du chrono compte, même sans avoir été envoyé
      // — voir `submitBrouillon` dans le moteur.
      brouillon: true,
      // Dix secondes de cible, puis trente de dessin.
      dureeS: (DUREE_CIBLE_MS + DUREE_DESSIN_MS) / 1000, dureeFixe: true,
      // Pas de banque écrite : la cible se choisit à l'antenne, dans la banque de
      // dessins du dépôt.
      direct: true,
      dureeCibleMs: DUREE_CIBLE_MS,
      dureeDessinMs: DUREE_DESSIN_MS,
      points: POINTS_CUEILLETTE,
      seuil: SEUIL_CUEILLETTE,
    },

    // LA BANQUE DE DESSINS EST HORS DE `meta`, ET CE N'EST PAS UN DÉTAIL DE
    // RANGEMENT. `meta` part À TOUT LE MONDE avec chaque manche — le moteur le
    // diffuse tel quel dans `module:started`, joueurs et stream compris. Les
    // dessins et leurs adresses y auraient voyagé deux fois par manche vers
    // chaque téléphone du salon, pour un écran qui n'en a aucun usage.
    //
    // Ils ne servent qu'à UN endroit : le panneau où l'animateur choisit sa cible.
    // Ils partent donc par `host:modules`, sur son canal, et nulle part ailleurs.
    //
    // LA BANQUE EST CELLE DU MODULE (26/09), modérée au Studio comme celle de
    // « Cache-cache » — voir `banqueDeCueillette`. Sans modération, ce sont les
    // cinquante dessins du dépôt.
    banqueDe(questions) {
      const dessins = banqueDeCueillette(questions, GRILLES_DESSINS);
      return {
        // SANS LA GRILLE : sept cents caractères par dessin, dont la console n'a
        // aucun usage. Elle ne quitte pas le serveur.
        dessins: dessins.map(({ grille, ...d }) => d),
        familles: famillesDe(dessins),
      };
    },

    buildRound(q) {
      // LA BANQUE VOYAGE AVEC LE TOP DE DÉPART, attachée par le serveur — jamais
      // reçue de l'écran (voir `host:startModule`). À défaut, celle du dépôt.
      const banque = Array.isArray(q?.banque) && q.banque.length
        ? q.banque
        : banqueDeCueillette(null, GRILLES_DESSINS);
      // LA CIBLE EST CELLE QUE L'ANIMATEUR A CHOISIE, et à défaut une au hasard :
      // un top de départ mal formé ne doit pas éteindre le jeu en direct.
      const choisi = banque.find((d) => d.id === q?.dessinId);
      const cible = choisi || banque[Math.floor(Math.random() * banque.length)];
      return {
        type: 'cueillette',
        questionId: q.id,
        text: 'Regarde bien…',
        cible: { id: cible.id, nom: cible.nom, famille: cible.famille, src: cible.src },
        // LA GRILLE DE COMPARAISON RESTE SUR LA MANCHE, HORS DE `cible` : la cible
        // part à tout le salon avec la révélation, et la grille n'a rien à y faire.
        grille: cible.grille,
        // Le tour 1 montre, le tour 2 fait dessiner.
        tours: 2,
        tour: 1,
        durationMs: DUREE_CIBLE_MS,
      };
    },

    // LA DURÉE CHANGE D'UN TOUR À L'AUTRE — la seule chose que le moteur ne
    // pouvait pas deviner.
    dureeDuTour(rt) {
      return rt.tour <= 1 ? DUREE_CIBLE_MS : DUREE_DESSIN_MS;
    },

    publicQuestion(rt) {
      const base = {
        type: 'cueillette',
        questionId: rt.questionId,
        tour: rt.tour,
        tours: rt.tours,
        dureeCibleMs: DUREE_CIBLE_MS,
        dureeDessinMs: DUREE_DESSIN_MS,
      };
      // PENDANT LE TOUR 1, LA CIBLE EST VISIBLE — c'est tout l'objet du tour.
      if (rt.tour <= 1) {
        return {
          ...base, phase: 'cible', text: 'Regarde bien…',
          cible: { src: rt.cible.src, nom: rt.cible.nom },
        };
      }
      // PENDANT LE TOUR 2, ELLE DISPARAÎT — ET SON ADRESSE AUSSI. La laisser dans
      // la charge utile mettrait l'image à un clic dans l'inspecteur du navigateur,
      // et le jeu consiste exactement à ne plus l'avoir sous les yeux.
      return { ...base, phase: 'dessin', text: 'À toi de dessiner !', saisie: true };
    },

    // UNE RÉPONSE EST UN DESSIN, et le serveur ne fait confiance à rien de ce qu'il
    // reçoit : bornes, élagage, rejet de ce qui ne se lit pas (voir `nettoyerDessin`).
    validateAnswer(rt, value) {
      if (rt.tour <= 1) return null;          // on ne dessine pas pendant la cible
      const propre = nettoyerDessin(value);
      return compterPoints(propre) ? propre : null;
    },

    score(rt) {
      const results = new Map();
      const dessins = [];
      // LES VINGT TRANCHES DE CINQ POUR CENT que l'écran demande, préparées ici :
      // « le graphique va de 0 % à 100 % et les résultats sont répartis par tranche
      // de 5 %, il doit donc y avoir 20 tranches ».
      const tranches = Array.from({ length: 20 }, (_, i) => (
        { bas: i * 5, haut: (i + 1) * 5, count: 0 }
      ));

      for (const [pid, a] of rt.answers) {
        // LA CIBLE EST UNE IMAGE : on la compare par sa grille, posée sur la
        // manche au départ.
        const position = rt.grille;
        const { pourcent } = position
          ? ressemblanceContreGrilles(position, a.value)
          : { pourcent: 0 };
        const base = pointsDuDessin(pourcent);
        results.set(pid, { base, speed: 0, correct: base > 0, pourcent });
        tranches[Math.min(19, Math.floor(pourcent / 5))].count += 1;
        dessins.push({ pid, pourcent, points: base, traits: a.value });
      }

      const notes = [...results.values()].map((r) => r.pourcent);
      const stats = {
        kind: 'cueillette',
        total: results.size,
        tranches,
        meilleur: notes.length ? Math.max(...notes) : 0,
        moyenne: notes.length ? Math.round(notes.reduce((x, y) => x + y, 0) / notes.length) : 0,
      };

      return {
        results,
        reveal: { type: 'cueillette', text: rt.cible.nom, cible: rt.cible, stats },
        // LES DESSINS ET LES NOMS NE PARTENT QU'À L'ANIMATEUR. « L'animateur a de
        // son côté un accès total à tous les dessins des joueurs » — de SON côté.
        // Les pseudonymes n'ont jamais quitté son canal dans ce projet, et ce n'est
        // pas un jeu de dessin qui va les y faire entrer.
        prives: { dessins },
      };
    },
  },
};

export const MODULE_TYPES = Object.keys(modules);

// Banque de questions embarquée (seed) — permet une partie complète sans Studio.
// 20+ questions par module (retour produit du 2026-08-18).
export const demoQuestions = {
  quiz: [
    { id: 'q-ocean', text: 'Quel est le plus grand océan ?', options: ['Atlantique', 'Indien', 'Pacifique', 'Arctique'], correctIndex: 2, durationSec: 15 },
    { id: 'q-montagne', text: "Quelle est la plus haute montagne d'Europe ?", options: ['Mont Blanc', 'Elbrouz', 'Cervin', 'Etna'], correctIndex: 1, durationSec: 20 },
    { id: 'q-australie', text: "Quelle est la capitale de l'Australie ?", options: ['Sydney', 'Canberra', 'Melbourne', 'Perth'], correctIndex: 1, durationSec: 15 },
    { id: 'q-vangogh', text: 'Quel peintre a réalisé « La Nuit étoilée » ?', options: ['Monet', 'Van Gogh', 'Picasso', 'Dalí'], correctIndex: 1, durationSec: 15 },
    { id: 'q-foot11', text: "Combien de joueurs d'une équipe de football sont sur le terrain ?", options: ['9', '10', '11', '12'], correctIndex: 2, durationSec: 12 },
    { id: 'q-loire', text: 'Quel est le plus long fleuve entièrement situé en France ?', options: ['La Seine', 'Le Rhône', 'La Loire', 'La Garonne'], correctIndex: 2, durationSec: 15 },
    { id: 'q-mars', text: 'Quelle planète est surnommée « la planète rouge » ?', options: ['Vénus', 'Mars', 'Jupiter', 'Saturne'], correctIndex: 1, durationSec: 10 },
    { id: 'q-hugo', text: 'Qui a écrit « Les Misérables » ?', options: ['Émile Zola', 'Victor Hugo', 'Honoré de Balzac', 'Gustave Flaubert'], correctIndex: 1, durationSec: 15 },
    { id: 'q-azote', text: "Quel gaz compose majoritairement l'air que nous respirons ?", options: ['Oxygène', 'Azote', 'Dioxyde de carbone', 'Hydrogène'], correctIndex: 1, durationSec: 15 },
    { id: 'q-hexagone', text: 'Combien de côtés possède un hexagone ?', options: ['5', '6', '7', '8'], correctIndex: 1, durationSec: 10 },
    { id: 'q-yen', text: 'Quelle est la monnaie du Japon ?', options: ['Le yuan', 'Le won', 'Le yen', 'Le ringgit'], correctIndex: 2, durationSec: 12 },
    { id: 'q-coeur', text: 'Quel organe pompe le sang dans le corps humain ?', options: ['Le foie', 'Le cœur', 'Le poumon', 'Le rein'], correctIndex: 1, durationSec: 10 },
    { id: 'q-1914', text: 'En quelle année la Première Guerre mondiale a-t-elle éclaté ?', options: ['1912', '1914', '1916', '1918'], correctIndex: 1, durationSec: 15 },
    { id: 'q-sahara', text: 'Quel est le plus grand désert chaud du monde ?', options: ['Le Gobi', 'Le Kalahari', 'Le Sahara', "L'Atacama"], correctIndex: 2, durationSec: 15 },
    { id: 'q-joconde', text: 'Qui a peint la Joconde ?', options: ['Michel-Ange', 'Raphaël', 'Léonard de Vinci', 'Botticelli'], correctIndex: 2, durationSec: 12 },
    { id: 'q-jo', text: 'Dans quel pays les Jeux olympiques antiques sont-ils nés ?', options: ['En Italie', 'En Grèce', 'En Égypte', 'En Chine'], correctIndex: 1, durationSec: 15 },
    { id: 'q-mandarin', text: 'Quelle langue compte le plus de locuteurs natifs au monde ?', options: ["L'anglais", "L'espagnol", 'Le mandarin', "L'hindi"], correctIndex: 2, durationSec: 15 },
    { id: 'q-piano36', text: 'Combien de touches noires possède un piano standard ?', options: ['30', '36', '42', '48'], correctIndex: 1, durationSec: 20 },
    { id: 'q-oxygene', text: 'Quel élément chimique a pour symbole « O » ?', options: ["L'or", "L'osmium", "L'oxygène", "L'étain"], correctIndex: 2, durationSec: 12 },
    { id: 'q-mediterranee', text: 'Quelle mer borde la ville de Marseille ?', options: ['La Manche', 'La Méditerranée', "L'Adriatique", 'La Baltique'], correctIndex: 1, durationSec: 12 },
    { id: 'q-faucon', text: "Quel est l'animal le plus rapide du monde ?", options: ['Le guépard', 'Le faucon pèlerin', "L'antilope", "L'espadon"], correctIndex: 1, durationSec: 15 },
    { id: 'q-foot90', text: 'Combien de minutes dure un match de football (temps réglementaire) ?', options: ['80', '90', '100', '120'], correctIndex: 1, durationSec: 10 },
  ],
  true_false: [
    { id: 'tf-soleil', text: 'Le Soleil est une étoile.', correct: true, durationSec: 10 },
    { id: 'tf-muraille', text: "La Grande Muraille de Chine est visible à l'œil nu depuis la Lune.", correct: false, durationSec: 12 },
    { id: 'tf-autruche', text: 'Les autruches peuvent voler.', correct: false, durationSec: 10 },
    { id: 'tf-nil', text: "Le Nil traverse l'Égypte.", correct: true, durationSec: 10 },
    { id: 'tf-ebullition', text: "Au niveau de la mer, l'eau bout à 90 °C.", correct: false, durationSec: 12 },
    { id: 'tf-seine', text: 'Paris est traversée par la Seine.', correct: true, durationSec: 8 },
    { id: 'tf-bissextile', text: 'Une année bissextile compte 365 jours.', correct: false, durationSec: 12 },
    { id: 'tf-requin', text: 'Le requin est un mammifère.', correct: false, durationSec: 10 },
    { id: 'tf-photosynthese', text: "La photosynthèse produit de l'oxygène.", correct: true, durationSec: 12 },
    { id: 'tf-mozart', text: 'Mozart était un compositeur français.', correct: false, durationSec: 10 },
    { id: 'tf-os206', text: "Le corps humain adulte compte 206 os.", correct: true, durationSec: 12 },
    { id: 'tf-belgique', text: "La Belgique partage une frontière avec l'Espagne.", correct: false, durationSec: 10 },
    { id: 'tf-tomate', text: 'Botaniquement, la tomate est un fruit.', correct: true, durationSec: 12 },
    { id: 'tf-everest', text: "Le mont Everest est le plus haut sommet du monde.", correct: true, durationSec: 10 },
    { id: 'tf-planetes8', text: 'Le Système solaire compte 8 planètes.', correct: true, durationSec: 12 },
    { id: 'tf-chauvesouris', text: 'Les chauves-souris sont aveugles.', correct: false, durationSec: 12 },
    { id: 'tf-miel', text: 'Le miel peut se conserver des années sans périmer.', correct: true, durationSec: 12 },
    { id: 'tf-lumiere', text: "La vitesse de la lumière est d'environ 300 000 km par heure.", correct: false, durationSec: 15 },
    { id: 'tf-amazone', text: "L'Amazone est un fleuve d'Afrique.", correct: false, durationSec: 10 },
    { id: 'tf-octet', text: 'Un octet contient 8 bits.', correct: true, durationSec: 10 },
    { id: 'tf-manchots', text: "Les manchots vivent principalement dans l'hémisphère Sud.", correct: true, durationSec: 12 },
  ],
  estimation: [
    { id: 'es-tourEiffel', text: 'Hauteur de la Tour Eiffel en mètres ?', target: 330, durationSec: 20 },
    { id: 'es-communes', text: 'Combien de communes compte la France (environ) ?', target: 35000, durationSec: 20 },
    { id: 'es-gutenberg', text: "En quelle année Gutenberg a-t-il mis au point l'imprimerie (environ) ?", target: 1450, durationSec: 20 },
    { id: 'es-montblanc', text: 'Altitude du mont Blanc en mètres ?', target: 4806, durationSec: 20 },
    { id: 'es-onu', text: "Combien de pays sont membres de l'ONU ?", target: 193, durationSec: 20 },
    { id: 'es-lune', text: 'Distance moyenne Terre-Lune en kilomètres ?', target: 384400, durationSec: 20 },
    { id: 'es-os', text: "Combien d'os compte le corps humain adulte ?", target: 206, durationSec: 15 },
    { id: 'es-berlin', text: 'En quelle année le mur de Berlin est-il tombé ?', target: 1989, durationSec: 15 },
    { id: 'es-marathon', text: "Longueur officielle d'un marathon en mètres ?", target: 42195, durationSec: 20 },
    { id: 'es-france', text: 'Population de la France en millions d\'habitants (environ) ?', target: 68, durationSec: 15 },
    { id: 'es-piano', text: 'Combien de touches possède un piano standard ?', target: 88, durationSec: 15 },
    { id: 'es-son', text: "Vitesse du son dans l'air en km/h (environ) ?", target: 1235, durationSec: 20 },
    { id: 'es-lumiere1895', text: 'En quelle année les frères Lumière ont-ils projeté leur premier film ?', target: 1895, durationSec: 20 },
    { id: 'es-departements', text: 'Combien de départements compte la France (métropole + outre-mer) ?', target: 101, durationSec: 15 },
    { id: 'es-cartes', text: 'Combien de cartes dans un jeu de 52 cartes avec ses 2 jokers ?', target: 54, durationSec: 10 },
    { id: 'es-mariannes', text: 'Profondeur de la fosse des Mariannes en mètres (environ) ?', target: 11000, durationSec: 20 },
    { id: 'es-iphone', text: 'En quelle année le premier iPhone est-il sorti ?', target: 2007, durationSec: 15 },
    { id: 'es-languesonu', text: "Combien de langues officielles à l'ONU ?", target: 6, durationSec: 15 },
    { id: 'es-soleil', text: 'Température de surface du Soleil en °C (environ) ?', target: 5500, durationSec: 20 },
    { id: 'es-marches', text: "Combien de marches pour monter au sommet de la Tour Eiffel ?", target: 1665, durationSec: 20 },
    { id: 'es-napoleon', text: 'En quelle année est né Napoléon Bonaparte ?', target: 1769, durationSec: 20 },
  ],
  vote: [
    { id: 'vo-saison', text: 'Meilleure saison ?', options: ['Printemps', 'Été', 'Automne', 'Hiver'], durationSec: 15 },
    { id: 'vo-matin', text: 'Plutôt quoi le matin ?', options: ['Thé', 'Café', 'Chocolat', 'Rien'], durationSec: 12 },
    { id: 'vo-repas', text: 'Le meilleur repas ?', options: ['Pizza', 'Burger', 'Sushi', 'Raclette'], durationSec: 15 },
    { id: 'vo-vacances', text: 'Vacances idéales ?', options: ['Plage', 'Montagne', 'Ville', 'Campagne'], durationSec: 15 },
    { id: 'vo-animal', text: 'Chien ou chat ?', options: ['Chien', 'Chat', 'Les deux', 'Aucun'], durationSec: 12 },
    { id: 'vo-rythme', text: 'Plutôt matin ou soir ?', options: ['Lève-tôt', 'Couche-tard', 'Les deux', 'Ni l\'un ni l\'autre'], durationSec: 12 },
    { id: 'vo-pouvoir', text: 'Le meilleur super-pouvoir ?', options: ['Voler', 'Invisibilité', 'Téléportation', 'Lire les pensées'], durationSec: 15 },
    { id: 'vo-dessert', text: 'Le dessert ultime ?', options: ['Tiramisu', 'Crêpes', 'Mousse au chocolat', 'Tarte au citron'], durationSec: 15 },
    { id: 'vo-soiree', text: 'Cinéma ou canapé ?', options: ['Cinéma', 'Canapé', 'Les deux', 'Théâtre'], durationSec: 12 },
    { id: 'vo-pire', text: 'Le pire au quotidien ?', options: ['Les bouchons', 'Les réunions', 'Les pubs', 'Le lundi matin'], durationSec: 15 },
    { id: 'vo-gout', text: 'Sucré ou salé ?', options: ['Sucré', 'Salé', 'Les deux', 'Ça dépend'], durationSec: 12 },
    { id: 'vo-boisson', text: 'Votre boisson de soirée ?', options: ['Soda', 'Jus de fruits', 'Eau pétillante', 'Cocktail'], durationSec: 12 },
    { id: 'vo-console', text: 'La meilleure plateforme de jeu ?', options: ['PlayStation', 'Xbox', 'Switch', 'PC'], durationSec: 15 },
    { id: 'vo-accompagnement', text: 'Frites ou purée ?', options: ['Frites', 'Purée', 'Gratin', 'Riz'], durationSec: 12 },
    { id: 'vo-musique', text: 'De la musique en travaillant ?', options: ['Toujours', 'Jamais', 'Parfois', 'Plutôt un podcast'], durationSec: 12 },
    { id: 'vo-baignade', text: 'Plutôt mer ou piscine ?', options: ['Mer', 'Piscine', 'Lac', 'Aucun'], durationSec: 12 },
    { id: 'vo-plateforme', text: 'Votre plateforme préférée ?', options: ['Twitch', 'YouTube', 'TikTok', 'Instagram'], durationSec: 15 },
    { id: 'vo-ananas', text: "L'ananas sur la pizza ?", options: ['Pour', 'Contre', 'Indifférent', 'Jamais goûté'], durationSec: 12 },
    { id: 'vo-film', text: 'Votre film du soir ?', options: ['Comédie', 'Action', 'Horreur', 'Documentaire'], durationSec: 15 },
    { id: 'vo-petitdej', text: 'Le meilleur petit-déjeuner ?', options: ['Croissant', 'Tartines', 'Œufs', 'Céréales'], durationSec: 12 },
    { id: 'vo-fin', text: 'Fromage ou dessert ?', options: ['Fromage', 'Dessert', 'Les deux', 'Aucun'], durationSec: 12 },
  ],
};
