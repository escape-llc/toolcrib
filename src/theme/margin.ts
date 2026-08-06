export type MarginMode = 'compact' | 'normal' | 'spacious';

export function getMarginVariables(mode: MarginMode = 'normal'): Record<string, string> {
  switch (mode) {
    case 'compact':
      return {
        '--ai-margin-xs': '0.125rem',
        '--ai-margin-sm': '0.375rem',
        '--ai-margin-md': '0.625rem',
        '--ai-margin-lg': '0.875rem',
        '--ai-margin-xl': '1.25rem',
        '--ai-margin-gap': '0.625rem',
      };
    case 'spacious':
      return {
        '--ai-margin-xs': '0.375rem',
        '--ai-margin-sm': '0.75rem',
        '--ai-margin-md': '1.25rem',
        '--ai-margin-lg': '1.75rem',
        '--ai-margin-xl': '2.5rem',
        '--ai-margin-gap': '1.25rem',
      };
    case 'normal':
    default:
      return {
        '--ai-margin-xs': '0.25rem',
        '--ai-margin-sm': '0.5rem',
        '--ai-margin-md': '0.875rem',
        '--ai-margin-lg': '1.25rem',
        '--ai-margin-xl': '1.75rem',
        '--ai-margin-gap': '0.875rem',
      };
  }
}

/**
 * Resolves component margin or spacing gap in rem units.
 * If marginModeProp is provided, returns explicit rem margin overriding global setting.
 * Otherwise returns CSS variable for automatic theme mode scaling.
 */
export function resolveMargin(
  marginModeProp?: MarginMode,
  size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'gap' = 'md'
): string {
  if (marginModeProp) {
    const vars = getMarginVariables(marginModeProp);
    const key = `--ai-margin-${size}` as keyof typeof vars;
    return vars[key];
  }
  return `var(--ai-margin-${size})`;
}

export const MarginThemeSlice = {
  id: 'margin',
  name: 'Margin & Element Spacing Mode',
  defaultState: 'normal' as MarginMode,
  getCSSVariables: (mode: MarginMode) => getMarginVariables(mode),
};
