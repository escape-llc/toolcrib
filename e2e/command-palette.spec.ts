import { test, expect, type Page } from '@playwright/test';

// The real keyboard flow on react-aria's Autocomplete (#720, replacing
// cmdk): typing stays in the input while arrow keys move a virtual focus
// through the results, the first result is highlighted after each change,
// and Enter runs the highlighted one. jsdom can't show any of that: the
// highlight is aria-activedescendant plus focus handling only a real
// browser does. The demo's "Components" items navigate to that
// component's Encyclopedia page, which is the observable effect.

// The shortcut listener is attached in an effect after mount, so a key
// pressed the instant the page loads can land before it (seen in WebKit).
// Opening is idempotent, so retry the shortcut until the input shows.
async function openPalette(page: Page) {
  const input = page.getByPlaceholder('Type a command or search...');
  await expect(async () => {
    await page.keyboard.press('Control+k');
    await expect(input).toBeVisible({ timeout: 1000 });
  }).toPass();
  return input;
}

test.describe('CommandPalette keyboard flow', () => {
  test('Ctrl+K opens it, typing filters, and Enter runs the first result', async ({ page }) => {
    await page.goto('/');
    const input = await openPalette(page);
    await expect(input).toBeFocused();

    await input.fill('Accordion');
    await expect(page.getByRole('menuitem', { name: 'Accordion', exact: true })).toBeVisible();
    await page.keyboard.press('Enter');

    await expect(input).not.toBeAttached();
    await expect(page).toHaveURL(/Accordion/);
  });

  test('ArrowDown moves the highlight while focus stays in the input', async ({ page }) => {
    await page.goto('/');
    const input = await openPalette(page);
    await input.fill('slider');

    const results = page.getByRole('menuitem');
    await expect(results.nth(1)).toBeVisible();
    const second = (await results.nth(1).textContent())!.trim();

    await page.keyboard.press('ArrowDown');
    await expect(input).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(input).not.toBeAttached();
    await expect(page).toHaveURL(new RegExp(second));
  });

  test('Escape closes it, and it reopens with an empty search', async ({ page }) => {
    await page.goto('/');
    const input = await openPalette(page);
    await input.fill('zzz-nothing');
    await expect(page.getByText('No results found.')).toBeVisible();

    // One Escape closes it even with text in the input, as with cmdk.
    await page.keyboard.press('Escape');
    await expect(input).not.toBeAttached();

    await openPalette(page);
    await expect(input).toHaveValue('');
  });
});
