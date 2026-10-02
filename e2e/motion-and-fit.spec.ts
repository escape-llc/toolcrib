import { test, expect, type Locator } from '@playwright/test';
import { gotoTab } from './nav';

// Base UI polish, motion and fit (#734, #735, #736). All three read Base UI's
// CSS variables (--active-tab-*, --transform-origin, --available-height), so
// only a real browser can check them: jsdom has no layout.

const box = async (l: Locator) => (await l.boundingBox())!;

test('TabStrip: the active-tab indicator glides to the clicked tab (#734)', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Catalog', 'TabStrip');
  const target = page.getByRole('tab', { name: 'Activity' });
  const indicator = target.locator('xpath=ancestor::*[@role="tablist"][1]').locator('.ai-tab-indicator');
  const active = page.getByRole('tab', { selected: true }).filter({ has: page.locator('xpath=.') }).first();
  await expect(indicator).toBeVisible();

  // Starts on the selected tab.
  const [ind0, tab0] = [await box(indicator), await box(active)];
  expect(Math.abs(ind0.x - tab0.x)).toBeLessThan(1.5);
  expect(Math.abs(ind0.width - tab0.width)).toBeLessThan(1.5);

  // Moves by a transition (not a jump), and ends on the clicked tab.
  expect(await indicator.evaluate(el => getComputedStyle(el).transitionDuration)).not.toBe('0s');
  const moved = indicator.evaluate(el => new Promise<void>(resolve => {
    el.addEventListener('transitionend', function handler(e) {
      if ((e as TransitionEvent).propertyName === 'left') {
        el.removeEventListener('transitionend', handler);
        resolve();
      }
    });
  }));
  await target.click();
  await moved;
  const [ind1, tab1] = [await box(indicator), await box(target)];
  expect(Math.abs(ind1.x - tab1.x)).toBeLessThan(1.5);
  expect(Math.abs(ind1.width - tab1.width)).toBeLessThan(1.5);
});

test('an anchored menu pops in from its trigger side (#735)', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Catalog', 'DropdownMenu');
  await page.getByRole('button', { name: 'User Actions Menu' }).click();
  const menu = page.locator('.ai-menu-popup');
  await expect(menu).toBeVisible();

  const info = await menu.evaluate(el => {
    const cs = getComputedStyle(el);
    const [x, y] = cs.transformOrigin.split(' ').map(parseFloat);
    return { animationName: cs.animationName, x, y, height: el.getBoundingClientRect().height, side: el.getAttribute('data-side') };
  });
  expect(info.animationName).toBe('ai-pop-in');
  // Scaling from the edge that meets the trigger, not the popup's centre.
  const edgeY = info.side === 'top' ? info.height : 0;
  expect(Math.abs(info.y - edgeY)).toBeLessThan(3);
});

test('a long Combobox list stays inside a short viewport, above or below its field, and scrolls (#736)', async ({ page }) => {
  // A ResizeObserver loop surfaces as a window error event, not a page error.
  await page.addInitScript(() => {
    (window as unknown as { __errors: string[] }).__errors = [];
    window.addEventListener('error', e => (window as unknown as { __errors: string[] }).__errors.push(e.message));
  });
  await page.setViewportSize({ width: 1280, height: 320 });
  await page.goto('/');
  await gotoTab(page, 'Catalog', 'Combobox');
  const input = page.getByPlaceholder('Search users...');
  // Centre the field so neither side has room for the full ~15rem list.
  await input.evaluate(el => el.scrollIntoView({ block: 'center' }));
  // Every demo user is "User N", so this matches the search's cap of 8.
  await input.fill('user');
  const popup = page.locator('.ai-combobox-popup');
  const listbox = popup.getByRole('listbox');
  // The demo search is debounced and async: a "Searching…" row shows first,
  // so wait for the real results.
  await expect.poll(() => listbox.getByRole('option').count()).toBe(8);

  const p = await box(popup);
  expect(p.y).toBeGreaterThanOrEqual(0);
  expect(p.y + p.height).toBeLessThanOrEqual(320 + 0.5);
  // Capped by the available height, so the list scrolls.
  const overflow = await listbox.evaluate(el => el.scrollHeight - el.clientHeight);
  expect(overflow).toBeGreaterThan(0);
  // It stays on the field's axis: with no room above or below, Popover's
  // default fell back beside the field, and the capped size then kept it
  // flipping between sides (a ResizeObserver loop).
  expect(['top', 'bottom']).toContain(await popup.getAttribute('data-side'));
  await page.waitForTimeout(300); // let any flip loop surface; nothing else changes here
  const errors = await page.evaluate(() => (window as unknown as { __errors: string[] }).__errors);
  expect(errors.filter(e => e.includes('ResizeObserver'))).toEqual([]);
});
