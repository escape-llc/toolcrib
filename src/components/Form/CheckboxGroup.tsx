'use client';

import React, { type ReactNode, useContext, useEffect, useId, useState } from 'react';
import { useFieldsetDisabled } from '../Fieldset/FieldsetContext';
import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox';
import { useOptionalFormContext } from './FormContext';
import { FieldContext } from './FieldContext';
import { getSparseVariables } from '../../theme/slice';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { CONTROL_FONT_SIZE_VAR, type ControlSize } from '../../theme/controlSize';
import { aiBus } from '../../eventBus/eventBus';
import { ToggleControlThemeSlice, type ToggleControlSliceState } from './ToggleControlSlice';

/** Data shape for each option in a `<CheckboxGroup>`. */
export interface CheckboxOption {
  /** Display label for this checkbox. */
  label: ReactNode;
  /** Value added to the group's array when this box is checked. */
  value: string;
  /** If true, this option can't be toggled. */
  disabled?: boolean;
  /** Additional help text below the option label. */
  helperText?: ReactNode;
}

/**
 * Props for `<CheckboxGroup>`: a labelled group of checkboxes bound to one
 * array-valued field. Binds to Form context via `name`.
 */
export interface CheckboxGroupProps {
  /** Field name. Auto-inherited from parent `<FormField>` if omitted. Inside a `<Form>`, the stored value is a `string[]`. */
  name?: string;
  /** The checkboxes, in display order. */
  options: CheckboxOption[];
  /** Controlled checked values. */
  value?: string[];
  /** Initial checked values (uncontrolled). */
  defaultValue?: string[];
  /** Change handler. Receives the checked values, in `options` order. */
  onChange?: (value: string[]) => void;
  /** Most boxes that can be checked at once. When reached, the unchecked boxes disable until one is unchecked. */
  maxSelected?: number;
  /** Visible group label. Inside a `<FormField label>` leave it off: the field's label names the group. */
  label?: ReactNode;
  /** Accessible name when there is no visible label. */
  'aria-label'?: string;
  /** Layout direction. @default 'vertical' */
  direction?: 'horizontal' | 'vertical';
  /** If true, every option is disabled. */
  disabled?: boolean;
  /** Control size, standardized with `<Button>` and every other sized control: the option label's font size. @default 'md' */
  size?: ControlSize;
  /** Per-instance checkbox size override. Shared with `<Checkbox>`/`<Switch>`. */
  overrides?: Partial<ToggleControlSliceState>;
}

/**
 * @manifest Group of checkboxes bound to one array-valued field (`string[]`), data-driven, with optional `maxSelected`
 * @manifestCategory Form Controls
 * @manifestAntiPatternAvoid N separate `<Checkbox>`es plus hand-written code to fold them into one array field
 * @manifestAntiPatternInstead `<CheckboxGroup options={[...]} maxSelected={3} />` inside a `<FormField>`; the Form value is the array of checked values
 */
