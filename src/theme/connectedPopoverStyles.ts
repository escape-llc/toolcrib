import React, { type ReactElement, type ReactNode, cloneElement, isValidElement } from 'react';
import { type SquareCornerOption } from '../components/Card/Card';

/** @barrelExport */
export type PopoverSide = 'top' | 'right' | 'bottom' | 'left';
/** @barrelExport */
export type PopoverAlign = 'start' | 'center' | 'end';

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

// A plain `Record<Corner, keyof CSSProperties>` plus dynamic indexed
// assignment doesn't type-check here: TS can't correlate "this specific
// key" with "therefore this value type" through a dynamic lookup, so it
// falls back to the union of every CSSProperties value type, which `0`
// doesn't satisfy for most of them. A switch keeps each assignment on its
// own literal property name instead, where the value type actually is
// `string | number`.
function setRadiusCorner(style: React.CSSProperties, corner: Corner, value: 0 | 'inherit'): void {
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
  /** Direct style patch for a plain DOM element trigger (a `<button>`, an `<input>` a component owns directly) — only the one facing corner, `0` while open and `'inherit'` while closed so it doesn't permanently truncate the trigger's own shape. */
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
  const key = `${side}-${align}`;
  const popupCorner = POPUP_CORNER[key];
  const triggerCorner = TRIGGER_CORNER[key];

  const popupCornerStyle: React.CSSProperties = {
    borderTopLeftRadius: radius,
    borderTopRightRadius: radius,
    borderBottomLeftRadius: radius,
    borderBottomRightRadius: radius,
  };
  if (popupCorner) {
    setRadiusCorner(popupCornerStyle, popupCorner, 0);
  }

  const triggerCornerStyle: React.CSSProperties = {};
  if (triggerCorner) {
    setRadiusCorner(triggerCornerStyle, triggerCorner, isOpen ? 0 : 'inherit');
  }

  return {
    side,
    align,
    sideOffset: -1,
    popupCornerStyle,
    triggerCornerStyle,
    triggerSquareCorners: triggerCorner && isOpen ? [triggerCorner] : 'none',
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
