// « CHASSE AUX ÉTOILES » — CE QU'UN RÉGLAGE PERMET VRAIMENT, CÔTÉ STUDIO.
//
// LA MÊME FORMULE QUE LE SERVEUR (`capaciteEtoiles` dans src/server/modules.js) :
// le nombre d'étoiles qui tiennent dans la fenêtre d'allumage. Le Studio s'en
// sert pour prévenir l'animateur avant qu'il enregistre une combinaison
// impossible. Elle vit ici parce que le client et le serveur ne partagent pas de
// fichiers ; un contrôle unitaire confronte les deux sur des centaines de
// réglages, pour que le Studio ne promette jamais autre chose que le jeu.
export function capaciteEtoiles(mode, r) {
  const fenetre = (r.fin - r.debut) * 1000;
  const duree = r.duree * 1000;
  if (!(duree > 0)) return 0;
  if (mode === 'ciel') return Math.max(0, r.simultanees * Math.floor(fenetre / duree));
  return Math.max(0, Math.floor((fenetre + r.pauseMin * 1000) / (duree + r.pauseMin * 1000)));
}
