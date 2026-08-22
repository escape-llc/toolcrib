import { TooltipWithBounds } from '@visx/tooltip';

export interface ChartTooltipRow {
  label: string;
  value: string;
  /** Series color, rendered as a short line-key beside the label (never a filled box — see dataviz interaction spec). */
  color?: string;
}

/**
 * Shared tooltip shell for `BarChart`/`LineChart`/`PieChart` — internal,
 * not part of the public manifest. Values lead (bold); labels follow
 * (regular weight) — the legend's hierarchy inverted, since here the
 * reader already has the series and wants the number. Both use
 * `--ai-text-primary`, not a secondary/muted tone: at tooltip scale
 * (0.75rem) a muted label reads as low-contrast rather than "secondary
 * emphasis," so weight alone carries the distinction. Series identity
 * rides a short stroke beside each row, not a filled swatch.
 */
export function ChartTooltip({
  left,
  top,
  title,
  rows,
}: {
  left: number;
  top: number;
  title?: string;
  rows: ChartTooltipRow[];
}) {
  return (
    <TooltipWithBounds
      left={left}
      top={top}
      unstyled
      applyPositionStyle
      role="tooltip"
      style={{
        background: 'var(--ai-bg-surface)',
        border: '1px solid var(--ai-border)',
        borderRadius: 'var(--ai-radius-sm, 0.375rem)',
        padding: '0.5rem 0.625rem',
        boxShadow: 'var(--ai-chart-tooltip-shadow, 0 0.25rem 0.75rem -0.125rem rgba(0, 0, 0, 0.15))',
        pointerEvents: 'none',
        minWidth: '8rem',
      }}
    >
      {title && (
        <div style={{ fontWeight: 'var(--ai-font-weight-semibold, 600)', fontSize: '0.8125rem', color: 'var(--ai-text-primary)', marginBottom: '0.25rem' }}>
          {title}
        </div>
      )}
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.0625rem 0' }}>
          {row.color && (
            <span aria-hidden="true" style={{ display: 'inline-block', width: '0.75rem', height: '0.125rem', background: row.color, flexShrink: 0 }} />
          )}
          <span style={{ fontSize: '0.75rem', fontWeight: 'var(--ai-font-weight-normal, 400)', color: 'var(--ai-text-primary)' }}>{row.label}</span>
          <strong style={{ fontSize: '0.8125rem', color: 'var(--ai-text-primary)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>{row.value}</strong>
        </div>
      ))}
    </TooltipWithBounds>
  );
}
