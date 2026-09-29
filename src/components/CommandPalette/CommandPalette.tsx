'use client';

import React, { type ReactNode, useEffect, useState } from 'react';
import { Autocomplete, Header, Input, Menu, MenuItem, MenuSection, TextField, useFilter } from 'react-aria-components';
import { aiBus } from '../../eventBus/eventBus';
import { useAIEvent } from '../../eventBus/useAIEvent';
import { useStableId } from '../shared/useStableId';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { useTargetDocument } from '../../theme/targetDocumentContext';
import { type SubthemeName } from '../../theme/subtheme';
import { Modal } from '../Overlay/Modal';
import { Kbd } from '../Kbd/Kbd';
import { CommandPaletteThemeSlice, type CommandPaletteSliceState } from './CommandPaletteSlice';

/** Data shape for each item in a `<CommandPalette>`. */
export interface CommandPaletteItemData {
  /** Unique string value emitted in the `commandpalette:item_selected` event. Also what the search matches when `label` isn't plain text. */
  value: string;
  /** Display label rendered in the item. */
  label: ReactNode;
  /** Optional icon rendered before the label. */
  icon?: ReactNode;
  /** Optional keyboard shortcut display, e.g. `'⌘S'`. Purely visual — does not register the shortcut itself. */
  shortcut?: string;
  /** Optional group heading this item is rendered under. Items sharing the same `group` are rendered together. */
  group?: string;
  /** Additional terms the search matches against, beyond the label's own text. */
  keywords?: string[];
  /** Handler invoked when this item is selected via click or keyboard. */
  onSelect?: () => void;
}

/** What a `<CommandPalette>` `filter` scores: an item's searchable text and keywords. */
export interface CommandPaletteMatchCandidate {
  /** The item's `value`. */
  value: string;
  /** The label when it's plain text, else `value`. */
  text: string;
  /** The item's `keywords`, or `[]`. */
  keywords: string[];
}

/**
 * Scores how well `query` matches a candidate. Return a positive number to
 * show the item, higher ranking first, or `0`/`false` to hide it. `true`
 * counts as `1`, so a plain yes/no predicate keeps the list's own order.
 * Only called with a non-empty query.
 */
export type CommandPaletteFilter = (query: string, candidate: CommandPaletteMatchCandidate) => number | boolean;

/**
 * Props for the `<CommandPalette>` searchable action launcher.
 *
 * Data-driven: pass an `items` array, grouped via each item's `group` field.
 * Opens on `Cmd/Ctrl+K` (registered automatically once mounted) or via
 * `aiBus.openCommandPalette(id)`. Emits `commandpalette:shown`,
 * `commandpalette:hidden`, and `commandpalette:item_selected`.
 */
export interface CommandPaletteProps {
  /** Unique identifier for event bus targeting. Auto-generated if omitted. */
  id?: string;
  /** Array of items to render, filtered as the user types (see `filter`). */
  items: CommandPaletteItemData[];
  /**
   * Custom matcher, e.g. a fuzzy scorer. The default is a case- and
   * accent-insensitive substring match on the item's text and keywords,
   * keeping the list's own order.
   */
  filter?: CommandPaletteFilter;
  /**
   * Input placeholder text.
   * @default 'Type a command or search...'
   */
  placeholder?: string;
  /**
   * Content shown when no item matches the current search.
   * @default 'No results found.'
   */
  emptyMessage?: ReactNode;
  /** Controlled open state. When provided, the component becomes fully controlled. */
  isOpen?: boolean;
  /** Callback fired when the palette opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /** Per-instance overrides for item density and max list height. */
  overrides?: Partial<CommandPaletteSliceState> & { subtheme?: SubthemeName };
}

/**
 * @manifest Searchable command launcher opened via Cmd/Ctrl+K, hosted in a top-anchored Modal (VS Code-style quick-switcher placement); pluggable matcher for fuzzy search
 * @manifestCategory Overlays
 * @manifestAntiPatternAvoid Hand-roll a fuzzy-searchable command launcher with a raw `<input>` and manual filtering, or wire your own global `Cmd/Ctrl+K` listener
 * @manifestAntiPatternInstead Use `<CommandPalette items={...}>` — filtering, grouping, and the global shortcut are wired in automatically once mounted; triggerable from anywhere via `aiBus.openCommandPalette(id)`
 */
