import { ThemeSlice } from '../../theme/slice';

/** @barrelExport */
export type TooltipTheme = 'dark' | 'light' | 'accent';
export type TooltipSize = 'sm' | 'md';

export interface TooltipSliceState {
  theme: TooltipTheme;
  size: TooltipSize;
}

export interface TooltipCSSVariables extends Record<string, string> {
  '--ai-tooltip-bg': string;
  '--ai-tooltip-color': string;
  '--ai-tooltip-padding': string;
  '--ai-tooltip-font-size': string;
  '--ai-tooltip-border-radius': string;
}

export const defaultTooltipState: TooltipSliceState = {
  theme: 'dark',
  size: 'md',
};

export function getTooltipVariables(state: TooltipSliceState = defaultTooltipState): TooltipCSSVariables {
  const { theme, size } = state;

  let bg = '#111827';
  let color = '#ffffff';

  if (theme === 'light') {
    bg = 'var(--ai-bg-surface, #ffffff)';
    color = 'var(--ai-text-primary, #111827)';
  } else if (theme === 'accent') {
    bg = 'var(--ai-color-primary, #3b82f6)';
    color = '#ffffff';
  }

  const padding = size === 'sm' ? '0.25rem 0.5rem' : '0.375rem 0.625rem';
  const fontSize = size === 'sm' ? '0.75rem' : '0.8125rem';

  return {
    '--ai-tooltip-bg': bg,
    '--ai-tooltip-color': color,
    '--ai-tooltip-padding': padding,
    '--ai-tooltip-font-size': fontSize,
    '--ai-tooltip-border-radius': 'var(--ai-radius-sm, 0.25rem)',
  };
}

export const TooltipThemeSlice: ThemeSlice<TooltipSliceState, TooltipCSSVariables> = {
  id: 'tooltip',
  name: '💬 Tooltip Styling & Theme',
  category: 'Overlays',
  defaultState: defaultTooltipState,
  getCSSVariables: getTooltipVariables,
  fieldVars: {
    theme: ['--ai-tooltip-bg', '--ai-tooltip-color'],
    size: ['--ai-tooltip-padding', '--ai-tooltip-font-size'],
  },
};
