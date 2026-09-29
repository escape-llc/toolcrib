import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { z } from 'zod';
import { CheckboxGroup, type CheckboxOption } from '../components/Form/CheckboxGroup';
import { Form } from '../components/Form/FormContext';
import { FormField, SubmitButton } from '../components/Form/FormComponents';
import { aiBus } from '../eventBus/eventBus';
import { axe } from './testUtils/axe';

const toppings: CheckboxOption[] = [
  { value: 'cheese', label: 'Cheese' },
  { value: 'olives', label: 'Olives' },
  { value: 'peppers', label: 'Peppers', helperText: 'Mild' },
  { value: 'anchovies', label: 'Anchovies', disabled: true },
];

const box = (name: string) => screen.getByRole('checkbox', { name });
// Base UI's checkbox is a <span role="checkbox">, disabled via aria-disabled
// (jest-dom's toBeDisabled only understands native form controls).
const isDisabled = (name: string) => box(name).getAttribute('aria-disabled') === 'true';

describe('CheckboxGroup', () => {
  it('renders a named group of checkboxes', () => {
    render(<CheckboxGroup label="Toppings" options={toppings} />);
    const group = screen.getByRole('group', { name: 'Toppings' });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(4);
    expect(screen.getByText('Mild')).toBeInTheDocument();
    expect(isDisabled('Anchovies')).toBe(true);
  });

  it('is editable standalone from a defaultValue and reports values in options order', () => {
    const onChange = vi.fn();
    render(<CheckboxGroup aria-label="Toppings" options={toppings} defaultValue={['peppers']} onChange={onChange} />);
    expect(box('Peppers')).toBeChecked();
    fireEvent.click(box('Cheese'));
    expect(box('Cheese')).toBeChecked();
    // Clicked after peppers, but listed first: the value follows options order.
    expect(onChange).toHaveBeenLastCalledWith(['cheese', 'peppers']);
    fireEvent.click(box('Peppers'));
    expect(box('Peppers')).not.toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith(['cheese']);
  });

  it('names a checked box by its label alone, without the check glyph', () => {
    // Base UI names the box from the wrapping <label>'s text; the indicator's
    // glyph is aria-hidden so a checked box isn't announced as "✓ Cheese".
    render(<CheckboxGroup aria-label="T" options={toppings} defaultValue={['cheese']} />);
    expect(box('Cheese')).toBeChecked();
  });

  it('follows a controlled value', () => {
    const { rerender } = render(<CheckboxGroup aria-label="T" options={toppings} value={['olives']} onChange={() => {}} />);
    expect(box('Olives')).toBeChecked();
    rerender(<CheckboxGroup aria-label="T" options={toppings} value={[]} onChange={() => {}} />);
    expect(box('Olives')).not.toBeChecked();
  });

  it('with maxSelected, locks the unchecked boxes at the limit and frees them on uncheck', () => {
    render(<CheckboxGroup aria-label="Pick two" options={toppings.slice(0, 3)} maxSelected={2} />);
    fireEvent.click(box('Cheese'));
    fireEvent.click(box('Olives'));
    expect(isDisabled('Peppers')).toBe(true);
    // Checked boxes stay enabled so the user can make room.
    expect(isDisabled('Cheese')).toBe(false);
    fireEvent.click(box('Cheese'));
    expect(isDisabled('Peppers')).toBe(false);
  });

  it('emits checkboxgroup:changed', () => {
    const handler = vi.fn();
    const unsub = aiBus.on('checkboxgroup:changed', handler);
    render(<CheckboxGroup name="toppings" aria-label="T" options={toppings} />);
    fireEvent.click(box('Olives'));
    expect(handler).toHaveBeenCalledWith({ name: 'toppings', value: ['olives'] });
    unsub();
  });

  it('is keyboard-operable: every enabled box is its own tab stop, Enter does not toggle', () => {
    render(<CheckboxGroup aria-label="T" options={toppings} />);
    for (const name of ['Cheese', 'Olives', 'Peppers']) {
      expect(box(name)).toHaveAttribute('tabindex', '0');
    }
    // WAI-ARIA checkbox: Space toggles; Enter must not.
    fireEvent.keyDown(box('Cheese'), { key: 'Enter' });
    expect(box('Cheese')).not.toBeChecked();
  });

  it('binds to a Form: array value, schema errors, and submit', async () => {
    const onSubmit = vi.fn();
    const schema = z.object({ toppings: z.array(z.string()).min(1, 'Pick at least one') });
    render(
      <Form id="cbg-form" schema={schema} onSubmit={onSubmit}>
        <FormField name="toppings" label="Toppings">
          <CheckboxGroup options={toppings} />
        </FormField>
        <SubmitButton>Order</SubmitButton>
      </Form>
    );
    // The FormField's label names the group.
    const group = screen.getByRole('group', { name: 'Toppings' });
    fireEvent.click(screen.getByRole('button', { name: 'Order' }));
    await waitFor(() => expect(screen.getByText('Pick at least one')).toBeInTheDocument());
    expect(group).toHaveAttribute('aria-describedby', 'toppings-error');
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(box('Peppers'));
    fireEvent.click(box('Cheese'));
    fireEvent.click(screen.getByRole('button', { name: 'Order' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toEqual({ toppings: ['cheese', 'peppers'] });
  });

  it("seeds a Form field from defaultValue, but the Form's initialValues win", async () => {
    const onSubmit = vi.fn();
    const { unmount } = render(
      <Form id="cbg-seed" schema={z.object({ toppings: z.array(z.string()) })} onSubmit={onSubmit}>
        <FormField name="toppings" label="Toppings">
          <CheckboxGroup options={toppings} defaultValue={['olives']} />
        </FormField>
        <SubmitButton>Order</SubmitButton>
      </Form>
    );
    expect(box('Olives')).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Order' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ toppings: ['olives'] }));
    unmount();

    render(
      <Form id="cbg-seed-2" schema={z.object({ toppings: z.array(z.string()) })} initialValues={{ toppings: ['cheese'] }} onSubmit={() => {}}>
        <FormField name="toppings" label="Toppings">
          <CheckboxGroup options={toppings} defaultValue={['olives']} />
        </FormField>
      </Form>
    );
    expect(box('Cheese')).toBeChecked();
    expect(box('Olives')).not.toBeChecked();
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <div>
        <CheckboxGroup label="Toppings" options={toppings} defaultValue={['cheese']} maxSelected={2} />
        <CheckboxGroup aria-label="Days" direction="horizontal" options={[{ value: 'mon', label: 'Mon' }, { value: 'tue', label: 'Tue' }]} />
      </div>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
