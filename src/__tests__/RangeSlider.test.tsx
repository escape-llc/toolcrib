import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { RangeSlider } from '../components/Form/RangeSlider';
import { FormField } from '../components/Form/FormComponents';
import { aiBus } from '../eventBus/eventBus';
import { axe } from './testUtils/axe';

// Base UI's thumb sets state in its focus handler, so a raw .focus() goes
// inside act() (AGENTS.md's act() case 4).
const focus = (el: HTMLElement) => act(() => el.focus());

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
    focus(lower);
    fireEvent.keyDown(lower, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith([21, 80]);
    expect(lower).toHaveAttribute('aria-valuenow', '21');
    focus(upper);
    fireEvent.keyDown(upper, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith([21, 79]);
    expect(upper).toHaveAttribute('aria-valuenow', '79');
  });

  it('emits rangeslider:changed with the field name and pair', () => {
    const handler = vi.fn();
    const unsub = aiBus.on('rangeslider:changed', handler);
    render(<RangeSlider name="price" ariaLabel="Price" defaultValue={[20, 80]} />);
    const [lower] = screen.getAllByRole('slider');
    focus(lower);
    fireEvent.keyDown(lower, { key: 'ArrowRight' });
    expect(handler).toHaveBeenCalledWith({ name: 'price', value: [21, 80] });
    unsub();
  });

  it('respects minStepsBetweenThumbs', () => {
    const onChange = vi.fn();
    render(<RangeSlider ariaLabel="Price" defaultValue={[48, 50]} minStepsBetweenThumbs={2} onChange={onChange} />);
    const [lower] = screen.getAllByRole('slider');
    focus(lower);
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

  it('names each thumb from the FormField label + suffix', () => {
    render(
      <FormField name="price" label="Price range">
        <RangeSlider defaultValue={[20, 80]} />
      </FormField>
    );
    // Named through aria-labelledby, not the label's htmlFor: Base UI
    // generates the thumb inputs' ids (#701).
    expect(screen.getByRole('slider', { name: 'Price range Minimum' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Price range Maximum' })).toBeInTheDocument();
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
    focus(lower);
    // A keyboard step is a discrete commit (onValueCommitted fires).
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
