import { type ThemeSlice } from '../../theme/slice';
import { FieldRow } from '../ThemeEditor/ThemeEditorFieldRow';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    table: Partial<TableSliceState>;
  }
}

/** @barrelExport */
export type TableDensity = 'compact' | 'normal' | 'spacious';
export type TableBorderStyle = 'grid' | 'horizontal' | 'none';

/**
 * `compact`/`spacious` scale `normal`'s own baseline padding by one number
 * each, not an independently hand-picked literal -- retuning how tight
 * `compact` feels relative to `normal` is one multiplier change here
 * instead of a separately-drifting padding literal. This is deliberately
 * a SEPARATE multiplier from `DENSITY_ROW_HEIGHT_MULTIPLIER` below, not
 * one shared number applied to both -- see that constant's own comment
 * for why coupling them was a real, Gemini-caught bug on this PR's first
 * pass. `normal` itself is always exactly 1 (it IS the baseline every
 * other density scales from), kept in the map anyway so a lookup never
 * needs a special case for it.
 */
const DENSITY_PADDING_MULTIPLIER: Record<TableDensity, number> = {
  compact: 0.4,
  normal: 1,
  spacious: 1.3,
};

/**
 * `compact`/`spacious` scale `normal`'s own 44px row height by one number
 * each. This PR's first pass applied this SAME multiplier to padding too
 * (a single shared `DENSITY_MULTIPLIER`), which produced a real layout
 * bug Gemini's review caught: `compact`'s 0.65x gave a 29px row height but
 * only shrank vertical padding to 7px/side (14px total) -- 29 - 14 = 15px
 * left for content, less than a 14px-font/1.5-line-height cell's real
 * ~21px line box, so text would visibly clip. Row height and padding
 * don't actually scale together at a fixed font-size: padding can shrink
 * as aggressively as the density wants, but row height is structurally
 * bounded below by `TEXT_LINE_HEIGHT_PX + 2 * verticalPaddingPx` regardless
 * of what any multiplier says -- see `getTableVariables`'s own `Math.max`
 * against that floor, which is what actually enforces this, not just this
 * comment. Splitting the multiplier in two is what let `compact`'s padding
 * shrink far enough (0.4x here) to reach the tight row height originally
 * wanted (29px) WITHOUT the floor ever needing to override it -- the floor
 * stays a real safety net for any future retuning, not the thing doing
 * the tightening today.
 */
const DENSITY_ROW_HEIGHT_MULTIPLIER: Record<TableDensity, number> = {
  compact: 0.65,
  normal: 1,
  spacious: 1.3,
};

/**
 * `normal` density's own baseline metrics in px, at this codebase's assumed
 * 16px root font-size -- the same assumption `<DataTable>`'s `itemHeight`
 * default already makes (issue #339). Cell/header padding are `[vertical,
 * horizontal]` pairs. `NORMAL_ROW_HEIGHT_PX` doubles as `normal`'s own
 * entry in `DENSITY_ROW_HEIGHT_PX` below.
 */
const NORMAL_ROW_HEIGHT_PX = 44;
const NORMAL_CELL_PADDING_PX: readonly [number, number] = [10, 16]; // 0.625rem 1rem
const NORMAL_HEADER_PADDING_PX: readonly [number, number] = [12, 16]; // 0.75rem 1rem

/**
 * DataTable cell text renders at a fixed `0.875rem` (14px) regardless of
 * density -- only padding/row-height change -- so every density's row
 * height must fit this SAME line box, at this codebase's default
 * `--ai-line-height` of `1.5` (`theme/typography.tsx`'s own
 * `baseLineHeight` default): `14 * 1.5 = 21px`. The real minimum, not a
 * static-fallback assumption the way `itemHeight`'s 16px-root assumption
 * is -- a consumer who changes the global line-height theme control could
 * still, in principle, need a taller floor than this, but this at least
 * guards the default/common case that broke in this PR's first pass.
 */
const TEXT_LINE_HEIGHT_PX = 21;
/**
 * A deliberate few px of slack ABOVE the bare `TEXT_LINE_HEIGHT_PX` math --
 * an exact zero-slack fit is one sub-pixel rounding difference or font-
 * metric quirk away from clipping again on some browser/font combination,
 * so the floor below targets "comfortably fits," not "fits exactly."
 */
const CONTENT_VERTICAL_SAFETY_PX = 2;

function scalePaddingPx(basePx: number, density: TableDensity): number {
  return Math.round(basePx * DENSITY_PADDING_MULTIPLIER[density]);
}
function pxToRem(px: number): string {
  return `${px / 16}rem`;
}

