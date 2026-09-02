// UN VISAGE DE LA SÉRIE, ET L'EMBLÈME DU JEU.
//
// DEUX CHOSES ICI, ET UNE SEULE RAISON : les trois surfaces (joueur, stream,
// console) affichent les mêmes visages et le même emblème. Un tracé recopié
// diverge — le projet l'a déjà payé une fois avec la flamme.
//
// LE PORTRAIT DESSINÉ A ÉTÉ RETIRÉ. Le jeu a tourné quelques heures sur des
// portraits que le client fabriquait à partir de l'identifiant, le temps que la
// banque d'images soit choisie et posée. Il n'en reste rien : « on ne garde que
// la vraie banque, on design avec la vraie banque ». Un visage sans adresse
// n'affiche donc plus rien — et le contrôle de la banque
// (tests/unit/visages.test.js) rougit si une adresse déclarée ne correspond à
// aucun fichier servi, ce qui est le seul chemin qui mènerait là.
import React from 'react';
import { MASQUES } from './marque-visages.js';

// LE PRÉCHARGEMENT DES VISAGES D'UNE SÉRIE.
//
// Un visage reste DEUX SECONDES à l'écran. Une image qui arrive en retard, c'est
// un visage qu'on n'a pas vu — donc une manche faussée, sans que rien ne le
// signale ni côté joueur ni côté serveur. C'est le défaut le plus vicieux que ce
// jeu puisse avoir : il ne casse rien, il fausse.
//
// On charge donc les vingt-neuf images dès l'annonce, pendant que l'animateur
// présente le jeu. Le navigateur les garde en cache ; l'affichage devient
// instantané. Sans `src` — tant que la vraie base n'est pas livrée — il n'y a
// rien à charger, et la fonction ne fait rien.
export function prechargerVisages(ids, srcDe) {
  if (typeof window === 'undefined' || !Array.isArray(ids)) return;
  for (const id of ids) {
    const src = typeof srcDe === 'function' ? srcDe(id) : null;
    if (!src) continue;
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
  }
}

// LE VISAGE. Une image de la banque, carrée, servie depuis /visages.
// `taille` est un côté en pixels ; l'image est carrée par construction, elle ne
// se déforme donc jamais.
export function Visage({ id, src, taille = 220, className = '', titre }) {
  if (!id || !src) return null;
  return (
    <img className={`visage ${className}`} src={src} width={taille} height={taille}
      alt={titre || ''} draggable="false" loading="eager" decoding="async" />
  );
}

// L'EMBLÈME — trois masques superposés, décalés vers la droite. Écran d'annonce
// du joueur et du stream, à deux tailles, un seul tracé.
export function MasquesVisages({ taille = 200, className = '' }) {
  const { viewBox, trait, contour, oeilGauche, oeilDroit, sourire, copies } = MASQUES;
  return (
    <svg className={className} width={taille} height={taille * 0.88} viewBox={viewBox}
      fill="none" stroke="currentColor" strokeWidth={trait} strokeLinecap="round" aria-hidden="true">
      {copies.map((c, i) => (
        <g key={i} transform={`translate(${c.x} ${c.y}) scale(${c.echelle})`} opacity={c.opacite}>
          <path d={contour} />
          <circle cx={oeilGauche.cx} cy={oeilGauche.cy} r={oeilGauche.r} fill="currentColor" stroke="none" />
          <circle cx={oeilDroit.cx} cy={oeilDroit.cy} r={oeilDroit.r} fill="currentColor" stroke="none" />
          <path d={sourire} />
        </g>
      ))}
    </svg>
  );
}
