import { describe, it, expect } from 'vitest';
import {
  isResponsiveConfig,
  resolveBaseMode,
  getResponsiveVariableKeys,
  generateResponsiveCSS,
} from '../theme/responsive';
import { getPaddingVariables } from '../theme/padding';
import { getMarginVariables } from '../theme/margin';

describe('isResponsiveConfig / resolveBaseMode', () => {
  it('distinguishes a bare mode string from a ResponsiveModeConfig object', () => {
    expect(isResponsiveConfig('compact')).toBe(false);
    expect(isResponsiveConfig(undefined)).toBe(false);
    expect(isResponsiveConfig({ base: 'compact' })).toBe(true);
    expect(isResponsiveConfig({ base: 'compact', lg: 'spacious' })).toBe(true);
  });

  it('resolves a bare string to itself, and a config object to its base tier', () => {
    expect(resolveBaseMode('compact')).toBe('compact');
    expect(resolveBaseMode({ base: 'spacious', lg: 'compact' })).toBe('spacious');
  });
});

describe('getResponsiveVariableKeys', () => {
  it('returns every variable a configured family owns, regardless of which tiers are set', () => {
    const keys = getResponsiveVariableKeys({ padding: { base: 'compact', lg: 'spacious' } });
    expect(keys).toEqual(new Set(Object.keys(getPaddingVariables('compact'))));
  });

  it('returns an empty set when nothing is configured', () => {
    expect(getResponsiveVariableKeys({})).toEqual(new Set());
  });

  it('unions keys across multiple configured families', () => {
    const keys = getResponsiveVariableKeys({
      padding: { base: 'normal' },
      margin: { base: 'normal' },
    });
    for (const key of Object.keys(getPaddingVariables('normal'))) expect(keys.has(key)).toBe(true);
    for (const key of Object.keys(getMarginVariables('normal'))) expect(keys.has(key)).toBe(true);
  });
});

describe('generateResponsiveCSS', () => {
  it('emits the base tier as an unconditional :root block, before any @media block', () => {
    const css = generateResponsiveCSS({ padding: { base: 'compact', lg: 'spacious' } });
    const rootIndex = css.indexOf(':root {');
    const mediaIndex = css.indexOf('@media');
    expect(rootIndex).toBeGreaterThanOrEqual(0);
    expect(mediaIndex).toBeGreaterThan(rootIndex);
    expect(css).toContain('--ai-padding-md: 0.375rem 0.75rem;'); // compact, base tier
  });

  it('emits @media blocks in ascending breakpoint order, since later-in-source wins the cascade at equal specificity', () => {
    const css = generateResponsiveCSS({
      padding: { base: 'compact', sm: 'normal', xl: 'spacious' },
    });
    const smIndex = css.indexOf('@media (min-width: 640px)');
    const xlIndex = css.indexOf('@media (min-width: 1280px)');
    expect(smIndex).toBeGreaterThanOrEqual(0);
    expect(xlIndex).toBeGreaterThan(smIndex);
  });

  it('only emits a tier a family actually configured -- an unset tier for one family carries no block content for it', () => {
    // padding sets 'lg', margin doesn't set anything at 'lg' -- the 'lg'
    // block should carry only padding's variables, not margin's, so
    // margin keeps inheriting whatever the last-applicable margin rule
    // established (the base tier here, since margin sets no other tier).
    const css = generateResponsiveCSS({
      padding: { base: 'compact', lg: 'spacious' },
      margin: { base: 'normal' },
    });
    const lgBlockStart = css.indexOf('@media (min-width: 1024px)');
    const lgBlockEnd = css.indexOf('}', css.indexOf('}', lgBlockStart) + 1) + 1;
    const lgBlock = css.slice(lgBlockStart, lgBlockEnd);
    expect(lgBlock).toContain('--ai-padding-md');
    expect(lgBlock).not.toContain('--ai-margin-');
  });

  it('emits no @media block at all for a tier nothing configured', () => {
    const css = generateResponsiveCSS({ padding: { base: 'compact', xl: 'spacious' } });
    expect(css).not.toContain('min-width: 640px');
    expect(css).not.toContain('min-width: 768px');
    expect(css).not.toContain('min-width: 1024px');
    expect(css).toContain('min-width: 1280px');
  });

  it('returns an empty string when nothing is configured', () => {
    expect(generateResponsiveCSS({})).toBe('');
  });

  it('merges multiple simultaneously-configured families into one combined block per breakpoint', () => {
    const css = generateResponsiveCSS({
      padding: { base: 'compact', lg: 'spacious' },
      margin: { base: 'compact', lg: 'spacious' },
    });
    const lgBlockStart = css.indexOf('@media (min-width: 1024px)');
    const lgBlockEnd = css.indexOf('}', css.indexOf('}', lgBlockStart) + 1) + 1;
    const lgBlock = css.slice(lgBlockStart, lgBlockEnd);
    expect(lgBlock).toContain('--ai-padding-md');
    expect(lgBlock).toContain('--ai-margin-md');
  });
});
