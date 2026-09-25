import { type ThemeSlice } from './slice';

declare module './sliceStateMap' {
  interface ToolcribSliceStateMap {
    livingColor: Partial<LivingColorSliceState>;
  }
}

/** @barrelExport */
export type LivingColorEnabled = 'on' | 'off';

export interface LivingColorSliceState {
  enabled: LivingColorEnabled;
  /** Seconds per full breathe/pulse cycle. */
  duration: number;
}

export interface LivingColorCSSVariables extends Record<string, string> {
  '--ai-living-color-duration': string;
  '--ai-living-color-easing': string;
}

export const defaultLivingColorState: LivingColorSliceState = {
  enabled: 'on',
  duration: 6,
};

/**
 * Deliberately mints its own `--ai-living-color-*` scale rather than
 * reusing `--ai-transition-*` — that scale is documented (animationKeyframes.ts)
 * as tuned for 100-500ms discrete state transitions, not multi-second
 * ambient loops, and this codebase has a real, twice-independently-occurring
 * bug class from treating an already-complete `--ai-transition-*` shorthand
 * string as if it were a bare duration to concatenate into.
 */
export function getLivingColorVariables(
  state: LivingColorSliceState = defaultLivingColorState
): LivingColorCSSVariables {
  const { enabled, duration } = state;

  if (enabled === 'off') {
    // Same early-return idiom as getAnimationVariables's preset:'none'
    // branch: 0s/linear makes the keyframe cycle instantaneous/invisible
    // without needing a second gating variable or JS add/remove-class logic.
    return {
      '--ai-living-color-duration': '0s',
      '--ai-living-color-easing': 'linear',
    };
  }

  return {
    '--ai-living-color-duration': `${duration}s`,
    '--ai-living-color-easing': 'ease-in-out',
  };
}

export const LivingColorThemeSlice: ThemeSlice<LivingColorSliceState, LivingColorCSSVariables> = {
  id: 'livingColor',
  name: '🌊 Living Color (Ambient Breathe & Glow)',
  category: 'Layout Primitives',
  defaultState: defaultLivingColorState,
  getCSSVariables: getLivingColorVariables,
};
