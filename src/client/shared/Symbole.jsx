// UN SIGNE DE « RETOUR DE FLAMME », dessiné depuis la déclaration unique.
//
// Les trois surfaces l'affichent : le défilé du joueur, celui du stream, et les
// deux graphiques de la révélation. Une seule fonction, quatre tailles — la leçon
// des chaînons, qui vivaient en deux copies identiques jusqu'à ce qu'un changement
// de forme en laisse une en arrière.
//
// LA TUILE EST CARRÉE, ET LE CHIFFRE Y OCCUPE LA MÊME PLACE QUE LA FIGURE. C'est
// la seule chose qui rende le jeu jouable : un défilé où les chiffres seraient
// petits et les figures grandes donnerait un indice de famille à chaque image, et
// l'œil suivrait ça plutôt que le signe lui-même.
import React from 'react';
import { GRILLE, TRAIT, symboleDe, libelleDe } from './symboles.js';

export function Symbole({ id, taille = 220, className = '', titre }) {
  const s = symboleDe(id);
  if (!s) return null;
  const nom = titre != null ? titre : libelleDe(id);
  return (
    <svg className={`symbole ${className}`} width={taille} height={taille}
      viewBox={`0 0 ${GRILLE} ${GRILLE}`} fill="none" stroke="currentColor"
      strokeWidth={TRAIT} strokeLinecap="round" strokeLinejoin="round"
      role="img" aria-label={nom}>
      {s.famille === 'figure' ? (
        s.figure.type === 'cercle'
          ? <circle cx={s.figure.cx} cy={s.figure.cy} r={s.figure.r} />
          : <path d={s.figure.d} />
      ) : (
        // LE CHIFFRE EST DANS LE MÊME SVG QUE LES FIGURES, et pas à côté : c'est
        // ce qui lui donne exactement la même boîte, le même centrage et la même
        // couleur héritée. Deux rendus différents pour deux familles, ce serait
        // deux façons de se décaler.
        <text x={GRILLE / 2} y={GRILLE / 2} textAnchor="middle" dominantBaseline="central"
          fill="currentColor" stroke="none" fontSize="17" fontWeight="700"
          fontFamily="var(--f-display), var(--f-ui)" letterSpacing="-0.02em">
          {s.chiffre}
        </text>
      )}
    </svg>
  );
}
