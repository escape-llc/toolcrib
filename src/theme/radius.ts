/** @barrelExport */
export type CornerRadiusMode = 'sharp' | 'subtle' | 'rounded' | 'pill';

export interface RadiusVariables extends Record<string, string> {
  '--ai-radius-sm': string;
  '--ai-radius-md': string;
  '--ai-radius-lg': string;
  '--ai-radius-xl': string;
}

export function getRadiusVariables(mode: CornerRadiusMode): RadiusVariables {
  switch (mode) {
    case 'sharp':
      return {
        '--ai-radius-sm': '0',
        '--ai-radius-md': '0',
        '--ai-radius-lg': '0',
        '--ai-radius-xl': '0',
      };
    case 'subtle':
      return {
        '--ai-radius-sm': '0.125rem',
        '--ai-radius-md': '0.25rem',
        '--ai-radius-lg': '0.375rem',
        '--ai-radius-xl': '0.5rem',
      };
    case 'pill':
      return {
        '--ai-radius-sm': '0.75rem',
        '--ai-radius-md': '1rem',
        '--ai-radius-lg': '1.25rem',
        '--ai-radius-xl': '1.5rem',
      };
    case 'rounded':
    default:
      return {
        '--ai-radius-sm': '0.25rem',
        '--ai-radius-md': '0.375rem',
        '--ai-radius-lg': '0.5rem',
        '--ai-radius-xl': '0.75rem',
      };
  }
}

export function resolveRadius(
  radiusMode?: CornerRadiusMode,
  size: 'sm' | 'md' | 'lg' | 'xl' = 'md'
): string {
  if (!radiusMode) {
    return `var(--ai-radius-${size})`;
  }
  const vars = getRadiusVariables(radiusMode);
  return vars[`--ai-radius-${size}`];
}

export const RadiusThemeSlice = {
  id: 'radius',
  name: 'Corner Rounding Mode',
  category: 'Layout Primitives' as const,
  defaultState: 'rounded' as CornerRadiusMode,
  getCSSVariables: (mode: CornerRadiusMode) => getRadiusVariables(mode),
};
