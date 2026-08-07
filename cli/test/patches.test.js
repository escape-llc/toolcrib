import { describe, it, expect, beforeEach } from 'vitest';
import { PendingChanges, normalize } from '../src/lib/patches.js';

describe('normalize', () => {
  it('converts CRLF to LF', () => {
    expect(normalize('a\r\nb\r\n')).toBe('a\nb\n');
  });

  it('converts lone CR to LF', () => {
    expect(normalize('a\rb\r')).toBe('a\nb\n');
  });

  it('leaves already-LF content untouched', () => {
    expect(normalize('a\nb\n')).toBe('a\nb\n');
  });

  it('treats content differing only by line ending as equal after normalization', () => {
    expect(normalize('line1\r\nline2\r\n')).toBe(normalize('line1\nline2\n'));
  });
});

describe('PendingChanges', () => {
  let changes;

  beforeEach(() => {
    changes = new PendingChanges();
  });

  it('starts empty', () => {
    expect(changes.isEmpty()).toBe(true);
    expect(changes.count()).toBe(0);
  });

  it('proposes nothing when current and proposed content are identical', () => {
    changes.propose('foo.txt', 'same content\n', 'same content\n');
    expect(changes.isEmpty()).toBe(true);
  });

  it('proposes nothing when content differs only by line ending (normalization)', () => {
    changes.propose('foo.txt', 'same content\r\n', 'same content\n');
    expect(changes.isEmpty()).toBe(true);
  });

  it('proposes a change when content genuinely differs', () => {
    changes.propose('foo.txt', 'old\n', 'new\n');
    expect(changes.count()).toBe(1);
  });

  it('marks empty current content as a new-file patch using /dev/null as the source', () => {
    changes.propose('components/dialog.tsx', '', 'export function Dialog() {}\n');
    expect(changes.entries[0].isNewFile).toBe(true);
    expect(changes.entries[0].patch).toContain('/dev/null');
  });

  it('does not mark a modification to existing content as a new file', () => {
    changes.propose('components/dialog.tsx', 'export function Dialog() { return null; }\n', 'export function Dialog() { return <div/>; }\n');
    expect(changes.entries[0].isNewFile).toBe(false);
    expect(changes.entries[0].patch).not.toContain('/dev/null');
  });

  it('accumulates multiple proposals independently', () => {
    changes.propose('a.txt', '', 'new a\n');
    changes.propose('b.txt', 'old b\n', 'new b\n');
    changes.propose('c.txt', 'same\n', 'same\n'); // should be skipped
    expect(changes.count()).toBe(2);
  });

  it('summarize() marks new files distinctly from modifications', () => {
    changes.propose('a.txt', '', 'new\n');
    changes.propose('b.txt', 'old\n', 'new\n');
    const summary = changes.summarize();
    expect(summary).toContain('+ (new) a.txt');
    expect(summary).toContain('~ b.txt');
  });
});
