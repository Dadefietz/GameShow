// Config Playwright — E2E sur le vrai serveur de jeu (build + Fastify + Socket.IO).
// workers: 1 (les tests partagent un serveur et des salons en mémoire).
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 1,
  timeout: 45_000,
  reporter: [['list'], ['json', { outputFile: 'tests/results/playwright-results.json' }]],
  use: {
    baseURL: 'http://localhost:8788',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // LE DOSSIER DE DONNÉES EST REMIS À ZÉRO AVANT CHAQUE EXÉCUTION. Sans cela
    // la bibliothèque de test s'accumule d'un passage à l'autre : le scénario
    // studio → partie crée « Épreuve témoin » à chaque fois et ne la retire
    // jamais, si bien qu'après quelques exécutions le menu en propose cinq et le
    // contrôle échoue sur une ambiguïté — pas sur un défaut du produit.
    // Même famille que la clôture de salon posée au chantier v1 : un test qui
    // lègue son état au suivant finit par mentir.
    command: 'rm -rf tests/.data && npm run build && PORT=8788 DATA_DIR=tests/.data node src/server/index.js',
    url: 'http://localhost:8788/api/health',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
