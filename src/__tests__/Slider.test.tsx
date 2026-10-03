import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Slider } from '../components/Form/Slider';
import { FormField } from '../components/Form/FormComponents';
import { axe } from './testUtils/axe';

describe('Slider Component', () => {
  it('renders a slider with the given value', () => {
    render(<Slider name="volume" value={40} onChange={vi.fn()} />);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '40');
  });

  it('regression: an uncontrolled Slider (defaultValue only, default commitOnRelease) actually moves via keyboard instead of staying pinned at defaultValue', () => {
    const onChange = vi.fn();
    render(<Slider name="volume" defaultValue={50} onChange={onChange} />);
    const thumb = screen.getByRole('slider');
    // Base UI's thumb sets state in its focus handler (AGENTS.md act() case 4).
    act(() => thumb.focus());
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith(51);
    expect(thumb).toHaveAttribute('aria-valuenow', '51');
  });

  describe('regression: no id/aria-label meant no accessible name outside a FormField, and no FormField label association', () => {
    // Slider exposed neither an `id` prop nor FieldContext consumption, so
    // (a) a Slider inside <FormField name="x" label="X"> had the same
    // broken htmlFor association Select/Combobox/Input had before their own
    // fixes, and (b) a standalone Slider outside any FormField had no
    // accessible name at all — the thumb only falls back to a generic
    // positional label like "Value" when neither aria-label nor a
    // <label htmlFor> resolves.
    it('names the thumb from the surrounding FormField label', async () => {
      render(
        <FormField name="volume" label="Volume">
          <Slider onChange={vi.fn()} />
        </FormField>
      );
      // Through aria-labelledby, not htmlFor: Base UI generates the thumb
      // input's id (#701).
      expect(screen.getByRole('slider', { name: 'Volume' })).toBeInTheDocument();
      expect(await axe(document.body)).toHaveNoViolations();
    });

    it('applies an explicit ariaLabel for standalone use outside a FormField', async () => {
      render(<Slider name="brightness" ariaLabel="Brightness" onChange={vi.fn()} />);
      expect(screen.getByRole('slider')).toHaveAttribute('aria-label', 'Brightness');
      // Scanned here, not the plain "renders a slider" test above -- that
      // one has no FormField and no ariaLabel, so it has no accessible name
      // at all (a real, separate, already-covered gap the regression suite
      // right above this one exists for) and would fail axe's own
      // accessible-name rule for exactly that reason, unrelated to this
      // sweep.
      expect(await axe(document.body)).toHaveNoViolations();
    });
  });
});
