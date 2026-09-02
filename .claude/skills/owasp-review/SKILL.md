---
name: owasp-review
description: Audit the whole codebase against OWASP Top 10 vulnerability categories (injection/XSS, security misconfiguration, vulnerable components, software-integrity failures, SSRF, and the CSRF boundary) — not scoped to a diff the way the built-in security-review skill is. Use when asked for an OWASP audit, a CSRF/XSS vulnerability assessment, or "how exposed are we" questions about the library as a whole.
context: fork
agent: Explore
---

# OWASP Top 10 audit — whole codebase, not a diff

This project (toolcrib) is a **client-side-only React component library**, vendored into consumer projects, plus a **CLI** that downloads and applies release artifacts. It has no server, no session/cookie handling, and no database of its own. Several classic OWASP categories therefore apply *differently* here than they would to a typical server-rendered web app — the first job of this audit is stating, per category, whether it's genuinely assessed or out of scope **and why**, not silently skipping categories that don't map cleanly.

Verify every claim against the actual current source before reporting it — do not trust a category's description below as still-true; each was last confirmed at authoring time and may have drifted. Grep first, read the real call site, then decide.

## Category-by-category methodology

**Injection / XSS (OWASP A03)** — the one category most directly relevant to a component library:
- `grep -rn "dangerouslySetInnerHTML" src/` — as of authoring, this returns **zero** matches in toolcrib's own source (outside tests). If this has changed, read every call site and confirm the HTML being injected is either a static literal or passes through a real sanitizer (e.g. DOMPurify) before reaching the DOM — an unsanitized dynamic string here is a real, reportable finding.
- `grep -rn "innerHTML\s*=\|insertAdjacentHTML\|eval(\|new Function(" src/` — same bar: static/trusted content is fine, anything built from a prop/parameter is not.
- CSS-text injection: `src/theme/injectGlobalStyle.ts`'s callers (`upsertGlobalStyle`/`injectGlobalStyle`) accept raw CSS text — confirm every call site passes either a static template literal or output from a pure, non-user-controlled generator (`generateResponsiveCSS`, `computeServerThemeCSS`), never a value built from an untrusted prop. CSS injection is a real, if less obvious, XSS-adjacent vector (`url()`/`expression()` tricks in older engines, exfiltration via `background-image` selectors).
- The Zod form engine (`FormContext.tsx`) and event bus payloads: confirm nothing renders a payload field via a raw-HTML path rather than JSX's own auto-escaping.
- **URL-scheme injection via `href`/`src` props** — `grep -rn "href=\|src=" src/components` (as of authoring: `Breadcrumb`, `Sidebar`, `Avatar`, `Gallery`, `ViewerContent`, `FileUpload`). None of these validate the URL scheme before rendering it — a `javascript:` value in an `href`-accepting prop executes on click, same as any plain `<a href>`. This is **not a toolcrib code defect** (no mainstream UI library sanitizes href schemes either — it's long-established as the *consumer's* responsibility, same as XSS-escaping any other prop value is the app's job wherever JSX's own auto-escaping is deliberately bypassed) — confirm `ai-docs/CORE.md`'s Anti-Patterns section still documents this explicitly (the "Security note — URL-accepting props" paragraph) rather than reporting it as a fresh finding each time. If a *new* component adds an `href`/`src`-accepting prop, check whether that note's component list needs updating instead of re-litigating whether the gap itself is a defect.
- **Prototype pollution via the theme-override merge path** (`useSliceOverrides`/`getSparseVariables` in `src/theme/`) — confirmed at authoring time to be a non-issue *because of the data flow*, not because the merge code itself defends against it: `overrides` is always a `Partial<TState>` object written as a literal prop in the consuming developer's own TSX, never a runtime `JSON.parse` of untrusted network/user input flowing into a recursive merge. The vulnerability class requires an attacker who can control merge *keys* (e.g. `__proto__`) from outside the trust boundary — verify this data-flow precondition is still absent before reporting, rather than checking only whether the merge function itself special-cases `__proto__`/`constructor`. If a future feature adds a merge over externally-sourced JSON (a remote theme config, a locale file fetched at runtime), re-open this check for real.

**Security Misconfiguration (OWASP A05)**:
- CSP nonce correctness — `src/theme/nonceContext.tsx`, every `injectGlobalStyle`/`upsertGlobalStyle` call site, and `e2e/csp-nonce.spec.ts`'s actual coverage. Confirm the nonce is set via the `.nonce` IDL property (not `setAttribute('nonce', ...)`, which modern browsers deliberately make unreadable/unreliable post-parse — using the wrong one is a real, silent CSP bypass gap) and that every `<style>` tag toolcrib creates actually receives it when one is supplied.
- Any dev-only code path (a debug flag, a verbose logger, a "skip auth" shortcut) that could ship into a production build without being stripped.

