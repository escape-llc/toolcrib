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
 * `key` is a separate, cheap-to-compare identity for `content` (e.g. the
 * raw error string itself), NOT the rendered element -- `content` is a
 * fresh JSX object every render even when the underlying text hasn't
 * actually changed, so comparing `content` directly (an earlier version
 * of this hook did) re-triggers its own "content changed" branch on
 * every single render, an infinite re-render loop caught by this
 * repo's own test suite, not just reasoned about. `key` being a plain
 * string means the comparison is by VALUE, so state only updates when
 * the identity has genuinely changed.
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
 * fresh key, or swapping from one non-empty key to another, e.g.
 * helperText -> error) is always reflected immediately -- there's no
 * visual "pop" to avoid there, since the wrapper is already expanded (or
 * expanding) either way; deferring that direction too would just delay
 * showing new, correct content for no benefit.
 */
export function useDeferredCollapseContent(key: string | undefined, content: ReactNode | undefined | false): {
  display: ReactNode | undefined | false;
  onTransitionEnd: (e: TransitionEvent<HTMLElement>) => void;
} {
  const [heldKey, setHeldKey] = useState<string | undefined>(key);
  const [heldContent, setHeldContent] = useState<ReactNode | undefined | false>(content);

  const isEmpty = key === undefined;
  if (!isEmpty && heldKey !== key) {
    setHeldKey(key);
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
    setHeldKey(undefined);
    setHeldContent(undefined);
  };

  return { display, onTransitionEnd };
}
