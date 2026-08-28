import { describe, it, expect, beforeEach } from 'vitest';
import { PendingChanges, normalize, joinPatchPath } from '../src/lib/patches.js';

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

  it('normalizes a backslash-containing relPath to forward slashes before building the patch header (last-mile enforcement)', () => {
    changes.propose('components\\Card\\Card.tsx', '', 'export function Card() {}\n');
    expect(changes.entries[0].relPath).toBe('components/Card/Card.tsx');
    expect(changes.entries[0].patch).toContain('b/components/Card/Card.tsx');
    expect(changes.entries[0].patch).not.toMatch(/[ab]\/[^\n]*\\/);
  });

  it('summarize() marks new files distinctly from modifications', () => {
    changes.propose('a.txt', '', 'new\n');
    changes.propose('b.txt', 'old\n', 'new\n');
    const summary = changes.summarize();
    expect(summary).toContain('+ (new) a.txt');
    expect(summary).toContain('~ b.txt');
  });

  // A deletion is just the mirror image of a new file: empty *proposed*
  // content instead of empty *current* content, and the patch's target
  // (not source) becomes /dev/null — confirmed directly against a real
  // `git apply` run (not just asserted here) that this is enough for git
  // to recognize it as "delete this file," no git-extended `diff --git`/
  // `deleted file mode` headers required.
  it('marks empty proposed content as a deletion patch using /dev/null as the target', () => {
    changes.propose('theme/useAnimatedMount.ts', 'export function useAnimatedMount() {}\n', '');
    expect(changes.entries[0].isDeletedFile).toBe(true);
    expect(changes.entries[0].isNewFile).toBe(false);
    expect(changes.entries[0].patch).toContain('/dev/null');
  });

  it('does not mark a new file (empty current content) as also deleted', () => {
    changes.propose('components/dialog.tsx', '', 'export function Dialog() {}\n');
    expect(changes.entries[0].isDeletedFile).toBe(false);
  });

  it('proposes nothing for a file that is already absent on both sides', () => {
    changes.propose('already-gone.ts', '', '');
    expect(changes.isEmpty()).toBe(true);
  });

  it('summarize() marks deletions distinctly from new files and modifications', () => {
    changes.propose('a.txt', '', 'new\n');
    changes.propose('b.txt', 'old\n', 'new\n');
    changes.propose('c.txt', 'old\n', '');
    const summary = changes.summarize();
    expect(summary).toContain('+ (new) a.txt');
    expect(summary).toContain('~ b.txt');
    expect(summary).toContain('- (deleted) c.txt');
  });
});

describe('joinPatchPath', () => {
  // Regression coverage for a real bug found via an end-to-end run on
  // Windows: git apply rejects backslash-separated patch header paths
  // outright, and path.join() normalizes to the platform separator
  // regardless of what separators its inputs already used — so this must
  // never delegate to path.join() even indirectly. These assertions would
  // all still pass under win32's path.join() too (it's the *shape* of the
  // input that matters, not the current OS), which is why it's safe to
  // assert on literal '/' output even though this test suite runs
  // cross-platform in CI.
  it('joins segments with a forward slash', () => {
    expect(joinPatchPath('toolcrib', 'components/Card/Card.tsx')).toBe('toolcrib/components/Card/Card.tsx');
  });

  it('strips a leading "./" from a segment', () => {
    expect(joinPatchPath('./toolcrib', 'index.ts')).toBe('toolcrib/index.ts');
  });

  it('normalizes backslashes within a segment, as defense in depth against an upstream source that missed this', () => {
    // Every relPath source in this CLI is already fixed to produce '/'
    // (see lib/zip.js, scripts/build-release.js) — this is a second line
    // of defense, not the primary fix, for exactly the class of bug that
    // shipped undetected until a real end-to-end Windows run caught it.
    expect(joinPatchPath('toolcrib', 'components\\Card\\Card.tsx')).toBe('toolcrib/components/Card/Card.tsx');
  });

  it('drops empty/falsy segments rather than producing a doubled or leading slash', () => {
    expect(joinPatchPath('toolcrib', '')).toBe('toolcrib');
  });
});
