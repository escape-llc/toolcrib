'use client';

import React, { useMemo } from 'react';
import { Group } from '@visx/group';
import { scaleBand, scaleLinear } from '@visx/scale';
import { BarRounded } from '@visx/shape';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { useTooltip } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import { getSparseVariables } from '../../theme/slice';
import { ChartThemeSlice, type ChartSliceState } from './ChartSlice';
import { ChartLegend } from './ChartLegend';
import { ChartTooltip } from './ChartTooltip';
import { ChartEmptyState } from './ChartEmptyState';
import { getSeriesColor } from './chartColors';
import { type ChartSeries } from './ChartTypes';

export interface BarChartProps {
  /** X-axis category labels, one per data position. */
  categories: string[];
  /** One or more series, each with one value per `categories` entry. A single series renders ungrouped bars and no legend. */
  series: ChartSeries[];
  /** SVG width in pixels. @default 480 */
  width?: number;
  /** SVG height in pixels, including the axis band. @default 280 */
  height?: number;
  /** Accessible name for the chart, and its visible caption when given. @default 'Bar chart' */
  title?: string;
  /** `'bottom'` (default) wraps the legend below the chart; `'side'` places it beside the chart, stacked vertically. */
  legendPosition?: 'bottom' | 'side';
  /** Per-instance override for the chart's gridline visibility. */
  overrides?: Partial<ChartSliceState>;
}

const MARGIN = { top: 16, right: 16, bottom: 32, left: 44 };
const MAX_BAR_THICKNESS = 24;

interface HoverDatum {
  category: string;
  seriesLabel: string;
  value: number;
  color: string;
}

/**
 * @manifest Grouped vertical bar chart for categorical comparisons
 * @manifestCategory Data Display
 */
export const BarChart: React.FC<BarChartProps> = ({
  categories,
  series,
  width = 480,
  height = 280,
  title = 'Bar chart',
  legendPosition = 'bottom',
  overrides,
}) => {
  const isSide = legendPosition === 'side';
  const chartVars = getSparseVariables(ChartThemeSlice, overrides ?? {});
  const { tooltipData, tooltipLeft, tooltipTop, tooltipOpen, showTooltip, hideTooltip } = useTooltip<HoverDatum>();

  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom);

  const maxValue = useMemo(() => {
    const all = series.flatMap(s => s.values);
    const max = all.length ? Math.max(...all, 0) : 0;
    return max === 0 ? 1 : max;
  }, [series]);

  const categoryScale = useMemo(
    () => scaleBand<string>({ domain: categories, range: [0, innerWidth], padding: 0.3 }),
    [categories, innerWidth]
  );
  const seriesScale = useMemo(
    () => scaleBand<number>({ domain: series.map((_, i) => i), range: [0, categoryScale.bandwidth()], padding: 0.15 }),
    [series, categoryScale]
  );
  const valueScale = useMemo(
    () => scaleLinear<number>({ domain: [0, maxValue], range: [innerHeight, 0] }),
    [maxValue, innerHeight]
  );

  const handleHover = (event: React.PointerEvent, datum: HoverDatum, barX: number, barY: number) => {
    const point = localPoint(event) ?? { x: barX, y: barY };
    showTooltip({ tooltipData: datum, tooltipLeft: point.x, tooltipTop: point.y });
  };

  if (categories.length === 0 || series.length === 0) {
    return <ChartEmptyState width={width} height={height} />;
  }

  return (
    <div style={{ position: 'relative', display: isSide ? 'inline-flex' : 'block', alignItems: isSide ? 'center' : undefined, gap: isSide ? '1.25rem' : undefined, ...chartVars }}>
      <svg width={width} height={height} role="graphics-document" aria-roledescription="bar chart" aria-label={title}>
        <title>{title}</title>
        <Group left={MARGIN.left} top={MARGIN.top}>
          <g aria-hidden="true" style={{ opacity: 'var(--ai-chart-grid-opacity, 1)' } as React.CSSProperties}>
            {valueScale.ticks(5).map((tick, i) => (
              <line
                key={i}
                x1={0}
                x2={innerWidth}
                y1={valueScale(tick)}
                y2={valueScale(tick)}
                stroke="var(--ai-border)"
                strokeWidth={1}
              />
            ))}
          </g>
          {categories.map((category, ci) => {
            const bandX = categoryScale(category) ?? 0;
            return (
              <Group key={category} left={bandX}>
                {series.map((s, si) => {
                  const value = s.values[ci] ?? 0;
                  const subX = seriesScale(si) ?? 0;
                  const subBandwidth = seriesScale.bandwidth();
                  const barWidth = Math.min(subBandwidth, MAX_BAR_THICKNESS);
                  const centeredX = subX + (subBandwidth - barWidth) / 2;
                  const barY = valueScale(value);
                  const barHeight = innerHeight - barY;
                  const color = getSeriesColor(si);
                  const isHovered =
                    tooltipOpen && tooltipData?.category === category && tooltipData?.seriesLabel === s.label;
                  return (
                    <BarRounded
                      key={s.label}
                      x={centeredX}
                      y={barY}
                      width={barWidth}
                      height={Math.max(barHeight, 0)}
                      radius={4}
                      top
                      fill={color}
                      stroke={isHovered ? 'var(--ai-bg-surface)' : 'none'}
                      style={
                        isHovered
                          ? ({
                              strokeWidth: 'var(--ai-chart-hover-ring-width, 0.125rem)',
                              filter: 'brightness(var(--ai-chart-hover-brightness, 1.1))',
                            } as React.CSSProperties)
                          : undefined
                      }
                      role="graphics-symbol"
                      aria-roledescription="bar"
                      aria-label={`${category}, ${s.label}: ${value}`}
                      onPointerMove={e =>
                        handleHover(e, { category, seriesLabel: s.label, value, color }, bandX + centeredX + barWidth / 2, barY)
                      }
                      onPointerLeave={hideTooltip}
                      onFocus={() => showTooltip({ tooltipData: { category, seriesLabel: s.label, value, color }, tooltipLeft: bandX + centeredX + barWidth / 2, tooltipTop: barY })}
                      onBlur={hideTooltip}
                      tabIndex={0}
                    />
                  );
                })}
              </Group>
            );
          })}
          <AxisBottom
            top={innerHeight}
            scale={categoryScale}
            stroke="var(--ai-border)"
            tickStroke="var(--ai-border)"
            tickLabelProps={() => ({ fill: 'var(--ai-text-secondary)', fontSize: 11, textAnchor: 'middle' })}
          />
          <AxisLeft
            scale={valueScale}
            numTicks={5}
            stroke="var(--ai-border)"
            tickStroke="var(--ai-border)"
            tickLabelProps={() => ({ fill: 'var(--ai-text-secondary)', fontSize: 11, textAnchor: 'end', dx: -4, dy: 4 })}
          />
        </Group>
      </svg>
      {series.length > 1 && (
        <ChartLegend
          items={series.map((s, i) => ({ label: s.label, color: getSeriesColor(i) }))}
          markShape="rect"
          direction={isSide ? 'column' : 'row'}
        />
      )}
      {tooltipOpen && tooltipData && tooltipLeft !== undefined && tooltipTop !== undefined && (
        <ChartTooltip
          left={tooltipLeft}
          top={tooltipTop}
          title={tooltipData.category}
          rows={[{ label: tooltipData.seriesLabel, value: String(tooltipData.value), color: tooltipData.color }]}
        />
      )}
    </div>
  );
};
