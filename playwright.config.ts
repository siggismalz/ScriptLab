import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/desktop',
  workers: 1,
  timeout: 30_000,
  reporter: [['list'], ['json', { outputFile: 'artifacts/desktop-ergebnis.json' }]],
  use: { trace: 'retain-on-failure' },
});
