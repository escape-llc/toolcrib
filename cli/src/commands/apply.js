import fs from 'node:fs';
import path from 'node:path';
import * as p from '@clack/prompts';
import { PATCH_DIR } from '../lib/patches.js';
import { isGitInstalled, ensureGitRepo, gitApplyStreaming } from '../lib/git.js';
import { applyPatchFallback } from '../lib/patchFallback.js';
import { listFilesRecursive } from '../lib/zip.js';

/** Every file left under the staging folder, forward-slash, relative to it. */
function listStaged(dir) {
  return listFilesRecursive(dir);
}

export async function applyCommand() {
  const projectRoot = process.cwd();
  const patchDir = path.join(projectRoot, PATCH_DIR);

  p.intro('toolcrib apply');

  if (!fs.existsSync(patchDir)) {
    p.outro('No pending patches. Run `toolcrib init` or `toolcrib merge` first.');
    return;
  }

  const patchFiles = fs
    .readdirSync(patchDir)
    .filter((f) => f.endsWith('.patch'))
    .sort() // numbered filenames give a stable, predictable apply order
    .map((f) => path.join(patchDir, f));

  if (patchFiles.length === 0) {
    const staged = listStaged(patchDir);
    // Only empty folders left (every note resolved and deleted): clear them.
    if (staged.length === 0) fs.rmSync(patchDir, { recursive: true, force: true });
    p.outro(
      staged.length > 0
        ? `No pending patches. ./toolcrib-patches/ still holds ${staged.length} note/upstream-copy file(s) from a merge; resolve them, then delete the folder.`
        : 'No pending patches.'
    );
    return;
  }

  // p.confirm() requires a real interactive TTY — it throws a raw libuv
  // error (not a catchable "no TTY" message) when stdin isn't one, which
  // happens in CI, scripted usage, and various sandboxed environments.
  // In that case, default to "yes" for git init specifically: it's a safe,
  // recoverable, expected action (see ensureGitRepo), not a destructive one,
  // so silently proceeding is preferable to crashing on a routine setup step.
  const isInteractive = process.stdin.isTTY && process.stdout.isTTY;
  const confirmFn = async (message) => {
    if (!isInteractive) {
      p.log.info(`${message} (no interactive terminal detected — proceeding automatically)`);
      return true;
    }
    const result = await p.confirm({ message });
    return result === true;
  };

  const gitAvailable = await isGitInstalled();
  const repoReady = gitAvailable && (await ensureGitRepo(projectRoot, { confirmFn }));

  const succeeded = [];
  const failed = [];

  for (const patchFile of patchFiles) {
    p.log.step(`Applying ${path.basename(patchFile)}`);

    const result = repoReady
      ? await gitApplyStreaming(patchFile, projectRoot)
      : applyPatchFallback(patchFile, projectRoot);

    if (result.success) {
      succeeded.push(patchFile);
    } else {
      failed.push({ patchFile, error: result.error });
      p.log.error(`  ${result.error || 'unknown error'}`);
    }
  }

  // Staging safety: nothing that hasn't been dealt with is ever deleted.
  // Patches that applied are done, so they're removed (re-running apply
  // would only fail on them). A failed patch stays, and so does everything
  // else staged beside the patches (conflict notes, binary upstream copies):
  // those are the user's work-in-progress, and `merge`/`init` refuse to run
  // over a non-empty folder precisely so they can't be lost.
  for (const patchFile of succeeded) fs.rmSync(patchFile, { force: true });
  const remaining = listStaged(patchDir);
  if (remaining.length === 0) fs.rmSync(patchDir, { recursive: true, force: true });

  p.log.success(`Applied ${succeeded.length} of ${patchFiles.length} patch(es).`);
  if (failed.length > 0) {
    p.log.warn(
      `${failed.length} patch(es) failed and were kept in ./toolcrib-patches/ (nothing was deleted):\n` +
        failed.map((f) => `  ${path.basename(f.patchFile)}${f.error ? ` — ${f.error.split('\n')[0]}` : ''}`).join('\n') +
        `\nFix the cause and re-run 'toolcrib apply', or delete the folder and run 'toolcrib merge' again to regenerate them.`
    );
  }
  const notes = remaining.filter((f) => !f.endsWith('.patch'));
  if (notes.length > 0) {
    p.log.info(
      `${notes.length} staged file(s) were not applied (they are notes and upstream copies, never written into ./toolcrib/):\n` +
        notes.map((f) => `  ./toolcrib-patches/${f}`).join('\n') +
        `\nResolve what they describe, then delete ./toolcrib-patches/. 'toolcrib merge' will not run until it's gone.`
    );
  }

  if (!repoReady) {
    p.log.info(
      gitAvailable
        ? 'Applied using the built-in fallback (no git repository).'
        : 'git was not found — applied using the built-in fallback.'
    );
  }

  p.outro('Done.');
}
