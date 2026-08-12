import React, { ReactNode, useContext } from 'react';
import { Select as SelectPrimitive } from 'radix-ui';
import { useOptionalFormContext } from './FormContext';
import { aiBus } from '../../eventBus/eventBus';
import { Z_INDEX } from '../../theme/zIndex';

/** Data shape for each option in a `<Select>` dropdown. */
export interface SelectOptionData {
  /** Display text for the option. */
  label: ReactNode;
  /** Value submitted/emitted when this option is selected. */
  value: string;
  /** If true, the option is visible but not selectable. */
  disabled?: boolean;
}

/**
 * Props for the `<Select>` dropdown control.
 *
 * Binds to Form context via `name`. Emits `select:changed` on the event bus.
 */
export interface SelectProps {
  /** Field name. Auto-inherited from parent `<FormField>` if omitted. */
  name?: string;
  /** Placeholder text when no value is selected. @default 'Select option...' */
  placeholder?: string;
  /** Array of selectable options. */
  options: SelectOptionData[];
  /** Controlled selected value. */
  value?: string;
  /** Initial selected value (uncontrolled). */
  defaultValue?: string;
  /** Change handler. Receives the selected value string. */
  onChange?: (value: string) => void;
  /** If true, the select is non-interactive. */
  disabled?: boolean;
}

/**
 * @manifest Dropdown select control bound to Form context, built on Radix Select
 * @manifestCategory Form Controls
 */
export const Select: React.FC<SelectProps> = ({
  name,
  placeholder = 'Select option...',
  options,
  value: externalValue,
  defaultValue,
  onChange: externalOnChange,
  disabled = false,
}) => {
  const formContext = useOptionalFormContext();
  const fieldName = name;

  const formValue = fieldName && formContext ? formContext.values[fieldName] : undefined;
  const selectedValue = externalValue !== undefined ? externalValue : formValue !== undefined ? String(formValue) : defaultValue;

  const handleChange = (val: string) => {
    aiBus.emit('select:changed', { name: fieldName, value: val });
    if (externalOnChange) externalOnChange(val);
    if (fieldName && formContext) {
      formContext.setFieldValue(fieldName, val);
      formContext.setFieldTouched(fieldName, true);
    }
  };

  return (
    <SelectPrimitive.Root
      value={selectedValue}
      onValueChange={handleChange}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '0.5rem 0.75rem',
          borderRadius: 'var(--ai-radius-md, 0.375rem)',
          border: '0.0625rem solid var(--ai-border, #d1d5db)',
          background: 'var(--ai-bg-surface, #ffffff)',
          color: 'var(--ai-text-primary, #111827)',
          fontSize: '0.875rem',
          outline: 'none',
          boxSizing: 'border-box',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon style={{ color: 'var(--ai-text-secondary, #6b7280)', fontSize: '0.75rem' }}>
          ▼
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          style={{
            zIndex: Z_INDEX.DROPDOWN,
            background: 'var(--ai-bg-surface, #ffffff)',
            borderRadius: 'var(--ai-radius-md, 0.375rem)',
            border: '0.0625rem solid var(--ai-border, #e5e7eb)',
            boxShadow: '0 0.625rem 1.5625rem -0.3125rem rgba(0,0,0,0.15)',
            overflow: 'hidden',
            minWidth: '11.25rem',
          }}
        >
          <SelectPrimitive.Viewport style={{ padding: '0.25rem' }}>
            {options.map((opt) => (
              <SelectPrimitive.Item
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.4375rem 0.75rem',
                  fontSize: '0.875rem',
                  borderRadius: 'var(--ai-radius-sm, 0.25rem)',
                  color: 'var(--ai-text-primary, #111827)',
                  cursor: opt.disabled ? 'not-allowed' : 'pointer',
                  outline: 'none',
                  userSelect: 'none',
                }}
              >
                <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator style={{ color: 'var(--ai-color-primary, #3b82f6)', fontWeight: 900 }}>
                  ✓
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
};
