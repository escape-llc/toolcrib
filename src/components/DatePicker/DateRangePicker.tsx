'use client';

import React, { type ReactNode, useContext } from 'react';
import { useFieldsetDisabled } from '../Fieldset/FieldsetContext';
import { DateRangePicker as AriaDateRangePicker, DateRangePickerStateContext, Group, Label } from 'react-aria-components/DateRangePicker';
import { I18nProvider } from 'react-aria-components/I18nProvider';
import { CalendarDate } from '@internationalized/date';
import { useOptionalFormContext } from '../Form/FormContext';
import { FieldContext } from '../Form/FieldContext';
import { aiBus } from '../../eventBus/eventBus';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { Popup } from '../Overlay/Popup';
import { Z_INDEX } from '../../theme/zIndex';
import { RangeCalendar, type CalendarDateRange } from './RangeCalendar';
import { type SquareCornerOption, resolveSquareCorners } from '../Card/Card';
import { useUIGroupSquareCorners } from '../UIGroup/UIGroupContext';
import { type DatePickerSliceState } from './DatePickerSlice';
import { CONTROL_FONT_SIZE_VAR, type ControlSize } from '../../theme/controlSize';
import { fieldGroupStyle, DateSegments, CalendarPopupTrigger } from './calendarParts';

/** Props for the `<DateRangePicker>` start/end fields + range calendar popover. */
export interface DateRangePickerProps {
  /** Field name. Auto-inherited from parent `<FormField>` if omitted. The Form value is a `{ start, end }` `CalendarDateRange`, or `null`. */
  name?: string;
  /** Label rendered above the field. */
  label?: ReactNode;
  /**
   * Controlled value, as `@internationalized/date` `CalendarDate`s -- never
   * raw JS `Date`s at this boundary.
   */
  value?: CalendarDateRange | null;
  /** Initial value (uncontrolled). */
  defaultValue?: CalendarDateRange | null;
  /** Change handler. Receives the new range, or `null` if cleared. */
  onChange?: (value: CalendarDateRange | null) => void;
  /** Earliest selectable date, inclusive. */
  minValue?: CalendarDate;
  /** Latest selectable date, inclusive. */
  maxValue?: CalendarDate;
  /** If true, the field is non-interactive. */
  isDisabled?: boolean;
  /**
   * BCP 47 locale tag. Fixed, not browser-auto-detected -- see
   * `<TimeField>`'s own doc for why an explicit default prevents an SSR
   * hydration mismatch.
   * @default 'en-US'
   */
  locale?: string;
  /** Per-instance override for the calendar popover's grid cell size. */
  overrides?: Partial<DatePickerSliceState>;
  /** Control size, standardized with `<Button>` and every other sized control so instances line up in a `<UIGroup>` row. @default 'md' */
  size?: ControlSize;
  /**
   * Accessible name for the field, for a caller that already shows a
   * visible label some other way (e.g. `<FormField label="...">`). Ignored
   * if `label` is set. Required for a meaningful accessible name unless
   * `aria-labelledby` or `label` is given instead.
   */
  'aria-label'?: string;
  /** Same as `aria-label`, but referencing an existing visible label element's id instead of a literal string. Ignored if `label` is set. */
  'aria-labelledby'?: string;
  /** Explicit corner-squaring override, e.g. for a `<UIGroup>` member. See `<Button>`'s own identical prop for the general pattern. */
  squareCorners?: SquareCornerOption;
}

/**
 * The start/end fields + calendar-toggle button, and the `<Popup>`-hosted
 * range calendar -- split out to read `DateRangePickerStateContext`, the
 * same way `<DatePicker>` does (see its own comment on why Popup, not
 * React Aria's own Popover, hosts the calendar, and why it's anchored to
 * the whole field).
 */
