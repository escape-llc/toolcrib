'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Presence } from '@radix-ui/react-presence';
import type { ZodType } from 'zod';
import { Form } from '../Form/FormContext';
import { FormField, Input, SubmitButton, Button } from '../Form/FormComponents';
import { VisuallyHidden } from '../Layout/VisuallyHidden';
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
  /**
   * The main grid's own real, measured viewport height in px (`DataTable.tsx`'s
   * `observedHeight`, the same value its own auto-page-size/auto-height
   * features already measure via `useAdaptiveSize(bodyRef)`) -- reused
   * directly rather than a second measurement. The co-grid can grow up to
   * this much of the grid's own on-screen real estate before it starts
   * scrolling internally, so editing many rows (up to `maxEditingRows`)
   * doesn't push the rest of the page down by thousands of pixels.
   */
  viewportHeight: number;
  onSave: (key: string, values: T) => void;
  onCancel: (key: string) => void;
}

// 160, not the original 128 -- confirmed by actually rendering it and
// measuring: two default-sized buttons ("Save" + "Cancel") plus their
// gap need ~140px, so 128 let the flex content overflow past its own
// (correctly sticky-pinned) cell's right edge -- the cell itself was
// positioned correctly, but its content wasn't constrained to fit it.
const ACTIONS_COLUMN_WIDTH = 160;

const cellStyle: CSSProperties = {
  display: 'table-cell',
  padding: 'var(--ai-table-cell-padding, var(--ai-padding-sm, 0.5rem 1rem))',
  verticalAlign: 'top',
  boxSizing: 'border-box',
};

/**
 * The `display: table` wrapper shared between the header and every row --
 * see `EditCoGrid`'s own header comment for why each is its own
 * independent table context rather than one literal table shared across
 * all of them.
 */
const TABLE_UNIT_STYLE: CSSProperties = { display: 'table', width: '100%', tableLayout: 'fixed' };

/**
 * One editing row -- extracted specifically so its cleanup can run via a
 * real `useEffect` (React hooks can't live inside the `.map()` this used
 * to be inlined in). See `EditCoGrid`'s own header comment for why this
 * component's unmount (not an `onAnimationEnd` handler) is what tells the
 * parent to actually forget this row.
 */
