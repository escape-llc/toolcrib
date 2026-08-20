import { type CSSProperties } from 'react';

/**
 * The one correct shape for a size-transparent trigger wrapper — used
 * anywhere a component clones/wraps a consumer-supplied trigger element in
 * its own extra `<div>`/`<span>` (`Modal`, `Popup`, `Drawer`). Extracted
 * after the same exact literal, hand-typed independently in each of those
 * three components, silently drifted once: `Popup`'s own copy used
 * `display: 'inline-block'` instead of `inline-flex` + `alignItems:
 * 'stretch'`, so its trigger never stretched to fill a parent flex
 * container's height (e.g. a `<UIGroup>` alongside taller siblings) the
 * way `Modal`'s and `Drawer`'s copies correctly did — reported directly.
 *
 * `inline-flex` + `alignItems: 'stretch'`, not `inline-block`: `inline-block`
 * never stretches a child to fill its own box, so a height-constrained
 * child (a plain `<button>` sized by its own padding) stays at its own
 * shorter natural height instead of filling the space already given to it.
 *
 * Not used by `Tooltip` — that component avoids needing a wrapper at all
 * by passing the consumer's own child straight through via Radix's
 * `asChild` (see Tooltip.tsx's own comment), which is strictly better
 * where it's achievable: one fewer DOM layer for things like `<UIGroup>`'s
 * corner-squaring CSS (which only reaches *direct* children) to see through.
 * `Modal`/`Popup`/`Drawer` can't do the same, since each also needs a
 * real DOM node of its own to attach an onClick/cursor to independent of
 * whatever the trigger element itself does.
 * @barrelExport
 */
export const TRIGGER_WRAPPER_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'stretch',
  cursor: 'pointer',
};
