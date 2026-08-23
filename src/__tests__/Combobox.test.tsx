import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { z } from 'zod';
import { Combobox } from '../components/Form/Combobox';
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

describe('Combobox Component — client-side filtering', () => {
  it('filters the listbox by substring as the user types', () => {
    render(<Combobox options={options} onChange={vi.fn()} />);
    const input = screen.getByRole('combobox');

    fireEvent.change(input, { target: { value: 'ed' } });
    expect(screen.getByText('Editor')).toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
    expect(screen.queryByText('Viewer')).not.toBeInTheDocument();
  });

  it('shows a no-results message when nothing matches', () => {
    render(<Combobox options={options} onChange={vi.fn()} noResultsMessage="Nothing found" />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'zzz' } });
    expect(screen.getByText('Nothing found')).toBeInTheDocument();
  });

  it('renders custom option content via render(), while filtering still matches against the plain label text', () => {
    const richOptions = [
      { label: 'Admin', value: 'admin', render: (opt: { label: string }) => <em data-testid="rich-admin">{opt.label} role</em> },
      { label: 'Editor', value: 'editor' },
    ];
    render(<Combobox options={richOptions} onChange={vi.fn()} />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'adm' } });

    expect(screen.getByTestId('rich-admin')).toHaveTextContent('Admin role');
    expect(screen.queryByText('Editor')).not.toBeInTheDocument();
  });

  it('selects an option via pointer interaction, closes the listbox, and emits combobox:changed', () => {
    const onChange = vi.fn();
    const changedFn = vi.fn();
    const unsub = aiBus.on('combobox:changed', changedFn);

    render(<Combobox name="role" options={options} onChange={onChange} />);
    const input = screen.getByRole('combobox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'ed' } });

    fireEvent.mouseDown(screen.getByText('Editor'));

    expect(input.value).toBe('Editor');
    expect(onChange).toHaveBeenCalledWith('editor');
    expect(changedFn).toHaveBeenCalledWith({ name: 'role', value: 'editor' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    unsub();
  });

  it('moves the active option with arrow keys and selects it with Enter', () => {
    const onChange = vi.fn();
    render(<Combobox options={options} onChange={onChange} />);
    const input = screen.getByRole('combobox');

    fireEvent.keyDown(input, { key: 'ArrowDown' }); // opens, activeIndex stays 0 (Admin)
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // -> Editor
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('editor');
  });

  it('Escape closes the listbox, per the WAI-ARIA APG Combobox pattern', () => {
    render(<Combobox options={options} onChange={vi.fn()} />);
    const input = screen.getByRole('combobox');

    fireEvent.keyDown(input, { key: 'ArrowDown' }); // opens
    expect(input).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('scrolls the newly-active option into view on every arrow-key move, so it can\'t scroll past the listbox\'s visible viewport and "disappear" (reported directly)', () => {
    const scrollIntoViewSpy = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});
    render(<Combobox options={options} onChange={vi.fn()} />);
    const input = screen.getByRole('combobox');

    fireEvent.keyDown(input, { key: 'ArrowDown' }); // opens, activeIndex stays 0 (Admin)
    scrollIntoViewSpy.mockClear(); // only care about moves after the listbox is already open and mounted

    fireEvent.keyDown(input, { key: 'ArrowDown' }); // -> Editor
    expect(scrollIntoViewSpy).toHaveBeenCalledWith({ block: 'nearest' });

    scrollIntoViewSpy.mockClear();
    fireEvent.keyDown(input, { key: 'ArrowUp' }); // -> back to Admin
    expect(scrollIntoViewSpy).toHaveBeenCalledWith({ block: 'nearest' });

    scrollIntoViewSpy.mockRestore();
  });

  it('disables the input and never opens the listbox when disabled', () => {
    render(<Combobox options={options} onChange={vi.fn()} disabled />);
    const input = screen.getByRole('combobox') as HTMLInputElement;
    expect(input).toBeDisabled();

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'ed' } });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('reverts to the last selected label on blur when the typed text matches nothing (allowCustomValue false)', () => {
    render(<Combobox options={options} defaultValue="editor" onChange={vi.fn()} />);
    const input = screen.getByRole('combobox') as HTMLInputElement;
    expect(input.value).toBe('Editor');

    fireEvent.change(input, { target: { value: 'gibberish' } });
    fireEvent.blur(input);

    expect(input.value).toBe('Editor');
  });

  it('commits freeform typed text on blur when allowCustomValue is true', () => {
    const onChange = vi.fn();
    render(<Combobox options={options} onChange={onChange} allowCustomValue />);
    const input = screen.getByRole('combobox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'Custom Role' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith('Custom Role');
  });

  it('clears the value via the clear button', () => {
    const onChange = vi.fn();
    render(<Combobox options={options} defaultValue="editor" onChange={onChange} />);
    const input = screen.getByRole('combobox') as HTMLInputElement;
    expect(input.value).toBe('Editor');

    fireEvent.click(screen.getByLabelText('Clear selection'));

    expect(input.value).toBe('');
    expect(onChange).toHaveBeenCalledWith('');
  });
});

describe('Combobox Component — async search', () => {
  it('does not open the panel or call onSearch on mere focus/click — only once the debounced search actually fires (reported directly: focusing an async Combobox popped an empty panel open before anything was typed)', () => {
    const onSearch = vi.fn().mockResolvedValue([{ label: 'Async Result', value: 'r1' }]);
    render(<Combobox onSearch={onSearch} searchDebounceMs={10} onChange={vi.fn()} />);
    const input = screen.getByRole('combobox');

    fireEvent.focus(input);
    fireEvent.click(input);
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('debounces onSearch, only opening/showing a loading state once the search actually fires, then replaces the listbox with results', async () => {
    const onSearch = vi.fn().mockResolvedValue([{ label: 'Async Result', value: 'r1' }]);
    render(<Combobox onSearch={onSearch} searchDebounceMs={10} onChange={vi.fn()} />);
    const input = screen.getByRole('combobox');

    fireEvent.change(input, { target: { value: 'query' } });
    // Still closed immediately after typing -- the panel only opens once
    // the debounce elapses and the search itself fires, not on every
    // keystroke.
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

    fireEvent.change(input, { target: { value: 'a' } });
    await waitFor(() => expect(onSearch).toHaveBeenCalledTimes(1));
    fireEvent.change(input, { target: { value: 'ab' } });
    await waitFor(() => expect(onSearch).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText('Second Result')).toBeInTheDocument());

    // The first (slower) request resolving afterward must not clobber it.
    resolveFirst([{ label: 'First Result', value: 'r1' }]);
    await new Promise(r => setTimeout(r, 20));
    expect(screen.queryByText('First Result')).not.toBeInTheDocument();
    expect(screen.getByText('Second Result')).toBeInTheDocument();
  });
});

describe('Combobox Component — multiple mode', () => {
  it('selects options as removable chips instead of filling the input text', () => {
    const onChange = vi.fn();
    render(<Combobox multiple options={options} onChange={onChange} />);
    const input = screen.getByRole('combobox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'ed' } });
    fireEvent.mouseDown(screen.getByText('Editor'));

    expect(onChange).toHaveBeenCalledWith(['editor']);
    // The query clears (not filled with the label) — selections render as
    // chips. The listbox itself stays open (see the next test), so "Editor"
    // is now on screen twice — the chip and the still-visible option — the
    // remove button is what's unambiguous to the chip.
    expect(input.value).toBe('');
    expect(screen.getByLabelText('Remove Editor')).toBeInTheDocument();
  });

  it('keeps the listbox open after a selection so multiple picks do not require reopening it', () => {
    render(<Combobox multiple options={options} onChange={vi.fn()} />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('toggles an already-selected option off when selected again', () => {
    const onChange = vi.fn();
    render(<Combobox multiple defaultValue={['admin', 'editor']} options={options} onChange={onChange} />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    // Both an "Admin" chip and an "Admin" listbox option are on screen at
    // this point — scope to the listbox to target the option unambiguously.
    fireEvent.mouseDown(within(screen.getByRole('listbox')).getByText('Admin'));
    expect(onChange).toHaveBeenCalledWith(['editor']);
  });

  it('removes the last chip on Backspace when the query is empty', () => {
    const onChange = vi.fn();
    render(<Combobox multiple defaultValue={['admin', 'editor']} options={options} onChange={onChange} />);
    const input = screen.getByRole('combobox');
    fireEvent.keyDown(input, { key: 'Backspace' });
    expect(onChange).toHaveBeenCalledWith(['admin']);
  });

  it('removes a chip via its own remove button', () => {
    const onChange = vi.fn();
    render(<Combobox multiple defaultValue={['admin', 'editor']} options={options} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Remove Admin'));
    expect(onChange).toHaveBeenCalledWith(['editor']);
  });

  it('clears every chip via the clear button', () => {
    const onChange = vi.fn();
    render(<Combobox multiple defaultValue={['admin', 'editor']} options={options} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Clear selection'));
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

    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(screen.getByText('Please choose a role')).toBeInTheDocument();
    });
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  describe('regression: missing id broke FormField label association and ARIA error state', () => {
    // Same root cause as Select's own fix: Combobox tracked fieldName/
    // formContext already, but never used either for `id` or for
    // isError/aria-invalid/aria-describedby.
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

      fireEvent.click(screen.getByText('Submit'));

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
