'use client';

import React, { type ReactNode } from 'react';
import { Fieldset as BaseFieldset } from '@base-ui/react/fieldset';
import { resolveMargin, type MarginMode } from '../../theme/margin';
import { FieldsetContext, useFieldsetDisabled } from './FieldsetContext';

/** Props for the `<Fieldset>` labelled group of form fields. */
export interface FieldsetProps {
  /**
   * The group's visible label, e.g. "Shipping address". Required, not
   * optional: a fieldset without a legend is a group nothing announces, which
   * is the problem this component exists to fix.
   */
  legend: ReactNode;
  /** The group's fields, usually `<FormField>`s. */
  children: ReactNode;
  /**
   * Disable every field inside. Native inputs and buttons are disabled by the
   * underlying `<fieldset>`; every other toolcrib control reads it too.
   * Nested fieldsets inherit it.
   * @default false
   */
  disabled?: boolean;
  /** Gap between the fields. @default 'md' */
  gap?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'gap';
  /** Override the gap using the theme margin token scale. */
  marginMode?: MarginMode;
}

/**
 * A labelled group of form fields on a real `<fieldset>`/legend, so a section
 * like "Shipping address" is announced as a group instead of being a `<div>`
 * with a heading. It adds no field binding of its own: `<FormField name>` and
 * `<Form>` work inside it unchanged.
 * @manifest Labelled group of form fields (a real fieldset and legend); a disabled Fieldset disables every field inside it
 * @manifestCategory Form Controls
 * @manifestChildren FormField, Input, Select, Checkbox, RadioGroup
 */
export const Fieldset: React.FC<FieldsetProps> = ({ legend, children, disabled, gap = 'md', marginMode }) => {
  // Nested fieldsets inherit: a disabled outer group can't be re-enabled by an
  // inner one, the same as native fieldsets.
  const isDisabled = useFieldsetDisabled(disabled);

  return (
    <FieldsetContext.Provider value={{ disabled: isDisabled }}>
      <BaseFieldset.Root
        disabled={isDisabled}
        // The native fieldset's own border, padding and min-width:min-content
        // are all things this group doesn't want.
        style={{ border: 'none', margin: 0, padding: 0, minWidth: 0 }}
      >
        <BaseFieldset.Legend
          style={{
            padding: 0,
            marginBottom: '0.5rem',
            fontSize: '0.9375rem',
            fontWeight: 600,
            color: isDisabled ? 'var(--ai-text-secondary, #4b5563)' : 'var(--ai-text-primary, #111827)',
          }}
        >
          {legend}
        </BaseFieldset.Legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: resolveMargin(marginMode, gap) }}>{children}</div>
      </BaseFieldset.Root>
    </FieldsetContext.Provider>
  );
};
