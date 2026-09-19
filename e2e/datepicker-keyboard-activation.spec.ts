import { test, expect } from '@playwright/test';
import { gotoTab } from './nav';

// Real-browser confirmation for issue #501: pressing Enter or Space while
// the calendar-toggle button has focus never opened the popup, even though
// a real mouse click worked fine. Root cause: this button is a plain native
// <button> (in Popup.Trigger) relying entirely on the browser's own native
// Enter/Space -> click translation -- but it lives inside the <Group>
// DatePicker.tsx renders, and React Aria's own useDatePickerGroup attaches
// a usePress instance to that Group (added just to run focusLast() on a
// mouse/touch/pen press). usePress's internal keydown handler
// unconditionally calls preventDefault() for Enter/Space on ANY descendant
// keydown that bubbles up to it, which suppresses the browser's native
// click translation before it ever fires -- so the Group silently swallows
// this button's own keyboard activation. See DatePicker.tsx's own comment
// on the button's onKeyDown for the full mechanism and the fix (stopping
// propagation before it reaches the Group, then firing a real .click()
// directly).

test('pressing Enter on the focused calendar button opens the popup (issue #501)', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Forms & Zod Engine');

  const button = page.getByRole('button', { name: 'Open calendar' }).first();
  await button.waitFor({ state: 'visible' });
  await button.focus();
  await expect(button).toBeFocused();

  await page.keyboard.press('Enter');

  await expect(page.locator('.ai-popup-content')).toBeVisible();
});

test('pressing Space on the focused calendar button opens the popup (issue #501)', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Forms & Zod Engine');

  const button = page.getByRole('button', { name: 'Open calendar' }).first();
  await button.waitFor({ state: 'visible' });
  await button.focus();
  await expect(button).toBeFocused();

  await page.keyboard.press(' ');

  await expect(page.locator('.ai-popup-content')).toBeVisible();
});
