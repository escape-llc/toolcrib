import React, { ReactNode, useContext } from 'react';
import {
  DatePicker as AriaDatePicker,
  DatePickerStateContext,
  DateInput,
  DateSegment,
  Group,
  Label,
} from 'react-aria-components/DatePicker';
import { I18nProvider } from 'react-aria-components/I18nProvider';
import { CalendarDate } from '@internationalized/date';
import { useOptionalFormContext } from '../Form/FormContext';
import { FieldContext } from '../Form/FieldContext';
import { aiBus } from '../../eventBus/eventBus';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { Popup } from '../Overlay/Popup';
import { Z_INDEX } from '../../theme/zIndex';
import { Calendar } from './Calendar';
import { DatePickerSliceState } from './DatePickerSlice';

/** Props for the `<DatePicker>` field + calendar popover. */
export interface DatePickerProps {
  /** Field name. Auto-inherited from parent `<FormField>` if omitted. */
  name?: string;
  /** Label rendered above the field. */
  label?: ReactNode;
  /**
   * Controlled value, as an `@internationalized/date` `CalendarDate` --
   * never a raw JS `Date` at this boundary. Convert to/from a plain `Date`
   * at your own call site if your backend needs one.
   */
  value?: CalendarDate | null;
  /** Initial value (uncontrolled). */
  defaultValue?: CalendarDate | null;
  /** Change handler. Receives the newly selected date, or `null` if cleared. */
  onChange?: (value: CalendarDate | null) => void;
  /** Earliest selectable date, inclusive. */
  minValue?: CalendarDate;
  /** Latest selectable date, inclusive. */
  maxValue?: CalendarDate;
  /** If true, the field is non-interactive. */
  isDisabled?: boolean;
  /**
   * BCP 47 locale tag. Fixed, not browser-auto-detected -- see
   * `<TimeField>`'s own doc for why an explicit default (not just a
   * provider's presence) is what actually prevents an SSR hydration
   * mismatch.
   * @default 'en-US'
   */
  locale?: string;
  /** Per-instance override for the calendar popover's grid cell size. */
  overrides?: Partial<DatePickerSliceState>;
}

/**
 * The typed field + calendar-toggle button, and the `<Popup>`-hosted
 * calendar itself -- split out so it can read `DatePickerStateContext`
 * (only available *inside* `<DatePicker>`, not from the props this
 * component's caller has direct access to).
 */
const DatePickerFieldAndCalendar: React.FC<{ overrides?: Partial<DatePickerSliceState> }> = ({ overrides }) => {
  const state = useContext(DatePickerStateContext)!;

  return (
    <Group
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: 'var(--ai-input-padding, 0.5rem 0.75rem)',
        border: '0.0625rem solid var(--ai-border, #d1d5db)',
        borderRadius: 'var(--ai-radius-md, 0.375rem)',
        background: 'var(--ai-bg-surface, #ffffff)',
        width: 'fit-content',
      }}
    >
      <DateInput style={{ display: 'flex', fontSize: '0.875rem' }}>
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

      {/*
        The calendar-toggle button is the *only* element wrapped by
        <Popup>'s own trigger -- not the whole Group (which would also
        wrap the DateInput's editable segments). Radix's PopoverPrimitive
        .Trigger attaches its own click handling to whatever `trigger`
        element it's given; wrapping the segments too would mean clicking
        into a segment to type a value could also toggle the calendar
        open/closed, which isn't how a date picker is supposed to behave --
        typing edits the value, only the button opens the calendar.

        isOpen/onOpenChange are wired directly to DatePickerState, not
        Popup's own internal open state -- this is the actual Shell/
        Content decoupling: React Aria's hook logic still owns whether the
        picker *should* be open (triggered by this button's press, or by
        keyboard interaction with the field), but Popup -- not React
        Aria's own Popover -- is the one thing that ever mounts a portal,
        traps focus, or handles Escape for the calendar surface.
      */}
      <Popup
        trigger={
          <button type="button" aria-label="Open calendar" style={{ all: 'unset', cursor: 'pointer', color: 'var(--ai-text-secondary, #6b7280)', display: 'flex' }}>
            📅
          </button>
        }
        isOpen={state.isOpen}
        onOpenChange={open => state.setOpen(open)}
        zIndex={Z_INDEX.DROPDOWN}
      >
        <Calendar
          value={(state.dateValue as CalendarDate | null) ?? undefined}
          onChange={date => {
            state.setDateValue(date);
            // No dependency on React Aria's own Popover/shouldCloseOnSelect
            // machinery, since that's exactly the piece this component
            // doesn't use -- closing on select is this component's own,
            // explicit call, matching that same default behavior.
            state.setOpen(false);
          }}
          overrides={overrides}
        />
      </Popup>
    </Group>
  );
};

/**
 * @manifest Date field + calendar popover, hosted in `<Popup>` (not React Aria's own popover), built on React Aria Components
 * @manifestCategory Form Controls
 */
export const DatePicker: React.FC<DatePickerProps> = ({
  name: propName,
  label,
  value: externalValue,
  defaultValue,
  onChange,
  minValue,
  maxValue,
  isDisabled = false,
  locale = 'en-US',
  overrides,
}) => {
  const fieldCtx = useContext(FieldContext);
  const fieldName = propName || fieldCtx.name || '';
  const formContext = useOptionalFormContext();
  useInjectInteractionStyles();

  const formValue: CalendarDate | null | undefined =
    fieldName && formContext ? (formContext.values[fieldName] as CalendarDate | null | undefined) : undefined;
  const resolvedValue = externalValue !== undefined ? externalValue : formValue !== undefined ? formValue : defaultValue;

  const handleChange = (val: CalendarDate | null) => {
    if (fieldName && formContext) {
      formContext.setFieldValue(fieldName, val);
      formContext.setFieldTouched(fieldName, true);
    }
    onChange?.(val);
    aiBus.emit('datepicker:changed', { name: fieldName, value: val ? val.toString() : null });
  };

  return (
    <I18nProvider locale={locale}>
      <AriaDatePicker
        value={resolvedValue ?? undefined}
        onChange={handleChange}
        granularity="day"
        minValue={minValue}
        maxValue={maxValue}
        isDisabled={isDisabled}
        shouldCloseOnSelect={false}
        className="ai-focus-ring"
      >
        {label && (
          <Label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 'var(--ai-font-weight-semibold, 600)', marginBottom: '0.375rem', color: 'var(--ai-text-primary, #111827)' }}>
            {label}
          </Label>
        )}
        <DatePickerFieldAndCalendar overrides={overrides} />
      </AriaDatePicker>
    </I18nProvider>
  );
};
