import { type ThemeSlice } from '../../theme/slice';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    stepper: Partial<StepperSliceState>;
  }
}

/** @barrelExport */
export type StepperSize = 'sm' | 'md' | 'lg';

export interface StepperSliceState {
  size: StepperSize;
}

export interface StepperCSSVariables extends Record<string, string> {
  '--ai-stepper-indicator-size': string;
  '--ai-stepper-font-size': string;
}

export const defaultStepperState: StepperSliceState = {
  size: 'md',
};

const sizeMap: Record<StepperSize, { indicator: string; font: string }> = {
  sm: { indicator: '1.5rem', font: '0.75rem' },
  md: { indicator: '1.875rem', font: '0.875rem' },
  lg: { indicator: '2.25rem', font: '1rem' },
};

export function getStepperVariables(state: StepperSliceState = defaultStepperState): StepperCSSVariables {
  const values = sizeMap[state.size] || sizeMap.md;
  return {
    '--ai-stepper-indicator-size': values.indicator,
    '--ai-stepper-font-size': values.font,
  };
}

export const StepperThemeSlice: ThemeSlice<StepperSliceState, StepperCSSVariables> = {
  id: 'stepper',
  name: '🔢 Stepper Indicator Size',
  category: 'Data Display',
  defaultState: defaultStepperState,
  getCSSVariables: getStepperVariables,
  fieldVars: {
    size: ['--ai-stepper-indicator-size', '--ai-stepper-font-size'],
  },
};
