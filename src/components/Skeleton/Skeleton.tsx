import React from 'react';
import { type StyleFreeAttributes, warnIfLegacyStyleProps } from '../../theme/safeProps';

/** Props for the `<Skeleton>` loading placeholder. */
export interface SkeletonProps extends StyleFreeAttributes<HTMLDivElement> {
  /**
   * Shape primitive.
   * - `'text'` — A single line of text, rounded, `1em`-ish tall.
   * - `'circle'` — A circle (avatar-shaped placeholder).
   * - `'rect'` — A rectangle with mild corner rounding (image/card placeholder).
   * @default 'text'
   */
  shape?: 'text' | 'circle' | 'rect';
  /** Width as a CSS value. @default '100%' for `'text'`/`'rect'`, matches `height` for `'circle'` */
  width?: string;
  /** Height as a CSS value. @default '1rem' for `'text'`, '100%' for `'rect'`, matches `width` for `'circle'` */
  height?: string;
}

/**
 * @manifest Shimmering loading placeholder in text/circle/rect shapes
 * @manifestCategory Data Display
 * @manifestAntiPatternAvoid Hand-roll a pulsing/shimmering loading placeholder `<div>` for content that hasn't loaded yet
 * @manifestAntiPatternInstead Use `<Skeleton shape="text"|"circle"|"rect">` — already animates off the shared keyframes, not a one-off duration
 */
export const Skeleton: React.FC<SkeletonProps> = ({ shape = 'text', width, height, ...props }) => {
  warnIfLegacyStyleProps(props, 'Skeleton');

  const resolvedWidth = width ?? (shape === 'circle' ? height ?? '2.5rem' : '100%');
  const resolvedHeight = height ?? (shape === 'circle' ? resolvedWidth : shape === 'rect' ? '8rem' : '1rem');
  const borderRadius = shape === 'circle' ? '999rem' : shape === 'rect' ? 'var(--ai-radius-md, 0.375rem)' : 'var(--ai-radius-sm, 0.25rem)';

  return (
    <div
      role="presentation"
      aria-hidden="true"
      {...props}
      style={{
        width: resolvedWidth,
        height: resolvedHeight,
        borderRadius,
        // A moving gradient sweeping across a flat base colour, not a
        // pulsing opacity -- the base colour comes from --ai-bg-container,
        // the sweep highlight from --ai-bg-surface, so the shimmer already
        // matches whatever surface/container contrast the active theme
        // resolves, light or dark, with no colour of its own to override.
        background:
          'linear-gradient(90deg, var(--ai-bg-container, #e5e7eb) 25%, var(--ai-bg-surface, #f3f4f6) 50%, var(--ai-bg-container, #e5e7eb) 75%)',
        backgroundSize: '200% 100%',
        animation: 'ai-skeleton-shimmer 1.5s ease-in-out infinite',
      }}
    />
  );
};
