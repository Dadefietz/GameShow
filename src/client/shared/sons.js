// LES SONS DU JEU (A25).
//
// CE QUI A ÉTÉ DEMANDÉ : « l'ajout d'effets sonores afin de mieux signaler la fin
// du chronomètre et les événements du jeu. » Theodore : « l'absence de signal
// sonore rendait difficile la perception de la fin des 20 secondes de réponse. »
//
// POURQUOI DES SONS SYNTHÉTISÉS ET NON DES FICHIERS.
//
// Le projet vient de passer une demi-journée sur des polices qui étaient dans le
// dépôt, servies, préchargées — et jamais déclarées. Un fichier audio, c'est le
// même piège en plus lourd : un octet à héberger, une adresse à tenir, un cache à
// invalider, et un silence qui ne se voit sur aucune capture d'écran. Deux
// oscillateurs et une enveloppe ne peuvent pas manquer à l'appel : le son EST le
// code, il part avec lui.
//
// C'est aussi ce que le registre sonore appelle : un bip de compte à rebours et
// une chute de fin ne gagnent rien à être enregistrés. Le jour où le jeu voudra
// un vrai habillage — un jingle, une nappe de feu —, ce sera un autre chantier,
// avec des fichiers et leur contrôle d'existence.
//
// LA RÈGLE DU NAVIGATEUR : aucun son sans geste préalable de l'utilisateur. Sur
// le téléphone d'un joueur, le geste existe — il a tapé pour rejoindre. Sur la
// source OBS, il n'y en a aucun : le contexte y démarre suspendu et se réveille
// au premier geste s'il en vient un. On ne force rien, et on ne casse jamais
// l'écran pour un bip qui n'a pas pu sortir.

let contexte = null;
let coupe = false;

// Le contexte est créé À LA DEMANDE. En créer un au chargement du module ferait
// apparaître un avertissement dans la console de toutes les surfaces, y compris
// celles qui ne jouent aucun son (le studio, la console).
function ctx() {
  if (coupe) return null;
  if (contexte) return contexte;
  const C = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!C) { coupe = true; return null; }
  try { contexte = new C(); } catch { coupe = true; return null; }
  return contexte;
}

// Une note : fréquence, durée, volume. L'enveloppe monte en 8 ms et redescend en
// exponentielle — une coupure franche produit un clic audible, qui s'entend
// beaucoup plus qu'il ne se lit dans le code.
function note({ frequence, duree = 0.12, volume = 0.18, forme = 'sine', retard = 0 }) {
  const c = ctx();
  if (!c) return;
  // Le contexte peut être suspendu tant qu'aucun geste n'a eu lieu. On demande sa
  // reprise sans l'attendre : si elle échoue, le son est perdu, jamais l'écran.
  if (c.state === 'suspended') c.resume().catch(() => {});
  const t = c.currentTime + retard;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = forme;
  osc.frequency.setValueAtTime(frequence, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + duree + 0.02);
}

// LE COMPTE À REBOURS — une seconde avant la fin, sur les cinq dernières.
// Court et clair : il doit se remarquer sans couvrir la voix de l'animateur.
export function bipCompteRebours() {
  note({ frequence: 880, duree: 0.09, volume: 0.14, forme: 'triangle' });
}

// LA FIN DU TEMPS — deux notes qui descendent. C'est le seul son du jeu qui dit
// « c'est terminé », et il doit se distinguer du bip à l'oreille, pas seulement
// sur le papier : d'où la chute, et non un bip plus grave.
export function sonFinDuTemps() {
  note({ frequence: 660, duree: 0.16, volume: 0.20, forme: 'triangle' });
  note({ frequence: 415, duree: 0.28, volume: 0.20, forme: 'triangle', retard: 0.14 });
}

// LA RÉVÉLATION — une montée brève, sur le stream seulement : c'est le moment où
// le public découvre la réponse.
export function sonRevelation() {
  note({ frequence: 523, duree: 0.14, volume: 0.16, forme: 'sine' });
  note({ frequence: 784, duree: 0.22, volume: 0.16, forme: 'sine', retard: 0.11 });
}

// Pour les contrôles automatiques et pour un éventuel réglage : couper la sortie
// sans avoir à retirer les appels.
export function couperLesSons() {
  coupe = true;
  if (contexte) { contexte.close().catch(() => {}); contexte = null; }
}
