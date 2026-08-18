# Toolcrib — AI Session Summary Prompt (for this repo's own Discussions)

A reusable prompt to get an agent to self-report a clean, Discussion-ready
summary of *contributor* work on toolcrib itself — a new component, a bug
fix, a theming change — including the friction points that feed directly
back into the toolkit's own backlog.

This is a contributor doc, not a consumer one — it lives at the repo root
next to `AGENTS.md`/`cli/CONTRIBUTING.md`, not under `ai-docs/`. Everything
under `ai-docs/` ships as-is into every consumer project via `toolcrib
init` (`scripts/build-release.js`'s own comment: *"ai-docs/ ships as-is,
whatever's actually there"*), and a prompt about posting to
`escape-llc/toolcrib`'s Discussions has no business in someone else's app.

## When to trigger it

**Not** once at the very end of a long, multi-commit session. By then:
- Early friction points have likely fallen out of effective context.
- Multiple unrelated pieces of work (a new component, a bug fix, a theming
  tweak) get flattened into one unfocused post instead of several clean,
  searchable ones.

**Instead, trigger it at each natural checkpoint** — right before or right
after a commit that represents "this piece is done and works." If a single
session covers several distinct pieces of work, ask for a separate summary
each time, not one giant recap at the end. Skip it for trivial/mechanical
commits (typo fixes, formatting) — only checkpoints that represent a real
unit of work are worth a post.

Rule of thumb: **one summary per commit-worthy unit of work, written while
it's still the freshest thing in context — not one summary per session.**

**Push before posting.** The Outcome section links to a commit — that link
is dead for readers until it's actually on `origin`. Push (or confirm it's
already pushed) before posting, not after.

## The prompt

Paste this in immediately after a checkpoint/commit, before moving on to
the next distinct task:

```
Write a summary of the work we just completed, formatted for a GitHub
Discussion post. Scope it to only this piece of work — if we touched
something unrelated earlier in this session, leave that out; it'll get
its own post.

Include, as headers:

1. **Goal** — one line: what was being built or fixed.
2. **Toolcrib surface touched** — an explicit list of what was added or
   modified (e.g., "DataTable — added controlled sort/page props"), plus
   any existing component whose established pattern you followed (e.g.,
   "TabStrip's activeId — used as the precedent for the controlled-state
   shape"). If something was reached for but didn't fit and you fell back
   to a different approach, say so — that's useful signal too.
3. **Approach** — the prompt(s) or instructions that got this working,
   condensed to the essential ask (not the full back-and-forth).
4. **Outcome** — what the result looks like; include a link to the commit
   (only once it's pushed — see above).
5. **Friction** — anything that took extra turns, wasn't obvious from
   AGENTS.md/CORE.md/the component manifest, or required guessing. Be
   specific and honest here even if it reflects a gap in the toolkit —
   this section is the most valuable part of the post.

Keep it tight — a maintainer should be able to read the whole thing in
under a minute. Skip anything not directly relevant to contributing to
toolcrib.
```

## Maintainer-side handling

- **Batch, then review before posting.** Several short summaries from one
  session should be reviewed together and posted individually (or as a
  short thread), not merged into one post.
- **Filter for signal.** Not every checkpoint needs to go public — post the
  ones that show a real pattern (a reusable internal convention, a working
  fix) or surface a genuine friction point. Routine/uneventful checkpoints
  can stay local.
- **Post under "AI Session Summaries".** That category already exists on
  this repo's Discussions and is the intended home for this template's
  output. `Show and tell` fits a more polished, user-facing feature
  announcement instead; `Announcements` is maintainer-only in tone.

  Cached GraphQL node IDs (as of 2026-08-18, via `gh api graphql`) so a
  posting session doesn't have to re-look these up every time:
  - Repository (`escape-llc/toolcrib`): `R_kgDOTwhGaA`
  - "AI Session Summaries" category: `DIC_kwDOTwhGaM4DDiVO`

  These are stable as long as the repo/category aren't renamed or
  recreated — if a `createDiscussion` mutation fails against them, re-fetch
  via `repository.discussionCategories` rather than assuming the IDs above
  are still current.
- **Be transparent about authorship.** These are maintainer-authored (you
  prompting the agent, then posting) — let that read as what it is,
  genuine build-in-public notes, rather than implying unprompted outside
  adoption. That's the framing that holds up under scrutiny.
