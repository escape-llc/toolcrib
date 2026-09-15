import { test, expect } from '@playwright/test';
import { gotoTab, loadDemoTableData } from './nav';

// Real-browser confirmation of issue #338's CSV export -- complements
// src/__tests__/DataTable.test.tsx's own jsdom suite (which already covers
// the CSV escaping/value-resolution logic and the download call sequence
// against mocked URL.createObjectURL/anchor click). The one thing genuinely
// worth re-confirming here is that a real click on the built-in button
// triggers a REAL browser download with the right file name and content --
// jsdom's mocks prove the code calls the right APIs in the right order, not
// that a real browser actually produces a file from them.

test.describe('DataTable CSV export (issue #338)', () => {
  test('clicking Export CSV downloads a real users.csv file with a header row and every loaded record', async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'Data Table');
    await loadDemoTableData(page);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('users.csv');

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const text = Buffer.concat(chunks).toString('utf-8').replace(/^﻿/, '');
    const lines = text.split('\r\n').filter(Boolean);

    // Header line reflects the demo's real column titles, not raw keys.
    expect(lines[0]).toContain('Name');
    // More than just the current page's worth of rows -- the full loaded dataset.
    expect(lines.length).toBeGreaterThan(15);
  });
});
