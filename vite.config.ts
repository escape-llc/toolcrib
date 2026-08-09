/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/__tests__/setup.ts',
    // cli/ is a separate Node project with its own vitest.config.js (see its
    // README) — without this, vitest's default include pattern picks up
    // cli/test/*.test.js here too, which only works by accident (relies on
    // cli/node_modules already being installed) and duplicates what `cd cli
    // && npm test` already runs.
    exclude: [...configDefaults.exclude, 'cli/**'],
  },
});
