'use client';

import React, { type ReactNode, useContext, useEffect } from 'react';
import {
  NumberField as AriaNumberField,
  Group,
  Input as AriaInput,
  Button as AriaButton,
  Label,
} from 'react-aria-components/NumberField';
import { I18nProvider } from 'react-aria-components/I18nProvider';
import { Minus, Plus } from 'lucide-react';
import { useOptionalFormContext } from '../Form/FormContext';
import { FieldContext } from '../Form/FieldContext';
import { aiBus } from '../../eventBus/eventBus';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { CONTROL_FONT_SIZE_VAR, resolveControlPadding, type ControlSize } from '../../theme/controlSize';
import { type SquareCornerOption, resolveSquareCorners } from '../Card/Card';
import { useUIGroupSquareCorners } from '../UIGroup/UIGroupContext';

/** Props for the `<NumberField>` numeric input. */
export interface NumberFieldProps {
  /** Field name. Auto-inherited from parent `<FormField>` if omitted. Inside a `<Form>`, the stored value is a real `number` (or `null` when empty). */
  name?: string;
  /** Label rendered above the input. */
  label?: ReactNode;
  /** Controlled value. `null` is an empty field. */
  value?: number | null;
  /** Initial value (uncontrolled). */
  defaultValue?: number | null;
  /** Change handler, called when the value commits (blur, Enter, a stepper, arrow keys). Receives `null` when the field is cleared. */
  onChange?: (value: number | null) => void;
  /** Lowest allowed value; typed values clamp to it on commit. */
  min?: number;
  /** Highest allowed value; typed values clamp to it on commit. */
  max?: number;
  /**
   * Increment for the steppers and arrow keys. When set, typed values also
   * snap to it (`step={0.25}` turns 1.1 into 1.0). Leave it unset for
   * free-form decimals like prices: the steppers still move by 1 and nothing
   * is rounded.
   */
  step?: number;
  /**
   * Display format, as `Intl.NumberFormat` options: `{ style: 'currency', currency: 'USD' }`,
   * `{ style: 'percent' }`, `{ style: 'unit', unit: 'kilogram' }`, `{ maximumFractionDigits: 2 }`.
   * The value itself stays a plain number (a percent of 25% is `0.25`).
   */
  formatOptions?: Intl.NumberFormatOptions;
  /**
   * BCP 47 locale tag for formatting and parsing (decimal and group
   * separators, currency placement). Fixed rather than browser-detected,
   * so server and client render the same text (no hydration mismatch).
   * @default 'en-US'
   */
  locale?: string;
  /** If true, the field is non-interactive. */
  isDisabled?: boolean;
  /** Placeholder shown while the field is empty. */
  placeholder?: string;
  /** Control size, standardized with `<Button>`/`<Input>` so instances line up in a `<UIGroup>` row. @default 'md' */
  size?: ControlSize;
  /** Accessible name when no visible `label` is rendered. Ignored if `label` is set. */
  'aria-label'?: string;
  /** Same as `aria-label`, referencing an existing visible label's id. Ignored if `label` is set. */
  'aria-labelledby'?: string;
  /** Explicit corner-squaring override, e.g. for a `<UIGroup>` member. See `<Button>`'s identical prop. */
  squareCorners?: SquareCornerOption;
}

// .ai-btn gives the steppers the toolkit's shared hover tint and press
// scale (interactionStyles.ts), same as <Button>.
const STEPPER_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: '2.25em',
  alignSelf: 'stretch',
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: 'var(--ai-text-secondary, #6b7280)',
  cursor: 'pointer',
};

/**
 * @manifest Numeric input with −/+ steppers, min/max clamping, step snapping, arrow/PageUp/PageDown keys and locale-aware currency/percent/unit formatting, built on React Aria Components
 * @manifestCategory Form Controls
 * @manifestAntiPatternAvoid `<Input type="number">` plus hand-rolled +/- buttons, clamping and `Intl.NumberFormat` display
 * @manifestAntiPatternInstead `<NumberField min={0} max={99} formatOptions={{ style: 'currency', currency: 'USD' }} />` — inside a `<Form>` it stores a real `number`
 */
