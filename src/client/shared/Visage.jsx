// UN VISAGE DE LA SÉRIE, ET L'EMBLÈME DU JEU.
//
// DEUX CHOSES ICI, ET UNE SEULE RAISON : les trois surfaces (joueur, stream,
// console) affichent les mêmes visages et le même emblème. Un tracé recopié
// diverge — le projet l'a déjà payé une fois avec la flamme.
//
// ---------------------------------------------------------------------------
// LE PORTRAIT DE SUBSTITUTION, ET POURQUOI IL EXISTE
// ---------------------------------------------------------------------------
// La base de visages définitive n'est pas encore livrée. Plutôt que d'attendre —
// ce qui aurait laissé le jeu non jouable, donc non mesurable, donc non éprouvé —
// le client DESSINE un portrait déterministe à partir de l'identifiant. Aucun
// fichier, aucune requête, et deux identifiants différents donnent deux visages
// qu'on distingue au premier coup d'œil : c'est tout ce que le jeu demande.
//
// LE JOUR OÙ LA VRAIE BASE ARRIVE : les entrées du bassin portent un `src`, et
// c'est l'image qui s'affiche. Une seule condition dans ce fichier, et le
// portrait dessiné devient le repli. Rien d'autre à toucher.
//
// LE DESSIN EST DÉTERMINISTE, et ce n'est pas un détail : le même identifiant
// doit donner le même visage sur le téléphone du joueur, sur le stream et sur le
// graphique de l'animateur. Un tirage au hasard à l'affichage ferait de la
// révélation un mensonge — on n'y reconnaîtrait pas ce qu'on vient de voir.
import React from 'react';
import { MASQUES } from './marque-visages.js';

// Empreinte stable d'une chaîne (FNV-1a, 32 bits). Assez pour cinq traits de
// visage, et surtout : identique partout, pour toujours.
function empreinte(id) {
  let h = 0x811c9dc5;
  for (let i = 0; i < String(id).length; i += 1) {
    h ^= String(id).charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

// Les traits, tirés de l'empreinte. Chaque caractéristique prend ses bits à elle :
// deux identifiants voisins ne produisent pas deux visages voisins.
export function traitsDuVisage(id) {
  const h = empreinte(id);
  const bit = (decalage, modulo) => Math.floor(h / 2 ** decalage) % modulo;
  return {
    teint: 25 + bit(0, 6) * 9,          // 25 → 70 : la teinte de la peau
    clarte: 0.62 + bit(3, 5) * 0.055,   // du plus sombre au plus clair
    cheveux: bit(6, 6),                 // 6 coiffures
    teinteCheveux: bit(9, 7) * 47,      // la couleur des cheveux, franchement variée
    ecartYeux: 8 + bit(12, 4),          // 8 → 11
    tailleYeux: 2.6 + bit(15, 3) * 0.5,
    bouche: bit(18, 4),                 // 4 bouches
    accessoire: bit(21, 5),             // 0 = rien, 1 lunettes, 2 barbe, 3 boucles, 4 rien
    largeur: 20 + bit(24, 3) * 1.4,
  };
}

const COIFFURES = [
  'M-21 -8c0-16 9-24 21-24s21 8 21 24c0-9-6-13-21-13s-21 4-21 13z',            // frange large
  'M-21 -10c1-15 9-22 21-22s20 7 21 22c-3-8-9-11-13-7-5 5-12 5-17 0-4-3-9 0-12 7z', // mèche
  'M-20 -12c0-14 8-20 20-20s20 6 20 20c-4-6-10-9-20-9s-16 3-20 9z',            // ras
  'M-22 -4c-1-19 8-28 22-28s23 9 22 28c-2-12-4-18-10-18-8 0-8 4-16 4-9 0-15 2-18 14z', // longs
  'M-19 -14c1-12 8-18 19-18s18 6 19 18c-5-4-11-6-19-6s-14 2-19 6zM-20 -14c-3 6-3 12-2 16M20 -14c3 6 3 12 2 16', // carré
  'M-16 -20c3-8 9-12 16-12s13 4 16 12c-4-4-9-6-16-6s-12 2-16 6z',              // dégarni
];

const BOUCHES = [
  'M-7 12c2.8 3.6 11.2 3.6 14 0',   // sourire
  'M-6 13h12',                       // neutre
  'M-6 14c2.4-3 9.6-3 12 0',         // moue
  'M-6 12c2 4 10 4 12 0c-3 1.6-9 1.6-12 0z', // sourire large
];

// LE VISAGE. `src` d'abord — la vraie base quand elle sera là —, portrait dessiné
// sinon. `taille` est un côté en pixels ; le tracé est en coordonnées relatives,
// il s'adapte donc sans se déformer.
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

export function Visage({ id, src, taille = 220, className = '', titre }) {
  if (!id) return null;
  if (src) {
    return (
      <img className={`visage ${className}`} src={src} width={taille} height={taille}
        alt={titre || ''} draggable="false" />
    );
  }
  const t = traitsDuVisage(id);
  const peau = `oklch(${t.clarte} 0.07 ${t.teint})`;
  const cheveux = `oklch(${0.28 + (t.cheveux % 3) * 0.06} 0.06 ${t.teinteCheveux})`;
  const trait = `oklch(0.22 0.03 50)`;
  return (
    <svg className={`visage ${className}`} width={taille} height={taille} viewBox="-32 -40 64 76"
      role="img" aria-label={titre || 'Un visage'}>
      {/* Le cou et les épaules, pour que la tête ne flotte pas. */}
      <path d="M-7 18h14v8h-14z" fill={peau} />
      <path d="M-26 40c0-11 8-16 19-16s19 5 19 16z" fill={`oklch(${0.34 + (t.bouche % 3) * 0.05} 0.05 ${(t.teinteCheveux + 180) % 360})`} />
      {/* Le visage. */}
      <ellipse cx="0" cy="0" rx={t.largeur} ry={t.largeur * 1.22} fill={peau} />
      {/* Les cheveux, par-dessus le haut du crâne. */}
      <path d={COIFFURES[t.cheveux]} fill={cheveux} />
      {/* Les yeux. */}
      <circle cx={-t.ecartYeux} cy="-2" r={t.tailleYeux} fill={trait} />
      <circle cx={t.ecartYeux} cy="-2" r={t.tailleYeux} fill={trait} />
      {/* La bouche. */}
      <path d={BOUCHES[t.bouche]} fill="none" stroke={trait} strokeWidth="1.9" strokeLinecap="round" />
      {/* L'accessoire, quand il y en a un — c'est lui qui rend deux visages
          proches immédiatement distincts. */}
      {t.accessoire === 1 ? (
        <g fill="none" stroke={trait} strokeWidth="1.5">
          <circle cx={-t.ecartYeux} cy="-2" r="5.4" />
          <circle cx={t.ecartYeux} cy="-2" r="5.4" />
          <path d={`M${-t.ecartYeux + 5.4} -2h${t.ecartYeux * 2 - 10.8}`} />
        </g>
      ) : null}
      {t.accessoire === 2 ? (
        <path d={`M-13 10c0 10 6 15 13 15s13-5 13-15c-3 6-9 8-13 8s-10-2-13-8z`} fill={cheveux} />
      ) : null}
      {t.accessoire === 3 ? (
        <g fill={`oklch(0.80 0.15 ${(t.teinteCheveux + 60) % 360})`}>
          <circle cx={-t.largeur - 1} cy="6" r="2.6" />
          <circle cx={t.largeur + 1} cy="6" r="2.6" />
        </g>
      ) : null}
    </svg>
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
