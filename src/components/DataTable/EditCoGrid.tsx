'use client';

import { useState, type CSSProperties } from 'react';
import { Presence } from '@radix-ui/react-presence';
import type { ZodType } from 'zod';
import { Form } from '../Form/FormContext';
import { FormField, Input, SubmitButton, Button } from '../Form/FormComponents';
import type { Column, CellContext } from './DataTable';

export interface EditCoGridEntry<T> {
  key: string;
  record: T;
  index: number;
}

export interface EditCoGridProps<T extends Record<string, any>> {
  tableId: string;
  columns: Column<T>[];
  /** Same redistributed px width the main grid's own `<colgroup>` uses (`getRedistributedColumnWidth` in `DataTable.tsx`) -- reused directly, not recomputed, so the two grids' columns actually line up in practice. */
  getColumnWidth: (col: Column<T>) => number;
  editSchema: ZodType<T>;
  /** Every row currently in the editing key-set, resolved against the raw `data` array -- NOT scoped to any page/sort/filter view. */
  entries: EditCoGridEntry<T>[];
  /** Keys that are ALSO on the main grid's current page/sort/filter view -- drives the pairing highlight. */
  pairedKeys: Set<string>;
  /** How many editing rows exist beyond `maxEditingRows` and so aren't in `entries` at all -- see `DataTable`'s own `maxEditingRows` doc. Zero in the common case. */
  truncatedCount: number;
  onSave: (key: string, values: T) => void;
  onCancel: (key: string) => void;
}

const ACTIONS_COLUMN_WIDTH = '8rem';

/**
 * The "edit co-grid" (issue #545) -- a second, small grid sharing the main
 * table's own `displayColumns` order/widths, consolidating every row
 * currently being edited (from ANY page/sort/filter) into one place. Kept
 * as its own component/file rather than folded into `DataTable.tsx`
 * (already ~2900 lines): unlike the main grid's rendering, this has a
 * small, genuinely self-contained dependency surface (columns, a width
 * getter, the schema, and a plain list of entries) and is entirely new
 * code, so extracting it carries none of the regression risk splitting up
 * the main grid's existing, deeply-entangled rendering would.
 *
 * **Not built on literal `<table>`/`<tr>`/`<td>` markup, deliberately.**
 * Each row needs its own `<Form>` wrapping that row's fields so `<Input>`/
 * `<FormField>` can reach it via context -- but `Form` renders a real
 * `<form>` element, and a `<form>` is not valid content inside a `<tr>`
 * (a browser's HTML parser foster-parents it right out, breaking the
 * layout silently). The fix is the standard one for exactly this shape of
 * constraint: plain `<div>`s styled with CSS `display: table`/`table-row`/
 * `table-cell` get the same column-alignment layout algorithm as a real
 * table without the tag-based content-model restriction (a `<form>`
 * wrapping `<div>`s is always valid HTML, regardless of their CSS
 * `display` value) -- with explicit `role="grid"`/`"row"`/`"gridcell"`/
 * `"columnheader"` added by hand, since a `<div>` gets none of those
 * roles implicitly the way a real table element would.
 *
 * Deliberately does NOT replicate the main grid's `position: sticky`
 * column-pinning offsets -- a pinned column here just renders in its
 * normal `displayColumns` position/width, unpinned. Pinning exists so a
 * column stays visible while scrolling a WIDE table; the co-grid isn't
 * expected to be wide or numerous enough for that to matter for a first
 * version, and reusing the main grid's sticky-offset machinery here would
 * mean either prop-drilling a large slice of `DataTable`'s own pinning
 * state or recomputing it a second time -- deferred as a disclosed,
 * deliberate scope trim, not an oversight.
 *
 * Animation: a dynamic list of independently-entering/exiting rows has no
 * single existing precedent in this codebase to reuse wholesale --
 * `useRowSetCrossFade.ts` cross-fades an ENTIRE table atomically on one
 * trigger-key change (density/page), a different shape of problem. This
 * instead follows the same real-completion-signal discipline that hook
 * and `DataTable.tsx`'s own empty-state entrance (a plain `ai-fade-in`,
 * confirmed safe on table-flow content there -- `transform`-based
 * animations are the ones with real cross-browser rendering quirks on
 * table content, not a plain opacity fade) already establish, via Radix's
 * own `Presence` (already used this way by `Drawer.tsx`): `rows` is a
 * local render-tracking map that gains a key the instant it appears in
 * `entries`, and only loses it once that row's own EXIT animation
 * genuinely finishes (its row `<div>`'s own `onAnimationEnd`) -- never the
 * instant it disappears from `entries`, which would unmount it before the
 * exit animation ever had a chance to play. `setState` during render (not
 * an effect) to detect a newly-arrived key mirrors `useRowSetCrossFade.ts`'s
 * own justified use of the identical pattern for the same reason: an
 * effect would cost an extra, visible render round-trip a plain state
 * clone from the KNOWN prop value doesn't need.
 */
