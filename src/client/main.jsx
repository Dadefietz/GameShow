import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
// Design system : tokens + polices self-hostées, bundlés par Vite depuis design/ (lecture seule).
import '../../design/tokens/tokens.css';
import './shared/app.css';
import { BrandLoader } from './shared/BrandLoader.jsx';

// Chargement paresseux par surface : chaque route ne télécharge que son code.
// Un joueur mobile (/play) ne charge plus Host/Studio/Overlay ni qrcode/supabase.
const HostApp = lazy(() => import('./host/HostApp.jsx').then((m) => ({ default: m.HostApp })));
const PlayApp = lazy(() => import('./play/PlayApp.jsx').then((m) => ({ default: m.PlayApp })));
const OverlayApp = lazy(() => import('./overlay/OverlayApp.jsx').then((m) => ({ default: m.OverlayApp })));
const StudioApp = lazy(() => import('./studio/StudioApp.jsx').then((m) => ({ default: m.StudioApp })));

const path = window.location.pathname;
const isOverlay = path.startsWith('/overlay');

function pick() {
  if (path.startsWith('/play')) return <PlayApp />;
  if (isOverlay) return <OverlayApp />;
  if (path.startsWith('/studio')) return <StudioApp />;
  return <HostApp />; // '/', '/host'
}

// Overlay OBS : fond transparent, aucun loader visible. Autres surfaces : loader de marque.
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Suspense fallback={isOverlay ? null : <BrandLoader />}>{pick()}</Suspense>
  </React.StrictMode>
);
