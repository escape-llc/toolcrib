import { test, expect } from '@playwright/test';
import { gotoTab } from './nav';

// Regression for a report on the TabStrip Catalog page: the active
// panel's content drew on top of the section after it. Cause: TabStrip.Panel
// is built to fill a full-height flex parent (flex: 1 1 0px, min-height: 0),
// so as a direct child of a content-sized flex column (VStack) it collapsed to
// 0px and its content overflowed (#643). jsdom has no layout engine, so only a
// real browser can see this. The live demo is now the last thing on the page
// (#680), so the check is that the panel stays inside the demo's own area.
test('the TabStrip demo panel has real height and stays inside the demo area', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Catalog', 'TabStrip');

  const panel = page.locator('#cat-TabStrip .ai-tabstrip-panel');
  await expect(panel).toBeVisible();
  const demoArea = page.locator('[data-catalog-demo="TabStrip"]');

  const panelBox = (await panel.boundingBox())!;
  const panelContentBox = (await panel.locator(':scope > *').first().boundingBox())!;
  const demoBox = (await demoArea.boundingBox())!;

  expect(panelBox.height, 'the panel collapsed to (near) zero height').toBeGreaterThan(8);
  // The panel's content fits inside the panel instead of overflowing it...
  expect(panelContentBox.y + panelContentBox.height).toBeLessThanOrEqual(panelBox.y + panelBox.height + 1);
  // ...and the whole panel sits inside the demo area, not spilling past it.
  expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(demoBox.y + demoBox.height + 1);
});