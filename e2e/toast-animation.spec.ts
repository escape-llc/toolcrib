import { test, expect } from '@playwright/test';
import { gotoTab } from './nav';

// Covers Toast.tsx's injectToastAnimations() — Radix's Presence keeps the
// toast's DOM node mounted until a real `animationend` fires on it, which
// jsdom never produces (see e2e/README.md). A jsdom test can only assert the
// CSS rule text exists, not that the toast actually enters/exits correctly
// in a real browser.

test('a promise toast updates in place when it settles, without replaying the enter animation (#613)', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Toast Subsystem');

  await page.getByRole('button', { name: 'Save (promise toast)', exact: true }).click();
  const toast = page.locator('[data-testid="toast-item"]').first();
  await expect(toast).toContainText('Saving report…');
  await expect(toast).toHaveAttribute('data-loading', '');

  // Let the entrance animation finish, then mark this exact element and count
  // any later slide-in starts. A remount would drop the mark; a replayed
  // entrance would bump the count. Recorded in the browser, not polled from
  // Node, so the narrow update moment can't slip between two checks.
  await expect(toast).toHaveCSS('opacity', '1');
  await toast.evaluate(el => {
    el.setAttribute('data-e2e-mark', 'original');
    (el as HTMLElement).dataset.slideInStarts = '0';
    el.addEventListener('animationstart', e => {
      if ((e as AnimationEvent).animationName === 'toolcrib-toast-slide-in') {
        const node = el as HTMLElement;
        node.dataset.slideInStarts = String(Number(node.dataset.slideInStarts) + 1);
      }
    });
  });

  // The demo's promise resolves after 1.5s.
  await expect(toast).toContainText('Saved report.pdf', { timeout: 5000 });
  await expect(toast).not.toHaveAttribute('data-loading');
  await expect(page.locator('[data-testid="toast-item"]')).toHaveCount(1);
  await expect(toast).toHaveAttribute('data-e2e-mark', 'original');
  await expect(toast).toHaveAttribute('data-slide-in-starts', '0');
});

test('a fired toast plays its slide-in animation and is removed cleanly after dismiss', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Toast Subsystem');

  await page.getByRole('button', { name: 'Fire Info Toast', exact: true }).click();

  const toast = page.locator('[data-testid="toast-item"]').first();
  await toast.waitFor({ state: 'visible', timeout: 2000 });

  const openInfo = await toast.evaluate(el => ({
    animationName: getComputedStyle(el).animationName,
    dataState: el.getAttribute('data-state'),
  }));
  expect(openInfo.animationName).toBe('toolcrib-toast-slide-in');
  // SPIKE #670: Radix's data-state; Base UI has no equivalent attribute on an open toast.

  // Regression test: dismissToast used to remove the toast from
  // ToastContext's state array immediately on click, which unmounted this
  // <ToastPrimitive.Root> synchronously — tearing down Radix's Presence
  // before it ever got to play an exit animation (reported directly: toasts
  // stopped animating on dismiss/expiry). data-state="closed" is only true
  // for the ~120ms fade-out itself, too narrow a window for a polling
  // assertion (Playwright's default poll interval backs off well past that)
  // to reliably observe — an animationend listener installed *before* the
  // trigger, independent of poll timing, is what actually proves the real
  // exit animation ran rather than an instant, unanimated removal.
  // Filtered, not { once: true } on the raw event — the entrance animation
  // (toolcrib-toast-slide-in) fires its own animationend well before the
  // toast is ever closed, and would otherwise resolve this immediately with
  // the wrong animation name.
  const animationEndNamePromise = toast.evaluate(el => new Promise<string>(resolve => {
    el.addEventListener('animationend', function handler(e) {
      const name = (e as AnimationEvent).animationName;
      if (name === 'toolcrib-toast-fade-out' || name === 'toolcrib-toast-swipe-out') {
        el.removeEventListener('animationend', handler);
        resolve(name);
      }
    });
  }));
  await toast.locator('button[aria-label="Dismiss toast"]').click();
  expect(await animationEndNamePromise).toBe('toolcrib-toast-fade-out');

  // Presence removes the node once its exit animation's `animationend`
  // fires — bounded wait, not instant (would mean no animation played) and
  // not indefinite (would mean the node got stuck, the exact bug this
  // toolkit hit before for Tooltip with a missing @keyframes).
  await expect(toast).not.toBeAttached({ timeout: 2000 });
});

test('a toast that times out on its own (never clicked) also plays its exit animation before being removed', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Toast Subsystem');
  await page.getByRole('button', { name: 'Fire Info Toast', exact: true }).click();

  const toast = page.locator('[data-testid="toast-item"]').first();
  await toast.waitFor({ state: 'visible', timeout: 2000 });

  // Install the listener before Radix's own duration timer (default
  // 5000ms) fires — see the manual-dismiss test above for why a polling
  // assertion on data-state can't reliably catch this instead.
  // Filtered, not { once: true } on the raw event — the entrance animation
  // (toolcrib-toast-slide-in) fires its own animationend well before the
  // toast is ever closed, and would otherwise resolve this immediately with
  // the wrong animation name.
  const animationEndNamePromise = toast.evaluate(el => new Promise<string>(resolve => {
    el.addEventListener('animationend', function handler(e) {
      const name = (e as AnimationEvent).animationName;
      if (name === 'toolcrib-toast-fade-out' || name === 'toolcrib-toast-swipe-out') {
        el.removeEventListener('animationend', handler);
        resolve(name);
      }
    });
  }));

  expect(await animationEndNamePromise).toBe('toolcrib-toast-fade-out');
  await expect(toast).not.toBeAttached({ timeout: 2000 });
});
