import type React from 'react';

// Shared by Slider and RangeSlider so the two render identically -- a
// single-thumb and a two-thumb slider side by side in the same form must
// not drift apart in track height, fill color, or thumb shape. Deliberately
// not tagged @barrelExport: internal styling, not public API.

/** `vars` is a slice's CSS-custom-property map (`getSparseVariables`'s result), spread last so a per-instance override wins. */
export function sliderRootStyle(disabled: boolean, vars: object): React.CSSProperties {
  return {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    userSelect: 'none',
    touchAction: 'none',
    width: '100%',
    height: '1.25rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    ...vars,
  };
}

export const SLIDER_TRACK_STYLE: React.CSSProperties = {
  background: 'var(--ai-border, #d1d5db)',
  position: 'relative',
  flexGrow: 1,
  borderRadius: 'var(--ai-radius-lg, 0.625rem)',
  height: 'var(--ai-slider-track-height, 0.375rem)',
};

export const SLIDER_RANGE_STYLE: React.CSSProperties = {
  position: 'absolute',
  background: 'var(--ai-color-primary, #3b82f6)',
  borderRadius: 'var(--ai-radius-lg, 0.625rem)',
  height: '100%',
};

export function sliderThumbStyle(disabled: boolean): React.CSSProperties {
  return {
    display: 'block',
    width: 'var(--ai-slider-thumb-size, 1.125rem)',
    height: 'var(--ai-slider-thumb-size, 1.125rem)',
    background: 'var(--ai-bg-surface, #ffffff)',
    border: '0.125rem solid var(--ai-color-primary, #3b82f6)',
    borderRadius: '50%',
    boxShadow: 'var(--ai-shadow-sm, 0 0.0625rem 0.25rem rgba(0,0,0,0.2))',
    outline: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}
