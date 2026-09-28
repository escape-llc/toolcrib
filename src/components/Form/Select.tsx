'use client';

// SPIKE (#670, Select): a WAI-ARIA select-only combobox built from the same
// parts as Combobox -- the toolkit's own Listbox inside Base UI's Popover --
// rather than on Base UI's (or Radix's) Select. One listbox and keyboard model
// for both pickers, all ours; Base UI supplies positioning, portal and
// outside-press dismissal only.
import React, { type ReactNode, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Popover as BasePopover } from '@base-ui/react/popover';
import { OverlayCSP, useOverlayLayer } from '../Overlay/baseui/overlayLayer';
import { Listbox, type ListboxOptionData } from '../Listbox/Listbox';
import { useOptionalFormContext } from './FormContext';
import { FieldContext } from './FieldContext';
import { aiBus } from '../../eventBus/eventBus';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { useTargetDocument } from '../../theme/targetDocumentContext';
import { type SubthemeName } from '../../theme/subtheme';
import { type SquareCornerOption, resolveSquareCorners } from '../Card/Card';
import { useUIGroupSquareCorners } from '../UIGroup/UIGroupContext';
import { SelectThemeSlice, type SelectSliceState } from './SelectSlice';
import { CONTROL_FONT_SIZE_VAR, resolveControlPadding, type ControlSize } from '../../theme/controlSize';

/** Data shape for each option in a `<Select>` dropdown. */
export interface SelectOptionData {
  /** Display text for the option. */
  label: ReactNode;
  /** Value submitted/emitted when this option is selected. */
  value: string;
  /** If true, the option is visible but not selectable. */
  disabled?: boolean;
  /**
   * Plain text for typeahead matching when `label` isn't a plain string
   * (an icon plus text, say). Defaults to the text found in `label`.
   */
  textValue?: string;
}

/**
 * Props for the `<Select>` dropdown control.
 *
 * Binds to Form context via `name`. Emits `select:changed` on the event bus.
 */
export interface SelectProps {
  /** Element id. Auto-derived from `name` (or the inherited `<FormField>` name) if omitted — needed for `<FormField>`'s `<label htmlFor>` to associate with this control. */
  id?: string;
  /** Field name. Auto-inherited from parent `<FormField>` if omitted. */
  name?: string;
  /** Placeholder text when no value is selected. @default 'Select option...' */
  placeholder?: string;
  /**
   * Accessible name for the trigger. Only needed when this `Select` isn't
   * inside a `<FormField label="...">` — the `<label htmlFor>` that
   * renders provides the accessible name already in that case, the same
   * way it does for `Input`/`Slider`/`Combobox`. Unlike those, `Select`
   * had no such escape hatch until this was added — a real gap for any
   * standalone (non-`FormField`) usage, the trigger's own selected-value
   * text notwithstanding (a combobox takes its name from a label, not from
   * the value it displays).
   */
  'aria-label'?: string;
  /** Array of selectable options. */
  options: SelectOptionData[];
  /** Controlled selected value. */
  value?: string;
  /** Initial selected value (uncontrolled). */
  defaultValue?: string;
  /** Change handler. Receives the selected value string. */
  onChange?: (value: string) => void;
  /** If true, the select is non-interactive. */
  disabled?: boolean;
  /** Per-instance overrides for trigger padding and item density. Only applies at the default `size="md"` — see `<Input>`'s own `size` doc for why. */
  overrides?: Partial<SelectSliceState> & { subtheme?: SubthemeName };
  /** Control size, standardized with `<Button>` and every other sized control so instances line up in a `<UIGroup>` row. @default 'md' */
  size?: ControlSize;
  /** Explicit corner-squaring override, e.g. for a `<UIGroup>` member. See `<Button>`'s own identical prop for the general pattern. */
  squareCorners?: SquareCornerOption;
}

/**
 * @manifest Dropdown select control bound to Form context: a select-only combobox over the toolkit's own Listbox
 * @manifestCategory Form Controls
 */
