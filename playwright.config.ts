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
  // e2e/screen-reader/ has its own dedicated config (single chromium
  // project, NVDA-only, run via its own screen-reader.yml CI workflow) --
  // without this exclusion, this config's recursive testDir scan picks up
  // its specs too and tries to run them against plain Chromium/WebKit with
  // no screen reader available at all ("No available supported screen
  // readers"), which is exactly what broke this job the first time this
  // subdirectory was added.
  testIgnore: '**/screen-reader/**',
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
    // WebKit, not Firefox — this suite exists specifically for real-engine
    // divergence on CSS/focus-visible/animation behavior (see this file's
    // own doc comment and e2e/README.md), and WebKit is where that
    // divergence actually shows up: its `:focus-visible` heuristics and
    // `color-mix()`/relative-color serialization genuinely differ from
    // Chromium's (the latter already produced a real, Chromium-specific
    // axe-core false positive — see AGENTS.md's axe-core section). Firefox
    // agrees with Chromium on both axes far more often, so it adds mostly
    // redundant CI time/flake surface rather than new signal.
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
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
