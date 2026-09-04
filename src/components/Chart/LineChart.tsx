'use client';

import React, { useMemo } from 'react';
import { Group } from '@visx/group';
import { scalePoint, scaleLinear } from '@visx/scale';
import { LinePath, Area } from '@visx/shape';
import { curveMonotoneX } from '@visx/curve';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { useTooltip } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import { getSparseVariables } from '../../theme/slice';
import { ChartThemeSlice, type ChartSliceState } from './ChartSlice';
import { ChartLegend } from './ChartLegend';
import { ChartTooltip, type ChartTooltipRow } from './ChartTooltip';
import { ChartEmptyState } from './ChartEmptyState';
import { getSeriesColor } from './chartColors';
import { type ChartSeries } from './ChartTypes';

export interface LineChartProps {
  /** X-axis category labels, one per data position. */
  categories: string[];
  /** One or more series, each with one value per `categories` entry. A single series renders one line and no legend. */
  series: ChartSeries[];
  /** SVG width in pixels. @default 480 */
  width?: number;
  /** SVG height in pixels, including the axis band. @default 280 */
  height?: number;
  /** Accessible name for the chart, and its visible caption when given. @default 'Line chart' */
  title?: string;
  /** `'line'` (default) draws unfilled lines. `'area'` fills a soft wash (~10% opacity) under each line's band-edge; with 2+ series the bands stack (cumulative), matching the toolkit's dataviz method for part-to-whole-over-time. */
  variant?: 'line' | 'area';
  /** `'bottom'` (default) wraps the legend below the chart; `'side'` places it beside the chart, stacked vertically. */
  legendPosition?: 'bottom' | 'side';
  /** Per-instance override for the chart's gridline visibility. */
  overrides?: Partial<ChartSliceState>;
}

const MARGIN = { top: 16, right: 16, bottom: 32, left: 44 };

interface HoverState {
  index: number;
}

/**
 * @manifest Multi-series line chart with a shared hover crosshair; `variant="area"` renders a stacked, filled area chart
 * @manifestCategory Data Display
 */
