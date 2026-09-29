import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { z } from 'zod';
import { OTPField } from '../components/OTPField/OTPField';
import { Form } from '../components/Form/FormContext';
import { FormField, SubmitButton } from '../components/Form/FormComponents';
import { LocaleProvider } from '../components/Locale/LocaleContext';
import { aiBus } from '../eventBus/eventBus';
import { axe } from './testUtils/axe';

const cell = (n: number, total = 6) => screen.getByRole('textbox', { name: `Digit ${n} of ${total}` });

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

  it('backspace clears a filled cell and moves back; in an empty cell it deletes the previous character', async () => {
    const onChange = vi.fn();
    render(<OTPField aria-label="Code" defaultValue="123" onChange={onChange} />);
    // Filled cell: the key clears it and focus steps back.
    act(() => cell(3).focus());
    act(() => { fireEvent.keyDown(cell(3), { key: 'Backspace' }); });
    expect(onChange).toHaveBeenLastCalledWith('12');
    await waitFor(() => expect(cell(2)).toHaveFocus());
    // Empty cell (#701, Base UI): one Backspace per character wherever the
    // caret is -- it deletes the previous cell's character and moves there.
    // The Radix version only moved focus.
    act(() => cell(3).focus());
    act(() => { fireEvent.keyDown(cell(3), { key: 'Backspace' }); });
    expect(onChange).toHaveBeenLastCalledWith('1');
    await waitFor(() => expect(cell(2)).toHaveFocus());
  });

  it('masks cells for a PIN and accepts letters in alphanumeric mode', () => {
    const { unmount } = render(<OTPField aria-label="PIN" length={4} mask />);
    expect(screen.getByLabelText('Digit 1 of 4')).toHaveAttribute('type', 'password');
    unmount();
    const onChange = vi.fn();
    render(<OTPField aria-label="Code" mode="alphanumeric" onChange={onChange} />);
    const first = screen.getByLabelText('Character 1 of 6');
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
