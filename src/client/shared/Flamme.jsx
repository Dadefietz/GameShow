// LA FLAMME, dessinée depuis la géométrie unique (chantier v2, décision 5.1).
//
// Un seul composant pour toutes les surfaces : le chargement, le stream, et tout
// ce qui viendra. Avant, chaque fichier recopiait les mêmes tracés — et l'un des
// trois exemplaires avait déjà dérivé sans que rien ne le signale.
import { FLAMME } from './marque-flamme.js';

// `anime` porte les classes d'animation du système : la flamme respire, la
// braise scintille, l'escarbille monte. Sans elle, le même dessin, immobile —
// c'est le seul écart entre les deux états, et c'est voulu.
export function Flamme({ taille = 44, anime = true, escarbille = false }) {
  return (
    <svg width={taille} height={taille} viewBox={FLAMME.viewBox} fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth={FLAMME.trait} strokeLinecap="round">
        <g className={anime ? 'brand-flame' : undefined}>
          <path d={FLAMME.flamme} />
        </g>
        {FLAMME.buches.map((d) => <path key={d} d={d} />)}
      </g>
      <circle className={anime ? 'brand-spark' : undefined}
        cx={FLAMME.braise.cx} cy={FLAMME.braise.cy} r={FLAMME.braise.r} fill="currentColor" />
      {escarbille ? (
        <circle className={anime ? 'brand-ember' : undefined}
          cx={FLAMME.escarbille.cx} cy={FLAMME.escarbille.cy} r={FLAMME.escarbille.r}
          fill="currentColor" />
      ) : null}
    </svg>
  );
}
