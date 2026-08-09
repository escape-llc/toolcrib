import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { proposeGitignore, proposeLockUpdate, readLock, readGitignoreFenceVersion } from '../src/lib/project.js';

describe('proposeGitignore', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolcrib-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('proposes creating .gitignore when none exists', () => {
    const result = proposeGitignore(tmpDir, '0.1.0');
    expect(result).not.toBeNull();
    expect(result.current).toBe('');
    expect(result.proposed).toContain('/toolcrib-patches/');
  });

  it('wraps the proposed entries in a versioned fence so a later version can update them in place', () => {
    const result = proposeGitignore(tmpDir, '0.1.0');
    expect(result.proposed.startsWith('# toolcrib:managed:gitignore:start version=0.1.0\n')).toBe(true);
    expect(result.proposed).toContain('/toolcrib-patches/');
    expect(result.proposed.endsWith('# toolcrib:managed:gitignore:end\n')).toBe(true);
  });

  it('proposes appending the fenced block when .gitignore exists but lacks it', () => {
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), 'node_modules/\n');
    const result = proposeGitignore(tmpDir, '0.1.0');
    expect(result.proposed).toContain('node_modules/');
    expect(result.proposed).toContain('/toolcrib-patches/');
    expect(result.proposed).toContain('# toolcrib:managed:gitignore:start version=0.1.0');
  });

  it('returns null (no proposal) when the same version is already fenced in — idempotent', () => {
    const gitignorePath = path.join(tmpDir, '.gitignore');
    fs.writeFileSync(gitignorePath, 'node_modules/\n');
    // Seed with a real proposeGitignore() output rather than a hand-written
    // fixture — hardcoding the fence's exact text (including the banner
    // line) here would silently stop testing anything the moment that
    // wording changes.
    fs.writeFileSync(gitignorePath, proposeGitignore(tmpDir, '0.1.0').proposed);

    const result = proposeGitignore(tmpDir, '0.1.0');
    expect(result).toBeNull();
  });

  it('proposes replacing just the fenced span when upgrading to a new version', () => {
    const gitignorePath = path.join(tmpDir, '.gitignore');
    fs.writeFileSync(gitignorePath, 'node_modules/\n');
    fs.writeFileSync(gitignorePath, proposeGitignore(tmpDir, '0.1.0').proposed);

    const result = proposeGitignore(tmpDir, '0.2.0');
    expect(result.proposed).toContain('node_modules/'); // untouched
    expect(result.proposed).toContain('# toolcrib:managed:gitignore:start version=0.2.0');
    expect(result.proposed).not.toContain('version=0.1.0');
  });
});

describe('readGitignoreFenceVersion', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolcrib-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null when .gitignore has no managed fence', () => {
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), 'node_modules/\n');
    expect(readGitignoreFenceVersion(tmpDir)).toBeNull();
  });

  it('returns the fenced version when present', () => {
    const { proposed } = proposeGitignore(tmpDir, '0.3.1');
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), proposed);
    expect(readGitignoreFenceVersion(tmpDir)).toBe('0.3.1');
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
