'use client';

import React, { type ReactNode, useState } from 'react';
import { Toggle as TogglePrimitive, ToggleGroup as ToggleGroupPrimitive } from 'radix-ui';
import { aiBus } from '../../eventBus/eventBus';
import { getSparseVariables } from '../../theme/slice';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { ToggleThemeSlice, type ToggleSliceState } from './ToggleSlice';
import { CONTROL_FONT_SIZE_VAR, resolveControlPadding, type ControlSize } from '../../theme/controlSize';
import { type SquareCornerOption, resolveSquareCorners } from '../Card/Card';
import { useUIGroupSquareCorners } from '../UIGroup/UIGroupContext';
import { useInjectChoiceSeparatorStyles } from '../../theme/choiceSeparator';

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
  /** Per-instance override for padding density. Shared with `<ToggleGroup>`. Only applies at the default `size="md"` — see `<Input>`'s own `size` doc for why. */
  overrides?: Partial<ToggleSliceState>;
  /** Control size, standardized with `<Button>` and every other sized control so instances line up in a `<UIGroup>` row. @default 'md' */
  size?: ControlSize;
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
  overrides,
  size = 'md',
}) => {
  const [internalPressed, setInternalPressed] = useState(defaultPressed);
  const isPressed = externalPressed !== undefined ? externalPressed : internalPressed;
  const toggleVars = getSparseVariables(ToggleThemeSlice, overrides ?? {});
  useInjectInteractionStyles();

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
      className="ai-btn"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--ai-toggle-gap, 0.375rem)',
        padding: resolveControlPadding(size, 'var(--ai-toggle-padding, 0.4375rem 0.75rem)'),
        borderRadius: 'var(--ai-radius-md, 0.375rem)',
        border: `0.0625rem solid ${isPressed ? 'var(--ai-color-primary, #3b82f6)' : 'var(--ai-border, #d1d5db)'}`,
        background: isPressed ? 'var(--ai-color-primary, #3b82f6)' : 'transparent',
        color: isPressed ? 'var(--ai-color-primary-text, #ffffff)' : 'var(--ai-text-primary, #111827)',
        fontSize: CONTROL_FONT_SIZE_VAR[size],
        fontWeight: 'var(--ai-font-weight-semibold, 600)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        // No inline transition -- .ai-btn's own shared rule
        // (interactionStyles.ts) already covers background-color and
        // border-color and is !important, so this would be silently
        // discarded outright, not just redundant (issue #411 -- this
        // was the originally-reported component: a segmented control
        // whose hover/selection color changes snapped instantly).
        outline: 'none',
        ['--ai-btn-bg' as string]: isPressed ? 'var(--ai-color-primary, #3b82f6)' : 'transparent',
        ...toggleVars,
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
  /** Per-instance override for padding density. Shared with `<Toggle>`. Only applies at the default `size="md"` — see `<Input>`'s own `size` doc for why. */
  overrides?: Partial<ToggleSliceState>;
  /** Control size, standardized with `<Button>` and every other sized control so instances line up in a `<UIGroup>` row. @default 'md' */
  size?: ControlSize;
  /**
   * Explicit corner-squaring override, e.g. when this ToggleGroup is a
   * `<UIGroup>` member and an ambient value from context isn't correct
   * for some other reason. Takes precedence over the value `<UIGroup>`
   * itself supplies automatically — see `<Button>`'s own identical prop
   * for the general pattern.
   */
  squareCorners?: SquareCornerOption;
  /**
   * Accessible name for the whole group (Radix's own `role="group"` on
   * the root) — e.g. "Row density" for a set of density options. Distinct
   * from each option's own accessible name (its `label`), the same way a
   * native `<fieldset><legend>` names the group without repeating into
   * every `<input>` inside it.
   */
  'aria-label'?: string;
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
  overrides,
  size = 'md',
  squareCorners,
  'aria-label': ariaLabel,
}) => {
  const [internalValue, setInternalValue] = useState<string | string[]>(
    defaultValue !== undefined ? defaultValue : type === 'multiple' ? [] : ''
  );
  const currentValue = externalValue !== undefined ? externalValue : internalValue;
  const toggleGroupVars = getSparseVariables(ToggleThemeSlice, overrides ?? {});
  useInjectInteractionStyles();
  useInjectChoiceSeparatorStyles();
  // "components should integrate seamlessly inside ui group with outer
  // border squaring" -- ToggleGroup is a COMPOUND control (its own
  // per-option first/middle/last corner logic below, independent of any
  // ancestor), so unlike Button/Input (which apply the group's own
  // squareCorners value to their one single element directly), only the
  // group's OUTERMOST edges -- this ToggleGroup's own first option's
  // leading corners, and its own last option's trailing corners -- should
  // ever be affected by an ANCESTOR <UIGroup>. Composed correctly below by
  // spreading resolveSquareCorners(...) onto every option's own style
  // AFTER its already-computed per-option radius: whichever corner the
  // ancestor group says should be squared was ALREADY 0 for every option
  // except the one genuine internal edge that needs to be forced flat, so
  // the same single spread is a no-op everywhere except that one case,
  // for every possible ancestor position (first/middle/last/standalone).
  const uiGroupSquareCorners = useUIGroupSquareCorners();
  const outerCornerOverrides = resolveSquareCorners(squareCorners ?? uiGroupSquareCorners);

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
      aria-label={ariaLabel}
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
            className="ai-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--ai-toggle-gap, 0.375rem)',
              padding: resolveControlPadding(size, 'var(--ai-toggle-padding, 0.4375rem 0.75rem)'),
              // Plain shorthand -- the interior choice divider (a short,
              // inset vertical rule marking the seam between adjacent
              // options, distinct from the strip's own true outer edge;
              // reported directly, from a real screenshot, that the
              // absence of any such marker read as ambiguous) now lives
              // entirely in a separate ::before rule
              // (useInjectChoiceSeparatorStyles, theme/choiceSeparator.ts)
              // rather than a per-side border-color override, so every
              // side of THIS element's own border uses the identical,
              // ordinary value again -- no shorthand/longhand mixing to
              // worry about (see AGENTS.md's own borderRadius-shorthand
              // entry for why that combination is a real React warning,
              // not just a style nit, confirmed directly here too before
              // this simplification).
              border: `0.0625rem solid ${selected ? 'var(--ai-color-primary, #3b82f6)' : 'var(--ai-border, #d1d5db)'}`,
              borderTopLeftRadius: isFirst ? 'var(--ai-radius-md, 0.375rem)' : 0,
              borderBottomLeftRadius: isFirst ? 'var(--ai-radius-md, 0.375rem)' : 0,
              borderTopRightRadius: isLast ? 'var(--ai-radius-md, 0.375rem)' : 0,
              borderBottomRightRadius: isLast ? 'var(--ai-radius-md, 0.375rem)' : 0,
              marginLeft: isFirst ? 0 : '-0.0625rem',
              background: selected ? 'var(--ai-color-primary, #3b82f6)' : 'var(--ai-bg-surface, #ffffff)',
              color: selected ? 'var(--ai-color-primary-text, #ffffff)' : 'var(--ai-text-primary, #111827)',
              fontSize: CONTROL_FONT_SIZE_VAR[size],
              fontWeight: 'var(--ai-font-weight-semibold, 600)',
              cursor: itemDisabled ? 'not-allowed' : 'pointer',
              opacity: itemDisabled ? 0.5 : 1,
              position: 'relative',
              zIndex: selected ? 1 : 0,
              // No inline transition -- .ai-btn's own shared rule
              // (interactionStyles.ts) already covers background-color,
              // color, and border-radius, and is !important, so this
              // would be silently discarded outright, not just redundant
              // (issue #411).
              outline: 'none',
              ['--ai-btn-bg' as string]: selected ? 'var(--ai-color-primary, #3b82f6)' : 'var(--ai-bg-surface, #ffffff)',
              ...toggleGroupVars,
              // Last -- wins over this option's own first/middle/last
              // radius above when an ancestor <UIGroup> says this whole
              // strip isn't the true outer edge at that position. See
              // this component's own comment on uiGroupSquareCorners.
              ...outerCornerOverrides,
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
