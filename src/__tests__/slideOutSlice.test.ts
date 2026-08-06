import { describe, it, expect } from 'vitest';
import { getSlideOutVariables, SlideOutThemeSlice } from '../components/Overlay/SlideOutSlice';

describe('SlideOutThemeSlice Engine', () => {
  it('generates correct CSS variables for md width and subtle backdrop blur', () => {
    const vars = getSlideOutVariables({
      width: 'md',
      position: 'right',
      backdropBlur: 'subtle',
      headerMargin: 'none',
    });

    expect(vars['--ai-slideout-width']).toBe('26rem');
    expect(vars['--ai-slideout-backdrop-blur']).toBe('0.125rem');
    expect(vars['--ai-slideout-header-margin']).toBe('0');
    expect(vars['--ai-slideout-duration']).toBe('var(--ai-transition-duration-normal, 250ms)');
  });

  it('generates 50vw width and detached header margin', () => {
    const vars = getSlideOutVariables({
      width: '50vw',
      position: 'left',
      backdropBlur: 'heavy',
      headerMargin: 'detached',
    });

    expect(vars['--ai-slideout-width']).toBe('50vw');
    expect(vars['--ai-slideout-backdrop-blur']).toBe('0.5rem');
    expect(vars['--ai-slideout-header-margin']).toBe('0.75rem 0.75rem 0.5rem 0.75rem');
    expect(vars['--ai-slideout-header-border-radius']).toBe('var(--ai-radius-md, 0.375rem)');
  });

  it('exports correct ThemeSlice metadata', () => {
    expect(SlideOutThemeSlice.id).toBe('slideout');
    expect(SlideOutThemeSlice.defaultState.width).toBe('md');
    expect(SlideOutThemeSlice.defaultState.headerMargin).toBe('none');
  });
});
