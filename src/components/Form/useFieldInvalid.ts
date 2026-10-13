'use client';

import { useOptionalFormContext } from './FormContext';

/**
 * Whether a form control should present as invalid: the field is bound to an
 * enclosing `<Form>`, has been touched, and the schema reports an error for it.
 * An explicit `aria-invalid` on the control wins over the Form-derived value,
 * which also covers a control used outside any `<Form>`.
 *
 * Every Form control calls this instead of re-deriving `touched && errors`
 * itself, so a new control gets the same invalid semantics for free.
 * @barrelExport
 */
export function useFieldInvalid(name: string | undefined, ariaInvalid?: boolean | 'true' | 'false' | 'grammar' | 'spelling'): boolean {
  const formContext = useOptionalFormContext();
  if (ariaInvalid !== undefined) return ariaInvalid === true || ariaInvalid === 'true' || ariaInvalid === 'grammar' || ariaInvalid === 'spelling';
  return name && formContext ? !!formContext.touched[name] && !!formContext.errors[name] : false;
}

/** The `--ai-subtheme-error` color every invalid control paints its border/indicator with. */
export const INVALID_COLOR = 'var(--ai-subtheme-error, #ef4444)';
