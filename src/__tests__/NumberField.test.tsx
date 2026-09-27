import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { z } from 'zod';
import { NumberField } from '../components/NumberField/NumberField';
import { Form } from '../components/Form/FormContext';
import { FormField, SubmitButton } from '../components/Form/FormComponents';
import { aiBus } from '../eventBus/eventBus';
import { axe } from './testUtils/axe';

// React Aria commits a typed value on blur (or Enter); these type into the
// input and blur it, the same way a user leaving the field would.
function typeAndCommit(input: HTMLElement, text: string) {
  act(() => {
    input.focus();
  });
  fireEvent.change(input, { target: { value: text } });
  act(() => {
    input.blur();
  });
}

describe('NumberField', () => {
  it('renders a labelled spin-button-style input with −/+ steppers', async () => {
    render(<NumberField label="Quantity" defaultValue={3} />);
    // The steppers are named "Increase Quantity"/"Decrease Quantity", so query the input by role.
    const input = screen.getByRole('textbox', { name: 'Quantity' });
    expect(input).toHaveValue('3');
    expect(screen.getByRole('button', { name: /increase/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /decrease/i })).toBeInTheDocument();
    await act(async () => {});
  });

  it('steps with the buttons and emits the new number', async () => {
    const onChange = vi.fn();
    const handler = vi.fn();
    const unsub = aiBus.on('numberfield:changed', handler);
    render(<NumberField aria-label="Qty" defaultValue={4} step={2} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /increase/i }));
    expect(screen.getByRole('textbox', { name: 'Qty' })).toHaveValue('6');
    expect(onChange).toHaveBeenLastCalledWith(6);
    expect(handler).toHaveBeenLastCalledWith({ name: undefined, value: 6 });
    fireEvent.click(screen.getByRole('button', { name: /decrease/i }));
    expect(onChange).toHaveBeenLastCalledWith(4);
    unsub();
    await act(async () => {});
  });

  it('steps with arrows and PageUp/PageDown, and Home/End go to min/max', async () => {
    const onChange = vi.fn();
    render(<NumberField aria-label="Qty" defaultValue={10} min={0} max={100} onChange={onChange} />);
    const input = screen.getByRole('textbox', { name: 'Qty' });
    act(() => input.focus());
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenLastCalledWith(11);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenLastCalledWith(10);
    // React Aria's NumberField steps PageUp/PageDown by one `step`, same as the arrows.
    fireEvent.keyDown(input, { key: 'PageUp' });
    expect(onChange).toHaveBeenLastCalledWith(11);
    fireEvent.keyDown(input, { key: 'PageDown' });
    expect(onChange).toHaveBeenLastCalledWith(10);
    fireEvent.keyDown(input, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith(100);
    fireEvent.keyDown(input, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith(0);
    await act(async () => {});
  });

  it('clamps a typed value to min/max on commit', async () => {
    const onChange = vi.fn();
    render(<NumberField aria-label="Qty" defaultValue={5} min={0} max={10} onChange={onChange} />);
    const input = screen.getByRole('textbox', { name: 'Qty' });
    typeAndCommit(input, '42');
    expect(onChange).toHaveBeenLastCalledWith(10);
    expect(input).toHaveValue('10');
    await act(async () => {});
  });

  it("gives the steppers the toolkit's shared button interaction states", async () => {
    render(<NumberField aria-label="Qty" defaultValue={1} />);
    expect(screen.getByRole('button', { name: /increase/i })).toHaveClass('ai-btn');
    expect(screen.getByRole('button', { name: /decrease/i })).toHaveClass('ai-btn');
    await act(async () => {});
  });

  it('disables the increment stepper at max', async () => {
    render(<NumberField aria-label="Qty" defaultValue={10} max={10} />);
    expect(screen.getByRole('button', { name: /increase/i })).toBeDisabled();
    await act(async () => {});
  });

  it('reports an emptied field as null, not NaN', async () => {
    const onChange = vi.fn();
    render(<NumberField aria-label="Qty" defaultValue={5} onChange={onChange} />);
    typeAndCommit(screen.getByRole('textbox', { name: 'Qty' }), '');
    expect(onChange).toHaveBeenLastCalledWith(null);
    await act(async () => {});
  });

  it('formats with Intl options (currency, percent) while the value stays a plain number', async () => {
    const onChange = vi.fn();
    const { unmount } = render(<NumberField aria-label="Price" defaultValue={1234.5} formatOptions={{ style: 'currency', currency: 'USD' }} />);
    expect(screen.getByRole('textbox', { name: 'Price' })).toHaveValue('$1,234.50');
    unmount();
    render(<NumberField aria-label="Rate" defaultValue={0.25} formatOptions={{ style: 'percent' }} step={0.01} onChange={onChange} />);
    expect(screen.getByRole('textbox', { name: 'Rate' })).toHaveValue('25%');
    fireEvent.click(screen.getByRole('button', { name: /increase/i }));
    expect(onChange).toHaveBeenLastCalledWith(0.26);
    await act(async () => {});
  });

  it('uses the locale for separators', async () => {
    render(<NumberField aria-label="Betrag" defaultValue={1234.5} locale="de-DE" formatOptions={{ minimumFractionDigits: 2 }} />);
    expect(screen.getByRole('textbox', { name: 'Betrag' })).toHaveValue('1.234,50');
    await act(async () => {});
  });

  it('is editable standalone with only a defaultValue (not frozen)', async () => {
    render(<NumberField aria-label="Qty" defaultValue={1} />);
    const input = screen.getByRole('textbox', { name: 'Qty' });
    typeAndCommit(input, '7');
    expect(input).toHaveValue('7');
    await act(async () => {});
  });

  it('follows a controlled value', async () => {
    const { rerender } = render(<NumberField aria-label="Qty" value={2} onChange={() => {}} />);
    expect(screen.getByRole('textbox', { name: 'Qty' })).toHaveValue('2');
    rerender(<NumberField aria-label="Qty" value={9} onChange={() => {}} />);
    expect(screen.getByRole('textbox', { name: 'Qty' })).toHaveValue('9');
    await act(async () => {});
  });

  it('binds to a Form: submits a real number and shows schema errors', async () => {
    const onSubmit = vi.fn();
    const schema = z.object({ qty: z.number().min(1, 'At least 1') });
    render(
      <Form id="nf-form" schema={schema} initialValues={{ qty: 0 }} onSubmit={onSubmit}>
        <FormField name="qty" label="Quantity">
          <NumberField />
        </FormField>
        <SubmitButton>Save</SubmitButton>
      </Form>
    );
    const input = screen.getByRole('textbox', { name: 'Quantity' });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(input).toHaveAttribute('aria-invalid', 'true'));
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /increase/i }));
    fireEvent.click(screen.getByRole('button', { name: /increase/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toEqual({ qty: 2 });
    expect(typeof onSubmit.mock.calls[0][0].qty).toBe('number');
  });

  it('an untouched Form field submits null, not a string', async () => {
    // registerField used to seed every field with '', so an untouched
    // NumberField failed z.number().nullable() with a type error.
    const onSubmit = vi.fn();
    render(
      <Form id="nf-empty" schema={z.object({ qty: z.number().nullable() })} onSubmit={onSubmit}>
        <FormField name="qty" label="Quantity">
          <NumberField />
        </FormField>
        <SubmitButton>Save</SubmitButton>
      </Form>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toEqual({ qty: null });
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <div>
        <NumberField label="Quantity" defaultValue={1} min={0} max={10} />
        <NumberField aria-label="Price" defaultValue={9.99} formatOptions={{ style: 'currency', currency: 'USD' }} />
      </div>
    );
    await act(async () => {});
    expect(await axe(container)).toHaveNoViolations();
  });
});
