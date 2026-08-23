import React, { type ReactElement, type ReactNode, cloneElement, isValidElement } from 'react';
import { type SquareCornerOption } from '../components/Card/Card';

/** @barrelExport */
export type PopoverSide = 'top' | 'right' | 'bottom' | 'left';
/**
 * `'stretch'` is for a popup sized to match the trigger exactly on the
 * cross axis (e.g. `Combobox`'s listbox, `width:
 * var(--radix-popover-trigger-width)`) — the whole connecting edge meets
 * the trigger, not just one corner, so *both* corners on that edge square
 * off. `'center'` still squares nothing (no single connecting corner).
 * @barrelExport
 */
export type PopoverAlign = 'start' | 'center' | 'end' | 'stretch';

type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

// Which corner of the POPUP touches the trigger, and which corner of the
// TRIGGER touches the popup, for every side/align combination that has one
// well-defined connecting corner. `align: 'center'` has no single corner
// (the popup straddles the trigger's midpoint on that axis), so it's
// deliberately absent here and falls back to no squaring at all -- a
// centered menu just keeps its normal fully-rounded shape.
const POPUP_CORNER: Record<string, Corner> = {
  'bottom-start': 'top-left',
  'bottom-end': 'top-right',
  'top-start': 'bottom-left',
  'top-end': 'bottom-right',
  'right-start': 'top-left',
  'right-end': 'bottom-left',
  'left-start': 'top-right',
  'left-end': 'bottom-right',
};

const TRIGGER_CORNER: Record<string, Corner> = {
  'bottom-start': 'bottom-left',
  'bottom-end': 'bottom-right',
  'top-start': 'top-left',
  'top-end': 'top-right',
  'right-start': 'top-right',
  'right-end': 'bottom-right',
  'left-start': 'top-left',
  'left-end': 'bottom-left',
};

// align: 'stretch' -- both corners on the connecting edge, one lookup per
// side rather than per side-align pair (align is irrelevant once the
// popup spans the trigger's full cross-axis size).
const STRETCH_POPUP_CORNERS: Record<PopoverSide, [Corner, Corner]> = {
  bottom: ['top-left', 'top-right'],
  top: ['bottom-left', 'bottom-right'],
  right: ['top-left', 'bottom-left'],
  left: ['top-right', 'bottom-right'],
};

const STRETCH_TRIGGER_CORNERS: Record<PopoverSide, [Corner, Corner]> = {
  bottom: ['bottom-left', 'bottom-right'],
  top: ['top-left', 'top-right'],
  right: ['top-right', 'bottom-right'],
  left: ['top-left', 'bottom-left'],
};

// A plain `Record<Corner, keyof CSSProperties>` plus dynamic indexed
// assignment doesn't type-check here: TS can't correlate "this specific
// key" with "therefore this value type" through a dynamic lookup, so it
// falls back to the union of every CSSProperties value type, which `0`
// doesn't satisfy for most of them. A switch keeps each assignment on its
// own literal property name instead, where the value type actually is
// `string | number`.
function setRadiusCorner(style: React.CSSProperties, corner: Corner, value: 0 | string): void {
  switch (corner) {
    case 'top-left': style.borderTopLeftRadius = value; break;
    case 'top-right': style.borderTopRightRadius = value; break;
    case 'bottom-left': style.borderBottomLeftRadius = value; break;
    case 'bottom-right': style.borderBottomRightRadius = value; break;
  }
}

/** @barrelExport */
export interface CornerSquaringResult {
  /** Pass straight through to the Radix `*.Content`'s own `side`/`align` props — kept here so a caller's `side`/`align` state and its corner-squaring can't drift apart. */
  side: PopoverSide;
  align: PopoverAlign;
  /** A slight negative overlap (not just 0) reads as one continuous seam rather than two adjacent flat edges — the value every `sideOffset` in the toolkit that uses this hook shares. */
  sideOffset: number;
  /** Spread into the popup content's own `style` — always a complete four-corner `borderRadius`, with the corner facing the trigger flattened to 0 while open. */
  popupCornerStyle: React.CSSProperties;
  /** Direct style patch for a plain DOM element trigger (a `<button>`, an `<input>` a component owns directly) — only the one facing corner, `0` while open and back to `radius` while closed so it doesn't permanently truncate the trigger's own shape. */
  triggerCornerStyle: React.CSSProperties;
  /** Same information in the shared `SquareCornerOption` vocabulary, for a toolcrib-native trigger component that already understands a `squareCorners` prop (`<Button>`, `<Card>`, ...). */
  triggerSquareCorners: SquareCornerOption;
}

