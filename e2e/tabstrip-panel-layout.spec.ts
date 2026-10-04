import { test, expect } from '@playwright/test';
import { gotoTab, loadDemoTableData } from './nav';

// TabStrip.Panel in the two layouts it's used in (#643). jsdom has no layout
// engine, so only a real browser can see either of these.

// Default (content-sized): the panel is a direct child of the demo's VStack, a
// content-sized flex column. When it was always a zero-basis fill item it
// collapsed to 0px there and its content drew on top of the section after it.
test('a content-sized TabStrip.Panel has real height and stays inside the demo area', async ({ page }) => {
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

// fill: the demo's own main panels are the growing region of a full-height
// layout and a virtualized DataTable (250 rows) inside one must still get a
// definite height and render rows. Without the zero basis it measured 0px.
test('a fill TabStrip.Panel gives a virtualized DataTable a height to render rows in', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Data Table');
  await loadDemoTableData(page);

  const panel = page.locator('.ai-tabstrip-panel').filter({ has: page.locator('[data-catalog-demo="DataTable"]') }).first();
  await expect(panel).toBeVisible();
  expect((await panel.boundingBox())!.height).toBeGreaterThan(200);
  expect(await page.locator('[data-catalog-demo="DataTable"] tbody tr').count()).toBeGreaterThan(3);
});
