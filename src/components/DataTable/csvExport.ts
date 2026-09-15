'use client';

import type { Column } from './DataTable';

/**
 * RFC 4180 field escaping -- wraps a field in double quotes and doubles any
 * embedded quote whenever it contains a comma, double-quote, or line break
 * (the characters that would otherwise break simple comma-joined parsing).
 */
function escapeCsvField(raw: string): string {
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

/**
 * Renders `data` as a CSV string using `columns`' own header titles and
 * resolved cell values (`accessorFn` if given, else `record[key]`) -- the
 * SAME value resolution `useTableSort`'s own `getValue` uses, not each
 * column's `render` output, since `render` can return arbitrary JSX with no
 * meaningful plain-text fallback. `\r\n` line endings, per RFC 4180.
 */
export function columnsToCsv<T extends Record<string, any>>(columns: Column<T>[], data: T[]): string {
  const header = columns.map(c => escapeCsvField(c.title)).join(',');
  const rows = data.map(record =>
    columns
      .map(col => {
        const value = col.accessorFn ? col.accessorFn(record) : record[col.key];
        return escapeCsvField(String(value ?? ''));
      })
      .join(',')
  );
  return [header, ...rows].join('\r\n');
}

/**
 * Triggers a browser download of `content` as a file named `filename` -- the
 * standard Blob + object-URL + synthetic-`<a>` pattern, with the URL revoked
 * immediately after the click so it doesn't leak for the life of the page. A
 * leading UTF-8 BOM is prepended so Excel (which otherwise guesses the wrong
 * encoding for a plain UTF-8 CSV with no BOM, mangling any non-ASCII
 * character) opens the file correctly -- a real, common CSV gotcha, not a
 * hypothetical one.
 */
export function downloadCsvFile(filename: string, content: string): void {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
