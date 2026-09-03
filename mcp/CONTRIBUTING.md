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
npm version <patch|minor|major>
npm test                # full suite green
node integration-test/run.mjs   # real subprocess check, against this repo's live ai-docs/
npm pack --dry-run       # confirm exactly what would ship -- package.json,
                          # README.md, LICENSE, src/ only (10 files, ~8KB
                          # packed as of the first release)
npm publish --dry-run    # same validation a real publish runs, no network write
npm publish
git push && git push --tags
```

### What the `files` field is for

`package.json`'s `files` array (`["src"]`) is an explicit whitelist —
`test/`, `integration-test/`, `vitest.config.js`, and `package-lock.json`
are left out of the published package even though they're sitting right
here in this folder. `package.json`, `README.md`, and `LICENSE` are always
included by npm regardless of `files`. Verify with `npm pack --dry-run`
before ever running the real `npm publish` — don't trust the `files` array
alone without checking the actual tarball contents.
