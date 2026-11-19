// L'EMBLÈME DE « CHASSE AUX ÉTOILES », dessiné depuis la géométrie unique — une
// seule fonction pour l'annonce du joueur et celle du stream.
import React from 'react';
import { EMBLEME_ETOILES } from './marque-etoiles.js';

export function EmblemeEtoiles({ taille = 120, className = '' }) {
  const e = EMBLEME_ETOILES;
  return (
    <svg className={className} width={taille} height={Math.round(taille * e.rapport)}
      viewBox={e.viewBox} fill="currentColor" stroke="none" aria-hidden="true">
      {e.etoiles.map((d, i) => <path key={i} d={d} />)}
      {e.points.map((p, i) => <circle key={`p${i}`} cx={p.cx} cy={p.cy} r={p.r} />)}
    </svg>
  );
}
