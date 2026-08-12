/** @barrelExport */
export type PaddingMode = 'compact' | 'normal' | 'spacious';

export function getPaddingVariables(mode: PaddingMode = 'normal'): Record<string, string> {
  switch (mode) {
    case 'compact':
      return {
        '--ai-padding-xs': '0.125rem',
        '--ai-padding-sm': '0.25rem 0.5rem',
        '--ai-padding-md': '0.375rem 0.75rem',
        '--ai-padding-lg': '0.5rem 1rem',
        '--ai-padding-xl': '0.75rem 1.25rem',
      };
    case 'spacious':
      return {
        '--ai-padding-xs': '0.375rem',
        '--ai-padding-sm': '0.625rem 1rem',
        '--ai-padding-md': '0.875rem 1.375rem',
        '--ai-padding-lg': '1.25rem 1.75rem',
        '--ai-padding-xl': '1.75rem 2.25rem',
      };
    case 'normal':
    default:
      return {
        '--ai-padding-xs': '0.25rem',
        '--ai-padding-sm': '0.375rem 0.75rem',
        '--ai-padding-md': '0.5rem 1rem',
        '--ai-padding-lg': '0.75rem 1.25rem',
        '--ai-padding-xl': '1rem 1.5rem',
      };
  }
}

/**
 * Resolves component padding in rem units.
 * If paddingModeProp is provided, returns explicit rem padding overriding global setting.
 * Otherwise returns CSS variable for automatic theme mode scaling.
 */
export function resolvePadding(
  paddingModeProp?: PaddingMode,
  size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'md'
): string {
  if (paddingModeProp) {
    const vars = getPaddingVariables(paddingModeProp);
    const key = `--ai-padding-${size}` as keyof typeof vars;
    return vars[key];
  }
  return `var(--ai-padding-${size})`;
}

export const PaddingThemeSlice = {
  id: 'padding',
  name: 'Padding Density Mode',
  defaultState: 'normal' as PaddingMode,
  getCSSVariables: (mode: PaddingMode) => getPaddingVariables(mode),
};
