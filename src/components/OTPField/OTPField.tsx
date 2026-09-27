'use client';

import React, { type ReactNode, useContext, useEffect, useId, useState } from 'react';
// Radix ships this primitive under an `unstable_` name (v0.1.x): its API may
// change in a minor radix-ui release. It's used anyway because paste
// distribution, auto-advance, backspace, SMS autofill (one real input with
// autocomplete="one-time-code") and password-manager opt-outs are exactly
// the edge cases a hand-rolled version gets wrong. If a radix-ui upgrade
// breaks this file, OTPField.test.tsx is what will say so.
import { unstable_OneTimePasswordField as OneTimePasswordField } from 'radix-ui';
import { useOptionalFormContext } from '../Form/FormContext';
import { FieldContext } from '../Form/FieldContext';
import { aiBus } from '../../eventBus/eventBus';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { CONTROL_FONT_SIZE_VAR, type ControlSize } from '../../theme/controlSize';
import { useLocaleStrings } from '../Locale/LocaleContext';

/** Props for `<OTPField>`. */
export interface OTPFieldProps {
  /** Field name. Auto-inherited from parent `<FormField>` if omitted. Inside a `<Form>`, the stored value is one string. */
  name?: string;
  /** Number of cells. @default 6 */
  length?: number;
  /** Controlled value (the whole code as one string). */
  value?: string;
  /** Initial value (uncontrolled). */
  defaultValue?: string;
  /** Called on every change with the whole code so far. */
  onChange?: (value: string) => void;
  /** Called once every cell is filled, with the full code. */
  onComplete?: (value: string) => void;
  /** Which characters a cell accepts; others are dropped, including from a paste. @default 'numeric' */
  mode?: 'numeric' | 'alphanumeric';
  /** Hide the characters, for a PIN. */
  mask?: boolean;
  /** Visible group label. Inside a `<FormField label>` leave it off: the field's label names the group. */
  label?: ReactNode;
  /** Accessible name for the group when there is no visible label. */
  'aria-label'?: string;
  /** If true, the field is non-interactive. */
  disabled?: boolean;
  /** Control size, standardized with `<Input>` and every other sized control. @default 'md' */
  size?: ControlSize;
}

const CELL_SIZE: Record<ControlSize, string> = { sm: '2rem', md: '2.5rem', lg: '3rem' };

/**
 * @manifest One-time code / PIN input: one cell per character with auto-advance, backspace-to-previous, paste distribution and SMS autofill (`autocomplete="one-time-code"`), bound to a Form as one string
 * @manifestCategory Form Controls
 * @manifestAntiPatternAvoid A row of hand-rolled single-character `<input>`s with manual focus moving, paste splitting and keyboard handling
 * @manifestAntiPatternInstead `<OTPField length={6} onComplete={verify} />` inside a `<FormField>`; the Form value is the code as one string
 */
export const OTPField: React.FC<OTPFieldProps> = ({
  name: propName,
  length = 6,
  value: externalValue,
  defaultValue,
  onChange,
  onComplete,
  mode = 'numeric',
  mask = false,
  label,
  'aria-label': ariaLabel,
  disabled = false,
  size = 'md',
}) => {
  const fieldCtx = useContext(FieldContext);
  const fieldName = propName || fieldCtx.name || '';
  const formContext = useOptionalFormContext();
  const registerField = formContext?.registerField;
  const strings = useLocaleStrings().otpField;
  const ownLabelId = useId();
  useInjectInteractionStyles();

  useEffect(() => {
    // Seeded with defaultValue when the Form has no value for the field yet.
    if (fieldName && registerField) registerField(fieldName, defaultValue ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a seed is read once, like any default
  }, [fieldName, registerField]);

  const isFormBound = !!(fieldName && formContext);
  // Local state keeps a standalone field editable (see Input's issue #614).
  const [localValue, setLocalValue] = useState(defaultValue ?? '');
  const formValue = isFormBound ? formContext!.values[fieldName] : undefined;
  const code = externalValue !== undefined ? externalValue : isFormBound ? (typeof formValue === 'string' ? formValue : '') : localValue;
  const isError = isFormBound ? !!(formContext!.touched[fieldName] && formContext!.errors[fieldName]) : false;

  const handleChange = (next: string) => {
    if (isFormBound) {
      formContext!.setFieldValue(fieldName, next);
      formContext!.setFieldTouched(fieldName, true);
    } else if (externalValue === undefined) {
      setLocalValue(next);
    }
    onChange?.(next);
    const complete = next.length === length;
    aiBus.emit('otpfield:changed', { name: fieldName || undefined, value: next, complete });
    if (complete) onComplete?.(next);
  };

  const labelledBy = label ? ownLabelId : !ariaLabel ? fieldCtx.labelId : undefined;
  const cellName = mode === 'numeric' ? strings.digit : strings.character;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      {label && (
        <span id={ownLabelId} style={{ fontSize: CONTROL_FONT_SIZE_VAR[size], fontWeight: 'var(--ai-font-weight-semibold, 600)', color: 'var(--ai-text-primary, #111827)' }}>
          {label}
        </span>
      )}
      <OneTimePasswordField.Root
        value={code}
        onValueChange={handleChange}
        validationType={mode}
        type={mask ? 'password' : 'text'}
        disabled={disabled}
        name={fieldName || undefined}
        aria-labelledby={labelledBy}
        aria-label={!label ? ariaLabel : undefined}
        aria-describedby={isError ? `${fieldName}-error` : undefined}
        style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}
      >
        {Array.from({ length }, (_, i) => (
          <OneTimePasswordField.Input
            key={i}
            aria-label={cellName(i + 1, length)}
            aria-invalid={isError || undefined}
            className="ai-focus-ring"
            style={{
              boxSizing: 'border-box',
              width: CELL_SIZE[size],
              height: `calc(${CELL_SIZE[size]} * 1.2)`,
              padding: 0,
              textAlign: 'center',
              fontSize: CONTROL_FONT_SIZE_VAR[size],
              fontFamily: 'inherit',
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--ai-text-primary, #111827)',
              background: disabled ? 'var(--ai-bg-container, #f3f4f6)' : 'var(--ai-bg-surface, #ffffff)',
              border: `var(--ai-input-border-width, 0.0625rem) solid ${isError ? 'var(--ai-subtheme-error, #ef4444)' : 'var(--ai-border, #d1d5db)'}`,
              borderRadius: 'var(--ai-radius-md, 0.375rem)',
            }}
          />
        ))}
        <OneTimePasswordField.HiddenInput />
      </OneTimePasswordField.Root>
    </div>
  );
};
