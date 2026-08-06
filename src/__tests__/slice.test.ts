import { describe, it, expect } from 'vitest';
import { ThemeSliceRegistry, ThemeSlice } from '../theme/slice';
import { ShadowThemeSlice, getShadowVariables } from '../theme/shadow';
import { MarginThemeSlice } from '../theme/margin';
import { PaddingThemeSlice } from '../theme/padding';

describe('Modular Theme Slice Engine', () => {
  it('registers theme slices and computes combined CSS variables', () => {
    const registry = new ThemeSliceRegistry();
    registry.register(MarginThemeSlice);
    registry.register(PaddingThemeSlice);
    registry.register(ShadowThemeSlice);

    expect(registry.getAll().length).toBe(3);

    const vars = registry.computeAllVariables({
      margin: 'compact',
      padding: 'spacious',
      shadow: 'elevated',
    });

    expect(vars['--ai-margin-sm']).toBe('0.375rem');
    expect(vars['--ai-padding-sm']).toBe('0.625rem 1rem');
    expect(vars['--ai-shadow-sm']).toBe('0 0.125rem 0.375rem rgba(0, 0, 0, 0.12)');
  });

  it('generates correct shadow elevation variables', () => {
    const glassVars = getShadowVariables('glass');
    expect(glassVars['--ai-shadow-md']).toContain('rgba(31, 38, 135');
  });
});
