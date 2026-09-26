import { test, expect } from '@playwright/test';
import { gotoTab } from './nav';

// Regression for issue #614: a standalone <Input> (no `value`, no <Form>)
// used to stay controlled at a constant '' and silently discard every
// keystroke. The demo's "Search records..." UIGroup input is exactly that
// shape -- found in a real browser while building #606's demo, where a
// password field never showed what was typed.
test('a standalone uncontrolled Input accepts typing', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Component Showcase');
  const input = page.getByPlaceholder('Search records...');
  await input.scrollIntoViewIfNeeded();
  await input.click();
  await page.keyboard.type('abc');
  await expect(input).toHaveValue('abc');
});
