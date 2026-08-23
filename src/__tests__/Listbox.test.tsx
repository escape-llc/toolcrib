import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Listbox, type ListboxOptionData } from '../components/Listbox/Listbox';

const options: ListboxOptionData[] = [
  { label: 'Admin', value: 'admin' },
  { label: 'Editor', value: 'editor' },
  { label: 'Viewer', value: 'viewer', disabled: true },
];

describe('Listbox', () => {
  it('renders every option\'s label by default', () => {
    render(<Listbox id="lb" options={options} onSelect={vi.fn()} />);
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Editor')).toBeInTheDocument();
    expect(screen.getByText('Viewer')).toBeInTheDocument();
  });

  it('supports aria-label/aria-labelledby for standalone use — no wrapping FormField convention applies here the way it does for other Form controls', () => {
    render(<Listbox id="lb" options={options} onSelect={vi.fn()} aria-label="Choose a role" />);
    expect(screen.getByRole('listbox', { name: 'Choose a role' })).toBeInTheDocument();
  });

  it('derives each option\'s id from the listbox\'s own id, so a caller can predict it for aria-activedescendant', () => {
    render(<Listbox id="lb" options={options} onSelect={vi.fn()} />);
    expect(document.getElementById('lb-option-0')).toHaveTextContent('Admin');
    expect(document.getElementById('lb-option-1')).toHaveTextContent('Editor');
  });

  it('calls onSelect on mousedown (not click), matching native listbox feel', () => {
    const onSelect = vi.fn();
    render(<Listbox id="lb" options={options} onSelect={onSelect} />);
    fireEvent.mouseDown(screen.getByText('Admin'));
    expect(onSelect).toHaveBeenCalledWith(options[0]);
    fireEvent.click(screen.getByText('Editor'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('never calls onSelect for a disabled option', () => {
    const onSelect = vi.fn();
    render(<Listbox id="lb" options={options} onSelect={onSelect} />);
    fireEvent.mouseDown(screen.getByText('Viewer'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('marks the option at activeIndex with data-highlighted', () => {
    render(<Listbox id="lb" options={options} activeIndex={1} onSelect={vi.fn()} />);
    expect(document.getElementById('lb-option-1')).toHaveAttribute('data-highlighted', '');
    expect(document.getElementById('lb-option-0')).not.toHaveAttribute('data-highlighted');
  });

  it('shows loadingMessage instead of options while loading', () => {
    render(<Listbox id="lb" options={options} loading onSelect={vi.fn()} />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });

  it('shows emptyMessage when there are no options and not loading', () => {
    render(<Listbox id="lb" options={[]} emptyMessage="Nothing here" onSelect={vi.fn()} />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('renders a trailing checkmark for selected options only when multiSelectable is true', () => {
    const { rerender } = render(
      <Listbox id="lb" options={options} selectedValues={['admin']} onSelect={vi.fn()} />
    );
    expect(screen.queryByText('✓')).not.toBeInTheDocument();

    rerender(<Listbox id="lb" options={options} selectedValues={['admin']} multiSelectable onSelect={vi.fn()} />);
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('uses render() for custom option content instead of the plain label, matching DataTable\'s own Column.render shape', () => {
    const customOptions: ListboxOptionData[] = [
      { label: 'admin', value: 'admin', render: opt => <strong data-testid="custom">{opt.label.toUpperCase()}</strong> },
    ];
    render(<Listbox id="lb" options={customOptions} onSelect={vi.fn()} />);
    expect(screen.getByTestId('custom')).toHaveTextContent('ADMIN');
  });
});
