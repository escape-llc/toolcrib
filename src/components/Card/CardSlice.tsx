import { type ThemeSlice } from '../../theme/slice';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    card: Partial<CardSliceState>;
  }
}

/** @barrelExport */
export type CardPadding = 'compact' | 'normal' | 'spacious';
export type CardHeaderStyle = 'flush' | 'bordered' | 'subtle-bg';

export interface CardSliceState {
  padding: CardPadding;
  headerStyle: CardHeaderStyle;
}

export interface CardCSSVariables extends Record<string, string> {
  '--ai-card-padding': string;
  '--ai-card-header-padding': string;
  '--ai-card-header-bg': string;
  '--ai-card-header-border': string;
}

export const defaultCardState: CardSliceState = {
  padding: 'normal',
  headerStyle: 'bordered',
};

const paddingMap: Record<CardPadding, string> = {
  compact: '0.75rem 1rem',
  normal: '1.25rem 1.5rem',
  spacious: '1.75rem 2.25rem',
};

export function getCardVariables(state: CardSliceState = defaultCardState): CardCSSVariables {
  const { padding, headerStyle } = state;

  let headerBg = 'transparent';
  let headerBorder = '0.0625rem solid var(--ai-border, #e5e7eb)';

  if (headerStyle === 'flush') {
    headerBorder = 'none';
  } else if (headerStyle === 'subtle-bg') {
    headerBg = 'var(--ai-bg-container, #f9fafb)';
  }

  return {
    '--ai-card-padding': paddingMap[padding] || paddingMap.normal,
    '--ai-card-header-padding': paddingMap[padding] || paddingMap.normal,
    '--ai-card-header-bg': headerBg,
    '--ai-card-header-border': headerBorder,
  };
}

export const CardThemeSlice: ThemeSlice<CardSliceState, CardCSSVariables> = {
  id: 'card',
  name: '🃏 Card Padding & Header Layout',
  category: 'Containers',
  defaultState: defaultCardState,
  getCSSVariables: getCardVariables,
  fieldVars: {
    padding: ['--ai-card-padding', '--ai-card-header-padding'],
    headerStyle: ['--ai-card-header-bg', '--ai-card-header-border'],
  },
};
