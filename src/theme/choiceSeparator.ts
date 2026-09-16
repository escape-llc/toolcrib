'use client';

import { useEffect } from 'react';
import { useTargetDocument } from './targetDocumentContext';
import { useNonce } from './nonceContext';
import { injectGlobalStyle } from './injectGlobalStyle';

/**
 * A visually distinct interior divider for a "radio-strip" control -- a
 * connected set of buttons representing mutually-exclusive choices (e.g.
 * `<ToggleGroup>`), as opposed to the strip's own true outer boundary.
 *
 * Reported directly, from a real screenshot: every option in a strip like
 * this uses the same border as the strip's own true outer edge, so the
 * seam BETWEEN two adjacent choices rendered visually identical to where
 * the whole control ends -- nothing distinguished "this is an interior
 * division between options in one control" from "this is where the
 * control itself ends," including once the whole strip was merged into a
 * larger `<UIGroup>` alongside unrelated action buttons.
 *
 * A first attempt lightened the interior seam's own border-color instead
 * (`color-mix()` against `--ai-border`) -- technically correct (confirmed
 * via `getComputedStyle`) but, on direct visual review of a real
 * screenshot, too subtle a difference to read clearly at normal size.
 *
 * A second attempt kept every option's own full, all-sides border (the
 * same one that draws the strip's true outer edge) and layered this SHORT
 * inset `::before` rule on top of it, reasoning that its shorter SHAPE
 * alone would read as "divider, not edge." Reported directly, again, once
 * merged: still barely visible -- "had to zoom in 4 times to see it."
 * Root cause, found by actually reasoning through the box model instead of
 * trusting the shape argument: every interior seam already had a
 * continuous, full-height, identically-colored line from the two adjacent
 * items' own collapsed borders (`marginLeft: -1px`), so painting a
 * same-color half-height accent ON TOP of that already-colored line was a
 * near no-op -- there was no plain background for the shorter shape to
 * stand out against. A shape difference only reads as a shape difference
 * when the competing full-length mark isn't ALSO there.
 *
 * The real fix (see `ToggleGroup.tsx`'s own per-item border comment) is on
 * the component side, not here: an interior seam's own border-color is now
 * `transparent`, not merely a lighter shade -- only a genuine outer edge
 * (a strip's first/last item, or any item's top/bottom) draws a real
 * border. That leaves this `::before` accent as the ONLY mark at an
 * interior seam, with nothing behind it to blend into, which is what
 * actually makes the shape (short vs. full-height) perceptible at all.
 * Given that, this rule also switched its own default color from
 * `--ai-border` (very light, chosen when it still needed to *match* the
 * surrounding border) to `--ai-text-secondary` (a plainly darker,
 * higher-contrast gray) now that it's the sole visual signal at the seam
 * and no longer needs to blend in with anything.
 *
 * Implemented as a `::before` pseudo-element (inline `style` props can
 * never target one -- a fundamental CSS/DOM limit, not a React one), via
 * this codebase's own established `injectGlobalStyle` mechanism. Scoped by
 * the real WAI-ARIA shape a "radio-strip" control renders as -- but that
 * shape isn't just `role="radiogroup"`: Radix's own `ToggleGroupPrimitive`
 * renders `role="radiogroup"` for `type="single"` but `role="toolbar"` for
 * `type="multiple"` (confirmed directly against Radix's own source, not
 * assumed), so a `type="multiple"` ToggleGroup matched neither this rule
 * NOR the old always-on full border it used to (transparent) rely on --
 * caught by an external review, once `ToggleGroup.tsx`'s own interior
 * borders went transparent: a multi-select group rendered with literally
 * no visible division between any of its options at all, a real
 * regression this rule's selector alone was responsible for. `role="group"`
 * (the reviewer's own guess) isn't actually what Radix renders either --
 * verify a primitive's real DOM shape directly before matching a selector
 * to it, the same discipline AGENTS.md already asks for elsewhere.
 * `[role="toolbar"] > .ai-btn` is safe to add alongside `[role="radiogroup"]`
 * -- confirmed the plain `<Toolbar>` component (`Toolbar.tsx`) also renders
 * `role="toolbar"`, but its own `Toolbar.Button`s are never DIRECT children
 * of that role element (always nested one level deeper inside
 * `Toolbar.Left`/`.Center`/`.Right`), so the direct-child (`>`) combinator
 * here can't accidentally match it.
 *
 * A THIRD real gap, reported directly with a screenshot: the default gray
 * (`--ai-text-secondary`) divider, tuned to read clearly against a plain
 * surface, all but disappears against a SELECTED option's own solid
 * `--ai-color-primary` fill -- confirmed exactly the "Spacious" case in
 * that screenshot (a divider between an unselected and a selected option).
 * A single static color can't satisfy both backdrops at once (the same
 * reason the ORIGINAL "barely visible" bug happened was too little
 * contrast against a plain surface -- swapping to a light color would just
 * recreate that same failure against a plain surface instead of a colored
 * one). Considered and rejected: hiding the divider entirely wherever a
 * neighbor is selected, since the color change alone already marks that
 * boundary -- but this rule's own `[role="toolbar"]` support means TWO
 * ADJACENT items can both be selected at once (`type="multiple"`, e.g.
 * Bold + Italic both active), where hiding it would put two
 * identically-colored fills flush against each other with no boundary
 * mark left at all -- the exact failure this rule exists to prevent.
 *
 * The actual fix: this rule's own `::before` is a pseudo-element of
 * whichever option is NOT `:first-child` (the "owning" item, positioned at
 * its own `left: 0`) -- combined with that item's `zIndex: selected ? 1 : 0`
 * (`ToggleGroup.tsx`), a divider whose OWNING item is selected, or whose
 * immediately PRECEDING sibling is selected (Radix's own `data-state="on"`
 * attribute marks this directly), ends up painted over a primary-colored
 * fill either way. Both cases get a second, higher-specificity rule
 * switching the divider to `--ai-color-primary-text` -- the same
 * WCAG-contrast-computed "readable on a primary fill" utility variable
 * `Calendar`'s today-marker and `Stepper` already lean on for the identical
 * guarantee, not an arbitrarily-picked light color.
 */
