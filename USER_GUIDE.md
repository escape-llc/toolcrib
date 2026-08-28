# Toolcrib — User Guide

This is the human-facing walkthrough for bootstrapping a project with
toolcrib: what has to happen, in order, with a real example
(`feed-farmer-pwa`, a project actually bootstrapped this way) at each
step. Every step below can be done by typing the commands yourself, or by
directing an AI coding agent to run them for you — `feed-farmer-pwa`'s own
bootstrap, CLI commands included, was done entirely by an AI agent under
human direction, not hand-typed. Read this as "what needs to happen and
why," not "what you personally must type."

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
around your app root, or components will throw or silently no-op. `AGENTS.md`/
`CLAUDE.md` (written by `init` in the step above) already tells an AI agent
to do this as part of setup — but if you're wiring it by hand, or checking
what the agent produced, here's `feed-farmer-pwa`'s own `src/main.tsx`:

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

**Example prompt covering steps 1–3**, if you're directing an AI agent
through the whole bootstrap rather than typing it yourself:

> Bootstrap this project with toolcrib. Run `npx toolcrib init --situation
> new`, show me a summary of what landed in `./toolcrib-patches/`, then run
> `npx toolcrib apply`. Wire `<ToolcribProvider>` around the app root with
> a theme that fits a [describe your project — e.g. "developer analytics
> dashboard, dark mode by default"] — pick an HSV base color and harmony
> mode that fits.

## 4. Building the UI itself

`toolcrib init` has already written a managed block into your `AGENTS.md`
(or `CLAUDE.md`) — toolcrib's own system prompt, component reference, and
conventions, kept in sync by `toolcrib merge` so it never goes stale. From
here, describe what you want to an AI coding agent (Claude Code or
equivalent) working in this repo rather than hand-writing UI code — it
reads that block automatically the same way it reads any other project
instructions, and builds against the real component set, theme system, and
event bus documented there instead of hand-rolling ad-hoc CSS and popups.
Everything from here — which component to reach for, how the event bus and
form engine work, first-run provider gotchas — is written for that AI
session to read, in `ai-docs/`, not for you to read directly.

**Example prompts to get started building:**

> Build a settings page using toolcrib components: a sidebar-grouped nav,
> a form with Zod-validated fields, and a save button that shows a toast
> on success.

> Add a data table showing our [feeds/orders/users/...] with sortable
> columns, a search box, and a Drawer that opens with the full detail when
> a row is clicked.

> Build a dashboard: a row of summary cards at the top, a chart below, and
> a modal for editing an entry, triggered from each card.

> This app doesn't have any UI yet — read `ai-docs/NEW_APP.md` and
> propose a page layout for [describe what the app does] before writing
> any code.

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
