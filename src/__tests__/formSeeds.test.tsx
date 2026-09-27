import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { z, type ZodType } from 'zod';
import type { ReactNode } from 'react';
import { Form } from '../components/Form/FormContext';
import { FormField, SubmitButton, Input, Textarea, Checkbox, Switch } from '../components/Form/FormComponents';
import { Select } from '../components/Form/Select';
import { Combobox } from '../components/Form/Combobox';
import { FileUpload } from '../components/Form/FileUpload';
import { RadioGroup } from '../components/Form/RadioGroup';

// Radix Checkbox/Switch render a hidden native input inside a real <form>,
// which measures itself with ResizeObserver; jsdom has none.
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverMock;
}
if (typeof window !== 'undefined' && !window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = () => {};
}

// Issue #667: registerField seeded every field with '' regardless of type
// and ignored the control's own default. Each case submits an untouched,
// Form-bound control and checks the value the schema actually received.
async function submitUntouched(schema: ZodType, field: ReactNode) {
  const onSubmit = vi.fn();
  render(
    <Form id="seed-form" schema={schema as ZodType<Record<string, unknown>>} onSubmit={onSubmit}>
      {field}
      <SubmitButton>Submit</SubmitButton>
    </Form>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalled());
  return onSubmit.mock.calls[0][0];
}

describe('typed Form seeds for untouched controls (#667)', () => {
  it('Checkbox submits false, so a plain z.boolean() passes', async () => {
    const values = await submitUntouched(z.object({ agree: z.boolean() }), <Checkbox name="agree" label="Agree" />);
    expect(values).toEqual({ agree: false });
  });

  it('Checkbox seeds from defaultChecked', async () => {
    const values = await submitUntouched(z.object({ agree: z.boolean() }), <Checkbox name="agree" label="Agree" defaultChecked />);
    expect(values).toEqual({ agree: true });
  });

  it('Switch submits false / its defaultChecked', async () => {
    const values = await submitUntouched(
      z.object({ a: z.boolean(), b: z.boolean() }),
      <>
        <Switch name="a" label="A" />
        <Switch name="b" label="B" defaultChecked />
      </>
    );
    expect(values).toEqual({ a: false, b: true });
  });

  it('FileUpload submits an empty file list', async () => {
    const values = await submitUntouched(z.object({ files: z.array(z.any()) }), <FileUpload name="files" />);
    expect(values).toEqual({ files: [] });
  });

  it('a multiple Combobox submits an empty array', async () => {
    const values = await submitUntouched(
      z.object({ tags: z.array(z.string()) }),
      <Combobox name="tags" multiple ariaLabel="Tags" options={[{ value: 'a', label: 'A' }]} />
    );
    expect(values).toEqual({ tags: [] });
  });

  it('string controls seed from their defaultValue', async () => {
    const values = await submitUntouched(
      z.object({ title: z.string(), notes: z.string(), size: z.string(), tone: z.string(), pick: z.string() }),
      <>
        <FormField name="title" label="Title"><Input defaultValue="Draft" /></FormField>
        <FormField name="notes" label="Notes"><Textarea defaultValue="n/a" /></FormField>
        <Select name="size" aria-label="Size" defaultValue="m" options={[{ value: 's', label: 'S' }, { value: 'm', label: 'M' }]} />
        <RadioGroup name="tone" defaultValue="calm" options={[{ value: 'calm', label: 'Calm' }, { value: 'loud', label: 'Loud' }]} />
        <Combobox name="pick" ariaLabel="Pick" defaultValue="b" options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]} />
      </>
    );
    expect(values).toEqual({ title: 'Draft', notes: 'n/a', size: 'm', tone: 'calm', pick: 'b' });
  });

  it("the Form's initialValues still win over a control's default", async () => {
    const onSubmit = vi.fn();
    render(
      <Form id="seed-init" schema={z.object({ agree: z.boolean(), title: z.string() })} initialValues={{ agree: false, title: 'From form' }} onSubmit={onSubmit}>
        <Checkbox name="agree" label="Agree" defaultChecked />
        <FormField name="title" label="Title"><Input defaultValue="From control" /></FormField>
        <SubmitButton>Submit</SubmitButton>
      </Form>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ agree: false, title: 'From form' }));
  });
});
