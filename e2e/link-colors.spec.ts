import { test, expect } from '@playwright/test';
import { gotoTab } from './nav';

// Covers TOOLCRIB_LINK_CSS's real color resolution (themeContext.tsx) --
// jsdom can assert the CSS variable *names* referenced (see Link.test.tsx)
// but not what they actually resolve to on screen, nor that a plain,
// class-less <a> genuinely gets themed too (see e2e/README.md).

test('a themed <Link> resolves its real color from --ai-color-primary-readable, preserving the theme\'s own hue rather than a neutral/gray color', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Navigation & Structure');

  const link = page.getByRole('link', { name: 'Default (primary)' });
  await link.waitFor({ state: 'visible' });

  const color = await link.evaluate(el => getComputedStyle(el).color);

  // The rendered color must exactly equal whatever --ai-color-primary-readable
  // resolves to right now, not some other value.
  const expected = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.color = 'var(--ai-color-primary-readable)';
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  });
  expect(color).toBe(expected);

  // Hue check: the default theme's baseColor hue is 217 (blue) --
  // ensureWCAGContrast (hsv.ts) only ever nudges Value/Saturation, never
  // Hue, so the rendered link color must still fall in the blue range
  // rather than having drifted toward grey or a different hue entirely.
  const hue = await page.evaluate(c => {
    const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return null;
    const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])].map(v => v / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    if (d === 0) return null; // achromatic -- exactly what this test must NOT see
    let h: number;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
    return h;
  }, color);

  expect(hue).not.toBeNull();
  expect(hue!).toBeGreaterThan(190);
  expect(hue!).toBeLessThan(250);
});

test('a plain hand-written <a> with no class picks up the exact same ambient link color as <Link>\'s own default', async ({ page }) => {
  await page.goto('/');

  // page.goto only waits for the 'load' event, not for ThemeProvider's own
  // mount effect that injects TOOLCRIB_LINK_STYLE_ID's <style> tag -- on a
  // slower engine (confirmed for real on WebKit) a probe created right
  // after goto can race ahead of that effect and see the browser's own UA
  // stylesheet default (#0000EE) instead, unrelated to any real cascade
  // bug. Wait for the actual mechanism under test to exist first.
  await page.waitForSelector('#toolcrib-link-base', { state: 'attached' });

  const plainAnchorColor = await page.evaluate(() => {
    const a = document.createElement('a');
    a.href = '#';
    a.textContent = 'probe';
    document.body.appendChild(a);
    const c = getComputedStyle(a).color;
    a.remove();
    return c;
  });

  await gotoTab(page, 'Navigation & Structure');
  const link = page.getByRole('link', { name: 'Default (primary)' });
  await link.waitFor({ state: 'visible' });
  const linkColor = await link.evaluate(el => getComputedStyle(el).color);

  expect(plainAnchorColor).toBe(linkColor);
});

test('variant="secondary" resolves to a real, different color than the default primary link — the per-instance --ai-link-color override actually takes effect', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Navigation & Structure');

  const primary = page.getByRole('link', { name: 'Default (primary)' });
  const secondary = page.getByRole('link', { name: 'Secondary variant' });
  await secondary.waitFor({ state: 'visible' });

  const primaryColor = await primary.evaluate(el => getComputedStyle(el).color);
  const secondaryColor = await secondary.evaluate(el => getComputedStyle(el).color);

  expect(secondaryColor).not.toBe(primaryColor);
});
