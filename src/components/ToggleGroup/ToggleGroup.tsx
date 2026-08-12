import React, { ReactNode, useState } from 'react';
import { Toggle as TogglePrimitive, ToggleGroup as ToggleGroupPrimitive } from 'radix-ui';
import { aiBus } from '../../eventBus/eventBus';

/** Props for the standalone `<Toggle>` pressed/unpressed button. */
export interface ToggleProps {
  /** Included in the emitted `toggle:changed` event payload. */
  name?: string;
  /** Controlled pressed state. */
  pressed?: boolean;
  /** Initial pressed state (uncontrolled). @default false */
  defaultPressed?: boolean;
  /** Change handler. Receives the new pressed state. */
  onPressedChange?: (pressed: boolean) => void;
  /** If true, the toggle is non-interactive. */
  disabled?: boolean;
  children: ReactNode;
}

/**
 * @manifest Two-state pressed/unpressed button, standalone (see ToggleGroup for a connected set)
 * @manifestCategory Form Controls
 */
export const Toggle: React.FC<ToggleProps> = ({
  name,
  pressed: externalPressed,
  defaultPressed = false,
  onPressedChange,
  disabled = false,
  children,
}) => {
  const [internalPressed, setInternalPressed] = useState(defaultPressed);
  const isPressed = externalPressed !== undefined ? externalPressed : internalPressed;

  const handlePressedChange = (next: boolean) => {
    if (externalPressed === undefined) setInternalPressed(next);
    if (onPressedChange) onPressedChange(next);
    aiBus.emit('toggle:changed', { name, pressed: next });
  };

  return (
    <TogglePrimitive.Root
      pressed={isPressed}
      onPressedChange={handlePressedChange}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.375rem',
        padding: '0.4375rem 0.75rem',
        borderRadius: 'var(--ai-radius-md, 0.375rem)',
        border: `0.0625rem solid ${isPressed ? 'var(--ai-color-primary, #3b82f6)' : 'var(--ai-border, #d1d5db)'}`,
        background: isPressed ? 'var(--ai-color-primary, #3b82f6)' : 'transparent',
        color: isPressed ? '#ffffff' : 'var(--ai-text-primary, #111827)',
        fontSize: '0.875rem',
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s ease',
        outline: 'none',
      }}
    >
      {children}
    </TogglePrimitive.Root>
  );
};

/** Data shape for each option in a `<ToggleGroup>`. */
export interface ToggleGroupOption {
  /** Unique value for this option — appears in `value`/`togglegroup:changed`. */
  value: string;
  /** Display label. */
  label?: ReactNode;
  /** Optional icon rendered before the label. */
  icon?: ReactNode;
  /** If true, this option is not selectable. */
  disabled?: boolean;
}

/**
 * Props for the `<ToggleGroup>` connected button set.
 *
 * Data-driven: pass an `options` array. `type="single"` behaves like a
 * segmented control (one selection, re-clicking the active option
 * deselects it — Radix's own behavior); `type="multiple"` allows any
 * combination, like a set of independent toggles that happen to share a
 * connected visual border.
 */
export interface ToggleGroupProps {
  /** Included in the emitted `togglegroup:changed` event payload. */
  name?: string;
  /**
   * `'single'` allows zero or one selected option. `'multiple'` allows any combination.
   * @default 'single'
   */
  type?: 'single' | 'multiple';
  /** Controlled selected value(s) — a string for `type="single"`, a string array for `type="multiple"`. */
  value?: string | string[];
  /** Initial selected value(s) (uncontrolled). */
  defaultValue?: string | string[];
  /** Change handler. Receives the new value in the same shape as `value`. */
  onChange?: (value: string | string[]) => void;
  /** Data-driven options rendered as connected buttons. */
  options: ToggleGroupOption[];
  /** If true, every option is disabled. */
  disabled?: boolean;
}

/**
 * @manifest Connected button set for single or multiple selection, data-driven
 * @manifestCategory Form Controls
 */
export const ToggleGroup: React.FC<ToggleGroupProps> = ({
  name,
  type = 'single',
  value: externalValue,
  defaultValue,
  onChange,
  options,
  disabled = false,
}) => {
  const [internalValue, setInternalValue] = useState<string | string[]>(
    defaultValue !== undefined ? defaultValue : type === 'multiple' ? [] : ''
  );
  const currentValue = externalValue !== undefined ? externalValue : internalValue;

  const handleValueChange = (next: string | string[]) => {
    if (externalValue === undefined) setInternalValue(next);
    if (onChange) onChange(next);
    aiBus.emit('togglegroup:changed', { name, value: next });
  };

  const isSelected = (optValue: string): boolean =>
    type === 'multiple' ? (currentValue as string[]).includes(optValue) : currentValue === optValue;

  return (
    <ToggleGroupPrimitive.Root
      type={type as any}
      value={currentValue as any}
      onValueChange={handleValueChange as any}
      disabled={disabled}
      style={{ display: 'inline-flex', alignItems: 'stretch' }}
    >
      {options.map((opt, index) => {
        const selected = isSelected(opt.value);
        const isFirst = index === 0;
        const isLast = index === options.length - 1;
        const itemDisabled = disabled || opt.disabled;

        return (
          <ToggleGroupPrimitive.Item
            key={opt.value}
            value={opt.value}
            disabled={itemDisabled}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.375rem',
              padding: '0.4375rem 0.75rem',
              border: `0.0625rem solid ${selected ? 'var(--ai-color-primary, #3b82f6)' : 'var(--ai-border, #d1d5db)'}`,
              borderTopLeftRadius: isFirst ? 'var(--ai-radius-md, 0.375rem)' : 0,
              borderBottomLeftRadius: isFirst ? 'var(--ai-radius-md, 0.375rem)' : 0,
              borderTopRightRadius: isLast ? 'var(--ai-radius-md, 0.375rem)' : 0,
              borderBottomRightRadius: isLast ? 'var(--ai-radius-md, 0.375rem)' : 0,
              marginLeft: isFirst ? 0 : '-0.0625rem',
              background: selected ? 'var(--ai-color-primary, #3b82f6)' : 'var(--ai-bg-surface, #ffffff)',
              color: selected ? '#ffffff' : 'var(--ai-text-primary, #111827)',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: itemDisabled ? 'not-allowed' : 'pointer',
              opacity: itemDisabled ? 0.5 : 1,
              position: 'relative',
              zIndex: selected ? 1 : 0,
              transition: 'all 0.15s ease',
              outline: 'none',
            }}
          >
            {opt.icon}
            {opt.label}
          </ToggleGroupPrimitive.Item>
        );
      })}
    </ToggleGroupPrimitive.Root>
  );
};
