import { type Page } from '@playwright/test';

/**
 * Mirrors demo/App.tsx's own NAV_GROUPS -- the sidebar groups the 12
 * main-demo tabs behind, so most tabs are only directly clickable once
 * their owning sidebar group is selected first (a solo-tab group's
 * content shows directly, with no inner tab strip at all). Keyed by each
 * tab's plain label (no emoji prefix; substring-matches the TabStrip's
 * own emoji-prefixed label). Kept in sync by hand with demo/App.tsx's
 * NAV_GROUPS -- update both together if either changes.
 */
const TAB_GROUP: Record<string, string> = {
  'Overview & Architecture': 'Overview',
  'Forms & Zod Engine': 'Forms & Data',
  'Data Table': 'Forms & Data',
  'Overlays & Actions': 'Overlays & Feedback',
  'Toast Subsystem': 'Overlays & Feedback',
  'Feedback & Status': 'Overlays & Feedback',
  Charts: 'Analytics',
  'Navigation & Structure': 'Navigation & Layout',
  'Common Layout Idioms': 'Navigation & Layout',
  'Media Gallery': 'Media & Wireframes',
  'Wireframe Gallery': 'Media & Wireframes',
  'Component Showcase': 'Showcase',
};

/**
 * Navigates to a main-demo tab by its plain label -- clicks the sidebar
 * group containing it first, then the inner (now per-group, much
 * shorter) TabStrip tab if that group has more than one tab. A solo-tab
 * group shows its content directly with no inner tab to click, so this
 * is a no-op past the sidebar click in that case.
 */
export async function gotoTab(page: Page, tabLabel: string): Promise<void> {
  const groupLabel = TAB_GROUP[tabLabel];
  if (!groupLabel) {
    throw new Error(`gotoTab: no sidebar group mapped for "${tabLabel}" -- update e2e/nav.ts's TAB_GROUP`);
  }
  // Not `exact: true` -- the link's accessible name is its icon glyph
  // plus the label (e.g. "🔔 Overlays & Feedback"), so an exact match
  // against the plain label alone would never hit.
  await page.getByRole('link', { name: groupLabel }).click();
  const tab = page.getByRole('tab', { name: tabLabel });
  if ((await tab.count()) > 0) {
    await tab.click();
  }
}
