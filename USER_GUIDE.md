# Toolcrib — User Guide

Toolcrib is designed so your AI assistant does almost everything: it reads
`ai-docs/` and writes the actual components, theming, and event-bus code for
you. The one part that's genuinely yours to operate is the **command-line
tool** — installing the toolkit, keeping it up to date, and knowing what to
do when something looks off. That's what this guide covers, start to
finish. It doesn't cover how to use any individual component; for that,
point your AI assistant at `ai-docs/` (see [What this guide doesn't
cover](#what-this-guide-doesnt-cover) at the end).

## Install

No install needed — run it directly:

```bash
npx toolcrib <command>
```

Or install it globally if you'll use it often:

```bash
npm install -g toolcrib
toolcrib <command>
```

Run every command from your project's root — the same directory as your
`package.json`.

## The lifecycle, at a glance

```
toolcrib init  →  review ./toolcrib-patches/  →  toolcrib apply
                                                        │
                        (later, to check in on things)  │
                                                        ▼
                                                toolcrib doctor
                                                        │
                                        (when a new version exists)
                                                        ▼
toolcrib merge  →  review ./toolcrib-patches/  →  toolcrib apply
```

Two ideas make everything else make sense:

1. **Nothing is ever written to an existing file except by `toolcrib
   apply`.** `init` and `merge` only ever compute a diff and save it as a
   `.patch` file in `./toolcrib-patches/` — a folder you can open, read,
   and delete without anything in your project changing. `apply` is the
   only command that actually touches your files, and only for patches
   sitting in that folder.
2. **Every command is safe to run "just to see."** `init`/`merge` never
   modify anything by themselves, and `doctor`/`versions` are read-only.
   If you're ever unsure what a command will do, running it costs nothing
   — the worst case is a `./toolcrib-patches/` folder you don't apply.

## Commands

### `toolcrib init`

Stages the toolkit into your project for the first time.

```bash
toolcrib init
toolcrib init --version 1.2.0        # a specific release instead of latest
toolcrib init --situation new        # greenfield project, no existing UI
toolcrib init --situation refactor   # adopting toolcrib into an existing app
```

What it does: downloads the requested release (`latest` by default),
computes what's new or different compared to what's already in `./toolcrib`
(nothing, the first time you run it), and writes every addition as a
numbered `.patch` file under `./toolcrib-patches/`. It also proposes
patches for `package.json` (adding the toolkit's dependencies and the
`#toolcrib` import alias), `.gitignore`, and an `AGENTS.md`/`CLAUDE.md`
block your AI assistant should read.

`--situation` controls whether a **New Project** or **Refactor** guide gets
added to that instruction-file block, on top of the core rules that are
always included. Skip it and you'll get the core rules only, with a note
telling you to re-run with `--situation` (or add the missing block by hand)
when you're ready.

One thing worth knowing up front: **`init` doesn't take a target folder
argument.** It always vendors into `./toolcrib` relative to wherever you
run it — there's no way to point it at, say, `./src/ui` instead. Run it
from your project root.

Nothing is written to your project yet — see [Reviewing and applying
patches](#reviewing-and-applying-patches) below.

### `toolcrib apply`

Applies everything staged in `./toolcrib-patches/`.

```bash
toolcrib apply
```

This is the command that actually creates/modifies files. It applies each
patch in order, reports how many succeeded, and **deletes the
`./toolcrib-patches/` folder afterward regardless of outcome** — a failed
patch isn't kept around to retry; if something fails, re-run `init` or
`merge` afterward to regenerate fresh patches against your project's
current state, which is more likely to apply cleanly than retrying a stale
one.

If your project isn't already a git repository, `apply` will offer to run
`git init` for you first (it uses `git apply` when possible, since that
gives you normal git tooling — `git diff`, `git checkout -- .` — to inspect
or undo what just landed). Say no and it falls back to a built-in patcher
that doesn't need git at all.

### `toolcrib doctor`

Read-only. Never modifies anything.

```bash
toolcrib doctor
```

Run this any time you want to sanity-check your install without changing
anything. It reports:

- **Local drift** — files under `./toolcrib` that no longer match what the
  installed version actually shipped (usually from hand-editing a vendored
  file directly, which is supported — that's the whole point of vendoring
  — but worth knowing about).
- **Stale instruction-file blocks** — if the `<!-- toolcrib:managed:... -->`
  block in your `AGENTS.md`/`CLAUDE.md` was hand-edited instead of
  regenerated, or is out of date with your installed version.
- **Whether a newer release is available.**
- **A `tsconfig.json` compatibility check** — if `moduleResolution` isn't
  set to `"bundler"`, `"node16"`, or `"nodenext"`, `import { ... } from
  '#toolcrib'` will run fine but your editor/`tsc` may falsely report
  "Cannot find module." `doctor` tells you the exact setting to fix it.
- **Bundler-specific notes**, when relevant — for example, on a Next.js
  project it'll remind you that any file rendering toolcrib components
  needs a `'use client'` directive, since Next's App Router treats
  components as server-only by default.

### `toolcrib merge`

Stages an upgrade from your currently installed version to another.

```bash
toolcrib merge                    # upgrade to latest
toolcrib merge --version 2.1.0    # upgrade to a specific version
```

Works like `init`, but smarter: for every vendored file, it compares three
things — what you originally got, what's actually on disk now, and what
the new version ships — and sorts each file into one of three outcomes:

- **Safe update** — you never touched the file; the new version's copy is
  staged as a patch.
- **Kept as-is** — you edited the file yourself and upstream didn't change
  it; left alone, no patch generated.
- **Conflict** — you edited it *and* upstream changed it too. `merge` won't
  guess which version wins. Instead it writes a `.upstream-diff` note
  explaining what upstream changed, so you (or your AI assistant) can
  reconcile it by hand.

As with `init`, nothing is written until you run `apply` afterward.

### `toolcrib versions`

Lists every published release.

```bash
toolcrib versions
```

Useful for picking an exact `--version` for `init` or `merge` instead of
always taking `latest`.

## Reviewing and applying patches

After `init` or `merge`, you'll have a `./toolcrib-patches/` folder full of
numbered `.patch` files — plain unified diffs. Before running `apply`:

- Open a few and skim them. They're ordinary text; any editor or `git
  diff`-style tool can show them.
- If you're not going to apply them, just delete the folder — nothing else
  has changed yet.
- If everything looks right, run `toolcrib apply`.

## Upgrading — a full example

```bash
toolcrib versions                 # see what's available
toolcrib merge --version 1.4.0    # stage the upgrade
# review ./toolcrib-patches/
toolcrib apply                    # actually upgrade
toolcrib doctor                   # confirm nothing's left drifted
```

## Troubleshooting

**`toolcrib apply` says "No pending patches."**
There's nothing staged — run `init` (first install) or `merge` (upgrade)
first.

**`doctor` warns about `moduleResolution`.**
Set `"moduleResolution": "bundler"` (or `"node16"`/`"nodenext"`) in your
`tsconfig.json`'s `compilerOptions`. Your code still runs fine either way —
this only affects whether `tsc`/your editor understands the `#toolcrib`
import.

**`doctor` (or `merge`) flags a hand-edited instruction-file block.**
The `<!-- toolcrib:managed:... -->` block in `AGENTS.md`/`CLAUDE.md` is
meant to be regenerated by `toolcrib merge`, not edited by hand. Move any
notes of your own outside the fence, then run `merge` to restore it
cleanly.

**`merge` reports a conflict.**
You changed a vendored file yourself, and the new version changed it too.
Check the matching `.upstream-diff` file in `./toolcrib-patches/` for what
upstream did, and reconcile manually — or hand it to your AI assistant with
"reconcile my local changes to `<file>` with the upstream update."

**A bundler-specific note from `doctor`.**
`doctor` detects Next.js, Create React App, Vite, webpack, and Parcel from
files already in your project and calls out anything that specific
tool needs — for instance, Create React App's frozen webpack config
predating `package.json` "imports" support. If nothing's flagged for your
bundler, there's nothing to do.

## What this guide doesn't cover

Everything about actually *using* the toolkit — which component to reach
for, how theming and the event bus work, first-run gotchas with providers
— lives in `ai-docs/`. That folder is written for your AI assistant to
read, not for you to read directly: point your AI assistant at it (see the
root `README.md` for how), and let it handle the rest.
