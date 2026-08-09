import { describe, it, expect } from 'vitest';
import { FENCE_STYLES, buildFence, extractFence, upsertFence } from '../src/lib/fences.js';

describe.each([
  ['markdown', FENCE_STYLES.markdown, '<!-- toolcrib:managed:demo:start version=1.0.0 -->'],
  ['hash', FENCE_STYLES.hash, '# toolcrib:managed:demo:start version=1.0.0'],
  ['js', FENCE_STYLES.js, '// toolcrib:managed:demo:start version=1.0.0'],
])('fences.js with the %s style', (_name, style, expectedStartLine) => {
  it('builds a fence with the style-appropriate comment syntax', () => {
    const block = buildFence(style, 'demo', '1.0.0', 'payload');
    expect(block.startsWith(expectedStartLine)).toBe(true);
    expect(block).toContain('payload');
  });

  it('round-trips: extract() reads back what build() wrote', () => {
    const block = buildFence(style, 'demo', '1.0.0', 'payload line');
    expect(extractFence(style, block, 'demo')).toEqual({ version: '1.0.0', content: 'payload line', raw: block });
  });

  it('upsert() replaces only the matching id, leaving surrounding content and other ids alone', () => {
    const other = buildFence(style, 'other-id', '1.0.0', 'unrelated');
    const original = `before\n${buildFence(style, 'demo', '1.0.0', 'old')}\n${other}\nafter`;

    const updated = upsertFence(style, original, 'demo', '2.0.0', 'new');

    expect(updated).toContain('before');
    expect(updated).toContain('after');
    expect(extractFence(style, updated, 'demo')).toMatchObject({ version: '2.0.0', content: 'new' });
    expect(extractFence(style, updated, 'other-id')).toMatchObject({ version: '1.0.0', content: 'unrelated' });
  });
});

describe.each([
  ['markdown', FENCE_STYLES.markdown],
  ['hash', FENCE_STYLES.hash],
  ['js', FENCE_STYLES.js],
])('fences.js with the %s style against CRLF content', (_name, style) => {
  // Regression coverage for a real bug found via an end-to-end run on
  // Windows: `git apply` writes CRLF when core.autocrlf=true (a common
  // Windows Git default), and the fence patterns originally required a
  // bare \n — silently matching zero blocks against a real CRLF file, no
  // error, just wrong. buildFence() itself still emits \n-only content;
  // this simulates what the file actually looks like on disk afterward.
  const toCrlf = (text) => text.replace(/\n/g, '\r\n');

  it('extractFence still finds the block when the file uses CRLF line endings', () => {
    const block = toCrlf(buildFence(style, 'demo', '1.0.0', 'payload'));
    expect(extractFence(style, block, 'demo')).toMatchObject({ version: '1.0.0', content: 'payload' });
  });

  it('upsertFence replaces (not duplicates) an existing CRLF-written block', () => {
    const original = toCrlf(buildFence(style, 'demo', '1.0.0', 'old'));
    const updated = upsertFence(style, original, 'demo', '2.0.0', 'new');
    expect(extractFence(style, updated, 'demo')).toMatchObject({ version: '2.0.0', content: 'new' });
    // Only one start marker for this id — confirms replace, not a second,
    // duplicate block appended alongside the (undetected) CRLF original.
    const occurrences = updated.split('toolcrib:managed:demo:start').length - 1;
    expect(occurrences).toBe(1);
  });
});

describe('fences.js style isolation', () => {
  it('does not match a markdown fence when reading with the hash style, or vice versa', () => {
    const markdownBlock = buildFence(FENCE_STYLES.markdown, 'demo', '1.0.0', 'payload');
    expect(extractFence(FENCE_STYLES.hash, markdownBlock, 'demo')).toBeNull();

    const hashBlock = buildFence(FENCE_STYLES.hash, 'demo', '1.0.0', 'payload');
    expect(extractFence(FENCE_STYLES.markdown, hashBlock, 'demo')).toBeNull();
  });
});
