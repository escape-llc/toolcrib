import { ThemeSlice } from '../../theme/slice';

export type TabVariant = 'pills' | 'underline' | 'cards' | 'segment';
export type TabSize = 'sm' | 'md' | 'lg';
export type TabPanelTransition = 'fade' | 'scale-fade' | 'none';

export interface TabSliceState {
  variant: TabVariant;
  size: TabSize;
  activeSubtheme: 'primary' | 'secondary' | 'success' | 'info';
  panelTransition: TabPanelTransition;
}

export interface TabCSSVariables extends Record<string, string> {
  '--ai-tab-padding': string;
  '--ai-tab-font-size': string;
  '--ai-tab-border-radius': string;
  '--ai-tab-active-bg': string;
  '--ai-tab-active-color': string;
  '--ai-tab-active-border': string;
  '--ai-tab-inactive-color': string;
  '--ai-tab-panel-animation': string;
}

export const defaultTabState: TabSliceState = {
  variant: 'pills',
  size: 'md',
  activeSubtheme: 'primary',
  panelTransition: 'fade',
};

const paddingMap: Record<TabSize, string> = {
  sm: '0.25rem 0.625rem',
  md: '0.5rem 0.875rem',
  lg: '0.625rem 1.25rem',
};

const fontSizeMap: Record<TabSize, string> = {
  sm: '0.75rem',
  md: '0.875rem',
  lg: '1rem',
};

export function getTabVariables(state: TabSliceState = defaultTabState): TabCSSVariables {
  const { variant, size, activeSubtheme, panelTransition } = state;

  const padding = paddingMap[size] || paddingMap.md;
  const fontSize = fontSizeMap[size] || fontSizeMap.md;

  let activeColor = 'var(--ai-color-primary, #3b82f6)';
  if (activeSubtheme === 'secondary') activeColor = 'var(--ai-color-secondary, #64748b)';
  if (activeSubtheme === 'success') activeColor = 'var(--ai-subtheme-success, #10b981)';
  if (activeSubtheme === 'info') activeColor = 'var(--ai-subtheme-info, #0284c7)';

  let borderRadius = 'var(--ai-radius-md, 0.375rem)';
  let activeBg = 'var(--ai-bg-surface, #ffffff)';
  let activeBorder = 'none';

  if (variant === 'underline') {
    borderRadius = '0';
    activeBg = 'transparent';
    activeBorder = `0.125rem solid ${activeColor}`;
  } else if (variant === 'cards') {
    borderRadius = 'var(--ai-radius-md, 0.375rem) var(--ai-radius-md, 0.375rem) 0 0';
    activeBg = 'var(--ai-bg-surface, #ffffff)';
    activeBorder = '0.0625rem solid var(--ai-border, #e5e7eb)';
  } else if (variant === 'segment') {
    borderRadius = 'var(--ai-radius-sm, 0.25rem)';
    activeBg = 'var(--ai-bg-surface, #ffffff)';
    activeBorder = 'none';
  }

  let panelAnimation = 'none';
  if (panelTransition === 'fade') {
    panelAnimation = 'ai-fade-in var(--ai-transition-duration-normal, 0.22s) var(--ai-transition-easing, ease)';
  } else if (panelTransition === 'scale-fade') {
    panelAnimation = 'ai-scale-in var(--ai-transition-duration-normal, 0.22s) var(--ai-transition-easing, ease)';
  }

  return {
    '--ai-tab-padding': padding,
    '--ai-tab-font-size': fontSize,
    '--ai-tab-border-radius': borderRadius,
    '--ai-tab-active-bg': activeBg,
    '--ai-tab-active-color': activeColor,
    '--ai-tab-active-border': activeBorder,
    '--ai-tab-inactive-color': 'var(--ai-text-secondary, #6b7280)',
    '--ai-tab-panel-animation': panelAnimation,
  };
}

export const TabThemeSlice: ThemeSlice<TabSliceState, TabCSSVariables> = {
  id: 'tab',
  name: '📑 Tab Group Panels & Variants',
  defaultState: defaultTabState,
  getCSSVariables: getTabVariables,
  fieldVars: {
    // variant and activeSubtheme both feed the "active tab" cluster —
    // e.g. the 'underline' variant's border colour is derived from
    // activeSubtheme's colour, so either field touches all three.
    variant: ['--ai-tab-border-radius', '--ai-tab-active-bg', '--ai-tab-active-color', '--ai-tab-active-border'],
    activeSubtheme: ['--ai-tab-active-bg', '--ai-tab-active-color', '--ai-tab-active-border'],
    size: ['--ai-tab-padding', '--ai-tab-font-size'],
    panelTransition: ['--ai-tab-panel-animation'],
  },
};
