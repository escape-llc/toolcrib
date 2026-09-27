import { test, expect } from '@playwright/test';
import { gotoTab } from './nav';

// SPIKE (#670): the Popup page's demo is swapped to PopupBaseUI on this
// branch. First test: overlay-animations.spec.ts's Popup test with Radix's
// data-state reads replaced by Base UI's data-open/data-closed. The rest
// probe what Base UI's `render` prop changes versus Popup.tsx's wrapper div.

test('Base UI popup plays ai-fade-in / ai-fade-out and is removed only after the exit animation', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Encyclopedia', 'Popup');
  await page.getByRole('button', { name: 'Toggle Popup Menu' }).click();

  const popup = page.locator('.ai-popup-content');
  await popup.waitFor({ state: 'visible', timeout: 2000 });
  const openInfo = await popup.evaluate(el => ({
    animationName: getComputedStyle(el).animationName,
    open: el.hasAttribute('data-open'),
  }));
  expect(openInfo.animationName).toBe('ai-fade-in');
  expect(openInfo.open).toBe(true);

  // Recorded in the browser. animationend fires only when an animation runs to
  // completion; an animation cut short by removal fires animationcancel. Base
  // UI unmounts on the animation's `finished` promise, which can land just
  // before animationend is dispatched, so "still attached at animationend" is
  // the wrong check (the first run of this spike asserted it and failed).
  const exit = popup.evaluate(el => new Promise<{ ended: boolean; cancelled: boolean }>(resolve => {
    let cancelled = false;
    el.addEventListener('animationcancel', e => {
      if ((e as AnimationEvent).animationName === 'ai-fade-out') cancelled = true;
    });
    el.addEventListener('animationend', function handler(e) {
      if ((e as AnimationEvent).animationName === 'ai-fade-out') {
        el.removeEventListener('animationend', handler);
        resolve({ ended: true, cancelled });
      }
    });
  }));
  await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
  expect(await exit).toEqual({ ended: true, cancelled: false });
  await expect(popup).not.toBeAttached({ timeout: 2000 });
});

test('render prop: the real trigger button carries aria-expanded, and Escape returns focus to it', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Encyclopedia', 'Popup');
  const trigger = page.getByRole('button', { name: 'Toggle Popup Menu' });
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.ai-popup-content')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.ai-popup-content')).not.toBeAttached({ timeout: 2000 });
  await expect(trigger).toBeFocused();
});
