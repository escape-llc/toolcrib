import React, { type ReactNode, createContext, useContext } from 'react';
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import { useOptionalFormContext } from './FormContext';
import { FieldContext } from './FieldContext';
import { getSparseVariables } from '../../theme/slice';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { RadioGroupThemeSlice, type RadioGroupSliceState } from './RadioGroupSlice';

/** Data shape for each option in a `<RadioGroup>`. */
export interface RadioOption {
  /** Display label for this radio option. */
  label: ReactNode;
  /** Value submitted when this option is selected. */
  value: string;
  /** If true, this option is not selectable. */
  disabled?: boolean;
  /** Additional help text below the option label. */
  helperText?: ReactNode;
}

/**
 * Props for the `<RadioGroup>` single-select control.
 *
 * Supports both data-driven (`options` array) and composition (`children`) patterns.
 * Binds to Form context via `name`.
 */
export interface RadioGroupProps {
  /** Field name. Auto-inherited from parent `<FormField>` if omitted. */
  name?: string;
  /** Controlled selected value. */
  value?: string;
  /** Initial selected value (uncontrolled). */
  defaultValue?: string;
  /** Change handler. Receives the selected value string. */
  onChange?: (value: string) => void;
  /** Data-driven options. Alternatively, use `children` with `<RadioGroup.Item>`. */
  options?: RadioOption[];
  /** Layout direction. @default 'vertical' */
  direction?: 'horizontal' | 'vertical';
  /** Compositional radio items (alternative to `options` prop). */
  children?: ReactNode;
  /** If true, all options are disabled. */
  disabled?: boolean;
  /** Per-instance overrides for option spacing and radio dot size. */
  overrides?: Partial<RadioGroupSliceState>;
}

interface RadioGroupContextValue {
  name?: string;
  selectedValue?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

/**
 * @manifest Single-select radio control bound to Form context, data-driven or compositional
 * @manifestCategory Form Controls
 */
export const RadioGroup: React.FC<RadioGroupProps> & {
  Option: React.FC<{ value: string; label: ReactNode; disabled?: boolean; helperText?: ReactNode }>;
} = ({
  name: propName,
  value: externalValue,
  defaultValue,
  onChange: externalOnChange,
  options,
  direction = 'vertical',
  children,
  disabled = false,
  overrides,
}) => {
  const fieldCtx = useContext(FieldContext);
  const fieldName = propName || fieldCtx.name || '';
  const formContext = useOptionalFormContext();
  const registerField = formContext?.registerField;
  const radioGroupVars = getSparseVariables(RadioGroupThemeSlice, overrides ?? {});
  useInjectInteractionStyles();

  // See Select.tsx for why this matters: without it, a RadioGroup left at
  // its default (nothing selected) on first submit never gets marked
  // touched, so a required-field validation error for it would compute
  // correctly but never actually display.
  //
  // Depends on registerField itself, not the whole formContext object —
  // Form recreates that object on every render (any field changing), and
  // registerField is idempotent but re-running it on every keystroke
  // anywhere in the form was still wasted effect churn. registerField is
  // stable for the form's lifetime (see FormContext.tsx), so this now only
  // fires when fieldName actually changes.
  React.useEffect(() => {
    if (fieldName && registerField) registerField(fieldName);
  }, [fieldName, registerField]);

  const formValue = fieldName && formContext ? formContext.values[fieldName] : undefined;
  const selectedValue = externalValue !== undefined ? externalValue : formValue !== undefined ? formValue : defaultValue;

  const handleChange = (val: string) => {
    if (externalOnChange) {
      externalOnChange(val);
    }
    if (fieldName && formContext) {
      formContext.setFieldValue(fieldName, val);
    }
  };

  const stringVal = selectedValue !== undefined ? String(selectedValue) : undefined;

  return (
    <RadioGroupContext.Provider
      value={{
        name: fieldName,
        selectedValue: stringVal,
        onChange: handleChange,
        disabled,
      }}
    >
      <RadioGroupPrimitive.Root
        value={stringVal}
        onValueChange={handleChange}
        disabled={disabled}
        className="ai-focus-ring"
        style={{
          display: 'flex',
          flexDirection: direction === 'horizontal' ? 'row' : 'column',
          gap: direction === 'horizontal'
            ? 'var(--ai-radiogroup-gap-horizontal, 1.25rem)'
            : 'var(--ai-radiogroup-gap-vertical, 0.625rem)',
          outline: 'none',
          ...radioGroupVars,
        }}
      >
        {options
          ? options.map(opt => (
              <RadioGroup.Option
                key={opt.value}
                value={opt.value}
                label={opt.label}
                disabled={opt.disabled || disabled}
                helperText={opt.helperText}
              />
            ))
          : children}
      </RadioGroupPrimitive.Root>
    </RadioGroupContext.Provider>
  );
};

RadioGroup.Option = ({ value, label, disabled: optionDisabled, helperText }) => {
  const ctx = useContext(RadioGroupContext);
  if (!ctx) {
    throw new Error('RadioGroup.Option must be used within a RadioGroup component');
  }

  const isChecked = ctx.selectedValue === String(value);
  const isDisabled = optionDisabled || ctx.disabled;

  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'flex-start',
        gap: '0.625rem',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.6 : 1,
        userSelect: 'none',
      }}
    >
      <RadioGroupPrimitive.Item
        value={value}
        disabled={isDisabled}
        className="ai-focus-ring"
        style={{
          all: 'unset',
          width: 'var(--ai-radiogroup-dot-size, 1.125rem)',
          height: 'var(--ai-radiogroup-dot-size, 1.125rem)',
          borderRadius: '50%',
          border: `0.125rem solid ${isChecked ? 'var(--ai-color-primary, #3b82f6)' : 'var(--ai-border, #d1d5db)'}`,
          background: 'var(--ai-bg-surface, #ffffff)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s ease',
          boxShadow: isChecked ? '0 0 0 0.125rem var(--ai-focus-ring, rgba(59, 130, 246, 0.2))' : 'none',
          marginTop: '0.125rem',
          flexShrink: 0,
          boxSizing: 'border-box',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
        }}
      >
        <RadioGroupPrimitive.Indicator
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
          }}
        >
          <div
            style={{
              width: 'var(--ai-radiogroup-dot-inner-size, 0.5rem)',
              height: 'var(--ai-radiogroup-dot-inner-size, 0.5rem)',
              borderRadius: '50%',
              background: 'var(--ai-color-primary, #3b82f6)',
            }}
          />
        </RadioGroupPrimitive.Indicator>
      </RadioGroupPrimitive.Item>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span
          style={{
            fontSize: '0.875rem',
            fontWeight: isChecked ? 'var(--ai-font-weight-semibold, 600)' : 'var(--ai-font-weight-normal, 400)',
            color: 'var(--ai-text-primary, #111827)',
          }}
        >
          {label}
        </span>
        {helperText && (
          <span
            style={{
              fontSize: '0.75rem',
              color: 'var(--ai-text-secondary, #6b7280)',
              marginTop: '0.125rem',
            }}
          >
            {helperText}
          </span>
        )}
      </div>
    </label>
  );
};
