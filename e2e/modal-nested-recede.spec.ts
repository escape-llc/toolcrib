import { test, expect, type Locator } from '@playwright/test';
import { gotoTab } from './nav';

// #738: while a dialog is open on top of a Modal, the parent recedes
// (scales down a step per level, from Base UI's --nested-dialogs) and eases
// back once the child closes.

// The x-scale out of the computed transform: 'none' is 1, else matrix(a, ...).
const scaleOf = (dialog: Locator) => dialog.evaluate((el) => {
  const t = getComputedStyle(el).transform;
  return t === 'none' ? 1 : Number(t.match(/^matrix\(([^,]+)/)?.[1] ?? NaN);
});

test('a Modal recedes while a nested dialog is open, and restores after (#738)', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Catalog', 'Modal');
  await page.getByRole('button', { name: 'Open Modal Dialog' }).click();
  await expect(page.getByRole('dialog', { name: 'Confirm Account Action' })).toBeVisible();
  // Not a role locator: once the child opens, the parent is aria-hidden.
  const outer = page.getByTestId('modal-container').filter({ hasText: 'Open Nested Modal' });
  // The enter animation also scales; wait for it to finish first.
  await outer.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)));
  expect(await scaleOf(outer)).toBe(1);

  await page.getByRole('button', { name: 'Open Nested Modal' }).click();
  await expect(page.getByRole('dialog', { name: 'Nested Confirmation' })).toBeVisible();
  // Default 'subtle' step: one level down is scale(0.96).
  await expect.poll(() => scaleOf(outer)).toBeCloseTo(0.96, 3);

  await page.keyboard.press('Escape'); // closes the inner dialog only
  await expect(page.getByRole('dialog', { name: 'Nested Confirmation' })).not.toBeAttached();
  await expect.poll(() => scaleOf(outer)).toBe(1);
});
