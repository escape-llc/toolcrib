import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { z } from 'zod';
import { Form } from '../components/Form/FormContext';
import { FormField, Input, Textarea, FormError, SubmitButton } from '../components/Form/FormComponents';
import { aiBus } from '../eventBus/eventBus';

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
});
