import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { CalendarDate } from '@internationalized/date';
import { RangeCalendar } from '../components/DatePicker/RangeCalendar';
import { aiBus } from '../eventBus/eventBus';
import { axe } from './testUtils/axe';

// Same helper as DatePicker.test.tsx: a React Aria cell's accessible name is
// the full formatted date, so match the visible day number on the cell
// element instead (see AGENTS.md's React Aria Components testing notes).
function getDayCell(container: HTMLElement, day: number): HTMLElement {
  const cells = Array.from(container.querySelectorAll('[role="button"].react-aria-CalendarCell'));
  const match = cells.find(cell => cell.textContent === String(day) && cell.getAttribute('data-outside-month') === null);
  if (!match) throw new Error(`No in-month day cell found for ${day}`);
  return match as HTMLElement;
}

const MARCH_15 = new CalendarDate(2026, 3, 15);

describe('RangeCalendar', () => {
  it('selects a range with two clicks and reports it as CalendarDates', () => {
    const onChange = vi.fn();
    const { container } = render(
      <RangeCalendar aria-label="Trip" defaultValue={{ start: MARCH_15, end: MARCH_15 }} onChange={onChange} />
    );
    fireEvent.click(getDayCell(container, 10));
    expect(onChange).not.toHaveBeenCalled(); // the first click only anchors the range
    fireEvent.click(getDayCell(container, 14));

    expect(onChange).toHaveBeenCalledTimes(1);
    const { start, end } = onChange.mock.calls[0][0];
    expect(start).toBeInstanceOf(CalendarDate);
    expect(start.toString()).toBe('2026-03-10');
    expect(end.toString()).toBe('2026-03-14');
  });

  it('orders the range even when the end is clicked before the start', () => {
    const onChange = vi.fn();
    const { container } = render(<RangeCalendar aria-label="Trip" defaultValue={{ start: MARCH_15, end: MARCH_15 }} onChange={onChange} />);
    fireEvent.click(getDayCell(container, 20));
    fireEvent.click(getDayCell(container, 12));
    const { start, end } = onChange.mock.calls[0][0];
    expect([start.toString(), end.toString()]).toEqual(['2026-03-12', '2026-03-20']);
  });

  it('selects a range from the keyboard: Enter, arrows, Enter', async () => {
    const onChange = vi.fn();
    const { container } = render(<RangeCalendar aria-label="Trip" defaultValue={{ start: MARCH_15, end: MARCH_15 }} onChange={onChange} />);
    const start = getDayCell(container, 15);
    act(() => {
      start.focus();
      fireEvent.keyDown(start, { key: 'Enter' });
      fireEvent.keyUp(start, { key: 'Enter' });
    });
    act(() => {
      fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    });
    act(() => {
      fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    });
    // The contract: the range runs from the day Enter anchored to whichever
    // day has focus at the second Enter. (Counting arrow presses isn't: in
    // jsdom React Aria also advances focus one day on the first Enter's
    // keyup -- confirmed with a probe -- so the exact end day is its
    // implementation detail, not this component's.)
    const endDay = Number((document.activeElement as HTMLElement).textContent);
    expect(endDay).toBeGreaterThan(15);
    act(() => {
      fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
      fireEvent.keyUp(document.activeElement!, { key: 'Enter' });
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    const range = onChange.mock.calls[0][0];
    expect(range.start.toString()).toBe('2026-03-15');
    expect(range.end.day).toBe(endDay);
    await act(async () => {}); // flush React Aria's own post-mount effects (AGENTS.md act() case 2)
  });

  it('emits rangecalendar:changed with ISO date strings', () => {
    const handler = vi.fn();
    const unsub = aiBus.on('rangecalendar:changed', handler);
    const { container } = render(<RangeCalendar name="trip" aria-label="Trip" defaultValue={{ start: MARCH_15, end: MARCH_15 }} />);
    fireEvent.click(getDayCell(container, 3));
    fireEvent.click(getDayCell(container, 5));
    expect(handler).toHaveBeenCalledWith({ name: 'trip', value: { start: '2026-03-03', end: '2026-03-05' } });
    unsub();
  });

  it('fills the two endpoints with primary and tints only the days between', () => {
    const { container } = render(
      <RangeCalendar aria-label="Trip" value={{ start: new CalendarDate(2026, 3, 10), end: new CalendarDate(2026, 3, 13) }} />
    );
    for (const endpoint of [10, 13]) {
      expect(getDayCell(container, endpoint).style.background).toContain('--ai-color-primary');
    }
    for (const between of [11, 12]) {
      expect(getDayCell(container, between).style.background).toContain('--ai-bg-container');
    }
    expect(getDayCell(container, 14).style.background).toBe('transparent');
  });

  it('disables dates outside minValue/maxValue', () => {
    const { container } = render(
      <RangeCalendar
        aria-label="Trip"
        defaultValue={{ start: MARCH_15, end: MARCH_15 }}
        minValue={new CalendarDate(2026, 3, 10)}
        maxValue={new CalendarDate(2026, 3, 20)}
      />
    );
    expect(getDayCell(container, 25)).toHaveAttribute('aria-disabled', 'true');
  });

  it('has no axe violations', async () => {
    const { container } = render(<RangeCalendar aria-label="Trip" defaultValue={{ start: MARCH_15, end: new CalendarDate(2026, 3, 18) }} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
