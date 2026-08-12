import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { z } from 'zod';
import { RadioGroup } from '../components/Form/RadioGroup';
import { Form } from '../components/Form/FormContext';
import { FormField, SubmitButton } from '../components/Form/FormComponents';

// Radix's RadioGroup uses ResizeObserver — not implemented in jsdom. Same
// polyfill pattern already used in RadixPrimitives.test.tsx for the same
// reason.
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverMock as any;
  (globalThis as any).ResizeObserver = ResizeObserverMock as any;
}

describe('RadioGroup Component', () => {
  const options = [
    { label: 'Option A', value: 'a' },
    { label: 'Option B', value: 'b' },
    { label: 'Option C', value: 'c' },
  ];

  it('renders radio options and handles selection change', () => {
    const handleChange = vi.fn();

    render(<RadioGroup options={options} value="a" onChange={handleChange} />);

    const radioA = screen.getByRole('radio', { name: 'Option A' });
    const radioB = screen.getByRole('radio', { name: 'Option B' });

    expect(radioA).toHaveAttribute('aria-checked', 'true');
    expect(radioB).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(radioB);
    expect(handleChange).toHaveBeenCalledWith('b');
  });

  it('renders with compound RadioGroup.Option elements', () => {
    const handleChange = vi.fn();

    render(
      <RadioGroup value="b" onChange={handleChange}>
        <RadioGroup.Option value="a" label="Item A" />
        <RadioGroup.Option value="b" label="Item B" />
      </RadioGroup>
    );

    expect(screen.getByText('Item A')).toBeInTheDocument();
    expect(screen.getByText('Item B')).toBeInTheDocument();

    const radioB = screen.getByRole('radio', { name: 'Item B' });
    expect(radioB).toHaveAttribute('aria-checked', 'true');
  });

  describe('regression: FormField name inheritance and touched-on-submit', () => {
    // RadioGroup's own JSDoc has always said "Field name. Auto-inherited
    // from parent <FormField> if omitted" — matching Input/Textarea/
    // Checkbox/Switch — but until this fix it never actually consulted
    // FieldContext, and never called registerField either. Both are
    // exercised here through a real <Form>, not in isolation, since the
    // bug's actual symptom (a validation error silently never displaying)
    // only shows up at that level.
    const roleSchema = z.object({
      role: z.string().min(1, 'Please select a role'),
    });

    it('inherits its name from the surrounding FormField without an explicit name prop', async () => {
      const handleSubmit = vi.fn();

      render(
        <Form id="role-form" schema={roleSchema} onSubmit={handleSubmit}>
          <FormField name="role" label="Role">
            <RadioGroup options={options} />
          </FormField>
          <SubmitButton>Submit</SubmitButton>
        </Form>
      );

      fireEvent.click(screen.getByRole('radio', { name: 'Option B' }));
      fireEvent.click(screen.getByText('Submit'));

      // If the name were never actually inherited, this submission would
      // validate against a `role` key that was never populated by the
      // click above (setFieldValue would have written to some other,
      // empty fieldName), and the schema would still report a "Please
      // select a role" error despite a real selection having been made.
      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledWith({ role: 'b' });
      });
    });

    it('shows its validation error on first submit even when left at its default (regression: missing registerField)', async () => {
      const handleSubmit = vi.fn();

      render(
        <Form id="role-form-2" schema={roleSchema} onSubmit={handleSubmit}>
          <FormField name="role" label="Role">
            <RadioGroup options={options} />
          </FormField>
          <SubmitButton>Submit</SubmitButton>
        </Form>
      );

      // Nothing selected — submit immediately, the scenario that exposed
      // the bug: schema validation always computes the error regardless,
      // but without registerField seeding `role` into the form's `values`
      // object, handleSubmit's "mark every known field touched" loop never
      // touches it, so <FormField>'s `touched[name] ? errors[name] : ...`
      // display logic would hide the error forever, on every submit
      // attempt, not just the first.
      fireEvent.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(screen.getByText('Please select a role')).toBeInTheDocument();
      });
      expect(handleSubmit).not.toHaveBeenCalled();
    });
  });
});
