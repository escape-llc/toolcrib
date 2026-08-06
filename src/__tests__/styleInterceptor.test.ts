import { describe, it, expect } from 'vitest';
import { resolveAIStyle } from '../theme/styleInterceptor';

describe('Toolkit Style Interceptor (resolveAIStyle)', () => {
  it('intercepts and replaces ad-hoc inline padding when paddingMode is active', () => {
    const style = resolveAIStyle({
      paddingMode: 'compact',
      style: { padding: '20px', color: 'red' },
    });

    expect(style.padding).toBe('0.375rem 0.75rem');
    expect(style.color).toBe('red');
  });

  it('intercepts and replaces ad-hoc inline margin when marginMode is active', () => {
    const style = resolveAIStyle({
      marginMode: 'spacious',
      style: { marginBottom: '30px' },
    });

    expect(style.marginBottom).toBe('1.25rem');
  });

  it('applies subtheme CSS variables to component styles', () => {
    const style = resolveAIStyle({
      subtheme: 'error',
    });

    expect(style.color).toBe('var(--ai-subtheme-error-text)');
    expect(style.backgroundColor).toBe('var(--ai-subtheme-error-bg)');
    expect(style.borderColor).toBe('var(--ai-subtheme-error-border)');
  });
});
