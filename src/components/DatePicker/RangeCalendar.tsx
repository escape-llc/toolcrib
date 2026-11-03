'use client';

import React from 'react';
import { RangeCalendar as AriaRangeCalendar } from 'react-aria-components/RangeCalendar';
import { I18nProvider } from 'react-aria-components/I18nProvider';
import { CalendarDate } from '@internationalized/date';
import { aiBus } from '../../eventBus/eventBus';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { DatePickerThemeSlice, type DatePickerSliceState } from './DatePickerSlice';
import { type ControlSize } from '../../theme/controlSize';
import { CalendarNav, CalendarMonthGrid } from './calendarParts';
import { useCalendarFormBinding } from './calendarFormBinding';

/**
 * An inclusive span of days, as `@internationalized/date` `CalendarDate`s --
 * the value shape of `<RangeCalendar>` and `<DateRangePicker>`.
 */
export interface CalendarDateRange {
  start: CalendarDate;
  end: CalendarDate;
}

/** Props for the standalone `<RangeCalendar>` month grid. */
export interface RangeCalendarProps {
  /** Field name, auto-inherited from parent `<FormField>` if omitted; inside a `<Form>` the selection is bound to it. Also included in emitted `rangecalendar:changed` events. */
  name?: string;
  /**
   * Controlled selected range, as `@internationalized/date` `CalendarDate`s
   * -- never raw JS `Date`s at this boundary.
   */
  value?: CalendarDateRange | null;
  /** Initial selected range (uncontrolled). */
  defaultValue?: CalendarDateRange | null;
  /** Change handler. Receives the newly selected range once both ends are picked. */
  onChange?: (value: CalendarDateRange) => void;
  /** Earliest selectable date, inclusive. */
  minValue?: CalendarDate;
  /** Latest selectable date, inclusive. */
  maxValue?: CalendarDate;
  /** If true, the whole calendar is non-interactive. Also set by an enclosing `<Fieldset disabled>`. */
  isDisabled?: boolean;
  /** Marks the calendar invalid; inside a `<Form>` it follows the field's error. */
  'aria-invalid'?: boolean;
  /**
   * BCP 47 locale tag controlling month/day names, week start day, and
   * date-grid layout. Fixed, not browser-auto-detected -- see `<TimeField>`'s
   * own doc for why an explicit default prevents an SSR hydration mismatch.
   * @default 'en-US'
   */
  locale?: string;
  /** Per-instance override for grid cell size. `overrides.cellSize` wins over `size` below if both are set. */
  overrides?: Partial<DatePickerSliceState>;
  /** Control size, standardized with `<Button>` and every other sized control. @default 'md' */
  size?: ControlSize;
  /** Accessible name for the calendar grid. Required for a meaningful accessible name unless `aria-labelledby` is given instead. */
  'aria-label'?: string;
  /** Same as `aria-label`, but referencing an existing visible label element's id instead of a literal string. */
  'aria-labelledby'?: string;
}

/**
 * @manifest Month grid for selecting an inclusive range of dates (click the start, then the end), built on React Aria Components
 * @manifestCategory Form Controls
 * @manifestStates default, disabled, invalid
 * @manifestGuarantees form-contract
 * @manifestAntiPatternAvoid Build a date range from two separate `<Calendar>`s with hand-written "end must be after start" logic
 * @manifestAntiPatternInstead Use `<RangeCalendar>` (or `<DateRangePicker>` for a field + popover) — one grid, start/end ordering and keyboard range selection handled for you
 */
export const RangeCalendar: React.FC<RangeCalendarProps> = ({
  name: propName,
  value: externalValue,
  defaultValue,
  onChange,
  minValue,
  maxValue,
  isDisabled: isDisabledProp = false,
  'aria-invalid': ariaInvalid,
  locale = 'en-US',
  overrides,
  size = 'md',
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}) => {
  const { vars } = useSliceOverrides(DatePickerThemeSlice, { cellSize: size, ...overrides });
  const binding = useCalendarFormBinding<CalendarDateRange>(propName, defaultValue ?? null, isDisabledProp, ariaInvalid);
  const name = binding.fieldName || undefined;
  // Controlled while bound to a Form, like the pickers; never because
  // defaultValue alone was set.
  const isControlled = externalValue !== undefined || binding.isFormBound;
  const controlledValue = externalValue !== undefined ? externalValue : binding.formValue;

  const handleChange = (range: { start: CalendarDate; end: CalendarDate }) => {
    const next = { start: range.start, end: range.end };
    binding.write(next);
    onChange?.(next);
    aiBus.emit('rangecalendar:changed', { name, value: { start: range.start.toString(), end: range.end.toString() } });
  };

  return (
    <I18nProvider locale={locale}>
      <AriaRangeCalendar
        key={binding.gridKey}
        {...(isControlled ? { value: controlledValue ?? null } : { defaultValue: defaultValue ?? undefined })}
        // Opens on the default's month even while bound: the Form's value
        // arrives a render later, after React Aria has picked today's month.
        defaultFocusedValue={defaultValue?.start}
        onChange={value => handleChange(value as { start: CalendarDate; end: CalendarDate })}
        minValue={minValue}
        maxValue={maxValue}
        isDisabled={binding.isDisabled}
        isInvalid={binding.isError || undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy ?? (ariaLabel ? undefined : binding.labelId)}
        aria-describedby={binding.describedBy}
        style={{ width: 'fit-content', ...binding.invalidStyle, ...vars } as React.CSSProperties}
      >
        <CalendarNav size={size} />
        <CalendarMonthGrid range />
      </AriaRangeCalendar>
    </I18nProvider>
  );
};
