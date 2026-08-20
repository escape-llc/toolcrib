import { type ThemeSlice } from './slice';

/** @barrelExport */
export type ShadowMode = 'none' | 'subtle' | 'elevated' | 'glass';

export function getShadowVariables(mode: ShadowMode = 'subtle'): Record<string, string> {
  switch (mode) {
    case 'none':
      return {
        '--ai-shadow-sm': 'none',
        '--ai-shadow-md': 'none',
        '--ai-shadow-lg': 'none',
      };
    case 'elevated':
      return {
        '--ai-shadow-sm': '0 0.125rem 0.375rem rgba(0, 0, 0, 0.12)',
        '--ai-shadow-md': '0 0.5rem 1.25rem -0.25rem rgba(0, 0, 0, 0.2)',
        '--ai-shadow-lg': '0 1rem 2.5rem -0.5rem rgba(0, 0, 0, 0.28)',
      };
    case 'glass':
      return {
        '--ai-shadow-sm': '0 0.25rem 0.75rem rgba(31, 38, 135, 0.07)',
        '--ai-shadow-md': '0 0.5rem 2rem 0 rgba(31, 38, 135, 0.15)',
        '--ai-shadow-lg': '0 1.25rem 3rem 0 rgba(31, 38, 135, 0.25)',
      };
    case 'subtle':
    default:
      return {
        '--ai-shadow-sm': '0 0.0625rem 0.125rem rgba(0, 0, 0, 0.05)',
        '--ai-shadow-md': '0 0.25rem 0.75rem -0.125rem rgba(0, 0, 0, 0.1)',
        '--ai-shadow-lg': '0 0.75rem 1.5rem -0.25rem rgba(0, 0, 0, 0.15)',
      };
  }
}

export function resolveShadow(
  shadowModeProp?: ShadowMode,
  size: 'sm' | 'md' | 'lg' = 'md'
): string {
  if (shadowModeProp) {
    const vars = getShadowVariables(shadowModeProp);
    const key = `--ai-shadow-${size}` as keyof typeof vars;
    return vars[key];
  }
  return `var(--ai-shadow-${size})`;
}

export const ShadowThemeSlice: ThemeSlice<ShadowMode> = {
  id: 'shadow',
  name: 'Elevation & Shadow Depth',
  category: 'Layout Primitives',
  defaultState: 'subtle',
  getCSSVariables: (mode) => getShadowVariables(mode),
};
