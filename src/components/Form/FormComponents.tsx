import React, { ReactNode, InputHTMLAttributes, TextareaHTMLAttributes, ButtonHTMLAttributes, useContext } from 'react';
import { Checkbox as CheckboxPrimitive, Switch as SwitchPrimitive } from 'radix-ui';
import { useOptionalFormContext } from './FormContext';
import { PaddingMode, resolvePadding } from '../../theme/padding';
import { CornerRadiusMode, resolveRadius } from '../../theme/radius';
import { StyleFree } from '../../theme/safeProps';
import { useResolvedSubtheme } from '../../theme/useSliceOverrides';
import { resolveSubtheme, SubthemeName } from '../../theme/subtheme';
import { SquareCornerOption, resolveSquareCorners } from '../Card/Card';
import { FieldContext } from './FieldContext';
export * from './RadioGroup';
export * from './Select';
export * from './Slider';

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

  return (
    <FieldContext.Provider value={{ name }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', width: '100%', marginBottom: 'var(--ai-margin-gap, 0.875rem)' }}>
        {label && (
          <label htmlFor={name} style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--ai-text-primary, #111827)' }}>
            {label}
          </label>
        )}
        {children}
        {error && (
          <span style={{ fontSize: '0.75rem', color: 'var(--ai-subtheme-error, #ef4444)', marginTop: '0.125rem' }}>
            {error}
          </span>
        )}
        {!error && helperText && (
          <span style={{ fontSize: '0.75rem', color: 'var(--ai-text-secondary, #6b7280)', marginTop: '0.125rem' }}>
            {helperText}
          </span>
        )}
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
  if (name) {
    const error = touched[name] ? errors[name] : undefined;
    if (!error) return null;
    return (
      <div style={{ color: 'var(--ai-subtheme-error, #ef4444)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
        {error}
      </div>
    );
  }

  const hasErrors = Object.keys(errors).length > 0;
  if (!hasErrors) return null;

  return (
    <div style={{ color: 'var(--ai-subtheme-error, #ef4444)', fontSize: '0.875rem', padding: '0.5rem 0.75rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--ai-radius-md, 0.375rem)' }}>
      Please correct the errors in the form before submitting.
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
  size?: 'sm' | 'md' | 'lg';
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
}

/**
 * @manifest Styled button with five variants, three sizes, subtheme colouring, and icon slots
 * @manifestCategory Form Controls
 */
export const Button: React.FC<ButtonProps> = ({
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
  ...props
}) => {
  const startIcon = icon || leadingIcon;
  const subtheme = useResolvedSubtheme(instanceSubtheme);
  const subthemeColors = subtheme ? resolveSubtheme(subtheme) : undefined;

  const getSizeStyles = (): React.CSSProperties => {
    const padding = resolvePadding(paddingMode, size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'md');
    switch (size) {
      case 'sm': return { padding, fontSize: '0.75rem' };
      case 'lg': return { padding, fontSize: '1rem' };
      default: return { padding, fontSize: '0.875rem' };
    }
  };

  const getVariantStyles = (): React.CSSProperties => {
    let baseBg = subthemeColors ? subthemeColors.main : 'var(--ai-color-primary, #3b82f6)';
    let textColor = '#ffffff';

    if (variant === 'secondary') {
      baseBg = 'var(--ai-color-secondary, #64748b)';
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
  const cornerOverrides = resolveSquareCorners(squareCorners);

  return (
    <button
      {...props}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        fontWeight: 600,
        borderTopLeftRadius: cornerOverrides.borderTopLeftRadius ?? currentRadius,
        borderTopRightRadius: cornerOverrides.borderTopRightRadius ?? currentRadius,
        borderBottomLeftRadius: cornerOverrides.borderBottomLeftRadius ?? currentRadius,
        borderBottomRightRadius: cornerOverrides.borderBottomRightRadius ?? currentRadius,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'var(--ai-transition-normal, all 0.2s cubic-bezier(0.4, 0, 0.2, 1))',
        ...getSizeStyles(),
        ...getVariantStyles(),
      }}
    >
      {startIcon && (
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1em', lineHeight: 1 }}>
          {startIcon}
        </span>
      )}
      {children}
      {trailingIcon && (
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1em', lineHeight: 1 }}>
          {trailingIcon}
        </span>
      )}
    </button>
  );
};

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
export interface InputProps extends StyleFree<Omit<InputHTMLAttributes<HTMLInputElement>, 'name'>> {
  /** Field name. Auto-inherited from parent `<FormField>` if omitted. */
  name?: string;
  /** Override corner radius using the theme radius token scale. */
  cornerRadiusMode?: CornerRadiusMode;
}

export const Input: React.FC<InputProps> = ({ name: propName, type = 'text', cornerRadiusMode, onBlur, onChange, value: externalValue, ...props }) => {
  const fieldCtx = useContext(FieldContext);
  const name = propName || fieldCtx.name || '';
  const formContext = useOptionalFormContext();
  const registerField = formContext?.registerField;

  // Depends on registerField itself, not the whole formContext object —
  // see RadioGroup.tsx for why (Form recreates that object on every render,
  // so depending on it re-fires this on every keystroke anywhere in the
  // form; registerField is stable for the form's lifetime).
  React.useEffect(() => {
    if (name && registerField) registerField(name);
  }, [name, registerField]);

  const value = externalValue !== undefined ? externalValue : (name && formContext ? formContext.values[name] ?? '' : '');
  const isError = name && formContext ? formContext.touched[name] && !!formContext.errors[name] : false;

  return (
    <input
      id={name || undefined}
      name={name || undefined}
      type={type}
      value={value}
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
        padding: '0.5rem 0.75rem',
        borderRadius: resolveRadius(cornerRadiusMode, 'md'),
        border: `0.0625rem solid ${isError ? 'var(--ai-subtheme-error, #ef4444)' : 'var(--ai-border, #d1d5db)'}`,
        background: 'var(--ai-bg-surface, #ffffff)',
        color: 'var(--ai-text-primary, #111827)',
        fontSize: '0.875rem',
        outline: 'none',
        boxSizing: 'border-box',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
      }}
      {...props}
    />
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
}

export const Checkbox: React.FC<CheckboxProps> = ({ name: propName, label, checked: externalChecked, onChange }) => {
  const fieldCtx = useContext(FieldContext);
  const name = propName || fieldCtx.name || '';
  const formContext = useOptionalFormContext();
  const registerField = formContext?.registerField;

  // Depends on registerField itself, not the whole formContext object —
  // see RadioGroup.tsx for why (Form recreates that object on every render,
  // so depending on it re-fires this on every keystroke anywhere in the
  // form; registerField is stable for the form's lifetime).
  React.useEffect(() => {
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
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
      <CheckboxPrimitive.Root
        id={name || undefined}
        checked={checked}
        onCheckedChange={handleCheckedChange}
        style={{
          all: 'unset',
          width: '1.125rem',
          height: '1.125rem',
          borderRadius: '0.25rem',
          border: `0.0625rem solid ${checked ? 'var(--ai-color-primary, #3b82f6)' : 'var(--ai-border, #d1d5db)'}`,
          background: checked ? 'var(--ai-color-primary, #3b82f6)' : 'var(--ai-bg-surface, #ffffff)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxSizing: 'border-box',
          transition: 'all 0.15s ease',
        }}
      >
        <CheckboxPrimitive.Indicator style={{ color: '#ffffff', fontSize: '0.75rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ✓
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {label && <span>{label}</span>}
    </label>
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
}

export const Switch: React.FC<SwitchProps> = ({ name: propName, label, checked: externalChecked, onChange }) => {
  const fieldCtx = useContext(FieldContext);
  const name = propName || fieldCtx.name || '';
  const formContext = useOptionalFormContext();
  const registerField = formContext?.registerField;

  // Depends on registerField itself, not the whole formContext object —
  // see RadioGroup.tsx for why (Form recreates that object on every render,
  // so depending on it re-fires this on every keystroke anywhere in the
  // form; registerField is stable for the form's lifetime).
  React.useEffect(() => {
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
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', fontSize: '0.875rem' }}>
      <SwitchPrimitive.Root
        id={name || undefined}
        checked={checked}
        onCheckedChange={handleCheckedChange}
        style={{
          all: 'unset',
          width: '2.375rem',
          height: '1.25rem',
          borderRadius: '0.625rem',
          background: checked ? 'var(--ai-color-primary, #3b82f6)' : 'var(--ai-border, #d1d5db)',
          position: 'relative',
          transition: 'background 0.2s ease',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          boxSizing: 'border-box',
        }}
      >
        <SwitchPrimitive.Thumb
          style={{
            display: 'block',
            width: '1rem',
            height: '1rem',
            borderRadius: '50%',
            background: '#ffffff',
            transform: checked ? 'translateX(1.25rem)' : 'translateX(0.125rem)',
            transition: 'transform 0.2s ease',
            boxShadow: '0 0.0625rem 0.1875rem rgba(0,0,0,0.2)',
          }}
        />
      </SwitchPrimitive.Root>
      {label && <span>{label}</span>}
    </label>
  );
};

/** Props for `<Textarea>` — multi-line text input bound to Form context via `name`. */
export interface TextareaProps extends StyleFree<Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'name'>> {
  /** Field name. Auto-inherited from parent `<FormField>` if omitted. */
  name?: string;
  /** Override corner radius using the theme radius token scale. */
  cornerRadiusMode?: CornerRadiusMode;
}

export const Textarea: React.FC<TextareaProps> = ({ name: propName, rows = 3, cornerRadiusMode, onChange, onBlur, value: externalValue, ...props }) => {
  const fieldCtx = useContext(FieldContext);
  const name = propName || fieldCtx.name || '';
  const formContext = useOptionalFormContext();
  const registerField = formContext?.registerField;

  // Depends on registerField itself, not the whole formContext object —
  // see RadioGroup.tsx for why (Form recreates that object on every render,
  // so depending on it re-fires this on every keystroke anywhere in the
  // form; registerField is stable for the form's lifetime).
  React.useEffect(() => {
    if (name && registerField) registerField(name);
  }, [name, registerField]);

  const value = externalValue !== undefined ? externalValue : (name && formContext ? formContext.values[name] ?? '' : '');
  const isError = name && formContext ? formContext.touched[name] && !!formContext.errors[name] : false;

  return (
    <textarea
      id={name || undefined}
      name={name || undefined}
      rows={rows}
      value={value}
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
        padding: '0.5rem 0.75rem',
        borderRadius: resolveRadius(cornerRadiusMode, 'md'),
        border: `0.0625rem solid ${isError ? 'var(--ai-subtheme-error, #ef4444)' : 'var(--ai-border, #d1d5db)'}`,
        background: 'var(--ai-bg-surface, #ffffff)',
        color: 'var(--ai-text-primary, #111827)',
        fontSize: '0.875rem',
        outline: 'none',
        boxSizing: 'border-box',
        fontFamily: 'inherit',
        resize: 'vertical',
      }}
      {...props}
    />
  );
};
