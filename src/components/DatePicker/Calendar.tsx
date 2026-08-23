import React from 'react';
import {
  Calendar as AriaCalendar,
  CalendarGrid,
  CalendarGridHeader,
  CalendarGridBody,
  CalendarHeaderCell,
  CalendarCell,
  CalendarHeading,
  Button,
} from 'react-aria-components/Calendar';
import { I18nProvider } from 'react-aria-components/I18nProvider';
import { CalendarDate } from '@internationalized/date';
import { aiBus } from '../../eventBus/eventBus';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { DatePickerThemeSlice, type DatePickerSliceState } from './DatePickerSlice';
import { CONTROL_FONT_SIZE_VAR, type ControlSize } from '../../theme/controlSize';

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <Button
            slot="previous"
            className="ai-btn"
            aria-label="Previous month"
            style={{
              all: 'unset',
              cursor: 'pointer',
              padding: '0.25rem 0.5rem',
              borderRadius: 'var(--ai-radius-sm, 0.25rem)',
              color: 'var(--ai-text-secondary, #6b7280)',
            }}
          >
            ◀
          </Button>
          <CalendarHeading style={{ fontWeight: 'var(--ai-font-weight-semibold, 600)', fontSize: CONTROL_FONT_SIZE_VAR[size], color: 'var(--ai-text-primary, #111827)' }} />
          <Button
            slot="next"
            className="ai-btn"
            aria-label="Next month"
            style={{
              all: 'unset',
              cursor: 'pointer',
              padding: '0.25rem 0.5rem',
              borderRadius: 'var(--ai-radius-sm, 0.25rem)',
              color: 'var(--ai-text-secondary, #6b7280)',
            }}
          >
            ▶
          </Button>
        </div>

        <CalendarGrid style={{ borderCollapse: 'collapse' }}>
          <CalendarGridHeader>
            {day => (
              <CalendarHeaderCell
                style={{ fontSize: '0.75rem', fontWeight: 'var(--ai-font-weight-semibold, 600)', color: 'var(--ai-text-secondary, #6b7280)', padding: '0.25rem' }}
              >
                {day}
              </CalendarHeaderCell>
            )}
          </CalendarGridHeader>
          <CalendarGridBody>
            {date => (
              <CalendarCell
                date={date}
                style={({ isSelected, isToday, isDisabled: cellDisabled, isOutsideMonth, isUnavailable }) => ({
                  width: 'var(--ai-datepicker-cell-size, 2.25rem)',
                  height: 'var(--ai-datepicker-cell-size, 2.25rem)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.8125rem',
                  borderRadius: 'var(--ai-radius-sm, 0.25rem)',
                  cursor: cellDisabled || isUnavailable ? 'not-allowed' : 'pointer',
                  opacity: isOutsideMonth ? 0.35 : cellDisabled ? 0.4 : 1,
                  textDecoration: isUnavailable ? 'line-through' : 'none',
                  background: isSelected ? 'var(--ai-color-primary, #3b82f6)' : 'transparent',
                  color: isSelected ? 'var(--ai-color-on-primary, #ffffff)' : 'var(--ai-text-primary, #111827)',
                  border: isToday && !isSelected ? '0.0625rem solid var(--ai-color-primary, #3b82f6)' : '0.0625rem solid transparent',
                })}
              />
            )}
          </CalendarGridBody>
        </CalendarGrid>
      </AriaCalendar>
    </I18nProvider>
  );
};
