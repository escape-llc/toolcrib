import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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

  it('renders a controlled value into its segments', async () => {
    render(<TimeField name="startTime" aria-label="Start time" value={new Time(14, 30)} />);
    const hour = screen.getAllByRole('spinbutton')[0];
    // 12-hour default locale display -- 14:30 is 2 PM.
    expect(hour).toHaveTextContent('2');
    // react-aria-components' DateSegment/Group internals schedule their own
    // follow-up state update on mount, landing on a microtask after this
    // test's synchronous render/assertion block — flush it here so it
    // doesn't leak an "update not wrapped in act" warning past this test.
    await act(async () => {});
  });

  it('calls onChange and emits timefield:changed when a segment is edited via the keyboard', async () => {
    const onChange = vi.fn();
    const changedFn = vi.fn();
    const unsub = aiBus.on('timefield:changed', changedFn);

    render(<TimeField name="startTime" aria-label="Start time" defaultValue={new Time(9, 0)} onChange={onChange} />);
    const hour = screen.getAllByRole('spinbutton')[0];
    // `.focus()` is a raw DOM call, not one of RTL's own APIs -- unlike
    // `render`/`fireEvent`, it is NOT auto-wrapped in `act()`. react-aria's
    // focus-tracking hooks (shared ambient focus-visible/focus-within state
    // across the whole segment group) update synchronously in response to
    // it, which is exactly what produced 4 separate "not wrapped in act"
    // warnings here -- confirmed by the fact that escalating `setTimeout`-
    // based flushes afterward did nothing (the update wasn't deferred at
    // all, it just wasn't wrapped in the first place). `fireEvent.keyDown`
    // itself IS already act-wrapped internally by RTL, but needs to be
    // inside the same act() as the preceding focus() to avoid a second,
    // separate unwrapped-update warning from focus changing between them.
    act(() => {
      hour.focus();
      fireEvent.keyDown(hour, { key: 'ArrowUp' });
    });

    expect(onChange).toHaveBeenCalled();
    const emitted = onChange.mock.calls[0][0] as Time;
    expect(emitted.hour).toBe(10);
    expect(changedFn).toHaveBeenLastCalledWith({ name: 'startTime', value: emitted.toString() });

    unsub();
  });

  it('is disabled when isDisabled is set', async () => {
    render(<TimeField name="startTime" aria-label="Start time" isDisabled defaultValue={new Time(9, 0)} />);
    const hour = screen.getAllByRole('spinbutton')[0];
    expect(hour).toHaveAttribute('aria-disabled', 'true');
    // Same react-aria-components internal-update flush as the other tests
    // in this file.
    await act(async () => {});
  });

  it('applies aria-label when no visible label is given -- the gap that let React Aria log its own "you must specify an aria-label" warning', () => {
    render(<TimeField name="startTime" aria-label="Start time" />);
    expect(document.querySelector('[aria-label="Start time"]')).toBeInTheDocument();
    expect(screen.queryByText('Start time')).not.toBeInTheDocument(); // no visible <Label> rendered
  });

  it('ignores aria-label once a visible label is set, so the two can never disagree', () => {
    render(<TimeField name="startTime" label="Start time" aria-label="Something else" />);
    expect(document.querySelector('[aria-label="Something else"]')).not.toBeInTheDocument();
  });
});