export const CheckboxGroup: React.FC<CheckboxGroupProps> = ({
  name: propName,
  options,
  value: externalValue,
  defaultValue,
  onChange,
  maxSelected,
  label,
  'aria-label': ariaLabel,
  direction = 'vertical',
  disabled: disabledProp = false,
  size = 'md',
  overrides,
}) => {
  const disabled = useFieldsetDisabled(disabledProp);
  const fieldCtx = useContext(FieldContext);
  const fieldName = propName || fieldCtx.name || '';
  const formContext = useOptionalFormContext();
  const registerField = formContext?.registerField;
  const toggleVars = getSparseVariables(ToggleControlThemeSlice, overrides ?? {});
  const ownLabelId = useId();
  useInjectInteractionStyles();

  useEffect(() => {
    // Seeded with defaultValue, else [] (not the default ''), so an untouched
    // group submits and validates as an array. Only applies when the Form has
    // no value for this field yet (its initialValues win).
    if (fieldName && registerField) registerField(fieldName, defaultValue ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a seed is read once, like any default
  }, [fieldName, registerField]);

  const isFormBound = !!(fieldName && formContext);
  // Local state is the third value source for a standalone group (no
  // `value`, no Form), so it stays editable -- see Input's issue #614.
  const [localValue, setLocalValue] = useState<string[]>(defaultValue ?? []);
  const formValue = isFormBound ? formContext!.values[fieldName] : undefined;
  const selected: string[] =
    externalValue !== undefined ? externalValue : isFormBound ? (Array.isArray(formValue) ? (formValue as string[]) : []) : localValue;
  const atLimit = maxSelected !== undefined && selected.length >= maxSelected;

  const toggle = (optionValue: string, checked: boolean) => {
    const set = new Set(selected);
    if (checked) set.add(optionValue);
    else set.delete(optionValue);
    // Options order, not click order, so the value is stable and predictable.
    const next = options.map(o => o.value).filter(v => set.has(v));
    if (isFormBound) {
      formContext!.setFieldValue(fieldName, next);
      formContext!.setFieldTouched(fieldName, true);
    } else if (externalValue === undefined) {
      setLocalValue(next);
    }
    onChange?.(next);
    aiBus.emit('checkboxgroup:changed', { name: fieldName || undefined, value: next });
  };

  // Group name: own visible label, else the enclosing FormField's label, else aria-label.
  const labelledBy = label ? ownLabelId : !ariaLabel ? fieldCtx.labelId : undefined;
  const isError = isFormBound ? !!(formContext!.touched[fieldName] && formContext!.errors[fieldName]) : false;

  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      aria-label={!label ? ariaLabel : undefined}
      aria-describedby={isError ? `${fieldName}-error` : undefined}
      style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', ...toggleVars }}
    >
      {label && (
        <span id={ownLabelId} style={{ fontSize: CONTROL_FONT_SIZE_VAR[size], fontWeight: 'var(--ai-font-weight-semibold, 600)', color: 'var(--ai-text-primary, #111827)' }}>
          {label}
        </span>
      )}
      <div
        style={{
          display: 'flex',
          flexDirection: direction === 'horizontal' ? 'row' : 'column',
          flexWrap: direction === 'horizontal' ? 'wrap' : undefined,
          gap: direction === 'horizontal' ? '1.25rem' : '0.625rem',
        }}
      >
        {options.map((opt, index) => {
          const isChecked = selected.includes(opt.value);
          // At the limit, only the unchecked boxes lock; a checked one can
          // always be unchecked to make room.
          const isDisabled = disabled || !!opt.disabled || (atLimit && !isChecked);
          // Helper text describes the box (aria-describedby); inside the
          // <label> it would become part of the box's name instead.
          const helperId = opt.helperText ? `${ownLabelId}-help-${index}` : undefined;
          return (
            <div key={opt.value} style={{ display: 'inline-flex', flexDirection: 'column', opacity: isDisabled ? 0.6 : 1 }}>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'flex-start',
                gap: '0.5rem',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                userSelect: 'none',
              }}
            >
              <BaseCheckbox.Root
                value={opt.value}
                checked={isChecked}
                disabled={isDisabled}
                aria-describedby={helperId}
                onCheckedChange={c => toggle(opt.value, c)}
                className="ai-focus-ring"
                style={{
                  all: 'unset',
                  width: 'var(--ai-togglecontrol-checkbox-size, 1.125rem)',
                  height: 'var(--ai-togglecontrol-checkbox-size, 1.125rem)',
                  borderRadius: 'var(--ai-radius-sm, 0.25rem)',
                  border: `0.0625rem solid ${isChecked ? 'var(--ai-color-primary, #3b82f6)' : 'var(--ai-border, #d1d5db)'}`,
                  background: isChecked ? 'var(--ai-color-primary, #3b82f6)' : 'var(--ai-bg-surface, #ffffff)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '0.125rem',
                  boxSizing: 'border-box',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                }}
              >
                {/* aria-hidden: Base UI names a checkbox inside a <label> by
                    aria-labelledby on that label, whose text would otherwise
                    include this glyph ("✓ Cheese"). Same in Checkbox. */}
                <BaseCheckbox.Indicator aria-hidden="true" style={{ color: 'var(--ai-color-primary-text, #ffffff)', fontSize: '0.75rem', fontWeight: 'var(--ai-font-weight-black, 900)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  ✓
                </BaseCheckbox.Indicator>
              </BaseCheckbox.Root>
              <span style={{ fontSize: CONTROL_FONT_SIZE_VAR[size], color: 'var(--ai-text-primary, #111827)' }}>{opt.label}</span>
            </label>
            {opt.helperText && (
              <span
                id={helperId}
                style={{
                  fontSize: 'var(--ai-text-size-xs, 0.75rem)',
                  color: 'var(--ai-text-secondary, #6b7280)',
                  marginTop: '0.125rem',
                  // Aligns under the label text: box width + the label's gap.
                  paddingLeft: 'calc(var(--ai-togglecontrol-checkbox-size, 1.125rem) + 0.5rem)',
                }}
              >
                {opt.helperText}
              </span>
            )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