export function EditCoGrid<T extends Record<string, any>>({
  tableId,
  columns,
  getColumnWidth,
  editSchema,
  entries,
  pairedKeys,
  truncatedCount,
  onSave,
  onCancel,
}: EditCoGridProps<T>) {
  const [rows, setRows] = useState<Map<string, EditCoGridEntry<T>>>(new Map());

  const currentKeys = new Set(entries.map(e => e.key));
  const missing = entries.filter(e => !rows.has(e.key));
  if (missing.length > 0) {
    const next = new Map(rows);
    missing.forEach(e => next.set(e.key, e));
    setRows(next);
  }

  const dropRow = (key: string) => {
    setRows(prev => {
      if (!prev.has(key)) return prev;
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  };

  if (rows.size === 0 && truncatedCount === 0) return null;

  const cellStyle: CSSProperties = {
    display: 'table-cell',
    padding: 'var(--ai-table-cell-padding, var(--ai-padding-sm, 0.5rem 1rem))',
    verticalAlign: 'top',
    boxSizing: 'border-box',
  };

  return (
    <div
      style={{
        // Mount-only entrance, matching the empty-state's own documented
        // reasoning: exit is already handled per-row above, so the outer
        // container disappearing the instant its last row's own exit
        // animation finishes is an acceptable, deliberate simplification
        // (same tradeoff DataTable.tsx's own empty-state entrance already
        // accepts for the identical structural reason).
        animation: 'ai-scale-in var(--ai-transition-duration-normal, 200ms) var(--ai-transition-easing, ease)',
        borderTop: '0.125rem solid var(--ai-color-quaternary, #a855f7)',
        background: 'var(--ai-bg-container, #f9fafb)',
      }}
    >
      {truncatedCount > 0 && (
        <div role="status" style={{ padding: 'var(--ai-padding-sm, 0.5rem 1rem)', fontSize: '0.8125rem', color: 'var(--ai-text-secondary, #6b7280)' }}>
          {`Showing ${rows.size} of ${rows.size + truncatedCount} rows being edited — save or cancel some to see the rest.`}
        </div>
      )}
      <div role="grid" aria-label="Rows being edited" style={{ display: 'table', width: '100%', tableLayout: 'fixed' }}>
        <div role="row" style={{ display: 'table-row' }}>
          {columns.map(col => (
            <div
              key={col.key}
              role="columnheader"
              style={{ ...cellStyle, width: `${getColumnWidth(col)}px`, textAlign: 'left', fontWeight: 'var(--ai-font-weight-semibold, 600)' }}
            >
              {col.title}
            </div>
          ))}
          <div role="columnheader" style={{ ...cellStyle, width: ACTIONS_COLUMN_WIDTH }} />
        </div>

        {Array.from(rows.entries()).map(([key, entry]) => {
          const present = currentKeys.has(key);
          const isPaired = pairedKeys.has(key);
          return (
            <Presence key={key} present={present}>
              <div
                role="row"
                onAnimationEnd={e => {
                  if (e.target === e.currentTarget && !present) dropRow(key);
                }}
                style={{
                  display: 'table-row',
                  animation: `${present ? 'ai-fade-in' : 'ai-fade-out'} var(--ai-transition-duration-normal, 200ms) var(--ai-transition-easing, ease)`,
                  boxShadow: isPaired ? 'inset 0.25rem 0 0 0 var(--ai-color-quaternary, #a855f7)' : 'none',
                  borderBottom: '0.0625rem solid var(--ai-border, #f3f4f6)',
                }}
              >
                <Form
                  id={`${tableId}-edit-${key}`}
                  schema={editSchema}
                  initialValues={entry.record}
                  onSubmit={values => onSave(key, values)}
                >
                  {columns.map(col => {
                    const value = col.accessorFn ? col.accessorFn(entry.record) : (entry.record as any)[col.key];
                    const context: CellContext<T> = {
                      value,
                      row: entry.record,
                      index: entry.index,
                      isEditing: true,
                      cancelEditingRow: () => onCancel(key),
                    };
                    return (
                      <div key={col.key} role="gridcell" style={{ ...cellStyle, width: `${getColumnWidth(col)}px` }}>
                        {col.editable === false
                          ? col.render
                            ? col.render(context)
                            : String(value ?? '')
                          : col.editEditor
                            ? col.editEditor(context)
                            : (
                              <FormField name={col.key}>
                                <Input />
                              </FormField>
                            )}
                      </div>
                    );
                  })}
                  <div role="gridcell" style={{ ...cellStyle, width: ACTIONS_COLUMN_WIDTH, display: 'flex', gap: '0.5rem' }}>
                    <SubmitButton>Save</SubmitButton>
                    <Button type="button" onClick={() => onCancel(key)}>
                      Cancel
                    </Button>
                  </div>
                </Form>
              </div>
            </Presence>
          );
        })}
      </div>
    </div>
  );
}
