import React from 'react';
import { getSparseVariables } from '../../theme/slice';
import { SeparatorThemeSlice, type SeparatorSliceState } from './SeparatorSlice';

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

  // A plain element, not a library primitive (#702): Base UI's Separator is
  // always role="separator" with no decorative mode, and there's nothing
  // else to it. Decorative is role="none"; a semantic one is
  // role="separator", with aria-orientation only where it differs from the
  // role's implicit horizontal.
  return (
    <div
      role={decorative ? 'none' : 'separator'}
      aria-orientation={!decorative && orientation === 'vertical' ? 'vertical' : undefined}
      style={
        orientation === 'horizontal'
          ? { width: '100%', height: thickness, background: 'var(--ai-border, #e5e7eb)', border: 'none', flexShrink: 0, ...separatorVars }
          : { width: thickness, height: '100%', background: 'var(--ai-border, #e5e7eb)', border: 'none', flexShrink: 0, ...separatorVars }
      }
    />
  );
};
