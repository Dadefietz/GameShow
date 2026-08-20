import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
// Design system : tokens + polices self-hostées, bundlés par Vite depuis design/ (lecture seule).
import '../../design/tokens/tokens.css';
import './shared/app.css';
import { BrandLoader } from './shared/BrandLoader.jsx';

// Chargement paresseux par surface : chaque route ne télécharge que son code.
// Un joueur mobile ('/') ne charge plus Host/Studio/Overlay ni qrcode/supabase.
const HostApp = lazy(() => import('./host/HostApp.jsx').then((m) => ({ default: m.HostApp })));
const PlayApp = lazy(() => import('./play/PlayApp.jsx').then((m) => ({ default: m.PlayApp })));
const OverlayApp = lazy(() => import('./overlay/OverlayApp.jsx').then((m) => ({ default: m.OverlayApp })));
const StudioApp = lazy(() => import('./studio/StudioApp.jsx').then((m) => ({ default: m.StudioApp })));

const path = window.location.pathname;
const isOverlay = path.startsWith('/overlay');

// Le lien du jeu ('/') mène à la page d'accueil JOUEUR (R1). La page animateur est
// sur /host (accès restreint à l'animateur unique), le stream sur /overlay.
function pick() {
  if (path.startsWith('/host')) return <HostApp />;
  if (isOverlay) return <OverlayApp />;
  if (path.startsWith('/studio')) return <StudioApp />;
  return <PlayApp />; // '/', '/play'
}

// LA MARQUE SUR LES QUATRE SURFACES, /overlay compris (chantier v2, décision 5.2).
// Le stream n'avait AUCUN écran de chargement : entre la navigation et le premier
// rendu, la source OBS montrait du vide.
//
// LA DÉCISION 5.7 DISAIT « fond transparent sur le stream ». Elle reposait sur une
// prémisse PÉRIMÉE : la scène du stream est elle-même opaque depuis qu'elle est un
// canevas fixe (`.stream-fit` peint --c-canvas). Les overlays transparents ont été
// abandonnés le 2026-08-18 ; seul le commentaire avait survécu. Un chargement
// transparent laisserait donc voir… le même brun. Ce qui compte vraiment, et qui
// était faux, c'est que ce brun soit LE MÊME partout — voir index.html.
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Suspense fallback={<BrandLoader />}>{pick()}</Suspense>
  </React.StrictMode>
);
