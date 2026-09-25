import { type ThemeSlice } from '../../theme/slice';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    slider: Partial<SliderSliceState>;
  }
}

/** @barrelExport */
export type SliderTrackHeight = 'thin' | 'normal' | 'thick';
export type SliderThumbSize = 'sm' | 'md' | 'lg';

export interface SliderSliceState {
  trackHeight: SliderTrackHeight;
  thumbSize: SliderThumbSize;
}

export interface SliderCSSVariables extends Record<string, string> {
  '--ai-slider-track-height': string;
  '--ai-slider-thumb-size': string;
}

export const defaultSliderState: SliderSliceState = {
  trackHeight: 'normal',
  thumbSize: 'md',
};

const trackHeightMap: Record<SliderTrackHeight, string> = {
  thin: '0.25rem',
  normal: '0.375rem',
  thick: '0.5rem',
};

const thumbSizeMap: Record<SliderThumbSize, string> = {
  sm: '0.875rem',
  md: '1.125rem',
  lg: '1.375rem',
};

export function getSliderVariables(state: SliderSliceState = defaultSliderState): SliderCSSVariables {
  return {
    '--ai-slider-track-height': trackHeightMap[state.trackHeight] || trackHeightMap.normal,
    '--ai-slider-thumb-size': thumbSizeMap[state.thumbSize] || thumbSizeMap.md,
  };
}

export const SliderThemeSlice: ThemeSlice<SliderSliceState, SliderCSSVariables> = {
  id: 'slider',
  name: '🎚️ Slider Track & Thumb Size',
  category: 'Form Controls',
  defaultState: defaultSliderState,
  getCSSVariables: getSliderVariables,
  fieldVars: {
    trackHeight: ['--ai-slider-track-height'],
    thumbSize: ['--ai-slider-thumb-size'],
  },
};
