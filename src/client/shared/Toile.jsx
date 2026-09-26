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
// premier mouvement du doigt fait défiler la page au lieu de tracer. IL A UNE
// CONTREPARTIE : le doigt ne peut plus faire défiler la page depuis la toile. Tout
// ce dont le joueur a besoin doit donc TENIR DANS L'ÉCRAN — voir la note de
// `.q-zone--cueillette` dans play.css, où le bouton d'envoi s'était retrouvé
// quatre-vingt-neuf pixels sous le pli, hors d'atteinte.
//
// `pointerleave` NE TERMINE PAS LE TRAIT, et c'est la raison même de la capture :
// un doigt qui sort de la toile continue d'être suivi, son trait borné au cadre.
// Le brancher sur la fin revenait à défaire la capture qu'on venait de prendre —
// le trait s'arrêtait net au bord, et le joueur croyait que l'écran avait lâché.
// `pointerup` et `pointercancel` suffisent : la capture garantit qu'ils arrivent.
import React, { useCallback, useEffect, useRef, useState } from 'react';

// LE PAS MINIMAL ENTRE DEUX POINTS GARDÉS, en fraction de la boîte.
//
// Un écran rapporte jusqu'à deux cents positions par seconde ; trente secondes de
// tracé en feraient six mille, dont la plupart à moins d'un pixel l'une de l'autre.
// On n'y gagnerait aucune précision — le serveur compare sur une grille de 64 — et
// l'on paierait le poids sur le réseau du salon, mille joueurs à la fois.
const PAS_MINIMAL = 0.004;

// UN POINT SE DESSINE (26/09) : « impossible de faire des points sur la surface
// de dessin. Il faut toujours tirer le doigt […] il faut faire des points. »
//
// Le point EXISTAIT : un toucher sans glisser pose bien un trait d'un seul point,
// que le serveur rastérise comme une tache (voir `nettoyerDessin`). Mais une
// `polyline` d'un seul point n'a pas de longueur, et le navigateur ne dessine
// RIEN : le joueur tapotait, ne voyait rien, et concluait que la toile refusait
// les points. On le trace donc comme un segment d'un millième de case : les
// bouts arrondis du trait en font un disque de l'épaisseur du trait, sur toutes
// les toiles — téléphone, console, stream. (Un segment de longueur NULLE ne
// suffirait pas : certains navigateurs n'en dessinent pas les bouts.)
function coordonnees(t) {
  const pts = t.length === 1 ? [t[0], [t[0][0] + 0.001, t[0][1]]] : t;
  return pts.map(([x, y]) => `${x * 1000},${y * 1000}`).join(' ');
}

export function Toile({
  valeur, onChange, disabled = false, fond = null, superpose = null,
  etiquette = 'Zone de dessin', testid = 'toile',
}) {
  const boite = useRef(null);
  const [traits, setTraits] = useState(() => valeur || []);
  const enCours = useRef(null);

  // LA VALEUR VIENT DU DEHORS QUAND ELLE CHANGE D'IDENTITÉ — une nouvelle manche,
  // un dessin à relire. On ne la réinjecte pas à chaque RENDU : le trait en cours
  // serait effacé sous le doigt.
  //
  // MAIS À CHAQUE CHANGEMENT D'IDENTITÉ, et non plus seulement quand elle passe
  // de « rien » à « quelque chose » (26/09). L'ancienne dépendance —
  // `valeur === undefined` — ne réagissait qu'à ce passage-là : partager un
  // second dessin au stream laissait LE PREMIER à l'écran, et l'animateur
  // concluait que le bouton « Partager » ne faisait rien. Pendant un tracé, la
  // valeur ne change pas (le dehors n'est prévenu qu'au doigt levé), si bien que
  // rien n'est effacé sous le doigt ; au doigt levé, elle revient identique à ce
  // que la toile a déjà.
  useEffect(() => { setTraits(valeur || []); }, [valeur]);

  const position = useCallback((e) => {
    const r = boite.current.getBoundingClientRect();
    // BORNÉ À LA BOÎTE : un doigt qui sort continue d'être suivi — c'est le but de
    // la capture — mais son trait ne sort pas du cadre.
    return [
      Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    ];
  }, []);

  // ============================================================================
  // RIEN DU TRAIT EN COURS N'EST LU DANS UNE FONCTION DE MISE À JOUR
  // ============================================================================
  //
  // CE QUI A ÉTÉ RAPPORTÉ : « le dessin au téléphone ne fonctionne pas, la zone de
  // dessin disparaît ». Elle ne disparaissait pas : L'ÉCRAN ENTIER TOMBAIT.
  //
  //     TypeError: d.current is not iterable
  //
  // `suivre` écrivait `setTraits((t) => [...t.slice(0, -1), [...enCours.current]])`.
  // La fonction passée à `setTraits` N'EST PAS EXÉCUTÉE TOUT DE SUITE : React la
  // met en file et l'appelle au rendu suivant. Entre les deux, le doigt se lève —
  // `finir` remet `enCours.current` à `null` — et la fonction en file déréférence
  // ce `null`. Le rendu jette, React démonte l'arbre, et le joueur se retrouve
  // devant une page noire au milieu de ses trente secondes.
  //
  // POURQUOI CELA NE S'EST PAS VU À LA SOURIS. Un glissé de souris produit des
  // événements espacés et bien ordonnés ; un doigt qui trace vite en produit des
  // rafales que React regroupe, et c'est le regroupement qui ouvre la fenêtre. Le
  // contrôle de bout en bout dessinait à la souris : il ne pouvait pas le voir.
  //
  // LA RÈGLE, DÉSORMAIS : on capture la valeur AVANT, et la fonction de mise à
  // jour ne lit plus que ses propres arguments. Elle ne peut plus rien apprendre
  // du monde entre le moment où on l'écrit et celui où elle s'exécute.
  const commencer = (e) => {
    if (disabled) return;
    e.preventDefault();
    boite.current.setPointerCapture?.(e.pointerId);
    const debut = [position(e)];
    enCours.current = debut;
    // UNE COPIE DANS L'ÉTAT, JAMAIS LE TABLEAU VIVANT. `enCours.current` est
    // muté à chaque point ; le poser tel quel dans l'état de React reviendrait à
    // modifier l'état en place, ce qui rend le rendu imprévisible.
    setTraits((t) => [...t, [...debut]]);
  };

  const suivre = (e) => {
    const trait = enCours.current;
    if (disabled || !trait) return;
    e.preventDefault();
    const p = position(e);
    const dernier = trait[trait.length - 1];
    if (Math.hypot(p[0] - dernier[0], p[1] - dernier[1]) < PAS_MINIMAL) return;
    trait.push(p);
    const fige = [...trait];
    setTraits((t) => [...t.slice(0, -1), fige]);
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
        onPointerUp={finir} onPointerCancel={finir}>
        {/* LE FOND — la cible, quand on la montre sous le dessin du joueur. */}
        {fond ? <img className="toile__fond" src={fond} alt="" draggable="false" /> : null}
        <svg className="toile__encre" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
          {/* LE TRACÉ SUPERPOSÉ, s'il y en a un — celui du joueur par-dessus la
              cible, en vert clair. Il passe SOUS le trait courant pour qu'un
              dessin en cours reste au premier plan. */}
          {(superpose || []).map((t, i) => (
            <polyline key={`s${i}`} className="toile__trait toile__trait--sien"
              points={coordonnees(t)} />
          ))}
          {traits.map((t, i) => (
            <polyline key={i} className="toile__trait" points={coordonnees(t)} />
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
