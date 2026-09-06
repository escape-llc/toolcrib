import { expect } from '@playwright/test';
import { screenReaderTest as test } from '@guidepup/playwright';
import { gotoTab } from '../nav';

// A real-screen-reader-level complement to Overlay.test.tsx's own
// attribute-level regression test for Modal's aria-modal="true" (see
// AGENTS.md's "A component built on a third-party primitive can silently
// omit a standard, spec-recommended ARIA attribute" entry -- that gap was
// found and fixed there, with its own regression test; this file checks a
// different, deeper thing entirely). axe-core (e2e/accessibility.spec.ts's
// scan) can only confirm an ARIA attribute's presence, never whether a real
// screen reader actually announces a dialog's accessible name correctly on
// open -- that's what this test exists to observe directly. Modeled on
// mui/base-ui's own verified "Screen Reader (Windows / NVDA)" CI job.
test.use({ screenReaderStartOptions: { capture: true } });

test('NVDA announces the Modal when it opens', async ({ page, screenReader }) => {
  await page.goto('/');
  await page.waitForSelector('h1');
  await gotoTab(page, 'Overlays & Actions');
  await page.bringToFront();

  // capture() wraps an arbitrary Playwright-driven action and returns the
  // NVDA speech produced while it ran -- the documented mechanism for
  // testing a real interaction's effect (as opposed to
  // navigateToWebContent() + next(), used in smoke.spec.ts for browsing
  // static content). See @guidepup/guidepup's NVDA.capture() JSDoc.
  const { spokenPhrase } = await screenReader.capture(async () => {
    await page.getByRole('button', { name: 'Open Modal Dialog' }).click();
    await page.getByRole('dialog').waitFor();
  });

  // demo/App.tsx's Modal instance sets ariaLabel="Confirm Account Action" --
  // its designated accessible name, which a screen reader should speak when
  // focus moves into the dialog on open. Deliberately not asserting the
  // literal word "dialog" is present: that depends on NVDA's own role
  // announcement, which no DOM-level check (axe-core included) can confirm
  // either way -- this test exists to observe that empirically.
  expect(spokenPhrase.toLowerCase()).toContain('confirm account action');

  await page.keyboard.press('Escape');
});
