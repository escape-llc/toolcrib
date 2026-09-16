/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';

// Read once at config-eval time (same process either way -- `vite build`
// and `vite dev` both just import this file), not per-request -- the
// commit obviously can't change mid-process. Falls back to 'unknown'
// rather than throwing: a shallow/gitless environment (a downloaded
// tarball with no .git, e.g.) should still produce a working build, just
// without this one label. actions/checkout's default shallow clone (depth
// 1, used by deploy-demo.yml) still has a real HEAD to read, so the real
// deploy always gets a real hash -- this fallback is for the case where
// there's no .git at all, not for shallow-clone depth.
function getCommitHash(): string {
  try {
    return execSync('git rev-parse --short=7 HEAD', { encoding: 'utf-8', cwd: import.meta.dirname }).trim();
  } catch {
    return 'unknown';
  }
}

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
  // Read by demo/App.tsx's header -- see __COMMIT_HASH__'s own declaration
  // in demo/vite-env.d.ts for why this needs a manual ambient type (Vite's
  // own `define` doesn't generate one automatically). JSON.stringify wraps
  // it as a string literal, matching how `define` replaces any identifier
  // with a literal source expression, not a runtime value.
  define: {
    __COMMIT_HASH__: JSON.stringify(getCommitHash()),
  },
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
