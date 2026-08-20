// Traduction des erreurs d'authentification Supabase en messages actionnables.
//
// Un « Vérifiez l'adresse » générique envoie chercher au mauvais endroit. Chaque
// cas doit dire ce qui se passe RÉELLEMENT, et ce qu'il reste à faire.
//
// La connexion se fait désormais par MOT DE PASSE (action 9). Le lien envoyé par
// mail a été abandonné : le service d'envoi intégré à Supabase est bridé sur les
// offres gratuites, si bien qu'une soirée un peu chargée pouvait épuiser le quota
// et enfermer l'animateur dehors — juste avant un direct. Le mail ne sert plus
// qu'à la réinitialisation, cas rare.
export function passwordErrorMessage(err) {
  const code = (err && (err.code || err.error_code)) || '';
  const msg = String((err && err.message) || '');

  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) {
    return 'Adresse ou mot de passe incorrect.';
  }
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(msg)) {
    return "Ce compte n'est pas encore confirmé.";
  }
  // Durcir les exigences de mot de passe côté Supabase n'invalide PAS les mots de
  // passe existants, mais leur propriétaire reçoit cette erreur à la connexion —
  // avec un mot de passe pourtant correct. Sans ce cas, on afficherait « connexion
  // impossible », ce qui enverrait chercher la panne au mauvais endroit.
  if (code === 'weak_password' || /weak password/i.test(msg)) {
    return 'Votre mot de passe ne respecte plus les exigences de sécurité. Utilisez « Mot de passe oublié » pour en choisir un nouveau.';
  }
  // Supabase limite les tentatives répétées : c'est une protection, pas une panne.
  if (code === 'over_request_rate_limit' || /rate limit/i.test(msg)) {
    return 'Trop de tentatives. Patientez une minute avant de réessayer.';
  }
  if (/invalid|format/i.test(msg) && /email/i.test(msg)) {
    return "Cette adresse email n'est pas valide.";
  }
  return 'Connexion impossible. Réessayez dans un instant.';
}

// Réinitialisation : le seul chemin qui passe encore par un envoi de mail, donc
// le seul qui puisse encore buter sur le quota de l'hébergeur.
export function resetErrorMessage(err) {
  const code = (err && (err.code || err.error_code)) || '';
  const msg = String((err && err.message) || '');
  if (code === 'over_email_send_rate_limit' || /rate limit/i.test(msg)) {
    return 'Trop de demandes. Patientez quelques minutes avant de réessayer.';
  }
  return "Envoi impossible. Vérifiez l'adresse et réessayez.";
}

// Masque une adresse pour l'affichage : l'écran animateur peut passer à l'antenne
// lors d'un partage d'écran, et une adresse personnelle qui s'y affiche ne se
// rattrape pas. On garde de quoi RECONNAÎTRE le compte, pas de quoi le recopier.
export function masquerEmail(email) {
  const s = String(email || '');
  const at = s.indexOf('@');
  if (at < 1) return s ? '•••' : '';
  const nom = s.slice(0, at);
  const domaine = s.slice(at + 1);
  const debut = nom.slice(0, 1);
  const point = domaine.lastIndexOf('.');
  const extension = point > 0 ? domaine.slice(point) : '';
  return `${debut}•••@•••${extension}`;
}
