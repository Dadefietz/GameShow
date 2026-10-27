// QUEL CODE CET ÉCRAN FAIT-IL TOURNER ? (26/10) — voir `server/version-client.js`.
//
// Le script principal porte l'empreinte du build dans son nom. Un écran ouvert
// avant une mise en ligne garde l'ancien : c'est ainsi que la console a montré
// « Coup de cœur » sans « Haut le cœur » à onze joueurs.
const MOTIF = /\/assets\/(index-[A-Za-z0-9_-]+\.js)/;

export function versionChargee(doc = globalThis.document) {
  if (!doc) return null;
  for (const s of doc.querySelectorAll('script[src]')) {
    const m = MOTIF.exec(s.getAttribute('src') || '');
    if (m) return m[1];
  }
  return null;
}

// Périmé seulement si les DEUX versions sont connues et diffèrent : en
// développement, aucun des deux côtés n'a d'empreinte, et rien ne doit s'alarmer.
export function estPerimee(servie, chargee) {
  return !!servie && !!chargee && servie !== chargee;
}
