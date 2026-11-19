// LES CARTES DE « CAMPEMENT ».
//
// `CarteReponse` — la carte avec ville, et des points posés dessus. Le téléphone
// y montre le point du joueur, la console et le stream tous les points du
// cercle. UN SEUL COMPOSANT pour les trois : « les points doivent être orange
// avec un contour noir », trois fois dans l'énoncé, et trois dessins finiraient
// par ne plus se ressembler.
//
// `CarteAPointer` — la carte sans ville, sur laquelle le joueur pose son point,
// et qu'il agrandit en pinçant.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { diametreDuPoint, positionSurLaCarte, zoomerAutour, bornerLaVue, ZOOM_MAX } from './campement.js';

// LES POINTS SONT DESSINÉS À LA TAILLE DU POINT ROUGE DE LA CARTE — c'est ce qui
// fait que « toucher le point rouge » se voit comme il se compte (voir
// `RAYON_POINT_CAMPEMENT` côté serveur). Leur diamètre est en pour cent de la
// largeur de la carte ; un plancher en pixels (dans la feuille de style) les
// garde visibles sur une petite carte de téléphone.
// `bloc` AJOUTE une classe, il ne remplace pas `cpcarte` : la carte et ses
// points ont UNE règle de dessin (dans app.css), et chaque surface ne fait que
// donner sa taille au cadre.
// LA VILLE EST REDESSINÉE PAR-DESSUS LES POINTS, plus petite qu'eux (`cible`).
//
// Le point rouge est déjà DANS l'image de la carte réponse — mais vu à l'écran,
// deux défauts : sur un téléphone il ne fait que quatre pixels, et le point
// orange d'un joueur tombé pile le recouvre entièrement, si bien que la ville
// disparaît précisément quand quelqu'un l'a trouvée. Le repère posé au-dessus,
// au même endroit, règle les deux : la ville se voit toujours, et un point pile
// se lit comme un anneau orange autour d'un cœur rouge — « touché ».
export function CarteReponse({ src, rapport = 1, points = [], moi = null, cible = null, rayon, bloc = '',
  testid, etiquette = 'La carte réponse' }) {
  const d = diametreDuPoint(rayon, rapport);
  const style = (p) => ({ left: `${p.x * 100}%`, top: `${p.y * 100}%`, width: `${d}%` });
  return (
    <div className={`cpcarte${bloc ? ` ${bloc}` : ''}`} role="img" aria-label={etiquette} data-testid={testid}
      style={{ aspectRatio: `1 / ${Number(rapport) > 0 ? rapport : 1}` }}>
      <img className="cpcarte__image" src={src} alt="" draggable="false" />
      {points.map((p, i) => (
        <span className="cpcarte__point" key={i} style={style(p)} data-testid={testid ? `${testid}-point` : undefined} />
      ))}
      {/* LE POINT DU JOUEUR, PAR-DESSUS LES AUTRES et légèrement plus grand :
          sur le téléphone, c'est le sien qu'il vient chercher. */}
      {moi ? (
        <span className="cpcarte__point cpcarte__point--moi" style={style(moi)}
          data-testid={testid ? `${testid}-moi` : undefined} />
      ) : null}
      {cible ? (
        <span className="cpcarte__ville" style={{ left: `${cible.x * 100}%`, top: `${cible.y * 100}%`, width: `${d * 0.6}%` }}
          data-testid={testid ? `${testid}-ville` : undefined} />
      ) : null}
    </div>
  );
}

