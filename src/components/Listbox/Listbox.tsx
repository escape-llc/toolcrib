'use client';

import React, { type ReactNode, useContext, useEffect, useState } from 'react';
import { FieldContext } from '../Form/FieldContext';
import { useOptionalFormContext } from '../Form/FormContext';
import { useFieldInvalid, INVALID_COLOR } from '../Form/useFieldInvalid';
import { useFieldsetDisabled } from '../Fieldset/FieldsetContext';
import { CONTROL_FONT_SIZE_VAR, type ControlSize } from '../../theme/controlSize';
import { VisuallyHidden } from '../Layout/VisuallyHidden';
import { useLocaleStrings } from '../Locale/LocaleContext';

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
 * that needs a keyboard-navigable option list.
 */
export interface ListboxProps {
  /** DOM id for the listbox container. Each option's own id is derived from this (`${id}-option-${index}`) — predictable so a caller can compute the active option's id for `aria-activedescendant` without Listbox needing to expose it separately. */
  id: string;
  /** Options to render. */
  options: ListboxOptionData[];
  /** Index of the currently keyboard-highlighted option, if any. */
  activeIndex?: number;
  /**
   * Values currently selected (controlled). Omit it to let the Listbox own
   * its selection: inside a `<Form>` the selection is bound to the field
   * (`name`, or the surrounding `<FormField>`'s), submitting a string, or a
   * string array when `multiSelectable`; outside one it is kept internally.
   * Combobox and Select pass it, so their popup lists never bind.
   */
  selectedValues?: string[];
  /** Field name for the bound selection. Auto-inherited from parent `<FormField>` if omitted. Ignored when `selectedValues` is passed. */
  name?: string;
  /** Initial selection when `selectedValues` is omitted: a value, or values when `multiSelectable`. */
  defaultValue?: string | string[];
  /** If true, no option can be chosen. Also set by an enclosing `<Fieldset disabled>`. @default false */
  disabled?: boolean;
  /** Marks the bound selection invalid; inside a `<Form>` it follows the field's error. */
  'aria-invalid'?: boolean;
  /** Called when an option is chosen (via `mousedown`, so a fast pointer-down-then-drag selects correctly, matching native listbox feel — and before an input's own `blur` would otherwise run). Never called for a `disabled` option. */
  onSelect?: (option: ListboxOptionData) => void;
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
   * Accessible name for the listbox. A listbox always needs one: a
   * controlling field's `aria-controls` doesn't name it. When it's the popup
   * of a field, give it the field's name (Combobox and Select pass their
   * `aria-label`, or the FormField label via `aria-labelledby`). A
   * `<div role="listbox">` with neither this nor `aria-labelledby` has no
   * name at all.
   */
  'aria-label'?: string;
  /** Same as `aria-label`, but referencing an existing visible label element's id instead of a literal string. */
  'aria-labelledby'?: string;
}

/**
 * @manifest Keyboard-navigable, controlled option list — extracted from Combobox's own hand-built listbox, now usable standalone
 * @manifestConstraints Purely presentational — owns no keyboard-navigation state; the caller drives `activeIndex` and reads back `${id}-option-${index}` for its own `aria-activedescendant`
 * @manifestCategory Form Controls
 * @manifestStates default, disabled, invalid
 * @manifestGuarantees form-contract
 */
