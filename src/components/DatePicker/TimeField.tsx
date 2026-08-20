import React, { type ReactNode, useContext } from 'react';
import {
  TimeField as AriaTimeField,
  DateInput,
  DateSegment,
  Label,
} from 'react-aria-components/TimeField';
import { I18nProvider } from 'react-aria-components/I18nProvider';
import { Time } from '@internationalized/date';
import { useOptionalFormContext } from '../Form/FormContext';
import { FieldContext } from '../Form/FieldContext';
import { aiBus } from '../../eventBus/eventBus';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';

/** Props for the `<TimeField>` segmented time input. */
export interface TimeFieldProps {
  /** Field name. Auto-inherited from parent `<FormField>` if omitted. */
  name?: string;
  /** Label rendered above the input. */
  label?: ReactNode;
  /**
   * Controlled value, as an `@internationalized/date` `Time` -- never a raw
   * JS `Date` at this boundary (timezone/DST correctness is exactly what
   * that type exists to guarantee). Convert to/from a plain `Date` at your
   * own call site if your backend needs one.
   */
  value?: Time | null;
  /** Initial value (uncontrolled). */
  defaultValue?: Time | null;
  /** Change handler. Receives the new `Time`, or `null` if cleared. */
  onChange?: (value: Time | null) => void;
  /** Smallest displayed unit. @default 'minute' */
  granularity?: 'hour' | 'minute' | 'second';
  /** 12-hour vs. 24-hour display. Defaults to the active locale's own convention. */
  hourCycle?: 12 | 24;
  /** If true, the field is non-interactive. */
  isDisabled?: boolean;
  /**
   * BCP 47 locale tag controlling segment order and hour-cycle default.
   * Fixed, not browser-auto-detected -- an explicit default is what
   * prevents an SSR hydration mismatch (server and client disagreeing),
   * not the presence of a provider by itself.
   * @default 'en-US'
   */
  locale?: string;
}

/**
 * @manifest Segmented time input (hour/minute/second, individually keyboard-editable) built on React Aria Components
 * @manifestCategory Form Controls
 */
export const TimeField: React.FC<TimeFieldProps> = ({
  name: propName,
  label,
  value: externalValue,
  defaultValue,
  onChange,
  granularity = 'minute',
  hourCycle,
  isDisabled = false,
  locale = 'en-US',
}) => {
  const fieldCtx = useContext(FieldContext);
  const fieldName = propName || fieldCtx.name || '';
  const formContext = useOptionalFormContext();
  useInjectInteractionStyles();

  const formValue: Time | null | undefined =
    fieldName && formContext ? (formContext.values[fieldName] as Time | null | undefined) : undefined;
  const resolvedValue = externalValue !== undefined ? externalValue : formValue !== undefined ? formValue : defaultValue;

  const handleChange = (val: Time | null) => {
    if (fieldName && formContext) {
      formContext.setFieldValue(fieldName, val);
      formContext.setFieldTouched(fieldName, true);
    }
    onChange?.(val);
    aiBus.emit('timefield:changed', { name: fieldName, value: val ? val.toString() : null });
  };

  return (
    <I18nProvider locale={locale}>
      <AriaTimeField
        value={resolvedValue ?? undefined}
        onChange={handleChange}
        granularity={granularity}
        hourCycle={hourCycle}
        isDisabled={isDisabled}
        className="ai-focus-ring"
      >
        {label && (
          <Label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 'var(--ai-font-weight-semibold, 600)', marginBottom: '0.375rem', color: 'var(--ai-text-primary, #111827)' }}>
            {label}
          </Label>
        )}
        <DateInput
          style={{
            display: 'flex',
            padding: 'var(--ai-input-padding, 0.5rem 0.75rem)',
            border: `0.0625rem solid var(--ai-border, #d1d5db)`,
            borderRadius: 'var(--ai-radius-md, 0.375rem)',
            background: isDisabled ? 'var(--ai-bg-container, #f3f4f6)' : 'var(--ai-bg-surface, #ffffff)',
            fontSize: '0.875rem',
            color: 'var(--ai-text-primary, #111827)',
            width: 'fit-content',
          }}
        >
          {segment => (
            <DateSegment
              segment={segment}
              style={{
                padding: '0 0.0625rem',
                textAlign: 'end',
                color: segment.isPlaceholder ? 'var(--ai-text-secondary, #9ca3af)' : 'var(--ai-text-primary, #111827)',
                outline: 'none',
              }}
            />
          )}
        </DateInput>
      </AriaTimeField>
    </I18nProvider>
  );
};
