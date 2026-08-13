import { defineConfig, devices } from '@playwright/test';

/**
 * A deliberately small, separate pipeline from the Vitest suite (`npm test`)
 * — see e2e/README.md for what belongs here and why. Only add a spec here
 * for behavior jsdom cannot express at all (real CSS `color-mix()`
 * resolution, `:focus-visible` matching, a genuine `animationend` firing);
 * everything else belongs in the Vitest suite.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Boots the same `npm run dev` every local workflow in this repo already
  // assumes (see vite.config.ts's own comment on why `base` is gated on
  // `command === 'build'` — dev always serves at http://localhost:5173/
  // with no path prefix). `reuseExistingServer` locally so a server you
  // already have running (e.g. from manual testing) isn't killed/restarted.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
