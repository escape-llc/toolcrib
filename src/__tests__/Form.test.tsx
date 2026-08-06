import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { z } from 'zod';
import { Form } from '../components/Form/FormContext';
import { FormField, Input, FormError, SubmitButton } from '../components/Form/FormComponents';
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
});