const DateRangeFieldAndCalendar: React.FC<{ overrides?: Partial<DatePickerSliceState>; size: ControlSize; squareCorners?: SquareCornerOption }> = ({ overrides, size, squareCorners }) => {
  const state = useContext(DateRangePickerStateContext)!;
  const uiGroupSquareCorners = useUIGroupSquareCorners();
  const cornerOverrides = resolveSquareCorners(squareCorners ?? uiGroupSquareCorners);
  const range = state.dateRange;

  return (
    <Popup
      anchor={
        <Group style={fieldGroupStyle(size, cornerOverrides)}>
          <DateSegments size={size} slot="start" />
          <span aria-hidden="true" style={{ color: 'var(--ai-text-secondary, #6b7280)', fontSize: CONTROL_FONT_SIZE_VAR[size] }}>
            –
          </span>
          <DateSegments size={size} slot="end" />
          <CalendarPopupTrigger />
        </Group>
      }
      isOpen={state.isOpen}
      onOpenChange={open => state.setOpen(open)}
      zIndex={Z_INDEX.DROPDOWN}
    >
      <RangeCalendar
        value={range?.start && range?.end ? { start: range.start as CalendarDate, end: range.end as CalendarDate } : undefined}
        // Only closes. Committing the range is already wired: React Aria's
        // DateRangePicker provides a RangeCalendarContext whose onChange is
        // its own state.setDateRange, context flows through Popup's portal,
        // and RangeCalendar merges it with this handler. Calling
        // setDateRange here too committed twice, firing onChange and
        // daterangepicker:changed twice per pick (caught by a test).
        // Closing on a completed range is this component's own explicit
        // call, as in <DatePicker>: it doesn't use React Aria's Popover.
        onChange={() => state.setOpen(false)}
        overrides={overrides}
        size={size}
      />
    </Popup>
  );
};

/**
 * @manifest Start/end date fields + a range calendar popover, hosted in `<Popup>`, built on React Aria Components
 * @manifestCategory Form Controls
 * @manifestAntiPatternAvoid Pair two `<DatePicker>`s for a date range and hand-validate that the end isn't before the start
 * @manifestAntiPatternInstead Use `<DateRangePicker>` — one Form-bound `{ start, end }` value, with the calendar enforcing start/end ordering as you pick
 */
export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  name: propName,
  label,
  value: externalValue,
  defaultValue,
  onChange,
  minValue,
  maxValue,
  isDisabled: isDisabledProp = false,
  locale = 'en-US',
  overrides,
  size = 'md',
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  squareCorners,
}) => {
  const isDisabled = useFieldsetDisabled(isDisabledProp);
  const fieldCtx = useContext(FieldContext);
  const fieldName = propName || fieldCtx.name || '';
  const formContext = useOptionalFormContext();
  useInjectInteractionStyles();

  const formValue: CalendarDateRange | null | undefined =
    fieldName && formContext ? (formContext.values[fieldName] as CalendarDateRange | null | undefined) : undefined;
  // Controlled only when there's a live value source (an explicit `value`,
  // or a real Form ancestor), never merely because `defaultValue` was set --
  // see <DatePicker>/<TimeField>: otherwise the field freezes after its
  // first keyboard edit.
  const isControlled = externalValue !== undefined || !!(fieldName && formContext);
  const controlledValue = externalValue !== undefined ? externalValue : formValue !== undefined ? formValue : defaultValue;

  const handleChange = (val: { start: CalendarDate; end: CalendarDate } | null) => {
    const next = val ? { start: val.start, end: val.end } : null;
    if (fieldName && formContext) {
      formContext.setFieldValue(fieldName, next);
      formContext.setFieldTouched(fieldName, true);
    }
    onChange?.(next);
    aiBus.emit('daterangepicker:changed', { name: fieldName, value: next ? { start: next.start.toString(), end: next.end.toString() } : null });
  };

  return (
    <I18nProvider locale={locale}>
      <AriaDateRangePicker
        {...(isControlled ? { value: controlledValue ?? null } : { defaultValue: defaultValue ?? undefined })}
        onChange={val => handleChange(val as { start: CalendarDate; end: CalendarDate } | null)}
        granularity="day"
        minValue={minValue}
        maxValue={maxValue}
        isDisabled={isDisabled}
        shouldCloseOnSelect={false}
        aria-label={!label ? ariaLabel : undefined}
        aria-labelledby={!label ? ariaLabelledBy : undefined}
        className="ai-focus-ring"
        // Dimmed like the other disabled controls; React Aria marks it
        // disabled but draws nothing for it.
        style={isDisabled ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
      >
        {label && (
          <Label style={{ display: 'block', fontSize: CONTROL_FONT_SIZE_VAR[size], fontWeight: 'var(--ai-font-weight-semibold, 600)', marginBottom: '0.375rem', color: 'var(--ai-text-primary, #111827)' }}>
            {label}
          </Label>
        )}
        <DateRangeFieldAndCalendar overrides={overrides} size={size} squareCorners={squareCorners} />
      </AriaDateRangePicker>
    </I18nProvider>
  );
};
