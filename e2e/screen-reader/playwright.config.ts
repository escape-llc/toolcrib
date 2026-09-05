import { defineConfig, devices } from '@playwright/test';
import { screenReaderConfig } from '@guidepup/playwright';

/**
 * A deliberately separate pipeline from both the Vitest suite and the
 * Chromium/WebKit e2e pipeline one level up (see e2e/README.md) -- this one
 * drives real NVDA (Windows-only, via @guidepup/playwright) and asserts on
 * actual announced speech, not just ARIA attribute presence the way
 * e2e/accessibility.spec.ts's axe-core scan does. Modeled directly on
 * mui/base-ui's own real, working "Screen Reader (Windows / NVDA)" CI job
 * (test/screen-reader/playwright.config.ts there) -- confirmed by reading
 * their source, not guessed at. `screenReaderConfig` forces `headless:
 * false` and `workers: 1` (NVDA is a singleton; only one instance can run,
 * and screen readers don't work against a headless browser at all).
 *
 * Only runs on Windows (see .github/workflows/screen-reader.yml) -- there is
 * no cross-platform equivalent worth adding here, unlike the Chromium/WebKit
 * split one level up, since VoiceOver (macOS) would need its own separate CI
 * runner and isn't in scope for this pass.
 */
export default defineConfig({
  ...screenReaderConfig,
  testDir: '.',
  testMatch: '*.spec.ts',
  // Real screen-reader interaction is slow and occasionally needs NVDA's own
  // startup/connection retries (up to 20 attempts inside
  // @guidepup/guidepup's NVDAClient) -- a single retry keeps a one-off
  // connection hiccup from failing the whole CI job outright.
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    ...screenReaderConfig.use,
    baseURL: 'http://localhost:5173',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Same demo app and dev server every other e2e spec boots against (see
  // e2e/README.md) -- no dedicated fixture page. reuseExistingServer only
  // locally, matching the root playwright.config.ts's own convention.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
