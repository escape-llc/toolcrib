/**
 * CSS `color-mix()` expression for a normalized `[0, 1]` position on the
 * sequential magnitude ramp — one hue (the active theme's own primary
 * color), varying strength from near-surface to full primary. Shared by
 * `Heatmap` (per-cell fill) and `ScaleLegend` (its gradient bar) so the
 * two can never drift out of sync with each other.
 */
export function sequentialColor(normalized: number): string {
  const pct = 10 + Math.min(Math.max(normalized, 0), 1) * 90;
  return `color-mix(in oklab, var(--ai-color-primary) ${pct}%, var(--ai-bg-surface))`;
}

/** The full ramp as a CSS gradient, for `ScaleLegend`'s swatch bar. */
export const SEQUENTIAL_GRADIENT_CSS = `linear-gradient(to right, ${sequentialColor(0)}, ${sequentialColor(1)})`;
