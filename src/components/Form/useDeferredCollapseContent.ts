'use client';

import { useState, type ReactNode, type TransitionEvent } from 'react';

/**
 * Keeps rendering the last non-empty `content` through a CSS collapse
 * transition, instead of unmounting it the instant the underlying
 * condition goes false (issue #507). A plain `{condition && <span>...}`
 * removes the text node on the very next paint, before the wrapper's own
 * `grid-template-rows` shrink transition (FormField/FormError's own
 * `0fr -> 1fr` mechanism, issue #503) has actually run -- so the collapse
 * animates an already-empty region instead of the text visibly sliding
 * away with it.
 *
 * Mirrors `DataTable.tsx`'s own `justLeftEmptyState`/
 * `handleRowEntranceAnimationEnd` shape: hold the last-shown content in
 * state, clear it only once a real `onTransitionEnd` fires for the
 * wrapper's own collapsing property -- never a fixed timeout guess (see
 * AGENTS.md's own "wait for a real signal" rule).
 *
 * `kind` + `rawValue` are a separate, cheap identity for `content` --
 * NOT the rendered element itself, and NOT a stringified version of
 * arbitrary content either. Two real bugs found in review (Gemini, PR
 * #511) before this shape was settled on:
 *
 * 1. An earlier version compared `content` (the rendered element)
 *    directly -- a fresh JSX object every render even when the
 *    underlying text hasn't changed, so the comparison was always
 *    "different," an infinite re-render loop caught by the real test
 *    suite (not just reasoned about).
 * 2. A follow-up version derived a comparable string key via
 *    `String(helperText)` -- works for a plain string, but collapses
 *    ANY React-element `helperText` to the literal text "[object
 *    Object]", so a later change from one JSX helperText value to a
 *    DIFFERENT one would go undetected, silently holding onto the
 *    FIRST JSX value shown rather than the most recent one once a
 *    collapse actually happened.
 *
 * The fix: compare `rawValue` (the actual `error`/`helperText` PROP, as
 * literally received -- never something this hook or its caller
 * constructs fresh each render) via plain `!==`. This works correctly
 * for a string (`!==` compares by value) and safely, if a little
 * eagerly, for a React element (`!==` compares by reference, so a
 * fresh element every consumer render is treated as "changed" every
 * time) -- eager-but-safe is fine here specifically because `rawValue`
 * is a raw PROP, not something rebuilt as a side effect of this hook's
 * own state updates: a resync triggered by this hook only re-renders
 * this component itself, which receives the exact same prop reference
 * again on that self-triggered render (a parent re-render is what would
 * hand it something new, and this hook's own setState calls never cause
 * that) -- so it settles after one extra render, it can't compound into
 * an unbounded loop the way comparing freshly-constructed `content`
 * directly did. `kind` (e.g. `'error'` vs `'helper'`) is compared
 * alongside `rawValue` so a swap between the two with coincidentally
 * identical text still counts as a real change.
 *
 * Deliberately plain `useState`, not a `useRef` holding the last value --
 * an earlier version read `ref.current` inside the render-phase
 * calculation below, which `eslint-plugin-react-hooks`'s `react-hooks/
 * refs` rule correctly flags: a ref mutated during a prior render and
 * read back during this one bypasses React's own re-render guarantee
 * (nothing forces a re-render just because a ref changed), which can
 * behave unpredictably under concurrent rendering. State is the correct
 * tool here specifically because this value IS part of render output.
 *
 * Only defers the CLEARING direction. `content` becoming non-empty (a
 * fresh kind/value, or swapping from one non-empty pair to another,
 * e.g. helperText -> error) is always reflected immediately -- there's
 * no visual "pop" to avoid there, since the wrapper is already expanded
 * (or expanding) either way; deferring that direction too would just
 * delay showing new, correct content for no benefit.
 */
export function useDeferredCollapseContent(kind: string | undefined, rawValue: unknown, content: ReactNode | undefined | false): {
  display: ReactNode | undefined | false;
  onTransitionEnd: (e: TransitionEvent<HTMLElement>) => void;
} {
  const [heldKind, setHeldKind] = useState<string | undefined>(kind);
  const [heldRawValue, setHeldRawValue] = useState<unknown>(rawValue);
  const [heldContent, setHeldContent] = useState<ReactNode | undefined | false>(content);

  const isEmpty = kind === undefined;
  if (!isEmpty && (heldKind !== kind || heldRawValue !== rawValue)) {
    setHeldKind(kind);
    setHeldRawValue(rawValue);
    setHeldContent(content);
  }

  // Computed locally (not just read back from useState) so THIS render
  // already reflects the setHeldContent call just above, rather than
  // waiting an extra render -- the same "adjust state during render"
  // idiom `Popup.tsx`'s `useActualPopoverSide`/`closedResyncKey` already
  // establishes in this codebase.
  const display = !isEmpty ? content : heldContent;

  const onTransitionEnd = (e: TransitionEvent<HTMLElement>) => {
    // `e.target === e.currentTarget` -- the same bubbled-event guard
    // DataTable.tsx's own onAnimationEnd handler uses, for the identical
    // reason: this wrapper has no nested animating child today, but
    // guarding against a bubbled transitionend from one a future change
    // might add costs nothing and matches established practice.
    // `propertyName` scoped to `grid-template-rows` specifically --
    // FormField's wrapper also transitions `margin-top`/`visibility` on
    // the same element, each firing its own separate transitionend; only
    // reacting to one of the (simultaneous, same-duration) properties
    // avoids redundant handling.
    if (e.target !== e.currentTarget || e.propertyName !== 'grid-template-rows') return;
    // `isEmpty` (captured from THIS render's own `kind`, via closure --
    // fresh every render, so always current) -- a real finding in
    // review (Gemini, PR #511): an EXPAND transition (0fr -> 1fr) also
    // fires its own grid-template-rows transitionend, and an earlier
    // version cleared unconditionally here regardless of direction --
    // harmless visually (display already ignores heldContent whenever
    // non-empty), but it meant every single expand triggered a clear
    // immediately followed by a redundant re-sync render, two wasted
    // re-renders on every expansion. Only a genuine collapse (content
    // now empty) should actually clear the held value.
    if (isEmpty) {
      setHeldKind(undefined);
      setHeldRawValue(undefined);
      setHeldContent(undefined);
    }
  };

  return { display, onTransitionEnd };
}
