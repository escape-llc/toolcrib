import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Time } from '@internationalized/date';
import { TimeField } from '../components/DatePicker/TimeField';
import { aiBus } from '../eventBus/eventBus';

describe('TimeField', () => {
  it('renders a label and editable segments', () => {
    render(<TimeField name="startTime" label="Start time" />);
    expect(screen.getByText('Start time')).toBeInTheDocument();
    // Segmented input: hour/minute segments render as individually focusable spinbuttons.
    expect(screen.getAllByRole('spinbutton').length).toBeGreaterThanOrEqual(2);
  });

  it('renders a controlled value into its segments', () => {
    render(<TimeField name="startTime" value={new Time(14, 30)} />);
    const hour = screen.getAllByRole('spinbutton')[0];
    // 12-hour default locale display -- 14:30 is 2 PM.
    expect(hour).toHaveTextContent('2');
  });

  it('calls onChange and emits timefield:changed when a segment is edited via the keyboard', () => {
    const onChange = vi.fn();
    const changedFn = vi.fn();
    const unsub = aiBus.on('timefield:changed', changedFn);

    render(<TimeField name="startTime" defaultValue={new Time(9, 0)} onChange={onChange} />);
    const hour = screen.getAllByRole('spinbutton')[0];
    hour.focus();
    fireEvent.keyDown(hour, { key: 'ArrowUp' });

    expect(onChange).toHaveBeenCalled();
    const emitted = onChange.mock.calls[0][0] as Time;
    expect(emitted.hour).toBe(10);
    expect(changedFn).toHaveBeenLastCalledWith({ name: 'startTime', value: emitted.toString() });

    unsub();
  });

  it('is disabled when isDisabled is set', () => {
    render(<TimeField name="startTime" isDisabled defaultValue={new Time(9, 0)} />);
    const hour = screen.getAllByRole('spinbutton')[0];
    expect(hour).toHaveAttribute('aria-disabled', 'true');
  });
});
