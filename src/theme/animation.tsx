import { type ThemeSlice } from './slice';
import { FieldRow } from '../components/ThemeEditor/ThemeEditorFieldRow';
import { Slider } from '../components/Form/Slider';

declare module './sliceStateMap' {
  interface ToolcribSliceStateMap {
    animation: Partial<AnimationSliceState>;
  }
}

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

/**
 * A transition that completes before a human can register it happening is
 * functionally identical to no transition at all — confirmed for real
 * against the focus ring's own fade (interactionStyles.ts): 120ms
 * (`snappy`'s own fast tier, before this floor existed) genuinely
 * interpolated the right values, sampled and verified, and was still
 * reported as invisible. `speed` alone can push any preset's fastest tier
 * well below that regardless of which preset is chosen — `snappy`/`subtle`
 * at `speed: 0.5` compute to 40–75ms, worse than the case that was already
 * too fast.
 *
 * Per-tier, not one shared floor: an earlier version used a single 150ms
 * floor for all three tiers, which meant the most extreme combination
 * (`snappy`, `speed: 0.5`) collapsed fast/normal/slow to the exact same
 * 150ms — defeating the actual point of having three tiers at all, not
 * just a rare edge case to shrug off. These three values are chosen to
 * stay clearly, individually distinguishable from each other (70–80ms
 * apart) even when every one of them is the floor doing the work, not the
 * preset's own math — confirmed this holds for every preset at `speed:
 * 0.5` (the actual worst case), not just asserted for the default.
 * Monotonically increasing floors applied to already-monotonically-
 * increasing raw values (every `baseDurations` entry has fast <= normal
 * <= slow, and multiplying by the same `speed` preserves that) can never
 * invert the ordering — each tier's floored result is still >= the tier
 * before it.
 *
 * Only applies in this function's "enabled" branch —
 * preset:'none'/reducedMotion:'always' still collapse to a real, honored
 * 0s below, since those are an explicit, deliberate request for no motion
 * at all, not a speed the floor should second-guess.
 */
const MIN_PERCEPTIBLE_DURATION_MS = { fast: 150, normal: 220, slow: 300 };

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

  const fastMs = Math.max(Math.round(base.fast * speed), MIN_PERCEPTIBLE_DURATION_MS.fast);
  const normalMs = Math.max(Math.round(base.normal * speed), MIN_PERCEPTIBLE_DURATION_MS.normal);
  const slowMs = Math.max(Math.round(base.slow * speed), MIN_PERCEPTIBLE_DURATION_MS.slow);

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
  category: 'Layout Primitives',
  defaultState: defaultAnimationState,
  getCSSVariables: getAnimationVariables,
  renderEditorControl: (state, onChange) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Transition Physics Preset"
        tooltip="Configures global easing curves and transition durations across all components"
        value={state.preset}
        onChange={val => onChange({ ...state, preset: val as AnimationPreset })}
        options={[
          { label: 'Smooth (Standard Easing Curve)', value: 'smooth' },
          { label: 'Spring (Elastic Bouncy Physics)', value: 'spring' },
          { label: 'Snappy (Fast Responsive Curves)', value: 'snappy' },
          { label: 'Subtle (Gentle Slow Fades)', value: 'subtle' },
          { label: 'None (Instant 0s Transitions)', value: 'none' },
        ]}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', fontWeight: 'var(--ai-font-weight-semibold, 600)' }}>
          <span>Motion Duration Factor</span>
          <span>{state.speed}x</span>
        </div>
        <Slider
          value={Math.round(state.speed * 100)}
          min={50}
          max={200}
          step={25}
          onChange={val => onChange({ ...state, speed: val / 100 })}
        />
      </div>
    </div>
  ),
};
