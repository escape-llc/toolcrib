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

  it('floors every duration tier at a minimum perceptible value, while keeping the three tiers distinguishable from each other', () => {
    // snappy's own base durations (80/160/280ms) at the slowest allowed
    // speed multiplier (0.5x) compute to 40/80/140ms before flooring --
    // all three below their own floor, and confirmed for real (not just
    // reasoned about) to be imperceptible at the focus ring's own 120ms
    // case before this floor existed. Each tier has its own floor (not one
    // shared value) specifically so this worst case still has three
    // distinct, individually perceptible durations, not one flat value --
    // three tiers you can't tell apart isn't meaningfully different from
    // having one.
    const vars = getAnimationVariables({
      preset: 'snappy',
      speed: 0.5,
      enableHoverEffects: true,
      reducedMotion: 'never',
    });

    expect(vars['--ai-transition-duration-fast']).toBe('150ms');
    expect(vars['--ai-transition-duration-normal']).toBe('220ms');
    expect(vars['--ai-transition-duration-slow']).toBe('300ms');
  });

  it.each(['subtle', 'smooth', 'snappy', 'spring'] as const)(
    'keeps fast < normal < slow strictly ordered for %s at the slowest allowed speed (worst case for the floor)',
    preset => {
      const vars = getAnimationVariables({ preset, speed: 0.5, enableHoverEffects: true, reducedMotion: 'never' });
      const fast = parseInt(vars['--ai-transition-duration-fast'], 10);
      const normal = parseInt(vars['--ai-transition-duration-normal'], 10);
      const slow = parseInt(vars['--ai-transition-duration-slow'], 10);
      expect(fast).toBeLessThan(normal);
      expect(normal).toBeLessThan(slow);
    }
  );

  it('does not apply the perceptibility floor when motion is explicitly disabled', () => {
    // preset:'none' and reducedMotion:'always' are a deliberate request for
    // zero motion, not a speed the floor should second-guess -- confirm
    // both still collapse to a real 0s, not the 150ms floor.
    const none = getAnimationVariables({ preset: 'none', speed: 1.0, enableHoverEffects: true, reducedMotion: 'never' });
    expect(none['--ai-transition-duration-normal']).toBe('0s');

    const reduced = getAnimationVariables({ preset: 'smooth', speed: 1.0, enableHoverEffects: true, reducedMotion: 'always' });
    expect(reduced['--ai-transition-duration-normal']).toBe('0s');
  });

  it('exports correct ThemeSlice metadata', () => {
    expect(AnimationThemeSlice.id).toBe('animation');
    expect(AnimationThemeSlice.defaultState.preset).toBe('smooth');
  });
});
