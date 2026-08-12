import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { z } from 'zod';
import { Select } from '../components/Form/Select';
import { Form } from '../components/Form/FormContext';
import { FormField, SubmitButton } from '../components/Form/FormComponents';

const options = [
  { label: 'Admin', value: 'admin' },
  { label: 'Editor', value: 'editor' },
  { label: 'Viewer', value: 'viewer' },
];

describe('Select Component', () => {
  it('renders with the current selected label', () => {
    render(<Select value="editor" onChange={vi.fn()} options={options} />);
    expect(screen.getByText('Editor')).toBeInTheDocument();
  });

  describe('regression: FormField name inheritance and touched-on-submit', () => {
    // Select's own JSDoc has always said "Field name. Auto-inherited from
    // parent <FormField> if omitted" — matching Input/Textarea/Checkbox/
    // Switch/RadioGroup — but until this fix it never actually consulted
    // FieldContext (useContext was imported but never called), and never
    // called registerField either. Both are exercised here through a real
    // <Form>, since the bug's actual symptom only shows up at that level.
    const roleSchema = z.object({
      role: z.string().min(1, 'Please select a role'),
    });

    it('inherits its name from the surrounding FormField and shows its validation error on first submit (regression: missing FieldContext + registerField)', async () => {
      const handleSubmit = vi.fn();

      render(
        <Form id="role-form" schema={roleSchema} onSubmit={handleSubmit}>
          <FormField name="role" label="Role">
            <Select options={options} />
          </FormField>
          <SubmitButton>Submit</SubmitButton>
        </Form>
      );

      // Nothing selected — submit immediately. This exercises both fixes
      // at once: if the name were never actually inherited from
      // FormField, fieldName would resolve to '' instead of 'role', so
      // registerField('') would seed and later touch the wrong key —
      // "Please select a role" would never appear under 'role' regardless
      // of whether registerField ran at all. And even with the name
      // correctly resolved, without registerField seeding 'role' into the
      // form's `values` object, handleSubmit's "mark every known field
      // touched" loop would never touch it, so <FormField>'s
      // `touched[name] ? errors[name] : undefined` display logic would
      // hide the error forever. This single assertion only passes if both
      // are wired correctly.
      fireEvent.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(screen.getByText('Please select a role')).toBeInTheDocument();
      });
      expect(handleSubmit).not.toHaveBeenCalled();
    });
  });
});
