'use client';

// SPIKE (#670): OTPField rebuilt on Base UI's OTP field, same props and
// behavior contract as OTPField.tsx (Radix). Not exported from the barrel;
// exercised only by OTPField.baseui.test.tsx. Not for merge.
import React, { useContext, useEffect, useId, useState } from 'react';
import { OTPField as BaseOTP } from '@base-ui/react/otp-field';
import { useOptionalFormContext } from '../Form/FormContext';
import { FieldContext } from '../Form/FieldContext';
import { aiBus } from '../../eventBus/eventBus';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { CONTROL_FONT_SIZE_VAR, type ControlSize } from '../../theme/controlSize';
import { useLocaleStrings } from '../Locale/LocaleContext';
import type { OTPFieldProps } from './OTPField';
import { VisuallyHidden } from '../Layout/VisuallyHidden';

const CELL_SIZE: Record<ControlSize, string> = { sm: '2rem', md: '2.5rem', lg: '3rem' };

export const OTPFieldBaseUI: React.FC<OTPFieldProps> = ({
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
  // Base UI labels the first input only via a real <label for> (it ignores
  // aria-label there), so the first input needs a stable id a label can
  // target: the field name inside a FormField (whose <label> is htmlFor=name),
  // else a generated one.
  const generatedId = useId();
  useInjectInteractionStyles();

  useEffect(() => {
    if (fieldName && registerField) registerField(fieldName, defaultValue ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a seed is read once, like any default
  }, [fieldName, registerField]);

  const isFormBound = !!(fieldName && formContext);
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
    aiBus.emit('otpfield:changed', { name: fieldName || undefined, value: next, complete: next.length === length });
  };

  const labelledBy = label ? ownLabelId : !ariaLabel ? fieldCtx.labelId : undefined;
  const firstInputId = fieldName || generatedId;
  const cellName = mode === 'numeric' ? strings.digit : strings.character;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      {label && (
        <label htmlFor={firstInputId} id={ownLabelId} style={{ fontSize: CONTROL_FONT_SIZE_VAR[size], fontWeight: 'var(--ai-font-weight-semibold, 600)', color: 'var(--ai-text-primary, #111827)' }}>
          {label}
        </label>
      )}
      {!label && ariaLabel && (
        <VisuallyHidden>
          <label htmlFor={firstInputId}>{ariaLabel}</label>
        </VisuallyHidden>
      )}
      <BaseOTP.Root
        id={firstInputId}
        length={length}
        value={code}
        onValueChange={handleChange}
        onValueComplete={v => onComplete?.(v)}
        validationType={mode}
        mask={mask}
        disabled={disabled}
        name={fieldName || undefined}
        aria-labelledby={labelledBy}
        aria-label={!label ? ariaLabel : undefined}
        aria-describedby={isError ? `${fieldName}-error` : undefined}
        style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}
      >
        {Array.from({ length }, (_, i) => (
          <BaseOTP.Input
            key={i}
            // Base UI names the first input from the field label and ignores
            // (and warns about) aria-label there; only cells 2..n take one.
            aria-label={i === 0 ? undefined : cellName(i + 1, length)}
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
      </BaseOTP.Root>
    </div>
  );
};
