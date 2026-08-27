import { test, expect } from '@playwright/test';
import { gotoTab } from './nav';

// UIGroup's own border-merging CSS (.toolcrib-group > *) only reaches
// *direct* DOM children -- jsdom can't evaluate that stylesheet rule at
// all (see src/__tests__/UIGroup.test.tsx's own file-level comment), and
// even a real-browser check of computed style on a plain direct child
// wouldn't prove the actual regression this fix addresses: a Popup's
// trigger sits behind an internal wrapper <div> (for flex-stretch inside
// a row like UIGroup), which that CSS selector never reaches. The fix is
// a separate mechanism entirely (UIGroupContext, computed in JS and
// applied as each button's own inline style) -- this test confirms it
// actually resolves to zero corner radius in a real browser, not just
// that the unit test's jsdom-computed inline style looks right in
// isolation.
test('a Popup trigger inside a UIGroup gets its corners squared, despite Popup wrapping it in its own internal div', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Component Showcase');

  const optionsButton = page.getByRole('button', { name: 'Options', exact: true });
  await optionsButton.scrollIntoViewIfNeeded();

  const radii = await optionsButton.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      topLeft: cs.borderTopLeftRadius,
      topRight: cs.borderTopRightRadius,
      bottomLeft: cs.borderBottomLeftRadius,
      bottomRight: cs.borderBottomRightRadius,
    };
  });

  // Middle item of a 3-button horizontal group -- every corner squared.
  expect(radii).toEqual({ topLeft: '0px', topRight: '0px', bottomLeft: '0px', bottomRight: '0px' });
});
