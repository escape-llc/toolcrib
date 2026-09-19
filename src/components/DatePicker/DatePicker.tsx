'use client';

import React, { type ReactNode, useContext } from 'react';
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
import { type SquareCornerOption, resolveSquareCorners } from '../Card/Card';
import { useUIGroupSquareCorners } from '../UIGroup/UIGroupContext';
import { type DatePickerSliceState } from './DatePickerSlice';
import { CONTROL_FONT_SIZE_VAR, resolveControlPadding, type ControlSize } from '../../theme/controlSize';

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
  /** Control size, standardized with `<Button>` and every other sized control so instances line up in a `<UIGroup>` row. @default 'md' */
  size?: ControlSize;
  /**
   * Accessible name for the field, for a caller that already shows a
   * visible label some other way (e.g. `<FormField label="...">`'s own
   * rendered label, which the field's composite date-segment structure
   * can't associate via a plain `htmlFor` the way a single `<input id>`
   * can) and doesn't want `label` above rendering a second, visually
   * duplicate one. Ignored if `label` is set — that already supplies an
   * accessible name via React Aria's own `<Label>`. Required for a
   * meaningful accessible name unless `aria-labelledby` or `label` is
   * given instead — without any of the three, React Aria's own
   * `useDatePicker` warns and the field has none at all.
   */
  'aria-label'?: string;
  /** Same as `aria-label`, but referencing an existing visible label element's id instead of a literal string. Ignored if `label` is set. */
  'aria-labelledby'?: string;
  /** Explicit corner-squaring override, e.g. for a `<UIGroup>` member. See `<Button>`'s own identical prop for the general pattern. */
  squareCorners?: SquareCornerOption;
}

/**
 * The typed field + calendar-toggle button, and the `<Popup>`-hosted
 * calendar itself -- split out so it can read `DatePickerStateContext`
 * (only available *inside* `<DatePicker>`, not from the props this
 * component's caller has direct access to).
 */
const DatePickerFieldAndCalendar: React.FC<{ overrides?: Partial<DatePickerSliceState>; size: ControlSize; squareCorners?: SquareCornerOption }> = ({ overrides, size, squareCorners }) => {
  const state = useContext(DatePickerStateContext)!;
  const uiGroupSquareCorners = useUIGroupSquareCorners();
  const cornerOverrides = resolveSquareCorners(squareCorners ?? uiGroupSquareCorners);

  // isOpen/onOpenChange are wired directly to DatePickerState, not Popup's
  // own internal open state -- this is the actual Shell/Content
  // decoupling: React Aria's hook logic still owns whether the picker
  // *should* be open (triggered by the calendar button's press, or by
  // keyboard interaction with the field), but Popup -- not React Aria's
  // own Popover -- is the one thing that ever mounts a portal, traps
  // focus, or handles Escape for the calendar surface.
  //
  // `anchor` (issue #502), not `trigger` -- positions the popup against
  // the WHOLE field's edge, matching every other connected popover in the
  // toolkit (Combobox's own dropdown, e.g.), while only the small
  // calendar-glyph button (wrapped in <Popup.Trigger>, nested inside the
  // Group below) actually opens/closes it. A single `trigger={<button>}`
  // anchored the popup to just that small glyph instead, positioned well
  // off the field's own edge -- reported directly. Using a REAL anchored
  // DOM node (the Group itself, always rendered) rather than Popup's
  // earlier-tried `anchorRef`/`virtualRef` design sidesteps a real,
  // confirmed Radix `virtualRef` timing gap (see Popup.tsx's own comment
  // on why `anchor` mode exists) entirely -- there's no separate
  // registration to race here.
  return (
    <Popup
      anchor={
        <Group
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: resolveControlPadding(size, 'var(--ai-input-padding, 0.5rem 0.75rem)'),
            border: '0.0625rem solid var(--ai-border, #d1d5db)',
            borderTopLeftRadius: 'var(--ai-radius-md, 0.375rem)',
            borderTopRightRadius: 'var(--ai-radius-md, 0.375rem)',
            borderBottomLeftRadius: 'var(--ai-radius-md, 0.375rem)',
            borderBottomRightRadius: 'var(--ai-radius-md, 0.375rem)',
            background: 'var(--ai-bg-surface, #ffffff)',
            width: 'fit-content',
            ...cornerOverrides,
          }}
        >
          <DateInput style={{ display: 'flex', fontSize: CONTROL_FONT_SIZE_VAR[size] }}>
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
            Popup.Trigger, not the whole Group -- wrapping the segments
            too would mean clicking into a segment to type a value could
            also toggle the calendar open/closed, which isn't how a date
            picker is supposed to behave -- typing edits the value, only
            the button opens the calendar.
          */}
          <Popup.Trigger>
            <button
              type="button"
              aria-label="Open calendar"
              // ai-focus-ring was missing here -- reported directly: Tab
              // correctly moves focus onto this button (confirmed via a real
              // browser trace, both Chromium and WebKit), but `all: 'unset'`
              // resets outline to its initial (invisible) value with nothing
              // to replace it, so a keyboard user tabbing here saw no focus
              // indicator at all -- indistinguishable from "Tab doesn't reach
              // it," which is exactly how it was reported.
              className="ai-focus-ring"
              style={{ all: 'unset', cursor: 'pointer', color: 'var(--ai-text-secondary, #6b7280)', display: 'flex' }}
              // Issue #501: this button relies on the browser's own native
              // Enter/Space -> click translation to open the calendar (via
              // Radix's Trigger onClick) -- there's no explicit click
              // handler here at all. But this button lives inside the
              // <Group> above, and React Aria's own useDatePickerGroup
              // attaches a usePress instance to that Group solely to run
              // focusLast() on a mouse/touch/pen press. usePress's internal
              // keydown handler unconditionally calls preventDefault() for
              // Enter/Space on ANY descendant keydown that bubbles up to it
              // (not just presses on the Group itself), even though its own
              // onPress/onPressStart are no-ops for pointerType 'keyboard' --
              // so the ancestor Group silently swallows this button's native
              // keyboard activation before the browser ever fires the click,
              // and the calendar never opens via Enter/Space (confirmed: a
              // real mouse click works fine, since that's a separate native
              // click event this bug never touches). Can't patch
              // react-aria's own useDatePickerGroup, so intercept here
              // instead: stopPropagation() alone keeps the keydown from
              // ever reaching the Group's handler -- deliberately NOT also
              // calling preventDefault()/.click() ourselves (an earlier
              // version of this fix did, and a Gemini PR review correctly
              // caught that it forced Space to activate on keydown instead
              // of keyup, breaking the standard "move focus away before
              // releasing to cancel" affordance). With propagation stopped
              // before the Group ever sees it, nothing prevents the
              // event's default action, so the browser's own native
              // keyboard-to-click translation runs unmodified -- Enter on
              // keydown, Space on keyup, exactly as it would if the Group's
              // usePress didn't exist.
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                }
              }}
            >
              📅
            </button>
          </Popup.Trigger>
        </Group>
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
        size={size}
      />
    </Popup>
  );
};

