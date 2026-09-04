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
    // cli/ and mcp/ are separate Node projects, each with its own
    // vitest.config.js and its own isolated node_modules (see their own
    // READMEs) — without excluding them here, vitest's default include
    // pattern picks up cli/test/*.test.js and mcp/test/*.test.js here too,
    // failing outright since root's own node_modules never has their
    // dependencies (@modelcontextprotocol/sdk, fuse.js, semver, commander,
    // etc.) installed — confirmed the hard way for mcp/ specifically: this
    // exact failure broke CI on main the moment mcp/ was added, because
    // this exclude list wasn't extended to cover it at the same time.
    // e2e/ is Playwright's own separate suite (see e2e/README.md, run via
    // `npm run test:e2e`) — its specs import `test`/`expect` from
    // `@playwright/test`, not Vitest's, so Vitest picking them up here
    // fails immediately with no `page` fixture.
    exclude: [...configDefaults.exclude, 'cli/**', 'mcp/**', 'e2e/**'],
  },
}));
