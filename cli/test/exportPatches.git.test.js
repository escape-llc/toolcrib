import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

vi.mock('../src/lib/release.js', () => ({
  fetchRelease: vi.fn(),
  fetchTestsRelease: vi.fn(),
}));

import { fetchRelease } from '../src/lib/release.js';
import { exportPatchesCommand } from '../src/commands/exportPatches.js';
import { releaseFixture, localFixture } from './helpers/exportFixture.js';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

function writeTree(root, files, prefix = '') {
  for (const [relPath, content] of Object.entries(files)) {
    const target = path.join(root, prefix, ...relPath.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
}

function fakeRelease(version, files) {
  return {
    version,
    config: {},
    readFile: (relPath) => files[relPath],
    allFiles: () => Object.keys(files),
    cleanup: async () => {},
  };
}

describe('exportPatchesCommand — real git apply', () => {
  let tmp;
  let project;
  let upstream;
  let out;
  let originalCwd;

  beforeEach(() => {
    vi.resetAllMocks();
    originalCwd = process.cwd();
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'toolcrib-export-test-'));
    project = path.join(tmp, 'project');
    upstream = path.join(tmp, 'upstream');
    out = path.join(tmp, 'out');
    fs.mkdirSync(project);
    fs.mkdirSync(upstream);

    writeTree(project, localFixture(), 'toolcrib');
    fs.writeFileSync(path.join(project, 'toolcrib', '.toolcrib-lock.json'), JSON.stringify({ version: '1.0.0' }));
    process.chdir(project);

    git(upstream, 'init', '-q');
    git(upstream, 'config', 'user.email', 't@example.com');
    git(upstream, 'config', 'user.name', 't');
    git(upstream, 'config', 'core.autocrlf', 'false');
    writeTree(upstream, releaseFixture(), 'src');
    git(upstream, 'add', '-A');
    git(upstream, 'commit', '-q', '-m', 'base');

    fetchRelease.mockResolvedValue(fakeRelease('1.0.0', releaseFixture()));
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('writes contributions whose patches each apply to the base tag on their own', async () => {
    await exportPatchesCommand({ out });

    const folders = fs.readdirSync(out).filter((f) => /^\d\d-/.test(f)).sort();
    expect(folders).toEqual(['01-Card', '02-Gauge', '03-useRetry']);
    expect(fs.existsSync(path.join(out, 'README.md'))).toBe(true);
    expect(fs.existsSync(path.join(out, '.toolcrib-export'))).toBe(true);

    for (const folder of folders) {
      git(upstream, 'checkout', '-q', '--', '.');
      git(upstream, 'clean', '-fdq');
      const patches = fs.readdirSync(path.join(out, folder)).filter((f) => f.endsWith('.patch')).sort();
      expect(patches.length).toBeGreaterThan(0);
      expect(fs.existsSync(path.join(out, folder, 'SUMMARY.md'))).toBe(true);
      for (const patch of patches) git(upstream, 'apply', '--check', path.join(out, folder, patch));
      for (const patch of patches) git(upstream, 'apply', path.join(out, folder, patch));

      if (folder === '02-Gauge') {
        const bus = fs.readFileSync(path.join(upstream, 'src', 'eventBus', 'eventBus.ts'), 'utf8');
        expect(bus).toContain("'gauge:changed'");
        expect(bus).not.toContain('myapp:thing');
        expect(bus).not.toContain('gauge:reset');
        expect(fs.existsSync(path.join(upstream, 'src', 'theme', 'gaugeMath.ts'))).toBe(true);
      }
    }
  });

  it('writes nothing when the tree matches the release', async () => {
    writeTree(project, releaseFixture(), 'toolcrib');
    fs.rmSync(path.join(project, 'toolcrib', 'components', 'Gauge'), { recursive: true });
    fs.rmSync(path.join(project, 'toolcrib', 'theme', 'gaugeMath.ts'));
    fs.rmSync(path.join(project, 'toolcrib', 'observer', 'useRetry.ts'));
    fs.rmSync(path.join(project, 'toolcrib', '__tests__'), { recursive: true });
    await exportPatchesCommand({ out });
    expect(fs.existsSync(out)).toBe(false);
  });

  it('refuses to clear a non-empty output directory it did not create', async () => {
    fs.mkdirSync(out);
    fs.writeFileSync(path.join(out, 'precious.txt'), 'keep');
    await exportPatchesCommand({ out });
    expect(fs.readFileSync(path.join(out, 'precious.txt'), 'utf8')).toBe('keep');
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });

  it('replaces an earlier export it created', async () => {
    await exportPatchesCommand({ out });
    fs.writeFileSync(path.join(out, 'stale.txt'), 'old');
    await exportPatchesCommand({ out });
    expect(fs.existsSync(path.join(out, 'stale.txt'))).toBe(false);
    expect(fs.existsSync(path.join(out, '01-Card'))).toBe(true);
  });

  it('errors without a lock file', async () => {
    fs.rmSync(path.join(project, 'toolcrib', '.toolcrib-lock.json'));
    await exportPatchesCommand({ out });
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
    expect(fetchRelease).not.toHaveBeenCalled();
  });
});