function EditCoGridRow<T extends Record<string, any>>({
  tableId,
  entry,
  present,
  isPaired,
  columns,
  getColumnWidth,
  editSchema,
  onSave,
  onCancel,
  onGone,
}: {
  tableId: string;
  entry: EditCoGridEntry<T>;
  present: boolean;
  isPaired: boolean;
  columns: Column<T>[];
  getColumnWidth: (col: Column<T>) => number;
  editSchema: ZodType<T>;
  onSave: (key: string, values: T) => void;
  onCancel: (key: string) => void;
  onGone: () => void;
}) {
  // Saved-callback ref (matches useAIEvent's/useRowSetCrossFade's own
  // established idiom in this codebase) so the cleanup below can call
  // whatever the LATEST onGone is without needing to be an effect
  // dependency itself.
  const onGoneRef = useRef(onGone);
  useEffect(() => {
    onGoneRef.current = onGone;
  }, [onGone]);
  // Fires on this row's REAL unmount, whatever the cause -- Presence
  // keeping it mounted through a genuinely-playing exit animation in a
  // real browser, or removing it immediately because no animation is
  // actually running (reduced motion, or jsdom, which never runs one at
  // all). Deliberately not an `onAnimationEnd` handler: that event never
  // fires under either of those conditions, which is exactly the real,
  // Gemini-flagged leak (a phantom entry staying in the parent's tracking
  // map forever, keeping the whole co-grid container rendered with
  // nothing real inside it). Tying cleanup to the component's own actual
  // removal from the tree, rather than to a specific DOM event, is
  // correct regardless of why or how fast that removal happens.
  useEffect(() => {
    return () => onGoneRef.current();
  }, []);

  const key = entry.key;
  return (
    <Form id={`${tableId}-edit-${key}`} schema={editSchema} initialValues={entry.record} onSubmit={values => onSave(key, values)}>
      {/* Own, independent `display: table` per row (and the header has its
          own too, below) -- NOT one shared table spanning header+rows.
          `<Form>` renders a real `<form>`, and `<form>` can't itself carry
          the `display: table-row` role a shared table's row would need
          (Form has no style-passthrough API, by this toolkit's own "no
          component accepts style/className" rule) -- if `<form>` sat
          directly inside a `display: table-row` ancestor, CSS's anonymous-
          table-object generation would wrap `<form>` in one anonymous
          cell and everything inside it in a SECOND anonymous table,
          collapsing every column into one cell (a real bug, caught by
          Gemini's review of this exact file). Making `<form>` the parent
          of its own self-contained table sidesteps the rule entirely:
          `<form>` is never itself part of any table formatting context,
          so nothing anonymous ever gets generated. Every row (and the
          header) using the SAME literal `getColumnWidth` px values is
          what keeps them visually aligned despite being separate table
          contexts. */}
      <div
        style={{
          ...TABLE_UNIT_STYLE,
          animation: `${present ? 'ai-fade-in' : 'ai-fade-out'} var(--ai-transition-duration-normal, 200ms) var(--ai-transition-easing, ease)`,
        }}
      >
        <div
          style={{
            display: 'table-row',
            boxShadow: isPaired ? 'inset 0.25rem 0 0 0 var(--ai-color-quaternary, #a855f7)' : 'none',
            borderBottom: '0.0625rem solid var(--ai-border, #f3f4f6)',
          }}
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
              <div key={col.key} style={{ ...cellStyle, width: `${getColumnWidth(col)}px` }}>
                {col.editable === false
                  ? col.render
                    ? col.render(context)
                    : String(value ?? '')
                  : col.editEditor
                    ? col.editEditor(context)
                    : (
                      // VisuallyHidden, not a plain string -- the co-grid's
                      // own header row above already shows this column's
                      // title visually; a real <label> is still needed
                      // for the field's accessible name (the fix for
                      // Gemini's ARIA finding), just not a second visible
                      // copy of text that's already on screen.
                      <FormField name={col.key} label={<VisuallyHidden>{col.title}</VisuallyHidden>}>
                        <Input />
                      </FormField>
                    )}
              </div>
            );
          })}
          {/* Pinned to the scroll container's own right edge (mirrors the
              main grid's `pinned: 'right'` column convention) -- the
              actions column is EXTRA width the main grid never has to
              budget for (see the outer container's own overflowX
              comment), so without this, Save/Cancel would only be
              reachable by scrolling a wide row all the way right, found
              by actually clicking through this in a real browser rather
              than assumed. Stays a real display:table-cell (the inner div
              carries the flex layout instead) -- overriding THIS cell's
              own display would desync it from the header's identical
              placeholder cell, which stays a plain table-cell. */}
          <div style={{ ...cellStyle, width: `${ACTIONS_COLUMN_WIDTH}px`, position: 'sticky', right: 0, background: 'var(--ai-bg-surface, #ffffff)' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <SubmitButton size="sm">Save</SubmitButton>
              <Button size="sm" type="button" onClick={() => onCancel(key)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Form>
  );
}

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
 * **Not built on literal `<table>`/`<tr>`/`<td>` markup, and NOT using
 * ARIA grid/row/gridcell/columnheader roles either -- both deliberate.**
 * Each row needs its own `<Form>` wrapping that row's fields so `<Input>`/
 * `<FormField>` can reach it via context. `Form` renders a real `<form>`
 * element, which rules out literal `<tr>`/`<td>` (a `<form>` inside a
 * `<tr>` is invalid content a browser's parser foster-parents right out)
 * -- CSS `display: table*` on plain `<div>`s gets the same column-
 * alignment layout without that tag-based restriction. It also rules out
 * `role="grid"`/`"row"`/`"gridcell"`: the WAI-ARIA grid pattern requires a
 * row's direct children to be cell roles, but `<Form>` (which itself
 * carries an implicit "form" role, and which this toolkit's components
 * have no way to strip a role from, since none accept arbitrary
 * attribute passthrough) would sit between them regardless of the CSS
 * fix above -- see `EditCoGridRow`'s own comment for the concrete
 * structure this settled on. Rather than fake a grid widget this doesn't
 * behave like anyway (no arrow-key navigation between cells, unlike the
 * main table), each field gets a real `<FormField>` accessible label
 * (visually hidden, since the co-grid's own header row already shows it
 * on screen) -- the honest, correct accessibility story for "a series of
 * edit forms," not a grid.
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
 * instead uses Radix's own `Presence` (already used this way by
 * `Drawer.tsx`) per row: `rows` is a local render-tracking map that gains
 * a key the instant it appears in `entries`, and only loses it once that
 * row's OWN COMPONENT actually unmounts (see `EditCoGridRow`'s `onGone`)
 * -- not the instant it disappears from `entries`, which would remove it
 * before Presence ever got a chance to play its exit animation in a real
 * browser. `setState` during render (not an effect) to detect a
 * newly-arrived key mirrors `useRowSetCrossFade.ts`'s own justified use
 * of the identical pattern for the same reason: an effect would cost an
 * extra, visible render round-trip a plain state clone from the KNOWN
 * prop value doesn't need.
 */
