'use client';

import { useContext } from 'react';
import { FieldContext } from './FieldContext';
import { mergeDescribedBy } from '../shared/mergeDescribedBy';

/**
 * The `aria-describedby` a Form control should render: the consumer's own ids,
 * then the surrounding `<FormField>`'s helper text (while it is showing), then
 * the field's error message while the control is invalid. Every Form control
 * calls this instead of writing `${name}-error` itself, so a consumer's
 * description is never replaced and the helper text is always announced.
 * @barrelExport
 */
export function useFieldDescribedBy(consumer: string | undefined, isError: boolean, errorId: string | undefined): string | undefined {
  const { helperId } = useContext(FieldContext);
  return mergeDescribedBy(consumer, helperId, isError ? errorId : undefined);
}
