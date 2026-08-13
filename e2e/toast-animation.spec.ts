import { test, expect } from '@playwright/test';

// Covers Toast.tsx's injectToastAnimations() — Radix's Presence keeps the
// toast's DOM node mounted until a real `animationend` fires on it, which
// jsdom never produces (see e2e/README.md). A jsdom test can only assert the
// CSS rule text exists, not that the toast actually enters/exits correctly
// in a real browser.

test('a fired toast plays its slide-in animation and is removed cleanly after dismiss', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Toast Subsystem').click();

  await page.getByRole('button', { name: 'Fire Info Toast', exact: true }).click();

  const toast = page.locator('[data-testid="toast-item"]').first();
  await toast.waitFor({ state: 'visible', timeout: 2000 });

  const openInfo = await toast.evaluate(el => ({
    animationName: getComputedStyle(el).animationName,
    dataState: el.getAttribute('data-state'),
  }));
  expect(openInfo.animationName).toBe('toolcrib-toast-slide-in');
  expect(openInfo.dataState).toBe('open');

  await toast.locator('button[aria-label="Dismiss toast"]').click();

  // Presence removes the node once its exit animation's `animationend`
  // fires — bounded wait, not instant (would mean no animation played) and
  // not indefinite (would mean the node got stuck, the exact bug this
  // toolkit hit before for Tooltip with a missing @keyframes).
  await expect(toast).not.toBeAttached({ timeout: 2000 });
});
