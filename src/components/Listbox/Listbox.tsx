import React, { type ReactNode } from 'react';
import { CONTROL_FONT_SIZE_VAR, type ControlSize } from '../../theme/controlSize';

/**
 * Data shape for each item in a `<Listbox>`.
 *
 * `label` stays a plain `string` (not `ReactNode`, unlike `SelectOptionData`/
 * `MenuItemData`) because it doubles as the searchable/filterable text for
 * any caller that filters by substring (`Combobox`'s own client-side
 * filter, e.g.) — a `ReactNode` can't be `.toLowerCase().includes(...)`'d.
 * `render`, not `label` itself, is the escape hatch for custom per-option
 * content — same name and shape as `DataTable`'s own `Column.render`
 * (`(context) => ReactNode`), deliberately: a consumer that's already
 * learned that pattern from one component recognizes it here too, instead
 * of every list-shaped component in the toolkit inventing its own naming
 * for "the same underlying idea."
 */
export interface ListboxOptionData {
  /** Display text for the option, and the text any caller's own filtering matches against. Still rendered as-is when `render` is omitted. */
  label: string;
  /** Value submitted/emitted when this option is selected. */
  value: string;
  /** If true, the option is visible but not selectable. */
  disabled?: boolean;
  /** Custom content for this option, overriding the plain `label` text render. `label` still applies to any caller's own text-based filtering — this only changes what's visually shown. */
  render?: (option: ListboxOptionData) => ReactNode;
}

/**
 * Props for the `<Listbox>` selectable option list.
 *
 * Purely presentational and controlled — it owns no keyboard-navigation
 * state of its own (no internal `activeIndex`, no `ArrowUp`/`ArrowDown`
 * handling). A caller supplies `activeIndex` (typically driven by its own
 * text input's `onKeyDown`, the way `Combobox` already does) and reads
 * back `id`-derived option ids (`${id}-option-${index}`) to wire its own
 * `aria-activedescendant` — the same contract `Combobox` already relied on
 * internally before this was extracted, now available standalone for a
 * custom search-results dropdown, a mentions widget, or any other picker
 * that needs a keyboard-navigable option list with no matching Radix
 * primitive to build on (Radix ships no Combobox/Listbox primitive at all).
 */
export interface ListboxProps {
  /** DOM id for the listbox container. Each option's own id is derived from this (`${id}-option-${index}`) — predictable so a caller can compute the active option's id for `aria-activedescendant` without Listbox needing to expose it separately. */
  id: string;
  /** Options to render. */
  options: ListboxOptionData[];
  /** Index of the currently keyboard-highlighted option, if any. */
  activeIndex?: number;
  /** Values currently selected. */
  selectedValues?: string[];
  /** Called when an option is chosen (via `mousedown`, so a fast pointer-down-then-drag selects correctly, matching native listbox feel — and before an input's own `blur` would otherwise run). Never called for a `disabled` option. */
  onSelect: (option: ListboxOptionData) => void;
  /** Shows `loadingMessage` instead of the option list. */
  loading?: boolean;
  /** Content shown while `loading` is true. @default 'Loading…' */
  loadingMessage?: ReactNode;
  /** Content shown when there are no options and not loading. @default 'No results' */
  emptyMessage?: ReactNode;
  /**
   * Whether more than one option can be selected at once — sets
   * `aria-multiselectable`. Every selected option gets a trailing
   * checkmark and a tinted background regardless of this flag; this only
   * controls whether more than one can carry that state simultaneously.
   * @default false
   */
  multiSelectable?: boolean;
  /** Per-option-row padding. Pass a caller's own themed CSS variable reference (e.g. Combobox passes `var(--ai-combobox-item-padding, ...)`) to keep density theme-consistent with the rest of that caller's own UI. @default 'var(--ai-padding-sm, 0.4375rem 0.75rem)' */
  itemPadding?: string;
  /** Control size, standardized with `<Button>` and every other sized control — drives the option row's font-size. @default 'md' */
  size?: ControlSize;
  /**
   * Accessible name for the listbox. Omit when a caller already establishes
   * one via its own `aria-controls`/`aria-activedescendant` relationship
   * from a labeled control (e.g. `Combobox`'s own input, itself named
   * through a wrapping `<FormField label="...">` — the same convention
   * every other Form control in this toolkit relies on rather than a
   * standalone label prop of its own). Required for a meaningful
   * accessible name in any other standalone use — a `<div role="listbox">`
   * with neither this nor `aria-labelledby` has none at all.
   */
  'aria-label'?: string;
  /** Same as `aria-label`, but referencing an existing visible label element's id instead of a literal string. */
  'aria-labelledby'?: string;
}

/**
 * @manifest Keyboard-navigable, controlled option list with no matching Radix primitive to build on — extracted from Combobox's own hand-built listbox, now usable standalone
 * @manifestConstraints Purely presentational — owns no keyboard-navigation state; the caller drives `activeIndex` and reads back `${id}-option-${index}` for its own `aria-activedescendant`
 * @manifestCategory Form Controls
 */
export const Listbox: React.FC<ListboxProps> = ({
  id,
  options,
  activeIndex,
  selectedValues = [],
  onSelect,
  loading = false,
  loadingMessage = 'Loading…',
  emptyMessage = 'No results',
  multiSelectable = false,
  itemPadding = 'var(--ai-padding-sm, 0.4375rem 0.75rem)',
  size = 'md',
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}) => {
  return (
    <div
      role="listbox"
      id={id}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-multiselectable={multiSelectable || undefined}
      style={{ padding: 'var(--ai-padding-xs, 0.25rem)', maxHeight: '15rem', overflowY: 'auto' }}
    >
      {loading && (
        <div style={{ padding: itemPadding, fontSize: '0.8125rem', color: 'var(--ai-text-secondary, #6b7280)' }}>
          {loadingMessage}
        </div>
      )}
      {!loading && options.length === 0 && (
        <div style={{ padding: itemPadding, fontSize: '0.8125rem', color: 'var(--ai-text-secondary, #6b7280)' }}>
          {emptyMessage}
        </div>
      )}
      {!loading &&
        options.map((opt, index) => {
          const isSelected = selectedValues.includes(opt.value);
          return (
            <div
              key={opt.value}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={isSelected}
              data-highlighted={index === activeIndex ? '' : undefined}
              className="ai-menu-item"
              onMouseDown={e => {
                e.preventDefault();
                if (!opt.disabled) onSelect(opt);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: itemPadding,
                fontSize: CONTROL_FONT_SIZE_VAR[size],
                borderRadius: 'var(--ai-radius-sm, 0.25rem)',
                color: 'var(--ai-text-primary, #111827)',
                // A selected row's own tint, independent of multiSelectable
                // -- single-select needs a persistent "this one is picked"
                // signal too, same as any native <select>'s own OS-rendered
                // dropdown already shows for its one selected item. Without
                // it, a caller that clears its own filter query after
                // picking (the natural thing to do, so the full list
                // reappears instead of staying narrowed to the one label
                // that now matches) has no visual trace of the pick at all.
                background: isSelected ? 'var(--ai-subtheme-info-bg, rgba(59, 130, 246, 0.1))' : undefined,
                cursor: opt.disabled ? 'not-allowed' : 'pointer',
                opacity: opt.disabled ? 0.5 : 1,
                userSelect: 'none',
              }}
            >
              {opt.render ? opt.render(opt) : opt.label}
              {isSelected && (
                <span style={{ color: 'var(--ai-color-primary, #3b82f6)', fontWeight: 'var(--ai-font-weight-black, 900)' }}>✓</span>
              )}
            </div>
          );
        })}
    </div>
  );
};
