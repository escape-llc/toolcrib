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
import { buildManagedBlock } from '../src/lib/managedDocs.js';

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

// classify() itself isn't exported (only mergeCommand is) — these exercise
// its full four-way outcome matrix (unchanged / safe-update / keep-local /
// conflict) indirectly, the only way it's reachable, for a normal file that
// still exists in the target release. The "removed upstream" describe block
// above covers the two outcomes reachable through that separate code path
// (safe-update -> delete, conflict); this covers the other loop.
describe('mergeCommand — classify() outcomes for a normal file update', () => {
  let tmpDir;
  let originalCwd;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolcrib-merge-classify-test-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);

    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'x', dependencies: {} }, null, 2) + '\n');
    fs.mkdirSync(path.join(tmpDir, 'toolcrib'), { recursive: true });
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

  it('unchanged: proposes nothing when local matches the original and upstream did not change it', async () => {
    fs.writeFileSync(path.join(tmpDir, 'toolcrib', 'widget.ts'), 'export const widget = 1;\n');
    const oldRelease = fakeRelease('1.0.0', { 'widget.ts': 'export const widget = 1;\n' });
    const newRelease = fakeRelease('2.0.0', { 'widget.ts': 'export const widget = 1;\n' });
    fetchRelease.mockImplementation((v) => Promise.resolve(v === '1.0.0' ? oldRelease : newRelease));

    await mergeCommand({ version: '2.0.0' });

    const patchDir = path.join(tmpDir, 'toolcrib-patches');
    // Only the lock file bump should be staged — nothing for widget.ts.
    expect(findPatchFor(patchDir, 'toolcrib/widget.ts')).toBeUndefined();
    expect(findPatchFor(patchDir, 'toolcrib/widget.ts.upstream-diff')).toBeUndefined();
    expect(fs.readFileSync(path.join(tmpDir, 'toolcrib', 'widget.ts'), 'utf-8')).toBe('export const widget = 1;\n');
  });

  it('safe-update: proposes a clean update patch when local is untouched but upstream changed the file', async () => {
    fs.writeFileSync(path.join(tmpDir, 'toolcrib', 'widget.ts'), 'export const widget = 1;\n');
    const oldRelease = fakeRelease('1.0.0', { 'widget.ts': 'export const widget = 1;\n' });
    const newRelease = fakeRelease('2.0.0', { 'widget.ts': 'export const widget = 2;\n' });
    fetchRelease.mockImplementation((v) => Promise.resolve(v === '1.0.0' ? oldRelease : newRelease));

    await mergeCommand({ version: '2.0.0' });

    const patchDir = path.join(tmpDir, 'toolcrib-patches');
    const patch = findPatchFor(patchDir, 'toolcrib/widget.ts');
    expect(patch).toBeDefined();
    expect(findPatchFor(patchDir, 'toolcrib/widget.ts.upstream-diff')).toBeUndefined();

    const patchContent = fs.readFileSync(path.join(patchDir, patch), 'utf-8');
    expect(patchContent).toContain('-export const widget = 1;');
    expect(patchContent).toContain('+export const widget = 2;');
    // Not applied to disk by merge itself — only staged as a patch for `apply`.
    expect(fs.readFileSync(path.join(tmpDir, 'toolcrib', 'widget.ts'), 'utf-8')).toBe('export const widget = 1;\n');
  });

  it('keep-local: proposes nothing when local was customized but upstream left the file alone', async () => {
    fs.writeFileSync(path.join(tmpDir, 'toolcrib', 'widget.ts'), 'export const widget = 1; // my own tweak\n');
    const oldRelease = fakeRelease('1.0.0', { 'widget.ts': 'export const widget = 1;\n' });
    const newRelease = fakeRelease('2.0.0', { 'widget.ts': 'export const widget = 1;\n' });
    fetchRelease.mockImplementation((v) => Promise.resolve(v === '1.0.0' ? oldRelease : newRelease));

    await mergeCommand({ version: '2.0.0' });

    const patchDir = path.join(tmpDir, 'toolcrib-patches');
    expect(findPatchFor(patchDir, 'toolcrib/widget.ts')).toBeUndefined();
    expect(findPatchFor(patchDir, 'toolcrib/widget.ts.upstream-diff')).toBeUndefined();
    // The local customization is left completely untouched.
    expect(fs.readFileSync(path.join(tmpDir, 'toolcrib', 'widget.ts'), 'utf-8')).toBe('export const widget = 1; // my own tweak\n');
  });

  it('conflict: stages an upstream-diff note (not a silent overwrite) when both local and upstream changed the file', async () => {
    fs.writeFileSync(path.join(tmpDir, 'toolcrib', 'widget.ts'), 'export const widget = 1; // my own tweak\n');
    const oldRelease = fakeRelease('1.0.0', { 'widget.ts': 'export const widget = 1;\n' });
    const newRelease = fakeRelease('2.0.0', { 'widget.ts': 'export const widget = 2;\n' });
    fetchRelease.mockImplementation((v) => Promise.resolve(v === '1.0.0' ? oldRelease : newRelease));

    await mergeCommand({ version: '2.0.0' });

    const patchDir = path.join(tmpDir, 'toolcrib-patches');
    expect(findPatchFor(patchDir, 'toolcrib/widget.ts')).toBeUndefined();
    const conflictPatch = findPatchFor(patchDir, 'toolcrib/widget.ts.upstream-diff');
    expect(conflictPatch).toBeDefined();

    const patchContent = fs.readFileSync(path.join(patchDir, conflictPatch), 'utf-8');
    expect(patchContent).toContain('modified locally AND changed upstream');
    expect(patchContent).not.toContain('removed upstream'); // distinct from the removed-upstream conflict note
    expect(fs.readFileSync(path.join(tmpDir, 'toolcrib', 'widget.ts'), 'utf-8')).toBe('export const widget = 1; // my own tweak\n');
  });
});

