import { describe, it, expect } from 'vitest';
import { CONTROL_FONT_SIZE_VAR, resolveControlPadding } from '../theme/controlSize';
import { getTypographyVariables, defaultTypographyState } from '../theme/typography';

describe('CONTROL_FONT_SIZE_VAR', () => {
  it('references the typography engine\'s CSS variables, each with its own literal fallback', () => {
    expect(CONTROL_FONT_SIZE_VAR.sm).toBe('var(--ai-control-font-size-sm, 0.75rem)');
    expect(CONTROL_FONT_SIZE_VAR.md).toBe('var(--ai-control-font-size-md, 0.875rem)');
    expect(CONTROL_FONT_SIZE_VAR.lg).toBe('var(--ai-control-font-size-lg, 1rem)');
  });

  it('fallbacks match what the typography engine actually emits at the default 16px master size', () => {
    const vars = getTypographyVariables(defaultTypographyState);
    expect(vars['--ai-control-font-size-sm']).toBe('12px');
    expect(vars['--ai-control-font-size-md']).toBe('14px');
    expect(vars['--ai-control-font-size-lg']).toBe('16px');
  });
});

describe('resolveControlPadding', () => {
  it('defers to the component\'s own default at size="md", leaving existing (unsized) rendering unchanged', () => {
    expect(resolveControlPadding('md', 'var(--ai-input-padding, 0.5rem 0.75rem)')).toBe('var(--ai-input-padding, 0.5rem 0.75rem)');
  });

  it('resolves sm/lg through the shared global padding scale instead, matching <Button> at the same size', () => {
    expect(resolveControlPadding('sm', 'var(--ai-input-padding, 0.5rem 0.75rem)')).toBe('var(--ai-padding-sm)');
    expect(resolveControlPadding('lg', 'var(--ai-input-padding, 0.5rem 0.75rem)')).toBe('var(--ai-padding-lg)');
  });
});
