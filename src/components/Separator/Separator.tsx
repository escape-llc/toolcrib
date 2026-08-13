import React from 'react';
import { Separator as SeparatorPrimitive } from 'radix-ui';
import { getSparseVariables } from '../../theme/slice';
import { SeparatorThemeSlice, SeparatorSliceState } from './SeparatorSlice';

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
  /** Per-instance override for line thickness. */
  overrides?: Partial<SeparatorSliceState>;
}

/**
 * @manifest Themed visual divider between content sections
 * @manifestCategory Layout Primitives
 */
export const Separator: React.FC<SeparatorProps> = ({
  orientation = 'horizontal',
  decorative = true,
  overrides,
}) => {
  const separatorVars = getSparseVariables(SeparatorThemeSlice, overrides ?? {});
  const thickness = 'var(--ai-separator-thickness, 0.0625rem)';

  return (
    <SeparatorPrimitive.Root
      orientation={orientation}
      decorative={decorative}
      style={
        orientation === 'horizontal'
          ? { width: '100%', height: thickness, background: 'var(--ai-border, #e5e7eb)', border: 'none', flexShrink: 0, ...separatorVars }
          : { width: thickness, height: '100%', background: 'var(--ai-border, #e5e7eb)', border: 'none', flexShrink: 0, ...separatorVars }
      }
    />
  );
};
