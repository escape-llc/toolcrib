# Toolcrib — Contributor Workflow

How a real change to this repo actually gets from "idea" to "merged," for whoever (human or AI) is doing the work. This is process, not component conventions — see `AGENTS.md` for those. Standing default, confirmed by the maintainer: every real change goes through this sequence, not a direct commit to `main`.

## Expected tools

Every step below assumes these are already installed and working — added after noticing this file jumps straight into `gh issue edit`/`gh pr merge` without ever having stated that assumption anywhere.

- **Verify `gh` (GitHub CLI) is authenticated before starting: `gh auth status`; run `gh auth login` first if it fails.** Used constantly throughout this whole sequence — issue/PR creation and labeling, checking CI status, reading review comments, merging. Nothing in this workflow works without it, and there's no alternate path through the plain GitHub web UI documented anywhere in this repo's process.
- **`git`, `node`, `npm`, and `npx` are assumed present and working, same as `gh`** — not called out per-step below. CI pins Node 22 (`.github/workflows/ci.yml`'s `node-version`); match that locally to avoid a version mismatch surfacing only in a GitHub Actions run rather than on your own machine. `cli/` and `mcp/` each have their own independent `package.json`/`node_modules` — a root `npm install` doesn't populate either; see `AGENTS.md`'s own notes on why they're deliberately isolated.

Situational, not needed for most changes — see the section named for each: `AGENTS.md`'s "Dev machine is Windows" (PowerShell over Bash on this repo's primary dev machine) and its CRLF/line-ending notes (a `python3` one-liner is fine for read-only inspection, never for writing a file — see that section for why).

## The sequence

1. **Open an issue** describing what's changing and why. Label it with whatever existing labels fit (`gh label list` for the current set) via `gh issue edit <N> --add-label "x,y"` — don't leave it unlabeled, and don't invent a new label without asking first.
2. **Branch off an up-to-date `main`** (`git checkout main && git pull --ff-only` first — never branch off a stale local copy).
3. **Make the change, verify it locally** before pushing — the relevant subset of: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run check-manifest`/`check-docs`/`check-index`. The Operational Log below records a real gap in this list (files nothing validates).
4. **Commit**, message ending with the `Co-Authored-By` trailer this session's attribution requires. Reference the issue number in the commit body if it clarifies which change it's part of.
5. **Push, open a PR** referencing the issue. Body gets a `## Summary` and a `## Test plan` — the test plan should say what was actually verified, not just what should theoretically pass. Use `Closes #N` only when this PR is the *whole* fix (see the Operational Log below). Label it the same way as its issue (`gh pr edit <N> --add-label "x,y"`). **An AI-authored PR description ends with a visible model footer:** one line, exactly `Model: <model-id> · Harness: <harness>` (e.g. `Model: claude-opus-5-5 · Harness: Claude Code`), placed just before any attribution line. Added 2026-09-26 at the maintainer's request. Commit `Co-Authored-By` trailers already name the model (470 `Claude Sonnet 5` trailers in history before this date), but PR descriptions, session summaries and review replies named none. Comparing sessions across models then meant inferring the model from dates. Visible rather than hidden, so readers see authorship directly, and a fixed format so it still parses.
6. **Wait for CI to go green before merging — always.** Never merge on "the diff looks right" alone. Required checks: `test`, `cli-windows`, `e2e`, `CodeQL`.
7. **Squash-merge, delete the branch** (`gh pr merge <N> --squash --delete-branch`).
8. **Close the issue** if the merge didn't already auto-close it via `Closes #N`.
9. **Sync local `main`** (`git checkout main && git pull --ff-only`) and drop the now-merged local branch ref.
10. **Post a session summary to GitHub Discussions**, per `SESSION_SUMMARIES.md`'s own template and cadence — one per commit-worthy checkpoint, not one per session.

Not every one-line typo fix needs the full ceremony — but a real change (new behavior, a real bug fix, a config/infra change) does, by default. When in doubt, run the sequence; the cost of an extra issue/PR is low, the cost of an undocumented direct-to-`main` change is a future session with no idea why something is the way it is.

## A literal per-issue checklist, not just this file's prose

Added 2026-09-12, after a direct question about long sessions silently drifting away from steps this file already documents. The numbered sequence above is easy to *read* and easy to stop *actively applying in full* once a session has already run it a dozen times — not because the text stops being available (project instruction files like this one are re-injected into context on every turn, including after a mid-session compaction), but because recalling the *right* step at the *right* moment under momentum is a different failure mode than the text being missing. The same "found once vs. found forever" gap `AGENTS.md`'s own "Generalizing lessons" section names for in-repo bugs applies here too, aimed at process instead of code.

The concrete fix: at the start of each issue's own work, write a literal checklist file into the session's own scratchpad directory (never into the repo itself — this is a personal tracking aid, not a project artifact) using the template below, and *update* it — don't just mentally recall it — at each real transition (CI going green, right before merging, right after posting the summary). A file that can be re-*read* to check current state is a stronger anchor across a long, mixed conversation than re-deriving "where was I" from history alone, and it survives a mid-session compaction the same way this file does.

```markdown
- [ ] Checked recent Discussions (AI Session Summaries category) and recent PRs' Gemini comments for anything relevant before starting
- [ ] Issue filed/labeled
- [ ] Branched off a freshly-synced main
- [ ] Change made; verified locally (npm test, npx tsc --noEmit, npm run lint, check-manifest/check-docs/check-index as relevant)
- [ ] Committed with the Co-Authored-By trailer, pushed
- [ ] PR opened (Closes #N only if this PR is the whole fix), labeled, `Model: … · Harness: …` footer present
- [ ] CI green
- [ ] Gemini's review CONTENT actually read (not just the review check's pass/fail) -- every finding evaluated and replied to on the thread; confirmed-true ones fixed, false positives replied to with the actual verification
- [ ] Squash-merged, branch deleted, issue closed
- [ ] Local main synced
- [ ] Session summary posted to Discussions, back-link comment left on the PR
```

