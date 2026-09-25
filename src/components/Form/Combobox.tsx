'use client';

/* eslint-disable react-hooks/refs -- selectedLabelsRef below is a persistent,
   incrementally-populated label cache read/written synchronously during
   render (see its own comment for why: labels must survive staticOptions/
   asyncOptions no longer containing a matching entry, e.g. after an async
   search moves on). Two things make this a deliberate exception rather
   than a bug: (1) every write is idempotent -- the same value key always
   resolves to the same deterministic label from immutable inputs, so even
   a discarded/replayed render (the actual concern this rule guards
   against) can't corrupt it, writing the same data twice does nothing
   different from writing it once; (2) deferring the population to an
   effect (the rule's own suggested fix) would be a real regression, not a
   fix -- the very first render needs already-selected values' labels
   resolved immediately (used at line ~171 for this component's own
   initial `query` state and in the chip list below), and effects don't
   run until after that first render commits, so an effect-based version
   would show raw values instead of labels on initial mount until some
   unrelated re-render happened to occur. Confirmed correct as-is, not
   deferred out of caution. */
import React, { type ReactNode, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { useOptionalFormContext } from './FormContext';
import { FieldContext } from './FieldContext';
import { aiBus } from '../../eventBus/eventBus';
import { Z_INDEX } from '../../theme/zIndex';
import { getSparseVariables } from '../../theme/slice';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { computeCornerSquaring, useActualPopoverSide } from '../../theme/connectedPopoverStyles';
import { useTargetDocument } from '../../theme/targetDocumentContext';
import { injectGlobalStyle } from '../../theme/injectGlobalStyle';
import { useNonce } from '../../theme/nonceContext';
import { type SquareCornerOption, resolveSquareCorners } from '../Card/Card';
import { useUIGroupSquareCorners } from '../UIGroup/UIGroupContext';
import { ComboboxThemeSlice, type ComboboxSliceState } from './ComboboxSlice';
import { CONTROL_FONT_SIZE_VAR, resolveControlPadding, type ControlSize } from '../../theme/controlSize';
import { Listbox, type ListboxOptionData } from '../Listbox/Listbox';
import { type SubthemeName } from '../../theme/subtheme';
import { resolveColorVariant, type ColorVariant, type Appearance } from '../../theme/colorVariant';
import { useLocaleStrings } from '../Locale/LocaleContext';

const COMBOBOX_CHIP_REMOVE_STYLE_ID = 'toolcrib-combobox-chip-remove-focus';

// Issue #425: the chip remove button sits ON its chip's own filled
// background -- by default var(--ai-color-primary) (a selected chip is
// persistent bucket-1 identity per AGENTS.md's color-buckets taxonomy), or
// whatever `chipColor` (issue #426) resolves for that specific chip. The
// shared `.ai-focus-ring` mechanism's own ring color (--ai-focus-ring) is
// primary-hued by design (focus rings stay primary-anchored everywhere, so
// "this is keyboard-focused" reads as one consistent signal) -- so applying
// it here would produce a ring with almost no contrast against a default
// primary chip, not a real fix.
//
// `currentColor`, not a fixed token: the button inherits its chip's own
// text color, which resolveColorVariant already picks as the readable
// color for that chip's background (--ai-color-primary-text for the
// default solid primary chip -- pickReadableTextColor's WCAG-checked value,
// harmonies.ts -- or a subtheme's -on-main/-text, etc.). The ring therefore
// contrasts against whichever background its own chip actually has, per
// chip, with no per-color lookup here. #425's original version hardcoded
// --ai-color-primary-text, correct only while every chip was primary.
function injectComboboxChipRemoveStyles(targetDocument?: Document, nonce?: string): void {
  injectGlobalStyle(
    COMBOBOX_CHIP_REMOVE_STYLE_ID,
    `
    .ai-combobox-chip-remove {
      outline: var(--ai-focus-ring-width, 0.125rem) solid transparent;
      outline-offset: var(--ai-focus-ring-offset, 0.125rem);
      transition: outline-color var(--ai-transition-duration-normal, 0.2s) var(--ai-transition-easing, ease);
    }
    .ai-combobox-chip-remove:focus-visible {
      outline-color: currentColor;
    }
    `,
    targetDocument,
    nonce
  );
}

/**
 * Color for one multi-select chip, returned by `<Combobox chipColor>`. Same
 * `subtheme`/`variant`/`appearance` trio as `<Badge>`, resolved through the
 * same shared `resolveColorVariant` — `subtheme` wins over `variant` when
 * both are set. `appearance` defaults to `'solid'` here (not `Badge`'s
 * `'soft'`), matching the filled look every chip already has.
 */
export interface ComboboxChipColor {
  /** One of the 4 fixed status colors — e.g. a red `'error'` "urgent" tag. */
  subtheme?: SubthemeName;
  /** Identity color from the harmony palette. Ignored if `subtheme` is set. */
  variant?: ColorVariant;
  /** Visual treatment for the resolved color. @default 'solid' */
  appearance?: Appearance;
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
   * Accessible name announced by screen readers. Only needed when this
   * `Combobox` isn't inside a `<FormField label="...">` -- the `<label
   * htmlFor>` that renders provides the accessible name already in that
   * case, the same way it does for `Input`/`Select`/`Slider`.
   */
  ariaLabel?: string;
  /**
   * Client-side option list, filtered locally by substring match against
   * `label`. Omit when using `onSearch` for server-driven results instead.
   */
  options?: ListboxOptionData[];
  /**
   * Async search — called (debounced by `searchDebounceMs`) with the
   * current query whenever it changes. Takes over from `options` entirely
   * when provided; results replace the listbox contents once resolved.
   */
  onSearch?: (query: string) => Promise<ListboxOptionData[]>;
  /** Debounce delay before calling `onSearch`. @default 250 */
  searchDebounceMs?: number;
  /**
   * Allows selecting more than one option, rendered as removable chips.
   * Changes the shape of `value`/`defaultValue`/`onChange` from `string` to
   * `string[]`. @default false
   */
  multiple?: boolean;
  /**
   * Per-chip color when `multiple` is true — called with each selected
   * value; return `undefined` for the default solid primary chip. A
   * function of the value rather than a field on each option, so it also
   * covers `allowCustomValue` chips and controlled/async values that have
   * no matching option object on hand (e.g. `v => v === 'urgent' ? { subtheme: 'error' } : undefined`).
   */
  chipColor?: (value: string) => ComboboxChipColor | undefined;
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
  /** Explicit corner-squaring override, e.g. for a `<UIGroup>` member. See `<Button>`'s own identical prop for the general pattern. */
  squareCorners?: SquareCornerOption;
}

/**
 * @manifest Filterable text input with a listbox, supporting client-side or async search and single/multi selection, bound to Form context
 * @manifestCategory Form Controls
 */
export const Combobox: React.FC<ComboboxProps> = ({
  id,
  name: propName,
  placeholder = 'Search...',
  ariaLabel,
  options: staticOptions,
  onSearch,
  searchDebounceMs = 250,
  multiple = false,
  chipColor,
  value: externalValue,
  defaultValue,
  onChange: externalOnChange,
  allowCustomValue = false,
  disabled = false,
  noResultsMessage = 'No results',
  overrides,
  size = 'md',
  squareCorners,
}) => {
  const fieldCtx = useContext(FieldContext);
  const fieldName = propName || fieldCtx.name || '';
  const effectiveId = id ?? (fieldName || undefined);
  const formContext = useOptionalFormContext();
  const registerField = formContext?.registerField;
  const isError = fieldName && formContext ? formContext.touched[fieldName] && !!formContext.errors[fieldName] : false;
  const comboboxVars = getSparseVariables(ComboboxThemeSlice, overrides ?? {});
  const uiGroupSquareCorners = useUIGroupSquareCorners();
  const cornerOverrides = resolveSquareCorners(squareCorners ?? uiGroupSquareCorners);
  const strings = useLocaleStrings().combobox;
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
  const contentRef = useRef<HTMLDivElement>(null);
  useInjectInteractionStyles();
  const nonce = useNonce();
  useEffect(() => {
    injectComboboxChipRemoveStyles(targetDocument, nonce);
  }, [targetDocument, nonce]);

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
  const [asyncOptions, setAsyncOptions] = useState<ListboxOptionData[] | null>(null);
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

  // Requests opening directly below the input, at the input's own width
  // (`width: var(--radix-popover-trigger-width)` on Content below) -- so
  // the whole bottom edge of the input meets the whole top edge of the
  // listbox, not just one corner. align="stretch" squares both connecting
  // corners on each side accordingly. Unlike DropdownMenu/Popup, side/align
  // aren't configurable here, so 'bottom' is a fixed request rather than
  // threaded through as a prop -- but Radix still auto-flips to 'top' on
  // collision regardless of what's requested, so the actual, possibly
  // flipped side (see useActualPopoverSide) is what corner-squaring uses.
  const actualSide = useActualPopoverSide(contentRef, 'bottom', open && !disabled);
  const squaring = computeCornerSquaring(actualSide, 'stretch', open && !disabled, 'var(--ai-radius-md, 0.375rem)');

  // External/Form-driven value changes (not from a selection made through
  // this input) resync the displayed text in single mode — e.g.
  // Form.resetForm(). Multi mode has no single "current label" to sync the
  // input to (selections render as chips instead, not as the input's text).
  //
  // Adjusted during render, not via a useEffect -- React's own documented
  // pattern for "sync state when a prop changes." Deliberately keyed on the
  // same three inputs the original effect's deps list named (multiple,
  // open, rawValue) rather than depending on labelFor/selectedValues too --
  // this must resync exactly when one of those three actually changes, not
  // on every render where selectedValues happens to differ for an unrelated
  // reason (e.g. the user's own selection, which shouldn't stomp on what
  // they just typed/selected).
  const comboboxSyncKey = `${multiple}|${open}|${rawValue}`;
  const [prevComboboxSyncKey, setPrevComboboxSyncKey] = useState(comboboxSyncKey);
  if (comboboxSyncKey !== prevComboboxSyncKey) {
    setPrevComboboxSyncKey(comboboxSyncKey);
    if (!multiple && !open) setQuery(labelFor(selectedValues[0] ?? ''));
  }

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

  // Adjusted during render, not via a useEffect -- same "sync state when a
  // derived value changes" pattern as above, avoiding an extra
  // render-then-effect-then-rerender cascade every time the filtered list
  // shrinks/grows.
  const [prevFilteredLength, setPrevFilteredLength] = useState(filteredOptions.length);
  if (filteredOptions.length !== prevFilteredLength) {
    setPrevFilteredLength(filteredOptions.length);
    setActiveIndex(prev => Math.max(0, Math.min(prev, filteredOptions.length - 1)));
  }

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
    } else if (e.key === 'Escape' && open) {
      // Required by the WAI-ARIA APG Combobox pattern: Escape closes the
      // popup when it's open. stopPropagation so a single Escape press
      // closes only this listbox, not also a parent Modal/Drawer the
      // combobox happens to be nested in (which would otherwise see the
      // same bubbling keydown and close itself too, in the same press).
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    }
  };

  // Matches Listbox's own id-generation scheme (`${id}-option-${index}`,
  // where `id` is whatever's passed as its own `id` prop below) — Listbox
  // is deliberately controlled/presentational and doesn't expose its
  // option ids any other way, so a caller predicts them from the same `id`
  // it already passed in.
  const activeOptionId = filteredOptions[activeIndex] ? `${listboxId}-option-${activeIndex}` : undefined;
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
            // All four corners as explicit longhands, not the `borderRadius`
            // shorthand -- squaring.triggerCornerStyle only ever includes
            // the specific corners currently squared (2 of 4, and *which*
            // 2 changes as the popover's actual side flips), so mixing it
            // with a shorthand base means the set of longhand keys present
            // changes across renders while the shorthand stays put. React
            // warns about exactly this ("Removing a style property...when a
            // conflicting property is set"), confirmed directly once
            // useActualPopoverSide started actually detecting a real flip
            // instead of silently never updating. See AGENTS.md's own
            // documented fix for this same pattern (Button's corner-radius
            // computation).
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
            // No inline transition -- .ai-focus-ring's own shared rule
            // (interactionStyles.ts) already covers border-radius
            // specifically for this reason (Combobox's own corner-squaring
            // morph) and is !important, so this would be silently
            // discarded outright, not just redundant (issue #411).
            ...squaring.triggerCornerStyle,
            ...comboboxVars,
            ...cornerOverrides,
          }}
        >
          {multiple &&
            selectedValues.map(v => {
              const chipSpec = chipColor?.(v);
              const chipColors = resolveColorVariant({
                subtheme: chipSpec?.subtheme,
                variant: chipSpec?.variant,
                appearance: chipSpec?.appearance ?? 'solid',
              }) ?? {
                background: 'var(--ai-color-primary, #3b82f6)',
                border: 'var(--ai-color-primary, #3b82f6)',
                color: 'var(--ai-color-primary-text, #ffffff)',
              };
              return (
              <span
                key={v}
                data-chip-value={v}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.125rem 0.375rem 0.125rem 0.5rem',
                  borderRadius: 'var(--ai-radius-xl, 9999px)',
                  background: chipColors.background,
                  // Inset box-shadow, not `border` -- 'soft'/'outline'
                  // chips need a visible edge, but a real border would
                  // grow every chip (the default solid one included) by
                  // 2px and shift the whole chip row's layout.
                  boxShadow: `inset 0 0 0 0.0625rem ${chipColors.border}`,
                  color: chipColors.color,
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
                  className="ai-combobox-chip-remove"
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
              );
            })}
          <input
            ref={inputRef}
            id={effectiveId}
            aria-label={ariaLabel}
            role="combobox"
            // `open && !disabled`, not `open` alone -- the actual Popover
            // below is gated on that same combined condition
            // (`<PopoverPrimitive.Root open={open && !disabled}>`), so
            // `open` alone can be stale-true (e.g. the input became
            // disabled while already open, or -- confirmed via a real axe
            // failure, not assumed -- the onChange handler below could
            // call setOpen(true) even while disabled) while the popover
            // itself never actually renders. Reporting aria-expanded="true"
            // with aria-controls/aria-activedescendant pointing at content
            // that was never mounted is a real, confirmed dangling-IDREF
            // bug (axe: aria-valid-attr-value), not just a style issue.
            aria-expanded={open && !disabled}
            // Only while open -- the listbox this points to (Listbox below,
            // inside PopoverPrimitive.Content) only mounts when open is
            // true, so pointing at its id while closed is a reference to an
            // element that isn't in the DOM (axe: aria-valid-attr-value).
            aria-controls={open && !disabled ? listboxId : undefined}
            aria-autocomplete="list"
            // Same reasoning as aria-controls above -- the option divs
            // aria-activedescendant would point at only exist while open.
            aria-activedescendant={open && !disabled ? activeOptionId : undefined}
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
              } else if (!disabled) {
                setOpen(true);
              }
            }}
            // Async mode never auto-opens from focus/click alone — only
            // once the user actually types and a search fires (see the
            // search effect above and its own comment). Client-side mode
            // (a fixed `options` list, nothing to wait on) keeps opening
            // immediately, unchanged. `!disabled` guards both: a real
            // browser blocks interaction with a disabled input entirely,
            // but a programmatic event (or `disabled` flipping true while
            // already open) shouldn't leave `open` state true with nothing
            // actually rendered to back it.
            onFocus={() => { if (!onSearch && !disabled) setOpen(true); }}
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
              aria-label={strings.clearSelection}
              onClick={handleClear}
              // Was tabIndex={-1} (mouse-only) -- reported directly: unlike
              // <Input clearable>'s own identically-shaped button (which has
              // a real keyboard alternative, Backspace/Ctrl+A+Delete, since
              // that's a plain editable text field), a single-select
              // Combobox has no equivalent. Backspace-to-clear (below,
              // handleKeyDown) is wired only for `multiple` mode -- a
              // single-selection Combobox genuinely has no other keyboard
              // path to clear a selection once made. className matches
              // every other icon-only button with no hover model of its own
              // (see interactionStyles.ts's own .ai-focus-ring doc comment).
              className="ai-focus-ring"
              style={{
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '1.125rem',
                height: '1.125rem',
                // A visible pill background, unlike each chip's own bare
                // remove ✕ — the input's own flex-grow (below) pushes this
                // button away from the chips whenever there's leftover row
                // width, and with no container of its own it read as a
                // stray, disconnected glyph rather than a real "clear all"
                // control, easy to mistake for a rendering glitch
                // (reported directly, from a real screenshot).
                background: 'var(--ai-bg-container, #f3f4f6)',
                border: 'none',
                borderRadius: 'var(--ai-radius-xl, 9999px)',
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
          // Radix's own Popover.Content hardcodes role="dialog" -- correct
          // for Popover's usual real-dialog-like usage, wrong here: this
          // wrapper is purely an anchored-positioning container around a
          // real role="listbox" (the WAI-ARIA Combobox pattern this
          // component implements calls for no wrapping role around the
          // listbox at all). Overriding to role="presentation" strips the
          // redundant, unnamed "dialog" semantics rather than just adding
          // a name to silence axe's aria-dialog-name rule -- the listbox
          // inside already carries the real, correct semantics. Confirmed
          // this override actually takes effect (not assumed): Radix's own
          // source spreads consumer props after its own `role: "dialog"`,
          // so a later `role` here wins.
          role="presentation"
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
            boxShadow: 'var(--ai-shadow-md, 0 0.625rem 1.5625rem -0.3125rem rgba(0,0,0,0.15))',
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
