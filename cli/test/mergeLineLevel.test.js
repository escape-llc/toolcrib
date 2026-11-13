import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

// Same module-level mock as merge.test.js: releases are fakes, git is real.
vi.mock('../src/lib/release.js', () => ({
  fetchRelease: vi.fn(),
  fetchTestsRelease: vi.fn(),
}));

import { fetchRelease, fetchTestsRelease } from '../src/lib/release.js';
import { mergeCommand } from '../src/commands/merge.js';
import { applyCommand } from '../src/commands/apply.js';
import { gitApplyStreaming } from '../src/lib/git.js';

/** A release whose files may be strings (text) or Buffers (binary). */
function fakeRelease(version, files) {
  const get = (relPath) => {
    if (files[relPath] === undefined) throw new Error(`no such file in fake release: ${relPath}`);
    return files[relPath];
  };
  return {
    version,
    config: { peerDependencies: {} },
    readFile: (relPath) => {
      const f = get(relPath);
      return Buffer.isBuffer(f) ? f.toString('utf8') : f;
    },
    readBuffer: (relPath) => {
      const f = get(relPath);
      return Buffer.isBuffer(f) ? f : Buffer.from(f, 'utf8');
    },
    allFiles: () => Object.keys(files),
    cleanup: async () => {},
  };
}

const lines = (n, edit = {}) => Array.from({ length: n }, (_, i) => `${edit[i + 1] ?? `line ${i + 1}`}\n`).join('');
const crlf = (s) => s.replace(/\n/g, '\r\n');

