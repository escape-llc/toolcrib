import { defineConfig } from 'vitest/config';

// Same reasoning as cli/vitest.config.js: without this, vitest walks up to
// the repo root's vite.config.ts, which needs `vite` as a dependency --
// not installed here, since this is a separate Node package, not a Vite app.
export default defineConfig({
  test: {
    include: ['test/**/*.test.js'],
    coverage: {
      provider: 'v8',
      all: true,
      include: ['src/**/*.js'],
      // index.js is the bin entry -- three lines, no branches, unconditional
      // top-level invocation. It can't be exercised without spawning a real
      // subprocess (that's what the integration test is for); its real
      // logic (arg parsing, error handling, server wiring) lives in
      // lib/cli.js instead, which is fully unit-tested.
      exclude: ['src/index.js'],
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
});
