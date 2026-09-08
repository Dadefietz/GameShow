// L'EMBLÈME DE « COUPE TA BÛCHE », dessiné depuis la géométrie unique.
//
// Une seule fonction pour les deux surfaces qui l'affichent — l'annonce du joueur
// et celle du stream. C'est la leçon des chaînons, qui vivaient en deux copies
// identiques jusqu'à ce qu'un changement de forme en laisse une en arrière.
//
// `taille` est une LARGEUR : la hauteur en découle, la bûche étant plus large que
// haute. Une surface qui imposerait les deux l'écraserait.
import React from 'react';
import { BUCHE_HACHE } from './marque-buche.js';

export function BucheHache({ taille = 160, className = '' }) {
  const { viewBox, rapport, trait, buche, cernes, manche, fer } = BUCHE_HACHE;
  return (
    <svg className={className} width={taille} height={Math.round(taille * rapport)}
      viewBox={viewBox} fill="none" stroke="currentColor" strokeWidth={trait}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x={buche.x} y={buche.y} width={buche.largeur} height={buche.hauteur} rx={buche.rayon} />
      {cernes.map((d) => <path key={d} d={d} />)}
      <path d={manche} />
      {/* LE FER EST PLEIN, pas tracé — et c'est ce qui le fait lire.
          Dessiné au trait, ce petit contour fermé devenait un ANNEAU : la hache
          entière se lisait comme une LOUPE, manche compris. La référence fournie
          est un dessin plein ; un tranchant est une masse, pas un cerne. Le
          projet mêle déjà les deux (les pavés du quiz, le moyeu du cadran). */}
      <path d={fer} fill="currentColor" stroke="none" />
    </svg>
  );
}