const CHOICE_SEPARATOR_STYLE_ID = 'toolcrib-choice-separator';
function injectChoiceSeparatorStyles(targetDocument?: Document, nonce?: string): void {
  injectGlobalStyle(
    CHOICE_SEPARATOR_STYLE_ID,
    `
    [role="radiogroup"] > .ai-btn:not(:first-child)::before,
    [role="toolbar"] > .ai-btn:not(:first-child)::before {
      content: '';
      position: absolute;
      left: 0;
      top: 18%;
      bottom: 18%;
      width: 0.09375rem;
      background: var(--ai-choice-separator, var(--ai-text-secondary, #6b7280));
      pointer-events: none;
    }
    [role="radiogroup"] > .ai-btn[data-state="on"]:not(:first-child)::before,
    [role="toolbar"] > .ai-btn[data-state="on"]:not(:first-child)::before,
    [role="radiogroup"] > .ai-btn[data-state="on"] + .ai-btn::before,
    [role="toolbar"] > .ai-btn[data-state="on"] + .ai-btn::before {
      background: var(--ai-choice-separator-selected, var(--ai-color-primary-text, #ffffff));
    }
    `,
    targetDocument,
    nonce
  );
}

/**
 * Convenience hook wrapping the `useTargetDocument()` + `useEffect(() =>
 * injectChoiceSeparatorStyles(targetDocument), [targetDocument])` triad --
 * matches `useInjectInteractionStyles`'s own identical shape (the same
 * reasoning: found hand-copied at each call site otherwise).
 */
/** @barrelExport */
export function useInjectChoiceSeparatorStyles(): void {
  const targetDocument = useTargetDocument();
  const nonce = useNonce();
  useEffect(() => {
    injectChoiceSeparatorStyles(targetDocument, nonce);
  }, [targetDocument, nonce]);
}
