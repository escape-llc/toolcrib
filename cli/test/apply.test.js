import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// apply.js's own job is orchestration -- read the patch dir, dispatch each
// file to git-or-fallback, track results, clean up. How git.js actually
// wraps real git is git.test.js's own concern (tested there against real
// git); how patchFallback.js actually applies a patch without git is
// patchFallback.test.js's own concern. Mocking both dependencies here tests
// apply.js's own logic in isolation, the same reason merge.test.js mocks
// lib/release.js instead of hitting the network.
vi.mock('../src/lib/git.js', () => ({
  isGitInstalled: vi.fn(),
  ensureGitRepo: vi.fn(),
  gitApplyStreaming: vi.fn(),
}));
vi.mock('../src/lib/patchFallback.js', () => ({
  applyPatchFallback: vi.fn(),
}));

import { isGitInstalled, ensureGitRepo, gitApplyStreaming } from '../src/lib/git.js';
import { applyPatchFallback } from '../src/lib/patchFallback.js';
import { applyCommand } from '../src/commands/apply.js';

describe('applyCommand', () => {
  let tmpDir;
  let originalCwd;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolcrib-apply-test-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
    vi.resetAllMocks();
    // Default: git available and already a real repo -- the common case --
    // individual tests override for the fallback/no-repo scenarios.
    isGitInstalled.mockResolvedValue(true);
    ensureGitRepo.mockResolvedValue(true);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writePatch(name, content = 'patch content\n') {
    fs.mkdirSync(path.join(tmpDir, 'toolcrib-patches'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'toolcrib-patches', name), content);
  }

  it('does nothing when the patches directory does not exist at all', async () => {
    await applyCommand();
    expect(gitApplyStreaming).not.toHaveBeenCalled();
    expect(applyPatchFallback).not.toHaveBeenCalled();
  });

  it('does nothing when the patches directory exists but has no .patch files', async () => {
    fs.mkdirSync(path.join(tmpDir, 'toolcrib-patches'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'toolcrib-patches', 'readme.txt'), 'not a patch');

    await applyCommand();

    expect(gitApplyStreaming).not.toHaveBeenCalled();
    expect(applyPatchFallback).not.toHaveBeenCalled();
    // Non-.patch files are irrelevant, but the dir itself is left alone
    // when there's nothing this command actually did.
    expect(fs.existsSync(path.join(tmpDir, 'toolcrib-patches'))).toBe(true);
  });

  it('applies every .patch file via git when a real repo is available, then removes the patch dir', async () => {
    writePatch('0001-a.patch');
    writePatch('0002-b.patch');
    gitApplyStreaming.mockResolvedValue({ success: true });

    await applyCommand();

    expect(gitApplyStreaming).toHaveBeenCalledTimes(2);
    expect(applyPatchFallback).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(tmpDir, 'toolcrib-patches'))).toBe(false);
  });

  it('applies in numbered-filename sort order, not directory listing order', async () => {
    // Written out of order -- readdirSync's own order isn't guaranteed to
    // match creation order, which is exactly why apply.js sorts explicitly.
    writePatch('0002-b.patch');
    writePatch('0001-a.patch');
    writePatch('0010-c.patch');
    gitApplyStreaming.mockResolvedValue({ success: true });

    await applyCommand();

    const calledPaths = gitApplyStreaming.mock.calls.map((call) => path.basename(call[0]));
    expect(calledPaths).toEqual(['0001-a.patch', '0002-b.patch', '0010-c.patch']);
  });

  it('auto-confirms git init through the real confirmFn closure when stdin is not a TTY (always true in a test process)', async () => {
    // Exercises apply.js's own confirmFn closure for real (not just the
    // mocked ensureGitRepo's return value) -- it's what actually decides
    // whether to silently proceed with `git init` or prompt interactively,
    // and process.stdin.isTTY is reliably falsy in a vitest run, so the
    // "no interactive terminal" branch is the one worth proving works.
    let capturedConfirmFn;
    ensureGitRepo.mockImplementation(async (cwd, { confirmFn }) => {
      capturedConfirmFn = confirmFn;
      return confirmFn('No git repository found here. Initialize one now?');
    });
    writePatch('0001-a.patch');
    gitApplyStreaming.mockResolvedValue({ success: true });

    await applyCommand();

    expect(await capturedConfirmFn('any message')).toBe(true);
    // ensureGitRepo's own return value (from calling confirmFn) drove
    // repoReady -- confirmed by gitApplyStreaming (not the fallback) being used.
    expect(gitApplyStreaming).toHaveBeenCalledTimes(1);
    expect(applyPatchFallback).not.toHaveBeenCalled();
  });

  it('falls back to applyPatchFallback when no git repo is available', async () => {
    ensureGitRepo.mockResolvedValue(false);
    writePatch('0001-a.patch');
    applyPatchFallback.mockReturnValue({ success: true });

    await applyCommand();

    expect(applyPatchFallback).toHaveBeenCalledTimes(1);
    expect(gitApplyStreaming).not.toHaveBeenCalled();
  });

  it('falls back to applyPatchFallback when git itself is not installed (ensureGitRepo never even called)', async () => {
    isGitInstalled.mockResolvedValue(false);
    writePatch('0001-a.patch');
    applyPatchFallback.mockReturnValue({ success: true });

    await applyCommand();

    expect(ensureGitRepo).not.toHaveBeenCalled();
    expect(applyPatchFallback).toHaveBeenCalledTimes(1);
    expect(gitApplyStreaming).not.toHaveBeenCalled();
  });

  it('counts successes and failures independently and still removes the patch dir when some fail', async () => {
    writePatch('0001-a.patch');
    writePatch('0002-b.patch');
    writePatch('0003-c.patch');
    gitApplyStreaming
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, error: 'hunk failed' })
      .mockResolvedValueOnce({ success: true });

    await applyCommand();

    expect(gitApplyStreaming).toHaveBeenCalledTimes(3);
    // A failed patch isn't "saved for later" -- the whole staging dir is
    // discarded regardless of individual outcomes (see apply.js's own
    // comment on why: the next init/merge recomputes fresh anyway).
    expect(fs.existsSync(path.join(tmpDir, 'toolcrib-patches'))).toBe(false);
  });

  it('only considers files ending in .patch, ignoring anything else staged alongside them', async () => {
    writePatch('0001-a.patch');
    fs.writeFileSync(path.join(tmpDir, 'toolcrib-patches', 'notes.md'), 'not a patch');
    gitApplyStreaming.mockResolvedValue({ success: true });

    await applyCommand();

    expect(gitApplyStreaming).toHaveBeenCalledTimes(1);
  });
});