export const NumberField: React.FC<NumberFieldProps> = ({
  name: propName,
  label,
  value: externalValue,
  defaultValue,
  onChange,
  min,
  max,
  step,
  formatOptions,
  locale = 'en-US',
  isDisabled = false,
  placeholder,
  size = 'md',
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  squareCorners,
}) => {
  const fieldCtx = useContext(FieldContext);
  const fieldName = propName || fieldCtx.name || '';
  const formContext = useOptionalFormContext();
  const registerField = formContext?.registerField;
  const uiGroupSquareCorners = useUIGroupSquareCorners();
  const cornerOverrides = resolveSquareCorners(squareCorners ?? uiGroupSquareCorners);
  useInjectInteractionStyles();

  useEffect(() => {
    // Seeded with defaultValue, else null (not the default ''), so an
    // untouched field submits and validates as a number or empty. Only applies
    // when the Form has no value for this field yet (its initialValues win).
    if (fieldName && registerField) registerField(fieldName, defaultValue ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a seed is read once, like any default
  }, [fieldName, registerField]);

  const isFormBound = !!(fieldName && formContext);
  // Controlled only with a live source (an explicit `value`, or a Form
  // binding) -- never because `defaultValue` was set; see TimeField and
  // AGENTS.md (no-frozen-controlled-prop) for the bug that shape causes.
  const isControlled = externalValue !== undefined || isFormBound;
  const formValue = isFormBound ? (formContext!.values[fieldName] as number | null | undefined) : undefined;
  const controlledValue = externalValue !== undefined ? externalValue : formValue;
  const isError = isFormBound ? !!(formContext!.touched[fieldName] && formContext!.errors[fieldName]) : false;

  const handleChange = (raw: number) => {
    // React Aria reports an emptied field as NaN; toolcrib's value is null.
    const val = Number.isNaN(raw) ? null : raw;
    if (isFormBound) {
      formContext!.setFieldValue(fieldName, val);
      formContext!.setFieldTouched(fieldName, true);
    }
    onChange?.(val);
    aiBus.emit('numberfield:changed', { name: fieldName || undefined, value: val });
  };

  // Label association inside a <FormField>: its label is htmlFor={name},
  // so the input takes the field name as its id, like <Input>.
  const labelledBy = !label ? ariaLabelledBy ?? (!ariaLabel ? fieldCtx.labelId : undefined) : undefined;

  return (
    <I18nProvider locale={locale}>
      <AriaNumberField
        {...(isControlled ? { value: controlledValue ?? NaN } : { defaultValue: defaultValue ?? undefined })}
        onChange={handleChange}
        minValue={min}
        maxValue={max}
        step={step}
        formatOptions={formatOptions}
        isDisabled={isDisabled}
        isInvalid={isError}
        id={fieldName || undefined}
        name={fieldName || undefined}
        aria-label={!label ? ariaLabel : undefined}
        aria-labelledby={labelledBy}
        style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', width: '100%' }}
      >
        {label && (
          <Label style={{ display: 'block', fontSize: CONTROL_FONT_SIZE_VAR[size], fontWeight: 'var(--ai-font-weight-semibold, 600)', color: 'var(--ai-text-primary, #111827)' }}>
            {label}
          </Label>
        )}
        <Group
          className="ai-focus-ring"
          style={{
            display: 'flex',
            alignItems: 'stretch',
            boxSizing: 'border-box',
            width: '100%',
            border: `var(--ai-input-border-width, 0.0625rem) solid ${isError ? 'var(--ai-subtheme-error, #ef4444)' : 'var(--ai-border, #d1d5db)'}`,
            borderTopLeftRadius: 'var(--ai-radius-md, 0.375rem)',
            borderTopRightRadius: 'var(--ai-radius-md, 0.375rem)',
            borderBottomLeftRadius: 'var(--ai-radius-md, 0.375rem)',
            borderBottomRightRadius: 'var(--ai-radius-md, 0.375rem)',
            background: isDisabled ? 'var(--ai-bg-container, #f3f4f6)' : 'var(--ai-bg-surface, #ffffff)',
            overflow: 'hidden',
            ...cornerOverrides,
          }}
        >
          <AriaButton slot="decrement" className="ai-btn" style={STEPPER_STYLE}>
            <Minus size="1em" aria-hidden="true" />
          </AriaButton>
          <AriaInput
            placeholder={placeholder}
            aria-describedby={isError ? `${fieldName}-error` : undefined}
            style={{
              flex: '1 1 auto',
              minWidth: 0,
              boxSizing: 'border-box',
              padding: resolveControlPadding(size, 'var(--ai-input-padding, 0.5rem 0.75rem)'),
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: CONTROL_FONT_SIZE_VAR[size],
              fontFamily: 'inherit',
              color: 'var(--ai-text-primary, #111827)',
              textAlign: 'center',
              fontVariantNumeric: 'tabular-nums',
            }}
          />
          <AriaButton slot="increment" className="ai-btn" style={STEPPER_STYLE}>
            <Plus size="1em" aria-hidden="true" />
          </AriaButton>
        </Group>
      </AriaNumberField>
    </I18nProvider>
  );
};
