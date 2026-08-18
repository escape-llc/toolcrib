# Contributing to Toolcrib

This file exists because GitHub's own UI (the "read the contributing
guidelines" prompt on PRs/issues) only looks for a file with this exact
name — the actual contributor instructions live elsewhere, in a form both
humans and AI agents read directly:

- **[AGENTS.md](AGENTS.md)** — the component library itself: the
  `ThemeSlice` pattern, how to add a component correctly (slice + tests +
  manifest entry), the JSDoc tagging conventions the manifest/docs
  generation pipeline depends on, and the generate → review →
  apply-what-review-missed → taste-check workflow this repo's history
  already follows.
- **[cli/CONTRIBUTING.md](cli/CONTRIBUTING.md)** — the `toolcrib` CLI
  (`cli/`) specifically: local development, the integration test harness,
  and publishing. A separate, independently-versioned npm package from the
  toolkit itself — see `AGENTS.md`'s own note on why they aren't merged.

If you're building an app that *uses* Toolcrib rather than working on
Toolcrib itself, this is also the wrong file — see `ai-docs/CORE.md` after
running `toolcrib init`.
