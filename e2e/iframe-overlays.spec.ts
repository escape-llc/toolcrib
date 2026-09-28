import { test, expect, type Frame, type Page } from '@playwright/test';

// Overlays rendered into another document (#670). demo/harness/iframe.tsx keeps
// the React root in the parent page and portals the overlays into an iframe
// through ThemeProvider's targetDocument. Each test checks one piece of
// overlay machinery that has to find the right document by itself: the
// portal, initial focus, the focus trap, Escape and outside-press dismissal,
// hiding the background from assistive tech, focus return and scroll lock.
// It asserts the correct behavior, so a failure names which piece still
// reaches for the global document.

async function openHarness(page: Page): Promise<Frame> {
  await page.goto('/demo/harness/iframe.html');
  const handle = await page.locator('iframe[title="Overlay frame"]').elementHandle();
  const frame = await handle!.contentFrame();
  await expect(frame!.getByRole('button', { name: 'Open modal' })).toBeVisible();
  return frame!;
}

/** Name of the element focused inside the frame, or '' if focus is elsewhere. */
function frameFocus(frame: Frame): Promise<string> {
  return frame.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return '<body>';
    return (el.textContent ?? '').trim();
  });
}

/** Whether document.activeElement in the frame is inside the open dialog. */
function focusInDialog(frame: Frame): Promise<boolean> {
  return frame.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
}

test.describe('Modal in an iframe', () => {
  test('portals into the iframe document, not the parent page', async ({ page }) => {
    const frame = await openHarness(page);
    await frame.getByRole('button', { name: 'Open modal' }).click();
    await expect(frame.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('moves focus into the dialog on open', async ({ page }) => {
    const frame = await openHarness(page);
    await frame.getByRole('button', { name: 'Open modal' }).click();
    await expect(frame.getByRole('dialog')).toBeVisible();
    await expect.poll(() => focusInDialog(frame)).toBe(true);
  });

  test('traps Tab inside the dialog', async ({ page }) => {
    const frame = await openHarness(page);
    await frame.getByRole('button', { name: 'Open modal' }).click();
    await expect.poll(() => focusInDialog(frame)).toBe(true);
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      expect(await focusInDialog(frame), `after Tab #${i + 1}`).toBe(true);
    }
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await focusInDialog(frame), `after Shift+Tab #${i + 1}`).toBe(true);
    }
  });

  test('Escape closes and focus returns to the trigger', async ({ page }) => {
    const frame = await openHarness(page);
    await frame.getByRole('button', { name: 'Open modal' }).click();
    await expect.poll(() => focusInDialog(frame)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(frame.getByRole('dialog')).not.toBeAttached();
    await expect.poll(() => frameFocus(frame)).toBe('Open modal');
  });

  test('a press outside the dialog closes it', async ({ page }) => {
    const frame = await openHarness(page);
    await frame.getByRole('button', { name: 'Open modal' }).click();
    await expect(frame.getByRole('dialog')).toBeVisible();
    // Top-left corner of the iframe: on the backdrop, clear of the dialog.
    const box = (await page.locator('iframe[title="Overlay frame"]').boundingBox())!;
    await page.mouse.click(box.x + 8, box.y + 8);
    await expect(frame.getByRole('dialog')).not.toBeAttached();
  });

  test('hides the iframe background from assistive tech, not the parent page', async ({ page }) => {
    const frame = await openHarness(page);
    await expect(frame.getByRole('button', { name: 'Background button' })).toHaveCount(1);
    await frame.getByRole('button', { name: 'Open modal' }).click();
    await expect(frame.getByRole('dialog')).toBeVisible();
    // getByRole leaves out elements hidden from the accessibility tree.
    await expect(frame.getByRole('button', { name: 'Background button' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Outer page button' })).toHaveCount(1);
  });

  test('control: with no overlay open, a wheel over the iframe scrolls it', async ({ page }) => {
    const frame = await openHarness(page);
    const box = (await page.locator('iframe[title="Overlay frame"]').boundingBox())!;
    await page.mouse.move(box.x + 8, box.y + box.height - 8);
    await page.mouse.wheel(0, 600);
    await expect.poll(() => frame.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });

  test('locks scrolling in the iframe document, and leaves the parent page alone', async ({ page }) => {
    const frame = await openHarness(page);
    const outerOverflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
    await frame.getByRole('button', { name: 'Open modal' }).click();
    await expect(frame.getByRole('dialog')).toBeVisible();
    const box = (await page.locator('iframe[title="Overlay frame"]').boundingBox())!;
    await page.mouse.move(box.x + 8, box.y + box.height - 8);
    await page.mouse.wheel(0, 600);
    // Give a wheel scroll (which is asynchronous) the chance to land, then
    // check it didn't: nothing here is supposed to change.
    await page.waitForTimeout(300);
    expect(await frame.evaluate(() => window.scrollY)).toBe(0);
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe(outerOverflow);
  });
});

test.describe('Popup in an iframe', () => {
  test('opens in the iframe document, anchored below its trigger', async ({ page }) => {
    const frame = await openHarness(page);
    const trigger = frame.getByRole('button', { name: 'Open popup' });
    await trigger.click();
    const body = frame.getByText('Popup body');
    await expect(body).toBeVisible();
    await expect(page.getByText('Popup body')).toHaveCount(0);
    const t = (await trigger.boundingBox())!;
    const b = (await body.boundingBox())!;
    expect(b.y).toBeGreaterThan(t.y + t.height - 1);
    expect(Math.abs(b.x - t.x)).toBeLessThan(40);
  });

  test('a press elsewhere in the iframe closes it', async ({ page }) => {
    const frame = await openHarness(page);
    await frame.getByRole('button', { name: 'Open popup' }).click();
    await expect(frame.getByText('Popup body')).toBeVisible();
    await frame.getByText('Filler line 20').click();
    await expect(frame.getByText('Popup body')).not.toBeAttached();
  });

  test('Escape closes and focus returns to the trigger', async ({ page }) => {
    const frame = await openHarness(page);
    await frame.getByRole('button', { name: 'Open popup' }).click();
    await expect(frame.getByText('Popup body')).toBeVisible();
    await frame.getByRole('button', { name: 'Popup action' }).focus();
    await page.keyboard.press('Escape');
    await expect(frame.getByText('Popup body')).not.toBeAttached();
    await expect.poll(() => frameFocus(frame)).toBe('Open popup');
  });
});
