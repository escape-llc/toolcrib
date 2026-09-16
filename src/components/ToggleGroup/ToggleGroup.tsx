'use client';

import React, { type ReactNode, useState } from 'react';
import { Toggle as TogglePrimitive, ToggleGroup as ToggleGroupPrimitive } from 'radix-ui';
import { aiBus } from '../../eventBus/eventBus';
import { getSparseVariables } from '../../theme/slice';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { ToggleThemeSlice, type ToggleSliceState } from './ToggleSlice';
import { CONTROL_FONT_SIZE_VAR, resolveControlPadding, type ControlSize } from '../../theme/controlSize';
import { type SquareCornerOption, resolveSquareCorners } from '../Card/Card';
import { useUIGroupSquareCorners } from '../UIGroup/UIGroupContext';
import { useInjectChoiceSeparatorStyles } from '../../theme/choiceSeparator';

/** Props for the standalone `<Toggle>` pressed/unpressed button. */
export interface ToggleProps {
  /** Included in the emitted `toggle:changed` event payload. */
  name?: string;
  /** Controlled pressed state. */
  pressed?: boolean;
  /** Initial pressed state (uncontrolled). @default false */
  defaultPressed?: boolean;
  /** Change handler. Receives the new pressed state. */
  onPressedChange?: (pressed: boolean) => void;
  /** If true, the toggle is non-interactive. */
  disabled?: boolean;
  children: ReactNode;
  /** Per-instance override for padding density. Shared with `<ToggleGroup>`. Only applies at the default `size="md"` — see `<Input>`'s own `size` doc for why. */
  overrides?: Partial<ToggleSliceState>;
  /** Control size, standardized with `<Button>` and every other sized control so instances line up in a `<UIGroup>` row. @default 'md' */
  size?: ControlSize;
}

/**
 * @manifest Two-state pressed/unpressed button, standalone (see ToggleGroup for a connected set)
 * @manifestCategory Form Controls
 */
export const Toggle: React.FC<ToggleProps> = ({
  name,
  pressed: externalPressed,
  defaultPressed = false,
  onPressedChange,
  disabled = false,
  children,
  overrides,
  size = 'md',
}) => {
  const [internalPressed, setInternalPressed] = useState(defaultPressed);
  const isPressed = externalPressed !== undefined ? externalPressed : internalPressed;
  const toggleVars = getSparseVariables(ToggleThemeSlice, overrides ?? {});
  useInjectInteractionStyles();

  const handlePressedChange = (next: boolean) => {
    if (externalPressed === undefined) setInternalPressed(next);
    if (onPressedChange) onPressedChange(next);
    aiBus.emit('toggle:changed', { name, pressed: next });
  };

  return (
    <TogglePrimitive.Root
      pressed={isPressed}
      onPressedChange={handlePressedChange}
      disabled={disabled}
      className="ai-btn"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--ai-toggle-gap, 0.375rem)',
        padding: resolveControlPadding(size, 'var(--ai-toggle-padding, 0.4375rem 0.75rem)'),
        borderRadius: 'var(--ai-radius-md, 0.375rem)',
        border: `0.0625rem solid ${isPressed ? 'var(--ai-color-primary, #3b82f6)' : 'var(--ai-border, #d1d5db)'}`,
        background: isPressed ? 'var(--ai-color-primary, #3b82f6)' : 'transparent',
        color: isPressed ? 'var(--ai-color-primary-text, #ffffff)' : 'var(--ai-text-primary, #111827)',
        fontSize: CONTROL_FONT_SIZE_VAR[size],
        fontWeight: 'var(--ai-font-weight-semibold, 600)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        // No inline transition -- .ai-btn's own shared rule
        // (interactionStyles.ts) already covers background-color and
        // border-color and is !important, so this would be silently
        // discarded outright, not just redundant (issue #411 -- this
        // was the originally-reported component: a segmented control
        // whose hover/selection color changes snapped instantly).
        outline: 'none',
        ['--ai-btn-bg' as string]: isPressed ? 'var(--ai-color-primary, #3b82f6)' : 'transparent',
        ...toggleVars,
      }}
    >
      {children}
    </TogglePrimitive.Root>
  );
};

