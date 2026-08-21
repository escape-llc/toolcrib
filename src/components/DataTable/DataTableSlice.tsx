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

export interface TableSliceState {
  density: TableDensity;
  borderStyle: TableBorderStyle;
  striped: boolean;
}

export function getTableVariables(state: TableSliceState): Record<string, string> {
  let cellPadding: string;
  let headerPadding: string;
  let rowHeight: string;

  switch (state.density) {
    case 'compact':
      cellPadding = '0.375rem 0.625rem';
      headerPadding = '0.5rem 0.625rem';
      rowHeight = '2.25rem';
      break;
    case 'spacious':
      cellPadding = '0.875rem 1.25rem';
      headerPadding = '1rem 1.25rem';
      rowHeight = '3.5rem';
      break;
    case 'normal':
    default:
      cellPadding = 'var(--ai-padding-sm, 0.625rem 1rem)';
      headerPadding = 'var(--ai-padding-md, 0.75rem 1rem)';
      rowHeight = '2.75rem';
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
          { label: 'Compact (2.25rem Row Height & Tight Cell Padding)', value: 'compact' },
          { label: 'Normal (2.75rem Row Height & Standard Cell Padding)', value: 'normal' },
          { label: 'Spacious (3.5rem Row Height & Generous Cell Padding)', value: 'spacious' },
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
