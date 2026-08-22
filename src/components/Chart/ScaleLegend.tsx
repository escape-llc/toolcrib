import { SEQUENTIAL_GRADIENT_CSS } from './sequentialColor';

export interface ScaleLegendProps {
  /** Value at the light end of the ramp. */
  min: number;
  /** Value at the dark end of the ramp. */
  max: number;
  /** Formats the min/max labels. @default String */
  formatValue?: (value: number) => string;
  /** Gradient bar width in pixels. @default 160 */
  width?: number;
}

/**
 * Continuous magnitude legend — a light-to-dark gradient bar with min/max
 * labels, the sequential-encoding counterpart to `ChartLegend`'s discrete
 * categorical swatches. Draws from the same ramp `Heatmap`'s own cells use
 * (`sequentialColor.ts`), so the two can't drift out of sync. `Heatmap`
 * renders one of these automatically; exported separately so any future
 * sequential-encoded chart (a choropleth, a scale-colored scatter) can
 * reuse it without depending on `Heatmap` itself.
 * @manifest Gradient legend for a sequential (magnitude) color-encoded chart
 * @manifestCategory Data Display
 */
export function ScaleLegend({ min, max, formatValue = (v: number) => String(v), width = 160 }: ScaleLegendProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span style={{ fontSize: '0.75rem', color: 'var(--ai-text-secondary)' }}>{formatValue(min)}</span>
      <div
        role="img"
        aria-label={`Scale from ${formatValue(min)} to ${formatValue(max)}`}
        style={{ width, height: '0.625rem', borderRadius: '0.25rem', background: SEQUENTIAL_GRADIENT_CSS }}
      />
      <span style={{ fontSize: '0.75rem', color: 'var(--ai-text-secondary)' }}>{formatValue(max)}</span>
    </div>
  );
}
