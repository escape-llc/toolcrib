import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CommandPalette, type CommandPaletteItemData, type CommandPaletteFilter } from '../components/CommandPalette/CommandPalette';
import { aiBus } from '../eventBus/eventBus';
import { axe } from './testUtils/axe';

const items: CommandPaletteItemData[] = [
  { value: 'new-file', label: 'New File', group: 'File', onSelect: vi.fn() },
  { value: 'open-file', label: 'Open File', group: 'File', onSelect: vi.fn() },
  { value: 'toggle-theme', label: 'Toggle Theme', group: 'View', keywords: ['dark mode'], onSelect: vi.fn() },
];

const search = (text: string) => fireEvent.change(screen.getByPlaceholderText('Type a command or search...'), { target: { value: text } });
const shown = () => screen.queryAllByRole('menuitem').map(el => el.textContent);

describe('CommandPalette', () => {
  it('renders nothing when closed (Modal not open)', async () => {
    render(<CommandPalette items={items} isOpen={false} />);
    expect(screen.queryByPlaceholderText('Type a command or search...')).not.toBeInTheDocument();
    // Closed-state scan: CommandPalette is built on Modal (Portal-rendered).
    expect(await axe(document.body)).toHaveNoViolations();
  });

  it('shows an item shortcut as a <Kbd> key cap', async () => {
    render(<CommandPalette items={[{ value: 'save', label: 'Save', shortcut: '⌘S', onSelect: vi.fn() }]} isOpen={true} onOpenChange={() => {}} />);
    expect(screen.getByText('⌘S').tagName).toBe('KBD');
    expect(await axe(document.body)).toHaveNoViolations();
  });

  it('renders all items grouped by their `group` field when open', async () => {
    render(<CommandPalette items={items} isOpen={true} onOpenChange={() => {}} />);
    expect(screen.getByText('New File')).toBeInTheDocument();
    expect(screen.getByText('Open File')).toBeInTheDocument();
    expect(screen.getByText('Toggle Theme')).toBeInTheDocument();
    expect(screen.getByText('File')).toBeInTheDocument();
    expect(screen.getByText('View')).toBeInTheDocument();
    expect(await axe(document.body)).toHaveNoViolations();
  });

  it('filters the list as the user types', () => {
    render(<CommandPalette items={items} isOpen={true} onOpenChange={() => {}} />);
    search('theme');

    expect(screen.getByText('Toggle Theme')).toBeInTheDocument();
    expect(screen.queryByText('New File')).not.toBeInTheDocument();
    expect(screen.queryByText('Open File')).not.toBeInTheDocument();
  });

  it('matches case- and accent-insensitively by default, and on keywords', () => {
    render(<CommandPalette items={[...items, { value: 'cafe', label: 'Café menu' }]} isOpen={true} onOpenChange={() => {}} />);
    search('FILE');
    expect(shown()).toEqual(['New File', 'Open File']);
    search('cafe');
    expect(shown()).toEqual(['Café menu']);
    search('dark');
    expect(shown()).toEqual(['Toggle Theme']);
  });

  // #720: the matcher is pluggable. A number ranks (higher first, across
  // groups too), 0/false hides, and true keeps the list's own order.
  it('uses a custom filter, ranking by its score', () => {
    const filter: CommandPaletteFilter = (query, { text }) =>
      text.toLowerCase().startsWith(query) ? 2 : text.toLowerCase().includes(query) ? 1 : 0;
    render(<CommandPalette items={items} isOpen={true} onOpenChange={() => {}} filter={filter} />);
    search('o');
    // 'Open File' starts with o (2), 'Toggle Theme' only contains it (1),
    // and 'New File' has no o (0, hidden).
    expect(shown()).toEqual(['Open File', 'Toggle Theme']);
    search('t');
    // Only 'Toggle Theme' has a t; its View group is all that's left.
    expect(shown()).toEqual(['Toggle Theme']);
    search('file');
    // Both File items score 1: ties keep the list's own order.
    expect(shown()).toEqual(['New File', 'Open File']);
    search('zz');
    // Nothing scores: the empty state is what's left (react-aria renders it
    // as the menu's one row).
    expect(shown()).toEqual(['No results found.']);
  });

  it('passes the item value as the text when the label is not plain text', () => {
    const filter = vi.fn(() => true);
    render(<CommandPalette items={[{ value: 'rich', label: <b>Rich</b>, keywords: ['k'] }]} isOpen={true} onOpenChange={() => {}} filter={filter} />);
    search('r');
    expect(filter).toHaveBeenCalledWith('r', { value: 'rich', text: 'rich', keywords: ['k'] });
  });

  it('starts each opening from an empty search', () => {
    render(<CommandPalette items={items} />);
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    search('theme');
    expect(shown()).toEqual(['Toggle Theme']);
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(shown()).toHaveLength(3);
  });

  it('shows the empty message when no item matches the search', () => {
    render(<CommandPalette items={items} isOpen={true} onOpenChange={() => {}} emptyMessage="Nothing here" />);
    search('zzz-no-match');
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
