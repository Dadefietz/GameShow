import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
// Design system : tokens + polices self-hostées, bundlés par Vite depuis design/ (lecture seule).
import '../../design/tokens/tokens.css';
import './shared/app.css';

// Chargement paresseux par surface : chaque route ne télécharge que son code.
// Un joueur mobile (/play) ne charge plus Host/Studio/Overlay ni qrcode/supabase.
const HostApp = lazy(() => import('./host/HostApp.jsx').then((m) => ({ default: m.HostApp })));
const PlayApp = lazy(() => import('./play/PlayApp.jsx').then((m) => ({ default: m.PlayApp })));
const OverlayApp = lazy(() => import('./overlay/OverlayApp.jsx').then((m) => ({ default: m.OverlayApp })));
const StudioApp = lazy(() => import('./studio/StudioApp.jsx').then((m) => ({ default: m.StudioApp })));

function pick() {
  const path = window.location.pathname;
  if (path.startsWith('/play')) return <PlayApp />;
  if (path.startsWith('/overlay')) return <OverlayApp />;
  if (path.startsWith('/studio')) return <StudioApp />;
  return <HostApp />; // '/', '/host'
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Suspense fallback={null}>{pick()}</Suspense>
  </React.StrictMode>
);
