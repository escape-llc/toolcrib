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

## Reproducing a Linux/CI-only failure locally

```
npm run test:e2e:linux -- e2e/some.spec.ts --project=chromium
```

CI runs on `ubuntu-latest`, and this suite drives real browsers — real
CSS/font-metric rendering genuinely differs between a contributor's own
OS (Windows, macOS) and CI's Linux runner. Confirmed directly, not
theoretically (issue #542): a fix that measurably worked against a real
local Windows browser produced byte-identical failures on CI three pushes
in a row, because the actual discrepancy (a header title's own wrap
point, which depends on real glyph widths) simply never reproduced
outside a Linux font stack — nothing was wrong with the reasoning, the
local repro was just impossible on that platform.

`scripts/run-e2e-in-container.mjs` (wired up as `test:e2e:linux` above)
runs the exact same command inside Microsoft's official Playwright Docker
image — the identical browser build this repo's own CI uses, tagged from
this repo's own installed `@playwright/test` version so it can never
silently drift out of sync with a Playwright bump. Works with either
Docker Desktop or Podman, whichever is on `PATH` (force one with
`CONTAINER_ENGINE=docker` or `CONTAINER_ENGINE=podman` if both are
installed). Every argument after `--` is forwarded straight to
`playwright test`, so any subset/project selection Playwright's own CLI
supports works here too.

This is *not* a byte-perfect stand-in for CI's own `ubuntu-latest` runner
image, worth knowing before trusting a clean local container run as
final proof — a GitHub-hosted runner is a full VM image with its own
broad, separately-maintained font-package list, while this is Microsoft's
own minimal Playwright image with only what the browsers themselves need.
Confirmed directly: the exact failure this tool was built to chase down
didn't reproduce in the container at all, only on the real CI runner,
because Ubuntu's default sans-serif fallback isn't consistently the same
literal font+metrics across every "Ubuntu 24.04" image. Use this to
rapidly iterate on anything CSS/rendering-adjacent without a multi-minute
CI round trip each time, but treat CI itself as the final word before
merging.

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
