'use client';

// The mechanics every portal overlay built on Base UI shares, done once
// (#670, #692). Modal/AlertDialog/Drawer (modal family) and Popup/Tooltip/
// HoverCard/menus/Select/Combobox (anchored family) all need the same four
// things the Radix versions each wire by hand:
//   1. the portal container: the target document's body, so an overlay opened
//      inside an iframe or pop-out window renders there, not in the host page;
//   2. a z-index from the toolkit's tiers, stacked strictly upward for nested
//      or simultaneous instances of the same tier (useStackedZIndex);
//   3. the CSP nonce, handed to Base UI's own injected styles via CSPProvider
//      (toolcrib's injectGlobalStyle already takes it);
//   4. enter/exit keyframes keyed on Base UI's state attributes: data-open
//      while open, data-closed through the exit. Base UI keeps the node mounted
//      until the element's running animations finish, the same guarantee Radix
//      Presence gives (measured in the #670 Popup spike: animationend, no cancel).
import React, { useEffect, type ReactNode } from 'react';
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
 * Enter/exit keyframes for one overlay part, keyed on Base UI's state
 * attributes. `enter` and `exit` are the toolkit's shared keyframe names
 * (animationKeyframes.ts: ai-fade-in, ai-scale-out, ...).
 */
export interface PartAnimation {
  className: string;
  enter: string | string[];
  exit: string | string[];
}

const TIMING = 'var(--ai-transition-duration-normal, 0.2s) var(--ai-transition-easing, ease)';
const list = (names: string | string[], fill = '') => (Array.isArray(names) ? names : [names]).map(n => `${n} ${TIMING}${fill}`).join(', ');

export function useOverlayAnimations(styleId: string, parts: PartAnimation[]): void {
  const targetDocument = useTargetDocument();
  const nonce = useNonce();
  const css = parts
    .map(p => `.${p.className}[data-open] { animation: ${list(p.enter)}; }\n.${p.className}[data-closed] { animation: ${list(p.exit, ' forwards')}; }`)
    .join('\n');
  useEffect(() => {
    injectGlobalStyle(styleId, css, targetDocument, nonce);
  }, [styleId, css, targetDocument, nonce]);
}
