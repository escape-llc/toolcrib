'use client';

import React, { type ReactNode, useContext, useEffect, useState } from 'react';
import { FieldContext } from '../Form/FieldContext';
import { useOptionalFormContext, type FormContextType } from '../Form/FormContext';
import { useFieldInvalid, INVALID_COLOR } from '../Form/useFieldInvalid';
import { useFieldsetDisabled } from '../Fieldset/FieldsetContext';
import { Toggle as BaseToggle } from '@base-ui/react/toggle';
import { ToggleGroup as BaseToggleGroup } from '@base-ui/react/toggle-group';
import { aiBus } from '../../eventBus/eventBus';
import { getSparseVariables } from '../../theme/slice';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { ToggleThemeSlice, type ToggleSliceState } from './ToggleSlice';
import { CONTROL_FONT_SIZE_VAR, resolveControlPadding, type ControlSize } from '../../theme/controlSize';
import { type SquareCornerOption, resolveSquareCorners } from '../Card/Card';
import { useUIGroupSquareCorners } from '../UIGroup/UIGroupContext';
import { ChoiceSeparator } from '../shared/ChoiceSeparator';

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
 * The Form binding Toggle and ToggleGroup share: the name inherited from
 * `<FormField>`, the seed registered on mount, and the field's value used as
 * the controlled value while inside a Form (#880's contract,
 * src/__tests__/formControlContract.test.tsx).
 */
function useFormBinding<V>(propName: string | undefined, seed: V) {
  const fieldCtx = useContext(FieldContext);
  const fieldName = propName || fieldCtx.name || '';
  const formContext = useOptionalFormContext();
  const registerField = formContext?.registerField;
  useEffect(() => {
    if (fieldName && registerField) registerField(fieldName, seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a seed is read once, like any default
  }, [fieldName, registerField]);
  const form: FormContextType | undefined = fieldName ? formContext ?? undefined : undefined;
  const isError = useFieldInvalid(fieldName || undefined);
  return {
    fieldName,
    isError,
    /** Invalid-state attributes for the control, following the field's error. */
    invalidProps: isError ? { 'aria-invalid': true as const, 'aria-describedby': `${fieldName}-error` } : {},
    labelId: fieldCtx.labelId,
    formValue: form ? (form.values[fieldName] as V | undefined) ?? seed : undefined,
    write: (next: V) => {
      if (!form) return;
      form.setFieldValue(fieldName, next);
      form.setFieldTouched(fieldName, true);
    },
  };
}

/**
 * @manifest Two-state pressed/unpressed button, standalone (see ToggleGroup for a connected set)
 * @manifestCategory Form Controls
 * @manifestStates default, focused, disabled, invalid
 * @manifestGuarantees form-contract
 */
export const Toggle: React.FC<ToggleProps> = ({
  name,
  pressed: externalPressed,
  defaultPressed = false,
  onPressedChange,
  disabled: disabledProp = false,
  children,
  overrides,
  size = 'md',
}) => {
  // The native <fieldset> already blocks the button; this makes it look
  // and report disabled too, like ToggleGroup (#880).
  const disabled = useFieldsetDisabled(disabledProp);
  const binding = useFormBinding<boolean>(name, defaultPressed);
  const [internalPressed, setInternalPressed] = useState(defaultPressed);
  const isPressed = externalPressed !== undefined ? externalPressed : binding.formValue ?? internalPressed;
  const toggleVars = getSparseVariables(ToggleThemeSlice, overrides ?? {});
  useInjectInteractionStyles();

  const handlePressedChange = (next: boolean) => {
    if (externalPressed === undefined) setInternalPressed(next);
    binding.write(next);
    if (onPressedChange) onPressedChange(next);
    aiBus.emit('toggle:changed', { name: binding.fieldName || name, pressed: next });
  };

  return (
    <BaseToggle
      pressed={isPressed}
      onPressedChange={next => handlePressedChange(next)}
      // Inside a <FormField>, its label (htmlFor={name}) names the toggle.
      id={binding.fieldName || undefined}
      {...binding.invalidProps}
      disabled={disabled}
      className="ai-btn"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--ai-toggle-gap, 0.375rem)',
        padding: resolveControlPadding(size, 'var(--ai-toggle-padding, 0.4375rem 0.75rem)'),
        borderRadius: 'var(--ai-radius-md, 0.375rem)',
        border: `0.0625rem solid ${isPressed ? 'var(--ai-color-primary, #3b82f6)' : binding.isError ? INVALID_COLOR : 'var(--ai-border, #d1d5db)'}`,
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
    </BaseToggle>
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
 * is a no-op, so one option always stays selected); `type="multiple"` allows any
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
   * Accessible name for the whole group (the root's `role="radiogroup"`
   * or `role="group"`) — e.g. "Row density" for a set of density options. Distinct
   * from each option's own accessible name (its `label`), the same way a
   * native `<fieldset><legend>` names the group without repeating into
   * every `<input>` inside it.
   */
  'aria-label'?: string;
}

