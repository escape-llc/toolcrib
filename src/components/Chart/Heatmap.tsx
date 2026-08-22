import React, { useMemo } from 'react';
import { Group } from '@visx/group';
import { scaleBand } from '@visx/scale';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { useTooltip } from '@visx/tooltip';
import { ChartTooltip } from './ChartTooltip';
import { ChartEmptyState } from './ChartEmptyState';
import { ScaleLegend } from './ScaleLegend';
import { sequentialColor } from './sequentialColor';

export interface HeatmapProps {
  /** Column labels, x-axis. */
  columns: string[];
  /** Row labels, y-axis. */
  rows: string[];
  /** Cell values, indexed `[rowIndex][columnIndex]`, same order as `rows`/`columns`. */
  values: number[][];
  /** SVG width in pixels. @default 480 */
  width?: number;
  /** SVG height in pixels, including the axis band. @default 280 */
  height?: number;
  /** Accessible name for the chart. @default 'Heatmap' */
  title?: string;
  /** Formats a cell's value for its tooltip/accessible label. @default String(value) */
  formatValue?: (value: number) => string;
}

const MARGIN = { top: 16, right: 16, bottom: 32, left: 72 };

interface HoverDatum {
  row: string;
  col: string;
  value: number;
}

/**
 * Magnitude grid — one hue, light-to-dark, unlike the fixed categorical
 * palette the other charts use. A sequential ramp has no adjacent-hue
 * collision to guard against (it's a single hue at varying strength, which
 * *is* the encoding), so unlike `chartColors.ts`'s fixed palette, this one
 * safely tracks the active theme's own primary color via `color-mix()` —
 * the same technique `FileUpload`'s drag-over tint already uses. The
 * lightest cells recede toward the surface rather than disappearing
 * entirely, so a near-zero value still reads as a grid cell.
 * @manifest Row/column magnitude grid with a theme-tracking sequential ramp
 * @manifestCategory Data Display
 */
export const Heatmap: React.FC<HeatmapProps> = ({
  columns,
  rows,
  values,
  width = 480,
  height = 280,
  title = 'Heatmap',
  formatValue = (v: number) => String(v),
}) => {
  const { tooltipData, tooltipLeft, tooltipTop, tooltipOpen, showTooltip, hideTooltip } = useTooltip<HoverDatum>();

  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom);

  const [minValue, maxValue] = useMemo(() => {
    const flat = values.flat();
    if (!flat.length) return [0, 1];
    return [Math.min(...flat), Math.max(...flat)];
  }, [values]);

  const columnScale = useMemo(
    () => scaleBand<string>({ domain: columns, range: [0, innerWidth], padding: 0.08 }),
    [columns, innerWidth]
  );
  const rowScale = useMemo(() => scaleBand<string>({ domain: rows, range: [0, innerHeight], padding: 0.08 }), [rows, innerHeight]);

  const cellColor = (value: number): string => {
    const span = maxValue - minValue;
    const normalized = span > 0 ? (value - minValue) / span : 0.5;
    return sequentialColor(normalized);
  };

  const handleHover = (row: string, col: string, value: number, cx: number, cy: number) => {
    showTooltip({ tooltipData: { row, col, value }, tooltipLeft: cx, tooltipTop: cy });
  };

  if (rows.length === 0 || columns.length === 0) {
    return <ChartEmptyState width={width} height={height} />;
  }

  return (
    <div style={{ position: 'relative', width }}>
      <svg width={width} height={height} role="graphics-document" aria-roledescription="heatmap" aria-label={title}>
        <title>{title}</title>
        <Group left={MARGIN.left} top={MARGIN.top}>
          {rows.map((row, ri) =>
            columns.map((col, ci) => {
              const value = values[ri]?.[ci] ?? 0;
              const x = columnScale(col) ?? 0;
              const y = rowScale(row) ?? 0;
              const cellW = columnScale.bandwidth();
              const cellH = rowScale.bandwidth();
              const isHovered = tooltipOpen && tooltipData?.row === row && tooltipData?.col === col;
              return (
                <rect
                  key={`${row}-${col}`}
                  x={x}
                  y={y}
                  width={cellW}
                  height={cellH}
                  rx={2}
                  fill={cellColor(value)}
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
                  aria-roledescription="cell"
                  aria-label={`${row}, ${col}: ${formatValue(value)}`}
                  tabIndex={0}
                  onPointerMove={() => handleHover(row, col, value, x + cellW / 2, y + cellH / 2)}
                  onPointerLeave={hideTooltip}
                  onFocus={() => handleHover(row, col, value, x + cellW / 2, y + cellH / 2)}
                  onBlur={hideTooltip}
                />
              );
            })
          )}
          <AxisBottom
            top={innerHeight}
            scale={columnScale}
            stroke="var(--ai-border)"
            tickStroke="var(--ai-border)"
            tickLabelProps={() => ({ fill: 'var(--ai-text-secondary)', fontSize: 11, textAnchor: 'middle' })}
          />
          <AxisLeft
            scale={rowScale}
            stroke="var(--ai-border)"
            tickStroke="var(--ai-border)"
            tickLabelProps={() => ({ fill: 'var(--ai-text-secondary)', fontSize: 11, textAnchor: 'end', dx: -4, dy: 4 })}
          />
        </Group>
      </svg>
      <div style={{ marginTop: '0.5rem', paddingLeft: MARGIN.left }}>
        <ScaleLegend min={minValue} max={maxValue} formatValue={formatValue} />
      </div>
      {tooltipOpen && tooltipData && tooltipLeft !== undefined && tooltipTop !== undefined && (
        <ChartTooltip
          left={tooltipLeft}
          top={tooltipTop}
          title={`${tooltipData.row}, ${tooltipData.col}`}
          rows={[{ label: 'Value', value: formatValue(tooltipData.value) }]}
        />
      )}
    </div>
  );
};
