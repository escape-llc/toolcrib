'use client';

import React, { type ReactNode, type InputHTMLAttributes, type TextareaHTMLAttributes, type ButtonHTMLAttributes, useContext, useEffect, useRef } from 'react';
import { Checkbox as CheckboxPrimitive, Switch as SwitchPrimitive } from 'radix-ui';
import { useOptionalFormContext } from './FormContext';
import { type PaddingMode, resolvePadding } from '../../theme/padding';
import { type CornerRadiusMode, resolveRadius } from '../../theme/radius';
import { type StyleFree } from '../../theme/safeProps';
import { useResolvedSubtheme, useSliceOverrides } from '../../theme/useSliceOverrides';
import { getSparseVariables } from '../../theme/slice';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { resolveSubtheme, type SubthemeName } from '../../theme/subtheme';
import { ICON_WRAPPER_STYLE } from '../../theme/iconWrapperStyle';
import { CONTROL_FONT_SIZE_VAR, resolveControlPadding, type ControlSize } from '../../theme/controlSize';
import { type SquareCornerOption, resolveSquareCorners } from '../Card/Card';
import { useUIGroupSquareCorners } from '../UIGroup/UIGroupContext';
import { FieldContext } from './FieldContext';
import { ButtonThemeSlice, type ButtonSliceState } from './ButtonSlice';
import { InputThemeSlice, type InputSliceState } from './InputSlice';
import { useLocaleStrings } from '../Locale/LocaleContext';
import { ToggleControlThemeSlice, type ToggleControlSliceState } from './ToggleControlSlice';
import { Label } from './Label';
export * from './RadioGroup';
export * from './Select';
export * from './Slider';
export * from './Label';
export * from './Combobox';
export * from './FileUpload';

/**
 * Props for `<FormField>` — wraps a form control with label, error display, and helper text.
 *
 * Provides `FieldContext` so child controls automatically inherit the `name` prop.
 */
