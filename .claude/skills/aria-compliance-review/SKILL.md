---
name: aria-compliance-review
description: Audit toolcrib's components for accessibility defects the standing axe-core E2E gate (e2e/accessibility.spec.ts) structurally cannot catch — keyboard-pattern completeness for custom widgets, label/description association correctness, focus-trap/restore-on-close behavior, `:focus-visible`-vs-`:focus-within` scope errors, and content hidden behind an unopened overlay that the scan never actually reaches. Use when asked for an accessibility/ARIA audit, "is this WCAG compliant," or "does axe passing mean we're actually accessible."
context: fork
agent: Explore
---

# ARIA compliance audit — what the axe-core gate can't see

`e2e/accessibility.spec.ts` already runs a real, standing WCAG 2.1 AA scan
(`@axe-core/playwright`) on every push across all 12 demo tabs, in both
light and dark mode. Its own header comment already states the boundary
explicitly: *"axe-core's ruleset only catches the automatable slice of real
WCAG issues (contrast, missing labels, invalid ARIA, landmark structure) —
keyboard-only flow correctness, focus order, and real screen-reader behavior
still need a human pass and aren't exercised here."* This skill exists to be
that human pass, on demand, for the categories that file already admits it
doesn't cover — not to duplicate what it already does well.

Verify every claim below against current source before reporting — findings
here were confirmed at authoring time against `e2e/accessibility.spec.ts`,
`AGENTS.md`'s own accessibility bug log, and the current `.ai-focus-ring`
call sites, and may have drifted since.

## 1. Coverage check — what does the scan actually render?

**This is the first thing to check, before auditing any component**, because
it changes what "axe passes" even means. Read `scanEveryTab()` in
`e2e/accessibility.spec.ts`: it navigates the 12 top-level demo tabs and,
in the dark-mode test only, transiently opens the Theme Designer drawer
just long enough to click its light/dark toggle before closing it again
with Escape — the drawer's own content is **never scanned while open**.
Anything that only renders inside a closed-by-default `<Drawer>`/`<Modal>`/
`<Popup>`/`<ContextMenu>`/collapsed `<Accordion>`/`<Collapsible>` section is
invisible to axe regardless of how thorough its ruleset is, because there's
nothing in the DOM for it to inspect. This is exactly why the `FieldRow`
unassociated-label bug (~50 call sites inside the Theme Designer's own
drawer content, fixed in commit `1b17cd3`) survived until a full manual
audit found it — the standing axe gate was never actually looking at that
surface.

Enumerate every overlay/gated surface in `demo/App.tsx` and cross-check
against `scanEveryTab()`'s navigation: for each one, is its content actually
open and in the DOM at some point during the scan? If not, name it
explicitly as an *unscanned surface*, not a false "no violations found" —
the two mean very different things, and only a manual pass (this skill, or
a scan-coverage fix to the E2E spec itself) closes the gap.

## 2. Custom widget keyboard-pattern completeness

axe-core inspects rendered markup; it never drives a keyboard, so a widget
can have a perfectly valid `role`/`aria-*` surface and still be completely
unusable without a mouse. For every component implementing a WAI-ARIA
Authoring Practices pattern — `Tree` (Treeview), `Combobox`, `CommandPalette`,
`Rating` (radiogroup), `Stepper`/`TabStrip` (tablist), `DataTable`'s
selection/sort controls, `Carousel` — confirm the *actual documented
keyboard interactions* for that pattern are implemented (arrow-key
navigation, Home/End, type-ahead where applicable, Escape to dismiss,
Enter/Space to activate), not just that the corresponding ARIA attributes
are present. Read the component's own keydown handler, don't infer
correctness from its `role` alone.

## 3. Label/description association — not just "has *a* name," but "has the *right* one"

axe's `label` rule catches a control with **zero** programmatic accessible
name; it does not verify that the visible label a sighted user reads is the
*same* one a screen reader announces. The `FieldRow` bug's precise shape was
a visible label and its `<Select>` both individually present in the DOM,
un-cross-referenced — confirm every shared label/field helper (`FieldRow`
and anything with the same shape) associates via `htmlFor`/`id` or
`aria-labelledby` generated from a single `useId()` call internal to the
helper, not left to each of ~50 call sites to remember correctly. A
single shared helper closes this class of bug at the source; auditing each
call site individually does not scale and was exactly how this one went
unnoticed for as long as it did.

## 4. Focus management for overlays

For `Modal`, `Drawer`, `Popup`, `AlertDialog`, `ContextMenu`: confirm (a)
focus is trapped inside while open — Tab/Shift+Tab never escapes to the
underlying page, (b) focus returns to the triggering element on close, and
(c) nested overlays behave correctly (per `AGENTS.md`'s own example: a
`<Viewer>` nested inside a `<Modal>` — Escape closes only the `<Viewer>`,
not the parent). None of this is inspectable from a single static DOM
snapshot, which is all axe ever sees.

