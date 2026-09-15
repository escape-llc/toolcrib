/**
 * The fixed 13-segment partition for the weekly scheduled Gemini codebase
 * audit (issue #407) -- one segment reviewed per week, selected
 * deterministically from the ISO week number so there's no persisted
 * rotation-state file to keep in sync or drift out of. See
 * .github/workflows/gemini-audit.yml for how this is actually invoked, and
 * AGENTS.md's "Weekly scheduled Gemini audit" section for the full design
 * reasoning (why a rotation instead of one big sweep).
 *
 * Deliberately pure and dependency-free (no filesystem, no
 * scripts/lib/extract.js import) so it can be unit-tested directly under
 * Vitest -- extract.js's own import.meta.url-based ROOT resolution throws
 * under Vitest's Vite-based transform (see extract.test.js/buildGraph.test.js's
 * own comments on this), so anything that needs extract.js's TypeScript
 * Compiler API access (resolving a component NAME to its actual source
 * FILE) has to live in audit-segment.js's CLI entry point instead, never
 * here.
 *
 * Five of the thirteen segments map onto a single, whole
 * `@manifestCategory` value from ai-docs/component-manifest.json (Layout
 * Primitives, Overlays, Containers) -- those need no `names` list at all,
 * and can never drift, since a new component in that category is
 * automatically included by audit-segment.js's own category scan. The
 * other two base categories (Data Display: 22 components, Form Controls:
 * 17) are each split into two segments along a natural sub-grouping (see
 * issue #407's own proposal) -- that split HAS to be a hand-maintained
 * `names` list, since "charts & media" vs. "lists & status" isn't a fact
 * derivable from the category alone. audit-segment.js cross-checks every
 * `names` list against the real manifest at run time and prints a warning
 * (not a hard failure -- this is a best-effort audit job, not a release
 * gate) for any component that's in the category but unassigned to either
 * half, so a newly-added component surfaces instead of silently never
 * being reviewed by either half.
 */

/** The five real @manifestCategory values (ai-docs/component-manifest.json / scripts/lib/extract.js's VALID_CATEGORIES) that segments needing a sub-split key off. */
export const SPLIT_CATEGORIES = {
  DATA_DISPLAY: 'Data Display',
  FORM_CONTROLS: 'Form Controls',
};

