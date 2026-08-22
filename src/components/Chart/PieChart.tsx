import React, { useMemo } from 'react';
import { Group } from '@visx/group';
import { Pie } from '@visx/shape';
import { useTooltip } from '@visx/tooltip';
import { ChartLegend } from './ChartLegend';
import { ChartTooltip } from './ChartTooltip';
import { ChartEmptyState } from './ChartEmptyState';
import { getSeriesColor } from './chartColors';

export interface PieChartDatum {
  label: string;
  value: number;
}

export interface PieChartProps {
  /** Slices to render. More than 8 are folded: the largest 7 keep their own slice, the rest merge into "Other" — a chart never generates a 9th categorical hue (see `chartColors.ts`). */
  data: PieChartDatum[];
  /** SVG width and height in pixels — pie charts render square, so only the smaller of the two is used. @default 320 */
  width?: number;
  /** @default 320 */
  height?: number;
  /** Fraction of the outer radius left as a hole, for a donut. `0` (default) renders a full pie. */
  innerRadius?: number;
  /** Accessible name for the chart. @default 'Pie chart' */
  title?: string;
  /** `'bottom'` (default) wraps the legend below the ring; `'side'` places it beside the ring, stacked vertically — the more common layout for a donut. */
  legendPosition?: 'bottom' | 'side';
}

const MAX_SLICES = 8;

function foldToOther(data: PieChartDatum[]): PieChartDatum[] {
  if (data.length <= MAX_SLICES) return data;
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const kept = sorted.slice(0, MAX_SLICES - 1);
  const rest = sorted.slice(MAX_SLICES - 1);
  const otherValue = rest.reduce((sum, d) => sum + d.value, 0);
  return [...kept, { label: 'Other', value: otherValue }];
}

interface HoverDatum {
  label: string;
  value: number;
  percent: number;
  color: string;
}

/**
 * Part-to-whole pie/donut chart. Per the toolkit's dataviz method, a
 * stacked `BarChart` reads comparisons more reliably than a pie once
 * values are close or slices exceed ~6 — reach for `PieChart` for an
 * at-a-glance whole, not close-value comparison.
 * @manifest Part-to-whole pie or donut chart
 * @manifestCategory Data Display
 */
export const PieChart: React.FC<PieChartProps> = ({
  data,
  width = 320,
  height = 320,
  innerRadius = 0,
  title = 'Pie chart',
  legendPosition = 'bottom',
}) => {
  const { tooltipData, tooltipLeft, tooltipTop, tooltipOpen, showTooltip, hideTooltip } = useTooltip<HoverDatum>();

  const folded = useMemo(() => foldToOther(data), [data]);
  const total = useMemo(() => folded.reduce((sum, d) => sum + d.value, 0), [folded]);

  const size = Math.min(width, height);
  const outerRadius = size / 2 - 8;
  const innerRadiusPx = outerRadius * Math.min(Math.max(innerRadius, 0), 0.95);
  const padRadius = (innerRadiusPx + outerRadius) / 2;
  const padAngle = padRadius > 0 ? 2 / padRadius : 0;

  const handleHover = (datum: PieChartDatum, color: string, centroid: [number, number]) => {
    showTooltip({
      tooltipData: { label: datum.label, value: datum.value, percent: total > 0 ? datum.value / total : 0, color },
      tooltipLeft: width / 2 + centroid[0],
      tooltipTop: height / 2 + centroid[1],
    });
  };

  const isSide = legendPosition === 'side';

  if (data.length === 0) {
    return <ChartEmptyState width={width} height={height} />;
  }

  return (
    <div style={{ position: 'relative', display: isSide ? 'inline-flex' : 'block', alignItems: isSide ? 'center' : undefined, gap: isSide ? '1.25rem' : undefined }}>
      <svg width={width} height={height} role="graphics-document" aria-roledescription="pie chart" aria-label={title}>
        <title>{title}</title>
        <Group top={height / 2} left={width / 2}>
          <Pie
            data={folded}
            pieValue={d => d.value}
            outerRadius={outerRadius}
            innerRadius={innerRadiusPx}
            padAngle={padAngle}
            padRadius={padRadius}
          >
            {pie =>
              pie.arcs.map((arc, i) => {
                const color = getSeriesColor(i);
                const isHovered = tooltipOpen && tooltipData?.label === arc.data.label;
                const centroid = pie.path.centroid(arc);
                const percent = total > 0 ? (arc.data.value / total) * 100 : 0;
                return (
                  <path
                    key={arc.data.label}
                    d={pie.path(arc) ?? undefined}
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
                    aria-roledescription="slice"
                    aria-label={`${arc.data.label}: ${arc.data.value} (${percent.toFixed(1)}%)`}
                    onPointerMove={() => handleHover(arc.data, color, centroid)}
                    onPointerLeave={hideTooltip}
                    onFocus={() => handleHover(arc.data, color, centroid)}
                    onBlur={hideTooltip}
                    tabIndex={0}
                  />
                );
              })
            }
          </Pie>
        </Group>
      </svg>
      {folded.length > 1 && (
        <ChartLegend
          items={folded.map((d, i) => ({ label: d.label, color: getSeriesColor(i) }))}
          markShape="rect"
          direction={isSide ? 'column' : 'row'}
        />
      )}
      {tooltipOpen && tooltipData && tooltipLeft !== undefined && tooltipTop !== undefined && (
        <ChartTooltip
          left={tooltipLeft}
          top={tooltipTop}
          rows={[
            {
              label: tooltipData.label,
              value: `${tooltipData.value} (${(tooltipData.percent * 100).toFixed(1)}%)`,
              color: tooltipData.color,
            },
          ]}
        />
      )}
    </div>
  );
};