**`HoverCard` is the one deliberate exception, confirmed, not a bug to
report.** `@radix-ui/react-hover-card`'s `Content` runs a `useEffect` (no
dep array, every render) that walks every tabbable descendant and
force-sets `tabindex="-1"` on each — verified directly in
`node_modules/@radix-ui/react-hover-card/dist/index.js`, not inferred from
symptoms. Radix's own accessibility docs for this component state this is
intentional: hover-card content is supplemental preview material,
deliberately excluded from the Tab order, and their own guidance is to use
Popover (toolcrib's `<Popup>`) instead whenever interactive content inside
genuinely needs to be keyboard-reachable. `HoverCard.tsx`'s own JSDoc and
`e2e/accessibility.spec.ts`'s regression test (asserting Tab does *not*
reach a button inside) both document this — a future audit finding "a
button inside `HoverCard` has `tabindex="-1"`" should confirm this is still
that same known, upstream-confirmed mechanism before reporting it as a
fresh finding.

## 5. `:focus-visible` vs `:focus-within` scope errors

A documented, previously-real bug class (`AGENTS.md`, commit `508e935`):
`.ai-focus-ring` is a `:focus-visible` rule — it only ever matches the exact
element it's applied to. Applying it to a non-focusable wrapper `<div>`
around a real focusable descendant (a `Combobox`'s own `<input>`, e.g.)
draws **no ring at all, ever** — not a subtle rendering issue, a complete
silent failure. `grep -rn "ai-focus-ring" src/` (currently 24 files) and
confirm each usage sits on the actual element that receives real DOM focus,
not a wrapper around one — a wrapper needs a `:focus-within` rule instead
(a distinct, sibling CSS rule for that shape, not a change to the shared
class — see `AGENTS.md`'s own note on why the two must stay separate).

## 6. axe false-positive triage discipline — don't rubber-stamp the existing disable

`e2e/accessibility.spec.ts` disables `color-contrast` with a documented,
hand-verified reason (axe-core 4.13.0 misreads a `color-mix()`/relative-color
CSS value serialized as `oklab(...)`/`color(srgb ...)` in this Chromium
build). Confirm this carve-out is still no broader than that specific,
verified false-positive shape — if a *real* contrast regression ever gets
introduced, it would currently be silently waved through by this same
disable unless someone re-verifies by hand (the WCAG relative-luminance
formula against the actual computed color) rather than assuming every
future contrast complaint in this environment is the same known false
positive. Re-run that hand calculation for any element newly relying on
this disable, don't just cite the existing comment as blanket cover.

A second carve-out lives alongside it: `ARIA_HIDDEN_FOCUS_DISABLED`
(`aria-hidden-focus`), scoped only to `DropdownMenu`/`ContextMenu` scans —
both Radix Menu-family primitives (`@radix-ui/react-menu`) call
`hideOthers()` to `aria-hidden` the rest of the page while open, but since
this demo's whole app lives inside one `#root`, axe sees "aria-hidden
container with focusable descendants" everywhere underneath. Confirmed by
direct Tab-trace (not assumed): pressing Tab repeatedly with the menu open
never moves focus outside it — Radix's `FocusScope` intercepts Tab at the
keydown level regardless of what's nominally still tabbable in the DOM. Same
discipline as the color-contrast carve-out: re-verify the Tab-trace by hand
if Radix's menu internals ever change, don't extend this disable to a new
overlay type without confirming the same trap-vs-static-DOM gap actually
applies there too — `Modal`/`Drawer`/`AlertDialog`/`Popup` do **not** need
it (confirmed clean without the disable in the same test file).

## 7. Live-region / dynamic-content announcement correctness

For state changes that happen without a corresponding focus move —
`Toast` appearing, `DataTable` sort/filter/pagination updates, async loading
states resolving — confirm screen-reader users get an announcement
(`aria-live`, `role="status"`/`"alert"`, or equivalent) rather than a
purely visual change. axe-core can confirm an `aria-live` region *exists*
in markup but cannot confirm it actually fires at the right moment for the
right change — trace the actual state-update path for a representative
case rather than trusting attribute presence alone.

## Reporting discipline

Match `owasp-review`'s standard, not a generic checklist pass:
- Quote the actual file:line for every finding, and state concretely what a
  keyboard-only or screen-reader user would experience — not a generic
  "may have accessibility issues."
- Explicitly separate "unscanned surface" (§1) from "scanned and clean" —
  collapsing the two into one "no findings" statement misrepresents what
  was actually checked.
- End with a status table per category (Assessed/Clean, Assessed/Finding(s),
  Unscanned-surface-identified) so nothing silently reads as verified when
  it was actually just never reached.
