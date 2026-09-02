import { describe, it, expect } from 'vitest';
import { getLivingColorVariables, LivingColorThemeSlice } from '../theme/livingColor';
import { TOOLCRIB_SHARED_KEYFRAMES_CSS } from '../theme/animationKeyframes';

describe('Living Color Theme Slice Engine', () => {
  it('generates duration/easing variables when enabled', () => {
    const vars = getLivingColorVariables({ enabled: 'on', duration: 8 });
    expect(vars['--ai-living-color-duration']).toBe('8s');
    expect(vars['--ai-living-color-easing']).toBe('ease-in-out');
  });

  it('collapses to a static 0s/linear value when disabled', () => {
    const vars = getLivingColorVariables({ enabled: 'off', duration: 8 });
    expect(vars['--ai-living-color-duration']).toBe('0s');
    expect(vars['--ai-living-color-easing']).toBe('linear');
  });

  it('exports correct ThemeSlice metadata', () => {
    expect(LivingColorThemeSlice.id).toBe('livingColor');
    expect(LivingColorThemeSlice.defaultState.enabled).toBe('on');
    expect(LivingColorThemeSlice.defaultState.duration).toBe(6);
    expect(LivingColorThemeSlice.category).toBe('Layout Primitives');
  });

  it('adds its shared keyframes to the same TOOLCRIB_SHARED_KEYFRAMES_CSS constant SSR relies on', () => {
    expect(TOOLCRIB_SHARED_KEYFRAMES_CSS).toContain('@keyframes ai-color-breathe');
    expect(TOOLCRIB_SHARED_KEYFRAMES_CSS).toContain('@keyframes ai-glow-pulse');
  });
});
