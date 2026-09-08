// LE CURSEUR DE « COUPE TA BÛCHE » — sa position, et l'écriture des proportions.
//
// LE CALCUL EXISTE DEUX FOIS : ici, qui DESSINE, et dans `src/server/modules.js`,
// qui ARBITRE. Les deux ne peuvent pas s'importer sans faire entrer du code
// serveur dans le paquet du navigateur — même situation que l'icône d'onglet et
// la marque, ou que les signes de « Retour de flamme ».
//
// UN CONTRÔLE AUTOMATIQUE LES CONFRONTE sur deux mille instants. S'ils
// divergeaient, le joueur couperait à un endroit et le serveur en compterait un
// autre : le jeu tournerait, les points seraient faux, et rien ne le signalerait.
import { useEffect, useRef, useState } from 'react';

// LA POSITION DU CURSEUR — une onde triangulaire. Il part à gauche, atteint la
// droite en une demi-période, revient en une demi-période. La proportion lue est
// la part de bûche À GAUCHE du curseur, en pourcentage.
export function positionDuCurseur(ecouleMs, periodeMs) {
  const demi = periodeMs / 2;
  const t = ((ecouleMs % periodeMs) + periodeMs) % periodeMs;
  return t <= demi ? (t / demi) * 100 : (2 - t / demi) * 100;
}

// Une proportion, telle qu'elle s'écrit à l'écran.
export function pourcent(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return `${Math.round(Number(v))} %`;
}

// LE BALAYAGE, EN DIRECT.
//
// POURQUOI IL NE COMPARE PAS DEUX HORLOGES — même raison que le compte à rebours
// du « juste temps », en pire : le curseur parcourt cent points de bûche par
// seconde. Une horloge de téléphone décalée d'une demi-seconde placerait le
// curseur à l'autre bout de la bûche. On décompte donc depuis la RÉCEPTION locale
// du départ, sur `performance.now()`, qui est monotone et ne saute pas.
//
// Il rend l'ÉCOULÉ, pas la position : c'est l'écoulé que le joueur annonce au
// serveur quand il frappe, et c'est de lui que la position se déduit — des deux
// côtés, par la même formule.
export function useBalayage(current, actif = true) {
  const dureeMs = current?.dureeCoupeMs ?? null;
  const roundId = current?.roundId ?? null;
  const dejaEcoule = current?.durationMs != null && current?.resteMs != null
    ? current.durationMs - current.resteMs
    : 0;
  const recuA = current?.recuA ?? null;

  const [ecouleMs, setEcoule] = useState(() => Math.max(0, dejaEcoule));
  const trame = useRef(0);

  useEffect(() => {
    if (dureeMs == null || recuA == null || !actif) return undefined;
    let vivant = true;
    const battre = () => {
      if (!vivant) return;
      const depuis = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - recuA;
      const e = Math.min(dureeMs, dejaEcoule + depuis);
      setEcoule(e);
      // À la fin du temps, le curseur s'arrête : une boucle qui continue de
      // tourner sur un écran figé est un compteur de batterie.
      if (e < dureeMs) trame.current = requestAnimationFrame(battre);
    };
    battre();
    return () => { vivant = false; cancelAnimationFrame(trame.current); };
  }, [dureeMs, dejaEcoule, recuA, actif, roundId]);

  return ecouleMs;
}
