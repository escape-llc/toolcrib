import { ThemeSlice } from '../../theme/slice';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    accordion: Partial<AccordionSliceState>;
  }
}

/** @barrelExport */
export type AccordionHeaderPadding = 'compact' | 'normal' | 'spacious';
export type AccordionItemGap = 'none' | 'compact' | 'normal' | 'spacious';
export type AccordionVariant = 'bordered' | 'ghost' | 'cards';
export type AccordionPanelAnimation = 'slide-fade' | 'expand' | 'scale-fade' | 'none';

export interface AccordionSliceState {
  headerPadding: AccordionHeaderPadding;
  itemGap: AccordionItemGap;
  variant: AccordionVariant;
  panelAnimation: AccordionPanelAnimation;
}

export interface AccordionCSSVariables extends Record<string, string> {
  '--ai-accordion-header-padding': string;
  '--ai-accordion-item-gap': string;
  '--ai-accordion-border-radius': string;
  '--ai-accordion-border': string;
  '--ai-accordion-animation': string;
}

export const defaultAccordionState: AccordionSliceState = {
  headerPadding: 'normal',
  itemGap: 'compact',
  variant: 'cards',
  panelAnimation: 'slide-fade',
};

const paddingMap: Record<AccordionHeaderPadding, string> = {
  compact: '0.5rem 0.75rem',
  normal: '0.875rem 1.125rem',
  spacious: '1.25rem 1.5rem',
};

const gapMap: Record<AccordionItemGap, string> = {
  none: '0',
  compact: '0.375rem',
  normal: '0.75rem',
  spacious: '1.25rem',
};

const animationMap: Record<AccordionPanelAnimation, string> = {
  'slide-fade': 'ai-accordion-slide-down 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
  'expand': 'ai-accordion-slide-down 0.2s ease-out',
  'scale-fade': 'ai-scale-in 0.2s ease-out',
  'none': 'none',
};

export function getAccordionVariables(state: AccordionSliceState = defaultAccordionState): AccordionCSSVariables {
  const { headerPadding, itemGap, variant, panelAnimation = 'slide-fade' } = state;

  let borderRadius = 'var(--ai-radius-md, 0.375rem)';
  let border = '0.0625rem solid var(--ai-border, #e5e7eb)';

  if (variant === 'ghost') {
    border = 'none';
    borderRadius = '0';
  } else if (variant === 'cards') {
    borderRadius = 'var(--ai-radius-lg, 0.5rem)';
  }

  return {
    '--ai-accordion-header-padding': paddingMap[headerPadding] || paddingMap.normal,
    '--ai-accordion-item-gap': gapMap[itemGap] || gapMap.compact,
    '--ai-accordion-border-radius': borderRadius,
    '--ai-accordion-border': border,
    '--ai-accordion-animation': animationMap[panelAnimation] || animationMap['slide-fade'],
  };
}

export const AccordionThemeSlice: ThemeSlice<AccordionSliceState, AccordionCSSVariables> = {
  id: 'accordion',
  name: '🪗 Accordion Header & Gap Spacing',
  category: 'Data Display',
  defaultState: defaultAccordionState,
  getCSSVariables: getAccordionVariables,
  fieldVars: {
    headerPadding: ['--ai-accordion-header-padding'],
    itemGap: ['--ai-accordion-item-gap'],
    variant: ['--ai-accordion-border-radius', '--ai-accordion-border'],
    panelAnimation: ['--ai-accordion-animation'],
  },
};
