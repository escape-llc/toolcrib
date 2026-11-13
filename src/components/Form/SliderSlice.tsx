import { type ThemeSlice } from '../../theme/slice';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    slider: Partial<SliderSliceState>;
  }
}

/** @barrelExport */
export type SliderTrackHeight = 'thin' | 'normal' | 'thick';
export type SliderThumbSize = 'sm' | 'md' | 'lg';
/**
 * `round`: the classic circular thumb. `cap`: a flat fader cap with a centre
 * line (a mixing-desk look) — narrower than it is tall across the track, so
 * the value reads from the line, not the centre of a circle.
 */
export type SliderThumbShape = 'round' | 'cap';

export interface SliderSliceState {
  trackHeight: SliderTrackHeight;
  thumbSize: SliderThumbSize;
  thumbShape: SliderThumbShape;
  /**
   * Draw a detent tick on the track at every `step` (only when the slider has
   * at most 32 steps, so a 0–100 slider stays clean). Pairs with `cap`.
   */
  detents: boolean;
}

export interface SliderCSSVariables extends Record<string, string> {
  '--ai-slider-track-height': string;
  '--ai-slider-thumb-size': string;
  /** Thumb box across / along the track (swapped for a vertical slider). */
  '--ai-slider-thumb-width': string;
  '--ai-slider-thumb-height': string;
  '--ai-slider-thumb-radius': string;
  /** Thumb face for a horizontal and a vertical slider (the cap's centre line runs across the track). */
  '--ai-slider-thumb-face': string;
  '--ai-slider-thumb-face-vertical': string;
  /** The detent tick colour, or `transparent` when detents are off. */
  '--ai-slider-detents': string;
}

export const defaultSliderState: SliderSliceState = {
  trackHeight: 'normal',
  thumbSize: 'md',
  thumbShape: 'round',
  detents: false,
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

const ROUND_FACE = 'var(--ai-bg-surface, #ffffff)';
// A brushed cap: light top edge, surface body, darker bottom — with a primary-coloured line through the middle.
const capFace = (angle: string) =>
  `linear-gradient(${angle}, var(--ai-color-primary, #3b82f6) 0 100%) center / ${angle === '90deg' ? '100% 0.125rem' : '0.125rem 100%'} no-repeat, ` +
  `linear-gradient(${angle === '90deg' ? '90deg' : '180deg'}, color-mix(in srgb, var(--ai-bg-surface, #ffffff) 80%, var(--ai-text-primary, #000000)) 0%, var(--ai-bg-surface, #ffffff) 45%, var(--ai-bg-container, #f3f4f6) 100%)`;

export function getSliderVariables(state: SliderSliceState = defaultSliderState): SliderCSSVariables {
  const size = thumbSizeMap[state.thumbSize] || thumbSizeMap.md;
  const cap = state.thumbShape === 'cap';
  return {
    '--ai-slider-track-height': trackHeightMap[state.trackHeight] || trackHeightMap.normal,
    '--ai-slider-thumb-size': size,
    '--ai-slider-thumb-width': cap ? `calc(${size} * 0.6)` : size,
    '--ai-slider-thumb-height': cap ? `calc(${size} * 1.2)` : size,
    '--ai-slider-thumb-radius': cap ? 'var(--ai-radius-sm, 0.25rem)' : '50%',
    '--ai-slider-thumb-face': cap ? capFace('180deg') : ROUND_FACE,
    '--ai-slider-thumb-face-vertical': cap ? capFace('90deg') : ROUND_FACE,
    '--ai-slider-detents': state.detents ? 'color-mix(in srgb, var(--ai-text-secondary, #6b7280) 75%, transparent)' : 'transparent',
  };
}

export const SliderThemeSlice: ThemeSlice<SliderSliceState, SliderCSSVariables> = {
  id: 'slider',
  name: '🎚️ Slider Track & Thumb',
  category: 'Form Controls',
  defaultState: defaultSliderState,
  getCSSVariables: getSliderVariables,
  fieldVars: {
    trackHeight: ['--ai-slider-track-height'],
    thumbSize: ['--ai-slider-thumb-size', '--ai-slider-thumb-width', '--ai-slider-thumb-height'],
    thumbShape: ['--ai-slider-thumb-width', '--ai-slider-thumb-height', '--ai-slider-thumb-radius', '--ai-slider-thumb-face', '--ai-slider-thumb-face-vertical'],
    detents: ['--ai-slider-detents'],
  },
};
