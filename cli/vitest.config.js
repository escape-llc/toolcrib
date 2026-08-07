import { defineConfig } from 'vitest/config';

// Without this file, vitest walks up parent directories looking for a
// config and finds the repo root's vite.config.ts (the toolkit's own dev
// app config, which needs `vite` as a dependency — not installed here in
// cli/, since this is a separate Node CLI project, not a Vite app).
// This file stops that upward search at the cli/ boundary.
export default defineConfig({
  test: {
    include: ['test/**/*.test.js'],
  },
});