/**
 * Each density's real row height in pixels -- the single source of truth
 * `getTableVariables`'s own `--ai-table-row-height` (a `rem` string) derives
 * from below, and the same values `<DataTable>` uses for its default
 * `itemHeight` (issue #339). Kept as a JS-readable px map, not just a CSS
 * variable, specifically so virtualization math (which needs a real number,
 * not a string a browser resolves) can never independently drift from what
 * the density's own padding/row-height CSS actually renders. Never below
 * `TEXT_LINE_HEIGHT_PX + 2 * verticalCellPaddingPx` for that density (see
 * `DENSITY_ROW_HEIGHT_MULTIPLIER`'s own comment) -- a real content-clipping
 * bug otherwise, not just a cosmetic one.
 */
export const DENSITY_ROW_HEIGHT_PX: Record<TableDensity, number> = {
  compact: Math.max(
    Math.round(NORMAL_ROW_HEIGHT_PX * DENSITY_ROW_HEIGHT_MULTIPLIER.compact),
    TEXT_LINE_HEIGHT_PX + CONTENT_VERTICAL_SAFETY_PX + 2 * scalePaddingPx(NORMAL_CELL_PADDING_PX[0], 'compact')
  ),
  normal: NORMAL_ROW_HEIGHT_PX,
  spacious: Math.max(
    Math.round(NORMAL_ROW_HEIGHT_PX * DENSITY_ROW_HEIGHT_MULTIPLIER.spacious),
    TEXT_LINE_HEIGHT_PX + CONTENT_VERTICAL_SAFETY_PX + 2 * scalePaddingPx(NORMAL_CELL_PADDING_PX[0], 'spacious')
  ),
};

/**
 * The `<thead>`'s own real height in pixels -- needed by `<DataTable>`'s
 * `computeAutoPageSize` (`defaultPageSize="auto"`) to subtract the sticky
 * header's own space from the measured body container before dividing by
 * `itemHeight`, since a sticky header is still a normal-flow child of that
 * same scrollable box. Computed the same way `DENSITY_ROW_HEIGHT_PX` itself
 * is -- text line-height plus this density's own scaled header padding --
 * deliberately NOT a live `ResizeObserver` measurement: an earlier version
 * measured `<thead>` live and caused a real, confirmed infinite-render-loop
 * crash, because the resulting height fed back into `effectivePageSize`,
 * which feeds `<DataTable>`'s own `resetKey`, which remounts the row set on
 * change -- a measure -> pageSize change -> remount -> re-measure cycle the
 * instant a freshly-measured height differed from the previous one by even
 * a sub-pixel. The header's real height has no legitimate reason to depend
 * on row count/pageSize at all (only column-title text + density-scaled
 * padding), so computing it algebraically sidesteps that feedback path
 * structurally instead of trying to dampen it.
 */
export const DENSITY_HEADER_HEIGHT_PX: Record<TableDensity, number> = {
  compact: TEXT_LINE_HEIGHT_PX + 2 * scalePaddingPx(NORMAL_HEADER_PADDING_PX[0], 'compact'),
  normal: TEXT_LINE_HEIGHT_PX + 2 * scalePaddingPx(NORMAL_HEADER_PADDING_PX[0], 'normal'),
  spacious: TEXT_LINE_HEIGHT_PX + 2 * scalePaddingPx(NORMAL_HEADER_PADDING_PX[0], 'spacious'),
};

/**
 * `rowCommands`' own per-row action buttons (`<DataTable>`'s trailing
 * actions column) were a FIXED `1.75rem` (28px) at every density -- never
 * scaled down the way cell padding/row height already are. Reported
 * directly, with a screenshot: switching to `defaultPageSize="auto"` at
 * `density="compact"` showed a real, live vertical scrollbar even though
 * "Auto" is supposed to compute an exact-fit page size. Root cause,
 * confirmed by measuring real rendered cells in a live browser (not just
 * read from source): at `compact`, `DENSITY_ROW_HEIGHT_PX.compact` (31px)
 * minus its own real vertical cell padding (2 * 4px = 8px) leaves only
 * 23px of content budget per cell -- but the row-commands column's action
 * buttons still rendered at their fixed 28px, forcing every row with
 * `rowCommands` to actually render ~6px taller than its own declared
 * `itemHeight`. `computeAutoPageSize` (`DataTable.tsx`) has no way to know
 * that -- it multiplies the DECLARED `itemHeight` by a row count to decide
 * how many rows fit, so real rows silently running taller than that,
 * accumulated across every visible row, is exactly what overflowed the
 * container and produced the scrollbar. This wasn't compact-specific in
 * principle (the same fixed 28px also exceeds `normal`'s own budget once
 * its real padding is subtracted -- `44 - 2*10 = 24px < 28px`), just far
 * enough under compact's much tighter budget, AND compact fits more rows
 * per given height in the first place, for the accumulated overflow to
 * actually cross the threshold into a visible scrollbar.
 *
 * Derived the same way `DENSITY_ROW_HEIGHT_PX` itself avoids drifting
 * out of sync with its own floor -- computed FROM that density's real
 * budget (`Math.min` against the historical 28px target), not a second,
 * independently-hand-picked number that could silently fall out of sync
 * with it again. The `- 2` is a small deliberate safety margin, the same
 * reasoning `CONTENT_VERTICAL_SAFETY_PX` above already uses for text.
 */
