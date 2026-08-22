import React, { type ReactNode, useEffect, useState } from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import { aiBus } from '../../eventBus/eventBus';
import { useAIEvent } from '../../eventBus/useAIEvent';
import { useStableId } from '../shared/useStableId';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { useTargetDocument } from '../../theme/targetDocumentContext';
import { type SubthemeName } from '../../theme/subtheme';
import { Modal } from '../Overlay/Modal';
import { CommandPaletteThemeSlice, type CommandPaletteSliceState } from './CommandPaletteSlice';

/** Data shape for each item in a `<CommandPalette>`. */
export interface CommandPaletteItemData {
  /** Unique string value emitted in the `commandpalette:item_selected` event, and used by `cmdk` for filtering/selection identity. */
  value: string;
  /** Display label rendered in the item. */
  label: ReactNode;
  /** Optional icon rendered before the label. */
  icon?: ReactNode;
  /** Optional keyboard shortcut display, e.g. `'⌘S'`. Purely visual — does not register the shortcut itself. */
  shortcut?: string;
  /** Optional group heading this item is rendered under. Items sharing the same `group` are rendered together. */
  group?: string;
  /** Additional terms `cmdk`'s fuzzy filter should match against, beyond `label`'s own text. */
  keywords?: string[];
  /** Handler invoked when this item is selected via click or keyboard. */
  onSelect?: () => void;
}

/**
 * Props for the `<CommandPalette>` fuzzy-searchable action launcher.
 *
 * Data-driven: pass an `items` array, grouped via each item's `group` field.
 * Opens on `Cmd/Ctrl+K` (registered automatically once mounted) or via
 * `aiBus.openCommandPalette(id)`. Emits `commandpalette:shown`,
 * `commandpalette:hidden`, and `commandpalette:item_selected`.
 */
export interface CommandPaletteProps {
  /** Unique identifier for event bus targeting. Auto-generated if omitted. */
  id?: string;
  /** Array of items to render, fuzzy-filtered by `cmdk` as the user types. */
  items: CommandPaletteItemData[];
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
 * @manifest Fuzzy-searchable command launcher opened via Cmd/Ctrl+K, hosted in a top-anchored Modal (VS Code-style quick-switcher placement)
 * @manifestCategory Overlays
 */
export const CommandPalette: React.FC<CommandPaletteProps> = ({
  id: propId,
  items,
  placeholder = 'Type a command or search...',
  emptyMessage = 'No results found.',
  isOpen: externalIsOpen,
  onOpenChange,
  overrides,
}) => {
  const id = useStableId(propId, 'commandpalette');
  const targetDocument = useTargetDocument();
  const { vars: paletteVars } = useSliceOverrides(CommandPaletteThemeSlice, overrides);
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

  const handleOpenChange = (open: boolean) => {
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

  const groups = new Map<string | undefined, CommandPaletteItemData[]>();
  for (const item of items) {
    const key = item.group;
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      groups.set(key, [item]);
    }
  }

  return (
    <Modal
      id={id}
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      width="37.5rem"
      ariaLabel="Command palette"
      align="top"
    >
      <CommandPrimitive
        label="Command palette"
        // cmdk owns filtering/active-item state internally (via `value`/
        // `onValueChange` left uncontrolled here) -- re-driving it from
        // this wrapper's own state would fight its own keyboard nav
        // instead of composing with it, per the acceptance criterion.
        style={{ display: 'flex', flexDirection: 'column', minHeight: 0, ...paletteVars }}
      >
        <div style={{ padding: 'var(--ai-padding-lg, 0.875rem)', borderBottom: '0.0625rem solid var(--ai-border, #e5e7eb)' }}>
          <CommandPrimitive.Input
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
        </div>
        <CommandPrimitive.List
          style={{
            maxHeight: 'var(--ai-commandpalette-max-list-height, 21.875rem)',
            overflowY: 'auto',
            padding: 'var(--ai-padding-sm, 0.375rem)',
          }}
        >
          <CommandPrimitive.Empty
            style={{
              padding: 'var(--ai-padding-lg, 1.25rem)',
              textAlign: 'center',
              color: 'var(--ai-text-secondary, #6b7280)',
              fontSize: '0.875rem',
            }}
          >
            {emptyMessage}
          </CommandPrimitive.Empty>
          {Array.from(groups.entries()).map(([group, groupItems]) => (
            <CommandPrimitive.Group
              key={group ?? '__ungrouped__'}
              value={group ?? '__ungrouped__'}
              heading={group}
              style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}
            >
              {groupItems.map(item => (
                <CommandPrimitive.Item
                  key={item.value}
                  value={item.value}
                  keywords={item.keywords}
                  onSelect={() => {
                    aiBus.emit('commandpalette:item_selected', { id, itemValue: item.value });
                    if (item.onSelect) item.onSelect();
                    handleOpenChange(false);
                  }}
                  style={{
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
                  }}
                >
                  {item.icon && <span>{item.icon}</span>}
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.shortcut && (
                    <span style={{ color: 'var(--ai-text-secondary, #6b7280)', fontSize: '0.75rem' }}>{item.shortcut}</span>
                  )}
                </CommandPrimitive.Item>
              ))}
            </CommandPrimitive.Group>
          ))}
        </CommandPrimitive.List>
      </CommandPrimitive>
    </Modal>
  );
};
