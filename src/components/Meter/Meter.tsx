'use client';

import React from 'react';
import { Meter as BaseMeter } from '@base-ui/react/meter';
import { useResolvedSubtheme } from '../../theme/useSliceOverrides';
import { resolveSubtheme, type SubthemeName } from '../../theme/subtheme';

/**
 * Props for the `<Meter>` gauge.
 *
 * A meter shows a value within a known range (disk usage, a quota, password
 * strength, a score). That is a different thing from `<Progress>`, which shows
 * how far a task has got: a meter has no "done", and a high reading can be
 * good or bad. `low`/`high`/`optimum` follow the HTML `<meter>` element, so
 * the bar colours itself by whether the value sits in the good, middling or
 * bad part of the range.
 */
export interface MeterProps {
  /**
   * Accessible name for the underlying `role="meter"` element. Required, as
   * on `<Progress>`: a meter has no text content ARIA can derive a name from.
   */
  'aria-label': string;
  /** Current value, between `min` and `max`. Out-of-range values are clamped. */
  value: number;
  /** Lowest value of the range. @default 0 */
  min?: number;
  /** Highest value of the range. @default 100 */
  max?: number;
  /**
   * Upper edge of the "low" part of the range. With `high` and `optimum`,
   * turns on band colouring. @default min
   */
  low?: number;
  /**
   * Lower edge of the "high" part of the range. @default max
   */
  high?: number;
  /**
   * The ideal value, which says which end of the range is good. Put it in the
   * low part (disk usage) and a high reading shows the error colour; put it in the high
   * part (battery, strength) and a low reading does. Band colouring is off
   * until at least one of `low`, `high` or `optimum` is set.
   * @default the middle of the range
   */
  optimum?: number;
  /** Visible caption above the bar, also wired up as its label. */
  label?: string;
  /** Show the formatted value beside the caption. @default false */
  showValue?: boolean;
  /** Options for formatting the value, e.g. `{ style: 'percent' }`. @default percent of the range */
  format?: Intl.NumberFormatOptions;
  /** Bar thickness. @default 'md' */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Apply a subtheme colour to the whole bar, which wins over band colouring.
   * Falls back to the nearest `<StyleDomainProvider>`'s if omitted.
   */
  subtheme?: SubthemeName;
}

type MeterBand = 'optimal' | 'suboptimal' | 'critical';

const SIZE_HEIGHT: Record<NonNullable<MeterProps['size']>, string> = {
  sm: '0.375rem',
  md: '0.5rem',
  lg: '0.75rem',
};

const BAND_SUBTHEME: Record<MeterBand, SubthemeName> = {
  optimal: 'success',
  suboptimal: 'warning',
  critical: 'error',
};

/** Which third of the range a number sits in: 0 below `low`, 2 above `high`. */
function region(n: number, low: number, high: number): 0 | 1 | 2 {
  if (n < low) return 0;
  if (n > high) return 2;
  return 1;
}

/**
 * The HTML `<meter>` rule: a value in the same region as the optimum is
 * optimal, one region away is suboptimal, two regions away is critical.
 */
function resolveBand(value: number, low: number, high: number, optimum: number): MeterBand {
  const distance = Math.abs(region(value, low, high) - region(optimum, low, high));
  return distance === 0 ? 'optimal' : distance === 1 ? 'suboptimal' : 'critical';
}

/**
 * @manifest Gauge for a value within a known range (role="meter"), with optional low/high/optimum colour bands
 * @manifestCategory Data Display
 */
export const Meter: React.FC<MeterProps> = ({
  'aria-label': ariaLabel,
  value,
  min = 0,
  max = 100,
  low,
  high,
  optimum,
  label,
  showValue = false,
  format,
  size = 'md',
  subtheme: instanceSubtheme,
}) => {
  const resolvedSubtheme = useResolvedSubtheme(instanceSubtheme);
  const clampedValue = Math.min(Math.max(value, min), max);

  const banded = low !== undefined || high !== undefined || optimum !== undefined;
  const lowEdge = Math.min(Math.max(low ?? min, min), max);
  const highEdge = Math.min(Math.max(high ?? max, lowEdge), max);
  const band = banded ? resolveBand(clampedValue, lowEdge, highEdge, optimum ?? (min + max) / 2) : undefined;

  const subthemeName = resolvedSubtheme ?? (band ? BAND_SUBTHEME[band] : undefined);
  const subthemeColors = subthemeName ? resolveSubtheme(subthemeName) : undefined;

  return (
    <BaseMeter.Root
      aria-label={ariaLabel}
      value={clampedValue}
      min={min}
      max={max}
      format={format}
      data-band={band}
      style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}
    >
      {(label || showValue) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
          {label ? (
            <BaseMeter.Label style={{ color: 'var(--ai-text-secondary, #4b5563)', fontSize: '0.875rem' }}>
              {label}
            </BaseMeter.Label>
          ) : (
            <span />
          )}
          {showValue && (
            <BaseMeter.Value style={{ color: 'var(--ai-text-primary, #111827)', fontSize: '0.875rem' }} />
          )}
        </div>
      )}
      <BaseMeter.Track
        style={{
          position: 'relative',
          overflow: 'hidden',
          width: '100%',
          height: SIZE_HEIGHT[size],
          // Shares Progress's track shape, so the two read as one family.
          borderRadius: 'var(--ai-progress-radius, 0.625rem)',
          background: 'var(--ai-bg-container, #f3f4f6)',
        }}
      >
        <BaseMeter.Indicator
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            background: subthemeColors ? subthemeColors.main : 'var(--ai-color-primary, #3b82f6)',
            borderRadius: 'inherit',
            // The var alone, not `transform ${var}` -- see Progress.tsx.
            transition: 'var(--ai-transition-normal, all 0.3s cubic-bezier(0.4, 0, 0.2, 1))',
          }}
        />
      </BaseMeter.Track>
    </BaseMeter.Root>
  );
};
