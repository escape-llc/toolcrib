import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CalendarDate } from '@internationalized/date';
import { Calendar } from '../components/DatePicker/Calendar';
import { aiBus } from '../eventBus/eventBus';

// React Aria Components renders each day as a real `role="button"` cell
// whose accessible name is the full formatted date ("Sunday, March 15,
// 2026[, selected]"), not the bare day number -- so "day 15" has to be
// found by the cell's own textContent (just "15"), not a getByRole name
// match, which could ambiguously match other digits in the full label
// (e.g. the year). Selection/disabled state are React Aria's own
// `data-selected`/`aria-disabled` attributes (confirmed directly against
// the rendered DOM), not Radix's `data-state` convention used elsewhere
// in this toolkit -- exactly the distinction the hand-off doc's own CSS/
// animation note warns about.
function getDayCell(container: HTMLElement, day: number): HTMLElement {
  const cells = Array.from(container.querySelectorAll('[role="button"].react-aria-CalendarCell'));
  const match = cells.find(cell => cell.textContent === String(day));
  if (!match) throw new Error(`No visible day cell found for ${day}`);
  return match as HTMLElement;
}

describe('Calendar', () => {
  it('renders the given month and marks the selected date', () => {
    const { container } = render(<Calendar name="meetingDate" value={new CalendarDate(2026, 3, 15)} />);
    expect(getDayCell(container, 15)).toHaveAttribute('data-selected', 'true');
  });

  it('selects a date via click and calls onChange with a CalendarDate, not a raw Date', () => {
    const onChange = vi.fn();
    const { container } = render(<Calendar name="meetingDate" defaultValue={new CalendarDate(2026, 3, 15)} onChange={onChange} />);
    fireEvent.click(getDayCell(container, 20));
    expect(onChange).toHaveBeenCalled();
    const emitted = onChange.mock.calls[0][0];
    expect(emitted).toBeInstanceOf(CalendarDate);
    expect(emitted.day).toBe(20);
  });

  it('emits calendar:changed with an ISO date string', () => {
    const changedFn = vi.fn();
    const unsub = aiBus.on('calendar:changed', changedFn);
    const { container } = render(<Calendar name="meetingDate" defaultValue={new CalendarDate(2026, 3, 15)} />);
    fireEvent.click(getDayCell(container, 20));
    expect(changedFn).toHaveBeenLastCalledWith({ name: 'meetingDate', value: '2026-03-20' });
    unsub();
  });

  it('navigates to the next/previous month via the header buttons', () => {
    render(<Calendar name="meetingDate" defaultValue={new CalendarDate(2026, 3, 15)} />);
    expect(screen.getAllByText('March 2026').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByLabelText('Next month'));
    expect(screen.getAllByText('April 2026').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByLabelText('Previous month'));
    fireEvent.click(screen.getByLabelText('Previous month'));
    expect(screen.getAllByText('February 2026').length).toBeGreaterThan(0);
  });

  it('disables dates outside minValue/maxValue', () => {
    const { container } = render(
      <Calendar
        name="meetingDate"
        defaultValue={new CalendarDate(2026, 3, 15)}
        minValue={new CalendarDate(2026, 3, 10)}
        maxValue={new CalendarDate(2026, 3, 20)}
      />
    );
    expect(getDayCell(container, 5)).toHaveAttribute('aria-disabled', 'true');
    expect(getDayCell(container, 15)).not.toHaveAttribute('aria-disabled');
    expect(getDayCell(container, 25)).toHaveAttribute('aria-disabled', 'true');
  });

  it('correctly handles a month/year boundary crossing (Dec 31 -> Jan 1) and a leap-year Feb 29', () => {
    render(<Calendar name="d" defaultValue={new CalendarDate(2025, 12, 31)} />);
    fireEvent.click(screen.getByLabelText('Next month'));
    expect(screen.getAllByText('January 2026').length).toBeGreaterThan(0);

    // 2028 is a leap year -- Feb should show a 29th.
    const { container } = render(<Calendar name="d2" defaultValue={new CalendarDate(2028, 2, 1)} />);
    expect(() => getDayCell(container, 29)).not.toThrow();
  });

  it('flips the week-start day for a non-US locale (en-US starts Sunday, en-GB starts Monday)', () => {
    const { container: us } = render(<Calendar name="d" defaultValue={new CalendarDate(2026, 3, 15)} locale="en-US" />);
    const usFirstHeader = us.querySelector('th')?.textContent;

    const { container: gb } = render(<Calendar name="d" defaultValue={new CalendarDate(2026, 3, 15)} locale="en-GB" />);
    const gbFirstHeader = gb.querySelector('th')?.textContent;

    // Confirms the locale prop actually reaches react-aria's own
    // week-start logic, not just decorative heading text.
    expect(usFirstHeader).toBe('S');
    expect(gbFirstHeader).toBe('M');
  });
});
