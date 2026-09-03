import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveVendoredRoot, readLockInfo } from '../src/lib/localInstall.js';
import { buildFakeProject, cleanupFakeProject } from './fixtures.js';

describe('resolveVendoredRoot', () => {
  let projectRoot;

  afterEach(() => {
    if (projectRoot) cleanupFakeProject(projectRoot);
    projectRoot = undefined;
  });

  it('finds a vendored install directly under the given directory', () => {
    ({ projectRoot } = buildFakeProject());
    expect(resolveVendoredRoot(projectRoot)).toBe(path.join(projectRoot, 'toolcrib'));
  });

  it('walks upward from a nested subdirectory to find it', () => {
    ({ projectRoot } = buildFakeProject());
    const nested = path.join(projectRoot, 'src', 'components');
    expect(resolveVendoredRoot(nested)).toBe(path.join(projectRoot, 'toolcrib'));
  });

  it('returns null when no vendored install exists anywhere above', () => {
    // A real system temp/root path has no .toolcrib-lock.json anywhere
    // above it in any real environment this test could run in.
    expect(resolveVendoredRoot(path.join(os.tmpdir(), 'definitely-not-a-toolcrib-project'))).toBe(null);
  });
});

describe('readLockInfo', () => {
  let projectRoot, vendoredRoot;

  afterEach(() => {
    cleanupFakeProject(projectRoot);
  });

  it('reads the version from a real .toolcrib-lock.json', () => {
    ({ projectRoot, vendoredRoot } = buildFakeProject({ version: '0.12.0' }));
    expect(readLockInfo(vendoredRoot)).toEqual({ version: '0.12.0' });
  });

  it('returns null when the lock file is missing', () => {
    ({ projectRoot, vendoredRoot } = buildFakeProject());
    expect(readLockInfo(path.join(projectRoot, 'nonexistent'))).toBe(null);
  });

  it('returns null when the lock file is malformed JSON', () => {
    ({ projectRoot, vendoredRoot } = buildFakeProject());
    fs.writeFileSync(path.join(vendoredRoot, '.toolcrib-lock.json'), 'not json');
    expect(readLockInfo(vendoredRoot)).toBe(null);
  });

  it('returns null when the lock file is valid JSON but has no string version field', () => {
    ({ projectRoot, vendoredRoot } = buildFakeProject());
    fs.writeFileSync(path.join(vendoredRoot, '.toolcrib-lock.json'), JSON.stringify({ version: 12 }));
    expect(readLockInfo(vendoredRoot)).toBe(null);
  });
});
