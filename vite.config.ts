/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  // GitHub Pages serves this repo's demo build at <org>.github.io/toolcrib/,
  // not the domain root, so the built asset paths need that prefix — but
  // Vite's `base` applies to the dev server too by default, not just
  // `vite build`, and this repo's whole local dev workflow (this file's own
  // README instructions, every script in this session) assumes
  // http://localhost:5173/ with no prefix. Gating on `command` keeps dev
  // exactly as it's always been and only changes the production build.
  // Update the path here if the repo is ever renamed or moved to a
  // different org.
  base: command === 'build' ? '/toolcrib/' : '/',
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
}));
