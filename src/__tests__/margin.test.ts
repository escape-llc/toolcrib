import { describe, it, expect } from 'vitest';
import { getMarginVariables, resolveMargin, MarginMode } from '../theme/margin';

describe('Margin & Spacing Mode System', () => {
  it('generates correct CSS variables for normal margin mode', () => {
    const vars = getMarginVariables('normal');
    expect(vars['--ai-margin-sm']).toBe('0.5rem');
    expect(vars['--ai-margin-md']).toBe('0.875rem');
    expect(vars['--ai-margin-gap']).toBe('0.875rem');
  });

  it('generates correct CSS variables for compact margin mode', () => {
    const vars = getMarginVariables('compact');
    expect(vars['--ai-margin-sm']).toBe('0.375rem');
    expect(vars['--ai-margin-md']).toBe('0.625rem');
    expect(vars['--ai-margin-gap']).toBe('0.625rem');
  });

  it('generates correct CSS variables for spacious margin mode', () => {
    const vars = getMarginVariables('spacious');
    expect(vars['--ai-margin-sm']).toBe('0.75rem');
    expect(vars['--ai-margin-md']).toBe('1.25rem');
    expect(vars['--ai-margin-gap']).toBe('1.25rem');
  });

  it('resolves component margins correctly', () => {
    expect(resolveMargin(undefined, 'md')).toBe('var(--ai-margin-md)');
    expect(resolveMargin('compact', 'gap')).toBe('0.625rem');
  });
});