export function EditCoGrid<T extends Record<string, any>>({
  tableId,
  columns,
  getColumnWidth,
  editSchema,
  entries,
  pairedKeys,
  truncatedCount,
  viewportHeight,
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

  return (
    <div
      role="region"
      aria-label="Rows being edited"
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
        // Can grow up to the main grid's own real viewport height before
        // scrolling internally -- editing many rows (bounded by
        // maxEditingRows) shouldn't push the rest of the page down by
        // thousands of pixels just because nothing capped this container's
        // own height. Sized off the SAME measurement DataTable.tsx's own
        // auto-height/auto-page-size features already take
        // (useAdaptiveSize(bodyRef)), not a second one.
        maxHeight: `${viewportHeight}px`,
        overflowY: 'auto',
        // Real, screenshot-caught bug: each row is systematically WIDER
        // than the main grid's own row by the actions column's width
        // (ACTIONS_COLUMN_WIDTH, below) -- the main grid never has to
        // budget for a Save/Cancel column at all. Without this, that
        // extra width just clips invisibly off the right edge (Cancel's
        // own button was cut off mid-render) rather than being reachable.
        overflowX: 'auto',
      }}
    >
      {truncatedCount > 0 && (
        <div role="status" style={{ padding: 'var(--ai-padding-sm, 0.5rem 1rem)', fontSize: '0.8125rem', color: 'var(--ai-text-secondary, #6b7280)' }}>
          {`Showing ${rows.size} of ${rows.size + truncatedCount} rows being edited — save or cancel some to see the rest.`}
        </div>
      )}

      {/* The header is its OWN independent display:table, same reasoning
          as each row -- see EditCoGridRow's own comment. Using the exact
          same literal getColumnWidth px values as every row is what keeps
          the columns visually aligned across these separate contexts. */}
      <div style={TABLE_UNIT_STYLE}>
        <div style={{ display: 'table-row' }}>
          {columns.map(col => (
            <div key={col.key} style={{ ...cellStyle, width: `${getColumnWidth(col)}px`, textAlign: 'left', fontWeight: 'var(--ai-font-weight-semibold, 600)' }}>
              {col.title}
            </div>
          ))}
          <div style={{ ...cellStyle, width: `${ACTIONS_COLUMN_WIDTH}px`, position: 'sticky', right: 0, background: 'var(--ai-bg-container, #f9fafb)' }} />
        </div>
      </div>

      {Array.from(rows.entries()).map(([key, entry]) => (
        <Presence key={key} present={currentKeys.has(key)}>
          <EditCoGridRow
            tableId={tableId}
            entry={entry}
            present={currentKeys.has(key)}
            isPaired={pairedKeys.has(key)}
            columns={columns}
            getColumnWidth={getColumnWidth}
            editSchema={editSchema}
            onSave={onSave}
            onCancel={onCancel}
            onGone={() => dropRow(key)}
          />
        </Presence>
      ))}
    </div>
  );
}
