import { createContext, useContext } from 'react';
import { type SquareCornerOption } from '../Card/Card';

/**
 * A squareCorners-aware component's automatic corner-squaring when it's a
 * descendant of a `<UIGroup>` — computed by `UIGroup` itself from this
 * child's position (first / middle / last), and reachable regardless of
 * how many component layers sit in between (a `Modal`/`Popup`/
 * `AlertDialog`'s own internal trigger-wrapper `<div>`, for instance).
 * React Context propagates via the render tree, not the DOM tree, so this
 * reaches a `Button` passed as `<Popup trigger={<Button/>}>` exactly the
 * same way `useTargetDocument()`/`useNonce()` already reach components
 * nested inside a portal — no cooperation required from whatever sits
 * between `<UIGroup>` and the real control.
 *
 * A deliberately separate context from `LayoutDomainContext`
 * (`useCornerSquaring`), matching this codebase's existing convention of
 * one context per squaring *axis* rather than one shared one: that one is
 * about spatial/containment position (which edge of a panel touches a
 * `<Splitter>` divider), this one is about group membership. Same shape,
 * different concern — see `AGENTS.md`'s own note on `LayoutDomainContext`
 * vs `StyleDomainContext` for the precedent.
 */
/** @barrelExport */
export const UIGroupContext = createContext<SquareCornerOption | undefined>(undefined);

/**
 * Returns the corner-squaring this component should apply as a `<UIGroup>`
 * member, or `undefined` outside any `<UIGroup>`. Always let an explicit
 * `squareCorners` prop the consumer set directly win, via
 * `squareCorners ?? useUIGroupSquareCorners()` before passing the result
 * into `resolveSquareCorners` — see `Button`/`Input`/`Card`/`Content` for
 * the exact call-site pattern.
 */
export function useUIGroupSquareCorners(): SquareCornerOption | undefined {
  return useContext(UIGroupContext);
}
