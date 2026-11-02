import { test, expect, type Page } from '@playwright/test';
import { gotoTab } from './nav';

// #852: zooming the Viewer did nothing visible. The zoom button kept its 100%
// max size, so it held the image at the stage's height (1200x800 rendered at
// 1200x537, letterboxed to the same picture). jsdom has no layout engine, so
// this can only be checked in a browser.

const measure = (page: Page) => page.evaluate(() => {
  const img = document.querySelector('[role="dialog"] img') as HTMLImageElement;
  const scroller = img.parentElement!.parentElement!;
  scroller.scrollTo(0, 0);
  const i = img.getBoundingClientRect();
  const s = scroller.getBoundingClientRect();
  return {
    naturalW: img.naturalWidth,
    naturalH: img.naturalHeight,
    imgW: Math.round(i.width),
    imgH: Math.round(i.height),
    stageW: scroller.clientWidth,
    stageH: scroller.clientHeight,
    // At scroll 0,0 the image's top-left corner must be at the stage's own
    // top-left: centring with justify/align `center` would push it past the
    // edge, out of scroll reach.
    offsetLeft: Math.round(i.left - s.left),
    offsetTop: Math.round(i.top - s.top),
  };
});

test('regression: Viewer zoom shows the image at natural size, scrollable from its top-left corner (#852)', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Catalog', 'Gallery');
  await page.getByRole('button', { name: /^(?!.*(Show|Hide)).*/ }).filter({ has: page.locator('img, [role="img"]') }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Media viewer' });
  await expect(dialog).toBeVisible();

  // Fitted: the image stays inside the stage.
  await expect.poll(async () => {
    const m = await measure(page);
    return m.naturalW > 0 && m.imgW <= m.stageW && m.imgH <= m.stageH;
  }).toBe(true);

  // Keyboard works inside the Modal: initial focus lands in the viewer (Base
  // UI moves it a frame after opening, so wait for it before pressing).
  await expect(dialog.getByRole('button', { name: 'Close viewer' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(dialog.locator('img')).toHaveAttribute('alt', 'Demo photo 2');

  await dialog.getByRole('button', { name: 'Zoom in' }).click();
  await expect(dialog.getByRole('button', { name: 'Zoom out' })).toHaveAttribute('aria-pressed', 'true');

  await expect.poll(async () => {
    const m = await measure(page);
    return {
      atNaturalSize: m.imgW === m.naturalW && m.imgH === m.naturalH,
      overflowsStage: m.imgW > m.stageW && m.imgH > m.stageH,
      topLeftReachable: m.offsetLeft === 0 && m.offsetTop === 0,
    };
  }).toEqual({ atNaturalSize: true, overflowsStage: true, topLeftReachable: true });

  // Zoomed, arrows pan (the browser scrolls the zoomed layer) rather than
  // switching photos.
  const scrollLeft = () => page.evaluate(() => {
    const img = document.querySelector('[role="dialog"] img') as HTMLImageElement;
    return img.parentElement!.parentElement!.scrollLeft;
  });
  // WebKit doesn't focus a button on click, so focus it the way a keyboard
  // user would already have it.
  await dialog.getByRole('button', { name: 'Zoom out' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(scrollLeft).toBeGreaterThan(0);
  await expect(dialog.locator('img')).toHaveAttribute('alt', 'Demo photo 2');
});
