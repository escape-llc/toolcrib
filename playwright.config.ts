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
  // Two servers, not one -- `webServer` accepts an array of processes
  // since Playwright 1.24, each with its own `url` Playwright waits on
  // before starting. Every spec except csp-nonce.spec.ts's strict-CSP
  // test uses the first (the plain dev server, matching every other
  // local/CI workflow in this repo); that one test opts into the second
  // via its own `test.use({ baseURL: ... })` (see that file). Both stay
  // running for the whole suite regardless of which specs actually hit
  // which one -- `reuseExistingServer` locally so a server you already
  // have running (e.g. from manual testing) isn't killed/restarted.
  webServer: [
    // Boots the same `npm run dev` every local workflow in this repo
    // already assumes (see vite.config.ts's own comment on why `base` is
    // gated on `command === 'build'` — dev always serves at
    // http://localhost:5173/ with no path prefix).
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    // A real PRODUCTION build (issue #559), not the dev server -- exists
    // purely for csp-nonce.spec.ts's one strict-CSP test, which
    // intercepts EVERY request via `page.route('**/*', route =>
    // route.fetch())` to inject a CSP header. Vite dev mode serves
    // ~1300 unbundled ES modules per page load; a real build collapses
    // that to ~4 files (confirmed directly: `npm run build` output).
    // Under Podman's containerized network path specifically (NOT a raw
    // CPU/throughput issue -- confirmed same hardware, same host,
    // native Windows never reproduced this), that per-request
    // interception multiplied by ~1300 reliably timed out at 30s while
    // every other spec (which never intercepts every request) never
    // did. This is also just a more correct test of the real claim
    // ("toolcrib's actual SHIPPED output produces zero CSP violations"),
    // not an accident of testing dev tooling -- that test previously had
    // to explicitly filter out @vite/client's own violations for
    // exactly this reason (dev-only HMR client script, not part of what
    // ships); testing the real dist output removes that carve-out
    // entirely.
    //
    // `--outDir dist-e2e-prod`, not the default `dist/` -- keeps this
    // fixture from colliding with (or being silently overwritten by) a
    // real release build a contributor might have sitting in `dist/`
    // for deployment purposes.
    //
    // `--base=/` on BOTH commands, explicit rather than relying on
    // either one's own default -- confirmed directly (not assumed) that
    // this matters: `vite.config.ts`'s `base` is a function of Vite's
    // own `command` argument, `'build'` vs `'preview'` vs `'serve'`, and
    // resolves to `/toolcrib/` (the real GitHub Pages path prefix) only
    // for `'build'`. Building this fixture with the REAL default (no
    // `--base` override) bakes `/toolcrib/`-prefixed asset URLs into its
    // HTML, but `vite preview` re-evaluates the config with `command:
    // 'preview'`, which resolves `base` back to `/` and serves assets at
    // plain root regardless -- a real mismatch (confirmed via a live
    // request: the JS bundle 404'd, silently served the SPA-fallback
    // `index.html` instead, wrong `content-type`) that has nothing to do
    // with Podman/CI at all. Passing `--base=/` to `vite build` keeps
    // this fixture's own baked-in asset paths at plain root, matching
    // exactly how `vite preview` already serves by default -- explicit
    // on preview's own invocation too, so this stays correct even if a
    // later change alters `vite.config.ts`'s non-build default.
    {
      command: 'npx tsc && npx vite build --outDir dist-e2e-prod --base=/ && npx vite preview --outDir dist-e2e-prod --base=/ --port 4174 --strictPort',
      url: 'http://localhost:4174',
      reuseExistingServer: !process.env.CI,
      // The build itself (not just the server boot) has to fit inside
      // this window -- longer than the dev server's own 60s for exactly
      // that reason.
      timeout: 120_000,
    },
  ],
});
