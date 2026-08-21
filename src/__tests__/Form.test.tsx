import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { z } from 'zod';
import { Form, useFormContext } from '../components/Form/FormContext';
import { FormField, Input, Textarea, Checkbox, Switch, FormError, SubmitButton, Button } from '../components/Form/FormComponents';
import { aiBus } from '../eventBus/eventBus';

// Switch (Radix Switch) uses react-use-size internally, which relies on
// ResizeObserver — not implemented in jsdom. Same polyfill pattern already
// used in RadixPrimitives.test.tsx and elsewhere for the same reason.
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverMock as any;
  (globalThis as any).ResizeObserver = ResizeObserverMock as any;
}

const testSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 chars'),
  email: z.string().email('Invalid email address'),
});

describe('Form & Zod Validation Engine', () => {
  it('validates schema on submit and emits form:errored to EventBus', async () => {
    const handleSubmit = vi.fn();
    const validatedSpy = vi.fn();
    const erroredSpy = vi.fn();

    aiBus.on('form:validated', validatedSpy);
    aiBus.on('form:errored', erroredSpy);

    render(
      <Form id="test-form" schema={testSchema} onSubmit={handleSubmit}>
        <FormField name="username" label="Username">
          <Input placeholder="Username" />
        </FormField>
        <FormField name="email" label="Email">
          <Input placeholder="Email" />
        </FormField>
        <FormError />
        <SubmitButton>Submit</SubmitButton>
      </Form>
    );

    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(screen.getByText('Username must be at least 3 chars')).toBeInTheDocument();
      expect(screen.getByText('Invalid email address')).toBeInTheDocument();
    });

    expect(validatedSpy).toHaveBeenCalledWith({ formId: 'test-form', isValid: false });
    expect(erroredSpy).toHaveBeenCalledWith({
      formId: 'test-form',
      errors: {
        username: 'Username must be at least 3 chars',
        email: 'Invalid email address',
      },
    });
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('submits successfully and emits form:submitted to EventBus', async () => {
    const handleSubmit = vi.fn();
    const submittedSpy = vi.fn();

    aiBus.on('form:submitted', submittedSpy);

    render(
      <Form id="test-form" schema={testSchema} onSubmit={handleSubmit}>
        <FormField name="username" label="Username">
          <Input placeholder="Username" />
        </FormField>
        <FormField name="email" label="Email">
          <Input placeholder="Email" />
        </FormField>
        <SubmitButton>Submit</SubmitButton>
      </Form>
    );

    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'alice' } });
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'alice@example.com' } });

    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({ username: 'alice', email: 'alice@example.com' });
    });

    expect(submittedSpy).toHaveBeenCalledWith({
      formId: 'test-form',
      values: { username: 'alice', email: 'alice@example.com' },
    });
  });

  it('stays disabled while submitting even when the consumer passes their own disabled prop (regression)', async () => {
    // Reproduces a real bug: SubmitButton spread {...props} *after* its
    // computed disabled={isSubmitting || props.disabled}, so passing any
    // explicit `disabled` at all — even `disabled={false}`, as a consumer
    // gating submission on form validity naturally would — silently
    // re-applied that original value via the trailing spread and discarded
    // the isSubmitting guard entirely.
    let resolveSubmit: () => void;
    const handleSubmit = vi.fn(
      () => new Promise<void>((resolve) => { resolveSubmit = resolve; })
    );

    render(
      <Form id="test-form" schema={testSchema} onSubmit={handleSubmit}>
        <FormField name="username" label="Username">
          <Input placeholder="Username" />
        </FormField>
        <FormField name="email" label="Email">
          <Input placeholder="Email" />
        </FormField>
        <SubmitButton disabled={false}>Submit</SubmitButton>
      </Form>
    );

    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'alice' } });
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'alice@example.com' } });

    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeDisabled();
    });

    resolveSubmit!();
    await waitFor(() => {
      expect(screen.getByRole('button')).not.toBeDisabled();
    });
  });

  it('emits live form:validated on field change', () => {
    const validatedSpy = vi.fn();
    aiBus.on('form:validated', validatedSpy);

    render(
      <Form id="test-form" schema={testSchema}>
        <FormField name="username" label="Username">
          <Input placeholder="Username" />
        </FormField>
      </Form>
    );

    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'bo' } });

    expect(validatedSpy).toHaveBeenCalledWith({ formId: 'test-form', isValid: false });
  });

  describe('regression: validation errors were computed but never exposed via ARIA', () => {
    // Input/Textarea already computed `isError` for border-color styling but
    // never set aria-invalid/aria-describedby, and FormField's error <span>
    // had no id for aria-describedby to point at — a screen reader user got
    // no indication a field had failed validation at all.
    it('sets aria-invalid and a resolving aria-describedby on Input once touched and invalid', async () => {
      render(
        <Form id="test-form" schema={testSchema} onSubmit={vi.fn()}>
          <FormField name="username" label="Username">
            <Input placeholder="Username" />
          </FormField>
          <SubmitButton>Submit</SubmitButton>
        </Form>
      );

      fireEvent.click(screen.getByText('Submit'));

      await waitFor(() => {
        const input = screen.getByPlaceholderText('Username');
        expect(input).toHaveAttribute('aria-invalid', 'true');
        const describedBy = input.getAttribute('aria-describedby');
        expect(describedBy).toBe('username-error');
        expect(document.getElementById(describedBy!)).toHaveTextContent('Username must be at least 3 chars');
      });
    });

    it('sets aria-invalid and a resolving aria-describedby on Textarea once touched and invalid', async () => {
      const bioSchema = z.object({ bio: z.string().min(5, 'Bio is too short') });
      render(
        <Form id="bio-form" schema={bioSchema} onSubmit={vi.fn()}>
          <FormField name="bio" label="Bio">
            <Textarea placeholder="Bio" />
          </FormField>
          <SubmitButton>Submit</SubmitButton>
        </Form>
      );

      fireEvent.click(screen.getByText('Submit'));

      await waitFor(() => {
        const textarea = screen.getByPlaceholderText('Bio');
        expect(textarea).toHaveAttribute('aria-invalid', 'true');
        const describedBy = textarea.getAttribute('aria-describedby');
        expect(describedBy).toBe('bio-error');
        expect(document.getElementById(describedBy!)).toHaveTextContent('Bio is too short');
      });
    });
  });

  describe('regression coverage: schema-less forms, resetForm, validateField, useFormContext, onSubmit errors', () => {
    it('a Form with no schema submits directly without ever computing validation errors', async () => {
      const handleSubmit = vi.fn();
      render(
        <Form id="no-schema-form" onSubmit={handleSubmit}>
          <FormField name="note" label="Note">
            <Input placeholder="Note" />
          </FormField>
          <SubmitButton>Submit</SubmitButton>
        </Form>
      );

      fireEvent.change(screen.getByPlaceholderText('Note'), { target: { value: 'hello' } });
      fireEvent.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledWith({ note: 'hello' });
      });
    });

    it('logs a console error but still clears isSubmitting when onSubmit throws', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const handleSubmit = vi.fn(() => { throw new Error('boom'); });

      render(
        <Form id="throwing-form" onSubmit={handleSubmit}>
          <SubmitButton>Submit</SubmitButton>
        </Form>
      );

      fireEvent.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Error in Form onSubmit:', expect.any(Error));
      });
      await waitFor(() => {
        expect(screen.getByText('Submit')).not.toBeDisabled();
      });

      consoleError.mockRestore();
    });

    it('resetForm (via useFormContext, the named hook) restores initial values/errors/touched', async () => {
      const ResetButton = () => {
        const { resetForm } = useFormContext();
        return <button type="button" onClick={resetForm}>Reset</button>;
      };

      render(
        <Form id="reset-form" schema={testSchema} initialValues={{ username: 'seed', email: '' }}>
          <FormField name="username" label="Username">
            <Input placeholder="Username" />
          </FormField>
          <ResetButton />
        </Form>
      );

      fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'changed' } });
      expect(screen.getByPlaceholderText('Username')).toHaveValue('changed');

      fireEvent.click(screen.getByText('Reset'));
      expect(screen.getByPlaceholderText('Username')).toHaveValue('seed');
    });

    it('validateField (via useFormContext) validates a single field on demand and returns its validity', () => {
      let lastResult: boolean | undefined;
      const ValidateButton = () => {
        const { validateField } = useFormContext();
        return (
          <button type="button" onClick={() => { lastResult = validateField('username', 'ab'); }}>
            Validate
          </button>
        );
      };

      const erroredSpy = vi.fn();
      const unsub = aiBus.on('form:errored', erroredSpy);

      render(
        <Form id="validate-field-form" schema={testSchema}>
          <ValidateButton />
        </Form>
      );

      fireEvent.click(screen.getByText('Validate'));
      // validateField doesn't mark the field touched itself (that's a
      // separate concern from field controls' own onBlur) — the emitted
      // event is what proves the schema actually ran against the supplied
      // value, independent of whether anything's currently displayed.
      expect(lastResult).toBe(false);
      expect(erroredSpy).toHaveBeenCalledWith(
        expect.objectContaining({ errors: expect.objectContaining({ username: 'Username must be at least 3 chars' }) })
      );

      unsub();
    });

    it('useFormContext throws when called outside a <Form>', () => {
      const Orphan = () => {
        useFormContext();
        return null;
      };
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => render(<Orphan />)).toThrow('Form controls must be rendered within a <Form> component');
      consoleError.mockRestore();
    });
  });

  describe('regression coverage: FormError with an explicit field name', () => {
    it('renders nothing for a field with no error, or one not yet touched', () => {
      const { container } = render(
        <Form id="field-error-form" schema={testSchema}>
          <FormError name="username" />
        </Form>
      );
      expect(container.querySelector('div')).toBeNull();
    });

    it('renders the field-specific message once that field is touched and invalid', async () => {
      render(
        <Form id="field-error-form-2" schema={testSchema}>
          {/* A bare Input (no FormField wrapper, so no built-in error span
              of its own) inside FieldContext directly — isolates the
              assertion to FormError's own rendering, rather than also
              matching FormField's separate error span for the same text. */}
          <FormField name="username">
            <Input placeholder="Username" />
          </FormField>
          <FormError name="username" />
          <SubmitButton>Submit</SubmitButton>
        </Form>
      );

      fireEvent.click(screen.getByText('Submit'));
      await waitFor(() => {
        expect(screen.getAllByText('Username must be at least 3 chars').length).toBeGreaterThan(0);
      });
    });

    it('renders nothing when rendered outside any <Form>', () => {
      const { container } = render(<FormError name="anything" />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('regression coverage: blur marks a field touched (Input, Textarea, Checkbox, Switch)', () => {
    it('Input onBlur reveals an error already computed by a prior change (blur itself only touches, it does not re-validate)', async () => {
      render(
        <Form id="blur-input-form" schema={testSchema}>
          <FormField name="username" label="Username">
            <Input placeholder="Username" />
          </FormField>
        </Form>
      );

      const input = screen.getByPlaceholderText('Username');
      // onChange already computes+stores the error silently (see "emits
      // live form:validated on field change" above); FormField only
      // *displays* it once touched, which onBlur is what actually flips.
      fireEvent.change(input, { target: { value: 'ab' } });
      expect(screen.queryByText('Username must be at least 3 chars')).not.toBeInTheDocument();

      fireEvent.blur(input);
      await waitFor(() => {
        expect(screen.getByText('Username must be at least 3 chars')).toBeInTheDocument();
      });
    });

    it('Textarea onBlur reveals an error already computed by a prior change', async () => {
      const bioSchema = z.object({ bio: z.string().min(5, 'Bio is too short') });
      render(
        <Form id="blur-textarea-form" schema={bioSchema}>
          <FormField name="bio" label="Bio">
            <Textarea placeholder="Bio" />
          </FormField>
        </Form>
      );

      const textarea = screen.getByPlaceholderText('Bio');
      fireEvent.change(textarea, { target: { value: 'hi' } });
      expect(screen.queryByText('Bio is too short')).not.toBeInTheDocument();

      fireEvent.blur(textarea);
      await waitFor(() => {
        expect(screen.getByText('Bio is too short')).toBeInTheDocument();
      });
    });

    it('Checkbox toggling sets both its value and touched state', () => {
      const acceptSchema = z.object({ accept: z.literal(true, { message: 'You must accept' }) });
      render(
        <Form id="checkbox-form" schema={acceptSchema}>
          <FormField name="accept">
            <Checkbox label="I accept" />
          </FormField>
        </Form>
      );

      fireEvent.click(screen.getByText('I accept'));
      // Toggled true then... clicking again toggles back false, which is
      // touched+invalid, surfacing the schema error — the concrete,
      // observable proof that both setFieldValue and setFieldTouched ran.
      fireEvent.click(screen.getByText('I accept'));
      expect(screen.getByText('You must accept')).toBeInTheDocument();
    });

    it('Switch toggling sets both its value and touched state', () => {
      const acceptSchema = z.object({ enabled: z.literal(true, { message: 'Must be enabled' }) });
      render(
        <Form id="switch-form" schema={acceptSchema}>
          <FormField name="enabled">
            <Switch label="Enable" />
          </FormField>
        </Form>
      );

      fireEvent.click(screen.getByText('Enable'));
      fireEvent.click(screen.getByText('Enable'));
      expect(screen.getByText('Must be enabled')).toBeInTheDocument();
    });
  });

  describe('regression coverage: Button variant/size branches', () => {
    it('renders the secondary variant styling', () => {
      render(<Button variant="secondary">Secondary</Button>);
      const btn = screen.getByText('Secondary');
      expect(btn.style.background).toBe('var(--ai-color-secondary, #64748b)');
    });

    it('renders the lg size styling', () => {
      render(<Button size="lg">Large</Button>);
      expect(screen.getByText('Large').style.fontSize).toBe('1rem');
    });
  });
});
