import { test, expect } from '@playwright/test';
import { gotoTab } from './nav';

// #739: inside a <TooltipGroup>, the first tooltip opens after its delay and
// pops in; once one is open, a neighbour opens instantly (Base UI marks it
// [data-instant]) and skips the pop animation. Base UI's hover handling
// listens to mouse events, so this hovers rather than focuses.
test('grouped tooltips: the first pops in, a neighbour opens instantly without the animation (#739)', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Catalog', 'TooltipGroup');
  const group = page.locator('#cat-TooltipGroup');

  await group.getByRole('button', { name: 'Bold' }).hover();
  const first = page.getByRole('tooltip', { name: 'Bold (grouped)' });
  await expect(first).toBeVisible();
  await expect(first).not.toHaveAttribute('data-instant');

  await group.getByRole('button', { name: 'Italic' }).hover();
  const second = page.getByRole('tooltip', { name: 'Italic (grouped)' });
  await expect(second).toBeVisible();
  await expect(second).toHaveAttribute('data-instant', 'delay');
  // No enter animation: the computed animation is 'none' and nothing runs.
  expect(await second.evaluate(el => ({ name: getComputedStyle(el).animationName, running: el.getAnimations().length })))
    .toEqual({ name: 'none', running: 0 });
});

test('a lone tooltip outside a group still opens with its pop animation (#739)', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Catalog', 'Tooltip');
  await page.locator('#cat-Tooltip').getByRole('button', { name: 'Hover For Tooltip' }).hover();
  const tip = page.getByRole('tooltip', { name: 'Accessible Tooltip with HSV Styling' });
  await expect(tip).toBeVisible();
  await expect(tip).not.toHaveAttribute('data-instant');
  expect(await tip.evaluate(el => getComputedStyle(el).animationName)).not.toBe('none');
});
