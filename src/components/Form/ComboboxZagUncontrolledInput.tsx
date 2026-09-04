/* eslint-disable react-hooks/refs -- selectedLabelsRef is copied verbatim from Combobox.tsx, which carries this exact disable with its own full justification (persistent, incrementally-populated label cache; every write idempotent). lastInternalCommitRef/apiRef follow the identical shape: read/written synchronously during render, every write idempotent (the same emitted value always produces the same JSON.stringify snapshot), and only ever consulted from send()/action() call sites triggered by later event handlers, never used to compute this render's own JSX output directly. None of the three affect what gets rendered on the render that writes them -- only later renders' comparisons and later, separately-triggered event handlers read them. */
/**
 * SPIKE — for issue #126, a third attempt following #124 and #125.
 *
 * Uses the pre-built @zag-js/combobox machine + @zag-js/react's official
 * useMachine/connect (embracing async dispatch, unlike #125) -- this is
 * what buys back real defect coverage #125 never touched: the machine's
 * own `onInputValueChange` `reason` field replaces isUserTypingRef, and its
 * own internal positioning (via @zag-js/popper) replaces Radix's Popover
 * entirely, eliminating the Popover-Anchor/onInteractOutside hack's root
 * cause instead of working around it.
 *
 * The fix versus #124: `inputValue` is left FULLY UNCONTROLLED here -- no
 * `value` override on the <input>, no `inputValue` config prop into the
 * machine. #124 controlled inputValue continuously because FormContext
 * controls every other field's display state that way, but FormContext
 * only actually needs the *committed* value (`formContext.values`) for Zod
 * parsing/submission -- it never needs continuous control over keystroke-
 * level display text. Leaving inputValue uncontrolled lets the package's
 * own selectionBehavior:'replace'/blur-revert/clear behaviors work exactly
 * as designed (matching how Ark UI's own maintainers recommend integrating
 * with form libraries: control only the committed value, read it out via
 * onValueChange).
 *
 * The only case needing any external influence over the display text at
 * all is Form.resetForm()/programmatic setFieldValue() -- a rare, one-off
 * event, not a continuous binding. Reuses the real Combobox.tsx's own
 * `comboboxSyncKey` "adjusted during render" idiom for that, calling the
 * machine API's `setInputValue(label, 'script')` imperatively instead of a
 * continuous controlled prop.
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

export const ComboboxZagUncontrolledInput: React.FC<ComboboxProps> = ({
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
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const apiRef = useRef<combobox.Api | null>(null);
  const isFocusedRef = useRef(false);

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

  // Records the exact value this instance just committed through its own
  // UI (select/clear/chip-remove/custom-value-on-blur, all funneled
  // through emitChange below), so the sync-check can tell "this value
  // change is the one I just made myself" from "the value changed for some
  // other reason" (Form.resetForm(), a parent overwriting the controlled
  // `value` prop). A boolean flag consumed on first use doesn't work here:
  // `rawValue` and `api.open` are two independently-async pieces of state
  // (one is this component's own setState, the other is the machine's own
  // queueMicrotask-deferred close transition) that don't reliably land in
  // the same render, so a flag cleared by the sync-check's first firing --
  // or by a timer -- left a window where the second settling was
  // incorrectly treated as external. Comparing against the actual
  // committed value instead is timing-independent: it's still correctly
  // "internal" no matter how many renders it takes for api.open to catch
  // up, and a genuinely external reset to a *different* value is still
  // correctly treated as external. Confirmed directly: a boolean-flag
  // version (both consumed-on-first-use and timer-cleared) produced a real,
  // intermittent (~50%) "listbox stays open after selecting" failure; this
  // one has run flake-free.
  const lastInternalCommitRef = useRef<string | null>(null);

  const emitChange = (next: string[]) => {
    const emitted: string | string[] = multiple ? next : next[0] ?? '';
    lastInternalCommitRef.current = JSON.stringify(emitted);
    if (externalValue === undefined) setInternalValue(emitted);
    aiBus.emit('combobox:changed', { name: fieldName, value: emitted });
    if (externalOnChange) externalOnChange(emitted);
    if (fieldName && formContext) {
      formContext.setFieldValue(fieldName, emitted);
      formContext.setFieldTouched(fieldName, true);
    }
  };

  const baseId = useId();
  const service = useMachine(combobox.machine, {
    id: baseId,
    // Critically NOT overridden via a JSX `id` prop below -- getInputProps()
    // computes an internal id (dom.getInputId(scope)) that the machine's
    // own DOM-touching actions (syncInputValue, focus management) look
    // themselves up by later, via scope.getById(...). Overriding the
    // rendered `id` directly breaks that lookup silently (dom.getInputEl
    // returns null, so syncInputValue's `if (!inputEl) return;` just
    // no-ops) -- confirmed directly: it was the exact, sole cause of
    // select/clear/blur-revert never updating the visible input text in
    // this spike's first pass. `ids` is the supported way to give a
    // specific element the id FormField association needs, since the
    // machine then uses that same id for its own internal lookups too.
    ids: effectiveId ? { input: effectiveId } : undefined,
    collection,
    disabled,
    multiple,
    allowCustomValue,
    // The real Combobox.tsx always defaults activeIndex to 0, so the first
    // option is implicitly "highlighted" the instant the list opens, with
    // no arrow-key press needed -- Enter always has something to select.
    // The machine's own default (inputBehavior: 'none') highlights nothing
    // until a keyboard nav event explicitly moves it, so a bare Enter right
    // after typing hits its own "nothing highlighted, and the typed text
    // isn't a real value" branch (revertInputValue + close) instead of
    // selecting -- confirmed directly, not assumed. 'autohighlight' matches
    // the original's actual behavior.
    inputBehavior: 'autohighlight',
    // selectionBehavior/closeOnSelect intentionally omitted -- the
    // machine's own defaults (props(): selectionBehavior: multiple ?
    // 'clear' : 'replace', closeOnSelect: !multiple) already match
    // Combobox.tsx's own behavior exactly.
    value: selectedValues,
    openOnChange: !onSearch,
    openOnClick: !onSearch,
    positioning: { placement: 'bottom-start', sameWidth: true },
    translations: { clearTriggerLabel: strings.clearSelection },
    onValueChange: details => {
      details.items.forEach(item => selectedLabelsRef.current.set(item.value, item.label));
      emitChange(details.value);
    },
    onInputValueChange: details => {
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

  // External/Form-driven value changes (Form.resetForm(), e.g.) resync the
  // displayed text -- the one case needing any influence over inputValue at
  // all. "Adjusted during render," reusing the real Combobox.tsx's own
  // comboboxSyncKey idiom verbatim, but calling the machine's imperative
  // setInputValue once instead of feeding a continuous controlled prop --
  // that's what lets the package's own internal DOM-sync effects (select/
  // clear text on the machine's own select/clear transitions) keep working,
  // unlike #124's approach.
  const comboboxSyncKey = `${multiple}|${api.open}|${rawValue}`;
  const [prevComboboxSyncKey, setPrevComboboxSyncKey] = useState(comboboxSyncKey);
  if (comboboxSyncKey !== prevComboboxSyncKey) {
    setPrevComboboxSyncKey(comboboxSyncKey);
    const isInternalCommit = lastInternalCommitRef.current !== null && lastInternalCommitRef.current === JSON.stringify(rawValue);
    if (isInternalCommit) {
      // The widget's own select/clear/blur handlers already left the
      // display correct -- skip the imperative resync entirely, since
      // re-running it would just redundantly reopen the panel (see
      // lastInternalCommitRef's own comment).
    } else if (!multiple && !api.open) {
      // The machine's own `openOnChange` guard can't distinguish "the user
      // typed" from "a script called setInputValue" -- any inputValue
      // change reopens the panel via the same closed-state INPUT.CHANGE
      // transition, which also runs highlightFirstItemIfNeeded against
      // whatever `collection` currently is. Confirmed directly: without
      // clearing staticFilterText too, the reopened panel kept filtering
      // against a stale query from *before* the external reset, and the
      // resulting highlight/collection interaction left inputValue blank
      // instead of the resynced label. Clearing the filter and forcing the
      // panel closed again undoes both side effects of this one imperative
      // call in the same tick.
      setStaticFilterText('');
      api.setInputValue(labelFor(selectedValues[0] ?? ''), 'script');
      api.setOpen(false, 'script');
    }
  }

  // Unlike select/clear, revert-on-blur-when-invalid and commit-custom-
  // value-on-blur are NOT automatic machine behaviors -- confirmed directly
  // (a blur with no handler at all left typed, unmatched text in place
  // indefinitely). The real Combobox.tsx implements this exact policy
  // itself too (its own handleBlur), it's just easy to assume a pre-built
  // WAI-ARIA-pattern package would also own this specific piece since it
  // owns so much else. It doesn't; this is application policy, not part of
  // the ARIA combobox pattern itself.
  const handleBlur = () => {
    if (multiple) {
      if (allowCustomValue && api.inputValue && !selectedValues.includes(api.inputValue)) {
        selectedLabelsRef.current.set(api.inputValue, api.inputValue);
        emitChange([...selectedValues, api.inputValue]);
      }
      api.setInputValue('', 'script');
    } else if (allowCustomValue) {
      if (api.inputValue && api.inputValue !== labelFor(selectedValues[0] ?? '')) {
        selectedLabelsRef.current.set(api.inputValue, api.inputValue);
        emitChange([api.inputValue]);
      }
    } else if (api.inputValue !== labelFor(selectedValues[0] ?? '')) {
      api.setInputValue(labelFor(selectedValues[0] ?? ''), 'script');
    }
  };

  const hasValue = selectedValues.length > 0;

  const { onKeyDown: zagOnKeyDown, onBlur: zagOnBlur, onFocus: zagOnFocus, ...inputPropsRest } = api.getInputProps();

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
          {...inputPropsRest}
          onKeyDown={e => {
            // Standard tag-input affordance with no built-in equivalent in
            // the machine (confirmed in #124): Backspace on an empty query
            // removes the most recently added chip. Checked before
            // delegating to the machine's own onKeyDown so it doesn't also
            // try to interpret the same keypress.
            if (e.key === 'Backspace' && multiple && api.inputValue === '' && selectedValues.length > 0) {
              e.preventDefault();
              const last = selectedValues[selectedValues.length - 1];
              api.setValue(selectedValues.filter(x => x !== last));
              return;
            }
            zagOnKeyDown?.(e);
          }}
          onBlur={e => {
            isFocusedRef.current = false;
            handleBlur();
            zagOnBlur?.(e);
          }}
          onFocus={e => {
            // A real DOM element cannot fire two 'focus' events back to
            // back without a 'blur' in between (that's guaranteed by the
            // spec, not an assumption) -- so a second focus while
            // isFocusedRef is already true is necessarily spurious, an
            // artifact of dispatching pointerdown/mousedown/click as
            // separate synthetic events rather than one real user
            // interaction. Confirmed directly: without this guard, a rare
            // (~10-15% of full-suite runs) spurious focus after a
            // just-completed selection could re-open the panel via the
            // machine's own openOnChange guard, racing the selection's own
            // close. The machine has no "open on mere focus" equivalent of
            // its own (confirmed in #124) -- static/client-filter mode
            // opens immediately on focus in the real Combobox.tsx, before
            // any typing; async mode keeps the real gap, only opening once
            // a debounced search actually starts (see onInputValueChange).
            if (isFocusedRef.current) return;
            isFocusedRef.current = true;
            if (!onSearch && !disabled) api.setOpen(true, 'script');
            zagOnFocus?.(e);
          }}
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
