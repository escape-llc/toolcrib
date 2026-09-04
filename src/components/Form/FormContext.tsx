'use client';

import { createContext, useCallback, useContext, useState, type ReactNode, type FormEvent } from 'react';
import { ZodType } from 'zod';
import { aiBus } from '../../eventBus/eventBus';

/**
 * Context value exposed by `<Form>` to all descendant form controls.
 *
 * AI consumers should NOT use this directly — form controls (`<Input>`, `<Select>`, etc.)
 * bind automatically via `useOptionalFormContext()`.
 */
export interface FormContextType {
  /** Current form field values keyed by field name. */
  values: Record<string, any>;
  /** Current validation errors keyed by field name. Empty object when valid. */
  errors: Record<string, string>;
  /** Tracks which fields have been blurred/interacted with. */
  touched: Record<string, boolean>;
  /** True while the `onSubmit` handler is executing. */
  isSubmitting: boolean;
  /** Update a single field value and re-validate. */
  setFieldValue: (name: string, value: any) => void;
  /** Mark a field as touched (triggers error display). */
  setFieldTouched: (name: string, touched?: boolean) => void;
  /** Register a field name in the values map (called automatically by controls). */
  registerField: (name: string) => void;
  /** Validate a single field against the schema. Returns true if valid. */
  validateField: (name: string, val?: any) => boolean;
  /** Trigger full form validation and submission. */
  handleSubmit: (e?: FormEvent) => void;
  /** Reset all values, errors, and touched state to initial values. */
  resetForm: () => void;
}

const FormContext = createContext<FormContextType | undefined>(undefined);

/**
 * Props for the `<Form>` component — Zod 4 schema-driven validation engine.
 *
 * @example
 * ```tsx
 * const schema = z.object({ email: z.string().email() });
 * <Form schema={schema} onSubmit={save}>
 *   <FormField name="email" label="Email"><Input /></FormField>
 *   <SubmitButton>Save</SubmitButton>
 * </Form>
 * ```
 */
export interface FormProps<T extends Record<string, any> = Record<string, any>> {
  /** Zod schema for validation. Omit for unvalidated forms. */
  schema?: ZodType<T>;
  /** Initial field values. Fields not listed default to empty string. */
  initialValues?: Partial<T>;
  /**
   * Called with the schema's parsed output on successful submission — for
   * a schema using `z.coerce.number()`, `.transform()`, etc., this is the
   * transformed value (a real `number`), not the raw string every field
   * control itself always stores. Forms with no `schema` get the raw field
   * values as-is, since there's nothing to parse them into.
   */
  onSubmit?: (values: T) => void | Promise<void>;
  children: ReactNode;
  /** Form element id attribute. Also used as `formId` in event bus payloads. */
  id?: string;
}

/**
 * @manifest Zod 4 schema-driven form. Controls bind via context — no register() or onChange boilerplate
 * @manifestChildren FormField, FormError, Button, SubmitButton, Input, Select, Checkbox, Switch, Textarea, RadioGroup, Slider
 * @manifestCategory Form Controls
 * @manifestAntiPatternAvoid Write `register()` or `onChange` boilerplate for form fields
 * @manifestAntiPatternInstead Nest `<Input>`, `<Select>`, etc. inside `<FormField name="...">` — binding is automatic
 */
