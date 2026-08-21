import { type ThemeSlice } from './slice';

declare module './sliceStateMap' {
  interface ToolcribSliceStateMap {
    typography: Partial<TypographySliceState>;
  }
}

/** @barrelExport */
export type FontFamilyPreset = 'system' | 'serif' | 'monospace';

export interface TypographySliceState {
  fontFamily: FontFamilyPreset;
  /** Base font size in px — controls all rem-based scaling throughout the toolkit. */
  masterFontSize: number;
}

export interface TypographyCSSVariables extends Record<string, string> {
  '--ai-font-family': string;
  '--ai-master-font-size': string;
}

export const defaultTypographyState: TypographySliceState = {
  fontFamily: 'system',
  masterFontSize: 16,
};

// 'system' matches the stack the demo previously hardcoded directly in its
// own index.css, unconditionally — preserved here as the default so moving
// font-family into the theme system doesn't change anyone's default look.
const fontFamilyMap: Record<FontFamilyPreset, string> = {
  system: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif',
  serif: 'Georgia, Cambria, "Times New Roman", Times, serif',
  monospace: '"SF Mono", "Cascadia Code", "Fira Code", Consolas, "Courier New", monospace',
};

export function getTypographyVariables(state: TypographySliceState = defaultTypographyState): TypographyCSSVariables {
  return {
    '--ai-font-family': fontFamilyMap[state.fontFamily] || fontFamilyMap.system,
    '--ai-master-font-size': `${state.masterFontSize}px`,
  };
}

export const TypographyThemeSlice: ThemeSlice<TypographySliceState, TypographyCSSVariables> = {
  id: 'typography',
  name: '🔤 Typography (Font Family & Size)',
  category: 'Layout Primitives',
  defaultState: defaultTypographyState,
  getCSSVariables: getTypographyVariables,
  fieldVars: {
    fontFamily: ['--ai-font-family'],
    masterFontSize: ['--ai-master-font-size'],
  },
};