**Vulnerable and Outdated Components (OWASP A06)**:
- Run `npm audit` (root) and `cd cli && npm audit` (CLI has its own independent `package.json`/lockfile — audit both separately, a clean root doesn't imply a clean CLI).
- Spot-check `package.json`/`cli/package.json` for pinned versions of security-sensitive dependencies (anything touching HTML sanitization, the CLI's own zip-extraction/patch-application libraries) against currently known CVEs.

**Software and Data Integrity Failures (OWASP A08)** — this is where the CLI's supply chain lives:
- `cli/src/lib/github.js`'s release-download path: confirmed (at authoring time) to fetch a `toolcrib.zip` release asset **and** its `.sha256` sibling, compute a real SHA-256 over the downloaded bytes, and compare against the published checksum — verify this is still true and still actually gates on a mismatch (not just logged and ignored). A prior version of this file tolerated a failed checksum fetch (missing asset, network error, or a blocked request) as "older release, no checksum published" and silently skipped verification — that was the actual finding from the audit that first authored this skill, fixed in commit `bcc8c42` since every real release has always shipped a checksum. Confirm the fallback stays gone rather than silently reappearing (e.g. a future "be lenient" refactor re-adding a `.catch(() => null)` around the checksum fetch).
- `cli/src/lib/patches.js`/`cli/src/lib/git.js` — confirm patches are applied via `git apply`/a fallback patcher against paths that stay within the target project root (no path-traversal via a crafted `../../` patch header).

**Server-Side Request Forgery (OWASP A10)**:
- Grep the whole repo (`src/`, `cli/`) for any `fetch(`/`http.request(`/similar call whose target URL is built from external input (a prop, a CLI argument, an environment variable) without validation. As of authoring, the only real outbound-fetch logic lives in the CLI's own release-downloading code (`cli/src/lib/github.js`), which targets a hardcoded `escape-llc/toolcrib` repo — not user-suppliable. If a future feature adds a URL-accepting fetch anywhere (a locale-file loader, a remote-theme loader), that's exactly the shape of change this category exists to catch.

**CSRF — explicit scope boundary, not a silent N/A**:
Classic CSRF targets a stateful, cookie-authenticated server endpoint — toolcrib has neither a server nor its own session state, so this category doesn't apply to the library's own code directly. State that explicitly in the report, rather than omitting the category. What *is* worth checking: whether any toolcrib-provided pattern (the event bus, `aiBus.requireAuth()`, the router bridge) could make it *easier* for a consumer app to accidentally weaken their own CSRF defenses — e.g., does any helper method perform a state-changing action as a side effect of an event a consumer doesn't fully control the trigger for? If so, name the specific mechanism and the specific risk, not a generic warning.

**Categories genuinely out of scope for this library specifically** (state why, don't skip silently): Broken Access Control (A01) and Identification/Authentication Failures (A07) — toolcrib has no access-control model or authentication of its own; `aiBus.requireAuth()` is an *announcement channel* for a consumer's own auth state, not an auth system toolcrib implements. Cryptographic Failures (A02) — no toolcrib code handles secrets, tokens, or encryption at rest/in transit beyond the CLI's checksum verification (covered under A08 above). Security Logging and Monitoring Failures (A09) — no server-side logging exists to fail at; note the `error:boundary` event bus channel as the closest analog and whether it could leak sensitive data into a consumer's own error-reporting pipeline (see `wildcard-event-monitoring.md`'s own JSON-serializability caveat).

## Reporting discipline

Match this repo's own established standard, not a generic checklist pass:
- Verify every finding against the real, current source before reporting it — quote the actual file:line, not a paraphrase.
- Distinguish a confirmed, exploitable issue from a theoretical one explicitly (mirrors `code-review`'s CONFIRMED/PLAUSIBLE verdict split) — don't inflate a defense-in-depth suggestion into a "vulnerability."
- Report via the `ReportFindings` tool if invoked as part of a review workflow that expects it; otherwise a plain structured write-up (category → finding → concrete exploit scenario, or "not applicable, because X") is fine.
- End with an explicit per-category status table (Assessed/Clean, Assessed/Finding(s), Out of scope + why) so nothing silently falls through.
