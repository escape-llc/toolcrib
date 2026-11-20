import { test, expect, type Page } from '@playwright/test';
import { gotoTab } from './nav';

// #978: the viewport inset keeps portaled elements out of an app's own title
// bar. A manual inset is simulated by setting the variables the Viewport theme
// slice emits, straight on the document root.

const setInset = (page: Page, side: 'top' | 'bottom', px: number) =>
  page.evaluate(([s, v]) => document.documentElement.style.setProperty(`--ai-viewport-inset-${s}`, `${v}px`), [side, px] as const);

/**
 * The Role Level Select, with the safe area shaped so its list can't open
 * below the trigger (the bottom inset starts right under it) and has only 60px
 * above it (the top inset), too little for the list. Without a boundary the
 * list would open below the trigger, over the bottom inset; with one it must
 * stay inside the safe area, between the two insets.
 */
async function constrainedSelect(page: Page) {
  await page.goto('/');
  await gotoTab(page, 'Forms & Zod Engine');
  const trigger = page.getByRole('combobox', { name: 'Role Level' });
  await trigger.scrollIntoViewIfNeeded();
  const { top, bottom, height } = await trigger.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, height: window.innerHeight };
  });
  return { trigger, insetTop: Math.round(top - 60), insetBottom: Math.round(height - bottom) };
}

test('a Select with no room below stays inside the safe area', async ({ page }) => {
  const { trigger, insetTop, insetBottom } = await constrainedSelect(page);
  await setInset(page, 'top', insetTop);
  await setInset(page, 'bottom', insetBottom);
  // The safe-area element's own box starts at the inset: the signal the boundary is live.
  await expect
    .poll(() => page.evaluate(() => document.querySelector('[data-toolcrib-safe-area]')?.getBoundingClientRect().top))
    .toBe(insetTop);

  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeVisible();
  // Polled: Base UI measures the popup, then positions and sizes it.
  await expect.poll(async () => (await listbox.boundingBox())?.y ?? -1).toBeGreaterThanOrEqual(insetTop - 1);
  await expect
    .poll(async () => {
      const box = await listbox.boundingBox();
      return box ? box.y + box.height : Infinity;
    })
    .toBeLessThanOrEqual((await page.evaluate(() => window.innerHeight)) - insetBottom + 1);
});

test('control: with no insets the same list opens below the trigger, so the test above sees a real change', async ({ page }) => {
  const { trigger } = await constrainedSelect(page);
  const triggerBottom = await trigger.evaluate((el) => el.getBoundingClientRect().bottom);
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeVisible();
  await expect.poll(async () => (await listbox.boundingBox())?.y ?? -1).toBeGreaterThanOrEqual(triggerBottom);
});

test('a Modal backdrop starts at the inset', async ({ page }) => {
  const INSET = 200;
  await page.goto('/');
  await gotoTab(page, 'Catalog', 'Modal');
  await page.getByRole('button', { name: 'Open Modal Dialog' }).click();
  await expect(page.getByRole('dialog', { name: 'Confirm Account Action' })).toBeVisible();
  await setInset(page, 'top', INSET);
  const backdrop = page.locator('.ai-modal-overlay');
  await expect.poll(async () => (await backdrop.boundingBox())?.y).toBe(INSET);
  // The strip above it is not covered by the backdrop.
  const hit = await page.evaluate((y) => String(document.elementFromPoint(10, y)?.className ?? ''), INSET / 2);
  expect(hit).not.toContain('ai-modal-overlay');
});
