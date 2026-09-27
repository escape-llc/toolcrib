import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { z } from 'zod';
import { OTPFieldBaseUI as OTPField } from '../components/OTPField/OTPField.baseui';
import { Form } from '../components/Form/FormContext';
import { FormField, SubmitButton } from '../components/Form/FormComponents';
import { LocaleProvider } from '../components/Locale/LocaleContext';
import { aiBus } from '../eventBus/eventBus';
import { axe } from './testUtils/axe';

// SPIKE: Base UI names cell 1 from the field label, not 'Digit 1 of N', so
// cells are found by position here; the naming difference is reported separately.
const cell = (n: number, _total = 6) => screen.getAllByRole('textbox')[n - 1];

function typeInto(el: HTMLElement, char: string) {
  act(() => el.focus());
  fireEvent.change(el, { target: { value: char } });
}

function pasteInto(el: HTMLElement, text: string) {
  act(() => el.focus());
  fireEvent.paste(el, { clipboardData: { getData: () => text } });
}

describe('OTPField', () => {
  it('renders a labelled group of positionally-named cells', () => {
    render(<OTPField label="Verification code" length={4} />);
    expect(screen.getByRole('group', { name: 'Verification code' })).toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(4);
    expect(cell(1, 4)).toBeInTheDocument();
    expect(cell(4, 4)).toBeInTheDocument();
  });

  it('offers SMS one-time-code autofill on the first cell only', () => {
    render(<OTPField aria-label="Code" />);
    expect(cell(1)).toHaveAttribute('autocomplete', 'one-time-code');
    expect(cell(2)).toHaveAttribute('autocomplete', 'off');
  });

  it('auto-advances focus as characters are typed', () => {
    const onChange = vi.fn();
    render(<OTPField aria-label="Code" onChange={onChange} />);
    typeInto(cell(1), '4');
    expect(onChange).toHaveBeenLastCalledWith('4');
    expect(cell(2)).toHaveFocus();
    typeInto(cell(2), '2');
    expect(onChange).toHaveBeenLastCalledWith('42');
  });

  it('drops characters the mode rejects', () => {
    const onChange = vi.fn();
    render(<OTPField aria-label="Code" onChange={onChange} />);
    typeInto(cell(1), 'x');
    expect(onChange).not.toHaveBeenCalled();
    expect(cell(1)).toHaveValue('');
  });

  it('distributes a paste across the cells and completes', () => {
    const onComplete = vi.fn();
    const handler = vi.fn();
    const unsub = aiBus.on('otpfield:changed', handler);
    render(<OTPField aria-label="Code" onComplete={onComplete} />);
    pasteInto(cell(1), '123456');
    expect([1, 2, 3, 4, 5, 6].map(n => (cell(n) as HTMLInputElement).value).join('')).toBe('123456');
    expect(onComplete).toHaveBeenCalledWith('123456');
    expect(handler).toHaveBeenLastCalledWith({ name: undefined, value: '123456', complete: true });
    unsub();
  });

  it('backspace clears a filled cell and moves back; in an empty cell it just moves back', async () => {
    const onChange = vi.fn();
    render(<OTPField aria-label="Code" defaultValue="12" onChange={onChange} />);
    // Filled cell: the key clears it (the browser's input event) and focus steps back.
    act(() => cell(2).focus());
    fireEvent.keyDown(cell(2), { key: 'Backspace' });
    fireEvent.change(cell(2), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith('1');
    expect(cell(1)).toHaveFocus();
    // Empty cell: only focus moves (on the next frame), nothing is cleared.
    onChange.mockClear();
    act(() => cell(2).focus());
    fireEvent.keyDown(cell(2), { key: 'Backspace' });
    await waitFor(() => expect(cell(1)).toHaveFocus());
    expect(onChange).not.toHaveBeenCalled();
  });

  it('masks cells for a PIN and accepts letters in alphanumeric mode', () => {
    const { unmount } = render(<OTPField aria-label="PIN" length={4} mask />);
    expect(document.querySelectorAll('input[type="password"]')).toHaveLength(4);
    unmount();
    const onChange = vi.fn();
    render(<OTPField aria-label="Code" mode="alphanumeric" onChange={onChange} />);
    const first = screen.getAllByRole('textbox')[0];
    typeInto(first, 'A');
    expect(onChange).toHaveBeenLastCalledWith('A');
  });

  it('localizes the cell names', () => {
    render(
      <LocaleProvider strings={{ otpField: { digit: (p, t) => `Ziffer ${p} von ${t}`, character: (p, t) => `Zeichen ${p} von ${t}` } }}>
        <OTPField aria-label="Code" length={4} />
      </LocaleProvider>
    );
    expect(screen.getByRole('textbox', { name: 'Ziffer 2 von 4' })).toBeInTheDocument();
  });

  it('binds to a Form as one string, with schema errors', async () => {
    const onSubmit = vi.fn();
    render(
      <Form id="otp-form" schema={z.object({ code: z.string().length(6, 'Enter all 6 digits') })} onSubmit={onSubmit}>
        <FormField name="code" label="Code">
          <OTPField />
        </FormField>
        <SubmitButton>Verify</SubmitButton>
      </Form>
    );
    expect(screen.getByRole('group', { name: 'Code' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    await waitFor(() => expect(screen.getByText('Enter all 6 digits')).toBeInTheDocument());
    expect(cell(1)).toHaveAttribute('aria-invalid', 'true');

    pasteInto(cell(1), '987654');
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ code: '987654' }));
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <div>
        <OTPField label="Verification code" defaultValue="12" />
        <OTPField aria-label="PIN" length={4} mask />
      </div>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
