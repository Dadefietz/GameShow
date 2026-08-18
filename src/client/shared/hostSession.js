// Cloisonnement de la session animateur par compte Supabase.
//
// La session mémorisée dans le navigateur ({ code, hostToken, overlayToken, ownerId })
// contient un JETON D'ANIMATEUR : quiconque l'obtient pilote le salon. Elle n'appartient
// donc qu'au compte qui l'a ouverte, et ne doit JAMAIS être héritée par un autre compte
// se connectant sur le même navigateur.
//
// Règle (volontairement conservatrice) : on purge sur une contradiction POSITIVE —
// un compte est connecté et ce n'est pas le propriétaire de la session. Quand personne
// n'est authentifié, on ne purge pas : une session Supabase absente ou en cours de
// rafraîchissement ne doit pas faire perdre son salon à l'animateur en pleine partie
// (le jeton d'animateur reste borné dans le temps et limité à ce salon).
export function shouldPurgeHostSession(stored, user) {
  if (!stored) return false;   // rien en mémoire
  if (!user) return false;     // personne d'authentifié : on ne casse pas une partie en cours
  // Session d'un AUTRE compte, ou session non attribuable (format antérieur au
  // cloisonnement) alors qu'un compte est connecté : dans les deux cas, on purge.
  return !stored.ownerId || stored.ownerId !== user.id;
}