export const CommandPalette: React.FC<CommandPaletteProps> = ({
  id: propId,
  items,
  placeholder = 'Type a command or search...',
  emptyMessage = 'No results found.',
  isOpen: externalIsOpen,
  onOpenChange,
  overrides,
  filter,
}) => {
  const id = useStableId(propId, 'commandpalette');
  const targetDocument = useTargetDocument();
  const { vars: paletteVars } = useSliceOverrides(CommandPaletteThemeSlice, overrides);
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const [query, setQuery] = useState('');
  const { contains } = useFilter({ sensitivity: 'base' });

  const handleOpenChange = (open: boolean) => {
    // Each opening starts from an empty search.
    if (!open) setQuery('');
    if (externalIsOpen === undefined) {
      setInternalIsOpen(open);
    }
    if (onOpenChange) {
      onOpenChange(open);
    }
    aiBus.emit(open ? 'commandpalette:shown' : 'commandpalette:hidden', { id });
  };

  useAIEvent('commandpalette:open', e => {
    if ((e.id === undefined || e.id === id) && !isOpen) handleOpenChange(true);
  });

  useEffect(() => {
    const doc = targetDocument ?? document;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        handleOpenChange(true);
      }
    };
    doc.addEventListener('keydown', handleKeyDown);
    return () => doc.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetDocument, isOpen]);

  // Scored and ordered here, not by Autocomplete's own filter (a yes/no
  // predicate), so a custom `filter` can rank as well as match. With a query,
  // items sort by score and groups by their best item; ties keep list order.
  const score = (item: CommandPaletteItemData): number => {
    if (!query) return 1;
    const candidate: CommandPaletteMatchCandidate = {
      value: item.value,
      text: typeof item.label === 'string' ? item.label : item.value,
      keywords: item.keywords ?? [],
    };
    const result = filter
      ? filter(query, candidate)
      : contains(candidate.text, query) || candidate.keywords.some(k => contains(k, query));
    return typeof result === 'number' ? result : result ? 1 : 0;
  };
  const scored = items.map((item, index) => ({ item, index, score: score(item) })).filter(s => s.score > 0);
  if (query) scored.sort((a, b) => b.score - a.score || a.index - b.index);

  const groups = new Map<string | undefined, CommandPaletteItemData[]>();
  for (const { item } of scored) {
    const bucket = groups.get(item.group);
    if (bucket) bucket.push(item);
    else groups.set(item.group, [item]);
  }

  const renderItem = (item: CommandPaletteItemData) => (
    <MenuItem
      key={item.value}
      id={item.value}
      textValue={typeof item.label === 'string' ? item.label : item.value}
      onAction={() => {
        aiBus.emit('commandpalette:item_selected', { id, itemValue: item.value });
        if (item.onSelect) item.onSelect();
        handleOpenChange(false);
      }}
      className="ai-menu-item"
      style={({ isFocused }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: 'var(--ai-commandpalette-item-padding, 0.4375rem 0.75rem)',
        fontSize: '0.875rem',
        fontWeight: 'var(--ai-font-weight-medium, 500)',
        borderRadius: 'var(--ai-radius-sm, 0.25rem)',
        color: 'var(--ai-text-primary, #111827)',
        cursor: 'pointer',
        outline: 'none',
        // The highlighted row (arrow keys move a virtual focus while typing
        // stays in the input), the same tint as other menus' rows.
        background: isFocused ? 'color-mix(in srgb, currentColor var(--ai-menu-item-highlight-amount, 10%), transparent)' : undefined,
      })}
    >
      {item.icon && <span>{item.icon}</span>}
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.shortcut && <Kbd size="sm">{item.shortcut}</Kbd>}
    </MenuItem>
  );

  return (
    <Modal
      id={id}
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      width="37.5rem"
      ariaLabel="Command palette"
      align="top"
    >
      {/* react-aria's Autocomplete (#720, replacing cmdk and the Radix it
          pulled in): typing stays in the input while arrow keys move a
          virtual focus through the menu, and Enter runs the highlighted
          item. The first result is highlighted after every change. */}
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, ...paletteVars }}>
        <Autocomplete inputValue={query} onInputChange={setQuery}>
          <TextField aria-label="Command palette" style={{ padding: 'var(--ai-padding-lg, 0.875rem)', borderBottom: '0.0625rem solid var(--ai-border, #e5e7eb)' }}>
            <Input
              autoFocus
              placeholder={placeholder}
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: '0.9375rem',
                color: 'var(--ai-text-primary, #111827)',
              }}
            />
          </TextField>
          {/* The list scrolls in this wrapper, which is a tab stop:
              arrow keys drive a virtual focus while typing stays in the
              input, so no row is itself focusable, and a scrollable region
              with nothing focusable in it has no keyboard access (axe:
              scrollable-region-focusable). Same fix as Content.Grow and
              ScrollArea. */}
          <div
            tabIndex={0}
            className="ai-focus-ring"
            style={{
              maxHeight: 'var(--ai-commandpalette-max-list-height, 21.875rem)',
              overflowY: 'auto',
              outline: 'none',
            }}
          >
          <Menu
            aria-label="Commands"
            renderEmptyState={() => (
              <div style={{ padding: 'var(--ai-padding-lg, 1.25rem)', textAlign: 'center', color: 'var(--ai-text-secondary, #6b7280)', fontSize: '0.875rem' }}>
                {emptyMessage}
              </div>
            )}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.125rem',
              padding: 'var(--ai-padding-sm, 0.375rem)',
              outline: 'none',
            }}
          >
            {Array.from(groups.entries()).map(([group, groupItems]) =>
              group === undefined ? (
                groupItems.map(renderItem)
              ) : (
                <MenuSection key={group} id={group} style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                  <Header
                    style={{
                      padding: '0.5rem 0.75rem 0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: 'var(--ai-font-weight-semibold, 600)',
                      color: 'var(--ai-text-secondary, #6b7280)',
                    }}
                  >
                    {group}
                  </Header>
                  {groupItems.map(renderItem)}
                </MenuSection>
              )
            )}
          </Menu>
          </div>
        </Autocomplete>
      </div>
    </Modal>
  );
};
