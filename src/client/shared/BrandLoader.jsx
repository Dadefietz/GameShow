// Écran de chargement de marque — sert de fallback Suspense pendant le
// téléchargement du chunk de surface. Reprend le loader inline de index.html
// pour une continuité parfaite (aucun flash, aucune bascule visuelle).
import React from 'react';

export function BrandLoader() {
  return (
    <div className="boot" role="status" aria-label="Chargement de Project Game Show">
      <img className="boot__emblem" src="/assets/avatar-emblem-tipi.png" alt="" />
      <span className="boot__name">Project Game Show</span>
      <span className="boot__dots" aria-hidden="true">
        <span className="boot__dot" />
        <span className="boot__dot" />
        <span className="boot__dot" />
      </span>
    </div>
  );
}
