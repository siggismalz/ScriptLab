import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Echte Windows-Host- und COM-Prüfungen erhalten nacheinander dieselben Ressourcen.
    maxWorkers: 1,
  },
});
