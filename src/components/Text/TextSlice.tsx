import { type ThemeSlice } from '../../theme/slice';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    text: Partial<TextSliceState>;
  }
}

/** @barrelExport */
export type TextSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
/** @barrelExport */
export type TextScale = 'compact' | 'normal' | 'large';

export interface TextSliceState {
  /** How big the whole `<Text>` size ramp runs, relative to the master font size. */
  scale: TextScale;
}

export interface TextCSSVariables extends Record<string, string> {
  '--ai-text-size-xs': string;
  '--ai-text-size-sm': string;
  '--ai-text-size-md': string;
  '--ai-text-size-lg': string;
  '--ai-text-size-xl': string;
  '--ai-text-font-mono': string;
}

export const defaultTextState: TextSliceState = {
  scale: 'normal',
};

// rem, so the whole ramp already tracks the Typography slice's master font
// size; `scale` only stretches or tightens the ramp around it. The 'normal'
// steps are the sizes the demo had been hand-typing (0.75/0.8125/0.875rem
// secondary text, 1rem body).
const SIZE_REM: Record<TextSize, number> = { xs: 0.75, sm: 0.8125, md: 0.875, lg: 1, xl: 1.125 };
const SCALE_FACTOR: Record<TextScale, number> = { compact: 0.9, normal: 1, large: 1.125 };

const MONO_FAMILY = '"SF Mono", "Cascadia Code", "Fira Code", Consolas, "Courier New", monospace';

export function getTextVariables(state: TextSliceState = defaultTextState): TextCSSVariables {
  const factor = SCALE_FACTOR[state.scale] ?? 1;
  const size = (s: TextSize) => `${+(SIZE_REM[s] * factor).toFixed(4)}rem`;
  return {
    '--ai-text-size-xs': size('xs'),
    '--ai-text-size-sm': size('sm'),
    '--ai-text-size-md': size('md'),
    '--ai-text-size-lg': size('lg'),
    '--ai-text-size-xl': size('xl'),
    '--ai-text-font-mono': MONO_FAMILY,
  };
}

/** Fallback for each size's CSS variable, so `<Text>` sizes correctly outside a mounted provider. */
export const TEXT_SIZE_FALLBACK: Record<TextSize, string> = {
  xs: `${SIZE_REM.xs}rem`,
  sm: `${SIZE_REM.sm}rem`,
  md: `${SIZE_REM.md}rem`,
  lg: `${SIZE_REM.lg}rem`,
  xl: `${SIZE_REM.xl}rem`,
};

export const TEXT_MONO_FALLBACK = MONO_FAMILY;

export const TextThemeSlice: ThemeSlice<TextSliceState, TextCSSVariables> = {
  id: 'text',
  name: '🔡 Text Size Ramp',
  category: 'Layout Primitives',
  defaultState: defaultTextState,
  getCSSVariables: getTextVariables,
  fieldVars: {
    scale: ['--ai-text-size-xs', '--ai-text-size-sm', '--ai-text-size-md', '--ai-text-size-lg', '--ai-text-size-xl'],
  },
};
