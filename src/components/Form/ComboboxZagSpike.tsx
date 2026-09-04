/**
 * SPIKE — not a real component, not exported from the barrel, not wired into
 * the manifest. See GitHub issue #124 for the evaluation this exists to
 * support: does @zag-js/combobox's state machine hold up as a replacement
 * for Combobox.tsx's hand-rolled open/activeIndex/query/async-search state?
 *
 * Deliberately mirrors ComboboxProps exactly so the existing test suite
 * (src/__tests__/Combobox.test.tsx) can be pointed at this file with the
 * import swapped and nothing else changed, to get a real parity signal.
 *
 * Known gaps vs. the real Combobox, left as-is for the spike rather than
 * chased down — see the write-up in issue #124, not fixed here:
 * - No focus-opens-the-panel behavior in client-filter mode (zag has no
 *   openOnFocus equivalent) -- not covered by any existing test.
 * - Loading state is still hand-managed (zag's combobox machine has no
 *   built-in async/loading concept), same as the original.
 */
import React, { useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import * as combobox from '@zag-js/combobox';
import { useMachine, normalizeProps } from '@zag-js/react';
import { useOptionalFormContext } from './FormContext';
import { FieldContext } from './FieldContext';
import { aiBus } from '../../eventBus/eventBus';
import { Z_INDEX } from '../../theme/zIndex';
import { getSparseVariables } from '../../theme/slice';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { ComboboxThemeSlice } from './ComboboxSlice';
import { CONTROL_FONT_SIZE_VAR, resolveControlPadding } from '../../theme/controlSize';
import { useLocaleStrings } from '../Locale/LocaleContext';
import type { ComboboxProps } from './Combobox';
import type { ListboxOptionData } from '../Listbox/Listbox';

export const ComboboxZagSpike: React.FC<ComboboxProps> = ({
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
  useInjectInteractionStyles();

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

  const [asyncOptions, setAsyncOptions] = useState<ListboxOptionData[] | null>(null);
  const [staticFilterText, setStaticFilterText] = useState('');
  // Controls the input's displayed text. Required in addition to the
  // controlled `value` above -- zag's `selectionBehavior: 'replace'` only
  // updates its own *internal* inputValue context on select; with `value`
  // externally controlled (mandatory here for Form binding), the consumer
  // is likewise expected to control `inputValue` in lockstep to see that
  // replacement reflected in the actual rendered text. Discovered directly:
  // leaving inputValue uncontrolled left the input showing stale/typed text
  // after every select, clear, and blur-revert. Same role as the real
  // Combobox's own `query` state.
  const [query, setQuery] = useState(multiple ? '' : labelFor(selectedValues[0] ?? ''));
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const collectionItems = useMemo(() => {
    if (onSearch) return asyncOptions ?? [];
    const source = staticOptions ?? [];
    if (!staticFilterText) return source;
    const q = staticFilterText.toLowerCase();
    return source.filter(o => o.label.toLowerCase().includes(q));
  }, [onSearch, asyncOptions, staticOptions, staticFilterText]);

  const collection = useMemo(
    () =>
      combobox.collection<ListboxOptionData>({
        items: collectionItems,
        itemToValue: item => item.value,
        itemToString: item => item.label,
        isItemDisabled: item => !!item.disabled,
      }),
    [collectionItems]
  );

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

  // Ref, not state -- read from inside onInputValueChange below, which is
  // itself passed into useMachine's config before `api` exists. Assigned
  // during render, same idempotent-write pattern selectedLabelsRef already
  // uses in the real Combobox: only ever holds "the latest api," and every
  // read happens in a later event callback, never during the render that
  // wrote it.
  const apiRef = useRef<combobox.Api | null>(null);

  const baseId = useId();
  const service = useMachine(combobox.machine, {
    id: baseId,
    collection,
    disabled,
    multiple,
    allowCustomValue,
    selectionBehavior: multiple ? 'clear' : 'replace',
    defaultValue: selectedValues,
    value: selectedValues,
    inputValue: query,
    // Async mode must not open the panel on the keystroke itself -- only
    // once the debounced search actually starts (matches the real
    // Combobox's isUserTypingRef-gated behavior). Client-filter mode keeps
    // the simpler "typing opens immediately" default.
    openOnChange: !onSearch,
    openOnClick: !onSearch,
    positioning: { placement: 'bottom-start', sameWidth: true },
    translations: { clearTriggerLabel: strings.clearSelection },
    onValueChange: details => {
      details.items.forEach(item => selectedLabelsRef.current.set(item.value, item.label));
      emitChange(details.value);
    },
    onInputValueChange: details => {
      // Mirror every reported inputValue unconditionally -- covers typing,
      // item-select's replace, clear-trigger's clear, and blur's revert, all
      // of which report through this same callback (see the `query` state's
      // own comment above for why controlling inputValue is necessary at
      // all once `value` is controlled).
      setQuery(details.inputValue);
      // Only a real keystroke should filter/search -- programmatic changes
      // (item-select, clear-trigger, script) fire this same callback too,
      // and must not re-trigger either path. This one check replaces the
      // real Combobox's isUserTypingRef flag entirely.
      if (details.reason !== 'input-change') return;
      if (!onSearch) {
        setStaticFilterText(details.inputValue);
        return;
      }
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      const requestId = ++requestIdRef.current;
      const text = details.inputValue;
      debounceTimerRef.current = setTimeout(() => {
        apiRef.current?.setOpen(true, 'script');
        setLoading(true);
        onSearch(text)
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
    },
  });

  const api = combobox.connect(service, normalizeProps);
  apiRef.current = api;
  // getInputProps() returns `defaultValue` (zag's own uncontrolled-DOM-sync
  // path); destructured out here since this component instead renders a
  // real controlled `value` (see the input's own comment below) and React
  // warns on an element receiving both.
  const { defaultValue: _zagDefaultInputValue, ...inputProps } = api.getInputProps();

  // External/Form-driven value changes (Form.resetForm(), e.g. -- not a
  // selection made through this input) still need to resync the displayed
  // text, the same case the real Combobox's own comboboxSyncKey covers.
  // "Adjusted during render," not a useEffect, for the same reason that
  // file gives: this must resync exactly when rawValue/multiple/open
  // actually change, not on every render.
  const comboboxSyncKey = `${multiple}|${api.open}|${rawValue}`;
  const [prevComboboxSyncKey, setPrevComboboxSyncKey] = useState(comboboxSyncKey);
  if (comboboxSyncKey !== prevComboboxSyncKey) {
    setPrevComboboxSyncKey(comboboxSyncKey);
    if (!multiple && !api.open) setQuery(labelFor(selectedValues[0] ?? ''));
  }

  const hasValue = selectedValues.length > 0;

  return (
    <div {...api.getRootProps()}>
      <div
        {...api.getControlProps()}
        className="ai-focus-ring"
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
                  api.setValue(selectedValues.filter(x => x !== v));
                  api.focus();
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
          {...inputProps}
          // Overrides getInputProps()'s own `defaultValue` -- since
          // `inputValue` is a controlled machine prop (see `query`'s own
          // comment above), the actual DOM text also has to be a real React
          // controlled `value`, not zag's uncontrolled-input default path
          // (which only ever syncs the DOM node imperatively in response to
          // an *internal* context change, never in response to a controlled
          // prop already matching what zag computed).
          value={query}
          id={effectiveId}
          aria-label={ariaLabel}
          aria-invalid={isError || undefined}
          aria-describedby={isError ? `${fieldName}-error` : undefined}
          placeholder={hasValue && multiple ? undefined : placeholder}
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
        {!disabled && (
          <button
            {...api.getClearTriggerProps()}
            aria-label={strings.clearSelection}
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

      <div {...api.getPositionerProps()} style={{ ...api.getPositionerProps().style, zIndex: Z_INDEX.DROPDOWN }}>
        {api.open && (
          <div
            {...api.getContentProps()}
            style={{
              background: 'var(--ai-bg-surface, #ffffff)',
              border: '0.0625rem solid var(--ai-border, #e5e7eb)',
              borderRadius: 'var(--ai-radius-md, 0.375rem)',
              boxShadow: '0 0.625rem 1.5625rem -0.3125rem rgba(0,0,0,0.15)',
              overflow: 'hidden',
              padding: 'var(--ai-padding-xs, 0.25rem)',
              maxHeight: '15rem',
              overflowY: 'auto',
              ...comboboxVars,
            }}
          >
            {loading && (
              <div style={{ padding: 'var(--ai-combobox-item-padding, 0.4375rem 0.75rem)', fontSize: '0.8125rem', color: 'var(--ai-text-secondary, #6b7280)' }}>
                Searching…
              </div>
            )}
            {!loading && collectionItems.length === 0 && (
              <div style={{ padding: 'var(--ai-combobox-item-padding, 0.4375rem 0.75rem)', fontSize: '0.8125rem', color: 'var(--ai-text-secondary, #6b7280)' }}>
                {noResultsMessage}
              </div>
            )}
            {!loading &&
              collectionItems.map(opt => {
                const itemState = api.getItemState({ item: opt });
                return (
                  <div
                    key={opt.value}
                    {...api.getItemProps({ item: opt })}
                    className="ai-menu-item"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--ai-combobox-item-padding, 0.4375rem 0.75rem)',
                      fontSize: CONTROL_FONT_SIZE_VAR[size],
                      borderRadius: 'var(--ai-radius-sm, 0.25rem)',
                      color: 'var(--ai-text-primary, #111827)',
                      background: itemState.selected ? 'var(--ai-subtheme-info-bg, rgba(59, 130, 246, 0.1))' : undefined,
                      cursor: opt.disabled ? 'not-allowed' : 'pointer',
                      opacity: opt.disabled ? 0.5 : 1,
                      userSelect: 'none',
                    }}
                  >
                    {opt.render ? opt.render(opt) : opt.label}
                    {itemState.selected && (
                      <span style={{ color: 'var(--ai-color-primary, #3b82f6)', fontWeight: 'var(--ai-font-weight-black, 900)' }}>✓</span>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
};
