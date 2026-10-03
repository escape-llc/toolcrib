'use client';

// The mechanics every portal overlay built on Base UI shares, done once
// (#670, #692). Modal/AlertDialog/Drawer (modal family) and Popup/Tooltip/
// HoverCard/menus/Select/Combobox (anchored family) all need the same four
// things each would otherwise wire by hand:
//   1. the portal container: the target document's body, so an overlay opened
//      inside an iframe or pop-out window renders there, not in the host page;
//   2. a z-index from the toolkit's tiers, stacked strictly upward for nested
//      or simultaneous instances of the same tier (useStackedZIndex);
//   3. the CSP nonce, handed to Base UI's own injected styles via CSPProvider
//      (toolcrib's injectGlobalStyle already takes it);
//   4. enter/exit keyframes keyed on Base UI's state attributes: data-open
//      while open, data-closed through the exit. Base UI keeps the node mounted
//      until the element's running animations finish, the same guarantee a
//      Presence component gives (measured in the #670 Popup spike: animationend, no cancel).
import React, { useEffect, type ReactElement, type ReactNode } from 'react';
import { CSPProvider } from '@base-ui/react/csp-provider';
import { useStackedZIndex } from '../../../theme/zIndexStack';
import { type ZIndexScale } from '../../../theme/zIndex';
import { useTargetDocument } from '../../../theme/targetDocumentContext';
import { useNonce } from '../../../theme/nonceContext';
import { injectGlobalStyle } from '../../../theme/injectGlobalStyle';
import { useInjectInteractionStyles } from '../../../theme/interactionStyles';

export interface OverlayLayer {
  /** Where the portal renders: the target document's body (undefined = Base UI's default, document.body). */
  container: HTMLElement | undefined;
  /** This instance's z-index: the tier's base, raised for each same-tier instance already open. */
  zIndex: number;
}

/**
 * The shared portal plumbing for one overlay instance: its container and its
 * stacked z-index in `tier`. `zIndexOverride` is the component's own `zIndex`
 * prop, an escape hatch that wins when set.
 */
export function useOverlayLayer(tier: ZIndexScale, zIndexOverride?: number): OverlayLayer {
  const targetDocument = useTargetDocument();
  const stacked = useStackedZIndex(tier);
  useInjectInteractionStyles();
  return { container: targetDocument?.body, zIndex: zIndexOverride ?? stacked };
}

/** Passes the app's CSP nonce to any `<style>` Base UI injects inside `children`. */
export const OverlayCSP: React.FC<{ children: ReactNode }> = ({ children }) => {
  const nonce = useNonce();
  return <CSPProvider nonce={nonce}>{children}</CSPProvider>;
};

/**
 * Props for a Base UI trigger part that renders the consumer's own element
 * (`<Dialog.Trigger {...triggerRenderProps(trigger)} />`). Base UI assumes
 * that element is a native `<button>` unless told otherwise; when it isn't,
 * `nativeButton: false` makes Base UI add `role="button"`, a tab stop and
 * Enter/Space activation itself. An intrinsic element is native only if it's
 * a `<button>`. A component is assumed to render one (Button does, and a
 * Tooltip-wrapped Button passes it through); if it doesn't, Base UI's own
 * dev warning names the trigger.
 */
export function triggerRenderProps(trigger: ReactElement): { render: ReactElement; nativeButton: boolean } {
  return { render: trigger, nativeButton: typeof trigger.type === 'string' ? trigger.type === 'button' : true };
}

/**
 * Enter/exit keyframes for one overlay part, keyed on Base UI's state
 * attributes. `enter` and `exit` are the toolkit's shared keyframe names
 * (animationKeyframes.ts: ai-fade-in, ai-scale-out, ...).
 */
export interface PartAnimation {
  className: string;
  enter: string | string[];
  exit: string | string[];
  /** Duration and easing, for a part with its own theme timing (Drawer's --ai-drawer-duration/-easing). Defaults to the shared transition tokens. */
  timing?: string;
  /**
   * For an anchored popup (#735): scale from the point nearest its anchor.
   * Base UI's Positioner sets `--transform-origin` there, and the popup
   * inherits it; pair with ai-pop-in/ai-pop-out.
   */
  fromAnchor?: boolean;
}

