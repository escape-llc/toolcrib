import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { z } from 'zod';
import { CalendarDate } from '@internationalized/date';
import { DateRangePicker } from '../components/DatePicker/DateRangePicker';
import { Form } from '../components/Form/FormContext';
import { FormField, SubmitButton } from '../components/Form/FormComponents';
import { Modal } from '../components/Overlay/Modal';
import { UIGroup } from '../components/UIGroup/UIGroup';
import { aiBus } from '../eventBus/eventBus';
import { axe } from './testUtils/axe';

const MARCH = { start: new CalendarDate(2026, 3, 15), end: new CalendarDate(2026, 3, 18) };

function openCalendar() {
  fireEvent.click(screen.getByLabelText('Open calendar'));
}

function calendar(): HTMLElement {
  const el = document.querySelector('.react-aria-RangeCalendar');
  if (!el) throw new Error('range calendar is not open');
  return el as HTMLElement;
}

// See DatePicker.test.tsx: match the visible day number, in-month only.
function getDayCell(container: HTMLElement, day: number): HTMLElement {
  const cells = Array.from(container.querySelectorAll('[role="button"].react-aria-CalendarCell'));
  const match = cells.find(cell => cell.textContent === String(day) && cell.getAttribute('data-outside-month') === null);
  if (!match) throw new Error(`No in-month day cell found for ${day}`);
  return match as HTMLElement;
}

/** The [start, end] "day" segments' displayed text. */
function daySegments(): string[] {
  return Array.from(document.querySelectorAll('[data-type="day"]')).map(el => el.textContent ?? '');
}

describe('DateRangePicker', () => {
  it('renders start and end fields and the calendar toggle, with the calendar closed', () => {
    render(<DateRangePicker label="Trip dates" defaultValue={MARCH} />);
    expect(screen.getByText('Trip dates')).toBeInTheDocument();
    expect(daySegments()).toEqual(['15', '18']);
    expect(screen.getByLabelText('Open calendar').className).toContain('ai-focus-ring');
    expect(document.querySelector('.react-aria-RangeCalendar')).not.toBeInTheDocument();
  });

  it('opens a range calendar hosted in <Popup>, picks a range, closes, and updates both fields', () => {
    const onChange = vi.fn();
    const { baseElement } = render(<DateRangePicker aria-label="Trip dates" defaultValue={MARCH} onChange={onChange} />);
    openCalendar();
    expect(baseElement.querySelector('[data-radix-popper-content-wrapper]')).toBeInTheDocument();

    fireEvent.click(getDayCell(calendar(), 3));
    fireEvent.click(getDayCell(calendar(), 7));

    // Exactly once: React Aria's own context already commits the range, and
    // committing it again from our handler used to fire this twice.
    expect(onChange).toHaveBeenCalledTimes(1);
    const { start, end } = onChange.mock.calls[0][0];
    expect(start).toBeInstanceOf(CalendarDate);
    expect([start.toString(), end.toString()]).toEqual(['2026-03-03', '2026-03-07']);
    expect(document.querySelector('.react-aria-RangeCalendar')).not.toBeInTheDocument();
    expect(daySegments()).toEqual(['3', '7']);
  });

  // Same regression as DatePicker's: with only defaultValue (no Form, no
  // value prop), the field must stay uncontrolled or a keyboard edit snaps
  // straight back.
  it('is keyboard-editable via its segments when only defaultValue is set', () => {
    render(<DateRangePicker aria-label="Trip dates" defaultValue={MARCH} />);
    const [, endDay] = Array.from(document.querySelectorAll('[data-type="day"]')) as HTMLElement[];
    act(() => {
      endDay.focus();
      fireEvent.keyDown(endDay, { key: 'ArrowUp' });
    });
    expect(daySegments()).toEqual(['15', '19']);
  });

  it('emits daterangepicker:changed with ISO date strings', () => {
    const handler = vi.fn();
    const unsub = aiBus.on('daterangepicker:changed', handler);
    render(<DateRangePicker name="trip" aria-label="Trip dates" defaultValue={MARCH} />);
    openCalendar();
    fireEvent.click(getDayCell(calendar(), 20));
    fireEvent.click(getDayCell(calendar(), 22));
    expect(handler).toHaveBeenLastCalledWith({ name: 'trip', value: { start: '2026-03-20', end: '2026-03-22' } });
    unsub();
  });

  it('binds to a Form: the picked range is the field value, and onSubmit receives it', async () => {
    const onSubmit = vi.fn();
    const schema = z.object({ trip: z.object({ start: z.instanceof(CalendarDate), end: z.instanceof(CalendarDate) }) });
    render(
      <Form schema={schema} onSubmit={onSubmit}>
        <FormField name="trip" label="Trip dates">
          <DateRangePicker aria-label="Trip dates" />
        </FormField>
        <SubmitButton>Save</SubmitButton>
      </Form>
    );
    openCalendar();
    // Empty Form value -> the calendar opens on today's month; pick two days in it.
    fireEvent.click(getDayCell(calendar(), 10));
    fireEvent.click(getDayCell(calendar(), 12));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const { trip } = onSubmit.mock.calls[0][0];
    expect(trip.start).toBeInstanceOf(CalendarDate);
    expect([trip.start.day, trip.end.day]).toEqual([10, 12]);
  });

  it('pressing Escape with the calendar open closes only the calendar, not an enclosing Modal', () => {
    render(
      <Modal isOpen>
        <DateRangePicker aria-label="Trip dates" defaultValue={MARCH} />
      </Modal>
    );
    openCalendar();
    expect(document.querySelector('.react-aria-RangeCalendar')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.querySelector('.react-aria-RangeCalendar')).not.toBeInTheDocument();
    expect(screen.getByTestId('modal-container')).toBeInTheDocument();
  });

  it('squares its field group corners as a leading UIGroup member', () => {
    render(
      <UIGroup>
        <DateRangePicker aria-label="Trip dates" />
        <button>Clear</button>
      </UIGroup>
    );
    const group = document.querySelector('.react-aria-Group') as HTMLElement;
    expect(group.style.borderTopRightRadius).toBe('0px');
    expect(group.style.borderTopLeftRadius).not.toBe('0px');
  });

  it('has no axe violations, closed or with the calendar open', async () => {
    const { container, baseElement } = render(<DateRangePicker label="Trip dates" defaultValue={MARCH} />);
    expect(await axe(container)).toHaveNoViolations();
    openCalendar();
    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
