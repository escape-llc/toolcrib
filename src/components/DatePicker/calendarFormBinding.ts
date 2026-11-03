'use client';

import { useContext, useEffect, useState } from 'react';
import { FieldContext } from '../Form/FieldContext';
import { useOptionalFormContext } from '../Form/FormContext';
import { useFieldInvalid, INVALID_COLOR } from '../Form/useFieldInvalid';
import { useFieldsetDisabled } from '../Fieldset/FieldsetContext';

/**
 * The Form binding `<Calendar>` and `<RangeCalendar>` share, the same contract
 * every Form control meets (src/__tests__/formControlContract.test.tsx): the
 * name inherited from `<FormField>`, the seed registered on mount, the field's
 * value as the controlled value, a change written and touched, the FormField
 * label, an enclosing `<Fieldset disabled>`, and invalid state.
 *
 * DatePicker and DateRangePicker clear the inherited field around the
 * calendar in their popup, so it never binds a second time.
 */
export function useCalendarFormBinding<V>(propName: string | undefined, seed: V | null, isDisabledProp: boolean, ariaInvalid?: boolean) {
  const fieldCtx = useContext(FieldContext);
  const fieldName = propName || fieldCtx.name || '';
  const formContext = useOptionalFormContext();
  const registerField = formContext?.registerField;
  useEffect(() => {
    if (fieldName && registerField) registerField(fieldName, seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a seed is read once, like any default
  }, [fieldName, registerField]);
  const isFormBound = !!(fieldName && formContext);
  const isError = useFieldInvalid(fieldName || undefined, ariaInvalid);
  const raw = isFormBound ? (formContext!.values[fieldName] as V | null | undefined) : undefined;

  // Changed from outside (resetForm, initialValues): React Aria keeps its
  // focused day, so Tab would land on the last-clicked date, not the value.
  // Remount the grid then; the user's own pick (lastWritten) never does.
  const [lastWritten, setLastWritten] = useState<V | undefined>(undefined);
  const [prevRaw, setPrevRaw] = useState(raw);
  const [gridKey, setGridKey] = useState(0);
  if (raw !== prevRaw) {
    setPrevRaw(raw);
    if (prevRaw !== undefined && raw !== lastWritten) setGridKey(k => k + 1);
  }

  return {
    gridKey,
    fieldName,
    isFormBound,
    formValue: isFormBound ? (raw ?? null) : undefined,
    labelId: fieldCtx.labelId,
    isDisabled: useFieldsetDisabled(isDisabledProp),
    isError,
    write: (next: V) => {
      if (!isFormBound) return;
      setLastWritten(next);
      formContext!.setFieldValue(fieldName, next);
      formContext!.setFieldTouched(fieldName, true);
    },
    /** A ring in the error color around the grid: no layout shift, unlike a border. */
    invalidStyle: isError ? { boxShadow: `0 0 0 0.0625rem ${INVALID_COLOR}`, borderRadius: 'var(--ai-radius-md, 0.375rem)' } : {},
    describedBy: isError && fieldName ? `${fieldName}-error` : undefined,
  };
}
