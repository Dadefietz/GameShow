// L'EMBLÈME DE « CACHE-CACHE », dessiné depuis la géométrie unique.
//
// Une seule fonction pour les deux surfaces qui l'affichent — l'annonce du joueur
// et celle du stream. C'est la leçon des chaînons, qui vivaient en deux copies
// identiques jusqu'à ce qu'un changement de forme en laisse une en arrière.
//
// `taille` est une LARGEUR : la hauteur en découle, l'emblème étant plus haut que
// large. Une surface qui imposerait les deux l'écraserait.
import React from 'react';
import { EMBLEME_CACHE } from './marque-cache.js';

export function EmblemeCache({ taille = 140, className = '' }) {
  const { viewBox, rapport, trait, oeil, cils, cases, cote, rayon } = EMBLEME_CACHE;
  return (
    <svg className={className} width={taille} height={Math.round(taille * rapport)}
      viewBox={viewBox} fill="none" stroke="currentColor" strokeWidth={trait}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={oeil} />
      {cils.map((d) => <path key={d} d={d} />)}
      {/* PLEINES, pas tracées — voir `marque-cache.js` : à l'épaisseur du système,
          neuf carrés tracés deviennent une gaufre. */}
      {cases.map((c) => (
        <rect key={c.place} x={c.x} y={c.y} width={cote} height={cote} rx={rayon}
          fill="currentColor" stroke="none" />
      ))}
    </svg>
  );
}
