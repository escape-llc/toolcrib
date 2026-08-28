# Toolcrib — User Guide

This is the human-facing walkthrough for bootstrapping a project with
toolcrib: the commands you run yourself, in order, with a real example
(`feed-farmer-pwa`, a project actually built this way) at each step. Once
your project is wired up, the day-to-day work of building UI happens in an
AI-guided session — toolcrib is designed for that, not for hand-authoring
components — but getting to that point starts with a few steps only you
can do: creating the project, running the CLI, and wiring the provider.

## 1. Start with a real project

Toolcrib installs into an existing `package.json` — it doesn't scaffold one
for you. Create your project with whatever tool you'd normally use (`npm
create vite@latest`, `create-next-app`, etc.) and get it running before
touching toolcrib at all. `feed-farmer-pwa` started as a plain Vite + React
+ TypeScript app.

## 2. Run `toolcrib init`

From your project root (same directory as `package.json`):

```bash
npx toolcrib init --situation new
```

Use `--situation new` for a greenfield project with no existing UI yet, or
`--situation refactor` if you're introducing toolcrib into an app that
already has one. This downloads the latest release and stages everything
it wants to add — new files, dependency changes, an `AGENTS.md`/`CLAUDE.md`
block — as plain-text patches in `./toolcrib-patches/`. **Nothing in your
project changes yet.**

Open a few of those patch files and skim them — they're ordinary unified
diffs, readable in any editor. When you're satisfied, apply them:

```bash
npx toolcrib apply
```

This is the step that actually creates files: a `./toolcrib/` directory
(the vendored component library — check it into git, it's yours to read
and fork, not a build artifact) plus a `#toolcrib` entry in your
`package.json`'s `"imports"` field. `feed-farmer-pwa`'s came out as:

```json
"imports": {
  "#toolcrib": "./toolcrib/index.ts"
}
```

If your `tsconfig.json`'s `compilerOptions.moduleResolution` isn't
`"bundler"`, `"node16"`, or `"nodenext"`, `apply` (or a later `toolcrib
doctor`) will tell you — that import resolves fine at runtime either way,
but your editor and `tsc` need one of those three settings to understand
`#toolcrib` without falsely reporting "Cannot find module."

## 3. Wire the provider

Every toolcrib component needs a single `<ToolcribProvider>` wrapped
around your app root, or components will throw or silently no-op. This is
the one piece of integration code you write by hand — everything after it
is AI-guided. `feed-farmer-pwa`'s `src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ToolcribProvider } from '#toolcrib';
import App from './App';
import './index.css';

const farmerTheme = {
  initialParameters: {
    baseColor: { h: 145, s: 72, v: 68 },
    harmonyMode: 'analogous',
    hueSpread: 25,
    isDarkMode: true,
  },
} as const;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToolcribProvider theme={farmerTheme}>
      <App />
    </ToolcribProvider>
  </StrictMode>,
);
```

The `theme` prop is optional — omit it for toolcrib's defaults — but it's
the whole knob for making an app not look like every other toolcrib app:
one HSV base color (`h`/`s`/`v`) plus a harmony mode drives the entire
palette. `feed-farmer-pwa` picked hue 145 (a rich green, for a "farming"
feed reader) with an `analogous` spread into teals and limes, and dark
mode on by default. Pick a hue that fits your project and move on — the
rest of the palette derives from it automatically.

## 4. Hand it to your AI assistant

At this point `toolcrib init` has already written a managed block into
your `AGENTS.md` (or `CLAUDE.md`) — toolcrib's own system prompt,
component reference, and conventions, kept in sync by `toolcrib merge` so
it never goes stale. This is the point where you stop hand-writing UI code
and start describing what you want to an AI coding agent (Claude Code or
equivalent) working in this repo. It reads that block automatically the
same way it reads any other project instructions, and builds against the
real component set, theme system, and event bus documented there instead
of hand-rolling ad-hoc CSS and popups. Everything from here — which
component to reach for, how the event bus and form engine work, first-run
provider gotchas — is written for that AI session to read, in `ai-docs/`,
not for you to read directly.

## 5. Staying current

Two read-only commands worth knowing:

```bash
npx toolcrib doctor      # sanity-check your install; never changes anything
npx toolcrib versions    # see what releases exist
```

When a new release lands, the upgrade path mirrors step 2 — stage, review,
apply:

```bash
npx toolcrib merge         # stages the upgrade as patches
# review ./toolcrib-patches/
npx toolcrib apply         # actually upgrades
npx toolcrib doctor        # confirm nothing's left drifted
```

`merge` is smart about files you've hand-edited since installing: it only
proposes a patch for files upstream actually changed, leaves your own
untouched edits alone, and flags a real conflict (you edited it, upstream
also changed it) instead of guessing which version should win.

## Full command reference

This guide covers the bootstrap path start to finish; for every flag, every
command's exact behavior, and troubleshooting, see
**[cli/README.md](cli/README.md)** (or [the CLI on
npm](https://www.npmjs.com/package/toolcrib)) — the CLI's own README, kept
in sync with what actually ships.
