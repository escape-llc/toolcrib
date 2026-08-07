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
