import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { assertValidVersion } from '../src/lib/version.js';
import { assetUrl } from '../src/lib/github.js';
import { readLock } from '../src/lib/project.js';
import { listManagedBlocks, buildManagedBlock } from '../src/lib/managedDocs.js';

const BAD = [
  '1/../../x',
  '0.17.0/../../attacker/repo/releases/download/v1',
  '',
  'v0.17.0',
  '0.17.0 ',
  '0.17 .0',
  '0.17.0%2f..',
  undefined,
];

describe('assertValidVersion', () => {
  it('accepts plain and prerelease semver', () => {
    expect(assertValidVersion('0.17.0', 'x')).toBe('0.17.0');
    expect(assertValidVersion('1.2.3-beta.1', 'x')).toBe('1.2.3-beta.1');
  });

  it.each(BAD)('rejects %j and names the source', (bad) => {
    expect(() => assertValidVersion(bad, 'the-source')).toThrow(/the-source/);
  });
});

describe('assetUrl', () => {
  it('builds a URL for a valid version and for latest', () => {
    expect(assetUrl('0.17.0', 'toolcrib.zip')).toMatch(/\/download\/v0\.17\.0\/toolcrib\.zip$/);
    expect(assetUrl('latest', 'toolcrib.zip')).toMatch(/\/latest\/download\/toolcrib\.zip$/);
  });

  it.each(BAD)('refuses a bad version %j', (bad) => {
    expect(() => assetUrl(bad, 'toolcrib.zip')).toThrow(/Invalid version/);
  });
});

describe('readLock', () => {
  it('fails with a clear error on a tampered version', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'toolcrib-lock-test-'));
    try {
      fs.mkdirSync(path.join(root, 'toolcrib'));
      fs.writeFileSync(
        path.join(root, 'toolcrib', '.toolcrib-lock.json'),
        JSON.stringify({ version: '1/../../../../attacker/repo/releases/download/v1' })
      );
      expect(() => readLock(root)).toThrow(/Invalid version.*\.toolcrib-lock\.json/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('managed block version', () => {
  it('rejects a tampered version attribute', () => {
    const good = buildManagedBlock('core', '1.0.0', 'x');
    expect(listManagedBlocks(good)).toHaveLength(1);
    const bad = buildManagedBlock('core', '1/../../evil', 'x');
    expect(() => listManagedBlocks(bad)).toThrow(/managed block "core"/);
  });
});
