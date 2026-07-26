import React from 'react';
import { createRoot } from 'react-dom/client';
// Design system : tokens + polices self-hostées, bundlés par Vite depuis design/ (lecture seule).
import '../../design/tokens/tokens.css';
import './shared/app.css';
import { HostApp } from './host/HostApp.jsx';
import { PlayApp } from './play/PlayApp.jsx';
import { OverlayApp } from './overlay/OverlayApp.jsx';
import { StudioApp } from './studio/StudioApp.jsx';

function Router() {
  const path = window.location.pathname;
  if (path.startsWith('/play')) return <PlayApp />;
  if (path.startsWith('/overlay')) return <OverlayApp />;
  if (path.startsWith('/studio')) return <StudioApp />;
  return <HostApp />; // '/', '/host'
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>
);