export interface FormFieldProps {
  /** Field name that binds to the form schema and context. */
  name: string;
  /** Label rendered above the control. */
  label?: ReactNode;
  /** Help text shown below the control (hidden when there's a validation error). */
  helperText?: ReactNode;
  /** The form control to render (e.g. `<Input />`, `<Select />`). */
  children: ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({ name, label, helperText, children }) => {
  const formContext = useOptionalFormContext();
  const error = formContext && formContext.touched[name] ? formContext.errors[name] : undefined;
  const errorId = `${name}-error`;

  return (
    <FieldContext.Provider value={{ name }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', width: '100%', marginBottom: 'var(--ai-margin-gap, 0.875rem)' }}>
        {label && (
          <Label htmlFor={name} overrides={{ weight: 'semibold' }}>
            {label}
          </Label>
        )}
        {children}
        {/*
          Slides open/closed instead of slamming (issue #503) via the
          standard CSS grid technique for animating to/from intrinsic
          height with no JS measurement: a single-row grid transitioning
          `grid-template-rows` between `0fr` and `1fr`, with its one child
          (the actual real height driver) clipped by `overflow: hidden`
          during the transition. `min-height: 0` on that child is required,
          not optional -- grid items default to `min-height: auto`
          (matching flex items' own default), which can stop the item
          shrinking below its content's intrinsic size and fight the
          explicit `0fr` row height otherwise.

          Always rendered now (previously: conditionally absent entirely
          when neither error nor helperText applied) -- an unconditionally
          zero-height grid row contributes zero visible space on its own,
          but the parent's own `gap: '0.375rem'` (spacing every child from
          its neighbor) would still add a fixed gap before this now-always-
          present child regardless of its collapsed height, a real
          regression from the previous fully-absent-node behavior. Canceled
          by animating `marginTop` in the opposite direction alongside the
          row transition: `-0.375rem` while collapsed (netting to zero
          combined with the parent's `gap`) up to `0` while expanded
          (letting the parent's gap apply in full) -- same combined spacing
          in both end states as the original conditional-render version,
          just reached smoothly instead of by insertion/removal.

          `transition-duration` reuses `--ai-transition-duration-normal`,
          the same token every other themed transition in this codebase
          keys off -- already resolves to `0s` under `reducedMotion:
          'always'`/`preset: 'none'` (animation.tsx's own
          getAnimationVariables), so reduced motion is respected for free,
          no separate JS check needed here.
        */}
        <div
          // aria-hidden when collapsed -- caught in review (Gemini, PR
          // #506): `overflow: hidden` + `grid-template-rows: 0fr` clips
          // content to zero *visible* area, but isn't guaranteed to read
          // as "hidden" to every screen reader's own visibility heuristic
          // (unlike `display: none`/`visibility: hidden`, which every AT
          // respects unambiguously). Harmless when there's genuinely
          // nothing inside (FormField's error/helper span is still
          // conditionally rendered, only present once truthy) -- applied
          // uniformly here anyway for defense-in-depth, since FormError's
          // own summary variant (below) has a *static* string that's
          // always in the DOM regardless of this same collapsed state,
          // where this same attribute is load-bearing, not just extra
          // safety.
          //
          // visibility: 'hidden' when collapsed -- a second, follow-up
          // finding on the same PR (Gemini): aria-hidden alone still lets
          // a browser's native "Find on Page" (Ctrl+F) match and scroll to
          // the collapsed, zero-height text, since neither
          // `overflow: hidden` nor `aria-hidden` affects that. `visibility`
          // is the one property both the accessibility tree AND native
          // find-on-page respect. Delayed via transitionDelay (only on the
          // *collapsing* direction, only on this one property) so the
          // content stays visible for the full grid-row shrink and only
          // actually vanishes once the collapse animation has finished --
          // switching instantly would cut the transition short visually.
          aria-hidden={!(error || helperText)}
          style={{
            display: 'grid',
            gridTemplateRows: error || helperText ? '1fr' : '0fr',
            marginTop: error || helperText ? 0 : '-0.375rem',
            visibility: error || helperText ? 'visible' : 'hidden',
            transitionProperty: 'grid-template-rows, margin-top, visibility',
            transitionDuration: 'var(--ai-transition-duration-normal, 0.2s)',
            transitionTimingFunction: 'var(--ai-transition-easing, ease)',
            transitionDelay: error || helperText ? '0s' : '0s, 0s, var(--ai-transition-duration-normal, 0.2s)',
          }}
        >
          <div style={{ overflow: 'hidden', minHeight: 0 }}>
            {error && (
              <span id={errorId} style={{ fontSize: '0.75rem', color: 'var(--ai-subtheme-error, #ef4444)', marginTop: '0.125rem', display: 'block' }}>
                {error}
              </span>
            )}
            {!error && helperText && (
              <span style={{ fontSize: '0.75rem', color: 'var(--ai-text-secondary, #6b7280)', marginTop: '0.125rem', display: 'block' }}>
                {helperText}
              </span>
            )}
          </div>
        </div>
      </div>
    </FieldContext.Provider>
  );
};

/**
 * Props for `<FormError>` — displays validation error messages.
 *
 * With `name`: shows the specific field error (only after touched).
 * Without `name`: shows a summary banner when any errors exist.
 */
export interface FormErrorProps {
  /** Field name to show the error for. Omit for a summary error banner. */
  name?: string;
}

export const FormError: React.FC<FormErrorProps> = ({ name }) => {
  const formContext = useOptionalFormContext();
  if (!formContext) return null;

  const { errors, touched } = formContext;
  // Both branches below now always render the same outer grid wrapper --
  // an early `return null` (the previous shape) would mean this
  // component's own DOM node is fully absent one render and freshly
  // inserted the next, and a CSS transition can't animate a node's very
  // first paint, only a property CHANGE on a node that already exists.
  // Same `grid-template-rows: 0fr -> 1fr` technique as FormField's own
  // fix, same reasoning (see that component's own comment for the full
  // account) -- collapsed state is genuinely zero-footprint here (no
  // compensating negative margin the way FormField needed), since
  // FormError is used standalone in an arbitrary consumer layout, not
  // inside a known, fixed-gap flex container this component controls.
  if (name) {
    const error = touched[name] ? errors[name] : undefined;
    return (
      <div
        // See FormField's own aria-hidden/visibility comments for the full
        // reasoning (both found in review, Gemini, PR #506).
        aria-hidden={!error}
        style={{
          display: 'grid',
          gridTemplateRows: error ? '1fr' : '0fr',
          visibility: error ? 'visible' : 'hidden',
          transitionProperty: 'grid-template-rows, visibility',
          transitionDuration: 'var(--ai-transition-duration-normal, 0.2s)',
          transitionTimingFunction: 'var(--ai-transition-easing, ease)',
          transitionDelay: error ? '0s' : '0s, var(--ai-transition-duration-normal, 0.2s)',
        }}
      >
        <div style={{ overflow: 'hidden', minHeight: 0 }}>
          <div style={{ color: 'var(--ai-subtheme-error, #ef4444)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{error}</div>
        </div>
      </div>
    );
  }

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <div
      // Load-bearing here, not just defense-in-depth (unlike the other two
      // wrappers above): this banner's own text is a *static* string,
      // always in the DOM regardless of hasErrors -- without this, a
      // screen reader whose own visibility heuristic doesn't treat a
      // zero-height, overflow:hidden region as hidden would discover and
      // announce "Please correct the errors..." even on a fully valid,
      // untouched form. Same reasoning applies to visibility below -- also
      // load-bearing here (not defense-in-depth), since it's what keeps a
      // browser's native "Find on Page" from matching this same always-
      // present static string (issue found in review, Gemini, PR #506).
      aria-hidden={!hasErrors}
      style={{
        display: 'grid',
        gridTemplateRows: hasErrors ? '1fr' : '0fr',
        visibility: hasErrors ? 'visible' : 'hidden',
        transitionProperty: 'grid-template-rows, visibility',
        transitionDuration: 'var(--ai-transition-duration-normal, 0.2s)',
        transitionTimingFunction: 'var(--ai-transition-easing, ease)',
        transitionDelay: hasErrors ? '0s' : '0s, var(--ai-transition-duration-normal, 0.2s)',
      }}
    >
      <div style={{ overflow: 'hidden', minHeight: 0 }}>
        <div style={{ color: 'var(--ai-subtheme-error, #ef4444)', fontSize: '0.875rem', padding: 'var(--ai-padding-md, 0.5rem 0.75rem)', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--ai-radius-md, 0.375rem)' }}>
          Please correct the errors in the form before submitting.
        </div>
      </div>
    </div>
  );
};

/**
 * Props for the `<Button>` component.
 *
 * Supports five variants, three sizes, subtheme colouring, and icon slots.
 */
export interface ButtonProps extends StyleFree<ButtonHTMLAttributes<HTMLButtonElement>> {
  /**
   * Visual style variant.
   * - `'primary'` — Filled with primary colour.
   * - `'secondary'` — Filled with secondary colour.
   * - `'outline'` — Transparent with border.
   * - `'danger'` — Filled with error colour.
   * - `'ghost'` — No background or border.
   * @default 'primary'
   */
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  /** Button size controlling padding and font-size. @default 'md' */
  size?: ControlSize;
  /** Override padding using the theme padding token scale. */
  paddingMode?: PaddingMode;
  /** Override corner radius using the theme radius token scale. */
  cornerRadiusMode?: CornerRadiusMode;
  /** Icon rendered before the label text. Alias for `icon`. */
  leadingIcon?: ReactNode;
  /** Icon rendered after the label text. */
  trailingIcon?: ReactNode;
  /** Shorthand for `leadingIcon`. */
  icon?: ReactNode;
  /** Apply a subtheme colour. Falls back to the nearest `<StyleDomainProvider>`'s if omitted. */
  subtheme?: SubthemeName;
  /**
   * Explicit corner-squaring override, e.g. for a trigger button whose
   * corner needs to flatten against an open `<Popup>`/`<DropdownMenu>`.
   * Applied after the button's own computed radius, so it wins.
   */
  squareCorners?: SquareCornerOption;
  /**
   * Per-instance overrides for label weight and icon spacing. Separate from
   * `subtheme` above (Button already resolves that itself via
   * `useResolvedSubtheme`, unrelated to this slice's own two fields).
   */
  overrides?: Partial<ButtonSliceState>;
}

/**
 * @manifest Styled button with five variants, three sizes, subtheme colouring, and icon slots
 * @manifestCategory Form Controls
 */
// forwardRef, not a plain React.FC — Button is used as the child of Radix
// `asChild` compositions (Modal.CloseButton, AlertDialog.Cancel/Action), and
// Radix's Slot mechanism clones the child with a composed `ref` prop.
// Giving a ref to a plain function component is a silent no-op that also
// logs a dev-mode console warning ("Function components cannot be given
// refs") — forwardRef is what makes that composition actually work cleanly.
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  children,
  variant = 'primary',
  size = 'md',
  paddingMode,
  cornerRadiusMode,
  leadingIcon,
  trailingIcon,
  icon,
  subtheme: instanceSubtheme,
  squareCorners,
  disabled,
  overrides,
  ...props
}, ref) => {
  const startIcon = icon || leadingIcon;
  const subtheme = useResolvedSubtheme(instanceSubtheme);
  const subthemeColors = subtheme ? resolveSubtheme(subtheme) : undefined;
  // getSparseVariables directly, not the full useSliceOverrides — Button
  // already resolves subtheme itself via useResolvedSubtheme above (its
  // pre-existing, unrelated mechanism), so there's no second subtheme
  // concern for this slice to fold in.
  const buttonVars = getSparseVariables(ButtonThemeSlice, overrides ?? {});
  useInjectInteractionStyles();

  const getSizeStyles = (): React.CSSProperties => ({
    padding: resolvePadding(paddingMode, size),
    fontSize: CONTROL_FONT_SIZE_VAR[size],
  });

  const getVariantStyles = (): React.CSSProperties => {
    // Text color per fill is picked from the palette's own
    // WCAG-guaranteed pickReadableTextColor result (see hsv.ts), not
    // hardcoded white — a bright, high-luminance primary color (e.g. a
    // vivid yellow or lime-green base) makes white-on-fill genuinely
    // unreadable otherwise. Mirrors baseBg's own subthemeColors-vs-variant
    // branching exactly, so text always matches whichever fill actually
    // rendered.
    let baseBg = subthemeColors ? subthemeColors.main : 'var(--ai-color-primary, #3b82f6)';
    let textColor = subthemeColors ? subthemeColors.onMain : 'var(--ai-color-primary-text, #ffffff)';

    if (variant === 'secondary') {
      baseBg = 'var(--ai-color-secondary, #64748b)';
      textColor = 'var(--ai-color-secondary-text, #ffffff)';
    } else if (variant === 'outline') {
      return {
        background: 'transparent',
        border: `0.0625rem solid ${subthemeColors ? subthemeColors.main : 'var(--ai-border, #d1d5db)'}`,
        color: subthemeColors ? subthemeColors.main : 'var(--ai-text-primary, #111827)',
      };
    } else if (variant === 'ghost') {
      return {
        background: 'transparent',
        border: 'none',
        color: 'var(--ai-text-primary, #111827)',
      };
    } else if (variant === 'danger') {
      baseBg = 'var(--ai-subtheme-error, #ef4444)';
      textColor = 'var(--ai-subtheme-error-on-main, #ffffff)';
    }

    return {
      background: baseBg,
      color: textColor,
      border: 'none',
    };
  };

  const currentRadius = resolveRadius(cornerRadiusMode, size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'md');
  // Explicit per-corner longhands, always all four, rather than spreading
  // resolveSquareCorners(...) directly (sparse — only the squared corners'
  // keys) alongside the borderRadius shorthand: since squareCorners can
  // toggle between 'none' (no keys) and a specific corner (some keys) as
  // e.g. a Popup opens/closes, the set of style keys would change between
  // renders while the shorthand stayed put — React warns "Removing a style
  // property during rerender ... can lead to styling bugs" for exactly
  // this. Keeping all four keys present on every render, only their
  // values changing, avoids it — confirmed via a real test run, not just
  // reasoning about it.
  // uiGroupSquareCorners: this Button's automatic fallback when it's a
  // <UIGroup> member and the consumer hasn't set squareCorners themselves
  // — an explicit prop still always wins (see UIGroupContext.tsx).
  const uiGroupSquareCorners = useUIGroupSquareCorners();
  const cornerOverrides = resolveSquareCorners(squareCorners ?? uiGroupSquareCorners);
  const variantStyles = getVariantStyles();

  return (
    <button
      {...props}
      ref={ref}
      className="ai-btn"
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--ai-button-icon-gap, 0.5rem)',
        fontWeight: 'var(--ai-button-font-weight, 600)',
        borderTopLeftRadius: cornerOverrides.borderTopLeftRadius ?? currentRadius,
        borderTopRightRadius: cornerOverrides.borderTopRightRadius ?? currentRadius,
        borderBottomLeftRadius: cornerOverrides.borderBottomLeftRadius ?? currentRadius,
        borderBottomRightRadius: cornerOverrides.borderBottomRightRadius ?? currentRadius,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        // No inline transition -- .ai-btn's own shared rule
        // (interactionStyles.ts) already covers background-color,
        // border-color, border-radius, and transform, and is !important,
        // so this would be silently discarded outright, not just
        // redundant (issue #411).
        ...getSizeStyles(),
        ...variantStyles,
        // Hover's actual colour is computed live in CSS (see interactionStyles.ts's
        // `color-mix()` rule) from this element's own currentColor — this
        // just publishes what "normal" already resolved to as the mix base,
        // so the rule never has to duplicate this per-variant logic.
        ['--ai-btn-bg' as string]: variantStyles.background,
        ...buttonVars,
      }}
    >
      {startIcon && (
        <span style={{ ...ICON_WRAPPER_STYLE, justifyContent: 'center', fontSize: '1.1em' }}>
          {startIcon}
        </span>
      )}
      {children}
      {trailingIcon && (
        <span style={{ ...ICON_WRAPPER_STYLE, justifyContent: 'center', fontSize: '1.1em' }}>
          {trailingIcon}
        </span>
      )}
    </button>
  );
});
Button.displayName = 'Button';

