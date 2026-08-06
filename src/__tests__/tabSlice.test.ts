import { describe, it, expect } from 'vitest';
import { getTabVariables, TabThemeSlice } from '../components/TabStrip/TabSlice';

describe('TabThemeSlice Engine', () => {
  it('generates correct CSS variables for pills variant', () => {
    const vars = getTabVariables({
      variant: 'pills',
      size: 'md',
      activeSubtheme: 'primary',
      panelTransition: 'fade',
    });

    expect(vars['--ai-tab-padding']).toBe('0.5rem 0.875rem');
    expect(vars['--ai-tab-font-size']).toBe('0.875rem');
    expect(vars['--ai-tab-active-bg']).toBe('var(--ai-bg-surface, #ffffff)');
    expect(vars['--ai-tab-active-border']).toBe('none');
    expect(vars['--ai-tab-panel-animation']).toContain('ai-fade-in');
  });

  it('generates underline active border for underline variant', () => {
    const vars = getTabVariables({
      variant: 'underline',
      size: 'lg',
      activeSubtheme: 'success',
      panelTransition: 'scale-fade',
    });

    expect(vars['--ai-tab-padding']).toBe('0.625rem 1.25rem');
    expect(vars['--ai-tab-active-bg']).toBe('transparent');
    expect(vars['--ai-tab-active-border']).toContain('var(--ai-subtheme-success');
    expect(vars['--ai-tab-panel-animation']).toContain('ai-scale-in');
  });

  it('exports correct ThemeSlice metadata', () => {
    expect(TabThemeSlice.id).toBe('tab');
    expect(TabThemeSlice.defaultState.variant).toBe('pills');
    expect(TabThemeSlice.defaultState.panelTransition).toBe('fade');
  });
});
