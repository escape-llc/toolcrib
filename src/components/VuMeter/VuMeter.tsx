'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { VuMeterThemeSlice, type VuMeterSliceState } from './VuMeterSlice';
import { useLocaleStrings } from '../Locale/LocaleContext';

/**
 * Props for the `<VuMeter>` level meter.
 *
 * A DAW-style level meter for live, moving values: a scale filled green, amber, red by position, with an optional
 * peak hold, a backlog ("pressure") band, a limit mark, a latching alarm LED and a readout. That is a different thing
 * from `<Meter>`, a plain gauge for a value in a known range with no peak hold, backlog band or LED. A `<VuMeter>`
 * frames itself like an outline `<Button>`, so it sits in a `<UIGroup>` beside buttons and fields.
 */
export interface VuMeterProps {
  /** Level from 0 to 1. Out-of-range values are clamped. */
  level: number;
  /** Hold the highest level as a peak marker. The marker falls back to the current level on the first `level` update after 3 s; it does not decay on a timer, so a meter whose `level` stops changing keeps its last peak. @default false */
  holdPeak?: boolean;
  /** Red band along the bottom, from 0 to 1: how far something is behind (a backlog). Omitted shows no band. */
  pressure?: number;
  /** A fixed tick on the scale, from 0 to 1 (a limit, or a reference share). Omitted shows none. */
  mark?: number;
  /** Latching alarm LED: lit when true, dim when false, absent when omitted. */
  led?: boolean;
  /** Colours the readout: `warn` and `error` use the warning and error subtheme text colours. @default 'ok' */
  zone?: 'ok' | 'warn' | 'error';
  /** Readout beside the scale (for example "1.2k pkt/s"). Omitted shows none. */
  value?: string;
  /** `sm` is a compact cell for rows and strips. @default 'md' */
  size?: 'md' | 'sm';
  /** Show the scale. `false` leaves only the LED and readout. @default true */
  scale?: boolean;
  /**
   * `level` fills green, amber, red by position on the scale. `share` shows a part of a whole in one neutral colour,
   * since a big share is no alarm; `mark` is then where the whole sits.
   * @default 'level'
   */
  kind?: 'level' | 'share';
  /** Smooth the fill and the peak marker (live data). Off for static values. @default false */
  live?: boolean;
  /** Stretch the scale to the free width of the row instead of the fixed scale width. @default false */
  fill?: boolean;
  /** Draw the outline-button frame and padding. Turn it off inside a cell that already has its own frame. @default true */
  framed?: boolean;
  /** Fade the meter, for example for a muted source. @default false */
  dimmed?: boolean;
  /**
   * Accessible name for the `role="meter"` element. Required, as on `<Meter>`: a meter has no text content ARIA can
   * derive a name from.
   */
  label: string;
  /** Tooltip text. Also spoken as the value when there is no `valueText`. */
  title?: string;
  /**
   * Spoken value for assistive technology. Falls back to `title`, then to the `value` readout. While the alarm `led`
   * is lit, the alarm is announced with it (the LED itself is decorative).
   */
  valueText?: string;
  /** Per-instance override of the meter's theme values (scale thickness). */
  overrides?: Partial<VuMeterSliceState>;
}

const PEAK_HOLD_MS = 3000;
const pct = (x: number) => `${(Math.max(0, Math.min(1, x)) * 100).toFixed(1)}%`;
const LEVEL_GRADIENT =
  'linear-gradient(90deg, var(--ai-subtheme-success) 0 70%, var(--ai-subtheme-warning) 70% 88%, var(--ai-subtheme-error) 88%)';
const SHARE_FILL = 'color-mix(in srgb, var(--ai-color-primary) 75%, transparent)';
// The kit's motion tokens, so the Motion preset and reduced motion apply (the duration is 0s under reducedMotion).
const SMOOTH = 'var(--ai-transition-duration-normal, 0.22s) var(--ai-transition-easing, ease)';

/**
 * @manifest Live level meter: a scale with peak hold, backlog band, limit mark, alarm LED and readout, framed like a Button
 * @manifestCategory Data Display
 */
