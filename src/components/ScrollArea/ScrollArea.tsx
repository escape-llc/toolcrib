'use client';

import React, { useEffect, type ReactNode } from 'react';
import { ScrollArea as BaseScrollArea } from '@base-ui/react/scroll-area';
import { getSparseVariables } from '../../theme/slice';
import { useNonce } from '../../theme/nonceContext';
import { useTargetDocument } from '../../theme/targetDocumentContext';
import { injectGlobalStyle } from '../../theme/injectGlobalStyle';
import { OverlayCSP } from '../Overlay/baseui/overlayLayer';
import { ScrollAreaThemeSlice, type ScrollAreaSliceState } from './ScrollAreaSlice';

/** Props for the `<ScrollArea>` themed-scrollbar container. */
export interface ScrollAreaProps {
  children: ReactNode;
  /** Which axis renders a scrollbar. `'both'` also renders the corner patch. @default 'vertical' */
  orientation?: 'vertical' | 'horizontal' | 'both';
  /**
   * When the scrollbar is visible — `'hover'` matches native OS scrollbar
   * behavior most closely. @default 'hover'
   */
  type?: 'auto' | 'always' | 'scroll' | 'hover';
  /**
   * Fixed height (e.g. `'20rem'`) for standalone use outside a flex domain.
   * Omit to fill 100% of the parent instead, the same fill-by-default
   * convention as `<Content>`.
   */
  maxHeight?: string;
  /** Per-instance override for the scrollbar thumb's thickness. */
  overrides?: Partial<ScrollAreaSliceState>;
}

const SCROLLBAR_CLASS = 'ai-scrollarea-scrollbar';

// The `type` prop, on Base UI's scrollbar attributes (#702). Base UI keeps a
// scrollbar mounted whenever its axis overflows and marks it data-hovering
// (pointer over the area) and data-scrolling; showing and hiding it is left
// to CSS. `auto` is visible whenever it's mounted, i.e. whenever there's
// overflow; `always` is also kept mounted without overflow (keepMounted).
const SCROLLBAR_CSS = `
.${SCROLLBAR_CLASS} { transition: opacity var(--ai-transition-duration-fast, 160ms) var(--ai-transition-easing, ease); }
.${SCROLLBAR_CLASS}[data-visibility="hover"]:not([data-hovering]):not([data-scrolling]),
.${SCROLLBAR_CLASS}[data-visibility="scroll"]:not([data-scrolling]) { opacity: 0; }
`;

/**
 * Cross-browser themed scrollbar, replacing the native OS scrollbar (which
 * can't be styled through the HSV variable system) whenever an AI-generated
 * panel needs `overflow: auto` with an on-brand look instead of ad-hoc
 * `scrollbar-color` CSS.
 * @manifest Scrollable container with a themed, cross-browser custom scrollbar
 * @manifestCategory Containers
 */
export const ScrollArea: React.FC<ScrollAreaProps> = ({
  children,
  orientation = 'vertical',
  type = 'hover',
  maxHeight,
  overrides,
}) => {
  const scrollAreaVars = getSparseVariables(ScrollAreaThemeSlice, overrides ?? {});
  // Issue #625: the viewport's own injected <style> (hiding the native
  // scrollbar) needs the CSP nonce; OverlayCSP below hands it to Base UI.
  const nonce = useNonce();
  const targetDocument = useTargetDocument();
  useEffect(() => {
    injectGlobalStyle('toolcrib-scrollarea-styles', SCROLLBAR_CSS, targetDocument, nonce);
  }, [targetDocument, nonce]);
  const showVertical = orientation === 'vertical' || orientation === 'both';
  const showHorizontal = orientation === 'horizontal' || orientation === 'both';

  const scrollbarProps = { className: SCROLLBAR_CLASS, keepMounted: type === 'always', 'data-visibility': type } as const;

  return (
    <OverlayCSP>
    <BaseScrollArea.Root
      style={{
        width: '100%',
        height: maxHeight ?? '100%',
        minHeight: 0,
        overflow: 'hidden',
        ...scrollAreaVars,
      }}
    >
      {/* tabIndex -- the Viewport is overflow:scroll internally
          with no tabIndex of its own, so a keyboard-only user has no way to
          reach and scroll it unless its content happens to contain another
          focusable element (axe: scrollable-region-focusable). Same fix as
          Content.Grow. */}
      <BaseScrollArea.Viewport tabIndex={0} style={{ width: '100%', height: '100%' }}>
        {children}
      </BaseScrollArea.Viewport>
      {showVertical && (
        <BaseScrollArea.Scrollbar
          orientation="vertical"
          {...scrollbarProps}
          style={{
            display: 'flex',
            userSelect: 'none',
            touchAction: 'none',
            padding: '0.125rem',
            width: 'var(--ai-scrollarea-thumb-size, 0.5rem)',
            background: 'transparent',
            transition: 'background var(--ai-transition-duration-fast, 160ms) var(--ai-transition-easing, ease)',
          }}
        >
          <BaseScrollArea.Thumb
            style={{
              flex: 1,
              background: 'var(--ai-border, #d1d5db)',
              borderRadius: 'var(--ai-radius-xl, 9999px)',
              position: 'relative',
            }}
          />
        </BaseScrollArea.Scrollbar>
      )}
      {showHorizontal && (
        <BaseScrollArea.Scrollbar
          orientation="horizontal"
          {...scrollbarProps}
          style={{
            display: 'flex',
            userSelect: 'none',
            touchAction: 'none',
            padding: '0.125rem',
            height: 'var(--ai-scrollarea-thumb-size, 0.5rem)',
            background: 'transparent',
            transition: 'background var(--ai-transition-duration-fast, 160ms) var(--ai-transition-easing, ease)',
          }}
        >
          <BaseScrollArea.Thumb
            style={{
              flex: 1,
              background: 'var(--ai-border, #d1d5db)',
              borderRadius: 'var(--ai-radius-xl, 9999px)',
              position: 'relative',
            }}
          />
        </BaseScrollArea.Scrollbar>
      )}
      {orientation === 'both' && (
        <BaseScrollArea.Corner style={{ background: 'var(--ai-bg-container, #f3f4f6)' }} />
      )}
    </BaseScrollArea.Root>
    </OverlayCSP>
  );
};
