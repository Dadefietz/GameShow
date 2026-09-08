// LE CHRONO DE « LE JUSTE TEMPS » — sa mesure, et son écriture.
//
// TROIS SURFACES DOIVENT AFFICHER LE MÊME COMPTE À REBOURS, à la même fraction de
// seconde : le téléphone du joueur, la scène du stream, et — pour la saisie et le
// résultat — la console de l'animateur. Deux implémentations dériveraient, et ce
// jeu se juge au centième : une dérive de deux dixièmes entre le téléphone et
// l'antenne ferait mentir le stream sur ce que les joueurs ont vu.
//
// AUCUNE CONSTANTE DE DURÉE ICI. La durée du compte à rebours et le temps de
// cache viennent du SERVEUR, avec la question. C'est la règle qu'observe déjà
// `echelle-estimation.js` pour les plages du barème : « un écran qui connaîtrait
// les paliers par cœur finirait par annoncer une plage que le barème ne
// récompense plus ». Un écran qui connaîtrait la durée par cœur finirait par
// décompter quinze secondes là où le serveur en accorde vingt.
import { useEffect, useRef, useState } from 'react';
import { pourcent as pourcentDeProportion } from './proportion.js';

// ---------------------------------------------------------------------------
// ÉCRITURE
// ---------------------------------------------------------------------------

// LE CHRONO EN GROS, tel qu'il défile : « 04,72 ». Deux chiffres avant la
// virgule, deux après, TOUJOURS — un affichage qui perdrait ou gagnerait un
// caractère en cours de route ferait sauter les chiffres à chaque centième, sur
// un écran où l'on ne regarde qu'eux.
export function chronoAffiche(secondes) {
  const s = Math.max(0, Number(secondes) || 0);
  const centiemes = Math.floor(s * 100 + 1e-6);
  const entier = Math.floor(centiemes / 100);
  const reste = centiemes % 100;
  return `${String(entier).padStart(2, '0')},${String(reste).padStart(2, '0')}`;
}

// UNE VALEUR DE TEMPS DANS UNE PHRASE OU SUR UN AXE : « 4,72 s ».
// Sans le zéro de tête — ici on lit un nombre, pas un cadran qui court.
export function secondes(valeur) {
  if (valeur == null || !Number.isFinite(Number(valeur))) return '—';
  return `${Number(valeur).toFixed(2).replace('.', ',')} s`;
}

// LE FORMATTEUR D'UNE RÉPARTITION. Les graphiques du barème servent l'estimation
// ET le juste temps : c'est la seule chose qui les distingue à l'écran. Le
// serveur dit laquelle des deux il envoie (`stats.unite`) ; l'écran ne devine pas.
export function formatteurDe(stats, formatParDefaut) {
  if (stats && stats.unite === 'secondes') return secondes;
  // « Coupe ta bûche » écrit ses valeurs en points de pourcentage. Le format vit
  // avec le curseur (`proportion.js`), pas ici : c'est le même fichier qui décide
  // comment une proportion se dessine et comment elle s'écrit.
  if (stats && stats.unite === 'pourcent') return pourcentDeProportion;
  return formatParDefaut;
}

// ---------------------------------------------------------------------------
// MESURE
// ---------------------------------------------------------------------------

