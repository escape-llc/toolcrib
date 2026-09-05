import { expect } from '@playwright/test';
import { screenReaderTest as test } from '@guidepup/playwright';
import { gotoTab } from '../nav';

// Targets a known, still-open accessibility gap: Modal/AlertDialog never set
// aria-modal="true" (see AGENTS.md's "A component built on a third-party
// primitive can silently omit a standard, spec-recommended ARIA attribute"
// entry). That gap is invisible to axe-core (e2e/accessibility.spec.ts's
// scan) because aria-modal is optional per the WAI-ARIA Dialog pattern --
// only a real screen reader can show whether it has any observable effect
// in practice. Modeled on mui/base-ui's own verified "Screen Reader
// (Windows / NVDA)" CI job.
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
  // announcement, which the missing aria-modal attribute may or may not
  // affect in practice -- this test exists to observe that empirically, not
  // to assume the answer in advance.
  expect(spokenPhrase.toLowerCase()).toContain('confirm account action');

  await page.keyboard.press('Escape');
});