export const Listbox: React.FC<ListboxProps> = ({
  id,
  options,
  activeIndex,
  selectedValues: controlledSelected,
  name: propName,
  defaultValue,
  disabled: disabledProp = false,
  'aria-invalid': ariaInvalid,
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
  const strings = useLocaleStrings().listbox;

  // Selected-item binding, only when the caller doesn't control selection.
  const ownsSelection = controlledSelected === undefined;
  const fieldCtx = useContext(FieldContext);
  const fieldName = ownsSelection ? propName || fieldCtx.name || '' : '';
  const formContext = useOptionalFormContext();
  const registerField = formContext?.registerField;
  const isFormBound = !!(fieldName && formContext);
  const seed: string | string[] = defaultValue ?? (multiSelectable ? [] : '');
  useEffect(() => {
    if (fieldName && registerField) registerField(fieldName, seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a seed is read once, like any default
  }, [fieldName, registerField]);
  const [internalSelected, setInternalSelected] = useState<string | string[]>(seed);
  const owned = isFormBound ? ((formContext!.values[fieldName] as string | string[] | undefined) ?? seed) : internalSelected;
  const selectedValues = controlledSelected ?? (Array.isArray(owned) ? owned : owned ? [owned] : []);
  const choose = (opt: ListboxOptionData) => {
    if (ownsSelection) {
      const next = multiSelectable
        ? selectedValues.includes(opt.value) ? selectedValues.filter(v => v !== opt.value) : [...selectedValues, opt.value]
        : opt.value;
      setInternalSelected(next);
      if (isFormBound) {
        formContext!.setFieldValue(fieldName, next);
        formContext!.setFieldTouched(fieldName, true);
      }
    }
    onSelect?.(opt);
  };
  const disabled = useFieldsetDisabled(disabledProp);
  // Only the bound selection has a field error; a popup list (Combobox,
  // Select) leaves invalid state to its field.
  const isError = useFieldInvalid(fieldName || undefined, ariaInvalid);
  const labelledBy = ariaLabelledBy ?? (!ariaLabel && ownsSelection ? fieldCtx.labelId : undefined);

  // Announces `loading` transitions via a visually-hidden aria-live region
  // -- the only non-visual signal a screen-reader user gets that an async
  // search (Combobox's own debounced onSearch) started or resolved.
  // Adjusted during render, not a useEffect -- same "sync state when a prop
  // changes" pattern Combobox itself already uses for comboboxSyncKey.
  // Deliberately scoped to `loading` transitions specifically, not every
  // `options` change: a static/client-filtered Listbox (loading always
  // false, never toggles) would otherwise announce a fresh result count on
  // every keystroke, which is exactly the kind of chatty, typing-
  // interrupting behavior real ARIA combobox guidance warns against --
  // `loading` only ever changes for genuinely async, already-debounced
  // searches, so gating on it naturally excludes that case.
  const [prevLoading, setPrevLoading] = useState(loading);
  const [announcement, setAnnouncement] = useState('');
  if (loading !== prevLoading) {
    setPrevLoading(loading);
    setAnnouncement(
      loading ? strings.loadingAnnouncement : options.length === 0 ? strings.noResultsAnnouncement : strings.resultsAnnouncement(options.length)
    );
  }

  return (
    <>
      <div aria-live="polite" aria-atomic="true">
        <VisuallyHidden>{announcement}</VisuallyHidden>
      </div>
      <div
        role="listbox"
        id={id}
        aria-label={ariaLabel}
        aria-labelledby={labelledBy}
        aria-multiselectable={multiSelectable || undefined}
        aria-disabled={disabled || undefined}
        aria-invalid={isError || undefined}
        aria-describedby={isError && fieldName ? `${fieldName}-error` : undefined}
        style={{
          padding: 'var(--ai-padding-xs, 0.25rem)',
          maxHeight: '15rem',
          overflowY: 'auto',
          // A ring in the error color when the bound selection is invalid (no
          // layout shift, unlike a border).
          ...(isError ? { boxShadow: `inset 0 0 0 0.0625rem ${INVALID_COLOR}`, borderRadius: 'var(--ai-radius-md, 0.375rem)' } : {}),
        }}
      >
        {/* role="option" + aria-disabled, not a plain div -- role="listbox"
            requires at least one role="option" child at all times (WAI-ARIA
            aria-required-children), including while loading or genuinely
            empty; a plain text div here leaves the listbox childless in
            exactly those two states, a real violation axe only started
            catching once a real scan actually reached this component while
            open (aria-compliance-review's own §1 coverage-gap finding).
            aria-disabled (not omitting a role, or disabled on a real
            <button>) keeps it correctly non-interactive without breaking
            the required-children contract -- a click never reaches
            onSelect for it since it's not part of options.map below. */}
        {loading && (
          <div role="option" aria-disabled="true" style={{ padding: itemPadding, fontSize: '0.8125rem', color: 'var(--ai-text-secondary, #6b7280)' }}>
            {loadingMessage}
          </div>
        )}
        {!loading && options.length === 0 && (
          <div role="option" aria-disabled="true" style={{ padding: itemPadding, fontSize: '0.8125rem', color: 'var(--ai-text-secondary, #6b7280)' }}>
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
                aria-disabled={disabled || opt.disabled || undefined}
                data-highlighted={index === activeIndex ? '' : undefined}
                className="ai-menu-item"
                // Press only keeps focus where it is (the combobox input or
                // trigger); the pick happens on click (#697). That matches a
                // native control: a user who presses on an option can still
                // cancel by moving off it before releasing.
                onMouseDown={e => e.preventDefault()}
                onClick={() => {
                  if (!opt.disabled && !disabled) choose(opt);
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
                  cursor: opt.disabled || disabled ? 'not-allowed' : 'pointer',
                  opacity: opt.disabled || disabled ? 0.5 : 1,
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
    </>
  );
};
