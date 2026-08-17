import React, { ReactNode } from 'react';
import { ScrollArea as ScrollAreaPrimitive } from 'radix-ui';
import { getSparseVariables } from '../../theme/slice';
import { ScrollAreaThemeSlice, ScrollAreaSliceState } from './ScrollAreaSlice';

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
  const showVertical = orientation === 'vertical' || orientation === 'both';
  const showHorizontal = orientation === 'horizontal' || orientation === 'both';

  return (
    <ScrollAreaPrimitive.Root
      type={type}
      style={{
        width: '100%',
        height: maxHeight ?? '100%',
        minHeight: 0,
        overflow: 'hidden',
        ...scrollAreaVars,
      }}
    >
      <ScrollAreaPrimitive.Viewport style={{ width: '100%', height: '100%' }}>
        {children}
      </ScrollAreaPrimitive.Viewport>
      {showVertical && (
        <ScrollAreaPrimitive.Scrollbar
          orientation="vertical"
          style={{
            display: 'flex',
            userSelect: 'none',
            touchAction: 'none',
            padding: '0.125rem',
            width: 'var(--ai-scrollarea-thumb-size, 0.5rem)',
            background: 'transparent',
            transition: 'background 160ms ease',
          }}
        >
          <ScrollAreaPrimitive.Thumb
            style={{
              flex: 1,
              background: 'var(--ai-border, #d1d5db)',
              borderRadius: '9999px',
              position: 'relative',
            }}
          />
        </ScrollAreaPrimitive.Scrollbar>
      )}
      {showHorizontal && (
        <ScrollAreaPrimitive.Scrollbar
          orientation="horizontal"
          style={{
            display: 'flex',
            userSelect: 'none',
            touchAction: 'none',
            padding: '0.125rem',
            height: 'var(--ai-scrollarea-thumb-size, 0.5rem)',
            background: 'transparent',
            transition: 'background 160ms ease',
          }}
        >
          <ScrollAreaPrimitive.Thumb
            style={{
              flex: 1,
              background: 'var(--ai-border, #d1d5db)',
              borderRadius: '9999px',
              position: 'relative',
            }}
          />
        </ScrollAreaPrimitive.Scrollbar>
      )}
      {orientation === 'both' && (
        <ScrollAreaPrimitive.Corner style={{ background: 'var(--ai-bg-container, #f3f4f6)' }} />
      )}
    </ScrollAreaPrimitive.Root>
  );
};
