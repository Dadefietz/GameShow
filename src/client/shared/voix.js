// LA VOIX DU JEU — registre unique de tout ce que le jeu dit au-delà des faits.
//
// Pourquoi ce fichier existe. Le jeu était juste et froid : aux moments où le
// joueur ressent quelque chose — il vient de trouver, il vient de se planter, il
// grimpe de six places — l'application lui répondait par un tableau de chiffres.
//
// TROIS STRATES :
//   - la voix INTIME, sur le téléphone du joueur : ce qui vient de t'arriver, à
//     toi. Elle peut taquiner, parce que personne d'autre ne la lit ;
//   - la voix de PLATEAU, sur le stream : ce qui vient d'arriver au groupe. Elle
//     ne parle que du collectif, JAMAIS d'un joueur nommé — sauf au podium, où
//     c'est pour célébrer ;
//   - la CONVENTION, ci-dessous, qui fait survivre le dispositif aux évolutions.
//
// RÈGLE ÉDITORIALE MAÎTRESSE : on peut taquiner en privé, jamais en public.
// L'écran du joueur n'est vu que par lui ; le stream est vu par tout le monde et
// affiche les noms. Personne ne doit se faire chambrer devant l'audience par une
// machine.
//
// DEUX AUTRES RÈGLES, tenues par le contrôle automatique (tests/unit/voix.test.js) :
//   - jamais de phrase qui CONTREDIT les chiffres affichés à côté. Chaque moment
//     est attaché à une condition vérifiée sur les données réelles, jamais à une
//     ambiance générale ;
//   - une ligne, deux au maximum. Un écran de résultat dure quelques secondes :
//     une phrase de trois lignes ne sera jamais lue.
//
// CONVENTION POUR LA SUITE (AGENTS.md [VOIX]) : toute nouvelle surface et tout
// nouveau type de jeu déclare ses moments ici. Le contrôle échoue sinon — il
// exige une DÉCLARATION, pas une œuvre : une phrase de repli suffit à passer.

// Surfaces qui parlent. Doit correspondre aux routes de src/client/main.jsx :
// une route ajoutée sans entrée ici fait échouer le contrôle.
export const SURFACES = ['play', 'host', 'overlay', 'studio'];

// Longueur maximale d'une phrase, en caractères. Calée sur le temps de lecture
// d'un écran de résultat, pas sur une esthétique.
export const LONGUEUR_MAX = 120;