This doesn't replace the numbered sequence above (or `SESSION_SUMMARIES.md`'s own template for the last step) — it's a tracking aid layered on top, for the specific failure mode of a long session's own momentum carrying a step past without it, not a new source of truth about what the steps actually are.

## Operational Log & Run-Time Guidance

Lessons this sequence has actually hit, one entry each: what happened, the fix applied, and the rule to keep. A new lesson goes here in the same shape, folded into an existing entry when it shares that entry's root cause (see `AGENTS.md`'s "Generalizing lessons"). An entry is dated only when the date is known.

- **[2026-09-09 - Step 7 (any repo-settings change) - blocked, then allowed]:** Issues #166 and #173 had a `gh api` branch-protection update and a `gh pr merge --auto` both denied by the harness's auto-mode classifier, and this file recorded that as an unconditional block. A later session then ran a direct `gh api --method PUT .../branches/main/protection` call successfully, adding a required-pull-request setting, after the maintainer explicitly said "apply if you are able" in response to a specific, already-diagnosed proposal.
  - *Fix applied:* Corrected the "confirmed for real, always blocked" framing. The real gate appears to be explicit authorization for that specific action at that specific moment, not a mechanism that refuses the call regardless of instruction.
  - *Mitigation for future runs:* Repo secrets, PATs and branch-protection changes still need the maintainer's explicit go-ahead on the specific change before attempting it. Creating a PAT or toggling a setting through the web UI isn't something an AI session can do at all (see the `TOOLCRIB_READ_TOKEN` work, issue #166). Don't cite "always blocked" as settled fact; if it matters, check current behavior.

- **[2026-09-08 - Step 3 (verify locally) - nothing validated it]:** `npm run lint` only covers `src`/`demo`. It never touched `.github/workflows/*.yml` or this repo's own docs, so no automated check existed for either.
  - *Fix applied:* CI's `actionlint` job (`npx github-actionlint`: real GitHub Actions schema and semantics, not just YAML syntax, plus `shellcheck` on every `run:` block on `ubuntu-latest`) and `link-check` job (`lychee`, catching a dead cross-reference link in `AGENTS.md`/`WORKFLOW.md`/etc.) now run on every push and PR (#189). Before that, `npx js-yaml <file>` was the ad-hoc stand-in, and it's still useful for a quick local check before pushing.
  - *Mitigation for future runs:* Before pushing a change to any file type that `npm test`/`npm run lint`/`tsc` never touch, find something that parses it. Don't let CI be a config file's first real validation.

- **[2026-09-06 - Step 6 (CI) - failed on unrelated drift]:** The repo-wide Action-pinning PR (#167) failed its first CI run, not because of its own diff but because `llms-full.txt` (which embeds `README.md` verbatim) had drifted from an unrelated README edit that landed in the same commit.
  - *Fix applied:* Regenerated on the same branch (`node scripts/generate-docs.js --write`, then commit) instead of opening a second PR.
  - *Mitigation for future runs:* CI blocks the PR either way, so fix such drift on the same branch, but only when the fix is purely mechanical (a generated file catching up to its own source). Never smuggle a second real behavior change into an unrelated PR this way.

- **[2026-09-08 - Step 5 (open PR) - issue closed too early]:** Issue #173 named two things. It split into a code change landed via PR and a repo-settings change the maintainer applied directly, and `Closes #N` would have auto-closed the issue with the remainder undone.
  - *Fix applied:* The PR body said `Part of #N`.
  - *Mitigation for future runs:* Use `Closes #N` only when the PR is the whole fix. Otherwise write `Part of #N`, since `Closes` auto-closes the issue on merge regardless of what's left.

- **[2026-09-08 - Step 7 (merge) - green PR refused to merge]:** `gh pr merge` returned `4 of 4 required status checks are expected` with every check green, because `main` had advanced since the branch's required checks last ran (`strict: true` means the branch itself has to be current). Hit twice in one session (#183, #198), both times merging two PRs close together. Nothing in the error names the real cause.
  - *Fix applied:* `git fetch origin && git checkout <branch> && git merge origin/main --no-edit && git push`, which restarts CI on the merge commit, then merged once that fresh run was green.
  - *Mitigation for future runs:* Expect this whenever PRs land in quick succession, and update the branch rather than retrying the merge.

- **[2026-09-08 - Step 6 (CI) - required check failed on an unrelated PR]:** `e2e/interaction-states.spec.ts`'s WebKit focus-visible-ring test (a real-browser, real-CSS-transition test that then used a fixed `waitForTimeout`, exactly the kind prone to CI scheduling jitter) failed twice in one session on PRs that touched no CSS or interaction code.
  - *Fix applied:* Checked the failure against other runs before re-running only the failed job (`gh run rerun <run-id> --failed`).
  - *Mitigation for future runs:* A failed required check isn't automatically a regression, but don't assume flake either. Before re-running: (1) confirm the failing test has no plausible connection to this PR's diff; (2) check whether the same test passed on other same-day `e2e` runs (`gh run view --log` on a recent run, grep the test name). Re-run only the failed job; never bypass the required check. A second failure after a re-run is a different signal: stop assuming flake and investigate (see `AGENTS.md`'s "e2e: wait for a real signal, never a fixed sleep").
