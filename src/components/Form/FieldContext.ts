import { createContext } from 'react';

/**
 * Lets `<FormField name="...">` automatically provide its `name` to a
 * child control that doesn't specify its own — without this, every
 * control would need an explicit `name` prop even when nested inside a
 * `<FormField>` that already declares it.
 *
 * Lives in its own module rather than inline in FormComponents.tsx (where
 * it originally was) specifically so files split out from there —
 * `RadioGroup.tsx`, `Select.tsx` — can import it too, without a circular
 * import back into FormComponents.tsx (which re-exports both of them via
 * `export * from './RadioGroup'` / `'./Select'`). Input/Textarea/Checkbox/
 * Switch, defined directly in FormComponents.tsx, already had access to
 * this before the extraction; RadioGroup and Select did not, despite both
 * documenting the same "auto-inherited from parent `<FormField>`" behavior
 * in their own JSDoc — the context simply wasn't reachable from those
 * files, so neither actually implemented what its own docs promised.
 */
export interface FieldContextValue {
  name?: string;
}

export const FieldContext = createContext<FieldContextValue>({});
