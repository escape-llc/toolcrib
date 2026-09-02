# Security Policy

## Reporting a vulnerability

Please report suspected security vulnerabilities in toolcrib (the toolkit
under `src/`, the CLI under `cli/`, or the release/patch pipeline in
`cli/src/lib/`) privately, not as a public issue or discussion.

Use GitHub's [private vulnerability reporting](https://github.com/escape-llc/toolcrib/security/advisories/new)
for this repository — it opens a private advisory thread visible only to
you and the maintainer, and can turn into a coordinated disclosure/CVE if
warranted. Include:

- The affected file(s)/version, and whether it's the toolkit (`src/`) or
  the CLI (`cli/`) — the two are versioned independently.
- Steps to reproduce, or a minimal example.
- The impact as you understand it.

## Supported versions

Only the latest published release of each independently-versioned piece
(the toolkit's root `package.json` version, and `cli/`'s own npm package
version) is supported. There is no long-term-support branch — fixes land
on `main` and ship in the next release.

## Scope

toolcrib is a source-vendoring toolkit and CLI, not a hosted service —
most traditional web-app vulnerability classes (auth, session handling,
server-side request forgery against a backend) don't apply. The relevant
categories are things like: XSS/injection sinks in vendored component
source, integrity of the CLI's release download/patch-apply pipeline, and
path-traversal in patch application. See `AGENTS.md` for the project's own
running log of security-relevant fixes and the reasoning behind them.
