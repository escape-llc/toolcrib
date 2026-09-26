import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RangeSlider } from '../components/Form/RangeSlider';
import { FormField } from '../components/Form/FormComponents';
import { aiBus } from '../eventBus/eventBus';
import { axe } from './testUtils/axe';

// Radix Slider's internal useSize hook uses ResizeObserver -- not
// implemented in jsdom. Same polyfill as Slider.test.tsx.
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverMock as any;
  (globalThis as any).ResizeObserver = ResizeObserverMock as any;
}

describe('RangeSlider Component', () => {
  it('renders two thumbs at the given [lower, upper] value', () => {
    render(<RangeSlider ariaLabel="Price" value={[20, 80]} onChange={vi.fn()} />);
    const [lower, upper] = screen.getAllByRole('slider');
    expect(lower).toHaveAttribute('aria-valuenow', '20');
    expect(upper).toHaveAttribute('aria-valuenow', '80');
  });

  it('defaults to the full [min, max] range when uncontrolled with no defaultValue', () => {
    render(<RangeSlider ariaLabel="Price" min={10} max={90} />);
    const [lower, upper] = screen.getAllByRole('slider');
    expect(lower).toHaveAttribute('aria-valuenow', '10');
    expect(upper).toHaveAttribute('aria-valuenow', '90');
  });

  it('moves each thumb independently via keyboard, reporting the full pair (uncontrolled)', () => {
    const onChange = vi.fn();
    render(<RangeSlider ariaLabel="Price" defaultValue={[20, 80]} onChange={onChange} />);
    const [lower, upper] = screen.getAllByRole('slider');
    lower.focus();
    fireEvent.keyDown(lower, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith([21, 80]);
    expect(lower).toHaveAttribute('aria-valuenow', '21');
    upper.focus();
    fireEvent.keyDown(upper, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith([21, 79]);
    expect(upper).toHaveAttribute('aria-valuenow', '79');
  });

  it('emits rangeslider:changed with the field name and pair', () => {
    const handler = vi.fn();
    const unsub = aiBus.on('rangeslider:changed', handler);
    render(<RangeSlider name="price" ariaLabel="Price" defaultValue={[20, 80]} />);
    const [lower] = screen.getAllByRole('slider');
    lower.focus();
    fireEvent.keyDown(lower, { key: 'ArrowRight' });
    expect(handler).toHaveBeenCalledWith({ name: 'price', value: [21, 80] });
    unsub();
  });

  it('respects minStepsBetweenThumbs', () => {
    const onChange = vi.fn();
    render(<RangeSlider ariaLabel="Price" defaultValue={[48, 50]} minStepsBetweenThumbs={2} onChange={onChange} />);
    const [lower] = screen.getAllByRole('slider');
    lower.focus();
    fireEvent.keyDown(lower, { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
    expect(lower).toHaveAttribute('aria-valuenow', '48');
  });

  it('does not loop when a controlled consumer passes a fresh array literal every render', () => {
    const { rerender } = render(<RangeSlider ariaLabel="Price" value={[20, 80]} onChange={vi.fn()} />);
    rerender(<RangeSlider ariaLabel="Price" value={[20, 80]} onChange={vi.fn()} />);
    rerender(<RangeSlider ariaLabel="Price" value={[30, 80]} onChange={vi.fn()} />);
    expect(screen.getAllByRole('slider')[0]).toHaveAttribute('aria-valuenow', '30');
  });

  it('names each thumb from ariaLabel + its own suffix', () => {
    render(<RangeSlider ariaLabel="Price" defaultValue={[20, 80]} />);
    expect(screen.getByRole('slider', { name: 'Price Minimum' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Price Maximum' })).toBeInTheDocument();
  });

  it('names each thumb from the FormField label + suffix, and the label targets the lower thumb', () => {
    render(
      <FormField name="price" label="Price range">
        <RangeSlider defaultValue={[20, 80]} />
      </FormField>
    );
    const lower = screen.getByRole('slider', { name: 'Price range Minimum' });
    expect(screen.getByRole('slider', { name: 'Price range Maximum' })).toBeInTheDocument();
    expect(lower.id).toBe('price');
  });

  it('accepts custom thumb labels', () => {
    render(<RangeSlider ariaLabel="Hours" thumbLabels={['Opens', 'Closes']} defaultValue={[9, 17]} min={0} max={24} />);
    expect(screen.getByRole('slider', { name: 'Hours Opens' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Hours Closes' })).toBeInTheDocument();
  });

  it('commitOnRelease defers onChange until the value is committed', () => {
    const onChange = vi.fn();
    render(<RangeSlider ariaLabel="Price" defaultValue={[20, 80]} commitOnRelease onChange={onChange} />);
    const [lower] = screen.getAllByRole('slider');
    lower.focus();
    // A keyboard step is a discrete commit in Radix (onValueCommit fires).
    fireEvent.keyDown(lower, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([21, 80]);
  });

  it('has no axe violations standalone or inside a FormField', async () => {
    const { container } = render(
      <div>
        <RangeSlider ariaLabel="Price" defaultValue={[20, 80]} />
        <FormField name="age" label="Age range">
          <RangeSlider defaultValue={[18, 65]} />
        </FormField>
      </div>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
