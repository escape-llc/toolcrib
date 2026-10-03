import { test, expect, type Page } from '@playwright/test';

// The runtime half of accessibility.spec.ts's focus-guard exclusion (#692).
// A trapped overlay's focus guards are aria-hidden and tabbable by design:
// the trap redirects focus the moment one receives it, so focus never rests
// on something hidden from assistive tech. axe reads the DOM statically and
// can't see that redirect; this spec does. It drives Tab and Shift+Tab
// around an open Modal and checks where focus settles after each key.
// Library-agnostic: it holds for any focus guards, Base UI's included.

/** Where focus settled: 'ok', or a description of what's wrong with it. */
function focusProblem(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return 'focus is on <body>';
    const label = `<${el.tagName.toLowerCase()}> "${(el.textContent ?? '').trim().slice(0, 40)}"`;
    if (el.hasAttribute('data-base-ui-focus-guard')) return `focus guard ${label}`;
    if (el.closest('[aria-hidden="true"]')) return `aria-hidden ${label}`;
    if (!el.closest('[role="dialog"]')) return `outside the dialog ${label}`;
    return 'ok';
  });
}

test('Tab and Shift+Tab never leave focus on a focus guard or hidden element in an open Modal', async ({ page }) => {
  await page.goto('/demo/harness/iframe.html');
  await page.getByRole('button', { name: 'Open outer modal' }).click();
  await expect(page.getByRole('dialog', { name: 'Outer modal' })).toBeVisible();
  await expect.poll(() => focusProblem(page)).toBe('ok');

  const visited = new Set<string>();
  for (const key of ['Tab', 'Shift+Tab']) {
    // More presses than the dialog has tabbables, so each direction wraps
    // past a guard at least once.
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press(key);
      // Polled: Base UI redirects from a guard a frame after the key lands.
      await expect.poll(() => focusProblem(page), { message: `after ${key} #${i + 1}`, timeout: 2000 }).toBe('ok');
      visited.add(await page.evaluate(() => (document.activeElement?.textContent ?? '').trim()));
    }
  }
  // The trap really moved focus around, not just held it on one element.
  expect(visited.size).toBeGreaterThan(1);
});
