import { describe, it, expect } from 'vitest';
import { getAnimationVariables, AnimationThemeSlice } from '../theme/animation';

describe('Animation & Transition Theme Slice Engine', () => {
  it('generates correct CSS variables for smooth animation preset', () => {
    const vars = getAnimationVariables({
      preset: 'smooth',
      speed: 1.0,
      enableHoverEffects: true,
      reducedMotion: 'never',
    });

    expect(vars['--ai-transition-duration-normal']).toBe('220ms');
    expect(vars['--ai-transition-easing']).toBe('cubic-bezier(0.4, 0, 0.2, 1)');
    expect(vars['--ai-hover-transform']).toBe('translateY(-0.125rem) scale(1.01)');
  });

  it('generates spring cubic-bezier easing for spring preset', () => {
    const vars = getAnimationVariables({
      preset: 'spring',
      speed: 1.0,
      enableHoverEffects: true,
      reducedMotion: 'never',
    });

    expect(vars['--ai-transition-duration-normal']).toBe('300ms');
    expect(vars['--ai-transition-easing']).toBe('cubic-bezier(0.34, 1.56, 0.64, 1)');
  });

  it('collapses all transitions to 0s when reducedMotion is set to always', () => {
    const vars = getAnimationVariables({
      preset: 'smooth',
      speed: 1.0,
      enableHoverEffects: true,
      reducedMotion: 'always',
    });

    expect(vars['--ai-transition-duration-normal']).toBe('0s');
    expect(vars['--ai-transition-fast']).toBe('none');
    expect(vars['--ai-hover-transform']).toBe('none');
  });

  it('exports correct ThemeSlice metadata', () => {
    expect(AnimationThemeSlice.id).toBe('animation');
    expect(AnimationThemeSlice.defaultState.preset).toBe('smooth');
  });
});