describe('mergeCommand — files removed upstream', () => {
  let tmpDir;
  let originalCwd;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolcrib-merge-removed-test-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);

    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'x', dependencies: {} }, null, 2) + '\n');
    fs.mkdirSync(path.join(tmpDir, 'toolcrib', 'theme'), { recursive: true });
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

  it('proposes deleting a file that is unmodified locally and removed upstream', async () => {
    fs.writeFileSync(path.join(tmpDir, 'toolcrib', 'theme', 'useAnimatedMount.ts'), 'export function useAnimatedMount() {}\n');

    const oldRelease = fakeRelease('1.0.0', {
      'index.ts': 'export {};\n',
      'theme/useAnimatedMount.ts': 'export function useAnimatedMount() {}\n',
    });
    const newRelease = fakeRelease('2.0.0', { 'index.ts': 'export {};\n' });
    fetchRelease.mockImplementation((v) => Promise.resolve(v === '1.0.0' ? oldRelease : newRelease));

    await mergeCommand({ version: '2.0.0' });

    const patchDir = path.join(tmpDir, 'toolcrib-patches');
    const deletionPatch = findPatchFor(patchDir, 'toolcrib/theme/useAnimatedMount.ts');
    expect(deletionPatch).toBeDefined();

    const patchContent = fs.readFileSync(path.join(patchDir, deletionPatch), 'utf-8');
    expect(patchContent).toContain('/dev/null');
    expect(patchContent).toContain('-export function useAnimatedMount() {}');
  });

  it('flags a conflict instead of silently deleting a file that was modified locally and removed upstream', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'toolcrib', 'theme', 'useAnimatedMount.ts'),
      'export function useAnimatedMount() { /* my own tweak */ }\n'
    );

    const oldRelease = fakeRelease('1.0.0', {
      'index.ts': 'export {};\n',
      'theme/useAnimatedMount.ts': 'export function useAnimatedMount() {}\n',
    });
    const newRelease = fakeRelease('2.0.0', { 'index.ts': 'export {};\n' });
    fetchRelease.mockImplementation((v) => Promise.resolve(v === '1.0.0' ? oldRelease : newRelease));

    await mergeCommand({ version: '2.0.0' });

    const patchDir = path.join(tmpDir, 'toolcrib-patches');
    // No deletion patch — the modified file is left untouched, and a
    // conflict note is staged instead (same shape as any other conflict).
    expect(findPatchFor(patchDir, 'toolcrib/theme/useAnimatedMount.ts')).toBeUndefined();
    const conflictPatch = findPatchFor(patchDir, 'toolcrib/theme/useAnimatedMount.ts.upstream-diff');
    expect(conflictPatch).toBeDefined();

    const patchContent = fs.readFileSync(path.join(patchDir, conflictPatch), 'utf-8');
    expect(patchContent).toContain('removed upstream');
    expect(fs.readFileSync(path.join(tmpDir, 'toolcrib', 'theme', 'useAnimatedMount.ts'), 'utf-8')).toContain('my own tweak');
  });

  it('proposes nothing for a file removed upstream that is already absent locally', async () => {
    // No useAnimatedMount.ts written to disk this time.
    const oldRelease = fakeRelease('1.0.0', {
      'index.ts': 'export {};\n',
      'theme/useAnimatedMount.ts': 'export function useAnimatedMount() {}\n',
    });
    const newRelease = fakeRelease('2.0.0', { 'index.ts': 'export {};\n' });
    fetchRelease.mockImplementation((v) => Promise.resolve(v === '1.0.0' ? oldRelease : newRelease));

    await mergeCommand({ version: '2.0.0' });

    const patchDir = path.join(tmpDir, 'toolcrib-patches');
    expect(findPatchFor(patchDir, 'toolcrib/theme/useAnimatedMount.ts')).toBeUndefined();
    expect(findPatchFor(patchDir, 'toolcrib/theme/useAnimatedMount.ts.upstream-diff')).toBeUndefined();
  });
});

