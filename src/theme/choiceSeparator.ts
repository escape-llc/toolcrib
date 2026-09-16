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
 * screenshot, too subtle a difference to read clearly at normal size. A
 * SHORT, inset vertical rule -- the standard technique real toolbars use
 * for exactly this ("partial" border, not full-height) -- is a much
 * clearer signal: its SHAPE alone (visibly shorter than the strip's own
 * real border) marks it as a divider rather than an edge, so it can use
 * the same ordinary `--ai-border` color as everything else without
 * needing a second, fainter shade to do the distinguishing.
 *
 * Implemented as a `::before` pseudo-element (inline `style` props can
 * never target one -- a fundamental CSS/DOM limit, not a React one), via
 * this codebase's own established `injectGlobalStyle` mechanism. Scoped
 * by the real WAI-ARIA shape a "radio-strip" control renders as
 * (`[role="radiogroup"] > .ai-btn`), not by any one component's own class
 * -- correct for `<ToggleGroup>` today and for any future component that
 * renders the identical shape, with nothing further to opt into.
 */
const CHOICE_SEPARATOR_STYLE_ID = 'toolcrib-choice-separator';
function injectChoiceSeparatorStyles(targetDocument?: Document, nonce?: string): void {
  injectGlobalStyle(
    CHOICE_SEPARATOR_STYLE_ID,
    `
    [role="radiogroup"] > .ai-btn:not(:first-child)::before {
      content: '';
      position: absolute;
      left: 0;
      top: 25%;
      bottom: 25%;
      width: 0.0625rem;
      background: var(--ai-choice-separator, var(--ai-border, #d1d5db));
      pointer-events: none;
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
