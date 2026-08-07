import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { proposeGitignore, proposeLockUpdate, readLock } from '../src/lib/project.js';

describe('proposeGitignore', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolcrib-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('proposes creating .gitignore when none exists', () => {
    const result = proposeGitignore(tmpDir);
    expect(result).not.toBeNull();
    expect(result.current).toBe('');
    expect(result.proposed).toContain('/toolcrib-patches/');
  });

  it('proposes appending the entry when .gitignore exists but lacks it', () => {
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), 'node_modules/\n');
    const result = proposeGitignore(tmpDir);
    expect(result.proposed).toContain('node_modules/');
    expect(result.proposed).toContain('/toolcrib-patches/');
  });

  it('returns null (no proposal) when the entry is already present — idempotent', () => {
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), 'node_modules/\n/toolcrib-patches/\n');
    const result = proposeGitignore(tmpDir);
    expect(result).toBeNull();
  });

  it('adds a leading newline only when the existing file lacks a trailing one', () => {
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), 'node_modules/'); // no trailing \n
    const result = proposeGitignore(tmpDir);
    expect(result.proposed).toBe('node_modules/\n/toolcrib-patches/\n');
  });
});

describe('lock file helpers', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolcrib-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('readLock returns null when no lock file exists', () => {
    expect(readLock(tmpDir)).toBeNull();
  });

  it('readLock reads back a previously written version', () => {
    fs.mkdirSync(path.join(tmpDir, 'toolcrib'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'toolcrib', '.toolcrib-lock.json'), JSON.stringify({ version: '1.4.0' }));
    expect(readLock(tmpDir)).toEqual({ version: '1.4.0' });
  });

  it('proposeLockUpdate proposes writing the new version when none exists', () => {
    const result = proposeLockUpdate(tmpDir, '1.5.0');
    expect(result.current).toBe('');
    expect(JSON.parse(result.proposed)).toEqual({ version: '1.5.0' });
  });

  // Regression test: git apply rejects paths with a leading "./" as
  // invalid ("error: invalid path './toolcrib/.toolcrib-lock.json'"),
  // discovered via a real end-to-end run against git apply, not by
  // inspection. Every relPath fed into PendingChanges must be
  // leading-dot-slash-free for its patch to actually be appliable.
  it('relPath has no leading "./" so the resulting patch is git-apply-compatible', () => {
    const result = proposeLockUpdate(tmpDir, '1.5.0');
    expect(result.relPath).not.toMatch(/^\.\//);
    expect(result.relPath).toBe('toolcrib/.toolcrib-lock.json');
  });
});
