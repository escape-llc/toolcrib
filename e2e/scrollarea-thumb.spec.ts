import { test, expect } from '@playwright/test';
import { gotoTab } from './nav';

// #860: the horizontal thumb had `flex: 1` inside a row scrollbar, so it
// grew to fill the whole track whatever the scroll range. jsdom has no
// layout engine, so this needs a real browser.
test('regression: horizontal ScrollArea thumb is sized to the visible fraction, not the whole track (#860)', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Catalog', 'ScrollArea');

  const measure = () => page.evaluate(() => {
    const bar = document.querySelector('#cat-ScrollArea .ai-scrollarea-scrollbar[data-orientation="horizontal"]') as HTMLElement | null;
    const thumb = bar?.firstElementChild as HTMLElement | null;
    if (!bar || !thumb) return null;
    return { track: bar.clientWidth, thumb: thumb.getBoundingClientRect().width };
  });

  await expect.poll(async () => {
    const m = await measure();
    // 30 items in a narrow viewport: the thumb must be well under the track.
    return m !== null && m.thumb > 0 && m.thumb < m.track * 0.9;
  }).toBe(true);
});
