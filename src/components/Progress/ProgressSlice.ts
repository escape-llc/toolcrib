import { ThemeSlice } from '../../theme/slice';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    progress: Partial<ProgressSliceState>;
  }
}

/** @barrelExport */
export type ProgressTrackRadius = 'sharp' | 'rounded' | 'pill';

export interface ProgressSliceState {
  trackRadius: ProgressTrackRadius;
}

export interface ProgressCSSVariables extends Record<string, string> {
  '--ai-progress-radius': string;
}

export const defaultProgressState: ProgressSliceState = {
  trackRadius: 'pill',
};

const radiusMap: Record<ProgressTrackRadius, string> = {
  sharp: '0rem',
  rounded: 'var(--ai-radius-sm, 0.25rem)',
  pill: '0.625rem',
};

export function getProgressVariables(state: ProgressSliceState = defaultProgressState): ProgressCSSVariables {
  return {
    '--ai-progress-radius': radiusMap[state.trackRadius] || radiusMap.pill,
  };
}

export const ProgressThemeSlice: ThemeSlice<ProgressSliceState, ProgressCSSVariables> = {
  id: 'progress',
  name: '📶 Progress Bar Track Shape',
  category: 'Data Display',
  defaultState: defaultProgressState,
  getCSSVariables: getProgressVariables,
  fieldVars: {
    trackRadius: ['--ai-progress-radius'],
  },
};
