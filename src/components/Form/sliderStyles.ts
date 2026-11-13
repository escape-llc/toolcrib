import type React from 'react';
import { INVALID_COLOR } from './useFieldInvalid';

// Shared by Slider and RangeSlider so the two render identically -- a
// single-thumb and a two-thumb slider side by side in the same form must
// not drift apart in track height, fill color, or thumb shape. Deliberately
// not tagged @barrelExport: internal styling, not public API.

export type SliderOrientation = 'horizontal' | 'vertical';

/** `vars` is a slice's CSS-custom-property map (`getSparseVariables`'s result), spread last so a per-instance override wins. */
export function sliderRootStyle(disabled: boolean, vars: object, orientation: SliderOrientation = 'horizontal'): React.CSSProperties {
  return {
    ...(orientation === 'vertical' ? { height: '100%' } : { width: '100%' }),
    opacity: disabled ? 0.6 : 1,
    ...vars,
  };
}

/** The pointer area (Base UI's `Slider.Control`): the whole row a press or drag lands on, not just the thin track. */
export function sliderControlStyle(disabled: boolean, orientation: SliderOrientation = 'horizontal'): React.CSSProperties {
  const vertical = orientation === 'vertical';
  return {
    position: 'relative',
    display: 'flex',
    flexDirection: vertical ? 'column' : 'row',
    alignItems: 'center',
    userSelect: 'none',
    touchAction: 'none',
    ...(vertical ? { height: '100%', width: '1.25rem' } : { width: '100%', height: '1.25rem' }),
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

/**
 * The track, with an error ring when the slider is invalid (the thumb's focus
 * ring owns `outline`). `detents` is the number of steps (max − min) / step:
 * with the slice's `detents` on and at most 32 steps, a tick is drawn at every
 * step (behind the fill), the way a stepped fader shows its positions.
 */
export function sliderTrackStyle(invalid: boolean, orientation: SliderOrientation = 'horizontal', detents?: number): React.CSSProperties {
  const vertical = orientation === 'vertical';
  const tick = 'var(--ai-slider-detents, transparent)';
  const ticks = detents && detents >= 2 && detents <= 32
    ? `repeating-linear-gradient(${vertical ? 'to top' : 'to right'}, ${tick} 0 0.0625rem, transparent 0.0625rem calc((100% - 0.0625rem) / ${detents}))`
    : undefined;
  return {
    // Longhands only, and backgroundImage always set: a `background` shorthand
    // plus a sometimes-present `backgroundImage` makes React warn (and can
    // leave a stale image) when detents toggle on a live slider.
    backgroundColor: 'var(--ai-border, #d1d5db)',
    backgroundImage: ticks ?? 'none',
    position: 'relative',
    flexGrow: 1,
    borderRadius: 'var(--ai-radius-lg, 0.625rem)',
    ...(vertical ? { width: 'var(--ai-slider-track-height, 0.375rem)' } : { height: 'var(--ai-slider-track-height, 0.375rem)' }),
    ...(invalid ? { boxShadow: `0 0 0 0.125rem ${INVALID_COLOR}` } : {}),
  };
}

export function sliderRangeStyle(orientation: SliderOrientation = 'horizontal'): React.CSSProperties {
  return {
    position: 'absolute',
    background: 'var(--ai-color-primary, #3b82f6)',
    borderRadius: 'var(--ai-radius-lg, 0.625rem)',
    ...(orientation === 'vertical' ? { width: '100%' } : { height: '100%' }),
  };
}

// No position/offset here: Base UI positions the thumb itself (absolute,
// inset along the track, translated -50% to center on the value).
// Width is across the track and height along it for a horizontal slider;
// a vertical slider swaps them, and takes the face whose centre line runs
// across the track (see SliderSlice's `thumbShape`).
export function sliderThumbStyle(disabled: boolean, orientation: SliderOrientation = 'horizontal'): React.CSSProperties {
  const vertical = orientation === 'vertical';
  return {
    display: 'block',
    boxSizing: 'border-box',
    width: vertical ? 'var(--ai-slider-thumb-height, var(--ai-slider-thumb-size, 1.125rem))' : 'var(--ai-slider-thumb-width, var(--ai-slider-thumb-size, 1.125rem))',
    height: vertical ? 'var(--ai-slider-thumb-width, var(--ai-slider-thumb-size, 1.125rem))' : 'var(--ai-slider-thumb-height, var(--ai-slider-thumb-size, 1.125rem))',
    background: vertical ? 'var(--ai-slider-thumb-face-vertical, var(--ai-bg-surface, #ffffff))' : 'var(--ai-slider-thumb-face, var(--ai-bg-surface, #ffffff))',
    border: '0.125rem solid var(--ai-color-primary, #3b82f6)',
    borderRadius: 'var(--ai-slider-thumb-radius, 50%)',
    boxShadow: 'var(--ai-shadow-sm, 0 0.0625rem 0.25rem rgba(0,0,0,0.2))',
    outline: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}