export function Form<T extends Record<string, any> = Record<string, any>>({
  schema,
  initialValues = {},
  onSubmit,
  children,
  id,
}: FormProps<T>) {
  const [values, setValues] = useState<Record<string, any>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Returns both the field-level error map AND `schema`'s actual parsed
  // output (`data`) — the two previously came apart at the one place it
  // mattered: handleSubmit computed errors from this same safeParse call
  // but then handed onSubmit the raw, pre-transform `values` state instead
  // of `result.data`. A schema using `z.coerce.number()`/`.transform()`
  // validated correctly but silently passed onSubmit the untransformed
  // value anyway — a real mismatch between what `FormProps.onSubmit`'s
  // type (`z.infer<typeof schema>`) claims and what actually arrived at
  // runtime, confirmed via a real consumer app (Founder's Desk) crashing
  // a `.toFixed()` call on what its schema's type said was already a
  // `number`. `data` is meaningless on failure (nothing should read it
  // then) and defaults to `currentValues` in both the invalid and
  // no-schema cases, so every caller can destructure it unconditionally.
  const parseValues = (currentValues: Record<string, any>): { errors: Record<string, string>; data: Record<string, any> } => {
    if (!schema) return { errors: {}, data: currentValues };

    const result = schema.safeParse(currentValues);
    if (result.success) {
      return { errors: {}, data: result.data };
    }

    const newErrors: Record<string, string> = {};
    result.error.issues.forEach(issue => {
      const fieldPath = issue.path.join('.');
      if (fieldPath && !newErrors[fieldPath]) {
        newErrors[fieldPath] = issue.message;
      }
    });

    return { errors: newErrors, data: currentValues };
  };

  const setFieldValue = (name: string, value: any) => {
    // setFieldValue is a plain function recreated every render (not
    // useCallback), so `values` here is always the current render's value —
    // safe to read directly rather than going through setValues' functional
    // updater. That matters because the validation/emit side effects below
    // must run exactly once per call: React 18 StrictMode invokes functional
    // updaters twice in dev specifically to catch impure updaters, and
    // putting setErrors/aiBus.emit inside one (the previous implementation)
    // meant every field edit double-emitted form:validated/form:errored.
    const updated = { ...values, [name]: value };
    setValues(updated);
    if (schema) {
      const { errors: errs } = parseValues(updated);
      setErrors(errs);
      const isValid = Object.keys(errs).length === 0;
      aiBus.emit('form:validated', { formId: id, isValid });
      if (!isValid) {
        aiBus.emit('form:errored', { formId: id, errors: errs });
      }
    }
  };

  const setFieldTouched = (name: string, isTouched = true) => {
    setTouched(prev => ({ ...prev, [name]: isTouched }));
  };

  // Stable across the form's whole lifetime (empty deps) — reads/writes
  // values entirely through the functional setValues form rather than
  // closing over the `values` variable above, specifically so field
  // controls (Input, RadioGroup, Select, etc.) can depend on this function
  // itself instead of the whole FormContext value, which Form recreates as
  // a new object literal on every render. Depending on the object was
  // re-firing every field's mount-registration effect on every keystroke
  // anywhere in the form; depending on this stable function fixes that at
  // the source for every consumer at once.
  const registerField = useCallback((name: string) => {
    setValues(prev => (prev[name] === undefined ? { ...prev, [name]: '' } : prev));
  }, []);

  const validateField = (name: string, val?: any): boolean => {
    if (!schema) return true;
    const testValues = { ...values, [name]: val !== undefined ? val : values[name] };
    const { errors: errs } = parseValues(testValues);
    setErrors(errs);
    const fieldIsValid = !errs[name];
    // form:validated/form:errored describe the whole form (matching
    // setFieldValue/handleSubmit's emissions of the same events) — only
    // the return value below is scoped to this one field.
    const formIsValid = Object.keys(errs).length === 0;
    aiBus.emit('form:validated', { formId: id, isValid: formIsValid });
    if (!formIsValid) {
      aiBus.emit('form:errored', { formId: id, errors: errs });
    }
    return fieldIsValid;
  };

  const resetForm = () => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  };

  const handleSubmit = async (e?: FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    setIsSubmitting(true);

    const { errors: validationErrors, data: parsedValues } = parseValues(values);
    setErrors(validationErrors);

    // Mark all fields touched
    const allTouched: Record<string, boolean> = {};
    Object.keys(values).forEach(k => {
      allTouched[k] = true;
    });
    setTouched(allTouched);

    const isValid = Object.keys(validationErrors).length === 0;

    aiBus.emit('form:validated', { formId: id, isValid });

    if (!isValid) {
      setIsSubmitting(false);
      aiBus.emit('form:errored', { formId: id, errors: validationErrors });
      return;
    }

    aiBus.emit('form:submitted', { formId: id, values: parsedValues });

    if (onSubmit) {
      try {
        await onSubmit(parsedValues as T);
      } catch (err) {
        console.error('Error in Form onSubmit:', err);
      }
    }

    setIsSubmitting(false);
  };

  return (
    <FormContext.Provider
      value={{
        values,
        errors,
        touched,
        isSubmitting,
        setFieldValue,
        setFieldTouched,
        registerField,
        validateField,
        handleSubmit,
        resetForm,
      }}
    >
      <form id={id} onSubmit={handleSubmit} noValidate>
        {children}
      </form>
    </FormContext.Provider>
  );
}

export const useFormContext = (): FormContextType => {
  const context = useContext(FormContext);
  if (!context) {
    throw new Error('Form controls must be rendered within a <Form> component');
  }
  return context;
};

export const useOptionalFormContext = (): FormContextType | null => {
  return useContext(FormContext) ?? null;
};
