// L'EMBLÈME DE « FRONTIÈRES », dessiné depuis la géométrie unique.
//
// Une seule fonction pour les deux surfaces qui l'affichent — l'annonce du
// joueur et celle du stream. C'est la leçon des chaînons, qui vivaient en deux
// copies identiques jusqu'à ce qu'un changement de forme en laisse une en
// arrière.
//
// `taille` est une LARGEUR : la hauteur en découle, l'emblème étant un peu moins
// haut que large. Une surface qui imposerait les deux l'écraserait.
import React from 'react';
import { EMBLEME_FRONTIERES } from './marque-frontieres.js';

export function EmblemeFrontieres({ taille = 140, className = '' }) {
  const e = EMBLEME_FRONTIERES;
  return (
    <svg className={className} width={taille} height={Math.round(taille * e.rapport)}
      viewBox={e.viewBox} fill="none" stroke="currentColor" strokeWidth={e.trait}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={e.terre} />
      <path d={e.crochet} />
      {/* LE POINT EST PLEIN — voir la note de `POINT` : à cette échelle, un
          disque de trois unités et demie tracé au trait du système se remplit
          de lui-même, en moins net. */}
      <circle cx={e.point.cx} cy={e.point.cy} r={e.point.r} fill="currentColor" stroke="none" />
    </svg>
  );
}