// L'ÉCOULÉ À L'INSTANT DU GESTE — et non celui de la dernière image dessinée.
//
// POURQUOI IL EXISTE. Les deux jeux d'adresse — le juste temps et la bûche —
// annonçaient au serveur la valeur AFFICHÉE, celle que le dernier rendu avait
// posée dans l'état de React. Or cette valeur a l'âge de la dernière image :
// jusqu'à 17 ms sur un écran à 60 Hz, 8 sur un écran à 120 Hz.
//
// CE QUE ÇA COÛTAIT, ET C'EST EXACTEMENT LA QUESTION POSÉE : deux téléphones qui
// frappent au même instant n'annoncent pas la même chose s'ils ne rafraîchissent
// pas à la même cadence. Sur la bûche, où le curseur parcourt CENT POINTS PAR
// SECONDE, une image de retard vaut 1,7 point de bûche — et le palier le plus
// haut n'en fait qu'un. Le joueur au vieux téléphone était systématiquement
// avantagé d'un demi-point sur celui qui a un écran rapide, sans que rien ne le
// dise.
//
// Ici on ne lit aucun rendu : on relit l'horloge monotone au moment même du
// geste. Deux appareils quelconques annoncent alors la même chose pour le même
// geste, quel que soit leur écran.
export function ecouleMaintenant(current) {
  const recuA = current?.recuA ?? null;
  if (recuA == null) return null;
  // Ce qui s'était déjà écoulé de la fenêtre à la réception — non nul au rejeu
  // d'une reconnexion en pleine manche.
  const dejaEcoule = current?.durationMs != null && current?.resteMs != null
    ? current.durationMs - current.resteMs
    : 0;
  const maintenant = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return Math.max(0, dejaEcoule + (maintenant - recuA));
}

// LE COMPTE À REBOURS, EN MILLISECONDES RESTANTES.
//
// POURQUOI IL NE COMPARE PAS DEUX HORLOGES. La manche porte une `deadline`, qui
// est un instant de l'horloge du SERVEUR. Partout ailleurs le client la compare à
// la sienne : sur un chrono affiché à la seconde et arrondi vers le haut, un
// décalage de quelques secondes ne se voit pas. Ici il se verrait — et il
// donnerait du temps de jeu en plus à qui a une horloge en retard.
//
// Le serveur envoie donc une DURÉE (`resteMs`), que l'on décompte depuis la
// réception locale du message. Aucune horloge murale n'entre dans le calcul :
// seulement `performance.now()`, qui est monotone et ne saute pas.
//
// `recuA` est posé par `useGame` à la réception de `module:started` — donc aussi
// au rejeu d'une reconnexion, où `resteMs` ne vaut plus la durée entière mais ce
// qu'il reste vraiment. Un joueur qui recharge en pleine manche retrouve son
// chrono à la bonne fraction de seconde, et non au début.
//
// LA BOUCLE SUIT L'ÉCRAN (`requestAnimationFrame`) et non un intervalle : les
// centièmes défilent à la cadence d'affichage, sans jamais demander plus de
// rendus que l'écran n'en fait. Elle s'arrête d'elle-même à zéro.
export function useCompteARebours(current, actif = true) {
  const dureeCompteMs = current?.dureeCompteMs ?? null;
  const roundId = current?.roundId ?? null;
  // Ce qui s'est écoulé de la FENÊTRE avant que le message n'arrive : la fenêtre
  // dépasse le compte à rebours (le serveur laisse une marge pour que buzzer à
  // zéro reste possible), et un rejeu de reconnexion arrive en cours de route.
  const dejaEcoule = current?.durationMs != null && current?.resteMs != null
    ? current.durationMs - current.resteMs
    : 0;
  const recuA = current?.recuA ?? null;

  const [restantMs, setRestantMs] = useState(() => (
    dureeCompteMs != null ? Math.max(0, dureeCompteMs - dejaEcoule) : null
  ));
  const trame = useRef(0);

  useEffect(() => {
    if (dureeCompteMs == null || recuA == null || !actif) return undefined;
    let vivant = true;
    const battre = () => {
      if (!vivant) return;
      const depuis = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - recuA;
      const reste = Math.max(0, dureeCompteMs - dejaEcoule - depuis);
      setRestantMs(reste);
      // À zéro on s'arrête : rien ne bouge plus, et une boucle qui continue de
      // tourner sur un écran figé est un compteur de batterie.
      if (reste > 0) trame.current = requestAnimationFrame(battre);
    };
    battre();
    return () => { vivant = false; cancelAnimationFrame(trame.current); };
    // `roundId` force le redémarrage d'une manche à l'autre, même si la durée ne
    // change pas — sans lui, deux manches de suite du même jeu partageraient le
    // chrono de la première.
  }, [dureeCompteMs, dejaEcoule, recuA, actif, roundId]);

  return restantMs;
}
