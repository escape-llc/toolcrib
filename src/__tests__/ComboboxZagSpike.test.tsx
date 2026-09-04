// SPIKE evaluation for issue #124 -- not a permanent test file. Delete
// alongside src/components/Form/ComboboxZagSpike.tsx once the evaluation is
// resolved one way or the other.
//
// Adapted from Combobox.test.tsx with two structural changes, both required
// specifically because @zag-js/react's useMachine defers every state
// transition through queueMicrotask + flushSync (confirmed by direct probing
// against the installed package, not assumed from docs):
//
// 1. Every interaction that should produce a visible update is wrapped in
//    `await act(async () => { fireEvent...; await flushMicrotasks(); })` --
//    a bare synchronous `fireEvent.x(...)` followed immediately by an
//    assertion (the original file's style throughout) never sees the
//    update, because zag's send() hasn't run its queued transition yet.
// 2. `fireEvent.change` alone is a no-op unless a `fireEvent.focus` precedes
//    it -- zag's combobox machine models the real "focus, then type"
//    sequence as an actual state precondition (the INPUT.CHANGE transition
//    that opens the panel only exists once the machine has already left the
//    "closed.idle" state via a focus event), unlike the real Combobox's
//    hand-rolled onChange, which has no such prerequisite.
//
// Everything else -- assertions, option data, scenario structure -- is
// unchanged from Combobox.test.tsx, so a side-by-side diff of the two files
// is itself part of the spike's evidence.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { z } from 'zod';
import { ComboboxZagSpike as Combobox } from '../components/Form/ComboboxZagSpike';
import { Form } from '../components/Form/FormContext';
import { FormField, SubmitButton } from '../components/Form/FormComponents';
import { aiBus } from '../eventBus/eventBus';

if (typeof window !== 'undefined' && !window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverMock as any;
  (globalThis as any).ResizeObserver = ResizeObserverMock as any;
}

const options = [
  { label: 'Admin', value: 'admin' },
  { label: 'Editor', value: 'editor' },
  { label: 'Viewer', value: 'viewer' },
];

const flush = () => act(async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
});

async function focusAndType(input: HTMLElement, value: string) {
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
  await flush();
}

async function press(input: HTMLElement, key: string) {
  fireEvent.keyDown(input, { key });
  await flush();
}

async function click(el: HTMLElement) {
  fireEvent.mouseDown(el);
  fireEvent.click(el);
  await flush();
}

