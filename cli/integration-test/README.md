# Testing toolcrib-cli

## Unit tests

```
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
  read/write, and a regression test for a real bug found during
  integration testing (see below)
- `test/github.test.js` — checksum verification (match / mismatch /
  missing-checksum-asset), version resolution, release listing — all
  with `fetch` mocked, no real network calls

## End-to-end integration test (real network-shaped, no GitHub required)

This exercises the full `init` → `apply` pipeline for real — real zip
download, real sha256 verification, real extraction, real `git apply` —
against a genuine `npm init`'d project, without needing a published
GitHub release. It works by running a tiny local server
(`integration-test/mock-github-server.js`) that serves a real release zip
built from your actual toolkit repo, shaped exactly like GitHub's API and
release-asset URLs.

### 1. Build a real release from your toolkit repo

```
cd /path/to/your/toolcrib-toolkit-repo
node scripts/build-release.js
node scripts/package-release.js
```

This produces `toolcrib.zip` and `toolcrib.zip.sha256` in that repo's root.

### 2. Serve it locally

```
mkdir -p integration-test/releases
cp /path/to/toolcrib-toolkit-repo/toolcrib.zip integration-test/releases/
cp /path/to/toolcrib-toolkit-repo/toolcrib.zip.sha256 integration-test/releases/
node integration-test/mock-github-server.js
```

Leave this running in its own terminal — it listens on `localhost:9999`.

### 3. Run the real CLI against a real dummy project

In another terminal:

```
mkdir /tmp/dummy-project && cd /tmp/dummy-project
npm init -y

TOOLCRIB_API_BASE=http://localhost:9999/api \
TOOLCRIB_RELEASES_BASE=http://localhost:9999/releases \
node /path/to/toolcrib-cli/src/index.js init

TOOLCRIB_API_BASE=http://localhost:9999/api \
TOOLCRIB_RELEASES_BASE=http://localhost:9999/releases \
node /path/to/toolcrib-cli/src/index.js apply
```

Then inspect `/tmp/dummy-project` — `toolcrib/` should contain every
vendored file, `package.json` should have the real peer dependencies
added, `.gitignore` should have `/toolcrib-patches/`, and
`toolcrib/.toolcrib-lock.json` should record the installed version.

`TOOLCRIB_API_BASE`/`TOOLCRIB_RELEASES_BASE` are the only two overrides
the CLI recognizes — unset, everything targets real GitHub. They exist
specifically to make this kind of test possible without a published
release or real network access.

### Testing `merge` for real (multi-version fixtures)

The flat layout above (a single `toolcrib.zip` at `releases/`) is enough
for `init`/`apply`, but `merge` needs to diff *two different* releases —
whatever's currently installed vs. the target — and the flat layout serves
the identical file for both requests, so `merge`'s own three-way
classification (`unchanged`/`safe-update`/`keep-local`/`conflict` in
`src/commands/merge.js`) never has real drift to detect. Confirmed
directly, not assumed: an early version of a real release-verification
pass reported "74 files updated cleanly," and every one of those updates
turned out to be a silent no-op once checked, because old and new were
byte-identical.

Serve distinct fixtures per version instead, in a subfolder keyed by
exactly what the requested URL names:

```
mkdir -p integration-test/releases/latest
mkdir -p integration-test/releases/v0.12.0
cp /path/to/new/toolcrib.zip integration-test/releases/latest/
cp /path/to/new/toolcrib.zip.sha256 integration-test/releases/latest/
cp /path/to/old/toolcrib.zip integration-test/releases/v0.12.0/
cp /path/to/old/toolcrib.zip.sha256 integration-test/releases/v0.12.0/
MOCK_LATEST_VERSION=0.14.0 node integration-test/mock-github-server.js
```

A real historical version's real assets are still published on GitHub —
`https://github.com/escape-llc/toolcrib/releases/download/v0.12.0/toolcrib.zip`
— so the "old" side doesn't need building locally, just downloading.
`MOCK_LATEST_VERSION` controls what the `/releases/latest` JSON endpoint
reports (defaults to `1.0.0`, matching this server's original hardcoded
value, so nothing above needs it set). The asset route falls back to the
flat `releases/{asset}` layout when no matching versioned subfolder
exists, so the simpler init/apply walkthrough above keeps working
unchanged either way.

Then point a real install already on the "old" version at this server and
run `merge`/`apply` as normal — `toolcrib/.toolcrib-lock.json` in that
project records which version it's currently on, which is what `merge`
requests as the "old" side.

## Bugs found by actually running this (not caught by unit tests alone)

Worth keeping this integration test around, since it already found three
real issues that unit tests, by construction, couldn't have caught:

1. **Hang on error** — a failed fetch left `@clack/prompts`' spinner
   interval alive, so the process never exited even after printing the
   error. Fixed by calling `process.exit(1)` explicitly in the CLI's
   top-level error handler rather than only setting `process.exitCode`.
2. **Crash in non-interactive environments** — `p.confirm()` throws a raw
   libuv TTY error (not a catchable message) when stdin/stdout aren't a
   real terminal (CI, scripts, sandboxes). Fixed by detecting
   `process.stdin.isTTY` and defaulting to "yes" for the (safe,
   recoverable) `git init` prompt when non-interactive.
3. **`git apply` rejected the lockfile patch** — `toolcrib/.toolcrib-lock.json`'s
   path was built with a leading `./`, which `git apply` treats as an
   invalid path even though every other file's path (built without the
   leading `./`) applied fine. Fixed by dropping the leading `./`; a
   regression test now locks this in.