describe.each(['git', 'js'])('mergeCommand — line-level three-way merge (%s engine)', (mergeEngine) => {
  let tmpDir;
  let originalCwd;
  let out;
  let writeSpy;

  const patchDir = () => path.join(tmpDir, 'toolcrib-patches');
  const kit = (rel) => path.join(tmpDir, 'toolcrib', ...rel.split('/'));
  const writeKit = (rel, content) => {
    fs.mkdirSync(path.dirname(kit(rel)), { recursive: true });
    fs.writeFileSync(kit(rel), content);
  };
  const patchFor = (relPath) => {
    const safe = relPath.replace(/[/\\]/g, '-');
    const f = fs.existsSync(patchDir()) ? fs.readdirSync(patchDir()).find((x) => x.endsWith(`${safe}.patch`)) : undefined;
    return f ? fs.readFileSync(path.join(patchDir(), f), 'utf-8') : undefined;
  };
  const run = async (oldFiles, newFiles, extra = {}) => {
    const oldR = fakeRelease('1.0.0', oldFiles);
    const newR = fakeRelease('2.0.0', newFiles);
    fetchRelease.mockImplementation((v) => Promise.resolve(v === '1.0.0' ? oldR : newR));
    await mergeCommand({ version: '2.0.0', mergeEngine, ...extra });
    return out.join('');
  };
  /** Apply the staged patches with real git into the tmp project. */
  const applyForReal = async () => {
    const names = fs.readdirSync(patchDir()).filter((f) => f.endsWith('.patch')).sort();
    for (const n of names) {
      const r = await gitApplyStreaming(path.join(patchDir(), n), tmpDir);
      expect(r.success, `${n}: ${r.error}`).toBe(true);
    }
  };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolcrib-merge-line-test-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
    execFileSync('git', ['init', '-q'], { cwd: tmpDir });
    execFileSync('git', ['config', 'core.autocrlf', 'false'], { cwd: tmpDir });
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'x', dependencies: {}, imports: { '#toolcrib': './toolcrib/index.ts' } }, null, 2) + '\n');
    writeKit('.toolcrib-lock.json', JSON.stringify({ version: '1.0.0' }, null, 2) + '\n');
    vi.resetAllMocks();
    out = [];
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      out.push(String(chunk));
      return true;
    });
  });

  afterEach(() => {
    writeSpy.mockRestore();
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('merges far-apart edits cleanly into one ordinary patch, counted as merged', async () => {
    writeKit('w.ts', lines(20, { 2: 'my tweak' }));
    const summary = await run({ 'w.ts': lines(20) }, { 'w.ts': lines(20, { 18: 'upstream edit' }) });

    const patch = patchFor('toolcrib/w.ts');
    expect(patch).toContain('+upstream edit');
    expect(patch).not.toContain('<<<<<<<');
    expect(fs.existsSync(path.join(patchDir(), 'conflicts'))).toBe(false);
    expect(summary).toMatch(/1 merged/);
    expect(summary).toMatch(/0 conflict\(s\)/);

    await applyForReal();
    expect(fs.readFileSync(kit('w.ts'), 'utf-8')).toBe(lines(20, { 2: 'my tweak', 18: 'upstream edit' }));
  });

  it('proposes conflict markers for overlapping edits, lists the path, and stages the note outside the kit', async () => {
    writeKit('w.ts', lines(10, { 5: 'my five' }));
    const summary = await run({ 'w.ts': lines(10) }, { 'w.ts': lines(10, { 5: 'upstream five' }) });

    const patch = patchFor('toolcrib/w.ts');
    expect(patch).toContain('<<<<<<< local');
    expect(patch).toContain('>>>>>>> v2.0.0');
    expect(summary).toMatch(/1 conflict\(s\)/);
    expect(summary).toContain('toolcrib/w.ts');
    expect(summary).toContain('conflicts/w.ts.md');
    expect(fs.readFileSync(path.join(patchDir(), 'conflicts', 'w.ts.md'), 'utf-8')).toContain('What upstream changed');

    await applyForReal();
    const applied = fs.readFileSync(kit('w.ts'), 'utf-8');
    expect(applied).toBe(lines(10).replace('line 5\n', '<<<<<<< local\nmy five\n=======\nupstream five\n>>>>>>> v2.0.0\n'));
  });

  it('reports a change the new release already contains as absorbed, not updated or conflicted', async () => {
    // Local made edit X; upstream took X too (plus an unrelated edit far away).
    writeKit('w.ts', lines(20, { 3: 'the fix' }));
    const summary = await run({ 'w.ts': lines(20) }, { 'w.ts': lines(20, { 3: 'the fix', 19: 'more upstream' }) });

    expect(summary).toMatch(/1 absorbed upstream/);
    expect(summary).toMatch(/0 conflict\(s\)/);
    expect(summary).toMatch(/0 merged/);
    await applyForReal();
    expect(fs.readFileSync(kit('w.ts'), 'utf-8')).toBe(lines(20, { 3: 'the fix', 19: 'more upstream' }));
  });

  it('counts a byte-identical absorption (converged) as absorbed too', async () => {
    writeKit('w.ts', 'export const w = 2;\n');
    const summary = await run({ 'w.ts': 'export const w = 1;\n' }, { 'w.ts': 'export const w = 2;\n' });
    expect(summary).toMatch(/1 absorbed upstream/);
    expect(patchFor('toolcrib/w.ts')).toBeUndefined();
  });

  it('reports a project-added file as kept, ignoring the lock/config files and __tests__ when tests are not installed', async () => {
    writeKit('w.ts', 'x\n');
    writeKit('mine/Gauge.tsx', 'export const Gauge = 1;\n');
    writeKit('.toolcrib-tests-config.json', '{}\n');
    writeKit('__tests__/mine.test.tsx', 'test\n');
    const summary = await run({ 'w.ts': 'x\n' }, { 'w.ts': 'x\n' });

    expect(summary).toMatch(/1 project-added/);
    expect(summary).toContain('toolcrib/mine/Gauge.tsx');
    expect(summary).not.toContain('__tests__/mine.test.tsx');
    expect(summary).not.toContain('toolcrib-lock');
    // never staged for change
    expect(patchFor('toolcrib/mine/Gauge.tsx')).toBeUndefined();
    expect(fs.readFileSync(kit('mine/Gauge.tsx'), 'utf-8')).toBe('export const Gauge = 1;\n');
  });

  it('includes __tests__ files that are not part of the kit in project-added when tests are installed', async () => {
    writeKit('.toolcrib-lock.json', JSON.stringify({ version: '1.0.0', testsVersion: '1.0.0' }, null, 2) + '\n');
    writeKit('__tests__/mine.test.tsx', 'test\n');
    writeKit('__tests__/Button.test.tsx', 'kit test\n');
    fetchTestsRelease.mockImplementation((v) =>
      Promise.resolve({ ...fakeRelease(v, { '__tests__/Button.test.tsx': 'kit test\n' }), config: { peerDependencies: {} } })
    );
    const summary = await run({ 'w.ts': 'x\n' }, { 'w.ts': 'x\n' });
    expect(summary).toMatch(/1 project-added/);
    expect(summary).toContain('toolcrib/__tests__/mine.test.tsx');
  });

  it('add/add collision with different content: markers staged, reported as a collision (not a plain conflict)', async () => {
    writeKit('Gauge.tsx', 'a\nb\nmine\nz\n');
    const summary = await run({ 'w.ts': 'x\n' }, { 'w.ts': 'x\n', 'Gauge.tsx': 'a\nb\ntheirs\nz\n' });

    const patch = patchFor('toolcrib/Gauge.tsx');
    expect(patch).toContain('<<<<<<< local');
    expect(patch).toContain('>>>>>>> v2.0.0');
    expect(summary).toMatch(/0 conflict\(s\), 1 collision\(s\)/);
    expect(fs.readFileSync(path.join(patchDir(), 'conflicts', 'Gauge.tsx.md'), 'utf-8')).toContain('Add/add collision');
    // Not counted as project-added: the new release ships it.
    expect(summary).toMatch(/0 project-added/);
  });

  it('add/add collision with identical content is simply absorbed', async () => {
    writeKit('Gauge.tsx', 'same\n');
    const summary = await run({ 'w.ts': 'x\n' }, { 'w.ts': 'x\n', 'Gauge.tsx': 'same\n' });
    expect(summary).toMatch(/1 absorbed upstream/);
    expect(summary).toMatch(/0 collision\(s\)/);
  });

  it('never line-merges a binary conflict: stages the upstream copy whole beside a note and leaves the local file alone', async () => {
    const local = Buffer.from([0x89, 0x50, 0x00, 0x01, 0xff, 0x10]);
    const original = Buffer.from([0x89, 0x50, 0x00, 0x01, 0xff, 0x00]);
    const upstream = Buffer.from([0x89, 0x50, 0x00, 0x01, 0xff, 0x20, 0xfe]);
    fs.writeFileSync(kit('logo.bin'), local);
    const summary = await run({ 'logo.bin': original }, { 'logo.bin': upstream });

    expect(patchFor('toolcrib/logo.bin')).toBeUndefined();
    expect(Buffer.compare(fs.readFileSync(path.join(patchDir(), 'conflicts', 'logo.bin.upstream')), upstream)).toBe(0);
    expect(fs.readFileSync(path.join(patchDir(), 'conflicts', 'logo.bin.md'), 'utf-8')).toContain('binary file');
    expect(Buffer.compare(fs.readFileSync(kit('logo.bin')), local)).toBe(0);
    expect(summary).toMatch(/1 conflict\(s\)/);
    expect(summary).toContain('[binary]');
  });

  it('treats invalid UTF-8 (no NUL byte) as binary too', async () => {
    const bad = (tail) => Buffer.concat([Buffer.from('text '), Buffer.from([0xc3, 0x28]), Buffer.from(tail)]);
    fs.writeFileSync(kit('odd.txt'), bad(' local'));
    await run({ 'odd.txt': bad(' base') }, { 'odd.txt': bad(' theirs') });
    expect(fs.existsSync(path.join(patchDir(), 'conflicts', 'odd.txt.upstream'))).toBe(true);
    expect(patchFor('toolcrib/odd.txt')).toBeUndefined();
  });

  it('merges a CRLF local file correctly and keeps it CRLF', async () => {
    writeKit('w.ts', crlf(lines(20, { 2: 'my tweak' })));
    const summary = await run({ 'w.ts': lines(20) }, { 'w.ts': lines(20, { 18: 'upstream edit' }) });
    expect(summary).toMatch(/1 merged/);

    await applyForReal();
    const bytes = fs.readFileSync(kit('w.ts'), 'utf-8');
    expect(bytes).toBe(crlf(lines(20, { 2: 'my tweak', 18: 'upstream edit' })));
    expect(bytes.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('keeps CRLF on a conflicted file too', async () => {
    writeKit('w.ts', crlf(lines(6, { 3: 'mine' })));
    await run({ 'w.ts': lines(6) }, { 'w.ts': lines(6, { 3: 'theirs' }) });
    await applyForReal();
    const bytes = fs.readFileSync(kit('w.ts'), 'utf-8');
    expect(bytes).toBe(crlf(lines(6).replace('line 3\n', '<<<<<<< local\nmine\n=======\ntheirs\n>>>>>>> v2.0.0\n')));
  });

  it('keeps a UTF-8 BOM on the local file through a clean merge', async () => {
    writeKit('w.ts', '﻿' + lines(20, { 2: 'my tweak' }));
    const summary = await run({ 'w.ts': lines(20) }, { 'w.ts': lines(20, { 18: 'upstream edit' }) });
    expect(summary).toMatch(/1 merged/);

    await applyForReal();
    const raw = fs.readFileSync(kit('w.ts'));
    expect(raw.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(true);
    expect(raw.subarray(3).toString('utf8')).toBe(lines(20, { 2: 'my tweak', 18: 'upstream edit' }));
  });

  it('keeps BOM and CRLF together', async () => {
    writeKit('w.ts', '﻿' + crlf(lines(20, { 2: 'my tweak' })));
    await run({ 'w.ts': lines(20) }, { 'w.ts': lines(20, { 18: 'upstream edit' }) });
    await applyForReal();
    expect(fs.readFileSync(kit('w.ts'), 'utf-8')).toBe('﻿' + crlf(lines(20, { 2: 'my tweak', 18: 'upstream edit' })));
  });

  it('a file deleted from the project but changed upstream is a conflict note, not a recreated file', async () => {
    const summary = await run({ 'gone.ts': 'a\n' }, { 'gone.ts': 'b\n' });
    expect(patchFor('toolcrib/gone.ts')).toBeUndefined();
    expect(fs.readFileSync(path.join(patchDir(), 'conflicts', 'gone.ts.md'), 'utf-8')).toContain('deleted from the project');
    expect(summary).toMatch(/1 conflict\(s\)/);
  });

  it('removed-upstream-edited-locally stays a note-only conflict and never writes into the kit', async () => {
    writeKit('old.ts', 'a edited\n');
    await run({ 'old.ts': 'a\n' }, { 'index.ts': 'export {};\n' });
    expect(patchFor('toolcrib/old.ts')).toBeUndefined();
    expect(fs.existsSync(path.join(patchDir(), 'conflicts', 'old.ts.md'))).toBe(true);
    // notes are never .patch files, so apply cannot write them into ./toolcrib/
    expect(fs.readdirSync(patchDir()).some((f) => f.endsWith('.upstream-diff'))).toBe(false);
  });

  it('prints every count in the summary', async () => {
    writeKit('w.ts', lines(20, { 2: 'my tweak' }));
    const summary = await run({ 'w.ts': lines(20) }, { 'w.ts': lines(20, { 18: 'upstream edit' }) });
    expect(summary).toMatch(
      /0 updated, 1 merged, 0 absorbed upstream, 0 kept-local, 0 project-added, 0 conflict\(s\), 0 collision\(s\), 0 removed/
    );
  });

  it('refuses to run over a non-empty ./toolcrib-patches/ and leaves it untouched', async () => {
    fs.mkdirSync(patchDir());
    fs.writeFileSync(path.join(patchDir(), '0001-a.patch'), 'unapplied');
    process.exitCode = undefined;

    await mergeCommand({ version: '2.0.0', mergeEngine });

    expect(process.exitCode).toBe(1);
    expect(fetchRelease).not.toHaveBeenCalled();
    expect(out.join('')).toContain('toolcrib apply');
    expect(fs.readdirSync(patchDir())).toEqual(['0001-a.patch']);
    process.exitCode = undefined;
  });

  it('proceeds over an existing but empty ./toolcrib-patches/', async () => {
    fs.mkdirSync(patchDir());
    writeKit('w.ts', 'x\n');
    await run({ 'w.ts': 'x\n' }, { 'w.ts': 'y\n' });
    expect(patchFor('toolcrib/w.ts')).toContain('+y');
  });
});

describe('apply + merge staging round trip', () => {
  let tmpDir;
  let originalCwd;
  let writeSpy;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolcrib-merge-roundtrip-test-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
    execFileSync('git', ['init', '-q'], { cwd: tmpDir });
    execFileSync('git', ['config', 'core.autocrlf', 'false'], { cwd: tmpDir });
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'x', dependencies: {}, imports: { '#toolcrib': './toolcrib/index.ts' } }, null, 2) + '\n');
    fs.mkdirSync(path.join(tmpDir, 'toolcrib'));
    fs.writeFileSync(path.join(tmpDir, 'toolcrib', '.toolcrib-lock.json'), JSON.stringify({ version: '1.0.0' }, null, 2) + '\n');
    vi.resetAllMocks();
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
    process.chdir(originalCwd);
    process.exitCode = undefined;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('apply writes the merged tree but leaves conflict notes (never into ./toolcrib/), and merge then refuses until the folder is deleted', async () => {
    fs.writeFileSync(path.join(tmpDir, 'toolcrib', 'w.ts'), lines(10, { 5: 'mine' }));
    const oldR = fakeRelease('1.0.0', { 'w.ts': lines(10) });
    const newR = fakeRelease('2.0.0', { 'w.ts': lines(10, { 5: 'theirs' }) });
    fetchRelease.mockImplementation((v) => Promise.resolve(v === '1.0.0' ? oldR : newR));
    await mergeCommand({ version: '2.0.0' });

    await applyCommand();

    const dir = path.join(tmpDir, 'toolcrib-patches');
    expect(fs.readdirSync(dir)).toEqual(['conflicts']); // applied patches gone, notes kept
    expect(fs.existsSync(path.join(dir, 'conflicts', 'w.ts.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'toolcrib', 'conflicts'))).toBe(false);
    expect(fs.readdirSync(path.join(tmpDir, 'toolcrib')).some((f) => f.endsWith('.md') || f.endsWith('.upstream-diff'))).toBe(false);
    expect(fs.readFileSync(path.join(tmpDir, 'toolcrib', 'w.ts'), 'utf-8')).toContain('<<<<<<< local');

    process.exitCode = undefined;
    fetchRelease.mockClear();
    await mergeCommand({ version: '3.0.0' });
    expect(process.exitCode).toBe(1);
    expect(fetchRelease).not.toHaveBeenCalled();
  });
});
