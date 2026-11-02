import { test, expect } from '@playwright/test';
import { gotoTab } from './nav';

// #737: a ScrollArea fades only the edges that have more content. The mask
// reads Base UI's --scroll-area-overflow-y-{start,end}; the computed
// mask-image shows each edge's resolved fade (0px = no fade there).
test('ScrollArea fades only the edges with more content to scroll (#737)', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Catalog', 'ScrollArea');
  // The Catalog's first ScrollArea is the vertical one; its viewport is the
  // focusable scroll region.
  const viewport = page.locator('#cat-ScrollArea [tabindex="0"]').first();

  const fades = () => viewport.evaluate((el) => {
    // Stops: transparent, #000 <top fade>, #000 <bottom stop>, transparent.
    const stops = getComputedStyle(el).maskImage.match(/rgb\(0, 0, 0\) ([^,]+?)(?=, |\)$)/g) ?? [];
    const [top, bottom] = stops.map(s => s.replace('rgb(0, 0, 0) ', ''));
    return { topFades: top !== '0px', bottomFades: bottom !== '100%' };
  });
  const scrollTo = (where: 'middle' | 'end') => viewport.evaluate((el, w) => {
    el.scrollTop = w === 'end' ? el.scrollHeight : (el.scrollHeight - el.clientHeight) / 2;
  }, where);

  await expect.poll(fades).toEqual({ topFades: false, bottomFades: true });
  await scrollTo('middle');
  await expect.poll(fades).toEqual({ topFades: true, bottomFades: true });
  await scrollTo('end');
  await expect.poll(fades).toEqual({ topFades: true, bottomFades: false });
});
