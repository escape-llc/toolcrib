import { type Page } from '@playwright/test';

/**
 * Mirrors demo/App.tsx's NAV_GROUPS: three single-page sidebar groups
 * since issue #624 consolidated the ten per-topic component tabs into
 * one Encyclopedia page (and renamed the Wireframe Gallery to Kits).
 *
 * The old tab labels are kept as aliases so the ~90 existing call sites
 * didn't all need rewriting: each maps to the page its content moved to,
 * plus the anchor of the entry that best stands in for the old tab, which
 * is scrolled into view. Specs that measure real on-screen coordinates
 * (mouse drags, bounding boxes) need their subject in the viewport, and
 * Playwright's own auto-scroll only covers actions, not measurements.
 */
const PAGES: Record<string, { page: string; anchor?: string }> = {
  Overview: { page: 'Overview' },
  'Overview & Architecture': { page: 'Overview' },
  Encyclopedia: { page: 'Encyclopedia' },
  Kits: { page: 'Kits' },
  // Legacy tab labels -> where that content lives now.
  'Forms & Zod Engine': { page: 'Encyclopedia', anchor: 'enc-Form' },
  'Data Table': { page: 'Encyclopedia', anchor: 'enc-DataTable' },
  'Overlays & Actions': { page: 'Encyclopedia', anchor: 'enc-Drawer' },
  'Toast Subsystem': { page: 'Encyclopedia', anchor: 'enc-sys-toasts' },
  'Feedback & Status': { page: 'Encyclopedia', anchor: 'enc-Badge' },
  'Navigation & Structure': { page: 'Encyclopedia', anchor: 'enc-Breadcrumb' },
  'Common Layout Idioms': { page: 'Encyclopedia', anchor: 'enc-VStack' },
  'Media Gallery': { page: 'Encyclopedia', anchor: 'enc-Carousel' },
  'Component Showcase': { page: 'Encyclopedia', anchor: 'enc-Button' },
  Charts: { page: 'Kits' },
  'Wireframe Gallery': { page: 'Kits' },
};

/**
 * Navigates to a demo page by its sidebar label (or a legacy tab label,
 * see PAGES), then scrolls the relevant entry into view. `component`
 * scrolls to that component's Encyclopedia entry instead -- e.g.
 * `gotoTab(page, 'Encyclopedia', 'TabStrip')`.
 */
export async function gotoTab(page: Page, label: string, component?: string): Promise<void> {
  const target = PAGES[label];
  if (!target) {
    throw new Error(`gotoTab: no page mapped for "${label}" -- update e2e/nav.ts's PAGES`);
  }
  // Not `exact: true` -- the link's accessible name is its icon glyph
  // plus the label (e.g. "🧰 Encyclopedia"), so an exact match against
  // the plain label alone would never hit.
  await page.getByRole('link', { name: target.page }).click();
  const anchor = component ? `enc-${component}` : target.anchor;
  if (anchor) {
    const entry = page.locator(`#${anchor}`);
    await entry.waitFor({ state: 'attached' });
    await entry.scrollIntoViewIfNeeded();
  }
}

/**
 * The Data Table tab's main `<DataTable>` starts empty (see demo/App.tsx's
 * own comment on why -- it's a genuine, discoverable way to reach
 * `emptyState`, not an oversight) -- call this right after
 * `gotoTab(page, 'Data Table')` in any test that needs the real 250-row
 * dataset actually loaded. Targets the persistent icon-only toolbar
 * button specifically (present whether the table is empty or not, always
 * named "Reload Data"), not the `emptyState`'s own "Load Data" action --
 * both are visible at once while empty. These two used to share the
 * substring "Load Data" and needed the toolbar button's own `🔄` emoji
 * prefix to disambiguate; issue #591-follow-up made that button icon-only
 * with a constant "Reload Data" accessible name instead, which is now
 * simply a distinct exact name from the emptyState's "Load Data" -- no
 * regex/substring matching needed to tell them apart any more.
 */
export async function loadDemoTableData(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Reload Data' }).click();
}