export const SubmitButton: React.FC<ButtonProps> = (props) => {
  const formContext = useOptionalFormContext();
  const isSubmitting = formContext ? formContext.isSubmitting : false;
  // `disabled` must be applied AFTER `{...props}`, not before — see the
  // general rule on this in AGENTS.md ("a value that must win over a prop
  // spread has to come after it, not before"). A consumer passing their own
  // `disabled` at all (e.g. `disabled={!isValid}`, a very natural way to
  // gate submission until the form is valid) would otherwise have that
  // exact value re-applied by the spread, silently discarding the
  // `isSubmitting ||` guard the instant the trailing spread runs — the
  // button would stop showing disabled while actively submitting.
  return (
    <Button type="submit" {...props} disabled={isSubmitting || props.disabled}>
      {isSubmitting ? 'Submitting...' : props.children || 'Submit'}
    </Button>
  );
};

/** Props for `<Input>` — text input bound to Form context via `name`. */
export interface InputProps extends StyleFree<Omit<InputHTMLAttributes<HTMLInputElement>, 'name' | 'size'>> {
  /** Field name. Auto-inherited from parent `<FormField>` if omitted. */
  name?: string;
  /** Override corner radius using the theme radius token scale. */
  cornerRadiusMode?: CornerRadiusMode;
  /** Per-instance overrides for padding and border width. Shared with `<Textarea>`. Only applies at the default `size="md"` — `sm`/`lg` resolve through the shared control padding scale instead, so they line up with a `sm`/`lg` `<Button>` in the same `<UIGroup>`. */
  overrides?: Partial<InputSliceState> & { subtheme?: SubthemeName };
  /** Which corners to square off — e.g. inside a `<UIGroup>`. @default 'none' */
  squareCorners?: SquareCornerOption;
  /** Control size, standardized with `<Button>` and every other sized control so instances line up in a `<UIGroup>` row. @default 'md' */
  size?: ControlSize;
  /**
   * Shows a small "✕" clear button at the trailing edge once the input has
   * a non-empty value — clicking it resets the value through the same
   * onChange/Form-context path a real clear keystroke would take, then
   * returns focus to the input. Mirrors `<Combobox>`'s own established
   * single-select clear button (`strings.clearSelection`) — same
   * `tabIndex={-1}` (mouse-only; Backspace/select-all already provide a
   * keyboard path, so this doesn't add an extra required Tab stop for
   * something with an easy keyboard alternative).
   * @default false
   */
  clearable?: boolean;
  /** Extra side effect to run when the clear button is clicked — e.g. also resetting a related piece of state (an active-descendant index, a filter). Runs after the value itself is cleared. Only meaningful alongside `clearable`. */
  onClear?: () => void;
}

