# Contributing to the toolcrib CLI

This file is for people working **on** this CLI (`cli/`), not people using it
in their own project — if that's you, see [README.md](README.md) instead
(what actually ships to npm).

## Local development / running without publishing

Three ways to run this CLI against your own changes, in increasing order
of fidelity to what a real published install behaves like.

### 1. Run the file directly — fastest iteration

```bash
node src/index.js init
node src/index.js apply
```

Good for quick iteration on logic. Skips the `bin`/shebang/executable-
permission resolution path entirely, so it won't catch packaging issues.

### 2. `npm link` — live global command, best for active development

```bash
cd cli
npm link                 # once
toolcrib init             # now works from anywhere on your machine
```

This creates a real global symlink back to this folder — edits to `src/`
take effect immediately, no relinking needed. Exercises the actual `bin`
entry and shebang, unlike option 1.

```bash
npm unlink -g toolcrib    # when done
```

### 3. `npm pack` + real global install — closest simulation of a real publish

```bash
cd cli
npm pack                                   # produces toolcrib-<version>.tgz
npm install -g ./toolcrib-<version>.tgz    # a real install: real deps, real files[] whitelist applied
toolcrib init                              # exactly what an end user would type
```

This is the only option of the three that actually respects the `files`
field in `package.json` (see below) — it's the real tarball a publish
would produce, not a symlink to your live source tree. Worth running once
before an actual `npm publish` as a final sanity check.

```bash
npm uninstall -g toolcrib   # when done
```

## Testing

### Unit tests

```bash
npm install
npm test
```

Covers the pure-logic modules without any network access:
- `test/patches.test.js` — `PendingChanges` (patch generation, idempotency,
  line-ending normalization, new-file vs. modification detection)
- `test/deps.test.js` — semver-based dependency classification (add /
  compatible / conflict), including the `workspace:*`-style unrecognized-
  specifier case
- `test/project.test.js` — `.gitignore` proposal idempotency, lock file
  read/write, and a regression test for a real bug (see below)
- `test/github.test.js` — checksum verification (match / mismatch /
  missing-checksum-asset), version resolution, release listing — all with
  `fetch` mocked, no real network calls

A `vitest.config.js` is present in this folder specifically so vitest
doesn't walk up to the repo root's `vite.config.ts` (the toolkit's own dev
app config, which needs `vite` — not installed here, since this is a
separate Node CLI project).

### End-to-end integration test (real network-shaped, no GitHub release required)

This exercises the full `init` → `apply` pipeline for real — real zip
download, real sha256 verification, real extraction, real `git apply` —
against a genuine `npm init`'d project, without needing a published
GitHub release. It works by running a tiny local server
(`integration-test/mock-github-server.js`) that serves a real release zip
built from this repo's own toolkit source, shaped exactly like GitHub's
API and release-asset URLs.

**1. Build a real release from the toolkit source (repo root, not cli/)**

```bash
cd ..                         # repo root, alongside src/, ai-docs/, scripts/
node scripts/build-release.js
node scripts/package-release.js
```

This produces `toolcrib.zip` and `toolcrib.zip.sha256` in the repo root.

**2. Serve it locally**

```bash
cd cli
mkdir -p integration-test/releases
cp ../toolcrib.zip ../toolcrib.zip.sha256 integration-test/releases/
node integration-test/mock-github-server.js
```

Leave this running in its own terminal — it listens on `localhost:9999`.

**3. Run the real CLI against a real dummy project**

In another terminal — either via `node src/index.js` directly, or via
`npm link` (see above) for the real `toolcrib` command:

```bash
mkdir /tmp/dummy-project && cd /tmp/dummy-project
npm init -y

TOOLCRIB_API_BASE=http://localhost:9999/api \
TOOLCRIB_RELEASES_BASE=http://localhost:9999/releases \
toolcrib init

TOOLCRIB_API_BASE=http://localhost:9999/api \
TOOLCRIB_RELEASES_BASE=http://localhost:9999/releases \
toolcrib apply
```

Then inspect `/tmp/dummy-project` — `toolcrib/` should contain every
vendored file, `package.json` should have the real peer dependencies
added, `.gitignore` should have `/toolcrib-patches/`, and
`toolcrib/.toolcrib-lock.json` should record the installed version.

`TOOLCRIB_API_BASE` / `TOOLCRIB_RELEASES_BASE` are the only two overrides
this CLI recognizes — unset, everything targets real GitHub. They exist
specifically to make this kind of test possible without a published
release or real network access.

### Bugs this integration test has already found

Worth keeping this test around — it already found three real issues that
unit tests, by construction, couldn't have caught:

1. **Hang on error** — a failed fetch left `@clack/prompts`' spinner
   interval alive, so the process never exited even after printing the
   error. Fixed by calling `process.exit(1)` explicitly in the CLI's
   top-level error handler rather than only setting `process.exitCode`.
2. **Crash in non-interactive environments** — `p.confirm()` throws a raw
   libuv TTY error (not a catchable message) when stdin/stdout aren't a
   real terminal (CI, scripts, sandboxes). Fixed by detecting
   `process.stdin.isTTY` and defaulting to "yes" for the (safe,
   recoverable) `git init` prompt when non-interactive.
3. **`git apply` rejected the lockfile patch** — its path was built with a
   leading `./`, which `git apply` treats as invalid even though every
   other file's path (built without the leading `./`) applied fine. Fixed
   by dropping the leading `./`; a regression test now locks this in.

## Publishing

```bash
cd cli
npm pack --dry-run    # confirm exactly what would ship — should be
                       # package.json + src/ only, ~20 files
npm publish --dry-run  # same validation a real publish runs (bin-script
                        # checks, package.json normalization), no network write
npm publish
```

### What the `files` field is for

`package.json`'s `files` array is an explicit whitelist of what
`npm publish`/`npm pack` include in the published package — everything
else in this folder (tests, the integration-test mock server, this file,
`package-lock.json`) is left out even though it's sitting right here in
the repo. Without it, npm defaults to "include everything not
gitignored," which would have shipped `test/`, `vitest.config.js`, and
`package-lock.json` to every installer for no reason. `["src"]` was
chosen by actually running `npm pack --dry-run` and confirming it's the
complete, correct set — `package.json`, `README.md`, `LICENSE`, and the
`bin` entry are always included automatically regardless of what's listed.
