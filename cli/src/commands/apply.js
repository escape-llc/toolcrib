import fs from 'node:fs';
import path from 'node:path';
import * as p from '@clack/prompts';
import { PATCH_DIR } from '../lib/patches.js';
import { isGitInstalled, ensureGitRepo, gitApplyStreaming } from '../lib/git.js';
import { applyPatchFallback } from '../lib/patchFallback.js';

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
    p.outro('No pending patches.');
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

  // Delete the entire staging directory unconditionally, whether patches
  // succeeded or failed — no stale state persists between runs. A failed
  // patch isn't "saved for later"; the next init/merge recomputes the
  // diff fresh against current reality, which is more likely to produce
  // something applicable than retrying an identical stale patch.
  fs.rmSync(patchDir, { recursive: true, force: true });

  p.log.success(`Applied ${succeeded.length} of ${patchFiles.length} patch(es).`);
  if (failed.length > 0) {
    p.log.warn(
      `${failed.length} patch(es) failed and were discarded.\n` +
        `Re-run 'toolcrib init' or 'toolcrib merge' to regenerate them against current state.`
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
