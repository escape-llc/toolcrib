import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { z } from 'zod';
import { CheckboxGroup, type CheckboxOption } from '../components/Form/CheckboxGroup';
import { Form } from '../components/Form/FormContext';
import { FormField, SubmitButton } from '../components/Form/FormComponents';
import { aiBus } from '../eventBus/eventBus';
import { axe } from './testUtils/axe';

// Inside a real <form>, Radix Checkbox renders a hidden native input that
// measures itself with ResizeObserver, which jsdom doesn't implement.
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverMock;
}

const toppings: CheckboxOption[] = [
  { value: 'cheese', label: 'Cheese' },
  { value: 'olives', label: 'Olives' },
  { value: 'peppers', label: 'Peppers', helperText: 'Mild' },
  { value: 'anchovies', label: 'Anchovies', disabled: true },
];

const box = (name: string) => screen.getByRole('checkbox', { name });

describe('CheckboxGroup', () => {
  it('renders a named group of checkboxes', () => {
    render(<CheckboxGroup label="Toppings" options={toppings} />);
    const group = screen.getByRole('group', { name: 'Toppings' });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(4);
    expect(screen.getByText('Mild')).toBeInTheDocument();
    expect(box('Anchovies')).toBeDisabled();
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
    expect(box('Peppers')).toBeDisabled();
    // Checked boxes stay enabled so the user can make room.
    expect(box('Cheese')).toBeEnabled();
    fireEvent.click(box('Cheese'));
    expect(box('Peppers')).toBeEnabled();
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
      expect(box(name).tagName).toBe('BUTTON');
      expect(box(name)).not.toHaveAttribute('tabindex', '-1');
    }
    // WAI-ARIA checkbox: Space toggles (native button activation); Enter must not.
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