/**
 * @manifest Date field + calendar popover, hosted in `<Popup>` (not React Aria's own popover), built on React Aria Components
 * @manifestCategory Form Controls
 * @manifestAntiPatternAvoid Hand-roll a date-field + calendar popover, or pass a raw JS `Date` into a custom date input
 * @manifestAntiPatternInstead Use `<DatePicker>` with an `@internationalized/date` `CalendarDate` value — timezone/DST/locale correctness is exactly what that dependency exists to guarantee
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
  size = 'md',
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  squareCorners,
}) => {
  const fieldCtx = useContext(FieldContext);
  const fieldName = propName || fieldCtx.name || '';
  const formContext = useOptionalFormContext();
  useInjectInteractionStyles();

  const formValue: CalendarDate | null | undefined =
    fieldName && formContext ? (formContext.values[fieldName] as CalendarDate | null | undefined) : undefined;
  // See TimeField's identical comment -- controlled only when there's a
  // live value source (an explicit `value` prop, or a real Form ancestor),
  // never merely because `defaultValue` was set, or the field freezes
  // after its first keyboard edit.
  const isControlled = externalValue !== undefined || !!(fieldName && formContext);
  const controlledValue = externalValue !== undefined ? externalValue : formValue !== undefined ? formValue : defaultValue;

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
        {...(isControlled ? { value: controlledValue ?? null } : { defaultValue: defaultValue ?? undefined })}
        onChange={handleChange}
        granularity="day"
        minValue={minValue}
        maxValue={maxValue}
        isDisabled={isDisabled}
        shouldCloseOnSelect={false}
        aria-label={!label ? ariaLabel : undefined}
        aria-labelledby={!label ? ariaLabelledBy : undefined}
        className="ai-focus-ring"
      >
        {label && (
          <Label style={{ display: 'block', fontSize: CONTROL_FONT_SIZE_VAR[size], fontWeight: 'var(--ai-font-weight-semibold, 600)', marginBottom: '0.375rem', color: 'var(--ai-text-primary, #111827)' }}>
            {label}
          </Label>
        )}
        <DatePickerFieldAndCalendar overrides={overrides} size={size} squareCorners={squareCorners} />
      </AriaDatePicker>
    </I18nProvider>
  );
};
