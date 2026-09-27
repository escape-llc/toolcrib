import { type ThemeSlice } from '../../theme/slice';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    kbd: Partial<KbdSliceState>;
  }
}

/** @barrelExport */
export type KbdAppearance = 'raised' | 'flat';

export interface KbdSliceState {
  /** `'raised'` draws a thicker bottom edge, like a physical key cap; `'flat'` is an even hairline. */
  appearance: KbdAppearance;
}

export interface KbdCSSVariables extends Record<string, string> {
  '--ai-kbd-border-bottom-width': string;
}

export const defaultKbdState: KbdSliceState = {
  appearance: 'raised',
};

const BOTTOM_WIDTH: Record<KbdAppearance, string> = {
  raised: '0.125rem',
  flat: '0.0625rem',
};

export function getKbdVariables(state: KbdSliceState = defaultKbdState): KbdCSSVariables {
  return {
    '--ai-kbd-border-bottom-width': BOTTOM_WIDTH[state.appearance] ?? BOTTOM_WIDTH.raised,
  };
}

export const KbdThemeSlice: ThemeSlice<KbdSliceState, KbdCSSVariables> = {
  id: 'kbd',
  name: '⌨️ Keyboard Key Appearance',
  category: 'Data Display',
  defaultState: defaultKbdState,
  getCSSVariables: getKbdVariables,
  fieldVars: {
    appearance: ['--ai-kbd-border-bottom-width'],
  },
};
