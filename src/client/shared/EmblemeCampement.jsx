// L'EMBLÈME DE « CAMPEMENT », dessiné depuis la géométrie unique — une seule
// fonction pour l'annonce du joueur et celle du stream (la leçon des chaînons).
//
// `taille` est une LARGEUR : la hauteur en découle.
import React from 'react';
import { EMBLEME_CAMPEMENT } from './marque-campement.js';

export function EmblemeCampement({ taille = 140, className = '' }) {
  const e = EMBLEME_CAMPEMENT;
  return (
    <svg className={className} width={taille} height={Math.round(taille * e.rapport)}
      viewBox={e.viewBox} fill="none" stroke="currentColor" strokeWidth={e.trait}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={e.terre} />
      {/* LES TIRETS N'ONT PAS DE BOUTS ARRONDIS : au trait de six, des bouts
          ronds mangeraient trois unités de chaque vide et le chemin
          redeviendrait un trait plein à cent pixels. */}
      <path d={e.chemin} strokeDasharray={e.tirets} strokeLinecap="butt" />
      <path d={e.croix} />
      <path d={e.tente} />
      <path d={e.porte} />
    </svg>
  );
}
