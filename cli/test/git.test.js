import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createTwoFilesPatch } from 'diff';
import {
  isGitInstalled,
  isInsideGitRepo,
  gitInit,
  gitApplyStreaming,
  ensureGitRepo,
} from '../src/lib/git.js';

const execFileAsync = promisify(execFile);
const isWindows = process.platform === 'win32';

/**
 * Real git, not mocked child_process — matching this repo's own stated
 * philosophy (AGENTS.md: "prefer testing [CLI path/git-handling code]
 * against a real init/apply/doctor run... this exact class of bug is
 * invisible to [mocked] unit tests by construction"). git.js's entire job
 * is "wrap real git correctly" -- a mock would just assert the mock,
 * proving nothing about whether the actual subprocess invocation, cwd
 * handling, or exit-code interpretation is right.
 */
describe('git.js (real git subprocess)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolcrib-git-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('isGitInstalled resolves true when git is on PATH (true in every environment this suite runs in)', async () => {
    expect(await isGitInstalled()).toBe(true);
  });

  it('isInsideGitRepo is false for a plain directory with no .git', async () => {
    expect(await isInsideGitRepo(tmpDir)).toBe(false);
  });

  it('isInsideGitRepo is true once the directory has been git-initialized', async () => {
    await execFileAsync('git', ['init'], { cwd: tmpDir, shell: isWindows });
    expect(await isInsideGitRepo(tmpDir)).toBe(true);
  });

  it('gitInit creates a real .git directory and reports ok', async () => {
    const result = await gitInit(tmpDir);
    expect(result.ok).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.git'))).toBe(true);
  });

  describe('gitApplyStreaming', () => {
    beforeEach(async () => {
      await execFileAsync('git', ['init'], { cwd: tmpDir, shell: isWindows });
    });

    it('applies a real, valid patch and reports success', async () => {
      fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'old content\n');
      const patch = createTwoFilesPatch('a/file.txt', 'b/file.txt', 'old content\n', 'new content\n', '(current)', '(proposed)');
      const patchPath = path.join(tmpDir, 'the.patch');
      fs.writeFileSync(patchPath, patch);

      const result = await gitApplyStreaming(patchPath, tmpDir);

      expect(result).toEqual({ success: true });
      expect(fs.readFileSync(path.join(tmpDir, 'file.txt'), 'utf-8')).toBe('new content\n');
    });

    it('applies a real deletion patch (target /dev/null) by removing the file', async () => {
      fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'content\n');
      const patch = createTwoFilesPatch('a/file.txt', '/dev/null', 'content\n', '', '(current)', undefined);
      const patchPath = path.join(tmpDir, 'the.patch');
      fs.writeFileSync(patchPath, patch);

      const result = await gitApplyStreaming(patchPath, tmpDir);

      expect(result).toEqual({ success: true });
      expect(fs.existsSync(path.join(tmpDir, 'file.txt'))).toBe(false);
    });

    it('reports failure with a real git error message when the patch does not apply cleanly', async () => {
      fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'completely different content\n');
      const patch = createTwoFilesPatch('a/file.txt', 'b/file.txt', 'old content\n', 'new content\n', '(current)', '(proposed)');
      const patchPath = path.join(tmpDir, 'the.patch');
      fs.writeFileSync(patchPath, patch);

      const result = await gitApplyStreaming(patchPath, tmpDir);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      // Content is untouched -- a failed apply must not partially mutate the file.
      expect(fs.readFileSync(path.join(tmpDir, 'file.txt'), 'utf-8')).toBe('completely different content\n');
    });

    it('reports failure when the patch file itself does not exist', async () => {
      const result = await gitApplyStreaming(path.join(tmpDir, 'nonexistent.patch'), tmpDir);
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe('ensureGitRepo', () => {
    it('returns true immediately, without calling confirmFn, when already inside a git repo', async () => {
      await execFileAsync('git', ['init'], { cwd: tmpDir, shell: isWindows });
      let confirmCalled = false;
      const confirmFn = async () => {
        confirmCalled = true;
        return true;
      };

      const result = await ensureGitRepo(tmpDir, { confirmFn });

      expect(result).toBe(true);
      expect(confirmCalled).toBe(false);
    });

    it('initializes a new repo and returns true when confirmFn approves', async () => {
      const confirmFn = async () => true;

      const result = await ensureGitRepo(tmpDir, { confirmFn });

      expect(result).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, '.git'))).toBe(true);
    });

    it('returns false without initializing a repo when confirmFn declines', async () => {
      const confirmFn = async () => false;

      const result = await ensureGitRepo(tmpDir, { confirmFn });

      expect(result).toBe(false);
      expect(fs.existsSync(path.join(tmpDir, '.git'))).toBe(false);
    });
  });
});