// LA RÉPARTITION DU CERCLE EN QUATRE TRANCHES — pile, tout près, dans le
// cercle, dehors. « Tu peux ajouter des statistiques en t'inspirant du module
// Estimation en fonction de la précision des joueurs » : c'est le même geste que
// l'histogramme de l'estimation, calé sur le barème — chaque barre est une
// tranche de points, et non une distance que le public ne saurait pas lire.
//
// LES LONGUEURS SONT RELATIVES À LA TRANCHE LA PLUS FOURNIE, comme celles de
// l'estimation : on montre une forme. Le nombre exact est écrit au bout.
export function TranchesCampement({ tranches = [], bloc = '', testid }) {
  const max = Math.max(1, ...tranches.map((t) => t.n || 0));
  return (
    <ul className={`cptr${bloc ? ` ${bloc}` : ''}`} data-testid={testid}>
      {tranches.map((t) => (
        <li className={`cptr__ligne cptr__ligne--${t.cle}`} key={t.cle}
          data-testid={testid ? `${testid}-${t.cle}` : undefined} data-n={t.n}>
          <span className="cptr__nom">{t.nom}</span>
          <span className="cptr__barre" aria-hidden="true">
            <span className="cptr__plein" style={{ width: `${((t.n || 0) / max) * 100}%` }} />
          </span>
          <span className="cptr__n">{t.n || 0}</span>
        </li>
      ))}
    </ul>
  );
}

// LA CARTE OÙ L'ON POSE SON POINT.
//
// « Le joueur doit être capable de placer un point orange sur la carte afin
// d'estimer où se trouve la Ville cible. Il doit également être capable de
// zoomer ou dézoomer la carte avec ses doigts pour être plus précis sur le
// placement du point. »
//
// TROIS GESTES, ET UN SEUL POSE UN POINT :
//   — un APPUI BREF (le doigt bouge de moins de huit pixels) pose le point ;
//   — DEUX DOIGTS pincent : zoom autour du milieu des doigts, et ce qui était
//     sous eux y reste ;
//   — UN DOIGT QUI GLISSE déplace la carte agrandie.
// Un glissé ou un pincement ne pose JAMAIS de point : un joueur qui déplace la
// carte pour chercher une région ne doit pas voir son point sauter sous son
// doigt à chaque fois qu'il le lève.
//
// LE NAVIGATEUR NE ZOOME PAS LA PAGE (`touch-action: none` sur le cadre) : sans
// cela, le pincement agrandirait l'écran entier, chrono et bouton compris, et
// le joueur se retrouverait à vingt secondes de la fin dans une page qu'il ne
// sait plus remettre d'aplomb.
//
// LE POINT GARDE SA TAILLE À L'ÉCRAN quel que soit le zoom : il est contre-mis à
// l'échelle. Un point qui grossirait avec la carte masquerait, au zoom maximal,
// la région exacte que le joueur cherche à viser.
const SEUIL_APPUI = 8;