/**
 * The one place "the look" — a popup that reads as directly attached to
 * its trigger rather than a floating chip — gets computed, for any
 * Radix Popper-based trigger+popup pair (`Popup`, `Combobox`, `DropdownMenu`
 * all call this). Pure function: feed it where the popup is anchored, get
 * back everything needed to wire both sides up. `isOpen` only gates the
 * *trigger's* squared corner (the trigger is always mounted, open or
 * closed, and should only look "attached" while actually attached) — the
 * popup content itself is conditionally mounted by Radix already, so its
 * own corner style doesn't need the same gate.
 */
export function computeCornerSquaring(
  side: PopoverSide,
  align: PopoverAlign,
  isOpen: boolean,
  radius: string = 'var(--ai-radius-lg, 0.5rem)'
): CornerSquaringResult {
  const popupCorners: Corner[] = align === 'stretch' ? STRETCH_POPUP_CORNERS[side] : [POPUP_CORNER[`${side}-${align}`]].filter((c): c is Corner => Boolean(c));
  const triggerCorners: Corner[] = align === 'stretch' ? STRETCH_TRIGGER_CORNERS[side] : [TRIGGER_CORNER[`${side}-${align}`]].filter((c): c is Corner => Boolean(c));

  const popupCornerStyle: React.CSSProperties = {
    borderTopLeftRadius: radius,
    borderTopRightRadius: radius,
    borderBottomLeftRadius: radius,
    borderBottomRightRadius: radius,
  };
  for (const corner of popupCorners) {
    setRadiusCorner(popupCornerStyle, corner, 0);
  }

  const triggerCornerStyle: React.CSSProperties = {};
  for (const corner of triggerCorners) {
    // `radius`, not the CSS keyword 'inherit' — 'inherit' pulls a
    // non-inherited property like border-radius from the PARENT element's
    // computed value, not "this trigger's own normal radius" (there's no
    // stylesheet rule to fall back to here; the trigger's own base radius
    // is itself just another inline style value set by the caller, same as
    // this one). Reported directly: a plain-DOM-element trigger (Combobox's
    // own wrapper div, which spreads this directly rather than going
    // through renderTriggerWithCornerSquaring's squareCorners-prop path)
    // showed its connecting corners already flattened even while CLOSED,
    // because its parent's own radius happened to be 0 — confirmed via the
    // element's raw inline style attribute, not just the computed value.
    setRadiusCorner(triggerCornerStyle, corner, isOpen ? 0 : radius);
  }

  return {
    side,
    align,
    sideOffset: -1,
    popupCornerStyle,
    triggerCornerStyle,
    triggerSquareCorners: triggerCorners.length && isOpen ? triggerCorners : 'none',
  };
}

/**
 * Applies a `CornerSquaringResult`'s trigger-side corner to an arbitrary
 * `trigger` element: a toolcrib-native component (anything not a bare
 * `"div"`/`"button"`/etc. string element type) gets `squareCorners` cloned
 * in as a typed prop it already understands; a plain DOM element gets a
 * direct `style` patch instead, since it has no such prop to consult. Same
 * dispatch `Popup` already used, extracted so `DropdownMenu` doesn't have
 * to duplicate it to get the same trigger-squaring `Popup` has.
 */
export function renderTriggerWithCornerSquaring(trigger: ReactNode, squaring: CornerSquaringResult): ReactNode {
  if (!isValidElement(trigger)) return trigger;
  const element = trigger as ReactElement<any>;
  const isToolcribComponent = typeof element.type !== 'string';
  return isToolcribComponent
    ? cloneElement(element, { squareCorners: squaring.triggerSquareCorners })
    : cloneElement(element, {
        style: { ...(element.props as any).style, ...squaring.triggerCornerStyle, transition: 'border-radius 0.15s ease' },
      });
}
