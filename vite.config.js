import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Front React/Vite. publicDir = src/public (tokens, polices, assets servis à la racine).
export default defineConfig({
  root: '.',
  publicDir: 'src/public',
  build: { outDir: 'dist', emptyOutDir: true },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
      '/socket.io': { target: 'http://localhost:8787', ws: true },
    },
  },
});
