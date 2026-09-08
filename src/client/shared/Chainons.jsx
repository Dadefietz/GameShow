// LES DEUX CHAÎNONS, dessinés depuis la géométrie unique.
//
// POURQUOI CE COMPOSANT EXISTE. L'emblème vivait en DEUX exemplaires recopiés à
// la main — `Chainons` dans PlayApp.jsx, `ChainonsStream` dans OverlayApp.jsx —
// deux fonctions strictement identiques à leur taille par défaut près. C'est
// exactement la faute que `marque-flamme.js` raconte en tête de fichier : la
// flamme avait vécu en trois copies avant de diverger sans témoin. La géométrie
// était partagée, mais le rendu ne l'était pas ; changer la forme du tracé — ce
// qui vient d'arriver — aurait suffi à en laisser une des deux en arrière.
//
// La flamme a `Flamme.jsx`. Les chaînons ont ce fichier. Une seule fonction, deux
// appelants, plus rien à recopier.
import React from 'react';
import { CHAINONS } from './marque-lien.js';

// LE SEUIL DE L'AMORCE, ET POURQUOI IL EST DANS LE COMPOSANT.
//
// Le jour du maillon mesure 5,1 sur la grille de 24 ; l'amorce en occupe 2,1. Il
// reste donc 1,5 de vide de chaque côté — soit `taille × 1,5 / 24` pixels à
// l'écran. À 34 px cela ne fait plus que 2,1 px : rendu à l'écran, le maillon se
// referme et l'emblème se lit comme deux taches. À 64 px il reste 4 px, et le
// dessin est net. C'est mesuré, pas estimé (voir la planche d'aperçu du chantier).
//
// 56 px est le plancher retenu : 3,5 px de jour. En dessous, le composant retire
// l'amorce de lui-même — deux anneaux nus, propres, qui disent la même chose.
//
// LE SEUIL EST ICI, PAS CHEZ L'APPELANT, pour la même raison que tout ce fichier :
// une règle confiée aux appelants est une règle qu'un troisième appelant oubliera.
// C'est le pendant de l'`escarbille` de la flamme, « réservée aux surfaces où la
// marque a la place de respirer » — sauf qu'ici personne n'a à y penser.
export const TAILLE_MIN_AMORCE = 56;

export function Chainons({ taille = 64, className = '' }) {
  const { viewBox, trait, maillon, amorce, copies } = CHAINONS;
  const avecAmorce = taille >= TAILLE_MIN_AMORCE;
  return (
    <svg className={className} width={taille} height={taille} viewBox={viewBox} fill="none"
      stroke="currentColor" strokeWidth={trait} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      {copies.map((c, i) => (
        <g key={i} transform={`translate(${c.x} ${c.y}) rotate(${c.rotation})`}>
          <path d={maillon} />
          {avecAmorce && (
            <g transform={`scale(${c.amorce} 1)`}><path d={amorce} /></g>
          )}
        </g>
      ))}
    </svg>
  );
}
