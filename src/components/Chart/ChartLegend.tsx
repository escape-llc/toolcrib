export interface ChartLegendItem {
  label: string;
  color: string;
}

/**
 * Shared legend for `BarChart`/`LineChart`/`PieChart` — internal, not part
 * of the public manifest. Per the dataviz method: always present for two or
 * more series (the dependable identity channel), and a swatch shape that
 * mirrors the chart's own mark (a line stroke for `LineChart`, a filled
 * rect for `BarChart`/`PieChart`) so the legend reads as "the same marks,
 * smaller" rather than an unrelated key. Caller decides whether to render
 * it at all — every chart below skips it below 2 items.
 */
export function ChartLegend({
  items,
  markShape = 'rect',
  direction = 'row',
}: {
  items: ChartLegendItem[];
  markShape?: 'rect' | 'line';
  /** `'row'` wraps horizontally below the chart (default); `'column'` stacks vertically, for a legend placed beside the chart. */
  direction?: 'row' | 'column';
}) {
  return (
    <ul
      aria-label="Legend"
      style={{
        display: 'flex',
        flexDirection: direction,
        flexWrap: direction === 'row' ? 'wrap' : 'nowrap',
        gap: direction === 'row' ? '0.75rem' : '0.5rem',
        margin: direction === 'row' ? '0.5rem 0 0' : 0,
        padding: 0,
        listStyle: 'none',
      }}
    >
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          {markShape === 'line' ? (
            <span
              aria-hidden="true"
              style={{ display: 'inline-block', width: '0.875rem', height: '0.125rem', background: item.color, borderRadius: '0.0625rem' }}
            />
          ) : (
            <span
              aria-hidden="true"
              style={{ display: 'inline-block', width: '0.625rem', height: '0.625rem', background: item.color, borderRadius: '0.125rem' }}
            />
          )}
          <span style={{ fontSize: '0.8125rem', color: 'var(--ai-text-secondary)' }}>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
