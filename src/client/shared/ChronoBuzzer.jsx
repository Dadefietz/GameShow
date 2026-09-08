// L'EMBLÈME DE « LE JUSTE TEMPS », dessiné depuis la géométrie unique.
//
// Une seule fonction pour les deux surfaces qui l'affichent — l'annonce du joueur
// et celle du stream. C'est la leçon des chaînons, qui vivaient en deux copies
// identiques : la géométrie était partagée, le rendu ne l'était pas, et le
// premier changement de forme en aurait laissé une en arrière.
//
// `taille` est une LARGEUR : la hauteur en découle, l'emblème étant plus haut que
// large (deux objets empilés). Une surface qui imposerait les deux l'écraserait.
import React from 'react';
import { CHRONO_BUZZER } from './marque-chrono.js';

export function ChronoBuzzer({ taille = 92, className = '' }) {
  const { viewBox, trait, rapport, cadran, couronne, col, aiguille, oreilles, dome, socle } = CHRONO_BUZZER;
  return (
    <svg className={className} width={taille} height={Math.round(taille * rapport)} viewBox={viewBox}
      fill="none" stroke="currentColor" strokeWidth={trait} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      {/* Le chronomètre : couronne, col, oreilles, cadran, aiguille. */}
      <rect x={couronne.x} y={couronne.y} width={couronne.largeur} height={couronne.hauteur} rx={couronne.rayon} />
      <path d={col} />
      {oreilles.map((d) => <path key={d} d={d} />)}
      <circle cx={cadran.cx} cy={cadran.cy} r={cadran.r} />
      <path d={aiguille} />
      {/* Le buzzer, juste dessous. */}
      <path d={dome} />
      <path d={socle} />
    </svg>
  );
}
