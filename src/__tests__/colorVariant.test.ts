import { describe, it, expect } from 'vitest';
import { resolveColorVariant } from '../theme/colorVariant';

describe('resolveColorVariant', () => {
  it('returns null when neither variant nor subtheme is set, letting the caller apply its own neutral default', () => {
    expect(resolveColorVariant({})).toBeNull();
    expect(resolveColorVariant({ appearance: 'solid' })).toBeNull();
  });

  describe('subtheme (status colors)', () => {
    it('soft (default) matches the subtheme\'s own precomputed bg/border/text family exactly', () => {
      const result = resolveColorVariant({ subtheme: 'success' });
      expect(result).toEqual({
        background: 'var(--ai-subtheme-success-bg)',
        border: 'var(--ai-subtheme-success-border)',
        color: 'var(--ai-subtheme-success-text)',
      });
    });

    it('solid fills with the subtheme\'s main color and readable on-main text', () => {
      const result = resolveColorVariant({ subtheme: 'error', appearance: 'solid' });
      expect(result).toEqual({
        background: 'var(--ai-subtheme-error)',
        border: 'var(--ai-subtheme-error)',
        color: 'var(--ai-subtheme-error-on-main)',
      });
    });

    it('outline is hollow: transparent background, main-colored border, readable-on-surface text', () => {
      const result = resolveColorVariant({ subtheme: 'warning', appearance: 'outline' });
      expect(result).toEqual({
        background: 'transparent',
        border: 'var(--ai-subtheme-warning)',
        color: 'var(--ai-subtheme-warning-text)',
      });
    });

    it('subtheme wins over variant when both are set, matching Button\'s own existing precedent', () => {
      const result = resolveColorVariant({ subtheme: 'info', variant: 'secondary' });
      expect(result?.background).toBe('var(--ai-subtheme-info-bg)');
    });
  });

  describe('variant (identity colors)', () => {
    it('soft (default) derives a live color-mix() tint from the identity color, with a readable-on-surface text color', () => {
      const result = resolveColorVariant({ variant: 'primary' });
      expect(result?.background).toBe('color-mix(in srgb, var(--ai-color-primary) 12%, var(--ai-bg-surface, #ffffff))');
      expect(result?.border).toBe('color-mix(in srgb, var(--ai-color-primary) 35%, transparent)');
      expect(result?.color).toBe('var(--ai-color-primary-readable)');
    });

    it('solid fills with the identity color and its precomputed readable-on-fill text', () => {
      const result = resolveColorVariant({ variant: 'secondary', appearance: 'solid' });
      expect(result).toEqual({
        background: 'var(--ai-color-secondary)',
        border: 'var(--ai-color-secondary)',
        color: 'var(--ai-color-secondary-text)',
      });
    });

    it('outline is hollow: transparent background, the raw identity color as border, readable-on-surface text', () => {
      const result = resolveColorVariant({ variant: 'primary', appearance: 'outline' });
      expect(result).toEqual({
        background: 'transparent',
        border: 'var(--ai-color-primary)',
        color: 'var(--ai-color-primary-readable)',
      });
    });
  });
});