/** Data shape for each option in a `<ToggleGroup>`. */
export interface ToggleGroupOption {
  /** Unique value for this option — appears in `value`/`togglegroup:changed`. */
  value: string;
  /** Display label. */
  label?: ReactNode;
  /** Optional icon rendered before the label. */
  icon?: ReactNode;
  /** If true, this option is not selectable. */
  disabled?: boolean;
}

/**
 * Props for the `<ToggleGroup>` connected button set.
 *
 * Data-driven: pass an `options` array. `type="single"` behaves like a
 * segmented control (one selection, re-clicking the active option
 * deselects it — Radix's own behavior); `type="multiple"` allows any
 * combination, like a set of independent toggles that happen to share a
 * connected visual border.
 */
export interface ToggleGroupProps {
  /** Included in the emitted `togglegroup:changed` event payload. */
  name?: string;
  /**
   * `'single'` allows zero or one selected option. `'multiple'` allows any combination.
   * @default 'single'
   */
  type?: 'single' | 'multiple';
  /** Controlled selected value(s) — a string for `type="single"`, a string array for `type="multiple"`. */
  value?: string | string[];
  /** Initial selected value(s) (uncontrolled). */
  defaultValue?: string | string[];
  /** Change handler. Receives the new value in the same shape as `value`. */
  onChange?: (value: string | string[]) => void;
  /** Data-driven options rendered as connected buttons. */
  options: ToggleGroupOption[];
  /** If true, every option is disabled. */
  disabled?: boolean;
  /** Per-instance override for padding density. Shared with `<Toggle>`. Only applies at the default `size="md"` — see `<Input>`'s own `size` doc for why. */
  overrides?: Partial<ToggleSliceState>;
  /** Control size, standardized with `<Button>` and every other sized control so instances line up in a `<UIGroup>` row. @default 'md' */
  size?: ControlSize;
  /**
   * Explicit corner-squaring override, e.g. when this ToggleGroup is a
   * `<UIGroup>` member and an ambient value from context isn't correct
   * for some other reason. Takes precedence over the value `<UIGroup>`
   * itself supplies automatically — see `<Button>`'s own identical prop
   * for the general pattern.
   */
  squareCorners?: SquareCornerOption;
  /**
   * Accessible name for the whole group (Radix's own `role="group"` on
   * the root) — e.g. "Row density" for a set of density options. Distinct
   * from each option's own accessible name (its `label`), the same way a
   * native `<fieldset><legend>` names the group without repeating into
   * every `<input>` inside it.
   */
  'aria-label'?: string;
}

/**
 * @manifest Connected button set for single or multiple selection, data-driven
 * @manifestCategory Form Controls
 */
