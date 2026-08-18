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
    command: 'npm run build && PORT=8788 DATA_DIR=tests/.data node src/server/index.js',
    url: 'http://localhost:8788/api/health',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
