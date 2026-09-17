// L'EMBLÈME DE « CUEILLETTE », dessiné depuis la géométrie unique.
//
// Une seule fonction pour les deux surfaces qui l'affichent — l'annonce du joueur
// et celle du stream. C'est la leçon des chaînons, qui vivaient en deux copies
// identiques jusqu'à ce qu'un changement de forme en laisse une en arrière.
//
// `taille` est une LARGEUR : la hauteur en découle, l'emblème étant un peu plus
// haut que large. Une surface qui imposerait les deux l'écraserait.
import React from 'react';
import { EMBLEME_CUEILLETTE } from './marque-cueillette.js';

export function EmblemeCueillette({ taille = 140, className = '' }) {
  const e = EMBLEME_CUEILLETTE;
  return (
    <svg className={className} width={taille} height={Math.round(taille * e.rapport)}
      viewBox={e.viewBox} fill="none" stroke="currentColor" strokeWidth={e.trait}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {e.petales.map((d) => <path key={d} d={d} />)}
      <path d={e.coupe} />
      <path d={e.tige} />
      {e.feuilles.map((d) => <path key={d} d={d} />)}
      <path d={e.crayonCorps} />
      <path d={e.crayonVirole} />
      <path d={e.crayonPointe} />
      {/* LA MINE EST PLEINE : trois traits dans un triangle de sept unités se
          rejoindraient en tache. C'est la même règle que les cases de
          « Cache-cache », pleines pour la même raison. */}
      <path d={e.crayonMine} fill="currentColor" stroke="none" />
    </svg>
  );
}
