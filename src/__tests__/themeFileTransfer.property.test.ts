import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { readThemeSnapshotFromFile } from '../theme/themeFileTransfer';

// readThemeSnapshotFromFile is the one place in the whole toolkit that
// parses genuinely untrusted external input -- a file a user drags into
// the Theme Editor, never something toolcrib generated itself. Every
// other property test in this repo targets pure internal math; this one
// targets that actual trust boundary.

describe('readThemeSnapshotFromFile (property)', () => {
  it('never hangs and never throws synchronously for arbitrary file content -- always settles the promise cleanly', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string(), fc.string({ minLength: 1 }), async (content, filename) => {
        const file = new File([content], filename, { type: 'application/json' });
        try {
          await readThemeSnapshotFromFile(file);
          // Resolved: fine, as long as it didn't throw getting there.
        } catch (err) {
          // Rejected: also fine, as long as it's the clean Error this
          // function documents itself as always rejecting with -- never
          // an unrelated crash (a TypeError from deep inside JSON.parse
          // internals, e.g.) leaking out unformatted.
          expect(err).toBeInstanceOf(Error);
          expect((err as Error).message).toMatch(/not valid JSON|doesn't look like a toolcrib theme/);
        }
      }),
      { numRuns: 1000 }
    );
  });

  it('never resolves with a value readThemeSnapshotFromFile has not itself validated the shape of', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.jsonValue(), // arbitrary valid JSON of any shape -- objects, arrays, primitives, null
          fc.constant(undefined)
        ),
        async (value) => {
          const content = value === undefined ? 'not json at all {{{' : JSON.stringify(value);
          const file = new File([content], 'fuzzed.json', { type: 'application/json' });
          try {
            const result = await readThemeSnapshotFromFile(file);
            // If it resolved, the parsed value must actually satisfy the
            // real schemaVersion:1 shape -- not just "was valid JSON."
            expect(result).toBeTruthy();
            expect(typeof result).toBe('object');
            expect((result as { schemaVersion?: unknown }).schemaVersion).toBe(1);
          } catch (err) {
            expect(err).toBeInstanceOf(Error);
          }
        }
      ),
      { numRuns: 1000 }
    );
  });
});