export const Select: React.FC<SelectProps> = ({
  id,
  name: propName,
  placeholder = 'Select option...',
  'aria-label': ariaLabel,
  options,
  value: externalValue,
  defaultValue,
  onChange: externalOnChange,
  disabled = false,
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
  const { vars: selectVars } = useSliceOverrides(SelectThemeSlice, overrides);
  const targetDocument = useTargetDocument();
  const { container, zIndex } = useOverlayLayer('DROPDOWN');
  const uiGroupSquareCorners = useUIGroupSquareCorners();
  const cornerOverrides = resolveSquareCorners(squareCorners ?? uiGroupSquareCorners);
  useInjectInteractionStyles();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxId = `${useId()}-listbox`;

  // Seeds the field so a required Select left at its placeholder is touched
  // (and shows its error) on first submit. See RadioGroup.tsx for why this
  // depends on registerField rather than the whole formContext.
  useEffect(() => {
    if (fieldName && registerField) registerField(fieldName, defaultValue ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a typed seed (#667), read once like any default
  }, [fieldName, registerField]);

  // Controlled when something re-feeds the value every render (a `value`
  // prop or a Form ancestor); otherwise the pick lives in local state, so a
  // standalone `defaultValue` Select still changes when the user picks.
  // Form-bound reads fall back to the seed registerField is about to write,
  // so the first paint already shows the default.
  const [internalValue, setInternalValue] = useState(defaultValue ?? '');
  const formValue = fieldName && formContext ? formContext.values[fieldName] ?? defaultValue ?? '' : undefined;
  const selectedValue =
    externalValue !== undefined ? externalValue : formValue !== undefined ? String(formValue) : internalValue;
  const selectedIndex = options.findIndex(o => o.value === selectedValue);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const isOpen = open && !disabled;

  const listOptions: ListboxOptionData[] = useMemo(
    () =>
      options.map(o => ({
        value: o.value,
        disabled: o.disabled,
        label: optionText(o),
        render: typeof o.label === 'string' ? undefined : () => o.label,
      })),
    [options]
  );

  const enabled = (i: number) => i >= 0 && i < options.length && !options[i].disabled;
  const step = (from: number, dir: 1 | -1) => {
    for (let i = from + dir; i >= 0 && i < options.length; i += dir) if (enabled(i)) return i;
    return from;
  };
  const first = () => step(-1, 1);
  const last = () => step(options.length, -1);

  const openAt = (index: number) => {
    setActiveIndex(enabled(index) ? index : first());
    setOpen(true);
  };

  const commit = (value: string) => {
    if (externalValue === undefined && !(fieldName && formContext)) setInternalValue(value);
    aiBus.emit('select:changed', { name: fieldName, value });
    externalOnChange?.(value);
    if (fieldName && formContext) {
      formContext.setFieldValue(fieldName, value);
      formContext.setFieldTouched(fieldName, true);
    }
  };

  const pick = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    if (option.value !== selectedValue) commit(option.value);
    setOpen(false);
  };

  // Typeahead: printable keys accumulate for half a second and jump to the
  // first enabled option whose text starts with them. Repeating one letter
  // cycles through the options starting with it, like a native <select>.
  const typeahead = useRef({ buffer: '', timer: 0 as ReturnType<typeof setTimeout> | 0 });
  const matchTypeahead = (key: string, from: number) => {
    const t = typeahead.current;
    if (t.timer) clearTimeout(t.timer);
    t.buffer += key.toLowerCase();
    t.timer = setTimeout(() => (t.buffer = ''), 500);
    const repeated = t.buffer.split('').every(c => c === t.buffer[0]);
    const needle = repeated ? t.buffer[0] : t.buffer;
    const start = repeated ? from + 1 : from;
    for (let n = 0; n < options.length; n++) {
      const i = (start + n) % options.length;
      if (enabled(i) && listOptions[i].label.toLowerCase().startsWith(needle)) return i;
    }
    return -1;
  };

  // Keyboard model: the WAI-ARIA APG select-only combobox. Focus never leaves
  // the trigger; the highlighted option is conveyed by aria-activedescendant.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const printable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openAt(selectedIndex >= 0 ? selectedIndex : first());
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        openAt(selectedIndex >= 0 ? selectedIndex : last());
      } else if (e.key === 'Home') {
        e.preventDefault();
        openAt(first());
      } else if (e.key === 'End') {
        e.preventDefault();
        openAt(last());
      } else if (printable) {
        const i = matchTypeahead(e.key, selectedIndex);
        if (i >= 0) openAt(i);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => step(i, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => step(i, -1));
    } else if (e.key === 'Home' || e.key === 'PageUp') {
      e.preventDefault();
      setActiveIndex(first());
    } else if (e.key === 'End' || e.key === 'PageDown') {
      e.preventDefault();
      setActiveIndex(last());
    } else if (e.key === 'Enter' || (e.key === ' ' && !typeahead.current.buffer)) {
      e.preventDefault();
      pick(activeIndex);
    } else if (e.key === 'Escape') {
      // Only this listbox: a parent Modal/Drawer mustn't also close.
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === 'Tab') {
      // Like a native <select>: Tab closes without changing the value and
      // focus moves on normally.
      setOpen(false);
    } else if (printable) {
      e.preventDefault();
      const i = matchTypeahead(e.key, activeIndex);
      if (i >= 0) setActiveIndex(i);
    }
  };

  // Base UI asks to close on an outside press or Escape. A press on the
  // trigger counts as outside (it isn't a Popover.Trigger: a trigger's own
  // toggle and dialog semantics would fight the combobox role), so a close
  // request that starts there is ignored and the trigger's onClick decides.
  const handleOpenChange = (next: boolean, details: BasePopover.Root.ChangeEventDetails) => {
    const target = details.event?.target as Node | null | undefined;
    if (!next && target && triggerRef.current?.contains(target)) return;
    setOpen(next);
  };

  const activeOptionId = isOpen && enabled(activeIndex) ? `${listboxId}-option-${activeIndex}` : undefined;

  // Keep the highlighted option in view as the keyboard moves it.
  useEffect(() => {
    if (!activeOptionId) return;
    (targetDocument ?? document).getElementById(activeOptionId)?.scrollIntoView({ block: 'nearest' });
  }, [activeOptionId, targetDocument]);

  return (
    <OverlayCSP>
      <BasePopover.Root open={isOpen} onOpenChange={handleOpenChange}>
        <button
          ref={triggerRef}
          type="button"
          id={effectiveId}
          role="combobox"
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={isOpen ? listboxId : undefined}
          aria-activedescendant={activeOptionId}
          aria-invalid={isError || undefined}
          aria-describedby={isError ? `${fieldName}-error` : undefined}
          disabled={disabled}
          className="ai-btn ai-focus-ring"
          onClick={() => (isOpen ? setOpen(false) : openAt(selectedIndex >= 0 ? selectedIndex : first()))}
          onKeyDown={handleKeyDown}
          // Focus leaving the trigger (Tab, a click elsewhere) closes the
          // list. Presses inside the popup never take focus (see onMouseDown
          // on the Popup), so they don't close it.
          onBlur={() => setOpen(false)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--ai-gap-sm, 0.5rem)',
            width: '100%',
            padding: resolveControlPadding(size, 'var(--ai-select-trigger-padding, 0.5rem 0.75rem)'),
            borderTopLeftRadius: 'var(--ai-radius-md, 0.375rem)',
            borderTopRightRadius: 'var(--ai-radius-md, 0.375rem)',
            borderBottomLeftRadius: 'var(--ai-radius-md, 0.375rem)',
            borderBottomRightRadius: 'var(--ai-radius-md, 0.375rem)',
            border: '0.0625rem solid var(--ai-border, #d1d5db)',
            background: 'var(--ai-bg-surface, #ffffff)',
            color: selected ? 'var(--ai-text-primary, #111827)' : 'var(--ai-text-secondary, #6b7280)',
            fontSize: CONTROL_FONT_SIZE_VAR[size],
            textAlign: 'left',
            outline: 'none',
            boxSizing: 'border-box',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1,
            ['--ai-btn-bg' as string]: 'var(--ai-bg-surface, #ffffff)',
            ...selectVars,
            ...cornerOverrides,
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selected ? selected.label : placeholder}
          </span>
          <span aria-hidden="true" style={{ color: 'var(--ai-text-secondary, #6b7280)', fontSize: '0.75rem' }}>
            ▼
          </span>
        </button>

        <BasePopover.Portal container={container}>
          <BasePopover.Positioner anchor={triggerRef} side="bottom" align="start" sideOffset={4} style={{ zIndex }}>
            {/* selectVars again: the popup portals away from the trigger, and
                CSS variables only inherit through the real DOM tree. */}
            <BasePopover.Popup
              // A positioning container around a real role="listbox"; the
              // select-only combobox pattern wants no wrapping role.
              role="presentation"
              initialFocus={false}
              finalFocus={false}
              // Keeps focus on the trigger for any press inside the popup
              // (options, padding, the scroll area), so onBlur above doesn't
              // close the list mid-pick.
              onMouseDown={e => e.preventDefault()}
              style={{
                minWidth: 'max(11.25rem, var(--anchor-width))',
                background: 'var(--ai-bg-surface, #ffffff)',
                borderRadius: 'var(--ai-radius-md, 0.375rem)',
                border: '0.0625rem solid var(--ai-border, #e5e7eb)',
                boxShadow: 'var(--ai-shadow-md, 0 0.625rem 1.5625rem -0.3125rem rgba(0,0,0,0.15))',
                overflow: 'hidden',
                ...selectVars,
              }}
            >
              <Listbox
                id={listboxId}
                options={listOptions}
                activeIndex={activeIndex}
                selectedValues={selected ? [selected.value] : []}
                onSelect={o => pick(options.findIndex(x => x.value === o.value))}
                itemPadding="var(--ai-select-item-padding, 0.4375rem 0.75rem)"
                size={size}
              />
            </BasePopover.Popup>
          </BasePopover.Positioner>
        </BasePopover.Portal>
      </BasePopover.Root>
    </OverlayCSP>
  );
};

/** Plain text for an option's label: typeahead matching and the Listbox's `label`. */
function optionText(option: SelectOptionData): string {
  if (option.textValue !== undefined) return option.textValue;
  const walk = (node: ReactNode): string => {
    if (node == null || typeof node === 'boolean') return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(walk).join('');
    if (React.isValidElement<{ children?: ReactNode }>(node)) return walk(node.props.children);
    return '';
  };
  return walk(option.label);
}
