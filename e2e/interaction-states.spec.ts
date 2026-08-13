import { test, expect } from '@playwright/test';

// Covers interactionStyles.ts's `.ai-btn`/`.ai-tab-trigger` rules — none of
// this is expressible in jsdom (see e2e/README.md).

test('hover tints a .ai-btn background via a live color-mix(), not a precomputed value', async ({ page }) => {
  await page.goto('/');

  const anyButton = page.locator('button.ai-btn').first();
  await anyButton.waitFor({ state: 'visible' });

  const before = await anyButton.evaluate(el => getComputedStyle(el).backgroundColor);
  await anyButton.hover();
  const after = await anyButton.evaluate(el => getComputedStyle(el).backgroundColor);

  expect(after).not.toBe(before);
});

test('real keyboard Tab navigation shows a :focus-visible ring on the first .ai-btn reached', async ({ page }) => {
  await page.goto('/');

  // No mouse interaction before this — Chromium's :focus-visible heuristic
  // suppresses the ring after recent pointer input, so the *order* here
  // (keyboard-only, from a fresh load) is what makes this assertion mean
  // anything.
  let found: { outlineStyle: string; matches: boolean } | null = null;
  for (let i = 0; i < 15 && !found; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || !el.classList.contains('ai-btn')) return null;
      return {
        outlineStyle: getComputedStyle(el).outlineStyle,
        matches: el.matches(':focus-visible'),
      };
    });
    if (info) found = info;
  }

  expect(found).not.toBeNull();
  expect(found!.matches).toBe(true);
  expect(found!.outlineStyle).toBe('solid');
});

test('a mouse click does NOT leave a :focus-visible ring behind (matches native browser behavior)', async ({ page }) => {
  await page.goto('/');

  const anyButton = page.locator('button.ai-btn').first();
  await anyButton.click();

  const outlineStyle = await anyButton.evaluate(el => getComputedStyle(el).outlineStyle);
  expect(outlineStyle).toBe('none');
});

test(':active applies the animation slice\'s --ai-active-transform press feedback', async ({ page }) => {
  await page.goto('/');

  const anyButton = page.locator('button.ai-btn').first();
  const box = await anyButton.boundingBox();
  expect(box).not.toBeNull();

  const idle = await anyButton.evaluate(el => getComputedStyle(el).transform);
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  const pressed = await anyButton.evaluate(el => getComputedStyle(el).transform);
  await page.mouse.up();

  expect(pressed).not.toBe(idle);
});