const GROUP_RADIUS = 'var(--ai-radius-md, 0.375rem)';
const GROUP_BORDER_WIDTH = '0.0625rem';
/** An option's fill sits inside the root's border, so its corner radius is the root's minus the border. */
const OPTION_INNER_RADIUS = `calc(${GROUP_RADIUS} - ${GROUP_BORDER_WIDTH})`;

/**
 * @manifest Connected button set for single or multiple selection, data-driven
 * @manifestCategory Form Controls
 * @manifestStates default, focused, disabled, invalid
 * @manifestGuarantees form-contract
 */
export const ToggleGroup: React.FC<ToggleGroupProps> = ({
  name,
  type = 'single',
  value: externalValue,
  defaultValue,
  onChange,
  options,
  disabled: disabledProp = false,
  overrides,
  size = 'md',
  squareCorners,
  'aria-label': ariaLabel,
}) => {
  const disabled = useFieldsetDisabled(disabledProp);
  const seed = defaultValue !== undefined ? defaultValue : type === 'multiple' ? [] : '';
  const binding = useFormBinding<string | string[]>(name, seed);
  const [internalValue, setInternalValue] = useState<string | string[]>(seed);
  const currentValue = externalValue !== undefined ? externalValue : binding.formValue ?? internalValue;
  const toggleGroupVars = getSparseVariables(ToggleThemeSlice, overrides ?? {});
  useInjectInteractionStyles();
  // The root draws the frame, so an ancestor <UIGroup> squares the root's
  // corners; the first and last options follow whatever the root resolved to.
  const uiGroupSquareCorners = useUIGroupSquareCorners();
  const squared = resolveSquareCorners(squareCorners ?? uiGroupSquareCorners);
  const rootCorners = {
    borderTopLeftRadius: squared.borderTopLeftRadius ?? GROUP_RADIUS,
    borderTopRightRadius: squared.borderTopRightRadius ?? GROUP_RADIUS,
    borderBottomLeftRadius: squared.borderBottomLeftRadius ?? GROUP_RADIUS,
    borderBottomRightRadius: squared.borderBottomRightRadius ?? GROUP_RADIUS,
  };
  const innerRadius = (corner: keyof typeof rootCorners) =>
    rootCorners[corner] === GROUP_RADIUS ? OPTION_INNER_RADIUS : 0;

  const handleValueChange = (groupValue: string[]) => {
    const next: string | string[] = type === 'multiple' ? groupValue : groupValue[0] ?? '';
    // type="single" is announced as a radiogroup (see the render below), but
    // the primitive's value model is still a plain toggle, not a true
    // radio: clicking the currently-selected option deselects it, leaving
    // no value -- valid, ordinary behavior for `type="multiple"`
    // (a toolbar of independent toggles can legitimately have none
    // pressed), but a real WAI-ARIA violation for `type="single"` (a
    // radiogroup must always have exactly one option checked once
    // initialized, never none) and, found the hard way via a real
    // "Too many re-renders" crash, is genuinely dangerous downstream:
    // DataTable's own density selector composes this exact shape, and an
    // empty density string cascades into DENSITY_ROW_HEIGHT_PX[''] being
    // undefined, itemHeight becoming undefined, and an eventual NaN
    // entering a render-time state-adjustment guard whose `!==` comparison
    // can never stabilize once either side is NaN (NaN !== NaN is always
    // true in JS) -- an infinite loop, not a cosmetic glitch. Ignoring an
    // empty-string deselect attempt in single mode keeps the previously
    // selected option checked, matching true radio semantics for every
    // consumer of this shape, not just DataTable's own.
    if (type === 'single' && next === '') return;
    if (externalValue === undefined) setInternalValue(next);
    binding.write(next);
    if (onChange) onChange(next);
    aiBus.emit('togglegroup:changed', { name: binding.fieldName || name, value: next });
  };

  const isSelected = (optValue: string): boolean =>
    type === 'multiple' ? (currentValue as string[]).includes(optValue) : currentValue === optValue;

  const groupValue = type === 'multiple' ? (currentValue as string[]) : currentValue ? [currentValue as string] : [];
  const isSingle = type === 'single';

  return (
    // Base UI's ToggleGroup is a group of aria-pressed toggle buttons in
    // both modes. Single mode uses radio semantics
    // (#702): the root is a radiogroup and each option a radio with
    // aria-checked, so "one of N" is announced as such. Arrow keys move
    // focus and Space/Enter selects. Dividers are aria-hidden spans between
    // the options (#903), never inside one, so no option's fill paints under one.
    <BaseToggleGroup
      multiple={!isSingle}
      value={groupValue}
      onValueChange={v => handleValueChange(v as string[])}
      disabled={disabled}
      // Only set in single mode: an explicit `role={undefined}` would erase
      // Base UI's own role="group" for a multiple group.
      {...(isSingle ? { role: 'radiogroup' } : {})}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel ? undefined : binding.labelId}
      {...binding.invalidProps}
      style={{
        display: 'inline-flex',
        alignItems: 'stretch',
        borderWidth: GROUP_BORDER_WIDTH,
        borderStyle: 'solid',
        borderColor: binding.isError ? INVALID_COLOR : 'var(--ai-border, #d1d5db)',
        background: 'var(--ai-bg-surface, #ffffff)',
        ...rootCorners,
      }}
    >
      {options.map((opt, index) => {
        const selected = isSelected(opt.value);
        const isFirst = index === 0;
        const isLast = index === options.length - 1;
        const itemDisabled = disabled || opt.disabled;

        return (
          <React.Fragment key={opt.value}>
            {!isFirst && <ChoiceSeparator />}
            <BaseToggle
              value={opt.value}
              disabled={itemDisabled}
              role={isSingle ? 'radio' : undefined}
              aria-checked={isSingle ? selected : undefined}
              aria-pressed={isSingle ? undefined : selected}
              className="ai-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--ai-toggle-gap, 0.375rem)',
                padding: resolveControlPadding(size, 'var(--ai-toggle-padding, 0.4375rem 0.75rem)'),
                // No border: the frame is on the root. Only the outer corners
                // of the first and last option round, to the root's inner
                // radius, so a fill follows the root's curve. The focus ring
                // is an outline outside the box, so overflow:hidden on the
                // root would clip it; radii don't.
                border: 0,
                borderTopLeftRadius: isFirst ? innerRadius('borderTopLeftRadius') : 0,
                borderBottomLeftRadius: isFirst ? innerRadius('borderBottomLeftRadius') : 0,
                borderTopRightRadius: isLast ? innerRadius('borderTopRightRadius') : 0,
                borderBottomRightRadius: isLast ? innerRadius('borderBottomRightRadius') : 0,
                background: selected ? 'var(--ai-color-primary, #3b82f6)' : 'var(--ai-bg-surface, #ffffff)',
                color: selected ? 'var(--ai-color-primary-text, #ffffff)' : 'var(--ai-text-primary, #111827)',
                fontSize: CONTROL_FONT_SIZE_VAR[size],
                fontWeight: 'var(--ai-font-weight-semibold, 600)',
                cursor: itemDisabled ? 'not-allowed' : 'pointer',
                opacity: itemDisabled ? 0.5 : 1,
                // No inline transition -- .ai-btn's own shared rule
                // (interactionStyles.ts) already covers background-color,
                // color, and border-radius, and is !important, so this
                // would be silently discarded outright, not just redundant
                // (issue #411).
                outline: 'none',
                ['--ai-btn-bg' as string]: selected ? 'var(--ai-color-primary, #3b82f6)' : 'var(--ai-bg-surface, #ffffff)',
                ...toggleGroupVars,
              }}
            >
              {opt.icon}
              {opt.label}
            </BaseToggle>
          </React.Fragment>
        );
      })}
    </BaseToggleGroup>
  );
};
