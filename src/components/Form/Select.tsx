import React, { type ReactNode, useContext } from 'react';
import { Select as SelectPrimitive } from 'radix-ui';
import { useOptionalFormContext } from './FormContext';
import { FieldContext } from './FieldContext';
import { aiBus } from '../../eventBus/eventBus';
import { Z_INDEX } from '../../theme/zIndex';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { useTargetDocument } from '../../theme/targetDocumentContext';
import { type SubthemeName } from '../../theme/subtheme';
import { SelectThemeSlice, type SelectSliceState } from './SelectSlice';

/** Data shape for each option in a `<Select>` dropdown. */
export interface SelectOptionData {
  /** Display text for the option. */
  label: ReactNode;
  /** Value submitted/emitted when this option is selected. */
  value: string;
  /** If true, the option is visible but not selectable. */
  disabled?: boolean;
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
  /** Per-instance overrides for trigger padding and item density. */
  overrides?: Partial<SelectSliceState> & { subtheme?: SubthemeName };
}

/**
 * @manifest Dropdown select control bound to Form context, built on Radix Select
 * @manifestCategory Form Controls
 */
export const Select: React.FC<SelectProps> = ({
  id,
  name: propName,
  placeholder = 'Select option...',
  options,
  value: externalValue,
  defaultValue,
  onChange: externalOnChange,
  disabled = false,
  overrides,
}) => {
  const fieldCtx = useContext(FieldContext);
  const fieldName = propName || fieldCtx.name || '';
  const effectiveId = id ?? (fieldName || undefined);
  const formContext = useOptionalFormContext();
  const registerField = formContext?.registerField;
  const isError = fieldName && formContext ? formContext.touched[fieldName] && !!formContext.errors[fieldName] : false;
  const { vars: selectVars } = useSliceOverrides(SelectThemeSlice, overrides);
  const targetDocument = useTargetDocument();
  useInjectInteractionStyles();

  // Without this, a Select's name is never added to the form's `values`
  // object until the user actually picks something — and handleSubmit's
  // "mark all fields touched" loop only touches keys already present in
  // `values`. A required Select left at its placeholder on first submit
  // would compute a real validation error (schema validation runs
  // regardless) but never be marked touched, so <FormField>'s
  // `touched[name] ? errors[name] : undefined` display logic would hide
  // that error forever. Matches Input/Textarea/Checkbox/Switch, which all
  // already call this on mount.
  //
  // Depends on registerField itself, not the whole formContext object —
  // see RadioGroup.tsx for why that distinction matters (wasted re-runs on
  // every keystroke anywhere in the form, not just this field's own).
  React.useEffect(() => {
    if (fieldName && registerField) registerField(fieldName);
  }, [fieldName, registerField]);

  const formValue = fieldName && formContext ? formContext.values[fieldName] : undefined;
  const selectedValue = externalValue !== undefined ? externalValue : formValue !== undefined ? String(formValue) : defaultValue;

  const handleChange = (val: string) => {
    aiBus.emit('select:changed', { name: fieldName, value: val });
    if (externalOnChange) externalOnChange(val);
    if (fieldName && formContext) {
      formContext.setFieldValue(fieldName, val);
      formContext.setFieldTouched(fieldName, true);
    }
  };

  return (
    <SelectPrimitive.Root
      value={selectedValue}
      onValueChange={handleChange}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        id={effectiveId}
        aria-invalid={isError || undefined}
        aria-describedby={isError ? `${fieldName}-error` : undefined}
        className="ai-btn ai-focus-ring"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: 'var(--ai-select-trigger-padding, 0.5rem 0.75rem)',
          borderRadius: 'var(--ai-radius-md, 0.375rem)',
          border: '0.0625rem solid var(--ai-border, #d1d5db)',
          background: 'var(--ai-bg-surface, #ffffff)',
          color: 'var(--ai-text-primary, #111827)',
          fontSize: '0.875rem',
          outline: 'none',
          boxSizing: 'border-box',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          ['--ai-btn-bg' as string]: 'var(--ai-bg-surface, #ffffff)',
          ...selectVars,
        }}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon style={{ color: 'var(--ai-text-secondary, #6b7280)', fontSize: '0.75rem' }}>
          ▼
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal container={targetDocument?.body}>
        {/* Content portals to a different DOM location than Trigger above
            (see this file's comment near `overrides` — CSS custom
            properties only inherit through the real DOM tree, not the
            React tree), so selectVars is spread here too, not just on
            Trigger, even though --ai-select-trigger-padding itself is a
            no-op here. */}
        <SelectPrimitive.Content
          className="ai-focus-ring"
          style={{
            zIndex: Z_INDEX.DROPDOWN,
            background: 'var(--ai-bg-surface, #ffffff)',
            borderRadius: 'var(--ai-radius-md, 0.375rem)',
            border: '0.0625rem solid var(--ai-border, #e5e7eb)',
            boxShadow: '0 0.625rem 1.5625rem -0.3125rem rgba(0,0,0,0.15)',
            overflow: 'hidden',
            minWidth: '11.25rem',
            ...selectVars,
          }}
        >
          <SelectPrimitive.Viewport style={{ padding: 'var(--ai-padding-xs, 0.25rem)' }}>
            {options.map((opt) => (
              <SelectPrimitive.Item
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
                className="ai-menu-item"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--ai-select-item-padding, 0.4375rem 0.75rem)',
                  fontSize: '0.875rem',
                  borderRadius: 'var(--ai-radius-sm, 0.25rem)',
                  color: 'var(--ai-text-primary, #111827)',
                  cursor: opt.disabled ? 'not-allowed' : 'pointer',
                  outline: 'none',
                  userSelect: 'none',
                }}
              >
                <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator style={{ color: 'var(--ai-color-primary, #3b82f6)', fontWeight: 'var(--ai-font-weight-black, 900)' }}>
                  ✓
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
};
