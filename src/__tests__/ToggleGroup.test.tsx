import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toggle, ToggleGroup } from '../components/ToggleGroup/ToggleGroup';
import { aiBus } from '../eventBus/eventBus';

// Radix's Toggle/ToggleGroup primitives use ResizeObserver internally —
// not implemented in jsdom. Same polyfill pattern already used in
// RadixPrimitives.test.tsx / RadioGroup.test.tsx for the same reason.
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverMock as any;
  (globalThis as any).ResizeObserver = ResizeObserverMock as any;
}

describe('Toggle Component', () => {
  it('toggles pressed state and emits toggle:changed', () => {
    const changedFn = vi.fn();
    const onPressedChange = vi.fn();
    const unsub = aiBus.on('toggle:changed', changedFn);

    render(
      <Toggle name="bold" onPressedChange={onPressedChange}>
        Bold
      </Toggle>
    );

    const btn = screen.getByRole('button', { name: 'Bold' });
    expect(btn).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(onPressedChange).toHaveBeenCalledWith(true);
    expect(changedFn).toHaveBeenCalledWith({ name: 'bold', pressed: true });

    unsub();
  });
});

describe('ToggleGroup Component', () => {
  const options = [
    { value: 'left', label: 'Left' },
    { value: 'center', label: 'Center' },
    { value: 'right', label: 'Right' },
  ];

  it('type="single": selecting one option deselects the previous one', () => {
    const onChange = vi.fn();
    render(<ToggleGroup name="align" type="single" defaultValue="left" options={options} onChange={onChange} />);

    expect(screen.getByRole('radio', { name: 'Left' })).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('radio', { name: 'Right' }));
    expect(onChange).toHaveBeenCalledWith('right');
    expect(screen.getByRole('radio', { name: 'Right' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Left' })).toHaveAttribute('aria-checked', 'false');
  });

  it('type="multiple": options toggle independently and emits togglegroup:changed', () => {
    const changedFn = vi.fn();
    const onChange = vi.fn();
    const unsub = aiBus.on('togglegroup:changed', changedFn);

    render(<ToggleGroup name="format" type="multiple" options={options} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Left' }));
    expect(onChange).toHaveBeenCalledWith(['left']);
    expect(changedFn).toHaveBeenCalledWith({ name: 'format', value: ['left'] });

    fireEvent.click(screen.getByRole('button', { name: 'Right' }));
    expect(onChange).toHaveBeenCalledWith(['left', 'right']);

    unsub();
  });
});
