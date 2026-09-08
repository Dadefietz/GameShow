// L'EMBLÈME D'UN JEU CLASSIQUE, dessiné depuis la géométrie unique.
//
// Une seule fonction pour les quatre jeux et pour les deux surfaces qui les
// affichent — l'annonce du joueur et celle du stream. C'est la leçon des
// chaînons, qui vivaient en deux copies identiques jusqu'à ce qu'un changement de
// forme en laisse une en arrière ; à quatre emblèmes et deux surfaces, ce serait
// huit copies.
//
// `taille` est une LARGEUR : la hauteur en découle, et elle diffère d'un emblème
// à l'autre — le cadran de l'estimation est large et bas, la coche est haute.
import React from 'react';
import { EMBLEMES_JEUX, TRAIT_JEUX, rapportDe } from './marque-jeux.js';

export function EmblemeJeu({ type, taille = 120, className = '' }) {
  const e = EMBLEMES_JEUX[type];
  if (!e) return null;
  return (
    <svg className={className} width={taille} height={Math.round(taille * rapportDe(type))}
      viewBox={e.viewBox} fill="none" stroke="currentColor" strokeWidth={TRAIT_JEUX}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {type === 'quiz' ? (
        <>
          {/* Le « ? » est du texte : la police du projet le dessine mieux qu'un
              chemin écrit à la main, et il reste lisible à toutes les tailles. */}
          <text x={e.interro.x} y={e.interro.y} textAnchor="middle" dominantBaseline="central"
            fill="currentColor" stroke="none" fontSize={e.interro.taille} fontWeight="700"
            fontFamily="var(--f-display), var(--f-ui)">?</text>
          {e.paves.map((p) => (
            <rect key={`${p.x}-${p.y}`} x={p.x} y={p.y} width={e.pave.l} height={e.pave.h}
              rx={e.pave.r} fill="currentColor" stroke="none" />
          ))}
        </>
      ) : null}

      {type === 'vote' ? (
        <>
          <path d={e.bulletin} />
          {e.lignes.map((d) => <path key={d} d={d} />)}
          {/* Le corps de l'enveloppe est PLEIN : sans cela le bulletin se voit au
              travers et l'image devient un rectangle dans un rectangle. */}
          <path d={e.corps} fill="var(--c-canvas)" />
          {e.pli.map((d) => <path key={d} d={d} />)}
        </>
      ) : null}

      {type === 'estimation' ? (
        <>
          <path d={e.arc} />
          {e.graduations.map((d) => <path key={d} d={d} />)}
          <path d={e.aiguille} />
          <circle cx={e.moyeu.cx} cy={e.moyeu.cy} r={e.moyeu.r} fill="currentColor" stroke="none" />
        </>
      ) : null}

      {type === 'true_false' ? (
        <>
          <path d={e.coche} />
          {e.croix.map((d) => <path key={d} d={d} />)}
          <path d={e.barre} />
        </>
      ) : null}
    </svg>
  );
}
