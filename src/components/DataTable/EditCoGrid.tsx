'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Presence } from '@radix-ui/react-presence';
import type { ZodType } from 'zod';
import { Form, useFormContext } from '../Form/FormContext';
import { FormField, Input } from '../Form/FormComponents';
import { VisuallyHidden } from '../Layout/VisuallyHidden';
import { Z_INDEX } from '../../theme/zIndex';
import { useAIEvent } from '../../eventBus/useAIEvent';
import type { Column, CellContext } from './DataTable';

/**
 * Runs `fn` exactly once, on this component's real unmount -- whatever the
 * cause (Presence keeping it mounted through a genuinely-playing exit
 * animation in a real browser, or removing it immediately because no
 * animation is actually running). A ref holds the latest `fn` so the
 * cleanup itself doesn't need to be an effect dependency. Shared by both
 * `EditCoGridRow` and the co-grid's own outer container below -- each
 * needs the identical "tell my parent I'm actually gone now" contract.
 */
function useUnmountEffect(fn: () => void) {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);
  useEffect(() => {
    return () => fnRef.current();
  }, []);
}

/**
 * Renders nothing -- exists purely so a plain DOM wrapper (which can't
 * itself call hooks) gets a real "I was just unmounted" signal via a child
 * that can. See the co-grid container's own use below.
 */
function OnUnmount({ fn }: { fn: () => void }) {
  useUnmountEffect(fn);
  return null;
}

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

// Glyph-only Save/Reset/Cancel (direct visual feedback: text buttons
// here read as "horrible" placement/space) need far less room than the
// text buttons this used to fit. Widened from 72 (Save/Cancel only) to
// fit a third ~23px glyph button (Reset) plus its own gap.
const ACTIONS_COLUMN_WIDTH = 104;
const GLYPH_BUTTON_PX = 23;

const glyphButtonStyle: CSSProperties = {
  border: 'none',
  padding: 0,
  font: 'inherit',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: `${GLYPH_BUTTON_PX}px`,
  height: `${GLYPH_BUTTON_PX}px`,
  borderRadius: 'var(--ai-radius-sm, 0.25rem)',
  cursor: 'pointer',
  fontSize: '0.875rem',
};

/**
 * Discards in-progress changes back to the row's original values
 * WITHOUT closing the edit form -- direct feedback ("add third edit
 * command to reset to initial values"), distinct from Cancel (which
 * both discards AND exits edit mode). Reuses `Form`'s own `resetForm`
 * (FormContext.tsx) rather than reimplementing "clear every field back
 * to entry.record" by hand. Must be a child rendered INSIDE `<Form>` --
 * `useFormContext` only resolves within that provider, which is why
 * this is its own small component rather than a plain button call site
 * in `EditCoGridRow` (a sibling of `<Form>`'s own return, not a
 * descendant of it).
 */
function ResetEditRowButton() {
  const { resetForm } = useFormContext();
  return (
    <button
      type="button"
      aria-label="Reset"
      title="Reset"
      className="ai-btn ai-focus-ring"
      style={{
        ...glyphButtonStyle,
        background: 'transparent',
        color: 'var(--ai-text-secondary, #6b7280)',
      }}
      onClick={resetForm}
    >
      <span aria-hidden="true">↺</span>
    </button>
  );
}

/**
 * Save, disabled while this row's own form is currently invalid --
 * direct feedback ("the apply button is not disabled while the zod
 * form is invalid"). `handleSubmit` (FormContext.tsx) already REFUSES
 * to call `onSave` on invalid data -- clicking this while invalid was
 * always a safe no-op, just a misleading one with no visual signal.
 *
 * Tracks validity via the event bus (`form:validated`), not a direct
 * `useFormContext().errors` read -- direct feedback ("that should all
 * be on the event bus" / "data table validation should go on the
 * event bus"), and it's also just the correct source: `errors` is
 * lazily computed (only set by setFieldValue/validateField/
 * handleSubmit, never eagerly on mount), so `form:validated`'s own
 * `isValid` -- emitted by every one of those exact same call sites --
 * is the same information Form already surfaces on the bus for this
 * purpose, rather than re-deriving it a second way. Starts `true`
 * (matches this same lazy-validation convention elsewhere: a
 * brand-new row with nothing touched yet isn't shown as invalid until
 * a real validation pass actually runs).
 */
