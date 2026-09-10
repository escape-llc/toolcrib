# Contributing to toolcrib-mcp

## Local development

```bash
cd mcp
npm install
npm test              # unit tests, in-process InMemoryTransport, no subprocess
npm run coverage:unit  # same, with the coverage report + 90% gate
```

Unit tests build a real temp directory shaped like a vendored consumer
install (`test/fixtures.js`'s `buildFakeProject()`) and exercise the real
`fs` I/O against it — no mocked filesystem. Tool-level tests connect a real
`@modelcontextprotocol/sdk` `Client` to `buildServer()`'s output over an
in-memory transport pair (`InMemoryTransport.createLinkedPair()`), so the
actual `registerTool` wiring, schemas, and error shapes are exercised, not
just the underlying lib functions in isolation.

### Integration test — real subprocess, real content

```bash
node integration-test/run.mjs
```

Not wired into `npm test` (same convention as `cli/integration-test/`).
Spawns the actual `src/index.js` bin entry as a real subprocess, connects a
real `StdioClientTransport`, and calls real tools against a fixture built by
copying *this repo's own* `ai-docs/` into the `toolcrib/ai-docs/` shape a
real vendored install has (plus a synthetic `.toolcrib-lock.json` using the
root `package.json`'s real version) — self-contained and reproducible by
anyone who clones the repo, no dependency on a prior `toolcrib init` run
existing anywhere.

## Publishing

**`toolcrib-mcp` is an independently-versioned, independently-published npm
package** — same discipline as `cli/`'s own `toolcrib` package (see the root
`AGENTS.md`'s "Cutting a release" section). Its version has no relationship
to the toolkit's or the CLI's; a toolkit or CLI release doesn't touch this
package's version, and vice versa. It ships zero vendored `ai-docs/` content
of its own, so its release cadence is decoupled from toolcrib's own content
releases entirely — a new version here is only needed when the *server
logic itself* changes (a new tool, a bug fix, an SDK bump), never because
toolcrib shipped a new component.

Only when the maintainer explicitly asks for a version bump:

```bash
cd mcp
npm version <patch|minor|major> --no-git-tag-version   # see below re: --no-git-tag-version
npm test                # full suite green
node integration-test/run.mjs   # real subprocess check, against this repo's live ai-docs/
npm pack --dry-run       # confirm exactly what would ship -- package.json,
                          # README.md, LICENSE, src/ only (10 files, ~8KB
                          # packed as of the first release)
npm publish --dry-run    # same validation a real publish runs, no network write
git add package.json package-lock.json && git commit -m "Bump toolcrib-mcp to vX.Y.Z"
git push -u origin <branch>   # main is a protected branch -- direct push is rejected
# Open a PR, wait for every required check to go fully green, then squash-merge
# (the standard issue/branch/PR/CI-green/merge sequence from root WORKFLOW.md --
# not a special case for a release commit)
git checkout main && git pull --ff-only
npm publish              # LAST step -- only once the version-bump commit that's
                          # about to be published is actually on main, verified
                          # there by this repo's own CI, not before
git tag mcp-vX.Y.Z && git push origin mcp-vX.Y.Z   # tag *after* publish succeeds, so a failed/declined publish never leaves a tag pointing at content that was never actually shipped
```

**`npm publish` is the last step, not the middle one — corrected 2026-09-10, found live during a real release pass.** The previous version of this checklist ran `npm publish` immediately after the two dry-runs, ahead of the commit/push -- reasonable back when a direct push to `main` was possible (publish for real, then just record it in git). It stopped being reasonable the moment `main` became a protected branch requiring a PR and full CI before merge: that ordering let a real, public, irreversible `npm publish` happen *before* this repo's own CI had verified anything about the commit being published at all, exactly backwards from what a release gate is for. The fix is the order above: bump, test locally, dry-run, commit, open a PR, wait for CI to go green, merge -- and only then run the real `npm publish`, against a working tree that's been pulled from the now-current `main`, so what actually gets published is provably the exact content CI already verified, not a local checkout that happened to look right.

**Always pass `--no-git-tag-version` on the `npm version` step itself** — that command's own default behavior creates and pushes a bare `vX.Y.Z` tag, and git tags in this repo are a single, shared, repo-wide namespace, not scoped per npm package: the root `toolcrib` package has already claimed every `v0.1.0`–`v0.13.0` (see root `AGENTS.md`'s "Cutting a release"), so a bare `npm version`-created tag would collide with (or worse, silently shadow) a real root release tag.

**Tag `mcp-vX.Y.Z` explicitly instead, added 2026-09-08** — a real git-level record of exactly which commit a given `toolcrib-mcp` publish was built from, the same "the tag *is* the shipped content" guarantee `release.yml` already gives the root package, just via a prefixed tag instead of a shared bare one. Verified directly, not assumed: `release.yml`'s own trigger (`on.push.tags: ['v*']`) only matches tags starting with the literal character `v` — `mcp-v0.3.0` starts with `m`, so creating and pushing it cannot trigger that workflow. Push only the one specific tag (`git push origin mcp-vX.Y.Z`), never a blanket `git push --tags` — this repo's tag namespace has other packages' tags in it too (`cli-vX.Y.Z`, see `cli/CONTRIBUTING.md`; plain `vX.Y.Z` for the root package), and a blanket push has no way to push just this package's own.

### What the `files` field is for

`package.json`'s `files` array (`["src"]`) is an explicit whitelist —
`test/`, `integration-test/`, `vitest.config.js`, and `package-lock.json`
are left out of the published package even though they're sitting right
here in this folder. `package.json`, `README.md`, and `LICENSE` are always
included by npm regardless of `files`. Verify with `npm pack --dry-run`
before ever running the real `npm publish` — don't trust the `files` array
alone without checking the actual tarball contents.
