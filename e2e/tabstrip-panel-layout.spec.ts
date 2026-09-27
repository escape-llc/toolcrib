import { test, expect } from '@playwright/test';
import { gotoTab } from './nav';

// Regression for a report on the TabStrip Encyclopedia page: the active
// panel's content drew on top of the "Blueprint" (source) section after it. Cause:
// TabStrip.Panel is built to fill a full-height flex parent (flex: 1 1 0px,
// min-height: 0), so as a direct child of a content-sized flex column
// (VStack) it collapsed to 0px and its content overflowed (#643). jsdom has
// no layout engine, so only a real browser can see this.
test('the TabStrip demo panel has real height and ends above the Blueprint section', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Encyclopedia', 'TabStrip');

  const panel = page.locator('#enc-TabStrip .ai-tabstrip-panel');
  await expect(panel).toBeVisible();
  const blueprint = page.locator('#enc-TabStrip').getByText('Blueprint — how this demo is built');

  const panelBox = (await panel.boundingBox())!;
  const panelContentBox = (await panel.locator(':scope > *').first().boundingBox())!;
  const blueprintBox = (await blueprint.boundingBox())!;

  expect(panelBox.height, 'the panel collapsed to (near) zero height').toBeGreaterThan(8);
  // The panel's content fits inside the panel instead of overflowing it...
  expect(panelContentBox.y + panelContentBox.height).toBeLessThanOrEqual(panelBox.y + panelBox.height + 1);
  // ...and the whole panel sits above the Blueprint section, not on top of it.
  expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(blueprintBox.y);
});
