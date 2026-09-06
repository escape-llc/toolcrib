import { test, expect } from '@playwright/test';
import { gotoTab } from './nav';

// Adversarial stress test for the Z_INDEX scale (src/theme/zIndex.ts) --
// prompted directly by a self-audit finding that the scale's guarantee has
// never actually been tested against the two ways it's most likely to
// fail in practice: two instances of the *same* overlay type stacked on
// top of each other (the scale gives both the identical numeric value),
// and several *different* overlay types open simultaneously (the scale's
// real reason to exist). Belongs in e2e/, not the Vitest suite, for the
// same reason as every other spec here (see e2e/README.md) -- real
// stacking order is a genuine browser paint-pipeline question
// (elementFromPoint, computed z-index against real siblings), not
// something jsdom can answer.

test('two nested Modals get identical z-index by design -- verified, not assumed', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Overlays & Actions');
  await page.getByRole('button', { name: 'Open Modal Dialog' }).click();

  const outerContent = page.getByTestId('modal-container').first();
  await outerContent.waitFor({ state: 'visible' });

  await page.getByRole('button', { name: 'Open Nested Modal' }).click();

  const containers = page.getByTestId('modal-container');
  await expect(containers).toHaveCount(2);

  const [outerZ, innerZ] = await containers.evaluateAll((els) =>
    els.map((el) => getComputedStyle(el).zIndex)
  );

  // This is the actual, current, documented behavior (Z_INDEX.MODAL + 1 for
  // both, since neither Modal instance knows about the other) -- asserting
  // it directly, not just describing it in a comment, so a future change
  // to this scheme (e.g. an incrementing per-instance offset) is a
  // deliberate decision that touches this test, not a silent drift.
  expect(outerZ).toBe(innerZ);

  // Despite the tie, real stacking must still put the nested dialog on top
  // -- confirmed via the browser's actual paint order (elementFromPoint at
  // a point inside both dialogs' bounding boxes), not just DOM/portal
  // append order assumed to correlate with it.
  const innerBox = await containers.nth(1).boundingBox();
  if (!innerBox) throw new Error('nested modal has no bounding box');
  const topElementIsInner = await page.evaluate(
    ({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      const inner = document.querySelectorAll('[data-testid="modal-container"]')[1];
      return inner.contains(el);
    },
    { x: innerBox.x + innerBox.width / 2, y: innerBox.y + innerBox.height / 2 }
  );
  expect(topElementIsInner).toBe(true);

  // Escape closes only the top (nested) dialog, leaving the parent open --
  // reconfirms AGENTS.md's prior manual finding as a standing, automated
  // regression rather than a one-time check. A brief settle wait between
  // the two Escape presses is required, not just defensive: Modal has no
  // custom Escape handler of its own, relying entirely on Radix Dialog's
  // built-in dismissable-layer stack (which tracks which mounted dialog is
  // currently "top" and should receive the keydown). React removing the
  // nested dialog's DOM node (what toHaveCount(1) alone confirms) and
  // Radix's own internal layer-stack bookkeeping registering that removal
  // are two different things -- confirmed for real: on a real CI runner
  // (ubuntu-latest, headless Chromium), firing the second Escape
  // immediately after the count-1 assertion passed twice in a row without
  // ever closing the parent, reproducibly, while the identical sequence
  // never failed locally. This wait is closing a real, confirmed race
  // between those two facts, not papering over a flaky assertion.
  await page.keyboard.press('Escape');
  await expect(containers).toHaveCount(1);
  await page.waitForTimeout(200);
  await page.keyboard.press('Escape');
  await expect(containers).toHaveCount(0);
});

test('a Toast fired from inside an open Modal stacks above it, per Z_INDEX.TOAST > Z_INDEX.MODAL', async ({ page }) => {
  // Deliberately not DropdownMenu/ContextMenu paired with anything else --
  // confirmed live (see the first attempt at this test, kept as a lesson):
  // Radix's Menu-family hideOthers() correctly aria-hides the entire rest
  // of the page while open, which also makes everything outside the menu
  // genuinely unfocusable, not just marked unfocusable. That's a real,
  // stronger accessibility guarantee (already the reason
  // accessibility.spec.ts carries its own ARIA_HIDDEN_FOCUS_DISABLED
  // carve-out) -- it also means "two different overlay types open at once"
  // isn't achievable with a Menu-family component as one of the two. Toast
  // is: it doesn't take focus or hide the page, so it's the one overlay
  // type that can genuinely coexist with any other. The demo's own Modal
  // instance already fires one from its "Confirm" button without closing
  // itself, which is what this test drives.
  await page.goto('/');
  await gotoTab(page, 'Overlays & Actions');
  await page.getByRole('button', { name: 'Open Modal Dialog' }).click();

  const modal = page.getByTestId('modal-container');
  await modal.waitFor({ state: 'visible' });

  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(modal).toBeVisible(); // Confirm doesn't close the dialog -- both are genuinely open together.

  const toast = page.getByTestId('toast-item').filter({ hasText: 'Action confirmed!' });
  await toast.waitFor({ state: 'visible' });

  // Z_INDEX.TOAST is applied to the Viewport (the toast item's real,
  // portal-direct parent -- see Toast.tsx's own comment on why there's no
  // per-toast wrapper div), not the individual toast item itself.
  const toastViewport = toast.locator('..');

  const [modalZ, toastZ] = await Promise.all([
    modal.evaluate((el) => Number(getComputedStyle(el).zIndex)),
    toastViewport.evaluate((el) => Number(getComputedStyle(el).zIndex)),
  ]);

  // The scale's actual ordering claim, checked directly rather than assumed
  // from the constants file alone.
  expect(toastZ).toBeGreaterThan(modalZ);

  // And real paint order agrees with the numbers, not just the CSS values.
  const toastBox = await toast.boundingBox();
  if (!toastBox) throw new Error('toast has no bounding box');
  const topElementIsToast = await page.evaluate(
    ({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return el?.textContent?.includes('Action confirmed!') ?? false;
    },
    { x: toastBox.x + toastBox.width / 2, y: toastBox.y + toastBox.height / 2 }
  );
  expect(topElementIsToast).toBe(true);
});
