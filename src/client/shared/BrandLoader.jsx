// J6 — Chargement de marque. Sert de fallback Suspense pendant le téléchargement
// du chunk de surface, et d'écran d'attente quand la session est là mais l'état
// du salon pas encore reçu.
//
// Trois temps, conformes au design : attente simple, puis réassurance au-delà de
// 4 s, puis sortie de secours (recharger) au-delà de 10 s. Aucun spinner, aucune
// barre de progression — la flamme scintille, les points respirent.
import React, { useEffect, useState } from 'react';
import './brand-loader.css';
import { Flamme } from './Flamme.jsx';
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
        {/* Le dessin vient de la géométrie unique (chantier v2, décision 5.1) :
            il était recopié ici, et l'icône d'onglet en avait déjà divergé. */}
        <Flamme taille={44} anime={!stuck} />
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
