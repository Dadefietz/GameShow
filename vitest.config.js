// Config Vitest — tests unitaires de la logique serveur (pure, sans DOM).
// La couverture cible les modules de logique pure ; index.js/auth.js/supabase.js
// sont couverts par la suite d'intégration (tests/integration) et les E2E Playwright.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.js'],
    reporters: ['verbose', ['json', { outputFile: 'tests/results/vitest-results.json' }]],
    coverage: {
      provider: 'v8',
      include: [
        'src/server/modules.js',
        'src/server/rooms.js',
        'src/server/engine.js',
        'src/server/store.js',
      ],
      thresholds: { lines: 70, functions: 70, branches: 60 },
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'tests/results/coverage',
    },
  },
});
