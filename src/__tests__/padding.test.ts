import { describe, it, expect } from 'vitest';
import { getPaddingVariables, resolvePadding } from '../theme/padding';

describe('PaddingMode & rem Padding Resolver', () => {
  it('generates correct rem padding variables for compact, normal, and spacious modes', () => {
    const compact = getPaddingVariables('compact');
    const normal = getPaddingVariables('normal');
    const spacious = getPaddingVariables('spacious');

    expect(compact['--ai-padding-md']).toBe('0.375rem 0.75rem');
    expect(normal['--ai-padding-md']).toBe('0.5rem 1rem');
    expect(spacious['--ai-padding-md']).toBe('0.875rem 1.375rem');
  });

  it('returns CSS variable when no component paddingMode prop is passed', () => {
    expect(resolvePadding(undefined, 'md')).toBe('var(--ai-padding-md)');
  });

  it('returns explicit rem padding string when component paddingMode prop is passed', () => {
    expect(resolvePadding('compact', 'md')).toBe('0.375rem 0.75rem');
    expect(resolvePadding('spacious', 'lg')).toBe('1.25rem 1.75rem');
  });
});
