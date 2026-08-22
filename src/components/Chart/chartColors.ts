const SERIES_COUNT = 8;

const warnedCounts = new Set<number>();

/**
 * Resolves a series' fixed categorical color by position — `var(--ai-chart-series-1)`
 * through `-8`, the toolkit's validated colorblind-safe palette (see
 * `theme/harmonies.ts`'s `CHART_SERIES_LIGHT`/`_DARK`). Never cycles past
 * slot 8: per the dataviz method, a generated or reused 9th hue is
 * indistinguishable from an existing slot under CVD simulation, so a chart
 * with more series than slots should fold the tail into an "Other" bucket
 * or facet, not repaint colors. This returns a muted fallback instead and
 * warns once per offending count, so the failure is visible in development
 * rather than silently shipping a broken palette.
 */
export function getSeriesColor(index: number): string {
  if (index < SERIES_COUNT) {
    return `var(--ai-chart-series-${index + 1})`;
  }
  if (!warnedCounts.has(index)) {
    warnedCounts.add(index);
    console.warn(
      `[toolcrib] Chart series index ${index} exceeds the validated 8-slot categorical palette. ` +
        `Fold extra series into an "Other" bucket or facet into multiple charts instead of adding more series.`
    );
  }
  return 'var(--ai-text-secondary)';
}
