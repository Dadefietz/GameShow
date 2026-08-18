// Traduction des erreurs d'authentification Supabase en messages actionnables.
//
// Un « Vérifiez l'adresse » générique envoie chercher au mauvais endroit : quand les
// inscriptions publiques sont fermées (recommandé pour un jeu mono-animateur), une
// demande de lien mal paramétrée est refusée alors que l'adresse est parfaitement
// valide. Chaque cas doit donc dire ce qui se passe RÉELLEMENT.
export function otpErrorMessage(err) {
  const code = (err && (err.code || err.error_code)) || '';
  const msg = String((err && err.message) || '');

  // Compte inexistant, ou inscriptions fermées : dans les deux cas, aucun compte
  // animateur ne correspond à cette adresse.
  if (code === 'otp_disabled' || code === 'signup_disabled' || /signups? not allowed/i.test(msg)) {
    return "Aucun compte animateur ne correspond à cette adresse.";
  }
  // Quota d'emails de l'hébergeur (strict sur le SMTP intégré de Supabase).
  if (code === 'over_email_send_rate_limit' || /rate limit/i.test(msg)) {
    return 'Trop de demandes de lien. Patientez quelques minutes avant de réessayer.';
  }
  if (/invalid|format/i.test(msg)) {
    return "Cette adresse email n'est pas valide.";
  }
  return "Envoi du lien impossible. Réessayez dans un instant.";
}
