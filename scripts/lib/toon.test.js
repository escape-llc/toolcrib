import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { toToon } from './toon.js';

// Reads the committed manifest directly (fs/path + process.cwd() only —
// no import.meta.url path resolution) rather than importing extract.js's
// own generator functions: under Vitest's Vite-based transform,
// extract.js's `import.meta.url`-based ROOT resolution throws ("The URL
// must be of scheme file"), a real cross-tool quirk between plain `node
// scripts/x.js` execution (what extract.js is actually designed for) and
// Vite's module graph. Reading the already-generated JSON file sidesteps
// it entirely, and is arguably more faithful to "the exact real data from
// component-manifest.json" than re-deriving it live would be.
// `npm test`/`vitest run` always run from the repo root, so process.cwd()
// is a safe, simple anchor here.
function readCommittedEventChannels() {
  const manifestPath = path.resolve(process.cwd(), 'ai-docs', 'component-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  return manifest.eventBus.channels;
}

describe('toToon', () => {
  it('returns an empty string for an empty array', () => {
    expect(toToon([])).toBe('');
  });

  it('serializes a simple uniform array with a correct header and row count', () => {
    const rows = [
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta' },
    ];
    const out = toToon(rows);
    const lines = out.split('\n');
    expect(lines[0]).toBe('[2]{id,label}:');
    expect(lines.length).toBe(rows.length + 1);
  });

  it('quotes a value containing a comma so column count is not corrupted on read-back', () => {
    const rows = [{ name: 'x', payload: 'Record<string, string>' }];
    const out = toToon(rows);
    const dataLine = out.split('\n')[1];
    // The quoted field must appear as one field, not split into two by the comma inside it.
    expect(dataLine).toContain('"Record<string, string>"');
    // Splitting naively on ',' outside the quotes should still yield exactly 2 top-level fields.
    const quoted = dataLine.trim();
    expect(quoted.startsWith('x,"Record<string, string>"')).toBe(true);
  });

  it('quotes a value containing a colon (e.g. an event name like theme:changed)', () => {
    const rows = [{ name: 'theme:changed', payload: '{ parameters: ThemeParameters }' }];
    const out = toToon(rows);
    const dataLine = out.split('\n')[1];
    expect(dataLine).toContain('"theme:changed"');
  });

  it('escapes a double-quote character by doubling it', () => {
    const rows = [{ name: 'x', payload: 'a "quoted" word' }];
    const out = toToon(rows);
    const dataLine = out.split('\n')[1];
    expect(dataLine).toContain('"a ""quoted"" word"');
  });

  it('serializes the real eventBus.channels data without throwing, with the expected line count', () => {
    const channels = readCommittedEventChannels();
    expect(channels.length).toBeGreaterThan(0);
    const out = toToon(channels);
    const lines = out.split('\n');
    expect(lines.length).toBe(channels.length + 1);
    expect(lines[0]).toBe(`[${channels.length}]{name,payload}:`);
  });
});
