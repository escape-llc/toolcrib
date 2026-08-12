import { ThemeSlice } from './slice';

/** @barrelExport */
export type AnimationPreset = 'none' | 'subtle' | 'smooth' | 'snappy' | 'spring';
export type ReducedMotionOption = 'auto' | 'always' | 'never';

export interface AnimationSliceState {
  preset: AnimationPreset;
  speed: number; // 0.5 (fast) to 2.0 (slow)
  enableHoverEffects: boolean;
  reducedMotion: ReducedMotionOption;
}

export interface AnimationCSSVariables extends Record<string, string> {
  '--ai-transition-duration-fast': string;
  '--ai-transition-duration-normal': string;
  '--ai-transition-duration-slow': string;
  '--ai-transition-easing': string;
  '--ai-transition-fast': string;
  '--ai-transition-normal': string;
  '--ai-transition-slow': string;
  '--ai-hover-transform': string;
  '--ai-active-transform': string;
  '--ai-hover-shadow': string;
}

export const defaultAnimationState: AnimationSliceState = {
  preset: 'smooth',
  speed: 1.0,
  enableHoverEffects: true,
  reducedMotion: 'auto',
};

const easingMap: Record<AnimationPreset, string> = {
  none: 'linear',
  subtle: 'cubic-bezier(0.4, 0, 0.6, 1)',
  smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
  snappy: 'cubic-bezier(0, 0, 0.2, 1)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
};

const baseDurations: Record<AnimationPreset, { fast: number; normal: number; slow: number }> = {
  none: { fast: 0, normal: 0, slow: 0 },
  subtle: { fast: 100, normal: 150, slow: 250 },
  smooth: { fast: 120, normal: 220, slow: 380 },
  snappy: { fast: 80, normal: 160, slow: 280 },
  spring: { fast: 150, normal: 300, slow: 500 },
};

export function getAnimationVariables(state: AnimationSliceState = defaultAnimationState): AnimationCSSVariables {
  const { preset, speed, enableHoverEffects, reducedMotion } = state;

  if (preset === 'none' || reducedMotion === 'always') {
    return {
      '--ai-transition-duration-fast': '0s',
      '--ai-transition-duration-normal': '0s',
      '--ai-transition-duration-slow': '0s',
      '--ai-transition-easing': 'linear',
      '--ai-transition-fast': 'none',
      '--ai-transition-normal': 'none',
      '--ai-transition-slow': 'none',
      '--ai-hover-transform': 'none',
      '--ai-active-transform': 'none',
      '--ai-hover-shadow': 'none',
    };
  }

  const base = baseDurations[preset] || baseDurations.smooth;
  const easing = easingMap[preset] || easingMap.smooth;

  const fastMs = Math.round(base.fast * speed);
  const normalMs = Math.round(base.normal * speed);
  const slowMs = Math.round(base.slow * speed);

  const durFast = `${fastMs}ms`;
  const durNormal = `${normalMs}ms`;
  const durSlow = `${slowMs}ms`;

  const transitionFast = `all ${durFast} ${easing}`;
  const transitionNormal = `all ${durNormal} ${easing}`;
  const transitionSlow = `all ${durSlow} ${easing}`;

  const hoverTransform = enableHoverEffects ? 'translateY(-0.125rem) scale(1.01)' : 'none';
  const activeTransform = enableHoverEffects ? 'scale(0.98)' : 'none';
  const hoverShadow = enableHoverEffects ? '0 0.5rem 1rem -0.25rem rgba(0, 0, 0, 0.12)' : 'none';

  return {
    '--ai-transition-duration-fast': durFast,
    '--ai-transition-duration-normal': durNormal,
    '--ai-transition-duration-slow': durSlow,
    '--ai-transition-easing': easing,
    '--ai-transition-fast': transitionFast,
    '--ai-transition-normal': transitionNormal,
    '--ai-transition-slow': transitionSlow,
    '--ai-hover-transform': hoverTransform,
    '--ai-active-transform': activeTransform,
    '--ai-hover-shadow': hoverShadow,
  };
}

export const AnimationThemeSlice: ThemeSlice<AnimationSliceState, AnimationCSSVariables> = {
  id: 'animation',
  name: '✨ Motion, Transitions & Micro-Animations',
  defaultState: defaultAnimationState,
  getCSSVariables: getAnimationVariables,
};