function SaveEditRowButton({ formId }: { formId: string }) {
  const [isValid, setIsValid] = useState(true);
  useAIEvent('form:validated', payload => {
    if (payload.formId === formId) setIsValid(payload.isValid);
  });
  return (
    <button
      type="submit"
      aria-label="Save"
      title="Save"
      disabled={!isValid}
      className="ai-btn ai-focus-ring"
      style={{
        ...glyphButtonStyle,
        // Green, not primary blue -- direct visual feedback ("I want
        // green/red for apply/cancel"), reusing this toolkit's own
        // semantic success/error subtheme tokens rather than a one-off
        // literal color.
        background: 'var(--ai-subtheme-success, #22c55e)',
        color: 'var(--ai-subtheme-success-on-main, #ffffff)',
        cursor: isValid ? 'pointer' : 'not-allowed',
        opacity: isValid ? 1 : 0.5,
      }}
    >
      <span aria-hidden="true">✓</span>
    </button>
  );
}

const cellStyle: CSSProperties = {
  display: 'table-cell',
  // A small, fixed value -- NOT `--ai-table-cell-padding` (the main
  // grid's own density-driven padding). Direct visual feedback ("way too
  // much space between edit rows ... it must be compact"): the co-grid
  // is a dense list of full edit forms, not a browsing grid, so it stays
  // tight regardless of whatever density the main grid happens to be set
  // to, rather than growing/shrinking with it. This is the resolution to
  // an earlier open question (whether editing should get its own,
  // separate density) -- always compact, not a second density knob to
  // expose.
  padding: '0.375rem 1rem',
  // 'middle', not 'top' -- direct visual feedback ("the non-edit is not
  // aligned vertically"). A plain read-only value (col.render's own text,
  // no FormField wrapper at all) and an <Input>/<Select>'s own taller,
  // padded/bordered box both being TOP-aligned in the same cell left their
  // actual text baselines mismatched, since only the input-based cells
  // carry that extra box height. Middle-aligning each cell's content
  // against the row's real height (set by the tallest cell, i.e. the
  // input-based ones) centers a plain text value at the same visual
  // height as an input's own vertically-centered text.
  verticalAlign: 'middle',
  boxSizing: 'border-box',
};

// Direct visual feedback ("compress the edit header height") -- the
// header row doesn't need the body rows' own roomy vertical padding
// (sized for a real <Input>'s box height), just enough to read
// comfortably. NOT `--ai-table-header-padding` -- checked its real
// per-density values in DataTableSlice.tsx first: that variable is
// deliberately LARGER than `--ai-table-cell-padding` at every density
// (0.75rem vs 0.625rem at 'normal', e.g.), since the main grid's own
// header needs a bit more breathing room above body rows. Using it here
// would make this header BIGGER, the opposite of what was asked. A
// fixed, deliberately small value instead -- this header's plain text
// has no interactive touch-target that needs to grow with density the
// way the body rows' real <Input>s do.
const headerCellStyle: CSSProperties = {
  ...cellStyle,
  padding: 'var(--ai-padding-xs, 0.25rem) 1rem',
};

