import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CalendarDate } from '@internationalized/date';
import { DatePicker } from '../components/DatePicker/DatePicker';
import { Modal } from '../components/Overlay/Modal';
import { aiBus } from '../eventBus/eventBus';

function openCalendar() {
  fireEvent.click(screen.getByLabelText('Open calendar'));
}

function getDayCell(container: HTMLElement, day: number): HTMLElement {
  const cells = Array.from(container.querySelectorAll('[role="button"].react-aria-CalendarCell'));
  const match = cells.find(cell => cell.textContent === String(day));
  if (!match) throw new Error(`No visible day cell found for ${day}`);
  return match as HTMLElement;
}

describe('DatePicker', () => {
  it('renders a label and the calendar-toggle button, with the calendar closed by default', () => {
    render(<DatePicker name="meetingDate" label="Meeting date" />);
    expect(screen.getByText('Meeting date')).toBeInTheDocument();
    expect(screen.getByLabelText('Open calendar')).toBeInTheDocument();
    expect(document.querySelector('.react-aria-Calendar')).not.toBeInTheDocument();
  });

  it('opens the calendar via the toggle button, hosted in <Popup> (not a react-aria-components Popover)', () => {
    const { baseElement } = render(<DatePicker name="meetingDate" defaultValue={new CalendarDate(2026, 3, 15)} />);
    openCalendar();
    expect(document.querySelector('.react-aria-Calendar')).toBeInTheDocument();
    // Popup portals its content to the real document body via Radix's own
    // Popover.Portal -- confirms the calendar is actually inside *our*
    // overlay primitive's portal output, not react-aria-components' own.
    expect(baseElement.querySelector('[data-radix-popper-content-wrapper]')).toBeInTheDocument();
  });

  it('selects a date, closes the calendar, and calls onChange with a CalendarDate', () => {
    const onChange = vi.fn();
    render(<DatePicker name="meetingDate" defaultValue={new CalendarDate(2026, 3, 15)} onChange={onChange} />);
    openCalendar();

    const grid = document.querySelector('.react-aria-Calendar') as HTMLElement;
    fireEvent.click(getDayCell(grid, 20));

    expect(onChange).toHaveBeenCalled();
    const emitted = onChange.mock.calls[0][0];
    expect(emitted).toBeInstanceOf(CalendarDate);
    expect(emitted.day).toBe(20);
    expect(document.querySelector('.react-aria-Calendar')).not.toBeInTheDocument();
  });

  it('emits datepicker:changed with an ISO date string', () => {
    const changedFn = vi.fn();
    const unsub = aiBus.on('datepicker:changed', changedFn);
    render(<DatePicker name="meetingDate" defaultValue={new CalendarDate(2026, 3, 15)} />);
    openCalendar();
    const grid = document.querySelector('.react-aria-Calendar') as HTMLElement;
    fireEvent.click(getDayCell(grid, 20));
    expect(changedFn).toHaveBeenLastCalledWith({ name: 'meetingDate', value: '2026-03-20' });
    unsub();
  });

  // The doc's own Shell/Content acceptance test: open a DatePicker inside a
  // Modal, press Escape once, confirm only the calendar popover closes --
  // proving Popup (not react-aria-components' own Escape handling) owns
  // the calendar's dismissal, so it doesn't compound with Modal's.
  it('pressing Escape once with the calendar open closes only the calendar, not an enclosing Modal', () => {
    render(
      <Modal isOpen>
        <DatePicker name="meetingDate" defaultValue={new CalendarDate(2026, 3, 15)} />
      </Modal>
    );
    expect(screen.getByTestId('modal-container')).toBeInTheDocument();

    openCalendar();
    expect(document.querySelector('.react-aria-Calendar')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.querySelector('.react-aria-Calendar')).not.toBeInTheDocument();
    expect(screen.getByTestId('modal-container')).toBeInTheDocument();
  });

  it('disables dates outside minValue/maxValue', () => {
    render(
      <DatePicker
        name="meetingDate"
        defaultValue={new CalendarDate(2026, 3, 15)}
        minValue={new CalendarDate(2026, 3, 10)}
        maxValue={new CalendarDate(2026, 3, 20)}
      />
    );
    openCalendar();
    const grid = document.querySelector('.react-aria-Calendar') as HTMLElement;
    expect(getDayCell(grid, 25)).toHaveAttribute('aria-disabled', 'true');
  });

  it('applies aria-label when no visible label is given -- the gap that let React Aria log its own "you must specify an aria-label" warning', () => {
    render(<DatePicker name="meetingDate" aria-label="Meeting date" />);
    expect(document.querySelector('[aria-label="Meeting date"]')).toBeInTheDocument();
    expect(screen.queryByText('Meeting date')).not.toBeInTheDocument(); // no visible <Label> rendered
  });

  it('ignores aria-label once a visible label is set, so the two can never disagree', () => {
    render(<DatePicker name="meetingDate" label="Meeting date" aria-label="Something else" />);
    expect(document.querySelector('[aria-label="Something else"]')).not.toBeInTheDocument();
  });
});
