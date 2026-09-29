'use client';

import React, { type LabelHTMLAttributes } from 'react';
import { type StyleFree } from '../../theme/safeProps';
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
export const Label: React.FC<LabelProps> = ({ children, overrides, onMouseDown, ...props }) => {
  const labelVars = getSparseVariables(LabelThemeSlice, overrides ?? {});

  return (
    <label
      {...props}
      // A native <label>, not a library primitive (#670, #701: Base UI has no
      // standalone label). This is the one behavior Radix's Label added: a
      // double-click on the label text doesn't select it. A press on a
      // control nested inside the label is left alone.
      onMouseDown={e => {
        if ((e.target as Element).closest('button, input, select, textarea')) return;
        onMouseDown?.(e);
        if (!e.defaultPrevented && e.detail > 1) e.preventDefault();
      }}
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
    </label>
  );
};
