import { type ThemeSlice } from '../../theme/slice';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    stepper: Partial<StepperSliceState>;
  }
}

/** @barrelExport */
export type StepperSize = 'sm' | 'md' | 'lg';

export type StepperTransition = 'slide' | 'fade' | 'none';

export interface StepperSliceState {
  size: StepperSize;
  /** How a step's content enters: sliding in from the direction of travel, fading, or not at all. */
  stepTransition: StepperTransition;
}

export interface StepperCSSVariables extends Record<string, string> {
  '--ai-stepper-indicator-size': string;
  '--ai-stepper-font-size': string;
  '--ai-stepper-enter-forward': string;
  '--ai-stepper-enter-backward': string;
}

export const defaultStepperState: StepperSliceState = {
  size: 'md',
  stepTransition: 'slide',
};

const TIMING = 'var(--ai-transition-duration-normal, 0.22s) var(--ai-transition-easing, ease)';
// Forward (Next) enters from the right, Back from the left. The slide
// keyframes are injected by Stepper.tsx; ai-fade-in is global.
const transitionMap: Record<StepperTransition, { forward: string; backward: string }> = {
  slide: { forward: `ai-stepper-slide-from-right ${TIMING}`, backward: `ai-stepper-slide-from-left ${TIMING}` },
  fade: { forward: `ai-fade-in ${TIMING}`, backward: `ai-fade-in ${TIMING}` },
  none: { forward: 'none', backward: 'none' },
};

const sizeMap: Record<StepperSize, { indicator: string; font: string }> = {
  sm: { indicator: '1.5rem', font: '0.75rem' },
  md: { indicator: '1.875rem', font: '0.875rem' },
  lg: { indicator: '2.25rem', font: '1rem' },
};

export function getStepperVariables(state: StepperSliceState = defaultStepperState): StepperCSSVariables {
  const values = sizeMap[state.size] || sizeMap.md;
  const transition = transitionMap[state.stepTransition] ?? transitionMap.slide;
  return {
    '--ai-stepper-indicator-size': values.indicator,
    '--ai-stepper-font-size': values.font,
    '--ai-stepper-enter-forward': transition.forward,
    '--ai-stepper-enter-backward': transition.backward,
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
    stepTransition: ['--ai-stepper-enter-forward', '--ai-stepper-enter-backward'],
  },
};