// ============================================================
// LES MOMENTS
// `quand` documente la condition RÉELLE qui déclenche le moment — c'est ce qui
// empêche une phrase de mentir.
// ============================================================
export const MOMENTS = {
  // ---------- VOIX INTIME : l'attente ----------
  'attente.seul': {
    surface: 'play',
    quand: 'le joueur est le seul dans le salon',
    rotation: true,
    phrases: [
      'Tu es arrivé le premier. Tu choisis ta place.',
      "Il n'y a que toi et les braises.",
      'Le feu part doucement. Comme toujours.',
      'Quelqu’un finira bien par sentir la fumée.',
      'Rien ne presse. Le bois est sec.',
      'Le cercle est vide. Ça ne durera pas.',
      'Tu gardes le feu. C’est une responsabilité.',
      'Personne à qui parler, personne à qui mentir.',
      'Profite : dans deux minutes, il y aura du monde.',
      'Le silence avant les rires. On y est.',
    ],
  },
  'attente.accompagne': {
    surface: 'play',
    quand: 'au moins deux joueurs sont connectés',
    rotation: true,
    phrases: [
      'Le cercle est formé. Il manque juste le signal.',
      'Tout le monde est assis. Personne n’ose commencer.',
      'Tu as encore le temps de préparer une excuse.',
      'Ça sent le bois et la compétition.',
      'Les places sont prises. Le feu attend.',
      'Quelqu’un a forcément révisé. Ce n’est pas toi.',
      'On y est presque. Respire.',
      'Le plus dur, c’est d’attendre.',
    ],
  },

  // ---------- VOIX INTIME : la manche ----------
  'reponse.envoyee': {
    surface: 'play',
    quand: 'la réponse est enregistrée, la manche n’est pas révélée',
    phrases: [
      'C’est parti. On verra bien.',
      'Ta réponse est au chaud.',
      'Enregistré. Plus qu’à attendre.',
      'Voilà. Trop tard pour changer d’avis.',
      'Reçu. Croise les doigts si tu veux.',
      'Ta voix est dans le pot commun.',
    ],
  },
  'temps.ecoule': {
    surface: 'play',
    quand: 'le chrono est tombé sans réponse du joueur',
    phrases: [
      'Le temps a filé. Ça arrive.',
      'Rien envoyé cette fois. La prochaine est à toi.',
      'Trop tard — mais ça ne coûte rien.',
      'Manche blanche. On repart entier.',
    ],
  },
  'juste.simple': {
    surface: 'play',
    quand: 'bonne réponse, sans supplément de rapidité ni série',
    phrases: [
      'Bien vu.',
      'C’était ça.',
      'Solide.',
      'Tu savais. Ça se voit.',
      'Propre.',
      'Sans trembler.',
      'Exactement ça.',
      'Tranquille.',
    ],
  },
  'juste.plus-rapide': {
    surface: 'play',
    quand: 'bonne réponse ET plus rapide de la manche (speed inclut le supplément)',
    phrases: [
      'Le plus rapide du cercle. Personne n’a vu passer ta main.',
      'Premier, et juste. Ça ne s’improvise pas.',
      'Tu as répondu avant que les autres finissent de lire.',
      'Le doigt plus vite que la pensée — sauf que c’était bon.',
      'Réflexe de braconnier.',
    ],
  },
  'juste.serie': {
    surface: 'play',
    quand: 'bonne réponse ET série de 2 ou plus',
    requiert: ['serie'],
    phrases: [
      '{serie} d’affilée. Tu commences à faire peur.',
      'Toujours pas fautif. {serie} de suite.',
      '{serie} bonnes réponses enchaînées. On te regarde.',
      'La série tient. {serie} et ça continue.',
      '{serie} d’affilée : quelqu’un devrait t’arrêter.',
    ],
  },
  faux: {
    surface: 'play',
    quand: 'mauvaise réponse (aucune pénalité : zéro point, pas moins)',
    phrases: [
      'Raté — mais ça ne coûte rien.',
      'Pas cette fois. Rien de perdu.',
      'À côté. La prochaine est neuve.',
      'Non. On efface et on repart.',
      'Manqué. Personne n’a rien vu.',
      'Ce n’était pas ça. Ça arrive aux meilleurs.',
      'Zéro pointé, zéro dégât.',
    ],
  },

  // Repli quand le joueur a répondu mais que le résultat n'est pas encore arrivé
  // — reconnexion en cours, ou manche pas encore révélée.
  'resultat.attente': {
    surface: 'play',
    quand: 'le joueur a répondu, son résultat n’est pas encore arrivé',
    phrases: [
      'Ta réponse est bien partie. On attend le verdict.',
      'C’est enregistré. Le résultat arrive.',
      'Tout est en ordre de ton côté.',
      'Patience : la manche se termine.',
    ],
  },
  // Repli pour le joueur ARRIVÉ APRÈS le lancement. La décision 11 est explicite :
  // jamais d'écran muet, même dans les cas limites.
  'manche.sans-toi': {
    surface: 'play',
    quand: 'le joueur n’a pas participé à cette manche (arrivé après le lancement)',
    phrases: [
      'Celle-là s’est jouée sans toi. La prochaine est à toi.',
      'Tu arrives : le cercle avait déjà commencé.',
      'Manche manquée, soirée intacte.',
      'Rien de perdu — tu entres maintenant.',
    ],
  },

  // ---------- VOIX INTIME : les places ----------
  'places.gagnees': {
    surface: 'play',
    quand: 'placesDelta > 0',
    requiert: ['places'],
    phrases: [
      '{places} de gagnées. Continue comme ça.',
      'Tu remontes de {places}. Ça se sent.',
      '{places} places grignotées.',
      '{places} de plus au compteur des places.',
      'Ça monte : {places} de gagnées.',
    ],
  },
  'places.perdues': {
    surface: 'play',
    quand: 'placesDelta < 0',
    phrases: [
      'Les autres avancent. Toi aussi, bientôt.',
      'Ça bouscule derrière. Rien d’irréversible.',
      'Un peu de terrain perdu. Le feu brûle encore.',
      'Le cercle se resserre autour de toi.',
      'Ça bouge devant. Rien n’est joué.',
    ],
  },

  // ---------- VOIX INTIME : estimation, par palier ----------
  'estimation.mille': {
    surface: 'play',
    quand: 'palier « mille » : à 2 % de la cible, ou à une unité près',
    phrases: [
      'Dans le mille. Presque suspect.',
      'Tu as visé juste au chiffre près.',
      'Exact, ou tout comme.',
      'Personne ne fait mieux que ça.',
      'Pile. Sans hésiter.',
    ],
  },
  'estimation.proche': {
    surface: 'play',
    quand: 'palier « proche » : à 10 % de la cible',
    phrases: [
      'Tout près. Bien vu.',
      'À un cheveu. Solide.',
      'Presque pile. On prend.',
      'Tu avais l’ordre de grandeur et la finesse.',
      'Belle visée.',
      'Pas loin du tout.',
    ],
  },
  'estimation.correct': {
    surface: 'play',
    quand: 'palier « correct » : à 20 % de la cible',
    phrases: [
      'Dans la bonne zone.',
      'Pas mal visé.',
      'L’ordre de grandeur y est.',
      'Correct, sans être chirurgical.',
      'Tu n’étais pas perdu.',
      'La direction était bonne.',
    ],
  },
  'estimation.loin': {
    surface: 'play',
    quand: 'palier « loin » : à 30 % de la cible',
    phrases: [
      'Un peu large, mais tu y étais.',
      'Pas tout à fait. L’idée était là.',
      'Ça s’éloigne — sans se perdre.',
      'Tu visais le bon continent.',
      'Généreux dans l’estimation.',
    ],
  },
  'estimation.hors': {
    surface: 'play',
    quand: 'au-delà de 30 % : zéro point',
    phrases: [
      'Là, on est loin. Vraiment loin.',
      'Autre ordre de grandeur. Ça arrive.',
      'Complètement à côté — et ça ne coûte rien.',
      'On ne parlait peut-être pas de la même chose.',
      'Hardi, mais non.',
    ],
  },

  // ---------- VOIX INTIME : vote ----------
  'vote.majorite': {
    surface: 'play',
    quand: 'vote noté, le joueur est dans un camp gagnant',
    phrases: [
      'Avec la salle. Tu la lis bien.',
      'Majoritaire. Tu sais où souffle le vent.',
      'Le groupe pensait comme toi.',
      'Tu as senti le cercle.',
      'Dans le camp le plus fourni.',
      'Bien vu : la salle t’a suivi.',
    ],
  },
  'vote.minorite': {
    surface: 'play',
    quand: 'vote noté, le joueur est minoritaire',
    phrases: [
      'Seul contre le cercle. Ça a du panache.',
      'Le groupe en a décidé autrement. Aucun point retiré.',
      'À contre-courant. Ce n’est pas une faute.',
      'Tu avais peut-être raison. Ça ne compte juste pas.',
      'Minoritaire, et assumé.',
      'Le cercle a penché ailleurs.',
    ],
  },
  'vote.sondage': {
    surface: 'play',
    quand: 'vote en mode sondage : personne ne gagne',
    phrases: [
      'Ta voix compte. Pas en points, en avis.',
      'C’est noté. Sans enjeu, juste ton opinion.',
      'Merci — la salle t’a entendu.',
      'Un avis, pas un pari.',
    ],
  },

  // ---------- VOIX INTIME : la fin ----------
  'fin.podium': {
    surface: 'play',
    quand: 'le joueur termine dans les trois premiers',
    requiert: ['rang'],
    phrases: [
      '{rang} du cercle. Tu peux te resservir.',
      'Sur le podium. C’était mérité.',
      '{rang} — garde-le pour la prochaine fois.',
      '{rang}. La soirée est à toi.',
    ],
  },
  'fin.classe': {
    surface: 'play',
    quand: 'le joueur est classé hors podium',
    requiert: ['rang'],
    phrases: [
      '{rang}. La soirée n’était pas perdue.',
      'Tu finis {rang}. Il y a des podiums plus faciles.',
      '{rang} — largement de quoi revenir.',
      '{rang}, et une revanche à prendre.',
    ],
  },
  'fin.dernier': {
    surface: 'play',
    quand: 'le joueur termine dernier, ou sans point',
    phrases: [
      'Tu es resté jusqu’au bout. C’est déjà beaucoup.',
      'Le classement dit une chose, la soirée en dit une autre.',
      'Prochaine fois. Le feu ne s’éteint pas.',
      'Dernier au tableau, présent au cercle.',
    ],
  },

  // ---------- VOIX DE PLATEAU : seulement sur le remarquable ----------
  'stream.unanimite-juste': {
    surface: 'overlay',
    quand: 'tout le monde a trouvé (>= 5 réponses)',
    phrases: [
      'Tout le cercle a trouvé. Trop facile ?',
      'Personne ne s’est trompé. Chapeau collectif.',
      'Unanimité. La question était trop tendre.',
      'Sans faute, tout le monde.',
      'Le cercle au complet a visé juste.',
    ],
  },
  'stream.personne': {
    surface: 'overlay',
    quand: 'personne n’a trouvé (>= 5 réponses)',
    phrases: [
      'Personne. Absolument personne.',
      'Le cercle entier est passé à côté.',
      'Zéro bonne réponse. La question a gagné.',
      'Toute la salle dans le mur, ensemble.',
      'Pas un seul. C’est presque beau.',
    ],
  },
  'stream.piege': {
    surface: 'overlay',
    quand: 'une mauvaise option a recueilli plus de voix que la bonne',
    phrases: [
      'Le piège a fonctionné. La majorité est tombée dedans.',
      'La salle a choisi la mauvaise porte, en groupe.',
      'Belle embuscade : le cercle s’est fait avoir.',
      'La fausse réponse était plus séduisante.',
      'Piégés, et en nombre.',
    ],
  },
  'stream.quasi-unanimite': {
    surface: 'overlay',
    quand: 'au moins neuf réponses sur dix sont justes',
    phrases: [
      'Presque tout le monde a trouvé.',
      'Quasi-unanimité. Un ou deux distraits.',
      'Le cercle était sûr de lui — à raison.',
      'À une poignée près, tout le monde.',
    ],
  },
  'stream.egalite': {
    surface: 'overlay',
    quand: 'les deux options de tête se tiennent à une voix',
    phrases: [
      'Le cercle est coupé en deux.',
      'Égalité parfaite. Personne ne tranche.',
      'Deux camps, pas un de plus que l’autre.',
      'La salle est partagée, exactement.',
    ],
  },
  'stream.option-morte': {
    surface: 'overlay',
    quand: 'une option n’a recueilli aucune voix',
    phrases: [
      'Une réponse que personne n’a voulue.',
      'Il y avait une option de trop.',
      'Une proposition délaissée par tout le monde.',
      'Personne n’a mordu à celle-là.',
    ],
  },
  'stream.vote-consensus': {
    surface: 'overlay',
    quand: 'vote : une option dépasse huit voix sur dix',
    phrases: [
      'La salle est d’accord. C’est rare.',
      'Consensus écrasant.',
      'Presque tout le cercle du même avis.',
      'Peu de débat sur celle-là.',
    ],
  },
  'stream.vote-division': {
    surface: 'overlay',
    quand: 'vote : les deux premières options à une voix près',
    phrases: [
      'Le cercle hésite. Deux camps à égalité.',
      'Aucune majorité claire. Ça va discuter.',
      'La salle est coupée en deux.',
      'Personne ne l’emporte vraiment.',
    ],
  },
  'stream.estim-groupe-juste': {
    surface: 'overlay',
    quand: 'la moyenne du groupe est à moins de 10 % de la cible',
    phrases: [
      'La moyenne du cercle tombe presque juste.',
      'Ensemble, la salle avait vu juste.',
      'Le groupe, collectivement, ne s’est pas trompé.',
      'La sagesse de la foule, pour une fois.',
    ],
  },
  'stream.estim-groupe-loin': {
    surface: 'overlay',
    quand: 'la moyenne du groupe dépasse le double de la cible',
    phrases: [
      'Le cercle s’est trompé d’échelle.',
      'Tout le monde a visé beaucoup trop haut.',
      'La salle entière était hors sujet.',
      'Collectivement à côté de la plaque.',
    ],
  },
  'stream.estim-quelquun-proche': {
    surface: 'overlay',
    quand: 'la meilleure estimation est à moins de 2 % de la cible',
    phrases: [
      'Quelqu’un est tombé pile. Sans calculer, on parie.',
      'Une estimation au millimètre dans le lot.',
      'Il y a un expert dans la salle.',
      'Quelqu’un savait, manifestement.',
    ],
  },
  'stream.estim-personne-proche': {
    surface: 'overlay',
    quand: 'même la meilleure estimation reste à plus de 50 % de la cible',
    phrases: [
      'Personne n’a approché. La question a gagné.',
      'Pas une estimation dans la bonne zone.',
      'Le cercle est resté loin du compte.',
      'Aucune approche sérieuse.',
    ],
  },
  'stream.podium': {
    surface: 'overlay',
    quand: 'podium affiché — SEUL moment où le stream nomme quelqu’un, pour célébrer',
    phrases: [
      'Voilà le cercle au complet.',
      'La soirée a rendu son verdict.',
      'Trois en haut, tout le monde autour du feu.',
      'Le classement est tombé.',
    ],
  },
};

