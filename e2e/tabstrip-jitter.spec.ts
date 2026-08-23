import { test, expect } from '@playwright/test';
import { gotoTab } from './nav';

// Guards against a real regression: TabStrip.Trigger used to render the
// active tab with a heavier fontWeight (700 vs 500) than every inactive
// tab, and hid the divider line next to whichever tab was active/adjacent —
// both are width-changing side effects of `activeId`, so clicking any tab
// shifted every other tab's x-position by several pixels (measured up to
// ~13px in a real browser before the fix), and — since the filmstrip's own
// scroll-arrow buttons react to its measured content width via
// useAdaptiveSize/checkScroll — could also spuriously reveal/hide the
// scroll arrows purely from switching tabs. Reported directly as "jarring."
// Not reproducible in jsdom (no real font metrics/layout), only a real
// browser (see e2e/README.md's "real CSS resolution" scope).
test('clicking a tab does not shift any tab\'s x-position', async ({ page }) => {
  await page.goto('/');
  // Overview (the default landing group) is a solo-tab sidebar group, so
  // its inner TabStrip is hidden entirely (see demo/App.tsx's NAV_GROUPS)
  // -- "Overlays & Feedback" is the nearest 3-tab group, giving this test
  // an actual multi-tab strip to click within.
  await gotoTab(page, 'Overlays & Actions');

  const tabs = page.locator('[role="tablist"]').first().locator('[role="tab"]');
  const count = await tabs.count();
  expect(count).toBeGreaterThan(2);

  const before: (number | undefined)[] = [];
  for (let i = 0; i < count; i++) {
    before.push((await tabs.nth(i).boundingBox())?.x);
  }

  await tabs.nth(2).click();
  // Let any (incorrect) width-driven reflow / scroll-arrow toggle settle.
  await page.waitForTimeout(300);

  for (let i = 0; i < count; i++) {
    const afterX = (await tabs.nth(i).boundingBox())?.x;
    expect(afterX, `tab ${i} x-position after click`).toBeCloseTo(before[i] ?? 0, 0);
  }
});
