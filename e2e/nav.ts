import { type Page } from '@playwright/test';

/**
 * Mirrors demo/App.tsx's NAV_GROUPS: three sidebar pages since issue #624
 * consolidated the ten per-topic component tabs into the Catalog (and
 * renamed the Wireframe Gallery to Kits). The Catalog shows one
 * component per page, routed by the URL hash (demo/hashRoute.ts).
 *
 * The old tab labels are kept as aliases so the ~90 existing call sites
 * didn't all need rewriting: each maps to the component page that best
 * stands in for the old tab. A spec exercising a different component
 * passes it explicitly -- only the current page's demo is mounted.
 */
const PAGES: Record<string, { page: string; entry?: string; system?: string }> = {
  Overview: { page: 'Overview' },
  'Overview & Architecture': { page: 'Overview' },
  Catalog: { page: 'Catalog' },
  Kits: { page: 'Kits' },
  // Legacy tab labels -> where that content lives now.
  'Forms & Zod Engine': { page: 'Catalog', entry: 'Form' },
  'Data Table': { page: 'Catalog', entry: 'DataTable' },
  'Overlays & Actions': { page: 'Catalog', entry: 'Drawer' },
  'Toast Subsystem': { page: 'Catalog', system: 'toasts' },
  'Theme system': { page: 'Catalog', system: 'theme' },
  'Feedback & Status': { page: 'Catalog', entry: 'Badge' },
  'Navigation & Structure': { page: 'Catalog', entry: 'Breadcrumb' },
  'Common Layout Idioms': { page: 'Catalog', entry: 'VStack' },
  'Media Gallery': { page: 'Catalog', entry: 'Carousel' },
  'Component Showcase': { page: 'Catalog', entry: 'Button' },
  Charts: { page: 'Kits' },
  'Wireframe Gallery': { page: 'Kits' },
};

/** The route (URL hash) of a component's Catalog page, or of a Systems area's. */
export const entryRoute = (component: string) => `#/catalog/${encodeURIComponent(component)}`;
export const systemRoute = (id: string) => `#/catalog/system/${encodeURIComponent(id)}`;

/**
 * Navigates to a demo page by its sidebar label (or a legacy tab label,
 * see PAGES). `component` opens that component's Catalog page instead
 * -- e.g. `gotoTab(page, 'Catalog', 'TabStrip')`. Waits for the page's
 * own section to be attached, so its demo is mounted before the spec runs.
 */
export async function gotoTab(page: Page, label: string, component?: string): Promise<void> {
  const target = PAGES[label];
  if (!target) {
    throw new Error(`gotoTab: no page mapped for "${label}" -- update e2e/nav.ts's PAGES`);
  }
  // Not `exact: true` -- the link's accessible name is its icon glyph
  // plus the label (e.g. "🧰 Catalog"), so an exact match against
  // the plain label alone would never hit. Scoped to the sidebar: an
  // Catalog page's own breadcrumb also links "Catalog".
  await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: target.page }).click();
  const entry = component ?? target.entry;
  if (entry) await gotoRoute(page, entryRoute(entry), `#cat-${entry}`);
  else if (target.system) await gotoRoute(page, systemRoute(target.system), `#cat-sys-${target.system}`);
}

export interface DemoPage {
  /** 'Overview', 'Catalog', a component name, 'system:<id>', or 'Kits'. */
  label: string;
  go: () => Promise<void>;
}

/**
 * Every page of the demo, for specs that sweep the whole thing (the
 * interactive sweep, the full axe scans): Overview, the Catalog index,
 * each component and Systems page, then Kits. The Catalog's pages are
 * read from the index's own links, so a new component is covered the moment
 * it's in the manifest.
 */
export async function demoPages(page: Page): Promise<DemoPage[]> {
  await gotoTab(page, 'Catalog');
  const hrefs = await page
    .getByTestId('main-content-scroll')
    .locator('a[href^="#/catalog/"]')
    .evaluateAll(links => [...new Set(links.map(a => a.getAttribute('href')!))]);
  const pages: DemoPage[] = [
    { label: 'Overview', go: () => gotoTab(page, 'Overview') },
    { label: 'Catalog', go: () => gotoTab(page, 'Catalog') },
  ];
  for (const href of hrefs) {
    const [, kind, id] = href.match(/^#\/catalog\/(system\/)?(.+)$/)!;
    const name = decodeURIComponent(id);
    pages.push(
      kind
        ? { label: `system:${name}`, go: () => gotoRoute(page, href, `#cat-sys-${name}`) }
        : { label: name, go: () => gotoRoute(page, href, `#cat-${name}`) }
    );
  }
  pages.push({ label: 'Kits', go: () => gotoTab(page, 'Kits') });
  return pages;
}

/** Sets the URL hash (a real history entry, like a link click) and waits for `waitFor` to attach. */
export async function gotoRoute(page: Page, hash: string, waitFor: string): Promise<void> {
  await page.evaluate(h => {
    window.location.hash = h;
  }, hash);
  await page.locator(waitFor).waitFor({ state: 'attached' });
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
