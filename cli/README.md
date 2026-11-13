# toolcrib (CLI)

Bootstraps and maintains the [toolcrib](https://github.com/escape-llc/toolcrib)
UI toolkit inside your own project. Downloads a release, computes what's
changed, and stages every addition/modification as a reviewable patch — it
never writes to a pre-existing file directly. You (or your AI assistant)
apply what you want with `toolcrib apply`.

This file covers the CLI itself, start to finish. It doesn't cover how to
use any individual component; for that, point your AI assistant at the
toolkit's `ai-docs/` folder, which `toolcrib init` vendors into your project
(see [What this guide doesn't cover](#what-this-guide-doesnt-cover)).

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

**Two version numbers, completely unrelated — never try to align them.**
`npx toolcrib` (or `npm install -g toolcrib`) always resolves to the CLI's
own latest npm release; there's no reason to ever pin it (`npx
toolcrib@1.2.3`), and doing so has nothing to do with which toolkit content
you get. The toolkit itself — the components, `ai-docs/`, everything
`init`/`merge` actually download — is versioned completely separately, as
GitHub Releases. That's what `init`/`merge`'s own `--version` flag targets
(see [Commands](#commands) below), and it already defaults to `latest` on
its own. These two numbers will essentially never match each other, by
design — don't infer one from the other, and don't specify either unless
you have a specific reason to pin a particular release.

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
toolcrib init --with-tests           # also vendor the real component test suite
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

#### `--with-tests`

toolcrib vendors component *source*, not an npm package — the real test
suite (Vitest + React Testing Library + jsdom) can't be vendored the same
unconditional way every other file is, since your project may not use
Vitest at all. `--with-tests` is opt-in: it stages the real test files
under `./toolcrib/__tests__/`, adds their peer dependencies (`vitest`,
`@testing-library/react`, etc.) to your `devDependencies`, and records that
this happened in `.toolcrib-lock.json` (`testsVersion`) so a later `toolcrib
merge` — no extra flag needed — keeps the vendored tests in sync
automatically alongside the core toolkit, once you've opted in.

If your project already uses Vitest, these run as-is. If it uses a
different test runner (Jest, etc.), **exclude `./toolcrib/__tests__/` from
that runner's own config before running your test suite** — a broad glob
could otherwise auto-discover these files and fail on missing Vitest
globals. Either way, they're real reference source: read them, run them, or
hand them to your AI assistant to adapt to whatever you actually use.

A `toolcrib/.toolcrib-tests-config.json` file is also vendored alongside
the lock file — it records the exact peer dependencies the test suite
declares, so a tool reading your project locally (e.g. a future
`toolcrib-mcp` capability) has something to check against without needing
network access. You shouldn't need to read or edit it directly.

Nothing is written to your project yet — see [Reviewing and applying
patches](#reviewing-and-applying-patches) below.

### `toolcrib apply`

Applies everything staged in `./toolcrib-patches/`.

```bash
toolcrib apply
```

This is the command that actually creates/modifies files. It applies each
patch in order and reports how many succeeded. Staged work is never thrown
away:

- A patch that applied is removed from `./toolcrib-patches/`.
- **If any patch fails, nothing else is deleted.** The failed patches stay in
  the folder and are listed, so you can fix the cause and re-run `apply`
  (or delete the folder and run `merge` again).
- Conflict notes and upstream copies from `merge` (under
  `./toolcrib-patches/conflicts/`) are not patches, so `apply` never writes
  them into `./toolcrib/`. They stay in the folder, and `apply` lists them,
  until you delete the folder.
- The folder itself is removed only when everything in it has been dealt with.

`init` and `merge` refuse to start while `./toolcrib-patches/` exists and is
not empty, and tell you to run `toolcrib apply` or delete the folder.

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
- **Whether a newer release is available** — and, when a known, fixed vulnerability affects your installed version specifically, its severity and a link to the fix (generated from real, fixed toolcrib CodeQL findings — see the project's own `AGENTS.md` for how).
- **A `tsconfig.json` compatibility check** — if `moduleResolution` isn't
  set to `"bundler"`, `"node16"`, or `"nodenext"`, `import { ... } from
  '#toolcrib'` will run fine but your editor/`tsc` may falsely report
  "Cannot find module." `doctor` tells you the exact setting to fix it.
- **Bundler-specific notes**, when relevant — for example, on a Next.js
  project it'll remind you that any file rendering toolcrib components
  needs a `'use client'` directive, since Next's App Router treats
  components as server-only by default.
- **Vendored test-suite drift**, only if you've installed it via `--with-tests`
  — reported separately from core drift, so the two never read as one
  merged list.

**`--reprint-managed-block [docId]`** re-prints the current managed block(s)
to stdout instead of running the checks above — for re-injecting the
primer into an agent session that's lost it to context compaction,
without starting a new session:

```bash
toolcrib doctor --reprint-managed-block          # every block found
toolcrib doctor --reprint-managed-block core     # just one docId
```

### `toolcrib merge`

Stages an upgrade from your currently installed version to another.

```bash
toolcrib merge                    # upgrade to latest
toolcrib merge --version 2.1.0    # upgrade to a specific version
```

Works like `init`, but smarter: for every vendored file, it compares three
things — what you originally got, what's actually on disk now, and what
the new version ships — and sorts each file into one of these outcomes:

- **Updated** — you never touched the file; the new version's copy is
  staged as a patch.
- **Kept local** — you edited the file yourself and upstream didn't change
  it; left alone, no patch generated.
- **Merged** — you edited it *and* upstream changed it, but in different
  places. `merge` does a line-level three-way merge (your copy, the version
  you installed, the new version) and stages the merged file as an ordinary
  patch. It uses `git merge-file` when git is installed and a built-in
  merge otherwise. Line endings are normalized for the merge and your
  file's own style (CRLF or LF, and a leading BOM) is kept in the result.
- **Absorbed upstream** — the new release already contains your change (it
  merges to exactly the new version's file, or your file already equals it).
  Reported separately so you can see your patch landed upstream.
- **Conflict** — the edits overlap. The file is staged *with conflict
  markers* (`<<<<<<< local` / `=======` / `>>>>>>> vX.Y.Z`) as a normal
  patch, and listed by path in the summary. A file you edited that upstream
  removed, or one you deleted that upstream changed, can't be merged: your
  file is left untouched and only a note is written.
- **Binary conflict** — a file that isn't valid UTF-8 text (or contains a NUL
  byte) is never line-merged. Your copy is untouched; the upstream copy is
  staged whole, next to a note, in the staging folder.
- **Project-added** — a file under `./toolcrib/` that neither the installed nor
  the new release ships (your own component, say). Listed as kept and never
  touched. (`__tests__/` is only considered when you installed the test suite.)
- **Collision** — you added a file at a path the new release now ships. It is
  three-way merged against an empty base: identical content is absorbed,
  anything else is staged with conflict markers and reported as a collision.

Conflict notes and binary upstream copies are written under
`./toolcrib-patches/conflicts/` as plain files (`<path>.md`, `<path>.upstream`).
They are never written into `./toolcrib/`, because `apply` only applies
`.patch` files. When it finishes, `merge` prints a count for each outcome
above, then the conflicting paths and where their notes are.

Limitation: only files in conflict are checked for binary content. A binary
file that only upstream changed still goes through the ordinary text-patch
path, as before; the toolkit ships text source only.

If you installed the test suite via `toolcrib init --with-tests`, `merge`
keeps it in sync automatically — no separate flag needed here; it checks
`.toolcrib-lock.json` for you.

As with `init`, nothing is written until you run `apply` afterward.

### `toolcrib versions`

Lists every published release.

```bash
toolcrib versions
```

Useful for picking an exact `--version` for `init` or `merge` instead of
always taking `latest`.

### `toolcrib export-patches`

Sends your changes to the vendored toolcrib source back upstream. It
compares `./toolcrib/` against the release recorded in
`toolcrib/.toolcrib-lock.json`, then writes one folder per contribution
to `./toolcrib-upstream/`. Each folder holds `git apply`-able patches
against toolcrib's own `src/` layout, plus a `SUMMARY.md`.

```bash
toolcrib export-patches                       # write folders to ./toolcrib-upstream/
toolcrib export-patches --out ./upstream      # choose another folder
toolcrib export-patches --post                # post each folder as a discussion (asks y/N)
toolcrib export-patches --post --yes          # post without the prompt (needed outside a terminal)
```

- Only `components/`, `theme/`, `eventBus/`, and `observer/` changes are
  exported. Changes to `ai-docs/`, `eslint-rules/`, and vendored tests are
  listed as not exported. Edits to `index.ts` are expected and not
  exported, since upstream regenerates it.
- Changes to shared files are split by contribution. A change that matches
  no contribution is app-specific and not exported. A change that matches
  two is ambiguous and not exported.
- Before posting, fill in each `SUMMARY.md`'s `intent:` lines
  (`bug-fix`, `missing-feature`, or `customization`).
- `--post` creates a discussion in the **Consumer Patches** category of the
  toolcrib repository, using your own `gh` login. It asks y/N first and
  never posts without that answer or `--yes`. A folder that was already
  posted (it has a `posted.json`) is skipped.
- The command never changes your project files. It only reads `./toolcrib/`
  and writes the output folder.

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
You changed a vendored file yourself, and the new version changed it in an
overlapping place. For a text file, `apply` writes it with conflict markers:
resolve each `<<<<<<< local` ... `>>>>>>> vX.Y.Z` block in place. The note at
`./toolcrib-patches/conflicts/<file>.md` shows what upstream changed. For
removed, deleted and binary files nothing is written to your file; read the
note (and the staged `.upstream` copy for binary files). Or hand it to your AI
assistant with "reconcile my local changes to `<file>` with the upstream
update." Delete `./toolcrib-patches/` when you're done; `merge` and `init`
won't run while it's there.

**`merge` or `init` says `./toolcrib-patches/` already holds staged work.**
They refuse to overwrite unapplied patches or conflict notes. Run `toolcrib
apply`, or delete the folder if you're finished with it.

**A bundler-specific note from `doctor`.**
`doctor` detects Next.js, Create React App, Vite, webpack, and Parcel from
files already in your project and calls out anything that specific
tool needs — for instance, Create React App's frozen webpack config
predating `package.json` "imports" support. If nothing's flagged for your
bundler, there's nothing to do.

## What this guide doesn't cover

Everything about actually *using* the toolkit — which component to reach
for, how theming and the event bus work, first-run gotchas with providers
— lives in `ai-docs/`, vendored into your project the first time you run
`toolcrib init`. That folder is written for your AI assistant to read, not
for you to read directly: point your AI assistant at it and let it handle
the rest.

## Contributing to the CLI itself

Working on this tool's own source (not just using it)? See
[CONTRIBUTING.md](CONTRIBUTING.md) for the local-dev workflow, test suite,
and publishing process.
