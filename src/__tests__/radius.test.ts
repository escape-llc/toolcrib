import { describe, it, expect } from 'vitest';
import { getRadiusVariables, resolveRadius } from '../theme/radius';

describe('CornerRadiusMode Engine', () => {
  it('generates correct CSS radius variables for sharp, subtle, rounded, and pill modes', () => {
    const sharp = getRadiusVariables('sharp');
    const subtle = getRadiusVariables('subtle');
    const rounded = getRadiusVariables('rounded');
    const pill = getRadiusVariables('pill');

    expect(sharp['--ai-radius-md']).toBe('0');
    expect(subtle['--ai-radius-md']).toBe('0.25rem');
    expect(rounded['--ai-radius-md']).toBe('0.375rem');
    expect(pill['--ai-radius-md']).toBe('1rem');
  });

  it('returns CSS variable when no component cornerRadiusMode prop is passed', () => {
    expect(resolveRadius(undefined, 'md')).toBe('var(--ai-radius-md)');
  });

  it('returns explicit rem radius string when component cornerRadiusMode prop is passed', () => {
    expect(resolveRadius('sharp', 'md')).toBe('0');
    expect(resolveRadius('pill', 'lg')).toBe('1.25rem');
  });
});
