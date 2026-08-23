import { test, expect } from '@playwright/test';

// Covers TypographyThemeSlice end-to-end — switching Font Family in the
// Theme Editor actually reaches --ai-font-family on :root and from there
// the real computed font on document.body. Not about CSS mechanics jsdom
// can't do (computed font-family resolution works fine in jsdom) — this is
// here because it's the one full round-trip test for the slice this turn
// added, and the other e2e specs already need a live browser anyway.

test('switching Font Family in the Theme Editor updates --ai-font-family and the real computed font', async ({ page }) => {
  await page.goto('/');

  const before = await page.evaluate(() => ({
    varValue: getComputedStyle(document.documentElement).getPropertyValue('--ai-font-family').trim(),
    bodyFont: getComputedStyle(document.body).fontFamily,
  }));
  expect(before.varValue).toContain('Inter');
  expect(before.bodyFont).toContain('Inter');

  await page.getByRole('button', { name: 'Open Theme Designer' }).click();
  await page.getByText('Typography (Font Family, Size & Line Height)').click();
  await page.getByText('System (Inter / system-ui)').click();
  await page.getByText('Monospace (SF Mono / Consolas)').click();

  const after = await page.evaluate(() => ({
    varValue: getComputedStyle(document.documentElement).getPropertyValue('--ai-font-family').trim(),
    bodyFont: getComputedStyle(document.body).fontFamily,
  }));
  expect(after.varValue).toContain('Consolas');
  expect(after.bodyFont).toContain('Consolas');
});

// Same round-trip as above, for the other half of TypographyThemeSlice —
// added specifically because this one was actually broken: the CSS
// variable updated correctly but nothing consumed it as a real font-size
// anywhere (see src/theme/themeContext.tsx's injectGlobalStyle call for
// the fix). A jsdom test could only ever assert the variable's string
// value, which is exactly what looked fine while this was broken — real
// computed font-size resolution is what actually catches it.
test("changing Master Font Size updates --ai-master-font-size and the real computed root font-size", async ({ page }) => {
  await page.goto('/');

  const before = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  expect(before).toBe(16);

  await page.getByRole('button', { name: 'Open Theme Designer' }).click();
  await page.getByText('Typography (Font Family, Size & Line Height)').click();

  // Scoped to the row containing the "Master Font Size" label rather than
  // page.getByRole('slider').first() — the panel also has HSV base-color
  // sliders (Hue/Saturation/Brightness), so "first" would be fragile.
  const fontSizeRow = page.getByText('Master Font Size (rem Base)').locator('..').locator('..');
  const thumb = fontSizeRow.getByRole('slider');
  await thumb.focus();
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowRight'); // 16px -> 24px (max)

  const after = await page.evaluate(() => ({
    varValue: getComputedStyle(document.documentElement).getPropertyValue('--ai-master-font-size').trim(),
    rootFontSize: parseFloat(getComputedStyle(document.documentElement).fontSize),
  }));
  expect(after.varValue).toBe('24px');
  expect(after.rootFontSize).toBe(24);
});
