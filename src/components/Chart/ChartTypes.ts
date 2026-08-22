/**
 * One named series of values, aligned by index to a chart's `categories`
 * array. Shared across `BarChart` and `LineChart` rather than each
 * declaring its own — both are Cartesian, category-aligned charts and
 * consume the same shape.
 * @barrelExport
 */
export interface ChartSeries {
  /** Series identity — the legend swatch label and tooltip row label. */
  label: string;
  /** One value per entry in the chart's `categories` array, same order. */
  values: number[];
}
