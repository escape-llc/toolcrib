import { test, expect, type Page } from '@playwright/test';
import { gotoTab } from './nav';

// Select's keyboard and pointer model in a real browser (#670, #697). Library-agnostic, so the
// same spec runs on the Radix Select and on the select-only combobox. What
// jsdom can't show: the trigger is a real <button>, where Enter and Space
// also fire a click (Enter on keydown, Space on keyup). A pick with either key
// must not be undone by that click reopening the list.

async function roleLevel(page: Page) {
  await page.goto('/');
  await gotoTab(page, 'Forms & Zod Engine');
  const trigger = page.getByRole('combobox', { name: 'Role Level' });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.focus();
  return trigger;
}

/** Past a frame and a close animation: a reopen would have happened by now. */
const settle = (page: Page) => page.waitForTimeout(300);

for (const key of ['Enter', ' '] as const) {
  test(`arrow to an option, ${key === ' ' ? 'Space' : key} picks it and the list stays closed`, async ({ page }) => {
    const trigger = await roleLevel(page);
    await page.keyboard.press('ArrowDown');
    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible();
    // The list opens on the current value (the demo form starts on Viewer
    // Only), so go to the top first: the second option is Content Editor.
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press(key);
    await expect(listbox).not.toBeVisible();
    await settle(page);
    await expect(listbox).not.toBeVisible();
    await expect(trigger).toContainText('Content Editor');
    await expect(trigger).toBeFocused();
  });
}

test('typing a letter jumps to the matching option', async ({ page }) => {
  const trigger = await roleLevel(page);
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('listbox')).toBeVisible();
  // Not the starting value (Viewer Only), so the pick is visible.
  await page.keyboard.press('c');
  await page.keyboard.press('Enter');
  await expect(trigger).toContainText('Content Editor');
});

test('Escape closes without changing the value', async ({ page }) => {
  const trigger = await roleLevel(page);
  const before = (await trigger.textContent()) ?? '';
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).not.toBeVisible();
  await expect(trigger).toHaveText(before);
  await expect(trigger).toBeFocused();
});

test('a mouse pick closes the list and shows the value', async ({ page }) => {
  const trigger = await roleLevel(page);
  await trigger.click();
  await page.getByRole('option', { name: 'Administrator' }).click();
  await expect(page.getByRole('listbox')).not.toBeVisible();
  await settle(page);
  await expect(page.getByRole('listbox')).not.toBeVisible();
  await expect(trigger).toContainText('Administrator');
});

// #697: an option is picked on click, not on the press, so a user who
// presses on the wrong option can cancel by sliding off it before releasing
// (a click only fires when press and release land on the same element).
test('pressing an option and sliding off before release picks nothing', async ({ page }) => {
  const trigger = await roleLevel(page);
  const before = (await trigger.textContent()) ?? '';
  await trigger.click();
  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeVisible();

  const admin = (await page.getByRole('option', { name: 'Administrator' }).boundingBox())!;
  await page.mouse.move(admin.x + admin.width / 2, admin.y + admin.height / 2);
  await page.mouse.down();
  // Off the option, onto the trigger (outside the list), then release.
  const t = (await trigger.boundingBox())!;
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 5 });
  await page.mouse.up();

  await settle(page);
  await expect(trigger).toHaveText(before);
});
