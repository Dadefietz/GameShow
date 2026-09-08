// L'EMBLÈME DE « RETOUR DE FLAMME », dessiné depuis la géométrie unique.
//
// `taille` est une LARGEUR : la hauteur en découle, et elle dépend du mode —
// quatre tuiles sont plus larges que trois. Une surface qui imposerait les deux
// écraserait l'un des deux modes.
import React from 'react';
import { geometrieDe } from './marque-retour.js';

export function RetourFlamme({ ecart = 2, taille = 200, className = '' }) {
  const g = geometrieDe(ecart);
  return (
    <svg className={className} width={taille} height={Math.round(taille * g.rapport)}
      viewBox={g.viewBox} fill="none" stroke="currentColor" strokeWidth={g.trait}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {/* Les tuiles, pleines : ce sont des IMAGES qui défilent, pas des cases à
          cocher. Un contour vide se lirait comme un formulaire. */}
      {g.centres.map((cx) => (
        <rect key={cx} x={cx - g.tuile / 2} y={g.yTuiles} width={g.tuile} height={g.tuile}
          rx="2" fill="currentColor" stroke="none" />
      ))}
      {/* Le retour en arrière : le crochet, puis sa pointe sur la première tuile. */}
      <path d={g.crochet} />
      <path d={g.pointe} />
      {/* Et le signe qui dit ce que la flèche signifie : la même image. */}
      {g.egal.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}
