'use client';

import { createContext, useContext } from 'react';

/**
 * Lets a `<Fieldset disabled>` reach every form control inside it, however
 * deeply nested. The native `<fieldset disabled>` attribute already disables
 * native inputs and buttons, but not a control that renders a `<span
 * role=...>` with a hidden input (Checkbox, Switch, Radio) or a React Aria
 * field, so a control resolves its own `disabled` through this too.
 */
export const FieldsetContext = createContext<{ disabled: boolean }>({ disabled: false });

/**
 * A control's effective `disabled`: its own prop, or the enclosing
 * `<Fieldset>`'s. Either one disables it, exactly as in HTML, where a control
 * inside a disabled `<fieldset>` can't be re-enabled by its own attribute.
 * @barrelExport
 */
export function useFieldsetDisabled(own?: boolean): boolean {
  const { disabled } = useContext(FieldsetContext);
  return Boolean(own) || disabled;
}
