import { describe, it, expect } from 'vitest';
import { getTypographyVariables, TypographyThemeSlice } from '../theme/typography';

describe('Typography Theme Slice Engine', () => {
  it('generates the system font stack and px font size by default', () => {
    const vars = getTypographyVariables({ fontFamily: 'system', masterFontSize: 16 });

    expect(vars['--ai-font-family']).toBe('Inter, system-ui, Avenir, Helvetica, Arial, sans-serif');
    expect(vars['--ai-master-font-size']).toBe('16px');
  });

  it('switches to the serif and monospace stacks', () => {
    expect(getTypographyVariables({ fontFamily: 'serif', masterFontSize: 16 })['--ai-font-family']).toContain('Georgia');
    expect(getTypographyVariables({ fontFamily: 'monospace', masterFontSize: 16 })['--ai-font-family']).toContain('Consolas');
  });

  it('scales --ai-master-font-size with the raw px number', () => {
    expect(getTypographyVariables({ fontFamily: 'system', masterFontSize: 20 })['--ai-master-font-size']).toBe('20px');
  });

  it('exports correct ThemeSlice metadata', () => {
    expect(TypographyThemeSlice.id).toBe('typography');
    expect(TypographyThemeSlice.category).toBe('Layout Primitives');
    expect(TypographyThemeSlice.defaultState.fontFamily).toBe('system');
    expect(TypographyThemeSlice.defaultState.masterFontSize).toBe(16);
  });
});
