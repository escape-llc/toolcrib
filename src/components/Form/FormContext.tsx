import React, { createContext, useContext, useState, ReactNode, FormEvent } from 'react';
import { z, ZodType } from 'zod';
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
  /** Called with validated values on successful submission. */
  onSubmit?: (values: T) => void | Promise<void>;
  children: ReactNode;
  /** Form element id attribute. Also used as `formId` in event bus payloads. */
  id?: string;
}

/**
 * @manifest Zod 4 schema-driven form. Controls bind via context — no register() or onChange boilerplate
 * @manifestChildren FormField, FormError, Button, SubmitButton, Input, Select, Checkbox, Switch, Textarea, RadioGroup, Slider
 * @manifestCategory Form Controls
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

  const validateValues = (currentValues: Record<string, any>): Record<string, string> => {
    if (!schema) return {};

    const result = schema.safeParse(currentValues);
    if (result.success) {
      return {};
    }

    const newErrors: Record<string, string> = {};
    result.error.issues.forEach(issue => {
      const fieldPath = issue.path.join('.');
      if (fieldPath && !newErrors[fieldPath]) {
        newErrors[fieldPath] = issue.message;
      }
    });

    return newErrors;
  };

  const setFieldValue = (name: string, value: any) => {
    setValues(prev => {
      const updated = { ...prev, [name]: value };
      if (schema) {
        const errs = validateValues(updated);
        setErrors(errs);
        const isValid = Object.keys(errs).length === 0;
        aiBus.emit('form:validated', { formId: id, isValid });
        if (!isValid) {
          aiBus.emit('form:errored', { formId: id, errors: errs });
        }
      }
      return updated;
    });
  };

  const setFieldTouched = (name: string, isTouched = true) => {
    setTouched(prev => ({ ...prev, [name]: isTouched }));
  };

  const registerField = (name: string) => {
    if (values[name] === undefined) {
      setValues(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateField = (name: string, val?: any): boolean => {
    if (!schema) return true;
    const testValues = { ...values, [name]: val !== undefined ? val : values[name] };
    const errs = validateValues(testValues);
    setErrors(errs);
    const isValid = !errs[name];
    aiBus.emit('form:validated', { formId: id, isValid });
    if (!isValid) {
      aiBus.emit('form:errored', { formId: id, errors: errs });
    }
    return isValid;
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

    const validationErrors = validateValues(values);
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

    aiBus.emit('form:submitted', { formId: id, values });

    if (onSubmit) {
      try {
        await onSubmit(values as T);
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
