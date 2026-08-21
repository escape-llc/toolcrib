import { describe, it, expect } from 'vitest';
import { ThemeSliceRegistry, type ThemeSlice, getSparseVariables } from '../theme/slice';
import { ShadowThemeSlice, getShadowVariables, resolveShadow } from '../theme/shadow';
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

  it('generates flat (no shadow) variables for the "none" mode', () => {
    const noneVars = getShadowVariables('none');
    expect(noneVars['--ai-shadow-sm']).toBe('none');
    expect(noneVars['--ai-shadow-md']).toBe('none');
    expect(noneVars['--ai-shadow-lg']).toBe('none');
  });

  describe('resolveShadow', () => {
    it('falls back to the CSS custom property reference when no mode is given', () => {
      expect(resolveShadow(undefined, 'lg')).toBe('var(--ai-shadow-lg)');
    });

    it('resolves the concrete value for a given mode and size', () => {
      expect(resolveShadow('elevated', 'sm')).toBe(getShadowVariables('elevated')['--ai-shadow-sm']);
    });
  });
});

interface FixtureState {
  padding: 'compact' | 'normal';
  headerStyle: 'flush' | 'bordered';
}

interface FixtureVars extends Record<string, string> {
  '--fixture-padding': string;
  '--fixture-header-padding': string;
  '--fixture-header-border': string;
}

const fixtureDefaultState: FixtureState = { padding: 'normal', headerStyle: 'bordered' };

const fixtureSliceWithFieldVars: ThemeSlice<FixtureState, FixtureVars> = {
  id: 'fixture',
  name: 'Fixture',
  category: 'Containers',
  defaultState: fixtureDefaultState,
  getCSSVariables: (state) => ({
    '--fixture-padding': state.padding === 'compact' ? '0.5rem' : '1rem',
    '--fixture-header-padding': state.padding === 'compact' ? '0.5rem' : '1rem',
    '--fixture-header-border': state.headerStyle === 'flush' ? 'none' : '1px solid gray',
  }),
  fieldVars: {
    padding: ['--fixture-padding', '--fixture-header-padding'],
    headerStyle: ['--fixture-header-border'],
  },
};

const fixtureSliceWithoutFieldVars: ThemeSlice<FixtureState, FixtureVars> = {
  ...fixtureSliceWithFieldVars,
  fieldVars: undefined,
};

describe('getSparseVariables', () => {
  it('emits only the variables reachable from the provided partial keys', () => {
    const sparse = getSparseVariables(fixtureSliceWithFieldVars, { padding: 'compact' });

    expect(sparse).toEqual({
      '--fixture-padding': '0.5rem',
      '--fixture-header-padding': '0.5rem',
    });
    expect(sparse['--fixture-header-border']).toBeUndefined();
  });

  it('combines variables from multiple provided fields', () => {
    const sparse = getSparseVariables(fixtureSliceWithFieldVars, {
      padding: 'compact',
      headerStyle: 'flush',
    });

    expect(Object.keys(sparse).sort()).toEqual([
      '--fixture-header-border',
      '--fixture-header-padding',
      '--fixture-padding',
    ]);
  });

  it('ignores explicitly-undefined partial fields', () => {
    const sparse = getSparseVariables(fixtureSliceWithFieldVars, { padding: undefined });
    expect(sparse).toEqual({});
  });

  it('returns an empty patch for an empty partial', () => {
    expect(getSparseVariables(fixtureSliceWithFieldVars, {})).toEqual({});
  });

  it('falls back to the full computed result when the slice has no fieldVars', () => {
    const sparse = getSparseVariables(fixtureSliceWithoutFieldVars, { padding: 'compact' });

    expect(sparse).toEqual({
      '--fixture-padding': '0.5rem',
      '--fixture-header-padding': '0.5rem',
      '--fixture-header-border': '1px solid gray',
    });
  });
});
