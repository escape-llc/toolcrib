import { test, expect, type Page } from '@playwright/test';

// One Escape closes only the topmost overlay (#696). A date picker's
// calendar is a Popup portalled outside its enclosing Modal's DOM, so this
// holds only if the overlay library knows the popup is nested in the
// dialog. jsdom can't check it (DatePicker.test.tsx explains why); this does.
// Harness: demo/harness/nested-overlays.tsx.

const closeRequests = (page: Page) => page.evaluate(() => window.modalCloseRequests);

for (const [name, calendarClass] of [
  ['Single date', 'react-aria-Calendar'],
  ['Date range', 'react-aria-RangeCalendar'],
] as const) {
  test(`${name}: Escape closes the calendar first, then the Modal`, async ({ page }) => {
    await page.goto('/demo/harness/nested-overlays.html');
    await page.getByRole('button', { name: 'Open host modal' }).click();
    const dialog = page.getByRole('dialog', { name: 'Host modal' });
    await expect(dialog).toBeVisible();

    const group = dialog.getByRole('group', { name });
    await group.getByLabel('Open calendar').click();
    const calendar = page.locator(`.${calendarClass}`);
    await expect(calendar).toBeVisible();
    // Focus really entered the calendar, which is what makes it topmost.
    await expect.poll(() => page.evaluate(c => !!document.activeElement?.closest(`.${c}`), calendarClass)).toBe(true);

    await page.keyboard.press('Escape');
    await expect(calendar).not.toBeAttached();
    await expect(dialog).toBeVisible();
    expect(await closeRequests(page)).toBe(0);

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeAttached();
    expect(await closeRequests(page)).toBeGreaterThan(0);
  });
}
