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
      'Tu es arrivé(e) le premier. Choisis ta place autour du feu.',
      "Pour le moment, il n'y a que toi et les braises.",
    ],
  },
  'attente.accompagne': {
    surface: 'play',
    quand: 'au moins deux joueurs sont connectés',
    rotation: true,
    phrases: [
      'Patience... le feu part doucement, comme toujours.',
      'x',
      'Le cercle est encore vide. Ça ne va pas durer.',
      'Tu gardes le feu. C’est une responsabilité.',
      'Profite : dans deux minutes, il y aura du monde.',
      'Le cercle se forme. En attente que le feu prenne !',
      'Tout le monde est assis. Personne n’ose commencer.',
      'Patience... tu as le temps de te griller un marshmallow.',
      'Ça sent le bois et la compétition.',
      'Assis-toi sur ta souche et patiente mon ami(e).',
      'On y est presque. Respire (mais pas la fumée).',
    ],
  },

  // ---------- VOIX INTIME : la manche ----------
  // `reponse.envoyee` A ÉTÉ SUPPRIMÉ AVEC L'ÉCRAN QU'IL SERVAIT (A11).
  //
  // Ses six phrases commentaient la page « Ta réponse est bien partie », posée
  // entre l'envoi et la révélation. L'auteur a fait retirer cette page — « la page
  // ta réponse est bien partie n'a pas lieu d'être » — et le joueur reste
  // désormais sur sa question jusqu'au résultat. Le moment était donc le seul du
  // registre que personne ne pouvait voir : il figurait en exception assumée du
  // contrôle d'atteignabilité, ce qui est une dette, pas une décision. La liste
  // des exceptions est maintenant vide.
  'temps.ecoule': {
    surface: 'play',
    quand: 'le chrono est tombé sans réponse du joueur',
    phrases: [
      'Le temps passe vite autour du feu ! On se reconcentre.',
      'Rien reçu... Parle plus fort la prochaine fois.',
      "Bah alors ? Tu t'es endormi(e) au coin du feu ?",
      "Ouhlala... t'es parti(e) au petit coin ?",
    ],
  },
  'juste.simple': {
    surface: 'play',
    quand: 'bonne réponse, sans être le plus rapide de la manche ni en série',
    phrases: [
      "Bien vu l'ami(e).",
      'C’était ça.',
      'Solide.',
      'Tu le savais. Ça se voit.',
      'Propre.',
      'Sans trembler.',
      'Exactement ça.',
      'Tranquille.',
    ],
  },
  'juste.plus-rapide': {
    surface: 'play',
    quand: 'bonne réponse ET plus rapide de la manche (drapeau `fastest` du serveur)',
    phrases: [
      "L'un(e) des plus rapide du cercle. Ziouuuum......",
      "C'est vif, et juste. Telle la flèche de Robin des bois.",
      'Tu as répondu avant que les autres finissent de lire.',
      'Mère Nature est fière de toi.',
      'Le feu crépite de joie en te voyant jouer !',
    ],
  },
  'juste.serie': {
    surface: 'play',
    quand: 'bonne réponse ET série de 2 ou plus',
    // LE NOMBRE A QUITTÉ LES PHRASES (A7). Le marqueur de série l'affiche en gros
    // à trois lignes de là, depuis A1 : la phrase le redisait en toutes lettres,
    // et le joueur lisait deux fois le même chiffre dans le même bloc. La voix
    // garde le ton, le marqueur porte le compte.
    phrases: [
      "Attention à ne pas t'enflammer !",
      'Toujours pas de faute.',
      "Enchaînées. Le feu t'admire.",
      'Une série enflammée, et ça continue.',
      "On ne t'arrête plus.",
    ],
  },
  faux: {
    surface: 'play',
    quand: 'mauvaise réponse (aucune pénalité : zéro point, pas moins)',
    phrases: [
      "Ouch ! Tu t'es brûlé(e) sur celle-ci.",
      "Aïe raté... ça fait plus mal qu'une écharde.",
      'À côté... Touche du bois pour la prochaine.',
      "Non non non... le feu va s'éteindre.",
      'Manqué. Chut, personne n’a rien vu.',
      'Ce n’était pas ça. Ça arrive aux meilleurs.',
      'Dommage... Ne laisse pas tes espoirs se consumer !',
    ],
  },

  // Repli pour le joueur ARRIVÉ APRÈS le lancement. La décision 11 est explicite :
  // jamais d'écran muet, même dans les cas limites.
  'manche.sans-toi': {
    surface: 'play',
    quand: 'le joueur n’a pas participé à cette manche (arrivé après le lancement)',
    phrases: [
      'Celle-là s’est jouée sans toi. Il va falloir envoyer du bois pour revenir.',
      "Tu arrives : le cercle avait déjà commencé. Le feu n'attend pas.",
      'Tu entres en jeu maintenant petite allumette.',
    ],
  },



  // ---------- VOIX INTIME : estimation, par palier ----------
  // LA RÉPONSE EXACTE. Elle tombait dans `estimation.mille`, le palier des 2 %,
  // alors qu'elle vaut 200 points de plus (décision 5.5 du chantier v4) et n'a
  // rien de commun avec « à deux pour cent près ». Elle passe AVANT lui.
  'estimation.exact': {
    surface: 'play',
    quand: 'palier « exact » : la valeur donnée est exactement la cible',
    phrases: [
      'Wow ! Dans le mille.',
      "Le cercle t'applaudit !",
      "La précision c'est ton dada !",
    ],
  },
  'estimation.mille': {
    surface: 'play',
    quand: 'palier « mille » : à 2 % de la cible, ou à une unité près',
    phrases: [
      'Tu as visé juste au chiffre près.',
      'Exact ! (enfin quasi)',
      "T'es plutôt doué !",
      'À une brindille de mettre le feu !',
    ],
  },
  'estimation.proche': {
    surface: 'play',
    quand: 'palier « proche » : à 10 % de la cible',
    phrases: [
      'Tout près. Bien vu.',
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
      'Ça s’éloigne, sans se perdre.',
      'Généreux dans l’estimation.',
    ],
  },
  // LE PLUS PROCHE, HORS DE TOUTE PLAGE (chantier v4, décisions 5.3 et 2.8).
  //
  // Sans ce moment, ce joueur tombait dans `estimation.hors`, dont la condition
  // déclarée dit « zéro point » et dont les phrases le répètent — « et ça ne coûte
  // rien » — pendant que son écran affichait « +400 ». Le bonus du plus proche a
  // rendu fausse la condition d'un moment existant : il fallait donc un moment,
  // non une phrase de plus dans l'ancien.
  'estimation.plus-proche': {
    surface: 'play',
    quand: 'au-delà de 30 % de la cible, mais le plus proche : le bonus de 400',
    phrases: [
      'Loin, mais le moins loin de tous. Ça compte.',
      'Personne n’a fait mieux. C’est déjà une victoire.',
      'Le plus proche du cercle — de loin, mais le plus proche.',
      'Tout le monde s’est perdu. Toi, un peu moins.',
      'Pas dans le mille, mais devant les autres.',
    ],
  },
  'estimation.hors': {
    surface: 'play',
    quand: 'au-delà de 30 % de la cible, et pas le plus proche : zéro point',
    phrases: [
      'Là, on est loin. Vraiment loin.',
      'Tu as dû missclick.',
      "Ouch ! Tu t'es brûlé(e) sur celle-ci.",
      'On ne parlait peut-être pas de la même chose.',
      "On va faire comme s'il ne s'était rien passé...",
    ],
  },

  // ---------- VOIX INTIME : le lien ----------
  //
  // PHRASES PROVISOIRES, à relire par l'auteur. Elles suivent la règle du
  // registre — on ne punit jamais, on nomme ce qui s'est passé — mais elles n'ont
  // pas encore été arbitrées, contrairement aux 165 autres.
  'lien.seul': {
    surface: 'play',
    quand: 'le lien : personne d’autre n’a donné ce mot',
    phrases: [
      'Personne n’a pensé comme toi. C’est original, ça ne rapporte rien.',
      'Ton mot n’a trouvé personne. Le cercle pensait ailleurs.',
      'Seul de ton avis. Ça arrive aux meilleurs.',
      'Bien vu, mais tout seul — et ici, seul ne compte pas.',
    ],
  },
  'lien.majorite': {
    surface: 'play',
    quand: 'le lien : le joueur est dans le groupe le plus nombreux',
    phrases: [
      'Le mot que tout le monde attendait. Tu l’as trouvé.',
      'En plein dans la tête du cercle.',
      'Le groupe le plus nombreux, et tu en es.',
      'Tu penses comme la majorité. Ce soir, c’est un talent.',
    ],
  },
  'lien.groupe': {
    surface: 'play',
    quand: 'le lien : le joueur partage son mot, hors du groupe de tête',
    requiert: ['taille'],
    phrases: [
      'Vous êtes {taille} à y avoir pensé.',
      'Ton mot a trouvé du monde. Pas la foule, mais du monde.',
      'Partagé — ce n’était donc pas si tiré par les cheveux.',
      'Un petit groupe s’est formé autour de toi.',
    ],
  },

  // ---------- VOIX DE PLATEAU : le lien ----------
  'stream.lien-unanime': {
    surface: 'overlay',
    quand: 'le lien : la moitié du cercle au moins a donné le même mot',
    phrases: [
      'Le cercle n’a eu qu’une seule idée.',
      'Une évidence pour presque tout le monde.',
      'Rarement vu autant de monde d’accord.',
      'Un seul mot, et il a rassemblé.',
    ],
  },
  'stream.lien-disperse': {
    surface: 'overlay',
    quand: 'le lien : personne n’a partagé son mot, tous les groupes sont seuls',
    phrases: [
      'Personne n’a pensé comme personne.',
      'Autant de mots que de joueurs. Belle dispersion.',
      'Le cercle est parti dans toutes les directions.',
      'Aucun mot en commun. Ça n’arrive pas souvent.',
    ],
  },

  // ---------- VOIX INTIME : les visages ----------
  //
  // TROIS ISSUES, ET LA DEUXIÈME EST LA PLUS IMPORTANTE À NOMMER. Buzzer sur la
  // PREMIÈRE apparition, c'est avoir reconnu un visage qui n'était pas encore
  // revenu : le joueur n'a pas mal joué, il a joué trop tôt — et c'est même la
  // faute que le jeu tend à provoquer. Lui servir la même phrase qu'à celui qui a
  // buzzé au hasard serait faux, et le registre ne punit jamais.
  'visages.trouve': {
    surface: 'play',
    quand: 'le joueur a buzzé pendant la SECONDE apparition du visage doublé',
    phrases: [
      'Tu l’as reconnu. Au bon moment, en plus.',
      'Pile sur le revenant. Belle mémoire.',
      'C’était bien lui, et tu ne t’es pas trompé(e) de passage.',
      'Vu, et vu au bon moment. Chapeau.',
      'Ton œil ne t’a pas menti.',
    ],
  },
  'visages.trop-tot': {
    surface: 'play',
    quand: 'le joueur a buzzé sur la PREMIÈRE apparition du visage doublé',
    phrases: [
      'C’était le bon visage… mais il n’était pas encore revenu.',
      'Tu avais raison trop tôt. Il fallait attendre son retour.',
      'Le bon visage, le mauvais passage. De peu.',
      'Presque : c’est à son RETOUR qu’il fallait buzzer.',
    ],
  },
  'visages.rate': {
    surface: 'play',
    quand: 'le joueur a buzzé sur un visage qui n’était pas le doublé',
    phrases: [
      'Ce visage-là, tu ne l’avais jamais vu.',
      'Fausse alerte. Ils se ressemblent tous, au bout d’un moment.',
      'Non, celui-ci passait pour la première fois.',
      'Le doute t’a eu(e). Ça arrive à tout le monde.',
      'Raté — mais tu as regardé, c’est déjà ça.',
    ],
  },

  // ---------- VOIX DE PLATEAU : les visages ----------
  'stream.visages-personne': {
    surface: 'overlay',
    quand: 'les visages : personne n’a buzzé au bon moment',
    phrases: [
      'Le visage est passé deux fois. Personne ne l’a vu.',
      'Il a traversé le cercle sans se faire prendre.',
      'Aucun buzz au bon moment. Il était trop discret.',
      'Le revenant a gagné cette manche.',
    ],
  },
  'stream.visages-foule': {
    surface: 'overlay',
    quand: 'les visages : la moitié du cercle au moins a buzzé au bon moment',
    phrases: [
      'Le cercle a l’œil : ils l’ont presque tous vu revenir.',
      'Pas discret du tout, finalement.',
      'Repéré par la moitié du cercle.',
      'Ce visage-là n’avait aucune chance.',
    ],
  },

  // ---------- VOIX INTIME : vote ----------
  'vote.majorite': {
    surface: 'play',
    quand: 'vote noté, le joueur est dans un camp gagnant',
    phrases: [
      "T'es avec le cercle !",
      'Tu sais où souffle le vent ! Et le feu aime le vent.',
      'Le cercle pensait comme toi.',
      "Peu importe si c'est ce que tu penses vraiment, t'es là où il faut.",
      'Dans le camp le plus fourni.',
      'Bien vu : le cercle t’a suivi.',
    ],
  },
  'vote.minorite': {
    surface: 'play',
    quand: 'vote noté, le joueur est minoritaire',
    phrases: [
      'Seul contre le cercle. Courageux.',
      'Le cercle en a décidé autrement. Montre lui de quel bois tu te chauffes.',
      'À contre-courant.',
      "C'est comme se sentir seul... mais en pire.",
      'Minoritaire, et assumé. Tu vas te refaire.',
      'Le cercle a penché ailleurs.',
    ],
  },
  'vote.sondage': {
    surface: 'play',
    quand: 'vote en mode sondage : personne ne gagne',
    phrases: [
      'Ta voix compte. (Je le pense vraiment)',
      "C’est noté. Sans enjeu, juste ton opinion, et je l'apprécie.",
      'Merci ! Le cercle t’a entendu.',
      'Un avis, pas un pari.',
    ],
  },

  // ---------- VOIX DE L'ANIMATEUR : ce qu'il peut mettre en avant ----------
  //
  // A21 — « une phrase permettant à l'animateur d'indiquer qu'une seule personne a
  // trouvé la réponse exacte ou qu'un joueur a obtenu la meilleure estimation.
  // Cette formulation doit servir à mettre en avant un participant lorsque la
  // condition correspondante est remplie. »
  //
  // PREMIÈRE SURFACE « host » DU REGISTRE, et c'est une frontière qu'il faut tenir :
  // ces phrases CITENT UN NOM. Elles ne peuvent donc jamais passer au stream, où
  // les pseudos s'affichent devant toute l'audience — c'est la même règle que le
  // panneau des plus proches (décision 6.2 du chantier v4). L'animateur lit, ou
  // ne lit pas : c'est lui qui décide de nommer quelqu'un à l'antenne.
  'host.exact-unique': {
    surface: 'host',
    quand: 'estimation : une SEULE personne a trouvé la valeur exacte',
    requiert: ['nom'],
    phrases: [
      'Une seule personne est tombée pile : {nom}.',
      '{nom} a trouvé la valeur exacte. Personne d’autre.',
      'Pile poil, et une seule fois : {nom}.',
      'La réponse exacte, {nom} l’avait.',
    ],
  },
  'host.meilleure-estimation': {
    surface: 'host',
    quand: 'estimation : personne n’est exact, on peut nommer la meilleure approche',
    requiert: ['nom'],
    phrases: [
      'La meilleure estimation est celle de {nom}.',
      'Personne n’a trouvé, mais {nom} s’en approche le plus.',
      'C’est {nom} qui vise le mieux sur celle-ci.',
      '{nom} signe la meilleure approche du cercle.',
    ],
  },

  // ---------- VOIX INTIME : la fin ----------
  'fin.podium': {
    surface: 'play',
    quand: 'le joueur termine dans les trois premiers',
    requiert: ['rang'],
    phrases: [
      '{rang} du cercle. Tu peux être fier(e) !',
      'Sur le podium. C’était mérité.',
      "{rang} — Jubile devant les autres, ça n'arrivera peut-être plus.",
      "{rang}. L'une des légendes du cercle. Bravo",
    ],
  },
  'fin.classe': {
    surface: 'play',
    quand: 'le joueur est classé hors podium',
    requiert: ['rang'],
    phrases: [
      '{rang}. La soirée n’était pas perdue. Le cercle se souvient.',
      'Tu finis {rang}. Tu reviendras plus fort(e).',
      '{rang}, on acclame le podium et on prie pour les perdants',
      '{rang}, et une revanche à prendre.',
    ],
  },
  'fin.dernier': {
    surface: 'play',
    quand: 'le joueur termine dernier, ou sans point',
    phrases: [
      'Tu es resté jusqu’au bout. C’est déjà beaucoup.',
      'Le classement dit une chose, la soirée en dit une autre.',
      'Une prochaine fois. Le feu ne s’éteint pas.',
      'Dernier au tableau, présent au cercle.',
    ],
  },

  // ---------- VOIX DE PLATEAU : seulement sur le remarquable ----------
  'stream.unanimite-juste': {
    surface: 'overlay',
    quand: 'tout le monde a trouvé (>= 5 réponses)',
    phrases: [
      'Tout le cercle a trouvé. Trop facile ?',
      'Le cercle est bon. Trop bon ?',
      'Unanimité. La question était trop tendre.',
      'Sans faute, tout le monde.',
      'Le cercle au complet a visé juste.',
    ],
  },
  'stream.personne': {
    surface: 'overlay',
    quand: 'personne n’a trouvé (>= 5 réponses)',
    phrases: [
      "Personne. Absolument personne... ça c'est un cercle uni !",
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
      'La plupart se sont brûlés. Bravo aux autres !',
      'Piégés, et en nombre.',
    ],
  },
  'stream.quasi-unanimite': {
    surface: 'overlay',
    quand: 'au moins neuf réponses sur dix sont justes',
    phrases: [
      'Presque tout le monde a trouvé.',
      'Quasi-unanimité. Un ou deux distraits.',
      'Le cercle était sûr de lui, à raison.',
      'À une poignée près, tout le monde.',
    ],
  },
  'stream.egalite': {
    surface: 'overlay',
    // A14 — « les camps sont parfaitement à égalité » et « les deux premières
    // options séparées d'une seule voix » étaient traités par la MÊME condition,
    // « à une voix près ». Une phrase comme « Wow ! Égalité parfaite » s'affichait
    // donc sur un écart d'une voix, où elle est fausse. Ce moment ne dit plus que
    // l'égalité STRICTE.
    quand: 'les deux options de tête sont exactement à égalité',
    phrases: [
      'Le cercle est coupé en deux.',
      'Wow ! Égalité parfaite.',
      'Le cercle est partagé...',
      'Pas une voix d’écart. Le cercle ne tranche pas.',
    ],
  },
  'stream.majorite-trompee': {
    surface: 'overlay',
    // A13 — « la majorité s'est trompée ». Le piège ne se déclenchait que si UNE
    // mauvaise option dépassait la bonne. Quand l'erreur se répartissait sur trois
    // options, chacune sous la bonne réponse, le cercle avait beau s'être trompé
    // en majorité : le plateau ne disait rien.
    quand: 'moins de la moitié des réponses données sont justes, sans qu’une seule mauvaise option domine',
    phrases: [
      'La majorité du cercle s’est trompée.',
      'Plus d’erreurs que de réussites sur celle-ci.',
      'Le cercle a douté, et il a eu tort.',
      'Celle-là a fait plus de victimes que de vainqueurs.',
    ],
  },
  'stream.option-morte': {
    surface: 'overlay',
    quand: 'une option n’a recueilli aucune voix',
    phrases: [
      'Il y a une option qui devrait finir au feu.',
      'Il y avait une option de trop on dirait.',
      'Une proposition délaissée par le cercle.',
      "Le cercle n'est pas dûpe face à cette option bancale.",
    ],
  },
  'stream.vote-consensus': {
    surface: 'overlay',
    quand: 'vote : une option dépasse huit voix sur dix',
    phrases: [
      'Le cercle est d’accord. C’est rare.',
      'Consensus écrasant.',
      'Presque tout le cercle est du même avis.',
      "Le feu s'intensifie en voyant une telle unité !",
    ],
  },
  'stream.vote-division': {
    surface: 'overlay',
    // A14 — resserré à UNE VOIX D'ÉCART EXACTEMENT. L'égalité parfaite a son
    // propre moment ci-dessous : ce sont deux situations qu'un animateur commente
    // différemment, et « deux camps à égalité » était faux à une voix près.
    quand: 'vote : une seule voix sépare les deux premières options',
    phrases: [
      'Le cercle hésite. Une seule voix d’écart.',
      'Le feu brûle de bonheur en voyant cette compétition !',
      'Une voix. C’est tout ce qui les sépare.',
      'Mais qui a gagné en fait ?',
    ],
  },
  'stream.vote-egalite': {
    surface: 'overlay',
    quand: 'vote : les deux premières options sont exactement à égalité',
    phrases: [
      'Parfaitement à égalité. Le cercle ne tranche pas.',
      'Deux camps, pas une voix d’écart.',
      'Le cercle est coupé en deux... ça fait des demi-cercles du coup.',
      'Personne ne l’emporte. Il va falloir en parler.',
    ],
  },
  'stream.estim-groupe-juste': {
    surface: 'overlay',
    quand: 'la moyenne du groupe est à moins de 10 % de la cible',
    phrases: [
      'Un cercle de qualité !',
      'Ensemble, le cercle a ajusté sa mire !',
      'Le cercle a envoyé du bois sur celle-ci.',
      'La sagesse de la foule, pour une fois.',
    ],
  },
  'stream.estim-groupe-loin': {
    surface: 'overlay',
    quand: 'la moyenne du groupe dépasse le double de la cible',
    phrases: [
      'Le cercle s’est trompé d’échelle.',
      'Tout le monde a visé beaucoup trop loin.',
      'Une partie du cercle était hors sujet.',
      'Collectivement à côté de la plaque.',
    ],
  },
  // REMPLACE « la meilleure estimation est à moins de 2 % de la cible ».
  // Arbitrage de l'auteur : le plateau ne s'émeut plus d'une approche, mais
  // d'une réponse EXACTE — et seulement si une seule personne l'a trouvée.
  'stream.estim-exact-unique': {
    surface: 'overlay',
    quand: 'estimation : une seule personne a trouvé la valeur exacte',
    phrases: [
      'Une seule personne talentueuse dans le cercle on dirait.',
      'Une estimation au millimètre dans le lot. Chapeau bas !',
      "Il y a un expert dans le cercle. Gardons-le à l'œil !",
      "Quelqu’un savait, et c'est tout à son honneur.",
    ],
  },
  'stream.estim-personne-proche': {
    surface: 'overlay',
    quand: 'même la meilleure estimation reste à plus de 50 % de la cible',
    phrases: [
      'Le cercle est parti se promener sur cette estimation on dirait.',
      "Alors... le but du jeu c'est d'être le plus proche de la réponse, pas le plus loin.",
      'Le cercle est resté loin du compte. Il va falloir songer à toucher du bois un peu.',
      'Ouch ! Le feu se sent bien seul sur celle-là.',
    ],
  },
  'stream.podium': {
    surface: 'overlay',
    quand: 'podium affiché — SEUL moment où le stream nomme quelqu’un, pour célébrer',
    phrases: [
      'Voici un podium de qualité ! (et le reste du cercle aussi vous avez du talent)',
      'La feu a rendu son verdict ! Bravo à notre grand vainqueur !',
      'Trois en haut, et tout le monde danse autour du feu.',
      'Tout feu tout flamme ces 3 gagnants ! (et les autres vous êtes chauds aussi !)',
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
  // `meilleureProche` (2 %) a disparu avec le moment qu'il servait : le plateau
  // ne parle plus d'une approche, mais d'une réponse EXACTE et unique. Un seuil
  // qui ne sert plus est un piège pour la relecture — on ne le garde pas.
  personneProche: 0.5,
  // LE LIEN : « la moitié du cercle au moins ». Sous ce seuil, un groupe de tête
  // n'a rien d'exceptionnel — c'est le jeu qui fonctionne normalement.
  lienUnanime: 0.5,
  // LES VISAGES : même lecture, même seuil. La moitié du cercle qui repère le
  // revenant, c'est remarquable ; un tiers, c'est le jeu qui marche.
  visagesFoule: 0.5,
};

// Ordre de PRIORITÉ : si plusieurs conditions se déclenchent, une seule parle.
export const PRIORITE_PLATEAU = [
  'stream.lien-unanime',
  'stream.lien-disperse',
  // L'échec collectif d'abord : qu'un visage traverse le cercle sans être vu est
  // plus remarquable que de le voir repéré par beaucoup.
  'stream.visages-personne',
  'stream.visages-foule',
  'stream.unanimite-juste',
  'stream.personne',
  'stream.piege',
  'stream.estim-exact-unique',
  'stream.estim-personne-proche',
  'stream.vote-egalite',
  'stream.egalite',
  'stream.vote-division',
  // La majorité trompée passe APRÈS le piège : quand une mauvaise option domine,
  // c'est elle l'histoire à raconter, et les deux conditions se déclenchent
  // ensemble. Elle passe aussi après l'égalité, plus rare donc plus remarquable.
  'stream.majorite-trompee',
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

// Les repères écrits dans une phrase : `{rang}`, `{serie}`, `{taille}`…
const REPERE = /\{(\w+)\}/g;
export function reperesDe(phrase) {
  return [...String(phrase).matchAll(REPERE)].map((m) => m[1]);
}

// Rend une phrase du moment, sans répétition tant que le stock n'est pas épuisé.
// `valeurs` remplit les repères déclarés dans `requiert`.
//
// AUCUNE ACCOLADE NE DOIT ARRIVER JUSQU'À UN JOUEUR (A30).
//
// Ce qui se passait avant : la substitution laissait le repère brut quand la
// valeur manquait — sans rien signaler. Sept phrases de fin de partie citaient
// `{rang}` alors qu'aucun appelant ne fournissait jamais cette valeur : tout
// joueur classé lisait « {rang} du cercle » à la fin de chaque partie. Le
// registre DÉCLARAIT pourtant le contrat, `requiert: ['rang']` ; personne ne le
// lisait.
//
// Désormais une phrase dont un repère n'est pas fourni n'est pas servie : on
// tire parmi celles qu'on peut vraiment écrire. Si aucune ne convient, on se
// tait — une ligne absente vaut mieux qu'une accolade affichée. Et on le crie
// en console, pour que le défaut se voie à la première partie d'essai au lieu
// de dormir des mois.
export function dire(momentId, valeurs = {}) {
  const moment = MOMENTS[momentId];
  if (!moment || !moment.phrases.length) return null;

  const servable = (p) => reperesDe(p).every((cle) => valeurs[cle] != null);
  const utilisables = moment.phrases
    .map((p, i) => [p, i])
    .filter(([p]) => servable(p));

  if (!utilisables.length) {
    const manquants = [...new Set(moment.phrases.flatMap(reperesDe))]
      .filter((cle) => valeurs[cle] == null);
    console.error(
      `[voix] « ${momentId} » est muet : aucune phrase servable, valeur(s) manquante(s) : ${manquants.join(', ')}`,
    );
    return null;
  }

  let servies = dejaDites.get(momentId);
  // Le stock se juge sur les phrases SERVABLES, non sur le total : sinon un
  // moment dont la moitié des phrases sont hors d'atteinte ne se réarmerait
  // jamais et finirait par ne plus rien dire.
  if (!servies || utilisables.every(([, i]) => servies.has(i))) {
    servies = new Set();
    dejaDites.set(momentId, servies);
  }
  const libres = utilisables.filter(([, i]) => !servies.has(i));
  const [phrase, i] = libres[Math.floor(Math.random() * libres.length)];
  servies.add(i);

  return phrase.replace(REPERE, (t, cle) => (valeurs[cle] != null ? String(valeurs[cle]) : t));
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
    // A14 — L'ÉGALITÉ PARFAITE N'EST PAS UNE VOIX D'ÉCART. Une seule condition,
    // « à une voix près », servait les deux cas : le plateau annonçait « égalité
    // parfaite » sur un écart d'une voix, où c'est faux, et « deux camps à
    // égalité » là où l'un menait. Ce sont deux situations qu'un animateur
    // commente différemment ; ce sont donc deux moments.
    const serres = trie.length > 1 && trie[0] > 0;
    const exAequo = serres && trie[0] === trie[1];
    const uneVoix = serres && trie[0] - trie[1] === 1;
    if (type === 'vote') {
      if (exAequo) candidats.add('stream.vote-egalite');
      if (uneVoix) candidats.add('stream.vote-division');
      if (trie[0] / total >= SEUILS.consensusVote) candidats.add('stream.vote-consensus');
    } else {
      if (exAequo) candidats.add('stream.egalite');
      const iJuste = type === 'quiz' ? reveal?.correctIndex : (reveal?.correct ? 0 : 1);
      const justes = tally[iJuste] || 0;
      if (justes === total) candidats.add('stream.unanimite-juste');
      else if (justes === 0) candidats.add('stream.personne');
      else if (justes / total >= SEUILS.quasiUnanimite) candidats.add('stream.quasi-unanimite');
      if (tally.some((n, i) => i !== iJuste && n > justes)) candidats.add('stream.piege');
      // A13 — « la majorité s'est trompée ». Le piège ci-dessus ne se déclenche
      // que si UNE mauvaise option dépasse la bonne. Quand l'erreur se répartit
      // sur plusieurs options, chacune sous la bonne réponse, la majorité s'est
      // bel et bien trompée et le plateau restait muet.
      //
      // Le compte porte sur les RÉPONSES DONNÉES, jamais sur les joueurs présents
      // (`total` vaut `rt.answers.size` côté serveur) : c'est la lecture retenue
      // en réunion pour toutes les règles de seuil.
      if (justes > 0 && justes / total < 0.5) candidats.add('stream.majorite-trompee');
    }
  }

  // LES VISAGES. Deux extrêmes seulement, comme partout ailleurs : le visage que
  // personne n'a démasqué, et celui que la moitié du cercle a vu revenir. Entre
  // les deux, une manche ordinaire — et le plateau se tait.
  if (stats.kind === 'visages') {
    if (stats.trouve === 0) candidats.add('stream.visages-personne');
    else if (stats.trouve / total >= SEUILS.visagesFoule) candidats.add('stream.visages-foule');
  }

  // LE LIEN. Le plateau ne commente que deux situations remarquables : le cercle
  // qui n'a eu qu'une idée, et celui qui n'en a partagé aucune. Entre les deux,
  // il se tait — commenter une répartition ordinaire est le métier de l'animateur.
  if (stats.kind === 'lien' && Array.isArray(stats.groupes)) {
    const tete = stats.groupes[0];
    if (tete && tete.count / total >= SEUILS.lienUnanime) candidats.add('stream.lien-unanime');
    if (stats.groupes.length && stats.groupes.every((g) => g.count === 1)) candidats.add('stream.lien-disperse');
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
      if (meilleur >= SEUILS.personneProche) candidats.add('stream.estim-personne-proche');
    }
    // UNE SEULE PERSONNE A TROUVÉ LA VALEUR EXACTE.
    //
    // Le seuil de proximité a été REMPLACÉ par cette condition, sur arbitrage de
    // l'auteur : le plateau ne s'émeut plus d'une approche à deux pour cent, mais
    // d'une réponse exacte — et seulement si UNE seule personne l'a trouvée. À
    // plusieurs, l'exploit n'en est plus un, et le plateau se tait.
    //
    // Le compte vient de l'histogramme, qui isole déjà la réponse exacte parce
    // qu'elle est de largeur nulle et se dessine en trait (chantier de l'axe).
    if (stats.histogramme?.exact === 1) candidats.add('stream.estim-exact-unique');
  }

  return PRIORITE_PLATEAU.find((id) => candidats.has(id)) || null;
}
