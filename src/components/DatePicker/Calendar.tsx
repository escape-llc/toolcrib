'use client';

import React from 'react';
import { Calendar as AriaCalendar } from 'react-aria-components/Calendar';
import { I18nProvider } from 'react-aria-components/I18nProvider';
import { CalendarDate } from '@internationalized/date';
import { aiBus } from '../../eventBus/eventBus';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { DatePickerThemeSlice, type DatePickerSliceState } from './DatePickerSlice';
import { type ControlSize } from '../../theme/controlSize';
import { CalendarNav, CalendarMonthGrid } from './calendarParts';

/** Props for the standalone `<Calendar>` month grid. */
export interface CalendarProps {
  /** Field name included in emitted `calendar:changed` events. */
  name?: string;
  /**
   * Controlled selected date, as an `@internationalized/date` `CalendarDate`
   * -- never a raw JS `Date` at this boundary. Convert to/from a plain
   * `Date` at your own call site if your backend needs one.
   */
  value?: CalendarDate | null;
  /** Initial selected date (uncontrolled). */
  defaultValue?: CalendarDate | null;
  /** Change handler. Receives the newly selected date. */
  onChange?: (value: CalendarDate) => void;
  /** Earliest selectable date, inclusive. */
  minValue?: CalendarDate;
  /** Latest selectable date, inclusive. */
  maxValue?: CalendarDate;
  /** If true, the whole calendar is non-interactive. */
  isDisabled?: boolean;
  /**
   * BCP 47 locale tag controlling month/day names, week start day, and
   * date-grid layout. Fixed, not browser-auto-detected -- see
   * `<TimeField>`'s own doc for why an explicit default (not just a
   * provider's presence) is what actually prevents an SSR hydration
   * mismatch.
   * @default 'en-US'
   */
  locale?: string;
  /** Per-instance override for grid cell size. `overrides.cellSize` wins over `size` below if both are set. */
  overrides?: Partial<DatePickerSliceState>;
  /** Control size, standardized with `<Button>` and every other sized control — maps onto the same scale as `overrides.cellSize` and scales the month heading's font size. @default 'md' */
  size?: ControlSize;
  /** Accessible name for the calendar grid. Required for a meaningful accessible name unless `aria-labelledby` is given instead — without either, React Aria's own `useCalendar` warns and the grid has none at all. */
  'aria-label'?: string;
  /** Same as `aria-label`, but referencing an existing visible label element's id instead of a literal string. */
  'aria-labelledby'?: string;
}

/**
 * @manifest Month grid for selecting a single date, built on React Aria Components
 * @manifestCategory Form Controls
 * @manifestAntiPatternAvoid Hand-roll month-grid calendar math (day-of-week offsets, leap years, month-length edge cases)
 * @manifestAntiPatternInstead Use `<Calendar>` with `@internationalized/date` values — timezone/DST/locale correctness is exactly what that dependency exists to guarantee
 */
export const Calendar: React.FC<CalendarProps> = ({
  name,
  value: externalValue,
  defaultValue,
  onChange,
  minValue,
  maxValue,
  isDisabled = false,
  locale = 'en-US',
  overrides,
  size = 'md',
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}) => {
  const { vars } = useSliceOverrides(DatePickerThemeSlice, { cellSize: size, ...overrides });

  const handleChange = (val: CalendarDate) => {
    onChange?.(val);
    aiBus.emit('calendar:changed', { name, value: val.toString() });
  };

  return (
    <I18nProvider locale={locale}>
      <AriaCalendar
        value={externalValue ?? undefined}
        defaultValue={defaultValue ?? undefined}
        onChange={handleChange}
        minValue={minValue}
        maxValue={maxValue}
        isDisabled={isDisabled}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        style={{ width: 'fit-content', ...vars } as React.CSSProperties}
      >
        <CalendarNav size={size} />
        <CalendarMonthGrid />
      </AriaCalendar>
    </I18nProvider>
  );
};
