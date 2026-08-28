# Contributing to Toolcrib

Toolcrib expects to be contributed to through an AI-guided session, not a
human editing files freehand and opening a PR from memory. Point an AI
coding agent (Claude Code or an equivalent) at this repo and let it work
from the instructions already written into the repo for exactly that
purpose — the same instructions any AI session working on this codebase is
already required to follow:

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
- **[SESSION_SUMMARIES.md](SESSION_SUMMARIES.md)** — how a session closes
  out: posting an honest writeup (including friction) of what changed to
  GitHub Discussions, so the next session — and anyone watching the
  project — has a real record to work from.

If you're building an app that *uses* Toolcrib rather than working on
Toolcrib itself, this is also the wrong file — see `ai-docs/CORE.md` after
running `toolcrib init`.
