'use client';

import React from 'react';
import {
  CalendarGrid,
  CalendarGridHeader,
  CalendarGridBody,
  CalendarHeaderCell,
  CalendarCell,
  CalendarHeading,
  Button,
} from 'react-aria-components/Calendar';
import { DateInput, DateSegment } from 'react-aria-components/DatePicker';
import { CONTROL_FONT_SIZE_VAR, resolveControlPadding, type ControlSize } from '../../theme/controlSize';
import { useLocaleStrings } from '../Locale/LocaleContext';
import { Popup } from '../Overlay/Popup';

// The field pieces shared by <DatePicker> and <DateRangePicker>: the
// bordered group's style, a date's editable segments, and the button that
// opens the calendar popup.

/** The bordered field group around the segments and the calendar button. `cornerOverrides` squares corners (UIGroup, `squareCorners`). */
export function fieldGroupStyle(size: ControlSize, cornerOverrides: React.CSSProperties): React.CSSProperties {
  return {
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
  };
}

/** One date's editable month/day/year segments. `slot` picks the start or end date inside a `<DateRangePicker>`. */
export const DateSegments: React.FC<{ size: ControlSize; slot?: 'start' | 'end' }> = ({ size, slot }) => (
  <DateInput slot={slot} style={{ display: 'flex', fontSize: CONTROL_FONT_SIZE_VAR[size] }}>
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
);

/**
 * The calendar-glyph button that opens the popup. Only this button toggles
 * it -- wrapping the segments too would mean clicking into a segment to
 * type a value could also toggle the calendar, which isn't how a date
 * picker is supposed to behave: typing edits the value, only the button
 * opens the calendar.
 */
export const CalendarPopupTrigger: React.FC = () => (
  <Popup.Trigger>
    <button
      type="button"
      aria-label="Open calendar"
      // ai-focus-ring was missing here -- reported directly: Tab correctly
      // moves focus onto this button (confirmed via a real browser trace,
      // both Chromium and WebKit), but `all: 'unset'` resets outline to its
      // initial (invisible) value with nothing to replace it, so a keyboard
      // user tabbing here saw no focus indicator at all -- indistinguishable
      // from "Tab doesn't reach it," which is exactly how it was reported.
      className="ai-focus-ring"
      style={{ all: 'unset', cursor: 'pointer', color: 'var(--ai-text-secondary, #6b7280)', display: 'flex' }}
      // Issue #501: this button relies on the browser's own native
      // Enter/Space -> click translation to open the calendar (via Radix's
      // Trigger onClick) -- there's no explicit click handler here at all.
      // But this button lives inside the field's <Group>, and React Aria's
      // own useDatePickerGroup attaches a usePress instance to that Group
      // solely to run focusLast() on a mouse/touch/pen press. usePress's
      // internal keydown handler unconditionally calls preventDefault() for
      // Enter/Space on ANY descendant keydown that bubbles up to it (not
      // just presses on the Group itself), even though its own
      // onPress/onPressStart are no-ops for pointerType 'keyboard' -- so the
      // ancestor Group silently swallows this button's native keyboard
      // activation before the browser ever fires the click, and the
      // calendar never opens via Enter/Space (confirmed: a real mouse click
      // works fine, since that's a separate native click event this bug
      // never touches). Can't patch react-aria's own useDatePickerGroup, so
      // intercept here instead: stopPropagation() alone keeps the keydown
      // from ever reaching the Group's handler -- deliberately NOT also
      // calling preventDefault()/.click() ourselves (an earlier version of
      // this fix did, and a Gemini PR review correctly caught that it forced
      // Space to activate on keydown instead of keyup, breaking the standard
      // "move focus away before releasing to cancel" affordance). With
      // propagation stopped before the Group ever sees it, nothing prevents
      // the event's default action, so the browser's own native
      // keyboard-to-click translation runs unmodified -- Enter on keydown,
      // Space on keyup, exactly as it would if the Group's usePress didn't
      // exist.
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.stopPropagation();
        }
      }}
    >
      📅
    </button>
  </Popup.Trigger>
);

// The month header and day grid shared by <Calendar> and <RangeCalendar>
// (issue #607). React Aria's CalendarGrid/CalendarCell read whichever
// calendar they sit inside from context, so the same markup serves a
// single-date calendar and a range calendar; only the cell styling differs.

const NAV_BUTTON_STYLE: React.CSSProperties = {
  all: 'unset',
  cursor: 'pointer',
  padding: '0.25rem 0.5rem',
  borderRadius: 'var(--ai-radius-sm, 0.25rem)',
  color: 'var(--ai-text-secondary, #6b7280)',
};

/** Previous/next month buttons around the month heading. */
export const CalendarNav: React.FC<{ size: ControlSize }> = ({ size }) => {
  const strings = useLocaleStrings().calendar;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
      <Button slot="previous" className="ai-btn" aria-label={strings.previousMonth} style={NAV_BUTTON_STYLE}>
        ◀
      </Button>
      <CalendarHeading style={{ fontWeight: 'var(--ai-font-weight-semibold, 600)', fontSize: CONTROL_FONT_SIZE_VAR[size], color: 'var(--ai-text-primary, #111827)' }} />
      <Button slot="next" className="ai-btn" aria-label={strings.nextMonth} style={NAV_BUTTON_STYLE}>
        ▶
      </Button>
    </div>
  );
};

/**
 * The day grid. `range` styles a selected span: the two endpoints get the
 * primary fill (selection identity stays primary everywhere, AGENTS.md's
 * color bucket 1) and the days between get a neutral container tint --
 * a plain palette value rather than a color-mix() of primary, which axe's
 * contrast checker can't parse (see accessibility.spec.ts).
 */
export const CalendarMonthGrid: React.FC<{ range?: boolean }> = ({ range = false }) => (
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
          style={({ isSelected, isSelectionStart, isSelectionEnd, isToday, isDisabled: cellDisabled, isOutsideMonth, isUnavailable }) => {
            // In a range, only the endpoints are "filled"; the span between
            // them is tinted. A single-date calendar's selection is always
            // its own endpoint.
            const isEndpoint = isSelected && (!range || isSelectionStart || isSelectionEnd);
            const isInSpan = range && isSelected && !isEndpoint;
            return {
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
              background: isEndpoint ? 'var(--ai-color-primary, #3b82f6)' : isInSpan ? 'var(--ai-bg-container, #f3f4f6)' : 'transparent',
              // --ai-color-on-primary was never actually a real variable
              // (paletteToCSSVariables only ever defined
              // --ai-color-primary-text) -- this always fell back to its
              // hardcoded #ffffff default, silently skipping the theme's
              // real WCAG-computed text color for a bright/high-luminance
              // primary hue. Fixed to the real variable.
              color: isEndpoint ? 'var(--ai-color-primary-text, #ffffff)' : 'var(--ai-text-primary, #111827)',
              // Issue #402: quaternary, not primary, for "today" -- "today"
              // and "selected" are already two different concepts (a ring
              // vs. a fill); giving them two distinct colors makes that
              // existing distinction clearer instead of using the same hue
              // for both. The selected date's own background above is
              // untouched -- selection identity stays primary everywhere.
              border: isToday && !isEndpoint ? '0.0625rem solid var(--ai-color-quaternary, #f97316)' : '0.0625rem solid transparent',
            };
          }}
        />
      )}
    </CalendarGridBody>
  </CalendarGrid>
);