describe('Combobox Component — client-side filtering', () => {
  it('filters the listbox by substring as the user types', async () => {
    render(<Combobox options={options} onChange={vi.fn()} />);
    const input = screen.getByRole('combobox');

    await focusAndType(input, 'ed');
    expect(screen.getByText('Editor')).toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
    expect(screen.queryByText('Viewer')).not.toBeInTheDocument();
  });

  it('shows a no-results message when nothing matches', async () => {
    render(<Combobox options={options} onChange={vi.fn()} noResultsMessage="Nothing found" />);
    const input = screen.getByRole('combobox');
    await focusAndType(input, 'zzz');
    expect(screen.getByText('Nothing found')).toBeInTheDocument();
  });

  it('renders custom option content via render(), while filtering still matches against the plain label text', async () => {
    const richOptions = [
      { label: 'Admin', value: 'admin', render: (opt: { label: string }) => <em data-testid="rich-admin">{opt.label} role</em> },
      { label: 'Editor', value: 'editor' },
    ];
    render(<Combobox options={richOptions} onChange={vi.fn()} />);
    const input = screen.getByRole('combobox');
    await focusAndType(input, 'adm');

    expect(screen.getByTestId('rich-admin')).toHaveTextContent('Admin role');
    expect(screen.queryByText('Editor')).not.toBeInTheDocument();
  });

  it('selects an option via pointer interaction, closes the listbox, and emits combobox:changed', async () => {
    const onChange = vi.fn();
    const changedFn = vi.fn();
    const unsub = aiBus.on('combobox:changed', changedFn);

    render(<Combobox name="role" options={options} onChange={onChange} />);
    const input = screen.getByRole('combobox') as HTMLInputElement;
    await focusAndType(input, 'ed');

    await click(screen.getByText('Editor'));

    expect(input.value).toBe('Editor');
    expect(onChange).toHaveBeenCalledWith('editor');
    expect(changedFn).toHaveBeenCalledWith({ name: 'role', value: 'editor' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    unsub();
  });

  it('moves the active option with arrow keys and selects it with Enter', async () => {
    const onChange = vi.fn();
    render(<Combobox options={options} onChange={onChange} />);
    const input = screen.getByRole('combobox');

    fireEvent.focus(input);
    await flush();
    await press(input, 'ArrowDown'); // opens, highlights Admin
    await press(input, 'ArrowDown'); // -> Editor
    await press(input, 'Enter');

    expect(onChange).toHaveBeenCalledWith('editor');
  });

  it('Escape closes the listbox, per the WAI-ARIA APG Combobox pattern', async () => {
    render(<Combobox options={options} onChange={vi.fn()} />);
    const input = screen.getByRole('combobox');

    fireEvent.focus(input);
    await flush();
    await press(input, 'ArrowDown'); // opens
    expect(input).toHaveAttribute('aria-expanded', 'true');

    await press(input, 'Escape');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('disables the input and never opens the listbox when disabled', async () => {
    render(<Combobox options={options} onChange={vi.fn()} disabled />);
    const input = screen.getByRole('combobox') as HTMLInputElement;
    expect(input).toBeDisabled();

    await focusAndType(input, 'ed');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('reverts to the last selected label on blur when the typed text matches nothing (allowCustomValue false)', async () => {
    render(<Combobox options={options} defaultValue="editor" onChange={vi.fn()} />);
    const input = screen.getByRole('combobox') as HTMLInputElement;
    expect(input.value).toBe('Editor');

    await focusAndType(input, 'gibberish');
    fireEvent.blur(input);
    await flush();

    expect(input.value).toBe('Editor');
  });

  it('commits freeform typed text on blur when allowCustomValue is true', async () => {
    const onChange = vi.fn();
    render(<Combobox options={options} onChange={onChange} allowCustomValue />);
    const input = screen.getByRole('combobox') as HTMLInputElement;

    await focusAndType(input, 'Custom Role');
    fireEvent.blur(input);
    await flush();

    expect(onChange).toHaveBeenCalledWith('Custom Role');
  });

  it('clears the value via the clear button', async () => {
    const onChange = vi.fn();
    render(<Combobox options={options} defaultValue="editor" onChange={onChange} />);
    const input = screen.getByRole('combobox') as HTMLInputElement;
    expect(input.value).toBe('Editor');

    await click(screen.getByLabelText('Clear selection'));

    expect(input.value).toBe('');
    expect(onChange).toHaveBeenCalledWith('');
  });
});

describe('Combobox Component — async search', () => {
  it('does not open the panel or call onSearch on mere focus/click — only once the debounced search actually fires', async () => {
    const onSearch = vi.fn().mockResolvedValue([{ label: 'Async Result', value: 'r1' }]);
    render(<Combobox onSearch={onSearch} searchDebounceMs={10} onChange={vi.fn()} />);
    const input = screen.getByRole('combobox');

    fireEvent.focus(input);
    fireEvent.click(input);
    await flush();
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('debounces onSearch, only opening/showing a loading state once the search actually fires, then replaces the listbox with results', async () => {
    const onSearch = vi.fn().mockResolvedValue([{ label: 'Async Result', value: 'r1' }]);
    render(<Combobox onSearch={onSearch} searchDebounceMs={10} onChange={vi.fn()} />);
    const input = screen.getByRole('combobox');

    await focusAndType(input, 'query');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Searching…')).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('Async Result')).toBeInTheDocument());
    expect(onSearch).toHaveBeenCalledWith('query');
    expect(input).toHaveAttribute('aria-expanded', 'true');
  });

  it('ignores a stale response that resolves after a newer request', async () => {
    let resolveFirst: (v: { label: string; value: string }[]) => void = () => {};
    const first = new Promise<{ label: string; value: string }[]>(resolve => { resolveFirst = resolve; });
    const onSearch = vi.fn()
      .mockImplementationOnce(() => first)
      .mockImplementationOnce(async () => [{ label: 'Second Result', value: 'r2' }]);

    render(<Combobox onSearch={onSearch} searchDebounceMs={5} onChange={vi.fn()} />);
    const input = screen.getByRole('combobox');

    await focusAndType(input, 'a');
    await waitFor(() => expect(onSearch).toHaveBeenCalledTimes(1));
    await focusAndType(input, 'ab');
    await waitFor(() => expect(onSearch).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText('Second Result')).toBeInTheDocument());

    resolveFirst([{ label: 'First Result', value: 'r1' }]);
    await new Promise(r => setTimeout(r, 20));
    expect(screen.queryByText('First Result')).not.toBeInTheDocument();
    expect(screen.getByText('Second Result')).toBeInTheDocument();
  });
});

describe('Combobox Component — multiple mode', () => {
  it('selects options as removable chips instead of filling the input text', async () => {
    const onChange = vi.fn();
    render(<Combobox multiple options={options} onChange={onChange} />);
    const input = screen.getByRole('combobox') as HTMLInputElement;

    await focusAndType(input, 'ed');
    await click(screen.getByText('Editor'));

    expect(onChange).toHaveBeenCalledWith(['editor']);
    expect(input.value).toBe('');
    expect(screen.getByLabelText('Remove Editor')).toBeInTheDocument();
  });

  it('keeps the listbox open after a selection so multiple picks do not require reopening it', async () => {
    render(<Combobox multiple options={options} onChange={vi.fn()} />);
    const input = screen.getByRole('combobox');
    await focusAndType(input, 'a');
    await press(input, 'Enter');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('toggles an already-selected option off when selected again', async () => {
    const onChange = vi.fn();
    render(<Combobox multiple defaultValue={['admin', 'editor']} options={options} onChange={onChange} />);
    const input = screen.getByRole('combobox');
    await focusAndType(input, '');
    await click(within(screen.getByRole('listbox')).getByText('Admin'));
    expect(onChange).toHaveBeenCalledWith(['editor']);
  });

  it('removes the last chip on Backspace when the query is empty', async () => {
    const onChange = vi.fn();
    render(<Combobox multiple defaultValue={['admin', 'editor']} options={options} onChange={onChange} />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    await press(input, 'Backspace');
    expect(onChange).toHaveBeenCalledWith(['admin']);
  });

  it('removes a chip via its own remove button', async () => {
    const onChange = vi.fn();
    render(<Combobox multiple defaultValue={['admin', 'editor']} options={options} onChange={onChange} />);
    await click(screen.getByLabelText('Remove Admin'));
    expect(onChange).toHaveBeenCalledWith(['editor']);
  });

  it('clears every chip via the clear button', async () => {
    const onChange = vi.fn();
    render(<Combobox multiple defaultValue={['admin', 'editor']} options={options} onChange={onChange} />);
    await click(screen.getByLabelText('Clear selection'));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});

describe('Combobox Component — Form binding', () => {
  const roleSchema = z.object({
    role: z.string().min(1, 'Please choose a role'),
  });

  it('inherits its name from the surrounding FormField and shows its validation error on first submit', async () => {
    const handleSubmit = vi.fn();
    render(
      <Form id="role-form" schema={roleSchema} onSubmit={handleSubmit}>
        <FormField name="role" label="Role">
          <Combobox options={options} />
        </FormField>
        <SubmitButton>Submit</SubmitButton>
      </Form>
    );

    await click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(screen.getByText('Please choose a role')).toBeInTheDocument();
    });
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  describe('regression: missing id broke FormField label association and ARIA error state', () => {
    it('gives the input an id matching the surrounding FormField label\'s htmlFor', () => {
      render(
        <FormField name="role" label="Role">
          <Combobox options={options} onChange={vi.fn()} />
        </FormField>
      );

      const input = screen.getByRole('combobox');
      expect(input).toHaveAttribute('id', 'role');
      expect(screen.getByText('Role')).toHaveAttribute('for', 'role');
    });

    it('sets aria-invalid and a resolving aria-describedby once touched and invalid', async () => {
      const handleSubmit = vi.fn();
      render(
        <Form id="role-form-2" schema={roleSchema} onSubmit={handleSubmit}>
          <FormField name="role" label="Role">
            <Combobox options={options} />
          </FormField>
          <SubmitButton>Submit</SubmitButton>
        </Form>
      );

      await click(screen.getByText('Submit'));

      await waitFor(() => {
        const input = screen.getByRole('combobox');
        expect(input).toHaveAttribute('aria-invalid', 'true');
        const describedBy = input.getAttribute('aria-describedby');
        expect(describedBy).toBe('role-error');
        expect(document.getElementById(describedBy!)).toHaveTextContent('Please choose a role');
      });
    });
  });
});
