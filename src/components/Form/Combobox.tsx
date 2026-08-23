import React, { type ReactNode, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { useOptionalFormContext } from './FormContext';
import { FieldContext } from './FieldContext';
import { aiBus } from '../../eventBus/eventBus';
import { Z_INDEX } from '../../theme/zIndex';
import { getSparseVariables } from '../../theme/slice';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { computeCornerSquaring } from '../../theme/connectedPopoverStyles';
import { useTargetDocument } from '../../theme/targetDocumentContext';
import { ComboboxThemeSlice, type ComboboxSliceState } from './ComboboxSlice';
import { CONTROL_FONT_SIZE_VAR, resolveControlPadding, type ControlSize } from '../../theme/controlSize';

/** Data shape for each option in a `<Combobox>` listbox. */
export interface ComboboxOptionData {
  /** Display text for the option — also what's matched against the typed query for client-side filtering. */
  label: string;
  /** Value submitted/emitted when this option is selected. */
  value: string;
  /** If true, the option is visible but not selectable. */
  disabled?: boolean;
}

/**
 * Props for the `<Combobox>` filterable text input + listbox.
 *
 * Binds to Form context via `name`, same as `<Select>`. Unlike `<Select>`,
 * the trigger is a real text input the user types into to filter — there's
 * no Radix primitive for this interaction (Radix ships no Combobox), so the
 * listbox, keyboard navigation, and ARIA wiring here are hand-built on top
 * of `Popover` purely for anchored positioning/portal/dismiss.
 *
 * `multiple` follows the same loosely-typed single/array convention
 * `<ToggleGroup>`'s own `type="single" | "multiple"` already uses in this
 * codebase, rather than a stricter discriminated union: `value`/
 * `defaultValue`/`onChange` all take a plain `string` when `multiple` is
 * false/omitted, and a `string[]` when it's true.
 */
export interface ComboboxProps {
  /** Element id. Auto-derived from `name` (or the inherited `<FormField>` name) if omitted — needed for `<FormField>`'s `<label htmlFor>` to associate with this control. */
  id?: string;
  /** Field name. Auto-inherited from parent `<FormField>` if omitted. */
  name?: string;
  /** Placeholder text when empty. @default 'Search...' */
  placeholder?: string;
  /**
   * Client-side option list, filtered locally by substring match against
   * `label`. Omit when using `onSearch` for server-driven results instead.
   */
  options?: ComboboxOptionData[];
  /**
   * Async search — called (debounced by `searchDebounceMs`) with the
   * current query whenever it changes. Takes over from `options` entirely
   * when provided; results replace the listbox contents once resolved.
   */
  onSearch?: (query: string) => Promise<ComboboxOptionData[]>;
  /** Debounce delay before calling `onSearch`. @default 250 */
  searchDebounceMs?: number;
  /**
   * Allows selecting more than one option, rendered as removable chips.
   * Changes the shape of `value`/`defaultValue`/`onChange` from `string` to
   * `string[]`. @default false
   */
  multiple?: boolean;
  /** Controlled selected value — a string, or a string array when `multiple` is true. */
  value?: string | string[];
  /** Initial selected value (uncontrolled) — same shape as `value`. */
  defaultValue?: string | string[];
  /** Change handler. Receives the new value in the same shape as `value`. */
  onChange?: (value: string | string[]) => void;
  /**
   * When true, text that doesn't match any option is committed as a
   * freeform value (or chip, when `multiple`) instead of being discarded.
   * @default false
   */
  allowCustomValue?: boolean;
  /** If true, the combobox is non-interactive. */
  disabled?: boolean;
  /** Message shown when no options match. @default 'No results' */
  noResultsMessage?: ReactNode;
  /** Per-instance overrides for input padding and item density. Only applies at the default `size="md"` — see `<Input>`'s own `size` doc for why. */
  overrides?: Partial<ComboboxSliceState>;
  /** Control size, standardized with `<Button>` and every other sized control so instances line up in a `<UIGroup>` row. @default 'md' */
  size?: ControlSize;
}

/**
 * @manifest Filterable text input with a listbox, supporting client-side or async search and single/multi selection, bound to Form context
 * @manifestCategory Form Controls
 */
export const Combobox: React.FC<ComboboxProps> = ({
  id,
  name: propName,
  placeholder = 'Search...',
  options: staticOptions,
  onSearch,
  searchDebounceMs = 250,
  multiple = false,
  value: externalValue,
  defaultValue,
  onChange: externalOnChange,
  allowCustomValue = false,
  disabled = false,
  noResultsMessage = 'No results',
  overrides,
  size = 'md',
}) => {
  const fieldCtx = useContext(FieldContext);
  const fieldName = propName || fieldCtx.name || '';
  const effectiveId = id ?? (fieldName || undefined);
  const formContext = useOptionalFormContext();
  const registerField = formContext?.registerField;
  const isError = fieldName && formContext ? formContext.touched[fieldName] && !!formContext.errors[fieldName] : false;
  const comboboxVars = getSparseVariables(ComboboxThemeSlice, overrides ?? {});
  const targetDocument = useTargetDocument();
  const inputRef = useRef<HTMLInputElement>(null);
  // Radix's non-modal Popover.Content only exempts clicks on
  // context.triggerRef (populated by <Popover.Trigger>) from its own
  // "interact outside -> dismiss" logic. Combobox deliberately uses
  // <Popover.Anchor> instead of <Popover.Trigger> -- Trigger's built-in
  // click-to-toggle would fight this component's own open-on-focus/typing
  // behavior -- which leaves triggerRef permanently empty, so *every*
  // interaction with the input (including the click that opens it) reads
  // as "outside" and immediately closes the popover again. Reported
  // directly as "clicking in does not display the list, it flashes
  // briefly" -- confirmed via a real timeline trace (opens then closes
  // ~11ms later, every time, regardless of sideOffset). This ref lets the
  // onInteractOutside handler below exempt the anchor region itself, the
  // same way Radix's own Trigger is exempted internally.
  const anchorRef = useRef<HTMLDivElement>(null);
  useInjectInteractionStyles();

  const baseId = useId();
  const listboxId = `${baseId}-listbox`;

  // Same registration requirement as Select — see that component's own
  // comment: without this, a required field left untouched at submit never
  // shows its validation error, since handleSubmit only touches keys
  // already present in `values`.
  useEffect(() => {
    if (fieldName && registerField) registerField(fieldName);
  }, [fieldName, registerField]);

  const formValue = fieldName && formContext ? formContext.values[fieldName] : undefined;
  const [internalValue, setInternalValue] = useState<string | string[]>(defaultValue ?? (multiple ? [] : ''));
  const rawValue = externalValue !== undefined ? externalValue : formValue !== undefined ? formValue : internalValue;
  // Normalized to an array regardless of mode — single mode just never has
  // more than one entry — so selection/toggle/render logic below doesn't
  // need its own single-vs-multiple branch beyond the few spots that
  // actually change behavior (documented at each one).
  const selectedValues: string[] = multiple
    ? Array.isArray(rawValue) ? rawValue.map(String) : []
    : rawValue ? [String(rawValue)] : [];

  // Labels for every value the user has actually selected through this
  // input (or that matched a passed-in `options` entry on mount) — tracked
  // directly rather than re-derived from `options`/async results, which may
  // no longer contain a match for the current query by the time it matters
  // (especially once async search has moved on to a different query).
  const selectedLabelsRef = useRef<Map<string, string>>(new Map());
  for (const v of selectedValues) {
    if (!selectedLabelsRef.current.has(v)) {
      const match = staticOptions?.find(o => o.value === v);
      if (match) selectedLabelsRef.current.set(v, match.label);
    }
  }
  const labelFor = (v: string) => selectedLabelsRef.current.get(v) ?? v;

  const [query, setQuery] = useState(multiple ? '' : labelFor(selectedValues[0] ?? ''));
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [asyncOptions, setAsyncOptions] = useState<ComboboxOptionData[] | null>(null);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);
  // Set in the input's own onChange, immediately before the setQuery that
  // triggers the search effect below, and reset the moment that effect
  // reads it — scopes "this query change came from the user typing" to
  // exactly one render cycle. query also changes for reasons that are NOT
  // the user typing (commitSelection sets it to the picked option's own
  // label, handleClear resets it, the external-value resync effect above
  // syncs it to the current selection) — none of those should schedule a
  // new search or pop the panel back open, so the effect only proceeds
  // when this ref is true.
  const isUserTypingRef = useRef(false);

  // Always opens directly below the input, at the input's own width
  // (`width: var(--radix-popover-trigger-width)` on Content below) -- so
  // the whole bottom edge of the input meets the whole top edge of the
  // listbox, not just one corner. align="stretch" squares both connecting
  // corners on each side accordingly. Unlike DropdownMenu/Popup, side/align
  // aren't configurable here, so this is computed once rather than
  // threaded through as props.
  const squaring = computeCornerSquaring('bottom', 'stretch', open && !disabled, 'var(--ai-radius-md, 0.375rem)');

  // External/Form-driven value changes (not from a selection made through
  // this input) resync the displayed text in single mode — e.g.
  // Form.resetForm(). Multi mode has no single "current label" to sync the
  // input to (selections render as chips instead, not as the input's text).
  useEffect(() => {
    if (!multiple && !open) setQuery(labelFor(selectedValues[0] ?? ''));
  }, [multiple, open, rawValue]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!onSearch) return;
    // See isUserTypingRef's own comment — only a query change that came
    // from the user actually typing schedules a search or (re)opens the
    // panel. Reported directly: focusing an async Combobox popped the
    // panel open immediately, showing "Searching…" (or empty results) for
    // a query nobody typed yet — the panel should stay closed until a real
    // search has actually fired.
    if (!isUserTypingRef.current) return;
    isUserTypingRef.current = false;
    const requestId = ++requestIdRef.current;
    const timer = setTimeout(() => {
      setOpen(true);
      setLoading(true);
      onSearch(query)
        .then(results => {
          // Stale-response guard: a fast typer can have an earlier, slower
          // request resolve after a newer one — only the most recent
          // request's results should ever be applied.
          if (requestIdRef.current === requestId) {
            setAsyncOptions(results);
            setLoading(false);
          }
        })
        .catch(() => {
          if (requestIdRef.current === requestId) {
            setAsyncOptions([]);
            setLoading(false);
          }
        });
    }, searchDebounceMs);
    return () => clearTimeout(timer);
  }, [query, onSearch, searchDebounceMs]);

  const filteredOptions = useMemo(() => {
    if (onSearch) return asyncOptions ?? [];
    const source = staticOptions ?? [];
    if (!query) return source;
    const q = query.toLowerCase();
    return source.filter(o => o.label.toLowerCase().includes(q));
  }, [onSearch, asyncOptions, staticOptions, query]);

  useEffect(() => {
    setActiveIndex(prev => Math.max(0, Math.min(prev, filteredOptions.length - 1)));
  }, [filteredOptions.length]);

  const emitChange = (next: string[]) => {
    const emitted: string | string[] = multiple ? next : next[0] ?? '';
    if (externalValue === undefined) setInternalValue(emitted);
    aiBus.emit('combobox:changed', { name: fieldName, value: emitted });
    if (externalOnChange) externalOnChange(emitted);
    if (fieldName && formContext) {
      formContext.setFieldValue(fieldName, emitted);
      formContext.setFieldTouched(fieldName, true);
    }
  };

  const commitSelection = (option: ComboboxOptionData) => {
    if (option.disabled) return;
    selectedLabelsRef.current.set(option.value, option.label);

    if (multiple) {
      // Selecting an already-selected option removes it — same toggle
      // semantics as ToggleGroup's own type="multiple". Stays open (no
      // setOpen(false)) so picking several options in a row doesn't require
      // reopening the listbox each time. No explicit refocus needed either
      // — neither a keyboard Enter nor a mousedown on this non-focusable
      // option div ever actually moves focus off the input to begin with,
      // and calling .focus() anyway (the previous version of this code did)
      // reads to Radix's non-modal Popover as a fresh focus-from-outside
      // transition, which auto-dismisses it — confirmed by a real test
      // failure, not just reasoning about it.
      const already = selectedValues.includes(option.value);
      const next = already ? selectedValues.filter(v => v !== option.value) : [...selectedValues, option.value];
      setQuery('');
      emitChange(next);
    } else {
      setQuery(option.label);
      setOpen(false);
      emitChange([option.value]);
    }
  };

  const removeChip = (v: string) => {
    emitChange(selectedValues.filter(x => x !== v));
    inputRef.current?.focus();
  };

  const handleClear = () => {
    setQuery('');
    setOpen(false);
    emitChange([]);
  };

  const handleBlur = () => {
    if (multiple) {
      if (allowCustomValue && query && !selectedValues.includes(query)) {
        selectedLabelsRef.current.set(query, query);
        emitChange([...selectedValues, query]);
      }
      setQuery('');
    } else if (allowCustomValue) {
      if (query && query !== labelFor(selectedValues[0] ?? '')) {
        selectedLabelsRef.current.set(query, query);
        emitChange([query]);
      }
    } else if (query !== labelFor(selectedValues[0] ?? '')) {
      setQuery(labelFor(selectedValues[0] ?? ''));
    }
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActiveIndex(i => Math.min(i + 1, filteredOptions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Home' && open) {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End' && open) {
      e.preventDefault();
      setActiveIndex(filteredOptions.length - 1);
    } else if (e.key === 'Enter') {
      if (open && filteredOptions[activeIndex]) {
        e.preventDefault();
        commitSelection(filteredOptions[activeIndex]);
      }
    } else if (e.key === 'Backspace' && multiple && query === '' && selectedValues.length > 0) {
      // Standard tag-input affordance: Backspace on an empty query removes
      // the most recently added chip instead of doing nothing.
      removeChip(selectedValues[selectedValues.length - 1]);
    }
  };

  const activeOptionId = filteredOptions[activeIndex] ? `${baseId}-option-${activeIndex}` : undefined;
  const hasValue = selectedValues.length > 0;

  // ArrowDown/ArrowUp/Home/End all move activeIndex, but the listbox itself
  // never followed — options are plain, non-focusable divs (aria-
  // activedescendant driven, see the input's own comment on why), so
  // there's no native focus-follows-scroll behavior to rely on the way a
  // real <select> or a focusable listbox item would get for free. Reported
  // directly: arrowing down highlights the next option correctly, but once
  // it scrolls past the visible listbox viewport the highlighted option
  // just "disappears" instead of the list scrolling to keep it in view.
  // scrollIntoView({ block: 'nearest' }) only scrolls the minimum distance
  // needed to bring the option back into view (not a jump-to-center),
  // matching native listbox keyboard-nav feel, and is a no-op when the
  // option's already fully visible.
  useEffect(() => {
    if (!open || !activeOptionId) return;
    const doc = targetDocument ?? document;
    doc.getElementById(activeOptionId)?.scrollIntoView({ block: 'nearest' });
  }, [activeOptionId, open, targetDocument]);

  return (
    <PopoverPrimitive.Root open={open && !disabled} onOpenChange={setOpen}>
      <PopoverPrimitive.Anchor asChild>
        <div
          ref={anchorRef}
          className="ai-focus-ring"
          onClick={() => inputRef.current?.focus()}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '0.25rem',
            width: '100%',
            padding: resolveControlPadding(size, 'var(--ai-combobox-input-padding, 0.5rem 0.75rem)'),
            borderRadius: 'var(--ai-radius-md, 0.375rem)',
            border: '0.0625rem solid var(--ai-border, #d1d5db)',
            background: 'var(--ai-bg-surface, #ffffff)',
            boxSizing: 'border-box',
            cursor: disabled ? 'not-allowed' : 'text',
            opacity: disabled ? 0.6 : 1,
            outline: 'none',
            transition: 'border-radius 0.15s ease',
            ...squaring.triggerCornerStyle,
            ...comboboxVars,
          }}
        >
          {multiple &&
            selectedValues.map(v => (
              <span
                key={v}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.125rem 0.375rem 0.125rem 0.5rem',
                  borderRadius: '9999px',
                  background: 'var(--ai-color-primary, #3b82f6)',
                  color: 'var(--ai-color-primary-text, #ffffff)',
                  fontSize: '0.75rem',
                  fontWeight: 'var(--ai-font-weight-medium, 500)',
                  whiteSpace: 'nowrap',
                }}
              >
                {labelFor(v)}
                <button
                  type="button"
                  aria-label={`Remove ${labelFor(v)}`}
                  disabled={disabled}
                  onClick={e => {
                    e.stopPropagation();
                    removeChip(v);
                  }}
                  style={{
                    display: 'inline-flex',
                    background: 'transparent',
                    border: 'none',
                    color: 'inherit',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    padding: 0,
                    fontSize: '0.6875rem',
                    lineHeight: 1,
                    opacity: 0.85,
                  }}
                >
                  ✕
                </button>
              </span>
            ))}
          <input
            ref={inputRef}
            id={effectiveId}
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeOptionId}
            aria-invalid={isError || undefined}
            aria-describedby={isError ? `${fieldName}-error` : undefined}
            autoComplete="off"
            disabled={disabled}
            placeholder={hasValue && multiple ? undefined : placeholder}
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              if (onSearch) {
                // Async mode: don't open yet — the search effect above
                // opens the panel once the debounced search actually
                // fires, not on every keystroke (and never on mere focus,
                // see onFocus/onClick below).
                isUserTypingRef.current = true;
              } else {
                setOpen(true);
              }
            }}
            // Async mode never auto-opens from focus/click alone — only
            // once the user actually types and a search fires (see the
            // search effect above and its own comment). Client-side mode
            // (a fixed `options` list, nothing to wait on) keeps opening
            // immediately, unchanged.
            onFocus={() => { if (!onSearch) setOpen(true); }}
            // Selecting an option deliberately keeps DOM focus on the input
            // (the option's own onMouseDown preventDefaults specifically so
            // focus never moves) so typing immediately after a selection
            // keeps working — but that also means a *second* click, to
            // reopen the list for a fresh search, never fires a new native
            // focus event (the input never actually lost focus in the DOM),
            // so onFocus alone never reopens it. onClick covers that case
            // too; harmless overlap with onFocus on a first click where the
            // input wasn't already focused. Same async-mode exemption as
            // onFocus above.
            onClick={() => { if (!onSearch) setOpen(true); }}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            style={{
              flex: '1 1 auto',
              minWidth: '4rem',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: 'var(--ai-text-primary, #111827)',
              fontSize: CONTROL_FONT_SIZE_VAR[size],
              padding: 0,
              cursor: disabled ? 'not-allowed' : 'text',
            }}
          />
          {hasValue && !disabled && (
            <button
              type="button"
              aria-label="Clear selection"
              onClick={handleClear}
              tabIndex={-1}
              style={{
                flexShrink: 0,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--ai-text-secondary, #6b7280)',
                fontSize: '0.75rem',
                lineHeight: 1,
                padding: 0,
              }}
            >
              ✕
            </button>
          )}
        </div>
      </PopoverPrimitive.Anchor>

      <PopoverPrimitive.Portal container={targetDocument?.body}>
        <PopoverPrimitive.Content
          side="bottom"
          align="start"
          sideOffset={squaring.sideOffset}
          // The input must keep real DOM focus the whole time — the
          // listbox itself is never focused (options are plain, non-
          // focusable divs highlighted via aria-activedescendant), so any
          // of Radix's own auto-focus behavior on open/close would fight
          // typing. Non-modal Popover (the default) already skips focus
          // trapping/outside-pointer-blocking, but auto-focus on open/close
          // still needs suppressing explicitly.
          onOpenAutoFocus={e => e.preventDefault()}
          onCloseAutoFocus={e => e.preventDefault()}
          // See anchorRef's own comment above: Radix's non-modal Content
          // only recognizes a <Popover.Trigger> as exempt from "interact
          // outside" dismissal, and this component uses Anchor instead, so
          // every click/focus on the input read as outside and closed the
          // popover the instant it opened. Exempting the anchor region here
          // is the direct fix.
          onInteractOutside={e => {
            if (anchorRef.current?.contains(e.target as Node)) {
              e.preventDefault();
            }
          }}
          style={{
            zIndex: Z_INDEX.DROPDOWN,
            width: 'var(--radix-popover-trigger-width)',
            background: 'var(--ai-bg-surface, #ffffff)',
            border: '0.0625rem solid var(--ai-border, #e5e7eb)',
            boxShadow: '0 0.625rem 1.5625rem -0.3125rem rgba(0,0,0,0.15)',
            overflow: 'hidden',
            ...squaring.popupCornerStyle,
            ...comboboxVars,
          }}
        >
          <div
            role="listbox"
            id={listboxId}
            aria-multiselectable={multiple || undefined}
            style={{ padding: 'var(--ai-padding-xs, 0.25rem)', maxHeight: '15rem', overflowY: 'auto' }}
          >
            {loading && (
              <div style={{ padding: 'var(--ai-combobox-item-padding, 0.4375rem 0.75rem)', fontSize: '0.8125rem', color: 'var(--ai-text-secondary, #6b7280)' }}>
                Searching…
              </div>
            )}
            {!loading && filteredOptions.length === 0 && (
              <div style={{ padding: 'var(--ai-combobox-item-padding, 0.4375rem 0.75rem)', fontSize: '0.8125rem', color: 'var(--ai-text-secondary, #6b7280)' }}>
                {noResultsMessage}
              </div>
            )}
            {!loading &&
              filteredOptions.map((opt, index) => {
                const isSelected = selectedValues.includes(opt.value);
                return (
                  <div
                    key={opt.value}
                    id={`${baseId}-option-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    data-highlighted={index === activeIndex ? '' : undefined}
                    className="ai-menu-item"
                    // onMouseDown, not onClick: fires before the input's own
                    // blur would otherwise run (moot here since these plain,
                    // non-focusable divs never steal focus from the input in
                    // the first place — see this file's own review notes —
                    // but onMouseDown also lets a fast pointer-down-then-drag
                    // select correctly, matching native listbox feel).
                    onMouseDown={e => {
                      e.preventDefault();
                      commitSelection(opt);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--ai-combobox-item-padding, 0.4375rem 0.75rem)',
                      fontSize: '0.875rem',
                      borderRadius: 'var(--ai-radius-sm, 0.25rem)',
                      color: 'var(--ai-text-primary, #111827)',
                      cursor: opt.disabled ? 'not-allowed' : 'pointer',
                      opacity: opt.disabled ? 0.5 : 1,
                      userSelect: 'none',
                    }}
                  >
                    {opt.label}
                    {multiple && isSelected && (
                      <span style={{ color: 'var(--ai-color-primary, #3b82f6)', fontWeight: 'var(--ai-font-weight-black, 900)' }}>✓</span>
                    )}
                  </div>
                );
              })}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
};
