import { EmptyState } from '../EmptyState/EmptyState';

/**
 * Shared empty-data placeholder for `BarChart`/`LineChart`/`PieChart`/
 * `Heatmap` — internal, not part of the public manifest. Sized to match
 * the chart's own configured `width`/`height` so swapping real data in
 * later doesn't jump the layout, wrapping the toolkit's existing
 * `EmptyState` rather than inventing a chart-specific one.
 */
export function ChartEmptyState({ width, height, message = 'No data to display' }: { width: number; height: number; message?: string }) {
  return (
    <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <EmptyState>
        <EmptyState.Icon aria-hidden="true">📊</EmptyState.Icon>
        <EmptyState.Title>{message}</EmptyState.Title>
      </EmptyState>
    </div>
  );
}
