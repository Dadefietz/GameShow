// « CHASSE AUX ÉTOILES » — LE CIEL, PARTAGÉ PAR LE TÉLÉPHONE ET LE STREAM.
//
// « Bien entendu c'est la même disposition pour chacun des joueurs et pour
// l'écran de stream. » Un seul composant la dessine, sur les deux : le même
// rectangle de trois sur quatre, les mêmes points, les mêmes allumages aux mêmes
// instants.
import React, { useEffect, useRef, useState } from 'react';
import { ecouleMaintenant } from './temps.js';
import { etoile as formeEtoile } from './marque-etoiles.js';

// LA FORME D'UNE ÉTOILE ALLUMÉE — celle de l'emblème, à quatre branches. Le
// point éteint est un disque ; l'étoile allumée change de FORME, pas seulement
// d'éclat : « le halo et l'animation doivent différencier les étoiles actives
// sans dépendre uniquement de la couleur ».
const ECLAT = formeEtoile(12, 12, 12, 0.2);

// L'HORLOGE DU JEU, ET CE QU'ELLE MONTRE.
//
// Elle tourne à la cadence de l'écran (`requestAnimationFrame`) mais NE
// REDESSINE QUE CE QUI CHANGE : la phase, le chiffre du compte à rebours, la
// seconde du chrono, et l'ensemble des étoiles allumées. Vingt points et un chrono
// redessinés soixante fois par seconde pour rien feraient ramer un vieux
// téléphone — et « conserver un affichage fluide » est demandé.
//
// LE TEMPS EST CELUI DE LA MANCHE, décompté depuis sa réception (`recuA`), sans
// jamais comparer deux horloges — voir `ecouleMaintenant`.
export function useJeuEtoiles(current, eteintes = []) {
  const [vue, setVue] = useState(() => ({ phase: 'compte', compte: 3, reste: 20, allumees: [] }));
  const cle = useRef('');
  const eteintesRef = useRef(eteintes);
  eteintesRef.current = eteintes;
  useEffect(() => {
    if (!current || current.type !== 'etoiles') return undefined;
    let id = 0;
    const compteMs = current.compteAReboursMs ?? 3000;
    const jeuMs = current.dureeJeuMs ?? 20000;
    const tour = () => {
      const brut = ecouleMaintenant(current);
      if (brut != null) {
        const e = brut - compteMs;
        const phase = e < 0 ? 'compte' : e < jeuMs ? 'jeu' : 'fin';
        const compte = phase === 'compte' ? Math.ceil(-e / 1000) : 0;
        const reste = phase === 'jeu' ? Math.ceil((jeuMs - e) / 1000) : phase === 'fin' ? 0 : Math.round(jeuMs / 1000);
        const ete = eteintesRef.current;
        const allumees = phase === 'jeu'
          ? (current.allumages || []).filter((a) => e >= a.debut && e < a.fin && !ete.includes(a.k))
            .map((a) => ({ k: a.k, etoile: a.etoile }))
          : [];
        const k = `${phase}|${compte}|${reste}|${allumees.map((a) => a.k).join(',')}`;
        if (k !== cle.current) {
          cle.current = k;
          setVue({ phase, compte, reste, allumees });
        }
      }
      id = requestAnimationFrame(tour);
    };
    id = requestAnimationFrame(tour);
    return () => cancelAnimationFrame(id);
  }, [current?.roundId, current?.recuA]);
  return vue;
}

// L'INSTANT DU JEU À L'INSTANT PRÉSENT — pour l'annonce d'une touche.
export function instantDuJeu(current) {
  const brut = ecouleMaintenant(current);
  return brut == null ? null : brut - (current.compteAReboursMs ?? 3000);
}

