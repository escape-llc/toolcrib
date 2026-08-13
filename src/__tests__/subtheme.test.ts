import { describe, it, expect } from 'vitest';
import { resolveSubtheme, SubthemeName } from '../theme/subtheme';

describe('resolveSubtheme', () => {
  it('resolves the full variable family for a subtheme name', () => {
    expect(resolveSubtheme('error')).toEqual({
      main: 'var(--ai-subtheme-error)',
      background: 'var(--ai-subtheme-error-bg)',
      border: 'var(--ai-subtheme-error-border)',
      color: 'var(--ai-subtheme-error-text)',
      onMain: 'var(--ai-subtheme-error-on-main)',
    });
  });

  it('resolves each of the four supported names', () => {
    const names: SubthemeName[] = ['error', 'success', 'warning', 'info'];
    for (const name of names) {
      const colors = resolveSubtheme(name);
      expect(colors.main).toBe(`var(--ai-subtheme-${name})`);
      expect(colors.background).toBe(`var(--ai-subtheme-${name}-bg)`);
      expect(colors.border).toBe(`var(--ai-subtheme-${name}-border)`);
      expect(colors.color).toBe(`var(--ai-subtheme-${name}-text)`);
      expect(colors.onMain).toBe(`var(--ai-subtheme-${name}-on-main)`);
    }
  });
});