// ============================================================
// SEUILS DU « REMARQUABLE » (voix de plateau)
//
// Le stream ne parle QUE quand il y a quelque chose à dire, et se tait sinon :
// commenter la répartition est le métier de l'animateur. Si l'écran le dit avant
// lui, il se retrouve à répéter ce que tout le monde a déjà lu. Le silence est
// une fonctionnalité, pas un manque.
// ============================================================
export const SEUILS = {
  // Préalable absolu : un pourcentage sur trois joueurs ne veut rien dire, et
  // « 100 % ont trouvé » avec deux participants est ridicule à l'antenne.
  reponsesMin: 5,
  quasiUnanimite: 0.9,
  consensusVote: 0.8,
  ecartMoyenneJuste: 0.10,
  ecartMoyenneLoin: 2.0,
  meilleureProche: 0.02,
  personneProche: 0.5,
};

// Ordre de PRIORITÉ : si plusieurs conditions se déclenchent, une seule parle.
export const PRIORITE_PLATEAU = [
  'stream.unanimite-juste',
  'stream.personne',
  'stream.piege',
  'stream.estim-quelquun-proche',
  'stream.estim-personne-proche',
  'stream.egalite',
  'stream.vote-division',
  'stream.quasi-unanimite',
  'stream.vote-consensus',
  'stream.estim-groupe-juste',
  'stream.estim-groupe-loin',
  'stream.option-morte',
];

