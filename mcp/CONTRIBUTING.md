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
git tag mcp-vX.Y.Z && git push origin mcp-vX.Y.Z   # on the merge commit; this push publishes
```

**Pushing the tag publishes; nobody runs `npm publish` by hand (#957).** `.github/workflows/publish.yml` runs on a pushed `mcp-v*` tag. It fails before publishing if:
- the tag's version doesn't match `mcp/package.json`;
- the tagged commit isn't on `main`, so only content CI already verified gets published;
- `npm test` fails.

It then runs `npm publish --provenance` with npm trusted publishing (OIDC): there's no npm token, and npm shows a signed provenance statement on the version's page. The package's trusted publisher on npmjs.com names this repo, `publish.yml` and the `npm-publish` environment; a publish from anywhere else is rejected. Check the workflow run went green before announcing the release. A failed run leaves the tag pointing at an unpublished version: fix the cause in a PR, then delete and re-push the tag on the new merge commit (`git push origin :refs/tags/mcp-vX.Y.Z`), since the version was never published.

The ordering rule from before still holds, just enforced by the workflow now: nothing is published before the version-bump commit is on `main` and CI has verified it (found 2026-09-10, when an earlier checklist published ahead of CI).

**Always pass `--no-git-tag-version` on the `npm version` step itself** — that command's own default behavior creates and pushes a bare `vX.Y.Z` tag, and git tags in this repo are a single, shared, repo-wide namespace, not scoped per npm package: the root `toolcrib` package has already claimed every `v0.1.0`–`v0.13.0` (see root `AGENTS.md`'s "Cutting a release"), so a bare `npm version`-created tag would collide with (or worse, silently shadow) a real root release tag.

**Tag `mcp-vX.Y.Z` explicitly instead, added 2026-09-08** — a git-level record of exactly which commit a given `toolcrib-mcp` publish was built from, and since #957 the trigger for that publish. `release.yml`'s trigger (`on.push.tags: ['v*']`) only matches tags starting with the literal character `v`, so `mcp-v0.3.0` can't trigger it; `publish.yml` matches only `cli-v*`/`mcp-v*`. Push only the one specific tag (`git push origin mcp-vX.Y.Z`), never a blanket `git push --tags` — this repo's tag namespace has other packages' tags in it too (`cli-vX.Y.Z`, see `cli/CONTRIBUTING.md`; plain `vX.Y.Z` for the root package), and a blanket push has no way to push just this package's own.

### What the `files` field is for

`package.json`'s `files` array (`["src"]`) is an explicit whitelist —
`test/`, `integration-test/`, `vitest.config.js`, and `package-lock.json`
are left out of the published package even though they're sitting right
here in this folder. `package.json`, `README.md`, and `LICENSE` are always
included by npm regardless of `files`. Verify with `npm pack --dry-run`
before ever running the real `npm publish` — don't trust the `files` array
alone without checking the actual tarball contents.
