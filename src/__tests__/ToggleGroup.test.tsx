import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Toggle, ToggleGroup } from '../components/ToggleGroup/ToggleGroup';
import { Form } from '../components/Form/FormContext';
import { FormField } from '../components/Form/FormComponents';
import { UIGroup } from '../components/UIGroup/UIGroup';
import { z } from 'zod';
import { aiBus } from '../eventBus/eventBus';
import { axe } from './testUtils/axe';
import { actAndSettle } from './testUtils/overlay';

// The Toggle/ToggleGroup primitives can use ResizeObserver internally —
// not implemented in jsdom. Same polyfill pattern already used in
// PrimitivesSubsystem.test.tsx / RadioGroup.test.tsx for the same reason.
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
  it('toggles pressed state and emits toggle:changed', async () => {
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
    expect(await axe(document.body)).toHaveNoViolations();

    unsub();
  });
});

describe('ToggleGroup Component', () => {
  const options = [
    { value: 'left', label: 'Left' },
    { value: 'center', label: 'Center' },
    { value: 'right', label: 'Right' },
  ];

  const separators = () => Array.from(document.querySelectorAll<HTMLElement>('[data-ai-choice-separator]'));

  it('type="single": selecting one option deselects the previous one', async () => {
    const onChange = vi.fn();
    render(<ToggleGroup name="align" type="single" defaultValue="left" options={options} onChange={onChange} />);

    expect(screen.getByRole('radio', { name: 'Left' })).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('radio', { name: 'Right' }));
    expect(onChange).toHaveBeenCalledWith('right');
    expect(screen.getByRole('radio', { name: 'Right' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Left' })).toHaveAttribute('aria-checked', 'false');
    expect(await axe(document.body)).toHaveNoViolations();
  });

  // Regression: type="single" renders role="radiogroup", but the primitive's own
  // underlying value model is still a plain toggle -- clicking the
  // currently-selected option calls its own onItemDeactivate, setting the
  // value to '' (fully deselected). Valid for type="multiple" (an
  // independent toggle CAN have none pressed) but a real WAI-ARIA
  // violation for type="single" (a radiogroup must always have exactly one
  // option checked once initialized) -- and, found via a real "Too many
  // re-renders" crash in a live consumer (DataTable's own density
  // selector), genuinely dangerous: an empty selected value cascading into
  // a downstream `Record<string, number>` lookup returning `undefined`,
  // then `NaN`, then an infinite render loop once a render-time state
  // guard's `!==` comparison can never stabilize (NaN !== NaN is always
  // true in JS). Re-clicking the already-selected option must be a no-op
  // that keeps it selected, not a deselect.
  it('type="single": clicking the already-selected option is a no-op, not a deselect (regression)', () => {
    const onChange = vi.fn();
    render(<ToggleGroup name="align" type="single" defaultValue="left" options={options} onChange={onChange} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Left' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: 'Left' })).toHaveAttribute('aria-checked', 'true');
  });

  it('type="multiple": clicking the only pressed option DOES deselect it -- toggles, unlike single mode', () => {
    const onChange = vi.fn();
    render(<ToggleGroup name="format" type="multiple" defaultValue={['left']} options={options} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Left' }));

    expect(onChange).toHaveBeenCalledWith([]);
    expect(screen.getByRole('button', { name: 'Left' })).toHaveAttribute('aria-pressed', 'false');
  });

  // #903: dividers are real aria-hidden elements BETWEEN options, never a
  // pseudo-element inside one, so an option's selected/hover fill can't paint
  // under a divider.
  describe('separators (#903)', () => {
    it('renders N-1 aria-hidden separators, each between two options in DOM order', () => {
      render(<ToggleGroup type="single" defaultValue="left" options={options} aria-label="Align" />);

      const seps = separators();
      expect(seps).toHaveLength(options.length - 1);
      const radios = screen.getAllByRole('radio');
      seps.forEach((sep, i) => {
        expect(sep).toHaveAttribute('aria-hidden', 'true');
        // radios[i] precedes the separator, radios[i + 1] follows it.
        expect(radios[i].compareDocumentPosition(sep) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(radios[i + 1].compareDocumentPosition(sep) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
        expect(sep.parentElement).toBe(radios[i].parentElement);
      });
    });

    it('never puts a separator inside an option, and the accessible options are exactly the options', () => {
      render(<ToggleGroup type="single" defaultValue="left" options={options} aria-label="Align" />);

      const radios = screen.getAllByRole('radio');
      expect(radios.map(r => r.textContent)).toEqual(['Left', 'Center', 'Right']);
      for (const radio of radios) {
        expect(radio.querySelector('[data-ai-choice-separator]')).toBeNull();
      }
      expect(screen.getByRole('radiogroup', { name: 'Align' })).toBeInTheDocument();
    });

    it('selecting an option does not hide or unmount any separator', () => {
      render(<ToggleGroup type="single" defaultValue="left" options={options} />);
      const before = separators();

      fireEvent.click(screen.getByRole('radio', { name: 'Center' }));

      const after = separators();
      expect(after).toHaveLength(before.length);
      after.forEach((sep, i) => {
        expect(sep).toBe(before[i]);
        expect(sep.style.opacity).toBe('1');
      });
    });

    it('type="multiple": two adjacent selected options keep the separator between them visible', () => {
      render(<ToggleGroup type="multiple" defaultValue={['left']} options={options} />);
      const before = separators();

      fireEvent.click(screen.getByRole('button', { name: 'Center' }));

      expect(screen.getByRole('button', { name: 'Left' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Center' })).toHaveAttribute('aria-pressed', 'true');
      const after = separators();
      expect(after).toHaveLength(2);
      after.forEach((sep, i) => {
        expect(sep).toBe(before[i]);
        expect(sep.style.opacity).toBe('1');
      });
    });

    it('arrow keys move focus option to option and never land on a separator', async () => {
      render(<ToggleGroup type="single" defaultValue="left" options={options} aria-label="Align" />);
      const [left, center, right] = screen.getAllByRole('radio');

      await actAndSettle(() => { left.focus(); });
      expect(document.activeElement).toBe(left);

      await actAndSettle(() => { fireEvent.keyDown(left, { key: 'ArrowRight' }); });
      expect(document.activeElement).toBe(center);
      await actAndSettle(() => { fireEvent.keyDown(center, { key: 'ArrowRight' }); });
      expect(document.activeElement).toBe(right);
      await actAndSettle(() => { fireEvent.keyDown(right, { key: 'ArrowLeft' }); });
      expect(document.activeElement).toBe(center);
      await actAndSettle(() => { fireEvent.keyDown(center, { key: 'ArrowLeft' }); });
      expect(document.activeElement).toBe(left);

      for (const sep of separators()) expect(document.activeElement).not.toBe(sep);
    });

    it('draws the frame on the root and no border on any option', () => {
      render(<ToggleGroup type="single" defaultValue="left" options={options} aria-label="Align" />);

      const root = screen.getByRole('radiogroup', { name: 'Align' });
      expect(root.style.borderWidth).toBe('0.0625rem');
      expect(root.style.borderTopLeftRadius).toBe('var(--ai-radius-md, 0.375rem)');
      for (const radio of screen.getAllByRole('radio')) {
        expect(radio.style.borderTopWidth).toBe('0px');
        expect(radio.style.borderLeftWidth).toBe('0px');
        expect(radio.style.marginLeft).toBe('');
      }
    });

    it('rounds only the first option\'s left and the last option\'s right corners', () => {
      render(<ToggleGroup type="single" defaultValue="left" options={options} />);
      const [left, center, right] = screen.getAllByRole('radio');

      expect(left.style.borderTopLeftRadius).not.toBe('0px');
      expect(left.style.borderTopRightRadius).toBe('0px');
      expect(center.style.borderTopLeftRadius).toBe('0px');
      expect(center.style.borderTopRightRadius).toBe('0px');
      expect(right.style.borderTopRightRadius).not.toBe('0px');
      expect(right.style.borderTopLeftRadius).toBe('0px');
    });

    it('inside a <UIGroup> squaring its leading edge, the root and first option square their left corners', () => {
      render(
        <UIGroup>
          <ToggleGroup type="single" defaultValue="left" options={options} aria-label="Align" />
          <ToggleGroup type="single" defaultValue="left" options={options} aria-label="Second" />
        </UIGroup>,
      );

      const second = screen.getByRole('radiogroup', { name: 'Second' });
      expect(second.style.borderTopLeftRadius).toBe('0px');
      expect(second.style.borderTopRightRadius).not.toBe('0px');
      expect(second.querySelector<HTMLElement>('[role="radio"]')!.style.borderTopLeftRadius).toBe('0px');
    });

    it('paints the root in the error color when its field is invalid', async () => {
      render(
        <Form schema={z.object({ align: z.string().min(1, 'Required') })} onSubmit={() => {}}>
          <FormField name="align" label="Align">
            <ToggleGroup type="single" options={options} />
          </FormField>
          <button type="submit">Go</button>
        </Form>,
      );

      const root = screen.getByRole('radiogroup');
      expect(root.style.borderColor).not.toContain('--ai-subtheme-error');
      await act(async () => { fireEvent.submit(root.closest('form')!); });
      expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByRole('radiogroup').getAttribute('style')).toContain('--ai-subtheme-error');
    });
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
