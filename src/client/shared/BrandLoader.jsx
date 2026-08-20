// J6 — Chargement de marque. Sert de fallback Suspense pendant le téléchargement
// du chunk de surface, et d'écran d'attente quand la session est là mais l'état
// du salon pas encore reçu.
//
// Trois temps, conformes au design : attente simple, puis réassurance au-delà de
// 4 s, puis sortie de secours (recharger) au-delà de 10 s. Aucun spinner, aucune
// barre de progression — la flamme scintille, les points respirent.
import React, { useEffect, useState } from 'react';
import './brand-loader.css';
import { NOM_DU_JEU } from './marque.js';

export function BrandLoader() {
  const [phase, setPhase] = useState('loading'); // loading | slow | stuck

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('slow'), 4000);
    const t2 = setTimeout(() => setPhase('stuck'), 10000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const stuck = phase === 'stuck';

  return (
    <div className="boot" data-state={phase} role="status" aria-live="polite"
      aria-label={`Chargement de ${NOM_DU_JEU}`}>
      <span className={`boot__mark${stuck ? '' : ' boot__mark--alive'}`} aria-hidden="true">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
          <g stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
            <g className={stuck ? undefined : 'brand-flame'}>
              <path d="M12 2.9c3 3.7 4.5 6.1 4.5 8a4.5 4.5 0 01-9 0c0-1.7.9-3.4 2.6-5.2" />
            </g>
            <path d="M3.4 18.7l17.2-3.5" />
            <path d="M3.4 15.2l17.2 3.5" />
          </g>
          <circle className={stuck ? undefined : 'brand-spark'} cx="12" cy="12.6" r="1.5" fill="currentColor" />
        </svg>
      </span>

      <p className="boot__name">Project<br />Game Show</p>

      {stuck ? (
        <>
          <p className="boot__text">
            La connexion n'aboutit pas. Vérifie ton réseau, puis recharge la page.
          </p>
          <button className="boot__reload" type="button" data-action="reload"
            onClick={() => window.location.reload()}>
            Recharger
          </button>
        </>
      ) : (
        <>
          <span className="boot__dots" aria-hidden="true">
            <span className="boot__dot" /><span className="boot__dot" /><span className="boot__dot" />
          </span>
          <p className="boot__text">On approche du feu…</p>
          {phase === 'slow' ? (
            <p className="boot__text boot__text--dim">
              Le réseau prend son temps. Reste sur cette page, ça arrive.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
