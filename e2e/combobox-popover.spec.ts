import { test, expect, type Page } from '@playwright/test';
import { gotoTab } from './nav';

// The Combobox's popover layer (#670). Written against the behavior a
// Combobox needs from its popover, not against a library: run unchanged on
// the Radix and Base UI versions.
//   - Opening must not hide the rest of the page from assistive tech. Base
//     UI's own Combobox does (mui/base-ui#5528); our Combobox uses only its
//     Popover and should not.
//   - Tab leaves the input for the next control and closes the listbox.
//   - Escape closes the listbox and focus stays in the input.
//   - Clicking the input again while open keeps it open (the input's wrapper
//     is not a popover trigger, so the popover must not read that click as
//     an outside press).

async function openSkills(page: Page) {
  await page.goto('/');
  await gotoTab(page, 'Catalog', 'Combobox');
  const input = page.getByRole('combobox', { name: 'Skills' });
  await input.scrollIntoViewIfNeeded();
  await input.click();
  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeVisible();
  return { input, listbox };
}

test('opening the listbox leaves the rest of the page in the accessibility tree', async ({ page }) => {
  await openSkills(page);
  // What a hide-others helper marks: siblings of the portal at body level.
  // Only aria-hidden and inert change what assistive tech sees. Base UI also
  // stamps data-base-ui-inert on the outside for a non-modal popover; that is
  // a bookkeeping marker with no a11y effect, checked below for pointer
  // effects instead.
  const hidden = await page.evaluate(() =>
    [...document.body.children]
      .filter(el => !el.hasAttribute('data-base-ui-focus-guard'))
      .filter(el => el.getAttribute('aria-hidden') === 'true' || el.hasAttribute('inert'))
      .map(el => `${el.tagName.toLowerCase()}#${el.id}`)
  );
  expect(hidden).toEqual([]);
  // A control outside the popover is still in the accessibility tree...
  const other = page.getByRole('combobox', { name: 'Search users' });
  await expect(other).toHaveCount(1);
  // ...and still takes a real click (the marker doesn't block pointer input).
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('root')!).pointerEvents)).not.toBe('none');
});

test('Tab moves on from the input and closes the listbox', async ({ page }) => {
  const { listbox } = await openSkills(page);
  await page.keyboard.press('Tab');
  await expect(listbox).not.toBeVisible();
  const focus = await page.evaluate(() => {
    const el = document.activeElement;
    return {
      isInput: el?.getAttribute('aria-label') === 'Skills',
      isGuard: !!el?.hasAttribute('data-base-ui-focus-guard'),
      isBody: el === document.body,
    };
  });
  expect(focus).toEqual({ isInput: false, isGuard: false, isBody: false });
});

test('Escape closes the listbox and keeps focus in the input', async ({ page }) => {
  const { input, listbox } = await openSkills(page);
  await page.keyboard.press('Escape');
  await expect(listbox).not.toBeVisible();
  await expect(input).toBeFocused();
});

test('clicking the input again while open keeps the listbox open', async ({ page }) => {
  const { input, listbox } = await openSkills(page);
  await input.click();
  await expect(listbox).toBeVisible();
  // Past one frame and one close-animation window: a dismissal would have
  // started by now. Nothing is meant to change.
  await page.waitForTimeout(300);
  await expect(listbox).toBeVisible();
});

// A press on the list's own background (its padding, or its scrollbar) is
// not a pick and not an outside press: focus must stay in the input, or the
// input's blur handler closes the list under the pointer. Gemini review on
// #710; Select already guarded this, Combobox didn't (Radix version either).
test('pressing the listbox background keeps it open and focus in the input', async ({ page }) => {
  const { input, listbox } = await openSkills(page);
  const box = (await listbox.boundingBox())!;
  // Inside the listbox's padding, clear of every option.
  await page.mouse.click(box.x + 2, box.y + 2);
  await expect(listbox).toBeVisible();
  await expect(input).toBeFocused();
});
