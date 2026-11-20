import { describe, it, expect } from 'vitest';
import { getViewportVariables, ViewportThemeSlice, defaultViewportState, VIEWPORT_INSET, VIEWPORT_EDGES } from '../theme/viewport';
import { globalThemeSliceRegistry } from '../theme/slice';
import '../theme/registerThemeSlices';

describe('ViewportThemeSlice', () => {
  it('is registered and defaults to auto with zero insets', () => {
    expect(globalThemeSliceRegistry.getAll().some(s => s.id === 'viewport')).toBe(true);
    expect(defaultViewportState).toEqual({ mode: 'auto', top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('auto: platform env() values, top also the title bar', () => {
    const vars = getViewportVariables();
    expect(vars['--ai-viewport-inset-top']).toBe('max(env(titlebar-area-height, 0px), env(safe-area-inset-top, 0px), 0rem)');
    expect(vars['--ai-viewport-inset-right']).toBe('max(env(safe-area-inset-right, 0px), 0rem)');
    expect(vars['--ai-viewport-inset-bottom']).toBe('max(env(safe-area-inset-bottom, 0px), 0rem)');
    expect(vars['--ai-viewport-inset-left']).toBe('max(env(safe-area-inset-left, 0px), 0rem)');
  });

  it('auto: the rem values are a minimum under the env() values', () => {
    const vars = getViewportVariables({ ...defaultViewportState, top: 2.5, left: 1 });
    expect(vars['--ai-viewport-inset-top']).toBe('max(env(titlebar-area-height, 0px), env(safe-area-inset-top, 0px), 2.5rem)');
    expect(vars['--ai-viewport-inset-left']).toBe('max(env(safe-area-inset-left, 0px), 1rem)');
  });

  it('manual: only the rem values', () => {
    expect(getViewportVariables({ mode: 'manual', top: 2.5, right: 0.25, bottom: 1, left: 0 })).toEqual({
      '--ai-viewport-inset-top': '2.5rem',
      '--ai-viewport-inset-right': '0.25rem',
      '--ai-viewport-inset-bottom': '1rem',
      '--ai-viewport-inset-left': '0rem',
    });
  });

  it('none: zero, ignoring the rem values', () => {
    const vars = getViewportVariables({ mode: 'none', top: 3, right: 3, bottom: 3, left: 3 });
    expect(Object.values(vars)).toEqual(['0rem', '0rem', '0rem', '0rem']);
  });

  it('clamps negative and non-finite values to 0 in auto and manual', () => {
    const bad = { top: -3, right: NaN, bottom: Infinity, left: undefined as unknown as number };
    const manual = getViewportVariables({ mode: 'manual', ...bad });
    expect(Object.values(manual)).toEqual(['0rem', '0rem', '0rem', '0rem']);
    expect(getViewportVariables({ mode: 'auto', ...bad })['--ai-viewport-inset-top']).toContain(', 0rem)');
  });

  it('treats a persisted state without a mode as auto', () => {
    const vars = getViewportVariables({ top: 0 } as never);
    expect(vars['--ai-viewport-inset-right']).toContain('env(safe-area-inset-right');
  });

  it('declares fieldVars so a partial override emits only the variables it touches', () => {
    expect(ViewportThemeSlice.fieldVars?.top).toEqual(['--ai-viewport-inset-top']);
    expect(ViewportThemeSlice.fieldVars?.left).toEqual(['--ai-viewport-inset-left']);
    expect(ViewportThemeSlice.fieldVars?.mode).toHaveLength(4);
  });

  it('readers use the vars with a 0px fallback', () => {
    expect(VIEWPORT_INSET.top).toBe('var(--ai-viewport-inset-top, 0px)');
    expect(VIEWPORT_EDGES).toEqual(VIEWPORT_INSET);
  });
});
