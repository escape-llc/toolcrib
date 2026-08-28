import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createTwoFilesPatch } from 'diff';
import { applyPatchFallback } from '../src/lib/patchFallback.js';

describe('applyPatchFallback', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolcrib-patchfallback-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('applies a new-file patch inside the project root', () => {
    const patch = createTwoFilesPatch('/dev/null', 'b/toolcrib/index.ts', '', 'export {};\n', undefined, '(new file)');
    const patchPath = path.join(tmpDir, 'the.patch');
    fs.writeFileSync(patchPath, patch);

    const result = applyPatchFallback(patchPath, tmpDir);

    expect(result).toEqual({ success: true });
    expect(fs.readFileSync(path.join(tmpDir, 'toolcrib', 'index.ts'), 'utf-8')).toBe('export {};\n');
  });

  it('applies a modification patch against existing content', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{\n  "name": "x"\n}\n');
    const patch = createTwoFilesPatch(
      'a/package.json',
      'b/package.json',
      '{\n  "name": "x"\n}\n',
      '{\n  "name": "y"\n}\n',
      '(current)',
      '(proposed)'
    );
    const patchPath = path.join(tmpDir, 'the.patch');
    fs.writeFileSync(patchPath, patch);

    const result = applyPatchFallback(patchPath, tmpDir);

    expect(result).toEqual({ success: true });
    expect(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf-8')).toBe('{\n  "name": "y"\n}\n');
  });

  it('reports failure when the patch does not apply cleanly', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{\n  "name": "completely different"\n}\n');
    const patch = createTwoFilesPatch(
      'a/package.json',
      'b/package.json',
      '{\n  "name": "x"\n}\n',
      '{\n  "name": "y"\n}\n',
      '(current)',
      '(proposed)'
    );
    const patchPath = path.join(tmpDir, 'the.patch');
    fs.writeFileSync(patchPath, patch);

    const result = applyPatchFallback(patchPath, tmpDir);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/did not apply cleanly/);
  });

  it('applies a deletion patch by removing the target file', () => {
    fs.mkdirSync(path.join(tmpDir, 'theme'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'theme', 'useAnimatedMount.ts'), 'export function useAnimatedMount() {}\n');
    const patch = createTwoFilesPatch(
      'a/theme/useAnimatedMount.ts',
      '/dev/null',
      'export function useAnimatedMount() {}\n',
      '',
      '(current)',
      undefined
    );
    const patchPath = path.join(tmpDir, 'the.patch');
    fs.writeFileSync(patchPath, patch);

    const result = applyPatchFallback(patchPath, tmpDir);

    expect(result).toEqual({ success: true });
    expect(fs.existsSync(path.join(tmpDir, 'theme', 'useAnimatedMount.ts'))).toBe(false);
  });

  it('treats a deletion patch as already-satisfied (not a failure) when the target is already gone', () => {
    // Re-running `apply` after a prior partial run, or a target a human
    // already deleted by hand — the end state the patch wants is already
    // true, so this should succeed as a no-op rather than error trying to
    // remove a file that isn't there.
    const patch = createTwoFilesPatch(
      'a/theme/useAnimatedMount.ts',
      '/dev/null',
      'export function useAnimatedMount() {}\n',
      '',
      '(current)',
      undefined
    );
    const patchPath = path.join(tmpDir, 'the.patch');
    fs.writeFileSync(patchPath, patch);

    const result = applyPatchFallback(patchPath, tmpDir);

    expect(result).toEqual({ success: true });
  });

  it('refuses to delete outside the project root (same containment guard as writes)', () => {
    // One level up (to os.tmpdir() itself, tmpDir's own direct parent), not
    // two -- unlike the sibling "refuses to write" test below, this one
    // actually needs to write the pre-existing file being "protected"
    // before the guard can prove it wasn't deleted, and two levels up from
    // a Linux CI runner's shallow /tmp/xxx path lands at the filesystem
    // root, which the runner has no write permission to at all (confirmed
    // directly: this exact test failed in CI with EACCES on that write,
    // while passing locally on Windows where two levels up still resolves
    // somewhere writable). os.tmpdir() itself is writable everywhere.
    const patch = createTwoFilesPatch(
      'a/../outside.txt',
      '/dev/null',
      'do not delete me\n',
      '',
      '(current)',
      undefined
    );
    const patchPath = path.join(tmpDir, 'the.patch');
    fs.writeFileSync(patchPath, patch);
    const outsidePath = path.join(tmpDir, '..', 'outside.txt');
    fs.writeFileSync(outsidePath, 'do not delete me\n');

    try {
      const result = applyPatchFallback(patchPath, tmpDir);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/outside the project root/);
      expect(fs.existsSync(outsidePath)).toBe(true);
    } finally {
      fs.rmSync(outsidePath, { force: true });
    }
  });

  it('refuses to write outside the project root (regression: no containment check)', () => {
    // A patch header path is normally always one of this CLI's own vendored
    // relPaths or fixed strings — never attacker-controlled — but nothing
    // previously stopped applyPatchFallback from writing wherever a patch
    // header said to, regardless of source. This simulates a corrupted or
    // tampered patch file to confirm the containment guard actually holds.
    const escapePath = 'b/../../outside.txt';
    const patch = createTwoFilesPatch('/dev/null', escapePath, '', 'malicious content\n', undefined, '(new file)');
    const patchPath = path.join(tmpDir, 'the.patch');
    fs.writeFileSync(patchPath, patch);

    const result = applyPatchFallback(patchPath, tmpDir);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/outside the project root/);
    expect(fs.existsSync(path.join(tmpDir, '..', '..', 'outside.txt'))).toBe(false);
  });
});
