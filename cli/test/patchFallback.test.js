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