export const SEGMENTS = [
  {
    id: 'layout-primitives',
    title: 'Layout Primitives',
    kind: 'components',
    category: 'Layout Primitives',
  },
  {
    id: 'data-display-charts-media',
    title: 'Data Display — Charts & Media',
    kind: 'components',
    category: SPLIT_CATEGORIES.DATA_DISPLAY,
    names: ['BarChart', 'LineChart', 'PieChart', 'Sparkline', 'Heatmap', 'ScaleLegend', 'Filmstrip', 'Gallery', 'Carousel'],
  },
  {
    id: 'data-display-lists-status',
    title: 'Data Display — Lists & Status',
    kind: 'components',
    category: SPLIT_CATEGORIES.DATA_DISPLAY,
    names: ['Accordion', 'Avatar', 'Badge', 'Breadcrumb', 'DataTable', 'EmptyState', 'Link', 'Progress', 'Skeleton', 'Spinner', 'Stepper', 'TabStrip', 'Tree'],
  },
  {
    id: 'overlays',
    title: 'Overlays',
    kind: 'components',
    category: 'Overlays',
  },
  {
    id: 'containers',
    title: 'Containers',
    kind: 'components',
    category: 'Containers',
  },
  {
    id: 'form-controls-value-inputs',
    title: 'Form Controls — Value Inputs',
    kind: 'components',
    category: SPLIT_CATEGORIES.FORM_CONTROLS,
    names: ['Button', 'Calendar', 'Combobox', 'DatePicker', 'FileUpload', 'Label', 'Listbox', 'RadioGroup', 'Rating', 'Select', 'Slider', 'TimeField', 'Toggle', 'ToggleGroup'],
  },
  {
    id: 'form-controls-composite',
    title: 'Form Controls — Composite',
    kind: 'components',
    category: SPLIT_CATEGORIES.FORM_CONTROLS,
    names: ['Form', 'Pagination', 'ThemeEditor'],
    // The shared slice.ts/useSliceOverrides.ts plumbing every form control
    // in segment 5 leans on -- reviewed once here, excluded from
    // 'theme-engine' below so the two segments don't overlap.
    extraFiles: ['src/theme/slice.ts', 'src/theme/useSliceOverrides.ts'],
  },
  {
    id: 'theme-engine',
    title: 'Theme Engine',
    kind: 'dirs',
    dirs: ['src/theme'],
    // Reviewed as part of 'form-controls-composite' instead (see that
    // segment's own extraFiles comment) -- excluded here to avoid the same
    // two files being reviewed twice in the same rotation.
    excludeFiles: ['src/theme/slice.ts', 'src/theme/useSliceOverrides.ts'],
  },
  {
    id: 'event-bus-observer',
    title: 'Event Bus & Observer',
    kind: 'dirs',
    dirs: ['src/eventBus', 'src/observer'],
  },
  {
    id: 'cli',
    title: 'CLI',
    kind: 'dirs',
    dirs: ['cli/src'],
  },
  {
    id: 'mcp',
    title: 'MCP Server',
    kind: 'dirs',
    dirs: ['mcp/src'],
  },
  {
    id: 'build-tooling',
    title: 'Build & Generation Tooling',
    kind: 'dirs',
    dirs: ['scripts', 'eslint-rules'],
  },
  {
    id: 'test-infra-demo',
    title: 'Test Infrastructure & Demo Harness',
    kind: 'dirs',
    dirs: ['e2e', 'demo'],
  },
];

/** ISO 8601 week number (1-53) for a given Date, UTC-based so the result doesn't shift with the runner's local timezone. */
export function isoWeekNumber(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // Thursday of this week decides which ISO year/week the date belongs to.
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

/** Deterministic segment selection for a given date -- (ISO week number - 1) mod 13, 0-indexed into SEGMENTS. No persisted state; the same date always yields the same segment. */
export function getSegmentForDate(date) {
  const index = (isoWeekNumber(date) - 1) % SEGMENTS.length;
  return SEGMENTS[index];
}

export function findSegmentById(id) {
  const segment = SEGMENTS.find((s) => s.id === id);
  if (!segment) {
    throw new Error(`Unknown audit segment id "${id}". Valid ids: ${SEGMENTS.map((s) => s.id).join(', ')}`);
  }
  return segment;
}

/**
 * Cross-checks a split category's two (or more) segments' `names` lists
 * against the real, current component names in that category (as read from
 * component-manifest.json at run time by the caller) -- returns any
 * component present in the category but named in none of its segments'
 * `names` lists ("unassigned"), and any component named in more than one
 * segment's list ("duplicated"). Both are drift signals: a real new
 * component (unassigned) or a hand-editing mistake (duplicated). Neither is
 * a hard failure here -- see audit-segment.js, which logs this as a warning
 * rather than exiting non-zero, since this is a best-effort audit job, not
 * a release-blocking check like check-manifest.
 */
export function findCategorySplitDrift(category, realComponentNamesInCategory, segments = SEGMENTS) {
  const segmentsForCategory = segments.filter((s) => s.kind === 'components' && s.category === category && s.names);
  const seen = new Map();
  for (const segment of segmentsForCategory) {
    for (const name of segment.names) {
      if (!seen.has(name)) seen.set(name, []);
      seen.get(name).push(segment.id);
    }
  }
  const assignedNames = new Set(seen.keys());
  const unassigned = realComponentNamesInCategory.filter((n) => !assignedNames.has(n));
  const duplicated = [...seen.entries()].filter(([, segmentIds]) => segmentIds.length > 1).map(([name, segmentIds]) => ({ name, segmentIds }));
  return { unassigned, duplicated };
}
