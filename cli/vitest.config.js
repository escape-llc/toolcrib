import { defineConfig } from 'vitest/config';

// Without this file, vitest walks up parent directories looking for a
// config and finds the repo root's vite.config.ts (the toolkit's own dev
// app config, which needs `vite` as a dependency — not installed here in
// cli/, since this is a separate Node CLI project, not a Vite app).
// This file stops that upward search at the cli/ boundary.
export default defineConfig({
  test: {
    include: ['test/**/*.test.js'],
    coverage: {
      provider: 'v8',
      // `all: true` (with a matching `include`) reports every src/ file in
      // the percentage, even one with zero tests importing it at all --
      // without this, a file nothing exercises is silently absent from the
      // table entirely rather than showing as 0%, which is exactly the gap
      // that hid apply.js/versions.js/git.js having no dedicated test file.
      all: true,
      include: ['src/**/*.js'],
    },
  },
});
