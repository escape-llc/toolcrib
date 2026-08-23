import { test, expect } from '@playwright/test';
import { gotoTab } from './nav';

// Guards against a real regression: `contain` (CSS containment) nested
// across a few flex-basis-0 boxes in a row (Splitter's panels, TabStrip's
// active panel wrapper, Card's `layout="auto"` mode) silently collapsed
// this scroll region to ~148px on *every* tab, because jsdom doesn't run a
// real layout engine at all (getBoundingClientRect/clientHeight are
// stubbed there), so nothing in the Vitest suite could have caught it —
// only a real browser's flex + containment resolution reproduces this
// class of bug (see e2e/README.md's "real CSS resolution" scope).
const MIN_HEALTHY_HEIGHT_PX = 250;

// Plain labels (no emoji) -- gotoTab (e2e/nav.ts) navigates to each via
// its owning sidebar group, mirroring demo/App.tsx's own NAV_GROUPS.
const TABS = [
  'Overview & Architecture',
  'Forms & Zod Engine',
  'Overlays & Actions',
  'Toast Subsystem',
  'Data Table',
  'Common Layout Idioms',
  'Wireframe Gallery',
  'Component Showcase',
];

test('the main content scroll region stays a healthy height on every tab, not collapsed', async ({ page }) => {
  await page.goto('/');
  const scrollRegion = page.getByTestId('main-content-scroll');

  for (const tab of TABS) {
    await gotoTab(page, tab);
    // clientHeight, not scrollHeight — this is specifically checking the
    // *container's* resolved height, independent of how much content is
    // inside it (some tabs, like Overlays/Toast, legitimately have little
    // content and nothing to scroll — that's fine; only the container
    // shrinking is the bug this guards against).
    const clientHeight = await scrollRegion.evaluate(el => el.clientHeight);
    expect(clientHeight, `"${tab}" tab's content region height`).toBeGreaterThan(MIN_HEALTHY_HEIGHT_PX);
  }
});

test('a tab with enough content to overflow actually scrolls', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Component Showcase');

  const scrollRegion = page.getByTestId('main-content-scroll');
  const before = await scrollRegion.evaluate(el => el.scrollTop);
  await scrollRegion.evaluate(el => { el.scrollTop = el.scrollHeight; });
  const after = await scrollRegion.evaluate(el => el.scrollTop);

  expect(after).toBeGreaterThan(before);
});
