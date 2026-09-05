import { expect } from '@playwright/test';
import { screenReaderTest as test } from '@guidepup/playwright';

// A minimal end-to-end sanity check for the NVDA <-> Playwright wiring
// itself (real connection, real speech capture) -- kept separate from
// modal.spec.ts's actual accessibility assertion so a wiring failure (NVDA
// not installed/connecting) and a real regression in Modal's behavior fail
// with two distinguishable, independently useful signals rather than one.
test.use({ screenReaderStartOptions: { capture: true } });

test('NVDA can read the demo app heading', async ({ page, screenReader }) => {
  await page.goto('/');
  await page.waitForSelector('h1');
  await page.bringToFront();
  await screenReader.navigateToWebContent();

  const itemText = await screenReader.itemText();
  const spokenPhrase = await screenReader.lastSpokenPhrase();

  expect(itemText.length + spokenPhrase.length).toBeGreaterThan(0);
});
