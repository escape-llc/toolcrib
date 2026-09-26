import { type Page } from '@playwright/test';

/**
 * Mirrors demo/App.tsx's NAV_GROUPS: three sidebar pages since issue #624
 * consolidated the ten per-topic component tabs into the Encyclopedia (and
 * renamed the Wireframe Gallery to Kits). The Encyclopedia shows one
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
  Encyclopedia: { page: 'Encyclopedia' },
  Kits: { page: 'Kits' },
  // Legacy tab labels -> where that content lives now.
  'Forms & Zod Engine': { page: 'Encyclopedia', entry: 'Form' },
  'Data Table': { page: 'Encyclopedia', entry: 'DataTable' },
  'Overlays & Actions': { page: 'Encyclopedia', entry: 'Drawer' },
  'Toast Subsystem': { page: 'Encyclopedia', system: 'toasts' },
  'Theme system': { page: 'Encyclopedia', system: 'theme' },
  'Feedback & Status': { page: 'Encyclopedia', entry: 'Badge' },
  'Navigation & Structure': { page: 'Encyclopedia', entry: 'Breadcrumb' },
  'Common Layout Idioms': { page: 'Encyclopedia', entry: 'VStack' },
  'Media Gallery': { page: 'Encyclopedia', entry: 'Carousel' },
  'Component Showcase': { page: 'Encyclopedia', entry: 'Button' },
  Charts: { page: 'Kits' },
  'Wireframe Gallery': { page: 'Kits' },
};

/** The route (URL hash) of a component's Encyclopedia page, or of a Systems area's. */
export const entryRoute = (component: string) => `#/encyclopedia/${encodeURIComponent(component)}`;
export const systemRoute = (id: string) => `#/encyclopedia/system/${encodeURIComponent(id)}`;

/**
 * Navigates to a demo page by its sidebar label (or a legacy tab label,
 * see PAGES). `component` opens that component's Encyclopedia page instead
 * -- e.g. `gotoTab(page, 'Encyclopedia', 'TabStrip')`. Waits for the page's
 * own section to be attached, so its demo is mounted before the spec runs.
 */
export async function gotoTab(page: Page, label: string, component?: string): Promise<void> {
  const target = PAGES[label];
  if (!target) {
    throw new Error(`gotoTab: no page mapped for "${label}" -- update e2e/nav.ts's PAGES`);
  }
  // Not `exact: true` -- the link's accessible name is its icon glyph
  // plus the label (e.g. "🧰 Encyclopedia"), so an exact match against
  // the plain label alone would never hit. Scoped to the sidebar: an
  // Encyclopedia page's own breadcrumb also links "Encyclopedia".
  await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: target.page }).click();
  const entry = component ?? target.entry;
  if (entry) await gotoRoute(page, entryRoute(entry), `#enc-${entry}`);
  else if (target.system) await gotoRoute(page, systemRoute(target.system), `#enc-sys-${target.system}`);
}

export interface DemoPage {
  /** 'Overview', 'Encyclopedia', a component name, 'system:<id>', or 'Kits'. */
  label: string;
  go: () => Promise<void>;
}

/**
 * Every page of the demo, for specs that sweep the whole thing (the
 * interactive sweep, the full axe scans): Overview, the Encyclopedia index,
 * each component and Systems page, then Kits. The Encyclopedia's pages are
 * read from the index's own links, so a new component is covered the moment
 * it's in the manifest.
 */
export async function demoPages(page: Page): Promise<DemoPage[]> {
  await gotoTab(page, 'Encyclopedia');
  const hrefs = await page
    .getByTestId('main-content-scroll')
    .locator('a[href^="#/encyclopedia/"]')
    .evaluateAll(links => [...new Set(links.map(a => a.getAttribute('href')!))]);
  const pages: DemoPage[] = [
    { label: 'Overview', go: () => gotoTab(page, 'Overview') },
    { label: 'Encyclopedia', go: () => gotoTab(page, 'Encyclopedia') },
  ];
  for (const href of hrefs) {
    const [, kind, id] = href.match(/^#\/encyclopedia\/(system\/)?(.+)$/)!;
    const name = decodeURIComponent(id);
    pages.push(
      kind
        ? { label: `system:${name}`, go: () => gotoRoute(page, href, `#enc-sys-${name}`) }
        : { label: name, go: () => gotoRoute(page, href, `#enc-${name}`) }
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
