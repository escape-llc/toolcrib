'use client';

import { useState } from 'react';
import { aiBus } from '../../eventBus/eventBus';
import type { TableDensity } from './DataTableSlice';

export interface UseTableDensityOptions {
  density?: TableDensity;
  defaultDensity?: TableDensity;
  onDensityChange?: (density: TableDensity) => void;
  /** This table instance's id, for the `datatable:density_changed` event payload. */
  tableId: string;
}

export interface UseTableDensityResult {
  density: TableDensity;
  handleDensityChange: (density: TableDensity) => void;
}

/**
 * `<DataTable densitySelector>`'s own live density state (issue #339) --
 * same controlled/uncontrolled shape `useTableQuickFilter`/`useTableSort`
 * already use. Deliberately its own hook rather than folded into the
 * `overrides`/`useSliceOverrides` mechanism: `overrides.density` is a
 * static, per-instance value a developer sets once, while this is a live
 * value an end user can toggle at runtime -- `DataTable.tsx` merges this
 * hook's resolved value into the `overrides` object passed to
 * `useSliceOverrides` (taking precedence over any `overrides.density` also
 * given), rather than this hook knowing anything about the theme system.
 */
export function useTableDensity({
  density: controlledDensity,
  defaultDensity,
  onDensityChange,
  tableId,
}: UseTableDensityOptions): UseTableDensityResult {
  const [internalDensity, setInternalDensity] = useState<TableDensity>(defaultDensity ?? 'normal');
  const isControlled = controlledDensity !== undefined;
  const density = isControlled ? controlledDensity! : internalDensity;

  const handleDensityChange = (next: TableDensity) => {
    if (!isControlled) setInternalDensity(next);
    onDensityChange?.(next);
    aiBus.emit('datatable:density_changed', { id: tableId, density: next });
  };

  return { density, handleDensityChange };
}