const ROW_COMMAND_BUTTON_TARGET_PX = 28;
export const DENSITY_ROW_COMMAND_BUTTON_PX: Record<TableDensity, number> = {
  compact: Math.min(ROW_COMMAND_BUTTON_TARGET_PX, DENSITY_ROW_HEIGHT_PX.compact - 2 * scalePaddingPx(NORMAL_CELL_PADDING_PX[0], 'compact') - 2),
  normal: Math.min(ROW_COMMAND_BUTTON_TARGET_PX, DENSITY_ROW_HEIGHT_PX.normal - 2 * scalePaddingPx(NORMAL_CELL_PADDING_PX[0], 'normal') - 2),
  spacious: Math.min(ROW_COMMAND_BUTTON_TARGET_PX, DENSITY_ROW_HEIGHT_PX.spacious - 2 * scalePaddingPx(NORMAL_CELL_PADDING_PX[0], 'spacious') - 2),
};

export interface TableSliceState {
  density: TableDensity;
  borderStyle: TableBorderStyle;
  striped: boolean;
}

export function getTableVariables(state: TableSliceState): Record<string, string> {
  let cellPadding: string;
  let headerPadding: string;
  const rowHeight = pxToRem(DENSITY_ROW_HEIGHT_PX[state.density]);

  switch (state.density) {
    case 'compact':
    case 'spacious': {
      const [cv, ch] = NORMAL_CELL_PADDING_PX;
      const [hv, hh] = NORMAL_HEADER_PADDING_PX;
      cellPadding = `${pxToRem(scalePaddingPx(cv, state.density))} ${pxToRem(scalePaddingPx(ch, state.density))}`;
      headerPadding = `${pxToRem(scalePaddingPx(hv, state.density))} ${pxToRem(scalePaddingPx(hh, state.density))}`;
      break;
    }
    case 'normal':
    default:
      // Sourced from the live theme token, not NORMAL_CELL_PADDING_PX --
      // normal density stays reactive to a global --ai-padding-sm/-md
      // theme change; compact/spacious scale off the token's OWN fallback
      // numbers instead (the same static-fallback limitation itemHeight's
      // 16px-root assumption already documents), since there's no way to
      // read a live CSS custom property's value back out in JS here.
      cellPadding = 'var(--ai-padding-sm, 0.625rem 1rem)';
      headerPadding = 'var(--ai-padding-md, 0.75rem 1rem)';
      break;
  }

  let borderCss: string;
  switch (state.borderStyle) {
    case 'grid':
      borderCss = '0.0625rem solid var(--ai-border, #e5e7eb)';
      break;
    case 'none':
      borderCss = 'none';
      break;
    case 'horizontal':
    default:
      borderCss = '0.0625rem solid var(--ai-border, #e5e7eb)';
      break;
  }

  return {
    '--ai-table-cell-padding': cellPadding,
    '--ai-table-header-padding': headerPadding,
    '--ai-table-row-height': rowHeight,
    '--ai-table-border': borderCss,
    '--ai-table-stripe-bg': state.striped ? 'var(--ai-bg-container, #f9fafb)' : 'transparent',
  };
}

export const DataTableThemeSlice: ThemeSlice<TableSliceState> = {
  id: 'table',
  name: 'Data Table Layout & Cell Density',
  category: 'Data Display',
  defaultState: {
    density: 'normal',
    borderStyle: 'horizontal',
    striped: true,
  },
  getCSSVariables: (state) => getTableVariables(state),
  renderEditorControl: (state, onChange) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Table Cell Density"
        tooltip="Configures padding and row height across all Data Table instances"
        value={state.density}
        onChange={val => onChange({ ...state, density: val as TableDensity })}
        options={[
          { label: `Compact (${DENSITY_ROW_HEIGHT_PX.compact / 16}rem Row Height & Tight Cell Padding)`, value: 'compact' },
          { label: `Normal (${DENSITY_ROW_HEIGHT_PX.normal / 16}rem Row Height & Standard Cell Padding)`, value: 'normal' },
          { label: `Spacious (${DENSITY_ROW_HEIGHT_PX.spacious / 16}rem Row Height & Generous Cell Padding)`, value: 'spacious' },
        ]}
      />
      <FieldRow
        label="Grid Border Lines"
        value={state.borderStyle}
        onChange={val => onChange({ ...state, borderStyle: val as TableBorderStyle })}
        options={[
          { label: 'Horizontal Rows Only', value: 'horizontal' },
          { label: 'Full Grid Borders', value: 'grid' },
          { label: 'No Borders (Borderless)', value: 'none' },
        ]}
      />
    </div>
  ),
  fieldVars: {
    density: ['--ai-table-cell-padding', '--ai-table-header-padding', '--ai-table-row-height'],
    borderStyle: ['--ai-table-border'],
    striped: ['--ai-table-stripe-bg'],
  },
};
