import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import { listFilesRecursive } from './build-tests-release.js';

// Regression test for a real, Gemini-caught defect (issue #435): on
// Windows, path.relative() returns backslash-separated paths, and these
// used to be written straight into toolcrib-tests.config.json's own
// files.tests array with no normalization -- a consumer resolving that
// array on Linux/Mac would treat a stray backslash as a literal filename
// character, not a path separator. Uses a real temp directory tree (not a
// mocked fs) so this exercises the real path.relative()/path.sep behavior
// of whatever OS the test actually runs on, not an assumption about it.

describe('listFilesRecursive (build-tests-release.js internal, issue #435)', () => {
  let tempDir;

  afterEach(() => {
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns forward-slash-separated relative paths for nested files, on any platform', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolcrib-list-files-'));
    fs.mkdirSync(path.join(tempDir, 'nested', 'deeper'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'top.txt'), '');
    fs.writeFileSync(path.join(tempDir, 'nested', 'mid.txt'), '');
    fs.writeFileSync(path.join(tempDir, 'nested', 'deeper', 'bottom.txt'), '');

    const files = listFilesRecursive(tempDir);

    expect(files).toEqual(['nested/deeper/bottom.txt', 'nested/mid.txt', 'top.txt']);
    for (const f of files) {
      expect(f).not.toContain('\\');
    }
  });

  it('returns an empty array for a directory that does not exist', () => {
    expect(listFilesRecursive(path.join(os.tmpdir(), 'toolcrib-does-not-exist-xyz'))).toEqual([]);
  });
});
