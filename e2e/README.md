# e2e/ — real-browser smoke tests

A separate pipeline from the Vitest suite (`npm test`), run via
`npm run test:e2e` (Playwright, real Chromium) against the demo app.

## Scope: what belongs here

**Only** behavior jsdom (what the Vitest suite runs on) cannot express at
all, no matter how the test is written:

- Real CSS resolution — `color-mix()`, computed `outline`/`transform` after
  a stylesheet rule wins over (or loses to) an inline style.
- Pseudo-class matching that depends on real input-device heuristics —
  `:focus-visible` (Chromium suppresses the ring after recent pointer input,
  shows it after real keyboard navigation; jsdom has no such heuristic at
  all, so a jsdom test could only assert the CSS rule exists, not that it
  behaves correctly for a keyboard user).
- Real CSS animations — whether an `animationend` genuinely fires (jsdom
  never runs the CSS animation/paint pipeline, so a component relying on
  Radix Presence waiting for one — see Toast, Tooltip — can look correct in
  jsdom while being permanently stuck open in a real browser).

If a jsdom + Testing Library test in `src/__tests__/` *can* express the same
assertion, it belongs there instead — this suite is deliberately small and
should stay that way. Don't add a spec here to re-verify something the
Vitest suite already covers just because "real browser" sounds more
thorough.

## Running locally

```
npm run test:e2e       # headless
npm run test:e2e:ui    # Playwright's interactive UI mode
```

`playwright.config.ts` boots `npm run dev` automatically (and reuses one
you already have running locally) — no manual server start needed.

## `screen-reader/` — a separate, Windows-only sub-pipeline

`e2e/screen-reader/` drives real NVDA (via `@guidepup/playwright`) and
asserts on actual announced speech, not just ARIA attribute presence the
way `accessibility.spec.ts`'s axe-core scan does — see its own
`playwright.config.ts` for why it's a separate config/CI workflow
(`.github/workflows/screen-reader.yml`) rather than a project inside this
directory's own config. NVDA is Windows-only and a singleton, so it can't
run alongside the Chromium/WebKit suite above.

```
npx guidepup install         # one-time: downloads a portable NVDA build
npx guidepup setup           # one-time: configures NVDA settings guidepup needs
npm run test:screen-reader
```

Real screen-reader automation needs true, uncontested OS focus on the
browser window for the run's duration — on a shared interactive desktop
(an IDE, another automation tool, anything else with a window open) this can
be genuinely flaky in ways a clean, single-purpose CI runner isn't. Don't
read a local failure/empty-capture here as proof of a regression on its own
— check the CI run.