// ============================================================
// CHOIX D'UNE PHRASE
// ============================================================

const dejaDites = new Map(); // momentId -> Set d'index déjà servis

// Remet le compteur à zéro — une nouvelle partie a droit aux mêmes phrases.
export function reinitialiserVoix() {
  dejaDites.clear();
}

// Rend une phrase du moment, sans répétition tant que le stock n'est pas épuisé.
// `valeurs` remplit les repères déclarés dans `requiert`.
export function dire(momentId, valeurs = {}) {
  const moment = MOMENTS[momentId];
  if (!moment || !moment.phrases.length) return null;

  let servies = dejaDites.get(momentId);
  if (!servies || servies.size >= moment.phrases.length) {
    servies = new Set();
    dejaDites.set(momentId, servies);
  }
  const libres = moment.phrases.map((_, i) => i).filter((i) => !servies.has(i));
  const i = libres[Math.floor(Math.random() * libres.length)];
  servies.add(i);

  return moment.phrases[i].replace(/\{(\w+)\}/g, (t, cle) => (
    valeurs[cle] != null ? String(valeurs[cle]) : t
  ));
}

// Choisit le moment de plateau à commenter, ou rien. `stats` est la répartition
// publiée par le serveur à la révélation.
export function momentDePlateau(type, stats, reveal) {
  if (!stats || (stats.total || 0) < SEUILS.reponsesMin) return null;
  const total = stats.total;
  const candidats = new Set();

  if (stats.kind === 'options' && Array.isArray(stats.tally)) {
    const tally = stats.tally;
    const trie = [...tally].sort((a, b) => b - a);
    if (tally.some((n) => n === 0)) candidats.add('stream.option-morte');
    if (trie.length > 1 && trie[0] > 0 && trie[0] - trie[1] <= 1) {
      candidats.add(type === 'vote' ? 'stream.vote-division' : 'stream.egalite');
    }
    if (type === 'vote') {
      if (trie[0] / total >= SEUILS.consensusVote) candidats.add('stream.vote-consensus');
    } else {
      const iJuste = type === 'quiz' ? reveal?.correctIndex : (reveal?.correct ? 0 : 1);
      const justes = tally[iJuste] || 0;
      if (justes === total) candidats.add('stream.unanimite-juste');
      else if (justes === 0) candidats.add('stream.personne');
      else if (justes / total >= SEUILS.quasiUnanimite) candidats.add('stream.quasi-unanimite');
      if (tally.some((n, i) => i !== iJuste && n > justes)) candidats.add('stream.piege');
    }
  }

  if (stats.kind === 'numeric' && stats.target != null) {
    const echelle = Math.max(Math.abs(stats.target), 1);
    if (stats.avg != null) {
      const ecart = Math.abs(stats.avg - stats.target) / echelle;
      if (ecart <= SEUILS.ecartMoyenneJuste) candidats.add('stream.estim-groupe-juste');
      if (ecart >= SEUILS.ecartMoyenneLoin) candidats.add('stream.estim-groupe-loin');
    }
    if (stats.closest != null) {
      const meilleur = Math.abs(stats.closest - stats.target) / echelle;
      if (meilleur <= SEUILS.meilleureProche) candidats.add('stream.estim-quelquun-proche');
      if (meilleur >= SEUILS.personneProche) candidats.add('stream.estim-personne-proche');
    }
  }

  return PRIORITE_PLATEAU.find((id) => candidats.has(id)) || null;
}
