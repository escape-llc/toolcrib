/* eslint-disable react-hooks/refs -- selectedLabelsRef below is copied verbatim from Combobox.tsx, which carries this exact same disable with its own full justification (persistent, incrementally-populated label cache; every write idempotent; deferring to an effect would regress the first-render label display). Not re-derived here -- see that file's own header comment for the complete reasoning. */
/**
 * SPIKE — for issue #125. Not a real component; mirrors Combobox.tsx
 * exactly except for how open/activeIndex are managed, specifically so the
 * *unmodified* Combobox.test.tsx can be pointed at this file (import swap
 * only) to get a real signal on whether a self-authored @zag-js/core
 * machine + a custom synchronous binding (useSyncStatechart) actually
 * avoids the two frictions found in the #124 spike (async dispatch,
 * controlled-value/DOM-sync fighting) while still getting a real statechart
 * instead of ad hoc useState/useRef coordination for the historically
 * fragile open/keyboard-nav kernel.
 *
 * Every other piece (query, async search debounce/stale-response guard,
 * multi-select value, chips, Form binding, Radix Popover for positioning
 * only) is copied verbatim from Combobox.tsx -- this spike is deliberately
 * scoped to the open/activeIndex kernel, not a rewrite of the whole
 * component.
 */
import React, { useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { useOptionalFormContext } from './FormContext';
import { FieldContext } from './FieldContext';
import { aiBus } from '../../eventBus/eventBus';
import { Z_INDEX } from '../../theme/zIndex';
import { getSparseVariables } from '../../theme/slice';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { computeCornerSquaring, useActualPopoverSide } from '../../theme/connectedPopoverStyles';
import { useTargetDocument } from '../../theme/targetDocumentContext';
import { ComboboxThemeSlice } from './ComboboxSlice';
import { CONTROL_FONT_SIZE_VAR, resolveControlPadding } from '../../theme/controlSize';
import { Listbox, type ListboxOptionData } from '../Listbox/Listbox';
import { useLocaleStrings } from '../Locale/LocaleContext';
import { comboboxOpenMachine } from './comboboxOpenMachine';
import { useSyncStatechart } from './useSyncStatechart';
import type { ComboboxProps } from './Combobox';

export const ComboboxStatechartSpike: React.FC<ComboboxProps> = ({
  id,
  name: propName,
  placeholder = 'Search...',
  ariaLabel,
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
  const strings = useLocaleStrings().combobox;
  const targetDocument = useTargetDocument();
  const inputRef = useRef<HTMLInputElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useInjectInteractionStyles();

  const baseId = useId();
  const listboxId = `${baseId}-listbox`;

  useEffect(() => {
    if (fieldName && registerField) registerField(fieldName);
  }, [fieldName, registerField]);

  const formValue = fieldName && formContext ? formContext.values[fieldName] : undefined;
  const [internalValue, setInternalValue] = useState<string | string[]>(defaultValue ?? (multiple ? [] : ''));
  const rawValue = externalValue !== undefined ? externalValue : formValue !== undefined ? formValue : internalValue;
  const selectedValues: string[] = multiple
    ? Array.isArray(rawValue) ? rawValue.map(String) : []
    : rawValue ? [String(rawValue)] : [];

  const selectedLabelsRef = useRef<Map<string, string>>(new Map());
  for (const v of selectedValues) {
    if (!selectedLabelsRef.current.has(v)) {
      const match = staticOptions?.find(o => o.value === v);
      if (match) selectedLabelsRef.current.set(v, match.label);
    }
  }
  const labelFor = (v: string) => selectedLabelsRef.current.get(v) ?? v;

  const [query, setQuery] = useState(multiple ? '' : labelFor(selectedValues[0] ?? ''));
  const [asyncOptions, setAsyncOptions] = useState<ListboxOptionData[] | null>(null);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);
  const isUserTypingRef = useRef(false);

  const filteredOptions = useMemo(() => {
    if (onSearch) return asyncOptions ?? [];
    const source = staticOptions ?? [];
    if (!query) return source;
    const q = query.toLowerCase();
    return source.filter(o => o.label.toLowerCase().includes(q));
  }, [onSearch, asyncOptions, staticOptions, query]);

  // The statechart kernel -- replaces the real Combobox's own `open`/
  // `activeIndex` useState pair and its "adjusted during render"
  // activeIndex-clamping block with a real statechart send/state.matches.
  const { state, send, context } = useSyncStatechart(comboboxOpenMachine, {
    id: baseId,
    count: filteredOptions.length,
  });
  const open = state.matches('open');
  const activeIndex = context.get('activeIndex');

  // Same clamping need the real Combobox has (its own "adjusted during
  // render" effect keyed on filteredOptions.length) -- expressed as a
  // machine event instead of a raw setActiveIndex call.
  const [prevFilteredLength, setPrevFilteredLength] = useState(filteredOptions.length);
  if (filteredOptions.length !== prevFilteredLength) {
    setPrevFilteredLength(filteredOptions.length);
    send({ type: 'CLAMP' });
  }

  const actualSide = useActualPopoverSide(contentRef, 'bottom', open && !disabled);
  const squaring = computeCornerSquaring(actualSide, 'stretch', open && !disabled, 'var(--ai-radius-md, 0.375rem)');

  const comboboxSyncKey = `${multiple}|${open}|${rawValue}`;
  const [prevComboboxSyncKey, setPrevComboboxSyncKey] = useState(comboboxSyncKey);
  if (comboboxSyncKey !== prevComboboxSyncKey) {
    setPrevComboboxSyncKey(comboboxSyncKey);
    if (!multiple && !open) setQuery(labelFor(selectedValues[0] ?? ''));
  }

  useEffect(() => {
    if (!onSearch) return;
    if (!isUserTypingRef.current) return;
    isUserTypingRef.current = false;
    const requestId = ++requestIdRef.current;
    const timer = setTimeout(() => {
      send({ type: 'OPEN' });
      setLoading(true);
      onSearch(query)
        .then(results => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- send is a fresh function identity every render (useSyncStatechart doesn't memoize it), including it would re-schedule this debounce timer on every keystroke's own re-render, defeating the debounce entirely.
  }, [query, onSearch, searchDebounceMs]);

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

  const commitSelection = (option: ListboxOptionData) => {
    if (option.disabled) return;
    selectedLabelsRef.current.set(option.value, option.label);

    if (multiple) {
      const already = selectedValues.includes(option.value);
      const next = already ? selectedValues.filter(v => v !== option.value) : [...selectedValues, option.value];
      setQuery('');
      emitChange(next);
    } else {
      setQuery(option.label);
      send({ type: 'CLOSE' });
      emitChange([option.value]);
    }
  };

  const removeChip = (v: string) => {
    emitChange(selectedValues.filter(x => x !== v));
    inputRef.current?.focus();
  };

  const handleClear = () => {
    setQuery('');
    send({ type: 'CLOSE' });
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
    send({ type: 'CLOSE' });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      send({ type: 'ARROW_DOWN' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      send({ type: 'ARROW_UP' });
    } else if (e.key === 'Home' && open) {
      e.preventDefault();
      send({ type: 'HOME' });
    } else if (e.key === 'End' && open) {
      e.preventDefault();
      send({ type: 'END' });
    } else if (e.key === 'Enter') {
      if (open && filteredOptions[activeIndex]) {
        e.preventDefault();
        commitSelection(filteredOptions[activeIndex]);
      }
    } else if (e.key === 'Backspace' && multiple && query === '' && selectedValues.length > 0) {
      removeChip(selectedValues[selectedValues.length - 1]);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      e.stopPropagation();
      send({ type: 'CLOSE' });
    }
  };

  const activeOptionId = filteredOptions[activeIndex] ? `${listboxId}-option-${activeIndex}` : undefined;
  const hasValue = selectedValues.length > 0;

  useEffect(() => {
    if (!open || !activeOptionId) return;
    const doc = targetDocument ?? document;
    doc.getElementById(activeOptionId)?.scrollIntoView({ block: 'nearest' });
  }, [activeOptionId, open, targetDocument]);

  return (
    <PopoverPrimitive.Root open={open && !disabled} onOpenChange={o => send({ type: o ? 'OPEN' : 'CLOSE' })}>
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
            borderTopLeftRadius: 'var(--ai-radius-md, 0.375rem)',
            borderTopRightRadius: 'var(--ai-radius-md, 0.375rem)',
            borderBottomLeftRadius: 'var(--ai-radius-md, 0.375rem)',
            borderBottomRightRadius: 'var(--ai-radius-md, 0.375rem)',
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
                  aria-label={strings.removeItem(labelFor(v))}
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
            aria-label={ariaLabel}
            role="combobox"
            aria-expanded={open}
            aria-controls={open ? listboxId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={open ? activeOptionId : undefined}
            aria-invalid={isError || undefined}
            aria-describedby={isError ? `${fieldName}-error` : undefined}
            autoComplete="off"
            disabled={disabled}
            placeholder={hasValue && multiple ? undefined : placeholder}
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              if (onSearch) {
                isUserTypingRef.current = true;
              } else {
                send({ type: 'OPEN' });
              }
            }}
            onFocus={() => { if (!onSearch) send({ type: 'OPEN' }); }}
            onClick={() => { if (!onSearch) send({ type: 'OPEN' }); }}
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
              aria-label={strings.clearSelection}
              onClick={handleClear}
              tabIndex={-1}
              style={{
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '1.125rem',
                height: '1.125rem',
                background: 'var(--ai-bg-container, #f3f4f6)',
                border: 'none',
                borderRadius: '9999px',
                cursor: 'pointer',
                color: 'var(--ai-text-secondary, #6b7280)',
                fontSize: '0.6875rem',
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
          ref={contentRef}
          side="bottom"
          align="start"
          sideOffset={squaring.sideOffset}
          onOpenAutoFocus={e => e.preventDefault()}
          onCloseAutoFocus={e => e.preventDefault()}
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
          <Listbox
            id={listboxId}
            options={filteredOptions}
            activeIndex={activeIndex}
            selectedValues={selectedValues}
            onSelect={commitSelection}
            loading={loading}
            loadingMessage="Searching…"
            emptyMessage={noResultsMessage}
            multiSelectable={multiple}
            itemPadding="var(--ai-combobox-item-padding, 0.4375rem 0.75rem)"
            size={size}
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
};