// LES DIX MEILLEURS — en direct pendant la manche, figés à la révélation.
//
// « Sur toute la longueur droite de l'écran, on voit les scores en direct des 10
// meilleurs joueurs. » Et à la révélation, « le classement des 10 meilleurs
// joueurs avec le détail de leurs bons et mauvais clics ». UN SEUL TABLEAU pour
// les deux moments : le public voit le même tableau se figer, il ne change pas
// d'écran au moment où il lit le résultat.
//
// LE SERVEUR LE COMPOSE (canal du staff seul) ; l'écran n'affiche que celui de la
// manche en cours — un tableau attardé d'une manche précédente ferait applaudir
// les mauvais noms.
export function ClassementEtoiles({ donnee, roundId, bloc = '', testid = 'etoiles-top', fmt = String }) {
  const lignes = donnee && donnee.roundId === roundId ? donnee.lignes : [];
  return (
    <div className={`ettop${bloc ? ` ${bloc}` : ''}`} data-testid={testid} data-final={donnee?.final ? 'oui' : 'non'}>
      <p className="ettop__titre">{donnee?.final ? 'Les meilleurs chasseurs' : 'En direct'}</p>
      {lignes.length ? (
        <ol className="ettop__liste">
          {lignes.map((l, i) => (
            <li className="ettop__ligne" key={`${l.pseudo}-${i}`} data-testid={`${testid}-ligne`}>
              <span className="ettop__rang">{i + 1}</span>
              <span className="ettop__nom" title={l.pseudo}>{l.pseudo}</span>
              <span className="ettop__detail" aria-label={`${l.bons} étoiles, ${l.rates} à côté`}>
                <span className="ettop__bons">{l.bons}</span>
                <span className="ettop__sep" aria-hidden="true">/</span>
                <span className="ettop__rates">{l.rates}</span>
              </span>
              <span className={`ettop__score${l.score < 0 ? ' ettop__score--neg' : ''}`}>{fmt(l.score)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="ettop__vide">Les premières étoiles vont tomber…</p>
      )}
    </div>
  );
}

// LE CIEL.
//
// LA TAILLE SE MESURE, comme la carte de « Campement » : une hauteur posée en
// cascade de boîtes flexibles a déjà effacé trois images de ce dépôt. Le ciel
// prend la plus grande taille au format trois sur quatre qui tient dans sa boîte.
//
// CHAQUE ÉTOILE EST UN BOUTON PLUS GRAND QUE SON POINT : la zone de touche fait
// quarante-huit pixels (« une zone de touche adaptée aux écrans tactiles »),
// quand le point blanc n'en fait que sept. Les étoiles sont espacées d'au moins
// un sixième de la largeur du ciel : deux zones ne se recouvrent pas.
//
// LA TOUCHE PART AU CONTACT (`pointerdown`), pas au relâcher : sur une étoile
// qui reste six dixièmes de seconde, attendre que le doigt se lève coûterait le
// dixième qui fait la différence.
export function Ciel({ ciel = [], format = { largeur: 3, hauteur: 4 }, allumees = [], onToucher, actif = false,
  retours = [], bloc = '', testid = 'ciel' }) {
  const boite = useRef(null);
  const [taille, setTaille] = useState(null);
  const ratio = (format.largeur || 3) / (format.hauteur || 4);
  useEffect(() => {
    const el = boite.current;
    if (!el) return undefined;
    const mesurer = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) {
        const l = Math.floor(Math.min(width, height * ratio));
        setTaille({ l, h: Math.floor(l / ratio) });
      }
    };
    mesurer();
    if (typeof ResizeObserver !== 'function') return undefined;
    const ro = new ResizeObserver(mesurer);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ratio]);
  const allumage = new Map(allumees.map((a) => [a.etoile, a.k]));
  return (
    <div className={`ciel-boite${bloc ? ` ${bloc}` : ''}`} ref={boite}>
      <div className="ciel" data-testid={testid}
        style={taille ? { width: `${taille.l}px`, height: `${taille.h}px` } : { width: '100%', aspectRatio: `${format.largeur} / ${format.hauteur}` }}>
        {ciel.map((p, i) => {
          const k = allumage.get(i);
          const allumee = k !== undefined;
          return (
            <button key={i} type="button" tabIndex={actif ? 0 : -1}
              className={`ciel__etoile${allumee ? ' ciel__etoile--allumee' : ''}`}
              style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
              data-testid={`${testid}-etoile`} data-i={i} data-allumee={allumee ? 'oui' : 'non'}
              aria-label={allumee ? `Étoile ${i + 1}, allumée` : `Étoile ${i + 1}`}
              disabled={!actif}
              onPointerDown={actif ? (e) => { e.preventDefault(); onToucher?.(i, allumee ? k : null); } : undefined}>
              {allumee ? (
                <span className="ciel__halo" aria-hidden="true">
                  <svg className="ciel__eclat" viewBox="0 0 24 24" aria-hidden="true"><path d={ECLAT} /></svg>
                </span>
              ) : <span className="ciel__point" aria-hidden="true" />}
            </button>
          );
        })}
        {/* LE RETOUR D'UNE TOUCHE — « +20 » doré ou « −20 » sur le point touché,
            une demi-seconde. Il ne ressemble à aucune étoile : du texte, pas un
            éclat — « ne pas ajouter d'effets qui rendent la cible ambiguë ». */}
        {retours.map((r) => {
          const p = ciel[r.etoile];
          if (!p) return null;
          return (
            <span key={r.id} className={`ciel__retour ciel__retour--${r.bon ? 'bon' : 'rate'}`} aria-hidden="true"
              style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}>
              {r.texte}
            </span>
          );
        })}
      </div>
    </div>
  );
}
