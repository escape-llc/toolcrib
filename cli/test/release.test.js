import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// fetchRelease's own job is orchestration -- resolve version, download,
// extract, read config, return a reader object -- the same reason
// apply.test.js mocks git.js/patchFallback.js instead of exercising the
// real network/subprocess layers underneath. downloadReleaseZip/
// resolveVersion are network calls (mocked, same reason merge.test.js
// mocks lib/release.js elsewhere); extractZip shells out to a real
// platform binary (its own command construction is zip.test.js's own
// concern) so it's mocked here too, but its mock actually writes real
// files into the target dir, so fetchRelease's own subsequent
// readFile/allFiles logic has something real to find. listFilesRecursive
// is kept real (a pure fs function) via importOriginal.
vi.mock('../src/lib/github.js', () => ({
  resolveVersion: vi.fn(),
  downloadReleaseZip: vi.fn(),
}));
vi.mock('../src/lib/zip.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, extractZip: vi.fn() };
});

import { resolveVersion, downloadReleaseZip } from '../src/lib/github.js';
import { extractZip } from '../src/lib/zip.js';
import { fetchRelease } from '../src/lib/release.js';

describe('fetchRelease', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resolveVersion.mockResolvedValue('1.0.0');
    downloadReleaseZip.mockResolvedValue(Buffer.from('fake zip bytes'));
    // Simulates what a real extraction would produce: a config file plus
    // a couple of vendored files, written for real into targetDir.
    extractZip.mockImplementation(async (zipBuffer, targetDir) => {
      fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(path.join(targetDir, 'toolcrib.config.json'), JSON.stringify({ peerDependencies: {} }));
      fs.mkdirSync(path.join(targetDir, 'theme'), { recursive: true });
      fs.writeFileSync(path.join(targetDir, 'index.ts'), 'export {};\n');
      fs.writeFileSync(path.join(targetDir, 'theme', 'zIndex.ts'), 'export const Z = 1;\n');
    });
  });

  it('resolves the version and returns it on the result', async () => {
    const release = await fetchRelease('latest');
    expect(resolveVersion).toHaveBeenCalledWith('latest');
    expect(release.version).toBe('1.0.0');
    await release.cleanup();
  });

  it('parses and returns toolcrib.config.json as the config', async () => {
    extractZip.mockImplementation(async (zipBuffer, targetDir) => {
      fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(path.join(targetDir, 'toolcrib.config.json'), JSON.stringify({ peerDependencies: { react: '^18.0.0' } }));
    });

    const release = await fetchRelease('1.0.0');

    expect(release.config).toEqual({ peerDependencies: { react: '^18.0.0' } });
    await release.cleanup();
  });

  it('strips a UTF-8 BOM from toolcrib.config.json before parsing (same reason project.js does for the consumer\'s own files)', async () => {
    extractZip.mockImplementation(async (zipBuffer, targetDir) => {
      fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(path.join(targetDir, 'toolcrib.config.json'), '﻿' + JSON.stringify({ peerDependencies: {} }));
    });

    const release = await fetchRelease('1.0.0');

    expect(release.config).toEqual({ peerDependencies: {} });
    await release.cleanup();
  });

  it('readFile returns a vendored file\'s content, BOM-stripped', async () => {
    extractZip.mockImplementation(async (zipBuffer, targetDir) => {
      fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(path.join(targetDir, 'toolcrib.config.json'), JSON.stringify({ peerDependencies: {} }));
      fs.writeFileSync(path.join(targetDir, 'index.ts'), '﻿export {};\n');
    });

    const release = await fetchRelease('1.0.0');

    expect(release.readFile('index.ts')).toBe('export {};\n');
    await release.cleanup();
  });

  it('allFiles lists every extracted file except toolcrib.config.json itself', async () => {
    const release = await fetchRelease('1.0.0');

    const files = release.allFiles().sort();
    expect(files).toEqual(['index.ts', 'theme/zIndex.ts']);
    expect(files).not.toContain('toolcrib.config.json');
    await release.cleanup();
  });

  it('cleanup removes the temp directory entirely', async () => {
    let capturedTempDir;
    extractZip.mockImplementation(async (zipBuffer, targetDir) => {
      capturedTempDir = targetDir;
      fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(path.join(targetDir, 'toolcrib.config.json'), JSON.stringify({ peerDependencies: {} }));
    });

    const release = await fetchRelease('1.0.0');
    expect(fs.existsSync(capturedTempDir)).toBe(true);

    await release.cleanup();

    expect(fs.existsSync(capturedTempDir)).toBe(false);
  });

  it('extracts into a fresh temp directory each call, not a shared/reused one', async () => {
    const releaseA = await fetchRelease('1.0.0');
    const releaseB = await fetchRelease('1.0.0');

    await releaseA.cleanup();

    // If both calls had shared the same temp directory, releaseA's cleanup
    // would have deleted releaseB's files out from under it too.
    expect(() => releaseB.readFile('index.ts')).not.toThrow();
    await releaseB.cleanup();
  });
});
