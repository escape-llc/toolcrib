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
