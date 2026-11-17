import { describe, it, expect } from 'vitest';
import {
  getTypographyVariables,
  TypographyThemeSlice,
  defaultTypographyState,
  FONT_MONO_FALLBACK,
  type MonoFamilyPreset,
  type TypographySliceState,
} from '../theme/typography';

describe('Typography Theme Slice Engine', () => {
  it('generates the system font stack and px font size by default', () => {
    const vars = getTypographyVariables({ fontFamily: 'system', monoFamily: 'system', masterFontSize: 16, baseLineHeight: 1.5 });

    expect(vars['--ai-font-family']).toBe('Inter, system-ui, Avenir, Helvetica, Arial, sans-serif');
    expect(vars['--ai-master-font-size']).toBe('16px');
  });

  it('switches to the serif and monospace stacks', () => {
    expect(getTypographyVariables({ fontFamily: 'serif', monoFamily: 'system', masterFontSize: 16, baseLineHeight: 1.5 })['--ai-font-family']).toContain('Georgia');
    expect(getTypographyVariables({ fontFamily: 'monospace', monoFamily: 'system', masterFontSize: 16, baseLineHeight: 1.5 })['--ai-font-family']).toContain('Consolas');
  });

  it('scales --ai-master-font-size with the raw px number', () => {
    expect(getTypographyVariables({ fontFamily: 'system', monoFamily: 'system', masterFontSize: 20, baseLineHeight: 1.5 })['--ai-master-font-size']).toBe('20px');
  });

  it('emits --ai-line-height as the raw unitless multiplier, controlling body-text density', () => {
    expect(getTypographyVariables({ fontFamily: 'system', monoFamily: 'system', masterFontSize: 16, baseLineHeight: 1.5 })['--ai-line-height']).toBe('1.5');
    expect(getTypographyVariables({ fontFamily: 'system', monoFamily: 'system', masterFontSize: 16, baseLineHeight: 1.8 })['--ai-line-height']).toBe('1.8');
  });

  it('exports correct ThemeSlice metadata', () => {
    expect(TypographyThemeSlice.id).toBe('typography');
    expect(TypographyThemeSlice.category).toBe('Layout Primitives');
    expect(TypographyThemeSlice.defaultState.fontFamily).toBe('system');
    expect(TypographyThemeSlice.defaultState.masterFontSize).toBe(16);
    expect(TypographyThemeSlice.defaultState.baseLineHeight).toBe(1.5);
  });

  it('lists --ai-line-height in fieldVars so a sparse baseLineHeight-only override emits just that variable', () => {
    expect(TypographyThemeSlice.fieldVars?.baseLineHeight).toEqual(['--ai-line-height']);
  });

  it('derives --ai-control-font-size-sm/md/lg as ratios of masterFontSize (75%/87.5%/100%), so every sized control rescales with the one slider', () => {
    const vars = getTypographyVariables({ fontFamily: 'system', monoFamily: 'system', masterFontSize: 16, baseLineHeight: 1.5 });
    expect(vars['--ai-control-font-size-sm']).toBe('12px');
    expect(vars['--ai-control-font-size-md']).toBe('14px');
    expect(vars['--ai-control-font-size-lg']).toBe('16px');

    const scaled = getTypographyVariables({ fontFamily: 'system', monoFamily: 'system', masterFontSize: 20, baseLineHeight: 1.5 });
    expect(scaled['--ai-control-font-size-sm']).toBe('15px');
    expect(scaled['--ai-control-font-size-md']).toBe('17.5px');
    expect(scaled['--ai-control-font-size-lg']).toBe('20px');
  });

  it('emits --ai-font-family-mono for each monoFamily preset, led by the preset font and ending in monospace', () => {
    const mono = (monoFamily: MonoFamilyPreset) =>
      getTypographyVariables({ ...defaultTypographyState, monoFamily })['--ai-font-family-mono'];
    expect(mono('system')).toBe(FONT_MONO_FALLBACK);
    expect(mono('system').startsWith('ui-monospace')).toBe(true);
    expect(mono('cascadia').startsWith('"Cascadia Code"')).toBe(true);
    expect(mono('fira').startsWith('"Fira Code"')).toBe(true);
    expect(mono('courier').startsWith('"Courier New"')).toBe(true);
    for (const p of ['system', 'cascadia', 'fira', 'courier'] as const) expect(mono(p).endsWith('monospace')).toBe(true);
  });

  it('the legacy monospace fontFamily preset reuses the same mono stack', () => {
    expect(getTypographyVariables({ ...defaultTypographyState, fontFamily: 'monospace' })['--ai-font-family']).toBe(FONT_MONO_FALLBACK);
  });

  it('falls back to the default mono stack when persisted state predates monoFamily', () => {
    const { monoFamily: _omit, ...legacy } = defaultTypographyState;
    const vars = getTypographyVariables(legacy as TypographySliceState);
    expect(vars['--ai-font-family-mono']).toBe(FONT_MONO_FALLBACK);
  });

  it('lists --ai-font-family-mono under monoFamily in fieldVars', () => {
    expect(TypographyThemeSlice.defaultState.monoFamily).toBe('system');
    expect(TypographyThemeSlice.fieldVars?.monoFamily).toEqual(['--ai-font-family-mono']);
  });

  it('lists all three control-font-size variables under masterFontSize in fieldVars, alongside --ai-master-font-size itself', () => {
    expect(TypographyThemeSlice.fieldVars?.masterFontSize).toEqual([
      '--ai-master-font-size',
      '--ai-control-font-size-sm',
      '--ai-control-font-size-md',
      '--ai-control-font-size-lg',
    ]);
  });
});
