import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CommandPalette, CommandPaletteItemData } from '../components/CommandPalette/CommandPalette';
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

// cmdk calls scrollIntoView() on the active item whenever selection moves
// (including on mount/filter) -- jsdom doesn't implement it at all.
if (typeof window !== 'undefined' && !window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = () => {};
}

const items: CommandPaletteItemData[] = [
  { value: 'new-file', label: 'New File', group: 'File', onSelect: vi.fn() },
  { value: 'open-file', label: 'Open File', group: 'File', onSelect: vi.fn() },
  { value: 'toggle-theme', label: 'Toggle Theme', group: 'View', onSelect: vi.fn() },
];

describe('CommandPalette', () => {
  it('renders nothing when closed (Modal not open)', () => {
    render(<CommandPalette items={items} isOpen={false} />);
    expect(screen.queryByPlaceholderText('Type a command or search...')).not.toBeInTheDocument();
  });

  it('renders all items grouped by their `group` field when open', () => {
    render(<CommandPalette items={items} isOpen={true} onOpenChange={() => {}} />);
    expect(screen.getByText('New File')).toBeInTheDocument();
    expect(screen.getByText('Open File')).toBeInTheDocument();
    expect(screen.getByText('Toggle Theme')).toBeInTheDocument();
    expect(screen.getByText('File')).toBeInTheDocument();
    expect(screen.getByText('View')).toBeInTheDocument();
  });

  it('fuzzy-filters the list as the user types, without this wrapper redundantly managing selection', () => {
    render(<CommandPalette items={items} isOpen={true} onOpenChange={() => {}} />);
    const input = screen.getByPlaceholderText('Type a command or search...');
    fireEvent.change(input, { target: { value: 'theme' } });

    expect(screen.getByText('Toggle Theme')).toBeInTheDocument();
    expect(screen.queryByText('New File')).not.toBeInTheDocument();
    expect(screen.queryByText('Open File')).not.toBeInTheDocument();
  });

  it('shows the empty message when no item matches the search', () => {
    render(<CommandPalette items={items} isOpen={true} onOpenChange={() => {}} emptyMessage="Nothing here" />);
    const input = screen.getByPlaceholderText('Type a command or search...');
    fireEvent.change(input, { target: { value: 'zzz-no-match' } });
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('selecting an item calls its onSelect, emits commandpalette:item_selected, and closes the palette', () => {
    const selectedFn = vi.fn();
    const unsub = aiBus.on('commandpalette:item_selected', selectedFn);
    const onOpenChange = vi.fn();
    const onSelect = vi.fn();
    const localItems: CommandPaletteItemData[] = [{ value: 'save', label: 'Save', onSelect }];

    render(<CommandPalette id="test-palette" items={localItems} isOpen={true} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByText('Save'));

    expect(onSelect).toHaveBeenCalled();
    expect(selectedFn).toHaveBeenCalledWith({ id: 'test-palette', itemValue: 'save' });
    expect(onOpenChange).toHaveBeenCalledWith(false);

    unsub();
  });

  it('opens on Cmd/Ctrl+K when uncontrolled', () => {
    render(<CommandPalette items={items} />);
    expect(screen.queryByPlaceholderText('Type a command or search...')).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });

    expect(screen.getByPlaceholderText('Type a command or search...')).toBeInTheDocument();
  });

  it('opens via aiBus.openCommandPalette(id), targeted by id', () => {
    render(<CommandPalette id="palette-a" items={items} />);
    expect(screen.queryByPlaceholderText('Type a command or search...')).not.toBeInTheDocument();

    act(() => {
      aiBus.openCommandPalette('palette-a');
    });

    expect(screen.getByPlaceholderText('Type a command or search...')).toBeInTheDocument();
  });

  it('emits commandpalette:shown when opened and commandpalette:hidden when closed', () => {
    const shownFn = vi.fn();
    const hiddenFn = vi.fn();
    const unsubShown = aiBus.on('commandpalette:shown', shownFn);
    const unsubHidden = aiBus.on('commandpalette:hidden', hiddenFn);

    let open = false;
    const handleOpenChange = (next: boolean) => {
      open = next;
    };
    const { rerender } = render(
      <CommandPalette id="palette-b" items={items} isOpen={open} onOpenChange={handleOpenChange} />
    );

    aiBus.openCommandPalette('palette-b');
    expect(shownFn).toHaveBeenCalledWith({ id: 'palette-b' });

    rerender(<CommandPalette id="palette-b" items={items} isOpen={true} onOpenChange={handleOpenChange} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(hiddenFn).toHaveBeenCalledWith({ id: 'palette-b' });

    unsubShown();
    unsubHidden();
  });
});