export const Input: React.FC<InputProps> = ({ id, name: propName, type = 'text', cornerRadiusMode, onBlur, onChange, value: externalValue, overrides, squareCorners, size = 'md', clearable = false, onClear, ...props }) => {
  const fieldCtx = useContext(FieldContext);
  const name = propName || fieldCtx.name || '';
  const formContext = useOptionalFormContext();
  const registerField = formContext?.registerField;
  const { vars: inputVars } = useSliceOverrides(InputThemeSlice, overrides);
  const strings = useLocaleStrings().input;
  useInjectInteractionStyles();
  const inputRef = useRef<HTMLInputElement>(null);

  // Depends on registerField itself, not the whole formContext object —
  // see RadioGroup.tsx for why (Form recreates that object on every render,
  // so depending on it re-fires this on every keystroke anywhere in the
  // form; registerField is stable for the form's lifetime).
  useEffect(() => {
    if (name && registerField) registerField(name);
  }, [name, registerField]);

  const value = externalValue !== undefined ? externalValue : (name && formContext ? formContext.values[name] ?? '' : '');
  const isError = name && formContext ? formContext.touched[name] && !!formContext.errors[name] : false;
  // Not `!!value` -- a numeric controlled value of exactly 0 (a real,
  // valid input.type="number" value) is falsy but not empty; the clear
  // button must still show for it.
  const hasValue = value !== '' && value !== undefined && value !== null;

  // squareCorners was previously destructured but never actually applied
  // anywhere below — dead since the prop was added, confirmed by reading
  // the render output, not assumed. Fixed the same pass as UIGroup's own
  // context-based squaring fallback, since it's the same underlying gap:
  // an Input never squared itself inside a UIGroup at all, even for the
  // simple direct-child case CSS alone already handles for Button.
  const currentRadius = resolveRadius(cornerRadiusMode, 'md');
  const uiGroupSquareCorners = useUIGroupSquareCorners();
  const cornerOverrides = resolveSquareCorners(squareCorners ?? uiGroupSquareCorners);

  // Real typing forwards the real SyntheticEvent unchanged -- a consumer's
  // handler may call e.preventDefault()/e.stopPropagation() or read other
  // target fields (name, id) beyond value, and a synthesized stand-in would
  // silently break all of that.
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (name && formContext) formContext.setFieldValue(name, e.target.value);
    if (onChange) onChange(e);
  };

  // The clear button has no real DOM change event to forward, so it
  // synthesizes one -- Input is always controlled (`value` above already
  // falls back to '' at minimum even with no `externalValue`/Form binding),
  // so there's no native DOM value to separately reset, and the next render
  // already picks up whatever the write below settles on. Still includes
  // name/id alongside value (mirrored onto both target and currentTarget)
  // so a generic multi-input handler keyed on `e.target.name` doesn't break
  // just because this particular change came from the clear button rather
  // than a keystroke -- and still provides no-op preventDefault/
  // stopPropagation so a handler that unconditionally calls either doesn't
  // throw against this synthesized stand-in.
  const handleClear = () => {
    if (name && formContext) formContext.setFieldValue(name, '');
    if (onChange) {
      const mockTarget = { value: '', name: name || undefined, id: id ?? (name || undefined) };
      onChange({
        target: mockTarget,
        currentTarget: mockTarget,
        preventDefault: () => {},
        stopPropagation: () => {},
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    }
    onClear?.();
    inputRef.current?.focus();
  };

  const inputElement = (
    <input
      {...props}
      ref={inputRef}
      id={id ?? (name || undefined)}
      name={name || undefined}
      type={type}
      value={value}
      aria-invalid={isError || undefined}
      aria-describedby={isError ? `${name}-error` : undefined}
      className="ai-focus-ring"
      onChange={handleChange}
      onBlur={e => {
        if (name && formContext) formContext.setFieldTouched(name, true);
        if (onBlur) onBlur(e);
      }}
      style={{
        width: '100%',
        padding: resolveControlPadding(size, 'var(--ai-input-padding, 0.5rem 0.75rem)'),
        // Extra trailing room for the clear button so typed text never
        // renders underneath it -- only when it can ever actually show.
        paddingRight: clearable ? '1.75rem' : undefined,
        // Explicit per-corner longhands, always all four -- same reason as
        // Button's own identical pattern (see its comment): a sparse
        // spread would add/remove style keys across renders as
        // squareCorners changes, which React warns about.
        borderTopLeftRadius: cornerOverrides.borderTopLeftRadius ?? currentRadius,
        borderTopRightRadius: cornerOverrides.borderTopRightRadius ?? currentRadius,
        borderBottomLeftRadius: cornerOverrides.borderBottomLeftRadius ?? currentRadius,
        borderBottomRightRadius: cornerOverrides.borderBottomRightRadius ?? currentRadius,
        border: `var(--ai-input-border-width, 0.0625rem) solid ${isError ? 'var(--ai-subtheme-error, #ef4444)' : 'var(--ai-border, #d1d5db)'}`,
        background: 'var(--ai-bg-surface, #ffffff)',
        color: 'var(--ai-text-primary, #111827)',
        fontSize: CONTROL_FONT_SIZE_VAR[size],
        outline: 'none',
        boxSizing: 'border-box',
        // No inline transition -- .ai-focus-ring's own shared rule
        // (interactionStyles.ts) already covers border-color and
        // box-shadow and is !important, so this would be silently
        // discarded outright, not just redundant (issue #411).
        ...inputVars,
      }}
    />
  );

  // Only wrapped in a positioning container when clearable is actually
  // set (issue #428) -- every existing non-clearable <Input> usage keeps
  // its current bare <input> DOM shape unchanged.
  if (!clearable) return inputElement;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {inputElement}
      {hasValue && !props.disabled && !props.readOnly && (
        <button
          type="button"
          aria-label={strings.clear}
          // Mouse-only, matching Combobox's own established clear button
          // (strings.clearSelection) -- Backspace/select-all already
          // provide a keyboard path, so this doesn't add an extra
          // required Tab stop for something with an easy alternative.
          tabIndex={-1}
          onClick={handleClear}
          style={{
            ...ICON_WRAPPER_STYLE,
            position: 'absolute',
            top: '50%',
            right: '0.5rem',
            transform: 'translateY(-50%)',
            justifyContent: 'center',
            width: '1.125rem',
            height: '1.125rem',
            background: 'var(--ai-bg-container, #f3f4f6)',
            border: 'none',
            borderRadius: 'var(--ai-radius-xl, 9999px)',
            cursor: 'pointer',
            color: 'var(--ai-text-secondary, #6b7280)',
            fontSize: '0.6875rem',
            padding: 0,
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
};

// --- Select ---
// Select is imported and exported from ./Select (Radix UI Primitive)

/** Props for `<Checkbox>` — boolean toggle bound to Form context via `name`. */
export interface CheckboxProps {
  /** Field name. Auto-inherited from parent `<FormField>` if omitted. */
  name?: string;
  /** Label text rendered beside the checkbox. */
  label?: ReactNode;
  /** Controlled checked state. */
  checked?: boolean;
  /** Change handler. Receives a synthetic event with `target.checked`. */
  onChange?: (e: { target: { checked: boolean } }) => void;
  /** Per-instance size override. Shared with `<Switch>`. */
  overrides?: Partial<ToggleControlSliceState>;
  /**
   * Explicit corner-squaring override, e.g. for a `<UIGroup>` member.
   * See `<Button>`'s own identical prop for the general pattern.
   */
  squareCorners?: SquareCornerOption;
}

export const Checkbox: React.FC<CheckboxProps> = ({ name: propName, label, checked: externalChecked, onChange, overrides, squareCorners }) => {
  const fieldCtx = useContext(FieldContext);
  const name = propName || fieldCtx.name || '';
  const formContext = useOptionalFormContext();
  const registerField = formContext?.registerField;
  const checkboxVars = getSparseVariables(ToggleControlThemeSlice, overrides ?? {});
  useInjectInteractionStyles();
  const uiGroupSquareCorners = useUIGroupSquareCorners();
  const cornerOverrides = resolveSquareCorners(squareCorners ?? uiGroupSquareCorners);

  // Depends on registerField itself, not the whole formContext object —
  // see RadioGroup.tsx for why (Form recreates that object on every render,
  // so depending on it re-fires this on every keystroke anywhere in the
  // form; registerField is stable for the form's lifetime).
  useEffect(() => {
    if (name && registerField) registerField(name);
  }, [name, registerField]);

  const checked = externalChecked !== undefined ? externalChecked : (name && formContext ? !!formContext.values[name] : false);

  const handleCheckedChange = (val: boolean) => {
    if (name && formContext) {
      formContext.setFieldValue(name, val);
      formContext.setFieldTouched(name, true);
    }
    if (onChange) onChange({ target: { checked: val } });
  };

  return (
    <Label>
      <CheckboxPrimitive.Root
        id={name || undefined}
        checked={checked}
        onCheckedChange={handleCheckedChange}
        className="ai-focus-ring"
        style={{
          all: 'unset',
          width: 'var(--ai-togglecontrol-checkbox-size, 1.125rem)',
          height: 'var(--ai-togglecontrol-checkbox-size, 1.125rem)',
          // Explicit per-corner longhands, always all four -- lets
          // cornerOverrides below (a `<UIGroup>` member) win on just the
          // corners it names. See Button's own identical comment on why
          // this can't be a plain `borderRadius` shorthand mixed with a
          // sometimes-present longhand override.
          borderTopLeftRadius: 'var(--ai-radius-sm, 0.25rem)',
          borderTopRightRadius: 'var(--ai-radius-sm, 0.25rem)',
          borderBottomLeftRadius: 'var(--ai-radius-sm, 0.25rem)',
          borderBottomRightRadius: 'var(--ai-radius-sm, 0.25rem)',
          border: `0.0625rem solid ${checked ? 'var(--ai-color-primary, #3b82f6)' : 'var(--ai-border, #d1d5db)'}`,
          background: checked ? 'var(--ai-color-primary, #3b82f6)' : 'var(--ai-bg-surface, #ffffff)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxSizing: 'border-box',
          // No inline transition -- .ai-focus-ring's own shared rule
          // (interactionStyles.ts) already covers background-color and
          // border-color and is !important, so this (like the `all: 'unset'`
          // above) would be silently discarded outright, not just
          // redundant (issue #411).
          ...checkboxVars,
          ...cornerOverrides,
        }}
      >
        <CheckboxPrimitive.Indicator style={{ color: 'var(--ai-color-primary-text, #ffffff)', fontSize: '0.75rem', fontWeight: 'var(--ai-font-weight-black, 900)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ✓
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {label && <span>{label}</span>}
    </Label>
  );
};

/** Props for `<Switch>` — boolean toggle with a sliding track, bound to Form context via `name`. */
export interface SwitchProps {
  /** Field name. Auto-inherited from parent `<FormField>` if omitted. */
  name?: string;
  /** Label text rendered beside the switch. */
  label?: ReactNode;
  /** Controlled checked state. */
  checked?: boolean;
  /** Change handler. Receives the new boolean value directly. */
  onChange?: (checked: boolean) => void;
  /** Per-instance size override. Shared with `<Checkbox>`. */
  overrides?: Partial<ToggleControlSliceState>;
  /**
   * Explicit corner-squaring override, e.g. for a `<UIGroup>` member.
   * See `<Button>`'s own identical prop for the general pattern.
   */
  squareCorners?: SquareCornerOption;
}

export const Switch: React.FC<SwitchProps> = ({ name: propName, label, checked: externalChecked, onChange, overrides, squareCorners }) => {
  const fieldCtx = useContext(FieldContext);
  const name = propName || fieldCtx.name || '';
  const formContext = useOptionalFormContext();
  const registerField = formContext?.registerField;
  const switchVars = getSparseVariables(ToggleControlThemeSlice, overrides ?? {});
  useInjectInteractionStyles();
  const uiGroupSquareCorners = useUIGroupSquareCorners();
  const cornerOverrides = resolveSquareCorners(squareCorners ?? uiGroupSquareCorners);

  // Depends on registerField itself, not the whole formContext object —
  // see RadioGroup.tsx for why (Form recreates that object on every render,
  // so depending on it re-fires this on every keystroke anywhere in the
  // form; registerField is stable for the form's lifetime).
  useEffect(() => {
    if (name && registerField) registerField(name);
  }, [name, registerField]);

  const checked = externalChecked !== undefined ? externalChecked : (name && formContext ? !!formContext.values[name] : false);

  const handleCheckedChange = (val: boolean) => {
    if (name && formContext) {
      formContext.setFieldValue(name, val);
      formContext.setFieldTouched(name, true);
    }
    if (onChange) onChange(val);
  };

  return (
    // gap: 'spacious' restores this label's prior 0.625rem gap — wider than
    // Checkbox's own wrapping label (which uses Label's 0.5rem default) —
    // exactly matching what this component's own hand-rolled <label> used
    // before both were consolidated onto the shared <Label> component.
    <Label overrides={{ gap: 'spacious' }}>
      <SwitchPrimitive.Root
        id={name || undefined}
        checked={checked}
        onCheckedChange={handleCheckedChange}
        className="ai-focus-ring"
        style={{
          all: 'unset',
          width: 'var(--ai-togglecontrol-switch-width, 2.375rem)',
          height: 'var(--ai-togglecontrol-switch-height, 1.25rem)',
          // Explicit per-corner longhands, always all four -- see
          // Checkbox's own identical comment just above in this file for
          // why (a `<UIGroup>` member's cornerOverrides needs to win on
          // just the corners it names, never mixed with a plain
          // `borderRadius` shorthand).
          borderTopLeftRadius: 'var(--ai-radius-lg, 0.625rem)',
          borderTopRightRadius: 'var(--ai-radius-lg, 0.625rem)',
          borderBottomLeftRadius: 'var(--ai-radius-lg, 0.625rem)',
          borderBottomRightRadius: 'var(--ai-radius-lg, 0.625rem)',
          background: checked ? 'var(--ai-color-primary, #3b82f6)' : 'var(--ai-border, #d1d5db)',
          position: 'relative',
          // No inline transition -- .ai-focus-ring's own shared rule
          // (interactionStyles.ts) already covers background-color and is
          // !important, so this (like the `all: 'unset'` above) would be
          // silently discarded outright, not just redundant (issue #411).
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          boxSizing: 'border-box',
          ...switchVars,
          ...cornerOverrides,
        }}
      >
        <SwitchPrimitive.Thumb
          style={{
            display: 'block',
            width: 'var(--ai-togglecontrol-switch-thumb-size, 1rem)',
            height: 'var(--ai-togglecontrol-switch-thumb-size, 1rem)',
            borderRadius: '50%',
            background: '#ffffff',
            // Travel distance is computed alongside width/height in the
            // slice itself (trackWidth - thumb - 2*inset), not hardcoded
            // separately — see ToggleControlSlice.ts's own comment on why
            // that matters once the size is themeable.
            transform: checked
              ? 'translateX(var(--ai-togglecontrol-switch-thumb-travel, 1.25rem))'
              : 'translateX(var(--ai-togglecontrol-switch-thumb-inset, 0.125rem))',
            // No shared class on this element (it's SwitchPrimitive.Thumb,
            // not .Root) -- no collision, so this transition genuinely
            // applies, just needed the floored duration token (issue #411).
            transition: 'transform var(--ai-transition-duration-normal, 0.2s) var(--ai-transition-easing, ease)',
            boxShadow: 'var(--ai-shadow-sm, 0 0.0625rem 0.1875rem rgba(0,0,0,0.2))',
          }}
        />
      </SwitchPrimitive.Root>
      {label && <span>{label}</span>}
    </Label>
  );
};

/** Props for `<Textarea>` — multi-line text input bound to Form context via `name`. */
export interface TextareaProps extends StyleFree<Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'name'>> {
  /** Field name. Auto-inherited from parent `<FormField>` if omitted. */
  name?: string;
  /** Override corner radius using the theme radius token scale. */
  cornerRadiusMode?: CornerRadiusMode;
  /** Per-instance overrides for padding and border width. Shared with `<Input>`. Only applies at the default `size="md"` — see `<Input>`'s own `size` doc. */
  overrides?: Partial<InputSliceState> & { subtheme?: SubthemeName };
  /** Control size, standardized with `<Button>` and every other sized control so instances line up in a `<UIGroup>` row. @default 'md' */
  size?: ControlSize;
}

export const Textarea: React.FC<TextareaProps> = ({ id, name: propName, rows = 3, cornerRadiusMode, onChange, onBlur, value: externalValue, overrides, size = 'md', ...props }) => {
  const fieldCtx = useContext(FieldContext);
  const name = propName || fieldCtx.name || '';
  const formContext = useOptionalFormContext();
  const registerField = formContext?.registerField;
  const { vars: textareaVars } = useSliceOverrides(InputThemeSlice, overrides);
  useInjectInteractionStyles();

  // Depends on registerField itself, not the whole formContext object —
  // see RadioGroup.tsx for why (Form recreates that object on every render,
  // so depending on it re-fires this on every keystroke anywhere in the
  // form; registerField is stable for the form's lifetime).
  useEffect(() => {
    if (name && registerField) registerField(name);
  }, [name, registerField]);

  const value = externalValue !== undefined ? externalValue : (name && formContext ? formContext.values[name] ?? '' : '');
  const isError = name && formContext ? formContext.touched[name] && !!formContext.errors[name] : false;

  return (
    <textarea
      {...props}
      id={id ?? (name || undefined)}
      name={name || undefined}
      rows={rows}
      value={value}
      aria-invalid={isError || undefined}
      aria-describedby={isError ? `${name}-error` : undefined}
      className="ai-focus-ring"
      onChange={e => {
        if (name && formContext) formContext.setFieldValue(name, e.target.value);
        if (onChange) onChange(e);
      }}
      onBlur={e => {
        if (name && formContext) formContext.setFieldTouched(name, true);
        if (onBlur) onBlur(e);
      }}
      style={{
        width: '100%',
        padding: resolveControlPadding(size, 'var(--ai-input-padding, 0.5rem 0.75rem)'),
        borderRadius: resolveRadius(cornerRadiusMode, 'md'),
        border: `var(--ai-input-border-width, 0.0625rem) solid ${isError ? 'var(--ai-subtheme-error, #ef4444)' : 'var(--ai-border, #d1d5db)'}`,
        background: 'var(--ai-bg-surface, #ffffff)',
        color: 'var(--ai-text-primary, #111827)',
        fontSize: CONTROL_FONT_SIZE_VAR[size],
        outline: 'none',
        boxSizing: 'border-box',
        fontFamily: 'inherit',
        resize: 'vertical',
        ...textareaVars,
      }}
    />
  );
};
