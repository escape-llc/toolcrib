'use client';

import React, { useMemo } from 'react';
import { scaleLinear } from '@visx/scale';
import { LinePath } from '@visx/shape';
import { curveMonotoneX } from '@visx/curve';

export interface SparklineProps {
  /** Sequential values forming the trend line, oldest first. */
  values: number[];
  /** SVG width in pixels. @default 80 */
  width?: number;
  /** SVG height in pixels. @default 24 */
  height?: number;
  /** Accessible name. @default 'Trend sparkline' */
  title?: string;
}

/**
 * Minimal inline trend line for a stat tile — no axes, legend, or tooltip
 * by design (the dataviz method's own exception to "interactive by
 * default": a bare figure accessory this small has no room for a hit
 * target, and the tile's own delta badge already carries the accessible
 * up/down reading). Renders in the de-emphasis ink with the current period
 * picked out in the theme's accent color, per the toolkit's stat-tile
 * figure contract.
 * @manifest Minimal inline trend line for a stat tile
 * @manifestCategory Data Display
 */
export const Sparkline: React.FC<SparklineProps> = ({ values, width = 80, height = 24, title = 'Trend sparkline' }) => {
  const padding = 2;
  const xScale = useMemo(
    () => scaleLinear<number>({ domain: [0, Math.max(values.length - 1, 1)], range: [padding, width - padding] }),
    [values.length, width]
  );
  const yScale = useMemo(() => {
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 1;
    const domain = min === max ? [min - 1, max + 1] : [min, max];
    return scaleLinear<number>({ domain, range: [height - padding, padding] });
  }, [values, height]);

  const lastValue = values[values.length - 1];
  const lastX = xScale(values.length - 1);
  const lastY = lastValue !== undefined ? yScale(lastValue) : 0;

  return (
    <svg width={width} height={height} role="img" aria-label={title}>
      <title>{title}</title>
      <LinePath
        data={values}
        x={(_, i) => xScale(i)}
        y={d => yScale(d)}
        stroke="var(--ai-text-secondary)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        curve={curveMonotoneX}
      />
      {lastValue !== undefined && <circle cx={lastX} cy={lastY} r={2} fill="var(--ai-color-accent)" />}
    </svg>
  );
};
