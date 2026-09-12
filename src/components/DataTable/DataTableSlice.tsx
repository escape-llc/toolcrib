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
 * Every non-normal density is `normal`'s own baseline metrics scaled by one
 * number, not an independently hand-picked literal -- retuning the whole
 * scale (or how tight `compact` feels relative to `normal`) is one
 * multiplier change here instead of separately-drifting row-height/padding
 * literals per density. `normal` itself is always exactly 1 (it IS the
 * baseline every other density scales from), kept in the map anyway so a
 * lookup never needs a special case for it.
 */
const DENSITY_MULTIPLIER: Record<TableDensity, number> = {
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

function scalePx(basePx: number, density: TableDensity): number {
  return Math.round(basePx * DENSITY_MULTIPLIER[density]);
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
 * the density's own padding/row-height CSS actually renders.
 */
export const DENSITY_ROW_HEIGHT_PX: Record<TableDensity, number> = {
  compact: scalePx(NORMAL_ROW_HEIGHT_PX, 'compact'),
  normal: NORMAL_ROW_HEIGHT_PX,
  spacious: scalePx(NORMAL_ROW_HEIGHT_PX, 'spacious'),
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
      cellPadding = `${pxToRem(scalePx(cv, state.density))} ${pxToRem(scalePx(ch, state.density))}`;
      headerPadding = `${pxToRem(scalePx(hv, state.density))} ${pxToRem(scalePx(hh, state.density))}`;
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
