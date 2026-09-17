// LA TOILE DE « CUEILLETTE » — dessiner au doigt ou à la souris.
//
// CE QUI A ÉTÉ DEMANDÉ (16/09) : « le joueur a 30 secondes pour reproduire le
// dessin (avec leur doigt sur téléphone, avec la souris sur PC) », et « une zone de
// dessin d'exactement la même taille que l'image du Dessin cible ».
//
// ============================================================================
// UN DESSIN EST UNE SUITE DE TRAITS, EN COORDONNÉES DE 0 À 1
// ============================================================================
//
// La toile ne garde pas de pixels : elle garde des TRAITS, chacun une liste de
// points rapportés à sa propre boîte. Trois raisons, et la troisième est décisive :
// le poids sur le réseau, la mise à l'échelle — le même dessin s'affiche ici, chez
// l'animateur, et en grand sur la toile du stream — et la superposition en vert
// clair par-dessus la cible, qui n'aurait aucun sens avec une image à détourer.
//
// ============================================================================
// POURQUOI `POINTERDOWN` ET LA CAPTURE DU POINTEUR
// ============================================================================
//
// Un seul jeu d'événements pour le doigt, la souris et le stylet : c'est ce que les
// événements de pointeur apportent, et écrire deux chemins reviendrait à corriger
// deux fois chaque défaut. LA CAPTURE compte autant : sans elle, un doigt qui sort
// de la toile en plein trait cesse d'être suivi — le trait s'arrête net au bord, et
// le joueur croit que l'écran a lâché. Avec elle, on continue de recevoir ses
// mouvements et le trait se poursuit, borné à la boîte.
//
// `touch-action: none` sur l'élément est INDISPENSABLE sur téléphone : sans lui, le
// premier mouvement du doigt fait défiler la page au lieu de tracer.
import React, { useCallback, useEffect, useRef, useState } from 'react';

// LE PAS MINIMAL ENTRE DEUX POINTS GARDÉS, en fraction de la boîte.
//
// Un écran rapporte jusqu'à deux cents positions par seconde ; trente secondes de
// tracé en feraient six mille, dont la plupart à moins d'un pixel l'une de l'autre.
// On n'y gagnerait aucune précision — le serveur compare sur une grille de 64 — et
// l'on paierait le poids sur le réseau du salon, mille joueurs à la fois.
const PAS_MINIMAL = 0.004;

export function Toile({
  valeur, onChange, disabled = false, fond = null, superpose = null,
  etiquette = 'Zone de dessin', testid = 'toile',
}) {
  const boite = useRef(null);
  const [traits, setTraits] = useState(() => valeur || []);
  const enCours = useRef(null);

  // LA VALEUR VIENT DU DEHORS QUAND ELLE CHANGE D'IDENTITÉ — une nouvelle manche,
  // un dessin à relire. On ne la réinjecte pas à chaque rendu : le trait en cours
  // serait effacé sous le doigt.
  useEffect(() => { setTraits(valeur || []); }, [valeur === undefined]);

  const position = useCallback((e) => {
    const r = boite.current.getBoundingClientRect();
    // BORNÉ À LA BOÎTE : un doigt qui sort continue d'être suivi — c'est le but de
    // la capture — mais son trait ne sort pas du cadre.
    return [
      Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    ];
  }, []);

  const commencer = (e) => {
    if (disabled) return;
    e.preventDefault();
    boite.current.setPointerCapture?.(e.pointerId);
    enCours.current = [position(e)];
    setTraits((t) => [...t, enCours.current]);
  };

  const suivre = (e) => {
    if (disabled || !enCours.current) return;
    e.preventDefault();
    const p = position(e);
    const dernier = enCours.current[enCours.current.length - 1];
    if (Math.hypot(p[0] - dernier[0], p[1] - dernier[1]) < PAS_MINIMAL) return;
    enCours.current.push(p);
    setTraits((t) => [...t.slice(0, -1), [...enCours.current]]);
  };

  const finir = () => {
    if (!enCours.current) return;
    enCours.current = null;
    // ON NE PRÉVIENT LE DEHORS QU'AU LEVER DU DOIGT. Remonter à chaque point
    // ferait rendre l'écran entier deux cents fois par seconde pendant trente
    // secondes, sur un téléphone.
    setTraits((t) => { onChange?.(t); return t; });
  };

  const annuler = () => {
    if (disabled) return;
    setTraits((t) => { const s = t.slice(0, -1); onChange?.(s); return s; });
  };
  const effacer = () => {
    if (disabled) return;
    setTraits(() => { onChange?.([]); return []; });
  };

  return (
    <div className="toile__bloc">
      <div ref={boite} className={`toile${disabled ? ' toile--figee' : ''}`}
        data-testid={testid} role="img" aria-label={etiquette}
        onPointerDown={commencer} onPointerMove={suivre}
        onPointerUp={finir} onPointerCancel={finir} onPointerLeave={finir}>
        {/* LE FOND — la cible, quand on la montre sous le dessin du joueur. */}
        {fond ? <img className="toile__fond" src={fond} alt="" draggable="false" /> : null}
        <svg className="toile__encre" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
          {/* LE TRACÉ SUPERPOSÉ, s'il y en a un — celui du joueur par-dessus la
              cible, en vert clair. Il passe SOUS le trait courant pour qu'un
              dessin en cours reste au premier plan. */}
          {(superpose || []).map((t, i) => (
            <polyline key={`s${i}`} className="toile__trait toile__trait--sien"
              points={t.map(([x, y]) => `${x * 1000},${y * 1000}`).join(' ')} />
          ))}
          {traits.map((t, i) => (
            <polyline key={i} className="toile__trait"
              points={t.map(([x, y]) => `${x * 1000},${y * 1000}`).join(' ')} />
          ))}
        </svg>
      </div>
      {!disabled && onChange ? (
        <div className="toile__outils">
          <button className="toile__btn" type="button" data-testid="toile-annuler"
            onClick={annuler} disabled={!traits.length}>Annuler le trait</button>
          <button className="toile__btn" type="button" data-testid="toile-effacer"
            onClick={effacer} disabled={!traits.length}>Tout effacer</button>
        </div>
      ) : null}
    </div>
  );
}
