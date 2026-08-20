import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Slider } from '../components/Form/Slider';
import { FormField } from '../components/Form/FormComponents';

// Radix Slider's internal useSize hook uses ResizeObserver — not
// implemented in jsdom. Same polyfill pattern already used in
// RadixPrimitives.test.tsx and eventBusTraffic.test.tsx for the same reason.
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverMock as any;
  (globalThis as any).ResizeObserver = ResizeObserverMock as any;
}

describe('Slider Component', () => {
  it('renders a slider with the given value', () => {
    render(<Slider name="volume" value={40} onChange={vi.fn()} />);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '40');
  });

  describe('regression: no id/aria-label meant no accessible name outside a FormField, and no FormField label association', () => {
    // Slider exposed neither an `id` prop nor FieldContext consumption, so
    // (a) a Slider inside <FormField name="x" label="X"> had the same
    // broken htmlFor association Select/Combobox/Input had before their own
    // fixes, and (b) a standalone Slider outside any FormField had no
    // accessible name at all — Radix's Thumb only falls back to a generic
    // positional label like "Value" when neither aria-label nor a
    // <label htmlFor> resolves.
    it('gives the thumb an id matching the surrounding FormField label\'s htmlFor', () => {
      render(
        <FormField name="volume" label="Volume">
          <Slider onChange={vi.fn()} />
        </FormField>
      );
      const thumb = screen.getByRole('slider');
      expect(thumb).toHaveAttribute('id', 'volume');
      expect(screen.getByText('Volume')).toHaveAttribute('for', 'volume');
    });

    it('applies an explicit ariaLabel for standalone use outside a FormField', () => {
      render(<Slider name="brightness" ariaLabel="Brightness" onChange={vi.fn()} />);
      expect(screen.getByRole('slider')).toHaveAttribute('aria-label', 'Brightness');
    });
  });
});