export const LineChart: React.FC<LineChartProps> = ({
  categories,
  series,
  width = 480,
  height = 280,
  title = 'Line chart',
  variant = 'line',
  legendPosition = 'bottom',
  overrides,
}) => {
  const isArea = variant === 'area';
  const isSide = legendPosition === 'side';
  const chartVars = getSparseVariables(ChartThemeSlice, overrides ?? {});
  const { tooltipData, tooltipLeft, tooltipOpen, showTooltip, hideTooltip } = useTooltip<HoverState>();

  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom);

  // Cumulative [bottom, top] per series per category, series stacked in
  // array order (series 0 at the baseline) -- only meaningful for
  // variant="area", but cheap enough to always compute rather than branch
  // the hook itself. A single series is just a stack of one (bottom 0).
  const stackedBands = useMemo(
    () =>
      series.map((_, si) =>
        categories.map((_, ci) => {
          const bottom = series.slice(0, si).reduce((sum, s) => sum + (s.values[ci] ?? 0), 0);
          return { bottom, top: bottom + (series[si].values[ci] ?? 0) };
        })
      ),
    [series, categories]
  );

  const maxValue = useMemo(() => {
    if (isArea) {
      let max = 0;
      for (let ci = 0; ci < categories.length; ci++) {
        let total = 0;
        for (const s of series) total += s.values[ci] ?? 0;
        max = Math.max(max, total);
      }
      return max === 0 ? 1 : max;
    }
    const all = series.flatMap(s => s.values);
    const max = all.length ? Math.max(...all, 0) : 0;
    return max === 0 ? 1 : max;
  }, [series, categories, isArea]);

  const xScale = useMemo(() => scalePoint<string>({ domain: categories, range: [0, innerWidth] }), [categories, innerWidth]);
  const yScale = useMemo(() => scaleLinear<number>({ domain: [0, maxValue], range: [innerHeight, 0] }), [maxValue, innerHeight]);

  const step = categories.length > 1 ? innerWidth / (categories.length - 1) : 0;

  const moveToIndex = (index: number) => {
    const clamped = Math.min(Math.max(index, 0), categories.length - 1);
    showTooltip({ tooltipData: { index: clamped }, tooltipLeft: MARGIN.left + clamped * step, tooltipTop: MARGIN.top });
  };

  const handlePointerMove = (event: React.PointerEvent<SVGRectElement>) => {
    const point = localPoint(event);
    if (!point || categories.length === 0) return;
    const relativeX = point.x - MARGIN.left;
    moveToIndex(step > 0 ? Math.round(relativeX / step) : 0);
  };

  const handleKeyDown = (event: React.KeyboardEvent<SVGRectElement>) => {
    const current = tooltipData?.index ?? 0;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      moveToIndex(current + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      moveToIndex(current - 1);
    } else if (event.key === 'Escape') {
      hideTooltip();
    }
  };

  const hoveredIndex = tooltipOpen && tooltipData ? Math.min(Math.max(tooltipData.index, 0), categories.length - 1) : undefined;
  const rows: ChartTooltipRow[] =
    hoveredIndex !== undefined
      ? series.map((s, i) => ({ label: s.label, value: String(s.values[hoveredIndex] ?? 0), color: getSeriesColor(i) }))
      : [];
  const overlayLabel =
    hoveredIndex !== undefined
      ? `${categories[hoveredIndex]}: ${series.map(s => `${s.label} ${s.values[hoveredIndex] ?? 0}`).join(', ')}`
      : `${title}. Use arrow keys to explore data points.`;

  if (categories.length === 0 || series.length === 0) {
    return <ChartEmptyState width={width} height={height} />;
  }

  return (
    <div style={{ position: 'relative', display: isSide ? 'inline-flex' : 'block', alignItems: isSide ? 'center' : undefined, gap: isSide ? '1.25rem' : undefined, ...chartVars }}>
      <svg width={width} height={height} role="graphics-document" aria-roledescription="line chart" aria-label={title}>
        <title>{title}</title>
        <Group left={MARGIN.left} top={MARGIN.top}>
          <g aria-hidden="true" style={{ opacity: 'var(--ai-chart-grid-opacity, 1)' } as React.CSSProperties}>
            {yScale.ticks(5).map((tick, i) => (
              <line key={i} x1={0} x2={innerWidth} y1={yScale(tick)} y2={yScale(tick)} stroke="var(--ai-border)" strokeWidth={1} />
            ))}
          </g>
          {hoveredIndex !== undefined && (
            <line
              aria-hidden="true"
              x1={xScale(categories[hoveredIndex])}
              x2={xScale(categories[hoveredIndex])}
              y1={0}
              y2={innerHeight}
              stroke="var(--ai-text-secondary)"
              strokeWidth={1}
            />
          )}
          {series.map((s, si) => {
            const color = getSeriesColor(si);
            const indices = categories.map((_, i) => i);
            // Area mode tracks each series' own STACKED top (band-edge),
            // not its raw value -- that's what visually sits at the top of
            // its fill. Line mode is unaffected: stackedBands[si][i].top
            // reduces to the raw value when nothing is stacked beneath it,
            // but line mode uses the raw value directly anyway, matching
            // pre-variant behavior exactly (no regression).
            const topY = (i: number) => (isArea ? yScale(stackedBands[si][i].top) : yScale(s.values[i] ?? 0));
            return (
              // Purely visual -- the overlay `<rect role="img">` below is
              // the sole accessible surface for this chart's data, so the
              // marks themselves (fill, edge line, hover dot) carry no
              // independent ARIA semantics of their own.
              <Group key={s.label} aria-hidden="true">
                {isArea && (
                  <Area
                    data={indices}
                    x={i => xScale(categories[i]) ?? 0}
                    y0={i => yScale(stackedBands[si][i].bottom)}
                    y1={i => yScale(stackedBands[si][i].top)}
                    fill={color}
                    fillOpacity={0.1}
                    curve={curveMonotoneX}
                  />
                )}
                <LinePath
                  data={indices}
                  x={i => xScale(categories[i]) ?? 0}
                  y={topY}
                  stroke={color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  curve={curveMonotoneX}
                />
                {hoveredIndex !== undefined && (
                  <circle
                    cx={xScale(categories[hoveredIndex])}
                    cy={topY(hoveredIndex)}
                    r={4}
                    fill={color}
                    stroke="var(--ai-bg-surface)"
                    strokeWidth={2}
                  />
                )}
              </Group>
            );
          })}
          <rect
            x={0}
            y={0}
            width={innerWidth}
            height={innerHeight}
            fill="transparent"
            tabIndex={0}
            role="img"
            aria-label={overlayLabel}
            onPointerMove={handlePointerMove}
            onPointerLeave={hideTooltip}
            onFocus={() => moveToIndex(tooltipData?.index ?? 0)}
            onBlur={hideTooltip}
            onKeyDown={handleKeyDown}
          />
          <AxisBottom
            top={innerHeight}
            scale={xScale}
            stroke="var(--ai-border)"
            tickStroke="var(--ai-border)"
            tickLabelProps={() => ({ fill: 'var(--ai-text-secondary)', fontSize: 11, textAnchor: 'middle' })}
          />
          <AxisLeft
            scale={yScale}
            numTicks={5}
            stroke="var(--ai-border)"
            tickStroke="var(--ai-border)"
            tickLabelProps={() => ({ fill: 'var(--ai-text-secondary)', fontSize: 11, textAnchor: 'end', dx: -4, dy: 4 })}
          />
        </Group>
      </svg>
      {series.length > 1 && (
        <ChartLegend items={series.map((s, i) => ({ label: s.label, color: getSeriesColor(i) }))} markShape="line" />
      )}
      {tooltipOpen && hoveredIndex !== undefined && tooltipLeft !== undefined && (
        <ChartTooltip left={tooltipLeft} top={MARGIN.top} title={categories[hoveredIndex]} rows={rows} />
      )}
    </div>
  );
};