/**
 * Collision avoidance for a list capped at `var(--available-height)` (Select,
 * Combobox, menus; #736): flip between the preferred side and its opposite,
 * never to the perpendicular axis. Base UI's own Select and Combobox use this
 * (its internal DROPDOWN_COLLISION_AVOIDANCE); toolcrib's are built on
 * Popover, whose default also falls back sideways. Sideways, a cramped list
 * jumped beside its field, and its size, which depends on the space on the
 * current side, set Base UI flipping back and forth (a ResizeObserver loop).
 */
export const DROPDOWN_COLLISION = { fallbackAxisSide: 'none' } as const;

/** The enter/exit pair for anchored popups: a fade plus a small scale, from the anchor (#735). */
export const ANCHORED_POP = { enter: 'ai-pop-in', exit: 'ai-pop-out', fromAnchor: true } as const;

const TIMING = 'var(--ai-transition-duration-normal, 0.2s) var(--ai-transition-easing, ease)';
const list = (names: string | string[], timing = TIMING, fill = '') => (Array.isArray(names) ? names : [names]).map(n => `${n} ${timing}${fill}`).join(', ');

/** Class for a Base UI `*.Arrow` part styled by `useOverlayArrowStyles`. */
export const OVERLAY_ARROW_CLASS = 'ai-overlay-arrow';

const ARROW_SIZE = 0.625; // rem
const ARROW_OUTER_EDGES: Record<string, [string, string]> = {
  bottom: ['top', 'left'],
  top: ['bottom', 'right'],
  right: ['bottom', 'left'],
  left: ['top', 'right'],
};

/**
 * The arrow for an anchored overlay (Tooltip, HoverCard). Base UI's is an
 * empty element it positions along the cross axis, with `data-side` naming the popup's side. This draws it as a
 * square rotated 45°, pulled half out of the popup on the main axis, so its
 * outer half reads as a point. Set on the arrow's inline style:
 * `--ai-arrow-bg` (the popup's background) and, for a bordered popup,
 * `--ai-arrow-border` (the popup's border shorthand), drawn on the two outward
 * edges only.
 *
 * Keep the popup's `contain` to `layout style`: paint containment clips
 * descendants to the popup's box, which cuts the arrow off.
 */
export function useOverlayArrowStyles(): void {
  const targetDocument = useTargetDocument();
  const nonce = useNonce();
  useEffect(() => {
    const half = `-${ARROW_SIZE / 2}rem`;
    const opposite: Record<string, string> = { bottom: 'top', top: 'bottom', right: 'left', left: 'right' };
    const css = [
      `.${OVERLAY_ARROW_CLASS} { width: ${ARROW_SIZE}rem; height: ${ARROW_SIZE}rem; transform: rotate(45deg); background: var(--ai-arrow-bg); }`,
      ...Object.entries(ARROW_OUTER_EDGES).map(
        ([side, [a, b]]) =>
          `.${OVERLAY_ARROW_CLASS}[data-side="${side}"] { ${opposite[side]}: ${half}; border-${a}: var(--ai-arrow-border, none); border-${b}: var(--ai-arrow-border, none); }`
      ),
    ].join('\n');
    injectGlobalStyle('toolcrib-overlay-arrow-baseui', css, targetDocument, nonce);
  }, [targetDocument, nonce]);
}

export function useOverlayAnimations(styleId: string, parts: PartAnimation[]): void {
  const targetDocument = useTargetDocument();
  const nonce = useNonce();
  const css = parts
    .map(
      p =>
        (p.fromAnchor ? `.${p.className} { transform-origin: var(--transform-origin, center); }\n` : '') +
        `.${p.className}[data-open] { animation: ${list(p.enter, p.timing)}; }\n.${p.className}[data-closed] { animation: ${list(p.exit, p.timing, ' forwards')}; }`
    )
    .join('\n');
  useEffect(() => {
    injectGlobalStyle(styleId, css, targetDocument, nonce);
  }, [styleId, css, targetDocument, nonce]);
}
