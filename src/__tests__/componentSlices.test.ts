import { describe, it, expect } from 'vitest';
import { getAccordionVariables, AccordionThemeSlice } from '../components/Accordion/AccordionSlice';
import { getCardVariables, CardThemeSlice } from '../components/Card/CardSlice';
import { getTooltipVariables, TooltipThemeSlice } from '../components/Tooltip/TooltipSlice';

describe('Component Slices Engine (Accordion, Card, Tooltip)', () => {
  it('generates correct Accordion variables for header padding, item gap, and panel animation', () => {
    const vars = getAccordionVariables({
      headerPadding: 'compact',
      itemGap: 'spacious',
      variant: 'cards',
      panelAnimation: 'slide-fade',
    });

    expect(vars['--ai-accordion-header-padding']).toBe('0.5rem 0.75rem');
    expect(vars['--ai-accordion-item-gap']).toBe('1.25rem');
    expect(vars['--ai-accordion-border-radius']).toBe('var(--ai-radius-lg, 0.5rem)');
    expect(vars['--ai-accordion-animation']).toBe('ai-accordion-slide-down 0.25s cubic-bezier(0.16, 1, 0.3, 1)');
  });

  it('generates correct Card variables for padding and header style', () => {
    const vars = getCardVariables({
      padding: 'spacious',
      headerStyle: 'subtle-bg',
    });

    expect(vars['--ai-card-padding']).toBe('1.75rem 2.25rem');
    expect(vars['--ai-card-header-bg']).toBe('var(--ai-bg-container, #f9fafb)');
  });

  it('generates correct Tooltip variables for accent theme and sm size', () => {
    const vars = getTooltipVariables({
      theme: 'accent',
      size: 'sm',
    });

    expect(vars['--ai-tooltip-bg']).toBe('var(--ai-color-primary, #3b82f6)');
    expect(vars['--ai-tooltip-padding']).toBe('0.25rem 0.5rem');
  });

  it('exports correct slice IDs and metadata', () => {
    expect(AccordionThemeSlice.id).toBe('accordion');
    expect(CardThemeSlice.id).toBe('card');
    expect(TooltipThemeSlice.id).toBe('tooltip');
  });
});