export const ToggleGroup: React.FC<ToggleGroupProps> = ({
  name,
  type = 'single',
  value: externalValue,
  defaultValue,
  onChange,
  options,
  disabled = false,
  overrides,
  size = 'md',
  squareCorners,
  'aria-label': ariaLabel,
}) => {
  const [internalValue, setInternalValue] = useState<string | string[]>(
    defaultValue !== undefined ? defaultValue : type === 'multiple' ? [] : ''
  );
  const currentValue = externalValue !== undefined ? externalValue : internalValue;
  const toggleGroupVars = getSparseVariables(ToggleThemeSlice, overrides ?? {});
  useInjectInteractionStyles();
  useInjectChoiceSeparatorStyles();
  // "components should integrate seamlessly inside ui group with outer
  // border squaring" -- ToggleGroup is a COMPOUND control (its own
  // per-option first/middle/last corner logic below, independent of any
  // ancestor), so unlike Button/Input (which apply the group's own
  // squareCorners value to their one single element directly), only the
  // group's OUTERMOST edges -- this ToggleGroup's own first option's
  // leading corners, and its own last option's trailing corners -- should
  // ever be affected by an ANCESTOR <UIGroup>. Composed correctly below by
  // spreading resolveSquareCorners(...) onto every option's own style
  // AFTER its already-computed per-option radius: whichever corner the
  // ancestor group says should be squared was ALREADY 0 for every option
  // except the one genuine internal edge that needs to be forced flat, so
  // the same single spread is a no-op everywhere except that one case,
  // for every possible ancestor position (first/middle/last/standalone).
  const uiGroupSquareCorners = useUIGroupSquareCorners();
  const outerCornerOverrides = resolveSquareCorners(squareCorners ?? uiGroupSquareCorners);

  const handleValueChange = (next: string | string[]) => {
    // type="single" renders role="radiogroup" (Radix's own
    // ToggleGroupImplSingle), but Radix's underlying value model is still a
    // plain toggle, not a true radio: clicking the currently-selected
    // option calls its own onItemDeactivate, which sets the value to ''
    // (fully deselected) -- valid, ordinary behavior for `type="multiple"`
    // (a toolbar of independent toggles can legitimately have none
    // pressed), but a real WAI-ARIA violation for `type="single"` (a
    // radiogroup must always have exactly one option checked once
    // initialized, never none) and, found the hard way via a real
    // "Too many re-renders" crash, is genuinely dangerous downstream:
    // DataTable's own density selector composes this exact shape, and an
    // empty density string cascades into DENSITY_ROW_HEIGHT_PX[''] being
    // undefined, itemHeight becoming undefined, and an eventual NaN
    // entering a render-time state-adjustment guard whose `!==` comparison
    // can never stabilize once either side is NaN (NaN !== NaN is always
    // true in JS) -- an infinite loop, not a cosmetic glitch. Ignoring an
    // empty-string deselect attempt in single mode keeps the previously
    // selected option checked, matching true radio semantics for every
    // consumer of this shape, not just DataTable's own.
    if (type === 'single' && next === '') return;
    if (externalValue === undefined) setInternalValue(next);
    if (onChange) onChange(next);
    aiBus.emit('togglegroup:changed', { name, value: next });
  };

  const isSelected = (optValue: string): boolean =>
    type === 'multiple' ? (currentValue as string[]).includes(optValue) : currentValue === optValue;

  return (
    <ToggleGroupPrimitive.Root
      type={type as any}
      value={currentValue as any}
      onValueChange={handleValueChange as any}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{ display: 'inline-flex', alignItems: 'stretch' }}
    >
      {options.map((opt, index) => {
        const selected = isSelected(opt.value);
        const isFirst = index === 0;
        const isLast = index === options.length - 1;
        const itemDisabled = disabled || opt.disabled;

        const borderColor = selected ? 'var(--ai-color-primary, #3b82f6)' : 'var(--ai-border, #d1d5db)';

        return (
          <ToggleGroupPrimitive.Item
            key={opt.value}
            value={opt.value}
            disabled={itemDisabled}
            className="ai-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--ai-toggle-gap, 0.375rem)',
              padding: resolveControlPadding(size, 'var(--ai-toggle-padding, 0.4375rem 0.75rem)'),
              // Regression, reported directly: the ::before divider below
              // used to sit on top of an identically-colored, full-height
              // border that every item ALSO drew on every side (the
              // previous version of this comment's own "plain shorthand"
              // approach) -- since interior seams already had a continuous,
              // full-height, border-colored line from the adjacent items'
              // own collapsed borders, painting a same-color half-height
              // accent on top of it was a visual no-op (confirmed: "had to
              // zoom in 4 times to see it"). The real fix has to remove
              // that competing line, not just add another one next to it --
              // only a genuine OUTER edge (first item's left side, last
              // item's right side, every item's top/bottom) draws a real
              // border; an INTERIOR seam (the side touching a neighbor)
              // is transparent, so the ::before accent is the ONLY mark
              // there, with nothing behind it to blend into. All four
              // sides use explicit longhands unconditionally (never a
              // shorthand mixed with a sometimes-different longhand) --
              // see AGENTS.md's own borderRadius-shorthand entry for why
              // that combination is a real React warning, not a style nit.
              borderTopWidth: '0.0625rem',
              borderBottomWidth: '0.0625rem',
              // Interior left side (the seam a non-first item's own choice-
              // separator ::before renders on, theme/choiceSeparator.ts) is
              // WIDTH 0, not just a transparent color -- reported directly,
              // with screenshots, in two connected ways: the divider looked
              // a different width at different seams, and "the background
              // is not uniformly excluding the separator, especially on
              // the left end." Root cause: `left: 0` on an
              // absolutely-positioned pseudo-element resolves against its
              // containing block's PADDING box, not its border box (CSS
              // Positioned Layout spec) -- so as long as this item had ANY
              // left border width (even color:transparent), the divider
              // sat inset by that width from the item's own true visible
              // edge, showing a sliver of this item's own background
              // between the real seam and the divider. Removing the border
              // WIDTH entirely on this side eliminates that inset at its
              // source: `left: 0` now lands exactly on this item's true
              // border-box edge. box-sizing: border-box (demo/index.css's
              // own global reset) means this doesn't shrink the item --
              // the border simply stops claiming space it was never
              // rendering anyway.
              //
              // This alone still wasn't sufficient, though -- confirmed by
              // screenshot, not assumed: a correctly-positioned divider
              // could still be fully painted over by a SELECTED neighbor,
              // because of the marginLeft/zIndex overlap a couple of
              // properties down. That trick used to exist to collapse two
              // adjacent items' own FULL-COLOR borders into a single
              // visible 1px line -- real, necessary behavior when every
              // side actually drew a border. It has no remaining purpose
              // now that every interior side is either transparent or (as
              // of this fix) zero-width, and it was actively harmful here:
              // the -1px shift pulls each item's own left edge one pixel
              // into its neighbor's territory, and whichever item has the
              // higher z-index (selected: 1 vs. unselected: 0) paints that
              // whole shared pixel -- including anything the LOWER
              // z-index item tried to render there, divider included,
              // regardless of how precisely it was positioned. Removed
              // below (marginLeft: 0 unconditionally) so adjacent items
              // sit exactly flush with no shared/contested pixel at all --
              // the real fix, not a positioning patch on top of a
              // still-broken overlap.
              borderLeftWidth: isFirst ? '0.0625rem' : 0,
              borderRightWidth: '0.0625rem',
              borderTopStyle: 'solid',
              borderBottomStyle: 'solid',
              borderLeftStyle: 'solid',
              borderRightStyle: 'solid',
              borderTopColor: borderColor,
              borderBottomColor: borderColor,
              borderLeftColor: isFirst ? borderColor : 'transparent',
              borderRightColor: isLast ? borderColor : 'transparent',
              borderTopLeftRadius: isFirst ? 'var(--ai-radius-md, 0.375rem)' : 0,
              borderBottomLeftRadius: isFirst ? 'var(--ai-radius-md, 0.375rem)' : 0,
              borderTopRightRadius: isLast ? 'var(--ai-radius-md, 0.375rem)' : 0,
              borderBottomRightRadius: isLast ? 'var(--ai-radius-md, 0.375rem)' : 0,
              // No longer isFirst ? 0 : '-0.0625rem' -- see the borderLeftWidth
              // comment above for why that overlap is actively wrong now,
              // not just unnecessary.
              marginLeft: 0,
              background: selected ? 'var(--ai-color-primary, #3b82f6)' : 'var(--ai-bg-surface, #ffffff)',
              color: selected ? 'var(--ai-color-primary-text, #ffffff)' : 'var(--ai-text-primary, #111827)',
              fontSize: CONTROL_FONT_SIZE_VAR[size],
              fontWeight: 'var(--ai-font-weight-semibold, 600)',
              cursor: itemDisabled ? 'not-allowed' : 'pointer',
              opacity: itemDisabled ? 0.5 : 1,
              position: 'relative',
              zIndex: selected ? 1 : 0,
              // No inline transition -- .ai-btn's own shared rule
              // (interactionStyles.ts) already covers background-color,
              // color, and border-radius, and is !important, so this
              // would be silently discarded outright, not just redundant
              // (issue #411).
              outline: 'none',
              ['--ai-btn-bg' as string]: selected ? 'var(--ai-color-primary, #3b82f6)' : 'var(--ai-bg-surface, #ffffff)',
              ...toggleGroupVars,
              // Last -- wins over this option's own first/middle/last
              // radius above when an ancestor <UIGroup> says this whole
              // strip isn't the true outer edge at that position. See
              // this component's own comment on uiGroupSquareCorners.
              ...outerCornerOverrides,
            }}
          >
            {opt.icon}
            {opt.label}
          </ToggleGroupPrimitive.Item>
        );
      })}
    </ToggleGroupPrimitive.Root>
  );
};
