import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// mergeCommand imports fetchRelease directly from lib/release.js — mock it
// at the module level (before importing mergeCommand) so both calls it
// makes (one for the currently-installed version, one for the target)
// resolve to fakes instead of hitting the network.
vi.mock('../src/lib/release.js', () => ({
  fetchRelease: vi.fn(),
}));

import { fetchRelease } from '../src/lib/release.js';
import { mergeCommand } from '../src/commands/merge.js';

/**
 * Matches the real shape returned by lib/release.js's fetchRelease — see
 * that file's own return statement. `config` only needs enough shape for
 * merge.js's own reads (it doesn't touch peerDependencies itself, but
 * keeping the field present avoids any accidental `undefined` access).
 */
function fakeRelease(version, files) {
  return {
    version,
    config: { peerDependencies: {} },
    readFile: (relPath) => {
      if (files[relPath] === undefined) throw new Error(`no such file in fake release: ${relPath}`);
      return files[relPath];
    },
    allFiles: () => Object.keys(files),
    cleanup: async () => {},
  };
}

/** Find the written patch for a given relPath among writeAll()'s numbered filenames. */
function findPatchFor(patchDir, relPath) {
  const safeName = relPath.replace(/[/\\]/g, '-');
  const files = fs.readdirSync(patchDir);
  return files.find((f) => f.endsWith(`${safeName}.patch`));
}

describe('mergeCommand — lock file update (regression)', () => {
  let tmpDir;
  let originalCwd;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolcrib-merge-test-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);

    // A minimal, already-installed v1.0.0 project — just enough for
    // mergeCommand's own reads (readLock, package.json for the imports
    // patch) to succeed.
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'x', dependencies: {} }, null, 2) + '\n');
    fs.mkdirSync(path.join(tmpDir, 'toolcrib'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'toolcrib', 'index.ts'), 'export {};\n');
    fs.writeFileSync(
      path.join(tmpDir, 'toolcrib', '.toolcrib-lock.json'),
      JSON.stringify({ version: '1.0.0' }, null, 2) + '\n'
    );

    vi.resetAllMocks();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('stages a .toolcrib-lock.json patch advancing to the target version', async () => {
    const oldRelease = fakeRelease('1.0.0', { 'index.ts': 'export {};\n' });
    const newRelease = fakeRelease('2.0.0', { 'index.ts': 'export {};\nexport const x = 1;\n' });
    fetchRelease.mockImplementation((v) => Promise.resolve(v === '1.0.0' ? oldRelease : newRelease));

    await mergeCommand({ version: '2.0.0' });

    const patchDir = path.join(tmpDir, 'toolcrib-patches');
    expect(fs.existsSync(patchDir)).toBe(true);

    const lockPatch = findPatchFor(patchDir, 'toolcrib/.toolcrib-lock.json');
    expect(lockPatch).toBeDefined();

    const patchContent = fs.readFileSync(path.join(patchDir, lockPatch), 'utf-8');
    expect(patchContent).toContain('-  "version": "1.0.0"');
    expect(patchContent).toContain('+  "version": "2.0.0"');
  });

  it('does not stage a lock update when already on the target version', async () => {
    const sameRelease = fakeRelease('1.0.0', { 'index.ts': 'export {};\n' });
    fetchRelease.mockImplementation(() => Promise.resolve(sameRelease));

    await mergeCommand({ version: '1.0.0' });

    // Already-on-this-version is an early return in mergeCommand before any
    // patches are computed at all — no patches directory should appear.
    expect(fs.existsSync(path.join(tmpDir, 'toolcrib-patches'))).toBe(false);
  });
});
