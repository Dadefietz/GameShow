import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Front React/Vite. publicDir = src/public (tokens, polices, assets servis à la racine).
export default defineConfig({
  root: '.',
  publicDir: 'src/public',
  // `emptyOutDir` EST DÉSACTIVÉ, ET CE N'EST PAS UN CONFORT.
  //
  // Le dépôt vit dans un dossier synchronisé par iCloud. Chaque suppression de
  // fichier y déclenche une écriture de synchronisation : vider `dist/` — 875
  // fichiers — a mesuré 250 s sur 263 s de build, soit 95 % du temps total
  // (relevé par PLUGIN_TIMINGS de Rolldown, pas une estimation). La suite E2E
  // reconstruit avant de démarrer : elle était devenue INEXÉCUTABLE, Playwright
  // abandonnant avant la fin du build.
  //
  // CE QUE COÛTE CE CHOIX : les fragments d'anciens builds restent dans `dist/`.
  // Ils ne sont jamais servis — `index.html` est réécrit à chaque build et ne
  // référence que les empreintes courantes — et le dossier est hors dépôt.
  //
  // LE VRAI REMÈDE EST HORS DU CODE : sortir le dépôt (ou au moins `dist/`) de
  // la synchronisation iCloud. Tant qu'il y est, aucun réglage de build ne
  // rendra les suppressions rapides.
  build: { outDir: 'dist', emptyOutDir: false },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
      '/socket.io': { target: 'http://localhost:8787', ws: true },
    },
  },
});