// `FormField` (Form/FormComponents.tsx) always applies its own fixed
// `marginBottom` (`var(--ai-margin-gap, 0.875rem)`), sized for a
// standalone form's own vertical rhythm -- inside this compact co-grid
// that reads as real wasted space between rows (direct visual feedback:
// "way too much space between edit rows"). FormField has no
// style/className passthrough to override it directly (this toolkit's
// own "no component accepts style/className" rule), so this cancels it
// from OUTSIDE instead: `overflow: hidden` contains the child's
// escaping bottom margin inside this wrapper's own box (rather than
// letting it collapse through to the wrapper's own siblings), then the
// wrapper's matching NEGATIVE marginBottom pulls that same amount back
// off the wrapper's own contribution to the row's total height. A
// field's real validation-error message (when one is actually showing)
// is untouched by this -- it renders BEFORE FormField's own trailing
// margin, so its own height still counts normally either way.
const CANCEL_FORM_FIELD_MARGIN_STYLE: CSSProperties = {
  overflow: 'hidden',
  marginBottom: 'calc(-1 * var(--ai-margin-gap, 0.875rem))',
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
  isPaired: boolean;
  columns: Column<T>[];
  getColumnWidth: (col: Column<T>) => number;
  editSchema: ZodType<T>;
  onSave: (key: string, values: T) => void;
  onCancel: (key: string) => void;
  onGone: () => void;
}) {
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
  useUnmountEffect(onGone);

  // Autofocus the first real field the instant this row's own edit form
  // mounts -- direct feedback: clicking rowCommands' "Edit" trigger left
  // focus stranded on that now-hidden button instead of moving into the
  // co-grid row it just created. Scoped to this row's own subtree (via
  // rootRef, not the whole co-grid) and mount-only (empty deps): this is
  // "this row just started being edited," not "this row re-rendered."
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    rootRef.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
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
          contexts. The row's own enter/exit animation lives on the plain
          `<div>` wrapping THIS component in EditCoGrid's own render loop,
          not here -- Presence needs a real DOM node for its ref, and
          `EditCoGridRow` (like `Form` itself) is a plain function
          component that can't receive one; `rootRef` above is a
          SEPARATE, purely-internal ref used only for the focus query. */}
      <div ref={rootRef} style={TABLE_UNIT_STYLE}>
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
                      // CANCEL_FORM_FIELD_MARGIN_STYLE wrapper: see its own
                      // comment -- FormField's fixed marginBottom read as
                      // real wasted space in this compact context.
                      <div style={CANCEL_FORM_FIELD_MARGIN_STYLE}>
                        <FormField name={col.key} label={<VisuallyHidden>{col.title}</VisuallyHidden>}>
                          <Input />
                        </FormField>
                      </div>
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
          {/* zIndex needed, confirmed by this codebase's own precedent --
              the main grid's getPinnedCellStyle sets one for its own
              pinned columns for the identical reason: a sticky cell with
              no elevated z-index can lose the paint order to an adjacent
              scrolling cell during simultaneous horizontal scroll,
              letting scrolled-under content render on top of it.
              `background: 'transparent'`, not an opaque fill -- direct
              visual feedback ("I want transparent behind the buttons"):
              an opaque white/gray fill here read as a separate panel
              stapled onto the row rather than part of it. Accepted
              trade-off: during horizontal scroll, the last data column's
              content can now briefly show through beneath the buttons
              instead of being fully occluded -- a real but minor cost
              against the "stark white box" look this replaces. */}
          <div style={{ ...cellStyle, width: `${ACTIONS_COLUMN_WIDTH}px`, position: 'sticky', right: 0, zIndex: Z_INDEX.STICKY, background: 'transparent' }}>
            <div style={{ display: 'flex', gap: '0.375rem' }}>
              {/* Glyph-only, not text "Save"/"Cancel" -- direct visual
                  feedback ("placement of save/cancel is horrible; go with
                  glyphs to take up less space"). Plain native buttons, not
                  SubmitButton/Button: SubmitButton always renders literal
                  "Save"/"Submitting..." text alongside any icon (its own
                  hardcoded `props.children || 'Submit'` fallback), which
                  can't be suppressed by an icon-only usage -- a real
                  constraint of that shared component, not a style choice
                  to route around here. `type="submit"` alone (a plain
                  button inside this row's own <Form>) is enough to
                  trigger the same real submission -- SubmitButton's own
                  extra value (isSubmitting-driven disable) is a small,
                  deliberately accepted trade-off for a form this synchronous. */}
              <SaveEditRowButton formId={`${tableId}-edit-${key}`} />
              {/* Reset (discard-in-place) sits between Save and Cancel --
                  a neutral middle ground between "commit" and "discard
                  AND close." */}
              <ResetEditRowButton />
              <button
                type="button"
                aria-label="Cancel"
                title="Cancel"
                className="ai-btn ai-focus-ring"
                style={{
                  ...glyphButtonStyle,
                  // Red, not transparent/secondary -- direct visual
                  // feedback ("I want green/red for apply/cancel"), same
                  // semantic-subtheme convention as Save's green above.
                  background: 'var(--ai-subtheme-error, #ef4444)',
                  color: 'var(--ai-subtheme-error-on-main, #ffffff)',
                }}
                onClick={() => onCancel(key)}
              >
                <span aria-hidden="true">✕</span>
              </button>
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

  const shouldShow = rows.size > 0 || truncatedCount > 0;
  // setState-during-render (mirrors the `missing` block's own established
  // idiom just above), NOT an effect -- an effect would cost an extra,
  // visible render round-trip a plain state clone from the KNOWN
  // `shouldShow` value doesn't need. Only ever flips true here; flipping
  // back to false happens exclusively via the container's own real
  // unmount below (`OnUnmount`), once its exit animation has actually
  // had the chance to play, not the instant `shouldShow` itself goes
  // false.
  const [everShown, setEverShown] = useState(shouldShow);
  if (shouldShow && !everShown) setEverShown(true);

  // Nothing to render, and nothing exiting either -- the true "return
  // null" case (both `rows` and `truncatedCount` empty, and no exit
  // animation currently in flight).
  if (!everShown) return null;

  return (
    // Presence needs a real DOM node for its ref, same reason
    // `EditCoGridRow`'s own row-level animation lives on a plain `<div>`
    // in the `.map()` below rather than on that component directly --
    // this outer container is a real, direct-child `<div>`, matching
    // `Drawer.tsx`'s own established Presence usage.
    <Presence present={shouldShow}>
      <div
        role="region"
        aria-label="Rows being edited"
        style={{
        // Direct visual feedback ("no exit transitions ... on the co-grid
        // itself") -- previously mount-only entrance with no exit story
        // at all; the container just vanished the instant `shouldShow`
        // went false. `OnUnmount` below (paired with `everShown` above)
        // is what keeps this container actually rendered long enough for
        // the exit animation to play in a real browser, the same
        // present-vs-actually-gone split `EditCoGridRow` already uses.
        animation: `${shouldShow ? 'ai-scale-in' : 'ai-fade-out'} var(--ai-transition-duration-normal, 200ms) var(--ai-transition-easing, ease)`,
        borderTop: '0.125rem solid var(--ai-color-quaternary, #a855f7)',
        background: 'var(--ai-bg-container, #f9fafb)',
        // Fixed viewport-relative cap, deliberately NOT derived from any
        // measured sibling -- editing many rows (bounded by
        // maxEditingRows) shouldn't push the rest of the page down by
        // thousands of pixels just because nothing capped this
        // container's own height, but capping it against the main
        // grid's own measured `observedHeight` (a real, shipped version
        // of this) created a genuine infinite resize loop, confirmed live
        // via the demo's own event-bus monitor (element:resized firing
        // repeatedly, alternating between two heights): this co-grid and
        // the main grid's own scrollable body are siblings sharing one
        // flex-column parent inside DataTable's own layout, so the
        // co-grid growing shrinks the main body, which shrinks
        // `observedHeight`, which shrinks THIS cap, which can flip
        // whether the co-grid needs to scroll internally, which changes
        // its own rendered footprint, which changes how much room the
        // main body gets back -- a closed loop with no reason to ever
        // converge. `50vh` has no dependency on any React-measured value
        // at all (resolved by the browser's own layout engine directly),
        // which is what actually breaks the cycle, not a smaller
        // measured number or a debounce that would only slow it down.
        maxHeight: '50vh',
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
      {/* Runs `setEverShown(false)` on this container's real unmount --
          the counterpart to `everShown` above. Renders nothing itself;
          it's a plain child purely so the surrounding `<div>` (which
          can't call hooks directly) gets a real lifecycle signal. */}
      <OnUnmount fn={() => setEverShown(false)} />

      {truncatedCount > 0 && (
        <div role="status" style={{ padding: 'var(--ai-padding-sm, 0.5rem 1rem)', fontSize: '0.8125rem', color: 'var(--ai-text-secondary, #6b7280)' }}>
          {`Showing ${rows.size} of ${rows.size + truncatedCount} rows being edited — save or cancel some to see the rest.`}
        </div>
      )}

      {/* The header is its OWN independent display:table, same reasoning
          as each row -- see EditCoGridRow's own comment. Using the exact
          same literal getColumnWidth px values as every row is what keeps
          the columns visually aligned across these separate contexts.
          headerCellStyle, not cellStyle -- direct visual feedback
          ("compress the edit header height"). */}
      <div style={TABLE_UNIT_STYLE}>
        <div style={{ display: 'table-row' }}>
          {columns.map(col => (
            <div key={col.key} style={{ ...headerCellStyle, width: `${getColumnWidth(col)}px`, textAlign: 'left', fontWeight: 'var(--ai-font-weight-semibold, 600)' }}>
              {col.title}
            </div>
          ))}
          <div style={{ ...headerCellStyle, width: `${ACTIONS_COLUMN_WIDTH}px`, position: 'sticky', right: 0, zIndex: Z_INDEX.STICKY, background: 'transparent' }} />
        </div>
      </div>

      {Array.from(rows.entries()).map(([key, entry]) => {
        const present = currentKeys.has(key);
        return (
          // Presence's DIRECT child must be a real DOM node it can attach
          // a ref to -- a plain `<div>` here, not `EditCoGridRow` itself
          // (a function component, same constraint as `Form`). The
          // enter/exit animation lives on THIS div; `EditCoGridRow` no
          // longer takes a `present` prop at all, since it no longer
          // renders any animation of its own.
          <Presence key={key} present={present}>
            <div style={{ animation: `${present ? 'ai-fade-in' : 'ai-fade-out'} var(--ai-transition-duration-normal, 200ms) var(--ai-transition-easing, ease)` }}>
              <EditCoGridRow
                tableId={tableId}
                entry={entry}
                isPaired={pairedKeys.has(key)}
                columns={columns}
                getColumnWidth={getColumnWidth}
                editSchema={editSchema}
                onSave={onSave}
                onCancel={onCancel}
                onGone={() => dropRow(key)}
              />
            </div>
          </Presence>
        );
      })}
      </div>
    </Presence>
  );
}
