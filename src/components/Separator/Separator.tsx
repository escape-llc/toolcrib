import React from 'react';
import { Separator as SeparatorPrimitive } from 'radix-ui';

/** Props for the `<Separator>` visual divider. */
export interface SeparatorProps {
  /**
   * Layout axis. `'horizontal'` divides stacked content; `'vertical'`
   * divides side-by-side content (needs a sizing/flex ancestor to be
   * visible, same as any 100%-height element).
   * @default 'horizontal'
   */
  orientation?: 'horizontal' | 'vertical';
  /**
   * Purely presentational (true) vs. a semantic content boundary announced
   * to assistive tech (false). @default true
   */
  decorative?: boolean;
}

/**
 * @manifest Themed visual divider between content sections
 * @manifestCategory Layout Primitives
 */
export const Separator: React.FC<SeparatorProps> = ({
  orientation = 'horizontal',
  decorative = true,
}) => (
  <SeparatorPrimitive.Root
    orientation={orientation}
    decorative={decorative}
    style={
      orientation === 'horizontal'
        ? { width: '100%', height: '0.0625rem', background: 'var(--ai-border, #e5e7eb)', border: 'none', flexShrink: 0 }
        : { width: '0.0625rem', height: '100%', background: 'var(--ai-border, #e5e7eb)', border: 'none', flexShrink: 0 }
    }
  />
);
