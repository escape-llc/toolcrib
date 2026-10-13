import { test, expect, type Page } from '@playwright/test';
import { gotoTab } from './nav';

// Docs say focus returns to the trigger when an overlay closes ("focus returns
// to it on close", Drawer/Popup/Modal props). Base UI does the work, but nothing
// here ever asserted it, so a regression (a trigger swapped for a wrapper that
// can't take focus, a close path that unmounts the trigger) would have been
// silent. One check per overlay family, via the keyboard: open with Enter,
// close with Escape, and the trigger is the active element again.
async function focusReturnsToTrigger(page: Page, tab: string, triggerName: string | RegExp) {
  await page.goto('/');
  await gotoTab(page, 'Catalog', tab);
  // By element + text, not role: an open modal hides its trigger from the accessibility tree.
  const trigger = page.locator('button').filter({ hasText: triggerName }).first();
  await trigger.focus();
  await page.keyboard.press('Enter');
  // Focus has moved into the overlay: it is no longer on the trigger.
  await expect(trigger).not.toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
}

test('Modal returns focus to its trigger on close', async ({ page }) => {
  await focusReturnsToTrigger(page, 'Modal', 'Open Modal Dialog');
});

test('AlertDialog returns focus to its trigger on close', async ({ page }) => {
  await focusReturnsToTrigger(page, 'AlertDialog', 'Delete Record');
});

test('Popup returns focus to its trigger on close', async ({ page }) => {
  await focusReturnsToTrigger(page, 'Popup', 'Toggle Popup Menu');
});

test('DropdownMenu returns focus to its trigger on close', async ({ page }) => {
  await focusReturnsToTrigger(page, 'DropdownMenu', 'User Actions Menu');
});