// mergeManagedBlocks() runs the same classify() logic as the vendored-file
// loop above, but against <!-- toolcrib:managed:... --> blocks inside the
// user's own AGENTS.md/CLAUDE.md instead of whole files under ./toolcrib/
// — a separate code path (also not exported; only reachable through
// mergeCommand) with its own four-way outcome matrix worth the same direct
// coverage as the vendored-file one.
describe('mergeCommand — managed block (AGENTS.md) outcomes', () => {
  let tmpDir;
  let originalCwd;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolcrib-merge-managed-test-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);

    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'x', dependencies: {} }, null, 2) + '\n');
    fs.mkdirSync(path.join(tmpDir, 'toolcrib'), { recursive: true });
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

  it('unchanged: proposes nothing when the block matches the original and upstream left the doc alone', async () => {
    const original = '# Core\nOriginal rules.\n';
    fs.writeFileSync(
      path.join(tmpDir, 'AGENTS.md'),
      `# My Project\n\n${buildManagedBlock('core', '1.0.0', original)}\n`
    );
    const oldRelease = fakeRelease('1.0.0', { 'index.ts': 'export {};\n', 'ai-docs/CORE.md': original });
    const newRelease = fakeRelease('2.0.0', { 'index.ts': 'export {};\n', 'ai-docs/CORE.md': original });
    fetchRelease.mockImplementation((v) => Promise.resolve(v === '1.0.0' ? oldRelease : newRelease));

    await mergeCommand({ version: '2.0.0' });

    const patchDir = path.join(tmpDir, 'toolcrib-patches');
    expect(findPatchFor(patchDir, 'AGENTS.md')).toBeUndefined();
  });

  it('safe-update: updates the block to the new version/content when it was never hand-edited', async () => {
    const original = '# Core\nOriginal rules.\n';
    const updated = '# Core\nUpdated rules.\n';
    fs.writeFileSync(
      path.join(tmpDir, 'AGENTS.md'),
      `# My Project\n\n${buildManagedBlock('core', '1.0.0', original)}\n`
    );
    const oldRelease = fakeRelease('1.0.0', { 'index.ts': 'export {};\n', 'ai-docs/CORE.md': original });
    const newRelease = fakeRelease('2.0.0', { 'index.ts': 'export {};\n', 'ai-docs/CORE.md': updated });
    fetchRelease.mockImplementation((v) => Promise.resolve(v === '1.0.0' ? oldRelease : newRelease));

    await mergeCommand({ version: '2.0.0' });

    const patchDir = path.join(tmpDir, 'toolcrib-patches');
    const patch = findPatchFor(patchDir, 'AGENTS.md');
    expect(patch).toBeDefined();
    const patchContent = fs.readFileSync(path.join(patchDir, patch), 'utf-8');
    expect(patchContent).toContain('Updated rules.');
    expect(patchContent).toContain('version=2.0.0');
  });

  it('keep-local: proposes nothing when the block was hand-edited but upstream left the doc alone', async () => {
    const original = '# Core\nOriginal rules.\n';
    const handEdited = '# Core\nOriginal rules, plus my own note.\n';
    fs.writeFileSync(
      path.join(tmpDir, 'AGENTS.md'),
      `# My Project\n\n${buildManagedBlock('core', '1.0.0', handEdited)}\n`
    );
    const oldRelease = fakeRelease('1.0.0', { 'index.ts': 'export {};\n', 'ai-docs/CORE.md': original });
    const newRelease = fakeRelease('2.0.0', { 'index.ts': 'export {};\n', 'ai-docs/CORE.md': original });
    fetchRelease.mockImplementation((v) => Promise.resolve(v === '1.0.0' ? oldRelease : newRelease));

    await mergeCommand({ version: '2.0.0' });

    const patchDir = path.join(tmpDir, 'toolcrib-patches');
    expect(findPatchFor(patchDir, 'AGENTS.md')).toBeUndefined();
    expect(fs.readFileSync(path.join(tmpDir, 'AGENTS.md'), 'utf-8')).toContain('plus my own note');
  });

  it('conflict: stages a managed-block upstream-diff note when both the block and upstream changed', async () => {
    const original = '# Core\nOriginal rules.\n';
    const handEdited = '# Core\nOriginal rules, plus my own note.\n';
    const updated = '# Core\nUpdated rules.\n';
    fs.writeFileSync(
      path.join(tmpDir, 'AGENTS.md'),
      `# My Project\n\n${buildManagedBlock('core', '1.0.0', handEdited)}\n`
    );
    const oldRelease = fakeRelease('1.0.0', { 'index.ts': 'export {};\n', 'ai-docs/CORE.md': original });
    const newRelease = fakeRelease('2.0.0', { 'index.ts': 'export {};\n', 'ai-docs/CORE.md': updated });
    fetchRelease.mockImplementation((v) => Promise.resolve(v === '1.0.0' ? oldRelease : newRelease));

    await mergeCommand({ version: '2.0.0' });

    const patchDir = path.join(tmpDir, 'toolcrib-patches');
    expect(findPatchFor(patchDir, 'AGENTS.md')).toBeUndefined();
    const conflictPatch = findPatchFor(patchDir, 'AGENTS.md.managed-core.upstream-diff');
    expect(conflictPatch).toBeDefined();
    const patchContent = fs.readFileSync(path.join(patchDir, conflictPatch), 'utf-8');
    expect(patchContent).toContain('modified locally AND changed upstream');
    // The file on disk is untouched — the hand-edited block stays exactly as-is.
    expect(fs.readFileSync(path.join(tmpDir, 'AGENTS.md'), 'utf-8')).toContain('plus my own note');
  });
});
