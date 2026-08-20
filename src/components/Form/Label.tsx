import React, { type LabelHTMLAttributes } from 'react';
import { Label as LabelPrimitive } from 'radix-ui';
import { type StyleFree, warnIfLegacyStyleProps } from '../../theme/safeProps';
import { getSparseVariables } from '../../theme/slice';
import { LabelThemeSlice, type LabelSliceState } from './LabelSlice';

/** Props for the `<Label>` form control label. */
export interface LabelProps extends StyleFree<LabelHTMLAttributes<HTMLLabelElement>> {
  /** Per-instance override for the label's font weight and gap (when wrapping a control plus its own text). */
  overrides?: Partial<LabelSliceState>;
}

/**
 * Accessible label for a form control — associates via `htmlFor` (a plain
 * string id, same as native `<label>`) or by wrapping the control directly
 * (`Checkbox`/`Switch`'s usage below), and suppresses the double-click
 * text-selection a native `<label>` otherwise triggers. `display:
 * inline-flex` is unconditional: harmless for a text-only label
 * (`FormField`'s usage) and exactly what a label wrapping a control plus
 * its own text needs (`Checkbox`/`Switch`'s usage), so one style serves
 * both without a `style` escape hatch.
 * @manifest Accessible label for a form control, associated via htmlFor or by wrapping it
 * @manifestCategory Form Controls
 */
export const Label: React.FC<LabelProps> = ({ children, overrides, ...props }) => {
  warnIfLegacyStyleProps(props, 'Label');
  const labelVars = getSparseVariables(LabelThemeSlice, overrides ?? {});

  return (
    <LabelPrimitive.Root
      {...props}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--ai-label-gap, 0.5rem)',
        cursor: 'pointer',
        fontSize: '0.875rem',
        color: 'var(--ai-text-primary, #111827)',
        fontWeight: 'var(--ai-label-weight, 400)',
        ...labelVars,
      }}
    >
      {children}
    </LabelPrimitive.Root>
  );
};
