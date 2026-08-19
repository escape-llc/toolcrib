import { ThemeSlice } from '../../theme/slice';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    datepicker: Partial<DatePickerSliceState>;
  }
}

/** @barrelExport */
export type DatePickerCellSize = 'sm' | 'md' | 'lg';

export interface DatePickerSliceState {
  cellSize: DatePickerCellSize;
}

export interface DatePickerCSSVariables extends Record<string, string> {
  '--ai-datepicker-cell-size': string;
  '--ai-datepicker-popover-padding': string;
}

export const defaultDatePickerState: DatePickerSliceState = {
  cellSize: 'md',
};

const cellSizeMap: Record<DatePickerCellSize, { cell: string; padding: string }> = {
  sm: { cell: '1.75rem', padding: '0.5rem' },
  md: { cell: '2.25rem', padding: '0.75rem' },
  lg: { cell: '2.75rem', padding: '1rem' },
};

export function getDatePickerVariables(state: DatePickerSliceState = defaultDatePickerState): DatePickerCSSVariables {
  const values = cellSizeMap[state.cellSize] || cellSizeMap.md;
  return {
    '--ai-datepicker-cell-size': values.cell,
    '--ai-datepicker-popover-padding': values.padding,
  };
}

export const DatePickerThemeSlice: ThemeSlice<DatePickerSliceState, DatePickerCSSVariables> = {
  id: 'datepicker',
  name: '📅 Date Picker Grid Cell Size',
  category: 'Form Controls',
  defaultState: defaultDatePickerState,
  getCSSVariables: getDatePickerVariables,
  fieldVars: {
    cellSize: ['--ai-datepicker-cell-size', '--ai-datepicker-popover-padding'],
  },
};