export function CarteAPointer({ src, rapport = 1, point, onPoser, disabled = false, testid = 'cp-carte' }) {
  const cadre = useRef(null);
  const image = useRef(null);
  const [vue, setVue] = useState({ s: 1, tx: 0, ty: 0 });
  const vueRef = useRef(vue);
  vueRef.current = vue;
  // Les doigts posés : identifiant → position de départ et position courante.
  const doigts = useRef(new Map());
  const geste = useRef(null);

  // LA VUE EST TENUE EN DEUX ENDROITS, et toujours ensemble : l'état pour le
  // rendu, la référence pour les gestes. Plusieurs mouvements de doigts arrivent
  // entre deux rendus ; lus dans l'état, ils partiraient tous de la même vue
  // périmée, et le pincement avancerait par à-coups.
  const appliquer = useCallback((nv) => { vueRef.current = nv; setVue(nv); }, []);

  // UNE NOUVELLE CARTE REPART DÉZOOMÉE : la manche précédente avait peut-être
  // laissé un coin d'un autre pays agrandi.
  useEffect(() => { appliquer({ s: 1, tx: 0, ty: 0 }); }, [src, appliquer]);

  // LA TAILLE DE LA CARTE SE MESURE, ELLE NE SE DÉCLARE PAS EN CSS.
  //
  // La carte doit prendre tout ce qui reste de l'écran en gardant son rapport :
  // la plus petite des deux dimensions décide. La première version le disait en
  // CSS, avec les unités de conteneur (`min(100cqw, 100cqh)`) — et la carte
  // mesurait ZÉRO sur le téléphone : relevé dans le navigateur, `100cqw` valait
  // bien 350 px, mais toute formule employant `cqh` rendait 0, le conteneur
  // flexible n'ayant pas de hauteur « définie » au moment où l'unité se résout.
  // C'est la troisième fois qu'une hauteur en cascade de boîtes flexibles efface
  // une image de ce dépôt (deux fois la cible de « Cueillette »). On ne joue plus
  // à ce jeu : on mesure la place réellement donnée, et on pose des pixels.
  const boite = useRef(null);
  const [cote, setCote] = useState(null);
  const r = Number(rapport) > 0 ? Number(rapport) : 1;
  useEffect(() => {
    const el = boite.current;
    if (!el) return undefined;
    const mesurer = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) setCote(Math.floor(Math.min(width, height / r)));
    };
    mesurer();
    if (typeof ResizeObserver !== 'function') return undefined;
    const ro = new ResizeObserver(mesurer);
    ro.observe(el);
    return () => ro.disconnect();
  }, [r]);

  const taille = () => {
    const r = cadre.current?.getBoundingClientRect();
    return r ? { r, l: r.width, h: r.height } : null;
  };

  const poser = useCallback((clientX, clientY) => {
    if (disabled || !onPoser) return;
    const pos = positionSurLaCarte(clientX, clientY, image.current?.getBoundingClientRect());
    if (pos) onPoser(pos);
  }, [disabled, onPoser]);

  const surDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // LA CAPTURE GARDE LE DOIGT À LA CARTE quand il en sort en glissant. Elle
    // peut être refusée (un doigt que le navigateur ne connaît plus) : le geste
    // continue sans elle plutôt que de casser l'écran en pleine manche.
    try { cadre.current?.setPointerCapture?.(e.pointerId); } catch { /* sans capture */ }
    doigts.current.set(e.pointerId, { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY });
    const t = taille();
    if (!t) return;
    if (doigts.current.size === 1) {
      geste.current = { type: 'appui', vue0: vueRef.current };
    } else if (doigts.current.size === 2) {
      // LE PINCEMENT COMMENCE : on retient l'écart des doigts et leur milieu.
      const [a, b] = [...doigts.current.values()];
      geste.current = {
        type: 'pince',
        ecart: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mx: (a.x + b.x) / 2 - t.r.left,
        my: (a.y + b.y) / 2 - t.r.top,
      };
    }
  };

  const surMove = (e) => {
    const d = doigts.current.get(e.pointerId);
    if (!d) return;
    d.x = e.clientX;
    d.y = e.clientY;
    const t = taille();
    if (!t || !geste.current) return;
    if (geste.current.type === 'pince' && doigts.current.size >= 2) {
      // LE PINCEMENT AVANCE PAR PETITS PAS, d'un mouvement à l'autre : zoom
      // autour du milieu PRÉCÉDENT des doigts, puis déplacement du milieu
      // précédent au milieu actuel. C'est ce qui garde sous les doigts ce qui y
      // était — même quand la main glisse en pinçant.
      const [a, b] = [...doigts.current.values()];
      const ecart = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mx = (a.x + b.x) / 2 - t.r.left;
      const my = (a.y + b.y) / 2 - t.r.top;
      const g = geste.current;
      const v = vueRef.current;
      const zoomee = zoomerAutour(v, v.s * (ecart / g.ecart), g.mx, g.my, t.l, t.h);
      appliquer(bornerLaVue({ s: zoomee.s, tx: zoomee.tx + (mx - g.mx), ty: zoomee.ty + (my - g.my) }, t.l, t.h));
      geste.current = { type: 'pince', ecart, mx, my };
      return;
    }
    if (doigts.current.size === 1) {
      const bouge = Math.hypot(d.x - d.x0, d.y - d.y0);
      if (geste.current.type === 'appui' && bouge > SEUIL_APPUI) {
        geste.current = { type: 'glisse', vue0: vueRef.current, x0: d.x, y0: d.y };
      }
      if (geste.current.type === 'glisse') {
        const v0 = geste.current.vue0;
        appliquer(bornerLaVue({ s: v0.s, tx: v0.tx + (d.x - geste.current.x0), ty: v0.ty + (d.y - geste.current.y0) }, t.l, t.h));
      }
    }
  };

  const surUp = (e) => {
    const d = doigts.current.get(e.pointerId);
    doigts.current.delete(e.pointerId);
    if (!d) return;
    const g = geste.current;
    // UN APPUI BREF POSE LE POINT — et seulement si aucun autre doigt n'a
    // participé au geste : la fin d'un pincement n'est pas un appui.
    if (g && g.type === 'appui' && doigts.current.size === 0
      && Math.hypot(d.x - d.x0, d.y - d.y0) <= SEUIL_APPUI) {
      poser(e.clientX, e.clientY);
    }
    if (doigts.current.size === 0) geste.current = null;
    else if (g && g.type === 'pince') {
      // Un doigt levé sur deux : le geste devient un glissé du doigt restant,
      // et JAMAIS un appui — sinon lever le second doigt poserait un point.
      const [reste] = [...doigts.current.values()];
      geste.current = { type: 'glisse', vue0: vueRef.current, x0: reste.x, y0: reste.y };
    }
  };

  // LA MOLETTE ET LE PAVÉ TACTILE, pour l'ordinateur. Le jeu se joue au
  // téléphone, mais rien n'interdit de rejoindre depuis un portable — et un jeu
  // de précision sans zoom y serait injouable.
  useEffect(() => {
    const el = cadre.current;
    if (!el) return undefined;
    const surRoue = (e) => {
      e.preventDefault();
      const t = taille();
      if (!t) return;
      const v = vueRef.current;
      appliquer(zoomerAutour(v, v.s * Math.exp(-e.deltaY / 300), e.clientX - t.r.left, e.clientY - t.r.top, t.l, t.h));
    };
    el.addEventListener('wheel', surRoue, { passive: false });
    return () => el.removeEventListener('wheel', surRoue);
  }, [appliquer]);

  // LES BOUTONS « + » ET « − » : le zoom au doigt n'est pas le seul geste
  // possible — un pouce seul, une main occupée, un lecteur d'écran. Ils zooment
  // autour du centre du cadre.
  const zoomBouton = (facteur) => {
    const t = taille();
    if (!t) return;
    const v = vueRef.current;
    appliquer(zoomerAutour(v, v.s * facteur, t.l / 2, t.h / 2, t.l, t.h));
  };

  const contre = 1 / vue.s;
  return (
    <div className="cpj" ref={boite}>
      <div className={`cpj__cadre${disabled ? ' cpj__cadre--fige' : ''}`} ref={cadre} data-testid={testid}
        data-zoom={vue.s.toFixed(2)}
        style={{ aspectRatio: `1 / ${r}`, width: cote ? `${cote}px` : '100%' }}
        role="application" aria-label="La carte. Touche l'endroit où se trouve la ville ; pince pour zoomer."
        onPointerDown={surDown} onPointerMove={surMove} onPointerUp={surUp} onPointerCancel={surUp}>
        <div className="cpj__plan"
          style={{ transform: `translate(${vue.tx}px, ${vue.ty}px) scale(${vue.s})` }}>
          <img className="cpj__image" ref={image} src={src} alt="" draggable="false" />
          {point ? (
            <span className="cpj__point" data-testid={`${testid}-point`}
              data-x={point.x} data-y={point.y}
              style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%`, transform: `translate(-50%, -50%) scale(${contre})` }} />
          ) : null}
        </div>
        <div className="cpj__zoom">
          <button type="button" className="cpj__zoom-btn" aria-label="Zoomer" data-testid={`${testid}-plus`}
            disabled={vue.s >= ZOOM_MAX}
            onPointerDown={(e) => e.stopPropagation()} onClick={() => zoomBouton(1.6)}>+</button>
          <button type="button" className="cpj__zoom-btn" aria-label="Dézoomer" data-testid={`${testid}-moins`}
            disabled={vue.s <= 1}
            onPointerDown={(e) => e.stopPropagation()} onClick={() => zoomBouton(1 / 1.6)}>−</button>
        </div>
      </div>
    </div>
  );
}
