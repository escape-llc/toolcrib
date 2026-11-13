import { type ThemeSlice } from '../../theme/slice';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    vumeter: Partial<VuMeterSliceState>;
  }
}

export interface VuMeterSliceState {
  /** Multiplier on the scale's height: 1 is the thin original, 3 is chunky. */
  thickness: number;
}

export interface VuMeterCSSVariables extends Record<string, string> {
  '--ai-vumeter-thickness': string;
}

export const VUMETER_THICKNESS_MIN = 1;
export const VUMETER_THICKNESS_MAX = 3;

export const defaultVuMeterState: VuMeterSliceState = {
  thickness: 1.75,
};

export function getVuMeterVariables(state: VuMeterSliceState = defaultVuMeterState): VuMeterCSSVariables {
  const t = Number.isFinite(state.thickness) ? state.thickness : defaultVuMeterState.thickness;
  return {
    '--ai-vumeter-thickness': String(Math.min(VUMETER_THICKNESS_MAX, Math.max(VUMETER_THICKNESS_MIN, t))),
  };
}

export const VuMeterThemeSlice: ThemeSlice<VuMeterSliceState, VuMeterCSSVariables> = {
  id: 'vumeter',
  name: '🎚️ VU Meter Thickness',
  category: 'Data Display',
  defaultState: defaultVuMeterState,
  getCSSVariables: getVuMeterVariables,
  fieldVars: {
    thickness: ['--ai-vumeter-thickness'],
  },
};