export const VuMeter: React.FC<VuMeterProps> = ({
  level,
  holdPeak,
  pressure,
  mark,
  led,
  zone = 'ok',
  value,
  size = 'md',
  scale = true,
  kind = 'level',
  live,
  fill,
  framed = true,
  dimmed,
  label,
  title,
  valueText,
  overrides,
}) => {
  const lv = Math.max(0, Math.min(1, level));
  const peakRef = useRef({ level: 0, at: 0 });
  const [peak, setPeak] = useState(0);
  useEffect(() => {
    if (!holdPeak) return;
    const now = performance.now();
    if (lv >= peakRef.current.level || now - peakRef.current.at > PEAK_HOLD_MS) {
      peakRef.current = { level: lv, at: now };
      setPeak(lv);
    }
  }, [lv, holdPeak]);

  const sm = size === 'sm';
  const thickness = 'var(--ai-vumeter-thickness, 1.75)';
  const scaleHeight = sm ? `min(calc(0.3rem * ${thickness}), 0.9rem)` : `calc(0.55rem * ${thickness})`;
  const zoneColor = zone === 'error' ? 'var(--ai-subtheme-error-text)' : zone === 'warn' ? 'var(--ai-subtheme-warning-text)' : undefined;
  const { vars } = useSliceOverrides(VuMeterThemeSlice, overrides);
  const strings = useLocaleStrings();
  // The readout carries the units ("1.2k pkt/s"), so it beats a bare percentage. The LED is aria-hidden, so a lit
  // alarm has to be part of the spoken value or a screen-reader user never hears it.
  const spokenValue = valueText ?? title ?? value;
  const ariaValueText = led ? strings.vuMeter.alarmOn(spokenValue ?? '') : spokenValue;

  return (
    <span
      data-vumeter=""
      data-zone={zone}
      data-size={size}
      data-kind={kind}
      data-live={live || undefined}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={+lv.toFixed(2)}
      aria-valuetext={ariaValueText}
      title={title}
      style={{
        display: fill ? 'flex' : 'inline-flex',
        flex: fill ? '1 1 auto' : undefined,
        minWidth: fill ? 0 : undefined,
        alignItems: 'center',
        gap: sm ? '0.2rem' : '0.35rem',
        boxSizing: 'border-box',
        minHeight: '1.75rem',
        padding: framed ? (sm ? '0 0.35rem' : '0 0.5rem') : 0,
        border: framed ? '0.0625rem solid var(--ai-border)' : 0,
        borderRadius: 'var(--ai-radius-md)',
        background: 'transparent',
        fontSize: 'var(--ai-text-size-xs)',
        color: 'var(--ai-text-secondary)',
        whiteSpace: 'nowrap',
        opacity: dimmed ? 0.4 : undefined,
        ...vars,
      }}
    >
      {scale && (
        <span
          data-vumeter-part="scale"
          style={{
            position: 'relative',
            display: 'block',
            flex: fill ? '1 1 auto' : 'none',
            width: fill ? 'auto' : sm ? '2.25rem' : '5.5rem',
            height: scaleHeight,
            borderRadius: '0.125rem',
            background: 'color-mix(in srgb, var(--ai-text-secondary) 18%, transparent)',
            overflow: 'hidden',
          }}
        >
          {/* The gradient spans the whole scale and is clipped to the level, so its colours sit at their scale positions at any width. */}
          <span
            data-vumeter-part="fill"
            data-level={pct(lv)}
            style={{
              position: 'absolute',
              inset: 0,
              background: kind === 'share' ? SHARE_FILL : LEVEL_GRADIENT,
              clipPath: `inset(0 ${(100 - lv * 100).toFixed(1)}% 0 0)`,
              transition: live ? `clip-path ${SMOOTH}` : undefined,
            }}
          />
          {mark !== undefined && (
            <span
              data-vumeter-part="mark"
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                width: '0.125rem',
                left: `calc(${pct(mark)} - 0.0625rem)`,
                background: kind === 'share' ? 'var(--ai-text-secondary)' : 'var(--ai-subtheme-warning)',
              }}
            />
          )}
          {holdPeak && (
            <span
              data-vumeter-part="peak"
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                width: '0.125rem',
                left: `calc(${pct(peak)} - 0.0625rem)`,
                background: 'var(--ai-text-primary)',
                opacity: 0.8,
                transition: `left ${SMOOTH}`,
              }}
            />
          )}
          {pressure !== undefined && (
            <span
              data-vumeter-part="pressure"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: `calc(${sm ? '0.1rem' : '0.2rem'} * ${thickness})`,
                background: 'color-mix(in srgb, var(--ai-subtheme-error) 75%, transparent)',
                transformOrigin: 'left',
                transform: `scaleX(${Math.max(0, Math.min(1, pressure)).toFixed(3)})`,
                transition: `transform ${SMOOTH}`,
              }}
            />
          )}
        </span>
      )}
      {led !== undefined && (
        <span
          data-vumeter-part="led"
          data-on={led}
          aria-hidden="true"
          style={{
            flex: 'none',
            width: sm ? '0.4rem' : '0.45rem',
            height: sm ? '0.4rem' : '0.45rem',
            borderRadius: '50%',
            background: led ? 'var(--ai-subtheme-error)' : 'color-mix(in srgb, var(--ai-subtheme-error) 20%, transparent)',
            boxShadow: led ? '0 0 0.35rem var(--ai-subtheme-error)' : undefined,
          }}
        />
      )}
      {value !== undefined && (
        <span
          data-vumeter-part="num"
          style={{
            fontFamily: sm ? 'inherit' : 'var(--ai-text-font-mono, monospace)',
            fontSize: sm ? '0.6rem' : undefined,
            fontVariantNumeric: 'tabular-nums',
            minWidth: sm ? '3rem' : '4.5rem',
            textAlign: 'right',
            color: zoneColor,
          }}
        >
          {value}
        </span>
      )}
    </span>
  );
};
